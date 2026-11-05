/*
  Use MubashirJP's ITEM price as the purchase price in AutoInventory, where it differs from the purchase invoice.

    AutoInventory vehicles.purchase_price  ←  MubashirJP Items.PurchaseUnitPrice
    for items where Items.PurchaseUnitPrice <> PurchasesInvoiceDetail.NetAmount
    (see scripts/report-mubashirjp-price-mismatch.sql — 10 items when written)

  Each changed vehicle gets a line in its notes recording the invoice and the old price, e.g.
    "Purchase price set from MubashirJP item price 1,400,000 (invoice PI-2610-00002: 900,000) on 2026-11-05"

  Safe:
    - only vehicles imported from MubashirJP ("mj-i-<ItemID>") are touched
    - a vehicle is changed only while its purchase price still equals the invoice amount,
      so prices edited by hand in Auto Inventory are never overwritten
    - running it again changes nothing
    - prints every change; everything runs in one transaction

  To limit it to some items, list their codes in @only, e.g. N'V26100002,V26100010' (empty = all mismatched items).

  sqlcmd -S localhost -U sa -P <password> -C -W -s "|" -f 65001 -i scripts/update-price-from-mubashirjp-items.sql
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
USE AutoInventory;

DECLARE @only nvarchar(max) = N'';   -- e.g. N'V26100002,V26100010'
DECLARE @today nvarchar(10) = CONVERT(nvarchar(10), SYSUTCDATETIME(), 23);

IF OBJECT_ID('tempdb..#fix') IS NOT NULL DROP TABLE #fix;

SELECT 'mj-i-' + CAST(i.ItemID AS nvarchar(20)) id, i.ItemCode, i.ItemName, p.PurchaseInvoiceNumber pi,
  CAST(pd.NetAmount AS float) invoice_price, CAST(i.PurchaseUnitPrice AS float) item_price
INTO #fix
FROM MubashirJP.dbo.Items i
JOIN MubashirJP.dbo.PurchasesInvoiceDetail pd ON pd.ItemID = i.ItemID
JOIN MubashirJP.dbo.PurchasesInvoice p ON p.PurchaseInvoiceID = pd.PurchaseInvoiceID
WHERE i.PurchaseUnitPrice <> pd.NetAmount
  AND (@only = N'' OR i.ItemCode IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@only, ',')));

-- ---------- What will change ----------
SELECT f.ItemCode [Stock #], f.ItemName [Item], f.pi [Purchase Invoice], f.invoice_price [Invoice Price],
  v.purchase_price [Current Price], f.item_price [New Price], f.item_price - v.purchase_price [Change],
  CASE WHEN v.id IS NULL THEN 'skipped: not in Auto Inventory'
       WHEN v.purchase_price = f.item_price THEN 'already done'
       WHEN ISNULL(v.purchase_price, -1) <> f.invoice_price THEN 'skipped: price was edited in Auto Inventory'
       ELSE 'update' END [Action]
FROM #fix f LEFT JOIN vehicles v ON v.id = f.id
ORDER BY f.ItemCode;

-- ---------- Apply ----------
BEGIN TRANSACTION;

UPDATE v SET
  purchase_price = f.item_price,
  notes = CONCAT(NULLIF(v.notes, '') + CHAR(13) + CHAR(10),
    'Purchase price set from MubashirJP item price ', FORMAT(f.item_price, 'N0'),
    ' (invoice ', f.pi, ': ', FORMAT(f.invoice_price, 'N0'), ') on ', @today),
  updated_at = CONVERT(nvarchar(19), SYSUTCDATETIME(), 120)
FROM vehicles v JOIN #fix f ON f.id = v.id
WHERE v.purchase_price = f.invoice_price;

DECLARE @n int = @@ROWCOUNT;
COMMIT;

-- ---------- Summary ----------
SELECT @n [Vehicles Updated],
  (SELECT SUM(f.item_price - f.invoice_price) FROM #fix f JOIN vehicles v ON v.id = f.id WHERE v.purchase_price = f.item_price) [Total Price Change],
  (SELECT SUM(purchase_price) FROM vehicles WHERE id LIKE 'mj-i-%') [Purchase Total Now];

DROP TABLE #fix;
