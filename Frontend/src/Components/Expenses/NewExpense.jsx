import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import axiosInstance from '../../helper/axiosInstance';
import { useUnsavedGuard } from '../../helper/useUnsavedGuard';
import nexusToast from '../../helper/nexusToast';
import AppDatePicker from '../common/AppDatePicker';
import CustomSelect from '../common/CustomSelect';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function NewExpense() {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const today = new Date().toISOString().slice(0, 10);

  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(today);
  const [paid, setPaid] = useState(true); // false → unpaid/accrued (credits Accounts Payable)
  const [expenseAccount, setExpenseAccount] = useState('');
  const [paidThrough, setPaidThrough] = useState('');
  const [payee, setPayee] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [taxRate, setTaxRate] = useState(5);
  const [notes, setNotes] = useState('');

  const [expAccounts, setExpAccounts] = useState([]); // expense-type accounts
  const [bankAccounts, setBankAccounts] = useState([]); // cash/bank accounts

  // Expense categories (rent, salary, fuel…) — expense-type GL accounts.
  useEffect(() => {
    axiosInstance.get('/api/accounts/?limit=500&status=active&type=expense')
      .then(r => setExpAccounts(r.data?.data?.accounts || []))
      .catch(() => {});
  }, []);

  // Paid-through options — only cash/bank accounts.
  useEffect(() => {
    axiosInstance.get('/api/accounts/?limit=500&status=active')
      .then(r => setBankAccounts((r.data?.data?.accounts || []).filter(a => a.isBankAccount)))
      .catch(() => {});
  }, []);

  const net = round2(parseFloat(amount) || 0);
  const taxAmt = round2(net * ((parseFloat(taxRate) || 0) / 100));
  const total = round2(net + taxAmt);

  const handleSubmit = async () => {
    if (!expenseAccount)     { nexusToast.error('Pick an expense account'); return; }
    if (paid && !paidThrough){ nexusToast.error('Pick a paid-through account'); return; }
    if (net <= 0)            { nexusToast.error('Enter an amount greater than zero'); return; }

    const expName = expAccounts.find(a => a._id === expenseAccount);
    const payName = bankAccounts.find(a => a._id === paidThrough);

    setSaving(true);
    try {
      await axiosInstance.post('/api/expenses/', {
        date,
        paid,
        expenseAccount,
        expenseAccountName: expName ? `[${expName.accountCode}] ${expName.accountName}` : '',
        paidThrough:     paid ? paidThrough : '',
        paidThroughName: paid && payName ? `[${payName.accountCode}] ${payName.accountName}` : '',
        payee:     payee.trim()     || undefined,
        reference: reference.trim() || undefined,
        amount:    net,
        taxRate:   parseFloat(taxRate) || 0,
        notes:     notes.trim() || undefined,
      });
      nexusToast.success('Expense recorded!');
      setTimeout(() => navigate('/Purchase/Expenses'), 800);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  const inp = { width: '100%', padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, fontFamily: 'inherit', outline: 'none' };
  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 };
  const sec = { background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '20px 22px', marginBottom: 16, boxShadow: isDark ? '0 2px 10px rgba(0,0,0,.25)' : '0 1px 4px rgba(0,0,0,.05)' };

  const guard = useUnsavedGuard({ hasDraft: false });

  return (
    <div onInput={guard.markDirty} onChange={guard.markDirty} style={{ minHeight: '100vh', background: T.bg, padding: '20px 20px 90px', color: T.textPri, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Top bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 30, background: isDark ? 'rgba(8,13,26,.95)' : 'rgba(241,245,249,.95)', backdropFilter: 'blur(12px)', padding: '12px 0', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => navigate('/Purchase/Expenses')} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <FaChevronLeft size={13} />
              </button>
              <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: T.textPri, margin: 0 }}>New Expense</h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate('/Purchase/Expenses')} style={{ padding: '9px 18px', border: `1.5px solid ${T.border}`, borderRadius: 9, background: 'transparent', color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? <><FaSpinner size={12} style={{ animation: 'spin .7s linear infinite' }} /> Saving…</> : <><FaCheckCircle size={12} /> Save Expense</>}
              </button>
            </div>
          </div>
        </div>

        <div style={sec}>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: T.textPri, margin: '0 0 16px' }}>Expense Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Date</label>
              <AppDatePicker value={date} onChange={setDate} />
            </div>
            <div>
              <label style={lbl}>Payee (optional)</label>
              <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. ENOC, Driver salary…" style={inp} />
            </div>
            <div>
              <label style={lbl}>Expense Account <span style={{ color: '#ef4444' }}>*</span></label>
              <CustomSelect value={expenseAccount} onChange={setExpenseAccount} placeholder="Select category…"
                options={[{ value: '', label: 'Select category…' }, ...expAccounts.map(a => ({ value: a._id, label: `[${a.accountCode}] ${a.accountName}` }))]} />
              <p style={{ fontSize: 11, color: T.textSec, margin: '6px 0 0' }}>
                Salary, fuel, rent… Add new ones under Finance → Chart of Accounts.
              </p>
            </div>
            <div>
              <label style={lbl}>Payment</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: true, t: 'Paid now' }, { v: false, t: 'Unpaid' }].map(o => (
                  <button key={o.t} type="button" onClick={() => setPaid(o.v)}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${paid === o.v ? '#3b82f6' : T.border}`,
                      background: paid === o.v ? (isDark ? 'rgba(59,130,246,.15)' : '#eff6ff') : T.surface,
                      color: paid === o.v ? '#3b82f6' : T.textSec }}>
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
            {paid ? (
              <div>
                <label style={lbl}>Paid Through <span style={{ color: '#ef4444' }}>*</span></label>
                <CustomSelect value={paidThrough} onChange={setPaidThrough} placeholder="Select cash/bank…"
                  options={[{ value: '', label: 'Select cash/bank…' }, ...bankAccounts.map(a => ({ value: a._id, label: `[${a.accountCode}] ${a.accountName}` }))]} />
              </div>
            ) : (
              <div>
                <label style={lbl}>Booked To</label>
                <input value="Accounts Payable (2000)" readOnly style={{ ...inp, background: T.surface2, color: T.textSec }} />
                <p style={{ fontSize: 11, color: T.textSec, margin: '6px 0 0' }}>Unpaid — owed, sits in payables until settled.</p>
              </div>
            )}
            <div>
              <label style={lbl}>Amount (excl. VAT) <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Tax %</label>
              <input type="number" min="0" step="any" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Reference (optional)</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt / cheque no." style={inp} />
            </div>
          </div>

          {/* Totals strip */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, color: T.textSec, display: 'block' }}>VAT</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono',monospace" }}>AED {taxAmt.toFixed(2)}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, color: T.textSec, display: 'block' }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: T.blue, fontFamily: "'DM Mono',monospace" }}>AED {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={sec}>
          <label style={lbl}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" rows={3} style={{ ...inp, resize: 'vertical' }} />
        </div>
      </div>
    </div>
  );
}
