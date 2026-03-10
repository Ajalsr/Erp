import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FaPlus, FaTimes, FaSearch, FaDownload, FaBoxOpen,
  FaChevronLeft, FaChevronRight, FaSortAmountDown, FaSortAmountUp,
  FaShoppingCart, FaCheckCircle, FaClock, FaFileInvoiceDollar,
  FaTruck, FaEdit, FaBan, FaTag, FaReceipt, FaCalendarAlt,
  FaWarehouse, FaExclamationTriangle, FaArrowRight,
  FaListUl
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
//import useGetAllPurchaseOrder from "../../helper/useGetAllPurchaseOrder";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import debounce from "lodash/debounce";

// ─── Helpers ──────────────────────────────────────────────────────
const fmtAED = (n) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 2 }).format(n || 0);

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtRelative = (d) => {
  if (!d) return "";
  const diff = Math.floor((new Date() - new Date(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return fmtDate(d);
};

const fmtStatus = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";

const STATUS_STEPS = ["draft", "pending", "approved", "ordered", "in transit", "received", "completed"];

const STATUS_CFG = {
  draft:        { color: "#94a3b8", dim: "rgba(148,163,184,0.1)",  border: "rgba(148,163,184,0.25)", label: "Draft",       step: 0 },
  pending:      { color: "#f59e0b", dim: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.28)",  label: "Pending",     step: 1 },
  approved:     { color: "#10b981", dim: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.28)",  label: "Approved",    step: 2 },
  ordered:      { color: "#3b82f6", dim: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.28)",  label: "Ordered",     step: 3 },
  "in transit": { color: "#8b5cf6", dim: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.28)",  label: "In Transit",  step: 4 },
  received:     { color: "#06b6d4", dim: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.28)",   label: "Received",    step: 5 },
  completed:    { color: "#10b981", dim: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.28)",  label: "Completed",   step: 6 },
  closed:       { color: "#64748b", dim: "rgba(100,116,139,0.1)",  border: "rgba(100,116,139,0.25)", label: "Closed",      step: 6 },
  cancelled:    { color: "#ef4444", dim: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.25)",   label: "Cancelled",   step: -1 },
};
const getSC = (raw) => STATUS_CFG[(raw || "").toLowerCase()] || STATUS_CFG.draft;

const transformPOs = (apiData) => {
  if (!apiData?.purchaseOrders) return [];
  return apiData.purchaseOrders.map(o => ({
    id:              o.id,
    poNumber:        o.orderNumber || o.poNumber || "—",
    rawStatus:       (o.status || "draft").toLowerCase(),
    vendor:          o.vendorName || o.vendor || "N/A",
    vendorCode:      o.vendorCode || "",
    vendorEmail:     o.vendorEmail || "",
    reference:       o.referenceNumber || o.refNumber || "—",
    deliveryDate:    o.deliveryDate || o.expectedDeliveryDate || null,
    orderDate:       o.orderDate || o.createdAt || null,
    paymentTerms:    o.paymentTerms || "",
    shippingMethod:  o.shippingMethod || "",
    warehouse:       o.warehouse || "",
    items:           o.items || [],
    subTotal:        o.subTotal || 0,
    shippingCharges: o.shippingCharges || 0,
    adjustment:      o.adjustment || 0,
    vat:             o.vat || 0,
    total:           o.total || 0,
    notes:           o.notes || "",
    createdAt:       o.createdAt || null,
  }));
};

// ─── Portal CustomSelect ───────────────────────────────────────────
const CustomSelect = ({ value, onChange, options, minWidth = 110 }) => {
  const [open,  setOpen]  = useState(false);
  const [ready, setReady] = useState(false);
  const [pos,   setPos]   = useState({ top: 0, left: 0, width: 0 });
  const trigRef = useRef(null);
  const dropRef = useRef(null);
  const rafRef  = useRef(null);

  const opts     = options.map(o => typeof o === "string" ? { label: o, value: o } : o);
  const selected = opts.find(o => o.value === value);

  const measure = useCallback(() => {
    if (!trigRef.current) return;
    const r = trigRef.current.getBoundingClientRect();
    const h = Math.min(opts.length * 38 + 10, 200);
    const top = (window.innerHeight - r.bottom) > h ? r.bottom + 4 : r.top - h - 4;
    setPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, minWidth) });
    setReady(true);
  }, [opts.length, minWidth]);

  const toggle = () => {
    if (open) { setOpen(false); setReady(false); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => rafRef.current = requestAnimationFrame(measure));
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [open, measure]);
  useEffect(() => {
    const h = e => {
      if (trigRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false); setReady(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isDarkNow = (() => { try { return JSON.parse(localStorage.getItem("nexus-theme") || "{}").state?.isDark ?? true; } catch { return true; } })();
  const bg    = isDarkNow ? "#0d1526" : "#fff";
  const bdr   = isDarkNow ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const tp    = isDarkNow ? "#e2e8f0" : "#0f172a";
  const ts    = isDarkNow ? "#64748b" : "#94a3b8";
  const actC  = isDarkNow ? "#60a5fa" : "#2563eb";
  const actBg = isDarkNow ? "rgba(59,130,246,0.12)" : "#eff6ff";
  const hovBg = isDarkNow ? "rgba(255,255,255,0.04)" : "#f8fafc";
  const focBd = isDarkNow ? "rgba(59,130,246,0.45)" : "#93c5fd";

  return (
    <div ref={trigRef} onClick={toggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "34px", padding: "0 11px", minWidth, border: `1px solid ${open ? focBd : bdr}`, borderRadius: "8px", background: bg, cursor: "pointer", userSelect: "none", gap: "8px", boxShadow: open ? `0 0 0 3px ${isDarkNow ? "rgba(59,130,246,0.12)" : "rgba(147,197,253,0.3)"}` : "none", transition: "all 0.15s" }}>
      <span style={{ fontSize: "12px", fontWeight: "500", color: selected ? tp : ts, fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap" }}>
        {selected?.label ?? "—"}
      </span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={open ? actC : ts} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {open && createPortal(
        <div ref={dropRef} style={{ position: "absolute", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999, background: bg, border: `1.5px solid ${bdr}`, borderRadius: "10px", boxShadow: isDarkNow ? "0 20px 60px rgba(0,0,0,0.55)" : "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden", visibility: ready ? "visible" : "hidden", opacity: ready ? 1 : 0, transition: "opacity 0.1s" }}>
          <div style={{ padding: "4px" }}>
            {opts.map((opt, i) => {
              const isA = opt.value === value;
              return (
                <div key={i} onClick={() => { onChange(opt.value); setOpen(false); setReady(false); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: isA ? "600" : "400", color: isA ? actC : tp, background: isA ? actBg : "transparent", transition: "background 0.1s" }}
                  onMouseEnter={e => { if (!isA) e.currentTarget.style.background = hovBg; }}
                  onMouseLeave={e => { if (!isA) e.currentTarget.style.background = "transparent"; }}>
                  {opt.label}
                  {isA && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={actC} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────
const StatusBadge = ({ raw, size = "sm" }) => {
  const sc = getSC(raw);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: size === "lg" ? "4px 12px" : "3px 9px", borderRadius: "999px", background: sc.dim, color: sc.color, border: `1px solid ${sc.border}`, fontSize: size === "lg" ? "11px" : "10px", fontWeight: "700", whiteSpace: "nowrap" }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.color, flexShrink: 0 }} />
      {sc.label}
    </span>
  );
};

// ─── Main Component ────────────────────────────────────────────────
const Purchaseorders = () => {
  const { handleGetPurchaseorder, data, loading, error } = useGetAllPurchaseOrder();
  const navigate = useNavigate();
  const isDark   = useThemeStore((s) => s.isDark);
  const T        = getTheme(isDark);

  const [drawer,       setDrawer]       = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [activeTab,    setActiveTab]    = useState("overview");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy,       setSortBy]       = useState("date");
  const [sortDir,      setSortDir]      = useState("desc");
  const [page,         setPage]         = useState(1);
  const [perPage,      setPerPage]      = useState(10);
  const [cmdOpen,      setCmdOpen]      = useState(false);
  const [cmdQuery,     setCmdQuery]     = useState("");
  const cmdInputRef = useRef(null);

  useEffect(() => { handleGetPurchaseorder(); }, [handleGetPurchaseorder]);

  const allOrders = data ? transformPOs(data) : [];

  const filtered = allOrders
    .filter(o => statusFilter === "all" || o.rawStatus === statusFilter)
    .filter(o => {
      const q = search.toLowerCase();
      return !q || o.poNumber?.toLowerCase().includes(q) ||
        o.vendor?.toLowerCase().includes(q) || o.reference?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let av, bv;
      if (sortBy === "date")   { av = new Date(a.orderDate || 0); bv = new Date(b.orderDate || 0); }
      else if (sortBy === "total")  { av = a.total; bv = b.total; }
      else if (sortBy === "vendor") { av = a.vendor.toLowerCase(); bv = b.vendor.toLowerCase(); }
      else { av = a.poNumber?.toLowerCase() || ""; bv = b.poNumber?.toLowerCase() || ""; }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const totalPages   = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentItems = filtered.slice((page - 1) * perPage, page * perPage);

  const getPageNums = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums = [1];
    let s = Math.max(2, page - 1), e = Math.min(totalPages - 1, page + 1);
    if (page <= 3) e = 4; if (page >= totalPages - 2) s = totalPages - 3;
    if (s > 2) nums.push("…");
    for (let i = s; i <= e; i++) nums.push(i);
    if (e < totalPages - 1) nums.push("…");
    if (totalPages > 1) nums.push(totalPages);
    return nums;
  };

  const stats = {
    total:        allOrders.length,
    active:       allOrders.filter(o => ["ordered","approved","in transit"].includes(o.rawStatus)).length,
    pending:      allOrders.filter(o => ["draft","pending"].includes(o.rawStatus)).length,
    received:     allOrders.filter(o => ["received","completed"].includes(o.rawStatus)).length,
    totalVal:     allOrders.reduce((s, o) => s + o.total, 0),
    overdueCount: allOrders.filter(o => o.deliveryDate && new Date(o.deliveryDate) < new Date() && !["completed","received","closed","cancelled"].includes(o.rawStatus)).length,
  };

  // Command palette keyboard shortcut
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(v => !v); setCmdQuery(""); }
      if (e.key === "Escape") { setCmdOpen(false); setDrawer(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { if (cmdOpen) setTimeout(() => cmdInputRef.current?.focus(), 60); }, [cmdOpen]);

  const cmdResults = cmdQuery.length >= 1
    ? allOrders.filter(o =>
        o.poNumber?.toLowerCase().includes(cmdQuery.toLowerCase()) ||
        o.vendor?.toLowerCase().includes(cmdQuery.toLowerCase()) ||
        o.reference?.toLowerCase().includes(cmdQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  const openDrawer  = (item) => { setSelected(item); setDrawer(true); setActiveTab("overview"); };
  const closeDrawer = ()     => { setDrawer(false); setSelected(null); };

  // ── CSS ─────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');

    html, body, * { scrollbar-width: thin; scrollbar-color: ${isDark ? "rgba(255,255,255,0.1) transparent" : "rgba(0,0,0,0.1) transparent"}; }
    *::-webkit-scrollbar { width: 5px; height: 5px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.11)"}; border-radius: 999px; }
    *::-webkit-scrollbar-thumb:hover { background: ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}; }

    .po-root * { box-sizing: border-box; }
    .po-root { font-family: 'Inter', sans-serif; }
    .po-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }

    .po-stat { transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .po-stat:hover { transform: translateY(-3px); box-shadow: ${isDark ? "0 16px 48px rgba(0,0,0,0.5)" : "0 12px 32px rgba(0,0,0,0.1)"} !important; }

    .po-row { transition: background 0.1s; cursor: pointer; }
    .po-row:hover { background: ${isDark ? "rgba(255,255,255,0.03)" : "#f8fafc"} !important; }
    .po-row:hover .po-num { color: ${isDark ? "#a78bfa" : "#6d28d9"} !important; }
    .po-row:hover .po-arrow { opacity: 1 !important; transform: translateX(0px) !important; }

    .po-btn { transition: all 0.15s; }
    .po-btn:hover { opacity: 0.88; transform: translateY(-1px); }

    .po-ghost { transition: all 0.12s; }
    .po-ghost:hover { background: ${isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"} !important; color: ${isDark ? "#e2e8f0" : "#0f172a"} !important; }

    .po-pill { transition: all 0.14s; cursor: pointer; }
    .po-pill:hover { border-color: ${isDark ? "rgba(139,92,246,0.35)" : "#ddd6fe"} !important; color: ${isDark ? "#a78bfa" : "#6d28d9"} !important; }
    .po-pill-on { background: ${isDark ? "rgba(139,92,246,0.14)" : "#f5f3ff"} !important; color: ${isDark ? "#a78bfa" : "#6d28d9"} !important; border-color: ${isDark ? "rgba(139,92,246,0.4)" : "#ddd6fe"} !important; font-weight: 600 !important; }

    .po-pgbtn { transition: all 0.12s; }
    .po-pgbtn:hover { border-color: ${isDark ? "rgba(139,92,246,0.35)" : "#ddd6fe"} !important; color: ${isDark ? "#a78bfa" : "#6d28d9"} !important; }

    .po-tab { transition: all 0.15s; border-bottom: 2px solid transparent; }
    .po-tab:hover { color: ${isDark ? "#94a3b8" : "#374151"} !important; }
    .po-tab-on { color: ${isDark ? "#a78bfa" : "#6d28d9"} !important; border-bottom-color: ${isDark ? "#8b5cf6" : "#7c3aed"} !important; }

    .po-drow { transition: background 0.1s; }
    .po-drow:hover { background: ${isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"} !important; }

    .po-icard { transition: border-color 0.15s, background 0.15s; }
    .po-icard:hover { background: ${isDark ? "rgba(139,92,246,0.06)" : "#faf5ff"} !important; border-color: ${isDark ? "rgba(139,92,246,0.28)" : "#ddd6fe"} !important; }

    .po-cmd-row { transition: background 0.08s; cursor: pointer; }
    .po-cmd-row:hover { background: ${isDark ? "rgba(139,92,246,0.1)" : "#f5f3ff"} !important; }

    .po-search:focus { outline: none; border-color: ${isDark ? "rgba(139,92,246,0.5)" : "#c4b5fd"} !important; box-shadow: 0 0 0 3px ${isDark ? "rgba(139,92,246,0.1)" : "rgba(196,181,253,0.25)"} !important; }

    @keyframes po-overdue { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
    .po-overdue { animation: po-overdue 2.2s ease infinite; }

    @keyframes po-fadeIn  { from { opacity:0; } to { opacity:1; } }
    @keyframes po-fadeUp  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes po-slideIn { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
    @keyframes po-spin    { to { transform:rotate(360deg); } }
    @keyframes po-cmdIn   { from { opacity:0; transform:scale(0.96) translateY(-8px); } to { opacity:1; transform:scale(1) translateY(0); } }

    .po-overlay { animation: po-fadeIn 0.18s ease forwards; }
    .po-drawer  { animation: po-slideIn 0.26s cubic-bezier(0.16,1,0.3,1) forwards; }
    .po-up      { animation: po-fadeUp 0.32s ease both; }
    .po-up-1    { animation: po-fadeUp 0.32s 0.07s ease both; }
    .po-up-2    { animation: po-fadeUp 0.32s 0.14s ease both; }
    .po-spin    { animation: po-spin 0.8s linear infinite; }
    .po-cmd-in  { animation: po-cmdIn 0.18s cubic-bezier(0.16,1,0.3,1) forwards; }
  `;

  const card = (extra = {}) => ({ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", transition: "background 0.25s, border-color 0.25s", ...extra });

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg }}>
      <style>{css}</style>
      <div style={{ textAlign: "center" }}>
        <div className="po-spin" style={{ width: "32px", height: "32px", border: `2.5px solid ${T.border}`, borderTopColor: T.purple, borderRadius: "50%", margin: "0 auto 14px" }} />
        <p style={{ color: T.textSec, fontSize: "13px", margin: 0, fontFamily: "Inter, sans-serif" }}>Loading purchase orders…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ margin: "24px", padding: "18px 20px", background: T.redDim, border: `1px solid rgba(239,68,68,0.2)`, borderRadius: "12px", color: T.red, fontFamily: "Inter, sans-serif", fontSize: "13px" }}>
      <FaExclamationTriangle style={{ marginRight: "8px" }} />Error: {error}
    </div>
  );

  return (
    <>
      <style>{css}</style>

      {/* ── COMMAND PALETTE ──────────────────────────────────── */}
      {cmdOpen && (
        <>
          <div className="po-overlay" onClick={() => { setCmdOpen(false); setCmdQuery(""); }}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(4,8,18,0.78)" : "rgba(15,23,42,0.48)", backdropFilter: "blur(10px)", zIndex: 200 }} />
          <div className="po-cmd-in" style={{ position: "fixed", top: "17vh", left: "50%", transform: "translateX(-50%)", width: "min(580px,92vw)", zIndex: 201, background: isDark ? "rgba(13,21,38,0.97)" : "rgba(255,255,255,0.98)", border: `1px solid ${isDark ? "rgba(139,92,246,0.2)" : "#e9d5ff"}`, borderRadius: "16px", boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.72), 0 0 0 1px rgba(139,92,246,0.1)" : "0 24px 64px rgba(109,40,217,0.15)", overflow: "hidden", backdropFilter: "blur(24px)" }}>
            {/* Search input */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
              <FaSearch style={{ color: T.purple, fontSize: "13px", flexShrink: 0 }} />
              <input ref={cmdInputRef} value={cmdQuery} onChange={e => setCmdQuery(e.target.value)}
                placeholder="Search PO number, vendor, reference…"
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: "15px", color: T.textPri, fontFamily: "inherit" }} />
              <kbd style={{ padding: "2px 7px", borderRadius: "5px", background: T.surface2, color: T.textSec, fontSize: "10px", fontFamily: "monospace", border: `1px solid ${T.border}`, flexShrink: 0 }}>ESC</kbd>
            </div>

            {/* Results */}
            {cmdResults.length > 0 ? (
              <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                <p style={{ padding: "8px 18px 4px", fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                  {cmdResults.length} result{cmdResults.length !== 1 ? "s" : ""}
                </p>
                {cmdResults.map(o => {
                  const sc = getSC(o.rawStatus);
                  return (
                    <div key={o.id} className="po-cmd-row" onClick={() => { openDrawer(o); setCmdOpen(false); setCmdQuery(""); }}
                      style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 18px", borderTop: `1px solid ${T.border}` }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: T.purpleDim, color: T.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>
                        <FaShoppingCart />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="po-jakarta" style={{ fontWeight: "700", fontSize: "13px", color: T.textPri, margin: 0 }}>{o.poNumber}</p>
                        <p style={{ fontSize: "11px", color: T.textSec, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.vendor} · Ref: {o.reference}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px", flexShrink: 0 }}>
                        <StatusBadge raw={o.rawStatus} />
                        <span className="po-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri }}>{fmtAED(o.total)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : cmdQuery.length >= 1 ? (
              <div style={{ padding: "36px 18px", textAlign: "center", color: T.textSec, fontSize: "13px" }}>
                No results for "<strong>{cmdQuery}</strong>"
              </div>
            ) : (
              <div style={{ padding: "16px 18px" }}>
                <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Quick actions</p>
                {[
                  { label: "New Purchase Order", icon: <FaPlus size={10} />, action: () => { navigate("/Purchase/Purchaseorders/Newpurchaseorders"); setCmdOpen(false); } },
                  { label: "View pending orders",  icon: <FaClock size={10} />, action: () => { setStatusFilter("pending"); setCmdOpen(false); } },
                  { label: "View in transit",       icon: <FaTruck size={10} />, action: () => { setStatusFilter("in transit"); setCmdOpen(false); } },
                  { label: "View all orders",       icon: <FaListUl size={10} />, action: () => { setStatusFilter("all"); setCmdOpen(false); } },
                ].map(({ label, icon, action }) => (
                  <div key={label} className="po-cmd-row" onClick={action}
                    style={{ display: "flex", alignItems: "center", gap: "11px", padding: "9px 10px", borderRadius: "8px", color: T.textSec, fontSize: "13px" }}>
                    <span style={{ color: T.purple, width: "16px", display: "flex", justifyContent: "center" }}>{icon}</span>
                    {label}
                    <FaArrowRight size={9} style={{ marginLeft: "auto", color: T.textMuted }} />
                  </div>
                ))}
              </div>
            )}

            {/* Footer hints */}
            <div style={{ padding: "8px 18px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "16px" }}>
              {[["↵", "Open"], ["↑↓", "Navigate"], ["ESC", "Close"]].map(([k, v]) => (
                <span key={k} style={{ fontSize: "11px", color: T.textSec, display: "flex", alignItems: "center", gap: "4px" }}>
                  <kbd style={{ padding: "1px 5px", borderRadius: "4px", background: T.surface2, border: `1px solid ${T.border}`, fontFamily: "monospace", fontSize: "10px" }}>{k}</kbd> {v}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── PAGE ────────────────────────────────────────────── */}
      <div className="po-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* HEADER */}
        <div className="po-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: T.purpleDim, color: T.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", border: `1px solid ${isDark ? "rgba(139,92,246,0.22)" : "#ddd6fe"}`, boxShadow: `0 0 0 4px ${isDark ? "rgba(139,92,246,0.06)" : "rgba(221,214,254,0.5)"}` }}>
              <FaShoppingCart />
            </div>
            <div>
              <h1 className="po-jakarta" style={{ fontSize: "19px", fontWeight: "800", color: T.textPri, margin: 0, letterSpacing: "-0.025em" }}>Purchase Orders</h1>
              <p style={{ fontSize: "12px", color: T.textSec, margin: "2px 0 0" }}>
                {stats.total} total · {stats.active} active
                {stats.overdueCount > 0 && <> · <span className="po-overdue" style={{ color: "#ef4444", fontWeight: "600" }}>{stats.overdueCount} overdue</span></>}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button className="po-ghost" onClick={() => { setCmdOpen(true); setCmdQuery(""); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 13px", border: `1px solid ${T.border}`, borderRadius: "9px", background: T.surface2, color: T.textSec, cursor: "pointer", fontFamily: "inherit", fontSize: "12px" }}>
              <FaSearch size={10} /> Search
              <kbd style={{ padding: "1px 5px", borderRadius: "4px", background: isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9", border: `1px solid ${T.border}`, fontFamily: "monospace", fontSize: "10px", color: T.textMuted }}>⌘K</kbd>
            </button>
            <button className="po-ghost"
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 13px", border: `1px solid ${T.border}`, borderRadius: "9px", background: T.surface, color: T.textSec, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: "500" }}>
              <FaDownload size={10} /> Export
            </button>
            <button className="po-btn" onClick={() => navigate("/Purchase/Purchaseorders/Newpurchaseorders")}
              style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 20px", border: "none", borderRadius: "9px", background: `linear-gradient(135deg, ${isDark ? "#8b5cf6" : "#7c3aed"}, ${isDark ? "#6d28d9" : "#5b21b6"})`, color: "white", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: "600", boxShadow: `0 4px 16px ${isDark ? "rgba(139,92,246,0.4)" : "rgba(91,33,182,0.32)"}` }}>
              <FaPlus size={10} /> New PO
            </button>
          </div>
        </div>

        {/* BENTO STATS */}
        <div className="po-up-1" style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "18px" }}>

          {/* Big value card */}
          <div className="po-stat" style={{ ...card({ padding: "22px 24px", position: "relative", overflow: "hidden" }) }}>
            {/* Decorative circles */}
            <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "180px", height: "180px", borderRadius: "50%", background: isDark ? "rgba(139,92,246,0.04)" : "rgba(139,92,246,0.035)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "-30px", right: "80px", width: "100px", height: "100px", borderRadius: "50%", background: isDark ? "rgba(59,130,246,0.03)" : "rgba(59,130,246,0.025)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, transparent, ${T.purple}${isDark ? "66" : "99"}, transparent)` }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.09em", margin: 0 }}>Total Procurement Value</p>
              <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: T.purpleDim, color: T.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
                <FaFileInvoiceDollar />
              </div>
            </div>
            <p className="po-jakarta" style={{ fontSize: "30px", fontWeight: "800", color: T.textPri, margin: "0 0 4px", letterSpacing: "-0.04em", lineHeight: 1 }}>{fmtAED(stats.totalVal)}</p>
            <p style={{ fontSize: "12px", color: T.textSec, margin: "0 0 18px" }}>
              Avg <strong style={{ color: T.textPri }}>{fmtAED(stats.total ? stats.totalVal / stats.total : 0)}</strong> per order across <strong style={{ color: T.textPri }}>{stats.total}</strong> POs
            </p>

            {/* Status breakdown bar */}
            <div style={{ height: "6px", borderRadius: "999px", background: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9", overflow: "hidden", display: "flex", gap: "2px", marginBottom: "10px" }}>
              {[
                { pct: stats.total ? (stats.active / stats.total) * 100 : 0,   color: T.blue  },
                { pct: stats.total ? (stats.pending / stats.total) * 100 : 0,  color: T.amber },
                { pct: stats.total ? (stats.received / stats.total) * 100 : 0, color: T.green },
              ].filter(b => b.pct > 0).map((b, i) => (
                <div key={i} style={{ height: "100%", width: `${b.pct}%`, background: b.color, borderRadius: "999px", transition: "width 1s ease" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: "18px" }}>
              {[{ l: "Active", v: stats.active, c: T.blue }, { l: "Pending", v: stats.pending, c: T.amber }, { l: "Received", v: stats.received, c: T.green }].map(({ l, v, c }) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: c, flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: T.textSec }}>{l} <strong style={{ color: T.textPri }}>{v}</strong></span>
                </div>
              ))}
            </div>
          </div>

          {/* Small stat cards */}
          {[
            { l: "Active",   v: stats.active,       icon: <FaTruck />,              c: T.blue,   dim: T.blueDim,   sub: `of ${stats.total}`,               bar: stats.total ? stats.active / stats.total * 100 : 0 },
            { l: "Pending",  v: stats.pending,      icon: <FaClock />,              c: T.amber,  dim: T.amberDim,  sub: "Awaiting approval",               bar: stats.total ? stats.pending / stats.total * 100 : 0 },
            { l: "Received", v: stats.received,     icon: <FaCheckCircle />,        c: T.green,  dim: T.greenDim,  sub: `${stats.total ? Math.round(stats.received/stats.total*100) : 0}% fulfilled`, bar: stats.total ? stats.received / stats.total * 100 : 0 },
            { l: "Overdue",  v: stats.overdueCount, icon: <FaExclamationTriangle />, c: stats.overdueCount > 0 ? "#ef4444" : T.textSec, dim: stats.overdueCount > 0 ? "rgba(239,68,68,0.1)" : T.surface2, sub: stats.overdueCount > 0 ? "Need attention" : "All on track", bar: null },
          ].map((c, i) => (
            <div key={i} className="po-stat" style={{ ...card({ padding: "17px 18px", position: "relative", overflow: "hidden" }) }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, transparent 10%, ${c.c}${isDark ? "55" : "88"}, transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.09em", margin: 0 }}>{c.l}</p>
                <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: c.dim, color: c.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>{c.icon}</div>
              </div>
              <p className="po-jakarta" style={{ fontSize: "24px", fontWeight: "800", color: c.l === "Overdue" && c.v > 0 ? "#ef4444" : T.textPri, margin: "0 0 7px", lineHeight: 1, letterSpacing: "-0.02em" }}>{c.v}</p>
              {c.bar !== null && (
                <div style={{ height: "3px", background: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0", borderRadius: "999px", marginBottom: "7px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.bar}%`, background: c.c, borderRadius: "999px", transition: "width 1s ease" }} />
                </div>
              )}
              <p style={{ fontSize: "11px", color: T.textSec, margin: 0 }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <div className="po-up-2" style={{ ...card({ padding: "11px 14px", marginBottom: "12px" }) }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
              <FaSearch style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: "11px", pointerEvents: "none" }} />
              <input className="po-search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Filter by PO #, vendor, reference…"
                style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "12px", background: T.surface2, color: T.textPri, fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s" }} />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }} style={{ position: "absolute", right: "9px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}>
                  <FaTimes size={10} />
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
              {[
                { v: "all",        l: "All" },
                { v: "draft",      l: "Draft" },
                { v: "pending",    l: "Pending" },
                { v: "approved",   l: "Approved" },
                { v: "ordered",    l: "Ordered" },
                { v: "in transit", l: "In Transit" },
                { v: "received",   l: "Received" },
                { v: "completed",  l: "Completed" },
                { v: "cancelled",  l: "Cancelled" },
              ].map(({ v, l }) => (
                <button key={v} onClick={() => { setStatusFilter(v); setPage(1); }}
                  className={`po-pill${statusFilter === v ? " po-pill-on" : ""}`}
                  style={{ padding: "5px 10px", borderRadius: "7px", fontSize: "11px", fontWeight: "500", background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {l}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
              <CustomSelect value={sortBy} onChange={v => { setSortBy(v); setPage(1); }}
                options={[{ label: "Date", value: "date" }, { label: "Total", value: "total" }, { label: "Vendor", value: "vendor" }, { label: "PO #", value: "po" }]} minWidth={108} />
              <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")} className="po-ghost"
                style={{ height: "34px", padding: "0 10px", border: `1px solid ${T.border}`, borderRadius: "8px", background: T.surface2, color: T.textSec, cursor: "pointer", display: "flex", alignItems: "center" }}>
                {sortDir === "asc" ? <FaSortAmountDown size={12} /> : <FaSortAmountUp size={12} />}
              </button>
              <span style={{ fontSize: "12px", color: T.textSec, paddingLeft: "4px", whiteSpace: "nowrap" }}>{filtered.length} order{filtered.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div style={{ ...card({ overflow: "hidden", marginBottom: "12px" }) }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                <th style={{ padding: "10px 14px", width: "32px" }}>
                  <input type="checkbox" style={{ accentColor: T.purple }} />
                </th>
                {["PO Number", "Status", "Vendor", "Reference", "Order Date", "Delivery", "Total", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 14px", textAlign: i === 6 ? "right" : "left", fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.09em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? currentItems.map((o, idx) => {
                const isOverdue = o.deliveryDate && new Date(o.deliveryDate) < new Date() && !["completed","received","closed","cancelled"].includes(o.rawStatus);
                return (
                  <tr key={o.id || idx} className="po-row" onClick={() => openDrawer(o)} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 14px" }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" style={{ accentColor: T.purple }} />
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span className="po-num po-jakarta" style={{ fontWeight: "700", fontSize: "13px", color: T.purple, transition: "color 0.15s" }}>{o.poNumber}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge raw={o.rawStatus} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <p style={{ fontWeight: "600", color: T.textPri, margin: 0, whiteSpace: "nowrap" }}>{o.vendor}</p>
                      {o.vendorCode && <p style={{ fontSize: "10px", color: T.textSec, margin: "2px 0 0", fontFamily: "monospace" }}>{o.vendorCode}</p>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "12px", color: T.textSec, fontFamily: "monospace" }}>{o.reference}</span>
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <p style={{ fontSize: "12px", color: T.textSec, margin: 0 }}>{fmtDate(o.orderDate)}</p>
                      <p style={{ fontSize: "10px", color: T.textMuted, margin: "2px 0 0" }}>{fmtRelative(o.orderDate)}</p>
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        {isOverdue && <FaExclamationTriangle size={9} className="po-overdue" style={{ color: "#ef4444" }} />}
                        <span style={{ fontSize: "12px", color: isOverdue ? "#ef4444" : T.textSec, fontWeight: isOverdue ? "600" : "400" }}>{fmtDate(o.deliveryDate)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <span className="po-jakarta" style={{ fontWeight: "700", fontSize: "13px", color: T.textPri }}>{fmtAED(o.total)}</span>
                    </td>
                    <td style={{ padding: "12px 10px", width: "32px" }}>
                      <div className="po-arrow" style={{ opacity: 0, transform: "translateX(-5px)", transition: "opacity 0.15s, transform 0.15s", color: T.textSec, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                        <FaArrowRight size={10} />
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="9" style={{ padding: "80px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
                      <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: T.textSec }}><FaBoxOpen /></div>
                      <div>
                        <p className="po-jakarta" style={{ fontWeight: "700", color: T.textPri, fontSize: "15px", margin: "0 0 4px" }}>No purchase orders</p>
                        <p style={{ color: T.textSec, fontSize: "13px", margin: 0 }}>
                          {statusFilter !== "all" ? `No "${fmtStatus(statusFilter)}" orders` : search ? `No results for "${search}"` : "Create your first PO to begin procurement"}
                        </p>
                      </div>
                      {!search && statusFilter === "all" && (
                        <button className="po-btn" onClick={() => navigate("/Purchase/Purchaseorders/Newpurchaseorders")}
                          style={{ padding: "9px 22px", background: `linear-gradient(135deg, ${T.purple}, ${isDark ? "#6d28d9" : "#5b21b6"})`, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                          New Purchase Order
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {filtered.length > 0 && (
          <div style={{ ...card({ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }) }}>
            <span style={{ fontSize: "12px", color: T.textSec }}>
              {(page-1)*perPage+1}–{Math.min(page*perPage, filtered.length)} of {filtered.length}
            </span>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="po-pgbtn"
                style={{ padding: "5px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "12px", color: page===1 ? T.textMuted : T.textSec, cursor: page===1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                <FaChevronLeft size={9} /> Prev
              </button>
              {getPageNums().map((p,i) => p==="…" ? (
                <span key={`e${i}`} style={{ padding: "5px 4px", color: T.textSec, fontSize: "12px" }}>…</span>
              ) : (
                <button key={p} className="po-pgbtn" onClick={() => setPage(p)}
                  style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${page===p ? "rgba(139,92,246,0.45)" : T.border}`, background: page===p ? T.purpleDim : "transparent", color: page===p ? T.purple : T.textSec }}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="po-pgbtn"
                style={{ padding: "5px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "12px", color: page===totalPages ? T.textMuted : T.textSec, cursor: page===totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                Next <FaChevronRight size={9} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: T.textSec }}>Rows:</span>
              <CustomSelect value={perPage} onChange={v => { setPerPage(Number(v)); setPage(1); }}
                options={[5,10,20,50].map(n => ({ label: String(n), value: n }))} minWidth={64} />
            </div>
          </div>
        )}
      </div>

      {/* DRAWER */}
      {drawer && selected && (() => {
        const sc = getSC(selected.rawStatus);
        const isOverdue = selected.deliveryDate && new Date(selected.deliveryDate) < new Date() && !["completed","received","closed","cancelled"].includes(selected.rawStatus);
        const step = sc.step ?? 0;

        return (
          <>
            <div className="po-overlay" onClick={closeDrawer}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(4,8,18,0.76)" : "rgba(15,23,42,0.42)", backdropFilter: "blur(8px)", zIndex: 100 }} />

            <div className="po-drawer"
              style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "480px", maxWidth: "96vw", background: T.surface, borderLeft: `1px solid ${T.border}`, zIndex: 101, display: "flex", flexDirection: "column", boxShadow: isDark ? "-28px 0 72px rgba(0,0,0,0.72)" : "-8px 0 48px rgba(0,0,0,0.12)" }}>

              {/* Header */}
              <div style={{ padding: "20px 22px 0", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "5px", flexWrap: "wrap" }}>
                      <h3 className="po-jakarta" style={{ fontSize: "16px", fontWeight: "800", color: T.textPri, margin: 0, letterSpacing: "-0.025em" }}>{selected.poNumber}</h3>
                      <StatusBadge raw={selected.rawStatus} size="lg" />
                      {isOverdue && (
                        <span className="po-overdue" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", borderRadius: "999px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", fontSize: "10px", fontWeight: "700" }}>
                          <FaExclamationTriangle size={8} /> Overdue
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "13px", color: T.textSec, margin: 0 }}>
                      {selected.vendor}
                      {selected.vendorCode && <span style={{ fontFamily: "monospace", fontSize: "11px", color: T.textMuted, marginLeft: "7px" }}>({selected.vendorCode})</span>}
                    </p>
                  </div>
                  <button onClick={closeDrawer}
                    style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "7px", cursor: "pointer", color: T.textSec, display: "flex", flexShrink: 0, marginLeft: "14px" }}>
                    <FaTimes size={11} />
                  </button>
                </div>

                {/* Status timeline */}
                {selected.rawStatus !== "cancelled" && (
                  <div style={{ paddingBottom: "16px", overflowX: "auto" }}>
                    <div style={{ display: "flex", alignItems: "center", minWidth: "max-content" }}>
                      {STATUS_STEPS.map((s, i) => {
                        const done    = i < step;
                        const current = i === step;
                        const tlSC    = getSC(s);
                        return (
                          <div key={s} style={{ display: "flex", alignItems: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                              <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: current ? tlSC.dim : done ? isDark ? "rgba(16,185,129,0.14)" : "#dcfce7" : T.surface2, border: `2px solid ${current ? tlSC.color : done ? T.green : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: current ? `0 0 0 4px ${tlSC.dim}` : "none", transition: "all 0.2s" }}>
                                {done ? <FaCheckCircle style={{ color: T.green, fontSize: "10px" }} />
                                  : current ? <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: tlSC.color }} />
                                  : <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: T.border }} />}
                              </div>
                              <span style={{ fontSize: "9px", fontWeight: current ? "700" : "500", color: current ? tlSC.color : done ? T.green : T.textMuted, whiteSpace: "nowrap", textTransform: "capitalize" }}>{fmtStatus(s)}</span>
                            </div>
                            {i < STATUS_STEPS.length - 1 && (
                              <div style={{ width: "26px", height: "2px", background: done ? T.green : T.border, marginTop: "-16px", transition: "background 0.3s" }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div style={{ display: "flex" }}>
                  {["overview", "items", "history"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`po-tab${activeTab === tab ? " po-tab-on" : ""}`}
                      style={{ padding: "9px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "500", fontFamily: "inherit", color: T.textSec, textTransform: "capitalize" }}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>

                {activeTab === "overview" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                    {[
                      { icon: <FaTag size={10} />,         label: "Reference",     value: selected.reference },
                      { icon: <FaCalendarAlt size={10} />, label: "Order Date",    value: fmtDate(selected.orderDate) },
                      { icon: <FaTruck size={10} />,       label: "Delivery Date", value: fmtDate(selected.deliveryDate), red: isOverdue },
                      { icon: <FaWarehouse size={10} />,   label: "Warehouse",     value: selected.warehouse },
                      { icon: <FaReceipt size={10} />,     label: "Payment Terms", value: selected.paymentTerms },
                      { icon: <FaTruck size={10} />,       label: "Ship Method",   value: selected.shippingMethod },
                    ].filter(r => r.value).map(({ icon, label, value, red }) => (
                      <div key={label} className="po-drow" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 13px", background: T.surface2, borderRadius: "10px", border: `1px solid ${T.border}` }}>
                        <div style={{ color: T.textSec, flexShrink: 0, width: "14px", display: "flex", justifyContent: "center" }}>{icon}</div>
                        <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500", minWidth: "92px", flexShrink: 0 }}>{label}</span>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: red ? "#ef4444" : T.textPri, marginLeft: "auto" }}>{value}</span>
                      </div>
                    ))}

                    {/* Financials */}
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden", marginTop: "6px" }}>
                      <div style={{ padding: "11px 13px", borderBottom: `1px solid ${T.border}` }}>
                        <p className="po-jakarta" style={{ fontSize: "10px", fontWeight: "700", color: T.textSec, margin: 0, textTransform: "uppercase", letterSpacing: "0.09em" }}>Financial Summary</p>
                      </div>
                      {[
                        { label: "Subtotal",   value: fmtAED(selected.subTotal) },
                        { label: "Shipping",   value: fmtAED(selected.shippingCharges) },
                        { label: "Adjustment", value: fmtAED(selected.adjustment) },
                        { label: "VAT (5%)",   value: fmtAED(selected.vat) },
                      ].map(({ label, value }) => (
                        <div key={label} className="po-drow" style={{ display: "flex", justifyContent: "space-between", padding: "10px 13px", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: "12px", color: T.textSec }}>{label}</span>
                          <span style={{ fontSize: "12px", color: T.textPri, fontWeight: "500" }}>{value}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 13px", background: isDark ? "rgba(139,92,246,0.07)" : "#faf5ff" }}>
                        <span className="po-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri }}>Total</span>
                        <span className="po-jakarta" style={{ fontSize: "20px", fontWeight: "800", color: T.purple, letterSpacing: "-0.03em" }}>{fmtAED(selected.total)}</span>
                      </div>
                    </div>

                    {selected.notes && (
                      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 13px", marginTop: "2px" }}>
                        <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>Notes</p>
                        <p style={{ fontSize: "13px", color: T.textPri, margin: 0, lineHeight: "1.65" }}>{selected.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "items" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selected.items?.length > 0 ? (
                      <>
                        {selected.items.map((item, i) => (
                          <div key={i} className="po-icard" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "11px", padding: "13px 14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                              <div style={{ display: "flex", gap: "10px", flex: 1, minWidth: 0 }}>
                                <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: T.purpleDim, color: T.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", flexShrink: 0 }}>
                                  <FaBoxOpen />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p className="po-jakarta" style={{ fontSize: "13px", fontWeight: "600", color: T.textPri, margin: "0 0 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {item.details || item.name || item.itemName || `Item ${i+1}`}
                                  </p>
                                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "11px", color: T.textSec }}>Qty: <strong style={{ color: T.textPri }}>{item.quantity}</strong></span>
                                    <span style={{ fontSize: "11px", color: T.textSec }}>Rate: <strong style={{ color: T.textPri }}>{fmtAED(item.rate)}</strong></span>
                                    {item.discount > 0 && <span style={{ fontSize: "11px", color: T.amber }}>Disc: {fmtAED(item.discount)}</span>}
                                  </div>
                                </div>
                              </div>
                              <span className="po-jakarta" style={{ fontSize: "14px", fontWeight: "700", color: T.purple, flexShrink: 0 }}>{fmtAED(item.amount)}</span>
                            </div>
                          </div>
                        ))}
                        <div style={{ padding: "12px 14px", background: isDark ? "rgba(139,92,246,0.06)" : "#faf5ff", border: `1px solid ${isDark ? "rgba(139,92,246,0.15)" : "#e9d5ff"}`, borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", color: T.textSec }}>{selected.items.length} item{selected.items.length !== 1 ? "s" : ""}</span>
                          <span className="po-jakarta" style={{ fontSize: "15px", fontWeight: "800", color: T.purple }}>{fmtAED(selected.total)}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px", gap: "12px" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "13px", background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: T.textSec }}><FaListUl /></div>
                        <p className="po-jakarta" style={{ fontWeight: "700", color: T.textPri, fontSize: "14px", margin: 0 }}>No line items</p>
                        <p style={{ color: T.textSec, fontSize: "12px", margin: 0 }}>No items attached to this PO.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "history" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px", gap: "12px" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "13px", background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: T.textSec }}><FaClock /></div>
                    <p className="po-jakarta" style={{ fontWeight: "700", color: T.textPri, fontSize: "14px", margin: 0 }}>No history yet</p>
                    <p style={{ color: T.textSec, fontSize: "12px", margin: 0 }}>Activity and audit trail will appear here.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "14px 22px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "8px", flexShrink: 0 }}>
                <button className="po-btn" onClick={() => navigate(`/Purchase/Purchaseorders/Edit/${selected.id}`)}
                  style={{ flex: 1, padding: "10px", background: `linear-gradient(135deg, ${isDark ? "#8b5cf6" : "#7c3aed"}, ${isDark ? "#6d28d9" : "#5b21b6"})`, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", boxShadow: `0 4px 14px ${isDark ? "rgba(139,92,246,0.32)" : "rgba(91,33,182,0.28)"}` }}>
                  <FaEdit size={11} /> Edit PO
                </button>
                <button className="po-btn po-ghost"
                  style={{ flex: 1, padding: "10px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  <FaFileInvoiceDollar size={11} /> Create Bill
                </button>
                <button className="po-btn"
                  style={{ padding: "10px 13px", background: T.redDim, color: T.red, border: `1px solid ${isDark ? "rgba(239,68,68,0.22)" : "#fca5a5"}`, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center" }}>
                  <FaBan size={11} />
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </>
  );
};

export default Purchaseorders;