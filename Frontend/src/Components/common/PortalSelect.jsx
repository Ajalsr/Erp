// ── PortalSelect — themed searchable dropdown with an optional "create new" shortcut ──
// Shared version of the dropdown pattern used across the item form, customer form, etc.
import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function PortalSelect({ T, isDark, name, value, onChange, options = [], placeholder = 'Select…', error, onCreateNew, createLabel }) {
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
    const dropH = Math.min(filtered.length * 42 + (searchable ? 52 : 10) + (onCreateNew ? 38 : 0), 320);
    const below = window.innerHeight - r.bottom;
    const top   = below > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, [filtered.length, searchable, onCreateNew]);

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
          zIndex: 100001, background: bg, border: `1.5px solid ${T.border}`, borderRadius: 12,
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
          {onCreateNew && (
            <div onClick={() => { onCreateNew(); setOpen(false); setReady(false); setQuery(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 11px',
                borderTop: `1px solid ${T.border}`, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#3b82f6',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {createLabel || 'Create new'}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
