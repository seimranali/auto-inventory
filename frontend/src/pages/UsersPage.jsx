import { useState } from 'react';
import { api } from '../api';
import { useAsync, useForm } from '../hooks';
import { useAuth } from '../auth';
import { formatDate } from '../dates';
import {
  PageHeader, DataTable, Button, Modal, FormGrid, Input, Select, Field, Badge, Loader, ErrorBox, useToast,
} from '../components';

const ROLE_CLASS = { Admin: 'b-role-admin', Manager: 'b-role-manager', Sales: 'b-role-sales', Viewer: 'b-role-viewer' };
export const RoleBadge = ({ role }) => <Badge className={ROLE_CLASS[role] || ''}>{role}</Badge>;

function UserForm({ user, roles, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !user;
  const form = useForm(user ? { ...user, password: '' } : { role: 'Sales', active: true, password: '' });
  const [saving, setSaving] = useState(false);
  const v = form.values;

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name: v.name, email: v.email, phone: v.phone, role: v.role, active: v.active, ...(v.password ? { password: v.password } : {}) };
      const saved = isNew ? await api.createUser(body) : await api.updateUser(user.id, body);
      toast(isNew ? `User ${saved.name} added` : 'User updated');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  }

  return (
    <Modal title={isNew ? 'Add User' : `Edit ${user.name}`} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="user-form" disabled={saving}>{saving ? 'Saving…' : 'Save User'}</Button></>}>
      <form id="user-form" onSubmit={save}>
        <FormGrid>
          <Input form={form} name="name" label="Full Name *" required />
          <Input form={form} name="email" label="Email *" type="email" required autoComplete="off" />
          <Input form={form} name="phone" label="Phone" />
          <Select form={form} name="role" label="Role *" placeholder={false} searchable={false}
            options={Object.entries(roles).map(([r, d]) => ({ value: r, label: r, description: d.description }))} />
          <Input form={form} name="password" type="password" autoComplete="new-password"
            label={isNew ? 'Password *' : 'New Password'} hint={isNew ? 'At least 8 characters' : 'Leave blank to keep the current password'} />
          <Field label="Status">
            <label className="switch">
              <input type="checkbox" checked={!!v.active} onChange={e => form.set('active', e.target.checked)} />
              <span>{v.active ? 'Active — can sign in' : 'Inactive — cannot sign in'}</span>
            </label>
          </Field>
        </FormGrid>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.users());
  const [editing, setEditing] = useState(null); // null | 'new' | user

  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;

  const remove = async u => {
    if (!confirm(`Delete ${u.name}? They will no longer be able to sign in. Consider deactivating instead to keep history.`)) return;
    try { await api.deleteUser(u.id); toast('User deleted'); reload(); } catch (e) { toast(e.message, 'error'); }
  };

  const active = data.users.filter(u => u.active).length;
  return (
    <>
      <PageHeader title="Users" subtitle={`${data.users.length} users · ${active} active`}
        actions={<Button variant="primary" onClick={() => setEditing('new')}>+ Add User</Button>} />

      <div className="panel grid-panel">
        <DataTable rows={data.users} exportName="users" filterable groupable pageSize={20} columns={[
          { key: 'name', label: 'Name', render: u => (
            <div className="user-cell">
              <span className="avatar">{u.name.slice(0, 1).toUpperCase()}</span>
              <div><b>{u.name}</b>{u.id === me.id && <span className="you-tag">You</span>}<small>{u.email}</small></div>
            </div>
          ) },
          { key: 'phone', label: 'Phone' },
          { key: 'role', label: 'Role', groupable: true, render: u => <RoleBadge role={u.role} /> },
          { key: 'status', label: 'Status', groupable: true, value: u => (u.active ? 'Active' : 'Inactive'),
            render: u => <Badge className={u.active ? 'b-InStock' : 'b-Sold'}>{u.active ? 'Active' : 'Inactive'}</Badge> },
          { key: 'last_login', label: 'Last Sign-in', render: u => (u.last_login ? formatDate(u.last_login.slice(0, 10)) : <span className="muted">Never</span>) },
          { key: 'created_at', label: 'Added', render: u => formatDate(u.created_at?.slice(0, 10)) },
          { key: 'actions', label: '', filter: false, value: () => '', render: u => (
            <div className="row-actions">
              <Button onClick={() => setEditing(u)}>Edit</Button>
              {u.id !== me.id && <Button variant="danger" onClick={() => remove(u)}>Delete</Button>}
            </div>
          ) },
        ]} />
      </div>

      {editing && (
        <UserForm user={editing === 'new' ? null : editing} roles={data.roles}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
    </>
  );
}
