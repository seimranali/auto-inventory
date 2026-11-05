/*
  Import MubashirJP expense vouchers → AutoInventory expenses (Accounts → Expenses).

    MubashirJP JournalEntry type 21 "Expense Voucher" (EXV-…)  →  transactions (kind = Expense)

  Each voucher is a period total ("TOTAL EXPENSE 2 MONTH", "1-9-2026 TO 30-10-2026"), so it becomes one expense
  dated on the voucher date, category "Monthly Expenses", with the voucher's note as the description and the
  voucher number as the reference. MubashirJP doesn't record how vouchers were paid; the business is cash-based,
  so they are imported as paid by Cash. (Their debit lines were posted to unrelated accounts — liabilities, etc. —
  so the voucher total is used, not the account postings.)

  Re-runnable: imported rows use stable ids ("mj-exv-…") and are replaced on every run.
  Expenses entered in Auto Inventory are left alone.

  sqlcmd -S localhost -U sa -P <password> -C -i scripts/import-mubashirjp-expenses.sql
  (run the app once first so the AutoInventory tables exist)
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
USE AutoInventory;

BEGIN TRANSACTION;

DELETE FROM transactions WHERE id LIKE 'mj-exv-%';

;WITH note AS (   -- first non-empty line note of each voucher
  SELECT d.JournalEntryID, LTRIM(RTRIM(d.Notes)) notes,
    ROW_NUMBER() OVER (PARTITION BY d.JournalEntryID ORDER BY d.SortOrder, d.JournalEntryDetailID) rn
  FROM MubashirJP.dbo.JournalEntryDetail d WHERE NULLIF(LTRIM(RTRIM(d.Notes)), '') IS NOT NULL
)
INSERT INTO transactions (id, txn_date, kind, account, category, description, amount, reference, created_by, created_at)
SELECT 'mj-exv-' + CAST(j.JournalEntryID AS nvarchar(20)),
  CONVERT(nvarchar(10), j.JournalEntryDate, 23),
  'Expense', 'Cash', 'Monthly Expenses',
  LEFT(COALESCE(NULLIF(LTRIM(RTRIM(j.Remarks)), ''), n.notes, 'Expense voucher'), 400),
  j.TotalAmount,
  j.JournalEntryNumber,
  (SELECT TOP 1 id FROM users WHERE role = 'Admin' ORDER BY created_at),
  CONVERT(nvarchar(19), j.CreatedAt, 120)
FROM MubashirJP.dbo.JournalEntry j
LEFT JOIN note n ON n.JournalEntryID = j.JournalEntryID AND n.rn = 1
WHERE j.JournalEntryTypeID = 21          -- Expense Voucher
  AND ISNULL(j.TotalAmount, 0) > 0;

COMMIT;

-- ---------- Summary ----------
SELECT reference voucher, txn_date date, amount, description FROM transactions WHERE id LIKE 'mj-exv-%' ORDER BY txn_date;

SELECT 'MubashirJP' source, COUNT(*) vouchers, SUM(TotalAmount) total
FROM MubashirJP.dbo.JournalEntry WHERE JournalEntryTypeID = 21 AND ISNULL(TotalAmount, 0) > 0
UNION ALL
SELECT 'AutoInventory', COUNT(*), SUM(amount) FROM transactions WHERE id LIKE 'mj-exv-%';
