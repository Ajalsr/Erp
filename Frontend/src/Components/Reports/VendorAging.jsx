import { useState, useCallback } from 'react';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { useBaseCurrency, baseCurrency } from '../../helper/currency';
import { usePermissions } from '../../helper/permissions';

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKETS = [
  { key: 'current', label: 'Current',  color: '#10b981' },
  { key: '1_30',    label: '1–30 Days', color: '#f59e0b' },
  { key: '31_60',   label: '31–60 Days', color: '#f97316' },
  { key: '61_90',   label: '61–90 Days', color: '#ef4444' },
  { key: '90_plus', label: '90+ Days',  color: '#7f1d1d' },
  { key: 'total',   label: 'Total',     color: '#3b82f6', bold: true },
];

export default function VendorAging() {
  useBaseCurrency();
  const isDark  = useThemeStore((s) => s.isDark);
  const T       = getTheme(isDark);
  const { can } = usePermissions();
  const canExport = can('reports', 'export');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/reports/vendor-aging');
      setData(res.data?.data);
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to load vendor aging');
    } finally { setLoading(false); }
  }, []);

  const exportCSV = () => {
    if (!data) return;
    const header = ['Vendor', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total'];
    const rows = (data.rows || []).map((r) => [
      r.vendorName, r.current, r['1_30'], r['31_60'], r['61_90'], r['90_plus'], r.total,
    ]);
    const s = data.summary;
    rows.push(['TOTAL', s.current, s['1_30'], s['31_60'], s['61_90'], s['90_plus'], s.total]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `vendor_aging_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const thStyle = { padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' };
  const tdStyle = (align = 'right') => ({ padding: '11px 16px', fontSize: 13, textAlign: align, fontFamily: "'DM Mono', monospace" });

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.textPri || T.text, fontFamily: "'DM Sans', sans-serif", padding: 28 }}>
      <style>{`* { box-sizing: border-box; } @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Sora:wght@700;800&display=swap');`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri || T.text, margin: '0 0 4px', letterSpacing: '-0.4px' }}>Vendor Aging Report</h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>Outstanding payables bucketed by days past due</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {data && canExport && (
            <button onClick={exportCSV} style={{ padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1.5px solid ${T.border}`, color: T.textPri || T.text, fontFamily: 'inherit' }}>
              ⬇ Export CSV
            </button>
          )}
          <button onClick={load} disabled={loading}
            style={{ padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Loading…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: T.textSec, fontSize: 14 }}>
          Click Generate Report to load vendor aging data
        </div>
      )}

      {data && (
        <>
          {/* Summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 24 }}>
            {BUCKETS.map((b) => (
              <div key={b.key} style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `3px solid ${b.color}`, borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 6px' }}>{b.label}</p>
                <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: b.color, margin: 0 }}>
                  {baseCurrency()} {fmt(data.summary[b.key])}
                </p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}` }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: T.textPri || T.text, margin: 0 }}>
                By Vendor — {data.rows?.length || 0} vendors with outstanding balances
              </h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Vendor</th>
                    {BUCKETS.map((b) => (
                      <th key={b.key} style={{ ...thStyle, color: b.color }}>{b.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.rows || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: T.textSec, fontSize: 13 }}>
                        No outstanding vendor payables
                      </td>
                    </tr>
                  ) : (data.rows || []).map((r, i) => (
                    <tr key={r.vendorId || i} style={{ borderBottom: `1px solid ${T.border}` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: T.textPri || T.text }}>{r.vendorName}</td>
                      {BUCKETS.map((b) => (
                        <td key={b.key} style={{ ...tdStyle(), color: r[b.key] > 0 ? b.color : T.textSec, fontWeight: b.bold ? 700 : 400 }}>
                          {r[b.key] > 0 ? `${baseCurrency()} ${fmt(r[b.key])}` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ background: isDark ? 'rgba(59,130,246,0.06)' : '#eff6ff', borderTop: `2px solid ${T.border}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: 13, color: T.textPri || T.text }}>TOTAL</td>
                    {BUCKETS.map((b) => (
                      <td key={b.key} style={{ ...tdStyle(), fontWeight: 800, color: b.color }}>
                        {baseCurrency()} {fmt(data.summary[b.key])}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
