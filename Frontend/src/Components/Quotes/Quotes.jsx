import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaTimes, FaSearch, FaFileAlt,
  FaChevronLeft, FaChevronRight, FaEdit, FaTrash,
} from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

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
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: s.color, background: s.bg, whiteSpace: "nowrap", border: `1px solid ${s.color}30` }}>
      {s.label}
    </span>
  );
};

const fmt = (n, currency = "AED") =>
  `${currency} ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LIMIT = 15;

export default function Quotes() {
  const navigate  = useNavigate();
  const isDark    = useThemeStore(s => s.isDark);
  const T         = getTheme(isDark);

  const [quotes,    setQuotes]    = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [status,    setStatus]    = useState("all");
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);
  const [stats,     setStats]     = useState({});
  const [converting, setConverting] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

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

  const filtered = search
    ? quotes.filter(q =>
        (q.quoteNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (q.customerName || "").toLowerCase().includes(search.toLowerCase())
      )
    : quotes;

  const totalPages = Math.ceil(total / LIMIT);

  async function handleConvert(q) {
    if (!window.confirm(`Convert ${q.quoteNumber} to an Invoice draft?`)) return;
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
    if (!window.confirm(`Delete ${q.quoteNumber}? This cannot be undone.`)) return;
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

  async function handleStatusChange(q, newStatus) {
    try {
      await axiosInstance.patch(`/api/quotes/${q._id}/status`, { status: newStatus });
      nexusToast.success("Status updated");
      setSelected(prev => prev?._id === q._id ? { ...prev, status: newStatus } : prev);
      load();
    } catch (e) {
      nexusToast.error("Failed to update status");
    }
  }

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
    .qt-root { font-family: 'DM Sans', sans-serif; }
    .qt-row { cursor: pointer; transition: background 0.12s; }
    .qt-row:hover { background: ${isDark ? "rgba(255,255,255,0.03)" : "#f8fafc"} !important; }
    .qt-row.active { background: ${isDark ? "rgba(59,130,246,0.08)" : "#eff6ff"} !important; }
    .qt-pill { cursor: pointer; transition: all 0.13s; }
    .qt-pill:hover { opacity: 0.8; }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .qt-drawer { animation: slideIn 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
  `;

  const statCards = [
    { label: "Sent",      key: "sent",      color: "#3b82f6" },
    { label: "Accepted",  key: "accepted",  color: "#10b981" },
    { label: "Declined",  key: "declined",  color: "#ef4444" },
    { label: "Converted", key: "converted", color: "#8b5cf6" },
  ];

  return (
    <div className="qt-root" style={{ background: T.bg, minHeight: "100vh", color: T.text }}>
      <style>{css}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

        {/* ── Main panel ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 800, color: T.text, margin: 0 }}>Quotes</h1>
                <p style={{ fontSize: 12, color: T.muted, margin: "3px 0 0" }}>{total} quote{total !== 1 ? "s" : ""} total</p>
              </div>
              <button
                onClick={() => navigate("/Sales/Quotes/Create")}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: T.accent, color: "#0a0e1a", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <FaPlus size={11} /> New Quote
              </button>
            </div>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
              {statCards.map(sc => {
                const d = stats[sc.key] || {};
                return (
                  <div key={sc.key} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, padding: "12px 16px" }}>
                    <p style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 5px" }}>{sc.label}</p>
                    <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: sc.color, margin: "0 0 2px" }}>{d.count || 0}</p>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{fmt(d.total || 0)}</p>
                  </div>
                );
              })}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 12 }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search quotes…"
                  style={{ width: "100%", paddingLeft: 32, padding: "8px 12px 8px 32px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, color: T.text, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {STATUSES.map(s => (
                  <button key={s.key} onClick={() => { setStatus(s.key); setPage(1); }} className="qt-pill"
                    style={{ padding: "7px 13px", borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                      border: status === s.key ? `1px solid ${isDark ? "rgba(59,130,246,0.4)" : "#bfdbfe"}` : `1px solid ${T.border}`,
                      background: status === s.key ? (isDark ? "rgba(59,130,246,0.15)" : "#eff6ff") : "transparent",
                      color: status === s.key ? (isDark ? "#60a5fa" : "#1d4ed8") : T.muted, cursor: "pointer" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: "auto", padding: "0 24px" }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.surface2 }}>
                    {["Quote #", "Customer", "Quote Date", "Valid Until", "Status", "Amount"].map((h, i) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: i >= 5 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ padding: "48px 16px", textAlign: "center", color: T.muted }}>Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "56px 16px", textAlign: "center" }}>
                        <FaFileAlt style={{ fontSize: 28, color: T.muted, marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
                        <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>No quotes found</p>
                        <button onClick={() => navigate("/Sales/Quotes/Create")}
                          style={{ marginTop: 12, padding: "7px 18px", background: T.accent, color: "#0a0e1a", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Create your first quote
                        </button>
                      </td>
                    </tr>
                  ) : filtered.map(q => (
                    <tr key={q._id} className={`qt-row${selected?._id === q._id ? " active" : ""}`}
                      onClick={() => setSelected(selected?._id === q._id ? null : q)}
                      style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "12px 16px", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: T.accent }}>{q.quoteNumber}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: T.text }}>{q.customerName || "—"}</td>
                      <td style={{ padding: "12px 16px", color: T.muted }}>{q.quoteDate || "—"}</td>
                      <td style={{ padding: "12px 16px", color: q.status === "expired" ? "#f59e0b" : T.muted }}>{q.validUntil || "—"}</td>
                      <td style={{ padding: "12px 16px" }}><Badge status={q.status} /></td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: T.text }}>{fmt(q.totals?.grandTotal, q.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "16px 0" }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
                  <FaChevronLeft size={11} />
                </button>
                <span style={{ fontSize: 12, color: T.muted }}>Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>
                  <FaChevronRight size={11} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Drawer ── */}
        {selected && (
          <div className="qt-drawer" style={{
            width: 380, flexShrink: 0, background: T.surface, borderLeft: `1px solid ${T.border}`,
            display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden",
          }}>
            {/* Drawer header */}
            <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: T.accent, margin: "0 0 4px" }}>{selected.quoteNumber}</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: "0 0 6px" }}>{selected.customerName || "Unknown Customer"}</p>
                  <Badge status={selected.status} />
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, padding: 4 }}>
                  <FaTimes size={14} />
                </button>
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Details */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  {[
                    ["Quote Date",   selected.quoteDate  || "—"],
                    ["Valid Until",  selected.validUntil || "—"],
                    ["Currency",     selected.currency   || "AED"],
                    ["Payment Terms",selected.paymentTerms || "—"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* Line items */}
                {selected.lineItems?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>Line Items</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selected.lineItems.map((li, i) => (
                        <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{li.desc || "—"}</p>
                            <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>Qty {li.qty} × {fmt(li.unitPrice, selected.currency)}</p>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "'DM Mono',monospace", flexShrink: 0, marginLeft: 8 }}>{fmt(li.total, selected.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px" }}>
                  {[
                    ["Subtotal",   selected.totals?.subtotal],
                    ["Discount",   selected.totals?.discountTotal],
                    ["Tax",        selected.totals?.taxTotal],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
                      <span style={{ fontSize: 12, color: T.text, fontFamily: "'DM Mono',monospace" }}>{fmt(val, selected.currency)}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Total</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: T.accent, fontFamily: "'DM Mono',monospace" }}>{fmt(selected.totals?.grandTotal, selected.currency)}</span>
                  </div>
                </div>

                {/* Notes */}
                {selected.notes?.customer && (
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Notes</p>
                    <p style={{ fontSize: 12, color: T.text, margin: 0, lineHeight: 1.5 }}>{selected.notes.customer}</p>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Edit — draft only */}
                  {selected.status === "draft" && (
                    <button
                      onClick={() => navigate("/Sales/Quotes/Create", { state: { edit: selected } })}
                      style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.accent, color: "#0a0e1a", border: "none", fontFamily: "inherit", width: "100%" }}>
                      <FaEdit style={{ marginRight: 6 }} /> Edit Quote
                    </button>
                  )}

                  {/* Mark as Sent */}
                  {selected.status === "draft" && (
                    <button
                      onClick={() => handleStatusChange(selected, "sent")}
                      style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa", fontFamily: "inherit", width: "100%" }}>
                      📤 Mark as Sent
                    </button>
                  )}

                  {/* Accept / Decline */}
                  {["sent", "draft"].includes(selected.status) && (
                    <>
                      <button
                        onClick={() => handleStatusChange(selected, "accepted")}
                        style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontFamily: "inherit", width: "100%" }}>
                        ✓ Mark Accepted
                      </button>
                      <button
                        onClick={() => handleStatusChange(selected, "declined")}
                        style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontFamily: "inherit", width: "100%" }}>
                        ✕ Mark Declined
                      </button>
                    </>
                  )}

                  {/* Convert to Sales Order (preferred path for accepted quotes) */}
                  {selected.status === "accepted" && (
                    <button
                      onClick={() => navigate("/Sales/Salesorders/Newsalesorders", { state: { fromQuote: {
                        quoteId: selected._id,
                        quoteNumber: selected.quoteNumber,
                        customerId: selected.customerId,
                        customerName: selected.customerName,
                        paymentTerms: selected.paymentTerms,
                        currency: selected.currency,
                        grandTotal: selected.totals?.grandTotal,
                        notes: selected.notes?.customer,
                      }}})}
                      style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontFamily: "inherit", width: "100%" }}>
                      📦 Create Sales Order →
                    </button>
                  )}

                  {/* Convert to Invoice (quick path / skip SO) */}
                  {["sent", "accepted"].includes(selected.status) && (
                    <button
                      disabled={converting}
                      onClick={() => handleConvert(selected)}
                      style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: converting ? "not-allowed" : "pointer", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#8b5cf6", fontFamily: "inherit", width: "100%", opacity: converting ? 0.6 : 1 }}>
                      {converting ? "Converting…" : "📄 Convert to Invoice (skip SO)"}
                    </button>
                  )}

                  {/* Clone */}
                  <button
                    onClick={() => navigate("/Sales/Quotes/Create", { state: { clone: selected } })}
                    style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.28)", color: "#f59e0b", fontFamily: "inherit", width: "100%" }}>
                    📋 Clone Quote
                  </button>

                  {/* Delete — not converted */}
                  {selected.status !== "converted" && (
                    <button
                      disabled={deleting}
                      onClick={() => handleDelete(selected)}
                      style={{ padding: "8px 0", borderRadius: 7, fontSize: 12, cursor: deleting ? "not-allowed" : "pointer", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontFamily: "inherit", opacity: deleting ? 0.6 : 1 }}>
                      {deleting ? "Deleting…" : "Delete Quote"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
