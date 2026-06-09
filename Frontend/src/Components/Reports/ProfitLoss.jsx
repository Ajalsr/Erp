import { useState, useEffect, useCallback } from 'react';
import { FaChartLine, FaFilter } from 'react-icons/fa';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import { useBaseCurrency, baseCurrency } from '../../helper/currency';

const fmt = v => Number(v || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ProfitLoss() {
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/reports/profit-loss', { params: { startDate, endDate } });
      setData(res.data?.data ?? null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const net = data?.netProfit ?? 0;
  const isProfit = net >= 0;

  const Section = ({ title, section, color }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px', background: isDark ? `${color}14` : `${color}09`, borderRadius: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>{title}</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 800, color }}>{fmt(section?.total)}</span>
      </div>
      {(section?.rows ?? []).map((r, i) => (
        <div key={i} className="pl-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px', borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 13, color: T.textPri }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: T.textSec, marginRight: 10 }}>{r.accountCode || '—'}</span>
            {r.accountName || '—'}
          </span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textPri }}>{fmt(r.balance)}</span>
        </div>
      ))}
      {(!section?.rows || section.rows.length === 0) && (
        <div style={{ padding: '12px 20px', fontSize: 12, color: T.textSec }}>No {title.toLowerCase()} in this period.</div>
      )}
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .pl-row:hover { background: ${isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'} !important; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(245,158,11,0.15)' : '#fffbeb', border: '1.5px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaChartLine size={16} color="#f59e0b" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Profit &amp; Loss</h1>
            <p style={{ fontSize: 12, color: T.textSec, margin: '2px 0 0' }}>Income statement — revenue less expenses over a period</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '7px 12px', border: `1.5px solid ${T.border}`, borderRadius: 8, background: T.surface, color: T.textPri, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          <span style={{ color: T.textSec, fontSize: 12 }}>to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '7px 12px', border: `1.5px solid ${T.border}`, borderRadius: 8, background: T.surface, color: T.textPri, fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={fetchData} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaFilter size={10} /> Apply
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: T.textSec, fontSize: 13 }}>Loading profit &amp; loss…</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No data</p>
          <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>No journal entries in this period or accounts not seeded yet.</p>
        </div>
      ) : (
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', padding: '16px 0' }}>
          <Section title="Income" section={data.income} color="#10b981" />
          <Section title="Expenses" section={data.expense} color="#ef4444" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', margin: '4px 16px 0', borderRadius: 10, background: isProfit ? (isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2'), border: `1.5px solid ${isProfit ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.textPri }}>{isProfit ? 'Net Profit' : 'Net Loss'}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 800, color: isProfit ? '#10b981' : '#ef4444' }}>{baseCurrency()} {fmt(Math.abs(net))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
