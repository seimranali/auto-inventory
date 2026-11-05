import { useState } from 'react';
import { api, fileUrl } from '../api';
import { useForm } from '../hooks';
import { useAuth } from '../auth';
import { formatAddress, JP_ACCOUNT_LABEL } from '../format';
import { PageHeader, Panel, FormGrid, Input, Select, TextArea, Button, FileDropzone, useToast } from '../components';
import { COUNTRY_OPTIONS, JP_PREFECTURES, JP_ACCOUNT_TYPES } from '../constants';
import { partyError } from '../components/PartyFields';

const CURRENCIES = ['JPY', 'USD', 'PKR', 'AED', 'GBP', 'EUR', 'KES', 'TZS', 'UGX', 'LKR', 'BDT', 'NZD'];

export default function CompanyPage() {
  const { company, setCompany, can } = useAuth();
  const toast = useToast();
  const form = useForm(company || {});
  const [saving, setSaving] = useState(false);
  const editable = can('company:manage');
  const v = form.values;
  const jp = v.country === 'Japan';

  async function save(e) {
    e.preventDefault();
    // Reuse the party format checks (〒, 法人番号, T-number, branch code, account no, katakana)
    const err = partyError({ ...v, scope: 'Local' });
    if (err) return toast(err, 'error');
    if (v.country !== company.country && !confirm(`Change home country to ${v.country}? Parties in ${v.country} become Local and all others International.`)) return;
    setSaving(true);
    try {
      setCompany(await api.updateCompany(v));
      toast('Company profile saved');
    } catch (err2) {
      toast(err2.message, 'error');
    }
    setSaving(false);
  }

  // The logo saves immediately, separately from the form
  const [logoBusy, setLogoBusy] = useState(false);
  const logoAction = async (fn, msg) => {
    setLogoBusy(true);
    try { setCompany(await fn()); toast(msg); } catch (e) { toast(e.message, 'error'); }
    setLogoBusy(false);
  };
  const uploadLogo = file => logoAction(() => api.uploadLogo(file), 'Logo updated');
  const removeLogo = () => confirm('Remove the company logo?') && logoAction(api.deleteLogo, 'Logo removed');

  const p = { form, disabled: !editable };
  const bankLine = jp
    ? [v.bank_name, v.bank_branch && `${v.bank_branch}${v.bank_branch_code ? ` (${v.bank_branch_code})` : ''}`, v.account_no && `${JP_ACCOUNT_LABEL[v.account_type] || ''} ${v.account_no}`.trim(), v.account_title].filter(Boolean).join(' · ')
    : [v.bank_name, v.account_title, v.account_no].filter(Boolean).join(' · ');

  return (
    <form id="company-form" onSubmit={save}>
      <PageHeader title="Company Profile" subtitle={jp ? '会社情報 · shown on invoices and across the app' : 'Shown on invoices and across the app'}
        actions={editable && <Button variant="primary" type="submit" form="company-form" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>} />

      <div className="company-layout">
        <div>
          <Panel title={jp ? 'Company Logo ロゴ' : 'Company Logo'}>
            <div className="logo-editor">
              <div className="logo-box">
                {company?.logo ? <img src={fileUrl(company.logo)} alt="Company logo" /> : <span className="muted">No logo</span>}
              </div>
              <div className="logo-tools">
                <p className="muted">Shown in the sidebar and on invoices and purchase records. PNG, JPG or WebP, up to 2 MB. A square or wide image on a transparent or white background works best.</p>
                {editable && <div className="row">
                  <FileDropzone multiple={false} accept="image/png,image/jpeg,image/webp,image/gif" busy={logoBusy}
                    label={company?.logo ? 'Replace logo — drop an image or click' : 'Upload logo — drop an image or click'} onFiles={uploadLogo} />
                  {company?.logo && <Button variant="danger" onClick={removeLogo} disabled={logoBusy}>Remove</Button>}
                </div>}
              </div>
            </div>
          </Panel>

          <Panel title={jp ? 'Company 会社' : 'Business Details'}>
            <FormGrid>
              <Select {...p} name="country" label="Country *" options={COUNTRY_OPTIONS} creatable sortable placeholder={false}
                hint="Decides what “Local” means for buyers and sellers" />
              <Input {...p} name="name" label={jp ? 'Company Name 会社名 *' : 'Company Name *'} required placeholder={jp ? '株式会社オートインベントリー' : ''} />
              {jp && <Input {...p} name="name_kana" label="Reading フリガナ" placeholder="カブシキガイシャオートインベントリー" />}
              {jp && <Input {...p} name="name_en" label="English Name" placeholder="Auto Inventory Co., Ltd." hint="Printed on export invoices" />}
              <Input {...p} name="representative" label={jp ? 'Representative 代表者' : 'Owner / Director'} placeholder={jp ? '代表取締役 山田 太郎' : ''} />
              <Input {...p} name="tagline" label="Tagline" placeholder="Import · Local Sale · Export" />
            </FormGrid>
          </Panel>

          <Panel title={jp ? 'Address & Contact 所在地・連絡先' : 'Address & Contact'}>
            {jp ? (
              <FormGrid>
                <Input {...p} name="postal_code" label="Postal Code 〒" placeholder="100-0001" inputMode="numeric" maxLength={8} />
                <Select {...p} name="prefecture" label="Prefecture 都道府県" options={JP_PREFECTURES} />
                <Input {...p} name="city" label="City / Ward 市区町村" placeholder="Chiyoda-ku 千代田区" />
                <Input {...p} name="address" label="Street & No. 町名・番地" placeholder="Chiyoda 1-1-1 千代田1-1-1" wide />
                <Input {...p} name="building" label="Building / Room 建物名" placeholder="Auto Bldg 5F" wide />
                <Input {...p} name="phone" label="Phone 電話" type="tel" placeholder="03-1234-5678" />
                <Input {...p} name="fax" label="FAX" type="tel" placeholder="03-1234-5679" />
                <Input {...p} name="email" label="Email" type="email" />
                <Input {...p} name="website" label="Website" />
              </FormGrid>
            ) : (
              <FormGrid>
                <TextArea {...p} name="address" label="Address" rows={2} />
                <Input {...p} name="city" label="City" />
                <Input {...p} name="postal_code" label="Postal Code" />
                <Input {...p} name="phone" label="Phone" />
                <Input {...p} name="email" label="Email" type="email" />
                <Input {...p} name="website" label="Website" />
              </FormGrid>
            )}
          </Panel>

          <Panel title={jp ? 'Registration 登録情報' : 'Tax Registration'}>
            {jp ? <>
              <FormGrid>
                <Input {...p} name="corporate_number" label="Corporate No. 法人番号" placeholder="13 digits" inputMode="numeric" maxLength={13} />
                <Input {...p} name="invoice_reg_no" label="Invoice Registration No. 登録番号" placeholder="T1234567890123"
                  hint="Required on qualified invoices (インボイス制度)" />
                <Input {...p} name="antique_license" label="Antique Dealer Licence 古物商許可番号" placeholder="第123456789012号"
                  hint="Required to trade used vehicles" />
                <Input {...p} name="antique_license_authority" label="Issued by 公安委員会" placeholder="東京都公安委員会" />
                <TextArea {...p} name="auction_memberships" label="Auction Memberships 会員番号" rows={2} placeholder={'USS 12345\nTAA 67890'} />
              </FormGrid>
            </> : (
              <FormGrid>
                <Input {...p} name="ntn" label="NTN / Tax No" />
              </FormGrid>
            )}
          </Panel>

          <Panel title={jp ? 'Bank for Payments 振込先' : 'Bank for Payments'}>
            <FormGrid>
              <Input {...p} name="bank_name" label={jp ? 'Bank 銀行名' : 'Bank Name'} placeholder={jp ? '三菱UFJ銀行' : ''} />
              {jp && <Input {...p} name="bank_branch" label="Branch 支店名" placeholder="新宿支店" />}
              {jp && <Input {...p} name="bank_branch_code" label="Branch Code 支店番号" placeholder="3 digits" inputMode="numeric" maxLength={3} />}
              {jp && <Select {...p} name="account_type" label="Account Type 預金種目" options={JP_ACCOUNT_TYPES} searchable={false} />}
              <Input {...p} name="account_no" label={jp ? 'Account No. 口座番号' : 'Account Number'} placeholder={jp ? '7 digits' : ''} inputMode="numeric" maxLength={jp ? 7 : undefined} />
              <Input {...p} name="account_title" label={jp ? 'Account Holder 口座名義 (カナ)' : 'Account Title'} placeholder={jp ? 'カ）オートインベントリー' : ''} />
              <Input {...p} name="swift" label="SWIFT / BIC" hint="For overseas buyers' telegraphic transfers" />
            </FormGrid>
          </Panel>

          <Panel title={jp ? 'Invoicing 請求書' : 'Invoicing'}>
            <FormGrid>
              <Select {...p} name="currency" label="Currency" options={CURRENCIES} creatable placeholder={false}
                hint={company?.currency && v.currency !== company.currency ? 'Changing currency relabels existing amounts; it does not convert them.' : undefined} />
              <Input {...p} name="invoice_prefix" label="Invoice Prefix" hint={`Next invoices: ${(v.invoice_prefix || 'INV').toUpperCase()}-${new Date().getFullYear()}-0001`} />
              <TextArea {...p} name="terms" label="Terms & Conditions (one per line)" rows={5} />
            </FormGrid>
          </Panel>
        </div>

        <Panel title="Invoice Header Preview" className="company-preview">
          {company?.logo && <img className="inv-logo" src={fileUrl(company.logo)} alt="" />}
          <div className="inv-company">{v.name || 'Company name'}</div>
          {jp && v.name_en && <div className="inv-small"><b>{v.name_en}</b></div>}
          <div className="muted">{v.tagline}</div>
          <div className="inv-small">{formatAddress(v)}{!jp && v.country ? `, ${v.country}` : jp ? ', Japan' : ''}</div>
          <div className="inv-small">{[v.phone && `TEL ${v.phone}`, v.fax && `FAX ${v.fax}`, v.email, v.website].filter(Boolean).join(' · ')}</div>
          {v.representative && <div className="inv-small">{jp ? '代表者' : 'Director'}: {v.representative}</div>}
          {jp ? <>
            {v.invoice_reg_no && <div className="inv-small">登録番号 Registration No. <b>{v.invoice_reg_no}</b></div>}
            {v.corporate_number && <div className="inv-small">法人番号 {v.corporate_number}</div>}
            {v.antique_license && <div className="inv-small">古物商許可 {v.antique_license}{v.antique_license_authority ? ` (${v.antique_license_authority})` : ''}</div>}
          </> : v.ntn && <div className="inv-small">NTN: {v.ntn}</div>}
          {bankLine && <><div className="inv-label" style={{ marginTop: 16 }}>Bank Details</div><div className="inv-small">{bankLine}{v.swift ? ` · SWIFT ${v.swift}` : ''}</div></>}
          <div className="inv-label" style={{ marginTop: 16 }}>Terms</div>
          <ol className="inv-small">{(v.terms || '').split('\n').filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}</ol>
          {jp && !v.invoice_reg_no && <p className="company-warn">Add your Invoice Registration No. so buyers in Japan can claim input tax credit on your invoices.</p>}
        </Panel>
      </div>
    </form>
  );
}
