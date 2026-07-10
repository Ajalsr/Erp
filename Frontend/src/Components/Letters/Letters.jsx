import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaFileAlt, FaDownload, FaEnvelope, FaTrash, FaEdit, FaTimes, FaSearch, FaPrint } from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import useGetCustomers from '../../helper/useGetCustomers';
import axiosInstance from '../../helper/axiosInstance';
import { getLetterTypes, getLetters, createLetter, updateLetter, deleteLetter, sendLetterEmail } from '../../helper/letterApi';

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
};
const EMPTY_FORM = { type: 'warranty', title: '', body: '', customerId: '' };

export default function Letters() {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [types, setTypes] = useState([]);
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const { handleGetCustomers, data: customers } = useGetCustomers();
  useEffect(() => { handleGetCustomers(); }, [handleGetCustomers]);

  const [drawer, setDrawer] = useState(null); // { mode: 'create'|'edit', letter? } or null
  const [form, setForm] = useState(EMPTY_FORM);
  const [custQuery, setCustQuery] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const [selectedCust, setSelectedCust] = useState(null);
  const [saving, setSaving] = useState(false);

  const [emailTarget, setEmailTarget] = useState(null); // letter, or null
  const [emailTo, setEmailTo] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getLetters(search ? { search } : {})
      .then((r) => setLetters(r.data?.data || []))
      .catch(() => nexusToast.error('Failed to load letters'))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    getLetterTypes().then((r) => setTypes(r.data?.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSelectedCust(null);
    setCustQuery('');
    setDrawer({ mode: 'create' });
  };
  const openEdit = (l) => {
    setForm({ type: l.type, title: l.title, body: l.body, customerId: l.customerId || '' });
    setSelectedCust(l.customerId ? { _id: l.customerId, customerDisplayName: l.customerName } : null);
    setCustQuery(l.customerName || '');
    setDrawer({ mode: 'edit', letter: l });
  };

  const filteredCustomers = custQuery.trim()
    ? customers.filter((c) => (c.customerDisplayName || c.companyName || '').toLowerCase().includes(custQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      nexusToast.error('Title and body are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, customerId: selectedCust?._id || '' };
      if (drawer.mode === 'edit') {
        await updateLetter(drawer.letter.id, payload);
        nexusToast.success('Letter updated');
      } else {
        await createLetter(payload);
        nexusToast.success('Letter created');
      }
      setDrawer(null);
      load();
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to save letter');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (l) => {
    if (!window.confirm(`Delete ${l.letterNumber}? This cannot be undone.`)) return;
    try {
      await deleteLetter(l.id);
      nexusToast.success('Letter deleted');
      load();
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to delete letter');
    }
  };

  const download = async (l) => {
    try {
      const res = await axiosInstance.get(`/api/letters/${l.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `letter-${l.letterNumber}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      nexusToast.success('Downloaded!');
    } catch {
      nexusToast.error('Download failed');
    }
  };

  const openEmail = (l) => {
    setEmailTarget(l);
    setEmailTo(l.customerEmail || '');
    setEmailMsg('');
  };
  const doSendEmail = async () => {
    const to = emailTo.split(',').map((s) => s.trim()).filter(Boolean);
    if (to.length === 0) { nexusToast.error('Enter at least one email'); return; }
    setSending(true);
    try {
      await sendLetterEmail(emailTarget.id, to, emailMsg);
      nexusToast.success('Letter emailed');
      setEmailTarget(null);
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const typeLabel = (v) => types.find((t) => t.value === v)?.label || v;
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };
  const inputStyle = { padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, color: T.textPri, fontSize: 13, fontFamily: 'inherit', width: '100%' };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0 }}>Letters</h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: '5px 0 0' }}>Warranty letters, bank details, references — issued on your company letterhead.</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,.35)' }}>
          <FaPlus /> New Letter
        </button>
      </div>

      <div style={{ marginBottom: 14, position: 'relative', maxWidth: 320 }}>
        <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textSec, fontSize: 12 }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number, title, customer…"
          style={{ ...inputStyle, paddingLeft: 32 }} />
      </div>

      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {['Number', 'Type', 'Title', 'Customer', 'Date', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>Loading…</td></tr>
              ) : letters.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>No letters yet — click "New Letter" to issue one.</td></tr>
              ) : letters.map((l) => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{l.letterNumber}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec }}>{typeLabel(l.type)}</td>
                  <td style={{ padding: '12px 16px', color: T.textPri, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec }}>{l.customerName || '—'}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec }}>{fmtDate(l.issueDate)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => navigate(`/Letters/${l.id}/print`)} title="Preview & Print" style={{ padding: 7, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', color: T.textSec }}><FaPrint size={11} /></button>
                      <button onClick={() => download(l)} title="Download PDF" style={{ padding: 7, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', color: T.textSec }}><FaDownload size={11} /></button>
                      <button onClick={() => openEmail(l)} title="Email" style={{ padding: 7, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', color: T.textSec }}><FaEnvelope size={11} /></button>
                      <button onClick={() => openEdit(l)} title="Edit" style={{ padding: 7, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', color: T.textSec }}><FaEdit size={11} /></button>
                      <button onClick={() => remove(l)} title="Delete" style={{ padding: 7, background: 'transparent', border: '1.5px solid rgba(239,68,68,.4)', borderRadius: 8, cursor: 'pointer', color: '#ef4444' }}><FaTrash size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit drawer */}
      {drawer && (
        <div onClick={() => !saving && setDrawer(null)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,.45)', display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', height: '100%', background: T.bg, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', boxShadow: '-16px 0 48px rgba(0,0,0,.28)', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri }}>{drawer.mode === 'edit' ? 'Edit Letter' : 'New Letter'}</div>
              <span onClick={() => setDrawer(null)} style={{ cursor: 'pointer', color: T.textSec, fontSize: 16 }}><FaTimes /></span>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>Type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={inputStyle}>
                  {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>Title</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Warranty Certificate" style={inputStyle} />
              </div>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>Customer (optional)</label>
                <input
                  value={custQuery}
                  onChange={(e) => { setCustQuery(e.target.value); setSelectedCust(null); setCustOpen(true); }}
                  onFocus={() => setCustOpen(true)}
                  placeholder="Search customer to address this to…"
                  style={inputStyle}
                />
                {custOpen && filteredCustomers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
                    {filteredCustomers.map((c) => (
                      <div key={c._id} onClick={() => { setSelectedCust(c); setCustQuery(c.customerDisplayName || c.companyName); setCustOpen(false); }}
                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, color: T.textPri, borderBottom: `1px solid ${T.border}` }}>
                        {c.customerDisplayName || c.companyName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>Body</label>
                <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Write the letter content here…" rows={12}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 220, fontFamily: 'inherit', lineHeight: 1.6 }} />
              </div>
            </div>
            <div style={{ padding: '16px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setDrawer(null)} disabled={saving} style={{ padding: '9px 16px', background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ padding: '9px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : drawer.mode === 'edit' ? 'Save Changes' : 'Create Letter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send email modal */}
      {emailTarget && (
        <div onClick={() => !sending && setEmailTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '92vw', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaFileAlt size={15} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.textPri }}>Email {emailTarget.letterNumber}</div>
                <div style={{ fontSize: 12, color: T.textSec }}>{emailTarget.title}</div>
              </div>
            </div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>To (comma-separated)</label>
            <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="customer@example.com" style={{ ...inputStyle, marginBottom: 12 }} />
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>Message (optional)</label>
            <textarea value={emailMsg} onChange={(e) => setEmailMsg(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 18 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEmailTarget(null)} disabled={sending} style={{ padding: '9px 16px', background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={doSendEmail} disabled={sending} style={{ padding: '9px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, fontFamily: 'inherit' }}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
