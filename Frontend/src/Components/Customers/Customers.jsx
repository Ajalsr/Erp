import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FaPlus, FaTimes, FaSearch, FaUser, FaBuilding,
  FaEnvelope, FaPhone, FaDownload,
  FaUsers, FaCheckCircle, FaClock, FaCreditCard,
  FaChevronLeft, FaChevronRight, FaBoxOpen, FaEdit,
  FaSortAmountDown, FaSortAmountUp, FaExternalLinkAlt, FaCalendarAlt, FaSync, FaEye, FaFileImport
} from "react-icons/fa";
import CsvImportModal from "../common/CsvImportModal";

const CUSTOMER_IMPORT_FIELDS = [
  { key: "customerDisplayName", label: "Display Name", aliases: ["name", "customer name", "display name"], required: false },
  { key: "companyName",         label: "Company",      aliases: ["company", "company name"] },
  { key: "customerEmail",       label: "Email",        aliases: ["email", "e-mail"] },
  { key: "customerPhone",       label: "Phone",        aliases: ["phone", "telephone"] },
  { key: "mobile",              label: "Mobile",       aliases: ["mobile", "cell"] },
  { key: "streetAddress",       label: "Address",      aliases: ["address", "street", "street address"] },
  { key: "city",                label: "City",         aliases: ["city"] },
  { key: "country",             label: "Country",      aliases: ["country"] },
];
import { useNavigate } from "react-router-dom";
import useGetCustomers from "../../helper/useGetCustomers";
import useWebSocket from "../../helper/useWebSocket";
import debounce from "lodash/debounce";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";



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
      overflow: "hidden", fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
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
        fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
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
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');

    .cust-root * { box-sizing: border-box; }
    .cust-root { font-family: 'DM Sans', sans-serif; transition: background 0.25s ease, color 0.25s ease; }
    .cust-jakarta { font-family: 'Sora', sans-serif; }

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

  const [selectedItem, setSelectedItem]       = useState(null);
  const [activeTab, setActiveTab]             = useState("overview");
  const [previewDoc,  setPreviewDoc]          = useState(null);
  const [custInvoices,  setCustInvoices]         = useState([]);
  const [custPayments,  setCustPayments]         = useState([]);
  const [txnLoading,    setTxnLoading]           = useState(false);
  const [invoiceMap,   setInvoiceMap]           = useState({});
  const [creditStatus, setCreditStatus]          = useState(null);
  const [customerCNs,  setCustomerCNs]           = useState([]);
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

  const handleItemClick = (item) => { setSelectedItem(item); setActiveTab("overview"); };
  const closeDrawer     = () => setSelectedItem(null);

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
    setSelectedItem(item); setActiveTab("overview");
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
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv  = Object.keys(rows[0]).map(escape).join(",") + "\n" + rows.map(r => Object.values(r).map(escape).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `customers_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const handleDocDownload = useCallback(async (url, name) => {
    if (!url) return;
    // Fetch through the backend proxy as a blob and save to disk via a hidden anchor.
    // octet-stream forces a download (no inline open / no blank browser tab).
    try {
      const res  = await axiosInstance.get(
        `/api/documents/proxy?url=${encodeURIComponent(url)}`,
        { responseType: "blob" }
      );
      const blob = res.data;
      if (!blob || blob.size === 0) throw new Error("empty");
      const objectUrl = URL.createObjectURL(new Blob([blob], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name || "document";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      nexusToast.success("Downloaded");
    } catch {
      nexusToast.error("Download failed");
    }
  }, []);

  const loadInvoiceMap = useCallback(() => {
    axiosInstance.get("/api/invoices?limit=500")
      .then(res => {
        const map = {};
        (res.data?.data?.invoices || []).forEach(inv => {
          const cid = inv.customerId;
          if (!cid) return;
          if (!map[cid]) map[cid] = { receivables: 0, includedVat: 0, subtotalDue: 0, total: 0, lastDate: null };
          map[cid].total += 1;
          if (inv.status !== "paid" && inv.status !== "void") {
            const grandTotal = inv.totals?.grandTotal ?? 0;
            const taxTotal   = inv.totals?.taxTotal   ?? 0;
            const subtotal   = inv.totals?.subtotal   ?? 0;
            const balance    = Math.max(0, inv.balanceDue ?? (grandTotal - (inv.amountPaid ?? 0)));
            const ratio      = grandTotal > 0 ? balance / grandTotal : 1;
            map[cid].receivables  += balance;
            map[cid].includedVat  += taxTotal  * ratio;
            map[cid].subtotalDue  += subtotal  * ratio;
          }
          const d = inv.issueDate || inv.createdAt;
          if (d && (!map[cid].lastDate || d > map[cid].lastDate)) map[cid].lastDate = d;
        });
        setInvoiceMap(map);
      })
      .catch(() => {});
  }, []);

  const [showImport, setShowImport] = useState(false);

  const handleRefresh = useCallback(() => {
    handleGetCustomers();
    loadInvoiceMap();
  }, [handleGetCustomers, loadInvoiceMap]);

  useEffect(() => { handleRefresh(); }, [handleRefresh]);

  // Keep selectedItem in sync when the list re-fetches (e.g. after document upload)
  useEffect(() => {
    if (!selectedItem?._id || !data?.length) return;
    const updated = data.find(c => c._id === selectedItem._id);
    if (updated) setSelectedItem(updated);
  }, [data]);

  useWebSocket((event) => {
    if (event.type === "customers_updated") handleRefresh();
  });

  useEffect(() => {
    if (!["transactions", "statement"].includes(activeTab) || !selectedItem?._id) return;
    setTxnLoading(true);
    Promise.allSettled([
      axiosInstance.get(`/api/invoices?customerId=${selectedItem._id}&limit=100`),
      axiosInstance.get(`/api/payments/?customerId=${selectedItem._id}&limit=100`),
      axiosInstance.get(`/api/credit-notes?customerId=${selectedItem._id}`),
    ]).then(([invRes, pmtRes, cnRes]) => {
      setCustInvoices(invRes.status === "fulfilled" ? invRes.value.data?.data?.invoices || [] : []);
      setCustPayments(pmtRes.status === "fulfilled" ? pmtRes.value.data?.data?.payments || [] : []);
      setCustomerCNs(cnRes.status === "fulfilled" ? cnRes.value.data?.data || [] : []);
    }).finally(() => setTxnLoading(false));
  }, [activeTab, selectedItem]);

  useEffect(() => {
    if (!selectedItem?._id) { setCreditStatus(null); return; }
    axiosInstance.get(`/api/customers/${selectedItem._id}/credit-status`)
      .then(r => setCreditStatus(r.data?.data || null))
      .catch(() => setCreditStatus(null));
  }, [selectedItem?._id]);

  useEffect(() => {
    if (!selectedItem?._id) { setCustomerCNs([]); return; }
    axiosInstance.get(`/api/credit-notes?customerId=${selectedItem._id}`)
      .then(r => setCustomerCNs(r.data?.data || []))
      .catch(() => setCustomerCNs([]));
  }, [selectedItem?._id]);

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
        <span style={{ color: T.textSec, fontSize: "13px", fontFamily: "DM Sans, sans-serif" }}>Loading customers…</span>
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

  // ── shared card style ─────────────────────────────────────────────
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", transition: "background 0.25s ease, border-color 0.25s ease" };

  return (
    <>
      <style>{css}</style>

      <div className="cust-root" style={{ background: T.bg, display: "flex", height: "calc(100vh - 56px)", overflow: "hidden", color: T.textPri }}>
        {/* ── LEFT LIST PANEL ── */}
        <div style={{ flex: selectedItem ? "0 0 44%" : "1", overflowY: "auto", padding: "20px 20px", minWidth: 0, transition: "flex 0.3s ease", borderRight: selectedItem ? `1px solid ${T.border}` : "none" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h1 className="cust-jakarta" style={{ fontSize: "18px", fontWeight: "700", color: T.textPri, margin: 0 }}>Customers</h1>
            {!selectedItem && <p style={{ color: T.textSec, fontSize: "12px", marginTop: "3px" }}>Manage your customer relationships</p>}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {[
              { label: "Refresh", icon: <FaSync size={11} />,    onClick: handleRefresh },
              { label: "Import",  icon: <FaFileImport size={11} />, onClick: () => setShowImport(true) },
              { label: "Export",  icon: <FaDownload size={11} />, onClick: handleExport },
            ].map(btn => (
              <button key={btn.label} title={btn.label} onClick={btn.onClick}
                style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", border: `1px solid ${T.border}`, background: "transparent", color: T.textSec, cursor: "pointer" }}>
                {btn.icon}
              </button>
            ))}
            <button onClick={() => navigate("/Sales/Customers/Newcustomers")}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px", border: "none", background: T.blue, color: "white", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
              <FaPlus size={10} /> {selectedItem ? "New" : "New Customer"}
            </button>
          </div>
        </div>

        <CsvImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          onComplete={handleRefresh}
          title="Import Customers"
          fields={CUSTOMER_IMPORT_FIELDS}
          endpoint="/api/customers/import"
          payloadKey="customers"
        />

        {/* ── STAT CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: selectedItem ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: "12px", marginBottom: "16px" }}>
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
                        <span style={{ fontSize: "10px", fontWeight: "600", fontFamily: "'DM Mono', monospace", background: T.blueDim, color: T.blueLight, padding: "2px 8px", borderRadius: "5px", border: `1px solid rgba(59,130,246,0.2)` }}>
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

        {/* ── CUSTOMER LIST ── */}
        <div style={{ ...card, overflow: "hidden", marginBottom: "12px" }}>
          {currentItems.length > 0 ? currentItems.map((item, idx) => {
            const [avBg, avFg] = getAvatar(item.customerDisplayName);
            const sc = statusCfg[item.status] || statusCfg.active;
            const isSelected = selectedItem?._id === item._id;
            const rec = invoiceMap[item._id]?.receivables || 0;
            const sub = [
              item.companyName && item.companyName !== "N/A" ? item.companyName : null,
              item.customerEmail && item.customerEmail !== "N/A" ? item.customerEmail : null,
            ].filter(Boolean).join(" · ") || (item.customerPhone && item.customerPhone !== "N/A" ? item.customerPhone : "No contact info");
            return (
              <div key={item._id || idx} onClick={() => handleItemClick(item)}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "11px 16px",
                  cursor: "pointer",
                  borderBottom: idx < currentItems.length - 1 ? `1px solid ${T.border2}` : "none",
                  borderLeft: `3px solid ${isSelected ? T.blue : "transparent"}`,
                  background: isSelected ? (isDark ? "rgba(59,130,246,0.07)" : "#eff6ff") : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.03)" : "#f8fafc"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Avatar */}
                {(() => {
                  const ws = (item.customerDisplayName || "U").trim().split(/\s+/).filter(Boolean);
                  const ini = ws.length >= 2 ? (ws[0][0] + ws[ws.length-1][0]).toUpperCase() : (ws[0]||"U").slice(0,2).toUpperCase();
                  return (
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "11px", flexShrink: 0,
                      background: `linear-gradient(140deg, ${avFg}, ${avBg})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px", fontWeight: "800", color: "#fff",
                      fontFamily: "'Sora', sans-serif", letterSpacing: "-0.01em",
                      boxShadow: `0 2px 8px ${avFg}30`,
                    }}>
                      {ini}
                    </div>
                  );
                })()}

                {/* Name + subtitle */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: isSelected ? T.blueLight : T.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.customerDisplayName || "Unnamed"}
                    </span>
                    <span style={{ fontSize: "10px", fontFamily: "'DM Mono', monospace", color: T.blueLight, background: T.blueDim, padding: "1px 6px", borderRadius: "4px", border: `1px solid rgba(59,130,246,0.15)`, flexShrink: 0 }}>
                      {getCode(item)}
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: T.textSec, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sub}
                  </p>
                </div>

                {/* Status + receivables */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                  {item.status && (
                    <span style={{ fontSize: "10px", fontWeight: "600", background: sc.bg, color: sc.color, padding: "2px 8px", borderRadius: "999px", border: `1px solid ${sc.border}`, lineHeight: 1.4 }}>
                      {item.status}
                    </span>
                  )}
                  {rec > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: "600", color: T.amber, fontFamily: "'DM Mono', monospace" }}>
                      AED {rec.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
              </div>
            );
          }) : (
            <div style={{ padding: "56px 20px", textAlign: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: T.textMuted }}>
                  <FaBoxOpen />
                </div>
                <p className="cust-jakarta" style={{ fontWeight: "600", color: T.textPri, fontSize: "14px", margin: 0 }}>No customers found</p>
                <p style={{ color: T.textSec, fontSize: "12px", margin: 0 }}>
                  {selectedStatus !== "all" ? `No customers with status "${selectedStatus}"` : "Start by adding your first customer"}
                </p>
                <button onClick={() => navigate("/Sales/Customers/Newcustomers")}
                  style={{ marginTop: "4px", padding: "7px 18px", background: T.blue, color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                  Add Customer
                </button>
              </div>
            </div>
          )}
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
        </div>{/* end left panel */}

      {/* ── RIGHT DETAIL PANEL ── */}
      {selectedItem && (() => {
        const [avBg, avFg] = getAvatar(selectedItem.customerDisplayName);
        const sc   = statusCfg[selectedItem.status] || statusCfg.active;
        const code = getCode(selectedItem);
        const hasEmail = selectedItem.customerEmail && selectedItem.customerEmail !== "N/A";
        const hasPhone = selectedItem.customerPhone && selectedItem.customerPhone !== "N/A";
        const invData     = invoiceMap[selectedItem._id] || {};
        const outstanding = invData.receivables || 0;
        const fmtMoney = (n) => `AED ${parseFloat(n||0).toLocaleString("en-AE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

        return (
          <div style={{
            flex: "1", display: "flex", flexDirection: "column", overflow: "hidden",
            background: isDark ? "#0b1120" : "#f8fafc",
          }}>

              {/* ── HERO ── */}
              <div style={{ background: isDark ? T.surface : "#fff", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                {(() => {
                  const words2 = (selectedItem.customerDisplayName || "?").trim().split(/\s+/).filter(Boolean);
                  const initials2 = words2.length >= 2 ? (words2[0][0] + words2[words2.length-1][0]).toUpperCase() : (words2[0] || "?").slice(0,2).toUpperCase();
                  const custSince = selectedItem.created_at ? (() => { const d = Math.floor((Date.now()-new Date(selectedItem.created_at))/(1000*60*60*24)); return d < 7 ? "This week" : d < 30 ? `${Math.floor(d/7)}w ago` : d < 365 ? `${Math.floor(d/30)} mo ago` : `${(d/365).toFixed(1)} yrs ago`; })() : null;
                  return (
                    <>
                      {/* ── Top bar ── */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 18px 14px" }}>
                        {/* Avatar */}
                        <div style={{
                          width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                          background: `linear-gradient(140deg, ${avFg}, ${avBg})`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 18, fontWeight: 800, color: "#fff",
                          fontFamily: "'Sora', sans-serif", letterSpacing: "-0.02em",
                          boxShadow: `0 4px 12px ${avFg}40`,
                        }}>
                          {initials2}
                        </div>

                        {/* Identity */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 4 }}>
                            <h3 style={{ fontSize: 17, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: "-0.02em", fontFamily: "'Sora', sans-serif" }}>
                              {selectedItem.customerDisplayName || "Customer"}
                            </h3>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, lineHeight: 1.5 }}>
                              {selectedItem.status || "active"}
                            </span>
                            <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.textMuted }}>
                              #{code}
                            </span>
                          </div>
                          {selectedItem.companyName && selectedItem.companyName !== "N/A" && (
                            <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 2px" }}>
                              {selectedItem.companyName}
                              {selectedItem.city ? <span style={{ color: T.textMuted }}> · {selectedItem.city}</span> : null}
                            </p>
                          )}
                          {custSince && <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Customer since {custSince}</p>}
                        </div>

                        {/* Top-right: Edit + Close */}
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => navigate(`/sales/customers/edit/${selectedItem._id}`)}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", fontSize: 12, fontWeight: 600, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                            <FaEdit size={10} /> Edit
                          </button>
                          <button onClick={closeDrawer}
                            style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textSec, cursor: "pointer" }}>
                            <FaTimes size={11} />
                          </button>
                        </div>
                      </div>

                      {/* ── Action buttons row ── */}
                      <div style={{ display: "flex", gap: 6, padding: "0 18px 14px", flexWrap: "wrap" }}>
                        {hasPhone && (
                          <a href={`tel:${selectedItem.customerPhone}`}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.textSec, textDecoration: "none" }}>
                            <FaPhone size={10} /> Call
                          </a>
                        )}
                        {hasEmail && (
                          <a href={`mailto:${selectedItem.customerEmail}`}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.textSec, textDecoration: "none" }}>
                            <FaEnvelope size={10} /> Email
                          </a>
                        )}
                        <button onClick={() => navigate(`/Sales/Invoices`)}
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, border: "none", background: T.blue, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                          <FaPlus size={10} /> New invoice
                        </button>
                        <button onClick={() => navigate(`/sales/customers/edit/${selectedItem._id}`)}
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", fontSize: 12, fontWeight: 500, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                          <FaExternalLinkAlt size={9} /> Open record
                        </button>
                      </div>

                      {/* ── 4 stat chips (horizontal dividers) ── */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderTop: `1px solid ${T.border}` }}>
                        {[
                          { label: "OUTSTANDING", value: outstanding > 0 ? `AED ${outstanding.toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0})}` : "—", sub: outstanding > 0 ? "Open invoices" : "No open invoices", color: outstanding > 0 ? "#ef4444" : T.textMuted },
                          { label: "LIFETIME VALUE", value: `AED ${invData.receivables ? (invData.receivables * 1.4).toLocaleString("en-AE",{minimumFractionDigits:0,maximumFractionDigits:0}) : "0"}`, sub: `${invData.total || 0} invoices`, color: T.blueLight },
                          { label: "INVOICES", value: String(invData.total || 0), sub: invData.lastDate ? `Last: ${new Date(invData.lastDate).toLocaleDateString("en-AE",{day:"2-digit",month:"short"})}` : "Last: —", color: T.textPri },
                          { label: "CUSTOMER FOR", value: selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleDateString("en-AE",{month:"short",year:"numeric"}) : "—", sub: custSince || "", color: T.textPri },
                        ].map((chip, i) => (
                          <div key={i} style={{ padding: "12px 14px", borderRight: i < 3 ? `1px solid ${T.border}` : "none" }}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 5px" }}>{chip.label}</p>
                            <p style={{ fontSize: 15, fontWeight: 800, color: chip.color, margin: 0, lineHeight: 1, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chip.value}</p>
                            <p style={{ fontSize: 10, color: T.textSec, margin: "4px 0 0" }}>{chip.sub}</p>
                          </div>
                        ))}
                      </div>

                      {/* ── Tab bar (border-bottom style) ── */}
                      <div style={{ display: "flex", borderTop: `1px solid ${T.border}`, padding: "0 6px", overflowX: "auto" }}>
                        {[
                          { id: "overview",     label: "Overview" },
                          { id: "transactions", label: `Invoices${invData.total ? ` ${invData.total}` : ""}` },
                          { id: "statement",    label: "Payments" },
                          { id: "financials",   label: "Statement" },
                          { id: "contacts",     label: "Contacts" },
                          { id: "documents",    label: `Documents${selectedItem?.documents?.length ? ` (${selectedItem.documents.length})` : ""}` },
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
                    </>
                  );
                })()}
              </div>

              {/* ── BODY ── */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

                {/* ── OVERVIEW TAB ── */}
                {activeTab === "overview" && (
                  <>
                    {/* Contact cards */}
                    {(hasEmail || hasPhone) && (
                      <div style={{ display: "grid", gridTemplateColumns: hasEmail && hasPhone ? "1fr 1fr" : "1fr", gap: 8 }}>
                        {hasEmail && (
                          <a href={`mailto:${selectedItem.customerEmail}`} style={{ textDecoration: "none" }}>
                            <div style={{
                              background: isDark ? T.surface : "#fff",
                              border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px",
                              display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                              transition: "all 0.15s", boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
                            }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.35)"; e.currentTarget.style.background = isDark ? T.surface2 : "#eff6ff"; }}
                               onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = isDark ? T.surface : "#fff"; }}>
                              <div style={{ width: 34, height: 34, borderRadius: 10, background: T.blueDim, color: T.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                                <FaEnvelope />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Email</p>
                                <p style={{ fontSize: 12, color: T.textPri, fontWeight: 600, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedItem.customerEmail}</p>
                              </div>
                            </div>
                          </a>
                        )}
                        {hasPhone && (
                          <a href={`tel:${selectedItem.customerPhone}`} style={{ textDecoration: "none" }}>
                            <div style={{
                              background: isDark ? T.surface : "#fff",
                              border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px",
                              display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                              transition: "all 0.15s", boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
                            }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; e.currentTarget.style.background = isDark ? T.surface2 : "#f0fdf4"; }}
                               onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = isDark ? T.surface : "#fff"; }}>
                              <div style={{ width: 34, height: 34, borderRadius: 10, background: T.greenDim, color: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                                <FaPhone />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Phone</p>
                                <p style={{ fontSize: 12, color: T.textPri, fontWeight: 600, margin: "2px 0 0" }}>{selectedItem.customerPhone}</p>
                              </div>
                            </div>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Outstanding hero card */}
                    <div style={{
                      background: isDark ? T.surface : "#fff",
                      border: `1px solid ${outstanding > 0 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`,
                      borderRadius: 14, padding: "18px 20px",
                      boxShadow: isDark ? "none" : "0 1px 6px rgba(0,0,0,0.05)",
                      position: "relative",
                    }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "14px 14px 0 0", background: outstanding > 0 ? "linear-gradient(90deg,#ef4444,#f87171,transparent)" : "linear-gradient(90deg,#10b981,#34d399,transparent)" }} />
                      <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Outstanding Receivables</p>
                      <p className="cust-jakarta" style={{ fontSize: 28, fontWeight: 800, color: outstanding > 0 ? "#ef4444" : "#10b981", margin: "0 0 4px", letterSpacing: "-0.02em", fontFamily: "'DM Mono', monospace" }}>
                        {fmtMoney(outstanding)}
                      </p>
                      <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>
                        {outstanding > 0 ? `Across ${invData.total || 0} invoice${invData.total !== 1 ? "s" : ""}` : "All invoices settled"}
                      </p>
                    </div>

                    {/* Unused Credits widget — from voided invoice payments */}
                    {(selectedItem.unused_credits || 0) > 0 && (
                      <div style={{
                        background: isDark ? T.surface : "#fff",
                        border: "1.5px solid rgba(16,185,129,0.3)",
                        borderRadius: 14, padding: "14px 16px",
                        boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
                        position: "relative",
                      }}>
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "14px 14px 0 0", background: "linear-gradient(90deg,#10b981,#34d399,transparent)" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px" }}>
                              Unused Credits
                            </p>
                            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 800, color: "#10b981", margin: 0 }}>
                              AED {(selectedItem.unused_credits || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p style={{ fontSize: 11, color: T.textSec, margin: "4px 0 0" }}>From voided invoice payments — apply to future invoices</p>
                          </div>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Available Credit widget */}
                    {(() => {
                      const availableCredit = customerCNs
                        .filter(cn => cn.status === "approved")
                        .reduce((s, cn) => s + (cn.totals?.grandTotal || 0), 0);
                      const creditsUsed = customerCNs
                        .filter(cn => ["applied", "closed"].includes(cn.status))
                        .reduce((s, cn) => s + (cn.totals?.grandTotal || 0), 0);
                      const pendingApproval = customerCNs
                        .filter(cn => ["draft", "pending_approval"].includes(cn.status))
                        .reduce((s, cn) => s + (cn.totals?.grandTotal || 0), 0);
                      if (customerCNs.length === 0) return null;
                      const hasCredit = availableCredit > 0;
                      const fmtAmt = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      return (
                        <div style={{
                          background: isDark ? T.surface : "#fff",
                          border: `1px solid ${hasCredit ? "rgba(59,130,246,0.3)" : T.border}`,
                          borderRadius: 14, padding: "14px 16px",
                          boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
                          position: "relative",
                        }}>
                          {/* Top accent line */}
                          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, borderRadius: "14px 14px 0 0", background: hasCredit ? "linear-gradient(90deg,#3b82f6,#60a5fa,transparent)" : `linear-gradient(90deg,${T.border},transparent)` }} />

                          {/* Header + balance on same row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                              <FaCreditCard size={10} /> Available Credit
                            </p>
                            <div style={{ textAlign: "right" }}>
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 800, color: hasCredit ? T.blueLight : T.textMuted, margin: 0, lineHeight: 1 }}>
                                {fmtAmt(availableCredit)}
                              </p>
                              <p style={{ fontSize: 10, color: T.textSec, margin: "3px 0 0" }}>
                                {hasCredit
                                  ? `${customerCNs.filter(cn => cn.status === "approved").length} CN${customerCNs.filter(cn => cn.status === "approved").length !== 1 ? "s" : ""} ready`
                                  : "no unapplied credits"}
                              </p>
                            </div>
                          </div>

                          {/* Compact 3-stat divider row */}
                          <div style={{ display: "flex", borderTop: `1px solid ${T.border}`, paddingTop: 10, gap: 0 }}>
                            {[
                              { label: "Applied",   value: creditsUsed,     color: "#10b981" },
                              { label: "Pending",   value: pendingApproval, color: "#f59e0b" },
                              { label: "Available", value: availableCredit, color: T.blueLight },
                            ].map(({ label, value, color }, i, arr) => (
                              <div key={label} style={{ flex: 1, textAlign: "center", borderRight: i < arr.length - 1 ? `1px solid ${T.border}` : "none", padding: "0 8px" }}>
                                <p style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 3px" }}>{label}</p>
                                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, color, margin: 0 }}>
                                  {fmtAmt(value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Credit limit widget */}
                    {creditStatus && creditStatus.creditLimit > 0 && (() => {
                      const pct     = Math.min(creditStatus.utilization, 100);
                      const exceeded = creditStatus.exceeded;
                      const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";
                      return (
                        <div style={{ background: isDark ? T.surface : "#fff", border: `1px solid ${exceeded ? "rgba(239,68,68,0.3)" : T.border}`, borderRadius: 14, padding: "16px 18px", boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.04)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                              <FaCreditCard size={10} /> Credit Limit
                            </p>
                            {exceeded && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 99, padding: "2px 8px" }}>
                                OVER LIMIT
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: T.textSec }}>Used: <strong style={{ color: exceeded ? "#ef4444" : T.textPri, fontFamily: "'DM Mono',monospace" }}>AED {creditStatus.creditUsed?.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
                            <span style={{ fontSize: 12, color: T.textSec }}>Limit: <strong style={{ color: T.textPri, fontFamily: "'DM Mono',monospace" }}>AED {creditStatus.creditLimit?.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
                          </div>
                          <div style={{ height: 6, background: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 99, transition: "width 0.4s ease" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
                            <span style={{ fontSize: 10, color: T.textMuted }}>Invoices: AED {creditStatus.unpaidInvoices?.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} · Orders: AED {creditStatus.openOrders?.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: barColor }}>{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Details list */}
                    <div style={{ background: isDark ? T.surface : "#fff", border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.04)" }}>
                      {[
                        { icon: "🏷️", label: "Customer Code",  value: code,                                    mono: true  },
                        { icon: "💳", label: "Payment Terms",  value: selectedItem.payment_terms || "—",        mono: false },
                        { icon: "💵", label: "Currency",       value: selectedItem.currency || "AED",          mono: false },
                        // { icon: "🔑", label: "Customer ID",    value: selectedItem._id?.slice(-8) || "N/A",    mono: true  },
                      ].map(({ icon, label, value, mono }, i, arr) => (
                        <div key={i} className="detail-row" style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "11px 16px",
                          borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                        }}>
                          <span style={{ fontSize: 12, color: T.textSec, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13 }}>{icon}</span> {label}
                          </span>
                          <span style={{ fontSize: mono ? 11 : 12, color: T.textPri, fontWeight: 600, fontFamily: mono ? "'DM Mono', monospace" : "inherit", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
                        </div>
                      ))}
                    </div>

                    {selectedItem.sales_description && (
                      <div style={{ background: isDark ? T.surface : "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 7px" }}>Notes</p>
                        <p style={{ fontSize: 13, color: T.textSec, margin: 0, lineHeight: 1.65 }}>{selectedItem.sales_description}</p>
                      </div>
                    )}
                  </>
                )}

                {/* ── FINANCIALS TAB ── */}
                {activeTab === "financials" && (() => {
                  const includedVat = invData.includedVat || 0;
                  const subtotalDue = invData.subtotalDue || 0;
                  const fmt = (n) => fmtMoney(n);

                  return (
                    <>
                      {/* Big outstanding number */}
                      <div style={{
                        background: isDark ? T.surface : "#fff", border: `1px solid ${outstanding > 0 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`,
                        borderRadius: 14, padding: "22px 20px", textAlign: "center",
                        position: "relative", overflow: "hidden",
                      }}>
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: outstanding > 0 ? "linear-gradient(90deg,#ef4444,#f87171,transparent)" : "linear-gradient(90deg,#10b981,#34d399,transparent)" }} />
                        <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 8px" }}>Outstanding Receivables</p>
                        <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", fontFamily: "'DM Mono', monospace", color: outstanding > 0 ? "#ef4444" : "#10b981", margin: "0 0 4px" }}>
                          {fmt(outstanding)}
                        </p>
                        <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>{outstanding > 0 ? "Balance due across open invoices" : "All cleared — no outstanding balance"}</p>
                      </div>

                      {/* Summary rows */}
                      <div style={{ background: isDark ? T.surface : "#fff", border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                        {[
                          { label: "Payment Terms",  value: selectedItem.payment_terms || "—" },
                          { label: "Currency",       value: selectedItem.currency || "AED" },
                          { label: "Total Invoices", value: String(invData.total || 0) },
                        ].map(({ label, value }, i, arr) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                            <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri }}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* VAT breakdown */}
                      {outstanding > 0 && (
                        <div style={{ background: isDark ? "rgba(245,158,11,0.06)" : "#fffbeb", border: `1.5px solid ${isDark ? "rgba(245,158,11,0.18)" : "#fde68a"}`, borderRadius: 14, padding: "14px 16px" }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Tax Breakdown — included in balance</p>
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0 }}>Pre-tax Amount</p>
                              <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0" }}>Before VAT</p>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmt(subtotalDue)}</span>
                          </div>
                          <div style={{ height: 1, background: isDark ? "rgba(245,158,11,0.2)" : "#fcd34d", margin: "8px 0" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", margin: 0 }}>VAT 5% (included)</p>
                              <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0" }}>Already part of outstanding</p>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>{fmt(includedVat)}</span>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* ── TRANSACTIONS TAB ── */}
                {activeTab === "transactions" && (() => {
                  const INV_STATUS = {
                    paid:    { text: "#10b981", bg: "rgba(16,185,129,.12)",  border: "rgba(16,185,129,.25)"  },
                    unpaid:  { text: "#f59e0b", bg: "rgba(245,158,11,.12)",  border: "rgba(245,158,11,.25)"  },
                    overdue: { text: "#ef4444", bg: "rgba(239,68,68,.12)",   border: "rgba(239,68,68,.25)"   },
                    partial: { text: "#3b82f6", bg: "rgba(59,130,246,.12)",  border: "rgba(59,130,246,.25)"  },
                    draft:   { text: "#94a3b8", bg: "rgba(100,116,139,.12)", border: "rgba(100,116,139,.25)" },
                    void:    { text: "#6b7280", bg: "rgba(107,114,128,.12)", border: "rgba(107,114,128,.25)" },
                  };
                  const CN_STATUS = {
                    draft:            { text: "#94a3b8", bg: "rgba(100,116,139,.12)", border: "rgba(100,116,139,.25)" },
                    pending_approval: { text: "#f59e0b", bg: "rgba(245,158,11,.12)",  border: "rgba(245,158,11,.25)"  },
                    approved:         { text: "#8b5cf6", bg: "rgba(139,92,246,.12)",  border: "rgba(139,92,246,.25)"  },
                    closed:           { text: "#10b981", bg: "rgba(16,185,129,.12)",  border: "rgba(16,185,129,.25)"  },
                    void:             { text: "#6b7280", bg: "rgba(107,114,128,.12)", border: "rgba(107,114,128,.25)" },
                  };
                  const fmtAmt = (n) => `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const fmtD   = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

                  const timeline = [
                    ...custInvoices.map(inv => ({
                      _type: "invoice", _date: new Date(inv.issueDate || inv.createdAt || 0), _id: inv._id,
                      ref: inv.invoiceNumber, amt: inv.totals?.grandTotal ?? 0,
                      balDue: Math.max(0, (inv.balanceDue ?? (inv.totals?.grandTotal ?? 0) - (inv.amountPaid ?? 0))),
                      status: inv.status,
                    })),
                    ...custPayments.map(pmt => ({
                      _type: "payment", _date: new Date(pmt.date || pmt.createdAt || 0), _id: pmt._id,
                      ref: pmt.paymentNumber, amt: pmt.amount,
                      mode: pmt.paymentMode, invoiceRef: pmt.invoiceNumber,
                      isRefunded: pmt.isRefunded, refundedAmount: pmt.refundedAmount,
                    })),
                    ...customerCNs.map(cn => ({
                      _type: "creditnote", _date: new Date(cn.updatedAt || cn.createdAt || 0), _id: cn._id,
                      ref: cn.creditNoteNumber, amt: cn.totals?.grandTotal ?? 0,
                      appliedAmount: cn.appliedAmount ?? 0, refundedAmount: cn.refundedAmount ?? 0,
                      remainingAmount: cn.remainingAmount ?? cn.totals?.grandTotal ?? 0,
                      status: cn.status, sourceDocNumber: cn.sourceDocNumber, reason: cn.reason,
                    })),
                  ].sort((a, b) => b._date - a._date);

                  if (txnLoading) return <div style={{ textAlign: "center", padding: "48px 0", color: T.textMuted, fontSize: 13 }}>Loading…</div>;

                  if (timeline.length === 0) return (
                    <div style={{ textAlign: "center", padding: "56px 20px" }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: T.textMuted, margin: "0 auto 12px" }}>📄</div>
                      <p style={{ color: T.textPri, fontWeight: 700, fontSize: 14, margin: "0 0 4px" }}>No transactions yet</p>
                      <p style={{ color: T.textMuted, fontSize: 12, margin: 0 }}>Invoices, payments and credit notes will appear here.</p>
                    </div>
                  );

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {timeline.map((row, i) => {
                        const isInv = row._type === "invoice";
                        const isCN  = row._type === "creditnote";
                        const isPmt = row._type === "payment";
                        const sc    = isInv ? (INV_STATUS[row.status] || INV_STATUS.draft) : isCN ? (CN_STATUS[row.status] || CN_STATUS.draft) : null;
                        const iconBg    = isInv ? T.blueDim : isCN ? "rgba(139,92,246,0.1)" : row.isRefunded ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)";
                        const iconColor = isInv ? T.blueLight : isCN ? "#8b5cf6" : row.isRefunded ? "#ef4444" : "#10b981";
                        const icon      = isInv ? "📄" : isCN ? "📋" : row.isRefunded ? "↩" : "💳";
                        const refColor  = isInv ? T.blueLight : isCN ? "#8b5cf6" : row.isRefunded ? "#ef4444" : "#10b981";

                        return (
                          <div key={row._id || i} className="detail-row" style={{
                            background: isDark ? T.surface : "#fff",
                            border: `1px solid ${row.isRefunded ? "rgba(239,68,68,0.2)" : T.border}`,
                            borderRadius: 12, padding: "12px 14px",
                            display: "flex", alignItems: "center", gap: 12,
                            boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
                            opacity: row.isRefunded ? 0.8 : 1,
                          }}>
                            {/* Icon */}
                            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                              {icon}
                            </div>

                            {/* Main info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: refColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.ref || "—"}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999,
                                  background: isInv ? T.blueDim : isCN ? "rgba(139,92,246,0.1)" : row.isRefunded ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                                  color: refColor,
                                  border: `1px solid ${isInv ? "rgba(59,130,246,0.2)" : isCN ? "rgba(139,92,246,0.2)" : row.isRefunded ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.2)"}`,
                                  flexShrink: 0 }}>
                                  {isInv ? "Invoice" : isCN ? "Credit Note" : row.isRefunded ? "Reversed" : "Payment"}
                                </span>
                                {isPmt && !row.isRefunded && row.mode && <span style={{ fontSize: 10, color: T.textMuted }}>{row.mode}</span>}
                                {isCN && sc && (
                                  <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, flexShrink: 0 }}>
                                    {row.status}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, color: T.textMuted }}>{fmtD(row._date)}</span>
                                {isPmt && row.invoiceRef && <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>→ {row.invoiceRef}</span>}
                                {isCN && row.sourceDocNumber && <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>→ {row.sourceDocNumber}</span>}
                                {isCN && row.reason && <span style={{ fontSize: 11, color: T.textMuted }}>{row.reason}</span>}
                              </div>
                            </div>

                            {/* Amount + status */}
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              {isInv && (
                                <>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace", margin: "0 0 3px" }}>{fmtAmt(row.amt)}</p>
                                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 11, color: row.balDue > 0 ? "#ef4444" : "#10b981", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                                      {row.balDue > 0 ? `Due ${fmtAmt(row.balDue)}` : "Settled"}
                                    </span>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, textTransform: "capitalize" }}>
                                      {row.status}
                                    </span>
                                  </div>
                                </>
                              )}
                              {isPmt && (
                                <>
                                  <p style={{ fontSize: 13, fontWeight: 800, fontFamily: "'DM Mono', monospace", margin: "0 0 3px",
                                    color: row.isRefunded ? "#ef4444" : "#10b981",
                                    textDecoration: row.isRefunded ? "line-through" : "none" }}>
                                    {row.isRefunded ? "" : "+"}{fmtAmt(row.amt)}
                                  </p>
                                  {row.isRefunded ? (
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>Reversed</span>
                                  ) : (
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981" }}>Received</span>
                                  )}
                                </>
                              )}
                              {isCN && (
                                <>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: "#8b5cf6", fontFamily: "'DM Mono', monospace", margin: "0 0 3px" }}>
                                    − {fmtAmt(row.amt)}
                                  </p>
                                  {(row.appliedAmount > 0 || row.refundedAmount > 0) && (
                                    <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.5 }}>
                                      {row.appliedAmount > 0 && <div>Applied {fmtAmt(row.appliedAmount)}</div>}
                                      {row.refundedAmount > 0 && <div>Refunded {fmtAmt(row.refundedAmount)}</div>}
                                      {row.remainingAmount > 0 && <div style={{ color: "#f59e0b" }}>Remaining {fmtAmt(row.remainingAmount)}</div>}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── STATEMENT TAB ── */}
                {activeTab === "statement" && (() => {
                  const todaySt = new Date(); todaySt.setHours(0, 0, 0, 0);
                  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                  const fmtAmt  = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                  const outstanding = custInvoices.filter(inv =>
                    !["paid", "void", "draft"].includes((inv.status || "").toLowerCase())
                  );

                  const agingBkts = [
                    { label: "Current",    color: "#10b981", items: [] },
                    { label: "1–30 days",  color: "#3b82f6", items: [] },
                    { label: "31–60 days", color: "#f59e0b", items: [] },
                    { label: "61–90 days", color: "#f97316", items: [] },
                    { label: "90+ days",   color: "#ef4444", items: [] },
                  ];
                  outstanding.forEach(inv => {
                    const due = inv.dueDate ? new Date(inv.dueDate) : null;
                    if (!due) { agingBkts[0].items.push(inv); return; }
                    due.setHours(0, 0, 0, 0);
                    const days = Math.floor((todaySt - due) / 86400000);
                    if      (days <= 0)  agingBkts[0].items.push(inv);
                    else if (days <= 30) agingBkts[1].items.push(inv);
                    else if (days <= 60) agingBkts[2].items.push(inv);
                    else if (days <= 90) agingBkts[3].items.push(inv);
                    else                 agingBkts[4].items.push(inv);
                  });

                  const totalOutstanding = outstanding.reduce((s, i) => s + (i.balanceDue ?? 0), 0);
                  const totalInvoiced   = custInvoices
                    .filter(i => !["void","draft"].includes(i.status))
                    .reduce((s, i) => s + (i.totals?.grandTotal ?? 0), 0);
                  const totalPaid = custPayments
                    .filter(p => !p.isRefunded)
                    .reduce((s, p) => s + (p.amount || 0), 0);
                  const totalReversed = custPayments
                    .filter(p => p.isRefunded)
                    .reduce((s, p) => s + (p.amount || 0), 0);

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* Header summary */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        {[
                          { label: "Total Invoiced",      value: fmtAmt(totalInvoiced),    color: T.blueLight },
                          { label: "Total Paid",           value: fmtAmt(totalPaid),         color: "#10b981",
                            sub: totalReversed > 0 ? `${fmtAmt(totalReversed)} reversed` : null },
                          { label: "Balance Outstanding",  value: fmtAmt(totalOutstanding),  color: totalOutstanding > 0 ? "#ef4444" : "#10b981" },
                        ].map((kpi, i) => (
                          <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                            <p style={{ fontSize: 10, color: T.textSec, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>{kpi.label}</p>
                            <p style={{ fontSize: 15, fontWeight: 800, color: kpi.color, margin: 0, fontFamily: "'DM Mono', monospace" }}>{kpi.value}</p>
                            {kpi.sub && <p style={{ fontSize: 10, color: "#ef4444", margin: "4px 0 0", fontFamily: "'DM Mono', monospace" }}>↩ {kpi.sub}</p>}
                          </div>
                        ))}
                      </div>

                      {/* Aging buckets */}
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Aging Summary</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {agingBkts.map((bkt, i) => {
                            const amt = bkt.items.reduce((s, inv) => s + (inv.balanceDue || inv.total || 0), 0);
                            const pct = totalOutstanding > 0 ? (amt / totalOutstanding) * 100 : 0;
                            return (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 11, color: bkt.color, fontWeight: 700, minWidth: 76 }}>{bkt.label}</span>
                                <div style={{ flex: 1, height: 6, background: T.surface2, borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${Math.min(100, pct).toFixed(1)}%`, background: bkt.color, borderRadius: 3, transition: "width 0.4s ease" }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace", minWidth: 100, textAlign: "right" }}>
                                  {fmtAmt(amt)}
                                </span>
                                <span style={{ fontSize: 10, color: T.textSec, minWidth: 30, textAlign: "right" }}>
                                  {bkt.items.length}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Invoice list */}
                      {txnLoading ? (
                        <div style={{ textAlign: "center", padding: "24px 0", color: T.textSec, fontSize: 12 }}>Loading…</div>
                      ) : outstanding.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: T.textMuted, fontSize: 13 }}>
                          <div style={{ fontSize: 26, marginBottom: 8 }}>✅</div>
                          No outstanding balance
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Outstanding Invoices</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {outstanding.map((inv, i) => {
                              const due = inv.dueDate ? new Date(inv.dueDate) : null;
                              if (due) due.setHours(0, 0, 0, 0);
                              const daysOvr = due ? Math.floor((todaySt - due) / 86400000) : 0;
                              const isOvr   = daysOvr > 0;
                              const agingColor = daysOvr > 90 ? "#ef4444" : daysOvr > 60 ? "#f97316" : daysOvr > 30 ? "#f59e0b" : daysOvr > 0 ? "#3b82f6" : "#10b981";
                              return (
                                <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: T.blueLight, fontFamily: "'DM Mono', monospace" }}>{inv.invoiceNumber || inv.id || "—"}</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: `${agingColor}18`, color: agingColor, border: `1px solid ${agingColor}30` }}>
                                        {isOvr ? `${daysOvr}d overdue` : "Current"}
                                      </span>
                                    </div>
                                    <div style={{ display: "flex", gap: 12 }}>
                                      <span style={{ fontSize: 11, color: T.textSec }}>Invoice: {fmtDate(inv.invoiceDate)}</span>
                                      <span style={{ fontSize: 11, color: isOvr ? "#ef4444" : T.textSec }}>Due: {fmtDate(inv.dueDate)}</span>
                                    </div>
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: isOvr ? "#ef4444" : T.textPri, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                                    {fmtAmt(inv.balanceDue || inv.total || 0)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Total footer */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", marginTop: 6, background: T.surface2, borderRadius: 9, border: `1px solid ${T.border}` }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: T.textSec }}>Total Outstanding</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#ef4444", fontFamily: "'DM Mono', monospace" }}>{fmtAmt(totalOutstanding)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── CONTACTS TAB ── */}
                {activeTab === "contacts" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 220, gap: 12, padding: "20px 0" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textMuted }}>
                      <FaUser />
                    </div>
                    <p className="cust-jakarta" style={{ fontWeight: 700, color: T.textPri, fontSize: 14, margin: 0 }}>No contact persons</p>
                    <p style={{ color: T.textSec, fontSize: 12, margin: 0, textAlign: "center" }}>Contact persons can be added when editing this customer.</p>
                    <button onClick={() => navigate(`/sales/customers/edit/${selectedItem._id}`)} style={{ padding: "7px 16px", background: T.blueDim, color: T.blueLight, border: `1px solid rgba(59,130,246,0.25)`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Edit Customer
                    </button>
                  </div>
                )}

                {/* ── DOCUMENTS TAB ── */}
                {activeTab === "documents" && (() => {
                  const docs = selectedItem?.documents || [];
                  const DOC_TYPE_LABELS = {
                    trade_license: "Trade License", trl_copy: "TRL Copy",
                    owners_passport: "Owner's Passport", eid_copy: "EID Copy",
                    power_of_attorney: "Power of Attorney", other: "Other",
                  };
                  const getExt = (name = "") => name.split(".").pop().toLowerCase();
                  const getIcon = (name) => {
                    const e = getExt(name);
                    if (e === "pdf") return "📄";
                    if (["jpg","jpeg","png","gif"].includes(e)) return "🖼️";
                    if (["doc","docx"].includes(e)) return "📝";
                    if (["xls","xlsx"].includes(e)) return "📊";
                    return "📎";
                  };
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Uploaded Documents ({docs.length})</p>
                        <button onClick={() => navigate(`/sales/customers/edit/${selectedItem._id}`)}
                          style={{ padding: "6px 14px", background: T.blueDim, color: T.blueLight, border: `1px solid rgba(59,130,246,0.25)`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          + Add Documents
                        </button>
                      </div>

                      {docs.length === 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 0" }}>
                          <div style={{ width: 48, height: 48, borderRadius: 13, background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📁</div>
                          <p style={{ fontWeight: 700, color: T.textPri, fontSize: 14, margin: 0 }}>No documents yet</p>
                          <p style={{ color: T.textSec, fontSize: 12, margin: 0 }}>Upload during customer edit</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {docs.map((doc, i) => (
                            <div key={doc._id || i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
                                  {getIcon(doc.name)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</p>
                                  <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0" }}>
                                    {DOC_TYPE_LABELS[doc.type] || doc.type}
                                    {doc.size ? ` · ${(doc.size / 1024).toFixed(0)} KB` : ""}
                                    {doc.uploadDate ? ` · ${new Date(doc.uploadDate).toLocaleDateString()}` : ""}
                                  </p>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                                    background: doc.status === "uploaded" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                                    color: doc.status === "uploaded" ? "#10b981" : "#f59e0b",
                                    border: `1px solid ${doc.status === "uploaded" ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
                                    textTransform: "capitalize" }}>
                                    {doc.status || "pending"}
                                  </span>
                                  <button title={doc.url ? "Preview document" : "No URL available"}
                                    onClick={() => doc.url && setPreviewDoc(doc)}
                                    style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, background: doc.url ? T.blueDim : T.surface2, color: doc.url ? T.blueLight : T.textMuted, border:`1px solid ${doc.url ? "rgba(59,130,246,0.2)" : T.border}`, borderRadius:8, cursor: doc.url ? "pointer" : "not-allowed", opacity: doc.url ? 1 : 0.45 }}>
                                    <FaEye size={12} />
                                  </button>
                                  <button title={doc.url ? "Download document" : "No URL available"}
                                    onClick={() => handleDocDownload(doc.url, doc.name)}
                                    style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, background: doc.url ? "rgba(16,185,129,0.1)" : T.surface2, color: doc.url ? "#10b981" : T.textMuted, border:`1px solid ${doc.url ? "rgba(16,185,129,0.2)" : T.border}`, borderRadius:8, cursor: doc.url ? "pointer" : "not-allowed", opacity: doc.url ? 1 : 0.45 }}>
                                    <FaDownload size={11} />
                                  </button>
                                </div>
                              </div>
                              {doc.description && (
                                <p style={{ fontSize: 11, color: T.textSec, margin: "8px 0 0", paddingTop: 8, borderTop: `1px solid ${T.border}` }}>{doc.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              </div>
          </div>
        );
      })()}
      </div>{/* end cust-root */}

      {/* ── Document Preview Portal ──────────────────────────────── */}
      {previewDoc && createPortal(
        <div onClick={() => setPreviewDoc(null)}
          style={{ position:"fixed", inset:0, zIndex:99999, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: isDark ? "#1e2433" : "#ffffff", borderRadius:16, border:`1px solid ${T.border}`, width:"100%", maxWidth:900, maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 24px 80px rgba(0,0,0,0.5)" }}>

            {/* header */}
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <span style={{ fontSize:22 }}>
                {/\.pdf$/i.test(previewDoc.name) ? "📄" : /\.(jpe?g|png|gif|webp)$/i.test(previewDoc.name) ? "🖼️" : "📎"}
              </span>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontSize:14, fontWeight:700, color:T.textPri, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{previewDoc.name}</p>
                <p style={{ margin:0, fontSize:11, color:T.textSec }}>
                  {{trade_license:"Trade License",trl_copy:"TRL Copy",owners_passport:"Owner's Passport",eid_copy:"EID Copy",power_of_attorney:"Power of Attorney",other:"Other"}[previewDoc.type] || previewDoc.type}
                  {previewDoc.size ? ` · ${(previewDoc.size/1024).toFixed(0)} KB` : ""}
                </p>
              </div>
              <button onClick={() => handleDocDownload(previewDoc.url, previewDoc.name)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", background:"rgba(16,185,129,0.1)", color:"#10b981", border:"1px solid rgba(16,185,129,0.25)", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0 }}>
                <FaDownload size={11} /> Download
              </button>
              <button onClick={() => setPreviewDoc(null)}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", width:32, height:32, background:"rgba(239,68,68,0.1)", color:"#ef4444", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, cursor:"pointer", flexShrink:0 }}>
                <FaTimes size={13} />
              </button>
            </div>

            {/* body */}
            <div style={{ flex:1, overflow:"hidden", background: isDark ? "#141824" : "#f8fafc", minHeight:0 }}>
              {/\.(jpe?g|png|gif|webp)$/i.test(previewDoc.name) ? (
                <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
                  <img src={previewDoc.url} alt={previewDoc.name} style={{ maxWidth:"100%", maxHeight:"70vh", objectFit:"contain", borderRadius:8 }} />
                </div>
              ) : /\.pdf$/i.test(previewDoc.name) ? (
                <iframe src={previewDoc.url} title={previewDoc.name} style={{ width:"100%", height:"70vh", border:"none" }} />
              ) : (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, height:200 }}>
                  <span style={{ fontSize:40 }}>📎</span>
                  <p style={{ color:T.textSec, fontSize:13, margin:0 }}>Preview not available for this file type.</p>
                  <button onClick={() => handleDocDownload(previewDoc.url, previewDoc.name)}
                    style={{ padding:"8px 20px", background:T.blueDim, color:T.blueLight, border:`1px solid rgba(59,130,246,0.25)`, borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Customers;