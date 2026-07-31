import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IoMdClose } from "react-icons/io";
import { useNavigate, useParams } from 'react-router-dom';
import useAdditem from '../../helper/useAddItem';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import axiosInstance from '../../helper/axiosInstance';
import { useUnsavedGuard } from '../../helper/useUnsavedGuard';
import { drawerWidth, BREAKPOINT_TABLET } from '../../helper/responsive';
import useIsMobile from '../../helper/useIsMobile';

/* ─── Colour palette derived from item name ─────────────────────────── */
const PALETTE = [
  { bg: '#1e3a5f', accent: '#4a90d9', soft: '#e8f1fb' },
  { bg: '#2d1b4e', accent: '#8b5cf6', soft: '#f0ebff' },
  { bg: '#1a3d2b', accent: '#10b981', soft: '#e6f7f1' },
  { bg: '#4a1c1c', accent: '#ef4444', soft: '#fef0f0' },
  { bg: '#3d2a00', accent: '#f59e0b', soft: '#fef9e7' },
  { bg: '#1a3040', accent: '#06b6d4', soft: '#e0f7fa' },
];
const getPalette = (name = '') =>
  PALETTE[(name.trim().charCodeAt(0) || 65) % PALETTE.length];

/* ─── Field wrapper ─────────────────────────────────────────────────── */
const F = ({ label, req, hint, children, T }) => (
  <div>
    <label style={{
      display: 'flex', alignItems: 'baseline', gap: 6,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
      textTransform: 'uppercase', color: T.textSec, marginBottom: 6,
    }}>
      {label}
      {req && <span style={{ color: '#ef4444', fontSize: 10 }}>*</span>}
      {hint && <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: T.textSec, fontStyle: 'italic' }}>{hint}</span>}
    </label>
    {children}
  </div>
);

/* ─── Input ─────────────────────────────────────────────────────────── */
function Input({ prefix, suffix, mono, T, error, ...props }) {
  const [focused, setFocused] = useState(false);
  const borderClr = error ? '#ef4444' : focused ? '#3b82f6' : T.border;
  const shadowClr = error ? 'rgba(239,68,68,.15)' : 'rgba(59,130,246,.12)';
  return (
    <div>
      <div style={{
        display: 'flex', borderRadius: 10, overflow: 'hidden',
        border: `1.5px solid ${borderClr}`,
        boxShadow: (focused || error) ? `0 0 0 3px ${shadowClr}` : 'none',
        background: props.disabled ? T.surface2 : T.surface,
        transition: 'border-color .15s, box-shadow .15s',
      }}>
        {prefix && (
          <span style={{ padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: T.textSec, background: T.surface2, borderRight: `1.5px solid ${T.border}`, flexShrink: 0 }}>
            {prefix}
          </span>
        )}
        <input {...props}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            flex: 1, padding: '10px 13px', background: 'transparent',
            border: 'none', outline: 'none', fontSize: 13,
            color: props.disabled ? T.textSec : T.textPri,
            fontFamily: mono ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
            minWidth: 0,
          }}
        />
        {suffix && (
          <span style={{ padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: T.textSec, background: T.surface2, borderLeft: `1.5px solid ${T.border}`, flexShrink: 0 }}>
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef4444', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={12}/><line x1={12} y1={16} x2="12.01" y2={16}/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}


/* ─── PortalSelect — modern themed dropdown ─────────────────────────── */
function PortalSelect({ T, isDark, name, value, onChange, options = [], placeholder = 'Select…', error }) {
  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [query,   setQuery]   = useState('');
  const [pos,     setPos]     = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const searchRef  = useRef(null);
  const rafRef     = useRef(null);

  const searchable = options.length > 8;
  const filtered   = searchable && query
    ? options.filter(o => (o.label ?? o).toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = options.find(o => (o.value ?? o) === value);
  const display  = selected ? (selected.label ?? selected) : null;

  const measure = useCallback(() => {
    if (!triggerRef.current) return;
    const r   = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(filtered.length * 42 + (searchable ? 52 : 10), 280);
    const below = window.innerHeight - r.bottom;
    const top   = below > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, [filtered.length, searchable]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); setQuery(''); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() =>
      rafRef.current = requestAnimationFrame(() => {
        measure();
        setTimeout(() => searchRef.current?.focus(), 40);
      })
    );
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => {
    if (!open) return;
    const h = () => measure();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [open, measure]);
  useEffect(() => {
    const h = e => {
      if (!triggerRef.current?.contains(e.target) && !dropRef.current?.contains(e.target))
        { setOpen(false); setReady(false); setQuery(''); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = opt => {
    onChange({ target: { name, value: opt.value ?? opt } });
    setOpen(false); setReady(false); setQuery('');
  };

  const bg       = isDark ? T.surface  : '#fff';
  const borderC  = error ? '#ef4444' : open ? '#3b82f6' : T.border;
  const shadow   = error ? 'rgba(239,68,68,.15)' : 'rgba(59,130,246,.12)';
  const activeC  = isDark ? '#60a5fa' : '#1d4ed8';
  const activeBg = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff';
  const hoverBg  = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc';

  return (
    <div>
      <div ref={triggerRef} onClick={handleOpen} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 42, padding: '0 13px', borderRadius: 10, cursor: 'pointer',
        border: `1.5px solid ${borderC}`, background: bg, userSelect: 'none',
        boxShadow: (open || error) ? `0 0 0 3px ${shadow}` : 'none',
        transition: 'border-color .15s, box-shadow .15s',
      }}>
        <span style={{ fontSize: 13, color: display ? T.textPri : T.textSec, fontFamily: "'DM Sans', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display ?? placeholder}
        </span>
        <svg style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', color: open ? '#3b82f6' : T.textSec }}
          width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {error && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef4444', fontWeight: 500 }}>{error}</p>
      )}

      {open && createPortal(
        <div ref={dropRef} style={{
          position: 'absolute', top: pos.top, left: pos.left, width: pos.width,
          zIndex: 99999, background: bg, border: `1.5px solid ${T.border}`, borderRadius: 12,
          boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(0,0,0,0.12)',
          overflow: 'hidden', fontFamily: "'DM Sans', sans-serif",
          visibility: ready ? 'visible' : 'hidden', opacity: ready ? 1 : 0, transition: 'opacity .12s',
        }}>
          {searchable && (
            <div style={{ padding: '8px 8px 4px', borderBottom: `1px solid ${T.border}` }}>
              <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="Search…"
                style={{ width: '100%', height: 32, padding: '0 10px', border: `1.5px solid ${T.border}`, borderRadius: 8,
                  fontSize: 12, background: T.surface2, color: T.textPri, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          )}
          <div style={{ maxHeight: 240, overflowY: 'auto', padding: '5px' }}>
            {filtered.length === 0
              ? <div style={{ padding: '14px', textAlign: 'center', fontSize: 12, color: T.textMuted }}>No results</div>
              : filtered.map((opt, i) => {
                  const val   = opt.value ?? opt;
                  const lbl   = opt.label ?? opt;
                  const isAct = val === value;
                  return (
                    <div key={i} onClick={() => select(opt)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                      fontWeight: isAct ? 600 : 400,
                      color: isAct ? activeC : T.textPri,
                      background: isAct ? activeBg : 'transparent', transition: 'background .1s',
                    }}
                      onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = hoverBg; }}
                      onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}>
                      {lbl}
                      {isAct && (
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={activeC} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
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
}

/* ─── Textarea ───────────────────────────────────────────────────────── */
function Textarea({ T, disabled, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea {...props} disabled={disabled}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '10px 13px',
        border: `1.5px solid ${focused ? '#3b82f6' : T.border}`,
        borderRadius: 10, fontSize: 13, color: disabled ? T.textSec : T.textPri,
        background: disabled ? T.surface2 : T.surface, outline: 'none', resize: 'vertical',
        minHeight: 76, fontFamily: "'DM Sans', sans-serif",
        boxShadow: focused ? '0 0 0 3px rgba(59,130,246,.12)' : 'none',
        transition: 'border-color .15s, box-shadow .15s',
        cursor: disabled ? 'not-allowed' : 'text', boxSizing: 'border-box',
      }}
    />
  );
}

/* ─── Section card ───────────────────────────────────────────────────── */
function Section({ title, icon, accent, children, id, T }) {
  return (
    <div id={id} className="nw2-section-anchor" style={{
      background: T.surface, borderRadius: 16,
      border: `1.5px solid ${T.border}`, overflow: 'hidden',
      marginBottom: 16, boxShadow: T.isDark ? '0 2px 12px rgba(0,0,0,.3)' : '0 2px 8px rgba(0,0,0,.04)',
    }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, transparent 80%)` }} />
      <div style={{ padding: '18px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}18`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            {icon}
          </div>
          <h3 style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0, letterSpacing: '-0.02em' }}>
            {title}
          </h3>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Toggle ─────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange, label, sub, accent = '#10b981', T }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ position: 'relative', flexShrink: 0, marginTop: 1 }} onClick={onChange}>
        <div style={{
          width: 42, height: 24, borderRadius: 999,
          background: checked ? accent : T.border, transition: 'background .2s',
          boxShadow: checked ? `0 0 0 3px ${accent}25` : 'none',
        }} />
        <div style={{
          position: 'absolute', top: 4, left: checked ? 22 : 4,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)',
          transition: 'left .2s cubic-bezier(.34,1.56,.64,1)',
        }} />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>{sub}</p>}
      </div>
    </label>
  );
}

/* ─── Chip ───────────────────────────────────────────────────────────── */
const Chip = ({ label, color }) => (
  <span style={{
    fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
    background: `${color}22`, color, border: `1px solid ${color}44`,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    fontFamily: "'DM Sans', sans-serif",
  }}>{label}</span>
);

/* ─── Discard Modal ──────────────────────────────────────────────────── */
function DiscardModal({ onConfirm, onCancel, T }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background: T.surface, borderRadius: 20, padding: '32px 36px', width: drawerWidth(360),
        textAlign: 'center', boxShadow: '0 40px 100px rgba(0,0,0,.35)',
        border: `1.5px solid ${T.border}`,
        animation: 'nwModalIn .2s cubic-bezier(.34,1.56,.64,1) both',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>⚠</div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, color: T.textPri, margin: '0 0 8px', fontWeight: 700 }}>Discard this item?</h2>
        <p style={{ fontSize: 13, color: T.textSec, margin: '0 0 24px', lineHeight: 1.5 }}>All unsaved data will be permanently lost.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '11px', background: '#ef4444', color: '#fff',
            border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
          }}>Yes, discard</button>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px', background: T.surface2, color: T.textPri,
            border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
          }}>Keep editing</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Nav sections ───────────────────────────────────────────────────── */
const NAV_SECTIONS = [
  { id: 'sec-identity', label: 'Identity' },
  { id: 'sec-physical', label: 'Physical'  },
  { id: 'sec-pricing',  label: 'Pricing'   },
  { id: 'sec-stock',    label: 'Stock'     },
  { id: 'sec-media',    label: 'Media'     },
];

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
const New = () => {
  const { handleAdditem } = useAdditem();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const guard = useUnsavedGuard({ hasDraft: false });
  const fileInputRef = useRef(null);

  // ── Theme ──
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const isMobile = useIsMobile();

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDiscard, setShowDiscard] = useState(false);
  const [activeSection, setActiveSection] = useState('sec-identity');
  const [imagePreview, setImagePreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [salesEnabled, setSalesEnabled] = useState(false);
  const [purchaseEnabled, setPurchaseEnabled] = useState(false);
  const [trackInventory, setTrackInventory] = useState(false);
  const [vendorOptions, setVendorOptions]   = useState([]);
  const [allAccounts, setAllAccounts]       = useState([]);
  const [groupOptions, setGroupOptions]     = useState([]);
  const [groupMap, setGroupMap]             = useState({});  // id → { prefix }

  const showInventorySection = salesEnabled && purchaseEnabled;

  const [formData, setFormData] = useState({
    type: 'goods', name: '', item_code: '', unit: '',
    category: '', brand: '', manufacturer: '',
    length: '', width: '', height: '', dimension_unit: 'cm',
    weight: '', upc: '', mpn: '', ean: '', isbn: '',
    quantity: '', reorder_point: '',
    selling_price: '', sales_account: '', sales_description: '',
    cost_price: '', cost_account: '', cost_description: '', preferred_vendor: '',
    inventory_account: '', opening_stock: '', opening_stock_rate: '',
    image: '',
  });

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      // When group changes, seed item_code with the group prefix if code is empty or still just the old prefix
      if (name === 'category' && value) {
        const grp = groupMap[value];
        if (grp?.prefix) {
          const prefixStem = grp.prefix + '-';
          // Only auto-fill if the field is blank or was previously a bare prefix
          if (!prev.item_code || prev.item_code === prefixStem || /^[A-Z]+-$/.test(prev.item_code)) {
            next.item_code = prefixStem;
          }
        }
      }
      return next;
    });
    setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
  }, [groupMap]);

  /* ── Vendor + Account lists ── */
  useEffect(() => {
    axiosInstance.get('/api/vendors/?limit=500')
      .then(res => {
        const list = res.data?.data?.vendors || res.data?.vendors || [];
        setVendorOptions(list.map(v => ({
          label: v.displayName || v.name || v.companyName || 'Unknown',
          value: v._id,
        })));
      })
      .catch(() => {});

    axiosInstance.get('/api/accounts/?limit=500&status=active')
      .then(res => {
        const list = res.data?.data?.accounts || [];
        setAllAccounts(list.map(a => ({ label: `[${a.accountCode}] ${a.accountName}`, value: a._id })));
      })
      .catch(() => {});

    axiosInstance.get('/api/item-groups/?status=active')
      .then(res => {
        const list = res.data?.data?.groups || [];
        setGroupOptions(list.map(g => ({ label: g.name, value: g._id })));
        const map = {};
        list.forEach(g => { map[g._id] = { prefix: g.prefix || '' }; });
        setGroupMap(map);
      })
      .catch(() => {});
  }, []);

  /* ── Load item when editing ── */
  useEffect(() => {
    if (!editId) return;
    axiosInstance.get(`/api/stocks/${editId}`)
      .then(res => {
        const it = res.data?.data;
        if (!it) return;
        setFormData(prev => ({
          ...prev,
          type: it.type || 'goods',
          name: it.name || '', item_code: it.item_code || '', unit: it.unit || '',
          category: it.category || '', brand: it.brand || '', manufacturer: it.manufacturer || '',
          length: it.length || '', width: it.width || '', height: it.height || '', dimension_unit: it.dimension_unit || 'cm',
          weight: it.weight || '', upc: it.upc || '', mpn: it.mpn || '', ean: it.ean || '', isbn: it.isbn || '',
          quantity: it.quantity || '', reorder_point: it.reorder_point || '',
          selling_price: it.selling_price || '', sales_account: it.sales_account || '', sales_description: it.sales_description || '',
          cost_price: it.cost_price || '', cost_account: it.cost_account || '', cost_description: it.cost_description || '', preferred_vendor: it.preferred_vendor || '',
          inventory_account: it.inventory_account || '', opening_stock: it.opening_stock || '', opening_stock_rate: it.opening_stock_rate || '',
          image: it.image || '',
        }));
        setSalesEnabled(!!(it.selling_price || it.sales_account));
        setPurchaseEnabled(!!(it.cost_price || it.cost_account));
        setTrackInventory(!!(it.inventory_account || it.opening_stock || it.reorder_point));
        setImagePreview(it.image || null);
      })
      .catch(() => nexusToast.error('Failed to load item'));
  }, [editId]);

  /* ── Scroll spy ── */
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => { entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); }); },
      { threshold: 0.4 }
    );
    NAV_SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  /* ── Image ── */
  const handleImageFile = (file) => {
    if (!file?.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = e => {
      setImagePreview(e.target.result);
      setFormData(prev => ({ ...prev, image: e.target.result }));
    };
    r.readAsDataURL(file);
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image: '' }));
  };

  // Derived: prefix string from the selected item group, e.g. "ITM-"
  const groupPrefix = formData.category && groupMap[formData.category]?.prefix
    ? groupMap[formData.category].prefix + '-'
    : '';

  /* ── Submit ── */
  const handleSubmit = async () => {
    // Validate all required fields and collect every error at once
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Item name is required';
    const codeSuffix = groupPrefix ? formData.item_code.slice(groupPrefix.length).trim() : formData.item_code.trim();
    if (!codeSuffix) newErrors.item_code = groupPrefix ? `Enter a code after the "${groupPrefix}" prefix` : 'Item code is required';
    if (!formData.unit) newErrors.unit = 'Unit of measure is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      nexusToast.error(Object.values(newErrors)[0]);
      // Focus first invalid field so user sees it immediately
      setTimeout(() => document.querySelector(`[name="${Object.keys(newErrors)[0]}"]`)?.focus(), 50);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      if (isEdit) {
        await axiosInstance.put(`/api/stocks/${editId}`, formData);
        nexusToast.success('Item updated successfully!');
      } else {
        await handleAdditem(formData);
        nexusToast.success('Item created successfully!');
      }
      guard.reset();
      setTimeout(() => navigate('/Items/Items'), 1500);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save item';
      nexusToast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /* ── Derived preview values ── */
  const pal = getPalette(formData.name);
  const initials = formData.name ? formData.name.slice(0, 2).toUpperCase() : '??';
  const qty = parseInt(formData.quantity || 0);
  const reorder = parseInt(formData.reorder_point || 0);
  const stockPct = reorder > 0 ? Math.min((qty / (reorder * 2)) * 100, 100) : qty > 0 ? 60 : 0;
  const stockLabel = qty <= 0 ? 'Out of Stock' : reorder > 0 && qty <= reorder ? 'Low Stock' : 'In Stock';
  const stockColor = qty <= 0 ? '#ef4444' : reorder > 0 && qty <= reorder ? '#f59e0b' : '#10b981';
  const margin = formData.selling_price && formData.cost_price
    ? ((parseFloat(formData.selling_price) - parseFloat(formData.cost_price)) / parseFloat(formData.selling_price) * 100).toFixed(1)
    : null;

  /* ── Completeness ── */
  const fields = [
    { label: 'Name',  done: !!formData.name },
    { label: 'Code',  done: !!formData.item_code },
    { label: 'Unit',  done: !!formData.unit },
    { label: 'Qty',   done: !!formData.quantity },
    { label: 'Price', done: !!formData.selling_price },
    { label: 'Image', done: !!imagePreview },
  ];
  const complete = Math.round((fields.filter(f => f.done).length / fields.length) * 100);

  /* ═══════════════════════════ CSS ═══════════════════════════════════ */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    html,body,* { scrollbar-width:thin; scrollbar-color:${T.border} transparent; }
    *::-webkit-scrollbar { width:4px; }
    *::-webkit-scrollbar-thumb { background:${T.border}; border-radius:99px; }
    .nw2-root { font-family:'DM Sans',sans-serif; }
    .nw2-root input::placeholder, .nw2-root textarea::placeholder { color:${T.textSec}; opacity:.6; }
    .nw2-root select option { background:${T.surface}; color:${T.textPri}; }

    @keyframes nwUp      { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes nwSlideIn { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
    @keyframes nwModalIn { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
    @keyframes nwSpin    { to{transform:rotate(360deg)} }
    @keyframes nwPulse   { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes nwGlow    { 0%,100%{box-shadow:0 0 0 0 ${pal.accent}44} 50%{box-shadow:0 0 24px 5px ${pal.accent}28} }

    .nw2-sec     { animation:nwUp .3s ease both; }
    .nw2-preview { animation:nwSlideIn .4s .05s ease both; }
    .nw2-section-anchor { scroll-margin-top: 90px; }

    .nw2-navdot { width:8px;height:8px;border-radius:999px;transition:all .2s cubic-bezier(.34,1.56,.64,1);cursor:pointer; }
    .nw2-navdot.active { width:24px; }

    .nw2-type-card { transition:all .16s;cursor:pointer; }
    .nw2-type-card:hover { transform:translateY(-1px); }

    .nw2-save-btn { transition:all .18s cubic-bezier(.34,1.56,.64,1); }
    .nw2-save-btn:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 10px 28px rgba(59,130,246,.35)!important; }
    .nw2-save-btn:active:not(:disabled) { transform:scale(.97); }

    .nw2-upload { transition:all .2s; }
    .nw2-upload:hover,.nw2-upload.drag-over { border-color:#3b82f6!important;background:${isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff'}!important; }

    .nw2-close-btn:hover { background:${T.surface2}!important;border-color:${T.border}!important; }
    .nw2-cancel-btn:hover { background:${T.surface2}!important; }
  `;

  /* ═══════════════════════════ RENDER ════════════════════════════════ */
  return (
    <div className="nw2-root" onInput={guard.markDirty} onChange={guard.markDirty} style={{ background: T.bg, minHeight: '100vh' }}>
      <style>{css}</style>

      {/* ── DISCARD MODAL (proper React portal, not toast) ── */}
      {showDiscard && (
        <DiscardModal
          T={T}
          onConfirm={() => { setShowDiscard(false); navigate('/Items/Items'); }}
          onCancel={() => setShowDiscard(false)}
        />
      )}

      {/* ══ TOP BAR ═════════════════════════════════════════════════ */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: isDark ? 'rgba(13,21,38,.92)' : 'rgba(255,255,255,.92)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1.5px solid ${T.border}`, height: 60,
        display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 28px',
        justifyContent: 'space-between', boxShadow: isDark ? '0 1px 0 rgba(0,0,0,.3)' : '0 1px 0 rgba(0,0,0,.05)',
        gap: 8,
      }}>
        {/* Left — close + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, minWidth: 0, flex: isMobile ? 1 : 'initial' }}>
          <button onClick={() => setShowDiscard(true)} className="nw2-close-btn" style={{
            width: 34, height: 34, flexShrink: 0, borderRadius: 10, border: `1.5px solid ${T.border}`,
            background: T.surface2, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: T.textSec, transition: 'all .15s',
          }}>
            <IoMdClose size={16} />
          </button>
          {!isMobile && <div style={{ width: 1, height: 22, background: T.border }} />}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: "'Sora',sans-serif", fontSize: isMobile ? 13 : 15, fontWeight: 700, color: T.textPri, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formData.name || <span style={{ color: T.textSec, fontStyle: 'italic' }}>{isEdit ? 'Edit Item' : 'New Item'}</span>}
            </p>
            {!isMobile && (
              <p style={{ fontSize: 10, color: T.textSec, margin: '3px 0 0', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {formData.item_code
                  ? <span style={{ fontFamily: "'DM Mono',monospace" }}>{formData.item_code}</span>
                  : 'Item Details Form'}
              </p>
            )}
          </div>
        </div>

        {/* Centre — scroll spy dots */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {NAV_SECTIONS.map(s => (
              <div key={s.id} title={s.label}
                className={`nw2-navdot${activeSection === s.id ? ' active' : ''}`}
                style={{ background: activeSection === s.id ? '#3b82f6' : T.border }}
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              />
            ))}
          </div>
        )}

        {/* Right — actions */}
        <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexShrink: 0 }}>
          <button onClick={() => setShowDiscard(true)} className="nw2-cancel-btn" style={{
            padding: isMobile ? '8px 12px' : '8px 18px', borderRadius: 10, border: `1.5px solid ${T.border}`,
            background: T.surface2, color: T.textSec, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap',
          }}>Cancel</button>
          <button className="nw2-save-btn" onClick={handleSubmit} disabled={saving} style={{
            padding: isMobile ? '8px 12px' : '8px 22px', borderRadius: 10, border: 'none',
            background: saving ? '#94a3b8' : '#3b82f6', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
            boxShadow: saving ? 'none' : '0 4px 16px rgba(59,130,246,.3)',
          }}>
            {saving
              ? <><div style={{ width:13,height:13,border:'2px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',animation:'nwSpin .7s linear infinite' }} /> {!isMobile && 'Saving…'}</>
              : <><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg> {isMobile ? (isEdit ? 'Update' : 'Save') : (isEdit ? 'Update Item' : 'Save Item')}</>
            }
          </button>
        </div>
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', maxWidth: 1160, margin: '0 auto', padding: isMobile ? '16px 14px 80px' : '28px 24px 80px', gap: isMobile ? 16 : 22 }}>

        {/* ── FORM COLUMN ────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, order: isMobile ? 2 : 1 }}>

          {/* SECTION 1: Identity */}
          <div className="nw2-sec">
            <Section id="sec-identity" title="Item Identity" icon="🏷" accent="#3b82f6" T={T}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                {[
                  { val: 'goods',   emoji: '📦', label: 'Physical Goods', sub: 'Tangible product · stock tracked' },
                  { val: 'service', emoji: '🔧', label: 'Service',        sub: 'Intangible · no inventory'        },
                ].map(t => (
                  <div key={t.val} className="nw2-type-card"
                    onClick={() => setFormData(p => ({ ...p, type: t.val }))}
                    style={{
                      padding: '14px 16px', borderRadius: 12,
                      border: `1.5px solid ${formData.type === t.val ? '#3b82f6' : T.border}`,
                      background: formData.type === t.val ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface2,
                      boxShadow: formData.type === t.val ? '0 0 0 3px rgba(59,130,246,.1)' : 'none',
                      transition: 'all .15s',
                    }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{t.emoji}</div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: formData.type === t.val ? '#3b82f6' : T.textPri, margin: '0 0 3px' }}>{t.label}</p>
                    <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>{t.sub}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <F label="Item Name" req T={T}><Input name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Ergonomic Office Chair" autoFocus T={T} error={errors.name} /></F>
                <F label="Item Code" req T={T}>
                  <Input
                    name="item_code"
                    prefix={groupPrefix || undefined}
                    value={groupPrefix ? formData.item_code.slice(groupPrefix.length) : formData.item_code}
                    onChange={groupPrefix
                      ? (e) => {
                          const suffix = e.target.value;
                          setFormData(prev => ({ ...prev, item_code: groupPrefix + suffix }));
                          setErrors(prev => { const n = { ...prev }; delete n.item_code; return n; });
                        }
                      : handleChange}
                    placeholder={groupPrefix ? 'suffix…' : 'ITM-001'}
                    mono T={T}
                    error={errors.item_code}
                  />
                </F>
                {/* <F label="SKU" T={T}><Input name="sku" value={formData.sku} onChange={handleChange} placeholder="Stock keeping unit" mono T={T} /></F> */}
                <F label="Category / Group" T={T}>
                  <PortalSelect T={T} isDark={isDark} name="category" value={formData.category} onChange={handleChange}
                    placeholder={groupOptions.length ? 'Select group…' : 'No groups yet — add in Item Groups'}
                    options={groupOptions} />
                </F>
                <F label="Unit of Measure" req T={T}>
                  <PortalSelect T={T} isDark={isDark} name="unit" value={formData.unit} onChange={handleChange} placeholder="Select unit…" error={errors.unit}
                    options={[
                      { label: 'Piece (pcs)',        value: 'piece'   },
                      { label: 'Box',                value: 'box'     },
                      { label: 'Carton (ctn)',       value: 'carton'  },
                      { label: 'Pallet',             value: 'pallet'  },
                      { label: 'Set',                value: 'set'     },
                      { label: 'Pair',               value: 'pair'    },
                      { label: 'Dozen (dz)',         value: 'dozen'   },
                      { label: 'Kilogram (kg)',      value: 'kg'      },
                      { label: 'Gram (g)',           value: 'g'       },
                      { label: 'Ton (t)',            value: 'ton'     },
                      { label: 'Liter (L)',          value: 'liter'   },
                      { label: 'Milliliter (mL)',    value: 'ml'      },
                      { label: 'Meter (m)',          value: 'meter'   },
                      { label: 'Centimeter (cm)',    value: 'cm'      },
                      { label: 'Square Meter (m²)',  value: 'sqm'     },
                      { label: 'Cubic Meter (m³)',   value: 'cbm'     },
                      { label: 'Roll',               value: 'roll'    },
                      { label: 'Sheet',              value: 'sheet'   },
                      { label: 'Bundle',             value: 'bundle'  },
                      { label: 'Unit',               value: 'unit'    },
                    ]} />
                </F>
                <F label="Brand" T={T}>
                  <input className="nw2-inp" name="brand" value={formData.brand} onChange={handleChange} placeholder="e.g. Samsung, Bosch…"
                    style={{ width: '100%', height: 42, padding: '0 13px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: "'DM Sans',sans-serif", transition: 'border-color .15s, box-shadow .15s', boxSizing: 'border-box' }} />
                </F>
              </div>
            </Section>
          </div>

          {/* SECTION 2: Physical */}
          <div className="nw2-sec" style={{ animationDelay: '.06s' }}>
            <Section id="sec-physical" title="Physical Attributes" icon="📐" accent="#8b5cf6" T={T}>
              <F label="Dimensions" hint="L × W × H" T={T}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${T.border}`, background: T.surface }}>
                    {['length','width','height'].map((dim, i) => (
                      <React.Fragment key={dim}>
                        {i > 0 && <span style={{ display:'flex',alignItems:'center',color:T.textSec,fontSize:15,padding:'0 4px',background:T.surface,flexShrink:0,userSelect:'none' }}>×</span>}
                        <input name={dim} value={formData[dim]} onChange={handleChange} placeholder="0"
                          style={{ flex:1,padding:'10px 8px',textAlign:'center',background:'transparent',border:'none',outline:'none',fontSize:13,color:T.textPri,fontFamily:"'DM Mono',monospace",minWidth:0 }} />
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ width: 84, flexShrink: 0 }}>
                    <PortalSelect T={T} isDark={isDark} name="dimension_unit" value={formData.dimension_unit} onChange={handleChange}
                      options={[{label:'cm',value:'cm'},{label:'in',value:'in'},{label:'mm',value:'mm'},{label:'m',value:'m'}]} />
                  </div>
                </div>
              </F>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginTop: 16, marginBottom: 16 }}>
                <F label="Weight" T={T}><Input name="weight" value={formData.weight} onChange={handleChange} placeholder="0.00" suffix="kg" mono T={T} /></F>
                <F label="Manufacturer" T={T}>
                  <input className="nw2-inp" name="manufacturer" value={formData.manufacturer} onChange={handleChange} placeholder="e.g. Sony, 3M, Honeywell…"
                    style={{ width: '100%', height: 42, padding: '0 13px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: "'DM Sans',sans-serif", transition: 'border-color .15s, box-shadow .15s', boxSizing: 'border-box' }} />
                </F>
              </div>

              <div style={{ padding: '14px 16px', background: T.surface2, borderRadius: 12, border: `1.5px solid ${T.border}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 14px' }}>Barcode Identifiers</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                  {[['upc','UPC'],['mpn','MPN'],['ean','EAN'],['isbn','ISBN']].map(([n,l]) => (
                    <F key={n} label={l} T={T}><Input name={n} value={formData[n]} onChange={handleChange} placeholder="—" mono T={T} /></F>
                  ))}
                </div>
              </div>
            </Section>
          </div>

          {/* SECTION 3: Pricing */}
          <div className="nw2-sec" style={{ animationDelay: '.12s' }}>
            <Section id="sec-pricing" title="Pricing & Accounts" icon="💰" accent="#10b981" T={T}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                {/* Sales panel */}
                <div style={{
                  padding: 16, borderRadius: 12,
                  border: `1.5px solid ${salesEnabled ? '#10b981' : T.border}`,
                  background: salesEnabled ? (isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4') : T.surface2,
                  boxShadow: salesEnabled ? '0 0 0 3px rgba(16,185,129,.08)' : 'none',
                  transition: 'all .2s',
                }}>
                  <div style={{ marginBottom: 16 }}>
                    <Toggle checked={salesEnabled} onChange={() => setSalesEnabled(v => !v)} label="Sales Information" sub="Selling price & revenue ledger" accent="#10b981" T={T} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: salesEnabled ? 1 : .4, pointerEvents: salesEnabled ? 'auto' : 'none', transition: 'opacity .2s' }}>
                    <F label="Selling Price" T={T}><Input prefix="AED" type="number" name="selling_price" value={formData.selling_price} onChange={handleChange} placeholder="0.00" disabled={!salesEnabled} T={T} /></F>
                    <F label="Account" T={T}>
                      <PortalSelect T={T} isDark={isDark} name="sales_account" value={formData.sales_account} onChange={handleChange}
                        placeholder={allAccounts.length ? 'Select account…' : 'No accounts yet — add in Finance'}
                        options={allAccounts} />
                    </F>
                    <F label="Description" T={T}><Textarea name="sales_description" value={formData.sales_description} onChange={handleChange} disabled={!salesEnabled} placeholder="Sales description…" T={T} /></F>
                  </div>
                </div>

                {/* Purchase panel */}
                <div style={{
                  padding: 16, borderRadius: 12,
                  border: `1.5px solid ${purchaseEnabled ? '#3b82f6' : T.border}`,
                  background: purchaseEnabled ? (isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff') : T.surface2,
                  boxShadow: purchaseEnabled ? '0 0 0 3px rgba(59,130,246,.08)' : 'none',
                  transition: 'all .2s',
                }}>
                  <div style={{ marginBottom: 16 }}>
                    <Toggle checked={purchaseEnabled} onChange={() => setPurchaseEnabled(v => !v)} label="Purchase Information" sub="Cost price & expense ledger" accent="#3b82f6" T={T} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: purchaseEnabled ? 1 : .4, pointerEvents: purchaseEnabled ? 'auto' : 'none', transition: 'opacity .2s' }}>
                    <F label="Cost Price" T={T}><Input prefix="AED" type="number" name="cost_price" value={formData.cost_price} onChange={handleChange} placeholder="0.00" disabled={!purchaseEnabled} T={T} /></F>
                    <F label="Account" T={T}>
                      <PortalSelect T={T} isDark={isDark} name="cost_account" value={formData.cost_account} onChange={handleChange}
                        placeholder={allAccounts.length ? 'Select account…' : 'No accounts yet — add in Finance'}
                        options={allAccounts} />
                    </F>
                    <F label="Description" T={T}><Textarea name="cost_description" value={formData.cost_description} onChange={handleChange} disabled={!purchaseEnabled} placeholder="Purchase description…" T={T} /></F>
                    <F label="Preferred Vendor" T={T}>
                      <PortalSelect T={T} isDark={isDark} name="preferred_vendor" value={formData.preferred_vendor} onChange={handleChange}
                        placeholder="Select vendor…"
                        options={vendorOptions} />
                    </F>
                  </div>
                </div>
              </div>

              {/* Margin calculator */}
              {salesEnabled && purchaseEnabled && formData.selling_price && formData.cost_price && (() => {
                const sell = parseFloat(formData.selling_price);
                const cost = parseFloat(formData.cost_price);
                const profit = sell - cost;
                const marg = ((profit / sell) * 100).toFixed(1);
                const markup = ((profit / cost) * 100).toFixed(1);
                return (
                  <div style={{ marginTop: 14, padding: isMobile ? '14px' : '14px 18px', background: T.surface2, borderRadius: 12, border: `1.5px solid ${T.border}`, display: 'flex', flexWrap: 'wrap', gap: isMobile ? 12 : 0, alignItems: 'center', animation: 'nwUp .2s ease both' }}>
                    {[
                      { label: 'Gross Profit', val: `AED ${profit.toFixed(2)}`, color: profit >= 0 ? '#10b981' : '#ef4444' },
                      { label: 'Margin',       val: `${marg}%`,                 color: marg >= 20 ? '#10b981' : marg >= 0 ? '#f59e0b' : '#ef4444' },
                      { label: 'Markup',       val: `${markup}%`,               color: '#3b82f6' },
                    ].map((m, i) => (
                      <React.Fragment key={m.label}>
                        {i > 0 && !isMobile && <div style={{ width:1,background:T.border,alignSelf:'stretch',margin:'0 20px' }} />}
                        <div>
                          <p style={{ fontSize:10,color:T.textSec,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',margin:'0 0 3px' }}>{m.label}</p>
                          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:17,fontWeight:700,color:m.color,margin:0 }}>{m.val}</p>
                        </div>
                      </React.Fragment>
                    ))}
                    {!isMobile && <div style={{ marginLeft: 'auto', fontSize: 11, color: T.textSec }}>📊 profitability</div>}
                  </div>
                );
              })()}
            </Section>
          </div>

          {/* SECTION 4: Stock */}
          <div className="nw2-sec" style={{ animationDelay: '.18s' }}>
            <Section id="sec-stock" title="Inventory & Stock" icon="📦" accent="#f59e0b" T={T}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <F label="Opening Quantity" req T={T}><Input type="number" name="quantity" value={formData.quantity} onChange={handleChange} placeholder="0" T={T} /></F>
                <F label="Reorder Point" hint="alert threshold" T={T}><Input type="number" name="reorder_point" value={formData.reorder_point} onChange={handleChange} placeholder="0" T={T} /></F>
              </div>

              {formData.quantity && (
                <div style={{ marginBottom: 16, padding: '12px 14px', background: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb', borderRadius: 10, border: `1.5px solid ${isDark ? 'rgba(245,158,11,0.25)' : '#fef3c7'}`, animation: 'nwUp .2s ease both' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: isDark ? '#fcd34d' : '#92400e', fontWeight: 600 }}>Stock level preview</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: stockColor, fontFamily: "'DM Mono',monospace" }}>{stockLabel}</span>
                  </div>
                  <div style={{ height: 6, background: isDark ? 'rgba(245,158,11,0.2)' : '#fde68a', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height:'100%',width:`${stockPct}%`,background:stockColor,borderRadius:999,transition:'width .5s cubic-bezier(.34,1,.64,1)' }} />
                  </div>
                  <div style={{ display:'flex',justifyContent:'space-between',marginTop:5,fontSize:10,fontFamily:"'DM Mono',monospace",color:isDark?'#fcd34d':'#92400e' }}>
                    <span>0</span>
                    {reorder > 0 && <span>reorder: {reorder}</span>}
                    <span>qty: {qty}</span>
                  </div>
                </div>
              )}

              {showInventorySection ? (
                <div style={{
                  padding: 16, borderRadius: 12,
                  border: `1.5px solid ${trackInventory ? '#8b5cf6' : T.border}`,
                  background: trackInventory ? (isDark ? 'rgba(139,92,246,0.1)' : '#f5f3ff') : T.surface2,
                  transition: 'all .2s',
                }}>
                  <div style={{ marginBottom: trackInventory ? 18 : 0 }}>
                    <Toggle checked={trackInventory} onChange={() => setTrackInventory(v => !v)} accent="#8b5cf6"
                      label="Track Inventory for this item"
                      sub="Cannot be changed after transactions are recorded" T={T} />
                  </div>
                  {trackInventory && (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, animation: 'nwUp .2s ease both' }}>
                      <F label="Inventory Account" req T={T}>
                        <PortalSelect T={T} isDark={isDark} name="inventory_account" value={formData.inventory_account} onChange={handleChange}
                          placeholder={allAccounts.length ? 'Select account…' : 'No accounts yet — add in Finance'}
                          options={allAccounts} />
                      </F>
                      <F label="Opening Stock" T={T}><Input type="number" name="opening_stock" value={formData.opening_stock} onChange={handleChange} placeholder="0" T={T} /></F>
                      <F label="Rate per Unit" T={T}><Input prefix="AED" type="number" name="opening_stock_rate" value={formData.opening_stock_rate} onChange={handleChange} placeholder="0.00" T={T} /></F>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '14px 16px', borderRadius: 12, background: T.surface2, border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: '0 0 2px' }}>Enable Sales & Purchase to unlock inventory tracking</p>
                    <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>Toggle both on in the Pricing section above.</p>
                  </div>
                </div>
              )}
            </Section>
          </div>

          {/* SECTION 5: Media */}
          <div className="nw2-sec" style={{ animationDelay: '.24s' }}>
            <Section id="sec-media" title="Images & Media" icon="🖼" accent="#06b6d4" T={T}>
              <div
                className={`nw2-upload${dragOver ? ' drag-over' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleImageFile(e.dataTransfer.files[0]); }}
                style={{ border: `2px dashed ${T.border}`, borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', background: T.surface2 }}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="preview" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 10, marginBottom: 10, objectFit: 'contain' }} />
                    <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>
                      Click to replace ·{' '}
                      <span onClick={handleRemoveImage} style={{ color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Remove</span>
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ width:52,height:52,borderRadius:16,background:isDark?'rgba(6,182,212,0.15)':'#e0f7fa',color:'#06b6d4',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:22 }}>📸</div>
                    <p style={{ fontSize:14,fontWeight:700,color:T.textPri,margin:'0 0 6px' }}>{dragOver ? 'Drop to upload' : 'Drag & drop images here'}</p>
                    <p style={{ fontSize:12,color:T.textSec,margin:'0 0 16px' }}>PNG · JPG · WEBP · max 5 MB · up to 15 images</p>
                    <span style={{ display:'inline-flex',alignItems:'center',gap:7,padding:'9px 20px',background:'#06b6d4',color:'#fff',borderRadius:10,fontSize:13,fontWeight:700,boxShadow:'0 4px 12px rgba(6,182,212,.3)' }}>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                      Browse Files
                    </span>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageFile(e.target.files[0])} />
              </div>
            </Section>
          </div>

        </div>

        {/* ── STICKY PREVIEW SIDEBAR ─────────────────────────────── */}
        <div style={{ width: isMobile ? '100%' : 288, flexShrink: 0, order: isMobile ? 1 : 2 }}>
          <div className="nw2-preview" style={isMobile ? {} : { position: 'sticky', top: 78 }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'nwPulse 2s ease infinite' }} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.textSec }}>Live Preview</span>
            </div>

            <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: isDark ? '0 16px 48px rgba(0,0,0,.5)' : '0 16px 48px rgba(0,0,0,.12)', border: `1.5px solid ${T.border}` }}>

              {/* Coloured header */}
              <div style={{ background: pal.bg, padding: '22px 20px 20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position:'absolute',top:-24,right:-24,width:96,height:96,borderRadius:'50%',background:`${pal.accent}22` }} />
                <div style={{ position:'absolute',bottom:-16,left:20,width:64,height:64,borderRadius:'50%',background:`${pal.accent}12` }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, position: 'relative' }}>
                  <div className="nw2-preview-avatar" style={{
                    width:50,height:50,borderRadius:14,flexShrink:0,
                    background: imagePreview ? 'transparent' : `${pal.accent}30`,
                    border:`2px solid ${pal.accent}55`,
                    display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',
                  }}>
                    {imagePreview
                      ? <img src={imagePreview} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                      : <span style={{ fontFamily:"'Sora',sans-serif",fontSize:18,color:pal.accent }}>{initials}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily:"'Sora',sans-serif",fontSize:15,color:'#fff',margin:'0 0 3px',letterSpacing:'-0.01em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                      {formData.name || <span style={{ opacity:.5,fontStyle:'italic' }}>Item name…</span>}
                    </p>
                    <p style={{ fontFamily:"'DM Mono',monospace",fontSize:10,color:`${pal.accent}cc`,margin:'0 0 8px' }}>
                      {formData.item_code || '—'}
                    </p>
                    <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                      {formData.type && <Chip label={formData.type === 'goods' ? '📦 Goods' : '🔧 Service'} color={pal.accent} />}
                      {formData.unit && <Chip label={formData.unit} color="#94a3b8" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: T.surface, borderBottom: `1.5px solid ${T.border}` }}>
                {[
                  { label:'Price',  val: formData.selling_price ? parseFloat(formData.selling_price).toLocaleString('en-AE',{minimumFractionDigits:2}) : '—', unit: formData.selling_price ? 'AED' : '', color:'#10b981' },
                  { label:'Qty',    val: formData.quantity || '—', unit: '', color: stockColor },
                  { label:'Margin', val: margin !== null ? `${margin}%` : '—', unit: '', color: margin >= 20 ? '#10b981' : margin >= 0 ? '#f59e0b' : '#ef4444' },
                ].map((m,i) => (
                  <div key={m.label} style={{ padding:'10px 12px',borderLeft:i>0?`1.5px solid ${T.border}`:'none',textAlign:'center' }}>
                    {m.unit && <p style={{ fontSize:8,fontWeight:700,color:T.textSec,textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 1px' }}>{m.unit}</p>}
                    <p style={{ fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:700,color:m.color,margin:'0 0 1px',lineHeight:1 }}>{m.val}</p>
                    <p style={{ fontSize:9,color:T.textSec,margin:0,textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:600 }}>{m.label}</p>
                  </div>
                ))}
              </div>

              {formData.quantity && (
                <div style={{ padding:'12px 16px',background:T.surface,borderBottom:`1.5px solid ${T.border}` }}>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                    <span style={{ fontSize:10,color:T.textSec,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em' }}>Stock</span>
                    <span style={{ fontSize:10,fontWeight:700,color:stockColor }}>{stockLabel}</span>
                  </div>
                  <div style={{ height:5,background:T.surface2,borderRadius:999,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${stockPct}%`,background:stockColor,borderRadius:999,transition:'width .5s cubic-bezier(.34,1,.64,1)' }} />
                  </div>
                </div>
              )}

              {(formData.brand || formData.category || formData.weight) && (
                <div style={{ padding:'12px 16px',background:T.surface,borderBottom:`1.5px solid ${T.border}` }}>
                  {[['Brand',formData.brand],['Category',groupOptions.find(g=>g.value===formData.category)?.label||formData.category],['Weight',formData.weight?`${formData.weight} kg`:'']].filter(([,v])=>v).map(([l,v])=>(
                    <div key={l} style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                      <span style={{ fontSize:11,color:T.textSec }}>{l}</span>
                      <span style={{ fontSize:11,fontWeight:600,color:T.textPri,textTransform:'capitalize' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {formData.length && formData.width && (
                <div style={{ padding:'10px 16px',background:T.surface,borderBottom:`1.5px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <span style={{ fontSize:11,color:T.textSec }}>Dimensions</span>
                  <span style={{ fontSize:11,fontWeight:600,color:T.textPri,fontFamily:"'DM Mono',monospace" }}>
                    {formData.length}×{formData.width}{formData.height?`×${formData.height}`:''} {formData.dimension_unit}
                  </span>
                </div>
              )}

              {/* Completeness */}
              <div style={{ padding:'14px 16px',background:T.surface2 }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:7 }}>
                  <span style={{ fontSize:10,color:T.textSec,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em' }}>Completeness</span>
                  <span style={{ fontSize:11,fontWeight:800,color:complete===100?'#10b981':'#3b82f6',fontFamily:"'DM Mono',monospace" }}>{complete}%</span>
                </div>
                <div style={{ height:4,background:T.border,borderRadius:999,overflow:'hidden',marginBottom:10 }}>
                  <div style={{ height:'100%',width:`${complete}%`,background:complete===100?'#10b981':'#3b82f6',borderRadius:999,transition:'width .4s cubic-bezier(.34,1.56,.64,1)' }} />
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1px 12px' }}>
                  {fields.map(f => (
                    <div key={f.label} style={{ display:'flex',alignItems:'center',gap:7,padding:'4px 0',fontSize:11,color:T.textSec }}>
                      <div style={{ width:14,height:14,borderRadius:4,flexShrink:0,background:f.done?(isDark?'rgba(16,185,129,0.2)':'#dcfce7'):T.surface,border:`1.5px solid ${f.done?'#10b981':T.border}`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                        {f.done && <svg width={8} height={7} viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{ color:f.done?T.textPri:T.textSec,fontWeight:f.done?600:400 }}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Save button */}
            <button className="nw2-save-btn" onClick={handleSubmit} disabled={saving} style={{
              width:'100%',marginTop:12,padding:13,borderRadius:14,
              background:saving?'#94a3b8':(isDark?T.textPri:'#0f172a'),
              color:isDark?T.bg:'#fff',border:'none',fontSize:14,fontWeight:700,
              cursor:saving?'not-allowed':'pointer',fontFamily:'inherit',
              display:'flex',alignItems:'center',justifyContent:'center',gap:8,
              boxShadow:saving?'none':'0 6px 20px rgba(15,23,42,.25)',
              letterSpacing:'-0.01em',
            }}>
              {saving
                ? <><div style={{ width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'nwSpin .7s linear infinite' }} /> Saving…</>
                : <><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> {isEdit ? 'Update Item' : 'Save Item to Catalog'}</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default New;