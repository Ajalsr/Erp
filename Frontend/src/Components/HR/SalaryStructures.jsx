import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaTrash, FaEdit } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { usePermissions } from '../../helper/permissions';
import { drawerWidth } from '../../helper/responsive';
import CustomSelect from '../common/CustomSelect';
import AppDatePicker from '../common/AppDatePicker';

export default function SalaryStructures() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [structures, setStructures] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null); // null | 'new' | structure object

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([
        axiosInstance.get('/api/payroll/salary-structures', { params: { status: 'active' } }),
        axiosInstance.get('/api/employees/', { params: { status: 'active' } }),
      ]);
      setStructures(sRes.data?.data?.salaryStructures || []);
      setEmployees(eRes.data?.data?.employees || []);
    } catch { nexusToast.error('Failed to load salary structures'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const empName = (id) => {
    const e = employees.find(x => x._id === id);
    return e ? (e.displayName || `${e.firstName} ${e.lastName}`) : id;
  };

  // Employees who don't already have an active structure — only these make
  // sense to offer in the "New Salary Structure" dropdown. An employee with
  // an active structure should be edited or superseded, not duplicated.
  const employeesWithoutStructure = employees.filter(
    e => !structures.some(s => s.employeeId === e._id)
  );

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <button onClick={() => navigate('/HR/Payroll')} style={{ background: 'transparent', border: 'none', color: T.textSec, fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>
        ← Back to Payroll
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Salary Structures</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Current active compensation per employee</p>
        </div>
        {can('payroll', 'add') && (
          <button onClick={() => setDrawer('new')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
            <FaPlus size={11} /> New Salary Structure
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
      ) : (
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
                {['Employee', 'Effective From', 'Basic', 'Gross Monthly', 'Currency', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textSec }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {structures.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>No salary structures yet.</td></tr>
              ) : structures.map(s => (
                <tr key={s._id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: '10px 14px', color: T.textPri, fontWeight: 600 }}>{empName(s.employeeId)}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{s.effectiveFrom}</td>
                  <td style={{ padding: '10px 14px', color: T.textPri }}>{s.basicSalary.toFixed(2)}</td>
                  <td style={{ padding: '10px 14px', color: T.textPri, fontWeight: 700 }}>{s.grossMonthly.toFixed(2)}</td>
                  <td style={{ padding: '10px 14px', color: T.textSec }}>{s.currency}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {can('payroll', 'edit') && (
                      <button onClick={() => setDrawer(s)} title="Edit"
                        style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                        <FaEdit size={11} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawer && (
        <SalaryStructureDrawer
          T={T}
          structure={drawer === 'new' ? null : drawer}
          employees={employeesWithoutStructure}
          employeeName={drawer === 'new' ? '' : empName(drawer.employeeId)}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

function SalaryStructureDrawer({ T, structure, employees, employeeName, onClose, onSaved }) {
  const isEdit = !!structure;
  const [employeeId, setEmployeeId] = useState(structure?.employeeId || '');
  const [effectiveFrom, setEffectiveFrom] = useState(structure?.effectiveFrom || '');
  const [basicSalary, setBasicSalary] = useState(structure?.basicSalary ?? '');
  const [allowances, setAllowances] = useState(
    (structure?.allowances || []).map(a => ({ name: a.name, amount: a.amount }))
  );
  const [deductions, setDeductions] = useState(
    (structure?.deductions || []).map(d => ({ name: d.name, amount: d.amount }))
  );
  const [saving, setSaving] = useState(false);

  const addRow = (setter) => setter(p => [...p, { name: '', type: '', amount: '' }]);
  const updateRow = (setter, i, k, v) => setter(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const removeRow = (setter, i) => setter(p => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!isEdit && !employeeId) { nexusToast.error('Select an employee'); return; }
    if (!effectiveFrom) { nexusToast.error('Effective date is required'); return; }
    if (!basicSalary || Number(basicSalary) <= 0) { nexusToast.error('Basic salary must be greater than zero'); return; }
    setSaving(true);
    try {
      const payload = {
        effectiveFrom, basicSalary: Number(basicSalary),
        allowances: allowances.filter(a => a.name).map(a => ({ name: a.name, type: 'earning', amount: Number(a.amount) || 0 })),
        deductions: deductions.filter(d => d.name).map(d => ({ name: d.name, type: 'deduction', amount: Number(d.amount) || 0 })),
      };
      if (isEdit) {
        await axiosInstance.put(`/api/payroll/salary-structures/${structure._id}`, payload);
        nexusToast.success('Salary structure updated');
      } else {
        await axiosInstance.post('/api/payroll/salary-structures', { ...payload, employeeId });
        nexusToast.success('Salary structure created');
      }
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const inp = { height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };
  const label = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 };

  const componentRows = (rows, setter, title) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ ...label, marginBottom: 0 }}>{title}</label>
        <button onClick={() => addRow(setter)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Add</button>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Name" value={r.name} onChange={e => updateRow(setter, i, 'name', e.target.value)} style={{ ...inp, flex: 2 }} />
          <input placeholder="Amount" type="number" value={r.amount} onChange={e => updateRow(setter, i, 'amount', e.target.value)} style={{ ...inp, flex: 1 }} />
          <button onClick={() => removeRow(setter, i)} style={{ width: 40, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', color: '#ef4444' }}><FaTrash size={10} /></button>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: drawerWidth(420), height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{isEdit ? 'Edit Salary Structure' : 'New Salary Structure'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>
        <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 16px' }}>
          {isEdit ? 'Editing the current active structure in place — for a pay change effective going forward, create a new structure instead so history is kept.'
                  : 'Creating a new structure for an employee supersedes their previous one — history is kept.'}
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Employee</label>
          {isEdit ? (
            <div style={{ ...inp, display: 'flex', alignItems: 'center', color: T.textPri, fontWeight: 600, background: T.isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>{employeeName}</div>
          ) : (
            <CustomSelect value={employeeId} onChange={setEmployeeId}
              options={employees.map(e => ({ value: e._id, label: e.displayName || `${e.firstName} ${e.lastName}` }))} />
          )}
          {!isEdit && employees.length === 0 && (
            <p style={{ fontSize: 11, color: T.textSec, margin: '6px 0 0' }}>Every active employee already has a salary structure.</p>
          )}
        </div>
        <div style={{ marginBottom: 14 }}><label style={label}>Effective From</label><AppDatePicker value={effectiveFrom} onChange={setEffectiveFrom} /></div>
        <div style={{ marginBottom: 16 }}><label style={label}>Basic Salary</label><input type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} style={inp} /></div>

        {componentRows(allowances, setAllowances, 'Allowances (earnings)')}
        {componentRows(deductions, setDeductions, 'Recurring Deductions')}

        <button onClick={handleSave} disabled={saving || (!isEdit && !employeeId)}
          style={{ width: '100%', padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
          {saving ? 'Saving…' : isEdit ? 'Update Salary Structure' : 'Create Salary Structure'}
        </button>
      </div>
    </div>
  );
}
