import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useForm } from '../hooks';
import { useAuth } from '../auth';
import { PageHeader, Button, Loader, useToast } from '../components';
import PartyFields, { emptyParty, partyError } from '../components/PartyFields';

export default function PartyForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { company } = useAuth();
  const form = useForm(emptyParty('Buyer', company?.country));
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.party(id).then(({ party }) => { form.setValues(party); setLoading(false); })
      .catch(e => { toast(e.message, 'error'); nav('/parties'); });
  }, [id]);

  async function save(e) {
    e.preventDefault();
    const err = partyError(form.values);
    if (err) return toast(err, 'error');
    setSaving(true);
    try {
      const saved = id ? await api.updateParty(id, form.values) : await api.createParty(form.values);
      toast(id ? 'Party updated' : `${saved.name} added (${saved.code})`);
      nav(`/parties/${saved.id}`);
    } catch (err2) {
      toast(err2.message, 'error');
      setSaving(false);
    }
  }

  if (loading) return <Loader />;
  return (
    <form id="party-form" onSubmit={save}>
      <PageHeader title={id ? `Edit ${form.values.name}` : 'Add Party'} subtitle={id ? form.values.code : 'Buyer or seller, local or international'}
        actions={<>
          <Button onClick={() => nav(-1)}>Cancel</Button>
          <Button variant="primary" type="submit" form="party-form" disabled={saving}>{saving ? 'Saving…' : 'Save Party'}</Button>
        </>} />
      <PartyFields form={form} />
    </form>
  );
}
