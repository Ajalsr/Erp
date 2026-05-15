import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaEdit, FaTrash, FaLayerGroup } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export default function ItemGroups() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [drawer, setDrawer]           = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [deleting, setDeleting]       = useState(null);
  const [search, setSearch]           = useState('');

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/item-groups/');
      setGroups(res.data?.data?.groups || []);
    } catch {
      nexusToast.error('Failed to load item groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Build tree: root groups + their children
  const roots    = groups.filter(g => !g.parentId);
  const children = (parentId) => groups.filter(g => g.parentId === parentId);

  const filtered = groups.filter(g =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axiosInstance.delete(`/api/item-groups/${id}`);
      nexusToast.success('Group deleted');
      setDrawer(null);
      fetchGroups();
    } catch {
      nexusToast.error('Failed to delete group');
    } finally {
      setDeleting(null);
    }
  };

  const GroupRow = ({ group, depth = 0 }) => {
    const kids = children(group._id);
    return (
      <>
        <div className="ig-row" onClick={() => setDrawer(group)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `11px 18px 11px ${18 + depth * 24}px`, borderBottom: `1px solid ${T.border}`, cursor: 'pointer', background: T.surface }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color || '#3b82f6', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{group.name}</p>
            {group.description && <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>{group.description}</p>}
          </div>
          {kids.length > 0 && (
            <span style={{ fontSize: 10, padding: '2px 8px', background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', borderRadius: 999, color: T.textSec, fontWeight: 600 }}>
              {kids.length} sub-group{kids.length > 1 ? 's' : ''}
            </span>
          )}
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 700, textTransform: 'capitalize', background: group.status === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : (isDark ? 'rgba(100,116,139,0.15)' : '#f8fafc'), color: group.status === 'active' ? '#10b981' : T.textSec }}>
            {group.status || 'active'}
          </span>
          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
            <button className="ig-btn" onClick={() => { setEditingGroup(group); setDrawer(null); }}
              style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
              <FaEdit size={10} />
            </button>
            <button className="ig-btn" onClick={() => handleDelete(group._id)} disabled={deleting === group._id}
              style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <FaTrash size={10} />
            </button>
          </div>
        </div>
        {kids.map(kid => <GroupRow key={kid._id} group={kid} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
        * { box-sizing: border-box; }
        .ig-row:hover { background: ${isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'} !important; }
        .ig-btn:hover  { background: ${isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'} !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Item Groups</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Organise your items into groups and sub-groups</p>
        </div>
        <button onClick={() => setEditingGroup({ _id: null, name: '', description: '', parentId: '', color: '#3b82f6', status: 'active' })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
          <FaPlus size={11} /> New Group
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Groups',   val: groups.length,                         color: '#3b82f6' },
          { label: 'Root Groups',    val: roots.length,                          color: '#10b981' },
          { label: 'Sub-groups',     val: groups.filter(g => g.parentId).length, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 18px', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 6px' }}>{s.label}</p>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 40, border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface, marginBottom: 14 }}>
        <FaLayerGroup size={12} color={T.textSec} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups…"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T.textPri, fontFamily: 'inherit' }} />
        {search && <IoClose size={14} color={T.textSec} style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />}
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', padding: '9px 18px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
          {['Group Name', 'Status', ''].map((h, i) => (
            <span key={i} style={{ flex: i === 0 ? 1 : 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec }}>{h}</span>
          ))}
        </div>
        {loading
          ? <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: T.textSec }}>Loading…</div>
          : search
            ? filtered.map(g => <GroupRow key={g._id} group={g} />)
            : roots.length === 0
              ? <div style={{ padding: 48, textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No item groups yet</p>
                  <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>Create your first group to start organising items.</p>
                </div>
              : roots.map(g => <GroupRow key={g._id} group={g} />)
        }
      </div>

      {/* Edit inline drawer */}
      {editingGroup && (
        <EditGroupDrawer group={editingGroup} groups={groups} T={T} isDark={isDark} COLORS={COLORS}
          onClose={() => setEditingGroup(null)}
          onSaved={() => { setEditingGroup(null); fetchGroups(); }} />
      )}

      {/* Detail drawer */}
      {drawer && !editingGroup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setDrawer(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: 340, height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>Group Details</h2>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <IoClose size={14} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: T.surface2, borderRadius: 12, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${drawer.color || '#3b82f6'}22`, border: `2px solid ${drawer.color || '#3b82f6'}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaLayerGroup size={14} color={drawer.color || '#3b82f6'} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>{drawer.name}</p>
                {drawer.description && <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>{drawer.description}</p>}
              </div>
            </div>
            {drawer.parentId && (
              <div style={{ padding: '9px 0', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: T.textSec }}>Parent Group</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textPri }}>{groups.find(g => g._id === drawer.parentId)?.name || '—'}</span>
              </div>
            )}
            <div style={{ padding: '9px 0', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: T.textSec }}>Sub-groups</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textPri }}>{children(drawer._id).length}</span>
            </div>
            <div style={{ padding: '9px 0', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: T.textSec }}>Status</span>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize', color: drawer.status === 'active' ? '#10b981' : T.textSec }}>{drawer.status || 'active'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setEditingGroup(drawer)} style={{ flex: 1, padding: 10, background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: T.textPri, fontFamily: 'inherit' }}>Edit</button>
              <button onClick={() => handleDelete(drawer._id)} disabled={deleting === drawer._id}
                style={{ flex: 1, padding: 10, background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'inherit' }}>
                {deleting === drawer._id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditGroupDrawer({ group, groups, T, isDark, COLORS, onClose, onSaved }) {
  const [form, setForm] = useState({ name: group.name, description: group.description || '', parentId: group.parentId || '', color: group.color || '#3b82f6', status: group.status || 'active', codePrefix: group.codePrefix || '' });
  const [saving, setSaving] = useState(false);
  const [prefixTouched, setPrefixTouched] = useState(!!group.codePrefix);

  const derivePrefix = (name) => name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();

  const handleSave = async () => {
    if (!form.name.trim()) { nexusToast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (group._id) {
        await axiosInstance.put(`/api/item-groups/${group._id}`, form);
      } else {
        await axiosInstance.post('/api/item-groups/', form);
      }
      nexusToast.success(group._id ? 'Group updated' : 'Group created');
      onSaved();
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const roots = groups.filter(g => !g.parentId && g._id !== group._id);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: 380, height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{group._id ? 'Edit Group' : 'New Group'}</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
        </div>
        {[['name','Group Name','e.g. Electronics',true],['description','Description','Optional description',false]].map(([name, label, ph, req]) => (
          <div key={name} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
              {label}{req && <span style={{ color: '#ef4444' }}> *</span>}
            </label>
            <input name={name} value={form[name]}
              onChange={e => {
                const val = e.target.value;
                setForm(p => {
                  const next = { ...p, [name]: val };
                  if (name === 'name' && !prefixTouched) next.codePrefix = val.trim() ? derivePrefix(val) : '';
                  return next;
                });
              }}
              placeholder={ph}
              style={{ width: '100%', height: name === 'description' ? 'auto' : 40, padding: name === 'description' ? '10px 12px' : '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        ))}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>
            Item Code Prefix
            <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6, color: T.textSec, fontStyle: 'italic' }}>optional — auto-prepended when creating items</span>
          </label>
          <input
            value={form.codePrefix}
            onChange={e => {
              const val = e.target.value.toUpperCase();
              setPrefixTouched(val !== '' && val !== derivePrefix(form.name));
              setForm(p => ({ ...p, codePrefix: val }));
            }}
            placeholder={form.name.trim() ? derivePrefix(form.name) + '-' : 'e.g. ELEC'}
            maxLength={10}
            style={{ width: '100%', height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: "'DM Mono', monospace", boxSizing: 'border-box', letterSpacing: '0.05em' }}
          />
          {form.codePrefix && (
            <p style={{ fontSize: 11, color: '#10b981', margin: '5px 0 0', fontFamily: "'DM Mono', monospace" }}>
              Preview: <strong>{form.codePrefix.replace(/-*$/, '')}</strong>-0001
            </p>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Parent Group</label>
          <select value={form.parentId} onChange={e => setForm(p => ({ ...p, parentId: e.target.value }))}
            style={{ width: '100%', height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', cursor: 'pointer' }}>
            <option value="">None (root group)</option>
            {roots.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 8 }}>Colour</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? `3px solid ${T.textPri}` : '3px solid transparent', transition: 'border .15s' }} />
            ))}
          </div>
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
        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: 12, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Saving…' : group._id ? 'Update Group' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}
