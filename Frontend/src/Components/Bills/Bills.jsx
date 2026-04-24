import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FaPlus, FaTimes, FaSearch, FaFileInvoiceDollar, FaChevronLeft,
  FaChevronRight, FaEdit, FaCheckCircle, FaClock, FaExclamationCircle,
  FaBan, FaDownload, FaFilter
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

// ── CustomSelect (portal) ──────────────────────────────────────────
const CustomSelect = ({ value, onChange, options, placeholder = "Select", minWidth = 120 }) => {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const trigRef = useRef(null);
  const dropRef = useRef(null);
  const isDark = (() => { try { return JSON.parse(localStorage.getItem("nexus-theme") || "{}").state?.isDark ?? true; } catch { return true; } })();
  const opts = options.map(o => typeof o === "string" ? { label: o, value: o } : o);
  const selected = opts.find(o => o.value === value);
  const bg = isDark ? "#111d30" : "#fff"; const border = isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0";
  const textPri = isDark ? "#e2e8f0" : "#1e293b"; const textSec = isDark ? "#64748b" : "#94a3b8";
  const hoverBg = isDark ? "rgba(59,130,246,0.08)" : "#eff6ff";
  const activeBg = isDark ? "rgba(59,130,246,0.15)" : "#eff6ff";
  const activeC = isDark ? "#60a5fa" : "#1d4ed8";
  const measure = () => {
    if (!trigRef.current) return;
    const r = trigRef.current.getBoundingClientRect();
    const dropH = Math.min(opts.length * 40 + 12, 220);
    const top = (window.innerHeight - r.bottom) > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, minWidth) });
    setReady(true);
  };
  const handleOpen = () => { if (open) { setOpen(false); setReady(false); return; } setReady(false); setOpen(true); requestAnimationFrame(() => requestAnimationFrame(measure)); };
  useEffect(() => { const h = e => { if (!trigRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) { setOpen(false); setReady(false); } }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const dropdown = (
    <div ref={dropRef} style={{ position: "absolute", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999, background: bg, border: `1.5px solid ${border}`, borderRadius: 11, boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden", visibility: ready ? "visible" : "hidden", opacity: ready ? 1 : 0, transition: "opacity 0.12s" }}>
      <div style={{ padding: 5 }}>{opts.map((opt, i) => <div key={i} onClick={() => { onChange(opt.value); setOpen(false); setReady(false); }} style={{ padding: "8px 11px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: opt.value === value ? 600 : 400, color: opt.value === value ? activeC : textPri, background: opt.value === value ? activeBg : "transparent" }} onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = hoverBg; }} onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = "transparent"; }}>{opt.label}</div>)}</div>
    </div>
  );
  return (
    <div ref={trigRef} onClick={handleOpen} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 34, padding: "0 11px", minWidth, border: `1px solid ${border}`, borderRadius: 7, background: bg, cursor: "pointer", userSelect: "none", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: selected ? textPri : textSec, whiteSpace: "nowrap" }}>{selected ? selected.label : placeholder}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={open ? activeC : textSec} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
};

const STATUS_CFG = {
  draft:   { color: "#94a3b8", bg: "rgba(100,116,139,0.1)", label: "Draft" },
  open:    { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  label: "Open"  },
  partial: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Partial" },
  paid:    { color: "#10b981", bg: "rgba(16,185,129,0.1)",  label: "Paid"  },
  overdue: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   label: "Overdue" },
  void:    { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Void"  },
};

const fmtAED = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function Bills() {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const LIMIT = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [billsRes, statsRes] = await Promise.allSettled([
        axiosInstance.get("/bills/"),
        axiosInstance.get("/bills/stats"),
      ]);
      if (billsRes.status === "fulfilled") setBills(billsRes.value.data?.data?.bills || []);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data?.data || {});
    } catch {
      nexusToast.error("Failed to load bills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = bills.filter(b => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (b.billNumber || "").toLowerCase().includes(q) || (b.vendorName || "").toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const statCards = [
    { label: "Total Bills", value: (stats.totalCount || 0), icon: <FaFileInvoiceDollar />, color: T.blue, dim: T.blueDim },
    { label: "Open / Partial", value: ((stats.byStatus?.open?.count || 0) + (stats.byStatus?.partial?.count || 0)), icon: <FaClock />, color: T.amber, dim: T.amberDim },
    { label: "Overdue", value: (stats.byStatus?.overdue?.count || 0), icon: <FaExclamationCircle />, color: "#ef4444", dim: "rgba(239,68,68,0.1)" },
    { label: "Total Payable", value: fmtAED(stats.totalPayable || 0), icon: <FaFileInvoiceDollar />, color: T.green, dim: T.greenDim, small: true },
  ];

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .bl-root * { box-sizing: border-box; }
    .bl-root { font-family: 'DM Sans', sans-serif; }
    .bl-row { transition: background 0.1s; }
    .bl-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .bl-pill { cursor: pointer; transition: all 0.15s; }
    .bl-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .bl-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }
    .bl-btn { transition: all 0.15s; }
    .bl-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    @keyframes bl-slide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes bl-fade  { from { opacity: 0; } to { opacity: 1; } }
    .bl-drawer  { animation: bl-slide 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .bl-overlay { animation: bl-fade 0.2s ease forwards; }
  `;

  return (
    <>
      <style>{css}</style>
      <div className="bl-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Bills</h1>
            <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Track and manage vendor bills</p>
          </div>
          <button className="bl-btn" onClick={() => navigate("/Purchase/Bills/New")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11} /> New Bill
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
          {statCards.map((c, i) => (
            <div key={i} style={{ ...card, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent 10%,${c.color}55,transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>{c.label}</p>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{c.icon}</div>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: c.small ? 16 : 26, fontWeight: 800, color: T.textPri, margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: 11, pointerEvents: "none" }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search bill number or vendor…"
              style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}><FaTimes size={11} /></button>}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "draft", "open", "partial", "paid", "overdue", "void"].map(s => (
              <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                className={`bl-pill${filterStatus === s ? " bl-pill-active" : ""}`}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit", cursor: "pointer" }}>
                {s === "all" ? "All" : STATUS_CFG[s]?.label || s}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: T.textSec, marginLeft: "auto" }}>{filtered.length} bill{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div style={{ ...card, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {["Bill #", "Vendor", "Bill Date", "Due Date", "Grand Total", "Paid", "Balance Due", "Status", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i >= 4 && i <= 6 ? "right" : "left", fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ padding: "60px 20px", textAlign: "center", color: T.textSec }}>Loading…</td></tr>
              ) : paged.length > 0 ? paged.map((b, i) => {
                const sc = STATUS_CFG[b.status] || STATUS_CFG.open;
                return (
                  <tr key={b._id || i} className="bl-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span onClick={() => { setSelected(b); setDrawerOpen(true); }} style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.blueLight, cursor: "pointer" }}>{b.billNumber}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{b.vendorName || "—"}</td>
                    <td style={{ padding: "12px 16px", color: T.textSec, fontSize: 12 }}>{fmtDate(b.billDate)}</td>
                    <td style={{ padding: "12px 16px", color: T.textSec, fontSize: 12 }}>{fmtDate(b.dueDate)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.textPri }}>{fmtAED(b.totals?.grandTotal)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.textSec }}>{fmtAED(b.amountPaid)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: (b.balanceDue || 0) > 0 ? "#ef4444" : "#10b981" }}>{fmtAED(b.balanceDue)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      <button onClick={() => { setSelected(b); setDrawerOpen(true); }}
                        style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 11, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="9" style={{ padding: "72px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textSec }}><FaFileInvoiceDollar /></div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>No bills yet</p>
                    <p style={{ color: T.textSec, fontSize: 13, margin: 0 }}>Create your first vendor bill</p>
                    <button className="bl-btn" onClick={() => navigate("/Purchase/Bills/New")}
                      style={{ marginTop: 4, padding: "8px 20px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      New Bill
                    </button>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > LIMIT && (
          <div style={{ ...card, padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: T.textSec }}>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, filtered.length)} of {filtered.length}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 12, color: page === 1 ? T.textMuted : T.textSec, cursor: page === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                <FaChevronLeft size={10} /> Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 12, color: page === totalPages ? T.textMuted : T.textSec, cursor: page === totalPages ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
                Next <FaChevronRight size={10} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {drawerOpen && selected && (() => {
        const b = selected;
        const sc = STATUS_CFG[b.status] || STATUS_CFG.open;
        return (
          <>
            <div className="bl-overlay" onClick={() => { setDrawerOpen(false); setSelected(null); }}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />
            <div className="bl-drawer" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 460, maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>
              {/* Header */}
              <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>Bill Detail</h3>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.blueLight }}>{b.billNumber}</span>
                </div>
                <button onClick={() => { setDrawerOpen(false); setSelected(null); }}
                  style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: T.textSec, display: "flex" }}>
                  <FaTimes size={11} />
                </button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Vendor + dates */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Vendor",    value: b.vendorName || "—" },
                    { label: "Bill Date", value: fmtDate(b.billDate) },
                    { label: "Due Date",  value: fmtDate(b.dueDate) },
                    { label: "PO #",      value: b.poNumber || "—" },
                  ].map(({ label, value }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Line items */}
                {b.lineItems?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Line Items</p>
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                      {b.lineItems.map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: i < b.lineItems.length - 1 ? `1px solid ${T.border}` : "none" }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.description}</p>
                            <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0", fontFamily: "'DM Mono', monospace" }}>{item.qty} × {fmtAED(item.unitPrice)}</p>
                          </div>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.textPri }}>{fmtAED(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Subtotal",    value: fmtAED(b.totals?.subtotal) },
                    { label: "Discount",    value: fmtAED(b.totals?.discountTotal) },
                    { label: "Tax",         value: fmtAED(b.totals?.taxTotal) },
                    { label: "Grand Total", value: fmtAED(b.totals?.grandTotal), bold: true },
                    { label: "Amount Paid", value: fmtAED(b.amountPaid) },
                    { label: "Balance Due", value: fmtAED(b.balanceDue), red: (b.balanceDue || 0) > 0 },
                  ].map(({ label, value, bold, red }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", background: bold ? (isDark ? "rgba(59,130,246,0.06)" : "#eff6ff") : "transparent" }}>
                      <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: red ? "#ef4444" : bold ? T.blue : T.textPri }}>{value}</span>
                    </div>
                  ))}
                </div>

                {b.notes && (
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>Notes</p>
                    <p style={{ fontSize: 13, color: T.textPri, margin: 0 }}>{b.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
                <button className="bl-btn" onClick={() => navigate(`/Purchase/PaymentsMade?billId=${b._id}`)}
                  style={{ flex: 1, padding: 10, background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Record Payment
                </button>
                <button className="bl-btn" onClick={() => { setDrawerOpen(false); setSelected(null); }}
                  style={{ padding: "10px 16px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Close
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </>
  );
}
