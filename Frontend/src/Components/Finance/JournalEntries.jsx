import { useState, useEffect, useCallback } from 'react';
import { FaBook, FaPlus, FaTimes, FaTrash, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import toast from 'react-hot-toast';
import axiosInstance from '../../helper/axiosInstance';
import useRealtime from '../../helper/useRealtime';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import { useBaseCurrency, baseCurrency } from '../../helper/currency';

const fmt = v => Number(v || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const REFTYPE_COLOR = {
  manual: '#8b5cf6', invoice: '#3b82f6', bill: '#ef4444', payment: '#10b981',
  vendor_payment: '#f59e0b', advance_payment: '#06b6d4', advance_application: '#06b6d4',
};
const emptyLine = () => ({ accountId: '', accountCode: '', accountName: '', debit: '', credit: '', description: '' });

export default function JournalEntries() {
  useBaseCurrency();
  const isDark = useThemeStore(s => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate]     = useState(today);
  const [entries, setEntries]     = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Create form
  const [form, setForm]   = useState({ date: today, reference: '', description: '' });
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/journal-entries/', { params: { startDate, endDate } });
      setEntries(res.data?.data?.entries ?? []);
    } catch { setEntries([]); } finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useRealtime(['journal_entries_updated','invoices_updated','bills_updated','payments_updated','vendor_payments_updated'], fetchEntries);
  useEffect(() => {
    axiosInstance.get('/api/accounts/?limit=500')
      .then(res => setAccounts(res.data?.data?.accounts ?? []))
      .catch(() => setAccounts([]));
  }, []);

  const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const setLine = (i, patch) => setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l));
  const pickAccount = (i, accId) => {
    const a = accounts.find(x => x._id === accId);
    setLine(i, { accountId: accId, accountCode: a?.accountCode || '', accountName: a?.accountName || '' });
  };

  const resetForm = () => {
    setForm({ date: today, reference: '', description: '' });
    setLines([emptyLine(), emptyLine()]);
  };

  const save = async () => {
    const used = lines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (used.length < 2) { toast.error('Add at least 2 lines with an account and amount'); return; }
    if (!balanced) { toast.error('Entry must balance — total debit must equal total credit'); return; }
    if (used.some(l => Number(l.debit) > 0 && Number(l.credit) > 0)) { toast.error('A line cannot have both debit and credit'); return; }

    setSaving(true);
    try {
      await axiosInstance.post('/api/journal-entries/', {
        date: form.date,
        reference: form.reference,
        description: form.description,
        lines: used.map(l => ({
          accountId: l.accountId, accountCode: l.accountCode, accountName: l.accountName,
          debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description,
        })),
      });
      toast.success('Journal entry posted');
      setShowModal(false); resetForm(); fetchEntries();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to post entry');
    } finally { setSaving(false); }
  };

  const inputStyle = { padding: '7px 10px', border: `1.5px solid ${T.border}`, borderRadius: 8, background: T.surface, color: T.textPri, fontSize: 12, fontFamily: 'inherit', outline: 'none' };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .je-row:hover { background: ${isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'} !important; }
        .je-select option { background: ${isDark ? '#0f172a' : '#fff'}; color: ${T.textPri}; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(139,92,246,0.15)' : '#f5f3ff', border: '1.5px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaBook size={15} color="#8b5cf6" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Journal Entries</h1>
            <p style={{ fontSize: 12, color: T.textSec, margin: '2px 0 0' }}>Manual &amp; system-posted double-entry transactions</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          <span style={{ color: T.textSec, fontSize: 12 }}>to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
          <button onClick={() => { resetForm(); setShowModal(true); }} style={{ padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaPlus size={10} /> New Entry
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.textSec, fontSize: 13 }}>Loading journal entries…</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No journal entries</p>
          <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>No entries in this period. Post one with “New Entry”.</p>
        </div>
      ) : (
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '28px 130px 1fr 120px 130px 130px', padding: '10px 18px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
            {['', 'Entry / Date', 'Description', 'Type', 'Debit', 'Credit'].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {entries.map(e => {
            const open = expanded === e._id;
            const color = REFTYPE_COLOR[e.refType] || T.textSec;
            return (
              <div key={e._id}>
                <div className="je-row" onClick={() => setExpanded(open ? null : e._id)}
                  style={{ display: 'grid', gridTemplateColumns: '28px 130px 1fr 120px 130px 130px', padding: '12px 18px', borderTop: `1px solid ${T.border}`, alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{ color: T.textSec }}>{open ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}</span>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textPri, fontWeight: 600 }}>{e.entryNumber}</div>
                    <div style={{ fontSize: 11, color: T.textSec }}>{e.date}</div>
                  </div>
                  <span style={{ fontSize: 13, color: T.textPri }}>{e.description || '—'}{e.reference ? <span style={{ color: T.textSec, fontSize: 11 }}> · {e.reference}</span> : ''}</span>
                  <span><span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color, background: `${color}1a`, padding: '3px 8px', borderRadius: 6 }}>{e.refType}</span></span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textPri, textAlign: 'right' }}>{fmt(e.totalDebit)}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textPri, textAlign: 'right' }}>{fmt(e.totalCredit)}</span>
                </div>
                {open && (
                  <div style={{ padding: '4px 18px 14px 46px', background: isDark ? 'rgba(255,255,255,0.015)' : '#fafbfc' }}>
                    {(e.lines ?? []).map((l, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px', padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
                        <span style={{ fontSize: 12, color: T.textPri }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", color: T.textSec, marginRight: 8 }}>{l.accountCode || '—'}</span>
                          {l.accountName || '(unknown account)'}
                        </span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textPri, textAlign: 'right' }}>{l.debit > 0 ? fmt(l.debit) : '—'}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textPri, textAlign: 'right' }}>{l.credit > 0 ? fmt(l.credit) : '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: T.bg, border: `1.5px solid ${T.border}`, borderRadius: 16, width: '100%', maxWidth: 820, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: T.textPri, margin: 0 }}>New Journal Entry</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSec }}><FaTimes size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: 'block', marginBottom: 4 }}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: 'block', marginBottom: 4 }}>Reference (optional)</label>
                <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="e.g. Adjustment, refund" style={{ ...inputStyle, width: '100%' }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: 'block', marginBottom: 4 }}>Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What is this entry for?" style={{ ...inputStyle, width: '100%' }} />
            </div>

            {/* Lines */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 28px', gap: 8, padding: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textSec }}>
              <span>Account</span><span style={{ textAlign: 'right' }}>Debit</span><span style={{ textAlign: 'right' }}>Credit</span><span />
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select className="je-select" value={l.accountId} onChange={e => pickAccount(i, e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer' }}>
                  <option value="">Select account…</option>
                  {accounts.map(a => <option key={a._id} value={a._id}>{a.accountCode} · {a.accountName}</option>)}
                </select>
                <input type="number" min="0" step="0.01" value={l.debit} onChange={e => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} placeholder="0.00" style={{ ...inputStyle, width: '100%', textAlign: 'right', fontFamily: "'DM Mono',monospace" }} />
                <input type="number" min="0" step="0.01" value={l.credit} onChange={e => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} placeholder="0.00" style={{ ...inputStyle, width: '100%', textAlign: 'right', fontFamily: "'DM Mono',monospace" }} />
                <button onClick={() => setLines(ls => ls.length > 2 ? ls.filter((_, j) => j !== i) : ls)} disabled={lines.length <= 2}
                  style={{ background: 'none', border: 'none', cursor: lines.length > 2 ? 'pointer' : 'not-allowed', color: lines.length > 2 ? '#ef4444' : T.textSec, opacity: lines.length > 2 ? 1 : 0.4 }}><FaTrash size={12} /></button>
              </div>
            ))}
            <button onClick={() => setLines(ls => [...ls, emptyLine()])} style={{ background: 'none', border: `1.5px dashed ${T.border}`, borderRadius: 8, color: T.textSec, fontSize: 12, fontWeight: 600, padding: '7px 14px', cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FaPlus size={9} /> Add line
            </button>

            {/* Totals */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 28px', gap: 8, marginTop: 14, padding: '12px 0', borderTop: `2px solid ${T.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.textPri, alignSelf: 'center' }}>
                Totals {balanced ? <span style={{ color: '#10b981', fontSize: 11 }}>✓ balanced</span> : <span style={{ color: '#ef4444', fontSize: 11 }}>✕ out by {baseCurrency()} {fmt(Math.abs(totalDebit - totalCredit))}</span>}
              </span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 800, color: T.textPri, textAlign: 'right' }}>{fmt(totalDebit)}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 800, color: T.textPri, textAlign: 'right' }}>{fmt(totalCredit)}</span>
              <span />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 18px', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 9, color: T.textPri, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving || !balanced} style={{ padding: '9px 22px', background: balanced ? '#8b5cf6' : T.border, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving || !balanced ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Posting…' : 'Post Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
