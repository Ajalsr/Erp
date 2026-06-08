import { useState, useEffect, useCallback } from 'react';
import { FaMoneyBillWave, FaFilter } from 'react-icons/fa';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';

const fmt = v => Number(v || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = v => `${v < 0 ? '-' : ''}AED ${fmt(Math.abs(v || 0))}`;

export default function CashFlow() {
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
      const res = await axiosInstance.get('/api/reports/cash-flow', { params: { startDate, endDate } });
      setData(res.data?.data ?? null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const Line = ({ label, value, strong, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: strong ? '14px 20px' : '10px 20px', borderBottom: `1px solid ${T.border}`, background: strong ? (isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc') : 'transparent' }}>
      <span style={{ fontSize: strong ? 14 : 13, fontWeight: strong ? 800 : 500, color: T.textPri }}>{label}</span>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: strong ? 14 : 12, fontWeight: strong ? 800 : 600, color: color || ((value ?? 0) >= 0 ? T.textPri : '#ef4444') }}>{signed(value)}</span>
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4', border: '1.5px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaMoneyBillWave size={16} color="#10b981" />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Cash Flow</h1>
            <p style={{ fontSize: 12, color: T.textSec, margin: '2px 0 0' }}>Cash movement through bank &amp; cash accounts over a period</p>
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
        <div style={{ textAlign: 'center', padding: 60, color: T.textSec, fontSize: 13 }}>Loading cash flow…</div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No data</p>
          <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>No journal entries in this period or no bank/cash accounts configured.</p>
        </div>
      ) : (
        <>
          <div style={{ maxWidth: 640, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <Line label="Opening cash balance" value={data.opening} />
            <Line label="Operating activities" value={data.operating} />
            <Line label="Investing activities" value={data.investing} />
            <Line label="Financing activities" value={data.financing} />
            <Line label="Net change in cash" value={data.netChange} strong color={(data.netChange ?? 0) >= 0 ? '#10b981' : '#ef4444'} />
            <Line label="Closing cash balance" value={data.closing} strong />
          </div>
          <p style={{ fontSize: 11, color: T.textSec, marginTop: 12, maxWidth: 640 }}>
            Approximate (direct method): cash movement is taken from journal entries touching bank/cash accounts and categorised by the counterpart account. Mark cash/bank accounts in Chart of Accounts for accuracy.
          </p>
        </>
      )}
    </div>
  );
}
