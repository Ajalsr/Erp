import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaBoxOpen, FaExclamationTriangle, FaClock } from 'react-icons/fa';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// Days until expiry (null if no expiry date)
const daysToExpiry = (d) => {
  if (!d) return null;
  const ms = new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
};

// Expiry bucket
function expiryState(d) {
  const days = daysToExpiry(d);
  if (days === null) return { key: 'none',    label: 'No Expiry', color: '#64748b', bg: 'rgba(100,116,139,.12)' };
  if (days < 0)      return { key: 'expired',  label: 'Expired',   color: '#ef4444', bg: 'rgba(239,68,68,.13)'  };
  if (days <= 30)    return { key: 'soon',     label: `${days}d left`, color: '#f59e0b', bg: 'rgba(245,158,11,.13)' };
  return { key: 'ok', label: `${days}d left`, color: '#10b981', bg: 'rgba(16,185,129,.12)' };
}

export default function BatchExpiry() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // all | expired | soon

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/grns/batches');
      setBatches(res.data?.data?.batches || []);
    } catch {
      nexusToast.error('Failed to load batch data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const enriched = batches.map(b => ({ ...b, exp: expiryState(b.expiryDate) }));

  const filtered = enriched.filter(b => {
    const matchFilter = filter === 'all' || b.exp.key === filter;
    const matchSearch = !search
      || b.name?.toLowerCase().includes(search.toLowerCase())
      || b.itemCode?.toLowerCase().includes(search.toLowerCase())
      || b.batchNumber?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const expiredCount = enriched.filter(b => b.exp.key === 'expired').length;
  const soonCount    = enriched.filter(b => b.exp.key === 'soon').length;

  const th = { padding: '11px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' };
  const td = { padding: '12px 16px', fontSize: 13, color: T.textPri };

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: T.bg, padding: '24px 28px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Batch &amp; Expiry</h1>
        <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Batch-tracked goods received via GRN — monitor expiry and traceability.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Batches', val: enriched.length, color: '#3b82f6' },
          { label: 'Expiring ≤ 30d', val: soonCount, color: '#f59e0b' },
          { label: 'Expired', val: expiredCount, color: '#ef4444' },
        ].map(c => (
          <div key={c.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.textSec, margin: 0, textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.label}</p>
            <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: c.color, margin: '6px 0 0' }}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textSec, fontSize: 12 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, code, batch…"
            style={{ width: '100%', padding: '9px 12px 9px 32px', border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface, color: T.textPri, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        {[['all', 'All'], ['soon', 'Expiring Soon'], ['expired', 'Expired']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${filter === v ? '#3b82f6' : T.border}`, background: filter === v ? (isDark ? 'rgba(59,130,246,.15)' : '#eff6ff') : T.surface, color: filter === v ? '#3b82f6' : T.textSec, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,.03)' : '#f8fafc', borderBottom: `1px solid ${T.border}` }}>
                {['Item', 'Code', 'Batch No.', 'Qty', 'Expiry', 'Status', 'Source GRN', 'Vendor'].map(h => (
                  <th key={h} style={{ ...th, textAlign: h === 'Qty' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', padding: 40, color: T.textSec }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', padding: 48, color: T.textSec }}>
                  <FaBoxOpen size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 10px' }} />
                  No batch-tracked stock. Enter a batch number when receiving goods in a GRN.
                </td></tr>
              ) : filtered.map((b, i) => (
                <tr key={`${b.batchNumber}-${i}`} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ ...td, fontWeight: 600 }}>{b.name}</td>
                  <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textSec }}>{b.itemCode || '—'}</td>
                  <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: '#8b5cf6' }}>{b.batchNumber}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{b.qty} {b.unit || ''}</td>
                  <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{fmtDate(b.expiryDate)}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: b.exp.bg, color: b.exp.color, whiteSpace: 'nowrap' }}>
                      {b.exp.key === 'expired' ? <FaExclamationTriangle size={9} style={{ marginRight: 5 }} /> : b.exp.key === 'soon' ? <FaClock size={9} style={{ marginRight: 5 }} /> : null}
                      {b.exp.label}
                    </span>
                  </td>
                  <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.blue || '#3b82f6' }}>{b.grnNumber}</td>
                  <td style={{ ...td, color: T.textSec }}>{b.vendorName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
