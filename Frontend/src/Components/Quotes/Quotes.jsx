import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaTimes, FaSearch, FaFileAlt,
  FaChevronLeft, FaChevronRight, FaEdit, FaTrash,
  FaCheckCircle, FaTimesCircle, FaBoxOpen, FaFileInvoice,
  FaCopy, FaPaperPlane, FaExchangeAlt, FaLink, FaDownload, FaPrint,
} from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import useAuthStore from "../../store/useAuthStore";
import axiosInstance from "../../helper/axiosInstance";
import useRealtime from "../../helper/useRealtime";
import nexusToast from "../../helper/nexusToast";
import { usePermissions } from "../../helper/permissions";
import useConfirm from "../common/useConfirm";
import useIsMobile from "../../helper/useIsMobile";

const STATUSES = [
  { key: "all",       label: "All" },
  { key: "draft",     label: "Draft",     color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  { key: "sent",      label: "Sent",      color: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  { key: "accepted",  label: "Accepted",  color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  { key: "declined",  label: "Declined",  color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
  { key: "expired",   label: "Expired",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  { key: "converted", label: "Converted", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
];
const STATUS_MAP = Object.fromEntries(STATUSES.filter(s => s.key !== "all").map(s => [s.key, s]));

const Badge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: s.color, background: s.bg, whiteSpace: "nowrap",
      border: `1px solid ${s.color}30`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  );
};

const initials = name =>
  (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

const fmt = (n, currency = "AED") =>
  `${currency} ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LIMIT = 15;

const STAT_CARDS = [
  { label: "Sent",      key: "sent",      color: "#3b82f6", icon: FaPaperPlane,    glow: "rgba(59,130,246,0.15)"  },
  { label: "Accepted",  key: "accepted",  color: "#10b981", icon: FaCheckCircle,   glow: "rgba(16,185,129,0.15)"  },
  { label: "Declined",  key: "declined",  color: "#ef4444", icon: FaTimesCircle,   glow: "rgba(239,68,68,0.15)"   },
  { label: "Converted", key: "converted", color: "#8b5cf6", icon: FaExchangeAlt,   glow: "rgba(139,92,246,0.15)"  },
];

export default function Quotes() {
  const navigate  = useNavigate();
  const { can, canEditRecord, canViewRecord, role } = usePermissions();
  const myUserId = useAuthStore((s) => s.user?.userId);
  const isOwnerAdmin = role === "owner" || role === "admin";
  const canExport = can("quotes", "export");
  const isDark    = useThemeStore(s => s.isDark);
  const T         = getTheme(isDark);
  const isMobile  = useIsMobile();
  const { confirm, ConfirmModal } = useConfirm();

  const [quotes,     setQuotes]     = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [status,     setStatus]     = useState("all");
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [stats,      setStats]      = useState({});
  const [converting,    setConverting]    = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const exportQuotesCSV = () => {
    const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Quote #", "Customer", "Quote Date", "Valid Until", "Status", "Amount", "Currency"];
    const rows = quotes.map(q => [
      q.quoteNumber, q.customerName, q.quoteDate, q.validUntil,
      q.status, (q.grandTotal ?? q.total ?? 0).toFixed(2), q.currency || "AED",
    ]);
    const csv = [header, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `quotes_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (status !== "all") params.set("status", status);
      const [qRes, sRes] = await Promise.allSettled([
        axiosInstance.get(`/api/quotes/?${params}`),
        axiosInstance.get("/api/quotes/stats"),
      ]);
      if (qRes.status === "fulfilled") {
        setQuotes(qRes.value.data?.data?.quotes || []);
        setTotal(qRes.value.data?.data?.total || 0);
      }
      if (sRes.status === "fulfilled") {
        setStats(sRes.value.data?.data?.byStatus || {});
      }
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);
  useRealtime(['quotes_updated','invoices_updated','sales_orders_updated','enquiries_updated'], load);

  const filtered = search
    ? quotes.filter(q =>
        (q.quoteNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (q.customerName || "").toLowerCase().includes(search.toLowerCase())
      )
    : quotes;

  const totalPages = Math.ceil(total / LIMIT);

  async function handleConvert(q) {
    if (!(await confirm({ title: "Convert to invoice", message: `Convert ${q.quoteNumber} to an Invoice draft?`, confirmLabel: "Convert" }))) return;
    setConverting(true);
    try {
      const res = await axiosInstance.post(`/api/quotes/${q._id}/convert`);
      nexusToast.success(`Converted → ${res.data?.data?.invoiceNumber}`);
      setSelected(null);
      load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Conversion failed");
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete(q) {
    if (!(await confirm({ title: "Delete quote", message: `Delete ${q.quoteNumber}? This cannot be undone.`, confirmLabel: "Delete", danger: true }))) return;
    setDeleting(true);
    try {
      await axiosInstance.delete(`/api/quotes/${q._id}`);
      nexusToast.success("Quote deleted");
      setSelected(null);
      load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  // Open the Sales Order form pre-filled from a quote (customer, items, terms, salesperson).
  const goToSOFromQuote = (q) => {
    if (!q) return;
    navigate("/Sales/Salesorders/Newsalesorders", { state: { fromQuote: {
      quoteId:      q._id,
      quoteNumber:  q.quoteNumber,
      customerId:   q.customerId,
      customerName: q.customerName,
      paymentTerms: q.paymentTerms,
      currency:     q.currency,
      grandTotal:   q.totals?.grandTotal,
      notes:        q.notes?.customer,
      salesperson:  q.salesperson || "",
      lineItems:    q.lineItems || [],
    }}});
  };

  async function handleStatusChange(q, newStatus) {
    try {
      await axiosInstance.patch(`/api/quotes/${q._id}/status`, { status: newStatus });
      nexusToast.success("Status updated");
      setSelected(prev => prev?._id === q._id ? { ...prev, status: newStatus } : prev);
      load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to update status");
    }
  }

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
    .qt-root * { box-sizing: border-box; }
    .qt-root { font-family: 'DM Sans', sans-serif; }
    .qt-row { cursor: pointer; transition: background 0.13s; }
    .qt-row:hover { background: ${isDark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.018)"} !important; }
    .qt-row.active { background: ${isDark ? "rgba(59,130,246,0.08)" : "#eff6ff"} !important; }
    .qt-pill { cursor: pointer; transition: all 0.13s; border: none; }
    .qt-pill:hover { opacity: 0.8; }
    .qt-stat:hover { transform: translateY(-1px); }
    .qt-stat { transition: transform 0.15s; }
    .qt-action { transition: opacity 0.13s, transform 0.13s; }
    .qt-action:hover { opacity: 0.85 !important; transform: translateY(-1px); }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .qt-drawer { animation: slideIn 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
    .qt-search:focus { border-color: ${isDark ? "rgba(99,102,241,0.5)" : "#a5b4fc"} !important; box-shadow: 0 0 0 3px ${isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)"} !important; }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
  `;

  return (
    <div className="qt-root" style={{ background: T.bg, height: "100%", overflow: "hidden", color: T.text }}>
      <style>{css}</style>

      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

        {/* ── Main panel ── */}
        <div style={{ display: isMobile && selected ? "none" : "flex", flex: 1, flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ padding: isMobile ? "14px 14px 0" : "22px 28px 0", flexShrink: 0 }}>

            {/* Title row */}
            <div style={{ display: "flex", flexWrap: isMobile ? "wrap" : "nowrap", justifyContent: "space-between", alignItems: "center", gap: isMobile ? 10 : 0, marginBottom: 20 }}>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: isMobile ? 19 : 22, fontWeight: 800, color: T.textPri || T.text, margin: 0, letterSpacing: "-0.4px" }}>
                  Quotes
                </h1>
                <p style={{ fontSize: 12, color: T.textSec || T.muted, margin: "3px 0 0" }}>
                  {total} quote{total !== 1 ? "s" : ""} · all pipelines
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
                {canExport && (
                <button
                  onClick={exportQuotesCSV}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: isMobile ? "9px 12px" : "9px 16px", background: "transparent",
                    color: T.textSec || T.muted, border: `1.5px solid ${T.border}`,
                    borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap", flex: isMobile ? "1" : "initial",
                  }}>
                  <FaDownload size={11} /> {isMobile ? "Export" : "Export CSV"}
                </button>
                )}
                <button
                  onClick={() => navigate("/Sales/Quotes/Create")}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: isMobile ? "9px 12px" : "9px 20px", background: T.blue || T.accent,
                    color: "#fff", border: "none", borderRadius: 10,
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", letterSpacing: "0.01em", whiteSpace: "nowrap", flex: isMobile ? "1" : "initial",
                    boxShadow: `0 2px 10px ${T.blueDim || "rgba(59,130,246,0.3)"}`,
                  }}>
                  <FaPlus size={11} /> New Quote
                </button>
              </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
              {STAT_CARDS.map(sc => {
                const d = stats[sc.key] || {};
                const Icon = sc.icon;
                return (
                  <div key={sc.key} className="qt-stat" style={{
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderLeft: `3px solid ${sc.color}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    position: "relative",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", right: 12, top: 12,
                      width: 32, height: 32, borderRadius: 8,
                      background: sc.glow, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon style={{ color: sc.color, fontSize: 13 }} />
                    </div>
                    <p style={{ fontSize: 10, color: T.textSec || T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>
                      {sc.label}
                    </p>
                    <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: sc.color, margin: "0 0 3px", lineHeight: 1 }}>
                      {d.count || 0}
                    </p>
                    <p style={{ fontSize: 11, color: T.textSec || T.muted, margin: 0, fontFamily: "'DM Mono',monospace" }}>
                      {fmt(d.total || 0)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Search + filter row */}
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, marginBottom: 16, alignItems: isMobile ? "stretch" : "center" }}>
              <div style={{ position: "relative", width: isMobile ? "100%" : 260 }}>
                <FaSearch style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textSec || T.muted, fontSize: 11, pointerEvents: "none" }} />
                <input
                  className="qt-search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search quotes or customer…"
                  style={{
                    width: "100%", paddingLeft: 32, padding: "8px 12px 8px 32px",
                    background: T.surface, border: `1.5px solid ${T.border}`,
                    borderRadius: 9, fontSize: 12, color: T.text,
                    fontFamily: "inherit", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {STATUSES.map(s => {
                  const active = status === s.key;
                  const sc = STATUS_MAP[s.key];
                  return (
                    <button
                      key={s.key}
                      onClick={() => { setStatus(s.key); setPage(1); }}
                      className="qt-pill"
                      style={{
                        padding: "6px 13px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                        fontFamily: "inherit",
                        background: active ? (sc ? sc.bg : (isDark ? "rgba(99,102,241,0.15)" : "#eef2ff")) : "transparent",
                        color: active ? (sc ? sc.color : (isDark ? "#818cf8" : "#4f46e5")) : (T.textSec || T.muted),
                        border: active
                          ? `1.5px solid ${sc ? sc.color + "55" : "rgba(99,102,241,0.35)"}`
                          : `1.5px solid transparent`,
                        cursor: "pointer",
                      }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: isMobile ? "0 14px 16px" : "0 28px 20px" }}>
            <div style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 14, overflowX: "auto", overflowY: "hidden",
            }}>
              <table style={{ width: "100%", minWidth: isMobile ? 720 : "auto", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                    {[
                      { h: "Quote #",     align: "left"  },
                      { h: "Customer",    align: "left"  },
                      { h: "Quote Date",  align: "left"  },
                      { h: "Valid Until", align: "left"  },
                      { h: "Status",      align: "left"  },
                      { h: "Amount",      align: "right" },
                    ].map(({ h, align }) => (
                      <th key={h} style={{
                        padding: "11px 18px",
                        textAlign: align,
                        fontSize: 10, fontWeight: 700,
                        color: T.textSec || T.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: `1px solid ${T.border}`,
                        whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "52px 18px", textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            border: `3px solid ${T.border}`,
                            borderTopColor: T.blue || T.accent,
                            animation: "spin 0.8s linear infinite",
                          }} />
                          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                          <p style={{ color: T.textSec || T.muted, fontSize: 12, margin: 0 }}>Loading quotes…</p>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "64px 18px", textAlign: "center" }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: 14,
                          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          margin: "0 auto 12px",
                        }}>
                          <FaFileAlt style={{ fontSize: 22, color: T.textSec || T.muted }} />
                        </div>
                        <p style={{ color: T.textPri || T.text, fontSize: 14, fontWeight: 600, margin: "0 0 5px" }}>No quotes found</p>
                        <p style={{ color: T.textSec || T.muted, fontSize: 12, margin: "0 0 16px" }}>
                          {search ? "Try a different search term" : "Create your first quote to get started"}
                        </p>
                        {!search && (
                          <button
                            onClick={() => navigate("/Sales/Quotes/Create")}
                            style={{
                              padding: "8px 20px", background: T.blue || T.accent,
                              color: "#fff", border: "none", borderRadius: 9,
                              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                            }}>
                            <FaPlus style={{ marginRight: 6 }} /> Create Quote
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : filtered.map((q, idx) => {
                    const isActive = selected?._id === q._id;
                    const sc = STATUS_MAP[q.status] || STATUS_MAP.draft;
                    return (
                      <tr
                        key={q._id}
                        className={`qt-row${isActive ? " active" : ""}`}
                        onClick={() => {
                          if (isActive) { setSelected(null); return; }
                          if (!canViewRecord("quotes", q.createdBy)) { nexusToast.error("You can only open quotes you created"); return; }
                          setSelected(q);
                        }}
                        style={{ borderBottom: idx < filtered.length - 1 ? `1px solid ${T.border}` : "none" }}>

                        {/* Quote # */}
                        <td style={{ padding: "13px 18px" }}>
                          <span style={{
                            fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600,
                            color: T.blue || T.accent,
                            background: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.07)",
                            padding: "3px 8px", borderRadius: 6,
                          }}>
                            {q.quoteNumber}
                          </span>
                        </td>

                        {/* Customer */}
                        <td style={{ padding: "13px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                              background: isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.1)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 800, color: "#8b5cf6", fontFamily: "'Sora',sans-serif",
                            }}>
                              {initials(q.customerName)}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri || T.text }}>
                              {q.customerName || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Dates */}
                        <td style={{ padding: "13px 18px", fontSize: 12, color: T.textSec || T.muted }}>
                          {q.quoteDate || "—"}
                        </td>
                        <td style={{ padding: "13px 18px", fontSize: 12, color: q.status === "expired" ? "#f59e0b" : (T.textSec || T.muted) }}>
                          {q.validUntil || "—"}
                        </td>

                        {/* Status */}
                        <td style={{ padding: "13px 18px" }}>
                          <Badge status={q.status} />
                        </td>

                        {/* Amount */}
                        <td style={{ padding: "13px 18px", textAlign: "right" }}>
                          <span style={{
                            fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700,
                            color: T.textPri || T.text,
                          }}>
                            {fmt(q.totals?.grandTotal, q.currency)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination footer — always visible, below the scroll area */}
          <div style={{ flexShrink: 0, borderTop: `1px solid ${T.border}`, padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 12, color: T.textSec || T.muted }}>
              {total === 0 ? "No quotes" : `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} of ${total} quotes`}
            </span>
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: `1px solid ${T.border}`, background: T.surface,
                    color: T.textSec || T.muted, cursor: page <= 1 ? "not-allowed" : "pointer",
                    opacity: page <= 1 ? 0.35 : 1, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  <FaChevronLeft size={10} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: 32, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: p === page ? `1.5px solid ${T.blue || T.accent}` : `1px solid ${T.border}`,
                      background: p === page ? (T.blue || T.accent) : T.surface,
                      color: p === page ? "#fff" : (T.textSec || T.muted),
                      cursor: "pointer", fontFamily: "inherit",
                    }}>
                    {p}
                  </button>
                ))}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    border: `1px solid ${T.border}`, background: T.surface,
                    color: T.textSec || T.muted, cursor: page >= totalPages ? "not-allowed" : "pointer",
                    opacity: page >= totalPages ? 0.35 : 1, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  <FaChevronRight size={10} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Drawer ── */}
        {selected && (
          <div className="qt-drawer" style={{
            width: isMobile ? "100%" : 400, flexShrink: 0,
            background: T.surface,
            borderLeft: isMobile ? "none" : `1px solid ${T.border}`,
            display: "flex", flexDirection: "column",
            height: "100%", overflow: "hidden",
          }}>

            {/* Drawer header */}
            <div style={{
              padding: "20px 22px 16px",
              borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
              background: isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.01)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  {/* Quote number chip */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700,
                      color: T.blue || T.accent,
                      background: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)",
                      padding: "3px 9px", borderRadius: 6, border: `1px solid ${(T.blue || "#3b82f6") + "30"}`,
                    }}>
                      {selected.quoteNumber}
                    </span>
                    <Badge status={selected.status} />
                  </div>

                  {/* Customer */}
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 800, color: "#8b5cf6", fontFamily: "'Sora',sans-serif",
                    }}>
                      {initials(selected.customerName)}
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: T.textPri || T.text, margin: 0, lineHeight: 1.2 }}>
                        {selected.customerName || "Unknown Customer"}
                      </p>
                      {selected.sourceEnquiryNumber && (
                        <p style={{ fontSize: 11, color: T.textSec || T.muted, margin: "3px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                          <FaLink size={9} /> From {selected.sourceEnquiryNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Grand total hero */}
                  <div style={{
                    marginTop: 14, padding: "10px 14px",
                    background: isDark ? "rgba(139,92,246,0.08)" : "rgba(139,92,246,0.05)",
                    borderRadius: 10, border: `1px solid rgba(139,92,246,0.18)`,
                  }}>
                    <p style={{ fontSize: 10, color: T.textSec || T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 2px" }}>
                      Total Value
                    </p>
                    <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 800, color: "#8b5cf6", margin: 0 }}>
                      {fmt(selected.totals?.grandTotal, selected.currency)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelected(null)}
                  style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                    border: "none", cursor: "pointer",
                    color: T.textSec || T.muted, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  <FaTimes size={12} />
                </button>
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Details grid */}
                <Section label="Quote Details">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Quote Date",    val: selected.quoteDate    || "—" },
                      { label: "Valid Until",   val: selected.validUntil   || "—" },
                      { label: "Currency",      val: selected.currency     || "AED" },
                      { label: "Payment Terms", val: selected.paymentTerms || "—" },
                    ].map(({ label, val }) => (
                      <div key={label} style={{
                        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)",
                        borderRadius: 9, padding: "10px 12px",
                        border: `1px solid ${T.border}`,
                      }}>
                        <p style={{ fontSize: 10, color: T.textSec || T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px" }}>{label}</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri || T.text, margin: 0 }}>{val}</p>
                      </div>
                    ))}
                  </div>
                </Section>

                {/* Line items */}
                {selected.lineItems?.length > 0 && (
                  <Section label={`Line Items (${selected.lineItems.length})`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selected.lineItems.map((li, i) => (
                        <div key={i} style={{
                          background: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)",
                          border: `1px solid ${T.border}`, borderRadius: 9,
                          padding: "10px 13px",
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri || T.text, margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {li.desc || "—"}
                            </p>
                            <p style={{ fontSize: 11, color: T.textSec || T.muted, margin: 0, fontFamily: "'DM Mono',monospace" }}>
                              {li.qty} × {fmt(li.unitPrice, selected.currency)}
                            </p>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.textPri || T.text, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>
                            {fmt(li.total, selected.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Totals */}
                <Section label="Totals">
                  <div style={{ background: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)", border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    {[
                      { label: "Subtotal", val: selected.totals?.subtotal },
                      { label: "Discount", val: selected.totals?.discountTotal },
                      { label: "Tax",      val: selected.totals?.taxTotal },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontSize: 12, color: T.textSec || T.muted }}>{label}</span>
                        <span style={{ fontSize: 12, color: T.textPri || T.text, fontFamily: "'DM Mono',monospace" }}>{fmt(val, selected.currency)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 9, borderTop: `1px solid ${T.border}`, marginTop: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri || T.text }}>Grand Total</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#8b5cf6", fontFamily: "'DM Mono',monospace" }}>
                        {fmt(selected.totals?.grandTotal, selected.currency)}
                      </span>
                    </div>
                  </div>
                </Section>

                {/* Notes */}
                {selected.notes?.customer && (
                  <Section label="Notes">
                    <p style={{ fontSize: 12, color: T.textPri || T.text, margin: 0, lineHeight: 1.6, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: `1px solid ${T.border}`, borderRadius: 9, padding: "10px 13px" }}>
                      {selected.notes.customer}
                    </p>
                  </Section>
                )}

                {/* Actions */}
                <Section label="Actions">
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>

                    {/* Preview & Print — in-app HTML render */}
                    <ActionBtn
                      onClick={() => navigate(`/Sales/Quotes/${selected._id}/print`)}
                      icon={<FaPrint />}
                      label="Preview & Print"
                      color="#f59e0b" glow="rgba(245,158,11,0.15)"
                      outline
                    />

                    {/* PDF download */}
                    {canExport && (
                    <ActionBtn
                      onClick={() => {
                        const base = import.meta.env.VITE_API_URL || "http://localhost:8080";
                        const pdfUrl = `${base}/api/quotes/${selected._id}/pdf`;
                        axiosInstance.get(`/api/quotes/${selected._id}/pdf`, { responseType: "blob" })
                          .then(res => {
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(res.data);
                            a.download = `quote-${selected.quoteNumber}.pdf`;
                            a.click();
                            nexusToast.success("Quote PDF downloaded");
                          })
                          .catch(() => window.open(pdfUrl, "_blank"));
                      }}
                      icon={<FaDownload />}
                      label="Download PDF"
                      color="#10b981" glow="rgba(16,185,129,0.15)"
                      outline
                    />
                    )}

                    {selected.status === "draft" && canEditRecord("quotes", selected.createdBy) && (
                      <ActionBtn
                        onClick={() => navigate("/Sales/Quotes/Create", { state: { edit: selected } })}
                        icon={<FaEdit />}
                        label="Edit Quote"
                        color="#6366f1" glow="rgba(99,102,241,0.2)"
                      />
                    )}

                    {selected.status === "draft" && (
                      <ActionBtn
                        onClick={() => handleStatusChange(selected, "sent")}
                        icon={<FaPaperPlane />}
                        label="Mark as Sent"
                        color="#3b82f6" glow="rgba(59,130,246,0.15)"
                        outline
                      />
                    )}

                    {["sent", "draft"].includes(selected.status) && (selected.createdBy !== myUserId || isOwnerAdmin) && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                        <ActionBtn
                          onClick={() => handleStatusChange(selected, "accepted")}
                          icon={<FaCheckCircle />}
                          label="Customer Accepted"
                          color="#10b981" glow="rgba(16,185,129,0.15)"
                          outline
                        />
                        <ActionBtn
                          onClick={() => handleStatusChange(selected, "declined")}
                          icon={<FaTimesCircle />}
                          label="Customer Declined"
                          color="#ef4444" glow="rgba(239,68,68,0.1)"
                          outline
                        />
                      </div>
                    )}

                    {selected.status === "accepted" && (
                      <ActionBtn
                        onClick={() => goToSOFromQuote(selected)}
                        icon={<FaBoxOpen />}
                        label="Create Sales Order"
                        color="#10b981" glow="rgba(16,185,129,0.2)"
                      />
                    )}

                    {selected.status === "accepted" && (
                      <ActionBtn
                        onClick={() => handleConvert(selected)}
                        icon={<FaFileInvoice />}
                        label={converting ? "Converting…" : "Convert to Invoice (skip SO)"}
                        color="#8b5cf6" glow="rgba(139,92,246,0.15)"
                        outline
                        disabled={converting}
                      />
                    )}

                    <ActionBtn
                      onClick={() => navigate("/Sales/Quotes/Create", { state: { clone: selected } })}
                      icon={<FaCopy />}
                      label="Clone Quote"
                      color="#f59e0b" glow="rgba(245,158,11,0.12)"
                      outline
                    />

                    {selected.status === "draft" && canEditRecord("quotes", selected.createdBy) && (
                      <ActionBtn
                        onClick={() => handleDelete(selected)}
                        icon={<FaTrash />}
                        label={deleting ? "Deleting…" : "Delete Quote"}
                        color="#ef4444" glow="rgba(239,68,68,0.08)"
                        outline
                        disabled={deleting}
                        small
                      />
                    )}
                  </div>
                </Section>

              </div>
            </div>
          </div>
        )}

      </div>
      {ConfirmModal}
    </div>
  );
}

function Section({ label, children }) {
  const isDark = useThemeStore(s => s.isDark);
  const T = getTheme(isDark);
  return (
    <div>
      <p style={{
        fontSize: 10, fontWeight: 700, color: T.textSec || T.muted,
        textTransform: "uppercase", letterSpacing: "0.08em",
        margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6,
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function ActionBtn({ onClick, icon, label, color, glow, outline = false, disabled = false, small = false }) {
  return (
    <button
      className="qt-action"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: small ? "8px 14px" : "10px 14px",
        borderRadius: 9,
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        opacity: disabled ? 0.55 : 1,
        border: outline ? `1.5px solid ${color}40` : "none",
        background: outline ? glow : color,
        color: outline ? color : "#fff",
        boxShadow: !outline && !disabled ? `0 2px 8px ${glow}` : "none",
        transition: "opacity 0.13s, transform 0.13s",
      }}>
      {icon}
      {label}
    </button>
  );
}
