import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaSearch, FaTruck,
  FaChevronLeft, FaChevronRight, FaClipboardList, FaTimes,
} from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import useRealtime from "../../helper/useRealtime";

const STATUSES = [
  { key: "all",        label: "All",         color: "#64748b", dim: "rgba(100,116,139,.12)" },
  { key: "draft",      label: "Draft",       color: "#f59e0b", dim: "rgba(245,158,11,.12)"  },
  { key: "confirmed",  label: "Confirmed",   color: "#3b82f6", dim: "rgba(59,130,246,.12)"  },
  { key: "dispatched", label: "Dispatched",  color: "#8b5cf6", dim: "rgba(139,92,246,.12)"  },
  { key: "delivered",  label: "Delivered",   color: "#10b981", dim: "rgba(16,185,129,.12)"  },
  { key: "backorder",  label: "Back-orders", color: "#d97706", dim: "rgba(217,119,6,.12)"   },
];
const SM = Object.fromEntries(STATUSES.map(s => [s.key, s]));

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE",{day:"2-digit",month:"short",year:"numeric"}) : "—";

const LIMIT = 20;

export default function DeliveryNoteList() {
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);
  const navigate = useNavigate();

  const [notes,        setNotes]        = useState([]);
  const [stats,        setStats]        = useState({});
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);
  const [mounted,      setMounted]      = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchStats = useCallback(async () => {
    try { const r = await axiosInstance.get("/api/delivery-notes/stats"); setStats(r.data?.data || {}); }
    catch { /* non-fatal */ }
  }, []);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (statusFilter === "backorder") params.backorder = "true";
      else if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const r = await axiosInstance.get("/api/delivery-notes/", { params });
      const d = r.data?.data || {};
      setNotes(d.deliveryNotes || []);
      setTotalCount(d.total || 0);
      setTotalPages(Math.max(1, Math.ceil((d.total || 0) / LIMIT)));
    } catch { setNotes([]); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useRealtime(['delivery_notes_updated','sales_orders_updated'], () => { fetchNotes(); fetchStats(); });
  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .dnl-root *{box-sizing:border-box}
    .dnl-root{font-family:'DM Sans',sans-serif}
    html,body,*{scrollbar-width:thin;scrollbar-color:${isDark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"} transparent}
    *::-webkit-scrollbar{width:5px}*::-webkit-scrollbar-thumb{background:${isDark?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)"};border-radius:99px}
    @keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .dnl-row{transition:background .1s;cursor:pointer}
    .dnl-row:hover td{background:${isDark?"rgba(255,255,255,.025)":"rgba(37,99,235,.018)"} !important}
    .dnl-btn{transition:all .15s;cursor:pointer}
    .dnl-btn:hover{filter:brightness(${isDark?"1.1":".95"});transform:translateY(-1px)}
    .dnl-stat{transition:transform .2s cubic-bezier(.34,1.56,.64,1)}
    .dnl-stat:hover{transform:translateY(-2px)}
    .dnl-mounted .dnl-s0{animation:fadeUp .28s .00s ease both}
    .dnl-mounted .dnl-s1{animation:fadeUp .28s .04s ease both}
    .dnl-mounted .dnl-s2{animation:fadeUp .28s .08s ease both}
    .dnl-mounted .dnl-s3{animation:fadeUp .28s .12s ease both}
    .dnl-mounted .dnl-s4{animation:fadeUp .28s .16s ease both}
    .dnl-mounted .dnl-s5{animation:fadeUp .28s .20s ease both}
    .dnl-mounted .dnl-tbl{animation:fadeUp .3s .26s ease both}
    .sora{font-family:'Sora',sans-serif}
    .mono{font-family:'DM Mono',monospace}
  `;

  const surface  = T.surface;
  const surface2 = T.surface2;
  const border   = T.border;
  const text     = T.textPri;
  const muted    = T.textSec;

  const STAT_CARDS = [
    { key:"all",       label:"Total",       val:stats.total      ||0, color:"#64748b", dim:"rgba(100,116,139,.1)"  },
    { key:"draft",     label:"Draft",       val:stats.draft      ||0, color:"#f59e0b", dim:"rgba(245,158,11,.12)"  },
    { key:"confirmed", label:"Confirmed",   val:stats.confirmed  ||0, color:"#3b82f6", dim:"rgba(59,130,246,.12)"  },
    { key:"dispatched",label:"Dispatched",  val:stats.dispatched ||0, color:"#8b5cf6", dim:"rgba(139,92,246,.12)"  },
    { key:"delivered", label:"Delivered",   val:stats.delivered  ||0, color:"#10b981", dim:"rgba(16,185,129,.12)"  },
    { key:"backorder", label:"Back-orders", val:stats.backorders ||0, color:"#d97706", dim:"rgba(217,119,6,.12)"   },
  ];

  return (
    <div className={`dnl-root${mounted?" dnl-mounted":""}`}
      style={{background:T.bg,minHeight:"calc(100vh - 56px)",color:text,padding:"24px 28px 48px"}}>
      <style>{css}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <div style={{width:34,height:34,borderRadius:10,background:"rgba(16,185,129,.12)",color:"#10b981",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <FaTruck size={15}/>
            </div>
            <h1 className="sora" style={{fontSize:20,fontWeight:700,color:text,margin:0,letterSpacing:"-0.03em"}}>Delivery Notes</h1>
          </div>
          <p style={{fontSize:12.5,color:muted,margin:0}}>Track dispatched goods and delivery confirmations</p>
        </div>
        <button className="dnl-btn" onClick={()=>navigate("/Sales/Outbound")}
          style={{display:"flex",alignItems:"center",gap:7,padding:"8px 16px",background:"linear-gradient(135deg,#10b981,#059669)",border:"none",borderRadius:9,fontSize:13,fontWeight:600,color:"#fff",boxShadow:"0 4px 14px rgba(16,185,129,.3)"}}>
          <FaPlus size={11}/> Create Delivery Note
        </button>
      </div>

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12,marginBottom:22}}>
        {STAT_CARDS.map((s,i)=>(
          <div key={s.label} className={`dnl-stat dnl-s${i}`}
            onClick={()=>{setStatusFilter(s.key);setPage(1);}}
            style={{background:surface,border:`1px solid ${border}`,borderRadius:13,padding:"16px 18px",position:"relative",overflow:"hidden",cursor:"pointer",outline:statusFilter===s.key?`2px solid ${s.color}`:"2px solid transparent",outlineOffset:2}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${s.color},transparent)`,opacity:isDark?.5:.7}}/>
            <p className="sora" style={{fontSize:26,fontWeight:800,color:s.color,margin:"0 0 3px",letterSpacing:"-0.03em",lineHeight:1}}>{s.val}</p>
            <p style={{fontSize:10.5,fontWeight:600,color:muted,margin:0,textTransform:"uppercase",letterSpacing:".06em"}}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{background:surface,border:`1px solid ${border}`,borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:"1 1 220px",minWidth:180}}>
          <FaSearch size={11} style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:muted}}/>
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
            placeholder="Search DN number, customer…"
            style={{width:"100%",paddingLeft:30,paddingRight:search?32:12,paddingTop:8,paddingBottom:8,background:surface2,border:`1px solid ${border}`,borderRadius:8,fontSize:13,color:text,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          {search&&<button onClick={()=>{setSearch("");setPage(1);}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:muted,padding:0,display:"flex"}}><FaTimes size={10}/></button>}
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {STATUSES.map(s=>{
            const active=statusFilter===s.key;
            return (
              <button key={s.key} onClick={()=>{setStatusFilter(s.key);setPage(1);}}
                style={{padding:"5px 13px",borderRadius:99,fontSize:11.5,fontWeight:600,cursor:"pointer",border:`1px solid ${active?(isDark?`${s.color}44`:`${s.color}55`):border}`,background:active?(isDark?`${s.color}18`:s.dim):"transparent",color:active?s.color:muted,fontFamily:"inherit",transition:"all .15s"}}>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="dnl-tbl" style={{background:surface,border:`1px solid ${border}`,borderRadius:13,overflow:"hidden"}}>
        {loading ? (
          <div style={{padding:"60px 0",textAlign:"center",color:muted}}>
            <div style={{width:28,height:28,border:`3px solid ${T.blueDim}`,borderTopColor:T.blue,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px"}}/>
            <p style={{fontSize:13}}>Loading…</p>
          </div>
        ) : notes.length===0 ? (
          <div style={{padding:"60px 0",textAlign:"center"}}>
            <FaClipboardList size={34} style={{color:muted,marginBottom:12,opacity:.4}}/>
            <p style={{fontSize:14,color:muted,margin:0,fontWeight:600}}>No delivery notes found</p>
            <p style={{fontSize:12,color:muted,margin:"6px 0 0"}}>Create one from the Outbound page</p>
          </div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:isDark?"rgba(255,255,255,.03)":"#f8fafc",borderBottom:`1px solid ${border}`}}>
                {["DN Number","Date","Customer","Sales Order","Items","Status"].map((h,i)=>(
                  <th key={h} style={{padding:"11px 16px",textAlign:i>=4?"center":"left",fontSize:10,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:".07em",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notes.map((note,idx)=>{
                const s = SM[note.status] || SM.draft;
                return (
                  <tr key={note._id} className="dnl-row"
                    onClick={()=>navigate(`/Sales/Deliverynote/${note._id}`)}
                    style={{borderBottom:`1px solid ${T.border2||border}`,animation:`fadeUp .22s ${idx*.02}s ease both`}}>
                    <td style={{padding:"13px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span className="mono" style={{fontSize:12,fontWeight:700,color:T.blue,background:"rgba(59,130,246,.08)",padding:"3px 9px",borderRadius:6,border:"1px solid rgba(59,130,246,.15)"}}>
                          {note.dnNumber}
                        </span>
                        {note.dnNumber?.startsWith("BO-")&&(
                          <span style={{fontSize:10,fontWeight:700,color:"#d97706",background:"rgba(217,119,6,.12)",padding:"2px 7px",borderRadius:20,border:"1px solid rgba(217,119,6,.25)",whiteSpace:"nowrap"}}>
                            Back-order
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{padding:"13px 16px",color:muted,fontSize:12}}>{fmtDate(note.date)}</td>
                    <td style={{padding:"13px 16px"}}>
                      <p style={{fontSize:13,fontWeight:600,color:text,margin:0}}>{note.customerName||"—"}</p>
                    </td>
                    <td style={{padding:"13px 16px"}}>
                      <span className="mono" style={{fontSize:11,color:muted}}>{note.orderNumber||"—"}</span>
                    </td>
                    <td style={{padding:"13px 16px",textAlign:"center"}}>
                      <span style={{fontSize:13,fontWeight:700,color:text}}>{(note.items||[]).length}</span>
                    </td>
                    <td style={{padding:"13px 16px",textAlign:"center"}}>
                      <span style={{padding:"3px 11px",borderRadius:20,fontSize:11,fontWeight:700,color:s.color,background:s.dim,whiteSpace:"nowrap"}}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages>1&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:14,padding:"0 2px"}}>
          <span style={{fontSize:12,color:muted}}>
            Showing {Math.min((page-1)*LIMIT+1,totalCount)}–{Math.min(page*LIMIT,totalCount)} of {totalCount}
          </span>
          <div style={{display:"flex",gap:6}}>
            <button className="dnl-btn" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
              style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",background:surface,border:`1px solid ${border}`,borderRadius:8,fontSize:12,fontWeight:600,color:page===1?muted:text,cursor:page===1?"not-allowed":"pointer",opacity:page===1?.5:1}}>
              <FaChevronLeft size={10}/> Prev
            </button>
            <button className="dnl-btn" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
              style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",background:surface,border:`1px solid ${border}`,borderRadius:8,fontSize:12,fontWeight:600,color:page===totalPages?muted:text,cursor:page===totalPages?"not-allowed":"pointer",opacity:page===totalPages?.5:1}}>
              Next <FaChevronRight size={10}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
