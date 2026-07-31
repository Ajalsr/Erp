import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { usePermissions } from '../../helper/permissions';
import { drawerWidth } from '../../helper/responsive';
import CustomSelect from '../common/CustomSelect';

export default function LeaveTypes() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/timeoff/leave-types');
      setTypes(res.data?.data?.leaveTypes || []);
    } catch { nexusToast.error('Failed to load leave types'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axiosInstance.delete(`/api/timeoff/leave-types/${id}`);
      nexusToast.success('Leave type deleted');
      setDrawer(null);
      fetchTypes();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(null); }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <button onClick={() => navigate('/HR/TimeOff')} style={{ background: 'transparent', border: 'none', color: T.textSec, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>
        ← Back to Time Off
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Leave Types</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Categories of leave employees can request</p>
        </div>
        {can('timeoff', 'add') && (
          <button onClick={() => setDrawer('new')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
            <FaPlus size={11} /> New Leave Type
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {types.map(t => (
            <div key={t._id} onClick={() => setDrawer(t)}
              style={{ background: T.surface, border: `1.5px solid ${t.color || T.border}`, borderRadius: 14, padding: 16, cursor: 'pointer' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: 0 }}>{t.name}</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: '4px 0 8px' }}>{t.code}</p>
              <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>{t.accrualDaysPerYear} days/yr · {t.paid ? 'Paid' : 'Unpaid'} · {t.requiresApproval ? 'Needs approval' : 'Auto-approved'}</p>
            </div>
          ))}
        </div>
      )}

      {drawer && (
        <LeaveTypeDrawer leaveType={drawer === 'new' ? null : drawer} T={T}
          onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); fetchTypes(); }}
          onDelete={handleDelete} deleting={deleting} canDelete={can('timeoff', 'delete')} />
      )}
    </div>
  );
}

function LeaveTypeDrawer({ leaveType, T, onClose, onSaved, onDelete, deleting, canDelete }) {
  const isEdit = !!(leaveType?._id);
  const [form, setForm] = useState({
    name: leaveType?.name || '', code: leaveType?.code || '',
    accrualDaysPerYear: leaveType?.accrualDaysPerYear ?? 0,
    paid: leaveType?.paid ?? true, requiresApproval: leaveType?.requiresApproval ?? true,
    carryForwardMaxDays: leaveType?.carryForwardMaxDays ?? 0, color: leaveType?.color || '#3b82f6',
    status: leaveType?.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { nexusToast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, accrualDaysPerYear: Number(form.accrualDaysPerYear), carryForwardMaxDays: Number(form.carryForwardMaxDays) };
      if (isEdit) await axiosInstance.put(`/api/timeoff/leave-types/${leaveType._id}`, payload);
      else await axiosInstance.post('/api/timeoff/leave-types', payload);
      nexusToast.success(isEdit ? 'Leave type updated' : 'Leave type created');
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const inp = { height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };
  const label = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: drawerWidth(380), height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{isEdit ? 'Edit Leave Type' : 'New Leave Type'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} style={inp} /></div>
          <div><label style={label}>Code</label><input value={form.code} onChange={e => set('code', e.target.value)} placeholder="AL" style={inp} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Accrual Days / Year</label><input type="number" value={form.accrualDaysPerYear} onChange={e => set('accrualDaysPerYear', e.target.value)} style={inp} /></div>
          <div><label style={label}>Carry-forward Max</label><input type="number" value={form.carryForwardMaxDays} onChange={e => set('carryForwardMaxDays', e.target.value)} style={inp} /></div>
        </div>
        <div style={{ marginBottom: 14 }}><label style={label}>Color</label><input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ ...inp, padding: 4, height: 40 }} /></div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={form.paid} onChange={e => set('paid', e.target.checked)} />
          <p style={{ fontSize: 13, color: T.textPri, margin: 0 }}>Paid leave</p>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
          <input type="checkbox" checked={form.requiresApproval} onChange={e => set('requiresApproval', e.target.checked)} />
          <p style={{ fontSize: 13, color: T.textPri, margin: 0 }}>Requires manager approval</p>
        </label>

        {isEdit && (
          <div style={{ marginBottom: 20 }}>
            <label style={label}>Status</label>
            <CustomSelect value={form.status} onChange={v => set('status', v)}
              options={[{ value: 'active', label: 'active' }, { value: 'inactive', label: 'inactive' }]} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
          {isEdit && canDelete && (
            <button onClick={() => onDelete(leaveType._id)} disabled={deleting === leaveType._id}
              style={{ padding: '11px 16px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'inherit' }}>
              {deleting === leaveType._id ? '…' : <FaTrash size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
