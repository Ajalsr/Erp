import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import PhoneInput, { getCountryCallingCode } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import axiosInstance from '../../helper/axiosInstance/';

/* ══════════════════════════════════════════════════════════════════════
   SHARED PRIMITIVES  (identical API to New.jsx so patterns stay consistent)
══════════════════════════════════════════════════════════════════════ */

/* ── Field wrapper ─────────────────────────────────────────────── */
const F = ({ label, req, hint, children, T, half }) => (
  <div style={half ? {} : {}}>
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

/* ── Input ─────────────────────────────────────────────────────── */
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

/* ── CustomSelect — portal-based, searchable ───────────────────── */
function CustomSelect({ value, onChange, options, placeholder = 'Select', name, T, isDark, error }) {
  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const [query,   setQuery]   = useState('');
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);
  const searchRef  = useRef(null);

  const searchable = options.length > 8;
  const filtered   = searchable && query
    ? options.filter(o => (o.label ?? o).toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = options.find(o => (o.value ?? o) === value);
  const display  = selected ? (selected.label ?? selected) : null;

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(filtered.length * 40 + (searchable ? 52 : 12), 300);
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, [filtered.length, searchable]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); setQuery(''); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        measurePos();
        setTimeout(() => searchRef.current?.focus(), 50);
      });
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    if (!open) return;
    const repos = () => measurePos();
    window.addEventListener('scroll', repos, true);
    window.addEventListener('resize', repos);
    return () => { window.removeEventListener('scroll', repos, true); window.removeEventListener('resize', repos); };
  }, [open, measurePos]);

  useEffect(() => {
    const h = e => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          dropRef.current    && !dropRef.current.contains(e.target)) {
        setOpen(false); setReady(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = opt => {
    onChange({ target: { name, value: opt.value ?? opt } });
    setOpen(false); setReady(false); setQuery('');
  };

  const activeColor = isDark ? '#60a5fa' : '#1d4ed8';
  const activeBg    = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff';
  const hoverBg     = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc';

  const dropdown = (
    <div ref={dropRef}
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width,
               zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12,
               boxShadow: isDark ? '0 16px 48px rgba(0,0,0,.5)' : '0 16px 48px rgba(0,0,0,.12)',
               overflow: 'hidden', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
               visibility: ready ? 'visible' : 'hidden', opacity: ready ? 1 : 0, transition: 'opacity .12s ease' }}>
      {searchable && (
        <div style={{ padding: '8px 8px 4px', borderBottom: `1px solid ${T.border}` }}>
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search…" onClick={e => e.stopPropagation()}
            style={{ width: '100%', height: 34, padding: '0 12px', border: `1.5px solid ${T.border}`,
                     borderRadius: 8, fontSize: 12, background: T.surface2, color: T.textPri,
                     outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
      )}
      <div style={{ maxHeight: 240, overflowY: 'auto', padding: 6 }}>
        {filtered.length === 0
          ? <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: T.textSec }}>No results</div>
          : filtered.map((opt, i) => {
              const val = opt.value ?? opt;
              const lbl = opt.label ?? opt;
              const isAct = val === value;
              return (
                <div key={i} onClick={() => select(opt)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                           padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                           fontWeight: isAct ? 600 : 400, color: isAct ? activeColor : T.textPri,
                           background: isAct ? activeBg : 'transparent', transition: 'background .1s' }}
                  onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = hoverBg; }}
                  onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}>
                  {lbl}
                  {isAct && (
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth={2.5} strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              );
            })
        }
      </div>
    </div>
  );

  return (
    <div>
      <div ref={triggerRef} onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                 height: 42, padding: '0 14px',
                 border: `1.5px solid ${error ? '#ef4444' : open ? (isDark ? 'rgba(59,130,246,.55)' : '#93c5fd') : T.border}`,
                 borderRadius: 10, background: T.surface, cursor: 'pointer',
                 boxShadow: error ? '0 0 0 3px rgba(239,68,68,.15)' : open ? `0 0 0 3px ${isDark ? 'rgba(59,130,246,.1)' : 'rgba(147,197,253,.2)'}` : 'none',
                 transition: 'border-color .15s, box-shadow .15s', boxSizing: 'border-box', userSelect: 'none' }}>
        <span style={{ fontSize: 13, color: display ? T.textPri : (isDark ? 'rgba(255,255,255,.25)' : '#cbd5e1'),
                       fontFamily: "'DM Sans', sans-serif", fontWeight: display ? 500 : 400 }}>
          {display || placeholder}
        </span>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
          stroke={error ? '#ef4444' : open ? (isDark ? '#60a5fa' : '#2563eb') : T.textSec}
          strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {error && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef4444', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <circle cx={12} cy={12} r={10}/><line x1={12} y1={8} x2={12} y2={12}/><line x1={12} y1={16} x2="12.01" y2={16}/>
          </svg>
          {error}
        </p>
      )}
      {open && createPortal(dropdown, document.body)}
    </div>
  );
}

/* ── CountrySelect — custom portal dropdown for PhoneInput ────── */
function CountrySelect({ value, onChange, options, iconComponent }) {
  const FlagIcon = iconComponent;
  const isDark = useThemeStore(s => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 260 });
  const [query,   setQuery]   = useState('');
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);
  const searchRef  = useRef(null);

  const countryOptions = options.filter(o => o.value);
  const filtered = query
    ? countryOptions.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : countryOptions;

  const getCode = code => { try { return '+' + getCountryCallingCode(code); } catch { return ''; } };

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(filtered.length * 42 + 60, 320);
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 6 : r.top - dropH - 6;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: 260 });
    setReady(true);
  }, [filtered.length]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); setQuery(''); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        measurePos();
        setTimeout(() => searchRef.current?.focus(), 50);
      });
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    if (!open) return;
    const repos = () => measurePos();
    window.addEventListener('scroll', repos, true);
    window.addEventListener('resize', repos);
    return () => { window.removeEventListener('scroll', repos, true); window.removeEventListener('resize', repos); };
  }, [open, measurePos]);

  useEffect(() => {
    const h = e => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          dropRef.current    && !dropRef.current.contains(e.target)) {
        setOpen(false); setReady(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = code => { onChange(code); setOpen(false); setReady(false); setQuery(''); };

  const activeColor = isDark ? '#60a5fa' : '#2563eb';
  const activeBg    = isDark ? 'rgba(59,130,246,.15)' : '#eff6ff';
  const hoverBg     = isDark ? 'rgba(255,255,255,.05)' : '#f8fafc';

  const dropdown = (
    <div ref={dropRef} style={{
      position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width,
      zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`,
      borderRadius: 14, fontFamily: "'DM Sans', sans-serif",
      boxShadow: isDark ? '0 20px 60px rgba(0,0,0,.6)' : '0 20px 60px rgba(0,0,0,.15)',
      overflow: 'hidden', visibility: ready ? 'visible' : 'hidden',
      opacity: ready ? 1 : 0, transition: 'opacity .12s ease',
    }}>
      {/* Search bar */}
      <div style={{ padding: '10px 10px 6px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 10px', height: 36,
          border: `1.5px solid ${T.border}`, borderRadius: 9, background: T.surface2,
        }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T.textSec} strokeWidth={2.5} strokeLinecap="round">
            <circle cx={11} cy={11} r={8}/><line x1={21} y1={21} x2={16.65} y2={16.65}/>
          </svg>
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search country…" onClick={e => e.stopPropagation()}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                     fontSize: 12, color: T.textPri, fontFamily: 'inherit' }} />
          {query && (
            <button onClick={e => { e.stopPropagation(); setQuery(''); }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.textSec, display: 'flex' }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/>
              </svg>
            </button>
          )}
        </div>
      </div>
      {/* List */}
      <div style={{ maxHeight: 252, overflowY: 'auto', padding: 6 }}>
        {filtered.length === 0
          ? <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: T.textSec }}>No results</div>
          : filtered.map(opt => {
              const isAct = opt.value === value;
              return (
                <div key={opt.value} onClick={() => select(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 9, cursor: 'pointer',
                    background: isAct ? activeBg : 'transparent', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = hoverBg; }}
                  onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: 24, height: 16, borderRadius: 3, overflow: 'hidden', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}>
                    <FlagIcon country={opt.value} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: isAct ? activeColor : T.textPri,
                                 fontWeight: isAct ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 11, color: isAct ? activeColor : T.textSec, fontWeight: 500, flexShrink: 0 }}>
                    {getCode(opt.value)}
                  </span>
                  {isAct && (
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth={2.5} strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              );
            })
        }
      </div>
    </div>
  );

  return (
    <div ref={triggerRef} onClick={handleOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px 0 10px',
               cursor: 'pointer', height: '100%', userSelect: 'none', flexShrink: 0 }}>
      <div style={{ width: 22, height: 15, borderRadius: 3, overflow: 'hidden', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.25)' }}>
        {value ? <FlagIcon country={value} /> : <span style={{ fontSize: 14 }}>🌐</span>}
      </div>
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={T.textSec}
        strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
}

/* ── Textarea ──────────────────────────────────────────────────── */
function Textarea({ T, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea {...props}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '10px 13px',
        border: `1.5px solid ${focused ? '#3b82f6' : T.border}`,
        borderRadius: 10, fontSize: 13, color: T.textPri,
        background: T.surface, outline: 'none', resize: 'vertical',
        minHeight: 80, fontFamily: "'DM Sans', sans-serif",
        boxShadow: focused ? '0 0 0 3px rgba(59,130,246,.12)' : 'none',
        transition: 'border-color .15s, box-shadow .15s', boxSizing: 'border-box',
      }}
    />
  );
}

/* ── Section card ──────────────────────────────────────────────── */
function Section({ id, title, icon, accent, children, T }) {
  return (
    <div id={id} style={{
      background: T.surface, borderRadius: 16,
      border: `1.5px solid ${T.border}`, overflow: 'hidden',
      marginBottom: 16,
      boxShadow: T.isDark ? '0 2px 12px rgba(0,0,0,.3)' : '0 2px 8px rgba(0,0,0,.04)',
    }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,${accent},transparent 80%)` }} />
      <div style={{ padding: '18px 22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
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

/* ── Discard Modal ─────────────────────────────────────────────── */
function DiscardModal({ onConfirm, onCancel, T }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)' }}>
      <div style={{
        background: T.surface, borderRadius: 20, padding: '32px 36px', width: 360,
        textAlign: 'center', boxShadow: '0 40px 100px rgba(0,0,0,.35)',
        border: `1.5px solid ${T.border}`,
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>⚠</div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, color: T.textPri, margin: '0 0 8px', fontWeight: 700 }}>Discard this vendor?</h2>
        <p style={{ fontSize: 13, color: T.textSec, margin: '0 0 24px', lineHeight: 1.5 }}>All unsaved data will be permanently lost.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '11px', background: '#ef4444', color: '#fff',
            border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Yes, discard
          </button>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px', background: T.surface2, color: T.textPri,
            border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Nav section pill ──────────────────────────────────────────── */
const NAV = [
  { id: 'sec-identity',  label: 'Identity'   },
  { id: 'sec-contact',   label: 'Contact'    },
  { id: 'sec-address',   label: 'Address'    },
  { id: 'sec-finance',   label: 'Finance'    },
  { id: 'sec-banking',   label: 'Banking'    },
  { id: 'sec-persons',   label: 'Contacts'   },
  { id: 'sec-notes',     label: 'Notes'      },
];

const COUNTRIES = [
  'United Arab Emirates','Saudi Arabia','Qatar','Kuwait','Bahrain','Oman',
  'India','Pakistan','Philippines','Egypt','Jordan','Lebanon','Turkey',
  'United Kingdom','United States','Germany','France','China','Japan',
  'Singapore','Malaysia','Australia','Canada','South Africa',
];

const CURRENCIES = ['AED','USD','EUR','GBP','INR','SAR','QAR','KWD','BHD','OMR','EGP'];

const PAYMENT_TERMS = [
  'Net 15','Net 30','Net 45','Net 60','Net 90',
  'Due on receipt','End of month','Cash on delivery',
];

const VENDOR_TYPES = ['Individual','Business / Company','Manufacturer','Distributor','Service Provider'];

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function NewVendor() {
  const navigate  = useNavigate();
  const isDark    = useThemeStore(s => s.isDark);
  const T         = { ...getTheme(isDark), isDark };

  /* ── State ── */
  const [saving,       setSaving]       = useState(false);
  const [showDiscard,  setShowDiscard]  = useState(false);
  const [activeSection,setActiveSection] = useState('sec-identity');
  const [errors,       setErrors]       = useState({});
  const [contacts,     setContacts]     = useState([{ id: Date.now(), name: '', email: '', phone: '', position: '', isPrimary: true }]);

  const [form, setForm] = useState({
    // Identity
    vendorType: '', origin: '', tradeLicenseNumber: '',
    displayName: '', companyName: '', vendorCode: '',
    website: '',
    // Contact
    email: '', phone: '', workPhone: '', mobile: '',
    // Address — Billing
    billStreet: '', billCity: '', billState: '', billPostal: '', billCountry: '',
    // Address — Shipping
    sameAsBilling: true,
    shipStreet: '', shipCity: '', shipState: '', shipPostal: '', shipCountry: '',
    // Finance
    currency: 'AED', paymentTerms: '', creditLimit: '', noOfDays: '',
    // Banking
    bankName: '', bankAccount: '', bankIban: '', bankSwift: '', bankBranch: '',
    // Notes
    notes: '', remarks: '', tags: '',
  });

  /* ── Scroll spy ── */
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); }),
      { threshold: 0.35 }
    );
    NAV.forEach(s => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  /* ── Handlers ── */
  const handleChange = useCallback(e => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(p => { const n = { ...p }; delete n[name]; return n; });
  }, [errors]);

  const handlePhoneChange = useCallback((value, field) => {
    setForm(p => ({ ...p, [field]: value || '' }));
  }, []);

  const addContact = () => setContacts(p => [...p, { id: Date.now(), name: '', email: '', phone: '', position: '', isPrimary: false }]);
  const removeContact = id => setContacts(p => p.filter(c => c.id !== id));
  const updateContact = (id, field, value) => setContacts(p => p.map(c => c.id === id ? { ...c, [field]: value } : c));

  /* ── Validation ── */
  const validate = () => {
    const e = {};
    if (!form.displayName.trim()) e.displayName = 'Display name is required';
    if (!form.email.trim())       e.email        = 'Email address is required';
    if (!form.vendorType)         e.vendorType   = 'Vendor type is required';
    if (!form.trnNumber.trim())   e.trnNumber    = 'TRN Number is required';
    return e;
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      nexusToast.error(Object.values(newErrors)[0]);
      setTimeout(() => document.querySelector(`[name="${Object.keys(newErrors)[0]}"]`)?.focus(), 50);
      return;
    }
    setErrors({});
    setSaving(true);

    const payload = {
      vendorType:          form.vendorType,
      origin:              form.origin,
      tradeLicenseNumber:  form.tradeLicenseNumber,
      displayName:         form.displayName,
      companyName:         form.companyName,
      vendorCode:          form.vendorCode,
      website:             form.website,
      email:         form.email,
      phone:         form.phone,
      workPhone:     form.workPhone,
      mobile:        form.mobile,
      billingAddress: {
        street:  form.billStreet,
        city:    form.billCity,
        state:   form.billState,
        postal:  form.billPostal,
        country: form.billCountry,
      },
      shippingAddress: form.sameAsBilling ? null : {
        street:  form.shipStreet,
        city:    form.shipCity,
        state:   form.shipState,
        postal:  form.shipPostal,
        country: form.shipCountry,
      },
      currency:     form.currency,
      paymentTerms: form.paymentTerms,
      creditLimit:  parseFloat(form.creditLimit) || 0,
      banking: {
        bankName:    form.bankName,
        accountNo:   form.bankAccount,
        iban:        form.bankIban,
        swiftCode:   form.bankSwift,
        branch:      form.bankBranch,
      },
      contactPersons: contacts.filter(c => c.name.trim()),
      notes:   form.notes,
      remarks: form.remarks,
      tags:    form.tags.split(',').map(t => t.trim()).filter(Boolean),
      status:  'active',
    };

    try {
      await axiosInstance.post('/api/vendors/', payload);
      nexusToast.success('Vendor created successfully!');
      setTimeout(() => navigate('/Purchase/Vendors'), 1500);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to save vendor';
      nexusToast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /* ── Derived ── */
  const initials = form.displayName
    ? form.displayName.trim().split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
    : '??';
  const avatarColor = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'][
    (form.displayName.charCodeAt(0) || 65) % 6
  ];

  /* ── Styles ── */
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0';
  const card = (extra = {}) => ({
    background: T.surface,
    borderRadius: 16,
    border: `1.5px solid ${borderColor}`,
    ...extra,
  });
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
  const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 };

  const saveBtn = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 22px',
    background: saving ? T.surface2 : 'linear-gradient(135deg,#3b82f6,#2563eb)',
    color: saving ? T.textSec : '#fff',
    border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700,
    cursor: saving ? 'not-allowed' : 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all .15s',
    boxShadow: saving ? 'none' : '0 4px 14px rgba(59,130,246,.35)',
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Keyframes + PhoneInput theme */}
      <style>{`
        @keyframes nvFadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .nv-contact-row:hover { background: ${isDark ? 'rgba(255,255,255,.03)' : '#f8fafc'} !important; }
        .nv-nav-pill:hover { background: ${isDark ? 'rgba(255,255,255,.06)' : '#f1f5f9'} !important; }
        .nv-tab:hover { background: ${isDark ? 'rgba(255,255,255,.04)' : '#f1f5f9'} !important; }
        .PhoneInput { width: 100%; display: flex; }
        .PhoneInputInput {
          flex: 1; height: 42px; padding: 0 14px;
          border: 1.5px solid ${T.border}; border-left: none;
          border-radius: 0 10px 10px 0;
          font-size: 13px; font-family: 'DM Sans', sans-serif;
          background: ${T.surface}; color: ${T.textPri}; outline: none;
          transition: border-color .15s;
        }
        .PhoneInputInput::placeholder { color: ${isDark ? 'rgba(255,255,255,.2)' : '#cbd5e1'}; }
        .PhoneInputInput:focus { border-color: ${isDark ? 'rgba(59,130,246,.55)' : '#93c5fd'}; }
        .PhoneInputCountry {
          border: 1.5px solid ${T.border}; border-right: none;
          border-radius: 10px 0 0 10px;
          background: ${T.surface2};
          height: 42px; display: flex; align-items: center;
          padding: 0;
        }
      `}</style>

      {showDiscard && (
        <DiscardModal
          T={T}
          onConfirm={() => navigate('/Purchase/Vendors')}
          onCancel={() => setShowDiscard(false)}
        />
      )}

      <div style={{
        minHeight: '100vh', background: T.bg, paddingBottom: 100,
        animation: 'nvFadeUp .3s ease both',
      }}>

        {/* ── Top bar ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: isDark ? 'rgba(8,13,26,.92)' : 'rgba(241,245,249,.92)',
          backdropFilter: 'blur(16px)', borderBottom: `1px solid ${borderColor}`,
          padding: '0 28px', height: 58,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setShowDiscard(true)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'none', border: `1.5px solid ${borderColor}`,
              borderRadius: 10, padding: '7px 14px', color: T.textSec,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back
            </button>
            <div style={{ width: 1, height: 24, background: borderColor }} />
            <div>
              <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>
                New Vendor
              </p>
              <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>
                Purchase → Vendors
              </p>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowDiscard(true)} style={{
              padding: '9px 18px', background: 'none',
              border: `1.5px solid ${borderColor}`, borderRadius: 12,
              color: T.textSec, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button style={saveBtn} onClick={handleSubmit} disabled={saving}>
              {saving
                ? <><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Saving…</>
                : <><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save Vendor</>
              }
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '24px 28px', display: 'grid', gridTemplateColumns: '180px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Left nav ── */}
          <div style={{ position: 'sticky', top: 78 }}>
            {/* Avatar card */}
            <div style={{ ...card({ padding: '22px 16px', textAlign: 'center', marginBottom: 12 }) }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: `${avatarColor}22`,
                border: `2px solid ${avatarColor}44`,
                color: avatarColor, display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 10px',
                fontFamily: "'Sora', sans-serif", fontSize: 22, fontWeight: 800,
              }}>
                {initials}
              </div>
              <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 700, color: T.textPri, margin: '0 0 2px', wordBreak: 'break-word' }}>
                {form.displayName || 'New Vendor'}
              </p>
              {form.companyName && (
                <p style={{ fontSize: 11, color: T.textSec, margin: 0, wordBreak: 'break-word' }}>{form.companyName}</p>
              )}
              {form.vendorType && (
                <span style={{
                  display: 'inline-block', marginTop: 8, padding: '3px 10px',
                  borderRadius: 999, fontSize: 10, fontWeight: 700,
                  background: `${avatarColor}18`, color: avatarColor,
                  border: `1px solid ${avatarColor}33`,
                }}>
                  {form.vendorType}
                </span>
              )}
            </div>

            {/* Nav pills */}
            <div style={{ ...card({ padding: '8px' }) }}>
              {NAV.map(n => (
                <button key={n.id} className="nv-nav-pill"
                  onClick={() => document.getElementById(n.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{
                    width: '100%', padding: '8px 12px', textAlign: 'left',
                    background: activeSection === n.id ? (isDark ? 'rgba(59,130,246,.15)' : '#eff6ff') : 'none',
                    border: 'none', borderRadius: 9,
                    color: activeSection === n.id ? '#3b82f6' : T.textSec,
                    fontSize: 12, fontWeight: activeSection === n.id ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                  {activeSection === n.id && (
                    <div style={{ width: 3, height: 14, borderRadius: 999, background: '#3b82f6', flexShrink: 0 }} />
                  )}
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Right form ── */}
          <div>

            {/* ── IDENTITY ── */}
            <Section id="sec-identity" title="Vendor Identity" accent="#3b82f6" T={T}
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x={2} y={5} width={20} height={14} rx={2}/><line x1={2} y1={10} x2={22} y2={10}/></svg>}
            >
              <div style={{ ...grid2, marginBottom: 16 }}>
                <F label="Vendor Type" req T={T}>
                  <CustomSelect name="vendorType" value={form.vendorType} onChange={handleChange}
                    options={VENDOR_TYPES} placeholder="Select type"
                    T={T} isDark={isDark} error={errors.vendorType} />
                </F>
                <F label="Origin" T={T}>
                  <CustomSelect name="origin" value={form.origin} onChange={handleChange}
                    options={['Free Zone', 'Mainland', 'Overseas']} placeholder="Select origin"
                    T={T} isDark={isDark} />
                </F>
              </div>

              <div style={{ ...grid2, marginBottom: 16 }}>
                <F label="Display Name" req T={T}>
                  <Input name="displayName" value={form.displayName} onChange={handleChange} placeholder="Name shown on documents" T={T} error={errors.displayName} autoFocus />
                </F>
              </div>

              <div style={{ ...grid2, marginBottom: 16 }}>
                <F label="Company Name" T={T}>
                  <Input name="companyName" value={form.companyName} onChange={handleChange} placeholder="Legal company name" T={T} />
                </F>
                <F label="Vendor Code" hint="auto if blank" T={T}>
                  <Input name="vendorCode" value={form.vendorCode} onChange={handleChange} placeholder="VND-001" mono T={T} />
                </F>
              </div>

              <div style={{ ...grid3 }}>
                <F label="TRN Number" req T={T}>
                  <Input name="trnNumber" value={form.trnNumber} onChange={handleChange} placeholder="Tax Registration No." mono T={T} error={errors.trnNumber} />
                </F>
                <F label="Trade License No." T={T}>
                  <Input name="tradeLicenseNumber" value={form.tradeLicenseNumber} onChange={handleChange} placeholder="TL-XXXXXXXX" mono T={T} />
                </F>
                <F label="Website" T={T}>
                  <Input name="website" value={form.website} onChange={handleChange} placeholder="https://example.com" T={T} />
                </F>
              </div>
            </Section>

            {/* ── CONTACT ── */}
            <Section id="sec-contact" title="Contact Details" accent="#10b981" T={T}
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.93 19.79 19.79 0 01.11 1.22 2 2 0 012.11 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/></svg>}
            >
              <div style={{ ...grid2, marginBottom: 16 }}>
                <F label="Email Address" req T={T}>
                  <Input name="email" type="email" value={form.email} onChange={handleChange} placeholder="vendor@example.com" T={T} error={errors.email} />
                </F>
                <F label="Primary Phone" T={T}>
                  <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                    countrySelectComponent={CountrySelect}
                    value={form.phone} onChange={val => handlePhoneChange(val, 'phone')} />
                </F>
              </div>
              <div style={{ ...grid2 }}>
                <F label="Work Phone" T={T}>
                  <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                    countrySelectComponent={CountrySelect}
                    value={form.workPhone} onChange={val => handlePhoneChange(val, 'workPhone')} />
                </F>
                <F label="Mobile" T={T}>
                  <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                    countrySelectComponent={CountrySelect}
                    value={form.mobile} onChange={val => handlePhoneChange(val, 'mobile')} />
                </F>
              </div>
            </Section>

            {/* ── ADDRESS ── */}
            <Section id="sec-address" title="Address" accent="#8b5cf6" T={T}
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx={12} cy={10} r={3}/></svg>}
            >
              {/* Billing */}
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8b5cf6', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 20, height: 1.5, background: '#8b5cf6', display: 'inline-block', borderRadius: 999 }} />
                Billing Address
              </p>
              <div style={{ ...grid2, marginBottom: 16 }}>
                <F label="Street / P.O Box" T={T} style={{ gridColumn: '1 / -1' }}>
                  <Input name="billStreet" value={form.billStreet} onChange={handleChange} placeholder="Street address, floor, suite…" T={T} />
                </F>
                <F label="City" T={T}>
                  <Input name="billCity" value={form.billCity} onChange={handleChange} placeholder="Dubai" T={T} />
                </F>
                <F label="State / Emirate" T={T}>
                  <Input name="billState" value={form.billState} onChange={handleChange} placeholder="Dubai" T={T} />
                </F>
              </div>
              <div style={{ ...grid2, marginBottom: 20 }}>
                <F label="Postal Code" T={T}>
                  <Input name="billPostal" value={form.billPostal} onChange={handleChange} placeholder="00000" mono T={T} />
                </F>
                <F label="Country" T={T}>
                  <CustomSelect name="billCountry" value={form.billCountry} onChange={handleChange}
                    options={COUNTRIES} placeholder="Select country" T={T} isDark={isDark} />
                </F>
              </div>

              {/* Same as billing toggle */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                padding: '10px 14px', borderRadius: 10,
                background: isDark ? 'rgba(255,255,255,.03)' : '#f8fafc',
                border: `1.5px solid ${borderColor}`, marginBottom: form.sameAsBilling ? 0 : 20,
              }}>
                <div
                  onClick={() => setForm(p => ({ ...p, sameAsBilling: !p.sameAsBilling }))}
                  style={{
                    width: 18, height: 18, borderRadius: 5, border: `2px solid ${form.sameAsBilling ? '#8b5cf6' : T.border}`,
                    background: form.sameAsBilling ? '#8b5cf6' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'all .15s', cursor: 'pointer',
                  }}
                >
                  {form.sameAsBilling && (
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri }}>Shipping address same as billing</span>
              </label>

              {!form.sameAsBilling && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8b5cf6', margin: '20px 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 20, height: 1.5, background: '#8b5cf6', display: 'inline-block', borderRadius: 999 }} />
                    Shipping Address
                  </p>
                  <div style={{ ...grid2, marginBottom: 16 }}>
                    <F label="Street / P.O Box" T={T}>
                      <Input name="shipStreet" value={form.shipStreet} onChange={handleChange} placeholder="Street address…" T={T} />
                    </F>
                    <F label="City" T={T}>
                      <Input name="shipCity" value={form.shipCity} onChange={handleChange} placeholder="Dubai" T={T} />
                    </F>
                  </div>
                  <div style={{ ...grid3 }}>
                    <F label="State" T={T}>
                      <Input name="shipState" value={form.shipState} onChange={handleChange} placeholder="Dubai" T={T} />
                    </F>
                    <F label="Postal Code" T={T}>
                      <Input name="shipPostal" value={form.shipPostal} onChange={handleChange} placeholder="00000" mono T={T} />
                    </F>
                    <F label="Country" T={T}>
                      <CustomSelect name="shipCountry" value={form.shipCountry} onChange={handleChange}
                        options={COUNTRIES} placeholder="Select country" T={T} isDark={isDark} />
                    </F>
                  </div>
                </>
              )}
            </Section>

            {/* ── FINANCE ── */}
            <Section id="sec-finance" title="Finance & Terms" accent="#f59e0b" T={T}
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1={12} y1={1} x2={12} y2={23}/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
            >
              <div style={{ ...grid3, marginBottom: 16 }}>
                <F label="Currency" T={T}>
                  <CustomSelect name="currency" value={form.currency} onChange={handleChange}
                    options={CURRENCIES} placeholder="Select currency" T={T} isDark={isDark} />
                </F>
                <F label="Payment Terms" T={T}>
                  <CustomSelect name="paymentTerms" value={form.paymentTerms} onChange={handleChange}
                    options={PAYMENT_TERMS} placeholder="Select terms" T={T} isDark={isDark} />
                </F>
                <F label="No. of Days" T={T}>
                  <Input type="number" name="noOfDays" value={form.noOfDays} onChange={handleChange} placeholder="0" mono T={T} />
                </F>
              </div>
              <div style={{ ...grid2 }}>
                <F label="Credit Limit" T={T}>
                  <Input prefix="AED" type="number" name="creditLimit" value={form.creditLimit} onChange={handleChange} placeholder="0.00" mono T={T} />
                </F>
                <F label="Credit Used" T={T}>
                  <Input prefix="AED" type="number" name="creditUsed" value={form.creditUsed} onChange={handleChange} placeholder="0.00" mono T={T} />
                </F>
                <F label="TRN Number" T={T}>
                  <Input name="trnNumber" value={form.trnNumber} onChange={handleChange} placeholder="VAT Reg No." mono T={T} />
                </F>
              </div>
            </Section>

            {/* ── BANKING ── */}
            <Section id="sec-banking" title="Banking Details" accent="#06b6d4" T={T}
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x={2} y={7} width={20} height={14} rx={2}/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>}
            >
              <div style={{ ...grid2, marginBottom: 16 }}>
                <F label="Bank Name" T={T}>
                  <Input name="bankName" value={form.bankName} onChange={handleChange} placeholder="e.g. Emirates NBD" T={T} />
                </F>
                <F label="Branch" T={T}>
                  <Input name="bankBranch" value={form.bankBranch} onChange={handleChange} placeholder="Branch name" T={T} />
                </F>
              </div>
              <div style={{ ...grid3 }}>
                <F label="Account Number" T={T}>
                  <Input name="bankAccount" value={form.bankAccount} onChange={handleChange} placeholder="0000000000" mono T={T} />
                </F>
                <F label="IBAN" T={T}>
                  <Input name="bankIban" value={form.bankIban} onChange={handleChange} placeholder="AE000000000000000" mono T={T} />
                </F>
                <F label="SWIFT / BIC" T={T}>
                  <Input name="bankSwift" value={form.bankSwift} onChange={handleChange} placeholder="ENBD AEADUXX" mono T={T} />
                </F>
              </div>
            </Section>

            {/* ── CONTACT PERSONS ── */}
            <Section id="sec-persons" title="Contact Persons" accent="#10b981" T={T}
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx={9} cy={7} r={4}/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {contacts.map((cp, idx) => (
                  <div key={cp.id} className="nv-contact-row" style={{
                    border: `1.5px solid ${borderColor}`, borderRadius: 12,
                    padding: '14px 16px',
                    background: isDark ? 'rgba(255,255,255,.02)' : '#fafafa',
                    transition: 'background .15s',
                  }}>
                    {/* Row header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: isDark ? 'rgba(59,130,246,.15)' : '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, fontFamily: "'Sora', sans-serif" }}>
                          {idx + 1}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.textPri }}>
                          {cp.isPrimary ? '★ Primary' : `Contact ${idx + 1}`}
                        </span>
                      </div>
                      {contacts.length > 1 && (
                        <button onClick={() => removeContact(cp.id)} style={{
                          background: isDark ? 'rgba(239,68,68,.1)' : '#fee2e2',
                          color: '#ef4444', border: 'none', borderRadius: 7,
                          padding: '4px 10px', fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          Remove
                        </button>
                      )}
                    </div>
                    {/* Fields */}
                    <div style={{ ...grid2, marginBottom: 12 }}>
                      <F label="Full Name" T={T}>
                        <Input value={cp.name} onChange={e => updateContact(cp.id, 'name', e.target.value)} placeholder="Contact name" T={T} />
                      </F>
                      <F label="Position / Title" T={T}>
                        <Input value={cp.position} onChange={e => updateContact(cp.id, 'position', e.target.value)} placeholder="e.g. Procurement Manager" T={T} />
                      </F>
                    </div>
                    <div style={{ ...grid2 }}>
                      <F label="Email" T={T}>
                        <Input type="email" value={cp.email} onChange={e => updateContact(cp.id, 'email', e.target.value)} placeholder="email@example.com" T={T} />
                      </F>
                      <F label="Phone" T={T}>
                        <Input value={cp.phone} onChange={e => updateContact(cp.id, 'phone', e.target.value)} placeholder="+971 50 000 0000" T={T} />
                      </F>
                    </div>
                  </div>
                ))}

                {/* Add contact button */}
                <button onClick={addContact} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', border: `1.5px dashed ${isDark ? 'rgba(59,130,246,.3)' : '#93c5fd'}`,
                  borderRadius: 12, background: 'none', color: '#3b82f6',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .15s',
                }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
                  Add Contact Person
                </button>
              </div>
            </Section>

            {/* ── NOTES ── */}
            <Section id="sec-notes" title="Notes & Tags" accent="#64748b" T={T}
              icon={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1={16} y1={13} x2={8} y2={13}/><line x1={16} y1={17} x2={8} y2={17}/><polyline points="10 9 9 9 8 9"/></svg>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <F label="Internal Notes" hint="not shown to vendor" T={T}>
                  <Textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Add any internal notes about this vendor…" T={T} />
                </F>
                <F label="Remarks" T={T}>
                  <Textarea name="remarks" value={form.remarks} onChange={handleChange} placeholder="Additional remarks…" T={T} style={{ minHeight: 60 }} />
                </F>
                <F label="Tags" hint="comma separated" T={T}>
                  <Input name="tags" value={form.tags} onChange={handleChange} placeholder="e.g. preferred, local, bulk" T={T} />
                </F>
                {form.tags && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {form.tags.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => (
                      <span key={i} style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: isDark ? 'rgba(100,116,139,.15)' : '#f1f5f9',
                        color: T.textSec, border: `1px solid ${borderColor}`,
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Section>

          </div>{/* end right form */}
        </div>{/* end body grid */}

        {/* ── Sticky bottom save bar ── */}
        <div style={{
          position: 'fixed', bottom: 0, left: 220, right: 0, zIndex: 90,
          background: isDark ? 'rgba(8,13,26,.95)' : 'rgba(241,245,249,.95)',
          backdropFilter: 'blur(12px)', borderTop: `1px solid ${borderColor}`,
          padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
        }}>
          <span style={{ fontSize: 12, color: T.textSec, marginRight: 'auto' }}>
            {Object.keys(errors).length > 0
              ? <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠ {Object.keys(errors).length} required field{Object.keys(errors).length > 1 ? 's' : ''} missing</span>
              : <span style={{ color: isDark ? 'rgba(255,255,255,.2)' : '#cbd5e1' }}>Fill in the required fields and save</span>
            }
          </span>
          <button onClick={() => setShowDiscard(true)} style={{
            padding: '9px 18px', background: 'none',
            border: `1.5px solid ${borderColor}`, borderRadius: 12,
            color: T.textSec, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Cancel
          </button>
          <button style={saveBtn} onClick={handleSubmit} disabled={saving}>
            {saving
              ? 'Saving…'
              : <><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save Vendor</>
            }
          </button>
        </div>

      </div>
    </>
  );
}