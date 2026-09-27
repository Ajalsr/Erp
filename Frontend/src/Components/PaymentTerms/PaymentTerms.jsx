import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaRegClock } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';
import { drawerWidth } from '../../helper/responsive';
import useIsMobile from '../../helper/useIsMobile';
import useConfirm from '../common/useConfirm';

export default function PaymentTerms() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };
  const isMobile = useIsMobile();
  const { confirm, ConfirmModal } = useConfirm();

  const [terms, setTerms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editingTerm, setEditingTerm] = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [search, setSearch]       = useState('');

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/payment-terms/');
      setTerms(res.data?.data?.paymentTerms || []);
    } catch {
      nexusToast.error('Failed to load payment terms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  const filtered = terms.filter(t => !search || t.name?.toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async (id) => {
    if (!(await confirm({ title: 'Delete payment term?', message: 'This will permanently remove the payment term. Records already using it keep their stored value.', confirmLabel: 'Delete', danger: true }))) return;
    setDeleting(id);
    try {
      await axiosInstance.delete(`/api/payment-terms/${id}`);
      nexusToast.success('Payment term deleted');
      fetchTerms();
    } catch {
      nexusToast.error('Failed to delete payment term');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
        * { box-sizing: border-box; }
        .pt-row:hover { background: ${isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'} !important; }
        .pt-btn:hover  { background: ${isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'} !important; }
      `}</style>

      <div style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: isMobile ? 19 : 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Payment Terms</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Manage the payment terms offered to customers and vendors</p>
        </div>
        <button onClick={() => setEditingTerm({ _id: null, name: '', days: 0, status: 'active' })}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', width: isMobile ? '100%' : 'auto', whiteSpace: 'nowrap', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
          <FaPlus size={11} /> New Term
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 40, border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface, marginBottom: 14 }}>
        <FaRegClock size={12} color={T.textSec} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search terms…"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T.textPri, fontFamily: 'inherit' }} />
        {search && <IoClose size={14} color={T.textSec} style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />}
      </div>

      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', padding: '9px 18px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
          {['Term', 'Days', 'Status', ''].map((h, i) => (
            <span key={i} style={{ flex: i === 0 ? 1 : 0, minWidth: i === 1 ? 70 : undefined, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec }}>{h}</span>
          ))}
        </div>
        {loading
          ? <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
          : filtered.length === 0
            ? <div style={{ padding: 48, textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No payment terms yet</p>
                <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>Create your first payment term (e.g. Net 30).</p>
              </div>
            : filtered.map(t => (
                <div key={t._id} className="pt-row" onClick={() => setEditingTerm(t)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: T.surface }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{t.name}</p>
                  </div>
                  <span style={{ minWidth: 70, fontSize: 12, fontFamily: "'DM Mono', monospace", color: T.textSec }}>{t.days === 0 ? 'On receipt' : `${t.days}d`}</span>
                  <span style={{ minWidth: 0, fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'capitalize', background: t.status === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : (isDark ? 'rgba(100,116,139,0.15)' : '#f8fafc'), color: t.status === 'active' ? '#10b981' : T.textSec }}>
                    {t.status || 'active'}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button className="pt-btn" onClick={() => setEditingTerm(t)}
                      style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                      <FaEdit size={10} />
                    </button>
                    <button className="pt-btn" onClick={() => handleDelete(t._id)} disabled={deleting === t._id}
                      style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                      <FaTrash size={10} />
                    </button>
                  </div>
                </div>
              ))
        }
      </div>

      {editingTerm && (
        <EditTermDrawer term={editingTerm} T={T} isDark={isDark}
          onClose={() => setEditingTerm(null)}
          onSaved={() => { setEditingTerm(null); fetchTerms(); }}
          onDelete={editingTerm._id ? () => handleDelete(editingTerm._id) : null}
          deleting={deleting === editingTerm._id} />
      )}
      {ConfirmModal}
    </div>
  );
}

function EditTermDrawer({ term, T, isDark, onClose, onSaved, onDelete, deleting }) {
  const [form, setForm] = useState({ name: term.name, days: term.days ?? 0, status: term.status || 'active' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { nexusToast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, days: Number(form.days) || 0, status: form.status };
      if (term._id) {
        await axiosInstance.put(`/api/payment-terms/${term._id}`, payload);
      } else {
        await axiosInstance.post('/api/payment-terms/', payload);
      }
      nexusToast.success(term._id ? 'Payment term updated' : 'Payment term created');
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save payment term');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: drawerWidth(380), height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{term._id ? 'Edit Payment Term' : 'New Payment Term'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
            Term Name<span style={{ color: '#ef4444' }}> *</span>
          </label>
          <input name="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Net 30"
            style={{ width: '100%', height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
            Days Until Due
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontStyle: 'italic', color: T.textSec }}>0 = due on receipt</span>
          </label>
          <input type="number" min="0" name="days" value={form.days} onChange={e => setForm(p => ({ ...p, days: e.target.value }))}
            placeholder="e.g. 30"
            style={{ width: '100%', height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: "'DM Mono', monospace", boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 8 }}>Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['active','inactive'].map(s => (
              <div key={s} onClick={() => setForm(p => ({ ...p, status: s }))}
                style={{ flex: 1, padding: '9px', textAlign: 'center', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${form.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : T.border}`, background: form.status === s ? (s === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2')) : T.surface2 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: form.status === s ? (s === 'active' ? '#10b981' : '#ef4444') : T.textSec, margin: 0, textTransform: 'capitalize' }}>{s}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: 12, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : term._id ? 'Update Term' : 'Create Term'}
          </button>
          {onDelete && (
            <button onClick={onDelete} disabled={deleting}
              style={{ padding: '12px 16px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'inherit' }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
