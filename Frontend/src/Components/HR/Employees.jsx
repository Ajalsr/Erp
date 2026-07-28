import { useState, useEffect, useCallback, useRef } from 'react';
import { FaPlus, FaEdit, FaTrash, FaUserTie, FaCamera, FaFileAlt, FaPrint } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { usePermissions } from '../../helper/permissions';
import { getLetterTypes, getLetters } from '../../helper/letterApi';
import CustomSelect from '../common/CustomSelect';
import AppDatePicker from '../common/AppDatePicker';

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'];
const STATUSES = ['active', 'on_leave', 'suspended', 'terminated', 'resigned'];

export default function Employees() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null); // null | 'new' | employee obj
  const [deleting, setDeleting] = useState(null);
  const [q, setQ] = useState('');

  const fetchEmployees = useCallback(async (search) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/employees/', { params: search ? { q: search } : {} });
      setEmployees(res.data?.data?.employees || []);
    } catch {
      nexusToast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axiosInstance.delete(`/api/employees/${id}`);
      nexusToast.success('Employee deleted');
      setDrawer(null);
      fetchEmployees(q);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(null); }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
        * { box-sizing: border-box; }
        .emp-card:hover { transform: translateY(-2px); box-shadow: ${isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)'} !important; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Employees</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>HR directory and org chart source</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/HR/OrgChart')}
            style={{ padding: '10px 16px', background: 'transparent', color: T.textPri, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            View Org Chart
          </button>
          {can('employees', 'add') && (
            <button onClick={() => setDrawer('new')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
              <FaPlus size={11} /> New Employee
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') fetchEmployees(q); }}
          onBlur={() => fetchEmployees(q)}
          placeholder="Search by name, code or email…"
          style={{ height: 40, padding: '0 14px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', width: 320, maxWidth: '100%' }}
        />
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
      ) : employees.length === 0 ? (
        <div style={{ padding: 64, textAlign: 'center', background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}` }}>
          <FaUserTie size={28} color={T.border} style={{ display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No employees yet</p>
          <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>Add your first employee to start building the directory and org chart.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {employees.map(e => (
            <div key={e._id} className="emp-card" onClick={() => setDrawer(e)}
              style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all .18s', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,.25)' : '0 2px 6px rgba(0,0,0,.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {e.photo ? <img src={e.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FaUserTie size={16} color="#3b82f6" />}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: 0 }}>{e.displayName || `${e.firstName} ${e.lastName}`}</p>
                    <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: T.textSec, margin: '1px 0 0' }}>{e.employeeCode}</p>
                  </div>
                </div>
                {can('employees', 'delete') && (
                  <div style={{ display: 'flex', gap: 4 }} onClick={ev => ev.stopPropagation()}>
                    <button onClick={() => setDrawer({ ...e, _edit: true })}
                      style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                      <FaEdit size={10} />
                    </button>
                    <button onClick={() => handleDelete(e._id)} disabled={deleting === e._id}
                      style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                      <FaTrash size={10} />
                    </button>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 6px' }}>{e.jobTitle}{e.department ? ` · ${e.department}` : ''}</p>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'capitalize', background: e.status === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : T.surface2, color: e.status === 'active' ? '#10b981' : T.textSec }}>
                {(e.status || 'active').replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {drawer && (
        <EmployeeDrawer
          employee={drawer === 'new' ? null : drawer}
          T={T} isDark={isDark}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); fetchEmployees(q); }}
          onDelete={handleDelete}
          deleting={deleting}
          canDelete={can('employees', 'delete')}
        />
      )}
    </div>
  );
}

function EmployeeDrawer({ employee, T, isDark, onClose, onSaved, onDelete, deleting, canDelete }) {
  const navigate = useNavigate();
  const isEdit = !!(employee?._id);
  const [form, setForm] = useState({
    firstName: employee?.firstName || '', lastName: employee?.lastName || '',
    displayName: employee?.displayName || '', email: employee?.email || '', phone: employee?.phone || '',
    jobTitle: employee?.jobTitle || '', department: employee?.department || '', location: employee?.location || '',
    employmentType: employee?.employmentType || 'full_time', status: employee?.status || 'active',
    hireDate: employee?.hireDate || '', terminationDate: employee?.terminationDate || '',
    reportsTo: employee?.reportsTo || '',
    emiratesId: employee?.emiratesId || '', passportNumber: employee?.passportNumber || '',
    bankName: employee?.bankName || '', bankAccountNumber: employee?.bankAccountNumber || '', bankIban: employee?.bankIban || '',
    notes: employee?.notes || '', photo: employee?.photo || '',
  });
  const [saving, setSaving] = useState(false);
  const [managers, setManagers] = useState([]);
  const [letters, setLetters] = useState([]);
  const [letterTypes, setLetterTypes] = useState([]);
  const [lettersLoading, setLettersLoading] = useState(false);
  const photoInputRef = useRef(null);

  const handlePhotoFile = (file) => {
    if (!file?.type?.startsWith('image/')) { nexusToast.error('Please choose an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { nexusToast.error('Image must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => set('photo', ev.target.result);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    axiosInstance.get('/api/employees/', { params: { status: 'active' } })
      .then(res => setManagers((res.data?.data?.employees || []).filter(m => m._id !== employee?._id)))
      .catch(() => {});
  }, [employee?._id]);

  useEffect(() => {
    if (!isEdit) return;
    getLetterTypes().then(r => setLetterTypes(r.data?.data || [])).catch(() => {});
    setLettersLoading(true);
    getLetters({ employeeId: employee._id })
      .then(r => setLetters(r.data?.data || []))
      .catch(() => nexusToast.error('Failed to load letters'))
      .finally(() => setLettersLoading(false));
  }, [isEdit, employee?._id]);

  const letterTypeLabel = (v) => letterTypes.find(t => t.value === v)?.label || v;
  const letterCounts = letters.reduce((acc, l) => { acc[l.type] = (acc[l.type] || 0) + 1; return acc; }, {});

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { nexusToast.error('First and last name are required'); return; }
    if (!form.jobTitle.trim()) { nexusToast.error('Job title is required'); return; }
    if (!form.hireDate) { nexusToast.error('Hire date is required'); return; }
    setSaving(true);
    try {
      if (isEdit) await axiosInstance.put(`/api/employees/${employee._id}`, form);
      else await axiosInstance.post('/api/employees/', form);
      nexusToast.success(isEdit ? 'Employee updated' : 'Employee created');
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const inp = { height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' };
  const label = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 };
  const section = (title) => (
    <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3b82f6', margin: '20px 0 10px', borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>{title}</p>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: 440, height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{isEdit ? 'Edit Employee' : 'New Employee'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <div onClick={() => photoInputRef.current?.click()} title="Change photo"
            style={{ position: 'relative', width: 84, height: 84, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden', background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', border: `2px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {form.photo ? <img src={form.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FaUserTie size={30} color="#3b82f6" />}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = 1; }} onMouseLeave={e => { e.currentTarget.style.opacity = 0; }}>
              <FaCamera size={16} color="#fff" />
            </div>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhotoFile(e.target.files?.[0])} />
        </div>
        {form.photo && (
          <div style={{ textAlign: 'center', marginBottom: 18, marginTop: -12 }}>
            <button onClick={() => set('photo', '')} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove photo</button>
          </div>
        )}

        {section('Identity')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>First Name <span style={{ color: '#ef4444' }}>*</span></label><input value={form.firstName} onChange={e => set('firstName', e.target.value)} style={inp} /></div>
          <div><label style={label}>Last Name <span style={{ color: '#ef4444' }}>*</span></label><input value={form.lastName} onChange={e => set('lastName', e.target.value)} style={inp} /></div>
        </div>
        <div style={{ marginBottom: 14 }}><label style={label}>Display Name</label><input value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder={`${form.firstName} ${form.lastName}`.trim()} style={inp} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Email</label><input value={form.email} onChange={e => set('email', e.target.value)} style={inp} /></div>
          <div><label style={label}>Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} style={inp} /></div>
        </div>

        {section('Employment')}
        <div style={{ marginBottom: 14 }}><label style={label}>Job Title <span style={{ color: '#ef4444' }}>*</span></label><input value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} style={inp} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Department</label><input value={form.department} onChange={e => set('department', e.target.value)} style={inp} /></div>
          <div><label style={label}>Location</label><input value={form.location} onChange={e => set('location', e.target.value)} style={inp} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={label}>Employment Type</label>
            <CustomSelect value={form.employmentType} onChange={v => set('employmentType', v)}
              options={EMPLOYMENT_TYPES.map(t => ({ value: t, label: t.replace('_', ' ') }))} />
          </div>
          <div>
            <label style={label}>Status</label>
            <CustomSelect value={form.status} onChange={v => set('status', v)}
              options={STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') }))} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Hire Date <span style={{ color: '#ef4444' }}>*</span></label><AppDatePicker value={form.hireDate} onChange={v => set('hireDate', v)} /></div>
          <div><label style={label}>Termination Date</label><AppDatePicker value={form.terminationDate} onChange={v => set('terminationDate', v)} /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Reports To (Manager)</label>
          <CustomSelect value={form.reportsTo} onChange={v => set('reportsTo', v)} placeholder="— None (org chart root) —"
            options={[{ value: '', label: '— None (org chart root) —' }, ...managers.map(m => ({ value: m._id, label: m.displayName || `${m.firstName} ${m.lastName}` }))]} />
        </div>

        {section('Compliance (optional)')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Emirates ID</label><input value={form.emiratesId} onChange={e => set('emiratesId', e.target.value)} style={inp} /></div>
          <div><label style={label}>Passport No.</label><input value={form.passportNumber} onChange={e => set('passportNumber', e.target.value)} style={inp} /></div>
        </div>

        {section('Bank (for payroll reference)')}
        <div style={{ marginBottom: 14 }}><label style={label}>Bank Name</label><input value={form.bankName} onChange={e => set('bankName', e.target.value)} style={inp} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={label}>Account Number</label><input value={form.bankAccountNumber} onChange={e => set('bankAccountNumber', e.target.value)} style={inp} /></div>
          <div><label style={label}>IBAN</label><input value={form.bankIban} onChange={e => set('bankIban', e.target.value)} style={inp} /></div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={label}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'none' }} />
        </div>

        {isEdit && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 10px', borderBottom: `1px solid ${T.border}`, paddingBottom: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3b82f6', margin: 0 }}>Letters</p>
              <button onClick={() => navigate(`/HR/Letters/new?employeeId=${employee._id}&employeeName=${encodeURIComponent(form.displayName || `${form.firstName} ${form.lastName}`)}&type=offer_letter`)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'transparent', border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 11, fontWeight: 700, color: T.textPri, cursor: 'pointer' }}>
                <FaPlus size={9} /> Issue Letter
              </button>
            </div>

            {lettersLoading ? (
              <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 14px' }}>Loading…</p>
            ) : letters.length === 0 ? (
              <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 14px' }}>No letters issued yet.</p>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {Object.entries(letterCounts).map(([type, count]) => (
                    <span key={type} style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: '#3b82f6' }}>
                      {letterTypeLabel(type)}: {count}
                    </span>
                  ))}
                </div>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {letters.map(l => (
                    <div key={l.id} onClick={() => navigate(`/HR/Letters/${l.id}/print`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer' }}>
                      <FaFileAlt size={11} color={T.textSec} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: T.textPri, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
                        <p style={{ fontSize: 10.5, color: T.textSec, margin: '1px 0 0' }}>{letterTypeLabel(l.type)} · {l.letterNumber}</p>
                      </div>
                      <FaPrint size={10} color={T.textSec} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create Employee'}
          </button>
          {isEdit && canDelete && (
            <button onClick={() => onDelete(employee._id)} disabled={deleting === employee._id}
              style={{ padding: '11px 16px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'inherit' }}>
              {deleting === employee._id ? '…' : <FaTrash size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
