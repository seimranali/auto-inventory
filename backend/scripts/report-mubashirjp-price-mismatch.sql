/*
  MubashirJP: items whose price on the item record differs from their purchase invoice.

  Compares, per item:
    PurchasesInvoiceDetail.NetAmount      the purchase invoice line (what was invoiced / paid)
    Items.PurchaseUnitPrice               the "Purchase Price" on the item record (editable by hand)
    Items.CostUnitPrice                   the "Cost Price" on the item record
    SalesInvoiceDetail.PurchaseUnitPrice  copied from the item record at sale time — this is what
                                          MubashirJP's "Items Wise Income Report" prints as Purchase Amount

  sqlcmd -S localhost -U sa -P <password> -C -W -s "," -i scripts/report-mubashirjp-price-mismatch.sql
*/
SET NOCOUNT ON;
USE MubashirJP;

SELECT
  i.ItemCode                                   AS [Item Code],
  i.ItemName                                   AS [Item Name],
  c.ItemCategoryName                           AS [Make / Category],
  i.Vehicle_Chassis_Number                     AS [Chassis No],
  p.PurchaseInvoiceNumber                      AS [Purchase Invoice No],
  CONVERT(char(10), p.PurchaseInvoiceDate, 23) AS [Purchase Invoice Date],
  v.VendorName                                 AS [Vendor],
  pd.NetAmount                                 AS [Invoice Price],
  i.PurchaseUnitPrice                          AS [Item Purchase Price],
  i.PurchaseUnitPrice - pd.NetAmount           AS [Difference],
  i.CostUnitPrice                              AS [Item Cost Price],
  CONVERT(char(16), i.CreatedAt, 120)          AS [Item Created],
  CONVERT(char(16), i.UpdatedAt, 120)          AS [Item Last Edited],
  uu.UserName                                  AS [Edited By],
  s.SaleInvoiceNumber                          AS [Sale Invoice No],
  CONVERT(char(10), s.SaleInvoiceDate, 23)     AS [Sale Date],
  sd.NetAmount                                 AS [Sale Price],
  sd.PurchaseUnitPrice                         AS [Purchase on Sale Line],
  CASE WHEN s.SaleInvoiceID IS NULL THEN 'In stock' ELSE 'Sold' END AS [Status],
  CASE
    WHEN pd.NetAmount > 0 AND i.PurchaseUnitPrice > 0
     AND (pd.NetAmount = i.PurchaseUnitPrice * 10 OR pd.NetAmount = i.PurchaseUnitPrice * 100
       OR pd.NetAmount * 10 = i.PurchaseUnitPrice OR pd.NetAmount * 100 = i.PurchaseUnitPrice) THEN 'Extra / missing zero'
    WHEN i.PurchaseUnitPrice > pd.NetAmount THEN 'Item price raised after invoice'
    ELSE 'Item price lowered after invoice'
  END                                          AS [Likely Reason]
FROM Items i
JOIN PurchasesInvoiceDetail pd ON pd.ItemID = i.ItemID
JOIN PurchasesInvoice p ON p.PurchaseInvoiceID = pd.PurchaseInvoiceID
LEFT JOIN Vendors v ON v.VendorID = p.VendorID
LEFT JOIN ItemsCategory c ON c.ItemCategoryID = i.ItemCategoryID
LEFT JOIN Users uu ON uu.UserID = i.UpdatedUserID
LEFT JOIN SalesInvoiceDetail sd ON sd.ItemID = i.ItemID
LEFT JOIN SalesInvoice s ON s.SaleInvoiceID = sd.SaleInvoiceID
WHERE i.PurchaseUnitPrice <> pd.NetAmount
ORDER BY p.PurchaseInvoiceDate, i.ItemCode;

SELECT COUNT(*) AS [Items], SUM(i.PurchaseUnitPrice - pd.NetAmount) AS [Net Difference],
  SUM(CASE WHEN s.SaleInvoiceID IS NOT NULL THEN i.PurchaseUnitPrice - pd.NetAmount ELSE 0 END) AS [Difference on Sold Items]
FROM Items i
JOIN PurchasesInvoiceDetail pd ON pd.ItemID = i.ItemID
LEFT JOIN SalesInvoiceDetail sd ON sd.ItemID = i.ItemID
LEFT JOIN SalesInvoice s ON s.SaleInvoiceID = sd.SaleInvoiceID
WHERE i.PurchaseUnitPrice <> pd.NetAmount;
