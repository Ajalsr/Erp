import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaExclamationTriangle, FaCartPlus, FaBoxOpen } from 'react-icons/fa';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

const fmtAED = (n) => `AED ${parseFloat(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS = {
  out:       { label: 'Out of Stock', color: '#ef4444', bg: 'rgba(239,68,68,0.13)'  },
  low_stock: { label: 'Low Stock',    color: '#f59e0b', bg: 'rgba(245,158,11,0.13)' },
};

export default function ReorderAlerts() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const navigate = useNavigate();

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // all | out | low_stock

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/stocks/getitem');
      setItems(res.data?.data || []);
    } catch {
      nexusToast.error('Failed to load stock data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Only items at or below reorder point (needs reorder_point set)
  const alerts = items
    .map(item => {
      const qty     = parseFloat(item.quantity || 0);
      const reorder = parseFloat(item.reorder_point || 0);
      const cost    = parseFloat(item.cost_price || 0);
      const status  = qty <= 0 ? 'out' : 'low_stock';
      const shortfall = Math.max(0, reorder - qty);
      return { ...item, qty, reorder, cost, status, shortfall, refillValue: shortfall * cost };
    })
    .filter(i => i.reorder > 0 && i.qty <= i.reorder);

  const filtered = alerts.filter(i => {
    const matchFilter = filter === 'all' || i.status === filter;
    const matchSearch = !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.item_code?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const outCount = alerts.filter(i => i.status === 'out').length;
  const lowCount = alerts.filter(i => i.status === 'low_stock').length;
  const totalRefill = alerts.reduce((s, i) => s + i.refillValue, 0);

  const handleCreatePO = (item) => {
    // PO create form does not yet accept prefill state — land on the create page.
    navigate('/Purchase/Purchaseorders/Newpurchaseorders', {
      state: { prefillItem: { itemId: item._id, name: item.name, itemCode: item.item_code, qty: item.shortfall || 1, rate: item.cost, vendorId: item.preferred_vendor || '' } },
    });
  };

  const th = { padding: '11px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' };
  const td = { padding: '12px 16px', fontSize: 13, color: T.textPri };

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: T.bg, padding: '24px 28px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Reorder Alerts</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Items at or below their reorder point — restock to avoid stockouts.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Out of Stock', val: outCount, color: '#ef4444' },
          { label: 'Low Stock',    val: lowCount, color: '#f59e0b' },
          { label: 'Items to Reorder', val: alerts.length, color: '#3b82f6' },
          { label: 'Est. Refill Cost', val: fmtAED(totalRefill), color: '#10b981', mono: true },
        ].map(c => (
          <div key={c.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.textSec, margin: 0, textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.label}</p>
            <p style={{ fontFamily: c.mono ? "'DM Mono',monospace" : "'Sora',sans-serif", fontSize: c.mono ? 16 : 22, fontWeight: 800, color: c.color, margin: '6px 0 0' }}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textSec, fontSize: 12 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
            style={{ width: '100%', padding: '9px 12px 9px 32px', border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface, color: T.textPri, fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        {[['all', 'All'], ['out', 'Out of Stock'], ['low_stock', 'Low Stock']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${filter === v ? '#3b82f6' : T.border}`, background: filter === v ? (isDark ? 'rgba(59,130,246,.15)' : '#eff6ff') : T.surface, color: filter === v ? '#3b82f6' : T.textSec, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,.03)' : '#f8fafc', borderBottom: `1px solid ${T.border}` }}>
                {['Item', 'Code', 'Qty on Hand', 'Reorder Point', 'Shortfall', 'Status', ''].map((h, i) => (
                  <th key={h || i} style={{ ...th, textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 40, color: T.textSec }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 48, color: T.textSec }}>
                  <FaBoxOpen size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 10px' }} />
                  No items need reordering. {alerts.length === 0 && 'Set reorder points on items to enable alerts.'}
                </td></tr>
              ) : filtered.map(item => {
                const sm = STATUS[item.status];
                return (
                  <tr key={item._id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>{item.name}</td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textSec }}>{item.item_code || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 700, color: sm.color }}>{item.qty} {item.unit || ''}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: "'DM Mono',monospace", color: T.textSec }}>{item.reorder}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: 700, color: '#f59e0b' }}>{item.shortfall}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sm.bg, color: sm.color, whiteSpace: 'nowrap' }}>
                        <FaExclamationTriangle size={9} style={{ marginRight: 5 }} />{sm.label}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => handleCreatePO(item)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        <FaCartPlus size={11} /> Create PO
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
