// Sidebar menu, also searched by the header search ("Pages").
// perm: hidden from the menu (and the route is blocked) without this permission. keywords: extra search terms.
export const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', perm: 'reports:read', keywords: 'home overview kpi' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory', perm: 'vehicles:read', keywords: 'stock vehicles cars list' },
  { to: '/vehicles/new', label: 'Buying', icon: 'buy', perm: 'vehicles:write', keywords: 'add vehicle purchase new car' },
  { to: '/sales/new', label: 'Sell Vehicle', icon: 'sell', perm: 'sales:write', keywords: 'sale invoice sold' },
  { to: '/parties', label: 'Parties', icon: 'users', perm: 'vehicles:read', keywords: 'buyers sellers customers suppliers' },
  { head: 'Accounts' },
  { to: '/accounts', label: 'Cash & Balances', icon: 'wallet', perm: 'accounts:manage', keywords: 'cash in hand balance credit card accountant' },
  { to: '/accounts/expenses', label: 'Expenses', icon: 'receipt', perm: 'accounts:manage', keywords: 'expense cost rent fuel salary bills' },
  { to: '/accounts/ledger', label: 'Ledger', icon: 'ledger', perm: 'accounts:manage', keywords: 'cash book ledger statement running balance' },
  { head: 'Reports' },
  { to: '/reports/available', label: 'Available Vehicles', icon: 'available', perm: 'reports:read', keywords: 'stock aging report' },
  { to: '/reports/profit', label: 'Profit & Margin', icon: 'profit', perm: 'reports:read', keywords: 'profit margin report revenue' },
  { to: '/reports/in-out', label: 'IN / OUT Vehicles', icon: 'inout', perm: 'reports:read', keywords: 'movement purchases sales report' },
  { head: 'Settings' },
  { to: '/settings/company', label: 'Company', icon: 'company', perm: 'company:manage', keywords: 'settings profile invoice bank' },
  { to: '/settings/users', label: 'Users', icon: 'users', perm: 'users:manage', keywords: 'staff accounts login' },
  { to: '/settings/roles', label: 'User Roles', icon: 'shield', perm: 'users:manage', keywords: 'permissions access' },
];
