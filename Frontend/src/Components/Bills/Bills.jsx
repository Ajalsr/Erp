import { useEffect, useState, useRef, useCallback } from "react";
import {
  FaPlus, FaTimes, FaSearch, FaFileInvoiceDollar, FaChevronLeft,
  FaChevronRight, FaClock, FaExclamationCircle, FaMoneyBillWave,
  FaCheckCircle, FaSpinner, FaReceipt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const STATUS_CFG = {
  draft:   { color: "#94a3b8", bg: "rgba(100,116,139,0.1)", label: "Draft"   },
  open:    { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  label: "Open"    },
  partial: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Partial" },
  paid:    { color: "#10b981", bg: "rgba(16,185,129,0.1)",  label: "Paid"    },
  overdue: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   label: "Overdue" },
  void:    { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Void"    },
};

const PAYMENT_MODES = ["Cash", "Bank Transfer", "Cheque", "Card", "Other"];
const LIMIT = 10;

const fmtAED  = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function Bills() {
  const navigate  = useNavigate();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);

  const [bills,           setBills]           = useState([]);
  const [stats,           setStats]           = useState({});
  const [loading,         setLoading]         = useState(true);
  const [filterStatus,    setFilterStatus]    = useState("all");
  const [search,          setSearch]          = useState("");
  const [page,            setPage]            = useState(1);
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [selected,        setSelected]        = useState(null);
  const [activeTab,       setActiveTab]       = useState("overview");
  const [billPayments,    setBillPayments]    = useState([]);
  const [pmtLoading,      setPmtLoading]      = useState(false);
  const [payModal,        setPayModal]        = useState(false);
  const [payForm,         setPayForm]         = useState({});
  const [paySubmitting,   setPaySubmitting]   = useState(false);
  const [voidLoading,     setVoidLoading]     = useState(false);

  /* ── Load list ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.allSettled([
        axiosInstance.get("/api/bills/"),
        axiosInstance.get("/api/bills/stats"),
      ]);
      if (bRes.status === "fulfilled") setBills(bRes.value.data?.data?.bills || []);
      if (sRes.status === "fulfilled") setStats(sRes.value.data?.data || {});
    } catch { nexusToast.error("Failed to load bills"); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Load payments when drawer opens ── */
  useEffect(() => {
    if (!selected?._id) return;
    setPmtLoading(true);
    axiosInstance.get(`/api/vendor-payments/?billId=${selected._id}`)
      .then(r => setBillPayments(r.data?.data?.payments || []))
      .catch(() => setBillPayments([]))
      .finally(() => setPmtLoading(false));
  }, [selected?._id]);

  /* ── Drawer helpers ── */
  const openDrawer = (b) => {
    setSelected(b);
    setDrawerOpen(true);
    setActiveTab("overview");
    setBillPayments([]);
    setPayModal(false);
    setPayForm({ amount: String(b.balanceDue || ""), paymentMode: "Bank Transfer", reference: "", date: new Date().toISOString().split("T")[0], notes: "" });
  };
  const closeDrawer = () => { setDrawerOpen(false); setSelected(null); setPayModal(false); };

  /* ── Record payment ── */
  const handleRecordPayment = async () => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) { nexusToast.error("Enter a valid amount"); return; }
    setPaySubmitting(true);
    try {
      await axiosInstance.post("/api/vendor-payments/", {
        vendorId:    selected.vendorId,
        vendorName:  selected.vendorName,
        billId:      selected._id,
        billNumber:  selected.billNumber,
        amount:      amt,
        paymentMode: payForm.paymentMode,
        reference:   payForm.reference || undefined,
        date:        payForm.date,
        notes:       payForm.notes    || undefined,
      });
      nexusToast.success("Payment recorded!");
      setPayModal(false);
      await load();
      const refreshed = await axiosInstance.get(`/api/bills/${selected._id}`);
      if (refreshed.data?.data) setSelected(refreshed.data.data);
      const pmtRes = await axiosInstance.get(`/api/vendor-payments/?billId=${selected._id}`);
      setBillPayments(pmtRes.data?.data?.payments || []);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || "Failed to record payment");
    } finally { setPaySubmitting(false); }
  };

  /* ── Void bill ── */
  const handleVoid = async () => {
    if (!window.confirm(`Void bill ${selected.billNumber}? This cannot be undone.`)) return;
    setVoidLoading(true);
    try {
      await axiosInstance.patch(`/api/bills/${selected._id}/status`, { status: "void" });
      nexusToast.success("Bill voided");
      await load();
      closeDrawer();
    } catch { nexusToast.error("Failed to void bill"); }
    finally { setVoidLoading(false); }
  };

  /* ── Filtering ── */
  const filtered = bills.filter(b => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (b.billNumber || "").toLowerCase().includes(q) || (b.vendorName || "").toLowerCase().includes(q);
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged      = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  /* ── Stat cards ── */
  const statCards = [
    { label: "Total Bills",   value: stats.totalCount || 0,           icon: <FaFileInvoiceDollar />, color: T.blue,   dim: T.blueDim },
    { label: "Open / Partial",value: (stats.byStatus?.open?.count || 0) + (stats.byStatus?.partial?.count || 0), icon: <FaClock />, color: T.amber, dim: T.amberDim },
    { label: "Overdue",       value: stats.byStatus?.overdue?.count || 0, icon: <FaExclamationCircle />, color: "#ef4444", dim: "rgba(239,68,68,0.1)" },
    { label: "Total Payable", value: fmtAED(stats.totalPayable || 0), icon: <FaFileInvoiceDollar />, color: T.green,  dim: T.greenDim, small: true },
  ];

  /* ── Styles ── */
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };
  const inp  = { width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" };
  const lbl  = { display: "block", fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .bl-root * { box-sizing: border-box; }
    .bl-root { font-family: 'DM Sans', sans-serif; }
    .bl-row { transition: background 0.1s; cursor: pointer; }
    .bl-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .bl-pill { cursor: pointer; transition: all 0.15s; }
    .bl-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .bl-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }
    .bl-btn { transition: all 0.15s; }
    .bl-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    .bl-tab { cursor: pointer; transition: color 0.15s; }
    .bl-tab:hover { color: ${isDark ? "#60a5fa" : "#2563eb"} !important; }
    @keyframes bl-slide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes bl-fade  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bl-spin  { to { transform: rotate(360deg); } }
    .bl-drawer  { animation: bl-slide 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .bl-overlay { animation: bl-fade 0.2s ease forwards; }
    .bl-spin    { animation: bl-spin 0.7s linear infinite; }
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
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
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
                <tr><td colSpan="9" style={{ padding: "60px 20px", textAlign: "center", color: T.textSec }}>
                  <FaSpinner className="bl-spin" style={{ fontSize: 18, display: "block", margin: "0 auto 10px" }} />Loading…
                </td></tr>
              ) : paged.length > 0 ? paged.map((b, i) => {
                const sc = STATUS_CFG[b.status] || STATUS_CFG.open;
                return (
                  <tr key={b._id || i} className="bl-row" onClick={() => openDrawer(b)} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.blueLight }}>{b.billNumber}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{b.vendorName || "—"}</td>
                    <td style={{ padding: "12px 16px", color: T.textSec, fontSize: 12 }}>{fmtDate(b.billDate)}</td>
                    <td style={{ padding: "12px 16px", color: T.textSec, fontSize: 12 }}>{fmtDate(b.dueDate)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.textPri }}>{fmtAED(b.totals?.grandTotal)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#10b981" }}>{fmtAED(b.amountPaid)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: (b.balanceDue || 0) > 0 ? "#ef4444" : "#10b981" }}>{fmtAED(b.balanceDue)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      <button onClick={e => { e.stopPropagation(); openDrawer(b); }}
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
                      style={{ marginTop: 4, padding: "8px 20px", background: T.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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

      {/* ── Detail Drawer ── */}
      {drawerOpen && selected && (() => {
        const b      = selected;
        const sc     = STATUS_CFG[b.status] || STATUS_CFG.open;
        const grand  = b.totals?.grandTotal || 0;
        const paidPct= grand > 0 ? Math.min(100, ((b.amountPaid || 0) / grand) * 100) : 0;
        const canPay = b.status !== "paid" && b.status !== "void";
        const canVoid= b.status !== "void";

        return (
          <>
            <div className="bl-overlay" onClick={closeDrawer}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />
            <div className="bl-drawer" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 490, maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

              {/* Drawer header */}
              <div style={{ padding: "18px 20px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.blueLight }}>{b.billNumber}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontSize: 15, fontWeight: 800, color: T.textPri, margin: 0 }}>{b.vendorName || "—"}</p>
                  </div>
                  <button onClick={closeDrawer} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 7, cursor: "pointer", color: T.textSec, display: "flex", flexShrink: 0 }}>
                    <FaTimes size={11} />
                  </button>
                </div>

                {/* Payment progress */}
                {grand > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textSec, marginBottom: 5 }}>
                      <span>Paid {fmtAED(b.amountPaid)} of {fmtAED(grand)}</span>
                      <span style={{ fontWeight: 700, color: paidPct >= 100 ? "#10b981" : T.amber }}>{paidPct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: T.surface2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${paidPct}%`, borderRadius: 99, background: paidPct >= 100 ? "#10b981" : "#3b82f6", transition: "width 0.4s" }} />
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div style={{ display: "flex" }}>
                  {["overview", "payments"].map(tab => (
                    <button key={tab} className="bl-tab" onClick={() => setActiveTab(tab)}
                      style={{ padding: "9px 16px", border: "none", background: "transparent", fontSize: 13, fontWeight: activeTab === tab ? 700 : 500, color: activeTab === tab ? (isDark ? "#60a5fa" : "#2563eb") : T.textSec, borderBottom: activeTab === tab ? `2px solid ${isDark ? "#60a5fa" : "#2563eb"}` : "2px solid transparent", cursor: "pointer", fontFamily: "inherit", marginBottom: -1 }}>
                      {tab === "payments" ? `Payments (${billPayments.length})` : "Overview"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

                {/* ── OVERVIEW ── */}
                {activeTab === "overview" && (<>
                  {/* Meta */}
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {[
                      { label: "Bill Date",     value: fmtDate(b.billDate) },
                      { label: "Due Date",      value: fmtDate(b.dueDate)  },
                      ...(b.paymentTerms ? [{ label: "Payment Terms", value: b.paymentTerms }] : []),
                      ...(b.poNumber    ? [{ label: "PO #",           value: b.poNumber, mono: true }] : []),
                      ...(b.grnNumber   ? [{ label: "GRN #",          value: b.grnNumber, mono: true }] : []),
                    ].map(({ label, value, mono }, i, arr) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: mono ? "'DM Mono', monospace" : "inherit" }}>{value}</span>
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
                              <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0", fontFamily: "'DM Mono', monospace" }}>
                                {item.qty} × {fmtAED(item.unitPrice)}
                                {item.discountAmt > 0 && <span style={{ color: "#10b981" }}> − {fmtAED(item.discountAmt)}</span>}
                              </p>
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
                      ...((b.totals?.discountTotal || 0) > 0 ? [
                        { label: "Gross Total", value: fmtAED((b.totals?.subtotal || 0) + (b.totals?.discountTotal || 0)) },
                        { label: "Discount",    value: `−${fmtAED(b.totals?.discountTotal)}`, green: true },
                      ] : []),
                      { label: "Subtotal (excl. VAT)", value: fmtAED(b.totals?.subtotal) },
                      { label: "VAT",                  value: fmtAED(b.totals?.taxTotal) },
                      { label: "Grand Total",          value: fmtAED(b.totals?.grandTotal), bold: true },
                      { label: "Amount Paid",          value: fmtAED(b.amountPaid), green: true },
                      { label: "Balance Due",          value: fmtAED(b.balanceDue), red: (b.balanceDue || 0) > 0 },
                    ].map(({ label, value, bold, red, green }, i, arr) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", background: bold ? (isDark ? "rgba(59,130,246,0.06)" : "#eff6ff") : "transparent" }}>
                        <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: red ? "#ef4444" : green ? "#10b981" : bold ? T.blue : T.textPri }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {b.notes && (
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>Notes</p>
                      <p style={{ fontSize: 13, color: T.textPri, margin: 0 }}>{b.notes}</p>
                    </div>
                  )}
                </>)}

                {/* ── PAYMENTS ── */}
                {activeTab === "payments" && (<>
                  {pmtLoading ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: T.textSec }}>
                      <FaSpinner className="bl-spin" style={{ fontSize: 18, display: "block", margin: "0 auto 10px" }} />Loading…
                    </div>
                  ) : billPayments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: T.textSec, margin: "0 auto 12px" }}><FaMoneyBillWave /></div>
                      <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 14, margin: 0 }}>No payments yet</p>
                      <p style={{ color: T.textSec, fontSize: 12, margin: "6px 0 0" }}>Record a payment to reduce the balance</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {billPayments.map((p, i) => (
                        <div key={p._id || i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                            <div>
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: T.blueLight, margin: 0 }}>{p.paymentNumber}</p>
                              <p style={{ fontSize: 12, color: T.textSec, margin: "3px 0 0" }}>{p.paymentMode} · {fmtDate(p.date)}</p>
                            </div>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 800, color: "#10b981" }}>{fmtAED(p.amount)}</span>
                          </div>
                          {p.reference && <p style={{ fontSize: 11, color: T.textSec, margin: "4px 0 0" }}>Ref: {p.reference}</p>}
                          {p.notes     && <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0", fontStyle: "italic" }}>{p.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>)}

                {/* ── Inline record payment form ── */}
                {payModal && canPay && (
                  <div style={{ background: isDark ? "rgba(59,130,246,0.06)" : "#eff6ff", border: `1.5px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, borderRadius: 14, padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <p style={{ fontFamily: "Sora, sans-serif", fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Record Payment</p>
                      <button onClick={() => setPayModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 2 }}><FaTimes size={11} /></button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={lbl}>Amount (AED) *</label>
                        <input type="number" min="0.01" step="0.01" value={payForm.amount}
                          onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder={`Balance: ${fmtAED(b.balanceDue)}`} style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Payment Mode</label>
                        <select value={payForm.paymentMode} onChange={e => setPayForm(f => ({ ...f, paymentMode: e.target.value }))} style={{ ...inp, appearance: "auto" }}>
                          {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Date</label>
                        <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} style={inp} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={lbl}>Reference</label>
                        <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
                          placeholder="Cheque / TT number…" style={inp} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={lbl}>Notes</label>
                        <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Optional…" style={inp} />
                      </div>
                    </div>
                    <button onClick={handleRecordPayment} disabled={paySubmitting}
                      style={{ marginTop: 12, width: "100%", padding: 10, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: paySubmitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit", opacity: paySubmitting ? 0.7 : 1 }}>
                      {paySubmitting ? <><FaSpinner className="bl-spin" size={12} /> Saving…</> : <><FaCheckCircle size={12} /> Confirm Payment</>}
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
                {canPay && !payModal && (
                  <button className="bl-btn" onClick={() => { setPayModal(true); setActiveTab("payments"); }}
                    style={{ flex: 1, padding: 10, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <FaMoneyBillWave size={12} /> Record Payment
                  </button>
                )}
                {canVoid && (
                  <button className="bl-btn" onClick={handleVoid} disabled={voidLoading}
                    style={{ padding: "10px 16px", background: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: voidLoading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    {voidLoading ? "Voiding…" : "Void"}
                  </button>
                )}
                <button className="bl-btn" onClick={closeDrawer}
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
