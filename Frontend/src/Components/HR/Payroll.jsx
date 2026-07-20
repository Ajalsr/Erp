import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaTrash, FaMoneyCheckAlt } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { usePermissions } from '../../helper/permissions';
import AppDatePicker from '../common/AppDatePicker';
import useConfirm from '../common/useConfirm';

const STATUS_COLOR = { draft: '#f59e0b', approved: '#3b82f6', paid: '#10b981', cancelled: '#94a3b8' };
const ACTION_LABEL = { approve: 'Approve', 'mark-paid': 'Mark Paid', delete: 'Delete' };

export default function Payroll() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { confirm, ConfirmModal } = useConfirm();

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/payroll/pay-runs');
      setRuns(res.data?.data?.payRuns || []);
    } catch { nexusToast.error('Failed to load pay runs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const doAction = async (id, action, confirmMsg) => {
    if (confirmMsg && !(await confirm({
      title: ACTION_LABEL[action] ? `${ACTION_LABEL[action]} pay run` : undefined,
      message: confirmMsg,
      confirmLabel: ACTION_LABEL[action] || 'Confirm',
      danger: action === 'delete',
    }))) return;
    setBusy(id + action);
    try {
      if (action === 'delete') await axiosInstance.delete(`/api/payroll/pay-runs/${id}`);
      else await axiosInstance.post(`/api/payroll/pay-runs/${id}/${action}`);
      nexusToast.success('Done');
      fetchRuns();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Action failed');
    } finally { setBusy(null); }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
        * { box-sizing: border-box; }
        .pr-card:hover { transform: translateY(-2px); box-shadow: ${isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)'} !important; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Payroll</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Pay runs, payslips and salary structures</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/HR/Payroll/Schedules')}
            style={{ padding: '10px 16px', background: 'transparent', color: T.textPri, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Schedules
          </button>
          <button onClick={() => navigate('/HR/Payroll/SalaryStructures')}
            style={{ padding: '10px 16px', background: 'transparent', color: T.textPri, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Salary Structures
          </button>
          {can('payroll', 'add') && (
            <button onClick={() => setDrawer(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
              <FaPlus size={11} /> New Pay Run
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
      ) : runs.length === 0 ? (
        <div style={{ padding: 64, textAlign: 'center', background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}` }}>
          <FaMoneyCheckAlt size={28} color={T.border} style={{ display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No pay runs yet</p>
          <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>Set up salary structures for your employees, then create a pay run.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {runs.map(r => (
            <div key={r._id} className="pr-card"
              style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: 18, transition: 'all .18s', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,.25)' : '0 2px 6px rgba(0,0,0,.05)' }}>
              <div onClick={() => navigate(`/HR/Payroll/${r._id}`)} style={{ cursor: 'pointer', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: 0 }}>{r.runNumber}</p>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'capitalize', background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', color: STATUS_COLOR[r.status] || T.textSec }}>{r.status}</span>
                </div>
                <p style={{ fontSize: 12, color: T.textSec, margin: '6px 0 0' }}>{r.periodStart} → {r.periodEnd} · Pay date {r.payDate}</p>
                <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: T.textPri, margin: '8px 0 0' }}>{(r.totalNet || 0).toFixed(2)}</p>
                <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>{(r.employeeIds || []).length} employee(s)</p>
              </div>
              {can('payroll', 'edit') && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                  {r.status === 'draft' && (
                    <>
                      <ActionBtn busy={busy === r._id + 'generate'} onClick={() => doAction(r._id, 'generate')} color={T.textPri}>Generate</ActionBtn>
                      <ActionBtn busy={busy === r._id + 'approve'} onClick={() => doAction(r._id, 'approve', 'Approve this pay run and post to the ledger?')} color="#3b82f6">Approve</ActionBtn>
                      <ActionBtn busy={busy === r._id + 'cancel'} onClick={() => doAction(r._id, 'cancel')} color="#94a3b8">Cancel</ActionBtn>
                      {can('payroll', 'delete') && (
                        <button onClick={() => doAction(r._id, 'delete', 'Delete this draft pay run?')} disabled={busy === r._id + 'delete'}
                          style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                          <FaTrash size={10} />
                        </button>
                      )}
                    </>
                  )}
                  {r.status === 'approved' && (
                    <ActionBtn busy={busy === r._id + 'mark-paid'} onClick={() => doAction(r._id, 'mark-paid', 'Mark this pay run as paid and clear the payable against the bank?')} color="#10b981">Mark Paid</ActionBtn>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {drawer && (
        <NewPayRunDrawer T={T} onClose={() => setDrawer(false)} onSaved={() => { setDrawer(false); fetchRuns(); }} />
      )}
      {ConfirmModal}
    </div>
  );
}

function ActionBtn({ children, onClick, busy, color = '#64748b' }) {
  return (
    <button onClick={onClick} disabled={busy}
      style={{ padding: '6px 12px', background: 'transparent', border: `1.5px solid ${color}`, borderRadius: 8, fontSize: 11, fontWeight: 700, color, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
      {busy ? '…' : children}
    </button>
  );
}

function NewPayRunDrawer({ T, onClose, onSaved }) {
  const [form, setForm] = useState({ periodStart: '', periodEnd: '', payDate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.periodStart || !form.periodEnd || !form.payDate) { nexusToast.error('Period start, end and pay date are required'); return; }
    setSaving(true);
    try {
      await axiosInstance.post('/api/payroll/pay-runs', form);
      nexusToast.success('Pay run created — covers all active employees');
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to create pay run');
    } finally { setSaving(false); }
  };

  const inp = { height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };
  const label = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: 400, height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>New Pay Run</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>
        <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 18px' }}>Covers every active employee. Generate payslips after creating the run.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Period Start</label><AppDatePicker value={form.periodStart} onChange={v => set('periodStart', v)} /></div>
          <div><label style={label}>Period End</label><AppDatePicker value={form.periodEnd} onChange={v => set('periodEnd', v)} /></div>
        </div>
        <div style={{ marginBottom: 14 }}><label style={label}>Pay Date</label><AppDatePicker value={form.payDate} onChange={v => set('payDate', v)} /></div>
        <div style={{ marginBottom: 20 }}>
          <label style={label}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'none' }} />
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Creating…' : 'Create Pay Run'}
        </button>
      </div>
    </div>
  );
}
