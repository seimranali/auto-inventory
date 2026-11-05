import { useState } from 'react';
import { api } from '../api';
import { useForm } from '../hooks';
import { useAuth } from '../auth';
import { PageHeader, Panel, FormGrid, Input, Field, Button, useToast } from '../components';
import { RoleBadge } from './UsersPage';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const details = useForm({ name: user.name, phone: user.phone || '' });
  const pw = useForm({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState('');

  async function saveDetails(e) {
    e.preventDefault();
    setBusy('details');
    try { setUser(await api.updateMe(details.values)); toast('Profile updated'); } catch (err) { toast(err.message, 'error'); }
    setBusy('');
  }

  async function savePassword(e) {
    e.preventDefault();
    const v = pw.values;
    if (v.new_password !== v.confirm) return toast('New passwords do not match', 'error');
    setBusy('pw');
    try {
      await api.updateMe({ current_password: v.current_password, new_password: v.new_password });
      pw.setValues({ current_password: '', new_password: '', confirm: '' });
      toast('Password changed');
    } catch (err) { toast(err.message, 'error'); }
    setBusy('');
  }

  return (
    <>
      <PageHeader title="My Profile" subtitle={user.email} />
      <div className="dash-grid">
        <Panel title="Your Details">
          <form onSubmit={saveDetails}>
            <FormGrid>
              <Input form={details} name="name" label="Full Name *" required />
              <Input form={details} name="phone" label="Phone" />
              <Field label="Email"><div className="readonly-value">{user.email}</div></Field>
              <Field label="Role"><div><RoleBadge role={user.role} /></div></Field>
            </FormGrid>
            <div className="form-actions"><Button variant="primary" type="submit" disabled={busy === 'details'}>Save Details</Button></div>
          </form>
        </Panel>
        <Panel title="Change Password">
          <form onSubmit={savePassword}>
            <FormGrid>
              <Input form={pw} name="current_password" label="Current Password" type="password" autoComplete="current-password" required wide />
              <Input form={pw} name="new_password" label="New Password" type="password" autoComplete="new-password" hint="At least 8 characters" required />
              <Input form={pw} name="confirm" label="Confirm New Password" type="password" autoComplete="new-password" required />
            </FormGrid>
            <div className="form-actions"><Button variant="primary" type="submit" disabled={busy === 'pw'}>Change Password</Button></div>
          </form>
        </Panel>
      </div>
    </>
  );
}
