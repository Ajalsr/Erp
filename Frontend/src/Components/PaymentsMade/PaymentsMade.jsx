import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import { FaPlus, FaTimes, FaSearch, FaMoneyBillWave, FaChevronLeft, FaChevronRight, FaCheckCircle } from "react-icons/fa";
import { useSearchParams } from "react-router-dom";
import DatePicker from "react-datepicker";
import { format, isSameDay, addDays, addMonths } from "date-fns";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import useRealtime from "../../helper/useRealtime";
import nexusToast from "../../helper/nexusToast";
import "react-datepicker/dist/react-datepicker.css";

const fmtAED  = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PAYMENT_MODES = [
  "Cash", "Bank Transfer", "Cheque", "PDC",
  "Credit Card", "Debit Card", "Demand Draft",
  "Online Transfer", "Letter of Credit", "Other",
];

const MODE_FIELDS = {
  "Cash":             [{ key: "receiptNo",   label: "Receipt No.",         placeholder: "e.g. RCP-001" }],
  "Bank Transfer":    [{ key: "bankName",    label: "Bank Name",           placeholder: "e.g. Emirates NBD" },
                       { key: "txnRef",      label: "Transaction Ref No.", placeholder: "e.g. TXN-001234", required: true },
                       { key: "accountNo",   label: "Account / IBAN",      placeholder: "e.g. AE070331234567890123456" }],
  "Cheque":           [{ key: "chequeNo",    label: "Cheque No.",          placeholder: "e.g. 001234", required: true },
                       { key: "bankName",    label: "Bank Name",           placeholder: "e.g. ADIB" },
                       { key: "branch",      label: "Branch",              placeholder: "e.g. Dubai Mall Branch" }],
  "PDC":              [{ key: "chequeNo",    label: "Cheque No.",          placeholder: "e.g. 001234", required: true },
                       { key: "chequeDate",  label: "Cheque Date",         placeholder: "", type: "date", required: true },
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
                       { key: "lcDate",      label: "LC Date",             placeholder: "", type: "date" }],
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

/* ── shared animation keyframe (injected once) ─────────────────── */
const PORTAL_ANIM = `@keyframes pmSelIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`;

/* ── Avatar color palette — seeded by first char code ─────────── */
const AVATAR_PALETTE = [
  ["rgba(59,130,246,.18)",  "#3b82f6"],
  ["rgba(139,92,246,.18)",  "#8b5cf6"],
  ["rgba(16,185,129,.18)",  "#10b981"],
  ["rgba(245,158,11,.18)",  "#f59e0b"],
  ["rgba(239,68,68,.18)",   "#ef4444"],
  ["rgba(6,182,212,.18)",   "#06b6d4"],
];
const avatarColor = (name = "") => AVATAR_PALETTE[(name.charCodeAt(0) || 0) % AVATAR_PALETTE.length];

/* ── VendorSelect — portal dropdown with avatar initials ────────── */
const VendorSelect = ({ value, onChange, vendors = [], T, isDark, error }) => {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef(null);
  const portalRef  = useRef(null);
  const inputRef   = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = vendors.find(v => v._id === value) || null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vendors.filter(v =>
      !q ||
      v.displayName?.toLowerCase().includes(q) ||
      v.companyName?.toLowerCase().includes(q) ||
      v.vendorCode?.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [vendors, search]);

  const updatePos = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom, left: r.left, width: r.width });
    }
  };

  useEffect(() => {
    if (open) { updatePos(); setTimeout(() => inputRef.current?.focus(), 50); }
    else setSearch("");
  }, [open]);

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

  const selName = selected ? (selected.displayName || selected.companyName || "") : "";
  const [selBg, selFg] = avatarColor(selName);

  return (
    <div>
      <style>{PORTAL_ANIM}</style>
      <button type="button" ref={triggerRef} onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "10px 13px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        border: `1.5px solid ${error ? "#ef4444" : open ? T.blue : selected ? T.blue : T.border}`,
        borderRadius: 10, background: selected ? T.blueDim : isDark ? T.inputBg : T.surface2,
        cursor: "pointer", fontSize: 13, transition: "all .15s",
        boxShadow: open ? "0 0 0 3px rgba(59,130,246,.12)" : "none",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {selected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: selBg, color: selFg,
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12,
              border: `1.5px solid ${selFg}44` }}>
              {selName.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: T.textPri, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selName}
              </div>
              {selected.vendorCode && (
                <div style={{ fontSize: 10, color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{selected.vendorCode}</div>
              )}
            </div>
          </div>
        ) : (
          <span style={{ color: T.textSec }}>Select a vendor…</span>
        )}
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? T.blue : T.textSec }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && ReactDOM.createPortal(
        <div ref={portalRef} style={{
          position: "fixed", zIndex: 20000, top: pos.top + 6, left: pos.left, width: Math.max(pos.width, 280),
          background: isDark ? T.surface : "#fff", borderRadius: 14, border: `1.5px solid ${T.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,.22)", overflow: "hidden",
          animation: "pmSelIn .15s ease both",
        }}>
          {/* Search bar */}
          <div style={{ padding: "10px 12px", borderBottom: `1.5px solid ${T.border}`, background: isDark ? T.surface2 : "#f8fafc" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textSec, pointerEvents: "none" }}
                width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx={11} cy={11} r={8}/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input ref={inputRef} placeholder="Search vendor…" value={search} onChange={e => setSearch(e.target.value)} style={{
                width: "100%", padding: "7px 10px 7px 30px",
                border: `1.5px solid ${T.border}`, borderRadius: 8,
                background: isDark ? T.inputBg : "#fff",
                color: T.textPri, fontSize: 12, outline: "none",
                fontFamily: "'DM Sans', sans-serif",
              }} />
            </div>
          </div>

          {/* Options */}
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "18px 16px", color: T.textSec, fontSize: 13, textAlign: "center" }}>No vendors found</div>
            ) : filtered.map(v => {
              const name = v.displayName || v.companyName || "";
              const isActive = value === v._id;
              const [bg, fg] = avatarColor(name);
              return (
                <div key={v._id} onClick={() => { onChange(v); setOpen(false); }}
                  style={{
                    padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`,
                    background: isActive ? T.blueDim : "transparent",
                    display: "flex", alignItems: "center", gap: 11, transition: "background .1s",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = isDark ? T.surface2 : "#f8fafc"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: isActive ? `${T.blue}25` : bg, color: isActive ? T.blue : fg,
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12,
                    border: `1.5px solid ${isActive ? T.blue + "55" : fg + "44"}`,
                  }}>{name.charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? T.blue : T.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </div>
                    {v.companyName && v.displayName && (
                      <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>{v.companyName}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                    {v.vendorCode && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: T.textSec, background: isDark ? T.surface2 : "#f1f5f9", padding: "2px 7px", borderRadius: 5, border: `1px solid ${T.border}` }}>
                        {v.vendorCode}
                      </span>
                    )}
                    {isActive && (
                      <div style={{ width: 18, height: 18, borderRadius: 6, background: T.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* ── ModeSelect — portal dropdown with colored emoji icons ──────── */
const MODE_ICONS   = { Cash: "💵", "Bank Transfer": "🏦", Cheque: "📄", PDC: "📋", "Credit Card": "💳", "Debit Card": "💳", "Demand Draft": "📜", "Online Transfer": "🌐", "Letter of Credit": "📃", Other: "🔄" };
const MODE_ACCENTS = { Cash: "#16a34a", "Bank Transfer": "#2563eb", Cheque: "#d97706", PDC: "#f59e0b", "Credit Card": "#9333ea", "Debit Card": "#8b5cf6", "Demand Draft": "#d97706", "Online Transfer": "#0891b2", "Letter of Credit": "#0f766e", Other: "#94a3b8" };

const ModeSelect = ({ value, onChange, T, isDark }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const portalRef  = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const accent = MODE_ACCENTS[value] || T.textSec;

  const updatePos = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom, left: r.left, width: r.width });
    }
  };

  useEffect(() => { if (open) updatePos(); }, [open]);
  useEffect(() => {
    const h = e => {
      if (!triggerRef.current?.contains(e.target) && !portalRef.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div>
      <button type="button" ref={triggerRef} onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "10px 13px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        border: `1.5px solid ${open ? accent : value ? accent : T.border}`,
        borderRadius: 10, background: value ? `${accent}14` : isDark ? T.inputBg : T.surface2,
        cursor: "pointer", fontSize: 13, transition: "all .15s",
        boxShadow: open ? `0 0 0 3px ${accent}22` : "none",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0, fontSize: 14,
            background: value ? `${accent}22` : isDark ? T.surface2 : "#f1f5f9",
            border: `1.5px solid ${value ? accent + "55" : T.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{MODE_ICONS[value] || "💳"}</div>
          <span style={{ color: value ? T.textPri : T.textSec, fontWeight: value ? 600 : 400 }}>
            {value || "Select payment mode…"}
          </span>
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? accent : T.textSec }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && ReactDOM.createPortal(
        <div ref={portalRef} style={{
          position: "fixed", zIndex: 20000, top: pos.top + 6, left: pos.left, width: Math.max(pos.width, 240),
          background: isDark ? T.surface : "#fff", borderRadius: 14, border: `1.5px solid ${T.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,.22)", overflow: "hidden",
          animation: "pmSelIn .15s ease both",
        }}>
          <div style={{ padding: "8px 13px 7px", borderBottom: `1px solid ${T.border}`, background: isDark ? T.surface2 : "#f8fafc" }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: T.textSec }}>
              {PAYMENT_MODES.length} payment methods
            </span>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {PAYMENT_MODES.map(m => {
            const isActive = value === m;
            const ac = MODE_ACCENTS[m];
            return (
              <div key={m} onClick={() => { onChange(m); setOpen(false); }}
                style={{
                  padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`,
                  background: isActive ? `${ac}18` : "transparent",
                  display: "flex", alignItems: "center", gap: 12, transition: "background .1s",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = isDark ? T.surface2 : "#f8fafc"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0, fontSize: 16,
                  background: isActive ? `${ac}25` : isDark ? T.surface2 : "#f1f5f9",
                  border: `1.5px solid ${isActive ? ac + "55" : T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{MODE_ICONS[m]}</div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? ac : T.textPri }}>{m}</span>
                {isActive && (
                  <div style={{ width: 18, height: 18, borderRadius: 6, background: ac, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</div>
                )}
              </div>
            );
          })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* ── ModernDatePicker — portal calendar with presets ────────────── */
const DATE_PRESETS = [
  { label: "Today",      fn: () => new Date() },
  { label: "Yesterday",  fn: () => addDays(new Date(), -1) },
  { label: "Last Week",  fn: () => addDays(new Date(), -7) },
  { label: "Last Month", fn: () => addMonths(new Date(), -1) },
];

const ModernDatePicker = ({ value, onChange, T, isDark, error }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("calendar");
  const triggerRef = useRef(null);
  const portalRef  = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const sel = value ? new Date(value) : null;

  const updatePos = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom, left: r.left, width: r.width });
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

  const handlePick = (d) => { onChange(d.toISOString().split("T")[0]); setOpen(false); setMode("calendar"); };

  return (
    <div>
      <button type="button" ref={triggerRef} onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "10px 13px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        border: `1.5px solid ${error ? "#ef4444" : open ? T.blue : sel ? T.blue : T.border}`,
        borderRadius: 10, background: sel ? T.blueDim : isDark ? T.inputBg : T.surface2,
        cursor: "pointer", fontSize: 13, transition: "all .15s",
        boxShadow: open ? "0 0 0 3px rgba(59,130,246,.12)" : "none",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0, fontSize: 13,
            background: sel ? "rgba(59,130,246,.2)" : isDark ? T.surface2 : "#f1f5f9",
            border: `1.5px solid ${sel ? T.blue + "55" : T.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>📅</div>
          <span style={{ color: sel ? T.textPri : T.textSec, fontWeight: sel ? 600 : 400 }}>
            {sel ? format(sel, "EEE, MMM dd, yyyy") : "Select date…"}
          </span>
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? T.blue : T.textSec }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && ReactDOM.createPortal(
        <div ref={portalRef} style={{
          position: "fixed", zIndex: 20000, top: pos.top + 6, left: pos.left, width: Math.max(pos.width, 320),
          background: isDark ? T.surface : "#fff", borderRadius: 16, border: `1.5px solid ${T.border}`,
          boxShadow: "0 24px 60px rgba(0,0,0,.25)", overflow: "hidden",
          animation: "pmSelIn .15s ease both",
        }}>
          <style>{`
            .pm-dp-cal .react-datepicker{font-family:'DM Sans',sans-serif!important;border:none!important;border-radius:0!important;box-shadow:none!important;background:${isDark ? T.surface : "#fff"}!important;width:100%!important;}
            .pm-dp-cal .react-datepicker__header{background:${isDark ? T.surface2 : "#f8fafc"}!important;border-bottom:1.5px solid ${T.border}!important;border-radius:0!important;padding-top:12px!important;}
            .pm-dp-cal .react-datepicker__current-month{font-size:14px!important;font-weight:700!important;color:${T.textPri}!important;}
            .pm-dp-cal .react-datepicker__day-name{color:${T.textSec}!important;font-size:11px!important;font-weight:600!important;}
            .pm-dp-cal .react-datepicker__day{border-radius:8px!important;font-size:12px!important;color:${T.textPri}!important;transition:all .1s!important;}
            .pm-dp-cal .react-datepicker__day:hover{background:rgba(59,130,246,.15)!important;color:${T.blue}!important;}
            .pm-dp-cal .react-datepicker__day--selected{background:${T.blue}!important;color:#fff!important;font-weight:700!important;}
            .pm-dp-cal .react-datepicker__day--today{background:rgba(59,130,246,.12)!important;color:${T.blue}!important;font-weight:700!important;}
            .pm-dp-cal .react-datepicker__day--outside-month{opacity:.35!important;}
            .pm-dp-cal .react-datepicker__month-container{width:100%!important;}
            .pm-dp-cal .react-datepicker__navigation{top:14px!important;}
          `}</style>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1.5px solid ${T.border}`, background: isDark ? T.surface2 : "#f8fafc" }}>
            {[["calendar","📅","Calendar"],["presets","⚡","Quick"]].map(([v, icon, lbl]) => (
              <button key={v} onClick={() => setMode(v)} style={{
                flex: 1, padding: "11px 8px", fontSize: 12, fontWeight: 700,
                border: "none", cursor: "pointer", background: "transparent",
                color: mode === v ? T.blue : T.textSec,
                borderBottom: mode === v ? `2px solid ${T.blue}` : "2px solid transparent",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontFamily: "'DM Sans', sans-serif", transition: "all .15s",
              }}>
                <span>{icon}</span>{lbl}
              </button>
            ))}
          </div>

          <div style={{ padding: "14px 14px 10px" }} className="pm-dp-cal">
            {mode === "calendar" ? (
              <DatePicker selected={sel} onChange={handlePick} inline
                renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
                    <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} style={{
                      width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`,
                      background: isDark ? T.surface2 : "#f1f5f9", cursor: "pointer", color: T.textSec,
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all .12s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.blue; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSec; }}>
                      <FaChevronLeft style={{ fontSize: 10 }} />
                    </button>
                    <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 14, color: T.textPri }}>
                      {format(date, "MMMM yyyy")}
                    </span>
                    <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} style={{
                      width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`,
                      background: isDark ? T.surface2 : "#f1f5f9", cursor: "pointer", color: T.textSec,
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all .12s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.blue; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSec; }}>
                      <FaChevronRight style={{ fontSize: 10 }} />
                    </button>
                  </div>
                )}
              />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {DATE_PRESETS.map(p => {
                  const d = p.fn();
                  const active = sel && isSameDay(sel, d);
                  return (
                    <button key={p.label} onClick={() => handlePick(d)} style={{
                      padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                      border: `1.5px solid ${active ? T.blue : T.border}`,
                      background: active ? T.blueDim : isDark ? T.surface2 : "#f8fafc",
                      transition: "all .15s", fontFamily: "'DM Sans', sans-serif",
                    }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.background = T.blueDim; } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = isDark ? T.surface2 : "#f8fafc"; } }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? T.blue : T.textPri }}>{p.label}</div>
                      <div style={{ fontSize: 10, color: T.textSec, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                        {format(d, "MMM dd, yyyy")}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {sel && (
              <div style={{
                marginTop: 10, padding: "9px 12px", borderRadius: 10,
                background: T.blueDim, border: `1.5px solid ${T.blue}44`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: 9, color: T.blue, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Selected</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginTop: 1 }}>
                    {format(sel, "EEE, MMM dd, yyyy")}
                  </div>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: T.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

/* ── Record Payment Modal ─────────────────────────────────────────── */
export const RecordPaymentModal = ({ T, isDark, onClose, onSaved, prefill }) => {
  const [vendors,      setVendors]      = useState([]);
  const [bills,        setBills]        = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState({});
  const [creditAvail,  setCreditAvail]  = useState(0);   // vendor's creditAvailable wallet
  const [applyingCredit, setApplyingCredit] = useState(false);
  const [alloc,   setAlloc]   = useState({});   // billId -> amount string
  const [touched, setTouched] = useState(false); // user manually edited the split
  const [accounts, setAccounts] = useState([]);  // cash/bank accounts for "Paid Through"

  const [form, setForm] = useState({
    vendorId:    prefill?.vendorId    || "",
    vendorName:  prefill?.vendorName  || "",
    amount:      prefill?.amount      || "",
    date:        new Date().toISOString().split("T")[0],
    paymentMode: "Bank Transfer",
    paidThroughAccount: "",
    details:     {},
    notes:       "",
  });

  const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const balanceOf = (b) => Math.max(0, (b.totals?.grandTotal ?? 0) - (b.amountPaid ?? 0));

  // Load all vendors once
  useEffect(() => {
    axiosInstance.get("/api/vendors/?limit=200")
      .then(r => setVendors(r.data?.data?.vendors || []))
      .catch(() => {});
  }, []);

  // Load cash/bank accounts for the "Paid Through" picker; default to the first one.
  useEffect(() => {
    axiosInstance.get("/api/accounts/?limit=500&status=active")
      .then(r => {
        const banks = (r.data?.data?.accounts || []).filter(a => a.isBankAccount);
        setAccounts(banks);
        setForm(f => f.paidThroughAccount ? f : { ...f, paidThroughAccount: banks[0]?._id || "" });
      })
      .catch(() => {});
  }, []);

  // Load outstanding bills (FIFO: oldest first) when vendor selected
  useEffect(() => {
    if (!form.vendorId) { setBills([]); setAlloc({}); setTouched(false); return; }
    setBillsLoading(true);
    axiosInstance.get(`/api/bills/?vendorId=${form.vendorId}&limit=100`)
      .then(r => {
        const all = (r.data?.data?.bills || [])
          .filter(b => b.status !== "paid" && b.status !== "void" && b.status !== "draft" && balanceOf(b) > 0)
          .sort((a, b) => new Date(a.billDate || a.createdAt || 0) - new Date(b.billDate || b.createdAt || 0));
        setBills(all);
      })
      .catch(() => {})
      .finally(() => setBillsLoading(false));
  }, [form.vendorId]);

  // Capture the vendor's credit wallet when the vendor list / selection changes.
  useEffect(() => {
    if (!form.vendorId) { setCreditAvail(0); return; }
    const v = vendors.find(x => x._id === form.vendorId);
    if (v) setCreditAvail(v.creditAvailable || 0);
  }, [form.vendorId, vendors]);

  // FIFO auto-split: fill oldest bills first until the paid amount runs out.
  // When opened for a specific bill (prefill), that bill is filled first.
  const autoAllocate = useCallback((amt) => {
    let rem = amt; const next = {};
    const ordered = prefill?.billId
      ? [...bills].sort((a, b) => (a._id === prefill.billId ? -1 : b._id === prefill.billId ? 1 : 0))
      : bills;
    for (const b of ordered) {
      const bal = balanceOf(b);
      if (rem <= 0 || bal <= 0) continue;
      const a = Math.min(rem, bal);
      next[b._id] = a.toFixed(2);
      rem = r2(rem - a);
    }
    return next;
  }, [bills, prefill]);

  // Re-run auto-split when amount or bills change, unless the user edited a split.
  useEffect(() => {
    if (touched) return;
    const amt = parseFloat(form.amount) || 0;
    if (!amt || bills.length === 0) { setAlloc({}); return; }
    setAlloc(autoAllocate(amt));
  }, [form.amount, bills, touched, autoAllocate]);

  const selectVendor = (v) => {
    const name = v.displayName || v.companyName || "";
    setForm(f => ({ ...f, vendorId: v._id, vendorName: name, amount: "" }));
    setAlloc({}); setTouched(false);
    setCreditAvail(v.creditAvailable || 0);
    setErrors(e => { const n = { ...e }; delete n.vendorId; return n; });
  };

  const setAllocFor = (billId, val) => { setTouched(true); setAlloc(a => ({ ...a, [billId]: val })); };
  const resetAuto = () => setTouched(false); // re-run FIFO auto-split

  // Apply the vendor's existing credit wallet to their oldest open bill.
  const handleApplyCredit = async () => {
    const target = bills[0];
    if (!form.vendorId || !target) return;
    const applyAmt = Math.min(creditAvail, balanceOf(target));
    if (applyAmt <= 0) return;
    setApplyingCredit(true);
    try {
      const res = await axiosInstance.post(`/api/vendors/${form.vendorId}/apply-credit`, {
        billId: target._id, amount: applyAmt,
      });
      setCreditAvail(res.data?.remainingCredit ?? 0);
      onSaved(); onClose();
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || "Failed to apply credit" });
    } finally { setApplyingCredit(false); }
  };

  // Derived totals across the allocation grid.
  const enteredAmt     = parseFloat(form.amount) || 0;
  const totalAllocated = r2(Object.values(alloc).reduce((s, v) => s + (parseFloat(v) || 0), 0));
  const excess         = Math.max(0, r2(enteredAmt - totalAllocated));
  const overAllocated  = totalAllocated > enteredAmt + 0.001;

  const validate = () => {
    const e = {};
    if (!form.vendorId) e.vendorId = "Select a vendor";
    if (!enteredAmt || enteredAmt <= 0) e.amount = "Enter a valid amount";
    if (!form.date)   e.date = "Select a date";
    if (overAllocated) e.amount = "Allocated more than the amount paid";
    for (const b of bills) {
      const a = parseFloat(alloc[b._id]) || 0;
      if (a > balanceOf(b) + 0.001) { e.amount = `Allocation for ${b.billNumber} exceeds its balance`; break; }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const allocations = bills
        .map(b => ({ billId: b._id, billNumber: b.billNumber, amount: r2(parseFloat(alloc[b._id]) || 0) }))
        .filter(a => a.amount > 0);
      await axiosInstance.post("/api/vendor-payments/", {
        vendorId:    form.vendorId,
        vendorName:  form.vendorName,
        amount:      Number(enteredAmt),
        paymentMode:    form.paymentMode,
        paidThroughAccount: form.paidThroughAccount || undefined,
        reference:      getPrimaryRef(form.paymentMode, form.details),
        paymentDetails: form.details,
        date:        form.date,
        notes:       form.notes,
        allocations,
      });
      onSaved();
      onClose();
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || "Failed to record payment" });
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: "100%", padding: "10px 13px",
    background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 9,
    color: T.textPri, fontSize: 13, outline: "none",
    fontFamily: "'DM Sans', sans-serif", transition: "border-color .15s",
  };
  const lbl    = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.textSec, marginBottom: 6 };
  const errTxt = { fontSize: 11, color: "#ef4444", marginTop: 3 };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: isDark ? "rgba(5,9,20,0.65)" : "rgba(15,23,42,0.4)",
      backdropFilter: "blur(6px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <style>{`
        @keyframes pmtIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .pm-bill-card:hover{border-color:#3b82f6 !important;background:rgba(59,130,246,.05) !important;}
        .pm-bill-sel{border-color:#3b82f6 !important;background:rgba(59,130,246,.08) !important;}
      `}</style>

      <div onClick={e => e.stopPropagation()} style={{
        background: T.surface, borderRadius: 18, width: 560, maxHeight: "92vh",
        overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,.35)",
        border: `1.5px solid ${T.border}`, animation: "pmtIn .2s ease both",
      }}>

        {/* Header */}
        <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: T.textPri }}>Record Payment</div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 3 }}>Apply a payment to a vendor bill</div>
          </div>
          <button onClick={onClose} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✕</button>
        </div>

        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Vendor dropdown */}
          <div>
            <label style={lbl}>Vendor <span style={{ color: "#ef4444" }}>*</span></label>
            <VendorSelect
              value={form.vendorId}
              onChange={selectVendor}
              vendors={vendors}
              T={T}
              isDark={isDark}
              error={errors.vendorId}
            />
            {errors.vendorId && <div style={errTxt}>{errors.vendorId}</div>}
          </div>

          {/* Amount paid */}
          <div>
            <label style={lbl}>Amount Paid (AED) <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              style={{
                ...inp,
                fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 600,
                borderColor: errors.amount ? "#ef4444" : excess > 0 ? "#f59e0b" : T.border,
                boxShadow: excess > 0 ? "0 0 0 3px rgba(245,158,11,.15)" : "none",
              }}
              type="number" min="0" step="0.01" placeholder="0.00"
              value={form.amount}
              onChange={e => { setTouched(false); setForm(f => ({ ...f, amount: e.target.value })); }}
            />
            {errors.amount && <div style={errTxt}>{errors.amount}</div>}
          </div>

          {/* Bill allocation (FIFO auto-split, editable) */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Apply to Bills</label>
              {bills.length > 0 && (
                <button type="button" onClick={resetAuto}
                  style={{ background: "none", border: `1px solid ${T.border}`, color: T.blue, borderRadius: 7, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  ⟲ Auto-split (FIFO)
                </button>
              )}
            </div>

            {!form.vendorId ? (
              <div style={{ padding: "12px 14px", background: T.surface2, border: `1px dashed ${T.border}`, borderRadius: 9, color: T.textSec, fontSize: 12, textAlign: "center" }}>
                Select a vendor first to see their bills
              </div>
            ) : billsLoading ? (
              <div style={{ padding: "12px 14px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, color: T.textSec, fontSize: 12, textAlign: "center" }}>
                Loading bills…
              </div>
            ) : bills.length === 0 ? (
              <div style={{ padding: "12px 14px", background: T.surface2, border: `1px dashed ${T.border}`, borderRadius: 9, color: T.textSec, fontSize: 12, textAlign: "center" }}>
                No outstanding bills — the full amount records as vendor credit.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 230, overflowY: "auto" }}>
                {bills.map(b => {
                  const bal  = balanceOf(b);
                  const a    = parseFloat(alloc[b._id]) || 0;
                  const full = a > 0 && a >= bal - 0.001;
                  const part = a > 0 && a < bal - 0.001;
                  const dt   = new Date(b.billDate || b.createdAt || 0);
                  return (
                    <div key={b._id} style={{
                      display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center",
                      padding: "10px 12px", borderRadius: 9,
                      border: `1.5px solid ${a > 0 ? "#3b82f6" : T.border}`,
                      background: a > 0 ? "rgba(59,130,246,.06)" : T.surface2,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: T.textPri }}>{b.billNumber}</span>
                          {full && <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,.12)", padding: "1px 6px", borderRadius: 20 }}>FULL</span>}
                          {part && <span style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,.12)", padding: "1px 6px", borderRadius: 20 }}>PARTIAL</span>}
                        </div>
                        <div style={{ fontSize: 10, color: T.textSec, marginTop: 3 }}>
                          {isNaN(dt) ? "" : dt.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })} · Balance AED {bal.toFixed(2)}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: T.textSec }}>AED</span>
                        <input type="number" min="0" step="0.01" value={alloc[b._id] ?? ""}
                          onChange={e => setAllocFor(b._id, e.target.value)}
                          style={{ ...inp, width: 110, padding: "7px 9px", fontFamily: "'DM Mono', monospace", fontSize: 12, textAlign: "right" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Allocation totals */}
            {enteredAmt > 0 && (
              <div style={{ marginTop: 10, padding: "12px 14px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                {[
                  { label: "Amount Paid",        val: enteredAmt,     color: T.textPri },
                  { label: "Allocated to Bills", val: totalAllocated, color: "#3b82f6" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color }}>AED {val.toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{excess > 0 ? "Excess → Credit" : "Unallocated"}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: excess > 0 ? "#f59e0b" : (overAllocated ? "#ef4444" : "#10b981") }}>
                    AED {(enteredAmt - totalAllocated).toFixed(2)}
                  </span>
                </div>
                {overAllocated && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 7, fontSize: 11, color: "#ef4444", textAlign: "center", fontWeight: 600 }}>
                    ⚠ Allocated more than paid — reduce a split
                  </div>
                )}
                {excess > 0 && !overAllocated && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 7, fontSize: 11, color: "#f59e0b", textAlign: "center", fontWeight: 600 }}>
                    ⚠ AED {excess.toFixed(2)} exceeds all bills — recorded as vendor credit (advance)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Credit available wallet banner */}
          {creditAvail > 0 && (
            <div style={{
              padding: "13px 16px", borderRadius: 10,
              background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.3)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>
                  Credit Available
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>
                  AED {creditAvail.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
                  {bills[0] ? `Apply AED ${Math.min(creditAvail, balanceOf(bills[0])).toFixed(2)} to ${bills[0].billNumber}` : "No open bill to apply to"}
                </div>
              </div>
              {bills[0] && (
                <button
                  onClick={handleApplyCredit}
                  disabled={applyingCredit}
                  style={{
                    padding: "8px 16px", borderRadius: 8, border: "none", cursor: applyingCredit ? "not-allowed" : "pointer",
                    background: applyingCredit ? "rgba(16,185,129,0.4)" : "#10b981",
                    color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "inherit", flexShrink: 0,
                    opacity: applyingCredit ? 0.7 : 1,
                  }}>
                  {applyingCredit ? "Applying…" : "Apply Credit"}
                </button>
              )}
            </div>
          )}

          {/* Date + Mode */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={lbl}>Payment Date <span style={{ color: "#ef4444" }}>*</span></label>
              <ModernDatePicker
                value={form.date}
                onChange={d => setForm(f => ({ ...f, date: d }))}
                T={T}
                isDark={isDark}
                error={errors.date}
              />
              {errors.date && <div style={errTxt}>{errors.date}</div>}
            </div>
            <div>
              <label style={lbl}>Payment Mode <span style={{ color: "#ef4444" }}>*</span></label>
              <ModeSelect
                value={form.paymentMode}
                onChange={m => setForm(f => ({ ...f, paymentMode: m, details: {} }))}
                T={T}
                isDark={isDark}
              />
            </div>
          </div>

          {/* Paid Through — which cash/bank GL account the money left from */}
          <div>
            <label style={lbl}>Paid Through (Cash / Bank Account)</label>
            <select
              value={form.paidThroughAccount}
              onChange={e => setForm(f => ({ ...f, paidThroughAccount: e.target.value }))}
              style={{
                width: "100%", padding: "10px 13px", borderRadius: 9, fontSize: 13, cursor: "pointer",
                background: isDark ? T.inputBg : T.surface2, border: `1.5px solid ${T.border}`,
                color: T.textPri, fontFamily: "'DM Sans', sans-serif", outline: "none",
              }}>
              {accounts.length === 0 && <option value="">Cash on Hand (default)</option>}
              {accounts.map(a => (
                <option key={a._id} value={a._id}>[{a.accountCode}] {a.accountName}</option>
              ))}
            </select>
          </div>

          {/* Mode-specific fields */}
          {(MODE_FIELDS[form.paymentMode] || []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 16px", background: T.surface2, borderRadius: 10, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: T.textSec, margin: 0 }}>{form.paymentMode} Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {(MODE_FIELDS[form.paymentMode] || []).map(f => (
                  <div key={f.key} style={{ gridColumn: f.type === "select" ? "1" : "auto" }}>
                    <label style={{ ...lbl, marginBottom: 4 }}>{f.label}{f.required && <span style={{ color: "#ef4444" }}> *</span>}</label>
                    {f.type === "date" ? (
                      <ModernDatePicker
                        value={form.details[f.key] || ""}
                        onChange={val => setForm(prev => ({ ...prev, details: { ...prev.details, [f.key]: val } }))}
                        T={T}
                        isDark={isDark}
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
            <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} placeholder="Optional internal notes…"
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
              cursor: "pointer", background: T.surface2, color: T.textSec,
              border: `1.5px solid ${T.border}`, fontFamily: "'DM Sans', sans-serif",
            }}>Cancel</button>
            <button onClick={handleSubmit} disabled={loading} style={{
              flex: 2, padding: "11px 0", borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? .6 : 1,
              background: "#3b82f6", color: "#fff", border: "none",
              fontFamily: "'DM Sans', sans-serif", boxShadow: "0 4px 14px rgba(59,130,246,.3)",
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

/* ── Main Component ─────────────────────────────────────────────── */
export default function PaymentsMade() {
  const [searchParams] = useSearchParams();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [payments,   setPayments]   = useState([]);
  const [stats,      setStats]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [prefill,    setPrefill]    = useState(null);
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(1);
  const [detail,     setDetail]     = useState(null); // payment shown in the detail modal
  const [acctMap,    setAcctMap]    = useState({});   // accountId → "[code] name" for Paid From

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pmtRes, statsRes] = await Promise.allSettled([
        axiosInstance.get("/api/vendor-payments/"),
        axiosInstance.get("/api/vendor-payments/stats"),
      ]);
      if (pmtRes.status === "fulfilled")   setPayments(pmtRes.value.data?.data?.payments || []);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data?.data || {});
    } catch {
      nexusToast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(['vendor_payments_updated','bills_updated','vendor_credits_updated'], load);

  // Cash/bank accounts → resolve a payment's paidThroughAccount id to a readable label.
  useEffect(() => {
    axiosInstance.get("/api/accounts/?limit=500&status=active")
      .then(r => {
        const m = {};
        for (const a of (r.data?.data?.accounts || [])) m[a._id] = `[${a.accountCode}] ${a.accountName}`;
        setAcctMap(m);
      })
      .catch(() => {});
  }, []);

  // Pre-fill from URL params (from Bills "Record Payment" button)
  useEffect(() => {
    const billId = searchParams.get("billId");
    if (billId) {
      axiosInstance.get(`/api/bills/${billId}`).then(res => {
        const b = res.data?.data;
        if (b) {
          setPrefill({
            vendorId:   b.vendorId,
            vendorName: b.vendorName,
            billId:     b._id,
            billNumber: b.billNumber,
            amount:     String(b.balanceDue || ""),
          });
          setModalOpen(true);
        }
      }).catch(() => {});
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter(p =>
      (p.paymentNumber || "").toLowerCase().includes(q) ||
      (p.vendorName    || "").toLowerCase().includes(q) ||
      (p.billNumber    || "").toLowerCase().includes(q)
    );
  }, [payments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged      = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const statCards = [
    { label: "Total Paid",    value: fmtAED(stats.totalPaid), icon: <FaMoneyBillWave />, color: T.green,  dim: T.greenDim  },
    { label: "This Month",    value: fmtAED(stats.thisMonth), icon: <FaCheckCircle />,   color: T.blue,   dim: T.blueDim   },
    { label: "Transactions",  value: stats.count || 0,        icon: <FaMoneyBillWave />, color: T.amber,  dim: T.amberDim  },
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
  `;

  const openModal = () => { setPrefill(null); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setPrefill(null); };

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
          <button className="pm-btn" onClick={openModal}
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
              <p style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 800, color: T.textPri, margin: 0 }}>{c.value}</p>
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
              ) : paged.length > 0 ? paged.map((p, i) => {
                const allocs = p.allocations || [];
                const billLabel = p.billNumber
                  || (allocs.length === 1 ? allocs[0].billNumber
                    : allocs.length > 1 ? `${allocs.length} bills` : "");
                return (
                <tr key={p._id || i} className="pm-row" onClick={() => setDetail(p)} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
                  <td style={{ padding: "12px 16px" }}><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.blueLight }}>{p.paymentNumber}</span></td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{fmtDate(p.date)}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{p.vendorName || "—"}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.textSec }}>{billLabel || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: T.surface2, border: `1px solid ${T.border}`, color: T.textSec }}>{p.paymentMode}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{p.reference || "—"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#10b981" }}>{fmtAED(p.amount)}</td>
                </tr>
                );
              }) : (
                <tr><td colSpan="7" style={{ padding: "72px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textSec }}><FaMoneyBillWave /></div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>No payments yet</p>
                    <p style={{ color: T.textSec, fontSize: 13, margin: 0 }}>Record your first vendor payment</p>
                    <button className="pm-btn" onClick={openModal}
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

      {modalOpen && (
        <RecordPaymentModal
          T={T}
          isDark={isDark}
          prefill={prefill}
          onClose={closeModal}
          onSaved={() => { load(); nexusToast.success("Payment recorded successfully"); }}
        />
      )}

      {detail && (() => {
        const allocs = detail.allocations || [];
        const det = detail.paymentDetails || {};
        const meta = [
          ["Payment #", detail.paymentNumber || "—"],
          ["Date", fmtDate(detail.date || detail.createdAt)],
          ["Vendor", detail.vendorName || "—"],
          ["Amount", fmtAED(detail.amount)],
          ["Mode", detail.paymentMode || "—"],
          ["Reference", detail.reference || "—"],
          ["Paid From", acctMap[detail.paidThroughAccount] || detail.paidThroughAccount || "—"],
        ];
        const lab = { fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: ".05em" };
        return (
          <div onClick={e => e.target === e.currentTarget && setDetail(null)}
            style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)", padding: 20 }}>
            <div style={{ background: T.surface, borderRadius: 18, width: 540, maxHeight: "88vh", overflowY: "auto", border: `1.5px solid ${T.border}`, boxShadow: "0 40px 80px rgba(0,0,0,.4)" }}>
              <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 700, color: T.textPri }}>💸 {detail.paymentNumber || "Payment"}</div>
                  <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: T.surface2, border: `1px solid ${T.border}`, color: T.textSec }}>{detail.paymentMode || "Other"}</span>
                </div>
                <button onClick={() => setDetail(null)} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: T.textSec, fontSize: 14 }}>✕</button>
              </div>
              <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 }}>
                  {meta.map(([k, v]) => (
                    <div key={k}><div style={lab}>{k}</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, color: T.textPri, wordBreak: "break-word" }}>{v}</div></div>
                  ))}
                </div>

                {allocs.length > 0 && (
                  <div>
                    <div style={{ ...lab, marginBottom: 8 }}>Applied to Bills ({allocs.length})</div>
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead><tr style={{ background: T.surface2 }}>
                          <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase" }}>Bill</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase" }}>Amount</th>
                        </tr></thead>
                        <tbody>
                          {allocs.map((a, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                              <td style={{ padding: "8px 12px", fontFamily: "'DM Mono', monospace", color: T.textPri }}>{a.billNumber || a.billId || "—"}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.textPri }}>{fmtAED(a.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {Object.keys(det).length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                    {Object.entries(det).filter(([, v]) => v != null && v !== "").map(([k, v]) => (
                      <div key={k}><div style={lab}>{k}</div><div style={{ fontSize: 13, marginTop: 2, color: T.textPri, wordBreak: "break-word" }}>{String(v)}</div></div>
                    ))}
                  </div>
                )}

                {detail.notes && (
                  <div><div style={lab}>Notes</div><div style={{ fontSize: 13, marginTop: 3, color: T.textPri, whiteSpace: "pre-wrap" }}>{detail.notes}</div></div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
