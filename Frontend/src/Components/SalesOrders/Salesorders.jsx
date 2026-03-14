import { useEffect, useState , useRef, useCallback} from "react";
import {
  FaPlus, FaTimes, FaSearch, FaShoppingCart,
  FaChevronLeft, FaChevronRight, FaBoxOpen,
  FaFileInvoiceDollar, FaEdit, FaBan,
  FaSortAmountDown, FaSortAmountUp, FaDownload,
  FaCheckCircle, FaClock, FaTimesCircle, FaSpinner
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import useGetAllSalesOrder from "../../helper/useGetAllSalesOrder";
import useWebSocket from "../../helper/useWebSocket";
import useThemeStore, { getTheme } from "../../store/useThemeStore";


const CustomSelect = ({ value, onChange, options, placeholder = "Select", minWidth = 120 }) => {
  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);

  // options: [{ label, value }] or plain strings
  const opts     = options.map(o => typeof o === "string" ? { label: o, value: o } : o);
  const selected = opts.find(o => o.value === value);

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(opts.length * 40 + 12, 220);
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, minWidth) });
    setReady(true);
  }, [opts.length, minWidth]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() =>
      rafRef.current = requestAnimationFrame(() => measurePos())
    );
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    if (!open) return;
    const upd = () => measurePos();
    window.addEventListener("scroll", upd, true);
    window.addEventListener("resize", upd);
    return () => { window.removeEventListener("scroll", upd, true); window.removeEventListener("resize", upd); };
  }, [open, measurePos]);

  useEffect(() => {
    const h = e => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          dropRef.current    && !dropRef.current.contains(e.target))
        { setOpen(false); setReady(false); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Grab T from the nearest theme store — read directly so this stays stateless
  const isDarkNow = (() => { try { return JSON.parse(localStorage.getItem("nexus-theme") || "{}").state?.isDark ?? true; } catch { return true; } })();
  const bg      = isDarkNow ? "#111d30" : "#ffffff";
  const border  = isDarkNow ? "rgba(255,255,255,0.07)" : "#e2e8f0";
  const textPri = isDarkNow ? "#e2e8f0" : "#1e293b";
  const textSec = isDarkNow ? "#64748b" : "#94a3b8";
  const hoverBg = isDarkNow ? "rgba(59,130,246,0.08)" : "#eff6ff";
  const activeBg= isDarkNow ? "rgba(59,130,246,0.15)" : "#eff6ff";
  const activeC = isDarkNow ? "#60a5fa" : "#1d4ed8";
  const focusBorder = isDarkNow ? "rgba(59,130,246,0.5)" : "#93c5fd";

  const dropdown = (
    <div ref={dropRef} style={{
      position: "absolute", top: dropPos.top, left: dropPos.left, width: dropPos.width,
      zIndex: 99999, background: bg, border: `1.5px solid ${border}`, borderRadius: "11px",
      boxShadow: isDarkNow ? "0 16px 48px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)",
      overflow: "hidden", fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      boxSizing: "border-box", visibility: ready ? "visible" : "hidden",
      opacity: ready ? 1 : 0, transition: "opacity 0.12s ease",
    }}>
      <div style={{ padding: "5px" }}>
        {opts.map((opt, i) => {
          const isAct = opt.value === value;
          return (
            <div key={i} onClick={() => { onChange(opt.value); setOpen(false); setReady(false); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 11px", borderRadius: "7px", cursor: "pointer", fontSize: "12px",
                fontWeight: isAct ? "600" : "400", color: isAct ? activeC : textPri,
                background: isAct ? activeBg : "transparent", transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = "transparent"; }}>
              {opt.label}
              {isAct && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={activeC} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={triggerRef} onClick={handleOpen} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "34px", padding: "0 11px", minWidth,
      border: `1px solid ${open ? focusBorder : border}`, borderRadius: "7px",
      background: bg, cursor: "pointer", userSelect: "none",
      boxShadow: open ? `0 0 0 3px ${isDarkNow ? "rgba(59,130,246,0.15)" : "rgba(147,197,253,0.25)"}` : "none",
      transition: "border-color 0.15s, box-shadow 0.15s", boxSizing: "border-box", gap: "8px",
    }}>
      <span style={{ fontSize: "12px", fontWeight: "500", color: selected ? textPri : textSec,
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", whiteSpace: "nowrap" }}>
        {selected ? selected.label : placeholder}
      </span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={open ? activeC : textSec}
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 2 }).format(amount || 0);

const formatDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
};

const formatStatus = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";

const transformOrders = (apiData) => {
  if (!apiData?.salesOrders) return [];
  return apiData.salesOrders.map(o => ({
    id:                  o.id,
    saleOrderNumber:     o.orderNumber,
    status:              formatStatus(o.status),
    rawStatus:           (o.status || "").toLowerCase(),
    customer:            o.customerName || "N/A",
    customerCode:        o.customerCode,
    lpoNumber:           o.lpoNumber || "—",
    lpoValue:            o.lpoValue || 0,
    total:               o.total || 0,
    orderDate:           o.orderDate,
    lpoDate:             o.lpoDate,
    expectedShipmentDate:o.expectedShipmentDate,
    paymentTerms:        o.paymentTerms,
    salesperson:         o.salesperson,
    items:               o.items || [],
    subTotal:            o.subTotal || 0,
    shippingCharges:     o.shippingCharges || 0,
    adjustment:          o.adjustment || 0,
    vat:                 o.vat || 0,
    createdAt:           o.createdAt,
  }));
};

const STATUS_CFG = {
  draft:      { color: "#f59e0b", dim: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)",  label: "Draft"       },
  confirmed:  { color: "#10b981", dim: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)",  label: "Confirmed"   },
  open:       { color: "#3b82f6", dim: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.25)",  label: "Open"        },
  "in progress":{ color:"#8b5cf6",dim:"rgba(139,92,246,0.12)",   border:"rgba(139,92,246,0.25)",   label:"In Progress"  },
  completed:  { color: "#10b981", dim: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)",  label: "Completed"   },
  closed:     { color: "#64748b", dim: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.25)", label: "Closed"      },
  cancelled:  { color: "#ef4444", dim: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   label: "Cancelled"   },
};
const getStatus = (raw) => STATUS_CFG[raw?.toLowerCase()] || STATUS_CFG.closed;

const Salesorders = () => {
  const { handleGetSalesorder, data, loading, error } = useGetAllSalesOrder();
  const navigate  = useNavigate();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);

  const [drawer,        setDrawer]       = useState(false);
  const [selected,      setSelected]     = useState(null);
  const [activeTab,     setActiveTab]    = useState("overview");
  const [search,        setSearch]       = useState("");
  const [statusFilter,  setStatusFilter] = useState("all");
  const [sortBy,        setSortBy]       = useState("date");
  const [sortDir,       setSortDir]      = useState("desc");
  const [page,          setPage]         = useState(1);
  const perPage = 10;

  useEffect(() => { handleGetSalesorder(); }, [handleGetSalesorder]);

  useWebSocket((event) => {
    if (event.type === "sales_orders_updated") handleGetSalesorder();
  });

  const allOrders = data ? transformOrders(data) : [];

  // filter + sort
  const filtered = allOrders
    .filter(o => statusFilter === "all" || o.rawStatus === statusFilter)
    .filter(o => {
      const q = search.toLowerCase();
      return !q || o.saleOrderNumber?.toLowerCase().includes(q) ||
        o.customer?.toLowerCase().includes(q) || o.lpoNumber?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let av, bv;
      if (sortBy === "date")     { av = new Date(a.orderDate||0); bv = new Date(b.orderDate||0); }
      else if (sortBy === "total"){ av = a.total; bv = b.total; }
      else                       { av = (a.saleOrderNumber||"").toLowerCase(); bv = (b.saleOrderNumber||"").toLowerCase(); }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const totalPages   = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentItems = filtered.slice((page - 1) * perPage, page * perPage);

  const stats = {
    total:    allOrders.length,
    open:     allOrders.filter(o => ["open","confirmed","in progress"].includes(o.rawStatus)).length,
    pending:  allOrders.filter(o => o.rawStatus === "draft").length,
    value:    allOrders.reduce((s, o) => s + o.total, 0),
  };

  const openDrawer = (item) => { setSelected(item); setDrawer(true); setActiveTab("overview"); };
  const closeDrawer = () => { setDrawer(false); setSelected(null); };

  // ── Dynamic CSS ───────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
    .so-root * { box-sizing: border-box; }
    .so-root { font-family: 'Inter', sans-serif; }
    .so-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }

    html, body, * { scrollbar-width: thin; scrollbar-color: ${isDark ? "rgba(255,255,255,0.12) transparent" : "rgba(0,0,0,0.14) transparent"}; }
    html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { width: 5px; height: 5px; }
    html::-webkit-scrollbar-track, body::-webkit-scrollbar-track, *::-webkit-scrollbar-track { background: transparent; }
    html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.13)"}; border-radius: 999px; transition: background 0.2s; }
    html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover, *::-webkit-scrollbar-thumb:hover { background: ${isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.24)"}; }
    html::-webkit-scrollbar-corner, body::-webkit-scrollbar-corner, *::-webkit-scrollbar-corner { background: transparent; }

    .so-stat { transition: transform 0.18s ease, box-shadow 0.18s ease; }
    .so-stat:hover { transform: translateY(-2px); box-shadow: ${isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.1)"} !important; }

    .so-row { transition: background 0.1s; }
    .so-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .so-row:hover .so-order-num { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .so-pill { transition: all 0.15s; cursor: pointer; }
    .so-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .so-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }

    .so-tbl-btn { transition: all 0.12s; }
    .so-tbl-btn:hover { background: ${isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9"} !important; color: ${isDark ? "#e2e8f0" : "#0f172a"} !important; }

    .so-page-btn { transition: all 0.12s; }
    .so-page-btn:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .so-action-btn { transition: all 0.15s; }
    .so-action-btn:hover { opacity: 0.85; transform: translateY(-1px); }

    .drawer-tab { transition: all 0.15s; border-bottom: 2px solid transparent; }
    .drawer-tab:hover { color: ${isDark ? "#94a3b8" : "#374151"} !important; }
    .drawer-tab-active { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-bottom-color: ${isDark ? "#3b82f6" : "#2563eb"} !important; }

    .detail-row { transition: background 0.1s; }
    .detail-row:hover { background: ${isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"} !important; }

    .fin-row { transition: background 0.1s; }
    .fin-row:hover { background: ${isDark ? "rgba(255,255,255,0.03)" : "#f8fafc"} !important; }

    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin    { to { transform: rotate(360deg); } }

    .so-drawer-anim  { animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .so-overlay-anim { animation: fadeIn 0.2s ease forwards; }
    .so-fade-up      { animation: fadeUp 0.3s ease both; }
    .so-fade-up-1    { animation: fadeUp 0.3s 0.05s ease both; }
    .so-fade-up-2    { animation: fadeUp 0.3s 0.10s ease both; }
    .so-spin         { animation: spin 0.8s linear infinite; }

    .sort-sel option { background: ${T.surface2}; color: ${T.textPri}; }
  `;

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", transition: "background 0.25s, border-color 0.25s" };

  // ── Loading ───────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg }}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <div className="so-spin" style={{ width: "36px", height: "36px", border: `3px solid ${T.border}`, borderTopColor: T.blue, borderRadius: "50%" }} />
        <span style={{ color: T.textSec, fontSize: "13px", fontFamily: "Inter, sans-serif" }}>Loading sales orders…</span>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: "20px", color: T.red, background: T.redDim, borderRadius: "12px", margin: "24px", border: `1px solid rgba(239,68,68,0.2)`, fontFamily: "Inter, sans-serif" }}>
      Error: {error}
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="so-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* ── HEADER ──────────────────────────────────────────── */}
        <div className="so-fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h1 className="so-jakarta" style={{ fontSize: "20px", fontWeight: "700", color: T.textPri, margin: 0 }}>Sales Orders</h1>
            <p style={{ color: T.textSec, fontSize: "13px", marginTop: "4px" }}>Manage and track all your sales orders</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="so-action-btn"
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px", fontSize: "13px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit", background: "transparent", color: T.textSec, border: `1px solid ${T.border}` }}>
              <FaDownload size={11} /> Export
            </button>
            <button className="so-action-btn" onClick={() => navigate("/Sales/Salesorders/Newsalesorders")}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", background: T.blue, color: "white", border: "none" }}>
              <FaPlus size={11} /> New Sales Order
            </button>
          </div>
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────── */}
        <div className="so-fade-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" }}>
          {[
            { label: "Total Orders",  value: stats.total,              icon: <FaShoppingCart />,     color: T.blue,   dim: T.blueDim   },
            { label: "Active Orders", value: stats.open,               icon: <FaCheckCircle />,      color: T.green,  dim: T.greenDim  },
            { label: "Drafts",        value: stats.pending,            icon: <FaClock />,            color: T.amber,  dim: T.amberDim  },
            { label: "Total Value",   value: formatCurrency(stats.value), icon: <FaFileInvoiceDollar />, color: T.purple, dim: T.purpleDim, small: true },
          ].map((c, i) => (
            <div key={i} className="so-stat" style={{ ...card, padding: "18px 20px", position: "relative", overflow: "hidden", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ position: "absolute", top: 0, left: "16px", right: "16px", height: "1px", background: `linear-gradient(90deg, transparent, ${c.color}${isDark ? "50" : "60"}, transparent)` }} />
              <div>
                <p style={{ fontSize: "11px", color: T.textSec, fontWeight: "500", margin: "0 0 8px" }}>{c.label}</p>
                <p className="so-jakarta" style={{ fontSize: c.small ? "15px" : "24px", fontWeight: "700", color: T.textPri, margin: 0, lineHeight: 1 }}>{c.value}</p>
              </div>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{c.icon}</div>
            </div>
          ))}
        </div>

        {/* ── TOOLBAR ─────────────────────────────────────────── */}
        <div className="so-fade-up-2" style={{ ...card, padding: "12px 16px", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
              <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: "11px", pointerEvents: "none" }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by order #, customer, LPO…"
                style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "13px", background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
              {search && (
                <button onClick={() => setSearch("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}>
                  <FaTimes size={11} />
                </button>
              )}
            </div>

            {/* Status pills */}
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {["all", "open", "confirmed", "draft", "in progress", "completed", "cancelled"].map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`so-pill${statusFilter === s ? " so-pill-active" : ""}`}
                  style={{ padding: "5px 11px", borderRadius: "7px", fontSize: "12px", fontWeight: "500", background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {s === "all" ? "All" : formatStatus(s)}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div style={{ display: "flex", gap: "6px", marginLeft: "auto" }}>
              <CustomSelect
                value={sortBy}
                onChange={v => { setSortBy(v); setCurrentPage(1); }}
                options={[
                  { label: "Date",        value: "date"        },
                  { label: "Value",     value: "total"     },
                  { label: "Order #",        value: "order"        },
                
                ]}
                minWidth={130}
              />
              {/* <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} className="sort-sel"
                style={{ padding: "6px 12px", border: `1px solid ${T.border}`, borderRadius: "7px", fontSize: "12px", color: T.textSec, background: T.surface2, fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                <option value="date">Date</option>
                <option value="total">Value</option>
                <option value="order">Order #</option>
              </select> */}
              <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
                style={{ padding: "6px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: T.surface2, color: T.textSec, cursor: "pointer", display: "flex", alignItems: "center" }}>
                {sortDir === "asc" ? <FaSortAmountDown size={12} /> : <FaSortAmountUp size={12} />}
              </button>
            </div>

            <span style={{ fontSize: "12px", color: T.textSec, whiteSpace: "nowrap" }}>{filtered.length} order{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* ── TABLE ───────────────────────────────────────────── */}
        <div style={{ ...card, overflow: "hidden", marginBottom: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                <th style={{ padding: "11px 16px", width: "32px" }}>
                  <input type="checkbox" style={{ accentColor: T.blue }} />
                </th>
                {["Order #", "Status", "Customer", "LPO Number", "LPO Value", "Total", "Date", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i >= 4 && i <= 5 ? "right" : "left", fontSize: "11px", fontWeight: "600", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? currentItems.map((item, idx) => {
                const sc = getStatus(item.rawStatus);
                return (
                  <tr key={item.id || idx} className="so-row" style={{ borderBottom: `1px solid ${T.border2}` }}>
                    <td style={{ padding: "13px 16px" }}><input type="checkbox" style={{ accentColor: T.blue }} /></td>

                    {/* Order # */}
                    <td style={{ padding: "13px 16px" }}>
                      <span className="so-order-num so-jakarta" onClick={() => openDrawer(item)}
                        style={{ fontWeight: "700", fontSize: "13px", color: T.blue, cursor: "pointer", transition: "color 0.15s" }}>
                        {item.saleOrderNumber}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "999px", background: sc.dim, color: sc.color, border: `1px solid ${sc.border}` }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.color, display: "inline-block", flexShrink: 0 }} />
                        {item.status}
                      </span>
                    </td>

                    {/* Customer */}
                    <td style={{ padding: "13px 16px" }}>
                      <p style={{ fontWeight: "600", color: T.textPri, margin: 0, fontSize: "13px" }}>{item.customer}</p>
                      {item.customerCode && <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0", fontFamily: "monospace" }}>{item.customerCode}</p>}
                    </td>

                    {/* LPO */}
                    <td style={{ padding: "13px 16px", color: T.textSec, fontSize: "12px" }}>{item.lpoNumber}</td>

                    {/* LPO Value */}
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <span className="so-jakarta" style={{ fontWeight: "600", color: T.textPri, fontSize: "13px" }}>{formatCurrency(item.lpoValue)}</span>
                    </td>

                    {/* Total */}
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <span className="so-jakarta" style={{ fontWeight: "700", color: T.textPri, fontSize: "13px" }}>{formatCurrency(item.total)}</span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: "13px 16px", color: T.textSec, fontSize: "12px", whiteSpace: "nowrap" }}>{formatDate(item.orderDate)}</td>

                    {/* Actions */}
                    <td style={{ padding: "13px 12px" }}>
                      <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                        <button className="so-tbl-btn" onClick={() => openDrawer(item)}
                          style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "11px", color: T.textSec, cursor: "pointer", fontFamily: "inherit", fontWeight: "500" }}>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="9" style={{ padding: "64px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: T.textMuted }}>
                        <FaBoxOpen />
                      </div>
                      <p className="so-jakarta" style={{ fontWeight: "600", color: T.textPri, fontSize: "15px", margin: 0 }}>No sales orders found</p>
                      <p style={{ color: T.textSec, fontSize: "13px", margin: 0 }}>
                        {statusFilter !== "all" ? `No orders with status "${formatStatus(statusFilter)}"` : "Create your first sales order to get started"}
                      </p>
                      <button onClick={() => navigate("/Sales/Salesorders/Newsalesorders")}
                        style={{ marginTop: "4px", padding: "8px 20px", background: T.blue, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                        New Sales Order
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ──────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div style={{ ...card, padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: T.textSec }}>
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "12px", color: page === 1 ? T.textMuted : T.textSec, cursor: page === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                <FaChevronLeft size={10} /> Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push("..."); acc.push(p); return acc; }, [])
                .map((p, i) => p === "..." ? (
                  <span key={`e${i}`} style={{ padding: "5px 8px", color: T.textSec, fontSize: "12px" }}>…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)} className="so-page-btn"
                    style={{ padding: "5px 10px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${page === p ? "rgba(59,130,246,0.35)" : T.border}`, background: page === p ? T.blueDim : "transparent", color: page === p ? T.blueLight : T.textSec }}>
                    {p}
                  </button>
                ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "12px", color: page === totalPages ? T.textMuted : T.textSec, cursor: page === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                Next <FaChevronRight size={10} />
              </button>
            </div>
            <span style={{ fontSize: "12px", color: T.textSec }}>{totalPages} page{totalPages !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* ── DRAWER ──────────────────────────────────────────────── */}
      {drawer && (
        <>
          <div className="so-overlay-anim" onClick={closeDrawer}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />

          <div className="so-drawer-anim"
            style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "440px", maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

            {/* Drawer Header */}
            {selected && (() => {
              const sc = getStatus(selected.rawStatus);
              return (
                <div style={{ padding: "20px 20px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                        <h3 className="so-jakarta" style={{ fontSize: "16px", fontWeight: "700", color: T.textPri, margin: 0 }}>
                          {selected.saleOrderNumber}
                        </h3>
                        <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "999px", background: sc.dim, color: sc.color, border: `1px solid ${sc.border}`, display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                          {selected.status}
                        </span>
                      </div>
                      <p style={{ fontSize: "13px", color: T.textSec, margin: 0 }}>{selected.customer}
                        {selected.customerCode && <span style={{ fontFamily: "monospace", fontSize: "11px", color: T.textMuted, marginLeft: "6px" }}>({selected.customerCode})</span>}
                      </p>
                    </div>
                    <button onClick={closeDrawer}
                      style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "6px", cursor: "pointer", color: T.textSec, display: "flex", flexShrink: 0, marginLeft: "12px" }}>
                      <FaTimes size={12} />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div style={{ display: "flex" }}>
                    {["overview", "items", "history"].map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`drawer-tab${activeTab === tab ? " drawer-tab-active" : ""}`}
                        style={{ padding: "9px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "500", fontFamily: "inherit", color: T.textSec, textTransform: "capitalize" }}>
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
              {selected && activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {/* Key info rows */}
                  {[
                    { label: "LPO Number",    value: selected.lpoNumber,          color: T.blue   },
                    { label: "Order Date",     value: formatDate(selected.orderDate), color: T.purple },
                    { label: "LPO Date",       value: formatDate(selected.lpoDate),  color: T.cyan   },
                    { label: "Expected Ship",  value: formatDate(selected.expectedShipmentDate), color: T.green },
                    { label: "Payment Terms",  value: selected.paymentTerms || "—", color: T.amber  },
                    { label: "Salesperson",    value: selected.salesperson || "—",  color: T.purple },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="detail-row"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", background: T.surface2, borderRadius: "10px", border: `1px solid ${T.border2}` }}>
                      <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500" }}>{label}</span>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: T.textPri }}>{value}</span>
                    </div>
                  ))}

                  {/* Financial summary */}
                  <div style={{ background: T.surface2, borderRadius: "12px", border: `1px solid ${T.border2}`, overflow: "hidden", marginTop: "4px" }}>
                    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border2}` }}>
                      <p className="so-jakarta" style={{ fontSize: "12px", fontWeight: "700", color: T.textPri, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Financial Summary</p>
                    </div>
                    {[
                      { label: "LPO Value",        value: formatCurrency(selected.lpoValue)         },
                      { label: "Subtotal",          value: formatCurrency(selected.subTotal)         },
                      { label: "Shipping",          value: formatCurrency(selected.shippingCharges)  },
                      { label: "Adjustment",        value: formatCurrency(selected.adjustment)       },
                      { label: "VAT (5%)",          value: formatCurrency(selected.vat)              },
                    ].map(({ label, value }) => (
                      <div key={label} className="fin-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.border2}` }}>
                        <span style={{ fontSize: "12px", color: T.textSec }}>{label}</span>
                        <span style={{ fontSize: "13px", fontWeight: "500", color: T.textPri }}>{value}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: isDark ? "rgba(59,130,246,0.06)" : "#eff6ff" }}>
                      <span className="so-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri }}>Total</span>
                      <span className="so-jakarta" style={{ fontSize: "15px", fontWeight: "800", color: T.blue }}>{formatCurrency(selected.total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {selected && activeTab === "items" && (
                <div>
                  {selected.items?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {selected.items.map((item, i) => (
                        <div key={i} style={{ background: T.surface2, borderRadius: "11px", border: `1px solid ${T.border2}`, padding: "13px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: "13px", fontWeight: "600", color: T.textPri, margin: 0 }}>{item.details || `Item ${i + 1}`}</p>
                              <p style={{ fontSize: "12px", color: T.textSec, margin: "4px 0 0" }}>
                                Qty {item.quantity} × {formatCurrency(item.rate)}
                                {item.discount && <span style={{ marginLeft: "8px", color: T.amber }}> -{item.discount}</span>}
                              </p>
                            </div>
                            <span className="so-jakarta" style={{ fontSize: "14px", fontWeight: "700", color: T.textPri, marginLeft: "12px", flexShrink: 0 }}>{formatCurrency(item.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "12px" }}>
                      <div style={{ width: "48px", height: "48px", borderRadius: "13px", background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: T.textMuted }}>
                        <FaBoxOpen />
                      </div>
                      <p className="so-jakarta" style={{ fontWeight: "600", color: T.textPri, fontSize: "14px", margin: 0 }}>No items</p>
                      <p style={{ color: T.textSec, fontSize: "12px", margin: 0 }}>No line items found for this order.</p>
                    </div>
                  )}
                </div>
              )}

              {selected && activeTab === "history" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "12px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "13px", background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: T.textMuted }}>
                    <FaClock />
                  </div>
                  <p className="so-jakarta" style={{ fontWeight: "600", color: T.textPri, fontSize: "14px", margin: 0 }}>No history yet</p>
                  <p style={{ color: T.textSec, fontSize: "12px", margin: 0 }}>Activity will appear here once recorded.</p>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "8px" }}>
              <button className="so-action-btn"
                style={{ flex: 1, padding: "10px", background: T.blue, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                <FaFileInvoiceDollar size={12} /> Generate Invoice
              </button>
              <button className="so-action-btn"
                style={{ flex: 1, padding: "10px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                <FaEdit size={12} /> Edit
              </button>
              <button className="so-action-btn"
                style={{ padding: "10px 14px", background: T.redDim, color: T.red, border: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "#fca5a5"}`, borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FaBan size={12} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Salesorders;