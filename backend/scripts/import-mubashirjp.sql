/*
  Import MubashirJP (ERP) → AutoInventory (both databases on the same SQL Server).

    Customers + Vendors          → parties  (Buyer / Seller)
    Items + PurchasesInvoice      → vehicles (Buying: purchase date, price, seller)
    SalesInvoice                  → vehicles (Sell: sale date, price, buyer, payment, invoice no)
    Company                       → company profile

  Re-runnable: imported rows use stable ids ("mj-…") and are replaced on every run.
  Rows added by hand in Auto Inventory are left alone.

  sqlcmd -S localhost -U sa -P <password> -C -i scripts/import-mubashirjp.sql
  (run the app once first so the AutoInventory tables exist)
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;   -- required by the filtered unique index on vehicles.stock_no
SET ANSI_NULLS ON;
USE AutoInventory;

BEGIN TRANSACTION;

DELETE FROM vehicles WHERE id LIKE 'mj-%';
DELETE FROM parties WHERE id LIKE 'mj-%';

-- ---------- Parties ----------
-- Category guessed from the name: auctions, companies (株式会社 / 有限会社 / LTD …) or individuals
;WITH src AS (
  SELECT 'mj-c-' + CAST(c.CustomerID AS nvarchar(20)) id, c.CustomerCode code, 'Buyer' role,
    LTRIM(RTRIM(c.CustomerName)) name, c.Email, c.Mobile, c.Phone, c.TaxNumber, c.IncorporationNumber, c.Note, c.IsActive, c.CreatedAt,
    COALESCE(NULLIF(a.BillingAddressLine1, ''), a.ShippingAddressLine1) line1, COALESCE(NULLIF(a.BillingAddressLine2, ''), a.ShippingAddressLine2) line2,
    COALESCE(NULLIF(a.BillingCityName, ''), a.ShippingCityName) city, COALESCE(NULLIF(a.BillingZipCode, ''), a.ShippingZipCode) zip,
    COALESCE(a.BillingProvinceID, a.ShippingProvinceID) province_id, COALESCE(a.BillingCountryID, a.ShippingCountryID) country_id
  FROM MubashirJP.dbo.Customers c LEFT JOIN MubashirJP.dbo.CustomersAddress a ON a.CustomerID = c.CustomerID
  UNION ALL
  SELECT 'mj-v-' + CAST(v.VendorID AS nvarchar(20)), v.VendorCode, 'Seller',
    LTRIM(RTRIM(v.VendorName)), v.Email, v.Mobile, v.Phone, v.TaxNumber, v.IncorporationNumber, v.Note, v.IsActive, v.CreatedAt,
    COALESCE(NULLIF(a.BillingAddressLine1, ''), a.MailingAddressLine1), COALESCE(NULLIF(a.BillingAddressLine2, ''), a.MailingAddressLine2),
    COALESCE(NULLIF(a.BillingCityName, ''), a.MailingCityName), COALESCE(NULLIF(a.BillingZipCode, ''), a.MailingZipCode),
    COALESCE(a.BillingProvinceID, a.MailingProvinceID), COALESCE(a.BillingCountryID, a.MailingCountryID)
  FROM MubashirJP.dbo.Vendors v LEFT JOIN MubashirJP.dbo.VendorsAddress a ON a.VendorID = v.VendorID
)
INSERT INTO parties (id, code, role, category, scope, name, phone, alt_phone, email, ntn, corporate_number,
  country, prefecture, city, address, postal_code, currency, notes, active, created_at)
SELECT s.id, s.code, s.role,
  CASE WHEN s.name LIKE '%AUCTION%' OR s.name LIKE '%オークション%' OR s.name IN ('USS', 'TAA', 'CAA', 'HAA', 'JU', 'ARAI', 'NAA', 'LAA') THEN 'Auction House'
       WHEN s.name LIKE '%株式会社%' OR s.name LIKE '%有限会社%' OR s.name LIKE '%合同会社%' OR s.name LIKE '% LTD%' OR s.name LIKE '% CO.%'
         OR s.name LIKE '% CO' OR s.name LIKE '%TRADING%' OR s.name LIKE '%MOTORS%' OR s.name LIKE '%CORPORATION%' THEN 'Company'
       ELSE 'Individual' END,
  CASE WHEN co.CountryName IS NULL OR co.CountryName = 'Japan' THEN 'Local' ELSE 'International' END,
  s.name,
  NULLIF(LTRIM(RTRIM(COALESCE(NULLIF(s.Mobile, ''), s.Phone))), ''),
  CASE WHEN NULLIF(s.Mobile, '') IS NOT NULL AND NULLIF(s.Phone, '') IS NOT NULL AND s.Phone <> s.Mobile THEN s.Phone END,
  NULLIF(LTRIM(RTRIM(s.Email)), ''),
  NULLIF(s.TaxNumber, ''),
  CASE WHEN s.IncorporationNumber LIKE REPLICATE('[0-9]', 13) THEN s.IncorporationNumber END,
  ISNULL(co.CountryName, 'Japan'), pr.ProvinceName, NULLIF(s.city, ''),
  NULLIF(LTRIM(RTRIM(CONCAT(s.line1, CASE WHEN NULLIF(s.line2, '') IS NOT NULL THEN ', ' + s.line2 END))), ''),
  NULLIF(s.zip, ''), 'JPY', NULLIF(s.Note, ''), CASE WHEN s.IsActive = 0 THEN 0 ELSE 1 END,
  CONVERT(nvarchar(19), s.CreatedAt, 120)
FROM src s
LEFT JOIN MubashirJP.dbo.Country co ON co.CountryID = s.country_id
LEFT JOIN MubashirJP.dbo.Province pr ON pr.ProvinceID = s.province_id;

-- ---------- Vehicles: one per item, with its purchase invoice and (if sold) its sale invoice ----------
;WITH pay AS (   -- payment method actually used on each sale (largest non-zero payment)
  SELECT SaleInvoiceID, PaymentMethodID, ROW_NUMBER() OVER (PARTITION BY SaleInvoiceID ORDER BY PaymentAmount DESC) rn
  FROM MubashirJP.dbo.SalesInvoicePaymentDetail WHERE PaymentAmount > 0
)
INSERT INTO vehicles (id, stock_no, chassis_no, engine_no, make, model, [condition],
  purchase_date, purchase_source, supplier, purchase_price, freight_cost, duty_tax, repair_cost, other_cost,
  status, asking_price,
  sale_type, sale_date, buyer_name, buyer_contact, buyer_address, sale_price, sale_expense, payment_method, amount_received,
  invoice_no, sale_notes, seller_party_id, buyer_party_id, notes, created_at, updated_at)
SELECT 'mj-i-' + CAST(i.ItemID AS nvarchar(20)),
  i.ItemCode,
  NULLIF(NULLIF(LTRIM(RTRIM(i.Vehicle_Chassis_Number)), ''), '00'),
  NULLIF(LTRIM(RTRIM(i.Vehicle_Engine_Number)), ''),
  cat.ItemCategoryName,
  LTRIM(RTRIM(i.ItemName)),
  'Used',
  -- Buying
  CONVERT(nvarchar(10), p.PurchaseInvoiceDate, 23),
  CASE sp.category WHEN 'Auction House' THEN 'Auction' WHEN 'Company' THEN 'Local Dealer' ELSE 'Individual' END,
  sp.name,
  pd.NetAmount, 0, 0, 0,
  -- invoice-level expenses, split evenly over the invoice's lines
  ISNULL(p.TotalExpense, 0) / NULLIF((SELECT COUNT(*) FROM MubashirJP.dbo.PurchasesInvoiceDetail x WHERE x.PurchaseInvoiceID = p.PurchaseInvoiceID), 0),
  CASE WHEN s.SaleInvoiceID IS NOT NULL THEN 'Sold' ELSE 'In Stock' END,
  CASE WHEN s.SaleInvoiceID IS NULL THEN NULLIF(i.SaleUnitPrice, 0) END,
  -- Selling
  CASE WHEN s.SaleInvoiceID IS NOT NULL THEN 'Local' END,
  CONVERT(nvarchar(10), s.SaleInvoiceDate, 23),
  bp.name, bp.phone, bp.address,
  sd.NetAmount,
  CASE WHEN s.SaleInvoiceID IS NOT NULL THEN ISNULL(s.TotalExpense, 0)
    / NULLIF((SELECT COUNT(*) FROM MubashirJP.dbo.SalesInvoiceDetail x WHERE x.SaleInvoiceID = s.SaleInvoiceID), 0) END,
  CASE WHEN s.SaleInvoiceID IS NULL THEN NULL WHEN pm.PaymentMethodID = 2 THEN 'Card' ELSE 'Cash' END,
  CASE WHEN s.SaleInvoiceID IS NOT NULL THEN
    -- the invoice's paid amount, shared across its lines in proportion to their value
    s.PaidAmount * sd.NetAmount / NULLIF(s.GrandTotalAmount, 0) END,
  s.SaleInvoiceNumber,
  NULLIF(s.Remarks, ''),
  sp.id, bp.id,
  NULLIF(CONCAT_WS(' · ', NULLIF(i.ItemDescription, ''), 'Purchase invoice ' + p.PurchaseInvoiceNumber,
    CASE WHEN p.StatusID = 1 THEN 'Purchase invoice was a draft in MubashirJP' END, NULLIF(p.Remarks, '')), ''),
  CONVERT(nvarchar(19), i.CreatedAt, 120),
  CONVERT(nvarchar(19), COALESCE(s.CreatedAt, i.UpdatedAt), 120)
FROM MubashirJP.dbo.Items i
JOIN MubashirJP.dbo.PurchasesInvoiceDetail pd ON pd.ItemID = i.ItemID
JOIN MubashirJP.dbo.PurchasesInvoice p ON p.PurchaseInvoiceID = pd.PurchaseInvoiceID
LEFT JOIN MubashirJP.dbo.ItemsCategory cat ON cat.ItemCategoryID = i.ItemCategoryID
LEFT JOIN parties sp ON sp.id = 'mj-v-' + CAST(p.VendorID AS nvarchar(20))
LEFT JOIN MubashirJP.dbo.SalesInvoiceDetail sd ON sd.ItemID = i.ItemID
LEFT JOIN MubashirJP.dbo.SalesInvoice s ON s.SaleInvoiceID = sd.SaleInvoiceID
LEFT JOIN parties bp ON bp.id = 'mj-c-' + CAST(s.CustomerID AS nvarchar(20))
LEFT JOIN pay pm ON pm.SaleInvoiceID = s.SaleInvoiceID AND pm.rn = 1;

-- A party that both sold to us and bought from us shows on both pickers
UPDATE p SET role = 'Both' FROM parties p
WHERE p.id LIKE 'mj-%' AND EXISTS (SELECT 1 FROM vehicles v WHERE v.seller_party_id = p.id)
  AND EXISTS (SELECT 1 FROM vehicles v WHERE v.buyer_party_id = p.id);

-- ---------- Company profile ----------
UPDATE c SET
  name = mc.CompanyName, email = NULLIF(mc.Email, ''), phone = NULLIF(mc.Phone, ''), fax = NULLIF(mc.Fax, ''),
  address = NULLIF(LTRIM(RTRIM(CONCAT(mc.AddressLine1, CASE WHEN NULLIF(mc.AddressLine2, '') IS NOT NULL THEN ', ' + mc.AddressLine2 END))), ''),
  city = NULLIF(mc.CityName, ''), postal_code = NULLIF(mc.ZipCode, ''), prefecture = pr.ProvinceName,
  country = ISNULL(co.CountryName, 'Japan'),
  corporate_number = CASE WHEN mc.IncorporationNumber LIKE REPLICATE('[0-9]', 13) THEN mc.IncorporationNumber END,
  ntn = NULLIF(NULLIF(mc.TaxNumber, ''), '-'),
  currency = 'JPY', tagline = NULL, updated_at = CONVERT(nvarchar(19), SYSUTCDATETIME(), 120)
FROM company c
CROSS JOIN (SELECT TOP 1 * FROM MubashirJP.dbo.Company ORDER BY CompanyID) mc
LEFT JOIN MubashirJP.dbo.Country co ON co.CountryID = mc.CountryID
LEFT JOIN MubashirJP.dbo.Province pr ON pr.ProvinceID = mc.ProvinceID
WHERE c.id = 1;

-- ---------- Clean-up to match Auto Inventory's Japanese formats ----------
-- Prefectures are stored in short form ("Ibaraki", not "Ibaraki Prefecture"); placeholder postal codes ("-") are dropped
UPDATE parties SET prefecture = NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(prefecture, ' Prefecture', ''), ' Metropolis', ''))), '') WHERE id LIKE 'mj-%';
UPDATE company SET prefecture = NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(prefecture, ' Prefecture', ''), ' Metropolis', ''))), '') WHERE id = 1;
UPDATE parties SET postal_code = NULL WHERE id LIKE 'mj-%'
  AND postal_code NOT LIKE '[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]' AND postal_code NOT LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9]';
UPDATE company SET postal_code = NULL WHERE id = 1
  AND postal_code NOT LIKE '[0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]' AND postal_code NOT LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9]';

COMMIT;

-- ---------- Summary ----------
SELECT 'Parties' item, COUNT(*) imported FROM parties WHERE id LIKE 'mj-%'
UNION ALL SELECT '  customers (buyers)', COUNT(*) FROM parties WHERE id LIKE 'mj-c-%'
UNION ALL SELECT '  vendors (sellers)', COUNT(*) FROM parties WHERE id LIKE 'mj-v-%'
UNION ALL SELECT 'Vehicles (buying)', COUNT(*) FROM vehicles WHERE id LIKE 'mj-%'
UNION ALL SELECT '  sold (selling)', COUNT(*) FROM vehicles WHERE id LIKE 'mj-%' AND status = 'Sold'
UNION ALL SELECT '  in stock', COUNT(*) FROM vehicles WHERE id LIKE 'mj-%' AND status <> 'Sold'
UNION ALL SELECT 'Skipped: purchase lines with no item', COUNT(*) FROM MubashirJP.dbo.PurchasesInvoiceDetail d
  WHERE NOT EXISTS (SELECT 1 FROM MubashirJP.dbo.Items i WHERE i.ItemID = d.ItemID)
UNION ALL SELECT 'Skipped: purchase invoices with no lines', COUNT(*) FROM MubashirJP.dbo.PurchasesInvoice p
  WHERE NOT EXISTS (SELECT 1 FROM MubashirJP.dbo.PurchasesInvoiceDetail d WHERE d.PurchaseInvoiceID = p.PurchaseInvoiceID);

SELECT 'MubashirJP' source, SUM(pd.NetAmount) purchase_total, (SELECT SUM(NetAmount) FROM MubashirJP.dbo.SalesInvoiceDetail) sale_total
FROM MubashirJP.dbo.PurchasesInvoiceDetail pd JOIN MubashirJP.dbo.Items i ON i.ItemID = pd.ItemID
UNION ALL
SELECT 'AutoInventory', SUM(purchase_price), SUM(sale_price) FROM vehicles WHERE id LIKE 'mj-%';
