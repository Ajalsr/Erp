import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { FaPlus, FaTimes, FaSearch, FaFileInvoiceDollar, FaChevronLeft, FaChevronRight, FaCheck, FaBan } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const fmtAED = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_CFG = {
  draft:   { color: "#94a3b8", bg: "rgba(100,116,139,0.1)", label: "Draft" },
  open:    { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  label: "Open"  },
  applied: { color: "#10b981", bg: "rgba(16,185,129,0.1)",  label: "Applied" },
  void:    { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Void"  },
};

// ── Shared Sel + VendorSearch (same as PaymentsMade) ──────────────
const Sel = ({ value, onChange, options, placeholder = "Select", T }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, ready: false });
  const trigRef = useRef(null);
  const dropRef = useRef(null);
  const isDark = (() => { try { return JSON.parse(localStorage.getItem("nexus-theme") || "{}").state?.isDark ?? true; } catch { return true; } })();
  const opts = options.map(o => typeof o === "string" ? { label: o, value: o } : o);
  const selected = opts.find(o => o.value === value);
  const bg = isDark ? "#111d30" : "#fff"; const border = isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0";
  const textPri = isDark ? "#e2e8f0" : "#1e293b"; const textSec = isDark ? "#64748b" : "#94a3b8";
  const activeBg = isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"; const activeC = isDark ? "#60a5fa" : "#1d4ed8";
  const measure = () => {
    if (!trigRef.current) return;
    const r = trigRef.current.getBoundingClientRect();
    const dropH = Math.min(opts.length * 40 + 12, 220);
    const top = (window.innerHeight - r.bottom) > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width, ready: true });
  };
  const toggle = () => { if (open) { setOpen(false); setPos(p => ({ ...p, ready: false })); return; } setPos(p => ({ ...p, ready: false })); setOpen(true); requestAnimationFrame(() => requestAnimationFrame(measure)); };
  useEffect(() => { const h = e => { if (!trigRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const dropdown = (
    <div ref={dropRef} style={{ position: "absolute", top: pos.top, left: pos.left, width: pos.width, zIndex: 99999, background: bg, border: `1.5px solid ${border}`, borderRadius: 11, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden", visibility: pos.ready ? "visible" : "hidden", opacity: pos.ready ? 1 : 0, transition: "opacity 0.12s" }}>
      <div style={{ padding: 5 }}>{opts.map((opt, i) => <div key={i} onClick={() => { onChange(opt.value); setOpen(false); }} style={{ padding: "9px 12px", borderRadius: 7, cursor: "pointer", fontSize: 13, color: opt.value === value ? activeC : textPri, background: opt.value === value ? activeBg : "transparent", fontFamily: "inherit" }} onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = isDark ? "rgba(59,130,246,0.08)" : "#eff6ff"; }} onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = "transparent"; }}>{opt.label}</div>)}</div>
    </div>
  );
  return (
    <div ref={trigRef} onClick={toggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, background: T.surface, cursor: "pointer", userSelect: "none" }}>
      <span style={{ fontSize: 13, color: selected ? T.textPri : T.textSec }}>{selected ? selected.label : placeholder}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textSec} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
};

const VendorSearch = ({ value, onChange, T }) => {
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const search = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); return; }
    try { const res = await axiosInstance.get(`/vendors/search?q=${encodeURIComponent(q)}`); setResults(res.data?.data || []); setOpen(true); } catch { setResults([]); }
  }, []);
  const handleChange = (e) => { const v = e.target.value; setQuery(v); search(v); if (!v) onChange(null); };
  useEffect(() => { const h = e => { if (!ref.current?.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={query} onChange={handleChange} placeholder="Search vendor name…"
        style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, zIndex: 1000, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
          {results.map((v, i) => (
            <div key={v._id || i} onClick={() => { setQuery(v.displayName || v.companyName); onChange({ id: v._id, name: v.displayName || v.companyName }); setOpen(false); setResults([]); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: i < results.length - 1 ? `1px solid ${T.border}` : "none" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{v.displayName || v.companyName}</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: 0, fontFamily: "'DM Mono', monospace" }}>{v.vendorCode}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EMPTY_ITEM = { description: "", qty: 1, unitPrice: 0, taxRate: 5, taxAmt: 0, total: 0 };
const DEFAULT_FORM = { vendorId: "", vendorName: "", reason: "", date: new Date().toISOString().split("T")[0], lineItems: [{ ...EMPTY_ITEM }], notes: "" };

const calcItem = (item) => {
  const base = (item.qty || 0) * (item.unitPrice || 0);
  const taxAmt = base * ((item.taxRate || 0) / 100);
  return { ...item, taxAmt: Math.round(taxAmt * 100) / 100, total: Math.round((base + taxAmt) * 100) / 100 };
};

const calcTotals = (items) => {
  const subtotal  = items.reduce((s, i) => s + (i.qty || 0) * (i.unitPrice || 0), 0);
  const taxTotal  = items.reduce((s, i) => s + (i.taxAmt || 0), 0);
  const grandTotal = subtotal + taxTotal;
  return { subtotal: Math.round(subtotal * 100) / 100, taxTotal: Math.round(taxTotal * 100) / 100, grandTotal: Math.round(grandTotal * 100) / 100 };
};

export default function VendorCredits() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [credits, setCredits] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [credRes, statsRes] = await Promise.allSettled([
        axiosInstance.get("/vendor-credits/"),
        axiosInstance.get("/vendor-credits/stats"),
      ]);
      if (credRes.status === "fulfilled") setCredits(credRes.value.data?.data?.credits || []);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data?.data || {});
    } catch {
      nexusToast.error("Failed to load vendor credits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = credits.filter(c => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (c.creditNumber || "").toLowerCase().includes(q) || (c.vendorName || "").toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  // Line item helpers
  const updateItem = (idx, field, val) => {
    setForm(f => {
      const items = [...f.lineItems];
      items[idx] = calcItem({ ...items[idx], [field]: field === "description" ? val : parseFloat(val) || 0 });
      return { ...f, lineItems: items };
    });
  };
  const addItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_ITEM }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }));

  const totals = calcTotals(form.lineItems);

  const handleSubmit = async () => {
    if (!form.vendorId) { nexusToast.error("Please select a vendor"); return; }
    if (!form.reason.trim()) { nexusToast.error("Reason is required"); return; }
    if (form.lineItems.some(i => !i.description.trim())) { nexusToast.error("All line items need a description"); return; }
    setSubmitting(true);
    try {
      await axiosInstance.post("/vendor-credits/", {
        vendorId: form.vendorId, vendorName: form.vendorName,
        reason: form.reason, date: form.date,
        lineItems: form.lineItems, totals,
        notes: form.notes,
      });
      nexusToast.success("Vendor credit created successfully");
      setModalOpen(false);
      setForm(DEFAULT_FORM);
      load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to create credit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoid = async (id) => {
    try {
      await axiosInstance.patch(`/vendor-credits/${id}/void`);
      nexusToast.success("Credit voided");
      load();
    } catch {
      nexusToast.error("Failed to void credit");
    }
  };

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .vc-root * { box-sizing: border-box; }
    .vc-root { font-family: 'DM Sans', sans-serif; }
    .vc-row { transition: background 0.1s; }
    .vc-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .vc-pill { cursor: pointer; transition: all 0.15s; }
    .vc-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .vc-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }
    .vc-btn { transition: all 0.15s; }
    .vc-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    @keyframes vc-fade  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes vc-modal { from { opacity: 0; transform: translate(-50%,-48%) scale(0.96); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
    @keyframes vc-slide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .vc-overlay { animation: vc-fade 0.2s ease forwards; }
    .vc-modal   { animation: vc-modal 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
    .vc-drawer  { animation: vc-slide 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
  `;

  const F = ({ label, children, req }) => (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textSec, marginBottom: 6 }}>
        {label}{req && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );

  const statCards = [
    { label: "Total Credits", value: Object.values(stats.byStatus || {}).reduce((s, v) => s + (v.count || 0), 0), icon: <FaFileInvoiceDollar />, color: T.blue, dim: T.blueDim },
    { label: "Open Credits", value: stats.byStatus?.open?.count || 0, icon: <FaFileInvoiceDollar />, color: T.amber, dim: T.amberDim },
    { label: "Open Value", value: fmtAED(stats.openTotal), icon: <FaFileInvoiceDollar />, color: T.green, dim: T.greenDim, small: true },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="vc-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Vendor Credits</h1>
            <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Manage credit notes received from vendors</p>
          </div>
          <button className="vc-btn" onClick={() => setModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11} /> New Credit
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
          {statCards.map((c, i) => (
            <div key={i} style={{ ...card, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent 10%,${c.color}55,transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>{c.label}</p>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{c.icon}</div>
              </div>
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: c.small ? 17 : 26, fontWeight: 800, color: T.textPri, margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: 11, pointerEvents: "none" }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search credit # or vendor…"
              style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}><FaTimes size={11} /></button>}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "draft", "open", "applied", "void"].map(s => (
              <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                className={`vc-pill${filterStatus === s ? " vc-pill-active" : ""}`}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit", cursor: "pointer" }}>
                {s === "all" ? "All" : STATUS_CFG[s]?.label || s}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: T.textSec, marginLeft: "auto" }}>{filtered.length} credit{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div style={{ ...card, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {["Credit #", "Date", "Vendor", "Reason", "Amount", "Status", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i === 4 ? "right" : "left", fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: "60px 20px", textAlign: "center", color: T.textSec }}>Loading…</td></tr>
              ) : paged.length > 0 ? paged.map((cr, i) => {
                const sc = STATUS_CFG[cr.status] || STATUS_CFG.open;
                return (
                  <tr key={cr._id || i} className="vc-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span onClick={() => { setSelected(cr); setDrawerOpen(true); }} style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.blueLight, cursor: "pointer" }}>{cr.creditNumber}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{fmtDate(cr.date)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{cr.vendorName || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cr.reason || "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.green }}>{fmtAED(cr.totals?.grandTotal)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setSelected(cr); setDrawerOpen(true); }}
                          style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 11, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                          View
                        </button>
                        {cr.status === "open" && (
                          <button onClick={() => handleVoid(cr._id)}
                            style={{ padding: "4px 8px", border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 7, background: "rgba(239,68,68,0.06)", fontSize: 11, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }} title="Void credit">
                            <FaBan size={10} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7" style={{ padding: "72px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textSec }}><FaFileInvoiceDollar /></div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>No vendor credits yet</p>
                    <button className="vc-btn" onClick={() => setModalOpen(true)}
                      style={{ marginTop: 4, padding: "8px 20px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      New Credit
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

      {/* Create Credit Modal */}
      {modalOpen && (
        <>
          <div className="vc-overlay" onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.75)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", zIndex: 60 }} />
          <div className="vc-modal" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, zIndex: 61, boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.6)" : "0 12px 48px rgba(0,0,0,0.15)" }}>
            <div style={{ padding: "20px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>New Vendor Credit</h3>
              <button onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
                style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: T.textSec, display: "flex" }}>
                <FaTimes size={11} />
              </button>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Vendor" req>
                  <VendorSearch value={form.vendorId ? { id: form.vendorId, name: form.vendorName } : null}
                    onChange={v => setForm(f => ({ ...f, vendorId: v?.id || "", vendorName: v?.name || "" }))} T={T} />
                </F>
                <F label="Date" req>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
                </F>
              </div>
              <F label="Reason" req>
                <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Returned goods, pricing error…"
                  style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
              </F>

              {/* Line items */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Line Items</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.lineItems.map((item, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 80px 100px auto", gap: 8, alignItems: "center" }}>
                      <input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Description"
                        style={{ padding: "9px 12px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
                      <input type="number" value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} placeholder="Qty"
                        style={{ padding: "9px 10px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono', monospace", textAlign: "center" }} />
                      <input type="number" value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} placeholder="Unit Price"
                        style={{ padding: "9px 10px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono', monospace" }} />
                      <input type="number" value={item.taxRate} onChange={e => updateItem(idx, "taxRate", e.target.value)} placeholder="Tax %"
                        style={{ padding: "9px 10px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono', monospace", textAlign: "center" }} />
                      <span style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.textPri }}>{fmtAED(item.total)}</span>
                      <button onClick={() => removeItem(idx)} disabled={form.lineItems.length === 1}
                        style={{ padding: "7px 8px", border: `1px solid ${T.border}`, borderRadius: 8, background: "transparent", color: T.textSec, cursor: form.lineItems.length === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", opacity: form.lineItems.length === 1 ? 0.4 : 1 }}>
                        <FaTimes size={10} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addItem} style={{ marginTop: 8, padding: "7px 14px", border: `1px dashed ${T.border}`, borderRadius: 8, background: "transparent", color: T.textSec, cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                  <FaPlus size={10} /> Add Item
                </button>
              </div>

              {/* Totals */}
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px" }}>
                {[
                  { label: "Subtotal", value: fmtAED(totals.subtotal) },
                  { label: "Tax (VAT)", value: fmtAED(totals.taxTotal) },
                  { label: "Grand Total", value: fmtAED(totals.grandTotal), bold: true },
                ].map(({ label, value, bold }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: label !== "Grand Total" ? `1px solid ${T.border}` : "none" }}>
                    <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: bold ? T.blue : T.textPri }}>{value}</span>
                  </div>
                ))}
              </div>

              <F label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes…"
                  style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit", resize: "vertical" }} />
              </F>
            </div>
            <div style={{ padding: "14px 22px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10 }}>
              <button className="vc-btn" onClick={handleSubmit} disabled={submitting}
                style={{ flex: 1, padding: 11, background: submitting ? T.surface2 : T.blue, color: submitting ? T.textSec : "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {submitting ? "Creating…" : "Create Credit"}
              </button>
              <button onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
                style={{ padding: "11px 20px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail Drawer */}
      {drawerOpen && selected && (() => {
        const cr = selected;
        const sc = STATUS_CFG[cr.status] || STATUS_CFG.open;
        return (
          <>
            <div className="vc-overlay" onClick={() => { setDrawerOpen(false); setSelected(null); }}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />
            <div className="vc-drawer" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 440, maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>
              <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>Credit Note</h3>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.blueLight }}>{cr.creditNumber}</span>
                </div>
                <button onClick={() => { setDrawerOpen(false); setSelected(null); }}
                  style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: T.textSec, display: "flex" }}>
                  <FaTimes size={11} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Vendor", value: cr.vendorName || "—" },
                    { label: "Date", value: fmtDate(cr.date) },
                    { label: "Reason", value: cr.reason || "—" },
                    { label: "Linked Bill", value: cr.billNumber || "—" },
                  ].map(({ label, value }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri }}>{value}</span>
                    </div>
                  ))}
                </div>
                {cr.lineItems?.length > 0 && (
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {cr.lineItems.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: i < cr.lineItems.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.description}</p>
                          <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0", fontFamily: "'DM Mono', monospace" }}>{item.qty} × {fmtAED(item.unitPrice)}</p>
                        </div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.green }}>{fmtAED(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Subtotal", value: fmtAED(cr.totals?.subtotal) },
                    { label: "Tax", value: fmtAED(cr.totals?.taxTotal) },
                    { label: "Grand Total", value: fmtAED(cr.totals?.grandTotal), bold: true },
                  ].map(({ label, value, bold }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", background: bold ? (isDark ? "rgba(16,185,129,0.06)" : "#f0fdf4") : "transparent" }}>
                      <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: bold ? T.green : T.textPri }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {cr.status === "open" && (
                <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
                  <button className="vc-btn" onClick={() => handleVoid(cr._id)}
                    style={{ flex: 1, padding: 10, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Void Credit
                  </button>
                  <button className="vc-btn" onClick={() => { setDrawerOpen(false); setSelected(null); }}
                    style={{ padding: "10px 16px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Close
                  </button>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </>
  );
}
