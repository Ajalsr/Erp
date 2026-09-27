import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { usePermissions } from '../../helper/permissions';
import CustomSelect from '../common/CustomSelect';

export default function LeaveBalances() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const navigate = useNavigate();
  const { can } = usePermissions();
  const year = new Date().getFullYear();

  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    axiosInstance.get('/api/employees/', { params: { status: 'active' } })
      .then(res => setEmployees(res.data?.data?.employees || []))
      .catch(() => nexusToast.error('Failed to load employees'));
    axiosInstance.get('/api/timeoff/leave-types', { params: { status: 'active' } })
      .then(res => setLeaveTypes(res.data?.data?.leaveTypes || []))
      .catch(() => {});
  }, []);

  const fetchBalances = useCallback(async (empId) => {
    if (!empId) { setBalances([]); return; }
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/timeoff/balances', { params: { employeeId: empId, year } });
      setBalances(res.data?.data?.balances || []);
    } catch { nexusToast.error('Failed to load balances'); }
    finally { setLoading(false); }
  }, [year]);

  useEffect(() => { fetchBalances(employeeId); }, [employeeId, fetchBalances]);

  const ltName = (id) => leaveTypes.find(t => t._id === id)?.name || id;

  const saveAdjustment = async (bal, value) => {
    try {
      await axiosInstance.put(`/api/timeoff/balances/${bal._id}`, { adjusted: Number(value) || 0 });
      nexusToast.success('Balance adjusted');
      setEditing(null);
      fetchBalances(employeeId);
    } catch { nexusToast.error('Failed to adjust balance'); }
  };

  const inp = { height: 34, padding: '0 10px', border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', width: 100 };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <button onClick={() => navigate('/HR/TimeOff')} style={{ background: 'transparent', border: 'none', color: T.textSec, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>
        ← Back to Time Off
      </button>
      <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Leave Balances</h1>
      <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 20px' }}>{year} entitlements and usage</p>

      <div style={{ marginBottom: 20 }}>
        <CustomSelect value={employeeId} onChange={setEmployeeId} placeholder="— Select an employee —" style={{ width: 280 }}
          options={employees.map(e => ({ value: e._id, label: e.displayName || `${e.firstName} ${e.lastName}` }))} />
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
      ) : !employeeId ? (
        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: T.textSec }}>Select an employee to view their leave balances.</div>
      ) : (
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
                {['Leave Type', 'Entitled', 'Carried Fwd', 'Used', 'Adjusted', 'Remaining', can('timeoff', 'edit') ? '' : null].filter(Boolean).map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textSec }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>No leave types configured yet.</td></tr>
              ) : balances.map(b => (
                <tr key={b._id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: '10px 14px', color: T.textPri, fontWeight: 600 }}>{ltName(b.leaveTypeId)}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{b.entitled}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{b.carriedForward || 0}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{b.used}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>
                    {editing === b._id ? (
                      <input type="number" defaultValue={b.adjusted || 0} autoFocus style={inp}
                        onBlur={e => saveAdjustment(b, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(null); }} />
                    ) : (
                      <span onClick={() => can('timeoff', 'edit') && setEditing(b._id)} style={{ cursor: can('timeoff', 'edit') ? 'pointer' : 'default', textDecoration: can('timeoff', 'edit') ? 'underline dotted' : 'none' }}>
                        {b.adjusted || 0}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: T.textPri, fontWeight: 700 }}>{b.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
