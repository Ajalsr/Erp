import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useGetItem from '../../helper/useGetItem';
import axiosInstance from '../../helper/axiosInstance';
import nexusToast from '../../helper/nexusToast';
import { debounce } from 'lodash';
import RDatePicker from 'react-datepicker';
import { format, addDays, addMonths, addYears, isSameDay } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import {
  FaPlus, FaTrash, FaChevronLeft, FaChevronRight, FaCheck,
  FaBox, FaPercent, FaMoneyBillWave, FaTag,
  FaCheckCircle, FaFileInvoiceDollar, FaBarcode,
  FaWarehouse, FaMoneyBill, FaBuilding,
} from 'react-icons/fa';

/* ─── CSS ─────────────────────────────────────────────────────────── */
const buildCSS = (isDark) => {
  const bg       = isDark ? '#080d1a' : '#f1f5f9';
  const surface  = isDark ? '#0d1526' : '#ffffff';
  const surface2 = isDark ? '#111d30' : '#f8fafc';
  const border   = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
  const border2  = isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9';
  const text     = isDark ? '#e2e8f0' : '#0f172a';
  const textSec  = isDark ? '#64748b' : '#64748b';
  const textMuted= isDark ? '#475569' : '#94a3b8';
  const inp      = isDark ? '#111d30' : '#ffffff';
  const inpBdr   = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
  const tblHead  = isDark ? '#0a1220' : '#f8fafc';
  const scrollThumb = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
  return `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
  .npo-root*,.npo-root *::before,.npo-root *::after{box-sizing:border-box;}
  .npo-root{font-family:'DM Sans',sans-serif;color:${text};background:${bg};}
  .npo-root input,.npo-root textarea,.npo-root button{font-family:'DM Sans',sans-serif;color:${text};}
  .npo-root input::placeholder,.npo-root textarea::placeholder{color:${textMuted};}
  .npo-root *::-webkit-scrollbar{width:5px;height:5px;}
  .npo-root *::-webkit-scrollbar-track{background:transparent;}
  .npo-root *::-webkit-scrollbar-thumb{background:${scrollThumb};border-radius:99px;}
  @keyframes npoFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes npoSpin{to{transform:rotate(360deg)}}
  .npo-card{animation:npoFadeUp .3s ease both;}
  .npo-inp{width:100%;padding:10px 14px;border:1.5px solid ${inpBdr};border-radius:10px;font-size:13px;color:${text};background:${inp};outline:none;transition:border-color .15s,box-shadow .15s;}
  .npo-inp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12);}
  .npo-lbl{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${textSec};margin-bottom:6px;}
  .npo-req{color:#ef4444;margin-left:2px;}
  .npo-section{background:${surface};border-radius:16px;border:1.5px solid ${border};overflow:hidden;margin-bottom:16px;box-shadow:${isDark?'0 2px 12px rgba(0,0,0,.3)':'0 1px 4px rgba(0,0,0,.04)'};}
  .npo-sbar{height:3px;}
  .npo-sin{padding:22px 24px;}
  .npo-stitle{font-family:'Sora',sans-serif;font-size:14px;font-weight:700;color:${text};margin:0 0 18px;letter-spacing:-.02em;display:flex;align-items:center;gap:9px;}
  .npo-sicon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
  .npo-table{width:100%;border-collapse:separate;border-spacing:0;}
  .npo-table thead tr th{padding:11px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${textMuted};background:${tblHead};border-bottom:1.5px solid ${border};text-align:left;white-space:nowrap;}
  .npo-table tbody tr{transition:background .12s;}
  .npo-table tbody tr:hover{background:${surface2};}
  .npo-table tbody tr td{padding:10px 14px;border-bottom:1.5px solid ${border2};vertical-align:middle;}
  .npo-table tbody tr:last-child td{border-bottom:none;}
  .npo-tinp{width:100%;padding:8px 11px;border:1.5px solid ${inpBdr};border-radius:8px;font-size:13px;color:${text};background:${inp};outline:none;transition:border-color .15s,box-shadow .15s;font-family:'DM Sans',sans-serif;}
  .npo-tinp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
  .npo-qty{display:flex;align-items:center;}
  .npo-qbtn{width:28px;height:34px;border:1.5px solid ${inpBdr};background:${surface2};color:${textSec};cursor:pointer;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0;}
  .npo-qbtn:first-child{border-radius:8px 0 0 8px;border-right:none;}
  .npo-qbtn:last-child{border-radius:0 8px 8px 0;border-left:none;}
  .npo-qbtn:hover{background:${isDark?'rgba(255,255,255,0.08)':'#e0e7ef'};color:${text};}
  .npo-qnum{width:44px;height:34px;text-align:center;border:1.5px solid ${inpBdr};border-left:none;border-right:none;font-size:13px;font-weight:600;color:${text};background:${inp};outline:none;font-family:'DM Mono',monospace;}
  .npo-amt{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${text};white-space:nowrap;padding:8px 12px;background:${surface2};border:1.5px solid ${border};border-radius:8px;min-width:110px;text-align:right;display:inline-block;}
  .npo-dtype{padding:8px 10px;border:1.5px solid ${inpBdr};border-radius:8px 0 0 8px;border-right:none;background:${surface2};color:${textSec};cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;transition:all .12s;display:flex;align-items:center;gap:4px;}
  .npo-dtype:hover{background:${isDark?'rgba(59,130,246,0.15)':'#eff6ff'};color:#3b82f6;border-color:#3b82f6;}
  .npo-dinp{flex:1;min-width:60px;padding:8px 10px;border:1.5px solid ${inpBdr};border-radius:0 8px 8px 0;font-size:13px;color:${text};background:${inp};outline:none;transition:border-color .15s;font-family:'DM Mono',monospace;}
  .npo-dinp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
  .npo-srow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;}
  .npo-srow+.npo-srow{border-top:1px solid ${border2};}
  .npo-bg{padding:10px 20px;border:1.5px solid ${border};border-radius:10px;background:${surface};color:${textSec};font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
  .npo-bg:hover{background:${surface2};color:${text};}
  .npo-bp{padding:10px 24px;border:none;border-radius:10px;background:#3b82f6;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;font-family:'DM Sans',sans-serif;box-shadow:0 4px 12px rgba(59,130,246,.3);display:flex;align-items:center;gap:7px;}
  .npo-bp:hover:not(:disabled){background:#2563eb;box-shadow:0 8px 20px rgba(59,130,246,.4);transform:translateY(-1px);}
  .npo-bp:disabled{opacity:.45;cursor:not-allowed;}
  .npo-addrow{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border:1.5px dashed #3b82f6;border-radius:10px;background:${isDark?'rgba(59,130,246,0.1)':'#eff6ff'};color:#3b82f6;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
  .npo-addrow:hover{background:${isDark?'rgba(59,130,246,0.18)':'#dbeafe'};border-color:#2563eb;}
  .npo-idd{background:${surface};border:1.5px solid ${border};border-radius:14px;box-shadow:${isDark?'0 20px 60px rgba(0,0,0,.5)':'0 20px 60px rgba(0,0,0,.12)'};max-height:380px;overflow-y:auto;}
  .npo-irow{padding:11px 14px;cursor:pointer;border-bottom:1px solid ${border2};transition:background .1s;display:flex;gap:12px;align-items:flex-start;}
  .npo-irow:last-child{border-bottom:none;}
  .npo-irow:hover{background:${isDark?'rgba(59,130,246,0.08)':'#eff6ff'};}
  .npo-bottombar{position:fixed;bottom:0;left:220px;right:0;z-index:20;background:${isDark?'rgba(8,13,26,.97)':'rgba(255,255,255,.97)'};backdrop-filter:blur(14px);border-top:1.5px solid ${border};padding:14px 32px;display:flex;align-items:center;justify-content:space-between;box-shadow:${isDark?'0 -8px 32px rgba(0,0,0,.4)':'0 -8px 32px rgba(0,0,0,.06)'};}
  .react-datepicker{font-family:'DM Sans',sans-serif!important;border:1.5px solid ${border}!important;border-radius:14px!important;box-shadow:${isDark?'0 20px 40px rgba(0,0,0,.5)':'0 20px 40px rgba(0,0,0,.12)'}!important;background:${surface}!important;}
  .react-datepicker__header{background:${surface2}!important;border-bottom:1.5px solid ${border}!important;border-radius:14px 14px 0 0!important;padding-top:14px!important;}
  .react-datepicker__current-month{font-size:14px!important;font-weight:700!important;color:${text}!important;font-family:'Sora',sans-serif!important;}
  .react-datepicker__day-name{color:${textMuted}!important;font-weight:600!important;font-size:11px!important;}
  .react-datepicker__day{width:2.2rem!important;height:2.2rem!important;line-height:2.2rem!important;border-radius:8px!important;font-size:13px!important;transition:all .12s!important;color:${text}!important;}
  .react-datepicker__day:hover{background:${isDark?'rgba(59,130,246,0.2)':'#eff6ff'}!important;color:#3b82f6!important;}
  .react-datepicker__day--selected{background:#3b82f6!important;color:#fff!important;font-weight:700!important;box-shadow:0 2px 8px rgba(59,130,246,.3)!important;}
  .react-datepicker__day--today{background:${isDark?'rgba(59,130,246,0.15)':'#dbeafe'}!important;color:#2563eb!important;font-weight:700!important;}
  .react-datepicker__day--outside-month{color:${textMuted}!important;}
  `;
};

/* ─── Constants ───────────────────────────────────────────────────── */
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
// normalise origin: handle both stored keys ('free_zone') and legacy display labels ('Free Zone')
const normaliseOrigin = (origin) => {
  if (!origin) return 'mainland';
  const o = origin.toLowerCase().replace(/\s+/g, '_');
  if (o === 'free_zone' || o === 'freezone') return 'free_zone';
  if (o === 'overseas')                      return 'overseas';
  return 'mainland';
};
const getVendorTaxRate = origin => {
  const o = normaliseOrigin(origin);
  return (o === 'free_zone' || o === 'overseas') ? 0.0 : 0.05;
};
const PAYMENT_TERMS_OPTS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90', 'End of Month', 'Cash on Delivery', 'Custom'];
const SHIP_PREFS = [
  { value: 'standard',  label: 'Standard'  },
  { value: 'express',   label: 'Express'   },
  { value: 'overnight', label: 'Overnight' },
];
const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'];

const calcLineBase = (qty, rate, discount, discountType) => {
  const base = qty * rate;
  if (discountType === 'percentage') return round2(base - base * (discount / 100));
  if (discountType === 'fixed')      return round2(Math.max(0, base - discount));
  return round2(base);
};

/* ─── Field wrapper ───────────────────────────────────────────────── */
const Field = ({ label, req, children }) => (
  <div>
    <label className="npo-lbl">{label}{req && <span className="npo-req">*</span>}</label>
    {children}
  </div>
);

/* ─── VendorSelect ────────────────────────────────────────────────── */
function VendorSelect({ value, onChange, vendors, loading, T, isDark }) {
  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const [query,   setQuery]   = useState('');
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);
  const searchRef  = useRef(null);

  const filtered = query
    ? vendors.filter(v =>
        (v.displayName  || '').toLowerCase().includes(query.toLowerCase()) ||
        (v.companyName  || '').toLowerCase().includes(query.toLowerCase()) ||
        (v.email        || '').toLowerCase().includes(query.toLowerCase())
      )
    : vendors;

  const getColor    = name  => AVATAR_COLORS[(name?.charCodeAt(0) || 65) % AVATAR_COLORS.length];
  const getInitials = v     => (v.displayName || v.companyName || '?').trim().split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(filtered.length * 58 + 60, 340);
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, 320) });
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
    const r = () => measurePos();
    window.addEventListener('scroll', r, true); window.addEventListener('resize', r);
    return () => { window.removeEventListener('scroll', r, true); window.removeEventListener('resize', r); };
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

  const select = v => { onChange(v); setOpen(false); setReady(false); setQuery(''); };

  const activeColor = isDark ? '#60a5fa' : '#2563eb';
  const activeBg    = isDark ? 'rgba(59,130,246,.15)' : '#eff6ff';
  const hoverBg     = isDark ? 'rgba(255,255,255,.05)' : '#f8fafc';

  const dropdown = (
    <div ref={dropRef} style={{
      position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width,
      zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14,
      fontFamily: "'DM Sans',sans-serif",
      boxShadow: isDark ? '0 20px 60px rgba(0,0,0,.6)' : '0 20px 60px rgba(0,0,0,.15)',
      overflow: 'hidden', visibility: ready ? 'visible' : 'hidden',
      opacity: ready ? 1 : 0, transition: 'opacity .12s ease',
    }}>
      <div style={{ padding: '10px 10px 6px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 36, border: `1.5px solid ${T.border}`, borderRadius: 9, background: T.surface2 }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T.textSec} strokeWidth={2.5} strokeLinecap="round">
            <circle cx={11} cy={11} r={8}/><line x1={21} y1={21} x2={16.65} y2={16.65}/>
          </svg>
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search vendors…" onClick={e => e.stopPropagation()}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: T.textPri, fontFamily: 'inherit' }} />
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
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: 6 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.textSec, fontSize: 12 }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${T.border}`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'npoSpin .7s linear infinite', margin: '0 auto 8px' }} />
            Loading vendors…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.textSec, fontSize: 12 }}>
            {query ? 'No vendors match your search' : 'No vendors found. Add vendors first.'}
          </div>
        ) : filtered.map(v => {
          const isAct = value?._id === v._id;
          const color = getColor(v.displayName || v.companyName);
          return (
            <div key={v._id} onClick={() => select(v)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, cursor: 'pointer', background: isAct ? activeBg : 'transparent', transition: 'background .1s' }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${color}22`, border: `1.5px solid ${color}44`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 800 }}>
                {getInitials(v)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: isAct ? 700 : 600, color: isAct ? activeColor : T.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.displayName || v.companyName || 'Unknown'}
                </div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(v.companyName && v.displayName !== v.companyName) ? v.companyName : (v.email || '')}
                </div>
              </div>
              {v.vendorType && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${color}18`, color, border: `1px solid ${color}33`, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {v.vendorType}
                </span>
              )}
              {isAct && (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth={2.5} strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const displayName = value?.displayName || value?.companyName || '';
  const triggerColor = displayName ? getColor(displayName) : T.textSec;

  return (
    <div ref={triggerRef} onClick={handleOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 42, border: `1.5px solid ${open ? (isDark ? 'rgba(59,130,246,.55)' : '#93c5fd') : T.border}`, borderRadius: 10, background: T.surface, cursor: 'pointer', boxShadow: open ? `0 0 0 3px ${isDark ? 'rgba(59,130,246,.1)' : 'rgba(147,197,253,.2)'}` : 'none', transition: 'border-color .15s,box-shadow .15s', userSelect: 'none', boxSizing: 'border-box' }}>
      {displayName ? (
        <div style={{ width: 24, height: 24, borderRadius: 7, background: `${triggerColor}22`, border: `1.5px solid ${triggerColor}44`, color: triggerColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: "'Sora',sans-serif", flexShrink: 0 }}>
          {getInitials(value)}
        </div>
      ) : (
        <FaBuilding size={13} style={{ color: T.textSec, flexShrink: 0 }} />
      )}
      <span style={{ flex: 1, fontSize: 13, color: displayName ? T.textPri : (isDark ? 'rgba(255,255,255,.25)' : '#cbd5e1'), fontWeight: displayName ? 500 : 400 }}>
        {displayName || 'Select vendor…'}
      </span>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={open ? (isDark ? '#60a5fa' : '#2563eb') : T.textSec} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
}

/* ─── CustomSelect ────────────────────────────────────────────────── */
function CustomSelect({ value, onChange, options, placeholder = 'Select', T, isDark }) {
  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(options.length * 40 + 12, 280);
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, [options.length]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => measurePos());
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => {
    if (!open) return;
    const r = () => measurePos();
    window.addEventListener('scroll', r, true); window.addEventListener('resize', r);
    return () => { window.removeEventListener('scroll', r, true); window.removeEventListener('resize', r); };
  }, [open, measurePos]);
  useEffect(() => {
    const h = e => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          dropRef.current    && !dropRef.current.contains(e.target)) {
        setOpen(false); setReady(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = opt => { onChange(opt.value ?? opt); setOpen(false); setReady(false); };
  const selected = options.find(o => (o.value ?? o) === value);
  const display  = selected ? (selected.label ?? selected) : null;

  const activeColor = isDark ? '#60a5fa' : '#2563eb';
  const activeBg    = isDark ? 'rgba(59,130,246,.15)' : '#eff6ff';
  const hoverBg     = isDark ? 'rgba(255,255,255,.05)' : '#f8fafc';

  const dropdown = (
    <div ref={dropRef} style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, fontFamily: "'DM Sans',sans-serif", boxShadow: isDark ? '0 16px 48px rgba(0,0,0,.5)' : '0 16px 48px rgba(0,0,0,.12)', overflow: 'hidden', visibility: ready ? 'visible' : 'hidden', opacity: ready ? 1 : 0, transition: 'opacity .12s ease' }}>
      <div style={{ maxHeight: 268, overflowY: 'auto', padding: 6 }}>
        {options.map((opt, i) => {
          const val = opt.value ?? opt; const lbl = opt.label ?? opt; const isAct = val === value;
          return (
            <div key={i} onClick={() => select(opt)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: isAct ? 600 : 400, color: isAct ? activeColor : T.textPri, background: isAct ? activeBg : 'transparent', transition: 'background .1s' }}
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
        })}
      </div>
    </div>
  );

  return (
    <div ref={triggerRef} onClick={handleOpen}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 42, padding: '0 14px', border: `1.5px solid ${open ? (isDark ? 'rgba(59,130,246,.55)' : '#93c5fd') : T.border}`, borderRadius: 10, background: T.surface, cursor: 'pointer', boxShadow: open ? `0 0 0 3px ${isDark ? 'rgba(59,130,246,.1)' : 'rgba(147,197,253,.2)'}` : 'none', transition: 'border-color .15s,box-shadow .15s', userSelect: 'none', boxSizing: 'border-box' }}>
      <span style={{ fontSize: 13, color: display ? T.textPri : (isDark ? 'rgba(255,255,255,.25)' : '#cbd5e1'), fontWeight: display ? 500 : 400 }}>
        {display || placeholder}
      </span>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={open ? (isDark ? '#60a5fa' : '#2563eb') : T.textSec} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
}

/* ─── DatePicker ──────────────────────────────────────────────────── */
function DatePicker({ value, onChange, placeholder = 'Select date' }) {
  const isDark = useThemeStore(s => s.isDark);
  const T = getTheme(isDark);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('calendar');
  const triggerRef = useRef(null);
  const portalRef  = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const presets = [
    { label: 'Today',      value: new Date() },
    { label: 'Tomorrow',   value: addDays(new Date(), 1) },
    { label: 'Next Week',  value: addDays(new Date(), 7) },
    { label: 'Next Month', value: addMonths(new Date(), 1) },
    { label: '3 Months',   value: addMonths(new Date(), 3) },
    { label: '6 Months',   value: addMonths(new Date(), 6) },
    { label: '1 Year',     value: addYears(new Date(), 1) },
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
    const h = e => {
      if (!triggerRef.current?.contains(e.target) && !portalRef.current?.contains(e.target)) setOpen(false);
    };
    const onScroll = e => { if (open && !portalRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  const pickerPanel = open ? createPortal(
    <div ref={portalRef} style={{
      position: 'fixed', zIndex: 9998, top: pos.top + 6, left: pos.left,
      background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}`,
      boxShadow: '0 24px 60px rgba(0,0,0,.18)', width: Math.max(pos.width, 340),
      overflow: 'hidden', fontFamily: "'DM Sans',sans-serif",
    }}>
      <div style={{ display: 'flex', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
        {[['calendar','Calendar'],['presets','Quick']].map(([v,l]) => (
          <button key={v} onClick={() => setMode(v)} style={{
            flex: 1, padding: '12px 8px', fontSize: 12, fontWeight: 700,
            border: 'none', cursor: 'pointer', background: 'transparent',
            color: mode === v ? '#2563eb' : '#94a3b8',
            borderBottom: mode === v ? '2px solid #3b82f6' : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .15s',
          }}>
            {v === 'calendar'
              ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x={3} y={4} width={18} height={18} rx={3}/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              : <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            }
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 14px 10px' }}>
        {mode === 'calendar' ? (
          <RDatePicker
            selected={sel}
            onChange={d => { onChange(d.toLocaleDateString('en-CA')); setOpen(false); setMode('calendar'); }}
            inline
            renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled}
                  style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface, cursor: 'pointer', color: T.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = T.border; }}>
                  <FaChevronLeft style={{ fontSize: 10 }}/>
                </button>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: T.textPri }}>
                  {format(date, 'MMMM yyyy')}
                </span>
                <button onClick={increaseMonth} disabled={nextMonthButtonDisabled}
                  style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface, cursor: 'pointer', color: T.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = T.border; }}>
                  <FaChevronRight style={{ fontSize: 10 }}/>
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
                  style={{ padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', transition: 'all .15s',
                    border: `1.5px solid ${active ? '#3b82f6' : T.border}`,
                    background: active ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface,
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = isDark ? 'rgba(59,130,246,0.08)' : '#f8fafc'; e.currentTarget.style.borderColor = '#bfdbfe'; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = T.surface; e.currentTarget.style.borderColor = T.border; } }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#2563eb' : T.textPri }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: T.textSec, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>{format(p.value, 'MMM dd, yyyy')}</div>
                </button>
              );
            })}
          </div>
        )}

        {sel && (
          <div style={{ marginTop: 10, padding: '9px 12px', background: isDark ? 'rgba(16,185,129,0.1)' : 'linear-gradient(135deg,#f0fdf4,#eff6ff)', borderRadius: 10, border: `1.5px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#bbf7d0'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Selected Date</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginTop: 1 }}>{format(sel, 'EEE, MMM dd, yyyy')}</div>
            </div>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaCheck style={{ fontSize: 10 }}/>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div>
      <button type="button" ref={triggerRef} onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        border: `1.5px solid ${open ? '#3b82f6' : sel ? '#3b82f6' : T.border}`,
        borderRadius: 10, background: sel ? (isDark ? 'rgba(59,130,246,0.08)' : '#eff6ff') : T.surface,
        cursor: 'pointer', fontSize: 13, transition: 'all .15s',
        boxShadow: open ? '0 0 0 3px rgba(59,130,246,.12)' : 'none',
      }}>
        <span style={{ color: sel ? T.textPri : (isDark ? 'rgba(255,255,255,.25)' : '#94a3b8'), fontWeight: sel ? 600 : 400 }}>
          {sel ? format(sel, 'MMM dd, yyyy') : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sel && (
            <span onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); }}
              style={{ width: 18, height: 18, borderRadius: 5, background: T.surface2, color: T.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: 'pointer', transition: 'all .12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.surface2; e.currentTarget.style.color = T.textSec; }}>✕</span>
          )}
          <div style={{ width: 28, height: 28, borderRadius: 8, background: open || sel ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface2, border: `1.5px solid ${open || sel ? '#bfdbfe' : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={open || sel ? '#3b82f6' : T.textSec} strokeWidth={2} strokeLinecap="round"><rect x={3} y={4} width={18} height={18} rx={3}/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
        </div>
      </button>
      {pickerPanel}
    </div>
  );
}

/* ════════════════════ MAIN ══════════════════════════════════════════ */
export default function Newpurchaseorders() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const isDark   = useThemeStore(s => s.isDark);
  const T        = getTheme(isDark);

  /* ── Item state ── */
  const [items, setItems] = useState([{
    id: 1, itemId: '', details: '', sku: '', quantity: 1,
    rate: '', discount: '', discountType: 'percentage', amount: '', unit: '',
  }]);
  const [showItemDropdown, setShowItemDropdown] = useState(null);
  const [searchTerm,       setSearchTerm]       = useState('');
  const [filteredItems,    setFilteredItems]     = useState([]);
  const itemInputRefs = useRef([]);

  /* ── Form state ── */
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendors,        setVendors]        = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [poType,         setPoType]         = useState('goods');
  const [orderDate,      setOrderDate]      = useState(new Date().toLocaleDateString('en-CA'));
  const [expectedDate,   setExpectedDate]   = useState('');
  const [paymentTerms,   setPaymentTerms]   = useState('Due on Receipt');
  const [deliveryAddr,   setDeliveryAddr]   = useState('organization');
  const [shipPref,       setShipPref]       = useState('');
  const [referenceNo,    setReferenceNo]    = useState('');
  const [customerNotes,  setCustomerNotes]  = useState('');
  const [terms,          setTerms]          = useState('');
  const [shipping,       setShipping]       = useState('0');
  const [adjustment,     setAdjustment]     = useState('0');
  const [saving,         setSaving]         = useState(false);

  /* ── Inventory ── */
  const { handleGetItem, data: inventoryData, loading: inventoryLoading } = useGetItem();
  useEffect(() => { handleGetItem(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Vendors ── */
  useEffect(() => {
    const fetch = async () => {
      setVendorsLoading(true);
      try {
        const res = await axiosInstance.get('/api/vendors/?limit=200');
        setVendors(res.data?.data?.vendors || []);
      } catch { /* silent */ } finally { setVendorsLoading(false); }
    };
    fetch();
  }, []);

  /* ── Load PO for editing ── */
  const [loadedVendorId, setLoadedVendorId] = useState('');
  useEffect(() => {
    if (!editId) return;
    axiosInstance.get(`/api/purchase-orders/${editId}`).then(r => {
      const po = r.data?.data || r.data;
      if (!po) return;
      setPoType(po.poType || 'goods');
      if (po.orderDate) setOrderDate(new Date(po.orderDate).toLocaleDateString('en-CA'));
      setExpectedDate(po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-CA') : '');
      setPaymentTerms(po.paymentTerms || 'Due on Receipt');
      setDeliveryAddr(po.deliveryAddress || 'organization');
      setShipPref(po.shipmentPreference || '');
      setReferenceNo(po.referenceNo || '');
      setCustomerNotes(po.customerNotes || '');
      setTerms(po.termsAndConditions || '');
      setShipping(String(po.shippingCharges ?? 0));
      setAdjustment(String(po.adjustment ?? 0));
      if (po.items?.length) setItems(po.items.map((it, i) => ({
        id: i + 1, itemId: it.itemId || '', details: it.details || '', sku: '', quantity: it.quantity || 1,
        rate: it.rate ?? '', discount: it.discount ?? '', discountType: it.discountType || 'percentage',
        amount: String(it.amount ?? ''), unit: it.unit || '',
        freight: it.freight ?? '', freightTaxRate: it.freightTaxRate ?? '',
      })));
      setLoadedVendorId(po.vendorId || '');
    }).catch(() => nexusToast.error('Failed to load purchase order'));
  }, [editId]);
  // Resolve the vendor object once both the PO and the vendor list are loaded.
  useEffect(() => {
    if (!loadedVendorId || !vendors.length) return;
    const v = vendors.find(x => (x._id || x.id) === loadedVendorId);
    if (v) setSelectedVendor(v);
  }, [loadedVendorId, vendors]);

  /* ── Filter items ── */
  useEffect(() => {
    if (!inventoryData) return;
    setFilteredItems(
      !searchTerm
        ? inventoryData.slice(0, 10)
        : inventoryData.filter(i =>
            i.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
          ).slice(0, 10)
    );
  }, [searchTerm, inventoryData]);

  /* ── Close item dropdown on outside click ── */
  useEffect(() => {
    const h = e => {
      if (showItemDropdown !== null) {
        const onInput    = itemInputRefs.current[showItemDropdown]?.contains(e.target);
        const onDropdown = document.querySelector('.item-dropdown-po')?.contains(e.target);
        if (!onInput && !onDropdown) setShowItemDropdown(null);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showItemDropdown]);

  const debouncedSearch = useCallback(debounce(t => setSearchTerm(t), 300), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Computed totals ── */
  const effectiveTaxRate = getVendorTaxRate(selectedVendor?.origin);
  const vatPct     = Math.round(effectiveTaxRate * 100);

  // Goods use vendor-origin VAT. Each item may carry OPTIONAL freight, taxed at its OWN
  // rate (UAE: local transport 5%, international 0%) — independent of vendor origin.
  const computedItems = items.map(item => {
    const qty  = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate)     || 0;
    const disc = parseFloat(item.discount) || 0;
    const base = calcLineBase(qty, rate, disc, item.discountType);
    const tax  = round2(base * effectiveTaxRate);
    const freight    = parseFloat(item.freight) || 0;
    const frtPct     = parseFloat(item.freightTaxRate) || 0;
    const freightTax = round2(freight * frtPct / 100);
    return { ...item, base, tax, freight, frtPct, freightTax, amount: round2(base + tax + freight + freightTax) };
  });

  // Tax breakdown grouped by tax % (goods at origin rate + freight at its own rate)
  const taxGroups = (() => {
    const m = {}, order = [];
    const add = (pct, b) => {
      if (!b) return;
      if (!(pct in m)) { m[pct] = { taxRate: pct, baseAmount: 0 }; order.push(pct); }
      m[pct].baseAmount = round2(m[pct].baseAmount + b);
    };
    computedItems.forEach(i => { add(vatPct, i.base); if (i.freight > 0) add(i.frtPct, i.freight); });
    return order.map(k => ({ taxRate: Number(k), baseAmount: m[k].baseAmount, taxAmount: round2(m[k].baseAmount * Number(k) / 100) }));
  })();
  const subTotal   = round2(computedItems.reduce((s, i) => s + i.base + i.freight, 0));
  const totalTax   = round2(computedItems.reduce((s, i) => s + i.tax + i.freightTax, 0));
  const shipAmt    = round2(parseFloat(shipping)   || 0);
  const adjAmt     = round2(parseFloat(adjustment) || 0);
  const grandTotal = round2(subTotal + totalTax + shipAmt + adjAmt);
  const hasItemsAdded = items.some(i => i.details && i.quantity > 0);
  const fmtAED = n => `AED ${(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`;

  /* ── Item handlers ── */
  const addNewRow = () => {
    const id = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems([...items, { id, itemId: '', details: '', sku: '', quantity: 1, rate: '', discount: '', discountType: 'percentage', amount: '', unit: '' }]);
  };

  const handleRemoveItem = idx => {
    if (items.length <= 1) {
      const u = [...items];
      u[idx] = { id: u[idx].id, itemId: '', details: '', sku: '', quantity: 1, rate: '', discount: '', discountType: 'percentage', amount: '', unit: '' };
      setItems(u); return;
    }
    setItems(items.filter((_, i) => i !== idx));
    if (showItemDropdown === idx) setShowItemDropdown(null);
  };

  const handleItemSelect = (idx, sel) => {
    const u    = [...items];
    const rate = parseFloat(sel.selling_price || sel.price || 0);
    const qty  = parseFloat(u[idx].quantity) || 1;
    const disc = parseFloat(u[idx].discount) || 0;
    const base = calcLineBase(qty, rate, disc, u[idx].discountType);
    u[idx] = { ...u[idx], itemId: sel._id, details: sel.name || 'No name', sku: sel.sku || sel.item_code || '', rate, unit: sel.unit || sel.Unit || 'pcs', quantity: qty, amount: String(round2(base + base * effectiveTaxRate)) };
    setItems(u); setShowItemDropdown(null); setSearchTerm('');
  };

  const handleQuantityChange = (idx, val) => {
    const u = [...items], qty = parseFloat(val) || 1;
    u[idx].quantity = qty;
    if (u[idx].rate) { const base = calcLineBase(qty, parseFloat(u[idx].rate), parseFloat(u[idx].discount)||0, u[idx].discountType); u[idx].amount = String(round2(base + base * effectiveTaxRate)); }
    setItems(u);
  };

  const handleRateChange = (idx, val) => {
    const u = [...items], rate = parseFloat(val) || 0;
    u[idx].rate = val;
    if (u[idx].quantity) { const base = calcLineBase(parseFloat(u[idx].quantity)||0, rate, parseFloat(u[idx].discount)||0, u[idx].discountType); u[idx].amount = String(round2(base + base * effectiveTaxRate)); }
    setItems(u);
  };

  const handleDiscountChange = (idx, val) => {
    const u = [...items]; u[idx].discount = val;
    if (u[idx].quantity && u[idx].rate) { const base = calcLineBase(parseFloat(u[idx].quantity)||0, parseFloat(u[idx].rate)||0, parseFloat(val)||0, u[idx].discountType); u[idx].amount = String(round2(base + base * effectiveTaxRate)); }
    setItems(u);
  };

  const handleDiscountTypeChange = (idx, type) => {
    const u = [...items]; u[idx].discountType = type;
    if (u[idx].quantity && u[idx].rate && u[idx].discount) { const base = calcLineBase(parseFloat(u[idx].quantity)||0, parseFloat(u[idx].rate)||0, parseFloat(u[idx].discount)||0, type); u[idx].amount = String(round2(base + base * effectiveTaxRate)); }
    setItems(u);
  };

  /* ── Submit ── */
  const handleSubmit = async (status = 'draft') => {
    if (!selectedVendor) { nexusToast.error('Vendor is required'); return; }
    if (!hasItemsAdded)  { nexusToast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const payload = {
        vendorId:   selectedVendor._id,
        vendorName: selectedVendor.displayName || selectedVendor.companyName || '',
        orderDate: new Date(orderDate).toISOString(),
        expectedDeliveryDate: expectedDate ? new Date(expectedDate).toISOString() : null,
        poType, paymentTerms, deliveryAddress: deliveryAddr, shipmentPreference: shipPref, referenceNo,
        items: computedItems.filter(i => i.details && i.quantity > 0).map(i => ({
          itemId: i.itemId, details: i.details, quantity: parseFloat(i.quantity),
          rate: parseFloat(i.rate)||0, discount: parseFloat(i.discount)||0, discountType: i.discountType, unit: i.unit,
          freight: parseFloat(i.freight)||0, freightTaxRate: (parseFloat(i.freight)||0) > 0 ? (parseFloat(i.freightTaxRate)||0) : 0,
        })),
        shippingCharges: shipAmt, adjustment: adjAmt, customerNotes, termsAndConditions: terms, status,
      };
      if (isEdit) {
        const res = await axiosInstance.put(`/api/purchase-orders/${editId}`, payload);
        nexusToast.success(res.data?.data?.status === 'pending_approval'
          ? 'Edit submitted for approval' : 'Purchase order updated');
      } else {
        await axiosInstance.post('/api/purchase-orders/', payload);
        nexusToast.success('Purchase order created successfully!');
      }
      setTimeout(() => navigate('/Purchase/Purchaseorders'), 1500);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} purchase order`);
    } finally { setSaving(false); }
  };

  /* ── Item dropdown portal ── */
  const [itemDropPos, setItemDropPos] = useState({ top: 0, left: 0, width: 0 });
  useEffect(() => {
    if (showItemDropdown === null) return;
    const el = itemInputRefs.current[showItemDropdown];
    if (!el) return;
    const r = el.getBoundingClientRect();
    setItemDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 480) });
  }, [showItemDropdown]);

  /* ─────────────────────────── RENDER ──────────────────────────── */
  return (
    <div className="npo-root" style={{ minHeight: '100vh', background: T.bg, padding: '20px 20px 90px' }}>
      {/* useMemo: only re-generate the style block when theme changes, not every keystroke */}
      <style>{useMemo(() => buildCSS(isDark), [isDark])}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Top bar ── */}
        <div style={{ position: 'sticky', top: 0, zIndex: 30, background: isDark ? 'rgba(8,13,26,.95)' : 'rgba(241,245,249,.95)', backdropFilter: 'blur(12px)', padding: '12px 0', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => navigate('/Purchase/Purchaseorders')} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <FaChevronLeft size={13} />
              </button>
              <div style={{ width: 1, height: 24, background: T.border }} />
              <div>
                <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-.02em' }}>{isEdit ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
                <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>Purchase → Purchase Orders</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isEdit && <span style={{ padding: '5px 12px', borderRadius: 99, background: '#fef9c3', border: '1.5px solid #fef08a', fontSize: 11, fontWeight: 700, color: '#854d0e', letterSpacing: '.04em' }}>● DRAFT</span>}
              <button onClick={() => navigate('/Purchase/Purchaseorders')} className="npo-bg">Cancel</button>
              {!isEdit && <button onClick={() => handleSubmit('draft')} className="npo-bg" disabled={saving || !hasItemsAdded} style={{ fontWeight: 700 }}>{saving ? 'Saving…' : 'Save Draft'}</button>}
              <button onClick={() => handleSubmit('open')} className="npo-bp" disabled={saving || !selectedVendor || !hasItemsAdded}>
                {saving
                  ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'npoSpin .7s linear infinite' }} />Processing…</>
                  : <><FaCheckCircle size={12} />{isEdit ? 'Save Changes' : 'Save & Submit'}</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Order Info ── */}
        <div className="npo-section npo-card">
          <div className="npo-sbar" style={{ background: 'linear-gradient(90deg,#3b82f6,transparent 80%)' }} />
          <div className="npo-sin">
            <div className="npo-stitle">
              <div className="npo-sicon" style={{ background: '#3b82f618', color: '#3b82f6' }}><FaFileInvoiceDollar /></div>
              Order Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <Field label="Vendor" req>
                  <VendorSelect value={selectedVendor} onChange={v => {
                    setSelectedVendor(v);
                    if (v?.paymentTerms) setPaymentTerms(v.paymentTerms);
                  }} vendors={vendors} loading={vendorsLoading} T={T} isDark={isDark} />
                </Field>
                {selectedVendor && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const origin = normaliseOrigin(selectedVendor.origin);
                      const isZero = origin === 'free_zone' || origin === 'overseas';
                      const label = origin === 'free_zone' ? 'Free Zone' : origin === 'overseas' ? 'Overseas' : 'Mainland';
                      const color = isZero ? '#10b981' : '#f59e0b';
                      const bg    = isZero ? (isDark ? 'rgba(16,185,129,.12)' : '#f0fdf4') : (isDark ? 'rgba(245,158,11,.12)' : '#fffbeb');
                      const border= isZero ? (isDark ? 'rgba(16,185,129,.3)' : '#a7f3d0') : (isDark ? 'rgba(245,158,11,.3)' : '#fde68a');
                      return (
                        <>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: bg, border: `1.5px solid ${border}`, color }}>
                            {label}
                          </span>
                          <span style={{ fontSize: 11, color: T.textSec }}>
                            VAT: <strong style={{ color }}>{isZero ? '0%' : '5%'}</strong>
                            {isZero && <span style={{ marginLeft: 4, color: T.textSec }}>({origin === 'overseas' ? 'Reverse charge' : 'Designated zone — exempt'})</span>}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <Field label="Supplier Reference">
                <input className="npo-inp" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="Supplier quotation reference" style={{ fontFamily: "'DM Mono',monospace" }} />
              </Field>
              <Field label="PO Type">
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: 'goods', label: 'Goods', hint: 'Requires GRN' }, { v: 'service', label: 'Service', hint: 'Bill directly' }].map(({ v, label, hint }) => (
                    <button key={v} type="button" onClick={() => setPoType(v)}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1.5px solid ${poType === v ? '#3b82f6' : T.border}`, background: poType === v ? (isDark ? 'rgba(59,130,246,.15)' : '#eff6ff') : T.surface2, color: poType === v ? '#3b82f6' : T.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                      {label}
                      <span style={{ display: 'block', fontSize: 10, fontWeight: 500, opacity: 0.7, marginTop: 1 }}>{hint}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Order Date" req>
                <DatePicker value={orderDate} onChange={setOrderDate} placeholder="Select order date" />
              </Field>
              <Field label="Expected Delivery">
                <DatePicker value={expectedDate} onChange={setExpectedDate} placeholder="Select expected date" />
              </Field>
              <Field label="Payment Terms">
                <CustomSelect value={paymentTerms} onChange={setPaymentTerms} options={PAYMENT_TERMS_OPTS} placeholder="Select terms" T={T} isDark={isDark} />
              </Field>
              <Field label="Shipment Preference">
                <CustomSelect value={shipPref} onChange={setShipPref} options={SHIP_PREFS} placeholder="Choose preference" T={T} isDark={isDark} />
              </Field>
              <div style={{ gridColumn: '1/-1' }}>
                <Field label="Delivery Address">
                  <div style={{ display: 'flex', gap: 20 }}>
                    {['organization', 'customer'].map(opt => (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: T.textPri }}>
                        <input type="radio" value={opt} checked={deliveryAddr === opt} onChange={e => setDeliveryAddr(e.target.value)} style={{ accentColor: '#3b82f6' }} />
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* ── Line Items ── */}
        <div className="npo-section npo-card">
          <div className="npo-sbar" style={{ background: 'linear-gradient(90deg,#10b981,transparent 80%)' }} />
          <div className="npo-sin">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div className="npo-stitle" style={{ margin: 0 }}>
                <div className="npo-sicon" style={{ background: '#10b98118', color: '#10b981' }}><FaBox /></div>
                Line Items
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#d1fae5', padding: '2px 9px', borderRadius: 99, marginLeft: 4 }}>{items.filter(i => i.details).length} added</span>
              </div>
              <button onClick={addNewRow} className="npo-addrow"><FaPlus style={{ fontSize: 11 }} /> Add Item Row</button>
            </div>

            <div style={{ borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${T.border}` }}>
              <table className="npo-table">
                <thead><tr>
                  <th style={{ width: '35%' }}>Item Details</th>
                  <th>Quantity</th>
                  <th>Rate (AED)</th>
                  <th>Discount</th>
                  <th style={{ textAlign: 'right' }}>Amount (excl. VAT)</th>
                  <th style={{ width: 40 }}></th>
                </tr></thead>
                <tbody>
                  {items.map((item, index) => {
                    const comp = computedItems[index];
                    const setF = (field, val) => { const u = [...items]; u[index][field] = val; setItems(u); };
                    const showFreight = item.showFreight || item.freight;
                    return (
                      <Fragment key={item.id}>
                      <tr>
                        {/* Item details cell — SKU row always rendered to keep row height stable */}
                        <td>
                          <div ref={el => itemInputRefs.current[index] = el}>
                            <input className="npo-tinp" placeholder="Search or type item name…" value={item.details}
                              onChange={e => {
                                const u = [...items]; u[index].details = e.target.value; setItems(u);
                                debouncedSearch(e.target.value); setShowItemDropdown(index);
                              }}
                              onFocus={() => { setShowItemDropdown(index); if (!item.details) setSearchTerm(''); }}
                            />
                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: T.textSec, height: 14 }}>
                              {item.sku && <><FaBarcode style={{ fontSize: 9, flexShrink: 0 }} /><span style={{ fontFamily: "'DM Mono',monospace" }}>{item.sku}</span>{item.unit && <span>· {item.unit}</span>}</>}
                              {!showFreight && (
                                <button type="button" onClick={() => { setF('showFreight', true); if (item.freightTaxRate == null) setF('freightTaxRate', 5); }}
                                  style={{ marginLeft: item.sku ? 8 : 0, background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: 0 }}>
                                  + freight
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Quantity — wrapped to vertically center within taller cell */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 52 }}>
                            <div className="npo-qty">
                              <button className="npo-qbtn" onClick={() => handleQuantityChange(index, Math.max(1, (parseFloat(item.quantity)||1) - 1))}>−</button>
                              <input type="number" className="npo-qnum" value={item.quantity} onChange={e => handleQuantityChange(index, e.target.value)} min="1" />
                              <button className="npo-qbtn" onClick={() => handleQuantityChange(index, (parseFloat(item.quantity)||1) + 1)}>+</button>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 52 }}>
                            <input type="text" value={item.rate} onChange={e => handleRateChange(index, e.target.value)} className="npo-tinp" placeholder="0.00" style={{ fontFamily: "'DM Mono',monospace", width: 110 }} />
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 52 }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <button type="button" className="npo-dtype"
                                onClick={() => handleDiscountTypeChange(index, item.discountType === 'percentage' ? 'fixed' : 'percentage')}
                                style={{ minWidth: 52, fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700 }}>
                                {item.discountType === 'percentage' ? <><FaPercent style={{ fontSize: 9 }} />&nbsp;<span>%</span></> : <><span style={{ fontSize: 10 }}>AED</span></>}
                              </button>
                              <input type="number" value={item.discount} onChange={e => handleDiscountChange(index, e.target.value)} className="npo-dinp"
                                placeholder={item.discountType === 'percentage' ? '0' : '0.00'} min="0" style={{ width: 72 }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', height: 52 }}>
                            <div className="npo-amt">{fmtAED(comp?.base || 0)}</div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 52 }}>
                            <button onClick={() => handleRemoveItem(index)}
                              style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, transition: 'all .12s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}>
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {showFreight && (
                        <tr style={{ background: isDark ? 'rgba(245,158,11,.05)' : '#fffdf7' }}>
                          <td colSpan={6} style={{ padding: '8px 12px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>🚚 Freight for this item</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>AED</span>
                              <input type="number" value={item.freight || ''} onChange={e => setF('freight', e.target.value)} className="npo-dinp" placeholder="0.00" min="0" style={{ width: 90, textAlign: 'right' }} />
                              <input type="number" value={item.freightTaxRate ?? 5} onChange={e => setF('freightTaxRate', e.target.value)} className="npo-dinp" min="0" max="100" style={{ width: 56, textAlign: 'right' }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec }}>% tax</span>
                              {comp?.freightTax > 0 && <span style={{ fontSize: 11, color: T.textSec }}>= tax {fmtAED(comp.freightTax)}</span>}
                              <button type="button" onClick={() => { setF('freight', ''); setF('showFreight', false); }}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11, fontWeight: 600 }}>remove freight</button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                  {!hasItemsAdded && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: T.textSec }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📦</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No items added yet</div>
                        <div style={{ fontSize: 11 }}>Click "Add Item Row" to start</div>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Item Dropdown Portal */}
            {showItemDropdown !== null && createPortal(
              <div className="item-dropdown-po npo-idd"
                style={{ position: 'absolute', top: itemDropPos.top, left: itemDropPos.left, width: itemDropPos.width, zIndex: 9999 }}>
                {inventoryLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: T.textSec, fontSize: 13 }}>
                    <div style={{ width: 16, height: 16, border: `2px solid ${T.border}`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'npoSpin .7s linear infinite', margin: '0 auto 8px' }} />Loading items…
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: T.textSec, fontSize: 13 }}>
                    {searchTerm ? 'No items match your search' : 'Start typing to search items'}
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textSec, borderBottom: `1.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}</span><span>Click to select</span>
                    </div>
                    {filteredItems.map(inv => (
                      <div key={inv._id} className="npo-irow" onClick={() => handleItemSelect(showItemDropdown, inv)}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(59,130,246,0.15)' : 'linear-gradient(135deg,#eff6ff,#dbeafe)', color: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                          <FaBox />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name || 'No name'}</span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: '2px 7px', background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: T.blue, borderRadius: 5, flexShrink: 0 }}>{inv.item_code || inv.sku || 'N/A'}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 8 }}>
                            {[
                              { icon: <FaMoneyBill style={{ color: '#10b981' }} />, label: 'Price', val: `AED ${inv.selling_price || 0}`, mono: true },
                              { icon: <FaWarehouse style={{ color: '#f59e0b' }} />, label: 'Stock', val: `${inv.quantity || 0} units`, color: (inv.quantity||0)>10?'#10b981':(inv.quantity||0)>0?'#f59e0b':'#ef4444' },
                              { icon: <FaTag style={{ color: '#8b5cf6' }} />, label: 'Unit', val: inv.unit || inv.Unit || 'pcs' },
                            ].map(m => (
                              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ fontSize: 11 }}>{m.icon}</div>
                                <div>
                                  <div style={{ fontSize: 9, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>{m.label}</div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: m.color || T.textPri, fontFamily: m.mono ? "'DM Mono',monospace" : undefined }}>{m.val}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>,
              document.body
            )}
          </div>
        </div>

        {/* ── Summary + Notes ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Tax Breakdown */}
          <div className="npo-section npo-card" style={{ marginBottom: 0 }}>
            <div className="npo-sbar" style={{ background: 'linear-gradient(90deg,#f59e0b,transparent 80%)' }} />
            <div className="npo-sin">
              <div className="npo-stitle"><div className="npo-sicon" style={{ background: '#f59e0b18', color: '#f59e0b' }}><FaMoneyBillWave /></div>Tax Breakdown</div>
              <div className="npo-srow"><span style={{ fontSize: 13, color: T.textSec, fontWeight: 500 }}>Sub Total</span><span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: T.textPri }}>{fmtAED(subTotal)}</span></div>
              {taxGroups.length > 0 && (
                <div style={{ margin: '10px 0', padding: '10px 12px', background: isDark ? 'rgba(245,158,11,.06)' : '#fffbeb', borderRadius: 10, border: `1.5px solid ${isDark ? 'rgba(245,158,11,.2)' : '#fde68a'}` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#f59e0b', margin: '0 0 8px' }}>VAT — Grouped by Rate</p>
                  {taxGroups.map((g, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 7, marginBottom: i < taxGroups.length - 1 ? 4 : 0 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0 }}>VAT {g.taxRate}%{g.taxRate === 0 ? ' — Exempt / Zero-rated' : ''}</p>
                        <p style={{ fontSize: 10, color: T.textSec, margin: '2px 0 0', fontFamily: "'DM Mono',monospace" }}>{fmtAED(g.baseAmount)} × {g.taxRate}%</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', fontFamily: "'DM Mono',monospace" }}>{fmtAED(g.taxAmount)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: `1.5px solid ${isDark ? 'rgba(245,158,11,.25)' : '#fcd34d'}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>Total VAT</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', fontFamily: "'DM Mono',monospace" }}>{fmtAED(totalTax)}</span>
                  </div>
                </div>
              )}
              {taxGroups.length === 0 && <div style={{ padding: '12px 0', textAlign: 'center', color: T.textSec, fontSize: 12 }}>Add items to see tax breakdown</div>}
              <div className="npo-srow" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: T.textSec, fontWeight: 500 }}>Shipping</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>AED</span><input type="number" value={shipping} onChange={e => setShipping(e.target.value)} className="npo-tinp" placeholder="0.00" step="0.01" min="0" style={{ width: 88, textAlign: 'right', fontFamily: "'DM Mono',monospace" }} /></div>
              </div>
              <div className="npo-srow" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: T.textSec, fontWeight: 500 }}>Adjustment</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>AED</span><input type="number" value={adjustment} onChange={e => setAdjustment(e.target.value)} className="npo-tinp" placeholder="0.00" step="0.01" style={{ width: 88, textAlign: 'right', fontFamily: "'DM Mono',monospace" }} /></div>
              </div>
              <div style={{ borderTop: `1.5px solid ${T.border}`, marginTop: 12, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: T.textPri }}>Grand Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: T.blue, fontFamily: "'DM Mono',monospace" }}>{fmtAED(grandTotal)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, paddingTop: 16, borderTop: `1.5px solid ${T.border}` }}>
                {[
                  { label: 'Line Items', val: items.filter(i => i.details).length, color: T.blue, bg: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff' },
                  { label: 'Total Qty',  val: items.reduce((t, i) => t + (parseFloat(i.quantity)||0), 0), color: T.green, bg: isDark ? 'rgba(16,185,129,0.12)' : '#f0fdf4' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: s.bg, borderRadius: 12 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="npo-section npo-card" style={{ marginBottom: 0 }}>
            <div className="npo-sbar" style={{ background: 'linear-gradient(90deg,#8b5cf6,transparent 80%)' }} />
            <div className="npo-sin">
              <div className="npo-stitle"><div className="npo-sicon" style={{ background: '#8b5cf618', color: '#8b5cf6' }}>📝</div>Notes & Terms</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Customer Notes"><textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} className="npo-inp" placeholder="Notes visible to vendor…" style={{ resize: 'none', height: 96, lineHeight: 1.6 }} /></Field>
                <Field label="Terms & Conditions"><textarea value={terms} onChange={e => setTerms(e.target.value)} className="npo-inp" placeholder="Enter terms and conditions…" style={{ resize: 'none', height: 96, lineHeight: 1.6 }} /></Field>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="npo-bottombar">
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>
              {items.filter(i => i.details).length} item{items.filter(i => i.details).length !== 1 ? 's' : ''}&nbsp;·&nbsp;
              <span style={{ fontFamily: "'DM Mono',monospace", color: T.blue }}>{fmtAED(grandTotal)}</span>
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Fields marked with <span style={{ color: '#ef4444' }}>*</span> are required</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/Purchase/Purchaseorders')} className="npo-bg">Cancel</button>
            {!isEdit && <button onClick={() => handleSubmit('draft')} className="npo-bg" disabled={saving || !hasItemsAdded} style={{ fontWeight: 700 }}>{saving ? 'Saving…' : 'Save as Draft'}</button>}
            <button onClick={() => handleSubmit('open')} className="npo-bp" disabled={saving || !selectedVendor || !hasItemsAdded}>
              {saving
                ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'npoSpin .7s linear infinite' }} />Processing…</>
                : <><FaCheckCircle size={12} />{isEdit ? 'Save Changes' : 'Save & Submit'}</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
