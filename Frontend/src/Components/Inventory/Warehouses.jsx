import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaWarehouse, FaStar } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { drawerWidth } from '../../helper/responsive';

export default function Warehouses() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [drawer, setDrawer]         = useState(null);   // null | 'new' | warehouse obj
  const [deleting, setDeleting]     = useState(null);

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/warehouses/');
      setWarehouses(res.data?.data?.warehouses || []);
    } catch {
      nexusToast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axiosInstance.delete(`/api/warehouses/${id}`);
      nexusToast.success('Warehouse deleted');
      setDrawer(null);
      fetchWarehouses();
    } catch { nexusToast.error('Failed to delete'); }
    finally { setDeleting(null); }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
        * { box-sizing: border-box; }
        .wh-card:hover { transform: translateY(-2px); box-shadow: ${isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)'} !important; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Warehouses</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Manage your storage locations</p>
        </div>
        <button onClick={() => setDrawer('new')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
          <FaPlus size={11} /> New Warehouse
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total',   val: warehouses.length,                                    color: '#3b82f6' },
          { label: 'Active',  val: warehouses.filter(w => w.status === 'active').length,  color: '#10b981' },
          { label: 'Default', val: warehouses.find(w => w.isDefault)?.name || '—',       color: '#f59e0b', text: true },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 18px', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 6px' }}>{s.label}</p>
            <p style={{ fontFamily: s.text ? 'inherit' : "'DM Mono',monospace", fontSize: s.text ? 14 : 24, fontWeight: 700, color: s.color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.val}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
      ) : warehouses.length === 0 ? (
        <div style={{ padding: 64, textAlign: 'center', background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}` }}>
          <FaWarehouse size={28} color={T.border} style={{ display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No warehouses yet</p>
          <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>Add your first storage location to start tracking inventory by warehouse.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {warehouses.map(w => (
            <div key={w._id} className="wh-card" onClick={() => setDrawer(w)}
              style={{ background: T.surface, border: `1.5px solid ${w.isDefault ? '#f59e0b' : T.border}`, borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all .18s', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,.25)' : '0 2px 6px rgba(0,0,0,.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FaWarehouse size={16} color="#3b82f6" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {w.isDefault && <FaStar size={10} color="#f59e0b" />}
                      <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: 0 }}>{w.name}</p>
                    </div>
                    {w.code && <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: T.textSec, margin: '1px 0 0' }}>{w.code}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setDrawer({ ...w, _edit: true })}
                    style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                    <FaEdit size={10} />
                  </button>
                  <button onClick={() => handleDelete(w._id)} disabled={deleting === w._id}
                    style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                    <FaTrash size={10} />
                  </button>
                </div>
              </div>
              {w.location && <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>📍 {w.location}</p>}
              {w.manager  && <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>👤 {w.manager}</p>}
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'capitalize', background: w.status === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : T.surface2, color: w.status === 'active' ? '#10b981' : T.textSec }}>
                {w.status || 'active'}
              </span>
            </div>
          ))}
        </div>
      )}

      {drawer && (
        <WarehouseDrawer
          warehouse={drawer === 'new' ? null : drawer}
          T={T} isDark={isDark}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); fetchWarehouses(); }}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}

function WarehouseDrawer({ warehouse, T, isDark, onClose, onSaved, onDelete, deleting }) {
  const isEdit = !!(warehouse?._id);
  const [form, setForm] = useState({
    name: warehouse?.name || '', code: warehouse?.code || '',
    location: warehouse?.location || '', description: warehouse?.description || '',
    manager: warehouse?.manager || '', phone: warehouse?.phone || '',
    capacity: warehouse?.capacity || '', isDefault: warehouse?.isDefault || false,
    status: warehouse?.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { nexusToast.error('Warehouse name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, capacity: parseFloat(form.capacity) || 0 };
      if (isEdit) await axiosInstance.put(`/api/warehouses/${warehouse._id}`, payload);
      else        await axiosInstance.post('/api/warehouses/', payload);
      nexusToast.success(isEdit ? 'Warehouse updated' : 'Warehouse created');
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const inp = { height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: drawerWidth(400), height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{isEdit ? 'Edit Warehouse' : 'New Warehouse'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          {[['name','Warehouse Name',true],['code','Code',false]].map(([k,l,req]) => (
            <div key={k}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>{l}{req && <span style={{ color: '#ef4444' }}> *</span>}</label>
              <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={k === 'name' ? 'e.g. Main Warehouse' : 'WH-001'} style={inp} />
            </div>
          ))}
        </div>

        {[['location','Location','Dubai, UAE'],['manager','Manager','e.g. Ahmed Al Rashid'],['phone','Phone','+971 4 000 0000']].map(([k,l,ph]) => (
          <div key={k} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>{l}</label>
            <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} style={inp} />
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Capacity (sq ft)</label>
          <input type="number" value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="0" style={inp} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional notes…" rows={2}
            style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'none' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 8 }}>Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['active','inactive'].map(s => (
              <div key={s} onClick={() => set('status', s)}
                style={{ flex: 1, padding: '9px', textAlign: 'center', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${form.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : T.border}`, background: form.status === s ? (s === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2')) : T.surface2 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: form.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : T.textSec, margin: 0, textTransform: 'capitalize' }}>{s}</p>
              </div>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 24 }}>
          <div onClick={() => set('isDefault', !form.isDefault)}
            style={{ width: 40, height: 22, borderRadius: 999, background: form.isDefault ? '#f59e0b' : T.border, position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
            <div style={{ position: 'absolute', top: 3, left: form.isDefault ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s' }} />
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>Set as default warehouse</p>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create Warehouse'}
          </button>
          {isEdit && (
            <button onClick={() => onDelete(warehouse._id)} disabled={deleting === warehouse._id}
              style={{ padding: '11px 16px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'inherit' }}>
              {deleting === warehouse._id ? '…' : <FaTrash size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
