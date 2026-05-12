import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../helper/axiosInstance";
import useThemeStore from "../../store/useThemeStore";
import nexusToast from "../../helper/nexusToast";

/* ─── Theme builder ──────────────────────────────────────────────────────── */
const buildTheme = (isDark) => ({
  bg:       isDark ? "#0a0e1a"               : "#f1f5f9",
  surface:  isDark ? "#111827"               : "#ffffff",
  surface2: isDark ? "#1a2234"               : "#f8fafc",
  border:   isDark ? "#1e2d47"               : "#e2e8f0",
  accent:   "#f59e0b",
  accent2:  "#10b981",
  red:      "#ef4444",
  blue:     "#3b82f6",
  purple:   "#a78bfa",
  text:     isDark ? "#f1f5f9"               : "#0f172a",
  muted:    "#64748b",
  subtle:   isDark ? "#334155"               : "#94a3b8",
  input:    isDark ? "#0f172a"               : "#ffffff",
  inputBdr: isDark ? "#1e2d47"               : "#e2e8f0",
});

/* mock data removed — invoices loaded from API */

/* ─── Status Config ─────────────────────────────────────────────────────── */
const STATUS = {
  paid:    { label: "Paid",    bg: "rgba(16,185,129,.12)",  border: "rgba(16,185,129,.3)",  text: "#10b981" },
  unpaid:  { label: "Unpaid",  bg: "rgba(245,158,11,.12)",  border: "rgba(245,158,11,.3)",  text: "#f59e0b" },
  sent:    { label: "Sent",    bg: "rgba(139,92,246,.12)",  border: "rgba(139,92,246,.3)",  text: "#8b5cf6" },
  overdue: { label: "Overdue", bg: "rgba(239,68,68,.12)",   border: "rgba(239,68,68,.3)",   text: "#ef4444" },
  partial: { label: "Partial", bg: "rgba(59,130,246,.12)",  border: "rgba(59,130,246,.3)",  text: "#3b82f6" },
  draft:   { label: "Draft",   bg: "rgba(100,116,139,.12)", border: "rgba(100,116,139,.3)", text: "#94a3b8" },
  void:    { label: "Void",    bg: "rgba(30,30,30,.15)",    border: "rgba(100,100,100,.3)", text: "#64748b" },
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const fmt = (n) => `AED ${Number(n).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const COLS = [
  { key: "id",       label: "Invoice #",   w: "14%" },
  { key: "customer", label: "Customer",    w: "18%" },
  { key: "date",     label: "Issue Date",  w: "13%" },
  { key: "due",      label: "Due Date",    w: "13%" },
  { key: "items",    label: "Items",       w: "8%"  },
  { key: "amount",   label: "Amount",      w: "15%" },
  { key: "status",   label: "Status",      w: "12%" },
  { key: "actions",  label: "",            w: "7%"  },
];

const PAGE_SIZE = 8;

/* ─── StatusBadge ───────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      letterSpacing: ".02em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.text, flexShrink: 0 }} />
      {s.label}
    </span>
  );
};

/* ─── StatCard ──────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, sub, accent, icon, T }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
    padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8,
    borderTop: `3px solid ${accent}`,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted }}>{label}</span>
      <span style={{ fontSize: 18 }}>{icon}</span>
    </div>
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, fontWeight: 500, color: T.text }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>}
  </div>
);

/* ─── DrawerTab ─────────────────────────────────────────────────────────── */
const DrawerTab = ({ label, active, onClick, T }) => (
  <button
    onClick={onClick}
    style={{
      background: "none", border: "none", cursor: "pointer", padding: "10px 16px",
      fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? T.accent : T.muted,
      borderBottom: active ? `2px solid ${T.accent}` : "2px solid transparent",
      fontFamily: "'DM Sans', sans-serif", transition: ".15s",
    }}
  >{label}</button>
);

/* ─── API → table row normaliser ────────────────────────────────────────── */
const toRow = (inv) => ({
  id:           inv.invoiceNumber || inv._id,
  _id:          inv._id,
  customer:     inv.billTo?.name || "—",
  customerId:   inv.customerId || "",
  date:         inv.issueDate || inv.createdAt?.split("T")[0] || "",
  due:          inv.dueDate   || "",
  amount:       inv.totals?.grandTotal ?? 0,
  paid:         inv.amountPaid ?? 0,
  balance:      inv.balanceDue  ?? (inv.totals?.grandTotal ?? 0),
  status:       inv.status || "unpaid",
  items:        (inv.lineItems || []).length,
  currency:     inv.currency || "AED",
  paymentTerms: inv.paymentTerms || "",
  lineItems:    inv.lineItems || [],
  notes:        inv.notes || {},
  publicToken:  inv.publicToken || "",
  voidReason:   inv.voidReason || "",
});

/* ─── Payment modes ─────────────────────────────────────────────────────── */
const PAYMENT_MODES = ["Cash", "Bank Transfer", "Cheque", "Card", "Other"];
const MODE_ICONS    = { Cash: "💵", "Bank Transfer": "🏦", Cheque: "📄", Card: "💳", Other: "🔄" };

/* ─── RecordPaymentModal ────────────────────────────────────────────────── */
const RecordPaymentModal = ({ T, isDark, invoice, onClose, onSaved }) => {
  const [form, setForm] = useState({
    customerId:   invoice.customerId,
    customerName: invoice.customer,
    invoiceId:    invoice._id,
    invoiceNumber: invoice.id,
    amount:       invoice.balance > 0 ? invoice.balance.toFixed(2) : "",
    date:         new Date().toISOString().split("T")[0],
    paymentMode:  "Bank Transfer",
    reference:    "",
    notes:        "",
  });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});
  const [modeOpen, setModeOpen] = useState(false);
  const modeRef = useRef(null);

  useEffect(() => {
    const h = e => { if (modeRef.current && !modeRef.current.contains(e.target)) setModeOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const enteredAmt = parseFloat(form.amount) || 0;
  const balanceDue = invoice.balance;
  const remaining  = Math.max(0, balanceDue - enteredAmt);
  const overpay    = enteredAmt > balanceDue && balanceDue > 0;

  const handleSubmit = async () => {
    const e = {};
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = "Enter a valid amount";
    if (!form.date) e.date = "Select a date";
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await axiosInstance.post("/api/payments/", { ...form, amount: Number(form.amount) });
      nexusToast.success(`Payment of ${fmt(Number(form.amount))} recorded`);
      onSaved();
      onClose();
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || "Failed to record payment" });
    } finally { setLoading(false); }
  };

  const inp = {
    width: "100%", padding: "10px 13px",
    background: isDark ? T.input : "#fff",
    border: `1.5px solid ${T.inputBdr}`, borderRadius: 9,
    color: T.text, fontSize: 13, outline: "none",
    fontFamily: "'DM Sans', sans-serif", transition: "border-color .15s",
  };
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6 };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`@keyframes pmtIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{
        background: T.surface, borderRadius: 18, width: 520, maxHeight: "90vh",
        overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,.4)",
        border: `1.5px solid ${T.border}`, animation: "pmtIn .2s ease both",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: T.text }}>💳 Record Payment</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {invoice.id} · {invoice.customer}
            </div>
          </div>
          <button onClick={onClose} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: T.muted, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Invoice summary */}
          <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Invoice Total", value: fmt(invoice.amount), color: T.text },
              { label: "Already Paid",  value: fmt(invoice.paid),   color: "#10b981" },
              { label: "Balance Due",   value: fmt(balanceDue),     color: balanceDue > 0 ? "#ef4444" : "#10b981" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label style={lbl}>Amount Received (AED) <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              type="number" min="0" step="0.01" placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              style={{
                ...inp, fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 600,
                borderColor: errors.amount ? "#ef4444" : overpay ? T.accent : T.inputBdr,
              }}
            />
            {errors.amount && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{errors.amount}</div>}
            {enteredAmt > 0 && (
              <div style={{ marginTop: 8, padding: "10px 13px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: T.muted }}>{overpay ? "Excess Payment" : "Remaining After"}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: overpay ? T.accent : remaining === 0 ? "#10b981" : "#ef4444" }}>
                  {overpay ? `+${fmt(enteredAmt - balanceDue)}` : fmt(remaining)}
                </span>
              </div>
            )}
            {remaining === 0 && !overpay && enteredAmt > 0 && (
              <div style={{ marginTop: 6, padding: "5px 10px", background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 7, fontSize: 11, color: "#10b981", textAlign: "center", fontWeight: 600 }}>
                ✓ This payment will fully settle the invoice
              </div>
            )}
          </div>

          {/* Date + Mode row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={lbl}>Payment Date <span style={{ color: "#ef4444" }}>*</span></label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                style={{ ...inp, borderColor: errors.date ? "#ef4444" : T.inputBdr }} />
              {errors.date && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{errors.date}</div>}
            </div>
            <div ref={modeRef} style={{ position: "relative" }}>
              <label style={lbl}>Payment Mode</label>
              <button type="button" onClick={() => setModeOpen(o => !o)} style={{
                ...inp, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                borderColor: modeOpen ? T.accent : T.inputBdr,
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{MODE_ICONS[form.paymentMode] || "💳"}</span>
                  <span style={{ fontWeight: 500 }}>{form.paymentMode}</span>
                </span>
                <span style={{ fontSize: 10, color: T.muted, transition: "transform .15s", transform: modeOpen ? "rotate(180deg)" : "none" }}>▼</span>
              </button>
              {modeOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
                  background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10,
                  boxShadow: "0 16px 40px rgba(0,0,0,.2)", overflow: "hidden",
                }}>
                  {PAYMENT_MODES.map(m => (
                    <div key={m} onClick={() => { setForm(f => ({ ...f, paymentMode: m })); setModeOpen(false); }}
                      style={{
                        padding: "10px 14px", cursor: "pointer", fontSize: 13, fontWeight: 500,
                        borderBottom: `1px solid ${T.border}`,
                        background: form.paymentMode === m ? "rgba(245,158,11,.08)" : "transparent",
                        display: "flex", alignItems: "center", gap: 10,
                        color: form.paymentMode === m ? T.accent : T.text, transition: "background .1s",
                      }}
                      onMouseEnter={e => { if (form.paymentMode !== m) e.currentTarget.style.background = T.surface2; }}
                      onMouseLeave={e => { if (form.paymentMode !== m) e.currentTarget.style.background = "transparent"; }}>
                      <span>{MODE_ICONS[m]}</span>{m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reference */}
          <div>
            <label style={lbl}>Reference / Cheque No.</label>
            <input style={inp} placeholder="e.g. TXN-001234 or Cheque #456"
              value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, resize: "vertical", minHeight: 56 }} placeholder="Optional internal notes…"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {errors.submit && (
            <div style={{ padding: "10px 13px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 2 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 600,
              cursor: "pointer", background: T.surface2, color: T.muted,
              border: `1.5px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif",
            }}>Cancel</button>
            <button onClick={handleSubmit} disabled={loading} style={{
              flex: 2, padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? .6 : 1,
              background: T.accent, color: "#0a0e1a", border: "none",
              fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 14px rgba(245,158,11,.3)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {loading ? "Saving…" : "✓ Record Payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Component ────────────────────────────────────────────────────── */
const Invoices = () => {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = buildTheme(isDark);

  /* data */
  const [invoices,     setInvoices]    = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [voidLoading,  setVoidLoading] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);

  const loadInvoices = useCallback(() => {
    setLoading(true);
    axiosInstance.get("/api/invoices")
      .then(res => setInvoices((res.data?.data?.invoices || []).map(toRow)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  /* filters */
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey,      setSortKey]      = useState("date");
  const [sortDir,      setSortDir]      = useState("desc");
  const [page,         setPage]         = useState(1);

  /* drawer */
  const [selected,       setSelected]      = useState(null);
  const [drawerTab,      setDrawerTab]     = useState("overview");
  const [linkedCNs,      setLinkedCNs]     = useState([]);
  const [cnLoading,      setCnLoading]     = useState(false);
  const [linkedPayments, setLinkedPayments] = useState([]);
  const [pmtLoading,     setPmtLoading]    = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);

  useEffect(() => {
    if (!selected || drawerTab !== "credits") return;
    setCnLoading(true);
    axiosInstance.get(`/api/credit-notes/by-invoice/${selected._id}`)
      .then(res => setLinkedCNs(res.data?.data || []))
      .catch(() => setLinkedCNs([]))
      .finally(() => setCnLoading(false));
  }, [selected, drawerTab]);

  useEffect(() => {
    if (!selected || drawerTab !== "payments") return;
    setPmtLoading(true);
    axiosInstance.get(`/api/payments/?invoiceId=${selected._id}`)
      .then(res => setLinkedPayments(res.data?.data?.payments || []))
      .catch(() => setLinkedPayments([]))
      .finally(() => setPmtLoading(false));
  }, [selected, drawerTab]);

  /* derived */
  const filtered = useMemo(() => {
    let data = [...invoices];
    if (search)                data = data.filter(i => `${i.id} ${i.customer}`.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") data = data.filter(i => i.status === statusFilter);
    data.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return data;
  }, [invoices, search, statusFilter, sortKey, sortDir]);

  const pages    = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = useCallback((key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }, [sortKey]);

  const handleSearch       = (e) => { setSearch(e.target.value); setPage(1); };
  const handleStatusFilter = (s) => { setStatusFilter(s); setPage(1); };

  /* stats */
  const stats = useMemo(() => {
    const total    = invoices.reduce((s, i) => s + i.amount, 0);
    const received = invoices.reduce((s, i) => s + i.paid,   0);
    const overdue  = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
    return { total, received, outstanding: total - received, overdue };
  }, [invoices]);

  /* drawer line items mapped for display */
  const drawerItems = selected
    ? selected.lineItems.map(li => ({
        desc:         li.desc || "—",
        qty:          li.qty  ?? 0,
        price:        li.unitPrice ?? 0,
        tax:          li.taxRate   ?? 5,
        amt:          li.total     ?? 0,
        discountAed:  li.discountAed ?? li.discountAED ?? 0,
        discountType: li.discountType || "fixed",
        discount:     li.discount ?? 0,
      }))
    : [];
  const drawerHistory = [];

  /* ── Styles shared ── */
  const inputStyle = {
    background: T.input, border: `1px solid ${T.border}`, color: T.text,
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "8px 12px",
    borderRadius: 7, outline: "none",
  };

  const thStyle = (key) => ({
    fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase",
    color: sortKey === key ? T.accent : T.muted,
    padding: "0 12px 10px", textAlign: "left", cursor: key !== "actions" ? "pointer" : "default",
    userSelect: "none", whiteSpace: "nowrap",
    borderBottom: `1px solid ${T.border}`,
  });

  const tdStyle = {
    padding: "12px", fontSize: 13, color: T.text,
    borderBottom: `1px solid rgba(30,45,71,.5)`, verticalAlign: "middle",
  };

  const SortArrow = ({ col }) => {
    if (sortKey !== col) return <span style={{ color: T.subtle, marginLeft: 4 }}>↕</span>;
    return <span style={{ color: T.accent, marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=DM+Sans:wght@400;500&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        .inv-row:hover td { background: rgba(245,158,11,.03) !important; }
        .inv-row { cursor: pointer; }
        .filter-pill { transition: .15s; }
        .filter-pill:hover { border-color: rgba(245,158,11,.4) !important; color: ${T.text} !important; }
        .action-btn { transition: .15s; }
        .action-btn:hover { background: rgba(245,158,11,.1) !important; color: #f59e0b !important; }
        input:focus { border-color: rgba(245,158,11,.5) !important; box-shadow: 0 0 0 3px rgba(245,158,11,.08) !important; outline: none; }
        select:focus { outline: none; }
        select option { background: ${T.surface}; color: ${T.text}; }
      `}</style>

      <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: ".05em", color: T.accent }}>Nexus</span>
              <span style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>ERP</span>
            </div>
            <span style={{ color: T.border }}>|</span>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 600 }}>Invoices</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...inputStyle, padding: "7px 14px", cursor: "pointer", fontSize: 13, transition: ".15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.subtle}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
            >Export</button>
            <button
              onClick={() => navigate("/Sales/Createinvoices")}
              style={{ padding: "7px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: T.accent, color: "#0a0e1a", border: "none", transition: ".15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#fbbf24"}
              onMouseLeave={e => e.currentTarget.style.background = T.accent}
            >+ New Invoice</button>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "24px 28px 0" }}>
          <StatCard T={T} label="Total Invoiced"  value={fmt(stats.total)}       sub={`${invoices.length} invoices`}                                          accent={T.accent}  icon="📄" />
          <StatCard T={T} label="Total Received"  value={fmt(stats.received)}    sub={`${invoices.filter(i=>i.status==="paid").length} paid`}              accent={T.accent2} icon="✅" />
          <StatCard T={T} label="Outstanding"     value={fmt(stats.outstanding)} sub="Awaiting payment"                                                    accent={T.blue}    icon="⏳" />
          <StatCard T={T} label="Overdue"         value={fmt(stats.overdue)}     sub={`${invoices.filter(i=>i.status==="overdue").length} invoices past due`} accent={T.red}  icon="⚠️" />
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px 0", flexWrap: "wrap", gap: 12 }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "0 0 280px" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 14, pointerEvents: "none" }}>🔍</span>
            <input
              value={search}
              onChange={handleSearch}
              placeholder="Search invoice # or customer…"
              style={{ ...inputStyle, paddingLeft: 36, width: "100%", transition: ".15s" }}
            />
          </div>

          {/* Status pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", "sent", "paid", "unpaid", "overdue", "partial", "draft", "void"].map(s => {
              const active = statusFilter === s;
              const cfg    = STATUS[s];
              return (
                <button
                  key={s}
                  className="filter-pill"
                  onClick={() => handleStatusFilter(s)}
                  style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", transition: ".15s",
                    background: active ? (cfg?.bg || "rgba(245,158,11,.12)") : "transparent",
                    border: `1px solid ${active ? (cfg?.border || T.accent) : T.border}`,
                    color: active ? (cfg?.text || T.accent) : T.muted,
                    textTransform: "capitalize",
                  }}
                >{s === "all" ? `All (${invoices.length})` : `${STATUS[s]?.label} (${invoices.filter(i => i.status === s).length})`}</button>
              );
            })}
          </div>

          {/* Sort select */}
          <select
            value={sortKey}
            onChange={e => { setSortKey(e.target.value); setSortDir("desc"); setPage(1); }}
            style={{ ...inputStyle, cursor: "pointer", minWidth: 140 }}
          >
            <option value="date">Sort: Issue Date</option>
            <option value="due">Sort: Due Date</option>
            <option value="amount">Sort: Amount</option>
            <option value="customer">Sort: Customer</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>

        {/* ── Table ── */}
        <div style={{ margin: "16px 28px 0", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                {COLS.map(c => <col key={c.key} style={{ width: c.w }} />)}
              </colgroup>
              <thead>
                <tr>
                  {COLS.map(c => (
                    <th key={c.key} style={thStyle(c.key)} onClick={() => c.key !== "actions" && handleSort(c.key)}>
                      {c.label}{c.key !== "actions" && c.key !== "items" && <SortArrow col={c.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLS.length} style={{ ...tdStyle, textAlign: "center", color: T.muted, padding: "48px 0" }}>Loading invoices…</td></tr>
                ) : pageData.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length} style={{ ...tdStyle, textAlign: "center", color: T.muted, padding: "48px 0" }}>
                      No invoices found.
                    </td>
                  </tr>
                ) : pageData.map(inv => (
                  <tr key={inv.id} className="inv-row" onClick={() => { setSelected(inv); setDrawerTab("overview"); }}>
                    <td style={tdStyle}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.accent, fontWeight: 500 }}>{inv.id}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{inv.customer}</div>
                    </td>
                    <td style={{ ...tdStyle, color: T.muted, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{fmtDate(inv.date)}</td>
                    <td style={{
                      ...tdStyle,
                      color: inv.status === "overdue" ? T.red : T.muted,
                      fontFamily: "'DM Mono', monospace", fontSize: 12,
                      fontWeight: inv.status === "overdue" ? 600 : 400,
                    }}>{fmtDate(inv.due)}</td>
                    <td style={{ ...tdStyle, color: T.muted, textAlign: "center" }}>{inv.items}</td>
                    <td style={{ ...tdStyle, fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
                      <div>{fmt(inv.amount)}</div>
                      {inv.paid > 0 && inv.paid < inv.amount && (
                        <div style={{ fontSize: 11, color: T.accent2, marginTop: 2 }}>Paid: {fmt(inv.paid)}</div>
                      )}
                    </td>
                    <td style={tdStyle}><StatusBadge status={inv.status} /></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <button
                        className="action-btn"
                        onClick={e => { e.stopPropagation(); setSelected(inv); setDrawerTab("overview"); }}
                        style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
                      >View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: T.muted }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} invoices
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: page === 1 ? "not-allowed" : "pointer", background: "transparent", border: `1px solid ${T.border}`, color: page === 1 ? T.subtle : T.muted, fontFamily: "'DM Sans', sans-serif" }}
              >← Prev</button>
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: ".15s",
                    background: page === p ? T.accent       : "transparent",
                    color:      page === p ? "#0a0e1a"      : T.muted,
                    border:     page === p ? "none"         : `1px solid ${T.border}`,
                    fontWeight: page === p ? 700 : 400,
                  }}
                >{p}</button>
              ))}
              <button
                disabled={page === pages}
                onClick={() => setPage(p => p + 1)}
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: page === pages ? "not-allowed" : "pointer", background: "transparent", border: `1px solid ${T.border}`, color: page === pages ? T.subtle : T.muted, fontFamily: "'DM Sans', sans-serif" }}
              >Next →</button>
            </div>
          </div>
        </div>

        {/* bottom padding */}
        <div style={{ height: 32 }} />

        {/* ── Detail Drawer ── */}
        {selected && (
          <>
            {/* Overlay */}
            <div
              onClick={() => setSelected(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 40, backdropFilter: "blur(2px)" }}
            />
            {/* Panel */}
            <div style={{
              position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
              background: T.surface, borderLeft: `1px solid ${T.border}`,
              zIndex: 50, display: "flex", flexDirection: "column",
              animation: "slideIn .2s ease",
            }}>
              <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

              {/* Drawer Header */}
              <div style={{ padding: "20px 24px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: T.accent, fontWeight: 500 }}>{selected.id}</div>
                    <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 600, marginTop: 4 }}>{selected.customer}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusBadge status={selected.status} />
                    <button
                      onClick={() => setSelected(null)}
                      style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 6px" }}
                    >×</button>
                  </div>
                </div>
                {/* Drawer Tabs */}
                <div style={{ display: "flex", gap: 0, marginTop: 8 }}>
                  {["overview", "items", "payments", "credits", "history"].map(tab => (
                    <DrawerTab key={tab} T={T} label={tab.charAt(0).toUpperCase() + tab.slice(1)} active={drawerTab === tab} onClick={() => setDrawerTab(tab)} />
                  ))}
                </div>
              </div>

              {/* Drawer Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

                {/* ── Overview Tab ── */}
                {drawerTab === "overview" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Amount summary */}
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {[
                          { label: "Invoice Total", val: fmt(selected.amount),  color: T.text },
                          { label: "Paid",          val: fmt(selected.paid),    color: T.accent2 },
                          { label: "Balance Due",   val: fmt(selected.balance), color: selected.balance > 0 ? T.accent : T.accent2 },
                          { label: "Tax (VAT)",     val: fmt(selected.amount - selected.amount / 1.05), color: T.muted },
                        ].map(({ label, val, color }) => (
                          <div key={label}>
                            <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 500, color }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Details grid */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                      {[
                        { label: "Issue Date",     val: fmtDate(selected.date) },
                        { label: "Due Date",       val: fmtDate(selected.due), warn: selected.status === "overdue" },
                        { label: "Customer",       val: selected.customer },
                        { label: "Currency",       val: selected.currency },
                        { label: "Line Items",     val: `${selected.items} items` },
                        { label: "Payment Terms",  val: selected.paymentTerms || "—" },
                      ].map(({ label, val, warn }, idx, arr) => (
                        <div key={label} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "11px 16px",
                          borderBottom: idx < arr.length - 1 ? `1px solid ${T.border}` : "none",
                        }}>
                          <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: warn ? T.red : T.text }}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                      {/* Void banner */}
                      {selected.status === "void" && (
                        <div style={{ padding: "10px 14px", borderRadius: 7, background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.25)", fontSize: 12, color: "#94a3b8" }}>
                          🚫 This invoice has been voided{selected.voidReason ? ` — ${selected.voidReason}` : ""}.
                        </div>
                      )}

                      {/* Draft-only actions */}
                      {selected.status === "draft" && (
                        <>
                          <button
                            disabled={issueLoading}
                            onClick={async () => {
                              setIssueLoading(true);
                              try {
                                await axiosInstance.patch(`/api/invoices/${selected._id}/status`, { status: "sent" });
                                setSelected(null); loadInvoices();
                                nexusToast.success("Invoice issued and marked as Sent");
                              } catch (e) {
                                nexusToast.error(e.response?.data?.message || "Failed to issue invoice");
                              } finally { setIssueLoading(false); }
                            }}
                            style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: issueLoading ? "not-allowed" : "pointer", background: T.accent, color: "#0a0e1a", border: "none", fontFamily: "'DM Sans', sans-serif", width: "100%", opacity: issueLoading ? 0.6 : 1 }}>
                            {issueLoading ? "Issuing…" : "✓ Issue Invoice"}
                          </button>
                          <button
                            onClick={() => navigate("/Sales/Createinvoices", { state: { editDraft: selected } })}
                            style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", border: `1px solid ${T.border}`, color: T.text, fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                            ✎ Edit Draft
                          </button>
                        </>
                      )}

                      {/* Send Invoice / Send Reminder */}
                      {["draft", "sent", "unpaid", "overdue", "partial"].includes(selected.status) && (
                        <button
                          onClick={async () => {
                            const email = window.prompt("Send to email address:", selected.customerEmail || "");
                            if (email === null) return;
                            try {
                              await axiosInstance.post(`/api/invoices/${selected._id}/send`, { toEmail: email || undefined });
                              nexusToast.success("Invoice sent successfully");
                              loadInvoices();
                            } catch (e) {
                              nexusToast.error(e.response?.data?.message || "Failed to send invoice");
                            }
                          }}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: T.blue, fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          📧 Send Invoice
                        </button>
                      )}

                      {selected.status === "overdue" && (
                        <button
                          onClick={async () => {
                            const email = window.prompt("Send reminder to:", selected.customerEmail || "");
                            if (email === null) return;
                            try {
                              await axiosInstance.post(`/api/invoices/${selected._id}/send-reminder`, { toEmail: email || undefined });
                              nexusToast.success("Payment reminder sent");
                            } catch (e) {
                              nexusToast.error(e.response?.data?.message || "Failed to send reminder");
                            }
                          }}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          🔔 Send Reminder
                        </button>
                      )}

                      {/* Record payment — sent/unpaid/overdue/partial */}
                      {["sent", "unpaid", "overdue", "partial"].includes(selected.status) && (
                        <button
                          onClick={() => setPaymentInvoice(selected)}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.accent, color: "#0a0e1a", border: "none", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          💳 Record Payment
                        </button>
                      )}

                      {/* Credit note — paid or partial */}
                      {(selected.status === "paid" || selected.status === "partial") && (
                        <button
                          onClick={() => navigate("/Sales/CreditNotes", {
                            state: {
                              prefill: {
                                customerId:    selected.customerId,
                                customerName:  selected.customer,
                                invoiceId:     selected._id,
                                invoiceNumber: selected.id,
                              }
                            }
                          })}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: T.blue, fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          📋 Raise Credit Note
                        </button>
                      )}

                      {/* Clone invoice */}
                      <button
                        onClick={() => navigate("/Sales/Createinvoices", {
                          state: {
                            clone: {
                              customerId:   selected.customerId,
                              customerName: selected.customer,
                              lineItems:    selected.lineItems,
                              notes:        selected.notes,
                              paymentTerms: selected.paymentTerms,
                            }
                          }
                        })}
                        style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.28)", color: "#f59e0b", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                        📄 Clone Invoice
                      </button>

                      {/* Shareable link */}
                      {selected.publicToken && (
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/invoice/public/${selected.publicToken}`;
                            navigator.clipboard.writeText(url);
                            nexusToast.success("Invoice link copied to clipboard");
                          }}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#8b5cf6", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          🔗 Copy Shareable Link
                        </button>
                      )}

                      {/* Void */}
                      {selected.status !== "void" && selected.status !== "paid" && (
                        <button
                          disabled={voidLoading}
                          onClick={async () => {
                            const reason = window.prompt(`Reason for voiding ${selected.id}? (optional)`);
                            if (reason === null) return; // cancelled
                            setVoidLoading(true);
                            try {
                              await axiosInstance.patch(`/api/invoices/${selected._id}/void`, { reason });
                              setSelected(null); loadInvoices();
                              nexusToast.success("Invoice voided");
                            } catch (e) {
                              nexusToast.error(e.response?.data?.message || "Failed to void invoice");
                            } finally { setVoidLoading(false); }
                          }}
                          style={{ padding: "8px 0", borderRadius: 7, fontSize: 12, cursor: voidLoading ? "not-allowed" : "pointer", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontFamily: "'DM Sans', sans-serif", opacity: voidLoading ? 0.6 : 1 }}>
                          {voidLoading ? "Voiding…" : "Void Invoice"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Items Tab ── */}
                {drawerTab === "items" && (
                  <div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Description", "Qty", "Unit Price", "Discount", "Tax", "Total"].map((h, i) => (
                            <th key={h} style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, padding: "0 8px 10px", textAlign: i === 0 ? "left" : "right", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {drawerItems.map((item, i) => (
                          <tr key={i}>
                            <td style={{ ...tdStyle, padding: "10px 8px", fontSize: 13 }}>{item.desc}</td>
                            <td style={{ ...tdStyle, padding: "10px 8px", textAlign: "right", color: T.muted, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{item.qty}</td>
                            <td style={{ ...tdStyle, padding: "10px 8px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>AED {item.price.toFixed(2)}</td>
                            <td style={{ ...tdStyle, padding: "10px 8px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, color: item.discountAed > 0 ? "#10b981" : T.muted }}>
                              {item.discountAed > 0
                                ? (item.discountType === "percentage"
                                    ? `${item.discount}% (AED ${Number(item.discountAed).toFixed(2)})`
                                    : `AED ${Number(item.discountAed).toFixed(2)}`)
                                : "—"}
                            </td>
                            <td style={{ ...tdStyle, padding: "10px 8px", textAlign: "right", color: T.muted, fontSize: 12 }}>{item.tax}%</td>
                            <td style={{ ...tdStyle, padding: "10px 8px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500 }}>AED {item.amt.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Totals summary */}
                    <div style={{ marginTop: 16, background: T.surface2, borderRadius: 8, border: `1px solid ${T.border}`, padding: 14 }}>
                      {(() => {
                        const totalDiscount = drawerItems.reduce((s, li) => s + (Number(li.discountAed) || 0), 0);
                        const subtotalBeforeDiscount = drawerItems.reduce((s, li) => s + (li.qty * li.price), 0);
                        const subtotalAfterDiscount = subtotalBeforeDiscount - totalDiscount;
                        const vat = subtotalAfterDiscount * 0.05;
                        const rows = [
                          { label: "Subtotal", val: `AED ${subtotalBeforeDiscount.toFixed(2)}` },
                          ...(totalDiscount > 0 ? [{ label: "Discount", val: `-AED ${totalDiscount.toFixed(2)}`, color: "#10b981" }] : []),
                          { label: "VAT (5%)", val: `AED ${vat.toFixed(2)}` },
                        ];
                        return rows.map(({ label, val, color }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                            <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: color || T.text }}>{val}</span>
                          </div>
                        ));
                      })()}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 8, borderTop: `1px solid ${T.border}` }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 500, color: T.accent }}>{fmt(selected.amount)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Payments Tab ── */}
                {drawerTab === "payments" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>Payments Recorded</p>
                      {["sent", "unpaid", "overdue", "partial"].includes(selected.status) && (
                        <button
                          onClick={() => setPaymentInvoice(selected)}
                          style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: T.accent, color: "#0a0e1a", border: "none" }}>
                          + Record Payment
                        </button>
                      )}
                    </div>
                    {pmtLoading ? (
                      <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: 13 }}>Loading…</div>
                    ) : linkedPayments.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "48px 0", color: T.muted, fontSize: 13 }}>
                        <div style={{ fontSize: 28, marginBottom: 10 }}>💳</div>
                        No payments recorded for this invoice
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {linkedPayments.map((p, i) => {
                          const modeColor = { Cash: "#10b981", "Bank Transfer": "#3b82f6", Cheque: "#f59e0b", Card: "#8b5cf6", Other: "#64748b" }[p.paymentMode] || "#64748b";
                          return (
                            <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, padding: "12px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.blue, fontWeight: 600 }}>{p.paymentNumber}</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: `${modeColor}18`, color: modeColor, border: `1px solid ${modeColor}30` }}>
                                      {p.paymentMode || "Other"}
                                    </span>
                                    {p.reference && (
                                      <span style={{ fontSize: 11, color: T.muted }}>Ref: {p.reference}</span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: "#10b981", margin: 0 }}>
                                    {fmt(p.amount)}
                                  </p>
                                  <p style={{ fontSize: 11, color: T.muted, margin: "3px 0 0" }}>
                                    {p.date ? new Date(p.date).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ marginTop: 4, padding: "10px 14px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: T.muted }}>Total paid</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#10b981" }}>
                            {fmt(linkedPayments.reduce((s, p) => s + (p.amount || 0), 0))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Credits Tab ── */}
                {drawerTab === "credits" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>Credit Notes Applied</p>
                      <button
                        onClick={() => navigate("/Sales/CreditNotes", {
                          state: {
                            prefill: {
                              customerId:    selected.customerId,
                              customerName:  selected.customer,
                              invoiceId:     selected._id,
                              invoiceNumber: selected.id,
                            }
                          }
                        })}
                        style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: T.blue }}>
                        + New Credit Note
                      </button>
                    </div>

                    {cnLoading ? (
                      <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: 13 }}>Loading…</div>
                    ) : linkedCNs.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "48px 0", color: T.muted, fontSize: 13 }}>
                        <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                        No credit notes linked to this invoice
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {linkedCNs.map((cn, i) => {
                          const statusColor = {
                            draft: "#94a3b8", pending_approval: "#f59e0b", approved: "#8b5cf6",
                            applied: "#10b981", closed: "#64748b", void: "#ef4444",
                          }[cn.status] || "#64748b";
                          return (
                            <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, padding: "12px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.blue, fontWeight: 600 }}>{cn.creditNoteNumber}</span>
                                  <p style={{ fontSize: 12, color: T.muted, margin: "3px 0 0" }}>{cn.reason || "—"}</p>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                                    {cn.status}
                                  </span>
                                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: T.text, margin: "5px 0 0" }}>
                                    AED {Number(cn.totals?.grandTotal || 0).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: T.muted }}>Total credits applied</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#10b981" }}>
                            AED {linkedCNs.filter(cn => ["applied","closed"].includes(cn.status)).reduce((s, cn) => s + (cn.totals?.grandTotal || 0), 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── History Tab ── */}
                {drawerTab === "history" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {drawerHistory.map((h, i) => (
                      <div key={i} style={{ display: "flex", gap: 14, paddingBottom: 20, position: "relative" }}>
                        {/* Timeline line */}
                        {i < drawerHistory.length - 1 && (
                          <div style={{ position: "absolute", left: 7, top: 18, bottom: 0, width: 1, background: T.border }} />
                        )}
                        {/* Dot */}
                        <div style={{ width: 15, height: 15, borderRadius: "50%", background: T.accent2, flexShrink: 0, marginTop: 2, border: `2px solid ${T.surface}`, position: "relative", zIndex: 1 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{h.event}</div>
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                            {fmtDate(h.date)} · {h.user}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Payment status */}
                    {selected.paid > 0 && (
                      <div style={{ display: "flex", gap: 14 }}>
                        <div style={{ width: 15, height: 15, borderRadius: "50%", background: T.accent, flexShrink: 0, marginTop: 2, border: `2px solid ${T.surface}`, position: "relative", zIndex: 1 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>Payment received — {fmt(selected.paid)}</div>
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>Bank Transfer · Auto-recorded</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {paymentInvoice && (
        <RecordPaymentModal
          T={T}
          isDark={isDark}
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSaved={() => { loadInvoices(); setSelected(null); }}
        />
      )}
    </>
  );
};

export default Invoices;