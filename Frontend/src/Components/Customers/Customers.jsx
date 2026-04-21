import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FaPlus, FaTimes, FaSearch, FaUser, FaBuilding,
  FaEnvelope, FaPhone, FaDownload, FaUpload,
  FaUsers, FaCheckCircle, FaClock, FaCreditCard,
  FaChevronLeft, FaChevronRight, FaBoxOpen, FaEdit,
  FaSortAmountDown, FaSortAmountUp, FaExternalLinkAlt, FaCalendarAlt
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetCustomers from "../../helper/useGetCustomers";
import useWebSocket from "../../helper/useWebSocket";
import debounce from "lodash/debounce";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";



// ─── CustomSelect — portal-based, theme-aware ────────────────────
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

const Customers = () => {
  const { handleGetCustomers, data, loading, error } = useGetCustomers();
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);

  // ── Avatar palettes — reactive to theme ──────────────────────────
  const AVATAR_PALETTES = [
    [T.blueDim,   T.blueLight],
    [T.greenDim,  T.green],
    [T.amberDim,  T.amber],
    [isDark ? "rgba(236,72,153,0.12)" : "#fce7f3", "#f472b6"],
    [T.purpleDim, T.purple],
    [T.cyanDim,   T.cyan],
  ];

  // ── Dynamic CSS ───────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');

    .cust-root * { box-sizing: border-box; }
    .cust-root { font-family: 'Inter', sans-serif; transition: background 0.25s ease, color 0.25s ease; }
    .cust-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }

    .stat-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: ${isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.1)"} !important;
    }

    .cust-row { transition: background 0.12s; }
    .cust-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .cust-row:hover .row-name { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .action-btn { transition: all 0.15s; }
    .action-btn:hover { opacity: 0.85; transform: translateY(-1px); }

    .filter-pill { transition: all 0.15s; cursor: pointer; }
    .filter-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .filter-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }

    .tbl-btn { transition: all 0.12s; }
    .tbl-btn:hover { background: ${isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9"} !important; color: ${isDark ? "#e2e8f0" : "#0f172a"} !important; }

    .page-btn { transition: all 0.12s; }
    .page-btn:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .suggestion-row { transition: background 0.1s; cursor: pointer; }
    .suggestion-row:hover { background: ${isDark ? "rgba(59,130,246,0.06)" : "#eff6ff"} !important; }

    .drawer-tab { transition: all 0.15s; border-bottom: 2px solid transparent; }
    .drawer-tab:hover { color: ${isDark ? "#94a3b8" : "#374151"} !important; }
    .drawer-tab-active { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-bottom-color: ${isDark ? "#3b82f6" : "#2563eb"} !important; }

    .detail-row { transition: background 0.1s; }
    .detail-row:hover { background: ${isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"} !important; }

    .approve-btn { transition: all 0.12s; }
    .approve-btn:hover { filter: brightness(${isDark ? "1.2" : "0.94"}); }

    .sort-select option { background: ${T.surface2}; color: ${T.textPri}; }
    .per-page-select option { background: ${T.surface2}; color: ${T.textPri}; }

    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes spin    { to { transform: rotate(360deg); } }
    @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

    .drawer-anim  { animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .overlay-anim { animation: fadeIn 0.2s ease forwards; }
    .fade-up      { animation: fadeUp 0.3s ease forwards; }
  `;

  const [isDrawerOpen, setIsDrawerOpen]       = useState(false);
  const [selectedItem, setSelectedItem]       = useState(null);
  const [activeTab, setActiveTab]             = useState("overview");
  const [custInvoices, setCustInvoices]         = useState([]);
  const [txnLoading,   setTxnLoading]           = useState(false);
  const [invoiceMap,   setInvoiceMap]           = useState({});
  const [searchTerm, setSearchTerm]           = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [selectedStatus, setSelectedStatus]   = useState("all");
  const [sortBy, setSortBy]                   = useState("name");
  const [sortOrder, setSortOrder]             = useState("asc");
  const [currentPage, setCurrentPage]         = useState(1);
  const [itemsPerPage, setItemsPerPage]       = useState(10);
  const [totalPages, setTotalPages]           = useState(1);
  const searchRef = useRef(null);

  // ── helpers ──────────────────────────────────────────────────────
  const getStats = () => {
    if (!data) return { total: 0, active: 0, pending: 0, receivables: 0 };
    const receivables = Object.values(invoiceMap).reduce((s, v) => s + v.receivables, 0);
    return {
      total:       data.length,
      active:      data.filter(i => (i.status || "active") === "active").length,
      pending:     data.filter(i => (i.status || "active") === "pending").length,
      receivables,
    };
  };
  const stats = getStats();

  const getCode = (item) => {
    if (item.customerCode) return item.customerCode;
    const initials = (item.customerDisplayName || "").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3);
    return `${initials}${(item._id || "0000").slice(-4).toUpperCase()}`;
  };

  const getAvatar = (name) => AVATAR_PALETTES[(name || "").charCodeAt(0) % AVATAR_PALETTES.length];

  const getFilteredSorted = () => {
    if (!data) return [];
    let list = [...data];
    if (selectedStatus !== "all") list = list.filter(i => (i.status || "active").toLowerCase() === selectedStatus);
    list.sort((a, b) => {
      const key = sortBy;
      let av = key === "date" ? new Date(a.createdAt || 0) : (key === "receivables" ? (invoiceMap[a._id]?.receivables || 0) : (a[key === "name" ? "customerDisplayName" : "companyName"] || "").toLowerCase());
      let bv = key === "date" ? new Date(b.createdAt || 0) : (key === "receivables" ? (invoiceMap[b._id]?.receivables || 0) : (b[key === "name" ? "customerDisplayName" : "companyName"] || "").toLowerCase());
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

  const handlePageChange = (p) => {
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

  const handleItemClick = (item) => { setSelectedItem(item); setIsDrawerOpen(true); setActiveTab("overview"); };
  const closeDrawer     = () => { setIsDrawerOpen(false); setSelectedItem(null); };

  const handleSearchChange = useCallback(debounce(() => {}, 300), []);
  const handleSearchInput  = (e) => {
    const v = e.target.value;
    setSearchTerm(v);
    handleSearchChange(v);
    if (v.trim().length >= 2) {
      const t = v.toLowerCase();
      setSearchSuggestions((data || []).filter(i =>
        (i.customerDisplayName || "").toLowerCase().includes(t) ||
        (i.companyName || "").toLowerCase().includes(t) ||
        (i.customerEmail || "").toLowerCase().includes(t) ||
        (i.customerPhone || "").toLowerCase().includes(t) ||
        (getCode(i) || "").toLowerCase().includes(t)
      ).slice(0, 8));
    } else setSearchSuggestions([]);
  };
  const handleClearSearch = () => { setSearchTerm(""); setSearchSuggestions([]); };

  const handleSuggestionClick = (item) => {
    setSelectedItem(item); setIsDrawerOpen(true); setActiveTab("overview");
    setSearchTerm(""); setSearchSuggestions([]); setIsSearchFocused(false);
  };

  useEffect(() => {
    const h = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchSuggestions([]); setIsSearchFocused(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleExport = () => {
    if (!data?.length) { alert("No customers to export"); return; }
    const rows = data.map(i => ({ Code: getCode(i), Name: i.customerDisplayName || "", Company: i.companyName || "", Email: i.customerEmail || "", Phone: i.customerPhone || "", Status: i.status || "active" }));
    const csv  = Object.keys(rows[0]).join(",") + "\n" + rows.map(r => Object.values(r).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `customers_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  useEffect(() => { handleGetCustomers(); }, [handleGetCustomers]);

  useEffect(() => {
    axiosInstance.get("/api/invoices?limit=500")
      .then(res => {
        const map = {};
        (res.data?.data?.invoices || []).forEach(inv => {
          const cid = inv.customerId;
          if (!cid) return;
          if (!map[cid]) map[cid] = { receivables: 0, total: 0, lastDate: null };
          map[cid].total += 1;
          if (inv.status !== "paid" && inv.status !== "void") {
            map[cid].receivables += inv.totals?.grandTotal ?? 0;
          }
          const d = inv.issueDate || inv.createdAt;
          if (d && (!map[cid].lastDate || d > map[cid].lastDate)) map[cid].lastDate = d;
        });
        setInvoiceMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab !== "transactions" || !selectedItem?._id) return;
    setTxnLoading(true);
    axiosInstance.get(`/api/invoices?customerId=${selectedItem._id}&limit=100`)
      .then(res => setCustInvoices(res.data?.data?.invoices || []))
      .catch(() => setCustInvoices([]))
      .finally(() => setTxnLoading(false));
  }, [activeTab, selectedItem]);

  useWebSocket((event) => {
    if (event.type === "customers_updated") handleGetCustomers();
  });

  // ── status badge config ───────────────────────────────────────────
  const statusCfg = {
    active:   { bg: T.greenDim,  color: T.green,  border: isDark ? "rgba(16,185,129,0.25)"  : "#86efac"  },
    pending:  { bg: T.amberDim,  color: T.amber,  border: isDark ? "rgba(245,158,11,0.25)"  : "#fcd34d"  },
    inactive: { bg: isDark ? T.textMuted + "33" : "#f1f5f9", color: T.textSec, border: isDark ? "rgba(100,116,139,0.2)" : "#cbd5e1" },
  };

  // ── loading / error ───────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg, transition: "background 0.25s ease" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: "36px", height: "36px", border: `3px solid ${T.border}`, borderTopColor: T.blue, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ color: T.textSec, fontSize: "13px", fontFamily: "Inter, sans-serif" }}>Loading customers…</span>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: "20px", color: T.red, background: T.redDim, borderRadius: "12px", margin: "24px", border: `1px solid rgba(239,68,68,0.2)`, fontFamily: "Inter, sans-serif" }}>
      Error: {error}
    </div>
  );

  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx   = Math.min(currentPage * itemsPerPage, filteredItems.length);

  // ── shared card style ─────────────────────────────────────────────
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", transition: "background 0.25s ease, border-color 0.25s ease" };

  return (
    <>
      <style>{css}</style>

      <div className="cust-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <div className="fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h1 className="cust-jakarta" style={{ fontSize: "20px", fontWeight: "700", color: T.textPri, margin: 0 }}>Customers</h1>
            <p style={{ color: T.textSec, fontSize: "13px", marginTop: "4px" }}>Manage and track your customer relationships</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { label: "Export", icon: <FaDownload size={11} />, onClick: handleExport, variant: "ghost" },
              { label: "Import", icon: <FaUpload size={11} />,   onClick: () => {},     variant: "ghost" },
              { label: "New Customer", icon: <FaPlus size={11} />, onClick: () => navigate("/Sales/Customers/Newcustomers"), variant: "primary" },
            ].map((btn) => (
              <button key={btn.label} className="action-btn" onClick={btn.onClick}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: "500",
                  cursor: "pointer", fontFamily: "inherit",
                  background: btn.variant === "primary" ? T.blue : "transparent",
                  color:      btn.variant === "primary" ? "white" : T.textSec,
                  border:     btn.variant === "primary" ? "none" : `1px solid ${T.border}`,
                }}>
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── STAT CARDS — Option A: Insight Cards ────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" }}>
          {[
            {
              label: "Total Customers", value: stats.total,
              icon: <FaUsers />, color: T.blue, dim: T.blueDim,
              sub: `${stats.active} active · ${stats.pending} pending`,
              bar: null,
            },
            {
              label: "Active", value: stats.active,
              icon: <FaCheckCircle />, color: T.green, dim: T.greenDim,
              sub: stats.total ? `${Math.round((stats.active / stats.total) * 100)}% of total` : "—",
              bar: stats.total ? (stats.active / stats.total) * 100 : 0,
              barColor: T.green,
            },
            {
              label: "Pending", value: stats.pending,
              icon: <FaClock />, color: T.amber, dim: T.amberDim,
              sub: stats.total ? `${Math.round((stats.pending / stats.total) * 100)}% of total` : "—",
              bar: stats.total ? (stats.pending / stats.total) * 100 : 0,
              barColor: T.amber,
            },
            {
              label: "Total Receivables", value: `AED ${stats.receivables.toLocaleString()}`,
              icon: <FaCreditCard />, color: T.purple, dim: T.purpleDim, small: true,
              sub: `Avg AED ${stats.total ? Math.round(stats.receivables / stats.total).toLocaleString() : 0} / customer`,
              bar: null,
            },
          ].map((c, i) => (
            <div key={i} className="stat-card"
              style={{ ...card, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              {/* Top glow line */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px",
                background: `linear-gradient(90deg, transparent 10%, ${c.color}${isDark ? "55" : "70"}, transparent 90%)` }} />

              {/* Label + icon row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <p style={{ fontSize: "11px", color: T.textSec, fontWeight: "600", margin: 0,
                  textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.label}</p>
                <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: c.dim,
                  color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>
                  {c.icon}
                </div>
              </div>

              {/* Value */}
              <p className="cust-jakarta" style={{ fontSize: c.small ? "17px" : "26px", fontWeight: "800",
                color: T.textPri, margin: "0 0 10px", lineHeight: 1 }}>{c.value}</p>

              {/* Progress bar for active / pending */}
              {c.bar !== null && c.bar !== undefined && (
                <div style={{ height: "3px", background: isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0",
                  borderRadius: "999px", marginBottom: "8px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.bar}%`, background: c.barColor,
                    borderRadius: "999px", transition: "width 0.8s ease" }} />
                </div>
              )}

              {/* Sub-label */}
              <p style={{ fontSize: "11px", color: T.textSec, margin: 0, fontWeight: "500" }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── TOOLBAR ─────────────────────────────────────────────── */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: "12px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>

            {/* Search */}
            <div ref={searchRef} style={{ position: "relative", flex: 1, minWidth: "240px" }}>
              <FaSearch style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: "11px", pointerEvents: "none" }} />
              <input type="text" value={searchTerm} onChange={handleSearchInput}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search by name, email, phone, code…"
                style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "13px", background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.target.style.borderColor = T.borderFoc}
                onMouseLeave={e => !isSearchFocused && (e.target.style.borderColor = T.border)}
              />
              {searchTerm && (
                <button onClick={handleClearSearch}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, display: "flex", padding: 0 }}>
                  <FaTimes size={11} />
                </button>
              )}

              {/* Suggestions dropdown */}
              {isSearchFocused && searchSuggestions.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px", boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, overflow: "hidden" }}>
                  <div style={{ padding: "8px 14px 6px", fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.08em" }}>{searchSuggestions.length} results</div>
                  {searchSuggestions.map((item, idx) => {
                    const [bg, fg] = getAvatar(item.customerDisplayName);
                    return (
                      <div key={item._id || idx} className="suggestion-row" onClick={() => handleSuggestionClick(item)}
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderTop: `1px solid ${T.border2}` }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 }}>
                          {(item.customerDisplayName || "U").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: "600", color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.customerDisplayName || "Unnamed"}</p>
                          <p style={{ fontSize: "11px", color: T.textSec, margin: 0 }}>{item.customerEmail || item.companyName || ""}</p>
                        </div>
                        <span style={{ fontSize: "10px", fontWeight: "600", fontFamily: "monospace", background: T.blueDim, color: T.blueLight, padding: "2px 8px", borderRadius: "5px", border: `1px solid rgba(59,130,246,0.2)` }}>
                          {getCode(item)}
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
                  className={`filter-pill${selectedStatus === s ? " filter-pill-active" : ""}`}
                  style={{ padding: "6px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: "500", background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit", cursor: "pointer" }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div style={{ display: "flex", gap: "6px" }}>
              <CustomSelect
                value={sortBy}
                onChange={v => { setSortBy(v); setCurrentPage(1); }}
                options={[
                  { label: "Name",        value: "name"        },
                  { label: "Company",     value: "company"     },
                  { label: "Date",        value: "date"        },
                  { label: "Receivables", value: "receivables" },
                ]}
                minWidth={130}
              />
              <button onClick={() => { setSortOrder(o => o === "asc" ? "desc" : "asc"); setCurrentPage(1); }}
                style={{ padding: "6px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: T.surface2, color: T.textSec, cursor: "pointer", display: "flex", alignItems: "center" }}>
                {sortOrder === "asc" ? <FaSortAmountDown size={12} /> : <FaSortAmountUp size={12} />}
              </button>
            </div>

            <span style={{ fontSize: "12px", color: T.textSec, marginLeft: "auto", whiteSpace: "nowrap" }}>
              {filteredItems.length} customer{filteredItems.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* ── TABLE ───────────────────────────────────────────────── */}
        <div style={{ ...card, overflow: "hidden", marginBottom: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                <th style={{ padding: "11px 16px", width: "32px" }}>
                  <input type="checkbox" style={{ accentColor: T.blue }} />
                </th>
                {["Customer", "Company", "Contact", "Description", "Receivables", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i === 4 ? "right" : "left", fontSize: "11px", fontWeight: "600", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? currentItems.map((item, idx) => {
                const [avBg, avFg] = getAvatar(item.customerDisplayName);
                const sc = statusCfg[item.status] || statusCfg.active;
                return (
                  <tr key={item._id || idx} className="cust-row" style={{ borderBottom: `1px solid ${T.border2}` }}>
                    <td style={{ padding: "13px 16px" }}><input type="checkbox" style={{ accentColor: T.blue }} /></td>

                    {/* Name + code + status */}
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                        <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: avBg, color: avFg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
                          {(item.customerDisplayName || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span className="row-name" onClick={() => handleItemClick(item)}
                              style={{ fontWeight: "600", color: T.textPri, cursor: "pointer", transition: "color 0.15s", fontSize: "13px" }}>
                              {item.customerDisplayName || "Unnamed"}
                            </span>
                            <span style={{ fontSize: "10px", fontFamily: "monospace", background: T.blueDim, color: T.blueLight, padding: "2px 7px", borderRadius: "5px", border: `1px solid rgba(59,130,246,0.2)` }}>
                              {getCode(item)}
                            </span>
                            {item.status && (
                              <span style={{ fontSize: "10px", fontWeight: "600", background: sc.bg, color: sc.color, padding: "2px 8px", borderRadius: "999px", border: `1px solid ${sc.border}` }}>
                                {item.status}
                              </span>
                            )}
                          </div>
                          {item.companyName && item.companyName !== "N/A" && (
                            <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0" }}>{item.companyName}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td style={{ padding: "13px 16px", color: T.textSec, fontSize: "12px" }}>
                      {item.companyName && item.companyName !== "N/A" ? item.companyName : <span style={{ color: T.textMuted }}>—</span>}
                    </td>

                    {/* Contact */}
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {item.customerEmail && item.customerEmail !== "N/A" && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: T.textSec, fontSize: "12px" }}>
                            <FaEnvelope style={{ color: T.textMuted, fontSize: "10px" }} />{item.customerEmail}
                          </div>
                        )}
                        {item.customerPhone && item.customerPhone !== "N/A" && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: T.textSec, fontSize: "12px" }}>
                            <FaPhone style={{ color: T.textMuted, fontSize: "10px" }} />{item.customerPhone}
                          </div>
                        )}
                        {!item.customerEmail && !item.customerPhone && <span style={{ color: T.textMuted }}>—</span>}
                      </div>
                    </td>

                    {/* Description */}
                    <td style={{ padding: "13px 16px", maxWidth: "180px" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "12px", color: T.textSec }}>
                        {item.sales_description || <span style={{ color: T.textMuted }}>—</span>}
                      </div>
                    </td>

                    {/* Receivables */}
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      {invoiceMap[item._id]?.receivables > 0
                        ? <span className="cust-jakarta" style={{ fontWeight: "600", color: T.amber, fontSize: "13px" }}>
                            AED {invoiceMap[item._id].receivables.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        : <span style={{ color: T.textMuted }}>—</span>}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "13px 12px" }}>
                      <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                        <button className="tbl-btn" onClick={() => handleItemClick(item)}
                          style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "11px", color: T.textSec, cursor: "pointer", fontFamily: "inherit", fontWeight: "500" }}>
                          View
                        </button>
                        <button className="tbl-btn" onClick={() => navigate(`/sales/customers/edit/${item._id}`)}
                          style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", fontSize: "11px", color: T.textSec, cursor: "pointer", fontFamily: "inherit", fontWeight: "500", display: "flex", alignItems: "center", gap: "4px" }}>
                          <FaEdit size={10} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="7" style={{ padding: "64px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: T.textMuted }}>
                        <FaBoxOpen />
                      </div>
                      <p className="cust-jakarta" style={{ fontWeight: "600", color: T.textPri, fontSize: "15px", margin: 0 }}>No customers found</p>
                      <p style={{ color: T.textSec, fontSize: "13px", margin: 0 }}>
                        {selectedStatus !== "all" ? `No customers with status "${selectedStatus}"` : "Start by adding your first customer"}
                      </p>
                      <button onClick={() => navigate("/Sales/Customers/Newcustomers")}
                        style={{ marginTop: "4px", padding: "8px 20px", background: T.blue, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                        Add Customer
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ──────────────────────────────────────────── */}
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
                  <button key={p} onClick={() => handlePageChange(p)} className="page-btn"
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
              <CustomSelect
                value={itemsPerPage}
                onChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1); }}
                options={[5, 10, 20, 50, 100].map(n => ({ label: String(n), value: n }))}
                minWidth={72}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── DRAWER ──────────────────────────────────────────────── */}
      {isDrawerOpen && selectedItem && (() => {
        const [avBg, avFg] = getAvatar(selectedItem.customerDisplayName);
        const sc   = statusCfg[selectedItem.status] || statusCfg.active;
        const code = getCode(selectedItem);
        const hasEmail = selectedItem.customerEmail && selectedItem.customerEmail !== "N/A";
        const hasPhone = selectedItem.customerPhone && selectedItem.customerPhone !== "N/A";

        return (
          <>
            {/* Backdrop */}
            <div className="overlay-anim" onClick={closeDrawer}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />

            {/* Panel */}
            <div className="drawer-anim"
              style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "520px", maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

              {/* ── Header ── */}
              <div style={{ position: "relative", padding: "24px 24px 0", borderBottom: `1px solid ${T.border}` }}>
                {/* Accent strip */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px",
                  background: `linear-gradient(90deg, ${avFg}88, ${avFg}22, transparent)` }} />

                {/* Close */}
                <button onClick={closeDrawer}
                  style={{ position: "absolute", top: "16px", right: "18px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "6px", cursor: "pointer", color: T.textSec, display: "flex" }}>
                  <FaTimes size={12} />
                </button>

                {/* Avatar + identity */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "18px" }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: avBg, color: avFg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "800", flexShrink: 0 }}>
                    {(selectedItem.customerDisplayName || "U").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: "36px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "5px" }}>
                      <h3 className="cust-jakarta" style={{ fontSize: "16px", fontWeight: "700", color: T.textPri, margin: 0 }}>
                        {selectedItem.customerDisplayName || "Customer"}
                      </h3>
                      <span style={{ fontSize: "10px", fontFamily: "monospace", background: T.blueDim, color: T.blueLight, padding: "2px 8px", borderRadius: "5px", border: `1px solid rgba(59,130,246,0.2)`, flexShrink: 0 }}>
                        {code}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {selectedItem.companyName && selectedItem.companyName !== "N/A" && (
                        <span style={{ fontSize: "12px", color: T.textSec, display: "flex", alignItems: "center", gap: "4px" }}>
                          <FaBuilding size={10} /> {selectedItem.companyName}
                        </span>
                      )}
                      {selectedItem.status && (
                        <span style={{ fontSize: "10px", fontWeight: "600", background: sc.bg, color: sc.color, padding: "2px 9px", borderRadius: "999px", border: `1px solid ${sc.border}` }}>
                          {selectedItem.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick action buttons */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
                  {hasEmail && (
                    <a href={`mailto:${selectedItem.customerEmail}`}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "12px", fontWeight: "500", color: T.textSec, cursor: "pointer", textDecoration: "none" }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.blueDim; e.currentTarget.style.color = T.blueLight; e.currentTarget.style.borderColor = "rgba(59,130,246,0.3)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = T.surface2; e.currentTarget.style.color = T.textSec; e.currentTarget.style.borderColor = T.border; }}>
                      <FaEnvelope size={11} /> Email
                    </a>
                  )}
                  {hasPhone && (
                    <a href={`tel:${selectedItem.customerPhone}`}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "12px", fontWeight: "500", color: T.textSec, cursor: "pointer", textDecoration: "none" }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.greenDim; e.currentTarget.style.color = T.green; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = T.surface2; e.currentTarget.style.color = T.textSec; e.currentTarget.style.borderColor = T.border; }}>
                      <FaPhone size={11} /> Call
                    </a>
                  )}
                  <button onClick={() => navigate(`/sales/customers/edit/${selectedItem._id}`)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", background: T.blue, border: "none", borderRadius: "9px", fontSize: "12px", fontWeight: "500", color: "white", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
                    onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}>
                    <FaEdit size={11} /> Edit
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex" }}>
                  {["overview", "contacts", "financials", "transactions"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`drawer-tab${activeTab === tab ? " drawer-tab-active" : ""}`}
                      style={{ padding: "9px 18px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "500", fontFamily: "inherit", color: T.textSec, textTransform: "capitalize" }}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Body ── */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

                {activeTab === "overview" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Contact info */}
                    {(hasEmail || hasPhone) && (
                      <div>
                        <p style={{ fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Contact Information</p>
                        <div style={{ background: T.surface2, borderRadius: "12px", border: `1px solid ${T.border2}`, overflow: "hidden" }}>
                          {hasEmail && (
                            <div className="detail-row" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderBottom: hasPhone ? `1px solid ${T.border2}` : "none" }}>
                              <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: T.blueDim, color: T.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", flexShrink: 0 }}>
                                <FaEnvelope />
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Email</p>
                                <p style={{ fontSize: "13px", color: T.textPri, margin: "2px 0 0", fontWeight: "500" }}>{selectedItem.customerEmail}</p>
                              </div>
                              <a href={`mailto:${selectedItem.customerEmail}`} style={{ color: T.textMuted, display: "flex" }}>
                                <FaExternalLinkAlt size={10} />
                              </a>
                            </div>
                          )}
                          {hasPhone && (
                            <div className="detail-row" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px" }}>
                              <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: T.greenDim, color: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", flexShrink: 0 }}>
                                <FaPhone />
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Phone</p>
                                <p style={{ fontSize: "13px", color: T.textPri, margin: "2px 0 0", fontWeight: "500" }}>{selectedItem.customerPhone}</p>
                              </div>
                              <a href={`tel:${selectedItem.customerPhone}`} style={{ color: T.textMuted, display: "flex" }}>
                                <FaExternalLinkAlt size={10} />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Financial snapshot — 2×2 grid */}
                    <div>
                      <p style={{ fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Financial Snapshot</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {[
                          { label: "Outstanding",    value: (invoiceMap[selectedItem._id]?.receivables > 0) ? `AED ${invoiceMap[selectedItem._id].receivables.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "AED 0.00", color: T.amber,  dim: T.amberDim,  icon: <FaCreditCard /> },
                          { label: "Total Invoices", value: invoiceMap[selectedItem._id]?.total > 0 ? String(invoiceMap[selectedItem._id].total) : "0",           color: T.blue,   dim: T.blueDim,   icon: <FaBoxOpen /> },
                          { label: "Last Invoice",   value: invoiceMap[selectedItem._id]?.lastDate ? new Date(invoiceMap[selectedItem._id].lastDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—", color: T.purple, dim: T.purpleDim, icon: <FaClock /> },
                          { label: "Customer Since", value: selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—", color: T.green, dim: T.greenDim, icon: <FaCalendarAlt /> },
                        ].map((stat, i) => (
                          <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: "11px", padding: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: stat.dim, color: stat.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>
                              {stat.icon}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{stat.label}</p>
                              <p className="cust-jakarta" style={{ fontSize: "14px", fontWeight: "700", color: T.textPri, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stat.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Description / Notes */}
                    {selectedItem.sales_description && (
                      <div>
                        <p style={{ fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Notes</p>
                        <div style={{ background: T.surface2, borderRadius: "12px", border: `1px solid ${T.border2}`, padding: "14px 16px" }}>
                          <p style={{ fontSize: "13px", color: T.textSec, margin: 0, lineHeight: 1.65 }}>{selectedItem.sales_description}</p>
                        </div>
                      </div>
                    )}

                    {/* Meta details */}
                    <div>
                      <p style={{ fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Details</p>
                      <div style={{ background: T.surface2, borderRadius: "12px", border: `1px solid ${T.border2}`, overflow: "hidden" }}>
                        {[
                          { label: "Customer Code", value: code,                                 mono: false },
                          { label: "Customer ID",   value: selectedItem._id || "N/A",            mono: true  },
                          ...(selectedItem.currency    ? [{ label: "Currency",       value: selectedItem.currency,    mono: false }] : []),
                          ...(selectedItem.paymentTerms ? [{ label: "Payment Terms", value: selectedItem.paymentTerms, mono: false }] : []),
                        ].map(({ label, value, mono }, i, arr) => (
                          <div key={i} className="detail-row"
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none" }}>
                            <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500", flexShrink: 0 }}>{label}</span>
                            <span style={{ fontSize: mono ? "11px" : "12px", color: T.textPri, fontWeight: "600", fontFamily: mono ? "monospace" : "inherit", textAlign: "right", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "contacts" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "260px", gap: "12px" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: T.textMuted }}>
                      <FaUser />
                    </div>
                    <p className="cust-jakarta" style={{ fontWeight: "600", color: T.textPri, fontSize: "14px", margin: 0 }}>No contact persons</p>
                    <p style={{ color: T.textSec, fontSize: "12px", margin: 0, textAlign: "center" }}>Contact persons can be added when editing this customer.</p>
                    <button onClick={() => navigate(`/sales/customers/edit/${selectedItem._id}`)}
                      style={{ padding: "7px 16px", background: T.blueDim, color: T.blueLight, border: `1px solid rgba(59,130,246,0.25)`, borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                      Edit Customer
                    </button>
                  </div>
                )}

                {activeTab === "financials" && (() => {
                  const outstanding  = invoiceMap[selectedItem._id]?.receivables || 0;
                  const taxBase      = outstanding;
                  const taxAmt       = Math.round(taxBase * 0.05 * 100) / 100;
                  const grandTotal   = Math.round((taxBase + taxAmt) * 100) / 100;
                  const fmt = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                      {/* Summary rows */}
                      <div style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: "12px", overflow: "hidden" }}>
                        {[
                          { label: "Outstanding Receivables", value: fmt(outstanding), color: outstanding > 0 ? "#ef4444" : T.textPri },
                          { label: "Payment Terms",           value: selectedItem.paymentTerms || "—" },
                          { label: "Currency",                value: selectedItem.currency || "AED" },
                        ].map(({ label, value, color }, i, arr) => (
                          <div key={i} className="detail-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border2}` : "none" }}>
                            <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500" }}>{label}</span>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: color || T.textPri }}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* VAT Breakdown */}
                      <div>
                        <p style={{ fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Tax Breakdown</p>
                        <div style={{ background: isDark ? "rgba(245,158,11,0.06)" : "#fffbeb", border: `1.5px solid ${isDark ? "rgba(245,158,11,0.2)" : "#fde68a"}`, borderRadius: "12px", padding: "12px 16px" }}>
                          <p style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: ".07em", color: "#f59e0b", margin: "0 0 10px" }}>VAT 5% — Grouped by Rate</p>
                          {outstanding > 0 ? (
                            <>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                                <div>
                                  <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>Receivables Amount</p>
                                  <p style={{ fontSize: "10px", color: T.textSec, margin: "1px 0 0", fontFamily: "monospace" }}>{fmt(taxBase)} × 5%</p>
                                </div>
                                <span style={{ fontSize: "13px", fontWeight: "700", color: "#f59e0b", fontFamily: "monospace" }}>{fmt(taxAmt)}</span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1.5px solid ${isDark ? "rgba(245,158,11,0.25)" : "#fcd34d"}`, marginTop: "8px", paddingTop: "8px" }}>
                                <span style={{ fontSize: "11px", fontWeight: "700", color: "#f59e0b" }}>Total VAT (5%)</span>
                                <span style={{ fontSize: "13px", fontWeight: "800", color: "#f59e0b", fontFamily: "monospace" }}>{fmt(taxAmt)}</span>
                              </div>
                            </>
                          ) : (
                            <p style={{ fontSize: "12px", color: T.textSec, margin: 0 }}>No outstanding receivables to calculate tax on.</p>
                          )}
                        </div>
                      </div>

                      {/* Grand Total */}
                      {outstanding > 0 && (
                        <div style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: "12px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="cust-jakarta" style={{ fontSize: "14px", fontWeight: "700", color: T.textPri }}>Grand Total (incl. VAT)</span>
                          <span className="cust-jakarta" style={{ fontSize: "17px", fontWeight: "800", color: T.blue, fontFamily: "monospace" }}>{fmt(grandTotal)}</span>
                        </div>
                      )}

                      <p style={{ fontSize: "11px", color: T.textMuted, margin: 0, textAlign: "center" }}>Full invoice history will appear once orders are created.</p>
                    </div>
                  );
                })()}

                {activeTab === "transactions" && (() => {
                  const STATUS_COLORS = {
                    paid:    { text: "#10b981", bg: "rgba(16,185,129,.12)",  border: "rgba(16,185,129,.3)"  },
                    unpaid:  { text: "#f59e0b", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.3)"  },
                    overdue: { text: "#ef4444", bg: "rgba(239,68,68,.12)",   border: "rgba(239,68,68,.3)"   },
                    partial: { text: "#3b82f6", bg: "rgba(59,130,246,.12)",  border: "rgba(59,130,246,.3)"  },
                    draft:   { text: "#94a3b8", bg: "rgba(100,116,139,.12)", border: "rgba(100,116,139,.3)" },
                    void:    { text: "#94a3b8", bg: "rgba(100,116,139,.12)", border: "rgba(100,116,139,.3)" },
                  };
                  const fmtAmt = (n) => `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const fmtD   = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                  return (
                    <div>
                      {txnLoading ? (
                        <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted, fontSize: 13 }}>Loading…</div>
                      ) : custInvoices.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "48px 0" }}>
                          <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
                          <p style={{ color: T.textPri, fontWeight: 600, fontSize: 14, margin: "0 0 4px" }}>No invoices yet</p>
                          <p style={{ color: T.textMuted, fontSize: 12, margin: 0 }}>Invoices issued to this customer will appear here.</p>
                        </div>
                      ) : (
                        <div style={{ background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: 12, overflow: "hidden" }}>
                          {/* Table header */}
                          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 90px", gap: 0, padding: "8px 14px", borderBottom: `1px solid ${T.border2}` }}>
                            {["Date", "Invoice #", "Amount", "Balance Due", "Status"].map(h => (
                              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</span>
                            ))}
                          </div>
                          {custInvoices.map((inv, i) => {
                            const sc = STATUS_COLORS[inv.status] || STATUS_COLORS.draft;
                            const amt = inv.totals?.grandTotal ?? 0;
                            return (
                              <div key={inv._id || i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.2fr 1fr 1fr 90px", gap: 0, padding: "10px 14px", borderBottom: i < custInvoices.length - 1 ? `1px solid ${T.border2}` : "none", alignItems: "center" }}>
                                <span style={{ fontSize: 12, color: T.textSec }}>{fmtD(inv.issueDate || inv.createdAt)}</span>
                                <span style={{ fontSize: 12, color: T.blueLight, fontWeight: 600, fontFamily: "monospace" }}>{inv.invoiceNumber || "—"}</span>
                                <span style={{ fontSize: 12, color: T.textPri, fontFamily: "monospace" }}>{fmtAmt(amt)}</span>
                                <span style={{ fontSize: 12, color: T.textPri, fontFamily: "monospace" }}>{fmtAmt(amt)}</span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, textTransform: "capitalize", width: "fit-content" }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.text, flexShrink: 0 }} />
                                  {inv.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── Footer ── */}
              <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "8px" }}>
                <button onClick={() => navigate(`/sales/customers/edit/${selectedItem._id}`)}
                  style={{ flex: 1, padding: "10px", background: T.blue, color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
                  <FaEdit size={12} /> Edit Customer
                </button>
                <button onClick={closeDrawer}
                  style={{ flex: 1, padding: "10px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                  Close
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </>
  );
};

export default Customers;