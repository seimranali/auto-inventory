/*
  Sync vehicle prices from MubashirJP invoices → AutoInventory.

    purchase_price   ← PurchasesInvoiceDetail.NetAmount   (the purchase invoice line for the item)
    sale_price       ← SalesInvoiceDetail.NetAmount       (the sales invoice line for the item)
    amount_received  ← SalesInvoice.PaidAmount, shared across the invoice's lines by value

  Only vehicles imported from MubashirJP (ids "mj-i-<ItemID>") are touched, and only these price fields —
  every other edit made in Auto Inventory is kept. The item master's "PurchaseUnitPrice" in MubashirJP is NOT used:
  for some items it was edited after the invoice and no longer matches it.
  Vehicles already set to the item price on purpose (update-price-from-mubashirjp-items.sql) are left as they are.

  Prints every change first, then applies it. Safe to run again (a second run changes nothing).

  sqlcmd -S localhost -U sa -P <password> -C -i scripts/sync-mubashirjp-prices.sql
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
USE AutoInventory;

IF OBJECT_ID('tempdb..#inv') IS NOT NULL DROP TABLE #inv;

-- Invoice prices per MubashirJP item
SELECT 'mj-i-' + CAST(pd.ItemID AS nvarchar(20)) id,
  CAST(pd.NetAmount AS float) purchase_price,
  CAST(it.PurchaseUnitPrice AS float) item_price,
  CAST(sd.NetAmount AS float) sale_price,
  CAST(s.PaidAmount * sd.NetAmount / NULLIF(s.GrandTotalAmount, 0) AS float) amount_received,
  p.PurchaseInvoiceNumber pi, s.SaleInvoiceNumber si
INTO #inv
FROM MubashirJP.dbo.PurchasesInvoiceDetail pd
JOIN MubashirJP.dbo.PurchasesInvoice p ON p.PurchaseInvoiceID = pd.PurchaseInvoiceID
JOIN MubashirJP.dbo.Items it ON it.ItemID = pd.ItemID
LEFT JOIN MubashirJP.dbo.SalesInvoiceDetail sd ON sd.ItemID = pd.ItemID
LEFT JOIN MubashirJP.dbo.SalesInvoice s ON s.SaleInvoiceID = sd.SaleInvoiceID;

-- ---------- What will change ----------
SELECT v.stock_no, CONCAT(v.make, ' ', v.model) vehicle, i.pi, i.si,
  v.purchase_price old_purchase, i.purchase_price new_purchase,
  v.sale_price old_sale, i.sale_price new_sale,
  v.amount_received old_received, i.amount_received new_received
FROM vehicles v JOIN #inv i ON i.id = v.id
WHERE (ISNULL(v.purchase_price, -1) <> ISNULL(i.purchase_price, -1)
       AND ISNULL(v.purchase_price, -1) <> ISNULL(i.item_price, -2))  -- kept: set to the item price on purpose
   OR (v.status = 'Sold' AND i.si IS NOT NULL AND (ISNULL(v.sale_price, -1) <> ISNULL(i.sale_price, -1)
       OR ABS(ISNULL(v.amount_received, 0) - ISNULL(i.amount_received, 0)) > 0.5))
ORDER BY v.stock_no;

-- ---------- Apply ----------
BEGIN TRANSACTION;

UPDATE v SET purchase_price = i.purchase_price, updated_at = CONVERT(nvarchar(19), SYSUTCDATETIME(), 120)
FROM vehicles v JOIN #inv i ON i.id = v.id
WHERE ISNULL(v.purchase_price, -1) <> ISNULL(i.purchase_price, -1)
  AND ISNULL(v.purchase_price, -1) <> ISNULL(i.item_price, -2);  -- kept: set to the item price on purpose (update-price-from-mubashirjp-items.sql)
DECLARE @purch int = @@ROWCOUNT;

-- Sale prices only where the vehicle is sold in both systems
UPDATE v SET sale_price = i.sale_price, amount_received = i.amount_received,
  updated_at = CONVERT(nvarchar(19), SYSUTCDATETIME(), 120)
FROM vehicles v JOIN #inv i ON i.id = v.id
WHERE v.status = 'Sold' AND i.si IS NOT NULL
  AND (ISNULL(v.sale_price, -1) <> ISNULL(i.sale_price, -1) OR ABS(ISNULL(v.amount_received, 0) - ISNULL(i.amount_received, 0)) > 0.5);
DECLARE @sale int = @@ROWCOUNT;

COMMIT;

-- ---------- Summary ----------
SELECT @purch purchase_prices_updated, @sale sale_prices_updated;

-- Sold in MubashirJP but not in Auto Inventory (or the other way round): listed, not changed
SELECT v.stock_no, v.status auto_inventory_status, i.si mubashirjp_sale_invoice
FROM vehicles v JOIN #inv i ON i.id = v.id
WHERE (v.status = 'Sold' AND i.si IS NULL) OR (ISNULL(v.status, '') <> 'Sold' AND i.si IS NOT NULL);

SELECT 'MubashirJP invoices' source, SUM(purchase_price) purchase_total, SUM(sale_price) sale_total FROM #inv i WHERE EXISTS (SELECT 1 FROM vehicles v WHERE v.id = i.id)
UNION ALL
SELECT 'AutoInventory', SUM(v.purchase_price), SUM(CASE WHEN v.status = 'Sold' THEN v.sale_price END) FROM vehicles v WHERE v.id LIKE 'mj-i-%';

DROP TABLE #inv;
