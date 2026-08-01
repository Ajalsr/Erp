import { useEffect, useState, useCallback, useRef } from 'react';
import { FaPlus, FaTrash, FaEdit, FaSearch, FaTimes, FaBuilding, FaChevronDown } from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { getProjects, createProject, updateProject, deleteProject } from '../../helper/projectApi';

const EMIRATES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
const EMPTY_CONTACT = { name: '', role: '', contactPerson: '', position: '', contactNumber: '' };
const EMPTY_FORM = {
  projectNo: '', projectName: '', emirates: '', location: '', typeOfProject: '', itemsProposed: '',
  mainContractor: '',
  subContractors: [{ ...EMPTY_CONTACT }],
  consultants: [{ ...EMPTY_CONTACT }],
  client: { ...EMPTY_CONTACT },
};

const PAGE_SIZE = 20;

export default function Projects() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [drawer, setDrawer] = useState(null); // { mode: 'create'|'edit', id? } | null
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getProjects(search ? { search } : {})
      .then((r) => setProjects(r.data?.data || []))
      .catch(() => nexusToast.error('Failed to load projects'))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const paged = projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreate = () => { setForm({ ...EMPTY_FORM, subContractors: [{ ...EMPTY_CONTACT }], consultants: [{ ...EMPTY_CONTACT }], client: { ...EMPTY_CONTACT } }); setDrawer({ mode: 'create' }); };
  const openEdit = (p) => {
    setForm({
      projectNo: p.projectNo || '', projectName: p.projectName || '', emirates: p.emirates || '',
      location: p.location || '', typeOfProject: p.typeOfProject || '', itemsProposed: p.itemsProposed || '',
      mainContractor: p.mainContractor || '',
      subContractors: p.subContractors?.length ? p.subContractors.map((c) => ({ ...EMPTY_CONTACT, ...c })) : [{ ...EMPTY_CONTACT }],
      consultants: p.consultants?.length ? p.consultants.map((c) => ({ ...EMPTY_CONTACT, ...c })) : [{ ...EMPTY_CONTACT }],
      client: { ...EMPTY_CONTACT, ...(p.client || {}) },
    });
    setDrawer({ mode: 'edit', id: p.id });
  };

  // dynamic row helpers
  const setContact = (listKey, idx, field, val) => setForm((f) => {
    const list = f[listKey].map((c, i) => (i === idx ? { ...c, [field]: val } : c));
    return { ...f, [listKey]: list };
  });
  const addRow = (listKey) => setForm((f) => ({ ...f, [listKey]: [...f[listKey], { ...EMPTY_CONTACT }] }));
  const removeRow = (listKey, idx) => setForm((f) => {
    const list = f[listKey].filter((_, i) => i !== idx);
    return { ...f, [listKey]: list.length ? list : [{ ...EMPTY_CONTACT }] };
  });

  const save = async () => {
    if (!form.projectName.trim()) {
      nexusToast.error('Project Name is required');
      return;
    }
    setSaving(true);
    try {
      if (drawer.mode === 'edit') { await updateProject(drawer.id, form); nexusToast.success('Project updated'); }
      else { await createProject(form); nexusToast.success('Project created'); }
      setDrawer(null);
      load();
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to save project');
    } finally { setSaving(false); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete project ${p.projectNo}? This cannot be undone.`)) return;
    try { await deleteProject(p.id); nexusToast.success('Project deleted'); load(); }
    catch (e) { nexusToast.error(e?.response?.data?.message || 'Failed to delete project'); }
  };

  const consultantSummary = (p) => {
    if (!p.consultants?.length) return '—';
    const first = p.consultants[0];
    const label = first.role || first.name || first.contactPerson || 'Consultant';
    return p.consultants.length > 1 ? `${label} +${p.consultants.length - 1}` : label;
  };
  const subSummary = (p) => {
    if (!p.subContractors?.length) return '—';
    const first = p.subContractors[0];
    const label = first.name || first.contactPerson || 'Sub-contractor';
    return p.subContractors.length > 1 ? `${label} +${p.subContractors.length - 1}` : label;
  };

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };
  const inputStyle = { padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, color: T.textPri, fontSize: 13, fontFamily: 'inherit', width: '100%' };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 };
  const cellRow = (p) => [p.projectNo, p.projectName, p.emirates, p.typeOfProject, (p.client?.name || p.client?.contactPerson || '—'), consultantSummary(p), (p.mainContractor || '—'), subSummary(p)];

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0 }}>Projects</h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: '5px 0 0' }}>Project details — stakeholders, contractors, consultants and client contacts.</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,.35)' }}>
          <FaPlus /> New Project
        </button>
      </div>

      <div style={{ marginBottom: 14, position: 'relative', maxWidth: 340 }}>
        <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textSec, fontSize: 12 }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project, client, contractor…" style={{ ...inputStyle, paddingLeft: 32 }} />
      </div>

      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {['Project No.', 'Project Name', 'Emirates', 'Type of Project', 'Client', 'Consultant', 'Main Contractor', 'Sub Contractor', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>Loading…</td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>No projects yet — click "New Project" to add one.</td></tr>
              ) : paged.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  {cellRow(p).map((val, i) => (
                    <td key={i} style={{ padding: '12px 16px', color: i === 0 ? T.textPri : T.textSec, fontWeight: i === 0 ? 700 : 400, fontFamily: i === 0 ? "'DM Mono', monospace" : 'inherit', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || '—'}</td>
                  ))}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => openEdit(p)} title="Edit" style={{ padding: 7, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', color: T.textSec }}><FaEdit size={11} /></button>
                      <button onClick={() => remove(p)} title="Delete" style={{ padding: 7, background: 'transparent', border: '1.5px solid rgba(239,68,68,.4)', borderRadius: 8, cursor: 'pointer', color: '#ef4444' }}><FaTrash size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {projects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '12px 16px', borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: T.textSec }}>Showing {Math.min((page - 1) * PAGE_SIZE + 1, projects.length)}–{Math.min(page * PAGE_SIZE, projects.length)} of {projects.length}</span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: page === 1 ? T.textMuted : T.textSec }}>← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pn) => (
                  <button key={pn} onClick={() => setPage(pn)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: page === pn ? T.accent : 'transparent', color: page === pn ? '#0a0e1a' : T.textSec, border: page === pn ? 'none' : `1px solid ${T.border}`, fontWeight: page === pn ? 700 : 400 }}>{pn}</button>
                ))}
                <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', background: 'transparent', border: `1px solid ${T.border}`, color: page === totalPages ? T.textMuted : T.textSec }}>Next →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit drawer */}
      {drawer && (
        <div onClick={() => !saving && setDrawer(null)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,.45)', display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: '96vw', height: '100%', background: T.bg, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', boxShadow: '-16px 0 48px rgba(0,0,0,.28)' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri }}>{drawer.mode === 'edit' ? 'Edit Project' : 'New Project'}</div>
              <span onClick={() => setDrawer(null)} style={{ cursor: 'pointer', color: T.textSec, fontSize: 16 }}><FaTimes /></span>
            </div>

            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18, flex: 1, overflowY: 'auto' }}>
              {/* Header fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={labelStyle}>Project No.</label><input value={form.projectNo} readOnly placeholder="Auto-generated on save" title="Auto-generated from Settings → Numbering" style={{ ...inputStyle, background: T.surface2, color: T.textSec, cursor: 'not-allowed' }} /></div>
                <div><label style={labelStyle}>Project Name *</label><input value={form.projectName} onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))} style={inputStyle} /></div>
                <div><label style={labelStyle}>Emirates</label>
                  <EmiratesSelect T={T} value={form.emirates} onChange={(v) => setForm((f) => ({ ...f, emirates: v }))} inputStyle={inputStyle} />
                </div>
                <div><label style={labelStyle}>Type of Project</label><input value={form.typeOfProject} onChange={(e) => setForm((f) => ({ ...f, typeOfProject: e.target.value }))} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Project Location (with land mark)</label><input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} style={inputStyle} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Items Proposed</label><textarea value={form.itemsProposed} onChange={(e) => setForm((f) => ({ ...f, itemsProposed: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Main Contractor</label><input value={form.mainContractor} onChange={(e) => setForm((f) => ({ ...f, mainContractor: e.target.value }))} placeholder="Company name" style={inputStyle} /></div>
              </div>

              <ContactSection T={T} title="Sub Contractors" listKey="subContractors" rows={form.subContractors} withRole={false} inputStyle={inputStyle} labelStyle={labelStyle} setContact={setContact} addRow={addRow} removeRow={removeRow} />
              <ContactSection T={T} title="Consultants" listKey="consultants" rows={form.consultants} withRole roleLabel="Type (Design / MEP / LEED…)" inputStyle={inputStyle} labelStyle={labelStyle} setContact={setContact} addRow={addRow} removeRow={removeRow} />

              {/* Client (single) */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.textPri, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}><FaBuilding size={11} /> Client</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Client Name</label><input value={form.client.name} onChange={(e) => setForm((f) => ({ ...f, client: { ...f.client, name: e.target.value } }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Contact Person</label><input value={form.client.contactPerson} onChange={(e) => setForm((f) => ({ ...f, client: { ...f.client, contactPerson: e.target.value } }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Position</label><input value={form.client.position} onChange={(e) => setForm((f) => ({ ...f, client: { ...f.client, position: e.target.value } }))} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Contact Number</label><input value={form.client.contactNumber} onChange={(e) => setForm((f) => ({ ...f, client: { ...f.client, contactNumber: e.target.value } }))} style={inputStyle} /></div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setDrawer(null)} disabled={saving} style={{ padding: '9px 16px', background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : drawer.mode === 'edit' ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom emirates dropdown: pick one of the 7, or type any custom value.
function EmiratesSelect({ T, value, onChange, inputStyle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const q = (value || '').toLowerCase();
  const matches = EMIRATES.filter((em) => em.toLowerCase().includes(q));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Select or type…"
        style={{ ...inputStyle, paddingRight: 30 }}
      />
      <FaChevronDown
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: T.textSec, fontSize: 11, cursor: 'pointer', pointerEvents: 'auto' }}
      />
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}>
          {matches.map((em) => (
            <div
              key={em}
              onClick={() => { onChange(em); setOpen(false); }}
              style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, color: T.textPri, borderBottom: `1px solid ${T.border}`, background: em === value ? T.surface2 : 'transparent' }}
            >{em}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactSection({ T, title, listKey, rows, withRole, roleLabel, inputStyle, labelStyle, setContact, addRow, removeRow }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.textPri, textTransform: 'uppercase', letterSpacing: '.05em' }}>{title}</div>
        <button onClick={() => addRow(listKey)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#3b82f6', cursor: 'pointer' }}><FaPlus size={9} /> Add</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((c, idx) => (
          <div key={idx} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, position: 'relative', background: T.surface }}>
            {rows.length > 1 && (
              <button onClick={() => removeRow(listKey, idx)} title="Remove" style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(239,68,68,.4)', borderRadius: 6, cursor: 'pointer', color: '#ef4444' }}><FaTimes size={9} /></button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: withRole ? 'auto' : '1 / -1' }}>
                <label style={labelStyle}>{listKey === 'consultants' ? 'Consultant Name' : 'Sub-contractor Name'}</label>
                <input value={c.name} onChange={(e) => setContact(listKey, idx, 'name', e.target.value)} placeholder="Company name" style={inputStyle} />
              </div>
              {withRole && (
                <div><label style={labelStyle}>{roleLabel || 'Role'}</label><input value={c.role} onChange={(e) => setContact(listKey, idx, 'role', e.target.value)} placeholder="e.g. MEP Consultant" style={inputStyle} /></div>
              )}
              <div><label style={labelStyle}>Contact Person</label><input value={c.contactPerson} onChange={(e) => setContact(listKey, idx, 'contactPerson', e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Position</label><input value={c.position} onChange={(e) => setContact(listKey, idx, 'position', e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Contact Number</label><input value={c.contactNumber} onChange={(e) => setContact(listKey, idx, 'contactNumber', e.target.value)} style={inputStyle} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
