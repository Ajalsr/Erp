import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoMdClose } from 'react-icons/io';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

const TYPE_SUBTYPES = {
  asset: [
    { label: 'Cash & Bank',        value: 'cash_bank' },
    { label: 'Accounts Receivable',value: 'accounts_receivable' },
    { label: 'Inventory',          value: 'inventory' },
    { label: 'Other Current Asset',value: 'other_current_asset' },
    { label: 'Fixed Asset',        value: 'fixed_asset' },
    { label: 'Other Asset',        value: 'other_asset' },
  ],
  liability: [
    { label: 'Accounts Payable',    value: 'accounts_payable' },
    { label: 'Credit Card',         value: 'credit_card' },
    { label: 'Other Current Liability', value: 'other_current_liability' },
    { label: 'Long-term Liability', value: 'long_term_liability' },
  ],
  equity: [
    { label: "Owner's Equity",     value: 'owners_equity' },
    { label: 'Retained Earnings',  value: 'retained_earnings' },
    { label: 'Other Equity',       value: 'other_equity' },
  ],
  income: [
    { label: 'Sales Revenue',   value: 'sales_revenue' },
    { label: 'Other Income',    value: 'other_income' },
    { label: 'Interest Income', value: 'interest_income' },
  ],
  expense: [
    { label: 'Cost of Goods Sold',  value: 'cost_of_goods' },
    { label: 'Operating Expense',   value: 'operating_expense' },
    { label: 'Salaries & Wages',    value: 'salaries' },
    { label: 'Depreciation',        value: 'depreciation' },
    { label: 'Other Expense',       value: 'other_expense' },
  ],
};

const TYPE_COLORS = {
  asset:     '#3b82f6',
  liability: '#ef4444',
  equity:    '#22c55e',
  income:    '#eab308',
  expense:   '#a855f7',
};

export default function NewAccount() {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    accountCode: '',
    accountName: '',
    accountType: '',
    subType: '',
    description: '',
    status: 'active',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({
      ...p,
      [name]: value,
      ...(name === 'accountType' ? { subType: '' } : {}),
    }));
    setErrors(p => { const n = { ...p }; delete n[name]; return n; });
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.accountCode.trim()) errs.accountCode = 'Account code is required';
    if (!form.accountName.trim()) errs.accountName = 'Account name is required';
    if (!form.accountType)        errs.accountType = 'Account type is required';
    if (Object.keys(errs).length) { setErrors(errs); nexusToast.error(Object.values(errs)[0]); return; }

    setSaving(true);
    try {
      await axiosInstance.post('/api/accounts/', form);
      nexusToast.success('Account created successfully!');
      setTimeout(() => navigate('/Finance/Accounts'), 1200);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to create account';
      nexusToast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const accent = TYPE_COLORS[form.accountType] || '#3b82f6';
  const subtypes = TYPE_SUBTYPES[form.accountType] || [];

  const inputStyle = (name) => ({
    width: '100%', height: 42, padding: '0 13px',
    border: `1.5px solid ${errors[name] ? '#ef4444' : T.border}`,
    borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface,
    outline: 'none', fontFamily: "'DM Sans',sans-serif",
    boxShadow: errors[name] ? '0 0 0 3px rgba(239,68,68,.12)' : 'none',
    transition: 'border-color .15s',
    boxSizing: 'border-box',
  });

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
        * { box-sizing: border-box; }
        select option { background: ${T.surface}; color: ${T.textPri}; }
      `}</style>

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40, height: 58,
        background: isDark ? 'rgba(13,21,38,.92)' : 'rgba(255,255,255,.92)',
        backdropFilter: 'blur(12px)', borderBottom: `1.5px solid ${T.border}`,
        display: 'flex', alignItems: 'center', padding: '0 28px', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/Finance/Accounts')}
            style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
            <IoMdClose size={16} />
          </button>
          <div style={{ width: 1, height: 22, background: T.border }} />
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>New Account</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/Finance/Accounts')}
            style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface2, color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: saving ? '#94a3b8' : accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: saving ? 'none' : `0 4px 16px ${accent}55` }}>
            {saving ? 'Saving…' : 'Save Account'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '36px 24px 80px' }}>

        {/* Type picker */}
        <div style={{ background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}`, padding: '20px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 14px' }}>Account Type</p>
          {errors.accountType && <p style={{ fontSize: 11, color: '#ef4444', margin: '0 0 10px' }}>{errors.accountType}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} onClick={() => handleChange({ target: { name: 'accountType', value: type } })}
                style={{
                  padding: '12px 8px', borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                  border: `1.5px solid ${form.accountType === type ? color : T.border}`,
                  background: form.accountType === type ? (isDark ? `${color}22` : `${color}12`) : T.surface2,
                  transition: 'all .15s',
                }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: form.accountType === type ? color : T.textSec, margin: 0, textTransform: 'capitalize' }}>{type}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div style={{ background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}`, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
                Account Code <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input name="accountCode" value={form.accountCode} onChange={handleChange} placeholder="e.g. 1000" style={inputStyle('accountCode')} />
              {errors.accountCode && <p style={{ fontSize: 11, color: '#ef4444', margin: '4px 0 0' }}>{errors.accountCode}</p>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
                Account Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input name="accountName" value={form.accountName} onChange={handleChange} placeholder="e.g. Cash in Hand" style={inputStyle('accountName')} />
              {errors.accountName && <p style={{ fontSize: 11, color: '#ef4444', margin: '4px 0 0' }}>{errors.accountName}</p>}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
              Sub-type
            </label>
            <select name="subType" value={form.subType} onChange={handleChange} disabled={!form.accountType}
              style={{ ...inputStyle('subType'), cursor: form.accountType ? 'pointer' : 'not-allowed', appearance: 'none', paddingRight: 36 }}>
              <option value="">{form.accountType ? 'Select sub-type…' : 'Select account type first'}</option>
              {subtypes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
              Description
            </label>
            <textarea name="description" value={form.description} onChange={handleChange} placeholder="Optional description…" rows={3}
              style={{ width: '100%', padding: '10px 13px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', resize: 'vertical', fontFamily: 'inherit', transition: 'border-color .15s', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
              Status
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['active', 'inactive'].map(s => (
                <div key={s} onClick={() => handleChange({ target: { name: 'status', value: s } })}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, textAlign: 'center', cursor: 'pointer', border: `1.5px solid ${form.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : T.border}`, background: form.status === s ? (s === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2')) : T.surface2, transition: 'all .15s' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: form.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : T.textSec, margin: 0, textTransform: 'capitalize' }}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick reference hint */}
        <div style={{ marginTop: 14, padding: '14px 16px', background: T.surface2, borderRadius: 12, border: `1.5px solid ${T.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Suggested code ranges</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {[['1000–1999', 'Assets'], ['2000–2999', 'Liabilities'], ['3000–3999', 'Equity'], ['4000–4999', 'Income'], ['5000–5999', 'Expenses']].map(([range, type]) => (
              <p key={type} style={{ fontSize: 11, color: T.textSec, margin: 0, fontFamily: "'DM Mono',monospace" }}>
                <span style={{ color: T.textPri, fontWeight: 600 }}>{range}</span> — {type}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
