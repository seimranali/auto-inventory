async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin', ...options });
  const data = await res.json().catch(() => ({}));
  // Session expired or revoked: tell the app to show the login page
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

const send = (method, path, body) =>
  request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const upload = (path, field, files) => {
  const fd = new FormData();
  [].concat(files).forEach(f => fd.append(field, f));
  return request(path, { method: 'POST', body: fd });
};

const qs = params => {
  const s = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v)).toString();
  return s ? `?${s}` : '';
};

export const api = {
  vehicles: params => request(`/vehicles${qs(params)}`),
  vehicle: id => request(`/vehicles/${id}`),
  createVehicle: data => send('POST', '/vehicles', data),
  nextStockNo: date => request(`/vehicles/next-stock-no${qs({ date })}`),
  updateVehicle: (id, data) => send('PUT', `/vehicles/${id}`, data),
  deleteVehicle: id => request(`/vehicles/${id}`, { method: 'DELETE' }),
  uploadImages: (id, files) => upload(`/vehicles/${id}/images`, 'files', files),
  deleteImage: (id, imageId) => request(`/vehicles/${id}/images/${imageId}`, { method: 'DELETE' }),
  setCover: (id, imageId) => request(`/vehicles/${id}/images/${imageId}`, { method: 'PATCH' }),
  uploadAuctionSheet: (id, file) => upload(`/vehicles/${id}/auction-sheet`, 'file', file),
  deleteAuctionSheet: id => request(`/vehicles/${id}/auction-sheet`, { method: 'DELETE' }),
  report: (type, params) => request(`/reports/${type}${qs(params)}`),
  options: (field, params) => request(`/options/${field}${qs(params)}`),

  login: (email, password) => send('POST', '/auth/login', { email, password }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateMe: data => send('PUT', '/auth/me', data),
  users: () => request('/users'),
  createUser: data => send('POST', '/users', data),
  updateUser: (id, data) => send('PUT', `/users/${id}`, data),
  deleteUser: id => request(`/users/${id}`, { method: 'DELETE' }),
  search: (q, signal) => request(`/search${qs({ q })}`, { signal }),
  parties: params => request(`/parties${qs(params)}`),
  party: id => request(`/parties/${id}`),
  createParty: data => send('POST', '/parties', data),
  updateParty: (id, data) => send('PUT', `/parties/${id}`, data),
  deleteParty: id => request(`/parties/${id}`, { method: 'DELETE' }),
  accountsSummary: params => request(`/accounts/summary${qs(params)}`),
  transactions: params => request(`/accounts/transactions${qs(params)}`),
  createTransaction: data => send('POST', '/accounts/transactions', data),
  updateTransaction: (id, data) => send('PUT', `/accounts/transactions/${id}`, data),
  deleteTransaction: id => request(`/accounts/transactions/${id}`, { method: 'DELETE' }),
  ledger: params => request(`/accounts/ledger${qs(params)}`),

  company: () => request('/company'),
  updateCompany: data => send('PUT', '/company', data),
  uploadLogo: file => upload('/company/logo', 'file', file),
  deleteLogo: () => request('/company/logo', { method: 'DELETE' }),
};

// Ready-made loadOptions for <Dropdown>: existing values of a vehicle field, with vehicle counts
export const loadField = (field, extra) => q =>
  api.options(field, { q, ...extra }).then(rows => rows.map(r => ({ ...r, description: `${r.count} vehicle${r.count > 1 ? 's' : ''}` })));

export const fileUrl = name => (name ? `/api/files/${name}` : null);
