import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import DatePicker from "react-datepicker";
import { format, addDays, addMonths, isSameDay } from "date-fns";
import useThemeStore from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import "react-datepicker/dist/react-datepicker.css";

const buildTheme = (isDark) => ({
  bg:       isDark ? "#0a0e1a"  : "#f1f5f9",
  surface:  isDark ? "#111827"  : "#ffffff",
  surface2: isDark ? "#1a2234"  : "#f8fafc",
  border:   isDark ? "#1e2d47"  : "#e2e8f0",
  accent:   "#f59e0b",
  accent2:  "#10b981",
  red:      "#ef4444",
  blue:     "#3b82f6",
  text:     isDark ? "#f1f5f9"  : "#0f172a",
  muted:    "#64748b",
  subtle:   isDark ? "#334155"  : "#94a3b8",
  input:    isDark ? "#0f172a"  : "#ffffff",
  inputBdr: isDark ? "#1e2d47"  : "#e2e8f0",
  overlay:  isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)",
});

const fmt = (n) =>
  `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};

const MODES = ["Cash", "Bank Transfer", "Cheque", "Card", "Other"];

const MODE_COLORS = {
  "Cash":          { bg: "rgba(16,185,129,.12)",  border: "rgba(16,185,129,.3)",  text: "#10b981" },
  "Bank Transfer": { bg: "rgba(59,130,246,.12)",   border: "rgba(59,130,246,.3)",  text: "#3b82f6" },
  "Cheque":        { bg: "rgba(245,158,11,.12)",   border: "rgba(245,158,11,.3)",  text: "#f59e0b" },
  "Card":          { bg: "rgba(139,92,246,.12)",   border: "rgba(139,92,246,.3)",  text: "#8b5cf6" },
  "Other":         { bg: "rgba(100,116,139,.12)",  border: "rgba(100,116,139,.3)", text: "#94a3b8" },
};

const ModeBadge = ({ mode }) => {
  const s = MODE_COLORS[mode] || MODE_COLORS["Other"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.text }} />
      {mode}
    </span>
  );
};

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

/* ── PaymentDatePicker — matches ModernDatePicker in other modules ─ */
const PRESETS = [
  { label: "Today",     fn: () => new Date() },
  { label: "Yesterday", fn: () => addDays(new Date(), -1) },
  { label: "Last Week", fn: () => addDays(new Date(), -7) },
  { label: "Last Month",fn: () => addMonths(new Date(), -1) },
];

const PaymentDatePicker = ({ value, onChange, T }) => {
  const [open,    setOpen]   = useState(false);
  const [mode,    setMode]   = useState("calendar");
  const triggerRef = useRef(null);
  const portalRef  = useRef(null);
  const [pos,     setPos]    = useState({ top: 0, left: 0, width: 0, above: false });

  const sel = value ? new Date(value) : null;

  const PANEL_H = 360; // estimated panel height

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

  const handlePick = (d) => {
    onChange(d.toISOString().split("T")[0]);
    setOpen(false);
    setMode("calendar");
  };

  const panel = open ? ReactDOM.createPortal(
    <div ref={portalRef} style={{
      position: "fixed", zIndex: 20000,
      ...(pos.above
        ? { bottom: window.innerHeight - pos.top + 6 }
        : { top: pos.top + 6 }),
      left: pos.left,
      width: Math.max(pos.width, 320),
      background: T.surface, borderRadius: 16,
      border: `1.5px solid ${T.border}`,
      boxShadow: "0 24px 60px rgba(0,0,0,.3)",
      overflow: "hidden",
      animation: "pmtDpIn .15s ease both",
    }}>
      <style>{`
        @keyframes pmtDpIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .pmt-dp .react-datepicker{font-family:'DM Sans',sans-serif!important;border:none!important;border-radius:0!important;box-shadow:none!important;background:${T.surface}!important;width:100%!important;}
        .pmt-dp .react-datepicker__header{background:${T.surface2}!important;border-bottom:1.5px solid ${T.border}!important;border-radius:0!important;padding-top:12px!important;}
        .pmt-dp .react-datepicker__current-month{font-size:14px!important;font-weight:700!important;color:${T.text}!important;font-family:'Sora',sans-serif!important;}
        .pmt-dp .react-datepicker__day-name{color:${T.muted}!important;font-size:11px!important;font-weight:600!important;}
        .pmt-dp .react-datepicker__day{border-radius:8px!important;font-size:12px!important;color:${T.text}!important;transition:all .1s!important;}
        .pmt-dp .react-datepicker__day:hover{background:rgba(245,158,11,.15)!important;color:#f59e0b!important;}
        .pmt-dp .react-datepicker__day--selected{background:#f59e0b!important;color:#0a0e1a!important;font-weight:700!important;}
        .pmt-dp .react-datepicker__day--today{background:rgba(245,158,11,.12)!important;color:#f59e0b!important;font-weight:700!important;}
        .pmt-dp .react-datepicker__day--outside-month{color:${T.muted}!important;opacity:.4!important;}
        .pmt-dp .react-datepicker__month-container{width:100%!important;}
        .pmt-dp .react-datepicker__navigation{top:14px!important;}
      `}</style>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1.5px solid ${T.border}`, background: T.surface2 }}>
        {[["calendar","📅","Calendar"], ["presets","⚡","Quick"]].map(([v, icon, lbl]) => (
          <button key={v} onClick={() => setMode(v)} style={{
            flex: 1, padding: "11px 8px", fontSize: 12, fontWeight: 700,
            border: "none", cursor: "pointer", background: "transparent",
            color: mode === v ? T.accent : T.muted,
            borderBottom: mode === v ? `2px solid ${T.accent}` : "2px solid transparent",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "'DM Sans', sans-serif", transition: "all .15s",
          }}>
            <span>{icon}</span>{lbl}
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 14px 10px" }} className="pmt-dp">
        {mode === "calendar" ? (
          <DatePicker
            selected={sel}
            onChange={handlePick}
            inline
            renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
                <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} style={{
                  width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`,
                  background: T.surface2, cursor: "pointer", color: T.muted,
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all .12s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
                  ‹
                </button>
                <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 14, color: T.text }}>
                  {format(date, "MMMM yyyy")}
                </span>
                <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} style={{
                  width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`,
                  background: T.surface2, cursor: "pointer", color: T.muted,
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all .12s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
                  ›
                </button>
              </div>
            )}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {PRESETS.map(p => {
              const d = p.fn();
              const active = sel && isSameDay(sel, d);
              return (
                <button key={p.label} onClick={() => handlePick(d)} style={{
                  padding: "10px 12px", borderRadius: 10, textAlign: "left",
                  cursor: "pointer", border: `1.5px solid ${active ? T.accent : T.border}`,
                  background: active ? "rgba(245,158,11,.1)" : T.surface2,
                  transition: "all .15s", fontFamily: "'DM Sans', sans-serif",
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = "rgba(245,158,11,.06)"; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface2; } }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: active ? T.accent : T.text }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                    {format(d, "MMM dd, yyyy")}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {sel && (
          <div style={{
            marginTop: 10, padding: "9px 12px",
            background: "rgba(16,185,129,.1)", borderRadius: 10,
            border: "1.5px solid rgba(16,185,129,.3)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 9, color: "#10b981", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Selected</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 1, fontFamily: "'DM Sans', sans-serif" }}>
                {format(sel, "EEE, MMM dd, yyyy")}
              </div>
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
        boxShadow: open ? `0 0 0 3px rgba(245,158,11,.12)` : "none",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: sel ? "rgba(245,158,11,.18)" : T.surface2,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
          }}>📅</div>
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

/* ── ModeSelect — styled dropdown matching Sel pattern ─────────── */
const MODE_ICONS  = { "Cash": "💵", "Bank Transfer": "🏦", "Cheque": "📄", "Card": "💳", "Other": "🔄" };
const MODE_ACCENT = ["#2563eb","#9333ea","#16a34a","#ea580c","#94a3b8"];

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
      {/* Trigger */}
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
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: value ? "rgba(245,158,11,.18)" : T.surface2,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
          }}>{MODE_ICONS[value] || "💳"}</div>
          <span style={{ color: value ? T.text : T.muted, fontWeight: value ? 600 : 400 }}>
            {value || "Select payment mode…"}
          </span>
        </div>
        <svg style={{ flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", color: open ? T.accent : T.muted }}
          width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12,
          boxShadow: "0 20px 48px rgba(0,0,0,.22)", overflow: "hidden",
        }}>
          <div style={{ padding: "8px 13px", borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: T.muted }}>
              {MODES.length} methods
            </div>
          </div>
          {MODES.map((m, i) => {
            const active = value === m;
            const accent = MODE_ACCENT[i % MODE_ACCENT.length];
            return (
              <div key={m} onClick={() => { onChange(m); setOpen(false); }}
                style={{
                  padding: "11px 14px", cursor: "pointer",
                  borderBottom: `1px solid ${T.border}`,
                  background: active ? `${accent}18` : "transparent",
                  display: "flex", alignItems: "center", gap: 11,
                  transition: "background .1s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.surface2; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: active ? `${accent}25` : T.surface2,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                  border: `1.5px solid ${active ? accent : T.border}`,
                }}>{MODE_ICONS[m]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? accent : T.text }}>{m}</div>
                </div>
                {active && (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Add Payment Modal ─────────────────────────────────────────── */
const AddPaymentModal = ({ T, onClose, onSaved }) => {
  const [customers,    setCustomers]    = useState([]);
  const [invoices,     setInvoices]     = useState([]);
  const [invLoading,   setInvLoading]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [custOpen,     setCustOpen]     = useState(false);
  const [custSearch,   setCustSearch]   = useState("");
  const [selectedInv,  setSelectedInv]  = useState(null); // full invoice object

  const [form, setForm] = useState({
    customerId: "", customerName: "", invoiceId: "", invoiceNumber: "",
    amount: "", date: new Date().toISOString().split("T")[0],
    paymentMode: "Bank Transfer", reference: "", notes: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    axiosInstance.get("/api/customers/getcustomers")
      .then(r => setCustomers(r.data?.data?.customers || r.data?.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.customerId) { setInvoices([]); setSelectedInv(null); return; }
    setInvLoading(true);
    axiosInstance.get(`/api/invoices?customerId=${form.customerId}&limit=50`)
      .then(r => {
        const all = r.data?.data?.invoices || [];
        setInvoices(all.filter(i => i.status !== "paid" && i.status !== "void"));
      })
      .catch(() => {})
      .finally(() => setInvLoading(false));
  }, [form.customerId]);

  const filteredCustomers = useMemo(() => {
    const q = custSearch.toLowerCase();
    return customers.filter(c =>
      !q ||
      c.customerDisplayName?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [customers, custSearch]);

  const selectCustomer = (c) => {
    setForm(f => ({ ...f, customerId: c._id, customerName: c.customerDisplayName || c.companyName || "", invoiceId: "", invoiceNumber: "", amount: "" }));
    setCustSearch(c.customerDisplayName || c.companyName || "");
    setCustOpen(false);
    setSelectedInv(null);
  };

  const selectInvoice = (inv) => {
    const balance = Math.max(0, (inv.totals?.grandTotal ?? 0) - (inv.amountPaid ?? 0));
    setSelectedInv(inv);
    setForm(f => ({ ...f, invoiceId: inv._id, invoiceNumber: inv.invoiceNumber || "", amount: balance.toFixed(2) }));
  };

  // Live balance calculation — always derive from grandTotal - amountPaid
  // (never trust stored balanceDue: Go returns 0 for unset float64, ?? won't catch it)
  const enteredAmt  = parseFloat(form.amount) || 0;
  const invTotal    = selectedInv ? (selectedInv.totals?.grandTotal ?? 0) : 0;
  const alreadyPaid = selectedInv ? (selectedInv.amountPaid ?? 0) : 0;
  const balanceDue  = selectedInv ? Math.max(0, invTotal - alreadyPaid) : 0;
  const remaining   = selectedInv ? Math.max(0, balanceDue - enteredAmt) : 0;
  const overpay     = selectedInv && enteredAmt > balanceDue;

  const validate = () => {
    const e = {};
    if (!form.customerId) e.customerId = "Select a customer";
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = "Enter a valid amount";
    if (!form.date) e.date = "Select a date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await axiosInstance.post("/api/payments/", { ...form, amount: Number(form.amount) });
      onSaved(); onClose();
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || "Failed to record payment" });
    } finally { setLoading(false); }
  };

  const inp = {
    width: "100%", padding: "10px 13px",
    background: T.input, border: `1.5px solid ${T.inputBdr}`, borderRadius: 9,
    color: T.text, fontSize: 13, outline: "none",
    fontFamily: "'DM Sans', sans-serif", transition: "border-color .15s",
  };
  const lbl = {
    display: "block", fontSize: 11, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: ".06em", color: T.muted, marginBottom: 6,
  };
  const errTxt = { fontSize: 11, color: "#ef4444", marginTop: 3 };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: T.overlay, backdropFilter: "blur(6px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <div style={{
        background: T.surface, borderRadius: 18, width: 560, maxHeight: "92vh",
        overflowY: "auto", boxShadow: "0 40px 80px rgba(0,0,0,.35)",
        border: `1.5px solid ${T.border}`, animation: "pmtIn .2s ease both",
      }}>
        <style>{`
          @keyframes pmtIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
          .pmt-cust-opt:hover{background:${T.surface} !important;}
          .pmt-inv-card:hover{border-color:#f59e0b !important; background:rgba(245,158,11,.05) !important;}
          .pmt-inv-card.selected{border-color:#f59e0b !important; background:rgba(245,158,11,.08) !important;}
        `}</style>

        {/* ── Header ── */}
        <div style={{ padding: "22px 26px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 17, fontWeight: 700, color: T.text }}>Record Payment</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Apply a received payment to a customer or invoice</div>
          </div>
          <button onClick={onClose} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── Customer dropdown ── */}
          <div style={{ position: "relative" }}>
            <label style={lbl}>Customer <span style={{ color: "#ef4444" }}>*</span></label>
            <div
              onClick={() => setCustOpen(o => !o)}
              style={{
                ...inp, display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", userSelect: "none",
                borderColor: errors.customerId ? "#ef4444" : custOpen ? T.accent : T.inputBdr,
                boxShadow: custOpen ? "0 0 0 3px rgba(245,158,11,.12)" : "none",
              }}
            >
              {form.customerId ? (
                <span style={{ fontWeight: 600, color: T.text }}>{form.customerName}</span>
              ) : (
                <span style={{ color: T.muted }}>Select a customer…</span>
              )}
              <span style={{ color: T.muted, fontSize: 11, transition: "transform .15s", transform: custOpen ? "rotate(180deg)" : "none" }}>▼</span>
            </div>
            {errors.customerId && <div style={errTxt}>{errors.customerId}</div>}

            {custOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10,
                boxShadow: "0 16px 40px rgba(0,0,0,.2)", zIndex: 100, overflow: "hidden",
              }}>
                <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
                  <input
                    autoFocus
                    placeholder="Search name or code…"
                    value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    style={{ ...inp, padding: "8px 11px", fontSize: 12 }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {filteredCustomers.length === 0 ? (
                    <div style={{ padding: "14px 16px", color: T.muted, fontSize: 13, textAlign: "center" }}>No customers found</div>
                  ) : filteredCustomers.map(c => (
                    <div key={c._id} className="pmt-cust-opt"
                      onClick={() => selectCustomer(c)}
                      style={{
                        padding: "10px 14px", cursor: "pointer", fontSize: 13,
                        borderBottom: `1px solid ${T.border}`,
                        background: form.customerId === c._id ? "rgba(245,158,11,.08)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                      <div>
                        <span style={{ fontWeight: 600, color: T.text }}>{c.customerDisplayName || c.companyName}</span>
                        {c.companyName && c.customerDisplayName && (
                          <span style={{ color: T.muted, fontSize: 11, marginLeft: 7 }}>{c.companyName}</span>
                        )}
                      </div>
                      {c.customerCode && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.muted, background: T.surface2, padding: "2px 7px", borderRadius: 5 }}>
                          {c.customerCode}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Invoice selection ── */}
          <div>
            <label style={lbl}>
              Invoice
              <span style={{ textTransform: "none", fontWeight: 400, letterSpacing: 0, marginLeft: 6, color: T.subtle }}>
                (optional — select to auto-fill balance)
              </span>
            </label>
            {!form.customerId ? (
              <div style={{ padding: "12px 14px", background: T.surface2, border: `1px dashed ${T.border}`, borderRadius: 9, color: T.muted, fontSize: 12, textAlign: "center" }}>
                Select a customer first to see their invoices
              </div>
            ) : invLoading ? (
              <div style={{ padding: "12px 14px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, color: T.muted, fontSize: 12, textAlign: "center" }}>
                Loading invoices…
              </div>
            ) : invoices.length === 0 ? (
              <div style={{ padding: "12px 14px", background: T.surface2, border: `1px dashed ${T.border}`, borderRadius: 9, color: T.muted, fontSize: 12, textAlign: "center" }}>
                No outstanding invoices for this customer
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 200, overflowY: "auto" }}>
                {/* "No invoice" option */}
                <div
                  className={`pmt-inv-card${!form.invoiceId ? " selected" : ""}`}
                  onClick={() => { setSelectedInv(null); setForm(f => ({ ...f, invoiceId: "", invoiceNumber: "", amount: "" })); }}
                  style={{
                    padding: "10px 13px", borderRadius: 9, cursor: "pointer",
                    border: `1.5px solid ${!form.invoiceId ? T.accent : T.border}`,
                    background: !form.invoiceId ? "rgba(245,158,11,.06)" : T.surface2,
                    fontSize: 12, color: T.muted, transition: "all .12s",
                  }}>
                  — General payment (not linked to a specific invoice) —
                </div>
                {invoices.map(inv => {
                  const tot  = inv.totals?.grandTotal ?? 0;
                  const paid = inv.amountPaid ?? 0;
                  const bal  = Math.max(0, tot - paid);
                  const pct  = tot > 0 ? Math.min(100, (paid / tot) * 100) : 0;
                  const sel  = form.invoiceId === inv._id;
                  return (
                    <div key={inv._id}
                      className={`pmt-inv-card${sel ? " selected" : ""}`}
                      onClick={() => selectInvoice(inv)}
                      style={{
                        padding: "11px 13px", borderRadius: 9, cursor: "pointer",
                        border: `1.5px solid ${sel ? T.accent : T.border}`,
                        background: sel ? "rgba(245,158,11,.06)" : T.surface2,
                        transition: "all .12s",
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: sel ? T.accent : T.text }}>
                          {inv.invoiceNumber}
                        </span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: "#ef4444" }}>
                          AED {bal.toFixed(2)} due
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: T.accent2, borderRadius: 2, transition: "width .3s" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.muted }}>
                        <span>Total: AED {tot.toFixed(2)}</span>
                        <span style={{ color: T.accent2 }}>Paid: AED {paid.toFixed(2)}</span>
                        <span style={{ color: "#ef4444" }}>Due: AED {bal.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Amount breakdown card ── */}
          <div>
            <label style={lbl}>Amount Received (AED) <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              style={{
                ...inp, fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 600,
                borderColor: errors.amount ? "#ef4444" : overpay ? "#f59e0b" : T.inputBdr,
                boxShadow: overpay ? "0 0 0 3px rgba(245,158,11,.15)" : "none",
              }}
              type="number" min="0" step="0.01" placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
            {errors.amount && <div style={errTxt}>{errors.amount}</div>}

            {/* Live breakdown — only show when invoice is selected */}
            {selectedInv && enteredAmt > 0 && (
              <div style={{
                marginTop: 10, padding: "13px 15px",
                background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10,
              }}>
                {[
                  { label: "Invoice Total",     val: `AED ${invTotal.toFixed(2)}`,    color: T.text },
                  { label: "Already Paid",      val: `AED ${alreadyPaid.toFixed(2)}`, color: T.accent2 },
                  { label: "Balance Due",       val: `AED ${balanceDue.toFixed(2)}`,  color: "#ef4444" },
                  { label: "This Payment",      val: `AED ${enteredAmt.toFixed(2)}`,  color: T.accent },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color }}>{val}</span>
                  </div>
                ))}
                {/* Remaining after */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                    {overpay ? "Excess Payment" : "Remaining After"}
                  </span>
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700,
                    color: overpay ? "#f59e0b" : remaining === 0 ? T.accent2 : "#ef4444",
                  }}>
                    {overpay
                      ? `+AED ${(enteredAmt - balanceDue).toFixed(2)}`
                      : `AED ${remaining.toFixed(2)}`}
                  </span>
                </div>
                {remaining === 0 && !overpay && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 7, fontSize: 11, color: "#10b981", textAlign: "center", fontWeight: 600 }}>
                    ✓ This payment will fully settle the invoice
                  </div>
                )}
                {overpay && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 7, fontSize: 11, color: "#f59e0b", textAlign: "center", fontWeight: 600 }}>
                    ⚠ Amount exceeds balance due — excess will be recorded as credit
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Date + Mode row ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={lbl}>Payment Date <span style={{ color: "#ef4444" }}>*</span></label>
              <PaymentDatePicker
                T={T}
                value={form.date}
                onChange={d => setForm(f => ({ ...f, date: d }))}
              />
              {errors.date && <div style={errTxt}>{errors.date}</div>}
            </div>
            <div>
              <label style={lbl}>Payment Mode <span style={{ color: "#ef4444" }}>*</span></label>
              <ModeSelect
                T={T}
                value={form.paymentMode}
                onChange={m => setForm(f => ({ ...f, paymentMode: m }))}
              />
            </div>
          </div>

          {/* ── Reference ── */}
          <div>
            <label style={lbl}>Reference / Cheque No.</label>
            <input style={inp} placeholder="e.g. TXN-001234 or Cheque #456"
              value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
          </div>

          {/* ── Notes ── */}
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

          {/* ── Actions ── */}
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

/* ── Main Component ─────────────────────────────────────────────── */
const PaymentsReceived = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const T = buildTheme(isDark);

  const [payments,   setPayments]  = useState([]);
  const [stats,      setStats]     = useState({ totalReceived: 0, count: 0, thisMonth: 0 });
  const [loading,    setLoading]   = useState(true);
  const [search,     setSearch]    = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [showModal,  setShowModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      axiosInstance.get("/api/payments/"),
      axiosInstance.get("/api/payments/stats"),
    ]).then(([pRes, sRes]) => {
      setPayments(pRes.data?.data?.payments || []);
      setStats(sRes.data?.data || { totalReceived: 0, count: 0, thisMonth: 0 });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let data = [...payments];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(p =>
        p.paymentNumber?.toLowerCase().includes(q) ||
        p.customerName?.toLowerCase().includes(q) ||
        p.invoiceNumber?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q)
      );
    }
    if (modeFilter !== "all") {
      data = data.filter(p => p.paymentMode === modeFilter);
    }
    return data;
  }, [payments, search, modeFilter]);

  const inputStyle = {
    background: T.input, border: `1px solid ${T.border}`, color: T.text,
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "8px 12px",
    borderRadius: 7, outline: "none",
  };
  const thStyle = {
    fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase",
    color: T.muted, padding: "0 12px 10px", textAlign: "left",
    borderBottom: `1px solid ${T.border}`,
  };
  const tdStyle = {
    padding: "12px", fontSize: 13, color: T.text,
    borderBottom: `1px solid rgba(30,45,71,.5)`, verticalAlign: "middle",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        .pmt-row:hover td { background: rgba(245,158,11,.03) !important; }
        .pmt-row { cursor: default; }
        input:focus { border-color: rgba(245,158,11,.5) !important; box-shadow: 0 0 0 3px rgba(245,158,11,.08) !important; }
        select:focus { outline: none; }
        select option { background: ${T.surface}; color: ${T.text}; }
        .pmt-pill { transition: .15s; }
        .pmt-pill:hover { border-color: rgba(245,158,11,.4) !important; color: ${T.text} !important; }
      `}</style>

      <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: ".05em", color: T.accent }}>Nexus</span>
              <span style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>ERP</span>
            </div>
            <span style={{ color: T.border }}>|</span>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 600 }}>Payments Received</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700,
              cursor: "pointer", background: T.accent, color: "#0a0e1a", border: "none",
              fontFamily: "'DM Sans', sans-serif", transition: ".15s",
              boxShadow: "0 4px 12px rgba(245,158,11,.25)",
            }}
          >+ Record Payment</button>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "24px 28px 0" }}>
          <StatCard T={T} label="Total Received"  value={fmt(stats.totalReceived)} sub={`${stats.count} payments`}       accent={T.accent2} icon="💰" />
          <StatCard T={T} label="This Month"      value={fmt(stats.thisMonth)}     sub="Current month"                   accent={T.accent}  icon="📅" />
          <StatCard T={T} label="Invoices Paid"   value={payments.filter(p=>p.invoiceId).length.toString()} sub="Linked to invoices" accent={T.blue}    icon="✅" />
          <StatCard T={T} label="Payment Methods" value={[...new Set(payments.map(p=>p.paymentMode))].length.toString()} sub="Unique modes" accent={T.purple||"#8b5cf6"} icon="💳" />
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px 0", flexWrap: "wrap", gap: 12 }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "0 0 280px" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 14, pointerEvents: "none" }}>🔍</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search payment # or customer…"
              style={{ ...inputStyle, paddingLeft: 36, width: "100%", transition: ".15s" }}
            />
          </div>

          {/* Mode pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", ...MODES].map(m => {
              const active = modeFilter === m;
              return (
                <button key={m} className="pmt-pill" onClick={() => setModeFilter(m)} style={{
                  padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400,
                  cursor: "pointer", transition: ".15s", fontFamily: "'DM Sans', sans-serif",
                  background: active ? T.accent : "transparent",
                  color: active ? "#0a0e1a" : T.muted,
                  border: `1px solid ${active ? T.accent : T.border}`,
                }}>
                  {m === "all" ? `All (${payments.length})` : m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div style={{ margin: "20px 28px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: T.muted }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              Loading payments…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 64, textAlign: "center", color: T.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                No payments yet
              </div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Record your first payment to get started</div>
              <button onClick={() => setShowModal(true)} style={{
                padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: "pointer", background: T.accent, color: "#0a0e1a", border: "none",
                fontFamily: "'DM Sans', sans-serif",
              }}>+ Record Payment</button>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Payment #", "Date", "Customer", "Invoice", "Amount", "Mode", "Reference"].map((h, i) => (
                    <th key={h} style={{ ...thStyle, textAlign: i >= 4 ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p._id || i} className="pmt-row">
                    <td style={tdStyle}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.accent, fontWeight: 500 }}>
                        {p.paymentNumber}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: T.muted, fontSize: 12 }}>{fmtDate(p.date || p.createdAt)}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{p.customerName || "—"}</td>
                    <td style={{ ...tdStyle, color: T.muted, fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                      {p.invoiceNumber || <span style={{ color: T.subtle }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.accent2 }}>
                      {fmt(p.amount)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <ModeBadge mode={p.paymentMode || "Other"} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", color: T.muted, fontSize: 12 }}>
                      {p.reference || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={{ padding: "0 28px 24px", fontSize: 12, color: T.muted }}>
            Showing {filtered.length} of {payments.length} payments
            {filtered.length > 0 && (
              <span style={{ marginLeft: 16, fontFamily: "'DM Mono', monospace", color: T.accent2 }}>
                Total: {fmt(filtered.reduce((s, p) => s + (p.amount || 0), 0))}
              </span>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <AddPaymentModal
          T={T}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </>
  );
};

export default PaymentsReceived;
