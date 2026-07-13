import { useEffect, useState, useCallback } from "react";
import {
  FaPlus, FaTimes, FaSearch, FaBox, FaTag, FaLayerGroup,
  FaExclamationTriangle, FaCheckCircle, FaBarcode, FaCubes, FaIndustry,
  FaEdit, FaArrowDown, FaArrowUp, FaMagic, FaCopy, FaPrint, FaFileInvoice,
  FaDownload, FaFileImport,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetItem from "../../helper/useGetItem";
import { matchItem } from "../../helper/itemSearch";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import useRealtime from "../../helper/useRealtime";
import CsvImportModal from "../common/CsvImportModal";

const ITEM_IMPORT_FIELDS = [
  { key: "name",          label: "Name",          aliases: ["item name", "product", "product name"], required: true },
  { key: "item_code",     label: "SKU",           aliases: ["sku", "item code", "code"] },
  { key: "unit",          label: "Unit",          aliases: ["unit", "uom"] },
  { key: "selling_price", label: "Selling Price", aliases: ["price", "sell price", "selling price", "rate"] },
  { key: "cost_price",    label: "Cost Price",    aliases: ["cost", "cost price", "buy price"] },
  { key: "brand",         label: "Brand",         aliases: ["brand"] },
  { key: "manufacturer",  label: "Manufacturer",  aliases: ["manufacturer", "maker"] },
  { key: "upc",           label: "UPC",           aliases: ["upc", "barcode"] },
];

/* ─── Utilities ─────────────────────────────────────────────────────── */
const fmtN = (n) => Number(n || 0).toLocaleString("en-AE", { maximumFractionDigits: 0 });
const fmtAED = (n) => `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const stockState = (qty, reorder = 0) => {
  qty     = parseFloat(qty)     || 0;
  reorder = parseFloat(reorder) || 0;
  if (qty <= 0)                          return "out";
  if (reorder > 0 && qty <= reorder / 2) return "critical";
  if (reorder > 0 && qty <= reorder)     return "low";
  if (reorder > 0 && qty > reorder * 6)  return "over";
  return "ok";
};

const stockPct = (qty, reorder) => {
  const target = Math.max((reorder || 0) * 3, 1);
  return Math.min(100, ((qty || 0) / target) * 100);
};

const itemHue = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
};

const thumbGrad = (name) => {
  const h = itemHue(name || "");
  return `linear-gradient(135deg, oklch(0.62 0.13 ${h}), oklch(0.40 0.10 ${h}))`;
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function Item() {
  const { handleGetItem, data, loading, error } = useGetItem();
  const [showImport, setShowImport] = useState(false);
  const navigate  = useNavigate();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);

  const [selectedItem,  setSelectedItem]  = useState(null);
  const [activeTab,     setActiveTab]     = useState("overview");
  const [searchTerm,    setSearchTerm]    = useState("");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [mounted,       setMounted]       = useState(false);
  const [itemOrders,    setItemOrders]    = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [adjustItem,    setAdjustItem]    = useState(null);
  const [adjustQty,     setAdjustQty]     = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [availability,  setAvailability]  = useState({});

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { handleGetItem(); }, [handleGetItem]);
  useRealtime(['stocks_updated','grns_updated','adjustments_updated'], handleGetItem);

  useEffect(() => {
    if (!selectedItem?._id) { setAvailability({}); return; }
    axiosInstance.get(`/api/stocks/${selectedItem._id}/availability`)
      .then(r => setAvailability(r.data?.data || {}))
      .catch(() => setAvailability({}));
  }, [selectedItem?._id]);

  const [itemAdjustments,    setItemAdjustments]    = useState([]);
  const [adjLoading,         setAdjLoading]         = useState(false);

  useEffect(() => {
    if (!selectedItem?._id || (activeTab !== "transactions" && activeTab !== "history" && activeTab !== "overview")) return;
    setOrdersLoading(true);
    Promise.allSettled([
      axiosInstance.get("/api/sales-orders/getsaleorder?limit=500"),
      axiosInstance.get("/api/grns/?status=confirmed&limit=500"),
      axiosInstance.get("/api/purchase-orders/getorders?limit=500"),
    ]).then(([soRes, grnRes, poRes]) => {
      const sos  = soRes.status  === "fulfilled" ? (soRes.value.data?.data?.salesOrders   || []) : [];
      const grns = grnRes.status === "fulfilled" ? (grnRes.value.data?.data?.grns         || []) : [];
      const pos  = poRes.status  === "fulfilled" ? (poRes.value.data?.data?.purchaseOrders || []) : [];

      // Sales — use SO ordered qty (outbound)
      const sales = sos.filter(so => (so.items||[]).some(i=>i.itemId===selectedItem._id)).map(so=>{
        const l = so.items.find(i=>i.itemId===selectedItem._id);
        return { type:"sale", id:so._id, orderNumber:so.orderNumber, partyName:so.customerName||"—", date:so.orderDate, qty:l?.quantity??0, total:(l?.quantity??0)*(l?.rate??0), status:so.status };
      });

      // Purchases — use confirmed GRN accepted qty (actual stock movement)
      const purchases = grns.filter(g=>(g.items||[]).some(i=>i.itemId===selectedItem._id)).map(g=>{
        const gItem = g.items.find(i=>i.itemId===selectedItem._id);
        const accepted = Math.max(0, (gItem?.receivedQty||0) - (gItem?.rejectedQty||0));
        return { type:"purchase", id:g._id, orderNumber:g.grnNumber, partyName:g.vendorName||"—", date:g.receiptDate||g.createdAt, qty:accepted, total:accepted*(gItem?.rate||0), status:"confirmed", poNumber:g.poNumber };
      });

      // PO orders (for "on order" context — not stock movements)
      const onOrder = pos.filter(po=>["issued","partial"].includes(po.status)&&(po.items||[]).some(i=>i.itemId===selectedItem._id)).map(po=>{
        const l = po.items.find(i=>i.itemId===selectedItem._id);
        const remaining = Math.max(0, (l?.quantity??0) - (l?.receivedQty||0));
        return { type:"onorder", id:po._id, orderNumber:po.orderNumber, partyName:po.vendorName||"—", forCustomer:po.forCustomerName||"", date:po.orderDate, qty:remaining, total:remaining*(l?.rate??0), status:po.status };
      });

      setItemOrders([...sales,...purchases,...onOrder].sort((a,b)=>new Date(a.date)-new Date(b.date)));
    }).finally(()=>setOrdersLoading(false));
  }, [activeTab, selectedItem]);

  useEffect(() => {
    if (!selectedItem?._id || activeTab !== "history") return;
    setAdjLoading(true);
    axiosInstance.get(`/api/inventory/adjustments/?itemId=${selectedItem._id}&limit=500`)
      .then(res => {
        const adjs = res.data?.data?.adjustments || res.data?.adjustments || [];
        setItemAdjustments(adjs.map(a => ({ ...a, _source: "adj" })));
      })
      .catch(() => setItemAdjustments([]))
      .finally(() => setAdjLoading(false));
  }, [activeTab, selectedItem]);

  const allItems = Array.isArray(data) ? data : [];

  const filteredItems = allItems.filter((item) => {
    const matchSearch = matchItem(item, searchTerm) ||
      (item.brand||"").toLowerCase().includes(searchTerm.trim().toLowerCase());
    const s = stockState(item.quantity, item.reorder_point);
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "low"  && (s==="low"||s==="critical")) ||
      (filterStatus === "out"  && s==="out") ||
      (filterStatus === "over" && s==="over") ||
      filterStatus === s;
    return matchSearch && matchStatus;
  });

  /* Stats */
  const totalItems   = allItems.length;
  const inStockCount = allItems.filter(i=>stockState(i.quantity,i.reorder_point)==="ok").length;
  const lowCount     = allItems.filter(i=>["low","critical"].includes(stockState(i.quantity,i.reorder_point))).length;
  const outCount     = allItems.filter(i=>stockState(i.quantity,i.reorder_point)==="out").length;
  const totalValue   = allItems.reduce((s,i)=>s+(parseFloat(i.selling_price||0)*(i.quantity||0)),0);

  const openItem = useCallback((item) => {
    setSelectedItem(item); setActiveTab("overview"); setItemOrders([]);
  }, []);

  const closePanel = useCallback(() => { setSelectedItem(null); handleGetItem(); }, [handleGetItem]);

  const handleAdjustStock = async () => {
    const newQty = parseFloat(adjustQty);
    if (isNaN(newQty)||newQty<0) return;
    const itemId = adjustItem._id || adjustItem.id;
    const diff = newQty - parseFloat(adjustItem.quantity||0);
    if (diff===0){setAdjustItem(null);return;}
    setAdjustLoading(true);
    try {
      if (diff>0) await axiosInstance.patch(`/api/stocks/${itemId}/increase`,{increaseBy:diff});
      else        await axiosInstance.patch(`/api/stocks/${itemId}/reduce`,{reduceBy:Math.abs(diff)});
      setAdjustItem(null); setAdjustQty(""); handleGetItem();
      if (selectedItem?._id===itemId) setSelectedItem(p=>p?{...p,quantity:newQty}:p);
    } catch(err){ alert(err?.response?.data?.message||"Failed to adjust stock"); }
    finally{ setAdjustLoading(false); }
  };

  useEffect(()=>{
    const h=(e)=>{ if(e.key==="Escape"){ closePanel(); } };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[closePanel]);

  /* ── CSS variables via style tag (theme-aware) ── */
  const bg      = T.bg;
  const surface = T.surface;
  const surface2= T.surface2;
  const border  = T.border;
  const border2 = T.border2;
  const text     = T.textPri;
  const muted    = T.textSec;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .inv-root *{box-sizing:border-box}
    .inv-root{font-family:'DM Sans',sans-serif;color:${text};background:${bg}}
    html,body,*{scrollbar-width:thin;scrollbar-color:${isDark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"} transparent}
    *::-webkit-scrollbar{width:6px;height:6px}
    *::-webkit-scrollbar-thumb{background:${isDark?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)"};border-radius:99px}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

    .inv-row{transition:background .1s;cursor:pointer}
    .inv-row:hover{background:${isDark?"rgba(255,255,255,.04)":"rgba(0,0,0,.025)"} !important}
    .inv-row.sel{background:${surface} !important;box-shadow:0 1px 0 rgba(0,0,0,.04),0 2px 6px rgba(0,0,0,.05);outline:1px solid ${isDark?"rgba(99,102,241,.35)":"rgba(99,102,241,.2)"}}

    .inv-filter-tab{transition:background .1s;cursor:pointer}
    .inv-filter-tab:hover{background:${surface}}
    .inv-filter-tab.on{background:${surface};color:${text};box-shadow:0 1px 0 rgba(0,0,0,.04),0 1px 4px rgba(0,0,0,.05)}

    .inv-tab-btn{transition:color .15s,border-color .15s;cursor:pointer}
    .inv-tab-btn:hover{color:${text}}

    .inv-btn{transition:all .15s;cursor:pointer}
    .inv-btn:hover{filter:brightness(${isDark?"1.1":".96"});transform:translateY(-1px)}
    .tx-acc:hover{filter:brightness(${isDark?"1.15":".97"})}

    .inv-qa{transition:background .1s;cursor:pointer}
    .inv-qa:hover{background:${isDark?"rgba(255,255,255,.06)":"rgba(0,0,0,.05)"}}

    .inv-kpi{background:${surface};border:1px solid ${border};border-radius:11px;padding:14px;position:relative;overflow:hidden}
    .inv-kpi .kpi-k{font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:${muted};margin-bottom:6px;display:flex;align-items:center;justify-content:space-between}
    .inv-kpi .kpi-v{font-size:20px;font-weight:600;letter-spacing:-0.01em;line-height:1.15;font-family:'Sora',sans-serif}
    .inv-kpi .kpi-sub{font-size:11px;color:${muted};margin-top:4px}

    .sora{font-family:'Sora',sans-serif}
    .mono{font-family:'DM Mono',monospace}
    .display{font-family:'Sora',sans-serif;font-weight:700;letter-spacing:-0.02em}
  `;

  /* ── Loading / Error ── */
  if (loading) return (
    <div className="inv-root" style={{height:"calc(100vh - 56px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{css}</style>
      <div style={{textAlign:"center"}}>
        <div style={{width:34,height:34,border:`3px solid ${T.blueDim}`,borderTopColor:T.blue,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px"}}/>
        <p style={{color:muted,fontSize:13}}>Loading inventory…</p>
      </div>
    </div>
  );
  if (error) return (
    <div className="inv-root" style={{height:"calc(100vh - 56px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{css}</style>
      <div style={{background:surface,border:`1px solid ${border}`,borderRadius:14,padding:"28px 32px",textAlign:"center"}}>
        <FaExclamationTriangle size={26} style={{color:T.red,marginBottom:12}}/>
        <p style={{color:text,fontWeight:600,margin:"0 0 6px"}}>Failed to load items</p>
        <p style={{color:muted,fontSize:12}}>{error}</p>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div className={`inv-root${mounted?" inv-mounted":""}`}
      style={{height:"calc(100vh - 56px)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{css}</style>

      <CsvImportModal
        open={showImport}
        onClose={()=>setShowImport(false)}
        onComplete={handleGetItem}
        title="Import Items"
        fields={ITEM_IMPORT_FIELDS}
        endpoint="/api/stocks/import"
        payloadKey="items"
      />

      {/* ══ PAGE HEAD ═══════════════════════════════════════════════════ */}
      <div style={{background:surface,borderBottom:`1px solid ${border}`,padding:"12px 22px 8px",display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
        <div>
          <div className="display" style={{fontSize:21,...(isDark?{background:"linear-gradient(90deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}:{color:"#1e293b"})}}>Inventory</div>
          <div style={{color:isDark?"rgba(148,163,184,.9)":muted,fontSize:12,marginTop:2}}>{allItems.length} items in catalog · last sync just now</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <button className="inv-btn" style={{display:"flex",alignItems:"center",gap:6,height:32,padding:"0 12px",borderRadius:8,background:surface2,border:`1px solid ${border}`,color:muted,fontSize:12.5,fontWeight:500,fontFamily:"inherit"}}>
            <FaDownload size={11}/> Export
          </button>
          <button className="inv-btn" onClick={()=>setShowImport(true)} style={{display:"flex",alignItems:"center",gap:6,height:32,padding:"0 12px",borderRadius:8,background:surface2,border:`1px solid ${border}`,color:muted,fontSize:12.5,fontWeight:500,fontFamily:"inherit"}}>
            <FaFileImport size={11}/> Import
          </button>
          <button className="inv-btn" onClick={()=>navigate("/Items/Items/New")}
            style={{display:"flex",alignItems:"center",gap:6,height:32,padding:"0 14px",borderRadius:8,background:T.blue,border:"none",color:"#fff",fontSize:12.5,fontWeight:600,fontFamily:"inherit",boxShadow:`0 4px 14px ${isDark?"rgba(59,130,246,.35)":"rgba(37,99,235,.25)"}`}}>
            <FaPlus size={10}/> New item
          </button>
        </div>
      </div>

      {/* ══ SUMMARY STRIP ═══════════════════════════════════════════════ */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",borderBottom:`1px solid ${border}`,background:surface,flexShrink:0}}>
        {[
          { k:"Total SKUs",     v:fmtN(totalItems),  sub:`+${Math.max(0,totalItems-5)} this week`, color:T.blue,  icon:<FaLayerGroup size={12}/>,  sparkVals:[totalItems-8,totalItems-6,totalItems-4,totalItems-2,totalItems-1,totalItems] },
          { k:"In stock",       v:fmtN(inStockCount), sub:`${totalItems?Math.round(inStockCount/totalItems*100):0}%`,  color:T.green, icon:<FaCheckCircle size={12}/> },
          { k:"Low stock",      v:fmtN(lowCount),    sub:"needs reorder",               color:T.amber, icon:<FaExclamationTriangle size={12}/> },
          { k:"Out of stock",   v:fmtN(outCount),    sub:`${totalItems?Math.round(outCount/totalItems*100).toFixed(1):0}%`, color:T.red,   icon:<FaTimes size={12}/> },
          { k:"Portfolio value",v:`AED ${(totalValue/1000).toFixed(0)}K`, sub:"+AED 84K",          color:T.green, icon:<FaTag size={12}/>, sparkVals:[totalValue*.85,totalValue*.88,totalValue*.92,totalValue*.95,totalValue*.98,totalValue].map(x=>x/1000) },
        ].map((s,i)=>(
          <div key={i} style={{padding:"14px 18px",borderRight:i<4?`1px solid ${border}`:"none"}}>
            <div style={{fontSize:11,letterSpacing:".04em",textTransform:"uppercase",color:isDark?"rgba(148,163,184,.85)":muted,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:s.color,opacity:.9}}>{s.icon}</span> {s.k}
            </div>
            <div className="sora" style={{fontSize:22,fontWeight:700,letterSpacing:"-0.01em",lineHeight:1.1,color:isDark?"#f1f5f9":text}}>
              {s.v} {s.sub && <small style={{fontSize:11,color:isDark?"rgba(148,163,184,.7)":muted,fontWeight:500,marginLeft:4,letterSpacing:".02em"}}>{s.sub}</small>}
            </div>
            {s.sparkVals && (
              <MiniSparkline vals={s.sparkVals} color={s.color}/>
            )}
          </div>
        ))}
      </div>

      {/* ══ SPLIT CONTENT ═══════════════════════════════════════════════ */}
      <div style={{display:"grid",gridTemplateColumns:selectedItem?"460px 1fr":"460px 1fr",flex:1,overflow:"hidden",minHeight:0}}>

        {/* ── LIST PANE ── */}
        <div style={{borderRight:`1px solid ${border}`,background:surface2,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* List header */}
          <div style={{padding:"12px 12px 0"}}>
            {/* Search */}
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 10px",height:32,borderRadius:8,background:surface,border:`1px solid ${border}`,color:muted,fontSize:12.5,marginBottom:10}}>
              <FaSearch size={12}/>
              <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
                placeholder="Search name, code, brand…"
                style={{flex:1,background:"transparent",border:0,outline:0,color:text,font:"inherit",fontSize:12.5}}/>
              {searchTerm&&<button onClick={()=>setSearchTerm("")} style={{background:"none",border:"none",cursor:"pointer",color:muted,padding:0,display:"flex"}}><FaTimes size={11}/></button>}
            </div>

            {/* Filter tabs */}
            <div style={{display:"flex",gap:2,padding:3,background:isDark?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)",borderRadius:8,marginBottom:0}}>
              {[
                ["all","All",totalItems],
                ["low","Low",lowCount,"warn"],
                ["out","Out",outCount,"bad"],
                ["over","Overstock",0],
              ].map(([k,l,n,tone])=>{
                const active = filterStatus===k;
                return (
                  <button key={k} className={`inv-filter-tab${active?" on":""}`}
                    onClick={()=>setFilterStatus(k)}
                    style={{flex:1,padding:"5px 6px",borderRadius:6,background:active?surface:"transparent",border:"none",color:active?text:muted,cursor:"pointer",font:"inherit",fontSize:11.5,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:5,whiteSpace:"nowrap"}}>
                    {l}
                    <span style={{fontSize:10,padding:"1px 5px",borderRadius:99,
                      background: active
                        ? (tone==="bad" ? (isDark?"rgba(239,68,68,.18)":"#fee2e2") : tone==="warn" ? (isDark?"rgba(245,158,11,.18)":"#fef3c7") : T.blueDim)
                        : (isDark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)"),
                      color: active
                        ? (tone==="bad"?T.red : tone==="warn"?T.amber : T.blue)
                        : muted,
                    }}>{n}</span>
                  </button>
                );
              })}
            </div>

            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 4px 6px",fontSize:11.5,color:muted}}>
              <span>Showing <b style={{color:text}}>{filteredItems.length}</b> of {allItems.length}</span>
              <span style={{display:"flex",alignItems:"center",gap:5,color:text,cursor:"default"}}>
                <FaLayerGroup size={11}/> Stock status
              </span>
            </div>
          </div>

          {/* List body */}
          <div style={{flex:1,overflowY:"auto",padding:"2px 8px 80px"}}>
            {filteredItems.length===0 ? (
              <div style={{textAlign:"center",padding:"48px 16px",opacity:.55}}>
                <FaBox size={24} style={{display:'block',margin:'0 auto 10px',color:muted}}/>
                <p style={{color:muted,fontWeight:500,fontSize:13,margin:"0 0 4px"}}>No items match</p>
                <p style={{color:muted,fontSize:11,margin:0}}>Adjust filters or clear search</p>
              </div>
            ) : filteredItems.map((item,idx)=>{
              const state = stockState(item.quantity,item.reorder_point);
              const pipColor = state==="out"||state==="critical"?T.red : state==="low"?T.amber : state==="over"?muted : T.green;
              const qty = parseFloat(item.quantity||0);
              const reo = parseFloat(item.reorder_point||0);
              const pct = stockPct(qty,reo);
              const reoPct = reo>0 ? Math.min(100,(reo/Math.max(reo*3,1))*100) : 0;
              const barColor = state==="out"||state==="critical"?T.red : state==="low"?T.amber : T.green;
              const stockLine = qty===0 ? <span style={{color:T.red}}>Out of stock</span>
                : state==="critical" ? <span style={{color:T.red}}>{qty} {item.unit||"units"} · critical</span>
                : state==="low"      ? <span style={{color:T.amber}}>{qty} {item.unit||"units"} · below reorder</span>
                : state==="over"     ? <span style={{color:muted}}>{qty} {item.unit||"units"} · overstock</span>
                : <span>{qty} {item.unit||"units"} · in stock</span>;
              const isSelected = selectedItem?._id===item._id;
              return (
                <div key={item._id||idx} className={`inv-row${isSelected?" sel":""}`}
                  onClick={()=>openItem(item)}
                  style={{display:"grid",gridTemplateColumns:"44px 1fr auto",gap:12,alignItems:"center",padding:"9px 8px",borderRadius:8,marginBottom:1,animation:`fadeUp .22s ${idx*.018}s ease both`}}>
                  {/* Thumbnail */}
                  <div style={{width:44,height:44,borderRadius:9,background:thumbGrad(item.name||""),display:"grid",placeItems:"center",color:"#fff",position:"relative",overflow:"hidden",boxShadow:"0 1px 0 rgba(255,255,255,.1) inset",flexShrink:0}}>
                    <FaCubes size={17} style={{opacity:.8}}/>
                    {/* Stock pip */}
                    <span style={{position:"absolute",right:-2,bottom:-2,width:12,height:12,borderRadius:"50%",background:pipColor,border:`2px solid ${isSelected?surface:surface2}`}}/>
                  </div>
                  {/* Meta */}
                  <div style={{minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                      <span style={{fontWeight:600,fontSize:13,color:text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</span>
                      <span className="mono" style={{fontSize:9.5,padding:"1px 5px",borderRadius:4,color:muted,background:isSelected?surface2:isDark?"rgba(255,255,255,.07)":"rgba(0,0,0,.06)",flexShrink:0}}>{item.item_code||"—"}</span>
                    </div>
                    <div style={{fontSize:11.5,color:muted,display:"flex",alignItems:"center",gap:5,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      <span>{item.brand||"—"}</span>
                      <span style={{color:isDark?"rgba(255,255,255,.2)":"rgba(0,0,0,.2)"}}>·</span>
                      {stockLine}
                    </div>
                  </div>
                  {/* Right */}
                  <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                    <div style={{fontSize:12.5,fontWeight:600,color:text,fontVariantNumeric:"tabular-nums"}}>{item.selling_price?`AED ${fmtN(item.selling_price)}`:"—"}</div>
                    <div style={{width:60,height:5,borderRadius:99,background:isDark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)",overflow:"hidden",position:"relative"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:barColor,borderRadius:99,transition:"width .2s"}}/>
                      {reoPct>0&&reoPct<100&&(
                        <div style={{position:"absolute",top:-1,bottom:-1,left:`${reoPct}%`,width:1.5,background:isDark?"rgba(255,255,255,.4)":"rgba(0,0,0,.3)"}}/>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* List footer */}
          <div style={{borderTop:`1px solid ${border}`,background:surface2,padding:"8px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:11.5,color:muted,flexShrink:0}}>
            <span>{filteredItems.length} item{filteredItems.length!==1?"s":""}</span>
            <span style={{color:text,fontWeight:500}}>{filterStatus!=="all"?`Filtered: ${filterStatus}`:""}</span>
          </div>
        </div>

        {/* ── DETAIL PANE ── */}
        <div style={{background:bg,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          {selectedItem ? (
            <DetailPanel
              item={selectedItem} T={T} isDark={isDark}
              surface={surface} surface2={surface2} border={border} border2={border2}
              text={text} muted={muted} bg={bg}
              activeTab={activeTab} setActiveTab={setActiveTab}
              itemOrders={itemOrders} ordersLoading={ordersLoading}
              itemAdjustments={itemAdjustments} adjLoading={adjLoading}
              requested={(availability.requested ?? 0) + (availability.committed ?? 0)}
              availability={availability}
              onClose={closePanel}
              onAdjust={(item)=>{setAdjustItem(item);setAdjustQty(String(item.quantity??0));}}
              onEdit={(item)=>navigate(`/Items/Items/Edit/${item._id||item.id}`)}
            />
          ) : (
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",opacity:.4}}>
              <div style={{textAlign:"center"}}>
                <FaBox size={32} style={{display:'block',margin:'0 auto 14px',color:muted}}/>
                <p style={{color:muted,fontWeight:600,fontSize:14,margin:"0 0 6px"}}>Select an item</p>
                <p style={{color:muted,fontSize:12,margin:0}}>Click any row to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ STOCK ADJUST MODAL ═══════════════════════════════════════════ */}
      {adjustItem&&(
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setAdjustItem(null)}>
          <div style={{background:isDark?"#0f172a":"#fff",border:`1px solid ${border}`,borderRadius:16,padding:"24px 28px",width:340,boxShadow:"0 32px 80px rgba(0,0,0,.45)"}} onClick={e=>e.stopPropagation()}>
            <p className="sora" style={{fontSize:14,fontWeight:700,color:text,margin:"0 0 4px"}}>Adjust Stock</p>
            <p style={{fontSize:12,color:muted,margin:"0 0 20px"}}>{adjustItem.name} · Current: <strong style={{color:text}}>{adjustItem.quantity??0}</strong></p>
            <label style={{fontSize:11,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:6}}>New Quantity</label>
            <input autoFocus type="number" min="0" value={adjustQty} onChange={e=>setAdjustQty(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdjustStock()}
              style={{width:"100%",padding:"10px 12px",borderRadius:9,border:`1.5px solid ${border}`,background:surface2,color:text,fontSize:15,fontWeight:700,fontFamily:"'DM Mono',monospace",outline:"none",boxSizing:"border-box"}}/>
            {adjustQty!==""&&parseFloat(adjustQty)!==parseFloat(adjustItem.quantity??0)&&(
              <p style={{fontSize:11,color:parseFloat(adjustQty)>parseFloat(adjustItem.quantity??0)?"#10b981":"#f59e0b",margin:"6px 0 0"}}>
                {parseFloat(adjustQty)>parseFloat(adjustItem.quantity??0)?`+${parseFloat(adjustQty)-parseFloat(adjustItem.quantity??0)} units will be added`:`${parseFloat(adjustItem.quantity??0)-parseFloat(adjustQty)} units will be removed`}
              </p>
            )}
            <div style={{display:"flex",gap:8,marginTop:20}}>
              <button onClick={handleAdjustStock} disabled={adjustLoading||adjustQty===""||parseFloat(adjustQty)<0}
                style={{flex:1,padding:10,background:"linear-gradient(135deg,#3b82f6,#2563eb)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:adjustLoading?.7:1}}>
                {adjustLoading?"Saving…":"Save"}
              </button>
              <button onClick={()=>setAdjustItem(null)}
                style={{flex:1,padding:10,background:surface2,color:muted,border:`1px solid ${border}`,borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Mini sparkline ─────────────────────────────────────────────────── */
function MiniSparkline({ vals, color }) {
  const w=110, h=22;
  const max=Math.max(...vals), min=Math.min(...vals);
  const pts = vals.map((v,i)=>{
    const x=(i/(vals.length-1))*w;
    const y=h-((v-min)/(max-min||1))*(h-3)-1.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const area=`0,${h} ${pts} ${w},${h}`;
  return (
    <svg width={w} height={h} style={{display:"block",marginTop:6}}>
      <polygon points={area} fill={color} opacity=".12"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

/* ─── Detail panel ────────────────────────────────────────────────────── */
function DetailPanel({ item, T, isDark, surface, surface2, border, border2, text, muted, bg, activeTab, setActiveTab, itemOrders, ordersLoading, itemAdjustments, adjLoading, requested, availability, onClose, onAdjust, onEdit }) {
  const state = stockState(item.quantity, item.reorder_point);
  const qty   = parseFloat(item.quantity || 0);
  const reo   = parseFloat(item.reorder_point || 0);
  const portfolioVal = parseFloat(item.selling_price||0)*qty;

  const badge =
    state==="out"      ? <Badge tone="bad">Out of stock</Badge> :
    state==="critical" ? <Badge tone="bad">Critical</Badge>     :
    state==="low"      ? <Badge tone="warn">Low stock</Badge>   :
    state==="over"     ? <Badge tone="neutral">Overstock</Badge>:
                         <Badge tone="good">Healthy</Badge>;

  const showInsight = ["low","critical","out"].includes(state);
  const suggestQty  = state==="out" ? (reo>0?reo*2:50) : (reo>0?Math.ceil(reo*1.5-qty):25);

  const velocity = 0; /* no velocity data in current schema */
  const forecastDays = state==="out"||velocity===0 ? null : Math.round((qty-reo)/Math.max(velocity,1)*30);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Sticky detail header */}
      <div style={{background:surface,borderBottom:`1px solid ${border}`,padding:"20px 24px 14px",flexShrink:0}}>
        {/* Hero row */}
        <div style={{display:"flex",alignItems:"flex-start",gap:16,marginBottom:14}}>
          <div style={{width:84,height:84,borderRadius:14,background:thumbGrad(item.name||""),display:"grid",placeItems:"center",color:"#fff",flexShrink:0,boxShadow:"0 1px 0 rgba(255,255,255,.15) inset, 0 8px 16px -8px rgba(0,0,0,.3)",position:"relative",overflow:"hidden"}}>
            <FaCubes size={34} style={{opacity:.8}}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div className="display" style={{fontSize:22,color:text,lineHeight:1.15,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              {item.name} {badge}
              <span className="mono" style={{fontSize:11,fontWeight:500,padding:"2px 7px",borderRadius:5,background:surface2,color:muted,letterSpacing:0,fontFamily:"'DM Mono',monospace"}}>{item.item_code}</span>
            </div>
            <div style={{fontSize:12.5,color:muted,marginTop:4,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              {item.brand&&<span>{item.brand}</span>}
              {item.category&&<span>{item.category}</span>}
              <span>Tracked in {item.unit||"units"}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"flex-start",flexShrink:0}}>
            <button className="inv-btn" style={{display:"flex",alignItems:"center",gap:5,height:30,padding:"0 10px",borderRadius:7,background:surface2,border:`1px solid ${border}`,color:text,fontSize:12,fontWeight:500,fontFamily:"inherit"}} onClick={()=>{}}>
              <FaCopy size={11}/> More
            </button>
            <button className="inv-btn" onClick={()=>onEdit(item)} style={{display:"flex",alignItems:"center",gap:5,height:30,padding:"0 11px",borderRadius:7,background:surface2,border:`1px solid ${border}`,color:text,fontSize:12,fontWeight:500,fontFamily:"inherit"}}>
              <FaEdit size={11}/> Edit
            </button>
            <button className="inv-btn" style={{display:"flex",alignItems:"center",gap:5,height:30,padding:"0 11px",borderRadius:7,background:T.blue,border:"none",color:"#fff",fontSize:12,fontWeight:600,fontFamily:"inherit",boxShadow:`0 4px 10px -4px ${T.blue}`}} onClick={()=>{}}>
              Open record
            </button>
            <button onClick={onClose} style={{width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:7,border:`1px solid ${border}`,background:surface2,color:muted,cursor:"pointer"}}>
              <FaTimes size={11}/>
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          {[
            { label:"Stock in",    icon:<FaArrowDown size={12}/>, primary:true, onClick:()=>onAdjust(item) },
            { label:"Stock out",   icon:<FaArrowUp size={12}/>, onClick:()=>onAdjust(item) },
            { label:"Create PO",   icon:<FaFileInvoice size={12}/> },
            { label:"Print label", icon:<FaPrint size={12}/> },
            { label:"Duplicate",   icon:<FaCopy size={12}/> },
          ].map(qa=>(
            <button key={qa.label} className="inv-qa"
              onClick={qa.onClick}
              style={{display:"inline-flex",alignItems:"center",gap:6,height:30,padding:"0 11px",borderRadius:7,
                background: qa.primary ? (isDark?"rgba(59,130,246,.18)":"rgba(59,130,246,.1)") : surface2,
                border:`1px solid ${qa.primary?(isDark?"rgba(59,130,246,.3)":"rgba(59,130,246,.2)"):border}`,
                color: qa.primary?T.blue:text,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>
              {qa.icon} {qa.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{flex:1,overflowY:"auto",background:bg}}>
        {/* AI Insight banner */}
        {showInsight&&(
          <div style={{margin:"14px 24px 0",padding:"12px 14px",borderRadius:11,background:`linear-gradient(90deg, ${isDark?"rgba(99,102,241,.12)":"rgba(99,102,241,.07)"}, transparent 80%)`,border:`1px solid ${isDark?"rgba(99,102,241,.25)":"rgba(99,102,241,.18)"}`,display:"flex",alignItems:"flex-start",gap:12,position:"relative"}}>
            <span style={{position:"absolute",top:-8,left:14,fontSize:9.5,letterSpacing:".08em",textTransform:"uppercase",padding:"2px 7px",background:T.blue,color:"#fff",borderRadius:99,fontWeight:600}}>AI · Reorder</span>
            <div style={{width:26,height:26,borderRadius:8,flexShrink:0,background:T.blue,color:"#fff",display:"grid",placeItems:"center",boxShadow:`0 4px 12px -4px ${T.blue}`}}>
              <FaMagic size={12}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,color:text,fontWeight:500,marginBottom:2}}>
                Reorder <b style={{color:T.blue}}>{suggestQty} {item.unit||"units"}</b> {state==="out"?"immediately":"soon"}.
              </div>
              <div style={{fontSize:11.5,color:muted,lineHeight:1.45}}>
                {state==="out"
                  ? `Stock hit zero. Suggested order of ${suggestQty} ${item.unit||"units"} to restore buffer.`
                  : `Below reorder point (${reo}). At current pace you may stock out soon. Lead time ~7 days.`}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button className="inv-btn" style={{height:28,padding:"0 10px",borderRadius:7,background:surface,border:`1px solid ${border}`,color:muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Snooze</button>
              <button className="inv-btn" style={{height:28,padding:"0 10px",borderRadius:7,background:T.blue,border:"none",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                <FaFileInvoice size={10}/> Create PO
              </button>
            </div>
          </div>
        )}

        {/* KPI grid — 6 cols */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,padding:"14px 24px 6px"}}>
          <KpiCard
            label="Stock on hand"
            value={`${qty} ${item.unit||"units"}`}
            tone={state==="out"||state==="critical"?"bad":state==="low"?"warn":""}
            sub={`Reorder at ${reo||"—"}`}
            icon={<FaBox size={12}/>}
            bar={{ pct:stockPct(qty,reo), reoPct:reo>0?(reo/Math.max(reo*3,1))*100:0, state }}
            T={T} isDark={isDark} muted={muted} text={text}
          />
          <KpiCard
            label="30-day velocity"
            value="—"
            sub="No velocity data"
            icon={<FaCheckCircle size={12}/>}
            T={T} isDark={isDark} muted={muted} text={text}
          />
          <KpiCard
            label="Reorder forecast"
            value={forecastDays!=null?`${forecastDays} days`:(state==="out"?"Overdue":"—")}
            tone={state==="out"?"bad":state==="low"?"warn":""}
            sub="Lead time ~7 days"
            icon={<FaExclamationTriangle size={12}/>}
            T={T} isDark={isDark} muted={muted} text={text}
          />
          <KpiCard
            label="Inventory value"
            value={portfolioVal>0?`AED ${fmtN(portfolioVal)}`:"—"}
            sub={item.selling_price?`Cost ${fmtAED(item.selling_price)} / ${item.unit||"u"}`:"No price set"}
            icon={<FaTag size={12}/>}
            T={T} isDark={isDark} muted={muted} text={text}
          />
          <KpiCard
            label="Requested qty"
            value={requested>0?`${fmtN(requested)} ${item.unit||"units"}`:"—"}
            tone={requested>0?"warn":""}
            sub={requested>0?"Reserved for orders":"No pending orders"}
            icon={<FaExclamationTriangle size={12}/>}
            T={T} isDark={isDark} muted={muted} text={text}
          />
          <KpiCard
            label="Free stock"
            value={`${fmtN(Math.max(0, qty - requested))} ${item.unit||"units"}`}
            tone={Math.max(0, qty - requested)>0?"good":"bad"}
            sub="Available to sell"
            icon={<FaBox size={12}/>}
            T={T} isDark={isDark} muted={muted} text={text}
          />
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,padding:"14px 24px 0",borderBottom:`1px solid ${border}`,background:surface}}>
          {["overview","transactions","history"].map(tab=>(
            <button key={tab} className="inv-tab-btn"
              onClick={()=>setActiveTab(tab)}
              style={{padding:"8px 12px 10px",background:"transparent",border:"none",cursor:"pointer",color:activeTab===tab?text:muted,font:"inherit",fontSize:12.5,fontWeight:500,borderBottom:`2px solid ${activeTab===tab?T.blue:"transparent"}`,marginBottom:-1,display:"flex",alignItems:"center",gap:6,textTransform:"capitalize",fontFamily:"inherit"}}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tab body */}
        {activeTab==="overview"&&(
          <OverviewTab item={item} T={T} isDark={isDark} surface={surface} surface2={surface2} border={border} border2={border2} text={text} muted={muted} itemOrders={itemOrders} availability={availability} onEdit={onEdit}/>
        )}
        {(activeTab==="transactions"||activeTab==="history")&&(
          <TxnHistoryTab activeTab={activeTab} item={item} T={T} isDark={isDark} surface={surface} surface2={surface2} border={border} border2={border2} text={text} muted={muted} itemOrders={itemOrders} ordersLoading={ordersLoading} itemAdjustments={itemAdjustments} adjLoading={adjLoading}/>
        )}
      </div>
    </div>
  );
}

/* ─── Badge ──────────────────────────────────────────────────────────── */
function Badge({ tone, children }) {
  const colors = {
    good:    { bg:"rgba(16,185,129,.12)",  color:"#10b981" },
    warn:    { bg:"rgba(245,158,11,.12)",  color:"#f59e0b" },
    bad:     { bg:"rgba(239,68,68,.12)",   color:"#ef4444" },
    neutral: { bg:"rgba(100,116,139,.12)", color:"#64748b" },
  };
  const c = colors[tone] || colors.good;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:500,background:c.bg,color:c.color,fontFamily:"'DM Sans',sans-serif",letterSpacing:0}}>
      <i style={{width:6,height:6,borderRadius:"50%",background:c.color,display:"inline-block"}}/>
      {children}
    </span>
  );
}

/* ─── KPI card ───────────────────────────────────────────────────────── */
function KpiCard({ label, value, tone, sub, icon, bar, T, isDark, muted, text }) {
  const toneStyle = {
    bad:  { ico:{ bg:isDark?"rgba(239,68,68,.15)":"#fee2e2", color:"#ef4444" }, val:{ color:"#ef4444" } },
    warn: { ico:{ bg:isDark?"rgba(245,158,11,.15)":"#fef3c7", color:"#f59e0b" }, val:{ color:"#f59e0b" } },
    good: { ico:{ bg:isDark?"rgba(16,185,129,.15)":"#d1fae5", color:T.green }, val:{ color:T.green } },
    "":   { ico:{ bg:isDark?"rgba(255,255,255,.07)":"rgba(0,0,0,.05)", color:muted }, val:{ color:text } },
  };
  const ts = toneStyle[tone||""] || toneStyle[""];
  const barColor = bar?.state==="out"||bar?.state==="critical" ? "#ef4444" : bar?.state==="low" ? "#f59e0b" : T.green;
  return (
    <div className="inv-kpi">
      <div className="kpi-k">
        {label}
        <span style={{width:22,height:22,borderRadius:6,display:"grid",placeItems:"center",...ts.ico}}>{icon}</span>
      </div>
      <div className="kpi-v" style={ts.val}>{value}</div>
      <div className="kpi-sub">{sub}</div>
      {bar&&(
        <div style={{marginTop:9,height:5,borderRadius:99,background:isDark?"rgba(255,255,255,.07)":"rgba(0,0,0,.07)",overflow:"hidden",position:"relative"}}>
          <div style={{height:"100%",width:`${bar.pct}%`,background:barColor,borderRadius:99}}/>
          {bar.reoPct>0&&bar.reoPct<100&&(
            <div style={{position:"absolute",top:-2,bottom:-2,left:`${bar.reoPct}%`,width:1.5,background:isDark?"rgba(255,255,255,.5)":"rgba(0,0,0,.35)"}}/>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Overview tab ────────────────────────────────────────────────────── */
function OverviewTab({ item, T, isDark, surface, border, border2, text, muted, itemOrders }) {
  const qty = parseFloat(item.quantity||0);
  const fmtD = (d)=>d?new Date(d).toLocaleDateString("en-AE",{day:"2-digit",month:"short",year:"numeric"}):"—";
  const recentTxns = itemOrders.slice(-5).reverse();


  const cardStyle = { background:surface, border:`1px solid ${border}`, borderRadius:11, overflow:"hidden" };
  const cardH     = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", borderBottom:`1px solid ${border}`, fontSize:12, fontWeight:600, color:text, letterSpacing:".01em" };
  const cardB     = { padding:"8px 14px 14px" };

  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1.05fr",gap:14,padding:"18px 24px"}}>
      {/* LEFT */}
      <div style={{display:"flex",flexDirection:"column",gap:14,minWidth:0}}>
        {/* Item details card */}
        <div style={cardStyle}>
          <div style={cardH}>Item details <span style={{fontSize:11.5,fontWeight:500,color:muted,cursor:"pointer"}}>Edit</span></div>
          <div style={cardB}>
            <div style={{display:"grid",gridTemplateColumns:"110px 1fr",rowGap:8,columnGap:12,paddingTop:6}}>
              {[
                ["SKU / Code", <span className="mono" style={{fontFamily:"'DM Mono',monospace"}}>{item.item_code||"—"}</span>],
                ["Brand",      <span style={{display:"flex",alignItems:"center",gap:6}}><FaIndustry size={12} style={{color:muted}}/>{item.brand||"—"}</span>],
                ["Category",   <span style={{display:"flex",alignItems:"center",gap:6}}><FaTag size={12} style={{color:muted}}/>{item.category||"—"}</span>],
                ["Type",       <span style={{textTransform:"capitalize"}}>{item.type||"goods"}</span>],
                ["Unit",       item.unit||"—"],
                ["Reorder pt", item.reorder_point||"—"],
              ].map(([k,v])=>(
                <>
                  <div key={k+"k"} style={{color:muted,fontSize:12}}>{k}</div>
                  <div key={k+"v"} style={{fontSize:12.5,color:text,display:"flex",alignItems:"center",gap:8}}>{v}</div>
                </>
              ))}
            </div>
          </div>
        </div>

        {/* Description card */}
        {(item.description||item.sales_description)&&(
          <div style={cardStyle}>
            <div style={cardH}>Description</div>
            <div style={cardB}>
              <p style={{fontSize:12.5,color:muted,margin:0,lineHeight:1.55}}>{item.sales_description||item.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div style={{display:"flex",flexDirection:"column",gap:14,minWidth:0}}>
        {/* Stock level card */}
        <div style={cardStyle}>
          <div style={cardH}>Stock level <span style={{fontSize:11.5,fontWeight:500,color:muted}}>{qty} {item.unit||"units"} on hand</span></div>
          <div style={cardB}>
            <div style={{height:8,background:isDark?"rgba(255,255,255,.07)":"rgba(0,0,0,.07)",borderRadius:99,overflow:"hidden",marginBottom:10,position:"relative"}}>
              <div style={{height:"100%",width:`${stockPct(qty,parseFloat(item.reorder_point||0))}%`,background:
                stockState(item.quantity,item.reorder_point)==="out"||stockState(item.quantity,item.reorder_point)==="critical"?T.red:
                stockState(item.quantity,item.reorder_point)==="low"?T.amber:T.green,
                borderRadius:99,transition:"width .6s ease"}}/>
              {parseFloat(item.reorder_point||0)>0&&(
                <div style={{position:"absolute",top:-2,bottom:-2,left:`${(parseFloat(item.reorder_point)/Math.max(parseFloat(item.reorder_point)*3,1))*100}%`,width:2,background:isDark?"rgba(255,255,255,.6)":"rgba(0,0,0,.4)"}}/>
              )}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,color:muted}}>
              <span>0</span>
              {item.reorder_point&&<span style={{color:T.amber}}>Reorder: {item.reorder_point}</span>}
              <span>Target: {Math.max(parseFloat(item.reorder_point||0)*3,qty*1.5).toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Recent transactions card */}
        <div style={cardStyle}>
          <div style={cardH}>
            Recent transactions
            <span style={{fontSize:11.5,fontWeight:500,color:muted,cursor:"pointer"}}>View all →</span>
          </div>
          <div style={{...cardB,padding:0}}>
            {recentTxns.length===0?(
              <div style={{padding:"20px 14px",textAlign:"center",color:muted,fontSize:12.5}}>No transactions yet</div>
            ):recentTxns.map((o,i)=>(
              <div key={o.id||i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderTop:i>0?`1px dashed ${border2}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                  <div style={{width:26,height:26,borderRadius:7,flexShrink:0,display:"grid",placeItems:"center",
                    background:o.type==="purchase"?(isDark?"rgba(16,185,129,.15)":"#dcfce7"):(isDark?"rgba(59,130,246,.15)":"#eff6ff"),
                    color:o.type==="purchase"?T.green:T.blue}}>
                    {o.type==="purchase"?<FaArrowDown size={11}/>:<FaArrowUp size={11}/>}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:500,color:text}}>{o.orderNumber||"—"} <span style={{color:muted,fontWeight:400}}>· {o.partyName}{o.forCustomer?` · for ${o.forCustomer}`:""}</span></div>
                    <div style={{fontSize:11,color:muted}}>{fmtD(o.date)}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:12.5,fontWeight:600,color:o.type==="purchase"?T.green:T.blue}}>{o.type==="purchase"?"+":"−"}{o.qty} {item.unit||"u"}</div>
                  <div style={{fontSize:10.5,color:muted}}>{fmtAED(o.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Transactions / History tab ─────────────────────────────────────── */
function TxnHistoryTab({ activeTab, item, T, isDark, surface2, border, border2, text, muted, itemOrders, ordersLoading, itemAdjustments, adjLoading }) {
  void surface2;
  const [collapsed, setCollapsed] = useState({});
  const fmtA=(n)=>fmtAED(n);
  const fmtD=(d)=>d?new Date(d).toLocaleDateString("en-AE",{day:"2-digit",month:"short",year:"numeric"}):"—";
  const SC={
    open:{t:T.blue,bg:T.blueDim},invoiced:{t:T.green,bg:T.greenDim},completed:{t:T.green,bg:T.greenDim},
    received:{t:T.green,bg:T.greenDim},cancelled:{t:T.red,bg:T.redDim},draft:{t:muted,bg:isDark?"rgba(255,255,255,.06)":"#f1f5f9"},pending:{t:T.amber,bg:T.amberDim}
  };
  const sc=(s)=>SC[s]||SC.draft;

  if(activeTab==="history"){
    if(ordersLoading||adjLoading) return <div style={{textAlign:"center",padding:"48px 0",color:muted,fontSize:13}}>Loading…</div>;
    const REASON_LABEL = { sale:"Sale (Dispatched)", return:"Sales Return", purchase:"Purchase", damaged:"Damaged", expired:"Expired", found:"Found", correction:"Correction", transfer:"Transfer", other:"Other" };
    // History uses ONLY real adjustment records (written by deductStockOnDispatch + GRN confirms).
    // SOs in draft/pending would cause phantom decreases — they belong in Transactions tab only.
    const histEntries = [...itemAdjustments]
      .sort((a,b)=>new Date(a.adjustedAt||a.createdAt)-new Date(b.adjustedAt||b.createdAt));
    if(!histEntries.length) return <Empty text icon={<FaBarcode size={22}/>} title="No History" sub="Stock movements appear here after dispatches and adjustments." T={T} muted={muted}/>;
    return (
      <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:0}}>
        <TLine dotColor={T.green} text={text} muted={muted} border={border} label="Opening Stock" sub={`${item.opening_stock||0} units · Initial inventory`}/>
        {histEntries.map((a,i)=>{
          const isInc = a.type==="increase";
          const dotColor = isInc ? T.green : T.red;
          const label = REASON_LABEL[a.reason] || a.reason || "Adjustment";
          const qty = a.quantity ?? 0;
          const partyPart = a.partyName ? ` · ${a.partyName}` : "";
          return <TLine key={a._id||i} dotColor={dotColor} text={text} muted={muted} border={border}
            label={<>{label} — <span style={{fontFamily:"monospace",color:dotColor}}>{isInc?"+":"−"}{qty} units</span></>}
            sub={`${fmtD(a.adjustedAt||a.createdAt)}${a.reference?" · "+a.reference:""}${partyPart}`}/>;
        })}
        <TLine dotColor={T.blue} text={text} muted={muted} border={border} label="Current Stock" sub={`${item.quantity||0} units remaining`} isLast/>
      </div>
    );
  }

  if(ordersLoading) return <div style={{textAlign:"center",padding:"48px 0",color:muted,fontSize:13}}>Loading…</div>;

  const sales    = itemOrders.filter(o=>o.type==="sale");
  const purchases= itemOrders.filter(o=>o.type==="purchase");   // confirmed GRNs — actual stock movements
  const onOrder  = itemOrders.filter(o=>o.type==="onorder");    // issued POs — pending receipt
  if(itemOrders.length===0) return <Empty icon={<FaBox size={22}/>} title="No Transactions" sub="Sales and purchase orders appear here." T={T} muted={muted}/>;

  const TxTable=({rows,color,label})=>{
    const isOpen = !collapsed[label];
    const toggle = ()=>setCollapsed(c=>({...c,[label]:!c[label]}));
    return (
    <div style={{marginBottom:16}}>
      <button onClick={toggle} className="tx-acc"
        style={{display:"flex",alignItems:"center",gap:9,marginBottom:isOpen?8:0,background:isDark?`${color}12`:`${color}0d`,border:`1px solid ${isDark?`${color}33`:`${color}26`}`,borderRadius:9,cursor:"pointer",padding:"9px 12px",fontFamily:"inherit",width:"100%",transition:"background .15s"}}>
        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:5,background:color,color:"#fff",fontSize:11,fontWeight:700,flexShrink:0,transform:isOpen?"rotate(90deg)":"none",transition:"transform .15s"}}>›</span>
        <span style={{width:7,height:7,borderRadius:"50%",background:color}}/>
        <span style={{fontSize:10,fontWeight:700,color,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</span>
        <span style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,fontWeight:700,color,background:isDark?`${color}22`:`${color}1a`,borderRadius:20,padding:"1px 8px"}}>{rows.length}</span>
          <span style={{fontSize:10,color:muted,fontWeight:500}}>{isOpen?"Hide":"Show"}</span>
        </span>
      </button>
      {isOpen && (
      <div style={{border:`1px solid ${border}`,borderRadius:9,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1.1fr 1fr .8fr .7fr .8fr 70px",padding:"7px 12px",background:isDark?`${color}08`:`${color}10`,borderBottom:`1px solid ${border}`}}>
          {["Date","Order #","Party","Qty","Total","Status"].map(h=>(
            <span key={h} style={{fontSize:9,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:".06em"}}>{h}</span>
          ))}
        </div>
        {rows.map((o,i)=>{
          const s=sc(o.status);
          return (
            <div key={o.id||i} style={{display:"grid",gridTemplateColumns:"1.1fr 1fr .8fr .7fr .8fr 70px",padding:"9px 12px",borderBottom:i<rows.length-1?`1px solid ${border2}`:"none",alignItems:"center"}}>
              <span style={{fontSize:10,color:muted}}>{fmtD(o.date)}</span>
              <span style={{fontSize:10,color,fontWeight:600,fontFamily:"monospace"}}>{o.orderNumber||"—"}</span>
              <span style={{fontSize:10,color:text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.partyName}{o.forCustomer&&<span style={{color:muted}}> · for {o.forCustomer}</span>}</span>
              <span className="sora" style={{fontSize:11,fontWeight:700,color}}>{o.type==="sale"?"−":"+"}{ o.qty}</span>
              <span style={{fontSize:10,color:text,fontFamily:"monospace"}}>{fmtA(o.total)}</span>
              <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:20,fontSize:9,fontWeight:600,background:s.bg,color:s.t,textTransform:"capitalize",width:"fit-content"}}>
                <span style={{width:4,height:4,borderRadius:"50%",background:s.t}}/>{o.status||"—"}
              </span>
            </div>
          );
        })}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",borderTop:`1px solid ${border}`,background:isDark?`${color}05`:`${color}08`}}>
          <span style={{fontSize:11,color:muted}}>{rows.length} order{rows.length!==1?"s":""}</span>
          <span className="sora" style={{fontSize:12,fontWeight:700,color,fontFamily:"monospace"}}>{fmtA(rows.reduce((s,o)=>s+o.total,0))}</span>
        </div>
      </div>
      )}
    </div>
    );
  };

  return (
    <div style={{padding:"20px 24px"}}>
      {purchases.length>0&&<TxTable rows={purchases} color={T.green} label="Inbound — Goods Received (GRN)"/>}
      {onOrder.length>0&&<TxTable rows={onOrder} color={T.amber} label="On Order — Pending Receipt"/>}
      {sales.length>0&&<TxTable rows={sales} color={T.blue} label="Outbound — Sales Orders"/>}
    </div>
  );
}

/* ─── Timeline entry ─────────────────────────────────────────────────── */
function TLine({ dotColor, label, sub, text, muted, border, isLast }) {
  return (
    <div style={{display:"flex",gap:12,paddingBottom:isLast?0:16,position:"relative"}}>
      {!isLast&&<div style={{position:"absolute",left:6,top:16,bottom:0,width:1,background:border}}/>}
      <div style={{width:13,height:13,borderRadius:"50%",background:dotColor,flexShrink:0,marginTop:3,position:"relative",zIndex:1}}/>
      <div>
        <div style={{fontSize:12,fontWeight:600,color:text}}>{label}</div>
        <div style={{fontSize:10,color:muted,marginTop:2}}>{sub}</div>
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────── */
function Empty({ icon, title, sub, T, muted }) {
  void T;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",textAlign:"center",opacity:.6}}>
      <div style={{color:muted,marginBottom:12}}>{icon}</div>
      <p style={{fontSize:13,fontWeight:600,margin:"0 0 5px"}}>{title}</p>
      <p style={{fontSize:11,color:muted,margin:0}}>{sub}</p>
    </div>
  );
}
