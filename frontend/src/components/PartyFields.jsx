import { useState } from 'react';
import { api } from '../api';
import { useForm } from '../hooks';
import { useAuth } from '../auth';
import {
  PARTY_ROLES, PARTY_CATEGORIES, PARTY_SCOPES, ID_TYPES, COUNTRY_OPTIONS,
  JP_PREFECTURES, JP_ID_TYPES, JP_ACCOUNT_TYPES, JP_PORTS,
} from '../constants';
import { FormGrid, Input, Select, TextArea, Field } from './FormFields';
import { Panel } from './Layout';
import Modal from './Modal';
import Button from './Button';
import { useToast } from './Toast';

// "Local" means the company's own country (Company profile → Country)
export const emptyParty = (role = 'Buyer', home = 'Pakistan') => ({ role, scope: 'Local', category: 'Individual', country: home, active: 1 });

const JP_FORMATS = [
  ['postal_code', /^\d{3}-?\d{4}$/, 'Postal code must be 7 digits, e.g. 100-0001'],
  ['corporate_number', /^\d{13}$/, 'Corporate Number (法人番号) must be 13 digits'],
  ['invoice_reg_no', /^T\d{13}$/, 'Invoice Registration No. must be T followed by 13 digits'],
  ['bank_branch_code', /^\d{3}$/, 'Branch code (支店番号) must be 3 digits'],
  ['account_no', /^\d{7}$/, 'Japanese account numbers are 7 digits'],
  ['name_kana', /^[゠-ヿ･-ﾟ\s・ー（）()]+$/, 'Name reading (フリガナ) must be in katakana'],
];

// Validation shared by the full page and the quick-add modal (mirrors the API)
export function partyError(v) {
  if (!v.name?.trim()) return 'Name is required';
  if (v.scope === 'International' && !v.country) return 'Country is required for international parties';
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return 'Enter a valid email address';
  if (v.country === 'Japan') for (const [f, re, msg] of JP_FORMATS) if (v[f] && !re.test(String(v[f]))) return msg;
  return null;
}

// Segmented control for 2–3 mutually exclusive choices
export function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(o => (
        <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

/**
 * All party fields in sections. `compact` (quick-add modal) shows only the essentials.
 * The form adapts to the party's country: Japan gets 〒 / prefecture addresses, 法人番号, invoice
 * registration, 古物商 licence, auction membership and Japanese bank (branch code, 普通/当座) fields.
 */
export default function PartyFields({ form, compact = false }) {
  const { company } = useAuth();
  const home = company?.country || 'Pakistan';
  const v = form.values;
  const intl = v.scope === 'International';
  const jp = v.country === 'Japan';
  const isCompany = v.category && v.category !== 'Individual';
  const trader = ['Dealer', 'Auction House', 'Company', 'Agent'].includes(v.category);
  const idTypes = jp ? JP_ID_TYPES : ID_TYPES[intl ? 'International' : 'Local'] || [];

  const setScope = s => {
    form.set('scope', s);
    if (s === 'Local') form.set('country', home);
    else if (v.country === home) form.set('country', '');
  };
  const setCountry = c => {
    form.set('country', c);
    if (v.id_type && !(c === 'Japan' ? JP_ID_TYPES : ID_TYPES[v.scope] || []).includes(v.id_type)) form.set('id_type', '');
    if (c === 'Japan' && !v.currency) form.set('currency', 'JPY');
  };
  const p = { form };

  const basics = (
    <FormGrid>
      <Field label="Party Type *"><Segmented value={v.role} options={PARTY_ROLES} onChange={r => form.set('role', r)} /></Field>
      <Field label={`Location * · Local = ${home}`}><Segmented value={v.scope} options={PARTY_SCOPES} onChange={setScope} /></Field>
      <Select {...p} name="category" label="Category" options={PARTY_CATEGORIES} placeholder={false} searchable={false} />
      {intl && <Select {...p} name="country" label="Country *" options={COUNTRY_OPTIONS} creatable sortable onChange={setCountry} />}
      <Input {...p} name="name" label={isCompany ? (jp ? 'Company Name 会社名 *' : 'Display Name *') : (jp ? 'Full Name 氏名 *' : 'Full Name *')} required
        placeholder={jp ? (isCompany ? '株式会社オートトレード' : '山田 太郎') : isCompany ? 'e.g. Gulf Star Trading' : 'e.g. Ahmed Raza'} />
      {jp && <Input {...p} name="name_kana" label="Reading フリガナ" placeholder={isCompany ? 'カブシキガイシャオートトレード' : 'ヤマダ タロウ'} hint="Katakana" />}
      {isCompany && !jp && <Input {...p} name="company_name" label="Registered Company Name" />}
      {isCompany && <Input {...p} name="contact_person" label={jp ? 'Contact Person 担当者' : 'Contact Person'} />}
      <Input {...p} name="phone" label={jp ? 'Phone 電話番号 *' : 'Phone *'} type="tel" placeholder={jp ? '03-1234-5678 / 090-1234-5678' : intl ? '+971 50 000 0000' : '+92 300 0000000'} />
      <Input {...p} name="email" label="Email" type="email" />
      {jp && isCompany
        ? <Input {...p} name="corporate_number" label="Corporate No. 法人番号" placeholder="13 digits" inputMode="numeric" maxLength={13} />
        : <>
          <Select {...p} name="id_type" label="ID Type" options={idTypes} searchable={false} />
          <Input {...p} name="id_no" label="ID Number" placeholder={v.id_type === 'CNIC' ? '42101-1234567-1' : ''} />
        </>}
    </FormGrid>
  );
  if (compact) return basics;

  return (
    <>
      <Panel title="Identity & Type">{basics}</Panel>

      {jp && (
        <Panel title="Japan Registration 登録情報">
          <FormGrid>
            <Input {...p} name="invoice_reg_no" label="Invoice Registration No. 登録番号" placeholder="T1234567890123"
              hint="Qualified Invoice System (インボイス制度)" />
            {trader && <Input {...p} name="antique_license" label="Antique Dealer Licence 古物商許可番号" placeholder="第123456789012号" />}
            {trader && <Input {...p} name="antique_license_authority" label="Issued by 公安委員会" placeholder="Tokyo Metropolitan Public Safety Commission" />}
            {trader && <Input {...p} name="auction_member_no" label="Auction Member No. 会員番号" placeholder="e.g. USS 12345" />}
            {isCompany && <Select {...p} name="id_type" label="Other ID (individual rep.)" options={JP_ID_TYPES.filter(t => !t.startsWith('Corporate'))} searchable={false} />}
            {isCompany && v.id_type && <Input {...p} name="id_no" label="ID Number" />}
          </FormGrid>
          <p className="muted jp-note">My Number (個人番号) is not collected: Japanese law restricts storing it to specific tax and social-security uses.</p>
        </Panel>
      )}

      <Panel title="Contact">
        <FormGrid>
          {isCompany && <Input {...p} name="designation" label={jp ? 'Title 役職' : 'Contact Designation'} placeholder={jp ? '営業部長' : 'e.g. Purchase Manager'} />}
          <Input {...p} name="alt_phone" label={jp ? 'Fax / Alt. Phone' : 'Alternate Phone'} type="tel" />
          <Input {...p} name="whatsapp" label={jp ? 'WhatsApp / LINE' : 'WhatsApp'} type="tel" />
          <Input {...p} name="website" label="Website" />
        </FormGrid>
      </Panel>

      <Panel title={jp ? 'Address 住所' : 'Address'}>
        {jp ? (
          <FormGrid>
            <Input {...p} name="postal_code" label="Postal Code 〒" placeholder="100-0001" inputMode="numeric" maxLength={8} />
            <Select {...p} name="prefecture" label="Prefecture 都道府県" options={JP_PREFECTURES} />
            <Input {...p} name="city" label="City / Ward 市区町村" placeholder="Chiyoda-ku 千代田区" />
            <Input {...p} name="address" label="Street & No. 町名・番地" placeholder="Chiyoda 1-1-1 千代田1-1-1" wide />
            <Input {...p} name="building" label="Building / Room 建物名・部屋番号" placeholder="Auto Bldg 5F" wide />
            {(intl || v.role !== 'Seller') && <Select {...p} name="port" label="Nearest Port 港" options={JP_PORTS} creatable />}
          </FormGrid>
        ) : (
          <FormGrid>
            {!intl && <Select {...p} name="country" label="Country" options={COUNTRY_OPTIONS} creatable sortable onChange={setCountry} />}
            <Input {...p} name="state" label={intl ? 'State / Province / Emirate' : 'Province'} />
            <Input {...p} name="city" label="City" />
            <Input {...p} name="postal_code" label="Postal Code" />
            {intl && <Input {...p} name="port" label="Default Port" hint="Used to pre-fill export sales" placeholder="e.g. Jebel Ali" />}
            <TextArea {...p} name="address" label="Street Address" rows={2} />
          </FormGrid>
        )}
      </Panel>

      <Panel title={jp ? 'Tax & Banking 振込先' : 'Tax & Banking'}>
        {jp ? (
          <FormGrid>
            <Input {...p} name="bank_name" label="Bank 銀行名" placeholder="MUFG Bank 三菱UFJ銀行" />
            <Input {...p} name="bank_branch" label="Branch 支店名" placeholder="Shinjuku 新宿支店" />
            <Input {...p} name="bank_branch_code" label="Branch Code 支店番号" placeholder="3 digits" inputMode="numeric" maxLength={3} />
            <Select {...p} name="account_type" label="Account Type 預金種目" options={JP_ACCOUNT_TYPES} searchable={false} />
            <Input {...p} name="account_no" label="Account No. 口座番号" placeholder="7 digits" inputMode="numeric" maxLength={7} />
            <Input {...p} name="account_title" label="Account Holder 口座名義 (カナ)" placeholder="カ）オートトレード" />
            {intl && <Input {...p} name="swift" label="SWIFT / BIC" hint="For overseas transfers" />}
            <Input {...p} name="currency" label="Trading Currency" placeholder="JPY" />
            <Input {...p} name="credit_limit" label="Credit Limit" type="number" min="0" step="any" />
          </FormGrid>
        ) : (
          <FormGrid>
            <Input {...p} name="ntn" label={intl ? 'Tax / VAT Number' : 'NTN'} />
            {!intl && <Input {...p} name="strn" label="STRN" />}
            <Input {...p} name="currency" label="Trading Currency" placeholder={intl ? 'USD' : 'PKR'} />
            <Input {...p} name="credit_limit" label="Credit Limit" type="number" min="0" step="any" />
            <Input {...p} name="bank_name" label="Bank Name" />
            <Input {...p} name="account_title" label="Account Title" />
            <Input {...p} name="account_no" label="Account Number" />
            <Input {...p} name="iban" label="IBAN" />
            {intl && <Input {...p} name="swift" label="SWIFT / BIC" />}
          </FormGrid>
        )}
      </Panel>

      <Panel title="Notes & Status">
        <FormGrid>
          <TextArea {...p} name="notes" label="Notes" rows={3} />
          <Field label="Status">
            <label className="switch">
              <input type="checkbox" checked={v.active !== 0} onChange={e => form.set('active', e.target.checked ? 1 : 0)} />
              <span>{v.active !== 0 ? 'Active' : 'Inactive — hidden from pickers'}</span>
            </label>
          </Field>
        </FormGrid>
      </Panel>
    </>
  );
}

// Quick-add from the Sell / Buying forms; returns the created party via onCreated
export function PartyQuickAdd({ role, initialName = '', onClose, onCreated }) {
  const toast = useToast();
  const { company } = useAuth();
  const form = useForm({ ...emptyParty(role, company?.country), name: initialName });
  const [saving, setSaving] = useState(false);
  async function save(e) {
    e.preventDefault();
    e.stopPropagation(); // never submit the Buying / Sell form behind the modal
    const err = partyError(form.values);
    if (err) return toast(err, 'error');
    setSaving(true);
    try {
      const party = await api.createParty(form.values);
      toast(`${party.name} added (${party.code})`);
      onCreated(party);
    } catch (e2) {
      toast(e2.message, 'error');
      setSaving(false);
    }
  }
  return (
    <Modal title={`New ${role}`} width={720} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="party-quick" disabled={saving}>{saving ? 'Saving…' : `Add ${role}`}</Button></>}>
      <form id="party-quick" onSubmit={save}>
        <PartyFields form={form} compact />
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 13 }}>Add address, registration and bank details later from the Parties page.</p>
      </form>
    </Modal>
  );
}
