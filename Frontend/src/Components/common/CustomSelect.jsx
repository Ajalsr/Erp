import { useState, useEffect, useRef } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';

// CustomSelect — themed dropdown replacing the native <select>. Options may be
// strings or { value, label } objects. Matches the look used across the app.
export default function CustomSelect({ value, onChange, options = [], placeholder = 'Select…', disabled = false, style = {} }) {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const selected = opts.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen(v => !v)}
        style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${open ? '#3b82f6' : T.border}`, borderRadius: 9, fontSize: 13, background: disabled ? T.surface2 : T.surface, color: selected ? T.textPri : T.textSec, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', boxShadow: open ? '0 0 0 3px rgba(59,130,246,.12)' : 'none', transition: 'border-color .15s, box-shadow .15s' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected?.label || placeholder}</span>
        <FaChevronDown size={10} style={{ flexShrink: 0, color: T.textSec, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1100, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,.5)' : '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
          {opts.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ width: '100%', padding: '9px 14px', fontSize: 13, background: o.value === value ? (isDark ? 'rgba(59,130,246,.15)' : '#eff6ff') : 'transparent', color: o.value === value ? '#3b82f6' : T.textPri, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontWeight: o.value === value ? 700 : 400, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
              {o.value === value && <span style={{ fontSize: 10, color: '#3b82f6', flexShrink: 0 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
