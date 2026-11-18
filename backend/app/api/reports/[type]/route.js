import { db, SELECT_VEHICLE, selectVehicles, COST_SQL, PROFIT_SQL, json, fail, scopeOf, inScope } from '@/lib/db';
import { guard } from '@/lib/auth';
import { expenseTotals } from '@/lib/accounts';

export const runtime = 'nodejs';

const { all, get: one } = db;
const month = c => `LEFT(${c}, 7)`; // 'YYYY-MM' from a 'YYYY-MM-DD' text date

// Builds "AND col BETWEEN" clauses for an optional from/to date range
function range(col, p) {
  const sql = [], args = [];
  if (p.get('from')) { sql.push(`${col} >= ?`); args.push(p.get('from')); }
  if (p.get('to')) { sql.push(`${col} <= ?`); args.push(p.get('to')); }
  return { sql: sql.map(s => ' AND ' + s).join(''), args };
}

// IN / OUT / revenue / profit for each of the last n calendar months (zero-filled)
async function lastMonths(n, C) {
  const d = new Date();
  const keys = Array.from({ length: n }, (_, i) => {
    const m = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
  });
  const ins = Object.fromEntries((await all(`SELECT ${month('purchase_date')} m, COUNT(*) c FROM vehicles
    WHERE ${C} AND ${month('purchase_date')} >= ? GROUP BY ${month('purchase_date')}`, keys[0])).map(r => [r.m, r.c]));
  const outs = Object.fromEntries((await all(`SELECT ${month('sale_date')} m, COUNT(*) c, SUM(sale_price) rev, SUM(${PROFIT_SQL}) p
    FROM vehicles WHERE ${C} AND status='Sold' AND ${month('sale_date')} >= ? GROUP BY ${month('sale_date')}`, keys[0])).map(r => [r.m, r]));
  return keys.map(k => ({ month: k, in: ins[k] || 0, out: outs[k]?.c || 0, revenue: outs[k]?.rev || 0, profit: outs[k]?.p || 0 }));
}

// Each report gets the query params and C, the SQL condition for the company scope ("1=1" = all companies combined).
// byCompany rows always cover every company, so the combined view can show them side by side.
const reports = {
  async dashboard(_p, C, cid) {
    const m = new Date().toISOString().slice(0, 7);
    return {
      byStatus: await all(`SELECT status, COUNT(*) count, SUM(${COST_SQL}) cost FROM vehicles WHERE ${C} GROUP BY status`),
      stock: await one(`SELECT COUNT(*) count, ISNULL(SUM(${COST_SQL}),0) cost FROM vehicles WHERE ${C} AND status <> 'Sold'`),
      sold: await one(`SELECT COUNT(*) count, ISNULL(SUM(sale_price),0) revenue, ISNULL(SUM(${PROFIT_SQL}),0) profit FROM vehicles WHERE ${C} AND status='Sold'`),
      thisMonth: {
        in: (await one(`SELECT COUNT(*) count FROM vehicles WHERE ${C} AND ${month('purchase_date')}=?`, m)).count,
        out: (await one(`SELECT COUNT(*) count FROM vehicles WHERE ${C} AND status='Sold' AND ${month('sale_date')}=?`, m)).count,
        profit: (await one(`SELECT ISNULL(SUM(${PROFIT_SQL}),0) p FROM vehicles WHERE ${C} AND status='Sold' AND ${month('sale_date')}=?`, m)).p,
      },
      bySaleType: await all(`SELECT sale_type, COUNT(*) count, SUM(sale_price) revenue, SUM(${PROFIT_SQL}) profit
        FROM vehicles WHERE ${C} AND status='Sold' GROUP BY sale_type`),
      recent: await all(`${selectVehicles(8)} WHERE ${C} ORDER BY ISNULL(v.updated_at, v.created_at) DESC`),
      months: await lastMonths(6, C),
      stockByMake: await all(`SELECT TOP 6 make label, COUNT(*) count, SUM(${COST_SQL}) value FROM vehicles WHERE ${C} AND status <> 'Sold'
        GROUP BY make ORDER BY count DESC, value DESC`),
      aging: await all(`${selectVehicles(5)} WHERE ${C} AND status <> 'Sold' AND purchase_date IS NOT NULL ORDER BY purchase_date`),
      receivables: {
        ...await one(`SELECT COUNT(*) count, ISNULL(SUM(sale_price - ISNULL(amount_received,0)),0) amount FROM vehicles
          WHERE ${C} AND status='Sold' AND sale_price - ISNULL(amount_received,0) > 0`),
        rows: await all(`${selectVehicles(5)} WHERE ${C} AND status='Sold' AND sale_price - ISNULL(amount_received,0) > 0
          ORDER BY sale_price - ISNULL(amount_received,0) DESC`),
      },
      recentSales: await all(`${selectVehicles(6)} WHERE ${C} AND status='Sold' ORDER BY sale_date DESC`),
      expensesThisMonth: (await expenseTotals(`${m}-01`, `${m}-31`, cid)).total,
      byCompany: await all(`SELECT company_id,
          SUM(CASE WHEN status <> 'Sold' THEN 1 ELSE 0 END) stock_count,
          ISNULL(SUM(CASE WHEN status <> 'Sold' THEN ${COST_SQL} END),0) stock_value,
          SUM(CASE WHEN status = 'Sold' THEN 1 ELSE 0 END) sold_count,
          ISNULL(SUM(CASE WHEN status = 'Sold' THEN sale_price END),0) revenue,
          ISNULL(SUM(CASE WHEN status = 'Sold' THEN ${PROFIT_SQL} END),0) profit,
          ISNULL(SUM(CASE WHEN status = 'Sold' THEN sale_price - ISNULL(amount_received,0) END),0) receivable
        FROM vehicles GROUP BY company_id`),
    };
  },

  async available(_p, C) {
    return {
      rows: await all(`${SELECT_VEHICLE} WHERE ${C} AND status <> 'Sold' ORDER BY make, model, year`),
      byMake: await all(`SELECT make, COUNT(*) count, SUM(${COST_SQL}) cost FROM vehicles WHERE ${C} AND status <> 'Sold' GROUP BY make ORDER BY count DESC`),
      byStatus: await all(`SELECT status, COUNT(*) count, SUM(${COST_SQL}) cost FROM vehicles WHERE ${C} AND status <> 'Sold' GROUP BY status`),
      byCompany: await all(`SELECT company_id, COUNT(*) count, SUM(${COST_SQL}) cost, ISNULL(SUM(asking_price),0) asking
        FROM vehicles WHERE status <> 'Sold' GROUP BY company_id`),
    };
  },

  async profit(p, C, cid) {
    const r = range('sale_date', p);
    let base = `status='Sold'${r.sql}`;
    const args = [...r.args];
    if (p.get('sale_type')) { base += ' AND sale_type = ?'; args.push(p.get('sale_type')); }
    const filter = `${C} AND ${base}`;
    const agg = `COUNT(*) count, ISNULL(SUM(sale_price),0) revenue, ISNULL(SUM(${COST_SQL}),0) cost,
      ISNULL(SUM(sale_expense),0) sale_expense, ISNULL(SUM(${PROFIT_SQL}),0) profit`;
    return {
      rows: await all(`${SELECT_VEHICLE} WHERE ${filter} ORDER BY sale_date`, ...args),
      totals: await one(`SELECT ${agg} FROM vehicles WHERE ${filter}`, ...args),
      bySaleType: await all(`SELECT sale_type label, ${agg} FROM vehicles WHERE ${filter} GROUP BY sale_type`, ...args),
      byMake: await all(`SELECT make label, ${agg} FROM vehicles WHERE ${filter} GROUP BY make ORDER BY profit DESC`, ...args),
      byMonth: await all(`SELECT ${month('sale_date')} label, ${agg} FROM vehicles WHERE ${filter} GROUP BY ${month('sale_date')} ORDER BY label`, ...args),
      byCompany: await all(`SELECT company_id, ${agg} FROM vehicles WHERE ${base} GROUP BY company_id`, ...args),
      // Operating expenses in the same period, deducted for net profit (not split by sale type); byCompany inside covers every company
      expenses: { ...await expenseTotals(p.get('from'), p.get('to'), cid), byCompany: (await expenseTotals(p.get('from'), p.get('to'))).byCompany },
    };
  },

  async inout(p, C) {
    const ri = range('purchase_date', p);
    const ro = range('sale_date', p);
    const inBase = `purchase_date IS NOT NULL${ri.sql}`, outBase = `status='Sold' AND sale_date IS NOT NULL${ro.sql}`;
    const inWhere = `${C} AND ${inBase}`, outWhere = `${C} AND ${outBase}`;
    const months = {};
    for (const m of await all(`SELECT ${month('purchase_date')} month, COUNT(*) count, SUM(${COST_SQL}) value FROM vehicles
      WHERE ${inWhere} GROUP BY ${month('purchase_date')}`, ...ri.args))
      months[m.month] = { month: m.month, in_count: m.count, in_value: m.value, out_count: 0, out_value: 0 };
    for (const m of await all(`SELECT ${month('sale_date')} month, COUNT(*) count, SUM(sale_price) value FROM vehicles
      WHERE ${outWhere} GROUP BY ${month('sale_date')}`, ...ro.args))
      Object.assign(months[m.month] ||= { month: m.month, in_count: 0, in_value: 0 }, { out_count: m.count, out_value: m.value });
    const companies = {};
    for (const r of await all(`SELECT company_id, COUNT(*) count, SUM(${COST_SQL}) value FROM vehicles WHERE ${inBase} GROUP BY company_id`, ...ri.args))
      companies[r.company_id] = { company_id: r.company_id, in_count: r.count, in_value: r.value, out_count: 0, out_value: 0 };
    for (const r of await all(`SELECT company_id, COUNT(*) count, SUM(sale_price) value FROM vehicles WHERE ${outBase} GROUP BY company_id`, ...ro.args))
      Object.assign(companies[r.company_id] ||= { company_id: r.company_id, in_count: 0, in_value: 0 }, { out_count: r.count, out_value: r.value });
    return {
      summary: {
        in: await one(`SELECT COUNT(*) count, ISNULL(SUM(${COST_SQL}),0) value FROM vehicles WHERE ${inWhere}`, ...ri.args),
        out: await one(`SELECT COUNT(*) count, ISNULL(SUM(sale_price),0) value FROM vehicles WHERE ${outWhere}`, ...ro.args),
        inBySource: await all(`SELECT purchase_source label, COUNT(*) count, SUM(${COST_SQL}) value FROM vehicles WHERE ${inWhere} GROUP BY purchase_source`, ...ri.args),
        outByType: await all(`SELECT sale_type label, COUNT(*) count, SUM(sale_price) value FROM vehicles WHERE ${outWhere} GROUP BY sale_type`, ...ro.args),
      },
      byMonth: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
      byCompany: Object.values(companies),
      inRows: await all(`${SELECT_VEHICLE} WHERE ${inWhere} ORDER BY purchase_date`, ...ri.args),
      outRows: await all(`${SELECT_VEHICLE} WHERE ${outWhere} ORDER BY sale_date`, ...ro.args),
    };
  },
};

// Company scope: X-Company header (a company id, or nothing = all companies combined)
export const GET = guard('reports:read', async (req, { params }) => {
  const fn = reports[(await params).type];
  if (!fn) return fail('Unknown report', 404);
  const cid = scopeOf(req);
  return json(await fn(new URL(req.url).searchParams, inScope(cid), cid));
});
