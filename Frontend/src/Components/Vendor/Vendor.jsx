import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FaPlus, FaTimes, FaSearch, FaBuilding,
  FaEnvelope, FaPhone, FaDownload,
  FaStore, FaCheckCircle, FaClock, FaFileInvoiceDollar,
  FaChevronLeft, FaChevronRight, FaEdit,
  FaSortAmountDown, FaSortAmountUp, FaExternalLinkAlt, FaSync,
  FaGlobe, FaTag, FaTruck, FaIdCard, FaBoxOpen,
} from "react-icons/fa";
import { FaFileImport } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import CsvImportModal from "../common/CsvImportModal";

const VENDOR_IMPORT_FIELDS = [
  { key: "displayName",   label: "Display Name", aliases: ["name", "vendor name", "display name"], required: false },
  { key: "companyName",   label: "Company",      aliases: ["company", "company name"] },
  { key: "email",         label: "Email",        aliases: ["email", "e-mail"] },
  { key: "phone",         label: "Phone",        aliases: ["phone", "telephone"] },
  { key: "mobile",        label: "Mobile",       aliases: ["mobile", "cell"] },
  { key: "trn",           label: "TRN",          aliases: ["trn", "tax registration"] },
  { key: "streetAddress", label: "Address",      aliases: ["address", "street"] },
  { key: "city",          label: "City",         aliases: ["city"] },
  { key: "country",       label: "Country",      aliases: ["country"] },
];
import debounce from "lodash/debounce";
import axiosInstance from "../../helper/axiosInstance";
import { usePermissions } from "../../helper/permissions";
import useRealtime from "../../helper/useRealtime";

// ─── CustomSelect ────────────────────────────────────────────────
const CustomSelect = ({ value, onChange, options, placeholder = "Select", minWidth = 120 }) => {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);

  const opts     = options.map(o => typeof o === "string" ? { label: o, value: o } : o);
  const selected = opts.find(o => o.value === value);

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r    = triggerRef.current.getBoundingClientRect();
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
      height: "34px", padding: "0 11px", minWidth,
      border: `1px solid ${open ? focusBorder : border}`, borderRadius: "7px",
      background: bg, cursor: "pointer", userSelect: "none",
      boxShadow: open ? `0 0 0 3px ${isDarkNow ? "rgba(59,130,246,0.15)" : "rgba(147,197,253,0.25)"}` : "none",
      transition: "border-color 0.15s, box-shadow 0.15s", boxSizing: "border-box", gap: "8px",
    }}>
      <span style={{ fontSize: "12px", fontWeight: "500", color: selected ? textPri : textSec, fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
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

const Vendors = () => {
  const navigate = useNavigate();
  const isDark   = useThemeStore(s => s.isDark);
  const T        = getTheme(isDark);
  const { can }  = usePermissions();
  const canExport = can("vendors", "export");

  const AVATAR_PALETTES = [
    [T.blueDim,   T.blueLight],
    [T.greenDim,  T.green],
    [T.amberDim,  T.amber],
    [isDark ? "rgba(236,72,153,0.12)" : "#fce7f3", "#f472b6"],
    [T.purpleDim, T.purple],
    [T.cyanDim,   T.cyan],
  ];

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
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
    .vnd-detail-row { transition: background 0.1s; }
    .vnd-detail-row:hover { background: ${isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"} !important; }
    .vnd-fin-row { transition: background 0.1s; }
    .vnd-fin-row:hover { background: ${isDark ? "rgba(255,255,255,0.03)" : "#f8fafc"} !important; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .fade-up { animation: fadeUp 0.3s ease forwards; }
  `;

  const [data,              setData]              = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(null);
  const [selectedItem,      setSelectedItem]      = useState(null);
  const [activeTab,         setActiveTab]         = useState("overview");
  const [txData,            setTxData]            = useState({ bills: [], payments: [], purchaseOrders: [], grns: [] });
  const [txLoading,         setTxLoading]         = useState(false);
  const [searchTerm,        setSearchTerm]        = useState("");
  const [isSearchFocused,   setIsSearchFocused]   = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [selectedStatus,    setSelectedStatus]    = useState("all");
  const [sortBy,            setSortBy]            = useState("name");
  const [sortOrder,         setSortOrder]         = useState("asc");
  const [currentPage,       setCurrentPage]       = useState(1);
  const [itemsPerPage,      setItemsPerPage]      = useState(10);
  const [totalPages,        setTotalPages]        = useState(1);
  const searchRef = useRef(null);

  const loadVendors = useCallback(async () => {
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

  useEffect(() => { loadVendors(); }, [loadVendors]);
  useRealtime(['vendors_updated','bills_updated','vendor_payments_updated'], loadVendors);

  // Keep selectedItem in sync when list re-fetches
  useEffect(() => {
    if (!selectedItem?._id || !data?.length) return;
    const updated = data.find(v => v._id === selectedItem._id);
    if (updated) setSelectedItem(updated);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedItem?._id) return;
    setTxLoading(true);
    axiosInstance.get(`/api/vendors/${selectedItem._id}/transactions`)
      .then(res => setTxData(res.data?.data || { bills: [], payments: [], purchaseOrders: [], grns: [] }))
      .catch(() => setTxData({ bills: [], payments: [], purchaseOrders: [], grns: [] }))
      .finally(() => setTxLoading(false));
  }, [selectedItem?._id]);

  // ── Helpers ────────────────────────────────────────────────────
  const getName    = v => v.displayName || v.vendorDisplayName || v.companyName || "Unnamed";
  const getCode    = v => v.vendorCode || (() => {
    const ini = getName(v).split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3);
    return `${ini}${(v._id || "0000").slice(-4).toUpperCase()}`;
  })();
  const getAvatar  = name => AVATAR_PALETTES[(name || "").charCodeAt(0) % AVATAR_PALETTES.length];
  const fmtMoney   = n => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate    = d => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const getStats = () => {
    if (!data) return { total: 0, active: 0, pending: 0, payables: 0 };
    return {
      total:    data.length,
      active:   data.filter(v => (v.status || "active") === "active").length,
      pending:  data.filter(v => (v.status || "active") === "pending").length,
      payables: data.reduce((s, v) => s + parseFloat(v.outstandingPayable || 0), 0),
    };
  };
  const stats = getStats();

  const statusCfg = {
    active:   { bg: T.greenDim,  color: T.green,  border: isDark ? "rgba(16,185,129,0.25)" : "#86efac" },
    pending:  { bg: T.amberDim,  color: T.amber,  border: isDark ? "rgba(245,158,11,0.25)"  : "#fcd34d" },
    inactive: { bg: isDark ? "rgba(100,116,139,0.12)" : "#f1f5f9", color: T.textSec, border: isDark ? "rgba(100,116,139,0.2)" : "#cbd5e1" },
  };

  const getFilteredSorted = () => {
    if (!data) return [];
    let list = [...data];
    if (selectedStatus !== "all") list = list.filter(v => (v.status || "active").toLowerCase() === selectedStatus);
    list.sort((a, b) => {
      const av = sortBy === "date" ? new Date(a.createdAt || 0) : sortBy === "payables" ? parseFloat(a.outstandingPayable || 0) : getName(a).toLowerCase();
      const bv = sortBy === "date" ? new Date(b.createdAt || 0) : sortBy === "payables" ? parseFloat(b.outstandingPayable || 0) : getName(b).toLowerCase();
      return sortOrder === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  };
  const filteredItems = getFilteredSorted();

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
    setTotalPages(pages);
    if (currentPage > pages) setCurrentPage(pages);
  }, [filteredItems, itemsPerPage, currentPage]);

  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = p => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  const handleItemClick = v => { setSelectedItem(v); setActiveTab("overview"); };
  const closePanel      = () => setSelectedItem(null);

  const handleSearchChange = useCallback(debounce(() => {}, 300), []);
  const handleSearchInput  = e => {
    const val = e.target.value;
    setSearchTerm(val);
    handleSearchChange(val);
    if (val.trim().length >= 2) {
      const q = val.toLowerCase();
      setSearchSuggestions((data || []).filter(v =>
        getName(v).toLowerCase().includes(q) ||
        (v.companyName || "").toLowerCase().includes(q) ||
        (v.email || "").toLowerCase().includes(q) ||
        (v.phone || "").toLowerCase().includes(q) ||
        getCode(v).toLowerCase().includes(q)
      ).slice(0, 8));
    } else setSearchSuggestions([]);
  };
  const handleClearSearch    = () => { setSearchTerm(""); setSearchSuggestions([]); };
  const handleSuggestionClick = v => { setSelectedItem(v); setActiveTab("overview"); setSearchTerm(""); setSearchSuggestions([]); setIsSearchFocused(false); };

  useEffect(() => {
    const h = e => { if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchSuggestions([]); setIsSearchFocused(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleExport = () => {
    if (!data?.length) { alert("No vendors to export"); return; }
    const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows   = data.map(v => ({ Code: getCode(v), Name: getName(v), Company: v.companyName || "", Email: v.email || "", Phone: v.phone || "", Status: v.status || "active" }));
    const csv    = [Object.keys(rows[0]), ...rows.map(r => Object.values(r))].map(r => r.map(escape).join(",")).join("\n");
    const a      = document.createElement("a");
    a.href       = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download   = `vendors_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg }}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <div style={{ width: "36px", height: "36px", border: `3px solid ${T.border}`, borderTopColor: T.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ color: T.textSec, fontSize: "13px", fontFamily: "DM Sans, sans-serif" }}>Loading vendors…</span>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: "20px", color: T.red, background: T.redDim, borderRadius: "12px", margin: "24px", border: `1px solid rgba(239,68,68,0.2)`, fontFamily: "DM Sans, sans-serif" }}>
      Error: {error}
    </div>
  );

  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx   = Math.min(currentPage * itemsPerPage, filteredItems.length);
  const card     = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", transition: "background 0.25s ease, border-color 0.25s ease" };

  return (
    <>
      <style>{css}</style>
      <div className="vnd-root" style={{ background: T.bg, display: "flex", height: "calc(100vh - 56px)", overflow: "hidden", color: T.textPri }}>

        {/* ── LEFT LIST PANEL ── */}
        <div style={{ flex: selectedItem ? "0 0 44%" : "1", overflowY: "auto", padding: "20px", minWidth: 0, transition: "flex 0.3s ease", borderRight: selectedItem ? `1px solid ${T.border}` : "none" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h1 className="vnd-jakarta" style={{ fontSize: "18px", fontWeight: "700", color: T.textPri, margin: 0 }}>Vendors</h1>
              {!selectedItem && <p style={{ color: T.textSec, fontSize: "12px", marginTop: "3px" }}>Manage your supplier relationships</p>}
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { label: "Refresh", icon: <FaSync size={11} />,    onClick: loadVendors },
                { label: "Import",  icon: <FaFileImport size={11} />, onClick: () => setShowImport(true) },
                ...(canExport ? [{ label: "Export",  icon: <FaDownload size={11} />, onClick: handleExport }] : []),
              ].map(btn => (
                <button key={btn.label} title={btn.label} onClick={btn.onClick}
                  style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: `1px solid ${T.border}`, background: "transparent", color: T.textSec, cursor: "pointer" }}>
                  {btn.icon}
                </button>
              ))}
              <button onClick={() => navigate("/Purchase/Vendors/NewVendor")}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px", border: "none", background: T.blue, color: "white", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                <FaPlus size={10} /> {selectedItem ? "New" : "New Vendor"}
              </button>
            </div>
          </div>

          <CsvImportModal
            open={showImport}
            onClose={() => setShowImport(false)}
            onComplete={loadVendors}
            title="Import Vendors"
            fields={VENDOR_IMPORT_FIELDS}
            endpoint="/api/vendors/import"
            payloadKey="vendors"
          />

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: selectedItem ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: "12px", marginBottom: "16px" }}>
            {[
              { label: "Total Vendors", value: stats.total, icon: <FaStore />, color: T.blue, dim: T.blueDim, sub: `${stats.active} active · ${stats.pending} pending`, bar: null },
              { label: "Active",  value: stats.active,  icon: <FaCheckCircle />, color: T.green,  dim: T.greenDim, sub: stats.total ? `${Math.round((stats.active  / stats.total) * 100)}% of total` : "—", bar: stats.total ? (stats.active  / stats.total) * 100 : 0, barColor: T.green  },
              { label: "Pending", value: stats.pending, icon: <FaClock />,       color: T.amber,  dim: T.amberDim, sub: stats.total ? `${Math.round((stats.pending / stats.total) * 100)}% of total` : "—", bar: stats.total ? (stats.pending / stats.total) * 100 : 0, barColor: T.amber  },
              { label: "Total Payables", value: `AED ${stats.payables.toLocaleString()}`, icon: <FaFileInvoiceDollar />, color: T.purple, dim: T.purpleDim, small: true, sub: `Avg AED ${stats.total ? Math.round(stats.payables / stats.total).toLocaleString() : 0} / vendor`, bar: null },
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

          {/* Toolbar */}
          <div style={{ ...card, padding: "12px 16px", marginBottom: "12px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Search */}
              <div ref={searchRef} style={{ position: "relative", flex: 1, minWidth: "240px" }}>
                <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: "11px", pointerEvents: "none" }} />
                <input type="text" value={searchTerm} onChange={handleSearchInput}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Search by name, email, phone, code…"
                  style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "13px", background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit", transition: "border-color 0.15s" }} />
                {searchTerm && (
                  <button onClick={handleClearSearch}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, display: "flex", padding: 0 }}>
                    <FaTimes size={11} />
                  </button>
                )}
                {isSearchFocused && searchSuggestions.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px", boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, overflow: "hidden" }}>
                    <div style={{ padding: "8px 14px 6px", fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em" }}>{searchSuggestions.length} results</div>
                    {searchSuggestions.map((v, idx) => {
                      const [bg, fg] = getAvatar(getName(v));
                      return (
                        <div key={v._id || idx} className="vnd-suggestion" onClick={() => handleSuggestionClick(v)}
                          style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderTop: `1px solid ${T.border}` }}>
                          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>
                            {getName(v).charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: "13px", fontWeight: "600", color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getName(v)}</p>
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
                  options={[{ label: "Name", value: "name" }, { label: "Company", value: "company" }, { label: "Date", value: "date" }, { label: "Payables", value: "payables" }]}
                  minWidth={130} />
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

          {/* Vendor list */}
          <div style={{ ...card, overflow: "hidden", marginBottom: "12px" }}>
            {currentItems.length > 0 ? currentItems.map((v, idx) => {
              const [avBg, avFg] = getAvatar(getName(v));
              const sc         = statusCfg[v.status] || statusCfg.active;
              const isSelected = selectedItem?._id === v._id;
              const payable    = parseFloat(v.outstandingPayable || 0);
              const name       = getName(v);
              const ws         = name.trim().split(/\s+/).filter(Boolean);
              const ini        = ws.length >= 2 ? (ws[0][0] + ws[ws.length - 1][0]).toUpperCase() : (ws[0] || "V").slice(0, 2).toUpperCase();
              const sub        = [v.companyName && v.companyName !== "N/A" ? v.companyName : null, v.email && v.email !== "N/A" ? v.email : null].filter(Boolean).join(" · ") || (v.phone || "No contact info");
              return (
                <div key={v._id || idx} onClick={() => handleItemClick(v)}
                  style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 16px", cursor: "pointer", borderBottom: idx < currentItems.length - 1 ? `1px solid ${T.border2 || T.border}` : "none", borderLeft: `3px solid ${isSelected ? T.blue : "transparent"}`, background: isSelected ? (isDark ? "rgba(59,130,246,0.07)" : "#eff6ff") : "transparent", transition: "background 0.1s" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.03)" : "#f8fafc"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                  {/* Avatar */}
                  <div style={{ width: "40px", height: "40px", borderRadius: "11px", flexShrink: 0, background: `linear-gradient(140deg, ${avFg}, ${avBg})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800", color: "#fff", fontFamily: "'Sora', sans-serif", letterSpacing: "-0.01em", boxShadow: `0 2px 8px ${avFg}30` }}>
                    {ini}
                  </div>
                  {/* Name + subtitle */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                      <span className="vnd-name" style={{ fontSize: "13px", fontWeight: "600", color: isSelected ? T.blueLight : T.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      <span style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", color: T.blueLight, background: T.blueDim, padding: "1px 6px", borderRadius: "4px", border: `1px solid rgba(59,130,246,0.15)`, flexShrink: 0 }}>{getCode(v)}</span>
                    </div>
                    <p style={{ fontSize: "11px", color: T.textSec, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>
                  </div>
                  {/* Status + payables */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                    {v.status && (
                      <span style={{ fontSize: "10px", fontWeight: "600", background: sc.bg, color: sc.color, padding: "2px 8px", borderRadius: "999px", border: `1px solid ${sc.border}`, lineHeight: 1.4 }}>{v.status}</span>
                    )}
                    {payable > 0 && (
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#ef4444", fontFamily: "'DM Mono', monospace" }}>
                        AED {payable.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div style={{ padding: "56px 20px", textAlign: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: T.textMuted || T.textSec }}>
                    <FaBoxOpen />
                  </div>
                  <p className="vnd-jakarta" style={{ fontWeight: "600", color: T.textPri, fontSize: "14px", margin: 0 }}>No vendors found</p>
                  <p style={{ color: T.textSec, fontSize: "12px", margin: 0 }}>{selectedStatus !== "all" ? `No vendors with status "${selectedStatus}"` : "Start by adding your first vendor"}</p>
                  <button onClick={() => navigate("/Purchase/Vendors/NewVendor")}
                    style={{ marginTop: "4px", padding: "7px 18px", background: T.blue, color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                    Add Vendor
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredItems.length > 0 && (
            <div style={{ ...card, padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: T.textSec }}>Showing {startIdx}–{endIdx} of {filteredItems.length}</span>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                  style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "12px", color: currentPage === 1 ? T.textMuted : T.textSec, cursor: currentPage === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                  <FaChevronLeft size={10} /> Prev
                </button>
                {getPageNums().map((p, i) =>
                  p === "..." ? (
                    <span key={`e${i}`} style={{ padding: "5px 8px", color: T.textSec, fontSize: "12px" }}>…</span>
                  ) : (
                    <button key={p} onClick={() => handlePageChange(p)} className="vnd-page-btn"
                      style={{ padding: "5px 10px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${currentPage === p ? "rgba(59,130,246,0.35)" : T.border}`, background: currentPage === p ? T.blueDim : "transparent", color: currentPage === p ? T.blueLight : T.textSec, transition: "all 0.12s" }}>
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                  style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "12px", color: currentPage === totalPages ? T.textMuted : T.textSec, cursor: currentPage === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                  Next <FaChevronRight size={10} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: T.textSec }}>Per page:</span>
                <CustomSelect value={itemsPerPage} onChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
                  options={[5, 10, 20, 50, 100].map(n => ({ label: String(n), value: n }))} minWidth={72} />
              </div>
            </div>
          )}
        </div>{/* end left panel */}

        {/* ── RIGHT DETAIL PANEL ── */}
        {selectedItem && (() => {
          const v            = selectedItem;
          const [avBg, avFg] = getAvatar(getName(v));
          const sc           = statusCfg[v.status] || statusCfg.active;
          const code         = getCode(v);
          const name         = getName(v);
          const hasEmail     = v.email && v.email !== "N/A";
          const hasPhone     = v.phone && v.phone !== "N/A";
          const payable         = parseFloat(v.outstandingPayable || 0);
          const creditAvailable = parseFloat(v.creditAvailable || 0);
          const billCount    = txData.bills?.length || 0;
          const poCount      = txData.purchaseOrders?.length || 0;

          const words2    = name.trim().split(/\s+/).filter(Boolean);
          const initials2 = words2.length >= 2 ? (words2[0][0] + words2[words2.length - 1][0]).toUpperCase() : (words2[0] || "V").slice(0, 2).toUpperCase();

          const pill = s => {
            const colors = { draft: { bg: T.surface2, fg: T.textSec }, confirmed: { bg: isDark ? "rgba(16,185,129,0.1)" : "#f0fdf4", fg: "#10b981" }, received: { bg: isDark ? "rgba(16,185,129,0.1)" : "#f0fdf4", fg: "#10b981" }, approved: { bg: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff", fg: T.blue }, paid: { bg: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff", fg: T.blue }, unpaid: { bg: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", fg: "#ef4444" }, partial: { bg: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb", fg: "#f59e0b" }, sent: { bg: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb", fg: "#f59e0b" } };
            const c = colors[s?.toLowerCase()] || colors.draft;
            return <span style={{ fontSize: "10px", fontWeight: "600", padding: "2px 8px", borderRadius: "99px", background: c.bg, color: c.fg }}>{s || "—"}</span>;
          };

          return (
            <div style={{ flex: "1", display: "flex", flexDirection: "column", overflow: "hidden", background: isDark ? "#0b1120" : "#f8fafc" }}>

              {/* Hero */}
              <div style={{ background: isDark ? T.surface : "#fff", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                {/* Top bar */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 18px 14px" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, flexShrink: 0, background: `linear-gradient(140deg, ${avFg}, ${avBg})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Sora', sans-serif", letterSpacing: "-0.02em", boxShadow: `0 4px 12px ${avFg}40` }}>
                    {initials2}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: "-0.02em", fontFamily: "'Sora', sans-serif" }}>{name}</h3>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, lineHeight: 1.5 }}>{v.status || "active"}</span>
                      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.textMuted || T.textSec }}>#{code}</span>
                    </div>
                    {v.companyName && v.companyName !== "N/A" && (
                      <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 2px" }}>{v.companyName}{v.city ? <span style={{ color: T.textMuted || T.textSec }}> · {v.city}</span> : null}</p>
                    )}
                    {v.category && <p style={{ fontSize: 11, color: T.textMuted || T.textSec, margin: 0 }}>{v.category}</p>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => navigate(`/Purchase/Vendors/Edit/${v._id}`)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", fontSize: 12, fontWeight: 600, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                      <FaEdit size={10} /> Edit
                    </button>
                    <button onClick={closePanel}
                      style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textSec, cursor: "pointer" }}>
                      <FaTimes size={11} />
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6, padding: "0 18px 14px", flexWrap: "wrap" }}>
                  {hasPhone && (
                    <a href={`tel:${v.phone}`} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.textSec, textDecoration: "none" }}>
                      <FaPhone size={10} /> Call
                    </a>
                  )}
                  {hasEmail && (
                    <a href={`mailto:${v.email}`} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.textSec, textDecoration: "none" }}>
                      <FaEnvelope size={10} /> Email
                    </a>
                  )}
                  <button onClick={() => navigate(`/Purchase/Purchaseorders/New?vendor=${v._id}`)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, border: "none", background: T.blue, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                    <FaPlus size={10} /> New PO
                  </button>
                  <button onClick={() => navigate(`/Purchase/Vendors/Edit/${v._id}`)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", fontSize: 12, fontWeight: 500, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                    <FaExternalLinkAlt size={9} /> Open record
                  </button>
                </div>

                {/* 4 stat chips */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", borderTop: `1px solid ${T.border}` }}>
                  {[
                    { label: "OUTSTANDING", value: payable > 0 ? `AED ${payable.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—", sub: payable > 0 ? "Open payables" : "No open payables", color: payable > 0 ? "#ef4444" : T.textMuted || T.textSec },
                    { label: "CREDIT AVAILABLE", value: creditAvailable > 0 ? `AED ${creditAvailable.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—", sub: creditAvailable > 0 ? "Unused vendor credits" : "No credits", color: creditAvailable > 0 ? "#8b5cf6" : T.textMuted || T.textSec },
                    { label: "PURCHASE ORDERS", value: String(poCount), sub: `${billCount} bill${billCount !== 1 ? "s" : ""}`, color: T.blueLight },
                    { label: "BILLS", value: String(billCount), sub: txData.bills?.[0]?.dueDate ? `Last due: ${fmtDate(txData.bills[0].dueDate)}` : "—", color: T.textPri },
                    { label: "VENDOR SINCE", value: v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-AE", { month: "short", year: "numeric" }) : "—", sub: v.paymentTerms || "", color: T.textPri },
                  ].map((chip, i) => (
                    <div key={i} style={{ padding: "12px 14px", borderRight: i < 4 ? `1px solid ${T.border}` : "none" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 5px" }}>{chip.label}</p>
                      <p style={{ fontSize: 15, fontWeight: 800, color: chip.color, margin: 0, lineHeight: 1, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chip.value}</p>
                      <p style={{ fontSize: 10, color: T.textSec, margin: "4px 0 0" }}>{chip.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Tab bar */}
                <div style={{ display: "flex", borderTop: `1px solid ${T.border}`, padding: "0 6px", overflowX: "auto" }}>
                  {[
                    { id: "overview",  label: "Overview" },
                    { id: "purchases", label: `Purchases${poCount ? ` ${poCount}` : ""}` },
                    { id: "history",   label: "History" },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                      padding: "10px 12px", border: "none", background: "transparent",
                      fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 500,
                      color: activeTab === tab.id ? T.blueLight : T.textSec,
                      cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      borderBottom: `2px solid ${activeTab === tab.id ? T.blue : "transparent"}`,
                      transition: "color 0.15s, border-color 0.15s",
                    }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* ── Overview ── */}
                  {activeTab === "overview" && (
                    <>
                      {/* Contact cards */}
                      {(hasEmail || hasPhone) && (
                        <div style={{ display: "grid", gridTemplateColumns: hasEmail && hasPhone ? "1fr 1fr" : "1fr", gap: 8 }}>
                          {hasEmail && (
                            <a href={`mailto:${v.email}`} style={{ textDecoration: "none" }}>
                              <div style={{ background: isDark ? T.surface : "#fff", border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "all 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.35)"; e.currentTarget.style.background = isDark ? T.surface2 : "#eff6ff"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = isDark ? T.surface : "#fff"; }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.blueDim, color: T.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}><FaEnvelope /></div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: 10, color: T.textMuted || T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Email</p>
                                  <p style={{ fontSize: 12, color: T.textPri, fontWeight: 600, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.email}</p>
                                </div>
                              </div>
                            </a>
                          )}
                          {hasPhone && (
                            <a href={`tel:${v.phone}`} style={{ textDecoration: "none" }}>
                              <div style={{ background: isDark ? T.surface : "#fff", border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "all 0.15s" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; e.currentTarget.style.background = isDark ? T.surface2 : "#f0fdf4"; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = isDark ? T.surface : "#fff"; }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.greenDim, color: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}><FaPhone /></div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ fontSize: 10, color: T.textMuted || T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Phone</p>
                                  <p style={{ fontSize: 12, color: T.textPri, fontWeight: 600, margin: "2px 0 0" }}>{v.phone}</p>
                                </div>
                              </div>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Outstanding payables hero */}
                      <div style={{ background: isDark ? T.surface : "#fff", border: `1px solid ${payable > 0 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`, borderRadius: 14, padding: "18px 20px", position: "relative" }}>
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "14px 14px 0 0", background: payable > 0 ? "linear-gradient(90deg,#ef4444,#f87171,transparent)" : "linear-gradient(90deg,#10b981,#34d399,transparent)" }} />
                        <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Outstanding Payables</p>
                        <p style={{ fontSize: 28, fontWeight: 800, color: payable > 0 ? "#ef4444" : "#10b981", margin: "0 0 4px", letterSpacing: "-0.02em", fontFamily: "'DM Mono', monospace" }}>
                          {fmtMoney(payable)}
                        </p>
                        <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>
                          {payable > 0 ? `Across ${billCount} bill${billCount !== 1 ? "s" : ""}` : "All bills settled"}
                        </p>
                      </div>

                      {/* Info rows */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { icon: <FaBuilding />, label: "Company",      value: v.companyName           },
                          { icon: <FaGlobe />,    label: "Website",      value: v.website               },
                          { icon: <FaTag />,      label: "Category",     value: v.category              },
                          { icon: <FaIdCard />,   label: "TRN / Tax ID", value: v.taxNumber || v.trn    },
                          { icon: <FaTruck />,    label: "Lead Time",    value: v.leadTime ? `${v.leadTime} days` : null },
                        ].filter(r => r.value).map(({ icon, label, value }) => (
                          <div key={label} className="vnd-detail-row"
                            style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: T.surface2, borderRadius: 10, border: `1px solid ${T.border}` }}>
                            <div style={{ color: T.textSec, fontSize: 12, flexShrink: 0, width: 16, display: "flex", justifyContent: "center" }}>{icon}</div>
                            <span style={{ fontSize: 12, color: T.textSec, fontWeight: 500, minWidth: 90, flexShrink: 0 }}>{label}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri, marginLeft: "auto", textAlign: "right" }}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Address */}
                      {(v.address || v.city || v.country) && (
                        <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "13px 14px" }}>
                          <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Address</p>
                          <p style={{ fontSize: 13, color: T.textPri, margin: 0, lineHeight: 1.6 }}>
                            {[v.address, v.city, v.state, v.country, v.postalCode].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      )}

                      {/* Financials */}
                      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ padding: "11px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: T.textPri, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Financials</p>
                        </div>
                        {[
                          { label: "Outstanding Payables", value: fmtMoney(payable), red: payable > 0 },
                          { label: "Credit Limit",  value: v.creditLimit ? fmtMoney(v.creditLimit) : "—" },
                          { label: "Payment Terms", value: v.paymentTerms || "—" },
                          { label: "Currency",      value: v.currency || "AED" },
                        ].map(({ label, value, red }) => (
                          <div key={label} className="vnd-fin-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                            <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: red ? "#ef4444" : T.textPri }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── Purchases ── */}
                  {activeTab === "purchases" && (() => {
                    const SectionHeader = ({ title, count }) => (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 6px" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{title}</p>
                        <span style={{ fontSize: 10, background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, padding: "1px 7px", borderRadius: "99px" }}>{count}</span>
                      </div>
                    );
                    return (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: T.textSec, fontWeight: 500 }}>Outstanding Payables</span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: payable > 0 ? "#ef4444" : T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmtMoney(payable)}</span>
                        </div>
                        {txLoading ? (
                          <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                            <div style={{ width: 24, height: 24, border: `2px solid ${T.border}`, borderTopColor: T.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                          </div>
                        ) : (
                          <>
                            {[
                              { title: "Purchase Orders", items: txData.purchaseOrders, keyFn: po => po.orderNumber || po.poNumber || "PO", dateFn: po => po.createdAt, amtFn: po => po.total, statusFn: po => po.status },
                              { title: "Goods Receipts (GRN)", items: txData.grns, keyFn: g => g.grnNumber || "GRN", dateFn: g => g.receiptDate || g.createdAt, amtFn: g => g.total, statusFn: g => g.status },
                              { title: "Bills", items: txData.bills, keyFn: b => b.billNumber || "Bill", dateFn: b => `Due: ${fmtDate(b.dueDate)}`, amtFn: b => b.totals?.grandTotal || b.total, statusFn: b => b.status },
                              { title: "Payments Made", items: txData.payments, keyFn: p => p.paymentNumber || p.referenceNumber || "Payment", dateFn: p => p.paymentDate || p.createdAt, amtFn: p => p.amount, statusFn: () => null, green: true },
                            ].map(({ title, items, keyFn, dateFn, amtFn, statusFn, green }) => (
                              <div key={title}>
                                <SectionHeader title={title} count={items?.length || 0} />
                                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                                  {items?.length > 0 ? (
                                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                      {items.map((item, i, arr) => (
                                        <div key={item._id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                          <div>
                                            <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0 }}>{keyFn(item)}</p>
                                            <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0" }}>{typeof dateFn(item) === "string" && dateFn(item).startsWith("Due:") ? dateFn(item) : fmtDate(dateFn(item))}</p>
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {statusFn(item) && pill(statusFn(item))}
                                            <span style={{ fontSize: 12, fontWeight: 700, color: green ? "#10b981" : T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmtMoney(amtFn(item))}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p style={{ fontSize: 12, color: T.textSec, padding: "12px", margin: 0 }}>No {title.toLowerCase()} yet.</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── History ── */}
                  {activeTab === "history" && (() => {
                    const history = [...(v.history || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    const actionLabel = {
                      po_created:     { label: "PO Created",   color: T.blue,    dim: T.blueDim    },
                      grn_received:   { label: "GRN Received", color: "#10b981", dim: isDark ? "rgba(16,185,129,0.12)" : "#f0fdf4" },
                      bill_created:   { label: "Bill Created", color: "#f59e0b", dim: isDark ? "rgba(245,158,11,0.12)" : "#fffbeb" },
                      payment_made:   { label: "Payment Made", color: "#10b981", dim: isDark ? "rgba(16,185,129,0.12)" : "#f0fdf4" },
                      credit_received: { label: "Credit Received", color: "#8b5cf6", dim: isDark ? "rgba(139,92,246,0.12)" : "#faf5ff" },
                      credit_applied:  { label: "Credit Applied",  color: T.blue,   dim: T.blueDim    },
                      credit_voided:   { label: "Credit Voided",   color: "#ef4444", dim: isDark ? "rgba(239,68,68,0.12)" : "#fef2f2" },
                    };
                    if (history.length === 0) return (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 13, background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: T.textSec }}><FaClock /></div>
                        <p style={{ fontWeight: 700, color: T.textPri, fontSize: 14, margin: 0, fontFamily: "'Sora', sans-serif" }}>No history yet</p>
                        <p style={{ color: T.textSec, fontSize: 12, margin: 0 }}>Activity will appear here once recorded.</p>
                      </div>
                    );
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {history.map((entry, i) => {
                          const cfg = actionLabel[entry.action] || { label: entry.action, color: T.textSec, dim: T.surface2 };
                          const ts  = entry.timestamp ? new Date(entry.timestamp) : null;
                          return (
                            <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 16, position: "relative" }}>
                              {i < history.length - 1 && <div style={{ position: "absolute", left: 14, top: 28, bottom: 0, width: 1, background: T.border }} />}
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: cfg.dim, border: `2px solid ${cfg.color}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: "99px", background: cfg.dim, color: cfg.color }}>{cfg.label}</span>
                                  {ts && <span style={{ fontSize: 10, color: T.textSec, flexShrink: 0 }}>{ts.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                                </div>
                                <p style={{ fontSize: 12, color: T.textSec, margin: 0, lineHeight: 1.5 }}>{entry.details}</p>
                                {entry.user && <p style={{ fontSize: 10, color: T.textMuted || T.textSec, margin: "2px 0 0" }}>by {entry.user}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
};

export default Vendors;
