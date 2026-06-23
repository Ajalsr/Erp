import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReactDOM from "react-dom";
import DatePicker from "react-datepicker";
import { format, addDays, addMonths, isSameDay } from "date-fns";
import axiosInstance from "../../helper/axiosInstance";
import useRealtime from "../../helper/useRealtime";
import useThemeStore from "../../store/useThemeStore";
import nexusToast from "../../helper/nexusToast";
import { usePermissions } from "../../helper/permissions";
import CreditNotes from "../CreditNotes/CreditNotes";
import "react-datepicker/dist/react-datepicker.css";

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
  paid:     { label: "Paid",     bg: "rgba(16,185,129,.12)",  border: "rgba(16,185,129,.3)",  text: "#10b981" },
  unpaid:   { label: "Unpaid",   bg: "rgba(245,158,11,.12)",  border: "rgba(245,158,11,.3)",  text: "#f59e0b" },
  overdue:  { label: "Overdue",  bg: "rgba(239,68,68,.12)",   border: "rgba(239,68,68,.3)",   text: "#ef4444" },
  partial:  { label: "Partial",  bg: "rgba(59,130,246,.12)",  border: "rgba(59,130,246,.3)",  text: "#3b82f6" },
  draft:    { label: "Draft",    bg: "rgba(100,116,139,.12)", border: "rgba(100,116,139,.3)", text: "#94a3b8" },
  void:     { label: "Void",     bg: "rgba(30,30,30,.15)",    border: "rgba(100,100,100,.3)", text: "#64748b" },
  proforma: { label: "Proforma", bg: "rgba(124,58,237,.12)",  border: "rgba(124,58,237,.3)",  text: "#7c3aed" },
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const fmt = (n) => `AED ${Number(n).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const COLS = [
  { key: "sel",      label: "",            w: "4%"  },
  { key: "id",       label: "Invoice #",   w: "13%" },
  { key: "customer", label: "Customer",    w: "17%" },
  { key: "date",     label: "Issue Date",  w: "12%" },
  { key: "due",      label: "Due Date",    w: "12%" },
  { key: "items",    label: "Items",       w: "7%"  },
  { key: "amount",   label: "Amount",      w: "14%" },
  { key: "status",   label: "Status",      w: "11%" },
  { key: "actions",  label: "",            w: "7%"  },
];

const PAGE_SIZE = 200;

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
  status:       inv.type === "proforma" ? "proforma" : (inv.status === "sent" ? "unpaid" : (inv.status || "unpaid")),
  docType:      inv.type || "invoice",
  proformaConvertedTo:       inv.proformaConvertedTo || "",
  proformaConvertedToNumber: inv.proformaConvertedToNumber || "",
  items:        (inv.lineItems || []).filter(li => li._type !== "expense" && li.stockId).length,
  currency:     inv.currency || "AED",
  paymentTerms: inv.paymentTerms || "",
  lineItems:    inv.lineItems || [],
  notes:        inv.notes || {},
  publicToken:   inv.publicToken || "",
  voidReason:    inv.voidReason || "",
  salesReturns:  inv.salesReturns || [],
});

/* ─── Payment modes ─────────────────────────────────────────────────────── */
const PAYMENT_MODES = [
  "Cash", "Bank Transfer", "Cheque", "PDC",
  "Credit Card", "Debit Card", "Demand Draft",
  "Online Transfer", "Letter of Credit", "Other",
];
const MODE_ICONS = {
  "Cash": "💵", "Bank Transfer": "🏦", "Cheque": "📄", "PDC": "📋",
  "Credit Card": "💳", "Debit Card": "💳", "Demand Draft": "📜",
  "Online Transfer": "🌐", "Letter of Credit": "📃", "Other": "🔄",
};
const MODE_ACCENT = ["#2563eb","#9333ea","#16a34a","#ea580c","#94a3b8"];
const MODE_FIELDS = {
  "Cash":             [], // Receipt No. auto-generated (the payment number) — no manual entry.
  "Bank Transfer":    [{ key: "bankName",     label: "Bank Name",            placeholder: "e.g. Emirates NBD" },
                       { key: "txnRef",       label: "Transaction Ref No.",  placeholder: "e.g. TXN-001234", required: true },
                       { key: "accountNo",    label: "Account / IBAN",       placeholder: "e.g. AE070331234567890123456" }],
  "Cheque":           [{ key: "chequeNo",     label: "Cheque No.",           placeholder: "e.g. 001234", required: true },
                       { key: "bankName",     label: "Bank Name",            placeholder: "e.g. ADIB" },
                       { key: "branch",       label: "Branch",               placeholder: "e.g. Dubai Mall Branch" }],
  "PDC":              [{ key: "chequeNo",     label: "Cheque No.",           placeholder: "e.g. 001234", required: true },
                       { key: "chequeDate",   label: "Cheque Date",          placeholder: "", type: "date", required: true },
                       { key: "bankName",     label: "Bank Name",            placeholder: "e.g. Mashreq Bank" },
                       { key: "branch",       label: "Branch",               placeholder: "e.g. DIFC Branch" }],
  "Credit Card":      [{ key: "cardNetwork",  label: "Card Network",         type: "select", options: ["Visa", "Mastercard", "Amex", "Other"] },
                       { key: "last4",        label: "Last 4 Digits",        placeholder: "e.g. 4242" },
                       { key: "approvalCode", label: "Approval Code",        placeholder: "e.g. 123456" }],
  "Debit Card":       [{ key: "cardNetwork",  label: "Card Network",         type: "select", options: ["Visa", "Mastercard", "Other"] },
                       { key: "last4",        label: "Last 4 Digits",        placeholder: "e.g. 4242" },
                       { key: "txnRef",       label: "Transaction Ref",      placeholder: "e.g. TXN-001234" }],
  "Demand Draft":     [{ key: "ddNo",         label: "DD No.",               placeholder: "e.g. DD-001234", required: true },
                       { key: "bankName",     label: "Bank Name",            placeholder: "e.g. HDFC Bank" },
                       { key: "branch",       label: "Branch",               placeholder: "e.g. Main Branch" }],
  "Online Transfer":  [{ key: "platform",     label: "Platform",             type: "select", options: ["NEFT", "RTGS", "IMPS", "UPI", "Wire Transfer", "Other"] },
                       { key: "txnRef",       label: "Reference / UTR No.",  placeholder: "e.g. UTR12345678", required: true }],
  "Letter of Credit": [{ key: "lcNo",         label: "LC No.",               placeholder: "e.g. LC-001234", required: true },
                       { key: "issuingBank",  label: "Issuing Bank",         placeholder: "e.g. First Abu Dhabi Bank" },
                       { key: "lcDate",       label: "LC Date",              placeholder: "", type: "date" }],
  "Other":            [{ key: "txnRef",       label: "Reference / Description", placeholder: "Enter reference or description" }],
};
const getPrimaryRef = (mode, d = {}) => {
  if (["Bank Transfer", "Online Transfer", "Debit Card", "Other"].includes(mode)) return d.txnRef || "";
  if (["Cheque", "PDC"].includes(mode)) return d.chequeNo ? `CHQ-${d.chequeNo}` : "";
  if (mode === "Demand Draft")     return d.ddNo || "";
  if (mode === "Letter of Credit") return d.lcNo || "";
  if (mode === "Credit Card")      return d.approvalCode ? `APPR-${d.approvalCode}` : "";
  if (mode === "Cash")             return d.receiptNo || "";
  return "";
};

/* ─── PaymentDatePicker ─────────────────────────────────────────────────── */
const PMT_PRESETS = [
  { label: "Today",     fn: () => new Date() },
  { label: "Yesterday", fn: () => addDays(new Date(), -1) },
  { label: "Last Week", fn: () => addDays(new Date(), -7) },
  { label: "Last Month",fn: () => addMonths(new Date(), -1) },
];

const PaymentDatePicker = ({ value, onChange, T }) => {
  const [open,    setOpen]  = useState(false);
  const [dpMode,  setDpMode] = useState("calendar");
  const triggerRef = useRef(null);
  const portalRef  = useRef(null);
  const [pos,     setPos]   = useState({ top: 0, left: 0, width: 0, above: false });
  const PANEL_H = 360;
  const sel = value ? new Date(value) : null;

  const updatePos = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const above = spaceBelow < PANEL_H + 16 && r.top > PANEL_H + 16;
      setPos({ top: above ? r.top : r.bottom, left: r.left, width: r.width, above });
    }
  };

  useEffect(() => { if (open) updatePos(); }, [open]);
  useEffect(() => {
    const h = e => {
      if (!triggerRef.current?.contains(e.target) && !portalRef.current?.contains(e.target))
        setOpen(false);
    };
    const onScroll = e => { if (open && !portalRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", h); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);

  const handlePick = (d) => { onChange(d.toISOString().split("T")[0]); setOpen(false); setDpMode("calendar"); };

  const panel = open ? ReactDOM.createPortal(
    <div ref={portalRef} style={{
      position: "fixed", zIndex: 20000,
      ...(pos.above ? { bottom: window.innerHeight - pos.top + 6 } : { top: pos.top + 6 }),
      left: pos.left, width: Math.max(pos.width, 320),
      background: T.surface, borderRadius: 16, border: `1.5px solid ${T.border}`,
      boxShadow: "0 24px 60px rgba(0,0,0,.3)", overflow: "hidden",
      animation: "pmtDpIn .15s ease both",
    }}>
      <style>{`
        @keyframes pmtDpIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .inv-dp .react-datepicker{font-family:'DM Sans',sans-serif!important;border:none!important;border-radius:0!important;box-shadow:none!important;background:${T.surface}!important;width:100%!important;}
        .inv-dp .react-datepicker__header{background:${T.surface2}!important;border-bottom:1.5px solid ${T.border}!important;border-radius:0!important;padding-top:12px!important;}
        .inv-dp .react-datepicker__current-month{font-size:14px!important;font-weight:700!important;color:${T.text}!important;}
        .inv-dp .react-datepicker__day-name{color:${T.muted}!important;font-size:11px!important;font-weight:600!important;}
        .inv-dp .react-datepicker__day{border-radius:8px!important;font-size:12px!important;color:${T.text}!important;transition:all .1s!important;}
        .inv-dp .react-datepicker__day:hover{background:rgba(245,158,11,.15)!important;color:#f59e0b!important;}
        .inv-dp .react-datepicker__day--selected{background:#f59e0b!important;color:#0a0e1a!important;font-weight:700!important;}
        .inv-dp .react-datepicker__day--today{background:rgba(245,158,11,.12)!important;color:#f59e0b!important;font-weight:700!important;}
        .inv-dp .react-datepicker__day--outside-month{color:${T.muted}!important;opacity:.4!important;}
        .inv-dp .react-datepicker__month-container{width:100%!important;}
        .inv-dp .react-datepicker__navigation{top:14px!important;}
      `}</style>
      <div style={{ display: "flex", borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
        {[["calendar","📅","Calendar"],["presets","⚡","Quick"]].map(([v, icon, lbl]) => (
          <button key={v} onClick={() => setDpMode(v)} style={{
            flex: 1, padding: "11px 8px", fontSize: 12, fontWeight: 700, border: "none",
            cursor: "pointer", background: "transparent", color: dpMode === v ? T.accent : T.muted,
            borderBottom: dpMode === v ? `2px solid ${T.accent}` : "2px solid transparent",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "'DM Sans', sans-serif", transition: "all .15s",
          }}><span>{icon}</span>{lbl}</button>
        ))}
      </div>
      <div style={{ padding: "14px 14px 10px" }} className="inv-dp">
        {dpMode === "calendar" ? (
          <DatePicker selected={sel} onChange={handlePick} inline
            renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
                <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface2, cursor: "pointer", color: T.muted, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>‹</button>
                <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 14, color: T.text }}>{format(date, "MMMM yyyy")}</span>
                <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface2, cursor: "pointer", color: T.muted, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>›</button>
              </div>
            )}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {PMT_PRESETS.map(p => {
              const d = p.fn();
              const active = sel && isSameDay(sel, d);
              return (
                <button key={p.label} onClick={() => handlePick(d)} style={{
                  padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                  border: `1.5px solid ${active ? T.accent : T.border}`,
                  background: active ? "rgba(245,158,11,.1)" : T.surface2,
                  transition: "all .15s", fontFamily: "'DM Sans', sans-serif",
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = "rgba(245,158,11,.06)"; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface2; }}}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: active ? T.accent : T.text }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{format(d, "MMM dd, yyyy")}</div>
                </button>
              );
            })}
          </div>
        )}
        {sel && (
          <div style={{ marginTop: 10, padding: "9px 12px", background: "rgba(16,185,129,.1)", borderRadius: 10, border: "1.5px solid rgba(16,185,129,.3)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 9, color: "#10b981", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Selected</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 1 }}>{format(sel, "EEE, MMM dd, yyyy")}</div>
            </div>
            <div style={{ width: 24, height: 24, borderRadius: 8, background: "#dcfce7", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</div>
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: "relative" }}>
      <button ref={triggerRef} type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "10px 13px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        border: `1.5px solid ${open ? T.accent : sel ? T.accent : T.inputBdr}`,
        borderRadius: 9, background: sel ? "rgba(245,158,11,.08)" : T.input,
        cursor: "pointer", fontSize: 13, transition: "all .15s",
        boxShadow: open ? "0 0 0 3px rgba(245,158,11,.12)" : "none",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: sel ? "rgba(245,158,11,.18)" : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>📅</div>
          <span style={{ color: sel ? T.text : T.muted, fontWeight: sel ? 600 : 400 }}>
            {sel ? format(sel, "EEE, MMM dd, yyyy") : "Select date…"}
          </span>
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? T.accent : T.muted }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {panel}
    </div>
  );
};

/* ─── ModeSelect ────────────────────────────────────────────────────────── */
const ModeSelect = ({ value, onChange, T }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "10px 13px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        border: `1.5px solid ${open ? T.accent : value ? T.accent : T.inputBdr}`,
        borderRadius: 9, background: value ? "rgba(245,158,11,.08)" : T.input,
        cursor: "pointer", fontSize: 13, transition: "all .15s",
        boxShadow: open ? "0 0 0 3px rgba(245,158,11,.12)" : "none",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: value ? "rgba(245,158,11,.18)" : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{MODE_ICONS[value] || "💳"}</div>
          <span style={{ color: value ? T.text : T.muted, fontWeight: value ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {value || "Select payment mode…"}
          </span>
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? T.accent : T.muted }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12,
          boxShadow: "0 20px 48px rgba(0,0,0,.22)", overflow: "hidden",
        }}>
          <div style={{ padding: "8px 13px", borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: T.muted }}>{PAYMENT_MODES.length} methods</div>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {PAYMENT_MODES.map((m, i) => {
              const active = value === m;
              const accent = MODE_ACCENT[i % MODE_ACCENT.length];
              return (
                <div key={m} onClick={() => { onChange(m); setOpen(false); }}
                  style={{ padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, background: active ? `${accent}18` : "transparent", display: "flex", alignItems: "center", gap: 11, transition: "background .1s" }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surface2; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: active ? `${accent}25` : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, border: `1.5px solid ${active ? accent : T.border}` }}>{MODE_ICONS[m]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? accent : T.text }}>{m}</div>
                  </div>
                  {active && (
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

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
    receiptNo:    "",
    details:      {},
    notes:        "",
  });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  const enteredAmt = parseFloat(form.amount) || 0;
  const balanceDue = invoice.balance;
  const remaining  = Math.max(0, balanceDue - enteredAmt);
  const overpay    = enteredAmt > balanceDue && balanceDue > 0;

  const handleSubmit = async () => {
    const e = {};
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = "Enter a valid amount";
    // Receipt No. required for every mode except Cash (cash auto-numbers).
    if (form.paymentMode !== "Cash" && !form.receiptNo.trim()) e.receiptNo = "Receipt number is required";
    if (!form.date) e.date = "Select a date";
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const receiptNo = form.receiptNo.trim();
      await axiosInstance.post("/api/payments/", {
        ...form,
        amount:         Number(form.amount),
        reference:      receiptNo || getPrimaryRef(form.paymentMode, form.details),
        paymentDetails: { ...form.details, ...(receiptNo ? { receiptNo } : {}) },
      });
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

          {/* Receipt No. — required for all modes except Cash (cash auto-numbers) */}
          {form.paymentMode !== "Cash" && (
            <div>
              <label style={lbl}>Receipt No. <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                type="text" placeholder="e.g. RCP-001"
                value={form.receiptNo}
                onChange={e => setForm(f => ({ ...f, receiptNo: e.target.value }))}
                style={{ ...inp, borderColor: errors.receiptNo ? "#ef4444" : T.inputBdr }}
              />
              {errors.receiptNo && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{errors.receiptNo}</div>}
            </div>
          )}

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
              <PaymentDatePicker T={T} value={form.date} onChange={d => setForm(f => ({ ...f, date: d }))} />
              {errors.date && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>{errors.date}</div>}
            </div>
            <div>
              <label style={lbl}>Payment Mode</label>
              <ModeSelect T={T} value={form.paymentMode} onChange={m => setForm(f => ({ ...f, paymentMode: m, details: {} }))} />
            </div>
          </div>

          {/* Mode-specific fields */}
          {(MODE_FIELDS[form.paymentMode] || []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px", background: T.surface2, borderRadius: 10, border: `1px solid ${T.inputBdr}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, margin: 0 }}>{form.paymentMode} Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {(MODE_FIELDS[form.paymentMode] || []).map(f => (
                  <div key={f.key}>
                    <label style={{ ...lbl, marginBottom: 4 }}>{f.label}{f.required && <span style={{ color: "#ef4444" }}> *</span>}</label>
                    {f.type === "date" ? (
                      <PaymentDatePicker
                        value={form.details[f.key] || ""}
                        onChange={val => setForm(prev => ({ ...prev, details: { ...prev.details, [f.key]: val } }))}
                        T={T}
                      />
                    ) : f.type === "select" ? (
                      <select
                        value={form.details[f.key] || ""}
                        onChange={e => setForm(prev => ({ ...prev, details: { ...prev.details, [f.key]: e.target.value } }))}
                        style={{ ...inp, cursor: "pointer" }}>
                        <option value="">Select…</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        style={inp}
                        placeholder={f.placeholder}
                        value={form.details[f.key] || ""}
                        onChange={e => setForm(prev => ({ ...prev, details: { ...prev.details, [f.key]: e.target.value } }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
  const location = useLocation();
  const { can } = usePermissions();
  const canExport = can("invoices", "export");
  const isDark = useThemeStore((s) => s.isDark);
  const T = buildTheme(isDark);

  /* data */
  const [invoices,     setInvoices]    = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [voidLoading,  setVoidLoading] = useState(false);
  const [issueLoading,       setIssueLoading]       = useState(false);
  const [finalizingProforma, setFinalizingProforma] = useState(false);
  const [refundModal,   setRefundModal]   = useState(null); // payment object
  const [refundAmount,  setRefundAmount]  = useState("");
  const [refundReason,  setRefundReason]  = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  const [returnModal,     setReturnModal]     = useState(false);
  const [returnItems,     setReturnItems]     = useState([]);
  const [returnNotes,     setReturnNotes]     = useState("");
  const [returnMode,      setReturnMode]      = useState("credit"); // "credit" | "refund" | "reduce"
  const [_returnPaymentId, setReturnPaymentId] = useState("");
  const [returnLoading,   setReturnLoading]   = useState(false);
  const [stocksList,      setStocksList]      = useState([]);

  const loadInvoices = useCallback(() => {
    setLoading(true);
    axiosInstance.get("/api/invoices")
      .then(res => setInvoices((res.data?.data?.invoices || []).map(toRow)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // Auto-open drawer when navigated from DN with openInvoiceId — fetch directly by ID
  useEffect(() => {
    const targetId = location.state?.openInvoiceId;
    if (!targetId) return;
    axiosInstance.get(`/api/invoices/${targetId}`)
      .then(res => {
        const inv = res.data?.data;
        if (inv) { setSelected(toRow(inv)); setDrawerTab("overview"); }
      })
      .catch(() => {});
  }, [location.state?.openInvoiceId]);

  /* inline credit-note modal */
  const [cnPrefill, setCnPrefill] = useState(null);

  /* available customer advances for the open invoice + apply modal */
  const [availAdvances, setAvailAdvances] = useState([]);
  const [applyAdvModal, setApplyAdvModal] = useState(false);
  const [advToApply, setAdvToApply] = useState("");      // advance _id
  const [advApplyAmt, setAdvApplyAmt] = useState("");
  const [advApplying, setAdvApplying] = useState(false);

  /* customer's unused-credit wallet (from overpayments / voided invoices) */
  const [availCredit, setAvailCredit] = useState(0);
  const [creditApplying, setCreditApplying] = useState(false);

  const handleApplyAdvance = async () => {
    if (!advToApply || !selected) { nexusToast.error("Select an advance"); return; }
    const adv = availAdvances.find(a => a._id === advToApply);
    if (!adv) return;
    const cap = Math.min(adv.remainingAmount, selected.balance ?? 0);
    const amt = parseFloat(advApplyAmt) || cap;
    if (amt <= 0) { nexusToast.error("Enter a valid amount"); return; }
    setAdvApplying(true);
    try {
      const r = await axiosInstance.post(`/api/advance-payments/${advToApply}/apply`, { invoiceId: selected._id, amount: amt });
      nexusToast.success(r.data?.message || "Advance applied");
      setApplyAdvModal(false); setAdvToApply(""); setAdvApplyAmt("");
      loadInvoices();
      const invId = selected._id;
      axiosInstance.get(`/api/invoices/${invId}`).then(res => { const f = res.data?.data; if (f) setSelected(toRow(f)); }).catch(() => {});
      axiosInstance.get(`/api/payments/?invoiceId=${invId}`).then(res => setLinkedPayments(res.data?.data?.payments || [])).catch(() => {});
      axiosInstance.get(`/api/advance-payments/?customerId=${selected.customerId}&available=true`).then(res => setAvailAdvances(res.data?.data?.advances || [])).catch(() => {});
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to apply advance");
    } finally { setAdvApplying(false); }
  };

  // Apply the customer's unused-credit wallet to this invoice (min of credit + balance).
  const handleApplyCredit = async () => {
    if (!selected?.customerId) return;
    const cap = Math.min(availCredit, selected.balance ?? 0);
    if (cap <= 0) { nexusToast.error("No applicable credit"); return; }
    setCreditApplying(true);
    try {
      const r = await axiosInstance.post(`/api/customers/${selected.customerId}/apply-credit`, {
        invoiceId: selected._id, amount: cap,
      });
      nexusToast.success(r.data?.message || "Credit applied");
      setAvailCredit(r.data?.remainingCredit ?? Math.max(0, availCredit - cap));
      loadInvoices();
      const invId = selected._id;
      axiosInstance.get(`/api/invoices/${invId}`).then(res => { const f = res.data?.data; if (f) setSelected(toRow(f)); }).catch(() => {});
      axiosInstance.get(`/api/payments/?invoiceId=${invId}`).then(res => setLinkedPayments(res.data?.data?.payments || [])).catch(() => {});
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to apply credit");
    } finally { setCreditApplying(false); }
  };

  const openCreditNote = (inv) => setCnPrefill({
    customerId:    inv.customerId,
    customerName:  inv.customer,
    invoiceId:     inv._id,
    invoiceNumber: inv.id,
    amountPaid:    inv.paid,
    balanceDue:    inv.balance,
  });

  /* filters */
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey,      setSortKey]      = useState("date");
  const [sortDir,      setSortDir]      = useState("desc");
  const [page,         setPage]         = useState(1);

  /* drawer */
  const [selected,       setSelected]      = useState(null);
  const [drawerTab,      setDrawerTab]     = useState("overview");

  // Live updates from other clients: refresh the list and, if a detail drawer is open,
  // re-fetch that invoice so its paid/balance/status update without a manual reload.
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const onRealtime = useCallback(() => {
    loadInvoices();
    const openId = selectedRef.current?._id;
    if (openId) {
      axiosInstance.get(`/api/invoices/${openId}`)
        .then((res) => { const f = res.data?.data; if (f) setSelected(toRow(f)); })
        .catch(() => {});
    }
  }, [loadInvoices]);
  useRealtime(['invoices_updated','payments_updated','credit_notes_updated','advance_payments_updated','delivery_notes_updated','sales_orders_updated'], onRealtime);
  const [linkedCNs,      setLinkedCNs]     = useState([]);
  const [cnLoading,      setCnLoading]     = useState(false);
  const [linkedPayments, setLinkedPayments] = useState([]);
  const [pmtLoading,     setPmtLoading]    = useState(false);
  const [linkedDNs,      setLinkedDNs]     = useState([]);
  const [paymentInvoice, setPaymentInvoice] = useState(null);

  /* inline modals (replaces window.prompt) */
  const [sendModal,  setSendModal]  = useState(null); // null | 'send' | 'reminder'
  const [sendEmail,  setSendEmail]  = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [voidModal,  setVoidModal]  = useState(false);
  const [voidInput,  setVoidInput]  = useState('');

  // Fetch payments + credits + delivery notes when drawer opens
  useEffect(() => {
    if (!selected) { setLinkedCNs([]); setLinkedPayments([]); setLinkedDNs([]); return; }
    setCnLoading(true);
    setPmtLoading(true);
    axiosInstance.get(`/api/credit-notes/by-invoice/${selected._id}`)
      .then(res => setLinkedCNs(res.data?.data || []))
      .catch(() => setLinkedCNs([]))
      .finally(() => setCnLoading(false));
    axiosInstance.get(`/api/payments/?invoiceId=${selected._id}`)
      .then(res => setLinkedPayments(res.data?.data?.payments || []))
      .catch(() => setLinkedPayments([]))
      .finally(() => setPmtLoading(false));
    axiosInstance.get(`/api/delivery-notes/?invoiceId=${selected._id}`)
      .then(res => setLinkedDNs(res.data?.data?.deliveryNotes || res.data?.data || []))
      .catch(() => setLinkedDNs([]));
  }, [selected]);

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

  const openSendModal = async (mode) => {
    let email = selected?.customerEmail || "";
    if (!email && selected?.customerId) {
      try {
        const res = await axiosInstance.get(`/api/customers/${selected.customerId}`);
        email = res.data?.data?.customerEmail || res.data?.customerEmail || "";
      } catch { /* fall through with empty */ }
    }
    setSendEmail(email);
    setSendModal(mode);
  };

  const handleSendInvoice = async () => {
    setSendLoading(true);
    try {
      const endpoint = sendModal === 'send'
        ? `/api/invoices/${selected._id}/send`
        : `/api/invoices/${selected._id}/send-reminder`;
      await axiosInstance.post(endpoint, { toEmail: sendEmail || undefined });
      nexusToast.success(sendModal === 'send' ? "Invoice sent successfully" : "Payment reminder sent");
      if (sendModal === 'send') loadInvoices();
      setSendModal(null); setSendEmail('');
    } catch (e) {
      nexusToast.error(e.response?.data?.message || (sendModal === 'send' ? "Failed to send invoice" : "Failed to send reminder"));
    } finally { setSendLoading(false); }
  };

  const handleRefund = async () => {
    if (!refundModal) return;
    const amt = parseFloat(refundAmount);
    if (!amt || amt <= 0) { nexusToast.error("Enter a valid refund amount"); return; }
    setRefundLoading(true);
    try {
      await axiosInstance.post(`/api/payments/${refundModal._id}/refund`, { amount: amt, reason: refundReason });
      nexusToast.success(`Refund of ${fmt(amt)} recorded`);
      setRefundModal(null); setRefundAmount(""); setRefundReason("");
      loadInvoices();
      if (selected) {
        const invId = selected._id;
        axiosInstance.get(`/api/invoices/${invId}`)
          .then(r => { const fresh = r.data?.data; if (fresh) setSelected(toRow(fresh)); })
          .catch(() => {});
        axiosInstance.get(`/api/payments/?invoiceId=${invId}`)
          .then(r => setLinkedPayments(r.data?.data?.payments || []))
          .catch(() => {});
      }
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Refund failed");
    } finally { setRefundLoading(false); }
  };

  const handleReturn = async () => {
    const items = returnItems.filter(i => i.qty > 0);
    if (items.length === 0) { nexusToast.error("Set qty > 0 for at least one item"); return; }
    setReturnLoading(true);
    try {
      const res = await axiosInstance.post(`/api/invoices/${selected._id}/return`, {
        items: items.map(i => ({ stockId: i.stockId || "", itemName: i.itemName, qty: i.qty, unitPrice: i.unitPrice, taxRate: i.taxRate })),
        notes: returnNotes,
        mode: returnMode,
      });
      const msg =
        returnMode === "reduce"
          ? `${res.data.returnNumber} processed — balance reduced by AED ${res.data.reducedAmount?.toFixed(2)}`
          : `${res.data.returnNumber} processed — credit note ${res.data.creditNoteNum} applied`;
      nexusToast.success(msg);
      setReturnModal(false); setReturnItems([]); setReturnNotes("");
      setReturnMode("credit"); setReturnPaymentId("");
      loadInvoices();
      // Re-fetch the open invoice so drawer reflects updated status/salesReturns immediately
      const invId = selected._id;
      axiosInstance.get(`/api/invoices/${invId}`)
        .then(r => { const fresh = r.data?.data; if (fresh) setSelected(toRow(fresh)); })
        .catch(() => {});
      axiosInstance.get(`/api/credit-notes/by-invoice/${invId}`)
        .then(r => setLinkedCNs(r.data?.data || [])).catch(() => {});
      axiosInstance.get(`/api/payments/?invoiceId=${invId}`)
        .then(r => setLinkedPayments(r.data?.data?.payments || [])).catch(() => {});
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Return failed");
    } finally { setReturnLoading(false); }
  };

  const handleVoidInvoice = async () => {
    setVoidLoading(true);
    try {
      await axiosInstance.patch(`/api/invoices/${selected._id}/void`, { reason: voidInput });
      setSelected(null); loadInvoices();
      nexusToast.success("Invoice voided");
      setVoidModal(false); setVoidInput('');
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to void invoice");
    } finally { setVoidLoading(false); }
  };

  /* Bulk selection */
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleRow    = (id, e) => { e.stopPropagation(); setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleAll    = () => setSelectedIds(prev => prev.size === pageData.length ? new Set() : new Set(pageData.map(i => i.id)));
  const bulkSelected = pageData.filter(i => selectedIds.has(i.id));

  const bulkExportCSV = () => {
    const src = bulkSelected.length ? bulkSelected : pageData;
    const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Invoice #","Customer","Issue Date","Due Date","Amount","Paid","Balance","Status"];
    const rows = src.map(i => [i.id, i.customer, i.date, i.due, i.amount.toFixed(2), i.paid.toFixed(2), (i.amount - i.paid).toFixed(2), i.status]);
    const csv = [header, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `invoices_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    setSelectedIds(new Set());
  };

  const bulkSend = async () => {
    if (!bulkSelected.length) return;
    const sendable = bulkSelected.filter(i => ["draft","unpaid","overdue","partial"].includes(i.status) && i.docType !== "proforma");
    if (!sendable.length) { nexusToast.error("No sendable invoices in selection (need draft/unpaid/overdue/partial)"); return; }
    if (!window.confirm(`Send ${sendable.length} invoice(s) to their customers?`)) return;
    let ok = 0, fail = 0;
    await Promise.all(sendable.map(i =>
      axiosInstance.post(`/api/invoices/${i._id}/send`).then(() => ok++).catch(() => fail++)
    ));
    nexusToast.success(`Sent ${ok} invoice(s)${fail ? `, ${fail} failed` : ""}`);
    setSelectedIds(new Set());
    loadInvoices();
  };

  /* CSV export (all) */
  const exportInvoicesCSV = () => {
    const rows = invoices.map(i => [
      i.id, i.customer, i.date, i.due,
      i.amount.toFixed(2), i.paid.toFixed(2), (i.amount - i.paid).toFixed(2),
      i.status,
    ]);
    const header = ["Invoice #","Customer","Issue Date","Due Date","Amount","Paid","Balance","Status"];
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `invoices_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

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
        _type:   li._type || "",   // keep empty if unset — don't coerce to "goods"
        stockId: li.stockId || "",
      }))
    : [];
  // Expense: explicit tag OR no inventory link (stockId absent + not explicitly "goods")
  const isExpense = (li) => li._type === "expense" || (!li.stockId && li._type !== "goods");
  const goodsItems   = drawerItems.filter(li => !isExpense(li));
  const expenseItems = drawerItems.filter(li =>  isExpense(li));
  const [drawerHistory, setDrawerHistory] = useState([]);
  useEffect(() => {
    if (!selected?._id) { setDrawerHistory([]); return; }
    axiosInstance.get(`/api/invoices/${selected._id}/history`)
      .then(res => setDrawerHistory(res.data?.data || []))
      .catch(() => setDrawerHistory([]));
  }, [selected?._id]);

  // Available customer advances — surfaced as "Apply Advance" on unpaid invoices
  useEffect(() => {
    if (!selected?.customerId) { setAvailAdvances([]); return; }
    axiosInstance.get(`/api/advance-payments/?customerId=${selected.customerId}&available=true`)
      .then(res => setAvailAdvances(res.data?.data?.advances || []))
      .catch(() => setAvailAdvances([]));
  }, [selected?.customerId, selected?._id]);

  // Customer unused-credit wallet — surfaced as "Apply Credit" on unpaid invoices.
  useEffect(() => {
    if (!selected?.customerId) { setAvailCredit(0); return; }
    axiosInstance.get(`/api/customers/${selected.customerId}`)
      .then(res => { const c = res.data?.data || res.data; setAvailCredit(c?.unused_credits || 0); })
      .catch(() => setAvailCredit(0));
  }, [selected?.customerId, selected?._id]);

  const totalAdvanceAvail = availAdvances.reduce((s, a) => s + (a.remainingAmount || 0), 0);

  /* ── Styles shared ── */
  const inputStyle = {
    background: T.input, border: `1px solid ${T.border}`, color: T.text,
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "8px 12px",
    borderRadius: 7, outline: "none",
  };

  const thStyle = (key) => ({
    fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase",
    color: sortKey === key ? T.accent : T.muted,
    padding: "14px 12px 10px", textAlign: "left", cursor: key !== "actions" ? "pointer" : "default",
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
            {["all", "unpaid", "paid", "overdue", "partial", "draft", "void"].map(s => {
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

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            {canExport && (
            <button onClick={exportInvoicesCSV} style={{ ...inputStyle, padding: "7px 14px", cursor: "pointer", fontSize: 13, transition: ".15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.subtle}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
            >Export CSV</button>
            )}
            <button
              onClick={() => navigate("/Sales/Createinvoices")}
              style={{ padding: "7px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: T.accent, color: "#0a0e1a", border: "none", transition: ".15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#fbbf24"}
              onMouseLeave={e => e.currentTarget.style.background = T.accent}
            >+ New Invoice</button>
          </div>
        </div>

        {/* ── Bulk Actions Bar ── */}
        {selectedIds.size > 0 && (
          <div style={{ margin: "12px 28px 0", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb", border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 9 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>{selectedIds.size} selected</span>
            {canExport && <button onClick={bulkExportCSV} style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "transparent", border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit" }}>Export CSV</button>}
            <button onClick={bulkSend} style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", background: T.accent, border: "none", color: "#0a0e1a", fontFamily: "inherit" }}>📧 Send Selected</button>
            <button onClick={() => setSelectedIds(new Set())} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", background: "transparent", border: `1px solid ${T.border}`, color: T.muted, fontFamily: "inherit" }}>✕ Clear</button>
          </div>
        )}

        {/* ── Table ── */}
        <div style={{ margin: "12px 28px 0", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                {COLS.map(c => <col key={c.key} style={{ width: c.w }} />)}
              </colgroup>
              <thead>
                <tr>
                  {COLS.map(c => (
                    <th key={c.key} style={thStyle(c.key)} onClick={() => c.key !== "actions" && c.key !== "sel" && handleSort(c.key)}>
                      {c.key === "sel"
                        ? <input type="checkbox" checked={pageData.length > 0 && selectedIds.size === pageData.length} onChange={toggleAll} style={{ cursor: "pointer", accentColor: T.accent }} />
                        : <>{c.label}{c.key !== "actions" && c.key !== "items" && <SortArrow col={c.key} />}</>
                      }
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
                    <td style={tdStyle} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={e => toggleRow(inv.id, e)} style={{ cursor: "pointer", accentColor: T.accent }} />
                    </td>
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

                      {/* Proforma actions */}
                      {selected.docType === "proforma" && !selected.proformaConvertedTo && (
                        <>
                          <div style={{ padding: "10px 14px", borderRadius: 7, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", fontSize: 12, color: "#a78bfa" }}>
                            📋 Proforma invoice — not recorded in AR. Finalize to convert to a real invoice.
                          </div>
                          <button
                            disabled={finalizingProforma}
                            onClick={async () => {
                              setFinalizingProforma(true);
                              try {
                                const res = await axiosInstance.post(`/api/invoices/${selected._id}/finalize`);
                                if (res.data?.data?.status === "pending_approval") {
                                  nexusToast.success("Submitted for approval");
                                } else {
                                  const invNum = res.data?.data?.invoiceNumber || "Invoice";
                                  nexusToast.success(`${invNum} created — proforma finalized`);
                                }
                                setSelected(null); loadInvoices();
                              } catch (e) {
                                nexusToast.error(e.response?.data?.message || "Finalize failed");
                              } finally { setFinalizingProforma(false); }
                            }}
                            style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: finalizingProforma ? "not-allowed" : "pointer", background: "#7c3aed", color: "#fff", border: "none", fontFamily: "'DM Sans', sans-serif", width: "100%", opacity: finalizingProforma ? 0.6 : 1 }}>
                            {finalizingProforma ? "Finalizing…" : "✓ Finalize → Create Invoice"}
                          </button>
                        </>
                      )}

                      {/* Send Proforma email */}
                      {selected.docType === "proforma" && !selected.proformaConvertedTo && (
                        <button
                          onClick={() => openSendModal("send")}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", color: "#7c3aed", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          📧 Send Proforma
                        </button>
                      )}

                      {selected.docType === "proforma" && selected.proformaConvertedTo && (
                        <div style={{ padding: "10px 14px", borderRadius: 7, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", fontSize: 12, color: "#10b981" }}>
                          ✓ Finalized →{" "}
                          <strong>{selected.proformaConvertedToNumber || "Invoice"}</strong> created.
                          <span
                            onClick={() => {
                              if (selected.proformaConvertedToNumber) setSearch(selected.proformaConvertedToNumber);
                              setStatusFilter("all");
                              setPage(1);
                              setSelected(null);
                            }}
                            style={{ marginLeft: 8, cursor: "pointer", textDecoration: "underline", color: "#34d399" }}>
                            View →
                          </span>
                        </div>
                      )}

                      {/* Draft-only actions */}
                      {selected.status === "draft" && selected.docType !== "proforma" && (
                        <>
                          <button
                            disabled={issueLoading}
                            onClick={async () => {
                              setIssueLoading(true);
                              try {
                                await axiosInstance.patch(`/api/invoices/${selected._id}/status`, { status: "unpaid" });
                                setSelected(null); loadInvoices();
                                nexusToast.success("Invoice issued");
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

                      {/* Preview & Print — bilingual tax-invoice layout */}
                      <button
                        onClick={() => navigate(`/Sales/Invoices/${selected._id}/print`)}
                        style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                        🖨 Preview &amp; Print
                      </button>

                      {/* Download PDF */}
                      {canExport && (
                      <button
                        onClick={() => {
                          const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
                          const base = import.meta.env.VITE_API_URL || "http://localhost:8080";
                          const pdfUrl = `${base}/api/invoices/${selected._id}/pdf`;
                          if (isTauri) {
                            window.__TAURI_INTERNALS__.invoke("plugin:shell|open", { path: pdfUrl }).catch(() => {});
                          } else {
                            axiosInstance.get(`/api/invoices/${selected._id}/pdf`, { responseType: "blob" })
                              .then(res => {
                                const a = document.createElement("a");
                                a.href = URL.createObjectURL(res.data);
                                a.download = `invoice-${selected.id}.pdf`;
                                a.click();
                              })
                              .catch(() => window.open(pdfUrl, "_blank"));
                          }
                        }}
                        style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                        ⬇ Download PDF
                      </button>
                      )}

                      {/* Send Invoice / Send Reminder */}
                      {["draft", "unpaid", "overdue", "partial"].includes(selected.status) && (
                        <button
                          onClick={() => openSendModal("send")}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: T.blue, fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          📧 Send Invoice
                        </button>
                      )}

                      {selected.status === "overdue" && (
                        <button
                          onClick={() => openSendModal("reminder")}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          🔔 Send Reminder
                        </button>
                      )}

                      {/* Record payment — unpaid/overdue/partial with remaining balance */}
                      {["unpaid", "overdue", "partial"].includes(selected.status) && (selected.balance ?? 0) > 0 && (
                        <button
                          onClick={() => setPaymentInvoice(selected)}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.accent, color: "#0a0e1a", border: "none", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          💳 Record Payment
                        </button>
                      )}

                      {/* Apply Advance — when customer has available advance credit */}
                      {["unpaid", "overdue", "partial"].includes(selected.status) && (selected.balance ?? 0) > 0 && totalAdvanceAvail > 0.005 && (
                        <button
                          onClick={() => setApplyAdvModal(true)}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#8b5cf6", fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          🏦 Apply Advance ({fmt(totalAdvanceAvail)} available)
                        </button>
                      )}

                      {/* Apply Credit — when customer has unused credit on account */}
                      {["unpaid", "overdue", "partial"].includes(selected.status) && (selected.balance ?? 0) > 0 && availCredit > 0.005 && (
                        <button
                          onClick={handleApplyCredit}
                          disabled={creditApplying}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: creditApplying ? "not-allowed" : "pointer", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontFamily: "'DM Sans', sans-serif", width: "100%", opacity: creditApplying ? 0.7 : 1 }}>
                          {creditApplying ? "Applying…" : `✓ Apply Credit (${fmt(availCredit)} available)`}
                        </button>
                      )}

                      {/* Credit note — paid invoices (refund) or partial with balance remaining */}
                      {(selected.status === "paid" || selected.status === "partial") && (
                        <button
                          onClick={() => openCreditNote(selected)}
                          style={{ padding: "9px 0", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: T.blue, fontFamily: "'DM Sans', sans-serif", width: "100%" }}>
                          📋 Raise Credit Note
                        </button>
                      )}

                      {/* Return Items — only when a linked delivery note is delivered */}
                      {["unpaid","overdue","partial","paid"].includes(selected.status) && selected.docType !== "proforma" && linkedDNs.some(dn => dn.status === "delivered") && (() => {
                        // Calculate already-returned qty per item name
                        const alreadyReturned = {};
                        (selected.salesReturns || []).forEach(r =>
                          (r.items || []).forEach(item => {
                            alreadyReturned[item.itemName] = (alreadyReturned[item.itemName] || 0) + item.qty;
                          })
                        );
                        const goodsLineItems = (selected.lineItems || []).filter(li => li._type !== "expense" && li.stockId);
                        const hasReturnable = goodsLineItems.some(li =>
                          Math.max(0, (li.qty ?? 0) - (alreadyReturned[li.desc] || 0)) > 0
                        );
                        return (
                          <button
                            disabled={!hasReturnable}
                            onClick={() => {
                              const s = selected.status;
                              const defaultMode = (s === "unpaid" || s === "overdue") ? "reduce" : s === "partial" ? "reduce" : "credit";
                              setReturnItems(goodsLineItems.map(li => ({
                                itemName:  li.desc || "",
                                qty:       0,
                                maxQty:    Math.max(0, (li.qty ?? 0) - (alreadyReturned[li.desc] || 0)),
                                unitPrice: li.unitPrice ?? 0,
                                taxRate:   li.taxRate   ?? 5,
                                stockId:   li.stockId  || "",
                              })));
                              setReturnMode(defaultMode);
                              setReturnPaymentId("");
                              setReturnNotes("");
                              setStocksList([]);
                              axiosInstance.get("/api/stocks/getitem")
                                .then(r => setStocksList(r.data?.data || []))
                                .catch(() => {});
                              setReturnModal(true);
                            }}
                            style={{ padding: "8px 0", borderRadius: 7, fontSize: 12, cursor: hasReturnable ? "pointer" : "not-allowed", background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.3)", color: hasReturnable ? "#a855f7" : T.muted, fontFamily: "'DM Sans', sans-serif", opacity: hasReturnable ? 1 : 0.5 }}>
                            ↩ Return Items{!hasReturnable ? " (all returned)" : ""}
                          </button>
                        );
                      })()}

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

                      {/* Void — draft only */}
                      {selected.status === "draft" && selected.docType !== "proforma" && (
                        <button
                          disabled={voidLoading}
                          onClick={() => setVoidModal(true)}
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
                        {goodsItems.map((item, i) => (
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
                        const totalDiscount = goodsItems.reduce((s, li) => s + (Number(li.discountAed) || 0), 0);
                        const subtotalBeforeDiscount = goodsItems.reduce((s, li) => s + (li.qty * li.price), 0);
                        const subtotalAfterDiscount = subtotalBeforeDiscount - totalDiscount;
                        const vat = goodsItems.reduce((s, li) => s + li.amt, 0) - subtotalAfterDiscount <= 0
                          ? subtotalAfterDiscount * 0.05
                          : goodsItems.reduce((s, li) => s + li.amt, 0) - subtotalAfterDiscount;
                        const rows = [
                          { label: "Subtotal", val: `AED ${subtotalBeforeDiscount.toFixed(2)}` },
                          ...(totalDiscount > 0 ? [{ label: "Discount", val: `-AED ${totalDiscount.toFixed(2)}`, color: "#10b981" }] : []),
                          { label: `VAT (5%)`, val: `AED ${vat.toFixed(2)}` },
                        ];
                        return rows.map(({ label, val, color }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                            <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: color || T.text }}>{val}</span>
                          </div>
                        ));
                      })()}
                      {/* Shipping + misc charges — shown separately below goods subtotal */}
                      {expenseItems.length > 0 && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.border}` }}>
                          {expenseItems.map((ei, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                              <span style={{ fontSize: 12, color: T.muted }}>{ei.desc}</span>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: T.text }}>
                                {ei.amt < 0 ? `−AED ${Math.abs(ei.amt).toFixed(2)}` : `AED ${ei.amt.toFixed(2)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
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
                      {["unpaid", "overdue", "partial"].includes(selected.status) && (
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
                          const refundedAmt = p.refundedAmount || 0;
                          const fullyRefunded = p.isRefunded && refundedAmt >= (p.amount || 0) - 0.005;
                          const partiallyRefunded = p.isRefunded && !fullyRefunded;
                          const netPaid = (p.amount || 0) - refundedAmt;
                          return (
                            <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, padding: "12px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.blue, fontWeight: 600 }}>{p.paymentNumber}</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: `${modeColor}18`, color: modeColor, border: `1px solid ${modeColor}30` }}>
                                      {p.paymentMode || "Other"}
                                    </span>
                                    {fullyRefunded && (
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                                        Refunded
                                      </span>
                                    )}
                                    {partiallyRefunded && (
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
                                        Partial Refund {fmt(refundedAmt)}
                                      </span>
                                    )}
                                    {p.reference && (
                                      <span style={{ fontSize: 11, color: T.muted }}>Ref: {p.reference}</span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: fullyRefunded ? T.muted : "#10b981", margin: 0, textDecoration: fullyRefunded ? "line-through" : "none" }}>
                                    {fmt(p.amount)}
                                  </p>
                                  {partiallyRefunded && (
                                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#10b981", margin: "2px 0 0" }}>
                                      Net: {fmt(netPaid)}
                                    </p>
                                  )}
                                  <p style={{ fontSize: 11, color: T.muted, margin: "3px 0 0" }}>
                                    {p.date ? new Date(p.date).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                  </p>
                                  {netPaid > 0.005 && (
                                    <button
                                      onClick={() => { setRefundModal(p); setRefundAmount(String(netPaid)); setRefundReason(""); }}
                                      style={{ marginTop: 6, fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6, cursor: "pointer", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", fontFamily: "'DM Sans', sans-serif" }}>
                                      ↩ Reverse Payment
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ marginTop: 4, padding: "10px 14px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: T.muted }}>Total paid (net of refunds)</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#10b981" }}>
                            {fmt(linkedPayments.reduce((s, p) => s + ((p.amount || 0) - (p.refundedAmount || 0)), 0))}
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
                      {/* No credit note against a void / draft / proforma invoice. */}
                      {selected.status !== "void" && selected.status !== "draft" && selected.type !== "proforma" && (
                        <button
                          onClick={() => openCreditNote(selected)}
                          style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: T.blue }}>
                          + New Credit Note
                        </button>
                      )}
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
                          const isSettled      = ["applied","closed"].includes(cn.status);
                          const invIdStr       = String(selected._id);
                          const appliedHere    = String(cn.appliedToInvoiceId || "") === invIdStr;
                          // Old CNs created via sales-return before appliedToInvoiceId was tracked:
                          // sourceDocId === this invoice AND no appliedToInvoiceId → CN was auto-applied here
                          const legacyHere     = !cn.appliedToInvoiceId && String(cn.sourceDocId || "") === invIdStr;
                          const appliedElsewhere = isSettled && !appliedHere && !legacyHere;
                          const displayAmt     = isSettled
                            ? appliedHere
                              ? (cn.appliedToInvoiceAmount ?? 0)
                              : legacyHere
                                // appliedAmount may be 0 in old records; fall back to grandTotal
                                ? (cn.appliedAmount || cn.totals?.grandTotal || 0)
                                : 0
                            : (cn.totals?.grandTotal ?? cn.remainingAmount ?? 0);
                          const refundedAmt    = cn.refundedAmount ?? 0;
                          return (
                            <div key={i} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, padding: "12px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.blue, fontWeight: 600 }}>{cn.creditNoteNumber}</span>
                                  <p style={{ fontSize: 12, color: T.muted, margin: "3px 0 0" }}>{cn.reason || "—"}</p>
                                  {appliedElsewhere && (
                                    <p style={{ fontSize: 10, color: "#f59e0b", margin: "3px 0 0" }}>Applied to a different invoice</p>
                                  )}
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                                    {cn.status}
                                  </span>
                                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: (isSettled && !appliedElsewhere) ? "#10b981" : T.text, margin: "5px 0 0" }}>
                                    AED {Number(displayAmt).toFixed(2)}
                                  </p>
                                  {refundedAmt > 0 && (
                                    <p style={{ fontSize: 10, color: T.muted, margin: "2px 0 0" }}>
                                      + AED {Number(refundedAmt).toFixed(2)} refunded as cash
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: T.muted }}>Total credits applied</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#10b981" }}>
                            AED {linkedCNs
                              .filter(cn => ["applied","closed"].includes(cn.status))
                              .reduce((s, cn) => {
                                const invIdStr = String(selected._id);
                                if (String(cn.appliedToInvoiceId || "") === invIdStr) return s + (cn.appliedToInvoiceAmount ?? 0);
                                if (!cn.appliedToInvoiceId && String(cn.sourceDocId || "") === invIdStr) return s + (cn.appliedAmount || cn.totals?.grandTotal || 0);
                                return s;
                              }, 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── History Tab ── */}
                {drawerTab === "history" && (() => {
                  // Build unified timeline: structural events + each payment + each credit applied
                  const timelineEntries = [
                    ...drawerHistory.map(h => ({
                      date: new Date(h.timestamp || 0),
                      dot: T.accent2,
                      label: h.action,
                      sub: [h.timestamp ? new Date(h.timestamp).toLocaleString("en-AE") : null, h.user, h.note].filter(Boolean).join(" · "),
                    })),
                    ...linkedPayments.flatMap(p => {
                      const entries = [{
                        date: new Date(p.date || p.createdAt || 0),
                        dot: "#10b981",
                        label: `Payment received — ${fmt(p.amount)}`,
                        sub: [
                          p.date ? new Date(p.date).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : null,
                          p.paymentMode || "Other",
                          p.paymentNumber,
                          p.reference ? `Ref: ${p.reference}` : null,
                        ].filter(Boolean).join(" · "),
                      }];
                      if (p.isRefunded) {
                        entries.push({
                          date: new Date(p.refundedAt || p.updatedAt || p.createdAt || 0),
                          dot: "#ef4444",
                          label: `↩ Refund processed — ${fmt(p.refundedAmount || p.amount)}`,
                          sub: [p.paymentNumber, p.refundReason || "Refunded"].filter(Boolean).join(" · "),
                        });
                      }
                      return entries;
                    }),
                    ...(selected.salesReturns || []).map(r => ({
                      date: new Date(r.createdAt || 0),
                      dot: "#a855f7",
                      label: r.mode === "reduce"
                        ? `Items returned — balance reduced AED ${r.refundAmount?.toFixed(2)} (${r.returnNumber})`
                        : r.mode === "refund"
                        ? `Items returned — cash refunded AED ${r.refundAmount?.toFixed(2)} (${r.returnNumber})`
                        : `Items returned — credit note ${r.creditNoteNum} (${r.returnNumber})`,
                      sub: [
                        r.date,
                        r.items?.length ? `${r.items.length} item${r.items.length > 1 ? "s" : ""}` : null,
                      ].filter(Boolean).join(" · "),
                    })),
                    ...linkedCNs.map(cn => {
                      const grandTotal  = cn.totals?.grandTotal ?? cn.grandTotal ?? 0;
                      const invIdStr2   = String(selected._id);
                      const invAmt2     = String(cn.appliedToInvoiceId || "") === invIdStr2
                        ? (cn.appliedToInvoiceAmount ?? 0)
                        : (!cn.appliedToInvoiceId && String(cn.sourceDocId || "") === invIdStr2)
                          ? (cn.appliedAmount || grandTotal || 0)
                          : 0;
                      const invoiceAmt  = invAmt2;
                      const refundedAmt = cn.refundedAmount ?? 0;
                      const statusLabel = {
                        draft:            `Credit note created (draft) — ${fmt(grandTotal)}`,
                        pending_approval: `Credit note submitted for approval — ${fmt(grandTotal)}`,
                        approved:         `Credit note approved — ${fmt(grandTotal)} available`,
                        applied:          refundedAmt > 0 && invoiceAmt > 0
                                            ? `Credit note applied — ${fmt(invoiceAmt)} to invoice + ${fmt(refundedAmt)} refunded`
                                            : refundedAmt > 0
                                            ? `Credit note refunded as cash — ${fmt(refundedAmt)}`
                                            : `Credit note applied — ${fmt(invoiceAmt)}`,
                        closed:           `Credit note fully applied — ${fmt(invoiceAmt || grandTotal)}`,
                        void:             `Credit note voided`,
                      }[cn.status] || `Credit note (${cn.status}) — ${fmt(grandTotal)}`;
                      const dotColor = { draft:"#94a3b8", pending_approval:"#f59e0b", approved:"#8b5cf6", applied:"#3b82f6", closed:"#10b981", void:"#ef4444" }[cn.status] || "#64748b";
                      return {
                        date: new Date(cn.updatedAt || cn.createdAt || 0),
                        dot: dotColor,
                        label: statusLabel,
                        sub: [
                          cn.creditNoteNumber,
                          cn.updatedAt ? new Date(cn.updatedAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : null,
                        ].filter(Boolean).join(" · "),
                      };
                    }),
                  ].sort((a, b) => a.date - b.date);

                  if (timelineEntries.length === 0) return (
                    <div style={{ textAlign: "center", padding: "48px 0", color: T.muted, fontSize: 13 }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                      No history yet
                    </div>
                  );

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {timelineEntries.map((entry, i) => (
                        <div key={i} style={{ display: "flex", gap: 14, paddingBottom: 20, position: "relative" }}>
                          {i < timelineEntries.length - 1 && (
                            <div style={{ position: "absolute", left: 7, top: 18, bottom: 0, width: 1, background: T.border }} />
                          )}
                          <div style={{ width: 15, height: 15, borderRadius: "50%", background: entry.dot, flexShrink: 0, marginTop: 2, border: `2px solid ${T.surface}`, position: "relative", zIndex: 1 }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.label}</div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{entry.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
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

      {/* ── Send / Reminder modal ── */}
      {sendModal && selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => e.target === e.currentTarget && setSendModal(null)}>
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: "24px", width: 400, boxShadow: "0 40px 80px rgba(0,0,0,.4)" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>
              {sendModal === 'send' ? '📧 Send Invoice' : '🔔 Send Reminder'}
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>{selected.id} · {selected.customer}</div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6 }}>
              Recipient Email
            </label>
            <input
              type="email"
              autoFocus
              value={sendEmail}
              onChange={e => setSendEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendInvoice()}
              placeholder="customer@example.com"
              style={{ width: "100%", padding: "10px 13px", background: T.input, border: `1.5px solid ${T.inputBdr}`, borderRadius: 9, color: T.text, fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => { setSendModal(null); setSendEmail(''); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface2, color: T.muted, border: `1.5px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleSendInvoice} disabled={sendLoading}
                style={{ flex: 2, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: sendLoading ? "not-allowed" : "pointer", opacity: sendLoading ? 0.6 : 1, background: sendModal === 'send' ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.12)", color: sendModal === 'send' ? T.blue : "#ef4444", border: `1px solid ${sendModal === 'send' ? "rgba(59,130,246,0.35)" : "rgba(239,68,68,0.3)"}`, fontFamily: "'DM Sans', sans-serif" }}>
                {sendLoading ? "Sending…" : sendModal === 'send' ? "Send Invoice" : "Send Reminder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Void modal ── */}
      {refundModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => e.target === e.currentTarget && setRefundModal(null)}>
          {(() => { const refundRemaining = (refundModal.amount || 0) - (refundModal.refundedAmount || 0); return (
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: "24px", width: 420, boxShadow: "0 40px 80px rgba(0,0,0,.4)" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>↩ Reverse Payment</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>
              {refundModal.paymentNumber} · Original: {fmt(refundModal.amount)}
              {(refundModal.refundedAmount || 0) > 0 && <> · Already refunded: {fmt(refundModal.refundedAmount)}</>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6 }}>
                  Refund Amount <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="number"
                  value={refundAmount}
                  min={0.01}
                  max={refundRemaining}
                  step="0.01"
                  onChange={e => {
                    const raw = parseFloat(e.target.value);
                    if (isNaN(raw) || raw < 0) { setRefundAmount(""); return; }
                    setRefundAmount(String(Math.min(raw, refundRemaining)));
                  }}
                  style={{ width: "100%", padding: "10px 13px", background: T.input, border: `1.5px solid ${parseFloat(refundAmount) > refundRemaining ? "#ef4444" : T.inputBdr}`, borderRadius: 9, color: T.text, fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace" }}
                />
                <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>
                  Max refundable: <span style={{ fontFamily: "'DM Mono', monospace", color: T.text }}>{fmt(refundRemaining)}</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6 }}>
                  Reason <span style={{ color: T.subtle, fontWeight: 400, textTransform: "none" }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  placeholder="e.g. Service cancelled, goods returned…"
                  style={{ width: "100%", padding: "10px 13px", background: T.input, border: `1.5px solid ${T.inputBdr}`, borderRadius: 9, color: T.text, fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>
              <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 12, color: "#f59e0b" }}>
                ⚠️ This will reduce the invoice paid amount and restore balance due. The original payment record stays for audit trail.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setRefundModal(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface2, color: T.muted, border: `1.5px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleRefund} disabled={refundLoading}
                style={{ flex: 2, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: refundLoading ? "not-allowed" : "pointer", opacity: refundLoading ? 0.6 : 1, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                {refundLoading ? "Processing…" : "↩ Confirm Reversal"}
              </button>
            </div>
          </div>
          ); })()}
        </div>
      )}

      {/* ── Return Items modal ── */}
      {returnModal && selected && (() => {
        const returnTotal = returnItems.reduce((s, i) => {
          if (i.qty <= 0) return s;
          const sub = i.qty * i.unitPrice;
          return s + sub + sub * (i.taxRate / 100);
        }, 0);
        const invStatus = selected.status;

        // Available modes per invoice status
        const modeOptions = invStatus === "paid"
          ? [
              { key: "credit", label: "📋 Credit Note", desc: "Customer gets credit for future invoices" },
            ]
          : invStatus === "partial"
          ? [
              { key: "reduce", label: "↓ Reduce Balance", desc: "Lower what they still owe" },
              { key: "credit", label: "📋 Credit Note",   desc: "Create credit for returned goods" },
            ]
          : [ // unpaid / overdue
              { key: "reduce", label: "↓ Reduce Balance", desc: "Remove returned goods from what they owe" },
            ];

        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 9300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
            onClick={e => e.target === e.currentTarget && setReturnModal(false)}>
            <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: "24px", width: 520, maxHeight: "82vh", overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,.4)" }}>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>↩ Return Items</div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>{selected.id}</div>

              {/* Mode toggle — only show if more than one option */}
              {modeOptions.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                  {modeOptions.map(opt => (
                    <div key={opt.key} onClick={() => { setReturnMode(opt.key); setReturnPaymentId(""); }}
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 9, cursor: "pointer", border: `1.5px solid ${returnMode === opt.key ? "#a855f7" : T.border}`, background: returnMode === opt.key ? "rgba(168,85,247,0.08)" : T.surface2, transition: ".15s" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: returnMode === opt.key ? "#a855f7" : T.text }}>{opt.label}</div>
                      <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>
              )}
              {modeOptions.length === 1 && (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)", fontSize: 12, color: "#a855f7", marginBottom: 16 }}>
                  {modeOptions[0].label} — {modeOptions[0].desc}
                </div>
              )}

              {/* Items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {returnItems.map((item, i) => (
                  <div key={i} style={{ background: T.surface2, border: `1px solid ${item.qty > 0 ? "rgba(168,85,247,0.4)" : T.border}`, borderRadius: 8, padding: "10px 13px", transition: ".15s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, fontSize: 13, color: T.text, fontWeight: 500 }}>{item.itemName || "—"}</div>
                      <div style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>max {item.maxQty}</div>
                      <input
                        type="number" min={0} max={item.maxQty} step={1} value={item.qty}
                        onChange={e => {
                          const v = Math.min(item.maxQty, Math.max(0, parseFloat(e.target.value) || 0));
                          setReturnItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: v } : it));
                        }}
                        style={{ width: 70, padding: "6px 9px", background: T.input, border: `1.5px solid ${item.qty > 0 ? "#a855f7" : T.inputBdr}`, borderRadius: 7, color: T.text, fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace", textAlign: "right" }}
                      />
                    </div>
                    {/* Stock linker — only shown when item has no stockId and qty > 0 */}
                    {item.qty > 0 && !item.stockId && stocksList.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, color: "#f59e0b", whiteSpace: "nowrap" }}>⚠ Link stock item to restore inventory:</span>
                        <select
                          value={item.linkedStockId || ""}
                          onChange={e => setReturnItems(prev => prev.map((it, idx) => idx === i ? { ...it, stockId: e.target.value } : it))}
                          style={{ flex: 1, padding: "4px 8px", background: T.input, border: `1px solid ${T.inputBdr}`, borderRadius: 6, color: T.text, fontSize: 11, outline: "none", fontFamily: "'DM Sans', sans-serif" }}>
                          <option value="">— skip stock update —</option>
                          {stocksList.map(s => (
                            <option key={s._id} value={s._id}>{s.name} ({s.itemCode}) · {s.quantity} in stock</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Return total */}
              {returnTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 13px", borderRadius: 7, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)", marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Return total (incl. VAT)</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#a855f7" }}>AED {returnTotal.toFixed(2)}</span>
                </div>
              )}


              {/* Notes */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6 }}>
                  Notes <span style={{ color: T.subtle, fontWeight: 400, textTransform: "none" }}>(optional)</span>
                </label>
                <input type="text" value={returnNotes} onChange={e => setReturnNotes(e.target.value)}
                  placeholder="e.g. Damaged goods, wrong item shipped…"
                  style={{ width: "100%", padding: "10px 13px", background: T.input, border: `1.5px solid ${T.inputBdr}`, borderRadius: 9, color: T.text, fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>

              {/* Info banner */}
              <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)", fontSize: 12, color: "#a855f7", marginBottom: 18 }}>
                {returnMode === "credit" && "Stock restored. Credit note created and applied to invoice automatically."}
                {returnMode === "reduce" && "Stock restored. Invoice balance reduced by the return amount."}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setReturnModal(false); setReturnMode("credit"); setReturnPaymentId(""); }}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface2, color: T.muted, border: `1.5px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif" }}>
                  Cancel
                </button>
                <button onClick={handleReturn} disabled={returnLoading}
                  style={{ flex: 2, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: returnLoading ? "not-allowed" : "pointer", opacity: returnLoading ? 0.6 : 1, background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                  {returnLoading ? "Processing…" : "↩ Process Return"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {voidModal && selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => e.target === e.currentTarget && setVoidModal(false)}>
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: "24px", width: 420, boxShadow: "0 40px 80px rgba(0,0,0,.4)" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>🚫 Void Invoice</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>
              {selected.id} · This action cannot be undone.
            </div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6 }}>
              Reason <span style={{ color: T.subtle, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </label>
            <input
              type="text"
              autoFocus
              value={voidInput}
              onChange={e => setVoidInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleVoidInvoice()}
              placeholder="e.g. Duplicate entry, Customer request…"
              style={{ width: "100%", padding: "10px 13px", background: T.input, border: `1.5px solid ${T.inputBdr}`, borderRadius: 9, color: T.text, fontSize: 13, outline: "none", fontFamily: "'DM Sans', sans-serif" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => { setVoidModal(false); setVoidInput(''); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface2, color: T.muted, border: `1.5px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleVoidInvoice} disabled={voidLoading}
                style={{ flex: 2, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: voidLoading ? "not-allowed" : "pointer", opacity: voidLoading ? 0.6 : 1, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                {voidLoading ? "Voiding…" : "Void Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Advance modal */}
      {applyAdvModal && selected && (
        <div onClick={e => e.target === e.currentTarget && setApplyAdvModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)", padding: 20 }}>
          <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: 24, width: 460, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,.4)" }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>🏦 Apply Advance</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 18 }}>
              {selected.id} · Balance due: <b style={{ color: T.accent, fontFamily: "'DM Mono',monospace" }}>{fmt(selected.balance)}</b>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6 }}>
                  Select Advance <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {availAdvances.map(adv => {
                    const active = advToApply === adv._id;
                    const soLinked = adv.salesOrderNumber ? ` · ${adv.salesOrderNumber}` : "";
                    return (
                      <div key={adv._id}
                        onClick={() => { setAdvToApply(adv._id); setAdvApplyAmt(String(Math.min(adv.remainingAmount, selected.balance ?? 0))); }}
                        style={{ padding: "10px 13px", borderRadius: 9, cursor: "pointer", border: `1.5px solid ${active ? "#8b5cf6" : T.border}`, background: active ? "rgba(139,92,246,0.08)" : T.surface2 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, color: T.blue }}>{adv.advanceNumber}</span>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: T.accent }}>{fmt(adv.remainingAmount)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{fmtDate(adv.date)} · {adv.paymentMode}{soLinked}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {advToApply && (() => {
                const adv = availAdvances.find(a => a._id === advToApply);
                const cap = adv ? Math.min(adv.remainingAmount, selected.balance ?? 0) : 0;
                return (
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6 }}>Amount to Apply</label>
                    <input type="number" min="0" step="0.01" max={cap} value={advApplyAmt}
                      onChange={e => { const raw = parseFloat(e.target.value); setAdvApplyAmt(isNaN(raw) ? "" : String(Math.min(raw, cap))); }}
                      style={{ width: "100%", padding: "10px 13px", background: T.input, border: `1.5px solid ${T.border}`, borderRadius: 9, color: T.text, fontSize: 13, outline: "none", fontFamily: "'DM Mono', monospace" }} />
                    <p style={{ fontSize: 11, color: T.muted, margin: "5px 0 0" }}>Max: <span style={{ fontFamily: "'DM Mono',monospace", color: T.text }}>{fmt(cap)}</span></p>
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => { setApplyAdvModal(false); setAdvToApply(""); setAdvApplyAmt(""); }}
                  style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface2, color: T.muted, border: `1.5px solid ${T.border}`, fontFamily: "inherit" }}>Cancel</button>
                <button onClick={handleApplyAdvance} disabled={advApplying || !advToApply}
                  style={{ flex: 2, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: (advApplying || !advToApply) ? "not-allowed" : "pointer", opacity: (advApplying || !advToApply) ? 0.6 : 1, background: "#8b5cf6", color: "#fff", border: "none", fontFamily: "inherit" }}>{advApplying ? "Applying…" : "Apply Advance"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline Credit Note modal — opened from invoice drawer, no navigation */}
      {cnPrefill && (
        <CreditNotes
          prefill={cnPrefill}
          onClose={() => { setCnPrefill(null); loadInvoices(); }}
        />
      )}
    </>
  );
};

export default Invoices;