import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import AppDatePicker from '../common/AppDatePicker';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { drawerWidth } from '../../helper/responsive';
import useIsMobile from '../../helper/useIsMobile';

const REASONS = ['damaged','expired','found','correction','return','transfer','other'];

export default function Adjustments() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const isMobile = useIsMobile();

  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [typeFilter, setTypeFilter]   = useState('all');
  const [total, setTotal]             = useState(0);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const params = typeFilter !== 'all' ? `?type=${typeFilter}` : '';
      const res = await axiosInstance.get(`/api/inventory/adjustments/${params}`);
      setAdjustments(res.data?.data?.adjustments || []);
      setTotal(res.data?.data?.total || 0);
    } catch {
      nexusToast.error('Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { fetchAdjustments(); }, [fetchAdjustments]);

  const increases = adjustments.filter(a => a.type === 'increase').length;
  const decreases = adjustments.filter(a => a.type === 'decrease').length;

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: isMobile ? '16px 14px' : '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .adj-row:hover { background: ${isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'} !important; }
      `}</style>

      <div style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: isMobile ? 19 : 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Stock Adjustments</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Manually adjust stock quantities with a reason</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', width: isMobile ? '100%' : 'auto', whiteSpace: 'nowrap', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
          <FaPlus size={11} /> New Adjustment
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Adjustments', val: total,     color: '#3b82f6' },
          { label: 'Stock Added',       val: increases,  color: '#10b981' },
          { label: 'Stock Removed',     val: decreases,  color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 18px', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 6px' }}>{s.label}</p>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {[['all','All'],['increase','Increases'],['decrease','Decreases']].map(([val, lbl]) => (
          <button key={val} onClick={() => setTypeFilter(val)}
            style={{ padding: '7px 16px', borderRadius: 10, border: `1.5px solid ${typeFilter === val ? (val === 'increase' ? '#10b981' : val === 'decrease' ? '#ef4444' : '#3b82f6') : T.border}`, background: typeFilter === val ? (val === 'increase' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : val === 'decrease' ? (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2') : (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff')) : T.surface2, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: typeFilter === val ? (val === 'increase' ? '#10b981' : val === 'decrease' ? '#ef4444' : '#3b82f6') : T.textSec, fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ minWidth: isMobile ? 840 : 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px 80px 80px 80px 120px 100px', padding: '9px 18px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
            {['Type','Item','Reason','Qty','Before','After','Date','Ref'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec }}>{h}</span>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
          ) : adjustments.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 4px' }}>No adjustments yet</p>
              <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>Create an adjustment to manually update stock quantities.</p>
            </div>
          ) : adjustments.map((adj, i) => (
            <div key={adj._id} className="adj-row"
              style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px 80px 80px 80px 120px 100px', padding: '11px 18px', borderBottom: i < adjustments.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', background: T.surface }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: adj.type === 'increase' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {adj.type === 'increase' ? <FaArrowUp size={10} color="#10b981" /> : <FaArrowDown size={10} color="#ef4444" />}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{adj.itemName || adj.itemId}</p>
                {adj.itemCode && <p style={{ fontSize: 11, color: T.textSec, margin: '1px 0 0', fontFamily: "'DM Mono',monospace" }}>{adj.itemCode}</p>}
              </div>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: T.surface2, color: T.textSec, fontWeight: 600, textTransform: 'capitalize', width: 'fit-content' }}>{adj.reason}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: adj.type === 'increase' ? '#10b981' : '#ef4444' }}>
                {adj.type === 'increase' ? '+' : '-'}{adj.quantity}
              </span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.textSec }}>{adj.previousQty}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, color: T.textPri }}>{adj.newQty}</span>
              <span style={{ fontSize: 11, color: T.textSec }}>{adj.adjustedAt ? new Date(adj.adjustedAt).toLocaleDateString() : '—'}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: T.textSec }}>{adj.reference || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <AdjustmentForm T={T} isDark={isDark}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchAdjustments(); }} />
      )}
    </div>
  );
}

function AdjustmentForm({ T, isDark, onClose, onSaved }) {
  const [allItems, setAllItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: 'increase', quantity: '', reason: 'correction',
    notes: '', reference: '', adjustedAt: new Date().toLocaleDateString('en-CA'),
  });

  useEffect(() => {
    axiosInstance.get('/api/stocks/getitem').then(res => setAllItems(res.data?.data || [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filteredItems = allItems.filter(s =>
    itemSearch && (s.name?.toLowerCase().includes(itemSearch.toLowerCase()) || s.item_code?.toLowerCase().includes(itemSearch.toLowerCase()))
  ).slice(0, 8);

  const currentQty = selectedItem ? parseFloat(selectedItem.quantity || 0) : 0;
  const adjQty     = parseFloat(form.quantity) || 0;
  const previewQty = form.type === 'increase' ? currentQty + adjQty : currentQty - adjQty;

  const handleSave = async () => {
    if (!selectedItem) { nexusToast.error('Select an item'); return; }
    if (!form.quantity || adjQty <= 0) { nexusToast.error('Enter a valid quantity'); return; }
    setSaving(true);
    try {
      await axiosInstance.post('/api/inventory/adjustments/', {
        itemId: selectedItem._id,
        type: form.type,
        quantity: adjQty,
        reason: form.reason,
        notes: form.notes,
        reference: form.reference,
        adjustedAt: form.adjustedAt,
      });
      nexusToast.success('Adjustment saved');
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save adjustment');
    } finally { setSaving(false); }
  };

  const inp = { height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: drawerWidth(420), height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>New Adjustment</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>

        {/* Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 8 }}>Adjustment Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['increase','Add Stock','#10b981'],['decrease','Remove Stock','#ef4444']].map(([val, lbl, color]) => (
              <div key={val} onClick={() => set('type', val)}
                style={{ padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', border: `1.5px solid ${form.type === val ? color : T.border}`, background: form.type === val ? (isDark ? `${color}22` : `${color}12`) : T.surface2, transition: 'all .15s' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: form.type === val ? `${color}22` : T.surface, border: `1.5px solid ${form.type === val ? color : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                  {val === 'increase' ? <FaArrowUp size={11} color={color} /> : <FaArrowDown size={11} color={color} />}
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: form.type === val ? color : T.textSec, margin: 0 }}>{lbl}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Item search */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Item <span style={{ color: '#ef4444' }}>*</span></label>
          {selectedItem ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', border: `1.5px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'}`, borderRadius: 10 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{selectedItem.name}</p>
                <p style={{ fontSize: 11, color: T.textSec, margin: '1px 0 0', fontFamily: "'DM Mono',monospace" }}>{selectedItem.item_code} · Current: {currentQty} {selectedItem.unit}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.textSec, padding: 4 }}><IoClose size={14} /></button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input value={itemSearch} onChange={e => { setItemSearch(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 150)}
                placeholder="Search items…" style={inp} />
              {showSearch && filteredItems.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, marginTop: 4, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
                  {filteredItems.map(s => (
                    <div key={s._id} onMouseDown={() => { setSelectedItem(s); setItemSearch(''); setShowSearch(false); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{s.name}</p>
                        <p style={{ fontSize: 11, color: T.textSec, margin: '1px 0 0', fontFamily: "'DM Mono',monospace" }}>{s.item_code}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>Qty: {s.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quantity */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Quantity <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="0" style={inp} />
          {selectedItem && adjQty > 0 && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: T.surface2, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.textSec }}>Preview:</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: previewQty < 0 ? '#ef4444' : '#10b981' }}>
                {currentQty} → {previewQty.toFixed(2)} {selectedItem.unit}
              </span>
            </div>
          )}
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Reason</label>
          <select value={form.reason} onChange={e => set('reason', e.target.value)} style={{ ...inp, cursor: 'pointer', appearance: 'none' }}>
            {REASONS.map(r => <option key={r} value={r} style={{ textTransform: 'capitalize' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Reference #</label>
            <input value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="Optional" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Date</label>
            <AppDatePicker value={form.adjustedAt} onChange={v => set('adjustedAt', v)} />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" rows={3}
            style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: 12, background: saving ? '#94a3b8' : (form.type === 'increase' ? '#10b981' : '#ef4444'), color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Saving…' : form.type === 'increase' ? 'Add Stock' : 'Remove Stock'}
        </button>
      </div>
    </div>
  );
}
