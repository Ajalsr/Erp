import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { matchItem } from "../../helper/itemSearch";
import {
  FaPlus, FaTimes, FaSearch, FaChevronLeft, FaChevronRight,
  FaPhoneAlt, FaEnvelope, FaBuilding, FaCalendarAlt,
  FaUserTie, FaFilter, FaEdit, FaSave, FaCheck, FaClipboardList,
} from "react-icons/fa";
import DatePicker from "react-datepicker";
import { format, addDays, addMonths, addYears, isSameDay } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import CountrySelect from "../common/CountrySelect";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import useAuthStore from "../../store/useAuthStore";
import axiosInstance from "../../helper/axiosInstance";
import useRealtime from "../../helper/useRealtime";
import nexusToast from "../../helper/nexusToast";
import useGetCustomers from "../../helper/useGetCustomers";
import { usePermissions } from "../../helper/permissions";

const STATUSES = [
  { key: "all",       label: "All" },
  { key: "new",       label: "New",       color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { key: "contacted", label: "Contacted",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { key: "quoted",    label: "Quoted",     color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  { key: "converted", label: "Converted",  color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  { key: "lost",      label: "Lost",       color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  { key: "cancelled", label: "Cancelled",  color: "#64748b", bg: "rgba(100,116,139,0.12)" },
];

const SOURCES = ["Walk-in", "Phone", "Email", "Referral", "Website", "Social Media", "Exhibition", "Other"];
const PRIORITIES = ["low", "medium", "high"];

const STATUS_MAP = Object.fromEntries(STATUSES.filter(s => s.key !== "all").map(s => [s.key, s]));

const PRIORITY_CFG = {
  low:    { color: "#64748b", bg: "rgba(100,116,139,0.1)", label: "Low" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Medium" },
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   label: "High" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.new;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      color: s.color, background: s.bg, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const p = PRIORITY_CFG[priority] || PRIORITY_CFG.medium;
  return (
    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
      color: p.color, background: p.bg }}>
      {p.label}
    </span>
  );
};

const EMPTY_LINE = { itemId: "", itemName: "", qty: 1, unitPrice: 0, discount: 0, total: 0 };

// Net line total after a percentage discount.
const lineTot = (li) => {
  const base = (parseFloat(li.qty) || 0) * (parseFloat(li.unitPrice) || 0);
  const d = parseFloat(li.discount) || 0;
  return Math.max(0, base - base * d / 100);
};

const EMPTY_FORM = {
  customerId: "", customerName: "", email: "", phone: "",
  projectName: "", supplier: "", contactPerson: "", contactEmail: "", contactPhone: "",
  source: "Walk-in", subject: "", description: "",
  lineItems: [{ ...EMPTY_LINE }],
  priority: "medium", assignedTo: "",
  followUpDate: "", notes: "", date: new Date().toISOString().slice(0, 10),
};

function ItemSearch({ value, onSelect, onType, allItems, T }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef(null);
  const dropRef = useRef(null);

  const filtered = allItems.filter(i => matchItem(i, value)).slice(0, 20);

  const measure = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    const h = e => {
      if (!wrapRef.current?.contains(e.target) && !dropRef.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Re-anchor the portal to the input on scroll/resize (ignore scrolls inside the list).
  useEffect(() => {
    if (!open) return;
    const onScroll = e => { if (dropRef.current?.contains(e.target)) return; measure(); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", measure); };
  }, [open]);

  return (
    <div ref={wrapRef}>
      <input
        value={value}
        onChange={e => { onType(e.target.value); setOpen(true); }}
        onFocus={() => { measure(); setOpen(true); }}
        placeholder="Search item…"
        style={{ width: "100%", padding: "7px 10px", border: `1.5px solid ${T.border}`,
          borderRadius: 7, fontSize: 12, background: T.surface, color: T.textPri,
          outline: "none", fontFamily: "inherit", boxSizing: "border-box",
          borderColor: value ? T.blue : T.border }}
      />
      {open && filtered.length > 0 && createPortal(
        <div ref={dropRef} style={{
          position: "fixed", top: pos.top, left: pos.left, width: Math.max(pos.width, 220),
          zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`,
          borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.32)",
          maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.map((item, i) => (
            <div key={item._id || i}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(item); setOpen(false); }}
              style={{ padding: "9px 13px", cursor: "pointer", fontSize: 12,
                borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "background .1s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div>
                <div style={{ fontWeight: 600, color: T.textPri, fontSize: 12 }}>{item.name}</div>
                {item.item_code && <div style={{ fontSize: 10, color: T.textSec, marginTop: 1 }}>{item.item_code}</div>}
              </div>
              <span style={{ fontSize: 11, color: T.blue, fontFamily: "'DM Mono', monospace", flexShrink: 0, marginLeft: 10 }}>
                {parseFloat(item.selling_price || 0) > 0 ? `AED ${parseFloat(item.selling_price).toFixed(2)}` : "—"}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function EnqDatePicker({ value, onChange, placeholder = "Select date", T }) {
  const isDark = useThemeStore(s => s.isDark);
  const [open, setOpen]     = useState(false);
  const [mode, setMode]     = useState("calendar");
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 });
  const trigRef = useRef(null);
  const dropRef = useRef(null);
  const sel = value ? new Date(value) : null;

  const presets = [
    { label: "Today",      v: new Date() },
    { label: "Tomorrow",   v: addDays(new Date(), 1) },
    { label: "+1 Week",    v: addDays(new Date(), 7) },
    { label: "+1 Month",   v: addMonths(new Date(), 1) },
    { label: "+3 Months",  v: addMonths(new Date(), 3) },
    { label: "+6 Months",  v: addMonths(new Date(), 6) },
  ];

  const measure = () => {
    const r = trigRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    const h = e => {
      if (!trigRef.current?.contains(e.target) && !dropRef.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Keep the portal anchored to the trigger when the modal/page scrolls or resizes.
  // Ignore scrolls that originate inside the dropdown itself.
  useEffect(() => {
    if (!open) return;
    const onScroll = e => { if (dropRef.current?.contains(e.target)) return; measure(); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", measure); };
  }, [open]);

  const pick = (d) => {
    onChange(d.toISOString().split("T")[0]);
    setOpen(false);
    setMode("calendar");
  };

  const calCSS = `
    .enq-dp .react-datepicker{font-family:'DM Sans',sans-serif!important;border:none!important;background:transparent!important;box-shadow:none!important;}
    .enq-dp .react-datepicker__header{background:${isDark?"#111d30":"#f8fafc"}!important;border-bottom:1px solid ${T.border}!important;border-radius:0!important;padding-top:10px!important;}
    .enq-dp .react-datepicker__current-month{color:${T.textPri}!important;font-size:13px!important;font-weight:700!important;}
    .enq-dp .react-datepicker__day-name{color:${T.textSec}!important;font-weight:600!important;font-size:11px!important;}
    .enq-dp .react-datepicker__day{color:${T.textPri}!important;border-radius:7px!important;font-size:12px!important;transition:all .1s!important;}
    .enq-dp .react-datepicker__day:hover{background:${isDark?"rgba(59,130,246,0.2)":"#dbeafe"}!important;color:#3b82f6!important;}
    .enq-dp .react-datepicker__day--selected{background:#3b82f6!important;color:#fff!important;font-weight:700!important;}
    .enq-dp .react-datepicker__day--today{background:${isDark?"rgba(59,130,246,0.15)":"#eff6ff"}!important;color:#2563eb!important;font-weight:700!important;}
    .enq-dp .react-datepicker__day--outside-month{color:${T.textSec}!important;opacity:.45!important;}
    .enq-dp .react-datepicker__navigation-icon::before{border-color:${T.textSec}!important;}
  `;

  return (
    <>
      <style>{calCSS}</style>
      <button type="button" ref={trigRef}
        onClick={() => { measure(); setOpen(o => !o); }}
        style={{
          width: "100%", padding: "8px 12px", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8,
          border: `1.5px solid ${open ? T.blue : sel ? T.blue : T.border}`,
          borderRadius: 8, background: sel ? (isDark ? "rgba(59,130,246,0.08)" : "#eff6ff") : T.surface,
          cursor: "pointer", fontSize: 12, color: sel ? T.textPri : T.textSec,
          fontFamily: "inherit", transition: "all .15s",
          boxShadow: open ? `0 0 0 3px ${T.blue}22` : "none",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FaCalendarAlt style={{ fontSize: 11, color: sel ? T.blue : T.textSec, flexShrink: 0 }} />
          <span style={{ fontWeight: sel ? 600 : 400 }}>
            {sel ? format(sel, "MMM dd, yyyy") : placeholder}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {sel && (
            <span onMouseDown={e => { e.stopPropagation(); onChange(""); }}
              style={{ fontSize: 10, color: T.textSec, cursor: "pointer", lineHeight: 1,
                width: 16, height: 16, borderRadius: 4, background: T.surface2,
                display: "flex", alignItems: "center", justifyContent: "center" }}>✕</span>
          )}
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none"
            stroke={T.textSec} strokeWidth={2.5} strokeLinecap="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </button>

      {open && createPortal(
        <div ref={dropRef} className="enq-dp" style={{
          position: "fixed", top: pos.top, left: pos.left, width: Math.max(pos.width, 280),
          zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`,
          borderRadius: 12, boxShadow: "0 16px 48px rgba(0,0,0,.35)", overflow: "hidden",
        }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: isDark ? "#0d1526" : "#f8fafc" }}>
            {[["calendar","📅 Calendar"],["quick","⚡ Quick"]].map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)} style={{
                flex: 1, padding: "9px 8px", fontSize: 11, fontWeight: 700,
                border: "none", cursor: "pointer", background: "transparent",
                color: mode === v ? T.blue : T.textSec,
                borderBottom: mode === v ? `2px solid ${T.blue}` : "2px solid transparent",
                fontFamily: "inherit",
              }}>{l}</button>
            ))}
          </div>

          {mode === "calendar" ? (
            <div style={{ padding: "8px 6px 6px" }}>
              <DatePicker selected={sel} onChange={pick} inline
                renderCustomHeader={({ date, decreaseMonth, increaseMonth }) => (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 8px" }}>
                    <button onClick={decreaseMonth} style={{ width: 26, height: 26, borderRadius: 7,
                      border: `1px solid ${T.border}`, background: T.surface2, color: T.textSec,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FaChevronLeft style={{ fontSize: 9 }}/>
                    </button>
                    <span style={{ fontWeight: 700, fontSize: 13, color: T.textPri }}>
                      {format(date, "MMMM yyyy")}
                    </span>
                    <button onClick={increaseMonth} style={{ width: 26, height: 26, borderRadius: 7,
                      border: `1px solid ${T.border}`, background: T.surface2, color: T.textSec,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FaChevronRight style={{ fontSize: 9 }}/>
                    </button>
                  </div>
                )}
              />
            </div>
          ) : (
            <div style={{ padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {presets.map(p => {
                const active = sel && isSameDay(sel, p.v);
                return (
                  <button key={p.label} onClick={() => pick(p.v)} style={{
                    padding: "9px 10px", borderRadius: 8, textAlign: "left",
                    border: `1.5px solid ${active ? T.blue : T.border}`,
                    background: active ? (isDark ? "rgba(59,130,246,0.12)" : "#eff6ff") : T.surface2,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: active ? T.blue : T.textPri }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: T.textSec, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
                      {format(p.v, "MMM dd, yyyy")}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {sel && (
            <div style={{ margin: "0 10px 10px", padding: "8px 12px",
              background: isDark ? "rgba(16,185,129,0.08)" : "#f0fdf4",
              border: `1px solid ${isDark ? "rgba(16,185,129,0.25)" : "#bbf7d0"}`,
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.textPri }}>
                {format(sel, "EEE, MMM dd, yyyy")}
              </span>
              <FaCheck style={{ fontSize: 10, color: "#10b981" }}/>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function EnqSelect({ value, onChange, options, placeholder = "Select…", T }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0, width: 0 });
  const trigRef = useRef(null);
  const dropRef = useRef(null);

  const measure = () => {
    const r = trigRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    const h = e => {
      if (!trigRef.current?.contains(e.target) && !dropRef.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Keep the portal anchored to the trigger when the modal/page scrolls or resizes.
  // Ignore scrolls that originate inside the dropdown itself.
  useEffect(() => {
    if (!open) return;
    const onScroll = e => { if (dropRef.current?.contains(e.target)) return; measure(); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", measure); };
  }, [open]);

  const selected = options.find(o => (o.value ?? o) === value);
  const label = selected ? (selected.label ?? selected) : value;

  return (
    <>
      <button type="button" ref={trigRef}
        onClick={() => { measure(); setOpen(o => !o); }}
        style={{
          width: "100%", padding: "8px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          border: `1.5px solid ${open ? T.blue : T.border}`,
          borderRadius: 8, background: T.surface, cursor: "pointer",
          fontSize: 13, color: value ? T.textPri : T.textSec,
          fontFamily: "inherit", fontWeight: value ? 600 : 400,
          transition: "all .15s",
          boxShadow: open ? `0 0 0 3px ${T.blue}22` : "none",
        }}>
        <span>{label || placeholder}</span>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none"
          stroke={T.textSec} strokeWidth={2.5} strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && createPortal(
        <div ref={dropRef} style={{
          position: "fixed", top: pos.top, left: pos.left, width: Math.max(pos.width, 160),
          zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`,
          borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,.3)",
          overflow: "hidden", maxHeight: 240, overflowY: "auto",
        }}>
          {options.map((opt, i) => {
            const v = opt.value ?? opt;
            const l = opt.label ?? opt;
            const dot = opt.color;
            const isActive = v === value;
            return (
              <div key={v}
                onClick={() => { onChange(v); setOpen(false); }}
                style={{
                  padding: "9px 13px", cursor: "pointer", fontSize: 13,
                  display: "flex", alignItems: "center", gap: 8,
                  background: isActive ? (T.blue + "18") : "transparent",
                  borderBottom: i < options.length - 1 ? `1px solid ${T.border}` : "none",
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? T.blue : T.textPri,
                  transition: "background .1s",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.surface2; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }}/>}
                <span>{l}</span>
                {isActive && <svg style={{ marginLeft: "auto", flexShrink: 0 }} width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

function CustomerPicker({ value, valueLabel, onSelect, onClear, customers, T, border, inputStyle }) {
  const [open, setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 });
  const trigRef = useRef(null);
  const dropRef = useRef(null);

  const filtered = customers.filter(c => {
    const name = c.customerDisplayName || c.companyName || `${c.firstName || ""} ${c.lastName || ""}`.trim();
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      (c.customerEmail || "").toLowerCase().includes(search.toLowerCase())
    );
  }).slice(0, 40);

  const measure = () => {
    if (!trigRef.current) return;
    const r = trigRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4 + window.scrollY, left: r.left + window.scrollX, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    measure();
    const h = (e) => {
      if (!trigRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) {
        setOpen(false); setSearch("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={trigRef}>
      {value ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
          border: `1.5px solid ${T.blue}`, borderRadius: 9, background: T.surface,
          fontSize: 13, color: T.textPri }}>
          <span style={{ flex: 1, fontWeight: 600 }}>{valueLabel}</span>
          <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer",
            color: T.textSec, fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      ) : (
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search existing customers…"
          style={{ ...inputStyle }}
        />
      )}
      {open && !value && createPortal(
        <div ref={dropRef} style={{
          position: "absolute", top: pos.top, left: pos.left, width: pos.width,
          zIndex: 99999, background: T.surface, border: `1.5px solid ${border}`,
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: T.textSec, textAlign: "center" }}>
              No match — leave blank to enter name manually
            </div>
          ) : filtered.map(c => {
            const name = c.customerDisplayName || c.companyName || `${c.firstName || ""} ${c.lastName || ""}`.trim();
            return (
              <div key={c._id} onClick={() => { onSelect(c); setOpen(false); setSearch(""); }}
                style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13,
                  borderBottom: `1px solid ${border}`, color: T.textPri }}>
                <div style={{ fontWeight: 600 }}>{name}</div>
                {c.customerEmail && <div style={{ fontSize: 11, color: T.textSec }}>{c.customerEmail}</div>}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

const LIMIT = 15;

export default function Enquiries() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const navigate = useNavigate();
  const { can, canViewRecord } = usePermissions();
  // View-only roles browse the table but cannot open the detail drawer.
  // Detail needs more than view (add/edit/delete) + record scope. owner/admin always.
  const canOpenDetail = (enq) =>
    canViewRecord("enquiries", enq?.createdBy) &&
    (can("enquiries", "add") || can("enquiries", "edit") || can("enquiries", "delete"));

  const [enquiries,    setEnquiries]    = useState([]);
  const [stats,        setStats]        = useState({});
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [followUp,     setFollowUp]     = useState(""); // "" | today | overdue
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [totalCount,   setTotalCount]   = useState(0);

  // Drawer
  const [selected,     setSelected]     = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [drawerTab,    setDrawerTab]    = useState("overview");
  const [editing,      setEditing]      = useState(false);
  const [editForm,     setEditForm]     = useState({});
  const [saving,       setSaving]       = useState(false);

  // Create modal
  const [modalOpen,    setModalOpen]    = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [submitting,   setSubmitting]   = useState(false);

  // Status update in drawer
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Customers for picker
  const { handleGetCustomers, data: customerList } = useGetCustomers();
  useEffect(() => { handleGetCustomers(); }, [handleGetCustomers]);

  // Stock items for line item picker
  const [allItems, setAllItems] = useState([]);
  useEffect(() => {
    axiosInstance.get("/api/stocks/getitem")
      .then(r => setAllItems(r.data?.data || []))
      .catch(() => {});
  }, []);

  // Sales reps in this org — populate the "Assigned To" dropdown.
  const activeOrgId = useAuthStore((s) => s.activeOrg?._id || s.user?.orgId || "");
  const [salesReps, setSalesReps] = useState([]);
  useEffect(() => {
    let cancelled = false;
    // Resolve the org id: prefer the store, but if it's stale/empty (e.g. session
    // persisted before the org existed) fall back to the user's first org.
    const resolveOrgId = async () => {
      if (activeOrgId) return activeOrgId;
      try {
        const r = await axiosInstance.get(`/api/organizations`);
        return r.data?.data?.[0]?._id || "";
      } catch { return ""; }
    };
    (async () => {
      const orgId = await resolveOrgId();
      if (!orgId || cancelled) { setSalesReps([]); return; }
      try {
        const r = await axiosInstance.get(`/api/organizations/${orgId}/members`);
        // Assignable = any active member who isn't owner/admin (covers sales_rep and
        // any custom sales-type role the org defines).
        const reps = (r.data?.data || [])
          .filter(m => m.status === "active" && m.role !== "owner" && m.role !== "admin")
          .map(m => m.userId);
        if (!cancelled) setSalesReps(reps);
      } catch { if (!cancelled) setSalesReps([]); }
    })();
    return () => { cancelled = true; };
  }, [activeOrgId]);
  const assigneeOptions = salesReps.map(u => ({ value: u, label: u }));

  // When the open enquiry is already quoted, load its quote so we can link to it and
  // convert to a Sales Order from the (richer) quote data.
  const [linkedQuote, setLinkedQuote] = useState(null);
  useEffect(() => {
    setLinkedQuote(null);
    if (!selected?._id || selected.status !== "quoted") return;
    axiosInstance.get(`/api/quotes/?sourceEnquiryId=${selected._id}&limit=1`)
      .then(r => { const qs = r.data?.data?.quotes || []; if (qs.length) setLinkedQuote(qs[0]); })
      .catch(() => {});
  }, [selected?._id, selected?.status]);
  const linkedQuoteId = linkedQuote?._id || null;

  const loadEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (followUp) params.set("followUp", followUp);
      if (search.trim()) params.set("q", search.trim());
      const res = await axiosInstance.get(`/api/enquiries/?${params}`);
      const d = res.data?.data ?? {};
      setEnquiries(Array.isArray(d.enquiries) ? d.enquiries : []);
      setTotalPages(d.totalPages ?? 1);
      setTotalCount(d.total ?? 0);
    } catch { setEnquiries([]); } finally { setLoading(false); }
  }, [page, statusFilter, followUp, search]);

  const loadStats = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/api/enquiries/stats");
      setStats(res.data?.data ?? {});
    } catch { }
  }, []);

  useEffect(() => { loadEnquiries(); }, [loadEnquiries]);
  useRealtime(['enquiries_updated','quotes_updated'], () => { loadEnquiries(); loadStats(); });
  useEffect(() => { loadStats(); }, [loadStats]);

  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const openDrawer = (enq) => { if (!canOpenDetail(enq)) return; setSelected(enq); setDrawerOpen(true); setDrawerTab("overview"); setEditing(false); };
  const closeDrawer = () => { setDrawerOpen(false); setSelected(null); setEditing(false); };

  const handleCreateCustomer = async () => {
    if (!selected) return;
    setCreatingCustomer(true);
    try {
      const nameParts = (selected.customerName || "").trim().split(" ");
      const res = await axiosInstance.post("/api/customers/addcustomers", {
        customerDisplayName: selected.customerName,
        firstName:           nameParts[0] || "",
        lastName:            nameParts.slice(1).join(" ") || "",
        customerEmail:       selected.email || "",
        customerPhone:       selected.phone || "",
        customerType:        "business",
      });
      const newId = res.data?.data?._id || res.data?._id;
      nexusToast.success("Customer created successfully");
      // Link enquiry to new customer
      if (newId) {
        await axiosInstance.put(`/api/enquiries/${selected._id}`, { customerId: newId });
        const updated = { ...selected, customerId: newId };
        setSelected(updated);
        setEnquiries(prev => prev.map(e => e._id === selected._id ? updated : e));
      }
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to create customer");
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleCreate = async () => {
    if (!form.customerName.trim()) { nexusToast.error("Customer name is required"); return; }
    if (!form.subject.trim())      { nexusToast.error("Subject is required"); return; }
    if (form.contactPhone && !isValidPhoneNumber(form.contactPhone)) { nexusToast.error("Enter a valid contact phone number"); return; }
    setSubmitting(true);
    try {
      const lineItems = (form.lineItems || []).filter(li => li.itemName.trim());
      const estimatedValue = lineItems.reduce((s, li) =>
        s + lineTot(li), 0);
      await axiosInstance.post("/api/enquiries/", {
        ...form,
        lineItems,
        estimatedValue,
      });
      nexusToast.success("Enquiry created successfully");
      setModalOpen(false);
      setForm(EMPTY_FORM);
      loadEnquiries();
      loadStats();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to create enquiry");
    } finally { setSubmitting(false); }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selected) return;
    setUpdatingStatus(true);
    try {
      await axiosInstance.patch(`/api/enquiries/${selected._id}/status`, { status: newStatus });
      nexusToast.success("Status updated");
      const updated = { ...selected, status: newStatus };
      setSelected(updated);
      setEnquiries(prev => prev.map(e => e._id === selected._id ? updated : e));
      loadStats();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to update status");
    } finally { setUpdatingStatus(false); }
  };

  const handleSaveEdit = async () => {
    if (editForm.contactPhone && !isValidPhoneNumber(editForm.contactPhone)) { nexusToast.error("Enter a valid contact phone number"); return; }
    setSaving(true);
    try {
      const lineItems = (editForm.lineItems || []).filter(li => li.itemName?.trim());
      const estimatedValue = lineItems.reduce((s, li) =>
        s + lineTot(li), 0);
      await axiosInstance.put(`/api/enquiries/${selected._id}`, {
        ...editForm,
        lineItems,
        estimatedValue,
      });
      nexusToast.success("Enquiry updated");
      const updated = { ...selected, ...editForm, lineItems, estimatedValue };
      setSelected(updated);
      setEnquiries(prev => prev.map(e => e._id === selected._id ? updated : e));
      setEditing(false);
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to update");
    } finally { setSaving(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const fmtAED  = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`;

  const border = T.border;
  const thS = { padding: "10px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
    textTransform: "uppercase", color: T.textSec, background: T.surface2,
    borderBottom: `1.5px solid ${border}`, whiteSpace: "nowrap" };
  const tdS = { padding: "12px 14px", fontSize: 13, color: T.textPri, borderBottom: `1px solid ${border}`, verticalAlign: "middle" };

  // ── Stat cards ─────────────────────────────────────────────────────
  const statCards = [
    { label: "Total Enquiries", value: stats.total ?? 0,     color: T.blue,   icon: "📋" },
    { label: "New",             value: stats.new ?? 0,        color: T.blue,   icon: "🆕" },
    { label: "Quoted",          value: stats.quoted ?? 0,     color: T.purple, icon: "📄" },
    { label: "Converted",       value: stats.converted ?? 0,  color: T.green,  icon: "✅" },
    { label: "Total Value",     value: fmtAED(stats.totalValue), color: T.amber, icon: "💰", wide: true },
  ];

  const inputStyle = { width: "100%", padding: "9px 12px", border: `1.5px solid ${border}`,
    borderRadius: 9, fontSize: 13, background: T.inputBg, color: T.textPri,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  const labelStyle = { fontSize: 11, fontWeight: 600, color: T.textSec,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };

  return (
    <>
      <style>{`
        @keyframes enqSlideIn  { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes enqOverlay  { from{opacity:0} to{opacity:1} }
        @keyframes enqFadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes enqModalIn  { from{opacity:0;transform:translate(-50%,-50%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        .enq-row:hover { background:${isDark ? "rgba(255,255,255,.03)" : "#f8fafc"} !important; }
        .enq-tab { cursor:pointer; padding:8px 14px; border-radius:8px; font-size:12px; font-weight:600;
          border:none; background:transparent; font-family:inherit; transition:all .15s; }
        .enq-tab:hover { background:${T.surface2}; }
        .enq-btn { cursor:pointer; border:none; border-radius:8px; font-family:inherit;
          font-size:12px; font-weight:600; padding:8px 14px; transition:all .15s; }
        .enq-btn:hover { opacity:.85; }
        .enq-input:focus { border-color:${T.borderFoc} !important; }
        .enq-phone .PhoneInput { width:100%; border:1.5px solid ${border}; border-radius:9px;
          background:${T.inputBg}; padding:1px 10px; box-sizing:border-box; }
        .enq-phone .PhoneInput--focus { border-color:${T.borderFoc}; }
        .enq-phone .PhoneInputInput { border:none; outline:none; background:transparent;
          color:${T.textPri}; font-size:13px; font-family:inherit; padding:8px 4px; }
        .enq-phone .PhoneInputInput::placeholder { color:${T.textSec}; }
        .enq-phone .PhoneInputCountrySelect { color:${T.textPri}; }
        .enq-phone .PhoneInputCountryIcon { box-shadow:none; }
      `}</style>

      <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", padding: "24px 28px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: "-0.02em" }}>Enquiries</h1>
            <p style={{ fontSize: 13, color: T.textSec, margin: "4px 0 0" }}>Track and manage customer enquiries &amp; leads</p>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setModalOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px",
              background: T.blue, color: "#fff", border: "none", borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11}/> New Enquiry
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          {statCards.map((s) => (
            <div key={s.label} style={{ flex: s.wide ? "1 1 180px" : "1 1 130px", minWidth: 120,
              background: T.surface, border: `1px solid ${border}`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: s.wide ? 15 : 22, fontWeight: 800, color: s.color, fontFamily: "'DM Mono',monospace" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: T.textSec, marginTop: 2, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div style={{ background: T.surface, border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>

          {/* Toolbar */}
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <FaSearch size={11} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textSec }} />
              <input
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search enquiries…"
                style={{ ...inputStyle, paddingLeft: 32, width: "100%" }}
                className="enq-input"
              />
            </div>
            {/* Status filter */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {STATUSES.map((s) => (
                <button key={s.key} className="enq-tab"
                  onClick={() => { setStatusFilter(s.key); setPage(1); }}
                  style={{ color: statusFilter === s.key ? (s.color || T.blue) : T.textSec,
                    background: statusFilter === s.key ? (s.bg || T.blueDim) : "transparent" }}>
                  {s.label}
                </button>
              ))}
            </div>
            {/* Follow-up quick filters */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[{ k: "today", l: "Due today", c: "#f59e0b" }, { k: "overdue", l: "Overdue", c: "#ef4444" }].map(({ k, l, c }) => {
                const on = followUp === k;
                return (
                  <button key={k} className="enq-tab"
                    onClick={() => { setFollowUp(on ? "" : k); setPage(1); }}
                    style={{ color: on ? "#fff" : c, background: on ? c : `${c}1a`, border: `1px solid ${c}55`, fontWeight: 600 }}>
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: T.textSec }}>Loading enquiries…</div>
          ) : enquiries.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ color: T.textSec, fontSize: 14 }}>No enquiries found</p>
              <button onClick={() => { setForm(EMPTY_FORM); setModalOpen(true); }}
                className="enq-btn" style={{ marginTop: 12, background: T.blue, color: "#fff" }}>
                Add First Enquiry
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Enquiry #", "Customer", "Project", "Subject", "Source", "Priority", "Follow Up", "Status", "Value"].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((enq) => (
                    <tr key={enq._id} className={canOpenDetail(enq) ? "enq-row" : ""} onClick={() => canOpenDetail(enq) && openDrawer(enq)}
                      style={{ cursor: canOpenDetail(enq) ? "pointer" : "default", transition: "background .12s" }}>
                      <td style={tdS}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: T.blue }}>{enq.enquiryNumber}</span>
                      </td>
                      <td style={tdS}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{enq.customerName || "—"}</div>
                        {enq.email && <div style={{ fontSize: 11, color: T.textSec }}>{enq.email}</div>}
                      </td>
                      <td style={{ ...tdS, fontSize: 12, color: T.textSec }}>{enq.projectName || "—"}</td>
                      <td style={{ ...tdS, maxWidth: 200 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{enq.subject || "—"}</div>
                      </td>
                      <td style={{ ...tdS, fontSize: 12, color: T.textSec }}>{enq.source || "—"}</td>
                      <td style={tdS}><PriorityBadge priority={enq.priority}/></td>
                      <td style={{ ...tdS, fontSize: 12, color: enq.followUpDate && new Date(enq.followUpDate) < new Date() ? T.red : T.textSec }}>
                        {fmtDate(enq.followUpDate)}
                      </td>
                      <td style={tdS}><StatusBadge status={enq.status}/></td>
                      <td style={{ ...tdS, fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, textAlign: "right" }}>
                        {enq.estimatedValue ? fmtAED(enq.estimatedValue) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: `1px solid ${border}` }}>
              <span style={{ fontSize: 12, color: T.textSec }}>Page {page} of {totalPages} · {totalCount} total</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: T.surface2,
                    border: `1.5px solid ${border}`, borderRadius: 8, fontSize: 12, fontWeight: 600,
                    color: page <= 1 ? T.textSec : T.textPri, cursor: page <= 1 ? "not-allowed" : "pointer",
                    opacity: page <= 1 ? 0.5 : 1, fontFamily: "inherit" }}>
                  <FaChevronLeft size={9}/> Prev
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: T.surface2,
                    border: `1.5px solid ${border}`, borderRadius: 8, fontSize: 12, fontWeight: 600,
                    color: page >= totalPages ? T.textSec : T.textPri, cursor: page >= totalPages ? "not-allowed" : "pointer",
                    opacity: page >= totalPages ? 0.5 : 1, fontFamily: "inherit" }}>
                  Next <FaChevronRight size={9}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Side Drawer ────────────────────────────────────────────────── */}
      {drawerOpen && selected && (
        <>
          <div onClick={closeDrawer} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40, animation: "enqOverlay .2s ease" }}/>
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 420, maxWidth: "95vw",
            background: T.surface, borderLeft: `1px solid ${border}`, zIndex: 41,
            display: "flex", flexDirection: "column", animation: "enqSlideIn .25s ease" }}>

            {/* Drawer header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${border}`, flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.blue, fontWeight: 700 }}>{selected.enquiryNumber}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, marginTop: 2 }}>{selected.customerName}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                  <StatusBadge status={selected.status}/>
                  <PriorityBadge priority={selected.priority}/>
                </div>
              </div>
              <button onClick={closeDrawer} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 4 }}>
                <FaTimes size={16}/>
              </button>
            </div>

            {/* Drawer tabs */}
            <div style={{ display: "flex", gap: 2, padding: "8px 16px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              {["overview", "update"].map(tab => (
                <button key={tab} onClick={() => { setDrawerTab(tab); setEditing(false); }}
                  className="enq-tab"
                  style={{ color: drawerTab === tab ? T.blue : T.textSec,
                    background: drawerTab === tab ? T.blueDim : "transparent",
                    textTransform: "capitalize" }}>
                  {tab === "update" ? "Update Status" : "Overview"}
                </button>
              ))}
              {(() => {
                const isConverted = selected?.status === "converted";
                return (
                  <button
                    onClick={() => { if (isConverted) return; setDrawerTab("edit"); setEditForm({ ...selected, estimatedValue: selected.estimatedValue || "" }); setEditing(true); }}
                    className="enq-tab"
                    disabled={isConverted}
                    title={isConverted ? "Converted enquiries can't be edited" : "Edit"}
                    style={{ color: drawerTab === "edit" ? T.blue : T.textSec,
                      background: drawerTab === "edit" ? T.blueDim : "transparent", marginLeft: "auto",
                      cursor: isConverted ? "not-allowed" : "pointer", opacity: isConverted ? 0.45 : 1 }}>
                    <FaEdit size={11} style={{ marginRight: 5 }}/>Edit
                  </button>
                );
              })()}
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

              {/* ── Overview Tab ── */}
              {drawerTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "enqFadeUp .2s ease" }}>

                  {/* Contact info */}
                  <div style={{ background: T.surface2, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Contact Information</div>
                    {[
                      { icon: <FaUserTie size={11}/>,      label: "Customer",       val: selected.customerName },
                      { icon: <FaEnvelope size={11}/>,     label: "Cust. Email",    val: selected.email || "—" },
                      { icon: <FaPhoneAlt size={11}/>,     label: "Cust. Phone",    val: selected.phone || "—" },
                      { icon: <FaClipboardList size={11}/>, label: "Project",       val: selected.projectName || "—" },
                      { icon: <FaBuilding size={11}/>,     label: "Supplier",       val: selected.supplier || "—" },
                      { icon: <FaUserTie size={11}/>,      label: "Contact Person", val: selected.contactPerson || "—" },
                      { icon: <FaEnvelope size={11}/>,     label: "Contact Email",  val: selected.contactEmail || "—" },
                      { icon: <FaPhoneAlt size={11}/>,     label: "Contact Phone",  val: selected.contactPhone || "—" },
                    ].map(({ icon, label, val }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ color: T.textSec, width: 16, flexShrink: 0 }}>{icon}</span>
                        <span style={{ fontSize: 11, color: T.textSec, width: 92, flexShrink: 0 }}>{label}</span>
                        <span style={{ fontSize: 13, color: T.textPri, fontWeight: 500 }}>{val}</span>
                      </div>
                    ))}
                    {/* Add to Customers — shown when no customerId linked */}
                    {!selected.customerId && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${border}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, color: T.textSec }}>Not linked to a customer record</span>
                          <button
                            disabled={creatingCustomer}
                            onClick={handleCreateCustomer}
                            style={{ padding: "5px 12px", background: T.blue, color: "#fff", border: "none",
                              borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: creatingCustomer ? "not-allowed" : "pointer",
                              opacity: creatingCustomer ? 0.6 : 1, fontFamily: "inherit" }}>
                            {creatingCustomer ? "Creating…" : "+ Add to Customers"}
                          </button>
                        </div>
                      </div>
                    )}
                    {selected.customerId && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${border}` }}>
                        <span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>✓ Linked to customer record</span>
                      </div>
                    )}
                  </div>

                  {/* Enquiry details */}
                  <div style={{ background: T.surface2, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Enquiry Details</div>
                    {[
                      { label: "Subject",        val: selected.subject || "—" },
                      { label: "Source",         val: selected.source || "—" },
                      { label: "Assigned To",    val: selected.assignedTo || "—" },
                      { label: "Enquiry Date",   val: fmtDate(selected.date) },
                      { label: "Follow Up",      val: fmtDate(selected.followUpDate) },
                      { label: "Est. Value",     val: selected.estimatedValue ? fmtAED(selected.estimatedValue) : "—", mono: true },
                    ].map(({ label, val, mono }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${border}` }}>
                        <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                        <span style={{ fontSize: 12, color: T.textPri, fontWeight: 600, fontFamily: mono ? "'DM Mono',monospace" : "inherit" }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  {selected.description && (
                    <div style={{ background: T.surface2, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Description</div>
                      <p style={{ fontSize: 13, color: T.textPri, lineHeight: 1.6, margin: 0 }}>{selected.description}</p>
                    </div>
                  )}

                  {/* Notes */}
                  {selected.notes && (
                    <div style={{ background: T.surface2, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Notes</div>
                      <p style={{ fontSize: 13, color: T.textPri, lineHeight: 1.6, margin: 0 }}>{selected.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Update Status Tab ── */}
              {drawerTab === "update" && (
                <div style={{ animation: "enqFadeUp .2s ease" }}>
                  {["converted", "lost", "cancelled"].includes(selected.status) && (
                    <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: isDark ? "rgba(148,163,184,0.1)" : "#f1f5f9", border: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>🔒</span>
                      <span style={{ fontSize: 12.5, color: T.textPri }}>This enquiry is <strong style={{ textTransform: "capitalize" }}>{selected.status}</strong> — a final state. Status can no longer change.</span>
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: T.textSec, marginBottom: 16 }}>Change the enquiry status to track its progress through your pipeline.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {STATUSES.filter(s => s.key !== "all").map(s => (
                      <button key={s.key}
                        disabled={updatingStatus || selected.status === s.key || ["converted", "lost", "cancelled"].includes(selected.status) || (selected.status === "quoted" && ["new", "contacted"].includes(s.key))}
                        onClick={() => handleStatusUpdate(s.key)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                          border: `1.5px solid ${selected.status === s.key ? s.color : border}`,
                          borderRadius: 10, background: selected.status === s.key ? s.bg : T.surface2,
                          cursor: selected.status === s.key ? "default" : "pointer",
                          fontFamily: "inherit", transition: "all .15s" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }}/>
                        <span style={{ fontSize: 13, fontWeight: 600, color: selected.status === s.key ? s.color : T.textPri }}>
                          {s.label}
                        </span>
                        {selected.status === s.key && <span style={{ marginLeft: "auto", fontSize: 11, color: s.color }}>Current</span>}
                      </button>
                    ))}
                  </div>

                  {/* Pipeline actions */}
                  <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Enquiry → Quote */}
                    {selected.status !== "quoted" && selected.status !== "converted" && selected.status !== "lost" && selected.status !== "cancelled" && (
                      <div style={{ padding: 14, background: isDark ? "rgba(59,130,246,0.08)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59,130,246,0.25)" : "#bfdbfe"}`, borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#60a5fa" : "#1d4ed8", marginBottom: 5 }}>Create Quote from this Enquiry</div>
                        <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 10px" }}>Open a new Quote pre-filled with this enquiry's data. The enquiry is marked Quoted only once the quote is saved.</p>
                        <button
                          disabled={updatingStatus}
                          onClick={() => {
                            // Don't flip the enquiry to "quoted" here — if the user cancels the
                            // quote it would lose this button. CreateQuote sets it on save.
                            navigate("/Sales/Quotes/Create", { state: { fromEnquiry: {
                              _id:            selected._id,
                              enquiryNumber:  selected.enquiryNumber,
                              customerId:     selected.customerId || "",
                              customerName:   selected.customerName,
                              email:          selected.email,
                              projectName:    selected.projectName,
                              supplier:       selected.supplier,
                              contactPerson:  selected.contactPerson,
                              subject:        selected.subject,
                              description:    selected.description,
                              estimatedValue: selected.estimatedValue,
                              assignedTo:     selected.assignedTo,
                              lineItems:      selected.lineItems || [],
                            }}});
                          }}
                          style={{ padding: "8px 16px", background: isDark ? "#2563eb" : "#1d4ed8", color: "#fff", border: "none",
                            borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Create Quote →
                        </button>
                      </div>
                    )}

                    {/* Already quoted — link to the existing quote instead of creating a new one */}
                    {selected.status === "quoted" && (
                      <div style={{ padding: 14, background: isDark ? "rgba(139,92,246,0.08)" : "#f5f3ff", border: `1px solid ${isDark ? "rgba(139,92,246,0.25)" : "#ddd6fe"}`, borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#a78bfa" : "#6d28d9", marginBottom: 5 }}>Already Quoted</div>
                        <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 10px" }}>A quote already exists for this enquiry. Open it instead of creating a duplicate.</p>
                        <button
                          disabled={!linkedQuoteId}
                          onClick={() => linkedQuoteId && navigate(`/Sales/Quotes/${linkedQuoteId}/print`)}
                          style={{ padding: "8px 16px", background: isDark ? "#7c3aed" : "#6d28d9", color: "#fff", border: "none",
                            borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: linkedQuoteId ? "pointer" : "not-allowed", opacity: linkedQuoteId ? 1 : 0.6, fontFamily: "inherit" }}>
                          {linkedQuoteId ? "View Quote →" : "Loading quote…"}
                        </button>
                      </div>
                    )}

                    {/* Enquiry → Sales Order (direct, for already-quoted or when skipping quote) */}
                    {selected.status !== "converted" && selected.status !== "lost" && selected.status !== "cancelled" && (
                      <div style={{ padding: 14, background: T.greenDim, border: `1px solid ${T.green}22`, borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 5 }}>Convert to Sales Order</div>
                        <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 10px" }}>Skip quote and go directly to creating a Sales Order.</p>
                        <button
                          disabled={updatingStatus}
                          onClick={async () => {
                            await handleStatusUpdate("converted");
                            // If a quote already exists, convert from the quote (richer data:
                            // priced line items, payment terms, salesperson). Else from the enquiry.
                            if (linkedQuote) {
                              navigate("/Sales/Salesorders/Newsalesorders", { state: { fromQuote: {
                                quoteId:      linkedQuote._id,
                                quoteNumber:  linkedQuote.quoteNumber,
                                customerId:   linkedQuote.customerId,
                                customerName: linkedQuote.customerName,
                                paymentTerms: linkedQuote.paymentTerms,
                                currency:     linkedQuote.currency,
                                grandTotal:   linkedQuote.totals?.grandTotal,
                                notes:        linkedQuote.notes?.customer,
                                salesperson:  linkedQuote.salesperson || selected.assignedTo || "",
                                lineItems:    linkedQuote.lineItems || [],
                              }}});
                              return;
                            }
                            navigate("/Sales/Salesorders/Newsalesorders", { state: { fromEnquiry: {
                              enquiryId:     selected._id,
                              enquiryNumber: selected.enquiryNumber,
                              customerId:    selected.customerId || "",
                              customerName:  selected.customerName,
                              email:         selected.email,
                              phone:         selected.phone,
                              projectName:   selected.projectName,
                              supplier:      selected.supplier,
                              contactPerson: selected.contactPerson,
                              subject:       selected.subject,
                              salesperson:   selected.assignedTo || "",
                              lineItems:     selected.lineItems || [],
                              notes:         selected.notes || "",
                            }}});
                          }}
                          style={{ padding: "8px 14px", background: T.green, color: "#fff", border: "none",
                            borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Convert & Create Order →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Edit Tab ── */}
              {drawerTab === "edit" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "enqFadeUp .2s ease" }}>
                  <div>
                    <label style={labelStyle}>Link Existing Customer (optional)</label>
                    <CustomerPicker
                      value={editForm.customerId || ""}
                      valueLabel={editForm.customerName || ""}
                      customers={customerList || []}
                      T={T} border={border} inputStyle={inputStyle}
                      onSelect={c => {
                        const name = c.customerDisplayName || c.companyName || `${c.firstName || ""} ${c.lastName || ""}`.trim();
                        setEditForm(f => ({
                          ...f,
                          customerId:   c._id,
                          customerName: name,
                          email:        c.customerEmail || f.email,
                          phone:        c.phone || f.phone,
                        }));
                      }}
                      onClear={() => setEditForm(f => ({ ...f, customerId: "" }))}
                    />
                  </div>

                  {[
                    { key: "customerName",  label: "Customer Name *" },
                    { key: "email",         label: "Customer Email" },
                    { key: "phone",         label: "Customer Phone" },
                    { key: "projectName",   label: "Project Name" },
                    { key: "supplier",      label: "Supplier" },
                    { key: "contactPerson", label: "Contact Person" },
                    { key: "contactEmail",  label: "Contact Email" },
                    { key: "contactPhone",  label: "Contact Phone" },
                    { key: "subject",       label: "Subject *" },
                    { key: "assignedTo",    label: "Assigned To" },
                    { key: "followUpDate",  label: "Follow Up Date", type: "date" },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      {key === "contactPhone" ? (
                        <div className="enq-phone">
                          <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                            countrySelectComponent={CountrySelect}
                            value={editForm.contactPhone || ""} onChange={v => setEditForm(f => ({ ...f, contactPhone: v || "" }))} />
                        </div>
                      ) : key === "assignedTo" ? (
                        <EnqSelect T={T} value={editForm.assignedTo || ""} options={assigneeOptions}
                          onChange={v => setEditForm(f => ({ ...f, assignedTo: v }))}
                          placeholder={assigneeOptions.length ? "Select sales rep…" : "No sales reps yet"} />
                      ) : (
                        <input type={type || "text"} value={editForm[key] || ""} className="enq-input"
                          onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                          style={{ ...inputStyle }}/>
                      )}
                    </div>
                  ))}

                  {/* Line Items */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={labelStyle}>Items & Prices</label>
                      <button type="button"
                        onClick={() => setEditForm(f => ({ ...f, lineItems: [...(f.lineItems || []), { ...EMPTY_LINE }] }))}
                        style={{ fontSize: 11, fontWeight: 700, color: T.blue, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        + Add Item
                      </button>
                    </div>
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 72px 50px 72px 20px", gap: 0,
                        background: T.surface2, padding: "5px 8px", fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.06em", textTransform: "uppercase", color: T.textSec }}>
                        <span>Item</span><span style={{ textAlign: "right" }}>Qty</span>
                        <span style={{ textAlign: "right" }}>Price</span>
                        <span style={{ textAlign: "right" }}>Disc %</span>
                        <span style={{ textAlign: "right" }}>Total</span><span/>
                      </div>
                      {(editForm.lineItems || [{ ...EMPTY_LINE }]).map((li, idx) => {
                        const total = lineTot(li);
                        return (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 52px 72px 50px 72px 20px",
                            gap: 0, padding: "5px 8px", borderTop: `1px solid ${T.border}`, alignItems: "center" }}>
                            <ItemSearch
                              value={li.itemName || ""}
                              allItems={allItems}
                              T={T}
                              onType={v => setEditForm(f => {
                                const items = [...(f.lineItems || [])];
                                items[idx] = { ...items[idx], itemName: v, itemId: "" };
                                return { ...f, lineItems: items };
                              })}
                              onSelect={item => setEditForm(f => {
                                const items = [...(f.lineItems || [])];
                                const up = parseFloat(item.selling_price || 0);
                                items[idx] = { ...items[idx], itemId: item._id, itemName: item.name,
                                  unitPrice: up };
                              items[idx].total = lineTot(items[idx]);
                                return { ...f, lineItems: items };
                              })}
                            />
                            <input type="number" min="0" value={li.qty}
                              onChange={e => setEditForm(f => {
                                const items = [...(f.lineItems || [])];
                                const q = parseFloat(e.target.value) || 0;
                                items[idx] = { ...items[idx], qty: q }; items[idx].total = lineTot(items[idx]);
                                return { ...f, lineItems: items };
                              })}
                              style={{ width: "100%", padding: "5px 4px", border: `1px solid ${T.border}`,
                                borderRadius: 5, fontSize: 12, background: T.surface, color: T.textPri,
                                outline: "none", textAlign: "right", fontFamily: "'DM Mono', monospace" }}/>
                            <input type="number" min="0" value={li.unitPrice}
                              onChange={e => setEditForm(f => {
                                const items = [...(f.lineItems || [])];
                                const up = parseFloat(e.target.value) || 0;
                                items[idx] = { ...items[idx], unitPrice: up }; items[idx].total = lineTot(items[idx]);
                                return { ...f, lineItems: items };
                              })}
                              style={{ width: "100%", padding: "5px 4px", border: `1px solid ${T.border}`,
                                borderRadius: 5, fontSize: 12, background: T.surface, color: T.textPri,
                                outline: "none", textAlign: "right", fontFamily: "'DM Mono', monospace" }}/>
                            <input type="number" min="0" max="100" value={li.discount ?? 0}
                              onChange={e => setEditForm(f => {
                                const items = [...(f.lineItems || [])];
                                const d = parseFloat(e.target.value) || 0;
                                items[idx] = { ...items[idx], discount: d }; items[idx].total = lineTot(items[idx]);
                                return { ...f, lineItems: items };
                              })}
                              style={{ width: "100%", padding: "5px 4px", border: `1px solid ${T.border}`,
                                borderRadius: 5, fontSize: 12, background: T.surface, color: T.textPri,
                                outline: "none", textAlign: "right", fontFamily: "'DM Mono', monospace" }}/>
                            <span style={{ textAlign: "right", fontSize: 11, fontWeight: 600,
                              color: T.textPri, fontFamily: "'DM Mono', monospace" }}>
                              {total.toFixed(2)}
                            </span>
                            {(editForm.lineItems || []).length > 1 && (
                              <button type="button"
                                onClick={() => setEditForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }))}
                                style={{ background: "none", border: "none", cursor: "pointer",
                                  color: T.textSec, fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                            )}
                          </div>
                        );
                      })}
                      <div style={{ padding: "5px 8px", borderTop: `1px solid ${T.border}`,
                        display: "flex", justifyContent: "flex-end", gap: 4,
                        fontSize: 12, fontWeight: 700, color: T.textPri }}>
                        <span style={{ color: T.textSec }}>Total:</span>
                        <span style={{ fontFamily: "'DM Mono', monospace" }}>
                          AED {(editForm.lineItems || []).reduce((s, li) => s + (lineTot(li)), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Source</label>
                    <EnqSelect T={T} value={editForm.source || ""}
                      onChange={v => setEditForm(f => ({ ...f, source: v }))}
                      options={SOURCES.map(s => ({ value: s, label: s }))}
                      placeholder="Select source…" />
                  </div>

                  <div>
                    <label style={labelStyle}>Priority</label>
                    <EnqSelect T={T} value={editForm.priority || "medium"}
                      onChange={v => setEditForm(f => ({ ...f, priority: v }))}
                      options={[
                        { value: "low",    label: "Low",    color: "#64748b" },
                        { value: "medium", label: "Medium", color: "#f59e0b" },
                        { value: "high",   label: "High",   color: "#ef4444" },
                      ]}
                      placeholder="Select priority…" />
                  </div>

                  <div>
                    <label style={labelStyle}>Description</label>
                    <textarea value={editForm.description || ""} rows={3} className="enq-input"
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      style={{ ...inputStyle, resize: "vertical" }}/>
                  </div>

                  <div>
                    <label style={labelStyle}>Notes</label>
                    <textarea value={editForm.notes || ""} rows={3} className="enq-input"
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      style={{ ...inputStyle, resize: "vertical" }}/>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            {drawerTab === "edit" && (
              <div style={{ padding: "14px 20px", borderTop: `1px solid ${border}`, flexShrink: 0, display: "flex", gap: 8 }}>
                <button disabled={saving} onClick={handleSaveEdit}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: 10, background: T.blue, color: "#fff", border: "none",
                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1, fontFamily: "inherit" }}>
                  <FaSave size={11}/> {saving ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => { setDrawerTab("overview"); setEditing(false); }}
                  style={{ padding: "10px 16px", background: T.surface2, color: T.textSec,
                    border: `1.5px solid ${border}`, borderRadius: 10, fontSize: 13,
                    fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            )}
            {drawerTab !== "edit" && (
              <div style={{ padding: "14px 20px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
                <button onClick={closeDrawer}
                  style={{ width: "100%", padding: 10, background: T.surface2, color: T.textSec,
                    border: `1.5px solid ${border}`, borderRadius: 10, fontSize: 13,
                    fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Create Modal ───────────────────────────────────────────────── */}
      {modalOpen && (
        <>
          <div onClick={() => setModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, animation: "enqOverlay .2s ease" }}/>
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 560, maxWidth: "95vw", maxHeight: "90vh", background: T.surface,
            border: `1px solid ${border}`, borderRadius: 16, zIndex: 51,
            display: "flex", flexDirection: "column", animation: "enqModalIn .2s cubic-bezier(0.16,1,0.3,1)" }}>

            {/* Modal header */}
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>New Enquiry</div>
                <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>Add a new customer enquiry or lead</div>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec }}>
                <FaTimes size={16}/>
              </button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

                {/* Link existing customer (optional) */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Link Existing Customer (optional)</label>
                  <CustomerPicker
                    value={form.customerId}
                    valueLabel={form.customerName}
                    customers={customerList || []}
                    T={T} border={border} inputStyle={inputStyle}
                    onSelect={c => {
                      const name = c.customerDisplayName || c.companyName || `${c.firstName || ""} ${c.lastName || ""}`.trim();
                      setForm(f => ({
                        ...f,
                        customerId:   c._id,
                        customerName: name,
                        email:        c.customerEmail || f.email,
                        phone:        c.phone || f.phone,
                      }));
                    }}
                    onClear={() => setForm(f => ({ ...f, customerId: "", customerName: "", email: "", phone: "" }))}
                  />
                </div>

                {[
                  { key: "customerName",  label: "Customer Name *", full: true },
                  { key: "email",         label: "Customer Email" },
                  { key: "phone",         label: "Customer Phone" },
                  { key: "projectName",   label: "Project Name" },
                  { key: "supplier",      label: "Supplier" },
                  { key: "contactPerson", label: "Contact Person" },
                  { key: "contactEmail",  label: "Contact Email" },
                  { key: "contactPhone",  label: "Contact Phone" },
                  { key: "subject",       label: "Subject / Product Interest *", full: true },
                  { key: "assignedTo",    label: "Assigned To" },
                ].map(({ key, label, full }) => (
                  <div key={key} style={{ gridColumn: full ? "1 / -1" : undefined }}>
                    <label style={labelStyle}>{label}</label>
                    {key === "contactPhone" ? (
                      <div className="enq-phone">
                        <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                          countrySelectComponent={CountrySelect}
                          value={form.contactPhone || ""} onChange={v => setForm(f => ({ ...f, contactPhone: v || "" }))} />
                      </div>
                    ) : key === "assignedTo" ? (
                      <EnqSelect T={T} value={form.assignedTo || ""} options={assigneeOptions}
                        onChange={v => setForm(f => ({ ...f, assignedTo: v }))}
                        placeholder={assigneeOptions.length ? "Select sales rep…" : "No sales reps yet"} />
                    ) : (
                      <input type="text" value={form[key] || ""} className="enq-input"
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ ...inputStyle }}/>
                    )}
                  </div>
                ))}

                <div>
                  <label style={labelStyle}>Enquiry Date</label>
                  <EnqDatePicker value={form.date} T={T} placeholder="Select date"
                    onChange={v => setForm(f => ({ ...f, date: v }))} />
                </div>
                <div>
                  <label style={labelStyle}>Follow Up Date</label>
                  <EnqDatePicker value={form.followUpDate} T={T} placeholder="Select date"
                    onChange={v => setForm(f => ({ ...f, followUpDate: v }))} />
                </div>

                {/* Line Items */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={labelStyle}>Items & Prices</label>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_LINE }] }))}
                      style={{ fontSize: 11, fontWeight: 700, color: T.blue, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      + Add Item
                    </button>
                  </div>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 82px 54px 78px 24px", gap: 0,
                      background: T.surface2, padding: "5px 10px", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.06em", textTransform: "uppercase", color: T.textSec }}>
                      <span>Item</span><span style={{ textAlign: "right" }}>Qty</span>
                      <span style={{ textAlign: "right" }}>Price/Unit</span>
                      <span style={{ textAlign: "right" }}>Disc %</span>
                      <span style={{ textAlign: "right" }}>Total</span><span/>
                    </div>
                    {form.lineItems.map((li, idx) => {
                      const total = lineTot(li);
                      return (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 56px 82px 54px 78px 24px",
                          gap: 0, padding: "6px 10px", borderTop: `1px solid ${T.border}`, alignItems: "center" }}>
                          <ItemSearch
                            value={li.itemName}
                            allItems={allItems}
                            T={T}
                            onType={v => setForm(f => {
                              const items = [...f.lineItems];
                              items[idx] = { ...items[idx], itemName: v, itemId: "" };
                              return { ...f, lineItems: items };
                            })}
                            onSelect={item => setForm(f => {
                              const items = [...f.lineItems];
                              const up = parseFloat(item.selling_price || 0);
                              items[idx] = { ...items[idx], itemId: item._id, itemName: item.name,
                                unitPrice: up };
                              items[idx].total = lineTot(items[idx]);
                              return { ...f, lineItems: items };
                            })}
                          />
                          <input type="number" min="0" value={li.qty}
                            onChange={e => setForm(f => {
                              const items = [...f.lineItems];
                              const q = parseFloat(e.target.value) || 0;
                              items[idx] = { ...items[idx], qty: q }; items[idx].total = lineTot(items[idx]);
                              return { ...f, lineItems: items };
                            })}
                            style={{ width: "100%", padding: "6px 6px", border: `1px solid ${T.border}`,
                              borderRadius: 6, fontSize: 12, background: T.surface, color: T.textPri,
                              outline: "none", textAlign: "right", fontFamily: "'DM Mono', monospace" }}/>
                          <input type="number" min="0" value={li.unitPrice}
                            onChange={e => setForm(f => {
                              const items = [...f.lineItems];
                              const up = parseFloat(e.target.value) || 0;
                              items[idx] = { ...items[idx], unitPrice: up }; items[idx].total = lineTot(items[idx]);
                              return { ...f, lineItems: items };
                            })}
                            style={{ width: "100%", padding: "6px 6px", border: `1px solid ${T.border}`,
                              borderRadius: 6, fontSize: 12, background: T.surface, color: T.textPri,
                              outline: "none", textAlign: "right", fontFamily: "'DM Mono', monospace" }}/>
                          <input type="number" min="0" max="100" value={li.discount ?? 0}
                            onChange={e => setForm(f => {
                              const items = [...f.lineItems];
                              const d = parseFloat(e.target.value) || 0;
                              items[idx] = { ...items[idx], discount: d }; items[idx].total = lineTot(items[idx]);
                              return { ...f, lineItems: items };
                            })}
                            style={{ width: "100%", padding: "6px 6px", border: `1px solid ${T.border}`,
                              borderRadius: 6, fontSize: 12, background: T.surface, color: T.textPri,
                              outline: "none", textAlign: "right", fontFamily: "'DM Mono', monospace" }}/>
                          <span style={{ textAlign: "right", fontSize: 12, fontWeight: 600,
                            color: T.textPri, fontFamily: "'DM Mono', monospace", padding: "0 2px" }}>
                            {total.toFixed(2)}
                          </span>
                          {form.lineItems.length > 1 && (
                            <button type="button"
                              onClick={() => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec,
                                fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ padding: "6px 10px", borderTop: `1px solid ${T.border}`,
                      display: "flex", justifyContent: "flex-end", gap: 4,
                      fontSize: 12, fontWeight: 700, color: T.textPri }}>
                      <span style={{ color: T.textSec }}>Total:</span>
                      <span style={{ fontFamily: "'DM Mono', monospace" }}>
                        AED {form.lineItems.reduce((s, li) => s + (lineTot(li)), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Source</label>
                  <EnqSelect T={T} value={form.source}
                    onChange={v => setForm(f => ({ ...f, source: v }))}
                    options={SOURCES.map(s => ({ value: s, label: s }))}
                    placeholder="Select source…" />
                </div>

                <div>
                  <label style={labelStyle}>Priority</label>
                  <EnqSelect T={T} value={form.priority}
                    onChange={v => setForm(f => ({ ...f, priority: v }))}
                    options={[
                      { value: "low",    label: "Low",    color: "#64748b" },
                      { value: "medium", label: "Medium", color: "#f59e0b" },
                      { value: "high",   label: "High",   color: "#ef4444" },
                    ]}
                    placeholder="Select priority…" />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Description</label>
                  <textarea value={form.description} rows={3} className="enq-input"
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe what the customer is interested in…"
                    style={{ ...inputStyle, resize: "vertical" }}/>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Internal Notes</label>
                  <textarea value={form.notes} rows={2} className="enq-input"
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Internal notes for your team…"
                    style={{ ...inputStyle, resize: "vertical" }}/>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: "14px 22px", borderTop: `1px solid ${border}`, flexShrink: 0, display: "flex", gap: 8 }}>
              <button disabled={submitting} onClick={handleCreate}
                style={{ flex: 1, padding: "11px 0", background: T.blue, color: "#fff", border: "none",
                  borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, fontFamily: "inherit" }}>
                {submitting ? "Creating…" : "Create Enquiry"}
              </button>
              <button onClick={() => setModalOpen(false)}
                style={{ padding: "11px 18px", background: T.surface2, color: T.textSec,
                  border: `1.5px solid ${border}`, borderRadius: 10, fontSize: 13,
                  fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
