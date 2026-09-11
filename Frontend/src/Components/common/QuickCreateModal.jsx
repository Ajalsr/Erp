// ── QuickCreateModal — small centered form for inline "create new" shortcuts ──
// Used by PortalSelect/CustomSelect-style dropdowns (item form's Category/Unit,
// customer form's Payment Terms, …) to spawn a related record without leaving
// the current form.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { IoMdClose } from 'react-icons/io';
import nexusToast from '../../helper/nexusToast';

export default function QuickCreateModal({ title, fields, T, onClose, onSubmit }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(f => [f.name, f.defaultValue ?? ''])));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const missing = fields.find(f => f.required && !String(form[f.name] ?? '').trim());
    if (missing) { nexusToast.error(`${missing.label} is required`); return; }
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: 340, maxWidth: '90vw', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: 22, zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
            <IoMdClose size={13} />
          </button>
        </div>
        {fields.map(f => (
          <div key={f.name} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
              {f.label}{f.required && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            <input type={f.type || 'text'} value={form[f.name]} onChange={e => setForm(p => ({ ...p, [f.name]: e.target.value }))}
              placeholder={f.placeholder} autoFocus={f.autoFocus}
              style={{ width: '100%', height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: f.mono ? "'DM Mono', monospace" : 'inherit', boxSizing: 'border-box' }} />
          </div>
        ))}
        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
          {saving ? 'Saving…' : 'Create'}
        </button>
      </div>
    </div>,
    document.body
  );
}
