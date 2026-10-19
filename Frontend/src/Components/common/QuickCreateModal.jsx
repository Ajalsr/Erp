// ── QuickCreateModal — small centered form for inline "create new" shortcuts ──
// Used by PortalSelect/CustomSelect-style dropdowns (item form's Category/Unit,
// customer form's Payment Terms, …) to spawn a related record without leaving
// the current form.
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IoMdClose } from 'react-icons/io';

// Fields may pass `render({ value, onChange })` to supply their own control.
// Custom searchable dropdown for `type: 'select'` fields — replaces the native
// <select> so it matches the app's styling and can be filtered.
function MiniSelect({ value, onChange, options, placeholder, T, autoFocus }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const searchRef = useRef(null);
  const opts = (options || []).map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = opts.find(o => o.value === value);
  const filtered = query ? opts.filter(o => String(o.label).toLowerCase().includes(query.toLowerCase())) : opts;

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const inputStyle = { width: '100%', height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
  const hoverBg = 'rgba(59,130,246,.08)';

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)} tabIndex={0} autoFocus={autoFocus}
        style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: selected ? T.textPri : T.textSec }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? selected.label : (placeholder || 'Select…')}</span>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T.textSec} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9" /></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.18)', overflow: 'hidden' }}>
          <div style={{ padding: 6, borderBottom: `1px solid ${T.border}` }}>
            <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
              style={{ width: '100%', height: 32, padding: '0 10px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12.5, background: T.surface2, color: T.textPri, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: 5 }}>
            {filtered.length === 0
              ? <div style={{ padding: 12, textAlign: 'center', fontSize: 12.5, color: T.textSec }}>No matches</div>
              : filtered.map(o => {
                  const isAct = o.value === value;
                  return (
                    <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                      style={{ padding: '9px 11px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: isAct ? 600 : 400, color: isAct ? '#2563eb' : T.textPri, background: isAct ? hoverBg : 'transparent' }}
                      onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = T.surface2; }}
                      onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}>
                      {o.label}
                    </div>
                  );
                })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuickCreateModal({ title, fields, T, onClose, onSubmit, columns = 1 }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(f => [f.name, f.defaultValue ?? ''])));
  const [saving, setSaving] = useState(false);
  // Errors are shown inside the modal — a toast would render behind its overlay.
  const [error, setError] = useState('');
  const [errField, setErrField] = useState(null);

  const handleSave = async () => {
    const missing = fields.find(f => f.required && !String(form[f.name] ?? '').trim());
    if (missing) { setError(`${missing.label} is required`); setErrField(missing.name); return; }
    setError(''); setErrField(null);
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: columns === 2 ? 640 : 340, maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: 22, zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
            <IoMdClose size={13} />
          </button>
        </div>
        <div style={columns === 2 ? { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 } : undefined}>
        {fields.map(f => f.render ? (
          // Custom field (e.g. a date picker) — renders its own label and control.
          <div key={f.name} style={{ marginBottom: 14, gridColumn: f.full ? '1 / -1' : undefined }}>
            {f.render({ value: form[f.name], onChange: val => setForm(p => ({ ...p, [f.name]: val })) })}
          </div>
        ) : (
          <div key={f.name} style={{ marginBottom: 14, gridColumn: f.full ? '1 / -1' : undefined }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
              {f.label}{f.required && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            {f.type === 'select' ? (
              <MiniSelect value={form[f.name]} onChange={val => setForm(p => ({ ...p, [f.name]: val }))}
                options={f.options} placeholder={f.placeholder} T={T} autoFocus={f.autoFocus} />
            ) : (
              <input type={f.type || 'text'} value={form[f.name]} onChange={e => { setForm(p => ({ ...p, [f.name]: e.target.value })); if (errField === f.name) { setErrField(null); setError(''); } }}
                placeholder={f.placeholder} autoFocus={f.autoFocus}
                style={{ width: '100%', height: 40, padding: '0 12px', border: `1.5px solid ${errField === f.name ? '#ef4444' : T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: f.mono ? "'DM Mono', monospace" : 'inherit', boxSizing: 'border-box' }} />
            )}
          </div>
        ))}
        </div>
        {error && (
          <div role="alert" style={{ marginTop: 4, marginBottom: 10, padding: '9px 12px', borderRadius: 9, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', color: '#dc2626', fontSize: 12.5, fontWeight: 600 }}>{error}</div>
        )}
        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
          {saving ? 'Saving…' : 'Create'}
        </button>
      </div>
    </div>,
    document.body
  );
}
