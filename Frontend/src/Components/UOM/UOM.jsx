import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaRulerCombined } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { drawerWidth } from '../../helper/responsive';
import useIsMobile from '../../helper/useIsMobile';
import useConfirm from '../common/useConfirm';

export default function UOM() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const isMobile = useIsMobile();
  const { confirm, ConfirmModal } = useConfirm();

  const [units, setUnits]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editingUnit, setEditingUnit] = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [search, setSearch]       = useState('');

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/uoms/');
      setUnits(res.data?.data?.uoms || []);
    } catch {
      nexusToast.error('Failed to load units of measure');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const filtered = units.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.symbol?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!(await confirm({ title: 'Delete unit?', message: 'This will permanently remove the unit of measure. Items already using it keep their stored value.', confirmLabel: 'Delete', danger: true }))) return;
    setDeleting(id);
    try {
      await axiosInstance.delete(`/api/uoms/${id}`);
      nexusToast.success('Unit deleted');
      fetchUnits();
    } catch {
      nexusToast.error('Failed to delete unit');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
        * { box-sizing: border-box; }
        .uom-row:hover { background: ${isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'} !important; }
        .uom-btn:hover  { background: ${isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'} !important; }
      `}</style>

      <div style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: isMobile ? 19 : 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Units of Measure</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Manage the units used to quantify items (pcs, kg, box…)</p>
        </div>
        <button onClick={() => setEditingUnit({ _id: null, name: '', symbol: '', status: 'active' })}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', width: isMobile ? '100%' : 'auto', whiteSpace: 'nowrap', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
          <FaPlus size={11} /> New Unit
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 40, border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface, marginBottom: 14 }}>
        <FaRulerCombined size={12} color={T.textSec} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search units…"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T.textPri, fontFamily: 'inherit' }} />
        {search && <IoClose size={14} color={T.textSec} style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />}
      </div>

      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', padding: '9px 18px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
          {['Unit', 'Symbol', 'Status', ''].map((h, i) => (
            <span key={i} style={{ flex: i === 0 ? 1 : 0, minWidth: i === 1 ? 80 : undefined, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec }}>{h}</span>
          ))}
        </div>
        {loading
          ? <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
          : filtered.length === 0
            ? <div style={{ padding: 48, textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No units yet</p>
                <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>Create your first unit of measure (e.g. Piece, Kilogram).</p>
              </div>
            : filtered.map(u => (
                <div key={u._id} className="uom-row" onClick={() => setEditingUnit(u)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: T.surface }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{u.name}</p>
                  </div>
                  <span style={{ minWidth: 80, fontSize: 12, fontFamily: "'DM Mono', monospace", color: T.textSec }}>{u.symbol || '—'}</span>
                  <span style={{ minWidth: 0, fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'capitalize', background: u.status === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : (isDark ? 'rgba(100,116,139,0.15)' : '#f8fafc'), color: u.status === 'active' ? '#10b981' : T.textSec }}>
                    {u.status || 'active'}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button className="uom-btn" onClick={() => setEditingUnit(u)}
                      style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                      <FaEdit size={10} />
                    </button>
                    <button className="uom-btn" onClick={() => handleDelete(u._id)} disabled={deleting === u._id}
                      style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                      <FaTrash size={10} />
                    </button>
                  </div>
                </div>
              ))
        }
      </div>

      {editingUnit && (
        <EditUnitDrawer unit={editingUnit} T={T} isDark={isDark}
          onClose={() => setEditingUnit(null)}
          onSaved={() => { setEditingUnit(null); fetchUnits(); }}
          onDelete={editingUnit._id ? () => handleDelete(editingUnit._id) : null}
          deleting={deleting === editingUnit._id} />
      )}
      {ConfirmModal}
    </div>
  );
}

function EditUnitDrawer({ unit, T, isDark, onClose, onSaved, onDelete, deleting }) {
  const [form, setForm] = useState({ name: unit.name, symbol: unit.symbol || '', status: unit.status || 'active' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { nexusToast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (unit._id) {
        await axiosInstance.put(`/api/uoms/${unit._id}`, form);
      } else {
        await axiosInstance.post('/api/uoms/', form);
      }
      nexusToast.success(unit._id ? 'Unit updated' : 'Unit created');
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save unit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: drawerWidth(380), height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{unit._id ? 'Edit Unit' : 'New Unit'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
            Unit Name<span style={{ color: '#ef4444' }}> *</span>
          </label>
          <input name="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Kilogram"
            style={{ width: '100%', height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
            Symbol
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', color: T.textSec }}>shown next to the name, e.g. kg</span>
          </label>
          <input name="symbol" value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))}
            placeholder="e.g. kg"
            style={{ width: '100%', height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: "'DM Mono', monospace", boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 8 }}>Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['active','inactive'].map(s => (
              <div key={s} onClick={() => setForm(p => ({ ...p, status: s }))}
                style={{ flex: 1, padding: '9px', textAlign: 'center', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${form.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : T.border}`, background: form.status === s ? (s === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2')) : T.surface2 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: form.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : T.textSec, margin: 0, textTransform: 'capitalize' }}>{s}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: 12, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : unit._id ? 'Update Unit' : 'Create Unit'}
          </button>
          {onDelete && (
            <button onClick={onDelete} disabled={deleting}
              style={{ padding: '12px 16px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'inherit' }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
