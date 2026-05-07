import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FaPlus, FaTimes, FaSearch, FaBuilding, FaEnvelope,
  FaPhone, FaDownload, FaUpload, FaStore, FaCheckCircle,
  FaClock, FaFileInvoiceDollar, FaChevronLeft, FaChevronRight,
  FaEdit, FaSortAmountDown, FaSortAmountUp,
  FaTruck, FaTag, FaGlobe, FaIdCard
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import debounce from "lodash/debounce";
import axiosInstance from "../../helper/axiosInstance";

const useGetVendors = () => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const handleGetVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/vendors/?limit=200");
      setData(res.data?.data?.vendors || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  return { handleGetVendors, data, loading, error };
};

// ─── CustomSelect — portal-based, theme-aware ─────────────────────
const CustomSelect = ({ value, onChange, options, placeholder = "Select", minWidth = 120 }) => {
  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);

  const opts     = options.map(o => typeof o === "string" ? { label: o, value: o } : o);
  const selected = opts.find(o => o.value === value);

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(opts.length * 40 + 12, 220);
    const top   = (window.innerHeight - r.bottom) > dropH ? r.bottom + 4 : r.top - dropH - 4;
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

  const isDarkNow   = (() => { try { return JSON.parse(localStorage.getItem("nexus-theme") || "{}").state?.isDark ?? true; } catch { return true; } })();
  const bg          = isDarkNow ? "#111d30" : "#ffffff";
  const border      = isDarkNow ? "rgba(255,255,255,0.07)" : "#e2e8f0";
  const textPri     = isDarkNow ? "#e2e8f0" : "#1e293b";
  const textSec     = isDarkNow ? "#64748b" : "#94a3b8";
  const hoverBg     = isDarkNow ? "rgba(59,130,246,0.08)" : "#eff6ff";
  const activeBg    = isDarkNow ? "rgba(59,130,246,0.15)" : "#eff6ff";
  const activeC     = isDarkNow ? "#60a5fa" : "#1d4ed8";
  const focusBorder = isDarkNow ? "rgba(59,130,246,0.5)" : "#93c5fd";

  const dropdown = (
    <div ref={dropRef} style={{
      position: "absolute", top: dropPos.top, left: dropPos.left, width: dropPos.width,
      zIndex: 99999, background: bg, border: `1.5px solid ${border}`, borderRadius: "11px",
      boxShadow: isDarkNow ? "0 16px 48px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)",
      overflow: "hidden", fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
      visibility: ready ? "visible" : "hidden", opacity: ready ? 1 : 0, transition: "opacity 0.12s ease",
    }}>
      <div style={{ padding: "5px" }}>
        {opts.map((opt, i) => {
          const isAct = opt.value === value;
          return (
            <div key={i} onClick={() => { onChange(opt.value); setOpen(false); setReady(false); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 11px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: isAct ? "600" : "400", color: isAct ? activeC : textPri, background: isAct ? activeBg : "transparent", transition: "background 0.1s" }}
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
      height: "34px", padding: "0 11px", minWidth, border: `1px solid ${open ? focusBorder : border}`,
      borderRadius: "7px", background: bg, cursor: "pointer", userSelect: "none",
      boxShadow: open ? `0 0 0 3px ${isDarkNow ? "rgba(59,130,246,0.15)" : "rgba(147,197,253,0.25)"}` : "none",
      transition: "border-color 0.15s, box-shadow 0.15s", gap: "8px",
    }}>
      <span style={{ fontSize: "12px", fontWeight: "500", color: selected ? textPri : textSec, fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
        {selected ? selected.label : placeholder}
      </span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={open ? activeC : textSec} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
};

// ── Avatar palettes ────────────────────────────────────────────────
const VENDOR_PALETTES_DARK  = [
  ["rgba(59,130,246,0.15)",  "#60a5fa"],
  ["rgba(16,185,129,0.15)",  "#34d399"],
  ["rgba(245,158,11,0.15)",  "#fbbf24"],
  ["rgba(236,72,153,0.12)",  "#f472b6"],
  ["rgba(139,92,246,0.15)",  "#a78bfa"],
  ["rgba(6,182,212,0.15)",   "#22d3ee"],
];
const VENDOR_PALETTES_LIGHT = [
  ["#eff6ff", "#1d4ed8"],
  ["#f0fdf4", "#15803d"],
  ["#fffbeb", "#b45309"],
  ["#fdf2f8", "#be185d"],
  ["#faf5ff", "#6d28d9"],
  ["#ecfeff", "#0e7490"],
];

const Vendors = () => {
  const { handleGetVendors, data, loading, error } = useGetVendors();
  const navigate  = useNavigate();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);

  const PALETTES = isDark ? VENDOR_PALETTES_DARK : VENDOR_PALETTES_LIGHT;

  // ── State ──────────────────────────────────────────────────────
  const [drawerOpen,        setDrawerOpen]        = useState(false);
  const [selectedItem,      setSelectedItem]      = useState(null);
  const [activeTab,         setActiveTab]         = useState("overview");
  const [txData,            setTxData]            = useState({ bills: [], payments: [], purchaseOrders: [], grns: [] });
  const [txLoading,         setTxLoading]         = useState(false);
  const [searchTerm,        setSearchTerm]        = useState("");
  const [isSearchFocused,   setIsSearchFocused]   = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [selectedStatus,    setSelectedStatus]    = useState("all");
  const [sortBy,            setSortBy]            = useState("name");
  const [sortOrder,         setSortOrder]         = useState("asc");
  const [currentPage,       setCurrentPage]       = useState(1);
  const [itemsPerPage,      setItemsPerPage]      = useState(10);
  const [totalPages,        setTotalPages]        = useState(1);
  const searchRef = useRef(null);

  // ── Helpers ────────────────────────────────────────────────────
  const getCode = (v) => {
    if (v.vendorCode) return v.vendorCode;
    const initials = (v.displayName || v.companyName || "V")
      .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3);
    return `${initials}${(v._id || "0000").slice(-4).toUpperCase()}`;
  };

  const getAvatar = (name) =>
    PALETTES[(name || "").charCodeAt(0) % PALETTES.length];

  const getStats = () => {
    if (!data) return { total: 0, active: 0, pending: 0, payables: 0 };
    return {
      total:    data.length,
      active:   data.filter(v => (v.status || "active") === "active").length,
      pending:  data.filter(v => (v.status || "active") === "pending").length,
      payables: data.reduce((s, v) => s + (parseFloat(v.outstandingPayable || 0) || 0), 0),
    };
  };
  const stats = getStats();

  const statusCfg = {
    active:   { bg: T.greenDim,  color: T.green,  border: isDark ? "rgba(16,185,129,0.25)"  : "#86efac"  },
    pending:  { bg: T.amberDim,  color: T.amber,  border: isDark ? "rgba(245,158,11,0.25)"  : "#fcd34d"  },
    inactive: { bg: isDark ? "rgba(100,116,139,0.12)" : "#f1f5f9", color: T.textSec, border: isDark ? "rgba(100,116,139,0.2)" : "#cbd5e1" },
  };

  // ── Filter + sort ──────────────────────────────────────────────
  const getFilteredSorted = () => {
    if (!data) return [];
    let list = [...data];
    if (selectedStatus !== "all")
      list = list.filter(v => (v.status || "active").toLowerCase() === selectedStatus);
    if (searchTerm.trim())
      list = list.filter(v => {
        const q = searchTerm.toLowerCase();
        return (v.displayName || "").toLowerCase().includes(q) ||
          (v.companyName || "").toLowerCase().includes(q) ||
          (v.email || "").toLowerCase().includes(q) ||
          (v.phone || "").toLowerCase().includes(q) ||
          (getCode(v) || "").toLowerCase().includes(q);
      });
    list.sort((a, b) => {
      let av, bv;
      if (sortBy === "date")     { av = new Date(a.createdAt || 0); bv = new Date(b.createdAt || 0); }
      else if (sortBy === "payables") { av = parseFloat(a.payables || 0); bv = parseFloat(b.payables || 0); }
      else if (sortBy === "company")  { av = (a.companyName || "").toLowerCase(); bv = (b.companyName || "").toLowerCase(); }
      else { av = (a.vendorDisplayName || "").toLowerCase(); bv = (b.vendorDisplayName || "").toLowerCase(); }
      return sortOrder === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  };
  const filteredItems = getFilteredSorted();

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    setTotalPages(pages);
    if (currentPage > pages) setCurrentPage(1);
  }, [filteredItems, itemsPerPage]);

  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getPageNums = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums = [1];
    let s = Math.max(2, currentPage - 1), e = Math.min(totalPages - 1, currentPage + 1);
    if (currentPage <= 3) e = 4;
    if (currentPage >= totalPages - 2) s = totalPages - 3;
    if (s > 2) nums.push("...");
    for (let i = s; i <= e; i++) nums.push(i);
    if (e < totalPages - 1) nums.push("...");
    if (totalPages > 1) nums.push(totalPages);
    return nums;
  };

  // ── Search suggestions ────────────────────────────────────────
  const handleSearchChange = useCallback(debounce(() => {}, 300), []);
  const handleSearchInput  = (e) => {
    const v = e.target.value;
    setSearchTerm(v);
    handleSearchChange(v);
    if (v.trim().length >= 2) {
      const q = v.toLowerCase();
      setSearchSuggestions((data || []).filter(vdr =>
        (vdr.vendorDisplayName || "").toLowerCase().includes(q) ||
        (vdr.companyName || "").toLowerCase().includes(q) ||
        (vdr.vendorEmail || "").toLowerCase().includes(q) ||
        (getCode(vdr) || "").toLowerCase().includes(q)
      ).slice(0, 8));
    } else setSearchSuggestions([]);
  };
  const handleClearSearch       = () => { setSearchTerm(""); setSearchSuggestions([]); };
  const handleSuggestionClick   = (v) => { setSelectedItem(v); setDrawerOpen(true); setActiveTab("overview"); setSearchTerm(""); setSearchSuggestions([]); setIsSearchFocused(false); };

  useEffect(() => {
    const h = e => { if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchSuggestions([]); setIsSearchFocused(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Drawer ────────────────────────────────────────────────────
  const openDrawer  = (v) => { setSelectedItem(v); setDrawerOpen(true); setActiveTab("overview"); };
  const closeDrawer = ()  => { setDrawerOpen(false); setSelectedItem(null); setTxData({ bills: [], payments: [], purchaseOrders: [], grns: [] }); };

  useEffect(() => {
    if (!selectedItem?._id) return;
    setTxLoading(true);
    axiosInstance.get(`/api/vendors/${selectedItem._id}/transactions`)
      .then(res => setTxData(res.data?.data || { bills: [], payments: [], purchaseOrders: [], grns: [] }))
      .catch(() => setTxData({ bills: [], payments: [], purchaseOrders: [], grns: [] }))
      .finally(() => setTxLoading(false));
  }, [selectedItem?._id]);

  // ── Export ────────────────────────────────────────────────────
  const handleExport = () => {
    if (!data?.length) { alert("No vendors to export"); return; }
    const rows = data.map(v => ({ Code: getCode(v), Name: v.displayName || "", Company: v.companyName || "", Email: v.email || "", Phone: v.phone || "", Status: v.status || "active" }));
    const csv  = Object.keys(rows[0]).join(",") + "\n" + rows.map(r => Object.values(r).join(",")).join("\n");
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `vendors_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  useEffect(() => { handleGetVendors(); }, [handleGetVendors]);

  // ── Dynamic CSS ───────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
    .vnd-root * { box-sizing: border-box; }
    .vnd-root { font-family: 'DM Sans', sans-serif; transition: background 0.25s ease, color 0.25s ease; }
    .vnd-jakarta { font-family: 'Sora', sans-serif; }

    .vnd-stat { transition: transform 0.18s ease, box-shadow 0.18s ease; }
    .vnd-stat:hover { transform: translateY(-2px); box-shadow: ${isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.1)"} !important; }

    .vnd-row { transition: background 0.12s; }
    .vnd-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .vnd-row:hover .vnd-name { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .vnd-action { transition: all 0.15s; }
    .vnd-action:hover { opacity: 0.85; transform: translateY(-1px); }

    .vnd-pill { transition: all 0.15s; cursor: pointer; }
    .vnd-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .vnd-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }

    .vnd-tbl-btn { transition: all 0.12s; }
    .vnd-tbl-btn:hover { background: ${isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9"} !important; color: ${isDark ? "#e2e8f0" : "#0f172a"} !important; }

    .vnd-page-btn { transition: all 0.12s; }
    .vnd-page-btn:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .vnd-suggestion { transition: background 0.1s; cursor: pointer; }
    .vnd-suggestion:hover { background: ${isDark ? "rgba(59,130,246,0.06)" : "#eff6ff"} !important; }

    .vnd-drawer-tab { transition: all 0.15s; border-bottom: 2px solid transparent; }
    .vnd-drawer-tab:hover { color: ${isDark ? "#94a3b8" : "#374151"} !important; }
    .vnd-drawer-tab-active { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-bottom-color: ${isDark ? "#3b82f6" : "#2563eb"} !important; }

    .vnd-detail-row { transition: background 0.1s; }
    .vnd-detail-row:hover { background: ${isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"} !important; }

    .vnd-fin-row { transition: background 0.1s; }
    .vnd-fin-row:hover { background: ${isDark ? "rgba(255,255,255,0.03)" : "#f8fafc"} !important; }

    @keyframes vnd-slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes vnd-fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes vnd-spin    { to { transform: rotate(360deg); } }
    @keyframes vnd-fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

    .vnd-drawer  { animation: vnd-slideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .vnd-overlay { animation: vnd-fadeIn 0.2s ease forwards; }
    .vnd-up      { animation: vnd-fadeUp 0.3s ease both; }
    .vnd-up-1    { animation: vnd-fadeUp 0.3s 0.05s ease both; }
    .vnd-up-2    { animation: vnd-fadeUp 0.3s 0.10s ease both; }
    .vnd-spin    { animation: vnd-spin 0.8s linear infinite; }
  `;

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", transition: "background 0.25s ease, border-color 0.25s ease" };

  // ── Loading ───────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg }}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <div className="vnd-spin" style={{ width: "36px", height: "36px", border: `3px solid ${T.border}`, borderTopColor: T.blue, borderRadius: "50%" }} />
        <span style={{ color: T.textSec, fontSize: "13px", fontFamily: "DM Sans, sans-serif" }}>Loading vendors…</span>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: "20px", color: "#ef4444", background: "rgba(239,68,68,0.08)", borderRadius: "12px", margin: "24px", border: "1px solid rgba(239,68,68,0.2)", fontFamily: "DM Sans, sans-serif" }}>
      Error: {error}
    </div>
  );

  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx   = Math.min(currentPage * itemsPerPage, filteredItems.length);

  return (
    <>
      <style>{css}</style>
      <div className="vnd-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* ── HEADER ──────────────────────────────────────────── */}
        <div className="vnd-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h1 className="vnd-jakarta" style={{ fontSize: "20px", fontWeight: "700", color: T.textPri, margin: 0 }}>Vendors</h1>
            <p style={{ color: T.textSec, fontSize: "13px", marginTop: "4px" }}>Manage your supplier relationships and payables</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { label: "Export", icon: <FaDownload size={11} />, onClick: handleExport, variant: "ghost" },
              { label: "Import", icon: <FaUpload   size={11} />, onClick: () => {},     variant: "ghost" },
              { label: "New Vendor", icon: <FaPlus size={11} />, onClick: () => navigate("/Purchase/Vendors/NewVendor"), variant: "primary" },
            ].map(btn => (
              <button key={btn.label} className="vnd-action" onClick={btn.onClick}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: btn.variant === "primary" ? "600" : "500", cursor: "pointer", fontFamily: "inherit", background: btn.variant === "primary" ? T.blue : "transparent", color: btn.variant === "primary" ? "white" : T.textSec, border: btn.variant === "primary" ? "none" : `1px solid ${T.border}` }}>
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────── */}
        <div className="vnd-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" }}>
          {[
            {
              label: "Total Vendors",  value: stats.total,
              icon: <FaStore />,       color: T.blue,   dim: T.blueDim,
              sub: `${stats.active} active · ${stats.pending} pending`, bar: null,
            },
            {
              label: "Active",         value: stats.active,
              icon: <FaCheckCircle />, color: T.green,  dim: T.greenDim,
              sub: stats.total ? `${Math.round((stats.active / stats.total) * 100)}% of total` : "—",
              bar: stats.total ? (stats.active / stats.total) * 100 : 0, barColor: T.green,
            },
            {
              label: "Pending",        value: stats.pending,
              icon: <FaClock />,       color: T.amber,  dim: T.amberDim,
              sub: stats.total ? `${Math.round((stats.pending / stats.total) * 100)}% of total` : "—",
              bar: stats.total ? (stats.pending / stats.total) * 100 : 0, barColor: T.amber,
            },
            {
              label: "Total Payables", value: `AED ${stats.payables.toLocaleString()}`,
              icon: <FaFileInvoiceDollar />, color: T.purple, dim: T.purpleDim, small: true,
              sub: `Avg AED ${stats.total ? Math.round(stats.payables / stats.total).toLocaleString() : 0} / vendor`,
              bar: null,
            },
          ].map((c, i) => (
            <div key={i} className="vnd-stat" style={{ ...card, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, transparent 10%, ${c.color}${isDark ? "55" : "70"}, transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", color: T.textSec, fontWeight: "600", margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.label}</p>
                <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>{c.icon}</div>
              </div>
              <p className="vnd-jakarta" style={{ fontSize: c.small ? "17px" : "26px", fontWeight: "800", color: T.textPri, margin: "0 0 10px", lineHeight: 1 }}>{c.value}</p>
              {c.bar !== null && c.bar !== undefined && (
                <div style={{ height: "3px", background: isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0", borderRadius: "999px", marginBottom: "8px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.bar}%`, background: c.barColor, borderRadius: "999px", transition: "width 0.8s ease" }} />
                </div>
              )}
              <p style={{ fontSize: "11px", color: T.textSec, margin: 0, fontWeight: "500" }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── TOOLBAR ─────────────────────────────────────────── */}
        <div className="vnd-up-2" style={{ ...card, padding: "12px 16px", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>

            {/* Search */}
            <div ref={searchRef} style={{ position: "relative", flex: 1, minWidth: "240px" }}>
              <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: "11px", pointerEvents: "none" }} />
              <input type="text" value={searchTerm} onChange={handleSearchInput}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search by name, email, phone, code…"
                style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "13px", background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
              {searchTerm && (
                <button onClick={handleClearSearch}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}>
                  <FaTimes size={11} />
                </button>
              )}

              {/* Suggestions dropdown */}
              {isSearchFocused && searchSuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px", boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, overflow: "hidden" }}>
                  <div style={{ padding: "8px 14px 6px", fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em" }}>{searchSuggestions.length} results</div>
                  {searchSuggestions.map((v, idx) => {
                    const [bg, fg] = getAvatar(v.displayName || v.companyName);
                    return (
                      <div key={v._id || idx} className="vnd-suggestion" onClick={() => handleSuggestionClick(v)}
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderTop: `1px solid ${T.border}` }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>
                          {(v.displayName || v.companyName || "V").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: "600", color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.displayName || v.companyName || "Unnamed"}</p>
                          <p style={{ fontSize: "11px", color: T.textSec, margin: 0 }}>{v.email || v.companyName || ""}</p>
                        </div>
                        <span style={{ fontSize: "10px", fontWeight: "600", fontFamily: "'DM Mono', monospace", background: T.blueDim, color: T.blueLight, padding: "2px 8px", borderRadius: "5px", border: `1px solid rgba(59,130,246,0.2)` }}>
                          {getCode(v)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {isSearchFocused && searchTerm.trim().length >= 2 && searchSuggestions.length === 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px", boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, padding: "20px", textAlign: "center" }}>
                  <p style={{ color: T.textSec, fontSize: "13px", margin: 0 }}>No results for "{searchTerm}"</p>
                </div>
              )}
            </div>

            {/* Status pills */}
            <div style={{ display: "flex", gap: "4px" }}>
              {["all", "active", "pending", "inactive"].map(s => (
                <button key={s} onClick={() => { setSelectedStatus(s); setCurrentPage(1); }}
                  className={`vnd-pill${selectedStatus === s ? " vnd-pill-active" : ""}`}
                  style={{ padding: "6px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: "500", background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit", cursor: "pointer" }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div style={{ display: "flex", gap: "6px" }}>
              <CustomSelect value={sortBy} onChange={v => { setSortBy(v); setCurrentPage(1); }}
                options={[
                  { label: "Name",     value: "name"     },
                  { label: "Company",  value: "company"  },
                  { label: "Date",     value: "date"     },
                  { label: "Payables", value: "payables" },
                ]} minWidth={130} />
              <button onClick={() => { setSortOrder(o => o === "asc" ? "desc" : "asc"); setCurrentPage(1); }}
                style={{ padding: "6px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: T.surface2, color: T.textSec, cursor: "pointer", display: "flex", alignItems: "center" }}>
                {sortOrder === "asc" ? <FaSortAmountDown size={12} /> : <FaSortAmountUp size={12} />}
              </button>
            </div>

            <span style={{ fontSize: "12px", color: T.textSec, marginLeft: "auto", whiteSpace: "nowrap" }}>
              {filteredItems.length} vendor{filteredItems.length !== 1 ? "s" : ""}
            </span>
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
                {["Vendor", "Company", "Contact", "Category", "Payables", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i === 4 ? "right" : "left", fontSize: "11px", fontWeight: "600", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? currentItems.map((v, idx) => {
                const [avBg, avFg] = getAvatar(v.displayName || v.companyName);
                const sc = statusCfg[v.status] || statusCfg.active;
                return (
                  <tr key={v._id || idx} className="vnd-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "13px 16px" }}><input type="checkbox" style={{ accentColor: T.blue }} /></td>

                    {/* Vendor name + code + status */}
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                        <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: avBg, color: avFg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
                          {(v.displayName || v.companyName || "V").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span className="vnd-name" onClick={() => openDrawer(v)}
                              style={{ fontWeight: "600", color: T.textPri, cursor: "pointer", transition: "color 0.15s", fontSize: "13px" }}>
                              {v.displayName || v.companyName || "Unnamed"}
                            </span>
                            <span style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", background: T.blueDim, color: T.blueLight, padding: "2px 7px", borderRadius: "5px", border: `1px solid rgba(59,130,246,0.2)` }}>
                              {getCode(v)}
                            </span>
                            {v.status && (
                              <span style={{ fontSize: "10px", fontWeight: "600", background: sc.bg, color: sc.color, padding: "2px 8px", borderRadius: "999px", border: `1px solid ${sc.border}`, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                                {v.status}
                              </span>
                            )}
                          </div>
                          {v.companyName && v.companyName !== "N/A" && (
                            <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0" }}>{v.companyName}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td style={{ padding: "13px 16px", color: T.textSec, fontSize: "12px" }}>
                      {v.companyName && v.companyName !== "N/A" ? v.companyName : <span style={{ color: T.textMuted }}>—</span>}
                    </td>

                    {/* Contact */}
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {v.email && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <FaEnvelope size={10} style={{ color: T.textSec, flexShrink: 0 }} />
                            <span style={{ fontSize: "12px", color: T.textSec }}>{v.email}</span>
                          </div>
                        )}
                        {v.phone && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <FaPhone size={10} style={{ color: T.textSec, flexShrink: 0 }} />
                            <span style={{ fontSize: "12px", color: T.textSec }}>{v.phone}</span>
                          </div>
                        )}
                        {!v.email && !v.phone && <span style={{ color: T.textMuted, fontSize: "12px" }}>—</span>}
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: "13px 16px" }}>
                      {v.category ? (
                        <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 9px", borderRadius: "7px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}` }}>
                          {v.category}
                        </span>
                      ) : <span style={{ color: T.textMuted, fontSize: "12px" }}>—</span>}
                    </td>

                    {/* Payables */}
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <span className="vnd-jakarta" style={{ fontWeight: "700", fontSize: "13px", color: parseFloat(v.payables || 0) > 0 ? "#ef4444" : T.textPri }}>
                        AED {parseFloat(v.outstandingPayable || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "13px 12px" }}>
                      <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                        <button className="vnd-tbl-btn" onClick={() => openDrawer(v)}
                          style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "11px", color: T.textSec, cursor: "pointer", fontFamily: "inherit", fontWeight: "500" }}>
                          View
                        </button>
                        <button className="vnd-tbl-btn" onClick={() => navigate(`/Purchase/Vendors/Edit/${v._id}`)}
                          style={{ padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "11px", color: T.textSec, cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <FaEdit size={10} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="7" style={{ padding: "72px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: T.textSec }}>
                        <FaStore />
                      </div>
                      <p className="vnd-jakarta" style={{ fontWeight: "700", color: T.textPri, fontSize: "15px", margin: 0 }}>No vendors yet</p>
                      <p style={{ color: T.textSec, fontSize: "13px", margin: 0 }}>Add your first supplier to get started</p>
                      <button className="vnd-action" onClick={() => navigate("/Purchase/Vendors/New")}
                        style={{ marginTop: "4px", padding: "8px 20px", background: T.blue, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                        New Vendor
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ──────────────────────────────────────── */}
        {filteredItems.length > 0 && (
          <div style={{ ...card, padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: T.textSec }}>
              Showing {startIdx}–{endIdx} of {filteredItems.length} vendors
            </span>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "12px", color: currentPage === 1 ? T.textMuted : T.textSec, cursor: currentPage === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                <FaChevronLeft size={10} /> Prev
              </button>
              {getPageNums().map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} style={{ padding: "5px 8px", color: T.textSec, fontSize: "12px" }}>…</span>
                ) : (
                  <button key={p} className="vnd-page-btn" onClick={() => setCurrentPage(p)}
                    style={{ padding: "5px 10px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${currentPage === p ? "rgba(59,130,246,0.35)" : T.border}`, background: currentPage === p ? T.blueDim : "transparent", color: currentPage === p ? T.blueLight : T.textSec }}>
                    {p}
                  </button>
                )
              )}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "12px", color: currentPage === totalPages ? T.textMuted : T.textSec, cursor: currentPage === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                Next <FaChevronRight size={10} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: T.textSec }}>Per page:</span>
              <CustomSelect value={itemsPerPage}
                onChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
                options={[5, 10, 20, 50].map(n => ({ label: String(n), value: n }))}
                minWidth={72} />
            </div>
          </div>
        )}
      </div>

      {/* ── DRAWER ──────────────────────────────────────────────── */}
      {drawerOpen && selectedItem && (() => {
        const v  = selectedItem;
        const sc = statusCfg[v.status] || statusCfg.active;
        const [avBg, avFg] = getAvatar(v.displayName || v.companyName);
        return (
          <>
            <div className="vnd-overlay" onClick={closeDrawer}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />

            <div className="vnd-drawer"
              style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "440px", maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

              {/* Drawer header */}
              <div style={{ padding: "20px 20px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: avBg, color: avFg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "800", flexShrink: 0 }}>
                      {(v.displayName || v.companyName || "V").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                        <h3 className="vnd-jakarta" style={{ fontSize: "15px", fontWeight: "800", color: T.textPri, margin: 0 }}>
                          {v.displayName || v.companyName || "Unnamed"}
                        </h3>
                        <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 9px", borderRadius: "999px", background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                          {v.status || "active"}
                        </span>
                      </div>
                      <span style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", background: T.blueDim, color: T.blueLight, padding: "2px 8px", borderRadius: "5px", border: `1px solid rgba(59,130,246,0.2)` }}>
                        {getCode(v)}
                      </span>
                    </div>
                  </div>
                  <button onClick={closeDrawer}
                    style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "6px", cursor: "pointer", color: T.textSec, display: "flex", flexShrink: 0, marginLeft: "10px" }}>
                    <FaTimes size={11} />
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex" }}>
                  {["overview", "purchases", "history"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`vnd-drawer-tab${activeTab === tab ? " vnd-drawer-tab-active" : ""}`}
                      style={{ padding: "9px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "500", fontFamily: "inherit", color: T.textSec, textTransform: "capitalize" }}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drawer body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>

                {/* ── Overview tab ── */}
                {activeTab === "overview" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {/* Contact info rows */}
                    {[
                      { icon: <FaBuilding />, label: "Company",      value: v.companyName          },
                      { icon: <FaEnvelope />, label: "Email",        value: v.email           },
                      { icon: <FaPhone />,    label: "Phone",        value: v.phone           },
                      { icon: <FaGlobe />,    label: "Website",      value: v.website               },
                      { icon: <FaTag />,      label: "Category",     value: v.category              },
                      { icon: <FaIdCard />,   label: "TRN / Tax ID", value: v.taxNumber || v.trn    },
                      { icon: <FaTruck />,    label: "Lead Time",    value: v.leadTime ? `${v.leadTime} days` : null },
                    ].filter(r => r.value).map(({ icon, label, value }) => (
                      <div key={label} className="vnd-detail-row"
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", background: T.surface2, borderRadius: "10px", border: `1px solid ${T.border}` }}>
                        <div style={{ color: T.textSec, fontSize: "12px", flexShrink: 0, width: "16px", display: "flex", justifyContent: "center" }}>{icon}</div>
                        <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500", minWidth: "90px", flexShrink: 0 }}>{label}</span>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: T.textPri, marginLeft: "auto", textAlign: "right" }}>{value}</span>
                      </div>
                    ))}

                    {/* Address block */}
                    {(v.address || v.city || v.country) && (
                      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "13px 14px", marginTop: "4px" }}>
                        <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Address</p>
                        <p style={{ fontSize: "13px", color: T.textPri, margin: 0, lineHeight: "1.6" }}>
                          {[v.address, v.city, v.state, v.country, v.postalCode].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    )}

                    {/* Payables summary */}
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden", marginTop: "4px" }}>
                      <div style={{ padding: "11px 14px", borderBottom: `1px solid ${T.border}` }}>
                        <p className="vnd-jakarta" style={{ fontSize: "11px", fontWeight: "700", color: T.textPri, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Financials</p>
                      </div>
                      {[
                        { label: "Outstanding Payables", value: `AED ${parseFloat(v.outstandingPayable || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`, red: parseFloat(v.payables || 0) > 0 },
                        { label: "Credit Limit",         value: v.creditLimit ? `AED ${parseFloat(v.creditLimit).toLocaleString("en-AE", { minimumFractionDigits: 2 })}` : "—" },
                        { label: "Payment Terms",        value: v.paymentTerms || "—" },
                        { label: "Currency",             value: v.currency || "AED" },
                      ].map(({ label, value, red }) => (
                        <div key={label} className="vnd-fin-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: "12px", color: T.textSec }}>{label}</span>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: red ? "#ef4444" : T.textPri }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Purchases tab ── */}
                {activeTab === "purchases" && (() => {
                  const payables = parseFloat(v.outstandingPayable || 0);
                  const fmt = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

                  const statusColor = {
                    draft:     { bg: T.surface2,                              fg: T.textSec  },
                    confirmed: { bg: isDark ? "rgba(16,185,129,0.1)" : "#f0fdf4",   fg: "#10b981" },
                    received:  { bg: isDark ? "rgba(16,185,129,0.1)" : "#f0fdf4",   fg: "#10b981" },
                    approved:  { bg: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff",   fg: T.blue    },
                    paid:      { bg: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff",   fg: T.blue    },
                    unpaid:    { bg: isDark ? "rgba(239,68,68,0.1)"  : "#fef2f2",   fg: "#ef4444" },
                    partial:   { bg: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb",   fg: "#f59e0b" },
                    sent:      { bg: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb",   fg: "#f59e0b" },
                  };
                  const pill = (s) => {
                    const c = statusColor[s?.toLowerCase()] || statusColor.draft;
                    return <span style={{ fontSize: "10px", fontWeight: "600", padding: "2px 8px", borderRadius: "99px", background: c.bg, color: c.fg }}>{s || "—"}</span>;
                  };

                  const SectionHeader = ({ title, count }) => (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 8px" }}>
                      <p style={{ fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{title}</p>
                      <span style={{ fontSize: "10px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, padding: "1px 7px", borderRadius: "99px" }}>{count}</span>
                    </div>
                  );

                  return (
                    <div style={{ display: "flex", flexDirection: "column" }}>

                      {/* Outstanding payables summary */}
                      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500" }}>Outstanding Payables</span>
                        <span className="vnd-jakarta" style={{ fontSize: "15px", fontWeight: "800", color: payables > 0 ? "#ef4444" : T.textPri }}>{fmt(payables)}</span>
                      </div>

                      {txLoading ? (
                        <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                          <div className="vnd-spin" style={{ width: "24px", height: "24px", border: `2px solid ${T.border}`, borderTopColor: T.blue, borderRadius: "50%" }} />
                        </div>
                      ) : (
                        <>
                          {/* Purchase Orders */}
                          <SectionHeader title="Purchase Orders" count={txData.purchaseOrders?.length || 0} />
                          <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
                            {txData.purchaseOrders?.length > 0 ? (
                              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                                {txData.purchaseOrders.map((po, i, arr) => (
                                  <div key={po._id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                    <div>
                                      <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>{po.orderNumber || po.poNumber || "PO"}</p>
                                      <p style={{ fontSize: "10px", color: T.textSec, margin: "2px 0 0" }}>{fmtDate(po.createdAt)}</p>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      {pill(po.status)}
                                      <span style={{ fontSize: "12px", fontWeight: "700", color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmt(po.total)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ fontSize: "12px", color: T.textSec, padding: "12px", margin: 0 }}>No purchase orders yet.</p>
                            )}
                          </div>

                          {/* GRNs */}
                          <SectionHeader title="Goods Receipts (GRN)" count={txData.grns?.length || 0} />
                          <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
                            {txData.grns?.length > 0 ? (
                              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                                {txData.grns.map((grn, i, arr) => (
                                  <div key={grn._id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                    <div>
                                      <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>{grn.grnNumber || "GRN"}</p>
                                      <p style={{ fontSize: "10px", color: T.textSec, margin: "2px 0 0" }}>{fmtDate(grn.receiptDate || grn.createdAt)}</p>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      {pill(grn.status)}
                                      <span style={{ fontSize: "12px", fontWeight: "700", color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmt(grn.total)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ fontSize: "12px", color: T.textSec, padding: "12px", margin: 0 }}>No goods receipts yet.</p>
                            )}
                          </div>

                          {/* Bills */}
                          <SectionHeader title="Bills" count={txData.bills?.length || 0} />
                          <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
                            {txData.bills?.length > 0 ? (
                              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                                {txData.bills.map((bill, i, arr) => (
                                  <div key={bill._id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                    <div>
                                      <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>{bill.billNumber || "Bill"}</p>
                                      <p style={{ fontSize: "10px", color: T.textSec, margin: "2px 0 0" }}>Due: {fmtDate(bill.dueDate)}</p>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      {pill(bill.status)}
                                      <span style={{ fontSize: "12px", fontWeight: "700", color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmt(bill.totals?.grandTotal || bill.total)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ fontSize: "12px", color: T.textSec, padding: "12px", margin: 0 }}>No bills yet.</p>
                            )}
                          </div>

                          {/* Payments */}
                          <SectionHeader title="Payments Made" count={txData.payments?.length || 0} />
                          <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
                            {txData.payments?.length > 0 ? (
                              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                                {txData.payments.map((pay, i, arr) => (
                                  <div key={pay._id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                    <div>
                                      <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>{pay.paymentNumber || pay.referenceNumber || "Payment"}</p>
                                      <p style={{ fontSize: "10px", color: T.textSec, margin: "2px 0 0" }}>{fmtDate(pay.paymentDate || pay.createdAt)}</p>
                                    </div>
                                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#10b981", fontFamily: "'DM Mono', monospace" }}>{fmt(pay.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ fontSize: "12px", color: T.textSec, padding: "12px", margin: 0 }}>No payments yet.</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ── History tab ── */}
                {activeTab === "history" && (() => {
                  const history = [...(v.history || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                  const actionLabel = {
                    po_created:     { label: "PO Created",      color: T.blue,    dim: T.blueDim    },
                    grn_received:   { label: "GRN Received",    color: "#10b981", dim: isDark ? "rgba(16,185,129,0.12)" : "#f0fdf4" },
                    bill_created:   { label: "Bill Created",    color: "#f59e0b", dim: isDark ? "rgba(245,158,11,0.12)" : "#fffbeb" },
                    payment_made:   { label: "Payment Made",    color: "#10b981", dim: isDark ? "rgba(16,185,129,0.12)" : "#f0fdf4" },
                    credit_applied: { label: "Credit Applied",  color: T.blue,    dim: T.blueDim    },
                  };
                  if (history.length === 0) return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px", gap: "12px" }}>
                      <div style={{ width: "48px", height: "48px", borderRadius: "13px", background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: T.textSec }}>
                        <FaClock />
                      </div>
                      <p className="vnd-jakarta" style={{ fontWeight: "700", color: T.textPri, fontSize: "14px", margin: 0 }}>No history yet</p>
                      <p style={{ color: T.textSec, fontSize: "12px", margin: 0 }}>Activity will appear here once recorded.</p>
                    </div>
                  );
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                      {history.map((entry, i) => {
                        const cfg = actionLabel[entry.action] || { label: entry.action, color: T.textSec, dim: T.surface2 };
                        const ts  = entry.timestamp ? new Date(entry.timestamp) : null;
                        return (
                          <div key={i} style={{ display: "flex", gap: "12px", paddingBottom: "16px", position: "relative" }}>
                            {/* Timeline line */}
                            {i < history.length - 1 && (
                              <div style={{ position: "absolute", left: "14px", top: "28px", bottom: 0, width: "1px", background: T.border }} />
                            )}
                            {/* Dot */}
                            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: cfg.dim, border: `2px solid ${cfg.color}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.color }} />
                            </div>
                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0, paddingTop: "4px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "2px" }}>
                                <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "99px", background: cfg.dim, color: cfg.color }}>{cfg.label}</span>
                                {ts && <span style={{ fontSize: "10px", color: T.textSec, flexShrink: 0 }}>{ts.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                              </div>
                              <p style={{ fontSize: "12px", color: T.textSec, margin: 0, lineHeight: "1.5" }}>{entry.details}</p>
                              {entry.user && <p style={{ fontSize: "10px", color: T.textMuted, margin: "2px 0 0" }}>by {entry.user}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Drawer footer */}
              <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "8px" }}>
                <button className="vnd-action"
                  style={{ flex: 1, padding: "10px", background: T.blue, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}
                  onClick={() => navigate(`/Purchase/Purchaseorders/New?vendor=${v._id}`)}>
                  <FaPlus size={11} /> New PO
                </button>
                <button className="vnd-action"
                  style={{ flex: 1, padding: "10px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}
                  onClick={() => navigate(`/Purchase/Vendors/Edit/${v._id}`)}>
                  <FaEdit size={11} /> Edit
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </>
  );
};

export default Vendors;