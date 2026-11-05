// Reports — async port of backend/app/api/reports/[type]/route.js. Q = q(env.DB) from db.js
import { SELECT_VEHICLE, COST_SQL, PROFIT_SQL } from './db.js';

function range(col, p) {
  const sql = [], args = [];
  if (p.get('from')) { sql.push(`${col} >= ?`); args.push(p.get('from')); }
  if (p.get('to')) { sql.push(`${col} <= ?`); args.push(p.get('to')); }
  return { sql: sql.map(s => ' AND ' + s).join(''), args };
}

// IN / OUT / revenue / profit for each of the last n calendar months (zero-filled).
// Workers run in UTC; month boundaries are close enough for a 6-month trend.
async function lastMonths(Q, n) {
  const d = new Date();
  const keys = Array.from({ length: n }, (_, i) => {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (n - 1 - i), 1));
    return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [ins, outs] = await Promise.all([
    Q.all(`SELECT substr(purchase_date,1,7) m, COUNT(*) c FROM vehicles WHERE substr(purchase_date,1,7) >= ? GROUP BY m`, keys[0]),
    Q.all(`SELECT substr(sale_date,1,7) m, COUNT(*) c, SUM(sale_price) rev, SUM(${PROFIT_SQL}) p
      FROM vehicles WHERE status='Sold' AND substr(sale_date,1,7) >= ? GROUP BY m`, keys[0]),
  ]);
  const inMap = Object.fromEntries(ins.map(r => [r.m, r.c]));
  const outMap = Object.fromEntries(outs.map(r => [r.m, r]));
  return keys.map(k => ({ month: k, in: inMap[k] || 0, out: outMap[k]?.c || 0, revenue: outMap[k]?.rev || 0, profit: outMap[k]?.p || 0 }));
}

// Resolves an object of promises into an object of values
const props = async o => Object.fromEntries(await Promise.all(Object.entries(o).map(async ([k, v]) => [k, await v])));

export const reports = {
  async dashboard(Q) {
    const month = new Date().toISOString().slice(0, 7);
    const r = await props({
      byStatus: Q.all(`SELECT status, COUNT(*) count, SUM(${COST_SQL}) cost FROM vehicles GROUP BY status`),
      stock: Q.one(`SELECT COUNT(*) count, IFNULL(SUM(${COST_SQL}),0) cost FROM vehicles WHERE status <> 'Sold'`),
      sold: Q.one(`SELECT COUNT(*) count, IFNULL(SUM(sale_price),0) revenue, IFNULL(SUM(${PROFIT_SQL}),0) profit FROM vehicles WHERE status='Sold'`),
      mIn: Q.one(`SELECT COUNT(*) count FROM vehicles WHERE substr(purchase_date,1,7)=?`, month),
      mOut: Q.one(`SELECT COUNT(*) count FROM vehicles WHERE status='Sold' AND substr(sale_date,1,7)=?`, month),
      mProfit: Q.one(`SELECT IFNULL(SUM(${PROFIT_SQL}),0) p FROM vehicles WHERE status='Sold' AND substr(sale_date,1,7)=?`, month),
      bySaleType: Q.all(`SELECT sale_type, COUNT(*) count, SUM(sale_price) revenue, SUM(${PROFIT_SQL}) profit FROM vehicles WHERE status='Sold' GROUP BY sale_type`),
      recent: Q.all(`${SELECT_VEHICLE} ORDER BY IFNULL(v.updated_at, v.created_at) DESC LIMIT 8`),
      months: lastMonths(Q, 6),
      stockByMake: Q.all(`SELECT make label, COUNT(*) count, SUM(${COST_SQL}) value FROM vehicles WHERE status <> 'Sold' GROUP BY make ORDER BY count DESC, value DESC LIMIT 6`),
      aging: Q.all(`${SELECT_VEHICLE} WHERE status <> 'Sold' AND purchase_date IS NOT NULL ORDER BY purchase_date LIMIT 5`),
      recv: Q.one(`SELECT COUNT(*) count, IFNULL(SUM(sale_price - IFNULL(amount_received,0)),0) amount FROM vehicles
        WHERE status='Sold' AND sale_price - IFNULL(amount_received,0) > 0`),
      recvRows: Q.all(`${SELECT_VEHICLE} WHERE status='Sold' AND sale_price - IFNULL(amount_received,0) > 0
        ORDER BY sale_price - IFNULL(amount_received,0) DESC LIMIT 5`),
      recentSales: Q.all(`${SELECT_VEHICLE} WHERE status='Sold' ORDER BY sale_date DESC LIMIT 6`),
    });
    const { mIn, mOut, mProfit, recv, recvRows, ...rest } = r;
    return { ...rest, thisMonth: { in: mIn.count, out: mOut.count, profit: mProfit.p }, receivables: { ...recv, rows: recvRows } };
  },

  async available(Q) {
    return props({
      rows: Q.all(`${SELECT_VEHICLE} WHERE status <> 'Sold' ORDER BY make, model, year`),
      byMake: Q.all(`SELECT make, COUNT(*) count, SUM(${COST_SQL}) cost FROM vehicles WHERE status <> 'Sold' GROUP BY make ORDER BY count DESC`),
      byStatus: Q.all(`SELECT status, COUNT(*) count, SUM(${COST_SQL}) cost FROM vehicles WHERE status <> 'Sold' GROUP BY status`),
    });
  },

  async profit(Q, p) {
    const r = range('sale_date', p);
    let filter = `status='Sold'${r.sql}`;
    const args = [...r.args];
    if (p.get('sale_type')) { filter += ' AND sale_type = ?'; args.push(p.get('sale_type')); }
    const agg = `COUNT(*) count, IFNULL(SUM(sale_price),0) revenue, IFNULL(SUM(${COST_SQL}),0) cost,
      IFNULL(SUM(sale_expense),0) sale_expense, IFNULL(SUM(${PROFIT_SQL}),0) profit`;
    return props({
      rows: Q.all(`${SELECT_VEHICLE} WHERE ${filter} ORDER BY sale_date`, ...args),
      totals: Q.one(`SELECT ${agg} FROM vehicles WHERE ${filter}`, ...args),
      bySaleType: Q.all(`SELECT sale_type label, ${agg} FROM vehicles WHERE ${filter} GROUP BY sale_type`, ...args),
      byMake: Q.all(`SELECT make label, ${agg} FROM vehicles WHERE ${filter} GROUP BY make ORDER BY profit DESC`, ...args),
      byMonth: Q.all(`SELECT substr(sale_date,1,7) label, ${agg} FROM vehicles WHERE ${filter} GROUP BY label ORDER BY label`, ...args),
    });
  },

  async inout(Q, p) {
    const ri = range('purchase_date', p);
    const ro = range('sale_date', p);
    const inWhere = `purchase_date IS NOT NULL${ri.sql}`;
    const outWhere = `status='Sold' AND sale_date IS NOT NULL${ro.sql}`;
    const r = await props({
      inMonths: Q.all(`SELECT substr(purchase_date,1,7) month, COUNT(*) count, SUM(${COST_SQL}) value FROM vehicles WHERE ${inWhere} GROUP BY month`, ...ri.args),
      outMonths: Q.all(`SELECT substr(sale_date,1,7) month, COUNT(*) count, SUM(sale_price) value FROM vehicles WHERE ${outWhere} GROUP BY month`, ...ro.args),
      in: Q.one(`SELECT COUNT(*) count, IFNULL(SUM(${COST_SQL}),0) value FROM vehicles WHERE ${inWhere}`, ...ri.args),
      out: Q.one(`SELECT COUNT(*) count, IFNULL(SUM(sale_price),0) value FROM vehicles WHERE ${outWhere}`, ...ro.args),
      inBySource: Q.all(`SELECT purchase_source label, COUNT(*) count, SUM(${COST_SQL}) value FROM vehicles WHERE ${inWhere} GROUP BY label`, ...ri.args),
      outByType: Q.all(`SELECT sale_type label, COUNT(*) count, SUM(sale_price) value FROM vehicles WHERE ${outWhere} GROUP BY label`, ...ro.args),
      inRows: Q.all(`${SELECT_VEHICLE} WHERE ${inWhere} ORDER BY purchase_date`, ...ri.args),
      outRows: Q.all(`${SELECT_VEHICLE} WHERE ${outWhere} ORDER BY sale_date`, ...ro.args),
    });
    const months = {};
    for (const m of r.inMonths) months[m.month] = { month: m.month, in_count: m.count, in_value: m.value, out_count: 0, out_value: 0 };
    for (const m of r.outMonths) Object.assign(months[m.month] ||= { month: m.month, in_count: 0, in_value: 0 }, { out_count: m.count, out_value: m.value });
    return {
      summary: { in: r.in, out: r.out, inBySource: r.inBySource, outByType: r.outByType },
      byMonth: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
      inRows: r.inRows, outRows: r.outRows,
    };
  },
};
