import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { IoMdClose } from 'react-icons/io';
import { FaPlus, FaTrash, FaChevronLeft, FaChevronRight, FaCheck, FaCalendarAlt } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import { format, addDays, addMonths, addYears, isSameDay } from 'date-fns';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { useUnsavedGuard } from '../../helper/useUnsavedGuard';
import 'react-datepicker/dist/react-datepicker.css';

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR'];

/* ── Custom portal-based Select ──────────────────────────────────────── */
const Sel = ({ value, onChange, options = [], placeholder = 'Select…' }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value) || null;

  const updatePos = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom, left: r.left, width: r.width });
    }
  };

  useEffect(() => { if (open) updatePos(); }, [open]);

  useEffect(() => {
    const h = (e) => {
      if (!triggerRef.current?.contains(e.target) && !portalRef.current?.contains(e.target))
        setOpen(false);
    };
    const onScroll = (e) => { if (open && !portalRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  const handleSelect = (opt) => { onChange(opt.value); setOpen(false); };

  const colors = [['#eff6ff', '#2563eb'], ['#fdf4ff', '#9333ea'], ['#f0fdf4', '#16a34a'], ['#fff7ed', '#ea580c'], ['#fef2f2', '#dc2626'], ['#f0fdfa', '#0d9488']];

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" ref={triggerRef} onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          border: `1.5px solid ${open ? '#3b82f6' : selected ? '#3b82f6' : T.border}`,
          borderRadius: 10, background: selected ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface,
          cursor: 'pointer', fontSize: 13, transition: 'all .15s',
          boxShadow: open ? '0 0 0 3px rgba(59,130,246,.12)' : 'none',
          fontFamily: "'DM Sans',sans-serif",
        }}>
        <span style={{ color: selected ? T.textPri : T.textSec, fontWeight: selected ? 600 : 400 }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: open ? '#3b82f6' : '#94a3b8' }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && ReactDOM.createPortal(
        <div ref={portalRef} style={{
          position: 'fixed', zIndex: 9996, top: pos.top + 4, left: pos.left, width: Math.max(pos.width, 200),
          background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,.14)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textSec }}>
              {options.length} option{options.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 240 }}>
            {options.map((opt, i) => {
              const isActive = opt.value === value;
              const [bg, fg] = colors[i % colors.length];
              return (
                <div key={opt.value} onClick={() => handleSelect(opt)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`,
                    background: isActive ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface,
                    display: 'flex', gap: 10, alignItems: 'center', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.surface2; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = T.surface; }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: isActive ? '#dbeafe' : bg, color: isActive ? '#2563eb' : fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0, border: `1.5px solid ${isActive ? '#bfdbfe' : fg + '22'}` }}>
                    {opt.label.charAt(0)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? T.blue : T.textPri, flex: 1 }}>
                    {opt.label}
                  </span>
                  {isActive && (
                    <div style={{ width: 18, height: 18, borderRadius: 6, background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaCheck size={8} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* ── Custom portal-based DatePicker ──────────────────────────────────── */
const ModernDatePicker = ({ value, onChange, placeholder = 'Select date' }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('calendar');
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const presets = [
    { label: 'Today', value: new Date() },
    { label: 'Tomorrow', value: addDays(new Date(), 1) },
    { label: 'Next Week', value: addDays(new Date(), 7) },
    { label: 'Next Month', value: addMonths(new Date(), 1) },
    { label: '3 Months', value: addMonths(new Date(), 3) },
    { label: '6 Months', value: addMonths(new Date(), 6) },
    { label: '1 Year', value: addYears(new Date(), 1) },
  ];
  const sel = value ? new Date(value) : null;

  const updatePos = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom, left: r.left, width: r.width });
    }
  };

  useEffect(() => { if (open) updatePos(); }, [open]);

  useEffect(() => {
    const h = (e) => {
      if (!triggerRef.current?.contains(e.target) && !portalRef.current?.contains(e.target)) setOpen(false);
    };
    const onScroll = (e) => { if (open && !portalRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  const pickerPanel = open ? ReactDOM.createPortal(
    <div ref={portalRef} style={{
      position: 'fixed', zIndex: 9998, top: pos.top + 6, left: pos.left,
      background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}`,
      boxShadow: '0 24px 60px rgba(0,0,0,.14)', width: Math.max(pos.width, 320), overflow: 'hidden',
    }}>
      {/* Tab header */}
      <div style={{ display: 'flex', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
        {[['calendar', 'Calendar'], ['presets', 'Quick']].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)} style={{
            flex: 1, padding: '11px 8px', fontSize: 12, fontWeight: 700,
            border: 'none', cursor: 'pointer', transition: 'all .15s', background: 'transparent',
            color: mode === v ? '#2563eb' : '#94a3b8',
            borderBottom: mode === v ? '2px solid #3b82f6' : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {v === 'calendar'
              ? <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x={3} y={4} width={18} height={18} rx={3} /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              : <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            }
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 14px 10px' }}>
        {mode === 'calendar' ? (
          <DatePicker selected={sel} onChange={d => { onChange(d.toLocaleDateString('en-CA')); setOpen(false); setMode('calendar'); }} inline
            renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled}
                  style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface, cursor: 'pointer', color: T.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = T.border; }}>
                  <FaChevronLeft style={{ fontSize: 10 }} />
                </button>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: T.textPri }}>
                  {format(date, 'MMMM yyyy')}
                </span>
                <button onClick={increaseMonth} disabled={nextMonthButtonDisabled}
                  style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface, cursor: 'pointer', color: T.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = T.border; }}>
                  <FaChevronRight style={{ fontSize: 10 }} />
                </button>
              </div>
            )}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {presets.map(p => {
              const active = sel && isSameDay(sel, p.value);
              return (
                <button key={p.label} onClick={() => { onChange(p.value.toLocaleDateString('en-CA')); setOpen(false); setMode('calendar'); }}
                  style={{
                    padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', transition: 'all .15s',
                    border: `1.5px solid ${active ? '#3b82f6' : T.border}`,
                    background: active ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface2,
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = '#bfdbfe'; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = T.surface2; e.currentTarget.style.borderColor = T.border; } }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#2563eb' : T.textPri }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: T.textSec, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>{format(p.value, 'MMM dd, yyyy')}</div>
                </button>
              );
            })}
          </div>
        )}

        {sel && (
          <div style={{ marginTop: 10, padding: '9px 12px', background: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4', borderRadius: 10, border: `1.5px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#bbf7d0'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Selected Date</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginTop: 1 }}>{format(sel, 'EEE, MMM dd, yyyy')}</div>
            </div>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaCheck style={{ fontSize: 10 }} />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div>
      <button type="button" ref={triggerRef} onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: `1.5px solid ${open ? '#3b82f6' : sel ? '#3b82f6' : T.border}`,
        borderRadius: 10, background: sel ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface,
        cursor: 'pointer', fontSize: 13, transition: 'all .15s',
        boxShadow: open ? '0 0 0 3px rgba(59,130,246,.12)' : 'none',
        fontFamily: "'DM Sans',sans-serif",
      }}>
        <span style={{ color: sel ? T.textPri : T.textSec, fontWeight: sel ? 600 : 400 }}>
          {sel ? format(new Date(value), 'MMM dd, yyyy') : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sel && (
            <div onClick={e => { e.stopPropagation(); onChange(''); }}
              style={{ width: 16, height: 16, borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0', color: T.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer' }}>
              ×
            </div>
          )}
          <FaCalendarAlt size={13} style={{ color: sel ? '#3b82f6' : T.textSec }} />
        </div>
      </button>
      {pickerPanel}
    </div>
  );
};

/* ── Main component ──────────────────────────────────────────────────── */
export default function NewPriceList() {
  const navigate = useNavigate();
  const guard = useUnsavedGuard({ hasDraft: false });
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [saving, setSaving] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemSearch, setShowItemSearch] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    currency: 'AED',
    adjustmentType: 'percentage',
    adjustment: 0,
    validFrom: '',
    validTo: '',
    isDefault: false,
    status: 'active',
    items: [],
  });

  useEffect(() => {
    axiosInstance.get('/api/stocks/getitem')
      .then(res => setAllItems(res.data?.data || res.data || []))
      .catch(() => {});
  }, []);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const addItem = (stock) => {
    if (form.items.find(i => i.itemId === stock._id)) return;
    const basePrice = parseFloat(stock.selling_price || 0);
    const price = form.adjustment
      ? +(basePrice * (1 + form.adjustment / 100)).toFixed(2)
      : basePrice;
    setForm(p => ({
      ...p,
      items: [...p.items, { itemId: stock._id, itemName: stock.name, itemCode: stock.item_code, basePrice, price }],
    }));
    setItemSearch('');
    setShowItemSearch(false);
  };

  const updateItemPrice = (idx, price) => {
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], price: parseFloat(price) || 0 };
      return { ...p, items };
    });
  };

  const removeItem = (idx) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { nexusToast.error('Price list name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        adjustment: parseFloat(form.adjustment) || 0,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
      };
      await axiosInstance.post('/api/price-lists/', payload);
      nexusToast.success('Price list created!');
      setTimeout(() => navigate('/Items/price-lists'), 1200);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to create price list');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = allItems.filter(s =>
    itemSearch && (
      s.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
      s.item_code?.toLowerCase().includes(itemSearch.toLowerCase())
    )
  ).slice(0, 8);

  const inp = (extra = {}) => ({
    height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10,
    fontSize: 13, color: T.textPri, background: T.surface, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', width: '100%', ...extra,
  });

  const lbl = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 };

  /* datepicker CSS injected so it matches theme */
  const dpCss = `
    .react-datepicker { font-family:'DM Sans',sans-serif!important; border:none!important; border-radius:0!important; box-shadow:none!important; background:${T.surface}!important; }
    .react-datepicker__header { background:${T.surface2}!important; border-bottom:1.5px solid ${T.border}!important; border-radius:0!important; padding-top:14px!important; }
    .react-datepicker__current-month { font-size:14px!important; font-weight:700!important; color:${T.textPri}!important; font-family:'Sora',sans-serif!important; }
    .react-datepicker__day-name { color:${T.textSec}!important; font-weight:600!important; font-size:11px!important; }
    .react-datepicker__day { width:2.2rem!important; height:2.2rem!important; line-height:2.2rem!important; border-radius:8px!important; font-size:13px!important; transition:all .12s!important; color:${T.textPri}!important; }
    .react-datepicker__day:hover { background:${isDark ? 'rgba(59,130,246,0.2)' : '#eff6ff'}!important; color:#3b82f6!important; }
    .react-datepicker__day--selected { background:#3b82f6!important; color:#fff!important; font-weight:700!important; }
    .react-datepicker__day--today { background:${isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe'}!important; color:#2563eb!important; font-weight:700!important; }
    .react-datepicker__day--outside-month { color:${T.textSec}!important; opacity:.4; }
  `;

  return (
    <div onInput={guard.markDirty} onChange={guard.markDirty} style={{ background: T.bg, minHeight: '100vh', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ${dpCss}
      `}</style>

      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, height: 58, background: isDark ? 'rgba(13,21,38,.92)' : 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', borderBottom: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 28px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => guard.leave(() => navigate('/Items/price-lists'))} style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
            <IoMdClose size={16} />
          </button>
          <div style={{ width: 1, height: 22, background: T.border }} />
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>New Price List</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => guard.leave(() => navigate('/Items/price-lists'))} style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface2, color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'Save Price List'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Basic info */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 16px' }}>Basic Information</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Wholesale Pricing" style={inp()} />
            </div>
            <div>
              <label style={lbl}>Currency</label>
              <Sel
                value={form.currency}
                onChange={(val) => set('currency', val)}
                options={CURRENCIES.map(c => ({ value: c, label: c }))}
                placeholder="Select currency…"
              />
            </div>
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description…" rows={2}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        {/* Adjustment */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 16px' }}>Global Price Adjustment</p>
          <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 14px' }}>Apply a percentage markup or markdown to all item base prices. You can override individual items below.</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['percentage', '% Markup/down'], ['fixed', 'Fixed Amount']].map(([val, lbl]) => (
                <div key={val} onClick={() => set('adjustmentType', val)}
                  style={{ padding: '9px 16px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${form.adjustmentType === val ? '#3b82f6' : T.border}`, background: form.adjustmentType === val ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface2, fontSize: 12, fontWeight: 600, color: form.adjustmentType === val ? '#3b82f6' : T.textSec }}>
                  {lbl}
                </div>
              ))}
            </div>
            <input type="number" value={form.adjustment} onChange={e => set('adjustment', e.target.value)}
              placeholder="0"
              style={{ ...inp(), width: 100 }} />
            <span style={{ fontSize: 13, color: T.textSec }}>{form.adjustmentType === 'percentage' ? '%' : form.currency}</span>
          </div>
          {form.adjustment !== 0 && form.adjustment !== '' && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: parseFloat(form.adjustment) > 0 ? (isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2'), borderRadius: 10, fontSize: 12, color: parseFloat(form.adjustment) > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {parseFloat(form.adjustment) > 0 ? '↑' : '↓'} Items in this list will be priced {Math.abs(form.adjustment)}{form.adjustmentType === 'percentage' ? '%' : ` ${form.currency}`} {parseFloat(form.adjustment) > 0 ? 'above' : 'below'} their base price.
            </div>
          )}
        </div>

        {/* Validity */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 16px' }}>Validity & Options</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Valid From</label>
              <ModernDatePicker value={form.validFrom} onChange={(v) => set('validFrom', v)} placeholder="Select start date" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Valid To</label>
              <ModernDatePicker value={form.validTo} onChange={(v) => set('validTo', v)} placeholder="Select end date" />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <div onClick={() => set('isDefault', !form.isDefault)}
              style={{ width: 40, height: 22, borderRadius: 999, background: form.isDefault ? '#f59e0b' : T.border, position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 3, left: form.isDefault ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Set as default price list</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>Used when no specific price list is assigned to a customer</p>
            </div>
          </label>
        </div>

        {/* Item overrides */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 3px' }}>Item Price Overrides</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>Override specific item prices (overrides the global adjustment above)</p>
            </div>
            <button onClick={() => setShowItemSearch(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: T.textPri, fontFamily: 'inherit' }}>
              <FaPlus size={9} /> Add Item
            </button>
          </div>

          {/* Item search */}
          {showItemSearch && (
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} autoFocus
                placeholder="Search items by name or code…"
                style={{ ...inp(), marginBottom: 0 }}
                onBlur={() => setTimeout(() => setShowItemSearch(false), 150)} />
              {filteredItems.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, marginTop: 4, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
                  {filteredItems.map(s => (
                    <div key={s._id} onMouseDown={() => addItem(s)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{s.name}</p>
                        <p style={{ fontSize: 11, color: T.textSec, margin: '1px 0 0', fontFamily: "'DM Mono',monospace" }}>{s.item_code}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', fontFamily: "'DM Mono',monospace" }}>AED {parseFloat(s.selling_price || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.items.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: T.surface2, borderRadius: 10 }}>
              <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>No item overrides added. The global adjustment above will apply to all items.</p>
            </div>
          ) : (
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 36px', padding: '8px 12px', background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {['Item', 'Base Price', 'Override Price', ''].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec }}>{h}</span>
                ))}
              </div>
              {form.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 36px', padding: '10px 12px', borderBottom: i < form.items.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', background: T.surface }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.itemName}</p>
                    <p style={{ fontSize: 11, color: T.textSec, margin: '1px 0 0', fontFamily: "'DM Mono',monospace" }}>{item.itemCode}</p>
                  </div>
                  <span style={{ fontSize: 12, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>{item.basePrice?.toFixed(2)}</span>
                  <input type="number" value={item.price} onChange={e => updateItemPrice(i, e.target.value)}
                    style={{ height: 32, padding: '0 8px', border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, color: T.textPri, background: T.surface2, outline: 'none', fontFamily: "'DM Mono',monospace", width: '100%' }} />
                  <button onClick={() => removeItem(i)}
                    style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FaTrash size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
