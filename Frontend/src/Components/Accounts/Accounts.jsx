import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaLock, FaBook, FaUniversity, FaBalanceScale } from 'react-icons/fa';
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
  const [seeding, setSeeding] = useState(false);
  const [ledgerAccount, setLedgerAccount] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

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

  const handleSeed = async () => {
    if (!window.confirm('Seed 23 standard chart of accounts for this organisation?')) return;
    setSeeding(true);
    try {
      const res = await axiosInstance.post('/api/accounts/seed');
      nexusToast.success(res.data?.message || 'Accounts seeded');
      fetchAccounts();
    } catch {
      nexusToast.error('Failed to seed accounts');
    } finally {
      setSeeding(false);
    }
  };

  const openLedger = async (acc) => {
    setLedgerAccount(acc);
    setLedgerData(null);
    setLedgerLoading(true);
    try {
      const res = await axiosInstance.get(`/api/accounts/${acc._id}/ledger`);
      setLedgerData(res.data?.data ?? null);
    } catch {
      nexusToast.error('Failed to load ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/Reports/trial-balance')} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', background: 'transparent', color: T.textSec,
            border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <FaBalanceScale size={11} /> Trial Balance
          </button>
          <button onClick={handleSeed} disabled={seeding} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', background: 'transparent', color: T.textSec,
            border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <FaUniversity size={11} /> {seeding ? 'Seeding…' : 'Seed Defaults'}
          </button>
          <button onClick={() => navigate('/Finance/Accounts/New')} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', background: '#3b82f6', color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(59,130,246,.3)',
          }}>
            <FaPlus size={11} /> New Account
          </button>
        </div>
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
            {accounts.length === 0 ? (
              <div>
                <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 16px' }}>Get started by seeding the standard 23 default accounts.</p>
                <button onClick={handleSeed} disabled={seeding}
                  style={{ padding: '10px 24px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {seeding ? 'Seeding…' : 'Seed Default Accounts'}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>Try adjusting your search or filter.</p>
            )}
          </div>
        ) : filtered.map((a, i) => (
          <div key={a._id} className="acc-row"
            onClick={() => setDrawerAccount(a)}
            style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 160px 100px', padding: '13px 18px', borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', background: T.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, color: T.textPri }}>{a.accountCode}</span>
              {a.isSystem && <FaLock size={9} color={T.textMuted || T.textSec} title="System account" />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{a.accountName}</p>
                {a.isBankAccount && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)' }}>BANK</span>}
              </div>
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
              <button className="acc-action-btn" title="View Ledger" onClick={() => openLedger(a)}
                style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                <FaBook size={11} />
              </button>
              <button className="acc-action-btn" onClick={() => navigate(`/Finance/Accounts/${a._id}/edit`)}
                style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <FaEdit size={11} />
              </button>
              {!a.isSystem && (
                <button className="acc-action-btn" onClick={() => handleDelete(a._id)} disabled={deleting === a._id}
                  style={{ width: 30, height: 30, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <FaTrash size={11} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ledger drawer */}
      {ledgerAccount && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', justifyContent: 'flex-end' }}
          onClick={() => setLedgerAccount(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: 560, height: '100%', background: T.surface, borderLeft: `1.5px solid ${T.border}`, display: 'flex', flexDirection: 'column', zIndex: 1 }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaBook size={13} color="#3b82f6" />
                  <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>Account Ledger</h2>
                </div>
                <p style={{ fontSize: 12, color: T.textSec, margin: '3px 0 0' }}>
                  {ledgerAccount.accountCode} · {ledgerAccount.accountName}
                </p>
              </div>
              <button onClick={() => setLedgerAccount(null)}
                style={{ width: 32, height: 32, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <IoClose size={16} />
              </button>
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {ledgerLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: T.textSec, fontSize: 13 }}>Loading ledger…</div>
              ) : !ledgerData || ledgerData.rows.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
                  <FaBook size={28} color={T.textSec} style={{ opacity: 0.3 }} />
                  <p style={{ color: T.textSec, fontSize: 13, margin: 0 }}>No transactions posted to this account yet</p>
                </div>
              ) : (
                <>
                  {/* Balance badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: isDark ? 'rgba(59,130,246,0.08)' : '#eff6ff', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.textSec }}>Closing Balance</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700, color: '#3b82f6' }}>
                      AED {(ledgerData.balance ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {/* Table */}
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 80px 100px', padding: '8px 12px', background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                      {['Date', 'Reference', 'Debit', 'Credit', 'Balance'].map(h => (
                        <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec }}>{h}</span>
                      ))}
                    </div>
                    {ledgerData.rows.map((r, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 80px 100px', padding: '10px 12px', borderBottom: i < ledgerData.rows.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: T.textSec }}>{r.date}</span>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0 }}>{r.reference}</p>
                          {r.description && <p style={{ fontSize: 10, color: T.textSec, margin: '1px 0 0' }}>{r.description}</p>}
                        </div>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: r.debit > 0 ? T.textPri : 'transparent' }}>
                          {r.debit > 0 ? r.debit.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
                        </span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: r.credit > 0 ? T.textPri : 'transparent' }}>
                          {r.credit > 0 ? r.credit.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
                        </span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 600, color: (r.runningBalance ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                          {(r.runningBalance ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
            {drawerAccount.isSystem && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: isDark ? 'rgba(251,191,36,0.08)' : '#fffbeb', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, marginBottom: 16 }}>
                <FaLock size={11} color="#f59e0b" />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>System account — cannot be deleted</span>
              </div>
            )}
            {[
              ['Type', drawerAccount.accountType],
              ['Sub-type', (drawerAccount.subType || '—').replace(/_/g, ' ')],
              ['Normal Balance', drawerAccount.normalBalance || '—'],
              ['Bank/Cash', drawerAccount.isBankAccount ? 'Yes' : 'No'],
              ['Status', drawerAccount.status || 'active'],
              ['Description', drawerAccount.description || '—'],
              ['Created', drawerAccount.createdAt ? new Date(drawerAccount.createdAt).toLocaleDateString() : '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.textSec, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 12, color: T.textPri, fontWeight: 600, textTransform: 'capitalize', textAlign: 'right', maxWidth: '60%' }}>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
              <button onClick={() => { setDrawerAccount(null); openLedger(drawerAccount); }}
                style={{ flex: 1, padding: '10px', background: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', border: '1.5px solid rgba(59,130,246,0.3)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#3b82f6', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <FaBook size={11} /> Ledger
              </button>
              <button onClick={() => navigate(`/Finance/Accounts/${drawerAccount._id}/edit`)}
                style={{ flex: 1, padding: '10px', background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: T.textPri, fontFamily: 'inherit' }}>
                Edit
              </button>
              {!drawerAccount.isSystem && (
                <button onClick={() => handleDelete(drawerAccount._id)} disabled={deleting === drawerAccount._id}
                  style={{ flex: 1, padding: '10px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#dc2626', fontFamily: 'inherit' }}>
                  {deleting === drawerAccount._id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
