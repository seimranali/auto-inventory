# Auto Inventory

Inventory and reports for a business that buys new and used vehicles and sells them locally or for export.

| Layer    | Tech                                  | Port |
|----------|---------------------------------------|------|
| Frontend | React 19 + Vite + React Router        | 3000 |
| Backend  | Next.js 15 (App Router API routes)    | 3001 |
| Database | Microsoft SQL Server (`mssql`)        | database `AutoInventory` |

Connection settings go in `backend/.env.local` (copy `backend/.env.example`). The tables are created automatically on first start.
Uploaded images and auction sheets are stored in `backend/data/uploads/`. To back up, back up the `AutoInventory` database and copy `backend/data/uploads`.

## Import from MubashirJP

`backend/scripts/import-mubashirjp.sql` copies customers and vendors (→ parties), purchase invoices (→ buying) and
sales invoices (→ sold vehicles) from the MubashirJP ERP database on the same SQL Server. It is safe to run again: imported rows are replaced, rows entered in Auto Inventory are kept.

```
sqlcmd -S localhost -U sa -P <password> -C -i backend/scripts/import-mubashirjp.sql
sqlcmd -S localhost -U sa -P <password> -C -i backend/scripts/import-mubashirjp-expenses.sql
```

`import-mubashirjp-expenses.sql` copies MubashirJP's Expense Vouchers (EXV-…) into Accounts → Expenses (paid by Cash,
category "Monthly Expenses"); they are deducted in Profit & Margin. Also safe to run again.

`sync-mubashirjp-prices.sql` re-applies purchase and sale prices from MubashirJP's purchase and sales **invoices**
to the imported vehicles, changing only those price fields (other edits in Auto Inventory are kept). It lists every change it makes.

## Run

```
cd backend  && npm install
cd frontend && npm install
```

Then double-click `start.bat`, or run `npm run dev` in `backend` and in `frontend`, and open http://localhost:3000.

## Deploy to Cloudflare

`/worker` is the production build for Cloudflare Workers: the API on **D1** (database) and **R2** (photos), with the React app
served by the same Worker. See [worker/DEPLOY.md](worker/DEPLOY.md).

## Sign in

On first run a default administrator is created:

- **Email:** `admin@autoinventory.local`
- **Password:** `admin123`

**Change this password straight away** (user menu → My Profile), then add real users under **Settings → Users**.

| Role | Can do |
|---|---|
| Admin | Everything, including users and company settings |
| Manager | Buy, edit and sell vehicles; all reports |
| Sales | View stock and record sales; no reports |
| Viewer | Read-only stock and reports |

Permissions are enforced by the API (`backend/lib/auth.js`), not just hidden in the UI.

## Demo data

`cd backend && node scripts/demo-data.mjs` resets the database to a Japanese demo dataset (**this deletes all vehicles, photos and parties**):

- Company: 株式会社ハルカゼ自動車 / Harukaze Motors Co., Ltd. (fictional, Yokohama, JPY)
- 19 fictional parties: 11 in Japan (auction agent, dealers, lease company, individuals) and 8 overseas importers
- 30 vehicles bought May–Oct 2026 at USS / TAA / CAA / HAA venues: 23 sold (13 export, 10 domestic), 7 in stock
- Demo logins (password `demo1234`): `manager@harukaze.example`, `sales@harukaze.example`, `viewer@harukaze.example`

All registration, phone and bank numbers in the demo use placeholder zeros.

## Features

- **Vehicles**: specs (make, model, variant, year, chassis/VIN, engine, mileage, color, fuel, transmission, body, drive, steering…), purchase details and every cost (price, freight, duty, repair, other), status (In Transit / In Stock / Reserved / Sold), and sale details (Local / Export, buyer, country, port, price, expenses).
- **Auction sheet & grading**: auction house, lot no, overall grade (S, 6–1, R, RA), interior/exterior grade, damage remarks, and an uploaded sheet (image or PDF).
- **Images**: multiple photos per vehicle, drag and drop, choose the cover, lightbox view.
- **Reports** (all printable, all tables export to CSV):
  - Available Vehicles: detailed list plus a summary by make, stock value, days in stock
  - Profit & Margin: totals, Local vs Export, by make, by month, vehicle by vehicle
  - IN / OUT: counts and values, monthly summary, IN by source, OUT by sale type, detailed IN and OUT lists

Profit = Sale Price − (Purchase + Freight + Duty + Repair + Other) − Sale Expenses. Margin = Profit / Sale Price.

To change the currency, edit `CURRENCY` in `frontend/src/constants.js`.

## Reusable components (`frontend/src/components`)

`Button`, `PageHeader`, `Panel`, `StatCard`/`StatGrid`, `BarList`, `DataTable` (sorting, totals row, CSV export), `Tabs`, `DateRangeFilter` (with presets), `Input`/`Select`/`TextArea`/`FormGrid`/`InfoList`, `StatusBadge`/`GradeBadge`/`SaleTypeBadge`, `FileDropzone`, `ImageGallery`, `DocumentPreview`, `Thumb`, `Toast`, `Lightbox`, and `vehicleColumns(...)`, which holds the shared vehicle column definitions for every table.
