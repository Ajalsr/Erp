// ── CountrySelect — custom portal dropdown for react-phone-number-input ──────
// Replaces the library's native <select> (which renders an OS dropdown that can
// run the full height of the screen) with a themed, fixed-height, scrollable,
// searchable popover anchored under the flag trigger.
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getCountryCallingCode } from 'react-phone-number-input';
import useThemeStore, { getTheme } from '../../store/useThemeStore';

const CountrySelect = ({ value, onChange, options, iconComponent }) => {
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
};

export default CountrySelect;
