import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaTrash, FaPlay, FaPause, FaCalendarAlt } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { usePermissions } from '../../helper/permissions';
import { drawerWidth } from '../../helper/responsive';
import CustomSelect from '../common/CustomSelect';
import AppDatePicker from '../common/AppDatePicker';
import useConfirm from '../common/useConfirm';

const STATUS_COLOR = { active: '#10b981', paused: '#f59e0b', completed: '#94a3b8' };
const FREQ_LABEL = { weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', yearly: 'Yearly' };

export default function PayrollSchedules() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { confirm, ConfirmModal } = useConfirm();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/payroll/schedules');
      setSchedules(res.data?.data || []);
    } catch { nexusToast.error('Failed to load payroll schedules'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const toggleStatus = async (s) => {
    const next = s.status === 'active' ? 'paused' : 'active';
    setBusy(s._id + 'toggle');
    try {
      await axiosInstance.patch(`/api/payroll/schedules/${s._id}/status`, { status: next });
      fetchSchedules();
    } catch (err) { nexusToast.error(err?.response?.data?.message || 'Failed to update'); }
    finally { setBusy(null); }
  };

  const runNow = async (s) => {
    if (!(await confirm({
      title: 'Run schedule now',
      message: `Create a draft pay run right now for "${s.profileName}"? This does not approve or pay it — you review and approve as usual.`,
      confirmLabel: 'Create pay run',
    }))) return;
    setBusy(s._id + 'run');
    try {
      const res = await axiosInstance.post(`/api/payroll/schedules/${s._id}/run-now`);
      nexusToast.success('Draft pay run created');
      navigate(`/HR/Payroll/${res.data?.data?.id}`);
    } catch (err) { nexusToast.error(err?.response?.data?.message || 'Failed to create pay run'); }
    finally { setBusy(null); }
  };

  const remove = async (id) => {
    if (!(await confirm({
      title: 'Delete payroll schedule',
      message: 'Delete this payroll schedule? Pay runs it already created are not affected.',
      confirmLabel: 'Delete',
      danger: true,
    }))) return;
    setBusy(id + 'delete');
    try {
      await axiosInstance.delete(`/api/payroll/schedules/${id}`);
      nexusToast.success('Schedule deleted');
      fetchSchedules();
    } catch (err) { nexusToast.error(err?.response?.data?.message || 'Failed to delete'); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <button onClick={() => navigate('/HR/Payroll')} style={{ background: 'transparent', border: 'none', color: T.textSec, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>
        ← Back to Payroll
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Payroll Schedules</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Auto-create draft pay runs on a cadence. Approve and mark-paid always stay manual.</p>
        </div>
        {can('payroll', 'add') && (
          <button onClick={() => setDrawer(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
            <FaPlus size={11} /> New Schedule
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
      ) : schedules.length === 0 ? (
        <div style={{ padding: 64, textAlign: 'center', background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}` }}>
          <FaCalendarAlt size={26} color={T.border} style={{ display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No payroll schedules yet</p>
          <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>Set one up to auto-create draft pay runs every week, two weeks, month, or year.</p>
        </div>
      ) : (
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
                {['Schedule', 'Frequency', 'Next Run', 'Generated', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textSec }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s._id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: '10px 14px', color: T.textPri, fontWeight: 600 }}>{s.profileName}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{FREQ_LABEL[s.frequency] || s.frequency}{s.interval > 1 ? ` × ${s.interval}` : ''}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{s.status === 'completed' ? '—' : s.nextRunDate}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{s.generatedCount || 0}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'capitalize', background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', color: STATUS_COLOR[s.status] || T.textSec }}>{s.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {can('payroll', 'edit') && (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {s.status !== 'completed' && (
                          <IconBtn title={s.status === 'active' ? 'Pause' : 'Resume'} onClick={() => toggleStatus(s)} busy={busy === s._id + 'toggle'} T={T}>
                            {s.status === 'active' ? <FaPause size={10} /> : <FaPlay size={10} />}
                          </IconBtn>
                        )}
                        <IconBtn title="Run now" onClick={() => runNow(s)} busy={busy === s._id + 'run'} T={T} color="#3b82f6">
                          <FaCalendarAlt size={10} />
                        </IconBtn>
                        {can('payroll', 'delete') && (
                          <IconBtn title="Delete" onClick={() => remove(s._id)} busy={busy === s._id + 'delete'} T={T} color="#ef4444">
                            <FaTrash size={10} />
                          </IconBtn>
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
        <ScheduleDrawer T={T} onClose={() => setDrawer(false)} onSaved={() => { setDrawer(false); fetchSchedules(); }} />
      )}
      {ConfirmModal}
    </div>
  );
}

function IconBtn({ children, onClick, busy, T, color, title }) {
  return (
    <button onClick={onClick} disabled={busy} title={title}
      style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color || T.textSec }}>
      {children}
    </button>
  );
}

function ScheduleDrawer({ T, onClose, onSaved }) {
  const [form, setForm] = useState({
    profileName: '', frequency: 'monthly', interval: 1, startDate: '', endDate: '',
    maxCount: 0, payDateOffsetDays: 3, autoGeneratePayslips: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.startDate) { nexusToast.error('Start date is required'); return; }
    setSaving(true);
    try {
      await axiosInstance.post('/api/payroll/schedules', {
        ...form,
        interval: Number(form.interval) || 1,
        maxCount: Number(form.maxCount) || 0,
        payDateOffsetDays: Number(form.payDateOffsetDays) || 0,
      });
      nexusToast.success('Payroll schedule created');
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
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: drawerWidth(400), height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>New Payroll Schedule</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>
        <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 18px' }}>Creates a <strong>draft</strong> pay run covering all active employees on each due date. You still review, generate payslips (if not automatic below), approve, and mark paid yourself.</p>

        <div style={{ marginBottom: 14 }}><label style={label}>Name</label><input value={form.profileName} onChange={e => set('profileName', e.target.value)} placeholder="Monthly payroll" style={inp} /></div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={label}>Frequency</label>
            <CustomSelect value={form.frequency} onChange={v => set('frequency', v)}
              options={[{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Biweekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} />
          </div>
          <div><label style={label}>Every N periods</label><input type="number" min={1} value={form.interval} onChange={e => set('interval', e.target.value)} style={inp} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Start Date</label><AppDatePicker value={form.startDate} onChange={v => set('startDate', v)} /></div>
          <div><label style={label}>End Date (optional)</label><AppDatePicker value={form.endDate} onChange={v => set('endDate', v)} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Pay Date Offset (days after period end)</label><input type="number" min={0} value={form.payDateOffsetDays} onChange={e => set('payDateOffsetDays', e.target.value)} style={inp} /></div>
          <div><label style={label}>Max Runs (0 = unlimited)</label><input type="number" min={0} value={form.maxCount} onChange={e => set('maxCount', e.target.value)} style={inp} /></div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
          <input type="checkbox" checked={form.autoGeneratePayslips} onChange={e => set('autoGeneratePayslips', e.target.checked)} />
          <p style={{ fontSize: 13, color: T.textPri, margin: 0 }}>Also auto-generate draft payslips (still requires manual approve)</p>
        </label>

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Creating…' : 'Create Schedule'}
        </button>
      </div>
    </div>
  );
}
