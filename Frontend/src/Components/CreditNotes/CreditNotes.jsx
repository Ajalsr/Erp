import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { FaPlus, FaTimes, FaSearch, FaFileInvoiceDollar, FaChevronLeft, FaChevronRight, FaBan, FaCheck } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

/* ─── Refund payment mode config ────────────────────────────────────────── */
const CN_MODES = [
  "Cash", "Bank Transfer", "Cheque", "PDC",
  "Credit Card", "Debit Card", "Demand Draft",
  "Online Transfer", "Letter of Credit", "Other",
];
const CN_MODE_ICONS = {
  "Cash": "💵", "Bank Transfer": "🏦", "Cheque": "📄", "PDC": "📋",
  "Credit Card": "💳", "Debit Card": "💳", "Demand Draft": "📜",
  "Online Transfer": "🌐", "Letter of Credit": "📃", "Other": "🔄",
};
const CN_ACCENT = ["#2563eb","#9333ea","#16a34a","#ea580c","#94a3b8"];
const CN_MODE_FIELDS = {
  "Cash":             [{ key: "receiptNo",    label: "Receipt No.",             placeholder: "e.g. RCP-001" }],
  "Bank Transfer":    [{ key: "bankName",     label: "Bank Name",               placeholder: "e.g. Emirates NBD" },
                       { key: "txnRef",       label: "Transaction Ref No.",     placeholder: "e.g. TXN-001234", required: true },
                       { key: "accountNo",    label: "Account / IBAN",          placeholder: "e.g. AE070331234567890123456" }],
  "Cheque":           [{ key: "chequeNo",     label: "Cheque No.",              placeholder: "e.g. 001234", required: true },
                       { key: "bankName",     label: "Bank Name",               placeholder: "e.g. ADIB" },
                       { key: "branch",       label: "Branch",                  placeholder: "e.g. Dubai Mall Branch" }],
  "PDC":              [{ key: "chequeNo",     label: "Cheque No.",              placeholder: "e.g. 001234", required: true },
                       { key: "chequeDate",   label: "Cheque Date",             type: "date", required: true },
                       { key: "bankName",     label: "Bank Name",               placeholder: "e.g. Mashreq Bank" },
                       { key: "branch",       label: "Branch",                  placeholder: "e.g. DIFC Branch" }],
  "Credit Card":      [{ key: "cardNetwork",  label: "Card Network",            type: "select", options: ["Visa","Mastercard","Amex","Other"] },
                       { key: "last4",        label: "Last 4 Digits",           placeholder: "e.g. 4242" },
                       { key: "approvalCode", label: "Approval Code",           placeholder: "e.g. 123456" }],
  "Debit Card":       [{ key: "cardNetwork",  label: "Card Network",            type: "select", options: ["Visa","Mastercard","Other"] },
                       { key: "last4",        label: "Last 4 Digits",           placeholder: "e.g. 4242" },
                       { key: "txnRef",       label: "Transaction Ref",         placeholder: "e.g. TXN-001234" }],
  "Demand Draft":     [{ key: "ddNo",         label: "DD No.",                  placeholder: "e.g. DD-001234", required: true },
                       { key: "bankName",     label: "Bank Name",               placeholder: "e.g. HDFC Bank" },
                       { key: "branch",       label: "Branch",                  placeholder: "e.g. Main Branch" }],
  "Online Transfer":  [{ key: "platform",     label: "Platform",                type: "select", options: ["NEFT","RTGS","IMPS","UPI","Wire Transfer","Other"] },
                       { key: "txnRef",       label: "Reference / UTR No.",     placeholder: "e.g. UTR12345678", required: true }],
  "Letter of Credit": [{ key: "lcNo",         label: "LC No.",                  placeholder: "e.g. LC-001234", required: true },
                       { key: "issuingBank",  label: "Issuing Bank",            placeholder: "e.g. First Abu Dhabi Bank" },
                       { key: "lcDate",       label: "LC Date",                 type: "date" }],
  "Other":            [{ key: "txnRef",       label: "Reference / Description", placeholder: "Enter reference or description" }],
};
const getCNPrimaryRef = (mode, d = {}) => {
  if (["Bank Transfer","Online Transfer","Debit Card","Other"].includes(mode)) return d.txnRef || "";
  if (["Cheque","PDC"].includes(mode)) return d.chequeNo ? `CHQ-${d.chequeNo}` : "";
  if (mode === "Demand Draft")     return d.ddNo || "";
  if (mode === "Letter of Credit") return d.lcNo || "";
  if (mode === "Credit Card")      return d.approvalCode ? `APPR-${d.approvalCode}` : "";
  if (mode === "Cash")             return d.receiptNo || "";
  return "";
};

const CnModeSelect = ({ value, onChange, T }) => {
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
        width: "100%", padding: "10px 13px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 8,
        border: `1.5px solid ${open ? "#f59e0b" : value ? "#f59e0b" : T.border}`,
        borderRadius: 9, background: value ? "rgba(245,158,11,.08)" : T.surface,
        cursor: "pointer", fontSize: 13, transition: "all .15s",
        boxShadow: open ? "0 0 0 3px rgba(245,158,11,.12)" : "none",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: value ? "rgba(245,158,11,.18)" : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
            {CN_MODE_ICONS[value] || "💳"}
          </div>
          <span style={{ color: value ? T.textPri : T.textSec, fontWeight: value ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {value || "Select payment mode…"}
          </span>
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? "#f59e0b" : T.textSec }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, boxShadow: "0 20px 48px rgba(0,0,0,.28)", overflow: "hidden" }}>
          <div style={{ padding: "8px 13px", borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: T.textSec }}>{CN_MODES.length} methods</div>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {CN_MODES.map((m, i) => {
              const active = value === m;
              const accent = CN_ACCENT[i % CN_ACCENT.length];
              return (
                <div key={m} onClick={() => { onChange(m); setOpen(false); }}
                  style={{ padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, background: active ? `${accent}18` : "transparent", display: "flex", alignItems: "center", gap: 11, transition: "background .1s" }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surface2; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: active ? `${accent}25` : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, border: `1.5px solid ${active ? accent : T.border}` }}>
                    {CN_MODE_ICONS[m]}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? accent : T.textPri }}>{m}</div>
                  {active && <svg style={{ marginLeft: "auto" }} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const CN_TYPE_ICONS = {
  "return_of_goods":       "📦",
  "price_adjustment":      "🏷️",
  "billing_error":         "🔧",
  "service_not_delivered": "🚫",
  "courtesy_credit":       "🎁",
  "other":                 "📝",
};
const CN_TYPE_ACCENT = "#2563eb";

const CnTypeSelect = ({ value, onChange, T }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = CN_TYPES.find(t => t.value === value);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "10px 13px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 8,
        border: `1.5px solid ${open ? CN_TYPE_ACCENT : value ? CN_TYPE_ACCENT : T.border}`,
        borderRadius: 9, background: value ? `rgba(37,99,235,.06)` : T.surface,
        cursor: "pointer", fontSize: 13, transition: "all .15s",
        boxShadow: open ? `0 0 0 3px rgba(37,99,235,.12)` : "none",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: value ? "rgba(37,99,235,.15)" : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
            {CN_TYPE_ICONS[value] || "📝"}
          </div>
          <span style={{ color: value ? T.textPri : T.textSec, fontWeight: value ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected?.label || "Select type…"}
          </span>
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? CN_TYPE_ACCENT : T.textSec }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, boxShadow: "0 20px 48px rgba(0,0,0,.28)", overflow: "hidden" }}>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {CN_TYPES.map(t => {
              const active = value === t.value;
              return (
                <div key={t.value} onClick={() => { onChange(t.value); setOpen(false); }}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, background: active ? `rgba(37,99,235,.1)` : "transparent", display: "flex", alignItems: "center", gap: 10, transition: "background .1s" }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surface2; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: active ? "rgba(37,99,235,.18)" : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, border: `1.5px solid ${active ? CN_TYPE_ACCENT : T.border}` }}>
                    {CN_TYPE_ICONS[t.value]}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? CN_TYPE_ACCENT : T.textPri }}>{t.label}</div>
                  {active && <svg style={{ marginLeft: "auto" }} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={CN_TYPE_ACCENT} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const fmt = (n, cur = "AED") =>
  `${cur} ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const INV_STATUS_COLOR = { unpaid: "#f59e0b", partial: "#3b82f6", overdue: "#ef4444" };

const CnInvoiceSelect = ({ value, onChange, invoices, T }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = invoices.find(i => i._id === value);
  const accent = "#2563eb";
  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 8 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "10px 13px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 8,
        border: `1.5px solid ${open ? accent : value ? accent : T.border}`,
        borderRadius: 9, background: value ? "rgba(37,99,235,.06)" : T.surface,
        cursor: "pointer", fontSize: 13, transition: "all .15s",
        boxShadow: open ? "0 0 0 3px rgba(37,99,235,.1)" : "none",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1, overflow: "hidden" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: value ? "rgba(37,99,235,.15)" : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
            🧾
          </div>
          {selected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", flex: 1 }}>
              <span style={{ fontWeight: 700, color: accent, fontFamily: "'DM Mono', monospace", fontSize: 12, whiteSpace: "nowrap" }}>{selected.invoiceNumber}</span>
              <span style={{ color: T.textSec, fontSize: 11, whiteSpace: "nowrap" }}>Due: {fmt(selected.balanceDue ?? 0)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: `${INV_STATUS_COLOR[selected.status] ?? "#64748b"}22`, color: INV_STATUS_COLOR[selected.status] ?? "#64748b", textTransform: "capitalize", whiteSpace: "nowrap" }}>{selected.status}</span>
            </div>
          ) : (
            <span style={{ color: T.textSec }}>— Select Invoice —</span>
          )}
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? accent : T.textSec }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, boxShadow: "0 20px 48px rgba(0,0,0,.28)", overflow: "hidden" }}>
          <div style={{ padding: "7px 13px", borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: T.textSec }}>{invoices.length} eligible invoice{invoices.length !== 1 ? "s" : ""}</div>
          </div>
          {invoices.length === 0 ? (
            <div style={{ padding: "16px 14px", fontSize: 12, color: T.textSec, textAlign: "center" }}>No eligible invoices for this customer.</div>
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {invoices.map(inv => {
                const active = value === inv._id;
                const sc = INV_STATUS_COLOR[inv.status] ?? "#64748b";
                return (
                  <div key={inv._id} onClick={() => { onChange(inv._id); setOpen(false); }}
                    style={{ padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, background: active ? `${accent}14` : "transparent", display: "flex", alignItems: "center", gap: 11, transition: "background .1s" }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surface2; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: active ? `${accent}20` : T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, border: `1.5px solid ${active ? accent : T.border}` }}>
                      🧾
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, color: active ? accent : T.textPri, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{inv.invoiceNumber}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: `${sc}22`, color: sc, textTransform: "capitalize" }}>{inv.status}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textSec }}>Balance due: <strong style={{ color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmt(inv.balanceDue ?? 0)}</strong></div>
                    </div>
                    {active && <svg style={{ flexShrink: 0 }} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const F = ({ label, children, req, T }) => (
  <div>
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textSec, marginBottom: 6 }}>
      {label}{req && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
    </label>
    {children}
  </div>
);

const STATUS_CFG = {
  draft:            { color: "#94a3b8", bg: "rgba(100,116,139,0.1)", label: "Draft"            },
  pending_approval: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Pending Approval" },
  approved:         { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  label: "Approved"         },
  applied:          { color: "#10b981", bg: "rgba(16,185,129,0.1)",  label: "Applied"          },
  closed:           { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  label: "Closed"           },
  void:             { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Void"             },
};


// ── Customer portal dropdown (matches Createinvoices style) ──────────────────
const CustomerDropdown = ({ value, onChange, customers, T }) => {
  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [query,   setQuery]   = useState("");
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);

  const selected = customers.find(c => c._id === value);
  const display  = selected ? (selected.displayName || selected.companyName || selected.firstName || "") : null;

  const filtered = query.trim()
    ? customers.filter(c => (c.displayName || c.companyName || c.firstName || "").toLowerCase().includes(query.toLowerCase()) || (c.customerCode || "").toLowerCase().includes(query.toLowerCase()))
    : customers;

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(filtered.length * 44 + 52, 280);
    const top = (window.innerHeight - r.bottom) > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, [filtered.length]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => { rafRef.current = requestAnimationFrame(() => measurePos()); });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => {
    if (!open) return;
    const s = () => measurePos();
    window.addEventListener("scroll", s, true);
    window.addEventListener("resize", s);
    return () => { window.removeEventListener("scroll", s, true); window.removeEventListener("resize", s); };
  }, [open, measurePos]);
  useEffect(() => {
    const h = e => { if (triggerRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return; setOpen(false); setReady(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const select = (c) => {
    onChange({ id: c._id, name: c.displayName || c.companyName || c.firstName || "" });
    setOpen(false); setReady(false); setQuery("");
  };

  const isDark = T.bg === "#080d1a" || T.bg?.includes("0d1a") || T.surface === "#0f172a" || T.textPri === "#f1f5f9";

  const dropdown = (
    <div ref={dropRef} style={{ position: "absolute", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.55)" : "0 8px 32px rgba(0,0,0,0.15)", overflow: "hidden", visibility: ready ? "visible" : "hidden", opacity: ready ? 1 : 0, transition: "opacity 0.12s ease" }}>
      <div style={{ padding: "8px 8px 4px" }}>
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customers…"
          style={{ width: "100%", padding: "7px 10px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>
      <div style={{ maxHeight: 228, overflowY: "auto", padding: "4px 8px 8px" }}>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: T.textSec, textAlign: "center", padding: "12px 0", margin: 0 }}>No customers found</p>
        ) : filtered.map((c, i) => {
          const name = c.displayName || c.companyName || c.firstName || "Unknown";
          const isAct = c._id === value;
          return (
            <div key={c._id || i} onClick={() => select(c)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px", borderRadius: 8, cursor: "pointer", background: isAct ? `${T.blue}22` : "transparent", transition: "background 0.1s" }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = T.surface2; }}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = "transparent"; }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: isAct ? 600 : 400, color: isAct ? T.blueLight : T.textPri, margin: 0 }}>{name}</p>
                {c.customerCode && <p style={{ fontSize: 11, color: T.textSec, margin: "1px 0 0", fontFamily: "'DM Mono', monospace" }}>{c.customerCode}</p>}
              </div>
              {isAct && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.blueLight} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div ref={triggerRef} onClick={handleOpen} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", height: 42, border: `1.5px solid ${open ? T.blueLight : T.border}`, borderRadius: 10, background: T.surface, cursor: "pointer", userSelect: "none", boxShadow: open ? `0 0 0 3px ${T.blue}22` : "none", transition: "border-color 0.15s, box-shadow 0.15s", boxSizing: "border-box" }}>
        <span style={{ fontSize: 13, fontWeight: display ? 500 : 400, color: display ? T.textPri : T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "inherit" }}>
          {display || "— Select Customer —"}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open ? T.blueLight : T.textSec} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && createPortal(dropdown, document.body)}
    </>
  );
};

// ── Invoice portal dropdown ───────────────────────────────────────────────────
const InvoiceDropdown = ({ value, onChange, invoices, T, isDark }) => {
  const [open,    setOpen]  = useState(false);
  const [ready,   setReady] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);

  const selected   = invoices.find(i => i._id === value);
  const balDue     = selected ? parseFloat(selected.balanceDue ?? selected.totals?.grandTotal ?? 0) : 0;
  const display    = selected ? `${selected.invoiceNumber} — Balance Due: AED ${balDue.toLocaleString("en-AE", { minimumFractionDigits: 2 })}` : null;

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(invoices.length * 48 + 16, 260);
    const top = (window.innerHeight - r.bottom) > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, [invoices.length]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => { rafRef.current = requestAnimationFrame(() => measurePos()); });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => {
    if (!open) return;
    const s = () => measurePos();
    window.addEventListener("scroll", s, true); window.addEventListener("resize", s);
    return () => { window.removeEventListener("scroll", s, true); window.removeEventListener("resize", s); };
  }, [open, measurePos]);
  useEffect(() => {
    const h = e => { if (triggerRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return; setOpen(false); setReady(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const STATUS_COLOR = { sent: "#3b82f6", partial: "#f59e0b", overdue: "#ef4444" };

  const dropdown = (
    <div ref={dropRef} style={{ position: "absolute", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.55)" : "0 8px 32px rgba(0,0,0,0.15)", overflow: "hidden", visibility: ready ? "visible" : "hidden", opacity: ready ? 1 : 0, transition: "opacity 0.12s ease" }}>
      <div style={{ maxHeight: 244, overflowY: "auto", padding: "6px 8px" }}>
        <div onClick={() => { onChange(""); setOpen(false); setReady(false); }}
          style={{ padding: "9px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: value === "" ? T.blueLight : T.textSec, fontWeight: value === "" ? 600 : 400, background: value === "" ? `${T.blue}22` : "transparent" }}
          onMouseEnter={e => { if (value) e.currentTarget.style.background = T.surface2; }}
          onMouseLeave={e => { if (value) e.currentTarget.style.background = "transparent"; }}>
          — None —
        </div>
        {invoices.map((inv, i) => {
          const isAct = inv._id === value;
          return (
            <div key={inv._id || i} onClick={() => { onChange(inv._id); setOpen(false); setReady(false); }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", borderRadius: 8, cursor: "pointer", background: isAct ? `${T.blue}22` : "transparent", transition: "background 0.1s" }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = T.surface2; }}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = "transparent"; }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: isAct ? T.blueLight : T.textPri, margin: 0, fontFamily: "'DM Mono', monospace" }}>{inv.invoiceNumber}</p>
                <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0" }}>
                  Balance Due: <strong style={{ color: "#f59e0b" }}>AED {parseFloat(inv.balanceDue ?? inv.totals?.grandTotal ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</strong>
                  <span style={{ marginLeft: 6, color: T.textSec, opacity: 0.6 }}>/ Total {parseFloat(inv.totals?.grandTotal || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}</span>
                </p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: `${STATUS_COLOR[inv.status] || "#94a3b8"}22`, color: STATUS_COLOR[inv.status] || "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{inv.status}</span>
            </div>
          );
        })}
        {invoices.length === 0 && <p style={{ fontSize: 12, color: T.textSec, textAlign: "center", padding: "12px 0", margin: 0 }}>No eligible invoices</p>}
      </div>
    </div>
  );

  return (
    <>
      <div ref={triggerRef} onClick={handleOpen} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", height: 42, border: `1.5px solid ${open ? T.blueLight : T.border}`, borderRadius: 10, background: T.surface, cursor: "pointer", userSelect: "none", boxShadow: open ? `0 0 0 3px ${T.blue}22` : "none", transition: "border-color 0.15s, box-shadow 0.15s", boxSizing: "border-box" }}>
        <span style={{ fontSize: 13, fontWeight: display ? 500 : 400, color: display ? T.textPri : T.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "inherit" }}>
          {display || "— None (manual credit note) —"}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open ? T.blueLight : T.textSec} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && createPortal(dropdown, document.body)}
    </>
  );
};

// ── Item catalog typeahead ────────────────────────────────────────────────────
const ItemSearch = ({ value, onSelect, onType, T, allItems }) => {
  const [query, setQuery]   = useState(value || "");
  const [open,  setOpen]    = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  const filtered = allItems.filter(i =>
    !query.trim() ||
    (i.name || "").toLowerCase().includes(query.toLowerCase()) ||
    (i.sku  || i.item_code || "").toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={query}
        onChange={e => { setQuery(e.target.value); onType(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Description or search item…"
        style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, zIndex: 1200, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.35)", maxHeight: 220, overflowY: "auto" }}>
          {filtered.map((item, i) => (
            <div key={item._id || i}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(item); setQuery(item.name || ""); setOpen(false); }}
              style={{ padding: "9px 12px", cursor: "pointer", borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.name}</p>
                <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0", fontFamily: "'DM Mono', monospace" }}>{item.sku || item.item_code || ""}</p>
              </div>
              <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: T.textSec, whiteSpace: "nowrap", marginLeft: 8 }}>
                {parseFloat(item.selling_price || item.price || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMPTY_ITEM   = { mode: "item",   description: "", qty: 1, unitPrice: 0, taxRate: 0, taxAmt: 0, total: 0 };
const EMPTY_MANUAL = { mode: "manual", description: "", qty: 1, unitPrice: 0, taxRate: 0, taxAmt: 0, total: 0 };
const CN_TYPES = [
  { value: "return_of_goods",      label: "Return of Goods" },
  { value: "price_adjustment",     label: "Price Adjustment" },
  { value: "billing_error",        label: "Billing Error" },
  { value: "service_not_delivered",label: "Service Not Delivered" },
  { value: "courtesy_credit",      label: "Courtesy Credit" },
  { value: "other",                label: "Other" },
];

const DEFAULT_FORM = {
  customerId: "", customerName: "",
  sourceDocId: "", sourceDocType: "invoice", sourceDocNumber: "",
  cnType: "return_of_goods",
  reason: "",
  date: new Date().toISOString().split("T")[0],
  lineItems: [{ ...EMPTY_ITEM }],
  notes: "",
};

const calcItem = (item) => {
  const base = (item.qty || 0) * (item.unitPrice || 0);
  const taxAmt = base * ((item.taxRate || 0) / 100);
  return { ...item, taxAmt: Math.round(taxAmt * 100) / 100, total: Math.round((base + taxAmt) * 100) / 100 };
};

const calcTotals = (items) => {
  const subtotal  = items.reduce((s, i) => s + (i.qty || 0) * (i.unitPrice || 0), 0);
  const taxTotal  = items.reduce((s, i) => s + (i.taxAmt || 0), 0);
  return {
    subtotal:   Math.round(subtotal  * 100) / 100,
    taxTotal:   Math.round(taxTotal  * 100) / 100,
    grandTotal: Math.round((subtotal + taxTotal) * 100) / 100,
  };
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CreditNotes({ prefill: inlinePrefill = null, onClose: onInlineClose = null }) {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const location = useLocation();

  const [notes,      setNotes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [search,     setSearch]     = useState("");
  const [filterSt,   setFilterSt]   = useState("all");
  const [page,       setPage]       = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [actioning,      setActioning]     = useState(false);
  const [custInvs,       setCustInvs]      = useState([]);
  const [prefillSource,  setPrefillSource] = useState(null);
  const [prefillLoading, setPrefillLoading]= useState(false);
  const [allItems,       setAllItems]      = useState([]);
  const [allCustomers,   setAllCustomers]  = useState([]);
  const [applyInvoiceId, setApplyInvoiceId] = useState("");
  const [applyInvoices,  setApplyInvoices]  = useState([]);
  const [applyAmount,    setApplyAmount]    = useState("");
  const [refundModal,    setRefundModal]    = useState(false);
  const [refundAmt,      setRefundAmt]      = useState("");
  const [refundPayMode,  setRefundPayMode]  = useState("Cash");
  const [refundDetails,  setRefundDetails]  = useState({});
  const [refundNotesTxt, setRefundNotesTxt] = useState("");
  const [refunding,      setRefunding]      = useState(false);
  const [drawerTab,      setDrawerTab]      = useState("details");

  const LIMIT = 15;

  const openModal = (prefillForm = null) => {
    setForm(prefillForm || DEFAULT_FORM);
    setPrefillSource(null);
    setCustInvs([]);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setForm(DEFAULT_FORM);
    setPrefillSource(null);
    setCustInvs([]);
    if (onInlineClose) onInlineClose();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/credit-notes");
      setNotes(res.data?.data || []);
    } catch { nexusToast.error("Failed to load credit notes"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load all customers once on mount
  useEffect(() => {
    axiosInstance.get("/api/customers/getcustomers")
      .then(r => setAllCustomers(r.data?.data ?? []))
      .catch(() => {});
  }, []);

  // When rendered inline from Invoices page (no navigation), open via prop
  useEffect(() => {
    if (!inlinePrefill) return;
    const p = inlinePrefill;
    const prefillForm = {
      ...DEFAULT_FORM,
      customerId:      p.customerId      || "",
      customerName:    p.customerName    || "",
      sourceDocId:     p.invoiceId       || "",
      sourceDocType:   "invoice",
      sourceDocNumber: p.invoiceNumber   || "",
    };
    openModal(prefillForm);
    if (p.invoiceId) {
      setPrefillLoading(true);
      axiosInstance.get(`/api/invoices/${p.invoiceId}`)
        .then(r => {
          const full = r.data?.data || r.data;
          const mapped = (full.lineItems || [])
            .filter(item => item._type !== "expense" && item.stockId)
            .map(item => calcItem({
              description: item.description || item.desc || "",
              qty:         parseFloat(item.qty || item.quantity || 1),
              unitPrice:   parseFloat(item.unitPrice || item.rate || 0),
              taxRate:     parseFloat(item.taxRate || 0),
              taxAmt: 0, total: 0,
            })).filter(i => i.description);
          if (mapped.length > 0) {
            setForm(f => ({ ...f, lineItems: mapped }));
            setPrefillSource({
              invNumber:  p.invoiceNumber,
              count:      mapped.length,
              amountPaid: parseFloat(p.amountPaid || full.amountPaid || 0),
              balanceDue: parseFloat(p.balanceDue || full.balanceDue || 0),
              isPartial:  parseFloat(p.amountPaid || 0) > 0 && parseFloat(p.balanceDue || 0) > 0,
            });
          }
        })
        .catch(() => {})
        .finally(() => setPrefillLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open create modal when arriving from "Raise Credit Note" on an invoice,
  // and pre-fetch that invoice's line items so the form is pre-filled
  useEffect(() => {
    if (inlinePrefill) return; // handled by inline prop effect above
    const p = location.state?.prefill;
    if (!p) return;
    const prefillForm = {
      ...DEFAULT_FORM,
      customerId:      p.customerId      || "",
      customerName:    p.customerName    || "",
      sourceDocId:     p.invoiceId       || "",
      sourceDocType:   "invoice",
      sourceDocNumber: p.invoiceNumber   || "",
    };
    openModal(prefillForm);
    if (p.invoiceId) {
      setPrefillLoading(true);
      axiosInstance.get(`/api/invoices/${p.invoiceId}`)
        .then(r => {
          const full = r.data?.data || r.data;
          const mapped = (full.lineItems || [])
            .filter(item => item._type !== "expense" && item.stockId)
            .map(item => calcItem({
              description: item.description || item.desc || "",
              qty:         parseFloat(item.qty || item.quantity || 1),
              unitPrice:   parseFloat(item.unitPrice || item.rate || 0),
              taxRate:     parseFloat(item.taxRate || 0),
              taxAmt: 0, total: 0,
            })).filter(i => i.description);
          if (mapped.length > 0) {
            const amountPaid  = parseFloat(p.amountPaid  || full.amountPaid  || 0);
            const balanceDue  = parseFloat(p.balanceDue  || full.balanceDue  || 0);
            setForm(f => ({ ...f, lineItems: mapped }));
            setPrefillSource({
              invNumber:  p.invoiceNumber,
              count:      mapped.length,
              amountPaid,
              balanceDue,
              isPartial:  amountPaid > 0 && balanceDue > 0,
            });
          }
        })
        .catch(() => {})
        .finally(() => setPrefillLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load item catalog when modal opens
  useEffect(() => {
    if (!modalOpen || allItems.length > 0) return;
    axiosInstance.get("/api/stocks/getitem")
      .then(r => setAllItems(r.data?.data || []))
      .catch(() => {});
  }, [modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load eligible invoices whenever a CN is open and approved (any approved CN can apply to any customer invoice)
  useEffect(() => {
    if (!drawerOpen || !selected || !["approved","applied"].includes(selected.status)) {
      setApplyInvoices([]); setApplyInvoiceId(""); setApplyAmount(""); return;
    }
    axiosInstance.get("/api/invoices")
      .then(r => {
        const all = r.data?.data?.invoices || [];
        const eligible = all.filter(inv =>
          inv.customerId === selected.customerId &&
          ["unpaid", "overdue", "partial"].includes(inv.status) &&
          (inv.balanceDue ?? inv.totals?.grandTotal ?? 0) > 0
        );
        setApplyInvoices(eligible);
        // Auto-select the linked source invoice and pre-fill amount
        if (selected.sourceDocId) {
          const linked = eligible.find(inv => inv._id === selected.sourceDocId);
          if (linked) {
            setApplyInvoiceId(selected.sourceDocId);
            const remaining = selected.remainingAmount ?? selected.totals?.grandTotal ?? 0;
            const cap = linked.balanceDue ?? 0;
            setApplyAmount(String(Math.min(remaining, cap)));
          }
        }
      })
      .catch(() => setApplyInvoices([]));
  }, [drawerOpen, selected]);

  // Load customer's invoices when customer changes (for optional source doc link)
  useEffect(() => {
    if (!form.customerId) { setCustInvs([]); return; }
    axiosInstance.get("/api/invoices")
      .then(r => {
        const all = r.data?.data?.invoices || [];
        setCustInvs(all.filter(inv =>
          (inv.customerId === form.customerId || inv.billTo?.name === form.customerName) &&
          ["unpaid", "overdue", "partial", "paid"].includes(inv.status) &&
          inv.type !== "proforma"
        ));
      })
      .catch(() => setCustInvs([]));
  }, [form.customerId, form.customerName]);

  // ── Filtered / paged list ─────────────────────────────────────────────────
  const filtered = notes.filter(n => {
    if (filterSt !== "all" && n.status !== filterSt) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (n.creditNoteNumber || "").toLowerCase().includes(q) ||
             (n.customerName    || "").toLowerCase().includes(q) ||
             (n.sourceDocNumber || "").toLowerCase().includes(q);
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  // ── Line item helpers ─────────────────────────────────────────────────────
  const updateItem = (idx, field, val) => {
    setForm(f => {
      const items = [...f.lineItems];
      const numVal = field === "description" ? val : Math.max(0, parseFloat(val) || 0);
      items[idx] = calcItem({ ...items[idx], [field]: numVal });
      return { ...f, lineItems: items };
    });
  };

  // Called when user picks an item from the catalog dropdown
  const selectCatalogItem = (idx, catalogItem) => {
    setForm(f => {
      const items = [...f.lineItems];
      items[idx] = calcItem({
        ...items[idx],
        description: catalogItem.name || catalogItem.itemName || "",
        unitPrice:   parseFloat(catalogItem.selling_price || catalogItem.price || 0),
        taxRate:     parseFloat(catalogItem.taxRate || catalogItem.tax_rate || 5),
      });
      return { ...f, lineItems: items };
    });
  };

  const addItem       = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_ITEM }] }));
  const addManualItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_MANUAL }] }));
  const removeItem    = (idx) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }));

  const totals = calcTotals(form.lineItems);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.customerId)  { nexusToast.error("Please select a customer"); return; }
    if (!form.reason.trim()) { nexusToast.error("Reason is required"); return; }
    if (form.lineItems.some(i => !i.description.trim())) { nexusToast.error("All line items need a description"); return; }
    if (form.lineItems.some(i => i.mode !== "manual" && i.qty <= 0)) { nexusToast.error("All items must have qty > 0"); return; }
    if (form.lineItems.some(i => i.unitPrice <= 0)) { nexusToast.error("All items must have a unit price > 0"); return; }
    setSubmitting(true);
    try {
      await axiosInstance.post("/api/credit-notes", {
        customerId:      form.customerId,
        customerName:    form.customerName,
        sourceDocId:     form.sourceDocId     || undefined,
        sourceDocType:   form.sourceDocId     ? "invoice" : undefined,
        sourceDocNumber: form.sourceDocNumber || undefined,
        cnType:          form.cnType,
        reason:          form.reason,
        date:            form.date,
        lineItems:       form.lineItems,
        notes:           form.notes,
      });
      nexusToast.success("Credit note created");
      closeModal();
      load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to create credit note");
    } finally { setSubmitting(false); }
  };

  const cnAction = async (id, endpoint, successMsg, errorMsg, body = null) => {
    setActioning(true);
    try {
      await axiosInstance.patch(`/api/credit-notes/${id}/${endpoint}`, body || undefined);
      nexusToast.success(successMsg);
      setDrawerOpen(false); setSelected(null);
      setApplyInvoiceId(""); setApplyInvoices([]);
      load();
    } catch (e) { nexusToast.error(e.response?.data?.message || errorMsg); }
    finally { setActioning(false); }
  };

  const handleSubmitCN = (id) => cnAction(id, "submit",  "Submitted for approval", "Failed to submit");
  const handleApprove  = (id) => cnAction(id, "approve", "Credit note approved",   "Failed to approve");
  const handleApply = (id) => {
    if (!applyInvoiceId) { nexusToast.error("Select an invoice to apply credit to"); return; }
    const amt = parseFloat(applyAmount);
    const body = { invoiceId: applyInvoiceId, ...(amt > 0 ? { amount: amt } : {}) };
    cnAction(id, "apply", "Credit applied to invoice", "Failed to apply", body);
  };
  const handleClose    = (id) => cnAction(id, "close",   "Credit note closed",     "Failed to close");
  const handleVoid     = (id) => cnAction(id, "void",    "Credit note voided",     "Failed to void");

  const handleRefundCash = async () => {
    const max = selected.remainingAmount ?? selected.totals?.grandTotal ?? 0;
    const amt = parseFloat(refundAmt);
    if (!amt || amt <= 0) { nexusToast.error("Enter a valid refund amount"); return; }
    if (amt > max + 0.005) { nexusToast.error(`Amount cannot exceed remaining credit (${fmt(max)})`); return; }
    if (!refundPayMode) { nexusToast.error("Select a payment mode"); return; }
    const required = (CN_MODE_FIELDS[refundPayMode] || []).filter(f => f.required);
    for (const f of required) {
      if (!refundDetails[f.key]) { nexusToast.error(`${f.label} is required`); return; }
    }
    setRefunding(true);
    try {
      await axiosInstance.patch(`/api/credit-notes/${selected._id}/refund`, {
        amount: amt,
        paymentMode: refundPayMode,
        reference: getCNPrimaryRef(refundPayMode, refundDetails),
        details: refundDetails,
        notes: refundNotesTxt,
      });
      nexusToast.success(`AED ${amt.toFixed(2)} refunded to customer`);
      setRefundModal(false);
      setDrawerOpen(false);
      setSelected(null);
      load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Refund failed");
    } finally { setRefunding(false); }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .cn-root * { box-sizing: border-box; }
    .cn-root { font-family: 'DM Sans', sans-serif; }
    .cn-row  { transition: background 0.1s; }
    .cn-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .cn-pill { cursor: pointer; transition: all 0.15s; }
    .cn-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .cn-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }
    .cn-btn { transition: all 0.15s; }
    .cn-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    @keyframes cn-fade  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes cn-modal { from { opacity: 0; transform: translate(-50%,-48%) scale(0.96); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
    @keyframes cn-slide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .cn-overlay { animation: cn-fade  0.2s ease forwards; }
    .cn-modal   { animation: cn-modal 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
    .cn-drawer  { animation: cn-slide 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
  `;


  const inputSt = { width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" };

  // ── Render ────────────────────────────────────────────────────────────────
  // Inline mode (rendered from Invoices page): skip the full list page, show only the modal
  return (
    <>
      <style>{css}</style>
      {!onInlineClose && (
      <div className="cn-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Credit Notes</h1>
            <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Issue and manage customer credit notes</p>
          </div>
          <button className="cn-btn" onClick={() => openModal()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11} /> New Credit Note
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: 11, pointerEvents: "none" }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search credit # or customer…"
              style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}><FaTimes size={11} /></button>}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "draft", "pending_approval", "approved", "closed", "void"].map(s => (
              <button key={s} onClick={() => { setFilterSt(s); setPage(1); }}
                className={`cn-pill${filterSt === s ? " cn-pill-active" : ""}`}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit", cursor: "pointer" }}>
                {s === "all" ? "All" : STATUS_CFG[s]?.label || s}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: T.textSec, marginLeft: "auto" }}>{filtered.length} note{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div style={{ ...card, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {["Credit #", "Date", "Customer", "Invoice", "Reason", "Amount", "Status", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i === 5 ? "right" : "left", fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ padding: "60px 20px", textAlign: "center", color: T.textSec }}>Loading…</td></tr>
              ) : paged.length > 0 ? paged.map((cn, i) => {
                const sc = STATUS_CFG[cn.status] || STATUS_CFG.draft;
                return (
                  <tr key={cn._id || i} className="cn-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span onClick={() => { setSelected(cn); setDrawerTab("details"); setDrawerOpen(true); }}
                        style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.blueLight, cursor: "pointer" }}>
                        {cn.creditNoteNumber}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{fmtDate(cn.date)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{cn.customerName || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{cn.sourceDocNumber || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cn.reason || "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.green }}>{fmt(cn.totals?.grandTotal)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setSelected(cn); setDrawerTab("details"); setDrawerOpen(true); }}
                          style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 11, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                          View
                        </button>
                        {["draft", "pending_approval", "approved"].includes(cn.status) && (
                          <button onClick={() => handleVoid(cn._id)}
                            style={{ padding: "4px 8px", border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 7, background: "rgba(239,68,68,0.06)", fontSize: 11, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }} title="Void">
                            <FaBan size={10} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="8" style={{ padding: "72px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textSec }}><FaFileInvoiceDollar /></div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>No credit notes yet</p>
                    <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>Issue credit notes to customers for returns or adjustments</p>
                    <button className="cn-btn" onClick={() => openModal()}
                      style={{ marginTop: 4, padding: "8px 20px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      New Credit Note
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
      )}

      {/* ── Create Modal ──────────────────────────────────────────────────── */}
      {modalOpen && (
        <>
          <div className="cn-overlay" onClick={closeModal}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.75)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", zIndex: 60 }} />
          <div className="cn-modal" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 620, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, zIndex: 61, boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.6)" : "0 12px 48px rgba(0,0,0,0.15)" }}>

            <div style={{ padding: "20px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>New Credit Note</h3>
              <button onClick={closeModal}
                style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: T.textSec, display: "flex" }}>
                <FaTimes size={11} />
              </button>
            </div>

            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* CN number notice */}
              <div style={{ padding: "10px 14px", borderRadius: 8, background: isDark ? "rgba(59,130,246,0.08)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59,130,246,0.25)" : "#bfdbfe"}`, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#60a5fa" : "#2563eb"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: isDark ? "#60a5fa" : "#2563eb" }}>
                  Credit note number will be auto-generated on save (e.g. <strong>CN-0001</strong>).
                </span>
              </div>

              {/* Customer + Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Customer" req T={T}>
                  <CustomerDropdown
                    value={form.customerId}
                    customers={allCustomers}
                    T={T}
                    onChange={v => {
                      setForm(f => ({ ...f, customerId: v?.id || "", customerName: v?.name || "", sourceDocId: "", sourceDocNumber: "", lineItems: [{ ...EMPTY_ITEM }] }));
                      setPrefillSource(null);
                    }}
                  />
                </F>
                <F label="Date" req T={T}>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ ...inputSt, colorScheme: isDark ? "dark" : "light" }} />
                </F>
              </div>

              {/* Credit Note Type */}
              <F label="Credit Note Type" req T={T}>
                <CnTypeSelect value={form.cnType} onChange={v => setForm(f => ({ ...f, cnType: v }))} T={T} />
              </F>

              {/* Link to source invoice (optional) */}
              <F label="Link to Invoice (optional)" T={T}>
                <InvoiceDropdown
                  value={form.sourceDocId}
                  invoices={custInvs}
                  T={T}
                  isDark={isDark}
                  onChange={async invId => {
                    if (!invId) {
                      setForm(f => ({ ...f, sourceDocId: "", sourceDocNumber: "", lineItems: [{ ...EMPTY_ITEM }] }));
                      setPrefillSource(null);
                      return;
                    }
                    const inv = custInvs.find(i => i._id === invId);
                    setForm(f => ({ ...f, sourceDocId: invId, sourceDocNumber: inv?.invoiceNumber || "" }));
                    setPrefillLoading(true);
                    try {
                      const r = await axiosInstance.get(`/api/invoices/${invId}`);
                      const full = r.data?.data || r.data;
                      const mapped = (full.lineItems || []).map(item => calcItem({
                        description: item.description || item.desc || "",
                        qty:         parseFloat(item.qty || item.quantity || 1),
                        unitPrice:   parseFloat(item.unitPrice || item.rate || 0),
                        taxRate:     parseFloat(item.taxRate || 0),
                        taxAmt: 0, total: 0,
                      })).filter(i => i.description).map(i => ({ ...i, mode: "item" }));
                      if (mapped.length > 0) {
                        setForm(f => ({ ...f, lineItems: mapped }));
                        setPrefillSource({ invNumber: inv?.invoiceNumber, count: mapped.length });
                      }
                    } catch (fetchErr) { void fetchErr; }
                    finally { setPrefillLoading(false); }
                  }}
                />
                {form.customerId && custInvs.length === 0 && (
                  <p style={{ fontSize: 11, color: T.textSec, marginTop: 4 }}>No eligible invoices for this customer.</p>
                )}
                {form.sourceDocId && (() => {
                  const inv = custInvs.find(i => i._id === form.sourceDocId);
                  if (!inv) return null;
                  const isPaid = inv.status === "paid";
                  const cap = isPaid
                    ? parseFloat(inv?.totals?.grandTotal ?? inv?.balanceDue ?? 0)
                    : parseFloat(inv?.balanceDue ?? inv?.totals?.grandTotal ?? 0);
                  return isPaid ? (
                    <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: isDark ? "rgba(16,185,129,0.08)" : "#f0fdf4", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span style={{ fontSize: 12, color: "#10b981" }}>
                        Invoice fully paid. CN will become a <strong>refund credit</strong> — max AED {cap.toLocaleString("en-AE", { minimumFractionDigits: 2 })}.
                      </span>
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span style={{ fontSize: 12, color: "#f59e0b" }}>
                        Credit limit: <strong>AED {cap.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</strong> — your credit note total cannot exceed this amount.
                      </span>
                    </div>
                  );
                })()}
              </F>

              {/* Reason */}
              <F label="Reason" req T={T}>
                <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Returned goods, pricing error, service not delivered…"
                  style={inputSt} />
              </F>

              {/* Line items */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Line Items</p>
                  {prefillLoading && (
                    <span style={{ fontSize: 11, color: T.textSec }}>Loading invoice items…</span>
                  )}
                  {prefillSource && !prefillLoading && (
                    <>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: isDark ? "rgba(59,130,246,0.12)" : "#eff6ff", color: isDark ? "#60a5fa" : "#1d4ed8", border: `1px solid ${isDark ? "rgba(59,130,246,0.25)" : "#bfdbfe"}` }}>
                        Pre-filled from {prefillSource.invNumber} · {prefillSource.count} item{prefillSource.count !== 1 ? "s" : ""}
                      </span>
                      {prefillSource.isPartial && (
                        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 12, color: "#f59e0b", marginTop: 4 }}>
                          ⚠️ Partial payment of <strong>AED {prefillSource.amountPaid.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</strong> already received.
                          Credit note total must not exceed balance due of <strong>AED {prefillSource.balanceDue.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</strong>.
                          Adjust quantities or prices below to match the outstanding balance.
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Column headers — item mode */}
                {form.lineItems.some(i => i.mode !== "manual") && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 100px 70px 90px 32px", gap: 8, padding: "0 2px", marginBottom: 2 }}>
                    {["Description", "Qty", "Unit Price", "Tax %", "Amount", ""].map((h, i) => (
                      <span key={i} style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i === 4 ? "right" : "left" }}>{h}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.lineItems.map((item, idx) => {
                    const numSt = { padding: "9px 8px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono', monospace" };
                    const canRemove = form.lineItems.length > 1;
                    const rmBtn = (
                      <button onClick={() => removeItem(idx)} disabled={!canRemove}
                        style={{ padding: "7px 8px", border: `1px solid ${T.border}`, borderRadius: 8, background: "transparent", color: T.textSec, cursor: canRemove ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", opacity: canRemove ? 1 : 0.4 }}>
                        <FaTimes size={10} />
                      </button>
                    );

                    if (item.mode === "manual") {
                      return (
                        <div key={idx}>
                          {idx === 0 || form.lineItems[idx - 1]?.mode !== "manual" ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 32px", gap: 8, padding: "0 2px", marginBottom: 4 }}>
                              {["Description", "Amount (AED)", ""].map((h, i) => (
                                <span key={i} style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i === 1 ? "right" : "left" }}>{h}</span>
                              ))}
                            </div>
                          ) : null}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 32px", gap: 8, alignItems: "center" }}>
                            <input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)}
                              placeholder="e.g. Return credit, discount adjustment…"
                              style={{ ...numSt, fontFamily: "inherit", padding: "9px 12px" }} />
                            <input type="number" min="0" value={item.unitPrice || ""}
                              onChange={e => {
                                const v = Math.max(0, parseFloat(e.target.value) || 0);
                                setForm(f => { const items = [...f.lineItems]; items[idx] = { ...items[idx], unitPrice: v, qty: 1, taxRate: 0, taxAmt: 0, total: v }; return { ...f, lineItems: items }; });
                              }}
                              onKeyDown={e => e.key === "-" && e.preventDefault()}
                              placeholder="0.00"
                              style={{ ...numSt, textAlign: "right" }} />
                            {rmBtn}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 70px 100px 70px 90px 32px", gap: 8, alignItems: "center" }}>
                        <ItemSearch value={item.description} allItems={allItems} T={T}
                          onSelect={cat => selectCatalogItem(idx, cat)}
                          onType={val => updateItem(idx, "description", val)} />
                        <input type="number" min="0" value={item.qty}
                          onChange={e => updateItem(idx, "qty", e.target.value)}
                          onKeyDown={e => e.key === "-" && e.preventDefault()}
                          style={{ ...numSt, textAlign: "center" }} />
                        <input type="number" min="0" value={item.unitPrice}
                          onChange={e => updateItem(idx, "unitPrice", e.target.value)}
                          onKeyDown={e => e.key === "-" && e.preventDefault()}
                          style={numSt} />
                        <input type="number" min="0" max="100" value={item.taxRate}
                          onChange={e => updateItem(idx, "taxRate", e.target.value)}
                          onKeyDown={e => e.key === "-" && e.preventDefault()}
                          style={{ ...numSt, textAlign: "center" }} />
                        <span style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.textPri }}>{fmt(item.total)}</span>
                        {rmBtn}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button onClick={addItem} style={{ padding: "7px 14px", border: `1px dashed ${T.border}`, borderRadius: 8, background: "transparent", color: T.textSec, cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                    <FaPlus size={10} /> Add Item
                  </button>
                  <button onClick={addManualItem} style={{ padding: "7px 14px", border: `1px dashed ${isDark ? "rgba(139,92,246,0.4)" : "#c4b5fd"}`, borderRadius: 8, background: "transparent", color: isDark ? "#a78bfa" : "#7c3aed", cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                    <FaPlus size={10} /> Add Adjustment
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px" }}>
                {[
                  { label: "Subtotal",   value: fmt(totals.subtotal) },
                  { label: "Tax (VAT)",  value: fmt(totals.taxTotal) },
                  { label: "Grand Total", value: fmt(totals.grandTotal), bold: true },
                ].map(({ label, value, bold }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: label !== "Grand Total" ? `1px solid ${T.border}` : "none" }}>
                    <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: bold ? T.blue : T.textPri }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Over-limit warning */}
              {form.sourceDocId && (() => {
                const inv = custInvs.find(i => i._id === form.sourceDocId);
                if (!inv) return null;
                const isPaid = inv.status === "paid";
                const cap = isPaid
                  ? parseFloat(inv?.totals?.grandTotal ?? 0)
                  : parseFloat(inv?.balanceDue ?? inv?.totals?.grandTotal ?? 0);
                if (totals.grandTotal > cap + 0.005) return (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span style={{ fontSize: 12, color: "#ef4444" }}>
                      Total <strong>AED {totals.grandTotal.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</strong> exceeds invoice {isPaid ? "total" : "balance due"} of <strong>AED {cap.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</strong>. Reduce quantities or amounts.
                    </span>
                  </div>
                );
                return null;
              })()}

              {/* Notes */}
              <F label="Notes" T={T}>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional internal notes…"
                  style={{ ...inputSt, resize: "vertical" }} />
              </F>
            </div>

            <div style={{ padding: "14px 22px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10 }}>
              <button className="cn-btn" onClick={handleSubmit} disabled={submitting}
                style={{ flex: 1, padding: 11, background: submitting ? T.surface2 : T.blue, color: submitting ? T.textSec : "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {submitting ? "Creating…" : "Create Credit Note"}
              </button>
              <button onClick={closeModal}
                style={{ padding: "11px 20px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && selected && (() => {
        const cn = selected;
        const sc = STATUS_CFG[cn.status] || STATUS_CFG.draft;
        return (
          <>
            <div className="cn-overlay" onClick={() => { setDrawerOpen(false); setSelected(null); }}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />
            <div className="cn-drawer" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 440, maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

              {/* Drawer header */}
              <div style={{ borderBottom: `1px solid ${T.border}` }}>
                <div style={{ padding: "20px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>Credit Note</h3>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.blueLight }}>{cn.creditNoteNumber}</span>
                  </div>
                  <button onClick={() => { setDrawerOpen(false); setSelected(null); }}
                    style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: T.textSec, display: "flex" }}>
                    <FaTimes size={11} />
                  </button>
                </div>
                {/* Tabs */}
                <div style={{ display: "flex", padding: "0 20px" }}>
                  {["details", "history"].map(tab => (
                    <button key={tab} onClick={() => setDrawerTab(tab)}
                      style={{ padding: "8px 16px", border: "none", borderBottom: `2px solid ${drawerTab === tab ? T.blue : "transparent"}`, background: "transparent", color: drawerTab === tab ? T.blue : T.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", transition: "all .15s" }}>
                      {tab === "history" ? "History" : "Details"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drawer body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

                {/* ── History tab ── */}
                {drawerTab === "history" && (() => {
                  const apps = cn.applications || [];
                  if (apps.length === 0) return (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: T.textSec }}>
                      <p style={{ fontSize: 13 }}>No application history yet.</p>
                    </div>
                  );
                  return (
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em" }}>Invoice</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em" }}>Applied</span>
                      </div>
                      {apps.map((a, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: i < apps.length - 1 ? `1px solid ${T.border}` : "none" }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0, fontFamily: "'DM Mono', monospace" }}>{a.invoiceNumber || a.invoiceId}</p>
                            <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0" }}>{a.date || "—"}</p>
                          </div>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.green }}>AED {(a.amount ?? 0).toFixed(2)}</span>
                        </div>
                      ))}
                      <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", background: isDark ? "rgba(16,185,129,0.06)" : "#f0fdf4" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.textSec }}>Total Applied</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 800, color: T.green }}>
                          AED {apps.reduce((s, a) => s + (a.amount ?? 0), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Details tab ── */}
                {drawerTab === "details" && <>
                {/* Meta */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Customer",       value: cn.customerName || "—" },
                    { label: "Date",            value: fmtDate(cn.date) },
                    { label: "Reason",          value: cn.reason || "—" },
                    { label: "Linked Invoice",  value: cn.sourceDocNumber || "—" },
                  ].map(({ label, value }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Line items */}
                {cn.lineItems?.length > 0 && (
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {cn.lineItems.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: i < cn.lineItems.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.description}</p>
                          <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0", fontFamily: "'DM Mono', monospace" }}>
                            {item.qty} × {fmt(item.unitPrice)} + {item.taxRate}% tax
                          </p>
                        </div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.green }}>{fmt(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals + balance breakdown */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Subtotal",    value: fmt(cn.totals?.subtotal) },
                    { label: "Tax (VAT)",   value: fmt(cn.totals?.vatTotal ?? cn.totals?.taxTotal) },
                    { label: "Grand Total", value: fmt(cn.totals?.grandTotal), bold: true },
                    ...(cn.appliedAmount  > 0 ? [{ label: "Applied to Invoices", value: `− ${fmt(cn.appliedAmount)}`,  dim: true }] : []),
                    ...(cn.refundedAmount > 0 ? [{ label: "Refunded as Cash",    value: `− ${fmt(cn.refundedAmount)}`, dim: true }] : []),
                    ...((cn.appliedAmount > 0 || cn.refundedAmount > 0) ? [{
                      label: "Remaining Credit",
                      value: fmt(cn.remainingAmount ?? (cn.totals?.grandTotal - (cn.appliedAmount || 0) - (cn.refundedAmount || 0))),
                      accent: true,
                    }] : []),
                  ].map(({ label, value, bold, dim, accent }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", background: bold ? (isDark ? "rgba(16,185,129,0.06)" : "#f0fdf4") : accent ? (isDark ? "rgba(59,130,246,0.07)" : "#eff6ff") : "transparent" }}>
                      <span style={{ fontSize: 12, color: dim ? T.textSec : T.textSec, fontWeight: bold || accent ? 700 : 400 }}>{label}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: bold || accent ? 800 : 600, color: bold ? T.green : accent ? (isDark ? "#60a5fa" : "#1d4ed8") : dim ? T.textSec : T.textPri }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Apply to Invoice panel — shown for approved/applied CNs with remaining credit */}
                {["approved","applied"].includes(cn.status) && (cn.remainingAmount ?? cn.totals?.grandTotal ?? 0) > 0 && (
                  <div style={{ background: isDark ? "rgba(59,130,246,0.07)" : "#eff6ff", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 12, padding: "14px" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#60a5fa" : "#1d4ed8", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Apply to Invoice</p>
                    <p style={{ fontSize: 11, color: T.textSec, margin: "0 0 10px" }}>
                      Available credit: <strong style={{ fontFamily: "'DM Mono', monospace" }}>
                        {fmt(cn.remainingAmount ?? cn.totals?.grandTotal)}
                      </strong>
                    </p>
                    <CnInvoiceSelect
                      value={applyInvoiceId}
                      onChange={setApplyInvoiceId}
                      invoices={applyInvoices}
                      T={T}
                    />
                    <input type="number" min={0.01} step={0.01}
                      value={applyAmount}
                      onChange={e => setApplyAmount(e.target.value)}
                      placeholder={`Amount (max ${fmt(cn.remainingAmount ?? cn.totals?.grandTotal)})`}
                      style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono', monospace", boxSizing: "border-box" }}
                    />
                  </div>
                )}
                </>}
              </div>

              {/* Drawer actions — follow status flow */}
              <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {cn.status === "draft" && (
                  <button className="cn-btn" disabled={actioning} onClick={() => handleSubmitCN(cn._id)}
                    style={{ flex: 1, padding: 10, background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: actioning ? "not-allowed" : "pointer", opacity: actioning ? 0.6 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <FaCheck size={11} /> {actioning ? "Submitting…" : "Submit for Approval"}
                  </button>
                )}
                {cn.status === "pending_approval" && (
                  <button className="cn-btn" disabled={actioning} onClick={() => handleApprove(cn._id)}
                    style={{ flex: 1, padding: 10, background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: actioning ? "not-allowed" : "pointer", opacity: actioning ? 0.6 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <FaCheck size={11} /> {actioning ? "Approving…" : "Approve"}
                  </button>
                )}
                {["approved","applied"].includes(cn.status) && (cn.remainingAmount ?? cn.totals?.grandTotal ?? 0) > 0 && (
                  <>
                    <button className="cn-btn" disabled={actioning || !applyInvoiceId} onClick={() => handleApply(cn._id)}
                      title={!applyInvoiceId ? "Select an invoice above" : "Apply credit to invoice"}
                      style={{ flex: 1, padding: 10, background: T.surface2, color: applyInvoiceId ? T.green : T.textMuted, border: `1px solid ${applyInvoiceId ? T.greenDim : T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: (actioning || !applyInvoiceId) ? "not-allowed" : "pointer", opacity: (actioning || !applyInvoiceId) ? 0.6 : 1, fontFamily: "inherit" }}>
                      {actioning ? "Applying…" : "Apply to Invoice"}
                    </button>
                    <button className="cn-btn" disabled={actioning} onClick={() => {
                      setRefundAmt(String(cn.remainingAmount ?? cn.totals?.grandTotal ?? ""));
                      setRefundPayMode("Cash");
                      setRefundDetails({});
                      setRefundNotesTxt("");
                      setRefundModal(true);
                    }}
                      style={{ flex: 1, padding: 10, background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: actioning ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                      ↩ Refund as Cash
                    </button>
                  </>
                )}
                {cn.status === "applied" && (
                  <button className="cn-btn" disabled={actioning} onClick={() => handleClose(cn._id)}
                    style={{ flex: 1, padding: 10, background: T.surface2, color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: actioning ? "not-allowed" : "pointer", opacity: actioning ? 0.6 : 1, fontFamily: "inherit" }}>
                    {actioning ? "Closing…" : "Close"}
                  </button>
                )}
                {["draft", "pending_approval", "approved"].includes(cn.status) && (
                  <button className="cn-btn" disabled={actioning} onClick={() => handleVoid(cn._id)}
                    style={{ flex: 1, padding: 10, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: actioning ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    Void
                  </button>
                )}
                <button className="cn-btn" onClick={() => { setDrawerOpen(false); setSelected(null); }}
                  style={{ padding: "10px 16px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Dismiss
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Refund as Cash Modal ──────────────────────────────────────────── */}
      {refundModal && selected && (() => {
        const maxAmt = selected.remainingAmount ?? selected.totals?.grandTotal ?? 0;
        const modeFields = CN_MODE_FIELDS[refundPayMode] || [];
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 9400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={e => e.target === e.currentTarget && setRefundModal(false)}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24, width: 440, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,0.4)" }}>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, marginBottom: 4 }}>↩ Refund as Cash</div>
              <div style={{ fontSize: 12, color: T.textSec, marginBottom: 18 }}>
                {selected.creditNoteNumber} · Remaining credit: <strong style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(maxAmt)}</strong>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textSec, marginBottom: 6 }}>
                  Refund Amount <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input type="number" min={0.01} max={maxAmt} step={0.01} value={refundAmt}
                  onChange={e => {
                    const raw = parseFloat(e.target.value) || 0;
                    setRefundAmt(raw > maxAmt ? String(maxAmt) : e.target.value);
                  }}
                  style={{ ...inputSt, fontFamily: "'DM Mono', monospace",
                    border: `1.5px solid ${parseFloat(refundAmt) > maxAmt + 0.005 ? "#ef4444" : T.border}` }} />
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 4 }}>
                  Max: <span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(maxAmt)}</span>
                </div>
              </div>

              {/* Payment mode */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textSec, marginBottom: 6 }}>
                  Payment Mode <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <CnModeSelect value={refundPayMode} T={T}
                  onChange={m => { setRefundPayMode(m); setRefundDetails({}); }} />
              </div>

              {/* Dynamic mode-specific fields */}
              {modeFields.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14, padding: "14px", background: T.surface2, borderRadius: 10, border: `1px solid ${T.border}` }}>
                  {modeFields.map(f => (
                    <div key={f.key}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textSec, marginBottom: 6 }}>
                        {f.label}{f.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
                      </label>
                      {f.type === "select" ? (
                        <select value={refundDetails[f.key] || ""} onChange={e => setRefundDetails(d => ({ ...d, [f.key]: e.target.value }))}
                          style={{ ...inputSt, cursor: "pointer" }}>
                          <option value="">— Select —</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={f.type || "text"} value={refundDetails[f.key] || ""} placeholder={f.placeholder || ""}
                          onChange={e => setRefundDetails(d => ({ ...d, [f.key]: e.target.value }))}
                          style={{ ...inputSt, fontFamily: f.type === "date" ? "inherit" : "'DM Mono', monospace" }} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textSec, marginBottom: 6 }}>Notes</label>
                <input type="text" value={refundNotesTxt} onChange={e => setRefundNotesTxt(e.target.value)}
                  placeholder="Optional reason or memo"
                  style={inputSt} />
              </div>

              <div style={{ padding: "10px 13px", borderRadius: 8, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 12, color: "#10b981", marginBottom: 18 }}>
                Cash returned to customer directly. CN marked as used — no invoice affected.
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setRefundModal(false)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif" }}>
                  Cancel
                </button>
                <button onClick={handleRefundCash} disabled={refunding}
                  style={{ flex: 2, padding: "10px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: refunding ? "not-allowed" : "pointer", opacity: refunding ? 0.6 : 1, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                  {refunding ? "Processing…" : "↩ Confirm Refund"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
