import { useState, useEffect, useCallback } from 'react';
import { FaBalanceScale, FaDownload, FaFilter } from 'react-icons/fa';
import AppDatePicker from '../common/AppDatePicker';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import { useBaseCurrency, baseCurrency } from '../../helper/currency';

const TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense'];
const TYPE_COLOR = {
  asset:     '#3b82f6',
  liability: '#ef4444',
  equity:    '#10b981',
  income:    '#f59e0b',
  expense:   '#8b5cf6',
};

const fmt = v => Number(v || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TrialBalance() {
  useBaseCurrency();
  const isDark = useThemeStore(s => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate]     = useState(today);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);

  const fetchTB = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/accounts/trial-balance', {
        params: { startDate, endDate },
      });
      setData(res.data?.data ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchTB(); }, [fetchTB]);

  // Group rows by accountType
  const grouped = {};
  TYPE_ORDER.forEach(t => { grouped[t] = []; });
  (data?.rows ?? []).forEach(r => {
    const t = r.accountType || 'expense';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(r);
  });

  const isBalanced = data
    ? Math.abs((data.grandDebit ?? 0) - (data.grandCredit ?? 0)) < 0.01
    : null;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .tb-row:hover { background: ${isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'} !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', border: '1.5px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaBalanceScale size={16} color="#3b82f6" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Trial Balance</h1>
            <p style={{ fontSize: 12, color: T.textSec, margin: '2px 0 0' }}>Debit and credit totals per account from journal entries</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AppDatePicker value={startDate} onChange={setStartDate} />
          <span style={{ color: T.textSec, fontSize: 12 }}>to</span>
          <AppDatePicker value={endDate} onChange={setEndDate} />
          <button onClick={fetchTB}
            style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaFilter size={10} /> Apply
          </button>
        </div>
      </div>

      {/* Balance status */}
      {isBalanced !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, marginBottom: 20, border: '1px solid', background: isBalanced ? (isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2'), borderColor: isBalanced ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)' }}>
          <span style={{ fontSize: 16 }}>{isBalanced ? '✓' : '✕'}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: isBalanced ? '#10b981' : '#ef4444' }}>
            {isBalanced ? 'Entries are balanced — total debits equal total credits' : `Out of balance by ${baseCurrency()} ${fmt(Math.abs((data?.grandDebit ?? 0) - (data?.grandCredit ?? 0)))}`}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.textSec, fontSize: 13 }}>Loading trial balance…</div>
      ) : !data || data.rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No journal entries found</p>
          <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>No transactions in this period or accounts not seeded yet.</p>
        </div>
      ) : (
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 140px 140px', padding: '10px 20px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
            {['Code', 'Account Name', 'Debit', 'Credit', 'Balance'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, textAlign: h !== 'Code' && h !== 'Account Name' ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>

          {TYPE_ORDER.map(type => {
            const rows = grouped[type] || [];
            if (!rows.length) return null;
            const typeDebit  = rows.reduce((s, r) => s + (r.totalDebit  || 0), 0);
            const typeCredit = rows.reduce((s, r) => s + (r.totalCredit || 0), 0);
            const color = TYPE_COLOR[type] || T.textSec;
            return (
              <div key={type}>
                {/* Group header */}
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 140px 140px', padding: '8px 20px', background: isDark ? `${color}14` : `${color}09`, borderTop: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color, gridColumn: '1/3' }}>{type}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color, textAlign: 'right' }}>{fmt(typeDebit)}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color, textAlign: 'right' }}>{fmt(typeCredit)}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color, textAlign: 'right' }}>{fmt(typeDebit - typeCredit)}</span>
                </div>
                {/* Rows */}
                {rows.map((r, i) => (
                  <div key={i} className="tb-row"
                    style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 140px 140px', padding: '10px 20px', borderTop: `1px solid ${T.border}`, alignItems: 'center' }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textSec }}>{r.accountCode || '—'}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.textPri }}>{r.accountName || '—'}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textPri, textAlign: 'right' }}>{r.totalDebit > 0 ? fmt(r.totalDebit) : '—'}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textPri, textAlign: 'right' }}>{r.totalCredit > 0 ? fmt(r.totalCredit) : '—'}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, color: (r.balance ?? 0) >= 0 ? '#10b981' : '#ef4444', textAlign: 'right' }}>{fmt(r.balance)}</span>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Grand totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 140px 140px', padding: '14px 20px', borderTop: `2px solid ${T.border}`, background: T.surface2 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: T.textPri, gridColumn: '1/3' }}>TOTAL</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 800, color: T.textPri, textAlign: 'right' }}>{fmt(data.grandDebit)}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 800, color: T.textPri, textAlign: 'right' }}>{fmt(data.grandCredit)}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 800, color: isBalanced ? '#10b981' : '#ef4444', textAlign: 'right' }}>{fmt((data.grandDebit ?? 0) - (data.grandCredit ?? 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
