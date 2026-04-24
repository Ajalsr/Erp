import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { FaPlus, FaTimes, FaSearch, FaMoneyBillWave, FaChevronLeft, FaChevronRight, FaCheckCircle } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const fmtAED = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ── Date picker (minimal inline) ──
const DateInput = ({ value, onChange, T }) => (
  <input type="date" value={value} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
);

// ── Portal select ──────────────────────────────────────────────────
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
  useEffect(() => { const h = e => { if (!trigRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) { setOpen(false); } }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
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

// ── Vendor search input ────────────────────────────────────────────
const VendorSearch = ({ value, onChange, T }) => {
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const search = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); return; }
    try {
      const res = await axiosInstance.get(`/vendors/search?q=${encodeURIComponent(q)}`);
      setResults(res.data?.data || []);
      setOpen(true);
    } catch { setResults([]); }
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    search(v);
    if (!v) onChange(null);
  };

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

const PAYMENT_MODES = ["Cash", "Bank Transfer", "Cheque", "Card", "Other"];

const DEFAULT_FORM = { vendorId: "", vendorName: "", billId: "", billNumber: "", amount: "", paymentMode: "Bank Transfer", reference: "", date: new Date().toISOString().split("T")[0], notes: "" };

export default function PaymentsMade() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pmtRes, statsRes] = await Promise.allSettled([
        axiosInstance.get("/vendor-payments/"),
        axiosInstance.get("/vendor-payments/stats"),
      ]);
      if (pmtRes.status === "fulfilled") setPayments(pmtRes.value.data?.data?.payments || []);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data?.data || {});
    } catch {
      nexusToast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pre-fill from URL params (e.g. from Bills "Record Payment" button)
  useEffect(() => {
    const billId = searchParams.get("billId");
    if (billId) {
      axiosInstance.get(`/bills/${billId}`).then(res => {
        const b = res.data?.data;
        if (b) {
          setForm(f => ({ ...f, billId: b._id, billNumber: b.billNumber, vendorId: b.vendorId, vendorName: b.vendorName, amount: String(b.balanceDue || "") }));
          setModalOpen(true);
        }
      }).catch(() => {});
    }
  }, [searchParams]);

  const filtered = payments.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.paymentNumber || "").toLowerCase().includes(q) || (p.vendorName || "").toLowerCase().includes(q) || (p.billNumber || "").toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const handleSubmit = async () => {
    if (!form.vendorId) { nexusToast.error("Please select a vendor"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { nexusToast.error("Amount must be greater than 0"); return; }
    setSubmitting(true);
    try {
      await axiosInstance.post("/vendor-payments/", {
        vendorId: form.vendorId,
        vendorName: form.vendorName,
        billId: form.billId || undefined,
        billNumber: form.billNumber || undefined,
        amount: parseFloat(form.amount),
        paymentMode: form.paymentMode,
        reference: form.reference,
        date: form.date,
        notes: form.notes,
      });
      nexusToast.success("Payment recorded successfully");
      setModalOpen(false);
      setForm(DEFAULT_FORM);
      load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const statCards = [
    { label: "Total Paid", value: fmtAED(stats.totalPaid), icon: <FaMoneyBillWave />, color: T.green, dim: T.greenDim, small: true },
    { label: "This Month", value: fmtAED(stats.thisMonth), icon: <FaCheckCircle />, color: T.blue, dim: T.blueDim, small: true },
    { label: "Transactions", value: stats.count || 0, icon: <FaMoneyBillWave />, color: T.amber, dim: T.amberDim },
  ];

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .pm-root * { box-sizing: border-box; }
    .pm-root { font-family: 'DM Sans', sans-serif; }
    .pm-row { transition: background 0.1s; }
    .pm-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .pm-btn { transition: all 0.15s; }
    .pm-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    @keyframes pm-slide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes pm-fade  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes pm-modal { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    .pm-overlay { animation: pm-fade 0.2s ease forwards; }
    .pm-modal   { animation: pm-modal 0.2s cubic-bezier(0.16,1,0.3,1) forwards; }
  `;

  const F = ({ label, children, req }) => (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textSec, marginBottom: 6 }}>
        {label}{req && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="pm-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Payments Made</h1>
            <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Record and track vendor payments</p>
          </div>
          <button className="pm-btn" onClick={() => setModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11} /> Record Payment
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
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: 11, pointerEvents: "none" }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search payment #, vendor, bill…"
              style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}><FaTimes size={11} /></button>}
          </div>
          <span style={{ fontSize: 12, color: T.textSec }}>{filtered.length} payment{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div style={{ ...card, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {["Payment #", "Date", "Vendor", "Bill #", "Mode", "Reference", "Amount"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i === 6 ? "right" : "left", fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: "60px 20px", textAlign: "center", color: T.textSec }}>Loading…</td></tr>
              ) : paged.length > 0 ? paged.map((p, i) => (
                <tr key={p._id || i} className="pm-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "12px 16px" }}><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.blueLight }}>{p.paymentNumber}</span></td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{fmtDate(p.date)}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{p.vendorName || "—"}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.textSec }}>{p.billNumber || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: T.surface2, border: `1px solid ${T.border}`, color: T.textSec }}>{p.paymentMode}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{p.reference || "—"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#10b981" }}>{fmtAED(p.amount)}</td>
                </tr>
              )) : (
                <tr><td colSpan="7" style={{ padding: "72px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textSec }}><FaMoneyBillWave /></div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>No payments yet</p>
                    <p style={{ color: T.textSec, fontSize: 13, margin: 0 }}>Record your first vendor payment</p>
                    <button className="pm-btn" onClick={() => setModalOpen(true)}
                      style={{ marginTop: 4, padding: "8px 20px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Record Payment
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

      {/* Record Payment Modal */}
      {modalOpen && (
        <>
          <div className="pm-overlay" onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.75)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", zIndex: 60 }} />
          <div className="pm-modal" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 520, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, zIndex: 61, boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.6)" : "0 12px 48px rgba(0,0,0,0.15)" }}>
            <div style={{ padding: "20px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>Record Payment</h3>
              <button onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
                style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: T.textSec, display: "flex" }}>
                <FaTimes size={11} />
              </button>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
              <F label="Vendor" req>
                <VendorSearch value={form.vendorId ? { id: form.vendorId, name: form.vendorName } : null}
                  onChange={v => setForm(f => ({ ...f, vendorId: v?.id || "", vendorName: v?.name || "" }))} T={T} />
              </F>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Amount (AED)" req>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00"
                    style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono', monospace" }} />
                </F>
                <F label="Date" req>
                  <DateInput value={form.date} onChange={d => setForm(f => ({ ...f, date: d }))} T={T} />
                </F>
              </div>
              <F label="Payment Mode" req>
                <Sel value={form.paymentMode} onChange={v => setForm(f => ({ ...f, paymentMode: v }))} options={PAYMENT_MODES} T={T} />
              </F>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Bill # (optional)">
                  <input value={form.billNumber} onChange={e => setForm(f => ({ ...f, billNumber: e.target.value }))} placeholder="BILL-2024XX-XXXX"
                    style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono', monospace" }} />
                </F>
                <F label="Reference">
                  <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Cheque / TXN number"
                    style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
                </F>
              </div>
              <F label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Optional notes…"
                  style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit", resize: "vertical" }} />
              </F>
            </div>
            <div style={{ padding: "14px 22px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10 }}>
              <button className="pm-btn" onClick={handleSubmit} disabled={submitting}
                style={{ flex: 1, padding: "11px", background: submitting ? T.surface2 : T.blue, color: submitting ? T.textSec : "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {submitting ? "Saving…" : "Record Payment"}
              </button>
              <button onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
                style={{ padding: "11px 20px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
