import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaPlus, FaTimes, FaSearch, FaBoxOpen,
  FaChevronLeft, FaChevronRight,
  FaFileInvoiceDollar, FaBan,
  FaCheckCircle, FaClock, FaTimesCircle, FaSpinner,
  FaTruck, FaDownload, FaFilter, FaEllipsisV,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import axiosInstance from '../../helper/axiosInstance';

const STATUS_CFG = {
  draft:            { label: 'Draft',            color: '#64748b', dimKey: 'surface2'  },
  pending_approval: { label: 'Pending Approval', color: '#f59e0b', dimKey: 'amberDim'  },
  issued:           { label: 'Issued',           color: '#8b5cf6', dimKey: 'purpleDim' },
  received:         { label: 'Received',         color: '#10b981', dimKey: 'greenDim'  },
  cancelled:        { label: 'Cancelled',        color: '#ef4444', dimKey: 'redDim'    },
  partial:          { label: 'Partial',          color: '#06b6d4', dimKey: 'cyanDim'   },
};
const STATUS_TABS = ['all','draft','pending_approval','issued','received','partial','cancelled'];

const StatCard = ({ label, value, accent, dimBg, icon, T }) => (
  <div style={{ background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:14, padding:'16px 18px', display:'flex', alignItems:'center', gap:14, boxShadow:T.isDark?'0 2px 10px rgba(0,0,0,.25)':'0 2px 6px rgba(0,0,0,.04)' }}>
    <div style={{ width:40, height:40, borderRadius:11, background:dimBg, color:accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{icon}</div>
    <div>
      <p style={{ fontFamily:"'Sora',sans-serif", fontSize:20, fontWeight:800, color:T.textPri, margin:0, lineHeight:1 }}>{value}</p>
      <p style={{ fontSize:11, fontWeight:600, color:T.textSec, margin:'3px 0 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</p>
    </div>
  </div>
);

const Badge = ({ status, T }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:999, fontSize:10, fontWeight:700, background:T[cfg.dimKey]||T.surface2, color:cfg.color, border:`1px solid ${cfg.color}33`, textTransform:'capitalize' }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:cfg.color }} />{cfg.label}
    </span>
  );
};

const Empty = ({ T, onNew }) => (
  <div style={{ textAlign:'center', padding:'72px 0' }}>
    <div style={{ width:64, height:64, borderRadius:18, background:T.blueDim, color:T.blue, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:26 }}><FaBoxOpen /></div>
    <p style={{ fontFamily:"'Sora',sans-serif", fontSize:15, fontWeight:700, color:T.textPri, margin:'0 0 6px' }}>No purchase orders yet</p>
    <p style={{ fontSize:13, color:T.textSec, margin:'0 0 20px' }}>Create your first purchase order to get started</p>
    <button onClick={onNew} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'#fff', border:'none', borderRadius:11, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 14px rgba(59,130,246,.35)' }}>
      <FaPlus size={11} /> New Purchase Order
    </button>
  </div>
);

const DRow = ({ label, value, T }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
    <span style={{ fontSize:11, color:T.textSec, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', flexShrink:0, marginRight:12 }}>{label}</span>
    <span style={{ fontSize:13, color:T.textPri, fontWeight:500, textAlign:'right', wordBreak:'break-word' }}>{value||'—'}</span>
  </div>
);

export default function Purchaseorders() {
  const navigate = useNavigate();
  const isDark   = useThemeStore(s => s.isDark);
  const T        = { ...getTheme(isDark), isDark };

  const [orders,      setOrders]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [stats,       setStats]       = useState({ total:0, pending:0, ordered:0, received:0, totalValue:0 });
  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState('all');
  const [sortField,   setSortField]   = useState('createdAt');
  const [sortDir,     setSortDir]     = useState('desc');
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [totalCount,  setTotalCount]  = useState(0);
  const [drawer,         setDrawer]         = useState(false);
  const [selected,       setSelected]       = useState(null);
  const [activeTab,      setActiveTab]      = useState('overview');
  const [markingReceived,setMarkingReceived]= useState(false);
  const [cancelling,     setCancelling]     = useState(false);
  const [linkedGRNs,     setLinkedGRNs]     = useState([]);
  const [grnsLoading,    setGrnsLoading]    = useState(false);
  const PER_PAGE = 15;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: PER_PAGE, ...(statusFilter !== 'all' && { status: statusFilter }), ...(search.trim() && { q: search.trim() }), sortBy: sortField, sortDir });
      const res  = await axiosInstance.get(`/api/purchase-orders/getorders?${params}`);
      const d    = res.data?.data ?? {};
      const list = Array.isArray(d.purchaseOrders) ? d.purchaseOrders : Array.isArray(d) ? d : [];
      setOrders(list);
      setTotalPages(d.totalPages ?? 1);
      setTotalCount(d.total ?? list.length);
    } catch { setOrders([]); } finally { setLoading(false); }
  }, [page, statusFilter, search, sortField, sortDir]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/api/purchase-orders/stats');
      const d   = res.data?.data ?? {};
      setStats({ total: d.totalOrders??0, pending: d.pendingOrders??0, ordered: d.orderedOrders??0, received: d.receivedOrders??0, totalValue: d.totalAmount??0 });
    } catch {}
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchStats();  }, [fetchStats]);

  const openDrawer  = (o) => { setSelected(o); setDrawer(true); setActiveTab('overview'); setLinkedGRNs([]); };
  const closeDrawer = ()  => { setDrawer(false); setSelected(null); };

  useEffect(() => {
    if (!selected?._id) return;
    setGrnsLoading(true);
    axiosInstance.get(`/api/grns/?purchaseOrderId=${selected._id}`)
      .then(r => setLinkedGRNs(r.data?.data?.grns || []))
      .catch(() => setLinkedGRNs([]))
      .finally(() => setGrnsLoading(false));
  }, [selected?._id]);
  const handleSort  = (f) => { if (sortField===f) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortField(f); setSortDir('desc'); } };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-AE',{day:'numeric',month:'short',year:'numeric'}) : '—';
  const fmtAmt  = n => `AED ${Number(n||0).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const displayed = orders.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (o.orderNumber||'').toLowerCase().includes(q)||(o.vendorName||'').toLowerCase().includes(q)||(o.status||'').toLowerCase().includes(q);
  });

  const border   = T.border;
  const thS = (f) => ({ padding:'11px 14px', fontSize:10, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:T.textSec, textAlign:'left', background:T.surface2, borderBottom:`1.5px solid ${border}`, cursor:f?'pointer':'default', userSelect:'none', whiteSpace:'nowrap' });
  const tdS = { padding:'12px 14px', fontSize:13, color:T.textPri, verticalAlign:'middle', borderBottom:`1px solid ${border}` };
  const SortIcon = ({ field }) => sortField!==field
    ? <span style={{color:T.textMuted,marginLeft:4,fontSize:9}}>↕</span>
    : <span style={{color:T.blue,marginLeft:4,fontSize:9}}>{sortDir==='asc'?'↑':'↓'}</span>;

  return (
    <>
      <style>{`
        @keyframes poSlideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes poOverlay { from{opacity:0} to{opacity:1} }
        @keyframes poFadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        .po-row:hover { background:${isDark?'rgba(255,255,255,.025)':'#f8fafc'} !important; }
        .po-tab { transition:all .15s; border-bottom:2px solid transparent; }
        .po-tab:hover { color:${isDark?'#94a3b8':'#374151'} !important; }
        .po-tab-active { color:${isDark?'#60a5fa':'#2563eb'} !important; border-bottom-color:${isDark?'#3b82f6':'#2563eb'} !important; }
        .po-pill:hover { border-color:${isDark?'rgba(59,130,246,0.3)':'#bfdbfe'} !important; color:${isDark?'#60a5fa':'#1d4ed8'} !important; }
        .po-pill-active { background:${isDark?'rgba(59,130,246,0.15)':'#eff6ff'} !important; color:${isDark?'#60a5fa':'#1d4ed8'} !important; border-color:${isDark?'rgba(59,130,246,0.35)':'#bfdbfe'} !important; font-weight:700 !important; }
        .po-num { color:${isDark?'#60a5fa':'#2563eb'}; cursor:pointer; font-weight:600; transition:color .12s; font-family:'DM Mono',monospace; font-size:12px; }
        .po-num:hover { color:${isDark?'#93c5fd':'#1d4ed8'}; text-decoration:underline; }
        .po-icon-btn { background:none; border:none; cursor:pointer; border-radius:8px; padding:6px 8px; transition:background .12s; color:${T.textSec}; }
        .po-icon-btn:hover { background:${isDark?'rgba(255,255,255,.06)':'#f1f5f9'}; }
        .po-drawer { animation:poSlideIn .25s cubic-bezier(0.16,1,0.3,1) forwards; }
        .po-overlay { animation:poOverlay .2s ease forwards; }
      `}</style>

      <div style={{ minHeight:'100vh', background:T.bg, padding:'24px 24px 80px', animation:'poFadeUp .3s ease both' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22 }}>
          <div>
            <h1 style={{ fontFamily:"'Sora',sans-serif", fontSize:20, fontWeight:800, color:T.textPri, margin:'0 0 3px', letterSpacing:'-0.02em' }}>Purchase Orders</h1>
            <p style={{ fontSize:12, color:T.textSec, margin:0 }}>Manage and track all procurement orders</p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="po-icon-btn" title="Export"><FaDownload size={12}/></button>
            <button className="po-icon-btn" title="More"><FaEllipsisV size={12}/></button>
            <button onClick={() => navigate('/Purchase/Purchaseorders/Newpurchaseorders')} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', background:'linear-gradient(135deg,#3b82f6,#2563eb)', color:'#fff', border:'none', borderRadius:11, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 14px rgba(59,130,246,.35)' }}>
              <FaPlus size={10}/> New Order
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:22 }}>
          <StatCard T={T} label="Total Orders" value={stats.total}    accent={T.blue}   dimBg={T.blueDim}   icon={<FaFileInvoiceDollar/>}/>
          <StatCard T={T} label="Pending"      value={stats.pending}  accent={T.amber}  dimBg={T.amberDim}  icon={<FaClock/>}/>
          <StatCard T={T} label="Ordered"      value={stats.ordered}  accent={T.purple} dimBg={T.purpleDim} icon={<FaTruck/>}/>
          <StatCard T={T} label="Received"     value={stats.received} accent={T.green}  dimBg={T.greenDim}  icon={<FaCheckCircle/>}/>
          <StatCard T={T} label="Total Value"  value={fmtAmt(stats.totalValue)} accent={T.cyan} dimBg={T.cyanDim} icon={<FaBoxOpen/>}/>
        </div>

        {/* Main card */}
        <div style={{ background:T.surface, borderRadius:16, border:`1.5px solid ${border}`, boxShadow:isDark?'0 2px 12px rgba(0,0,0,.3)':'0 2px 8px rgba(0,0,0,.04)', overflow:'hidden' }}>

          {/* Toolbar */}
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, background:T.surface2, border:`1.5px solid ${border}`, borderRadius:10, padding:'8px 13px', flex:'1 1 260px', maxWidth:380 }}>
              <FaSearch size={12} style={{ color:T.textSec, flexShrink:0 }}/>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search order no., vendor…" style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:T.textPri, fontFamily:"'DM Sans',sans-serif" }}/>
              {search && <button onClick={()=>{setSearch('');setPage(1);}} style={{ background:'none', border:'none', cursor:'pointer', color:T.textSec, padding:0, display:'flex', lineHeight:1 }}><FaTimes size={11}/></button>}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button className="po-icon-btn" style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', border:`1.5px solid ${border}`, borderRadius:9, fontSize:12, fontWeight:600, fontFamily:'inherit', color:T.textSec }}>
                <FaFilter size={10}/> Filter
              </button>
              <span style={{ fontSize:11, color:T.textSec, background:T.surface2, border:`1px solid ${border}`, padding:'5px 11px', borderRadius:8, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>
                {totalCount} order{totalCount!==1?'s':''}
              </span>
            </div>
          </div>

          {/* Status tabs */}
          <div style={{ display:'flex', padding:'0 18px', borderBottom:`1px solid ${border}`, gap:2, overflowX:'auto' }}>
            {STATUS_TABS.map(s => (
              <button key={s} className={`po-pill${statusFilter===s?' po-pill-active':''}`} onClick={()=>{setStatusFilter(s);setPage(1);}}
                style={{ padding:'10px 14px', background:'none', border:'none', fontSize:12, fontWeight:500, color:T.textSec, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', textTransform:'capitalize', transition:'all .15s' }}>
                {s==='all'?'All Orders':STATUS_CFG[s]?.label??s}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'60px 0', gap:10, color:T.textSec }}>
              <FaSpinner size={18} style={{ animation:'spin 1s linear infinite' }}/>
              <span style={{ fontSize:13, fontWeight:600 }}>Loading orders…</span>
            </div>
          ) : displayed.length === 0 ? (
            <Empty T={T} onNew={()=>navigate('/Purchase/Purchaseorders/Newpurchaseorders')}/>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thS(), width:40, textAlign:'center' }}><input type="checkbox" style={{ accentColor:T.blue }}/></th>
                    <th style={thS('orderNumber')} onClick={()=>handleSort('orderNumber')}>Order No. <SortIcon field="orderNumber"/></th>
                    <th style={thS('vendorName')}  onClick={()=>handleSort('vendorName')}>Vendor <SortIcon field="vendorName"/></th>
                    <th style={thS('orderDate')}   onClick={()=>handleSort('orderDate')}>Order Date <SortIcon field="orderDate"/></th>
                    <th style={thS()}>Expected By</th>
                    <th style={thS()}>Payment Terms</th>
                    <th style={thS('status')}      onClick={()=>handleSort('status')}>Status <SortIcon field="status"/></th>
                    <th style={{ ...thS('total'), textAlign:'right' }} onClick={()=>handleSort('total')}>Total <SortIcon field="total"/></th>
                    <th style={{ ...thS(), textAlign:'center', width:80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((o,i) => (
                    <tr key={o._id||o.id||i} className="po-row">
                      <td style={{ ...tdS, textAlign:'center' }}><input type="checkbox" style={{ accentColor:T.blue }}/></td>
                      <td style={tdS}><span className="po-num" onClick={()=>openDrawer(o)}>{o.orderNumber||`PO-${String(i+1).padStart(4,'0')}`}</span></td>
                      <td style={tdS}>
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <div style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:T.blueDim, color:T.blue, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Sora',sans-serif", fontSize:10, fontWeight:800 }}>
                            {(o.vendorName||'V')[0].toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin:0, fontSize:13, fontWeight:600, color:T.textPri }}>{o.vendorName||'—'}</p>
                            {o.vendorCode && <p style={{ margin:0, fontSize:10, color:T.textSec, fontFamily:"'DM Mono',monospace" }}>{o.vendorCode}</p>}
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdS, fontSize:12, color:T.textSec }}>{fmtDate(o.orderDate)}</td>
                      <td style={{ ...tdS, fontSize:12, color:T.textSec }}>{fmtDate(o.expectedDeliveryDate||o.expectedDate)}</td>
                      <td style={tdS}>{o.paymentTerms ? <span style={{ background:T.surface2, border:`1px solid ${border}`, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600, color:T.textSec }}>{o.paymentTerms}</span> : <span style={{ color:T.textSec }}>—</span>}</td>
                      <td style={tdS}><Badge status={o.status||'draft'} T={T}/></td>
                      <td style={{ ...tdS, textAlign:'right', fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:700 }}>{fmtAmt(o.total)}</td>
                      <td style={{ ...tdS, textAlign:'center' }}>
                        <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                          <button className="po-icon-btn" title="View" onClick={()=>openDrawer(o)}><FaFileInvoiceDollar size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderTop:`1px solid ${border}` }}>
              <span style={{ fontSize:12, color:T.textSec }}>Page {page} of {totalPages} · {totalCount} total</span>
              <div style={{ display:'flex', gap:6 }}>
                <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:T.surface2, border:`1.5px solid ${border}`, borderRadius:8, fontSize:12, fontWeight:600, color:page<=1?T.textSec:T.textPri, cursor:page<=1?'not-allowed':'pointer', opacity:page<=1?0.5:1, fontFamily:'inherit' }}><FaChevronLeft size={9}/> Prev</button>
                {Array.from({length:Math.min(totalPages,5)},(_,i)=>{const pg=totalPages<=5?i+1:page<=3?i+1:page>=totalPages-2?totalPages-4+i:page-2+i;return(
                  <button key={pg} onClick={()=>setPage(pg)} style={{ width:32, height:32, borderRadius:8, background:page===pg?T.blue:T.surface2, border:`1.5px solid ${page===pg?T.blue:border}`, color:page===pg?'#fff':T.textPri, fontSize:12, fontWeight:700, cursor:'pointer' }}>{pg}</button>
                );}).filter(Boolean)}
                <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', background:T.surface2, border:`1.5px solid ${border}`, borderRadius:8, fontSize:12, fontWeight:600, color:page>=totalPages?T.textSec:T.textPri, cursor:page>=totalPages?'not-allowed':'pointer', opacity:page>=totalPages?0.5:1, fontFamily:'inherit' }}>Next <FaChevronRight size={9}/></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawer */}
      {drawer && selected && (
        <div style={{ position:'fixed', inset:0, zIndex:1000 }}>
          <div className="po-overlay" onClick={closeDrawer} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.45)', backdropFilter:'blur(6px)' }}/>
          <div className="po-drawer" style={{ position:'absolute', right:0, top:0, bottom:0, width:480, maxWidth:'100vw', background:T.surface, borderLeft:`1.5px solid ${border}`, display:'flex', flexDirection:'column', boxShadow:'-20px 0 60px rgba(0,0,0,.3)' }}>

            {/* Drawer header */}
            <div style={{ padding:'16px 20px', borderBottom:`1px solid ${border}`, flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <p style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color:T.blue, margin:0 }}>{selected.orderNumber||'PO-DRAFT'}</p>
                    <Badge status={selected.status||'draft'} T={T}/>
                  </div>
                  <p style={{ fontFamily:"'Sora',sans-serif", fontSize:16, fontWeight:800, color:T.textPri, margin:0 }}>{selected.vendorName||'Unknown Vendor'}</p>
                  <p style={{ fontSize:11, color:T.textSec, margin:'3px 0 0' }}>{fmtDate(selected.orderDate)}</p>
                </div>
                <button onClick={closeDrawer} className="po-icon-btn" style={{ padding:8, marginTop:-4 }}><FaTimes size={14}/></button>
              </div>
              <div style={{ marginTop:14, padding:'12px 16px', borderRadius:12, background:isDark?'rgba(59,130,246,.1)':'#eff6ff', border:`1.5px solid ${isDark?'rgba(59,130,246,.25)':'#bfdbfe'}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:11, fontWeight:700, color:T.textSec, textTransform:'uppercase', letterSpacing:'0.06em' }}>Order Total</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:18, fontWeight:800, color:T.blue }}>{fmtAmt(selected.total)}</span>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:`1px solid ${border}`, padding:'0 20px', flexShrink:0 }}>
              {[['overview','Overview'],['items','Items'],['grns',`GRNs (${linkedGRNs.length})`],['history','History']].map(([tab,label]) => (
                <button key={tab} className={`po-tab${activeTab===tab?' po-tab-active':''}`} onClick={()=>setActiveTab(tab)}
                  style={{ padding:'11px 14px', background:'none', border:'none', fontSize:12, fontWeight:600, color:T.textSec, cursor:'pointer', fontFamily:'inherit' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>

              {activeTab==='overview' && (
                <div>
                  <div style={{ background:T.surface2, border:`1.5px solid ${border}`, borderRadius:12, padding:'14px 16px', marginBottom:18 }}>
                    <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:T.textSec, margin:'0 0 10px' }}>Vendor</p>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:40, height:40, borderRadius:11, background:T.blueDim, color:T.blue, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Sora',sans-serif", fontSize:14, fontWeight:800, flexShrink:0 }}>
                        {(selected.vendorName||'V')[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin:0, fontSize:14, fontWeight:700, color:T.textPri }}>{selected.vendorName||'—'}</p>
                        {selected.vendorCode && <p style={{ margin:'2px 0 0', fontSize:11, color:T.textSec, fontFamily:"'DM Mono',monospace" }}>{selected.vendorCode}</p>}
                      </div>
                    </div>
                  </div>
                  <DRow label="Order Number"  value={selected.orderNumber} T={T}/>
                  <DRow label="Order Date"    value={fmtDate(selected.orderDate)} T={T}/>
                  <DRow label="Expected By"   value={fmtDate(selected.expectedDeliveryDate||selected.expectedDate)} T={T}/>
                  <DRow label="Payment Terms" value={selected.paymentTerms} T={T}/>
                  <DRow label="Delivery To"   value={selected.deliveryAddress||selected.warehouse} T={T}/>
                  <DRow label="Reference No." value={selected.referenceNo||selected.lpoNumber} T={T}/>
                  <DRow label="Created By"    value={selected.createdBy} T={T}/>
                  <DRow label="Sub Total"     value={fmtAmt(selected.subTotal)} T={T}/>
                  <DRow label="Shipping"      value={fmtAmt(selected.shippingCharges)} T={T}/>
                  <DRow label="Adjustment"    value={fmtAmt(selected.adjustment)} T={T}/>
                  <DRow label="VAT (5%)"      value={fmtAmt(selected.totalTax ?? selected.vat)} T={T}/>
                  {selected.notes && (
                    <div style={{ marginTop:14, padding:12, background:T.surface2, border:`1px solid ${border}`, borderRadius:10 }}>
                      <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:T.textSec, margin:'0 0 6px' }}>Notes</p>
                      <p style={{ fontSize:13, color:T.textPri, margin:0, lineHeight:1.5 }}>{selected.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab==='items' && (
                <div>
                  {Array.isArray(selected.items) && selected.items.length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {selected.items.map((item,i) => (
                        <div key={i} style={{ border:`1.5px solid ${border}`, borderRadius:12, padding:'13px 15px', background:T.surface2 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                            <div>
                              <p style={{ margin:0, fontSize:13, fontWeight:700, color:T.textPri }}>{item.itemName||item.name||item.itemId||'—'}</p>
                              {item.details && <p style={{ margin:'2px 0 0', fontSize:11, color:T.textSec }}>{item.details}</p>}
                            </div>
                            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color:T.textPri }}>{fmtAmt(item.amount)}</span>
                          </div>
                          <div style={{ display:'flex', gap:16 }}>
                            <span style={{ fontSize:11, color:T.textSec }}>Qty: <strong style={{ color:T.textPri }}>{item.quantity}</strong></span>
                            <span style={{ fontSize:11, color:T.textSec }}>Rate: <strong style={{ color:T.textPri, fontFamily:"'DM Mono',monospace" }}>AED {item.rate}</strong></span>
                            {item.discount>0 && <span style={{ fontSize:11, color:T.amber }}>Disc: {item.discountType==='fixed' ? `AED ${item.discount}` : `${item.discount}%`}</span>}
                          </div>
                        </div>
                      ))}
                      <div style={{ display:'flex', justifyContent:'flex-end', padding:'12px 0 0', borderTop:`1px solid ${border}` }}>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ margin:0, fontSize:11, color:T.textSec, fontWeight:600 }}>ORDER TOTAL</p>
                          <p style={{ margin:'3px 0 0', fontFamily:"'DM Mono',monospace", fontSize:18, fontWeight:800, color:T.blue }}>{fmtAmt(selected.total)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign:'center', padding:'48px 0' }}>
                      <FaBoxOpen size={32} style={{ color:T.textSec, opacity:0.4, marginBottom:10 }}/>
                      <p style={{ fontSize:13, color:T.textSec, margin:0 }}>No line items</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab==='grns' && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                    <p style={{ fontFamily:"'Sora',sans-serif", fontSize:13, fontWeight:700, color:T.textPri, margin:0 }}>Linked GRNs</p>
                    {selected.status === 'issued' && (
                      <button onClick={() => navigate(`/Purchase/GRN/new?poId=${selected._id}&poNumber=${selected.orderNumber}&vendorId=${selected.vendorId}&vendorName=${encodeURIComponent(selected.vendorName||'')}`)}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', border:'none', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                        <FaTruck size={11}/> Create GRN
                      </button>
                    )}
                  </div>
                  {grnsLoading ? (
                    <div style={{ textAlign:'center', padding:'32px 0', color:T.textSec }}>
                      <FaSpinner size={16} style={{ animation:'spin 1s linear infinite' }}/>
                    </div>
                  ) : linkedGRNs.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'48px 0' }}>
                      <FaBoxOpen size={28} style={{ color:T.textSec, opacity:0.4, marginBottom:10 }}/>
                      <p style={{ fontSize:13, color:T.textSec, margin:0 }}>No GRNs yet for this PO</p>
                      {selected.status === 'issued' && (
                        <button onClick={() => navigate(`/Purchase/GRN/new?poId=${selected._id}&poNumber=${selected.orderNumber}&vendorId=${selected.vendorId}&vendorName=${encodeURIComponent(selected.vendorName||'')}`)}
                          style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#10b981', color:'#fff', border:'none', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                          <FaTruck size={11}/> Create First GRN
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {linkedGRNs.map((g,i) => (
                        <div key={g._id||i} style={{ border:`1.5px solid ${border}`, borderRadius:12, padding:'13px 15px', background:T.surface2 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                            <div>
                              <p style={{ margin:0, fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700, color:T.blue }}>{g.grnNumber}</p>
                              <p style={{ margin:'3px 0 0', fontSize:11, color:T.textSec }}>{fmtDate(g.receiptDate)} · {g.items?.length||0} item(s)</p>
                            </div>
                            <div style={{ textAlign:'right' }}>
                              <p style={{ margin:0, fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700, color:T.textPri }}>{fmtAmt(g.total)}</p>
                              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:999, background:g.status==='confirmed'?T.greenDim:T.surface2, color:g.status==='confirmed'?T.green:T.textSec, border:`1px solid ${g.status==='confirmed'?T.green+'44':border}` }}>{g.status||'draft'}</span>
                            </div>
                          </div>
                          {g.notes && <p style={{ margin:'8px 0 0', fontSize:11, color:T.textSec, fontStyle:'italic' }}>{g.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab==='history' && (() => {
                const fmtTs = (d) => {
                  if (!d) return '—';
                  const dt = new Date(d);
                  return dt.toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) + ' · ' +
                         dt.toLocaleTimeString('en-AE', { hour:'2-digit', minute:'2-digit', hour12:true });
                };
                const fmtAgo = (d) => {
                  if (!d) return '';
                  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
                  if (s < 60)   return `${s}s ago`;
                  if (s < 3600) return `${Math.floor(s/60)}m ago`;
                  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
                  return `${Math.floor(s/86400)}d ago`;
                };

                // Build timeline events from available PO data
                const events = [];
                if (selected.createdAt) {
                  events.push({ type:'created', label:'Purchase Order Created', sub:`Order ${selected.orderNumber} raised for ${selected.vendorName||'vendor'}`, ts:selected.createdAt, by:selected.createdBy, color:'#3b82f6', dot:'#3b82f6', bg:T.blueDim });
                }
                const statusHistory = [
                  { key:'draft',            label:'Marked as Draft',         color:'#64748b' },
                  { key:'pending_approval', label:'Submitted for Approval',  color:'#f59e0b' },
                  { key:'issued',           label:'PO Issued / Approved',    color:'#8b5cf6' },
                  { key:'partial',          label:'Partial Receipt Recorded', color:'#06b6d4' },
                  { key:'received',         label:'Goods Fully Received',    color:'#10b981' },
                  { key:'cancelled',        label:'Order Cancelled',          color:'#ef4444' },
                ];
                const curSt = (selected.status||'draft').toLowerCase();
                const stCfg = statusHistory.find(s => s.key === curSt);
                if (stCfg && selected.updatedAt && selected.updatedAt !== selected.createdAt) {
                  events.push({ type:'status', label:stCfg.label, sub:`Status changed to "${stCfg.key}"`, ts:selected.updatedAt, by:selected.createdBy, color:stCfg.color, dot:stCfg.color, bg:`${stCfg.color}18` });
                }
                if (selected.expectedDeliveryDate) {
                  const isPast = new Date(selected.expectedDeliveryDate) < new Date();
                  events.push({ type:'delivery', label: isPast ? 'Expected Delivery (Overdue)' : 'Expected Delivery', sub:fmtDate(selected.expectedDeliveryDate), ts:selected.expectedDeliveryDate, color: isPast ? '#ef4444' : '#10b981', dot: isPast ? '#ef4444' : '#10b981', bg: isPast ? 'rgba(239,68,68,0.1)' : T.greenDim, future:!isPast });
                }
                events.sort((a,b) => new Date(a.ts) - new Date(b.ts));

                return (
                  <div>
                    {/* Header */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                      <div>
                        <p style={{ fontFamily:"'Sora',sans-serif", fontSize:13, fontWeight:700, color:T.textPri, margin:0 }}>Activity Timeline</p>
                        <p style={{ fontSize:11, color:T.textSec, margin:'2px 0 0' }}>{events.length} event{events.length!==1?'s':''}</p>
                      </div>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:999, fontSize:10, fontWeight:700, background:T.surface2, color:T.textSec, border:`1px solid ${T.border}` }}>
                        <FaClock size={8}/> Most recent last
                      </span>
                    </div>

                    {events.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'48px 0' }}>
                        <div style={{ width:52, height:52, borderRadius:16, background:T.surface2, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:22, color:T.textSec }}>
                          <FaClock />
                        </div>
                        <p style={{ fontFamily:"'Sora',sans-serif", fontSize:14, fontWeight:700, color:T.textPri, margin:'0 0 5px' }}>No History Yet</p>
                        <p style={{ fontSize:12, color:T.textSec, margin:0 }}>Status changes will appear here</p>
                      </div>
                    ) : (
                      <div style={{ position:'relative' }}>
                        {/* Vertical line */}
                        <div style={{ position:'absolute', left:19, top:20, bottom:20, width:2, background:`linear-gradient(to bottom, ${isDark?'rgba(255,255,255,0.06)':'#e2e8f0'}, ${isDark?'rgba(255,255,255,0.02)':'#f1f5f9'})`, borderRadius:2 }} />

                        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                          {events.map((ev, i) => (
                            <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start', paddingBottom: i < events.length-1 ? 20 : 0, position:'relative' }}>
                              {/* Dot */}
                              <div style={{ width:40, height:40, borderRadius:12, background:ev.bg, border:`2px solid ${ev.dot}33`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1, boxShadow:`0 0 0 4px ${isDark?T.surface:T.bg}` }}>
                                {ev.type==='created'  && <FaFileInvoiceDollar size={14} style={{ color:ev.dot }}/>}
                                {ev.type==='status'   && <FaCheckCircle size={14} style={{ color:ev.dot }}/>}
                                {ev.type==='delivery' && <FaTruck size={14} style={{ color:ev.dot }}/>}
                              </div>

                              {/* Card */}
                              <div style={{ flex:1, background:T.surface2, border:`1.5px solid ${ev.future ? `${ev.dot}33` : T.border}`, borderRadius:12, padding:'12px 14px', borderLeft:`3px solid ${ev.dot}` }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <p style={{ fontFamily:"'Sora',sans-serif", fontSize:12, fontWeight:700, color:T.textPri, margin:'0 0 3px' }}>{ev.label}</p>
                                    {ev.sub && <p style={{ fontSize:11, color:T.textSec, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.sub}</p>}
                                  </div>
                                  {ev.future && (
                                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:999, background:`${ev.dot}18`, color:ev.dot, border:`1px solid ${ev.dot}30`, whiteSpace:'nowrap', flexShrink:0 }}>UPCOMING</span>
                                  )}
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, paddingTop:8, borderTop:`1px solid ${T.border}` }}>
                                  <FaClock size={9} style={{ color:T.textMuted, flexShrink:0 }}/>
                                  <span style={{ fontSize:10, color:T.textSec, fontFamily:"'DM Mono',monospace" }}>{fmtTs(ev.ts)}</span>
                                  {!ev.future && <span style={{ fontSize:10, color:T.textMuted }}>· {fmtAgo(ev.ts)}</span>}
                                  {ev.by && <span style={{ fontSize:10, color:T.textMuted, marginLeft:'auto', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100 }}>by {ev.by}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Current status footer */}
                        <div style={{ marginTop:20, padding:'12px 14px', borderRadius:12, background:isDark?'rgba(255,255,255,0.03)':'#f8fafc', border:`1px dashed ${T.border}` }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:8, height:8, borderRadius:'50%', background:(STATUS_CFG[curSt]||STATUS_CFG.draft).color, flexShrink:0 }}/>
                            <span style={{ fontSize:11, color:T.textSec }}>Current status: </span>
                            <span style={{ fontSize:11, fontWeight:700, color:(STATUS_CFG[curSt]||STATUS_CFG.draft).color, textTransform:'capitalize' }}>{curSt}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={{ padding:'14px 20px', borderTop:`1px solid ${border}`, flexShrink:0, display:'flex', gap:8, flexWrap:'wrap' }}>
              {selected.status === 'issued' && (
                <button onClick={() => navigate(`/Purchase/GRN/new?poId=${selected._id}&poNumber=${selected.orderNumber}&vendorId=${selected.vendorId}&vendorName=${encodeURIComponent(selected.vendorName||'')}`)}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:10, background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', border:'none', borderRadius:11, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  <FaTruck size={11}/> Create GRN
                </button>
              )}
              {selected.status!=='received' && selected.status!=='cancelled' && (
                <button
                  disabled={markingReceived}
                  onClick={async () => {
                    setMarkingReceived(true);
                    try {
                      await axiosInstance.patch(`/api/purchase-orders/${selected._id}/status`, { status: 'received' });
                      closeDrawer(); fetchOrders(); fetchStats();
                    } catch (e) { console.error('Mark received failed', e); }
                    finally { setMarkingReceived(false); }
                  }}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'10px 14px', background:T.surface2, color:T.green, border:`1.5px solid ${T.greenDim}`, borderRadius:11, fontSize:13, fontWeight:700, cursor:markingReceived?'not-allowed':'pointer', opacity:markingReceived?0.6:1, fontFamily:'inherit' }}>
                  <FaCheckCircle size={11}/> {markingReceived ? 'Updating…' : 'Mark Received'}
                </button>
              )}
              {selected.status!=='cancelled' && selected.status!=='received' && (
                <button
                  disabled={cancelling}
                  onClick={async () => {
                    if (!window.confirm(`Cancel PO ${selected.orderNumber}?`)) return;
                    setCancelling(true);
                    try {
                      await axiosInstance.patch(`/api/purchase-orders/${selected._id}/status`, { status: 'cancelled' });
                      closeDrawer(); fetchOrders(); fetchStats();
                    } catch (e) { console.error('Cancel PO failed', e); }
                    finally { setCancelling(false); }
                  }}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', background:'transparent', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:11, fontSize:13, fontWeight:600, cursor:cancelling?'not-allowed':'pointer', fontFamily:'inherit' }}>
                  <FaBan size={11}/> {cancelling ? 'Cancelling…' : 'Cancel PO'}
                </button>
              )}
              <button onClick={closeDrawer} style={{ padding:'10px 16px', background:T.surface2, color:T.textSec, border:`1.5px solid ${border}`, borderRadius:11, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}