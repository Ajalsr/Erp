import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaPlus, FaTrash, FaEdit, FaSearch, FaPrint } from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { getLetterTypes, getLetters, deleteLetter } from '../../helper/letterApi';
import useConfirm from '../common/useConfirm';

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Letters() {
  const navigate = useNavigate();
  const location = useLocation();
  // Mounted at both /Letters (Sales — customer letters) and /HR/Letters (HR —
  // employee letters, offer/warning/etc). Same component, scoped by pathname
  // so each nav entry only ever shows/creates the letters it owns.
  const isHR = location.pathname.startsWith('/HR');
  const base = isHR ? '/HR/Letters' : '/Letters';
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const { confirm, ConfirmModal } = useConfirm();

  const [types, setTypes] = useState([]);
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const remove = async (l) => {
    if (!(await confirm({ title: 'Delete letter', message: `Delete ${l.letterNumber}? This cannot be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deleteLetter(l.id);
      nexusToast.success('Letter deleted');
      load();
    } catch (e) {
      nexusToast.error(e?.response?.data?.message || 'Failed to delete letter');
    }
  };

  const typeLabel = (v) => types.find((t) => t.value === v)?.label || v;
  // "custom" has no category (either side can use it) — bucket it with
  // Sales/customer by default so HR only ever shows the HR-specific types.
  const scopedLetters = types.length === 0 ? letters : letters.filter((l) => {
    const cat = types.find((t) => t.value === l.type)?.category || '';
    return isHR ? cat === 'employee' : cat !== 'employee';
  });
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };
  const inputStyle = { padding: '9px 12px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, color: T.textPri, fontSize: 13, fontFamily: 'inherit', width: '100%' };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0 }}>{isHR ? 'HR Letters' : 'Letters'}</h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: '5px 0 0' }}>
            {isHR
              ? 'Offer, appointment, warning, experience and other employee letters — written on your company letterhead.'
              : 'Warranty letters, bank details, references — written on your company letterhead.'}
          </p>
        </div>
        <button onClick={() => navigate(`${base}/new`)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,.35)' }}>
          <FaPlus /> New Letter
        </button>
      </div>

      <div style={{ marginBottom: 14, position: 'relative', maxWidth: 320 }}>
        <FaSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textSec, fontSize: 12 }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isHR ? 'Search number, title, employee…' : 'Search number, title, customer…'}
          style={{ ...inputStyle, paddingLeft: 32 }} />
      </div>

      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {['Number', 'Type', 'Title', 'Addressed To', 'Date', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>Loading…</td></tr>
              ) : scopedLetters.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: T.textSec }}>No letters yet — click "New Letter" to write one.</td></tr>
              ) : scopedLetters.map((l) => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{l.letterNumber}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec }}>{typeLabel(l.type)}</td>
                  <td style={{ padding: '12px 16px', color: T.textPri, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec }}>{l.customerName || l.employeeName || '—'}</td>
                  <td style={{ padding: '12px 16px', color: T.textSec }}>{fmtDate(l.issueDate)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => navigate(`${base}/${l.id}/print`)} title="Preview, Print, Download & Email" style={{ padding: 7, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', color: T.textSec }}><FaPrint size={11} /></button>
                      <button onClick={() => navigate(`${base}/${l.id}/edit`)} title="Edit" style={{ padding: 7, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', color: T.textSec }}><FaEdit size={11} /></button>
                      <button onClick={() => remove(l)} title="Delete" style={{ padding: 7, background: 'transparent', border: '1.5px solid rgba(239,68,68,.4)', borderRadius: 8, cursor: 'pointer', color: '#ef4444' }}><FaTrash size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {ConfirmModal}
    </div>
  );
}
