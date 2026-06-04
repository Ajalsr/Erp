import { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaBoxOpen, FaExclamationTriangle, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

const STATUS = {
  in_stock:  { label: 'In Stock',   color: '#10b981', bg: 'rgba(16,185,129,0.15)',  bgL: '#f0fdf4'  },
  low_stock: { label: 'Low Stock',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  bgL: '#fffbeb'  },
  out:       { label: 'Out of Stock',color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   bgL: '#fef2f2'  },
};

function stockStatus(qty, reorder) {
  if (qty <= 0)                              return 'out';
  if (reorder > 0 && qty <= reorder)         return 'low_stock';
  return 'in_stock';
}

export default function StockSummary() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [drawer, setDrawer]       = useState(null);
  const [drawerTab, setDrawerTab] = useState('details');
  const [history, setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [whNames, setWhNames]     = useState({}); // warehouseId → name
  const [backfilling, setBackfilling] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/stocks/getitem');
      setItems(res.data?.data || []);
    } catch {
      nexusToast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Warehouse id → name map for the per-warehouse breakdown
  useEffect(() => {
    axiosInstance.get('/api/warehouses/')
      .then(r => {
        const list = r.data?.data?.warehouses || r.data?.data || [];
        const m = {};
        list.forEach(w => { m[w._id] = w.name + (w.isDefault ? ' (default)' : ''); });
        setWhNames(m);
      })
      .catch(() => {});
  }, []);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await axiosInstance.post('/api/stocks/backfill-warehouse');
      nexusToast.success(res.data?.message || 'Warehouse stock seeded');
      fetchItems();
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Backfill failed');
    } finally { setBackfilling(false); }
  };

  // Reset tab + fetch history when drawer item changes
  useEffect(() => {
    if (!drawer) { setHistory([]); setDrawerTab('details'); return; }
    setDrawerTab('details');
    setHistory([]);
  }, [drawer?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = useCallback(async (itemId) => {
    setHistLoading(true);
    try {
      const res = await axiosInstance.get(`/api/inventory/adjustments/?itemId=${itemId}`);
      setHistory(res.data?.data?.adjustments || []);
    } catch { setHistory([]); }
    finally { setHistLoading(false); }
  }, []);

  const enriched = items.map(item => {
    const qty     = parseFloat(item.quantity || 0);
    const reorder = parseFloat(item.reorder_point || 0);
    const cost    = parseFloat(item.cost_price || 0);
    return { ...item, qty, reorder, cost, status: stockStatus(qty, reorder), stockValue: qty * cost };
  });

  const filtered = enriched.filter(i => {
    const matchFilter = filter === 'all' || i.status === filter;
    const matchSearch = !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.item_code?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalValue  = enriched.reduce((s, i) => s + i.stockValue, 0);
  const inStock     = enriched.filter(i => i.status === 'in_stock').length;
  const lowStock    = enriched.filter(i => i.status === 'low_stock').length;
  const outOfStock  = enriched.filter(i => i.status === 'out').length;

  const s = (key) => isDark ? STATUS[key].bg : STATUS[key].bgL;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .ss-row:hover { background: ${isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'} !important; }
      `}</style>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Stock Summary</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Real-time overview of all inventory levels</p>
        </div>
        <button onClick={handleBackfill} disabled={backfilling}
          title="Seed per-warehouse breakdown from current stock into the default warehouse"
          style={{ padding: '8px 14px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, fontSize: 12.5, fontWeight: 600, cursor: backfilling ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {backfilling ? 'Seeding…' : 'Seed Warehouses'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Items',    val: enriched.length,                                          color: '#3b82f6',            mono: true  },
          { label: 'In Stock',       val: inStock,                                                   color: STATUS.in_stock.color, mono: true  },
          { label: 'Low Stock',      val: lowStock,                                                  color: STATUS.low_stock.color,mono: true  },
          { label: 'Out of Stock',   val: outOfStock,                                                color: STATUS.out.color,      mono: true  },
        ].map(st => (
          <div key={st.label} onClick={() => setFilter(f => f === st.label.toLowerCase().replace(/ /g,'_') ? 'all' : (st.label === 'Total Items' ? 'all' : st.label.toLowerCase().replace(/ /g,'_')))}
            style={{ padding: '14px 18px', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, cursor: 'pointer', transition: 'all .15s' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 6px' }}>{st.label}</p>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 700, color: st.color, margin: 0 }}>{st.val}</p>
          </div>
        ))}
      </div>

      {/* Stock value */}
      <div style={{ padding: '16px 20px', background: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', border: `1.5px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'}`, borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>Total Stock Value</p>
        <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 800, color: '#3b82f6', margin: 0 }}>
          AED {totalValue.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 40, border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface }}>
          <FaSearch size={12} color={T.textSec} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T.textPri, fontFamily: 'inherit' }} />
          {search && <IoClose size={14} color={T.textSec} style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />}
        </div>
        {['all','in_stock','low_stock','out'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '0 16px', height: 40, borderRadius: 10, border: `1.5px solid ${filter === f ? (f === 'all' ? '#3b82f6' : STATUS[f]?.color || '#3b82f6') : T.border}`, background: filter === f ? (f === 'all' ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : s(f === 'all' ? 'in_stock' : f)) : T.surface2, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: filter === f ? (f === 'all' ? '#3b82f6' : STATUS[f]?.color) : T.textSec, fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' }}>
            {f === 'all' ? 'All' : STATUS[f]?.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 100px 100px 120px', padding: '9px 18px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
          {['Code','Name','Unit','Qty','Reorder','Status'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec }}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading stock data…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <FaBoxOpen size={28} color={T.border} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 4px' }}>No items found</p>
            <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>Try adjusting your search or filter.</p>
          </div>
        ) : filtered.map((item, i) => {
          const st = STATUS[item.status];
          return (
            <div key={item._id} className="ss-row" onClick={() => setDrawer(item)}
              style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 100px 100px 120px', padding: '12px 18px', borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', background: T.surface, cursor: 'pointer' }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600, color: T.textPri }}>{item.item_code || '—'}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.name}</p>
                {item.category && <p style={{ fontSize: 11, color: T.textSec, margin: '1px 0 0', textTransform: 'capitalize' }}>{item.category}</p>}
              </div>
              <span style={{ fontSize: 12, color: T.textSec }}>{item.unit || '—'}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: st.color }}>{item.qty}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textSec }}>{item.reorder || '—'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: isDark ? st.bg : st.bgL, color: st.color, width: 'fit-content' }}>
                {item.status === 'low_stock' && <FaExclamationTriangle size={9} />}
                {st.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Drawer */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setDrawer(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: 400, height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, display: 'flex', flexDirection: 'column', zIndex: 1 }}>

            {/* Header */}
            <div style={{ padding: '18px 22px 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{drawer.name}</h2>
                <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
              </div>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[['details','Details'],['history','History']].map(([tab, label]) => (
                  <button key={tab} onClick={() => { setDrawerTab(tab); if (tab === 'history' && history.length === 0) loadHistory(drawer._id); }}
                    style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', color: drawerTab === tab ? '#3b82f6' : T.textSec, borderBottom: `2px solid ${drawerTab === tab ? '#3b82f6' : 'transparent'}`, fontFamily: 'inherit', marginBottom: -1, transition: 'all .15s' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              {drawerTab === 'details' && (
                <>
                  {/* Stock bar */}
                  <div style={{ padding: 16, background: isDark ? STATUS[drawer.status].bg : STATUS[drawer.status].bgL, borderRadius: 12, marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: STATUS[drawer.status].color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{STATUS[drawer.status].label}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: STATUS[drawer.status].color }}>{drawer.qty} {drawer.unit}</span>
                    </div>
                    <div style={{ height: 6, background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: STATUS[drawer.status].color, width: drawer.reorder > 0 ? `${Math.min((drawer.qty / (drawer.reorder * 2)) * 100, 100)}%` : drawer.qty > 0 ? '60%' : '0%', transition: 'width .4s' }} />
                    </div>
                  </div>
                  {[
                    ['Item Code',    drawer.item_code || '—'],
                    ['Category',     drawer.category  || '—'],
                    ['Unit',         drawer.unit       || '—'],
                    ['Qty on Hand',  drawer.qty],
                    ['Reorder Point',drawer.reorder || '—'],
                    ['Cost Price',   drawer.cost ? `AED ${drawer.cost.toFixed(2)}` : '—'],
                    ['Stock Value',  `AED ${drawer.stockValue.toFixed(2)}`],
                    ['Selling Price',drawer.selling_price ? `AED ${parseFloat(drawer.selling_price).toFixed(2)}` : '—'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 12, color: T.textSec }}>{l}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.textPri, textAlign: 'right', maxWidth: '55%' }}>{v}</span>
                    </div>
                  ))}

                  {/* Per-warehouse breakdown */}
                  <div style={{ marginTop: 18 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>By Warehouse</p>
                    {drawer.warehouseStock && Object.keys(drawer.warehouseStock).length > 0 ? (
                      <div style={{ background: T.surface2 || (isDark ? 'rgba(255,255,255,.03)' : '#f8fafc'), border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                        {Object.entries(drawer.warehouseStock).map(([wid, q], i, arr) => (
                          <div key={wid} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 13px', borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                            <span style={{ fontSize: 12.5, color: T.textPri }}>{whNames[wid] || 'Unknown warehouse'}</span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, fontWeight: 700, color: q > 0 ? T.textPri : T.textSec }}>{q} {drawer.unit}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>No warehouse breakdown yet. Use “Seed Warehouses” to populate from current stock.</p>
                    )}
                  </div>
                </>
              )}

              {drawerTab === 'history' && (
                histLoading ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', fontSize: 13, color: T.textSec }}>Loading history…</div>
                ) : history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <FaBoxOpen size={26} color={T.border} style={{ marginBottom: 10 }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: '0 0 4px' }}>No history yet</p>
                    <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>Adjustments and returns will appear here.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.map((h, i) => {
                      const isInc = h.type === 'increase';
                      const color = isInc ? '#10b981' : '#ef4444';
                      const reasonLabel = { damaged:'Damaged', expired:'Expired', found:'Found', correction:'Correction', return:'Sales Return', transfer:'Transfer', other:'Other', sale:'Sale', purchase:'Purchase' }[h.reason] || h.reason || '—';
                      const date = h.adjustedAt || h.createdAt;
                      return (
                        <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: isInc ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isInc ? <FaArrowUp size={12} color={color} /> : <FaArrowDown size={12} color={color} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: T.textPri }}>{reasonLabel}</span>
                              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color }}>{isInc ? '+' : '-'}{h.quantity}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                              <span style={{ fontSize: 11, color: T.textSec }}>{h.reference || '—'}</span>
                              <span style={{ fontSize: 11, color: T.textSec }}>{date ? new Date(date).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</span>
                            </div>
                            {(h.previousQty !== undefined && h.newQty !== undefined) && (
                              <div style={{ marginTop: 4, fontSize: 10, color: T.textSec }}>
                                {h.previousQty} → <strong style={{ color: T.textPri }}>{h.newQty}</strong> {drawer.unit}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
