import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaStar, FaTags } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

const CURRENCIES = ['AED','USD','EUR','GBP','SAR','INR'];

export default function PriceLists() {
  const navigate  = useNavigate();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = { ...getTheme(isDark), isDark };

  const [lists, setLists]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer]   = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/api/price-lists/');
      setLists(res.data?.data?.priceLists || []);
    } catch {
      nexusToast.error('Failed to load price lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axiosInstance.delete(`/api/price-lists/${id}`);
      nexusToast.success('Price list deleted');
      setDrawer(null);
      fetchLists();
    } catch {
      nexusToast.error('Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .pl-card:hover { transform: translateY(-2px); box-shadow: ${isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)'} !important; }
        .pl-btn:hover  { background: ${isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'} !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>Price Lists</h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>Manage pricing tiers for different customers or scenarios</p>
        </div>
        <button onClick={() => navigate('/Items/price-lists/new')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)' }}>
          <FaPlus size={11} /> New Price List
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Lists',   val: lists.length,                                  color: '#3b82f6' },
          { label: 'Active',        val: lists.filter(l => l.status === 'active').length, color: '#10b981' },
          { label: 'Default List',  val: lists.find(l => l.isDefault)?.name || '—',     color: '#f59e0b', mono: false },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 18px', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 6px' }}>{s.label}</p>
            <p style={{ fontFamily: s.mono !== false ? "'DM Mono',monospace" : 'inherit', fontSize: s.mono !== false ? 24 : 15, fontWeight: 700, color: s.color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: T.textSec, fontSize: 13 }}>Loading…</div>
      ) : lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}` }}>
          <FaTags size={28} color={T.border} style={{ display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No price lists yet</p>
          <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>Create a price list to manage custom pricing for different customers.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {lists.map(pl => (
            <div key={pl._id} className="pl-card" onClick={() => setDrawer(pl)}
              style={{ background: T.surface, border: `1.5px solid ${pl.isDefault ? '#f59e0b' : T.border}`, borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all .18s', boxShadow: T.isDark ? '0 2px 8px rgba(0,0,0,.25)' : '0 2px 6px rgba(0,0,0,.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    {pl.isDefault && <FaStar size={11} color="#f59e0b" />}
                    <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>{pl.name}</p>
                  </div>
                  {pl.description && <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>{pl.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button className="pl-btn" onClick={() => navigate(`/Items/price-lists/${pl._id}/edit`)}
                    style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                    <FaEdit size={10} />
                  </button>
                  <button className="pl-btn" onClick={() => handleDelete(pl._id)} disabled={deleting === pl._id}
                    style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 7, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                    <FaTrash size={10} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: '#3b82f6', fontWeight: 700 }}>{pl.currency || 'AED'}</span>
                {pl.adjustment !== 0 && pl.adjustment != null && (
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: pl.adjustment > 0 ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'), color: pl.adjustment > 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                    {pl.adjustment > 0 ? '+' : ''}{pl.adjustment}%
                  </span>
                )}
                {(pl.items?.length || 0) > 0 && (
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: T.surface2, color: T.textSec, fontWeight: 600 }}>{pl.items.length} item{pl.items.length > 1 ? 's' : ''}</span>
                )}
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 700, textTransform: 'capitalize', background: pl.status === 'active' ? (isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : T.surface2, color: pl.status === 'active' ? '#10b981' : T.textSec }}>
                  {pl.status || 'active'}
                </span>
              </div>

              {(pl.validFrom || pl.validTo) && (
                <p style={{ fontSize: 10, color: T.textSec, margin: '10px 0 0', fontFamily: "'DM Mono',monospace" }}>
                  {pl.validFrom ? new Date(pl.validFrom).toLocaleDateString() : '∞'} → {pl.validTo ? new Date(pl.validTo).toLocaleDateString() : '∞'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setDrawer(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: 400, height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 24, overflowY: 'auto', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{drawer.name}</h2>
              <button onClick={() => setDrawer(null)} style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}><IoClose size={14} /></button>
            </div>
            {[
              ['Currency', drawer.currency || 'AED'],
              ['Adjustment', drawer.adjustment ? `${drawer.adjustment > 0 ? '+' : ''}${drawer.adjustment}% ${drawer.adjustmentType === 'percentage' ? '(% of base)' : '(fixed)'}` : 'None'],
              ['Default', drawer.isDefault ? 'Yes' : 'No'],
              ['Status', drawer.status || 'active'],
              ['Valid From', drawer.validFrom ? new Date(drawer.validFrom).toLocaleDateString() : '—'],
              ['Valid To', drawer.validTo ? new Date(drawer.validTo).toLocaleDateString() : '—'],
              ['Item Overrides', (drawer.items?.length || 0) + ' items'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.textSec }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textPri, textTransform: 'capitalize' }}>{v}</span>
              </div>
            ))}
            {drawer.items?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 10px' }}>Item Overrides</p>
                {drawer.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 12, color: T.textPri }}>{item.itemName || item.itemId}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', fontFamily: "'DM Mono',monospace" }}>AED {item.price?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => navigate(`/Items/price-lists/${drawer._id}/edit`)} style={{ flex: 1, padding: 10, background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: T.textPri, fontFamily: 'inherit' }}>Edit</button>
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
