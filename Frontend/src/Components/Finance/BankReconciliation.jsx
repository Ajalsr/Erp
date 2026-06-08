import { useState, useEffect, useCallback } from 'react';
import { FaUniversity, FaCheckCircle, FaSync } from 'react-icons/fa';
import toast from 'react-hot-toast';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';

const fmt = v => Number(v || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BankReconciliation() {
  const isDark = useThemeStore(s => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const today = new Date().toISOString().slice(0, 10);

  const [accounts, setAccounts]   = useState([]);
  const [accountId, setAccountId] = useState('');
  const [stmtDate, setStmtDate]   = useState(today);
  const [stmtBalance, setStmtBalance] = useState('');
  const [txns, setTxns]           = useState([]);
  const [bookBalance, setBookBalance] = useState(0);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [history, setHistory]     = useState([]);

  // Bank/cash accounts only
  useEffect(() => {
    axiosInstance.get('/api/accounts/?limit=500')
      .then(res => {
        const banks = (res.data?.data?.accounts ?? []).filter(a => a.isBankAccount);
        setAccounts(banks);
        if (banks.length && !accountId) setAccountId(banks[0]._id);
      }).catch(() => setAccounts([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTxns = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/bank-reconciliation/transactions', { params: { accountId, endDate: stmtDate } });
      setTxns(res.data?.data?.transactions ?? []);
      setBookBalance(res.data?.data?.bookBalance ?? 0);
    } catch { setTxns([]); } finally { setLoading(false); }
  }, [accountId, stmtDate]);

  const loadHistory = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await axiosInstance.get('/api/bank-reconciliation/', { params: { accountId } });
      setHistory(res.data?.data ?? []);
    } catch { setHistory([]); }
  }, [accountId]);

  useEffect(() => { loadTxns(); loadHistory(); }, [loadTxns, loadHistory]);

  const clearedBalance = txns.reduce((s, t) => s + (t.cleared ? t.amount : 0), 0);
  const difference = (Number(stmtBalance) || 0) - clearedBalance;
  const isBalanced = Math.abs(difference) < 0.005 && stmtBalance !== '';

  const toggle = async (t) => {
    const next = !t.cleared;
    setTxns(ts => ts.map(x => x.id === t.id ? { ...x, cleared: next } : x)); // optimistic
    try {
      await axiosInstance.post('/api/bank-reconciliation/toggle', { accountId, jeId: t.id, cleared: next });
    } catch {
      setTxns(ts => ts.map(x => x.id === t.id ? { ...x, cleared: !next } : x)); // revert
      toast.error('Failed to update');
    }
  };

  const finish = async () => {
    if (!isBalanced) { toast.error('Difference must be zero to reconcile'); return; }
    setSaving(true);
    try {
      const res = await axiosInstance.post('/api/bank-reconciliation/', { accountId, statementDate: stmtDate, statementBalance: Number(stmtBalance) });
      toast.success(res.data?.message || 'Reconciled');
      loadHistory();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reconcile');
    } finally { setSaving(false); }
  };

  const inputStyle = { padding: '7px 12px', border: `1.5px solid ${T.border}`, borderRadius: 8, background: T.surface, color: T.textPri, fontSize: 12, fontFamily: 'inherit', outline: 'none' };

  const Stat = ({ label, value, color }) => (
    <div style={{ flex: 1, padding: '12px 16px', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12 }}>
      <div style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 800, color: color || T.textPri, marginTop: 4 }}>{fmt(value)}</div>
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .br-row:hover { background: ${isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'} !important; }
        .br-select option { background: ${isDark ? '#0f172a' : '#fff'}; color: ${T.textPri}; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(6,182,212,0.15)' : '#ecfeff', border: '1.5px solid rgba(6,182,212,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaUniversity size={15} color="#06b6d4" />
        </div>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Bank Reconciliation</h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: '2px 0 0' }}>Match book transactions to your bank statement</p>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: 'block', marginBottom: 4 }}>Bank / Cash account</label>
          <select className="br-select" value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...inputStyle, minWidth: 220, cursor: 'pointer' }}>
            {accounts.length === 0 && <option value="">No bank accounts — mark one in Chart of Accounts</option>}
            {accounts.map(a => <option key={a._id} value={a._id}>{a.accountCode} · {a.accountName}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: 'block', marginBottom: 4 }}>Statement date</label>
          <input type="date" value={stmtDate} onChange={e => setStmtDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: 'block', marginBottom: 4 }}>Statement ending balance</label>
          <input type="number" step="0.01" value={stmtBalance} onChange={e => setStmtBalance(e.target.value)} placeholder="0.00" style={{ ...inputStyle, textAlign: 'right', fontFamily: "'DM Mono',monospace" }} />
        </div>
        <button onClick={() => { loadTxns(); loadHistory(); }} style={{ ...inputStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: T.textSec }}><FaSync size={11} /> Refresh</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <Stat label="Statement balance" value={Number(stmtBalance) || 0} />
        <Stat label="Cleared balance" value={clearedBalance} color="#06b6d4" />
        <Stat label="Difference" value={difference} color={isBalanced ? '#10b981' : '#ef4444'} />
        <Stat label="Book balance" value={bookBalance} />
      </div>

      {/* Balance banner + finish */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, marginBottom: 18, border: '1px solid', background: isBalanced ? (isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.06)' : '#fef2f2'), borderColor: isBalanced ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: isBalanced ? '#10b981' : '#ef4444' }}>
          {stmtBalance === '' ? 'Enter the statement ending balance, then tick transactions that appear on your statement.'
            : isBalanced ? 'Balanced — cleared transactions match the statement. Ready to reconcile.'
            : `Off by AED ${fmt(Math.abs(difference))} — tick/untick transactions until the difference is zero.`}
        </span>
        <button onClick={finish} disabled={!isBalanced || saving}
          style={{ padding: '8px 18px', background: isBalanced ? '#10b981' : T.border, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: !isBalanced || saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FaCheckCircle size={11} /> {saving ? 'Saving…' : 'Finish Reconciliation'}
        </button>
      </div>

      {/* Transactions */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: T.textSec, fontSize: 13 }}>Loading transactions…</div>
      ) : txns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: T.textSec, fontSize: 13 }}>No transactions for this account up to the statement date.</div>
      ) : (
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 110px 1fr 140px 150px', padding: '10px 18px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
            {['Cleared', 'Date', 'Description', 'Type', 'Amount'].map((h, i) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textSec, textAlign: i === 4 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {txns.map(t => (
            <div key={t.id} className="br-row" onClick={() => toggle(t)}
              style={{ display: 'grid', gridTemplateColumns: '60px 110px 1fr 140px 150px', padding: '11px 18px', borderTop: `1px solid ${T.border}`, alignItems: 'center', cursor: 'pointer', background: t.cleared ? (isDark ? 'rgba(6,182,212,0.06)' : 'rgba(6,182,212,0.04)') : 'transparent' }}>
              <input type="checkbox" checked={t.cleared} readOnly style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#06b6d4' }} />
              <span style={{ fontSize: 12, color: T.textSec }}>{t.date}</span>
              <span style={{ fontSize: 13, color: T.textPri }}>{t.description || '—'}{t.reference ? <span style={{ color: T.textSec, fontSize: 11 }}> · {t.reference}</span> : ''}</span>
              <span style={{ fontSize: 11, color: T.textSec }}>{t.refType}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600, color: t.amount >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>{t.amount >= 0 ? '+' : ''}{fmt(t.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 10 }}>Past reconciliations</h3>
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {history.map(r => (
              <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${T.border}`, fontSize: 12 }}>
                <span style={{ color: T.textPri }}>{r.statementDate} · {r.clearedCount} txns cleared</span>
                <span style={{ fontFamily: "'DM Mono',monospace", color: '#10b981', fontWeight: 600 }}>{fmt(r.statementBalance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
