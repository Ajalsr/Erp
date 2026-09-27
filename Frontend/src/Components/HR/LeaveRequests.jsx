import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaCheck, FaTimes, FaBan } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useAuthStore from '../../store/useAuthStore';
import nexusToast from '../../helper/nexusToast';
import { usePermissions } from '../../helper/permissions';
import { drawerWidth } from '../../helper/responsive';
import CustomSelect from '../common/CustomSelect';
import AppDatePicker from '../common/AppDatePicker';

const STATUS_COLOR = { pending_approval: '#f59e0b', approved: '#10b981', rejected: '#ef4444', cancelled: '#94a3b8' };

export default function LeaveRequests() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const navigate = useNavigate();
  const { can, role } = usePermissions();
  const myUserId = useAuthStore((s) => s.user?.userId || '');

  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, eRes, ltRes] = await Promise.all([
        axiosInstance.get('/api/timeoff/requests'),
        axiosInstance.get('/api/employees/', { params: { status: 'active' } }),
        axiosInstance.get('/api/timeoff/leave-types', { params: { status: 'active' } }),
      ]);
      setRequests(rRes.data?.data?.requests || []);
      setEmployees(eRes.data?.data?.employees || []);
      setLeaveTypes(ltRes.data?.data?.leaveTypes || []);
    } catch { nexusToast.error('Failed to load leave requests'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const decide = async (id, action) => {
    setBusy(id + action);
    try {
      await axiosInstance.post(`/api/timeoff/requests/${id}/${action}`, {});
      nexusToast.success(`Request ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'cancelled'}`);
      fetchAll();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Action failed');
    } finally { setBusy(null); }
  };

  const canDecide = (r) => {
    if (role === 'owner' || role === 'admin') return true;
    const step = r.approverChain?.[r.currentStep];
    return !!step && step.approverUserId === myUserId;
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Time Off</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Leave requests and approvals</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/HR/TimeOff/Balances')}
            style={{ padding: '10px 16px', background: 'transparent', color: T.textPri, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Balances
          </button>
          <button onClick={() => navigate('/HR/TimeOff/LeaveTypes')}
            style={{ padding: '10px 16px', background: 'transparent', color: T.textPri, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Leave Types
          </button>
          {can('timeoff', 'add') && (
            <button onClick={() => setDrawer(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
              <FaPlus size={11} /> New Request
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
      ) : (
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
                {['Request #', 'Employee', 'Type', 'Dates', 'Days', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textSec }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>No leave requests yet.</td></tr>
              ) : requests.map(r => (
                <tr key={r._id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", color: T.textPri }}>{r.requestNumber}</td>
                  <td style={{ padding: '10px 14px', color: T.textPri, fontWeight: 600 }}>{r.employeeName}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{r.leaveTypeName}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{r.startDate} → {r.endDate}</td>
                  <td style={{ padding: '10px 14px', color: T.textPri }}>{r.days}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'capitalize', background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', color: STATUS_COLOR[r.status] || T.textSec }}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {r.status === 'pending_approval' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canDecide(r) && (
                          <>
                            <button onClick={() => decide(r._id, 'approve')} disabled={busy === r._id + 'approve'} title="Approve"
                              style={{ width: 28, height: 28, border: '1px solid #10b981', borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                              <FaCheck size={10} />
                            </button>
                            <button onClick={() => decide(r._id, 'reject')} disabled={busy === r._id + 'reject'} title="Reject"
                              style={{ width: 28, height: 28, border: '1px solid #ef4444', borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                              <FaTimes size={10} />
                            </button>
                          </>
                        )}
                        {(r.createdBy === myUserId || role === 'owner' || role === 'admin') && (
                          <button onClick={() => decide(r._id, 'cancel')} disabled={busy === r._id + 'cancel'} title="Cancel"
                            style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                            <FaBan size={10} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawer && (
        <NewRequestDrawer T={T} employees={employees} leaveTypes={leaveTypes}
          onClose={() => setDrawer(false)} onSaved={() => { setDrawer(false); fetchAll(); }} />
      )}
    </div>
  );
}

function NewRequestDrawer({ T, employees, leaveTypes, onClose, onSaved }) {
  const [form, setForm] = useState({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.employeeId || !form.leaveTypeId || !form.startDate || !form.endDate) { nexusToast.error('Employee, leave type and dates are required'); return; }
    setSaving(true);
    try {
      const res = await axiosInstance.post('/api/timeoff/requests', form);
      nexusToast.success(res.data?.message || 'Leave request submitted');
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to submit request');
    } finally { setSaving(false); }
  };

  const inp = { height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };
  const label = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: drawerWidth(400), height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>New Leave Request</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Employee</label>
          <CustomSelect value={form.employeeId} onChange={v => set('employeeId', v)}
            options={employees.map(e => ({ value: e._id, label: e.displayName || `${e.firstName} ${e.lastName}` }))} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Leave Type</label>
          <CustomSelect value={form.leaveTypeId} onChange={v => set('leaveTypeId', v)}
            options={leaveTypes.map(t => ({ value: t._id, label: t.name }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Start Date</label><AppDatePicker value={form.startDate} onChange={v => set('startDate', v)} /></div>
          <div><label style={label}>End Date</label><AppDatePicker value={form.endDate} onChange={v => set('endDate', v)} /></div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={label}>Reason</label>
          <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={3} style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'none' }} />
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Submitting…' : 'Submit Request'}
        </button>
      </div>
    </div>
  );
}
