import { useState, useEffect, useCallback } from 'react';
import { FaBalanceScale, FaFilter } from 'react-icons/fa';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';

const fmt = v => Number(v || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BalanceSheet() {
  const isDark = useThemeStore(s => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf]       = useState(today);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/reports/balance-sheet', { params: { asOf } });
      setData(res.data?.data ?? null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [asOf]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const Section = ({ title, section, color }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 18px', background: isDark ? `${color}14` : `${color}09`, borderRadius: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>{title}</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 800, color }}>{fmt(section?.total)}</span>
      </div>
      {(section?.rows ?? []).map((r, i) => (
        <div key={i} className="bs-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 18px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 13, color: T.textPri }}>{r.accountName || '—'}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textPri }}>{fmt(r.balance)}</span>
        </div>
      ))}
      {(!section?.rows || section.rows.length === 0) && (
        <div style={{ padding: '10px 18px', fontSize: 12, color: T.textSec }}>None.</div>
      )}
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .bs-row:hover { background: ${isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'} !important; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', border: '1.5px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaBalanceScale size={16} color="#3b82f6" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Balance Sheet</h1>
            <p style={{ fontSize: 12, color: T.textSec, margin: '2px 0 0' }}>Assets, liabilities &amp; equity as of a date</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: T.textSec, fontSize: 12 }}>As of</span>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} style={{ padding: '7px 12px', border: `1.5px solid ${T.border}`, borderRadius: 8, background: T.surface, color: T.textPri, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={fetchData} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaFilter size={10} /> Apply
          </button>
        </div>
      </div>

      {data && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, marginBottom: 20, border: '1px solid', background: data.balanced ? (isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2'), borderColor: data.balanced ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)' }}>
          <span style={{ fontSize: 16 }}>{data.balanced ? '✓' : '✕'}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: data.balanced ? '#10b981' : '#ef4444' }}>
            {data.balanced ? 'Balanced — Assets equal Liabilities plus Equity' : `Out of balance by AED ${fmt(Math.abs((data.totalAssets ?? 0) - (data.totalLiabEquity ?? 0)))}`}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.textSec, fontSize: 13 }}>Loading balance sheet…</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No data</p>
          <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>No journal entries up to this date or accounts not seeded yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Assets */}
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '16px 0' }}>
            <Section title="Assets" section={data.assets} color="#3b82f6" />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', margin: '0 14px', borderTop: `2px solid ${T.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.textPri }}>TOTAL ASSETS</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 800, color: '#3b82f6' }}>{fmt(data.totalAssets)}</span>
            </div>
          </div>
          {/* Liabilities + Equity */}
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '16px 0' }}>
            <Section title="Liabilities" section={data.liabilities} color="#ef4444" />
            <Section title="Equity" section={data.equity} color="#10b981" />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', margin: '0 14px', borderTop: `2px solid ${T.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.textPri }}>TOTAL LIAB. + EQUITY</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 800, color: T.textPri }}>{fmt(data.totalLiabEquity)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
