import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch, FaEdit, FaTrash } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

const TYPE_COLORS = {
  asset:     { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dark: 'rgba(59,130,246,0.15)' },
  liability: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dark: 'rgba(239,68,68,0.15)'  },
  equity:    { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', dark: 'rgba(34,197,94,0.15)'  },
  income:    { bg: '#fefce8', text: '#ca8a04', border: '#fde68a', dark: 'rgba(234,179,8,0.15)'  },
  expense:   { bg: '#fdf4ff', text: '#9333ea', border: '#e9d5ff', dark: 'rgba(147,51,234,0.15)' },
};

const TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense'];

export default function Accounts() {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [accounts, setAccounts] = useState([]);
  const [stats, setStats]       = useState({});
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [drawerAccount, setDrawerAccount] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, statsRes] = await Promise.all([
        axiosInstance.get('/api/accounts/?limit=500'),
        axiosInstance.get('/api/accounts/stats'),
      ]);
      setAccounts(accRes.data?.data?.accounts || []);
      setStats(statsRes.data?.data?.byType || {});
    } catch {
      nexusToast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const filtered = accounts.filter(a => {
    const matchType   = typeFilter === 'all' || a.accountType === typeFilter;
    const matchSearch = !search ||
      a.accountCode?.toLowerCase().includes(search.toLowerCase()) ||
      a.accountName?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await axiosInstance.delete(`/api/accounts/${id}`);
      nexusToast.success('Account deleted');
      setDrawerAccount(null);
      fetchAccounts();
    } catch {
      nexusToast.error('Failed to delete account');
    } finally {
      setDeleting(null);
    }
  };

  const typeColor = (type, shade = 'text') => {
    const c = TYPE_COLORS[type];
    if (!c) return T.textSec;
    if (shade === 'bg')     return isDark ? c.dark   : c.bg;
    if (shade === 'border') return isDark ? c.border + '55' : c.border;
    return isDark ? c.border : c.text;
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .acc-row { transition: background .12s; cursor: pointer; }
        .acc-row:hover { background: ${isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'} !important; }
        .acc-action-btn { transition: all .15s; }
        .acc-action-btn:hover { background: ${isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'} !important; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.03em' }}>
            Chart of Accounts
          </h1>
          <p style={{ fontSize: 13, color: T.textSec, margin: '4px 0 0' }}>
            Manage your ledger accounts used in sales, purchases, and inventory
          </p>
        </div>
        <button onClick={() => navigate('/Finance/Accounts/New')} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', background: '#3b82f6', color: '#fff',
          border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)',
        }}>
          <FaPlus size={11} /> New Account
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
        {TYPE_ORDER.map(type => (
          <div key={type} onClick={() => setTypeFilter(t => t === type ? 'all' : type)}
            style={{
              padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
              background: typeFilter === type ? typeColor(type, 'bg') : T.surface,
              border: `1.5px solid ${typeFilter === type ? typeColor(type, 'border') : T.border}`,
              transition: 'all .15s',
            }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: typeColor(type), margin: '0 0 6px' }}>
              {type}
            </p>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 700, color: typeColor(type), margin: 0, lineHeight: 1 }}>
              {stats[type] || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 40, border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface }}>
          <FaSearch size={12} color={T.textSec} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by code or name…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T.textPri, fontFamily: 'inherit' }} />
          {search && <IoClose size={14} color={T.textSec} style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '0 14px', height: 40, border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface, color: T.textPri, fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <option value="all">All Types</option>
          {TYPE_ORDER.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 160px 80px', padding: '10px 18px', borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
          {['Code', 'Name', 'Type', 'Sub-type', ''].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: T.textSec, fontSize: 13 }}>Loading accounts…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: '0 0 6px' }}>No accounts found</p>
            <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>
              {accounts.length === 0 ? 'Create your first account to get started.' : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : filtered.map((a, i) => (
          <div key={a._id} className="acc-row"
            onClick={() => setDrawerAccount(a)}
            style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 160px 80px', padding: '13px 18px', borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', background: T.surface }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, color: T.textPri }}>{a.accountCode}</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{a.accountName}</p>
              {a.description && <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</p>}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999,
              fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
              background: typeColor(a.accountType, 'bg'), color: typeColor(a.accountType),
              border: `1px solid ${typeColor(a.accountType, 'border')}`,
              width: 'fit-content',
            }}>{a.accountType}</span>
            <span style={{ fontSize: 12, color: T.textSec, textTransform: 'capitalize' }}>{(a.subType || '').replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
              <button className="acc-action-btn" onClick={() => navigate(`/Finance/Accounts/${a._id}/edit`)}
                style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <FaEdit size={11} />
              </button>
              <button className="acc-action-btn" onClick={() => handleDelete(a._id)} disabled={deleting === a._id}
                style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <FaTrash size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail drawer */}
      {drawerAccount && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
          onClick={() => setDrawerAccount(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: 380, height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, padding: 28, overflowY: 'auto', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 700, color: T.textPri, margin: 0 }}>Account Details</h2>
              <button onClick={() => setDrawerAccount(null)}
                style={{ width: 32, height: 32, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <IoClose size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', background: typeColor(drawerAccount.accountType, 'bg'), borderRadius: 12, border: `1.5px solid ${typeColor(drawerAccount.accountType, 'border')}`, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: typeColor(drawerAccount.accountType, 'bg'), border: `2px solid ${typeColor(drawerAccount.accountType, 'border')}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700, color: typeColor(drawerAccount.accountType) }}>
                  {drawerAccount.accountCode?.slice(0, 2)}
                </span>
              </div>
              <div>
                <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: typeColor(drawerAccount.accountType), margin: '0 0 3px', fontWeight: 600 }}>{drawerAccount.accountCode}</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>{drawerAccount.accountName}</p>
              </div>
            </div>
            {[
              ['Type', drawerAccount.accountType],
              ['Sub-type', (drawerAccount.subType || '—').replace(/_/g, ' ')],
              ['Status', drawerAccount.status || 'active'],
              ['Description', drawerAccount.description || '—'],
              ['Created', drawerAccount.createdAt ? new Date(drawerAccount.createdAt).toLocaleDateString() : '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.textSec, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 12, color: T.textPri, fontWeight: 600, textTransform: 'capitalize', textAlign: 'right', maxWidth: '60%' }}>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => navigate(`/Finance/Accounts/${drawerAccount._id}/edit`)}
                style={{ flex: 1, padding: '10px', background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: T.textPri, fontFamily: 'inherit' }}>
                Edit
              </button>
              <button onClick={() => handleDelete(drawerAccount._id)} disabled={deleting === drawerAccount._id}
                style={{ flex: 1, padding: '10px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'inherit' }}>
                {deleting === drawerAccount._id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
