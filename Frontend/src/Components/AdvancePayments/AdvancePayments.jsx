import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import DatePicker from "react-datepicker";
import { format, addDays, addMonths, isSameDay } from "date-fns";
import useThemeStore from "../../store/useThemeStore";
import useIsMobile from "../../helper/useIsMobile";
import axiosInstance from "../../helper/axiosInstance";
import useRealtime from "../../helper/useRealtime";
import nexusToast from "../../helper/nexusToast";
import "react-datepicker/dist/react-datepicker.css";

const buildTheme = (isDark) => ({
  bg:       isDark ? "#0a0e1a"  : "#f1f5f9",
  surface:  isDark ? "#111827"  : "#ffffff",
  surface2: isDark ? "#1a2234"  : "#f8fafc",
  border:   isDark ? "#1e2d47"  : "#e2e8f0",
  accent:   "#f59e0b",
  green:    "#10b981",
  red:      "#ef4444",
  blue:     "#3b82f6",
  purple:   "#8b5cf6",
  text:     isDark ? "#f1f5f9"  : "#0f172a",
  muted:    "#64748b",
  input:    isDark ? "#0f172a"  : "#ffffff",
  inputBdr: isDark ? "#1e2d47"  : "#e2e8f0",
});

const fmt = (n) => `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; } };
const localISO = (d) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local tz

const MODES = ["Cash", "Bank Transfer", "Cheque", "PDC", "Credit Card", "Debit Card", "Demand Draft", "Online Transfer", "Letter of Credit", "Other"];
const MODE_ICONS = { "Cash": "💵", "Bank Transfer": "🏦", "Cheque": "📄", "PDC": "📋", "Credit Card": "💳", "Debit Card": "💳", "Demand Draft": "📜", "Online Transfer": "🌐", "Letter of Credit": "📃", "Other": "🔄" };

// Per-mode dynamic fields — mirrors PaymentsReceived
const MODE_FIELDS = {
  "Cash":             [{ key: "receiptNo",   label: "Receipt No.",         placeholder: "e.g. RCP-001" }],
  "Bank Transfer":    [{ key: "bankName",    label: "Bank Name",           placeholder: "e.g. Emirates NBD" },
                       { key: "txnRef",      label: "Transaction Ref No.", placeholder: "e.g. TXN-001234", required: true },
                       { key: "accountNo",   label: "Account / IBAN",      placeholder: "e.g. AE07033..." }],
  "Cheque":           [{ key: "chequeNo",    label: "Cheque No.",          placeholder: "e.g. 001234", required: true },
                       { key: "bankName",    label: "Bank Name",           placeholder: "e.g. ADIB" },
                       { key: "branch",      label: "Branch",              placeholder: "e.g. Dubai Mall Branch" }],
  "PDC":              [{ key: "chequeNo",    label: "Cheque No.",          placeholder: "e.g. 001234", required: true },
                       { key: "chequeDate",  label: "Cheque Date",         type: "date", required: true },
                       { key: "bankName",    label: "Bank Name",           placeholder: "e.g. Mashreq Bank" },
                       { key: "branch",      label: "Branch",              placeholder: "e.g. DIFC Branch" }],
  "Credit Card":      [{ key: "cardNetwork", label: "Card Network",        type: "select", options: ["Visa", "Mastercard", "Amex", "Other"] },
                       { key: "last4",       label: "Last 4 Digits",       placeholder: "e.g. 4242" },
                       { key: "approvalCode",label: "Approval Code",       placeholder: "e.g. 123456" }],
  "Debit Card":       [{ key: "cardNetwork", label: "Card Network",        type: "select", options: ["Visa", "Mastercard", "Other"] },
                       { key: "last4",       label: "Last 4 Digits",       placeholder: "e.g. 4242" },
                       { key: "txnRef",      label: "Transaction Ref",     placeholder: "e.g. TXN-001234" }],
  "Demand Draft":     [{ key: "ddNo",        label: "DD No.",              placeholder: "e.g. DD-001234", required: true },
                       { key: "bankName",    label: "Bank Name",           placeholder: "e.g. HDFC Bank" },
                       { key: "branch",      label: "Branch",              placeholder: "e.g. Main Branch" }],
  "Online Transfer":  [{ key: "platform",   label: "Platform",            type: "select", options: ["NEFT", "RTGS", "IMPS", "UPI", "Wire Transfer", "Other"] },
                       { key: "txnRef",      label: "Reference / UTR No.", placeholder: "e.g. UTR12345678", required: true }],
  "Letter of Credit": [{ key: "lcNo",        label: "LC No.",              placeholder: "e.g. LC-001234", required: true },
                       { key: "issuingBank", label: "Issuing Bank",        placeholder: "e.g. First Abu Dhabi Bank" },
                       { key: "lcDate",      label: "LC Date",             type: "date" }],
  "Other":            [{ key: "txnRef",      label: "Reference / Description", placeholder: "Enter reference or description" }],
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

const STATUS_CFG = {
  unallocated: { label: "Unallocated", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  partial:     { label: "Partial",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  applied:     { label: "Applied",     color: "#10b981", bg: "rgba(16,185,129,0.1)" },
};

/* ─── Sel: portal custom dropdown ─────────────────────────────── */
const Sel = ({ value, onChange, options, placeholder = "Select…", T, icon }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, above: false });

  const opts = options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  const selected = opts.find(o => o.value === value);

  const updatePos = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelH = Math.min(opts.length * 44 + 12, 280);
    const spaceBelow = window.innerHeight - r.bottom;
    const above = spaceBelow < panelH + 16 && r.top > panelH + 16;
    setPos({ top: above ? r.top : r.bottom, left: r.left, width: r.width, above });
  };

  useLayoutEffect(() => { if (open) updatePos(); }, [open]); // eslint-disable-line
  useEffect(() => {
    const h = e => { if (!triggerRef.current?.contains(e.target) && !portalRef.current?.contains(e.target)) setOpen(false); };
    const sc = e => { if (open && !portalRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", sc, true);
    return () => { document.removeEventListener("mousedown", h); window.removeEventListener("scroll", sc, true); };
  }, [open]);

  const panel = open ? ReactDOM.createPortal(
    <div ref={portalRef} style={{
      position: "fixed", zIndex: 21000,
      ...(pos.above ? { bottom: window.innerHeight - pos.top + 6 } : { top: pos.top + 6 }),
      left: pos.left, width: pos.width, maxHeight: 280, overflowY: "auto",
      background: T.surface, borderRadius: 12, border: `1.5px solid ${T.border}`,
      boxShadow: "0 24px 60px rgba(0,0,0,.3)", padding: 6,
    }}>
      {opts.length === 0 && <div style={{ padding: "12px", fontSize: 12, color: T.muted, textAlign: "center" }}>No options</div>}
      {opts.map(o => {
        const active = o.value === value;
        return (
          <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
            style={{ padding: "9px 11px", borderRadius: 8, cursor: "pointer", fontSize: 13,
              background: active ? "rgba(245,158,11,.12)" : "transparent",
              color: active ? T.accent : T.text, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surface2; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</div>
              {o.sub && <div style={{ fontSize: 11, color: T.muted, fontFamily: "'DM Mono',monospace", marginTop: 1 }}>{o.sub}</div>}
            </div>
            {o.right && <span style={{ fontSize: 12, color: T.muted, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{o.right}</span>}
          </div>
        );
      })}
    </div>, document.body) : null;

  return (
    <div style={{ position: "relative" }}>
      <button ref={triggerRef} type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "10px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        border: `1.5px solid ${open || value ? T.accent : T.inputBdr}`, borderRadius: 9,
        background: value ? "rgba(245,158,11,.08)" : T.input, cursor: "pointer", fontSize: 13,
        boxShadow: open ? "0 0 0 3px rgba(245,158,11,.12)" : "none", fontFamily: "'DM Sans',sans-serif", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
          <span style={{ color: selected ? T.text : T.muted, fontWeight: selected ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected ? selected.label : placeholder}
          </span>
          {selected?.sub && <span style={{ fontSize: 11, color: T.muted, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{selected.sub}</span>}
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? T.accent : T.muted }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {panel}
    </div>
  );
};

/* ─── DateField: portal calendar ──────────────────────────────── */
const PRESETS = [
  { label: "Today",     fn: () => new Date() },
  { label: "Yesterday", fn: () => addDays(new Date(), -1) },
  { label: "Last Week", fn: () => addDays(new Date(), -7) },
  { label: "Last Month",fn: () => addMonths(new Date(), -1) },
];

const DateField = ({ value, onChange, T }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("calendar");
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, above: false });
  const sel = value ? new Date(value) : null;
  const PANEL_H = 360;

  const updatePos = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const above = window.innerHeight - r.bottom < PANEL_H + 16 && r.top > PANEL_H + 16;
    const panelW = Math.max(r.width, 320);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - panelW - 8);
    setPos({ top: above ? r.top : r.bottom, left, width: r.width, above });
  };
  useLayoutEffect(() => { if (open) updatePos(); }, [open]); // eslint-disable-line
  useEffect(() => {
    const h = e => { if (!triggerRef.current?.contains(e.target) && !portalRef.current?.contains(e.target)) setOpen(false); };
    const sc = e => { if (open && !portalRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", sc, true);
    return () => { document.removeEventListener("mousedown", h); window.removeEventListener("scroll", sc, true); };
  }, [open]);

  const pick = (d) => { onChange(localISO(d)); setOpen(false); setMode("calendar"); };

  const panel = open ? ReactDOM.createPortal(
    <div ref={portalRef} style={{
      position: "fixed", zIndex: 21000,
      ...(pos.above ? { bottom: window.innerHeight - pos.top + 6 } : { top: pos.top + 6 }),
      left: pos.left, width: Math.max(pos.width, 320), background: T.surface, borderRadius: 16,
      border: `1.5px solid ${T.border}`, boxShadow: "0 24px 60px rgba(0,0,0,.3)", overflow: "hidden" }}>
      <style>{`
        .adv-dp .react-datepicker{font-family:'DM Sans',sans-serif!important;border:none!important;border-radius:0!important;box-shadow:none!important;background:${T.surface}!important;width:100%!important;}
        .adv-dp .react-datepicker__header{background:${T.surface2}!important;border-bottom:1.5px solid ${T.border}!important;border-radius:0!important;padding-top:12px!important;}
        .adv-dp .react-datepicker__day-name{color:${T.muted}!important;font-size:11px!important;font-weight:600!important;}
        .adv-dp .react-datepicker__day{border-radius:8px!important;font-size:12px!important;color:${T.text}!important;}
        .adv-dp .react-datepicker__day:hover{background:rgba(245,158,11,.15)!important;color:#f59e0b!important;}
        .adv-dp .react-datepicker__day--selected{background:#f59e0b!important;color:#0a0e1a!important;font-weight:700!important;}
        .adv-dp .react-datepicker__day--today{background:rgba(245,158,11,.12)!important;color:#f59e0b!important;font-weight:700!important;}
        .adv-dp .react-datepicker__day--outside-month{color:${T.muted}!important;opacity:.4!important;}
        .adv-dp .react-datepicker__month-container{width:100%!important;}
        .adv-dp .react-datepicker__navigation{top:14px!important;}
      `}</style>
      <div style={{ display: "flex", borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
        {[["calendar", "📅", "Calendar"], ["presets", "⚡", "Quick"]].map(([v, ic, lbl]) => (
          <button key={v} onClick={() => setMode(v)} style={{ flex: 1, padding: "11px 8px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: "transparent", color: mode === v ? T.accent : T.muted, borderBottom: mode === v ? `2px solid ${T.accent}` : "2px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "'DM Sans',sans-serif" }}>
            <span>{ic}</span>{lbl}
          </button>
        ))}
      </div>
      <div style={{ padding: "14px 14px 10px" }} className="adv-dp">
        {mode === "calendar" ? (
          <DatePicker selected={sel} onChange={pick} inline
            renderCustomHeader={({ date, decreaseMonth, increaseMonth }) => (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
                <button onClick={decreaseMonth} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface2, cursor: "pointer", color: T.muted }}>‹</button>
                <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 14, color: T.text }}>{format(date, "MMMM yyyy")}</span>
                <button onClick={increaseMonth} style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.surface2, cursor: "pointer", color: T.muted }}>›</button>
              </div>
            )} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {PRESETS.map(p => {
              const d = p.fn();
              const active = sel && isSameDay(sel, d);
              return (
                <button key={p.label} onClick={() => pick(d)} style={{ padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer", border: `1.5px solid ${active ? T.accent : T.border}`, background: active ? "rgba(245,158,11,.1)" : T.surface2, fontFamily: "'DM Sans',sans-serif" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: active ? T.accent : T.text }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>{format(d, "MMM dd, yyyy")}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>, document.body) : null;

  return (
    <div style={{ position: "relative" }}>
      <button ref={triggerRef} type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "10px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        border: `1.5px solid ${open || sel ? T.accent : T.inputBdr}`, borderRadius: 9, background: sel ? "rgba(245,158,11,.08)" : T.input,
        cursor: "pointer", fontSize: 13, boxShadow: open ? "0 0 0 3px rgba(245,158,11,.12)" : "none", fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span>📅</span>
          <span style={{ color: sel ? T.text : T.muted, fontWeight: sel ? 600 : 400 }}>{sel ? format(sel, "EEE, MMM dd, yyyy") : "Select date…"}</span>
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? T.accent : T.muted }} width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {panel}
    </div>
  );
};

/* ─── Main ─────────────────────────────────────────────────────── */
export default function AdvancePayments() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = buildTheme(isDark);
  const isMobile = useIsMobile();

  const [advances, setAdvances] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [applyAdv, setApplyAdv] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(() => {
    setLoading(true);
    axiosInstance.get("/api/advance-payments/")
      .then(r => setAdvances(r.data?.data?.advances || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(['advance_payments_updated','invoices_updated','payments_updated'], load);
  useEffect(() => {
    axiosInstance.get("/api/customers/getcustomers")
      .then(r => setCustomers(r.data?.data ?? []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!search) return advances;
    const q = search.toLowerCase();
    return advances.filter(a => a.advanceNumber?.toLowerCase().includes(q) || a.customerName?.toLowerCase().includes(q) || a.reference?.toLowerCase().includes(q));
  }, [advances, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => { setPage(1); }, [search]);

  const totals = useMemo(() => ({
    total:     advances.reduce((s, a) => s + (a.amount || 0), 0),
    available: advances.reduce((s, a) => s + (a.remainingAmount || 0), 0),
    applied:   advances.reduce((s, a) => s + (a.allocatedAmount || 0), 0),
  }), [advances]);

  const inputStyle = { width: "100%", background: T.input, border: `1.5px solid ${T.inputBdr}`, color: T.text, fontSize: 13, padding: "9px 12px", borderRadius: 8, outline: "none", fontFamily: "'DM Sans',sans-serif" };
  const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6 };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: isMobile ? "14px" : "24px 28px", fontFamily: "'DM Sans',sans-serif", color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .adv-row:hover { background: ${isDark ? "rgba(255,255,255,0.02)" : "#f8fafc"} !important; }
        input:focus { border-color: rgba(245,158,11,.5) !important; }
      `}</style>

      <div style={{ display: "flex", flexWrap: isMobile ? "wrap" : "nowrap", justifyContent: "space-between", alignItems: "flex-start", gap: isMobile ? 10 : 0, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: isMobile ? 18 : 21, fontWeight: 800, color: T.text, margin: 0 }}>Customer Advances</h1>
          <p style={{ fontSize: 13, color: T.muted, margin: "4px 0 0" }}>Payments received before invoicing — held as liability, applied to future invoices</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 18px", width: isMobile ? "100%" : "auto", background: T.accent, color: "#0a0e1a", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Record Advance</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
        {[{ label: "Total Advances", val: fmt(totals.total), color: T.blue }, { label: "Available", val: fmt(totals.available), color: T.accent }, { label: "Applied", val: fmt(totals.applied), color: T.green }].map(s => (
          <div key={s.label} style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: T.muted, margin: "0 0 6px" }}>{s.label}</p>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 700, color: s.color, margin: 0 }}>{s.val}</p>
          </div>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search advance #, customer, reference…" style={{ ...inputStyle, maxWidth: isMobile ? "100%" : 340, marginBottom: 16 }} />

      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, overflowX: "auto", overflowY: "hidden" }}>
       <div style={{ minWidth: isMobile ? 800 : "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 120px 120px 120px 110px 90px", padding: "11px 16px", borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
          {["Advance #", "Customer", "Amount", "Applied", "Available", "Status", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, textAlign: i >= 2 && i <= 4 ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: T.muted, fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "0 0 6px" }}>No advances recorded</p>
            <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Record an advance when a customer pays before an invoice exists.</p>
          </div>
        ) : paged.map((a, i) => {
          const sc = STATUS_CFG[a.status] || STATUS_CFG.unallocated;
          return (
            <div key={a._id} className="adv-row" style={{ display: "grid", gridTemplateColumns: "130px 1fr 120px 120px 120px 110px 90px", padding: "13px 16px", borderBottom: i < paged.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, color: T.blue }}>{a.advanceNumber}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>{a.customerName}</p>
                <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0" }}>{fmtDate(a.date)} · {a.paymentMode}{a.salesOrderNumber ? ` · ${a.salesOrderNumber}` : ""}</p>
              </div>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: T.text, textAlign: "right" }}>{fmt(a.amount)}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: T.green, textAlign: "right" }}>{fmt(a.allocatedAmount)}</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: a.remainingAmount > 0 ? T.accent : T.muted, textAlign: "right" }}>{fmt(a.remainingAmount)}</span>
              <span style={{ display: "inline-flex", width: "fit-content", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{sc.label}</span>
              <div style={{ textAlign: "right" }}>
                {a.remainingAmount > 0.005 && (
                  <button onClick={() => setApplyAdv(a)} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: T.blue, fontFamily: "inherit" }}>Apply</button>
                )}
              </div>
            </div>
          );
        })}
       </div>
      </div>

      {filtered.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
          <span style={{ fontSize: 12, color: T.muted }}>
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} advances
          </span>
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: page === 1 ? "not-allowed" : "pointer", background: "transparent", border: `1px solid ${T.border}`, color: page === 1 ? T.muted : T.text, fontFamily: "'DM Sans',sans-serif" }}
              >← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                    background: page === p ? T.accent : "transparent",
                    color:      page === p ? "#0a0e1a" : T.muted,
                    border:     page === p ? "none" : `1px solid ${T.border}`,
                    fontWeight: page === p ? 700 : 400,
                  }}
                >{p}</button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: page === totalPages ? "not-allowed" : "pointer", background: "transparent", border: `1px solid ${T.border}`, color: page === totalPages ? T.muted : T.text, fontFamily: "'DM Sans',sans-serif" }}
              >Next →</button>
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateAdvanceModal T={T} customers={customers} inputStyle={inputStyle} labelStyle={labelStyle} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {applyAdv && <ApplyAdvanceModal T={T} advance={applyAdv} inputStyle={inputStyle} labelStyle={labelStyle} onClose={() => setApplyAdv(null)} onApplied={() => { setApplyAdv(null); load(); }} />}
    </div>
  );
}

/* ─── Create Advance Modal ────────────────────────────────────── */
function CreateAdvanceModal({ T, customers, inputStyle, labelStyle, onClose, onSaved }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ customerId: "", customerName: "", amount: "", date: localISO(new Date()), paymentMode: "Cash", depositAccount: "", salesOrderId: "", salesOrderNumber: "", notes: "" });
  const [details, setDetails] = useState({});
  const [sos, setSos] = useState([]);
  const [accounts, setAccounts] = useState([]); // cash/bank accounts for "Deposit To"
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.customerId) { setSos([]); return; }
    axiosInstance.get("/api/sales-orders/getsaleorder?limit=500")
      .then(r => { const all = r.data?.data?.salesOrders || []; setSos(all.filter(so => so.customerId === form.customerId && !["completed", "cancelled", "rejected"].includes(so.status))); })
      .catch(() => setSos([]));
  }, [form.customerId]);

  // Load cash/bank accounts for the "Deposit To" picker.
  useEffect(() => {
    axiosInstance.get("/api/accounts/?limit=500&status=active")
      .then(r => setAccounts((r.data?.data?.accounts || []).filter(a => a.isBankAccount)))
      .catch(() => {});
  }, []);

  const modeFields = MODE_FIELDS[form.paymentMode] || [];

  const save = async () => {
    if (!form.customerId) { nexusToast.error("Select a customer"); return; }
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { nexusToast.error("Enter a valid amount"); return; }
    for (const f of modeFields) {
      if (f.required && !details[f.key]) { nexusToast.error(`${f.label} is required`); return; }
    }
    setSaving(true);
    try {
      await axiosInstance.post("/api/advance-payments/", { ...form, amount: amt, reference: getPrimaryRef(form.paymentMode, details) });
      nexusToast.success("Advance recorded");
      onSaved();
    } catch (e) { nexusToast.error(e.response?.data?.message || "Failed to record advance"); }
    finally { setSaving(false); }
  };

  const custOpts = customers.map(c => ({ value: c._id, label: c.customerDisplayName || c.companyName || "Unknown", sub: c.customerCode || "" }));
  const soOpts = [{ value: "", label: "None" }, ...sos.map(so => ({ value: so.id || so._id, label: so.orderNumber, right: fmt(so.total) }))];

  return (
    <Overlay T={T} onClose={onClose} title="Record Customer Advance">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Customer <span style={{ color: "#ef4444" }}>*</span></label>
          <Sel T={T} value={form.customerId} options={custOpts} placeholder="Select customer…" icon="🏢"
            onChange={v => { const c = customers.find(x => x._id === v); setForm(f => ({ ...f, customerId: v, customerName: c?.customerDisplayName || c?.companyName || "", salesOrderId: "", salesOrderNumber: "" })); }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Amount <span style={{ color: "#ef4444" }}>*</span></label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} placeholder="0.00" />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <DateField T={T} value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Payment Mode</label>
          <Sel T={T} value={form.paymentMode} options={MODES.map(m => ({ value: m, label: m }))} icon={MODE_ICONS[form.paymentMode]}
            onChange={v => { setForm(f => ({ ...f, paymentMode: v })); setDetails({}); }} />
        </div>
        <div>
          <label style={labelStyle}>Deposit To (Cash / Bank Account)</label>
          <Sel T={T} value={form.depositAccount} icon="🏦"
            placeholder="Auto by payment mode"
            options={[{ value: "", label: "Auto (by payment mode)" }, ...accounts.map(a => ({ value: a._id, label: `[${a.accountCode}] ${a.accountName}` }))]}
            onChange={v => setForm(f => ({ ...f, depositAccount: v }))} />
        </div>
        {/* Dynamic per-mode fields */}
        {modeFields.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile || modeFields.length <= 1 ? "1fr" : "1fr 1fr", gap: 12, padding: "12px", background: T.surface2, borderRadius: 10, border: `1px solid ${T.border}` }}>
            {modeFields.map(f => (
              <div key={f.key} style={{ gridColumn: f.type === "date" || modeFields.length === 1 ? "1 / -1" : "auto" }}>
                <label style={labelStyle}>{f.label}{f.required && <span style={{ color: "#ef4444" }}> *</span>}</label>
                {f.type === "select" ? (
                  <Sel T={T} value={details[f.key] || ""} options={[{ value: "", label: "Select…" }, ...f.options.map(o => ({ value: o, label: o }))]} onChange={v => setDetails(d => ({ ...d, [f.key]: v }))} />
                ) : f.type === "date" ? (
                  <DateField T={T} value={details[f.key] || ""} onChange={v => setDetails(d => ({ ...d, [f.key]: v }))} />
                ) : (
                  <input value={details[f.key] || ""} onChange={e => setDetails(d => ({ ...d, [f.key]: e.target.value }))} style={inputStyle} placeholder={f.placeholder} />
                )}
              </div>
            ))}
          </div>
        )}
        {sos.length > 0 && (
          <div>
            <label style={labelStyle}>Link to Sales Order (optional)</label>
            <Sel T={T} value={form.salesOrderId} options={soOpts} placeholder="None" icon="📦"
              onChange={v => { const so = sos.find(x => (x.id || x._id) === v); setForm(f => ({ ...f, salesOrderId: v, salesOrderNumber: so?.orderNumber || "" })); }} />
          </div>
        )}
        <div>
          <label style={labelStyle}>Notes</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} placeholder="Optional" />
        </div>
        <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", fontSize: 12, color: T.blue }}>
          Posts to <b>Customer Advances</b> (liability). Apply to invoices later to settle balances.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface2, color: T.muted, border: `1.5px solid ${T.border}`, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, background: T.accent, color: "#0a0e1a", border: "none", fontFamily: "inherit" }}>{saving ? "Saving…" : "Record Advance"}</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ─── Apply Advance Modal ─────────────────────────────────────── */
function ApplyAdvanceModal({ T, advance, inputStyle, labelStyle, onClose, onApplied }) {
  const [invoices, setInvoices] = useState([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    axiosInstance.get("/api/invoices")
      .then(r => {
        const all = r.data?.data?.invoices || [];
        const open = all.filter(inv => inv.customerId === advance.customerId && ["unpaid", "overdue", "partial"].includes(inv.status) && inv.type !== "proforma" && (inv.balanceDue ?? 0) > 0);
        if (advance.salesOrderId) {
          open.sort((a, b) => {
            const am = (a.linkedSalesOrderIds || []).includes(advance.salesOrderId) ? 0 : 1;
            const bm = (b.linkedSalesOrderIds || []).includes(advance.salesOrderId) ? 0 : 1;
            return am - bm;
          });
        }
        setInvoices(open);
      })
      .catch(() => {});
  }, [advance.customerId, advance.salesOrderId]);

  const selectedInv = invoices.find(i => i._id === invoiceId);
  const maxApply = selectedInv ? Math.min(advance.remainingAmount, selectedInv.balanceDue) : advance.remainingAmount;

  const apply = async () => {
    if (!invoiceId) { nexusToast.error("Select an invoice"); return; }
    const amt = parseFloat(amount) || maxApply;
    if (amt <= 0) { nexusToast.error("Enter a valid amount"); return; }
    setApplying(true);
    try {
      const r = await axiosInstance.post(`/api/advance-payments/${advance._id}/apply`, { invoiceId, amount: amt });
      nexusToast.success(r.data?.message || "Advance applied");
      onApplied();
    } catch (e) { nexusToast.error(e.response?.data?.message || "Failed to apply advance"); }
    finally { setApplying(false); }
  };

  const invOpts = invoices.map(inv => ({
    value: inv._id,
    label: inv.invoiceNumber + (advance.salesOrderId && (inv.linkedSalesOrderIds || []).includes(advance.salesOrderId) ? "  ★" : ""),
    right: fmt(inv.balanceDue),
  }));

  return (
    <Overlay T={T} onClose={onClose} title="Apply Advance to Invoice">
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>
        {advance.advanceNumber} · {advance.customerName} · Available: <b style={{ color: T.accent, fontFamily: "'DM Mono',monospace" }}>{fmt(advance.remainingAmount)}</b>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Invoice <span style={{ color: "#ef4444" }}>*</span></label>
          <Sel T={T} value={invoiceId} options={invOpts} placeholder="Select invoice…" icon="📄"
            onChange={v => { setInvoiceId(v); const inv = invoices.find(i => i._id === v); setAmount(inv ? String(Math.min(advance.remainingAmount, inv.balanceDue)) : ""); }} />
          {invoices.length === 0 && <p style={{ fontSize: 11, color: T.muted, margin: "6px 0 0" }}>No open invoices for this customer.</p>}
          {advance.salesOrderNumber && <p style={{ fontSize: 11, color: T.muted, margin: "6px 0 0" }}>Advance linked to {advance.salesOrderNumber} — ★ invoices from that order shown first.</p>}
        </div>
        <div>
          <label style={labelStyle}>Amount to Apply</label>
          <input type="number" min="0" step="0.01" max={maxApply} value={amount} onChange={e => { const raw = parseFloat(e.target.value); setAmount(isNaN(raw) ? "" : String(Math.min(raw, maxApply))); }} style={inputStyle} placeholder="0.00" />
          <p style={{ fontSize: 11, color: T.muted, margin: "5px 0 0" }}>Max: <span style={{ fontFamily: "'DM Mono',monospace", color: T.text }}>{fmt(maxApply)}</span></p>
        </div>
        <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", fontSize: 12, color: T.green }}>
          Reduces invoice balance + advance liability. GL: DR Customer Advances / CR Accounts Receivable.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface2, color: T.muted, border: `1.5px solid ${T.border}`, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={apply} disabled={applying || !invoiceId} style={{ flex: 2, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: (applying || !invoiceId) ? "not-allowed" : "pointer", opacity: (applying || !invoiceId) ? 0.6 : 1, background: T.green, color: "#0a0e1a", border: "none", fontFamily: "inherit" }}>{applying ? "Applying…" : "Apply Advance"}</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ─── Shared overlay ──────────────────────────────────────────── */
function Overlay({ T, title, onClose, children }) {
  const isMobile = useIsMobile();
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", padding: isMobile ? 10 : 20 }}>
      <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: isMobile ? 16 : 24, width: 480, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,.4)" }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 18 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
