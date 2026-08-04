import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { matchItem } from "../../helper/itemSearch";
import useGetCustomers from "../../helper/useGetCustomers";
import useAuthStore from "../../store/useAuthStore";
import axiosInstance from "../../helper/axiosInstance";
import { useUnsavedGuard } from "../../helper/useUnsavedGuard";
import useThemeStore from "../../store/useThemeStore";
import useIsMobile from "../../helper/useIsMobile";
import nexusToast from "../../helper/nexusToast";

/* ─── Theme ─────────────────────────────────────────────────────────────── */
const getT = (isDark) => isDark ? {
  bg: "#0a0e1a", surface: "#111827", surface2: "#1a2234", border: "#1e2d47",
  accent: "#f59e0b", accent2: "#10b981", red: "#ef4444",
  text: "#f1f5f9", muted: "#64748b", subtle: "#334155", input: "#0f172a",
  topbar: "#111827", shadow: "0 16px 48px rgba(0,0,0,0.55)",
} : {
  bg: "#f1f5f9", surface: "#ffffff", surface2: "#f8fafc", border: "#e2e8f0",
  accent: "#d97706", accent2: "#059669", red: "#dc2626",
  text: "#0f172a", muted: "#64748b", subtle: "#cbd5e1", input: "#ffffff",
  topbar: "#ffffff", shadow: "0 12px 32px rgba(0,0,0,0.1)",
};

const ThemeCtx  = createContext(getT(true));
const useT      = () => useContext(ThemeCtx);
const StockCtx  = createContext([]);
const useStock  = () => useContext(StockCtx);

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const today  = () => new Date().toISOString().split("T")[0];
const net30  = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; };
const p      = (v) => parseFloat(v) || 0;
let _uid = 0; const uid = () => ++_uid;

const calcLine = (item) => {
  const subtotal = p(item.qty) * p(item.unitPrice);
  const discAmt  = item.discountType === "percentage"
    ? subtotal * (p(item.discount) / 100) : p(item.discount);
  const taxAmt   = (subtotal - discAmt) * (p(item.taxRate) / 100);
  return { subtotal, discAmt, taxAmt, total: subtotal - discAmt + taxAmt };
};

const fmtMoney = (n) =>
  `AED ${Number(n).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCustAddr = (c) => {
  const l1 = c.streetAddress || "";
  const l2 = [c.city, c.country].filter(Boolean).join(", ");
  return [l1, l2].filter(Boolean).join("\n");
};

/* ─── Primitive components ──────────────────────────────────────────────── */
const useFF = () => {
  const T = useT();
  return {
    onFocus: (e) => { e.target.style.borderColor = `${T.accent}88`; e.target.style.boxShadow = `0 0 0 3px ${T.accent}14`; },
    onBlur:  (e) => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; },
  };
};
const Inp = ({ style, ...r }) => {
  const T = useT(); const f = useFF();
  return <input style={{ background: T.input, border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit", fontSize: 13, padding: "8px 12px", borderRadius: 7, outline: "none", width: "100%", transition: "border-color .15s", ...style }} {...f} {...r} />;
};
/* ─── Custom dropdown (themed, portal — never clipped) ───────────────────── */
const CustomSelect = ({ value, onChange, options, placeholder = "Select", style, disabled }) => {
  const T = useT();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const dropRef = useRef(null);
  const sel = options.find(o => o.value === value);
  const measure = () => { const r = btnRef.current?.getBoundingClientRect(); if (r) setCoords({ top: r.bottom + 4, left: r.left, width: r.width }); };
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!btnRef.current?.contains(e.target)) setOpen(false); };
    // Close on page scroll, but ignore scrolling inside the dropdown list itself.
    const reposition = (e) => { if (e?.target && dropRef.current?.contains(e.target)) return; setOpen(false); };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); };
  }, [open]);
  return (
    <>
      <button type="button" ref={btnRef} disabled={disabled}
        onClick={() => { if (disabled) return; measure(); setOpen(o => !o); }}
        style={{ background: T.input, border: `1px solid ${open ? `${T.accent}88` : T.border}`, color: sel ? T.text : T.muted, fontFamily: "inherit", fontSize: 13, padding: "8px 10px", borderRadius: 7, outline: "none", cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, width: "100%", textAlign: "left", ...style }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel ? sel.label : placeholder}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, opacity: .6, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && coords && createPortal(
        <div ref={dropRef} style={{ position: "fixed", top: coords.top, left: coords.left, width: Math.max(coords.width, 90), zIndex: 9999, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, boxShadow: T.shadow, padding: 4, maxHeight: 240, overflowY: "auto", animation: "qPop .12s ease" }}>
          {options.map(o => (
            <div key={o.value} onMouseDown={() => { onChange(o.value); setOpen(false); }}
              style={{ padding: "8px 10px", borderRadius: 6, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", color: o.value === value ? T.accent : T.text, background: o.value === value ? `${T.accent}14` : "transparent", fontWeight: o.value === value ? 600 : 400 }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = T.surface2; }}
              onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = "transparent"; }}>
              {o.label}
            </div>
          ))}
        </div>, document.body)}
    </>
  );
};

/* ─── Custom date picker (themed calendar popover) ───────────────────────── */
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const CustomDate = ({ value, onChange, style, placeholder = "Select date" }) => {
  const T = useT();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const parsed = value ? new Date(value + "T00:00:00") : null;
  const [view, setView] = useState(parsed || new Date());
  const measure = () => { const r = btnRef.current?.getBoundingClientRect(); if (r) setCoords({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 248) }); };
  useEffect(() => {
    if (!open) return;
    setView(parsed || new Date());
    const close = (e) => { if (!btnRef.current?.contains(e.target)) setOpen(false); };
    const reposition = () => setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); };
  }, [open]); // eslint-disable-line
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const isSel = (d) => parsed && parsed.getFullYear() === y && parsed.getMonth() === m && parsed.getDate() === d;
  const isToday = (d) => { const t = new Date(); return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d; };
  const navBtn = { width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.border}`, background: T.input, color: T.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 };
  return (
    <>
      <button type="button" ref={btnRef}
        onClick={() => { measure(); setOpen(o => !o); }}
        style={{ background: T.input, border: `1px solid ${open ? `${T.accent}88` : T.border}`, color: parsed ? T.text : T.muted, fontFamily: "inherit", fontSize: 13, padding: "9px 12px", borderRadius: 7, outline: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left", ...style }}>
        <span>{parsed ? `${String(parsed.getDate()).padStart(2, "0")} ${MONTHS_FULL[parsed.getMonth()].slice(0, 3)} ${parsed.getFullYear()}` : placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: .55 }}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      </button>
      {open && coords && createPortal(
        <div style={{ position: "fixed", top: coords.top, left: coords.left, width: 248, zIndex: 9999, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, boxShadow: T.shadow, padding: 12, animation: "qPop .12s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" style={navBtn} onClick={() => setView(new Date(y, m - 1, 1))}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{MONTHS_FULL[m]} {y}</span>
            <button type="button" style={navBtn} onClick={() => setView(new Date(y, m + 1, 1))}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
            {DOW.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: T.muted, padding: "2px 0" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((d, i) => d === null
              ? <div key={i} />
              : <button key={i} type="button"
                  onClick={() => { onChange(ymd(new Date(y, m, d))); setOpen(false); }}
                  style={{ aspectRatio: "1", borderRadius: 7, border: isToday(d) && !isSel(d) ? `1px solid ${T.accent}88` : "1px solid transparent", background: isSel(d) ? T.accent : "transparent", color: isSel(d) ? "#fff" : T.text, fontSize: 12, fontWeight: isSel(d) ? 700 : 500, cursor: "pointer" }}
                  onMouseEnter={e => { if (!isSel(d)) e.currentTarget.style.background = T.surface2; }}
                  onMouseLeave={e => { if (!isSel(d)) e.currentTarget.style.background = "transparent"; }}>
                  {d}
                </button>)}
          </div>
          <button type="button" onClick={() => { onChange(ymd(new Date())); setOpen(false); }}
            style={{ marginTop: 10, width: "100%", padding: "7px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.input, color: T.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Today
          </button>
        </div>, document.body)}
    </>
  );
};
const Tex = ({ style, ...r }) => {
  const T = useT(); const f = useFF();
  return <textarea style={{ background: T.input, border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit", fontSize: 13, padding: "8px 12px", borderRadius: 7, outline: "none", width: "100%", resize: "vertical", minHeight: 70, lineHeight: 1.5, ...style }} {...f} {...r} />;
};
const Field = ({ label, children }) => {
  const T = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", color: T.muted, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
};
const Section = ({ title, children }) => {
  const T = useT();
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.accent, fontFamily: "'Sora', sans-serif" }}>
        {title}<span style={{ flex: 1, height: 1, background: T.border }} />
      </div>
      {children}
    </div>
  );
};
const Btn = ({ v = "ghost", style, children, ...r }) => {
  const T = useT();
  const map = {
    ghost:   { background: "transparent", color: T.muted,   border: `1px solid ${T.border}` },
    outline: { background: "transparent", color: T.accent,  border: `1px solid ${T.accent}66` },
    primary: { background: T.accent,      color: "#0a0e1a", border: "none", fontWeight: 700 },
    success: { background: T.accent2,     color: "#0a0e1a", border: "none", fontWeight: 700 },
  };
  return <button style={{ padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: ".15s", ...map[v], ...style }} {...r}>{children}</button>;
};

/* ─── Customer Select ───────────────────────────────────────────────────── */
const CustomerSelect = ({ value, onChange, options, name, disabled }) => {
  const T = useT();
  const [open, setOpen]       = useState(false);
  const [ready, setReady]     = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const trigRef = useRef(null);
  const dropRef = useRef(null);
  const rafRef  = useRef(null);

  const selected = options.find(o => o.value === value);

  const measure = useCallback(() => {
    if (!trigRef.current) return;
    const r = trigRef.current.getBoundingClientRect();
    const dropH = Math.min(options.length * 44 + 16, 260);
    const top = (window.innerHeight - r.bottom) > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, [options.length]);

  const handleOpen = () => {
    if (disabled) return;
    if (open) { setOpen(false); setReady(false); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => rafRef.current = requestAnimationFrame(measure));
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [open, measure]);
  useEffect(() => {
    const h = e => {
      if (trigRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false); setReady(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const select = (opt) => {
    onChange({ target: { name, value: opt.value }, customer: opt.customer || null });
    setOpen(false); setReady(false);
  };

  return (
    <>
      <div ref={trigRef} onClick={handleOpen} style={{
        background: disabled ? T.surface : T.input, border: `1px solid ${T.border}`, borderRadius: 7,
        padding: "8px 12px", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13,
        color: selected ? T.text : T.muted, opacity: disabled ? 0.7 : 1,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>{selected?.label || "Select customer…"}</span>
        {!disabled && <span style={{ color: T.muted, fontSize: 10 }}>▾</span>}
      </div>
      {open && createPortal(
        <div ref={dropRef} style={{
          position: "absolute", top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12,
          boxShadow: T.shadow, overflow: "hidden",
          visibility: ready ? "visible" : "hidden", opacity: ready ? 1 : 0, transition: "opacity .12s",
        }}>
          <div style={{ maxHeight: 244, overflowY: "auto", padding: 6 }}>
            {options.map((opt, i) => {
              const act = opt.value === value;
              return (
                <div key={i} onClick={() => select(opt)} style={{
                  padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                  fontWeight: act ? 600 : 400, color: act ? T.accent : T.text,
                  background: act ? `${T.accent}1a` : "transparent",
                }}>
                  {opt.label}
                </div>
              );
            })}
            {options.length === 0 && <div style={{ padding: 16, color: T.muted, fontSize: 12, textAlign: "center" }}>No customers found</div>}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

/* ─── Item Combo (desc + stock picker) ─────────────────────────────────── */
const ItemCombo = ({ value, stockId, onChange }) => {
  const T      = useT();
  const stocks = useStock();
  const [q, setQ]           = useState(value || "");
  const [open, setOpen]     = useState(false);
  const [pos, setPos]       = useState({ top: 0, left: 0, width: 0 });
  const wrapRef  = useRef(null);
  const dropRef  = useRef(null);

  // Keep local q in sync when parent resets (e.g. clone)
  useEffect(() => { setQ(value || ""); }, [value]);

  const filtered = q.trim()
    ? stocks.filter(s => matchItem(s, q)).slice(0, 8)
    : stocks.slice(0, 8);

  const measure = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 2, left: r.left, width: r.width });
  };

  const handleFocus = () => { measure(); setOpen(true); };
  const handleChange = (e) => {
    setQ(e.target.value);
    onChange({ desc: e.target.value, unitPrice: null, stockId: null }); // free type clears stockId
    setOpen(true);
  };
  const pick = (s) => {
    const price = parseFloat(s.selling_price || s.price || 0);
    setQ(s.name || "");
    setOpen(false);
    onChange({ desc: s.name || "", unitPrice: price, stockId: s._id });
  };

  useEffect(() => {
    const h = e => {
      if (wrapRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={q}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder="Search or type description…"
          style={{
            background: T.input, border: `1px solid ${stockId ? T.accent2 + "88" : T.border}`,
            color: T.text, fontFamily: "inherit", fontSize: 13,
            padding: "8px 28px 8px 10px", borderRadius: 7, outline: "none", width: "100%",
            transition: "border-color .15s",
          }}
        />
        {stockId && (
          <span style={{
            position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)",
            fontSize: 9, fontWeight: 800, color: T.accent2,
            background: T.accent2 + "22", padding: "1px 5px", borderRadius: 4,
          }}>●</span>
        )}
      </div>
      {open && filtered.length > 0 && createPortal(
        <div ref={dropRef} style={{
          position: "fixed", top: pos.top, left: pos.left, width: Math.max(pos.width, 240),
          zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`,
          borderRadius: 10, boxShadow: T.shadow, overflow: "hidden",
        }}>
          {filtered.map(s => (
            <div
              key={s._id}
              onMouseDown={e => { e.preventDefault(); pick(s); }}
              style={{
                padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "background .1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: T.text }}>{s.name}</p>
                {s.sku && <p style={{ margin: 0, fontSize: 10, color: T.muted }}>{s.sku}</p>}
              </div>
              <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: T.accent, flexShrink: 0, marginLeft: 8 }}>
                AED {parseFloat(s.selling_price || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

/* ─── Line Item Row ─────────────────────────────────────────────────────── */
const LineRow = ({ item, onChange, onRemove, isOnly }) => {
  const T = useT();
  const set = (k, v) => onChange({ ...item, [k]: v });
  const { subtotal, discAmt, taxAmt, total } = calcLine(item);

  const handleItemPick = ({ desc, unitPrice, stockId }) => {
    onChange({
      ...item,
      desc:       desc ?? item.desc,
      unitPrice:  unitPrice !== null && unitPrice !== undefined ? unitPrice : item.unitPrice,
      stockId:    stockId !== undefined ? stockId : item.stockId,
    });
  };

  return (
    <tr>
      <td style={{ padding: "6px 4px", width: 90 }}>
        <Inp value={item.partNumber} onChange={e => set("partNumber", e.target.value)} placeholder="Part No." />
      </td>
      <td style={{ padding: "6px 4px" }}>
        <ItemCombo value={item.desc} stockId={item.stockId} onChange={handleItemPick} />
      </td>
      <td style={{ padding: "6px 4px", width: 62 }}>
        <Inp type="number" min="0.01" step="0.01" value={item.qty} onChange={e => set("qty", e.target.value)} style={{ textAlign: "right" }} />
      </td>
      <td style={{ padding: "6px 4px", width: 70 }}>
        <CustomSelect value={item.unit} onChange={v => set("unit", v)}
          options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))} />
      </td>
      <td style={{ padding: "6px 4px", width: 100 }}>
        <Inp type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => set("unitPrice", e.target.value)} style={{ textAlign: "right" }} />
      </td>
      <td style={{ padding: "6px 4px", width: 165, minWidth: 165 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "stretch" }}>
          <Inp type="number" min="0" value={item.discount} onChange={e => set("discount", e.target.value)} style={{ textAlign: "right", flex: 1, minWidth: 0, padding: "8px 8px" }} />
          <CustomSelect value={item.discountType} onChange={v => set("discountType", v)}
            options={[{ value: "percentage", label: "%" }, { value: "fixed", label: "AED" }]}
            style={{ width: 64, flexShrink: 0 }} />
        </div>
      </td>
      <td style={{ padding: "6px 4px", width: 62 }}>
        <Inp type="number" min="0" max="100" value={item.taxRate} onChange={e => set("taxRate", e.target.value)} style={{ textAlign: "right" }} />
      </td>
      <td style={{ padding: "6px 4px", width: 100, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 13, color: T.text, whiteSpace: "nowrap" }}>
        {fmtMoney(total)}
      </td>
      <td style={{ padding: "6px 4px", width: 28, textAlign: "center" }}>
        <button onClick={onRemove} disabled={isOnly} style={{ background: "none", border: "none", cursor: isOnly ? "not-allowed" : "pointer", color: isOnly ? T.subtle : T.red, fontSize: 14, lineHeight: 1 }}>×</button>
      </td>
    </tr>
  );
};

/* ─── Paste-import parser ────────────────────────────────────────────────
   Turns pasted table text (copied from Excel, or a PDF table where tabs
   survive the copy) into draft line items. Supplier quote PDFs list several
   numeric columns per row (qty, VAT%, VAT amount, unit price, discount%,
   line amount) with no reliable column markers once pasted as plain text —
   so instead of guessing "column 3 = price", we self-validate: a row's own
   arithmetic (qty × unitPrice ≈ lineAmount) tells us which numbers are which.
   Rows that don't resolve cleanly still come through (as a free-text line,
   qty 1, price 0) so nothing is silently dropped — the preview step lets the
   user fix or discard them before anything touches the quote. */
const toNum = (s) => {
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

const NUM_TOKEN = /^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/;
const isNumTok = (t) => NUM_TOKEN.test(t.replace(/%$/, ""));

// Tokenizes on ANY whitespace (not just tabs/double-spaces) — a table copied
// out of a rendered PDF viewer usually collapses every column gap down to a
// single space, so requiring tabs/double-spaces missed real rows entirely.
// Once split into words, the qty/unitPrice/amount triple is found the same
// self-validating way (their product must match a 3rd number on the line),
// but now tracked by INDEX so we know exactly which words are structured
// numeric columns (qty, VAT%, VAT amt, price, disc%, amount) vs description
// words — including embedded part numbers like "840240", which are numeric
// but never satisfy the qty×price≈amount check so they stay in the description.
function findTriple(tokens) {
  const nums = tokens.map((t, i) => (isNumTok(t) ? { i, v: toNum(t) } : null)).filter(Boolean);
  let best = null; // prefer the match whose amount is the largest on the line (real "Amount" col)
  for (const q of nums) {
    if (q.v <= 0 || q.v > 100000 || !Number.isInteger(q.v)) continue;
    for (const p of nums) {
      if (p.i === q.i || p.v <= 0) continue;
      for (const a of nums) {
        if (a.i === q.i || a.i === p.i) continue;
        if (Math.abs(q.v * p.v - a.v) < 0.05) {
          if (!best || a.v > best.a.v) best = { qty: q, price: p, amt: a };
        }
      }
    }
  }
  return best;
}

function parsePastedItemsLine(line) {
  const raw = line.trim();
  if (!raw) return null;
  // Section headers ("--20 mtr channel…") and "Origin : Europe" metadata lines
  // carry no item-description text worth keeping — skip outright.
  if (/^--/.test(raw) || /^note:?$/i.test(raw) || /^origin\s*:/i.test(raw)) return null;

  const tokens = raw.split(/\s+/).filter(Boolean);
  const triple = findTriple(tokens);

  if (!triple) {
    if (tokens.every(t => !isNumTok(t))) return { continuation: raw }; // pure prose, no numbers
    // Numbers present but nothing self-validated (e.g. a discounted line) —
    // still surface the row so the user can fix it rather than losing it.
    const nums = tokens.filter(isNumTok).map(toNum);
    return { desc: raw, qty: nums.find(n => Number.isInteger(n) && n > 0) ?? 1, unitPrice: nums.sort((a, b) => b - a)[0] ?? 0 };
  }

  const { qty, price, amt } = triple;
  // Drop a leading small standalone integer (the "SR No." column) from the
  // description — everything else in front of the qty column is the item's
  // text, including any embedded part number (e.g. "840240"), which the user
  // wants kept since it never matches the qty×price validation itself.
  const leadIsSR = tokens.length && isNumTok(tokens[0]) && Number.isInteger(toNum(tokens[0])) && toNum(tokens[0]) < 1000 && toNum(tokens[0]) !== qty.v;
  const descTokens = tokens.slice(leadIsSR ? 1 : 0, qty.i);
  // A lone unit-of-measure word ("Piece", "Nos"…) often sits right after qty —
  // grab it for the unit field instead of leaving it dangling in the description.
  const unitWord = tokens[qty.i + 1] && !isNumTok(tokens[qty.i + 1]) ? tokens[qty.i + 1] : null;

  return {
    desc: descTokens.join(" ").trim() || raw,
    qty: qty.v,
    unitPrice: price.v,
    unit: unitWord,
    _amt: amt.v,
  };
}

function parsePastedItems(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    const r = parsePastedItemsLine(line);
    if (!r) continue;
    if (r.continuation) {
      // Fold a description-continuation line into the previous real row
      // instead of creating a phantom line item for it.
      if (rows.length) rows[rows.length - 1].desc += " " + r.continuation;
      continue;
    }
    rows.push(r);
  }
  return rows;
}

const UNIT_ALIASES = { piece: "Pcs", pieces: "Pcs", pc: "Pcs", pcs: "Pcs", each: "Nos", no: "Nos", nos: "Nos", set: "Set", kg: "Kg", ltr: "Ltr", mtr: "Mtr", meter: "Mtr", metre: "Mtr", sqm: "Sqm", box: "Box", roll: "Roll" };
const normalizeUnit = (u) => (u && UNIT_ALIASES[u.trim().toLowerCase()]) || "Nos";

// Best-effort catalog match: exact SKU/code first, else fuzzy name/desc match.
function matchCatalog(desc, catalogItems) {
  const d = desc.trim().toLowerCase();
  const exact = catalogItems.find(c =>
    [c.sku, c.item_code, c.code].filter(Boolean).some(v => String(v).toLowerCase() === d));
  if (exact) return exact;
  const fuzzy = catalogItems.filter(c => matchItem(c, desc));
  return fuzzy.length === 1 ? fuzzy[0] : null; // only auto-link when unambiguous
}

/* ─── Paste Items modal ─────────────────────────────────────────────────── */
const PasteItemsModal = ({ T, catalogItems, onConfirm, onClose }) => {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState(null); // parsed preview, or null before parsing

  const doParse = () => {
    const parsed = parsePastedItems(raw).map(r => {
      const match = matchCatalog(r.desc, catalogItems);
      return {
        _uid: uid(),
        desc: match ? (match.name || r.desc) : r.desc,
        qty: r.qty,
        unit: normalizeUnit(r.unit),
        unitPrice: match ? parseFloat(match.selling_price || match.price || r.unitPrice || 0) : r.unitPrice,
        stockId: match ? match._id : null,
        matched: !!match,
      };
    });
    setRows(parsed);
  };

  const updateRow = (uid_, patch) => setRows(prev => prev.map(r => r._uid === uid_ ? { ...r, ...patch } : r));
  const removeRow = (uid_) => setRows(prev => prev.filter(r => r._uid !== uid_));

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 720, maxWidth: "94vw", maxHeight: "86vh", overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>Paste Items</div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
          Paste a copied table (from Excel, or a PDF's item table) below. Each line becomes one item — review before adding.
        </div>

        {rows === null ? (
          <>
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder={"ACO Xtraline Channel NW100 h=55 L=1000\t20\tPiece\t38.95\t779.00\n..."}
              rows={10}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 12, fontFamily: "'DM Mono',monospace", resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={doParse} disabled={!raw.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: raw.trim() ? "pointer" : "not-allowed", opacity: raw.trim() ? 1 : 0.5, fontFamily: "inherit" }}>Parse</button>
            </div>
          </>
        ) : (
          <>
            {rows.length === 0 ? (
              <div style={{ fontSize: 13, color: T.muted, padding: "20px 0", textAlign: "center" }}>Nothing parsed from that text.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rows.map(r => (
                  <div key={r._uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface2 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.matched ? T.accent2 : T.muted, flexShrink: 0 }} title={r.matched ? "Matched to catalog item" : "No catalog match — free-text line"} />
                    <input value={r.desc} onChange={e => updateRow(r._uid, { desc: e.target.value })}
                      style={{ flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 12, fontFamily: "inherit" }} />
                    <input type="number" value={r.qty} onChange={e => updateRow(r._uid, { qty: toNum(e.target.value) ?? 0 })}
                      style={{ width: 56, padding: "5px 6px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 12, textAlign: "right", fontFamily: "inherit" }} />
                    <input type="number" value={r.unitPrice} onChange={e => updateRow(r._uid, { unitPrice: toNum(e.target.value) ?? 0 })}
                      style={{ width: 80, padding: "5px 6px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 12, textAlign: "right", fontFamily: "inherit" }} />
                    <button onClick={() => removeRow(r._uid)} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 15, padding: "0 4px" }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <button onClick={() => setRows(null)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={() => onConfirm(rows)} disabled={rows.length === 0} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.accent2, color: "#fff", fontSize: 12, fontWeight: 700, cursor: rows.length ? "pointer" : "not-allowed", opacity: rows.length ? 1 : 0.5, fontFamily: "inherit" }}>
                  Add {rows.length} Item{rows.length === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

/* ─── Main Component ────────────────────────────────────────────────────── */
const EMPTY_ITEM = () => ({ _uid: uid(), partNumber: "", desc: "", qty: 1, unit: "Nos", unitPrice: 0, discount: 0, discountType: "percentage", taxRate: 5 });

const UNIT_OPTIONS = ["Nos", "Pcs", "Set", "Kg", "Ltr", "Mtr", "Sqm", "Box", "Roll", "Lot", "Job", "Month", "Hr"];

export default function CreateQuote() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useThemeStore(s => s.isDark);
  const T         = getT(isDark);
  const isMobile  = useIsMobile();

  const { handleGetCustomers, data: rawCustomers } = useGetCustomers();
  useEffect(() => { handleGetCustomers(); }, [handleGetCustomers]);
  const customerOpts = (rawCustomers || []).map(c => ({
    value: c._id,
    label: c.customerDisplayName || c.companyName || `${c.firstName} ${c.lastName}`.trim(),
    customer: c,
  }));

  // Pre-fill from edit/clone state or from Enquiry conversion
  const prefill    = location.state?.edit || location.state?.clone || null;
  const isEdit     = !!location.state?.edit;
  const fromEnquiry = location.state?.fromEnquiry || null;

  const [customerId,    setCustomerId]    = useState(prefill?.customerId || fromEnquiry?.customerId || "");
  const [customerName,  setCustomerName]  = useState(prefill?.customerName || fromEnquiry?.customerName || "");
  const [customerEmail, setCustomerEmail] = useState(prefill?.customerEmail || fromEnquiry?.email || "");
  const [billTo,        setBillTo]        = useState({
    name: fromEnquiry?.customerName || "",
    address: fromEnquiry?.company ? `${fromEnquiry.company}` : "",
    trn: "",
    poBox: "",
    ...(prefill?.billTo || {}), // older saved quotes may predate poBox — falls back to ""
  });
  const [quoteDate,     setQuoteDate]     = useState(today());
  const [validUntil,    setValidUntil]    = useState(net30());
  const [currency,      setCurrency]      = useState(prefill?.currency || "AED");
  const [paymentTerms,  setPaymentTerms]  = useState(prefill?.paymentTerms || "Net 30");
  const [lineItems,     setLineItems]     = useState(
    prefill?.lineItems?.length
      ? prefill.lineItems.map(li => ({ ...li, _uid: uid(), discountType: li.discountType || "percentage" }))
      : fromEnquiry?.lineItems?.length
        ? fromEnquiry.lineItems.map(li => ({
            ...EMPTY_ITEM(),
            desc:       li.itemName || li.desc || "",
            qty:        li.qty || 1,
            unitPrice:  li.unitPrice || 0,
            _enqItemId: li.itemId || null,
            stockId:    li.itemId || null,
          }))
        : fromEnquiry?.estimatedValue
          ? [{ ...EMPTY_ITEM(), desc: fromEnquiry.subject || "As per enquiry", unitPrice: fromEnquiry.estimatedValue }]
          : [EMPTY_ITEM()]
  );

  // Stock catalog — always loaded (used in item picker + price delta panel)
  const [catalogItems, setCatalogItems] = useState([]);
  useEffect(() => {
    axiosInstance.get("/api/stocks/getitem")
      .then(r => setCatalogItems(r.data?.data || []))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [custNote,    setCustNote]    = useState(
    prefill?.notes?.customer || (fromEnquiry?.description ? `Enquiry: ${fromEnquiry.description}` : "")
  );
  const [internalNote,setInternalNote]= useState(
    prefill?.notes?.internal || (fromEnquiry?.enquiryNumber ? `Ref: ${fromEnquiry.enquiryNumber}` : "")
  );

  // Reference / document fields
  const [attentionTo,  setAttentionTo]  = useState(prefill?.attentionTo  || fromEnquiry?.contactPerson || "");
  const [salutation,   setSalutation]   = useState(prefill?.salutation  || "");
  const [subject,      setSubject]      = useState(prefill?.subject      || fromEnquiry?.subject || "");
  const [projectName,  setProjectName]  = useState(prefill?.projectName  || fromEnquiry?.projectName || "");
  const [introText,    setIntroText]    = useState(prefill?.introText    || "");
  // Salesperson — selectable; drives the quote number (initials) when the org enables
  // salesperson numbering, and carries to a converted Sales Order.
  const [salesperson, setSalesperson] = useState(prefill?.salesperson || fromEnquiry?.assignedTo || "");
  const activeOrg   = useAuthStore((s) => s.activeOrg);
  const activeOrgId = useAuthStore((s) => s.activeOrg?._id || s.user?.orgId || "");
  const [salesReps, setSalesReps] = useState([]);
  useEffect(() => {
    if (!activeOrgId) return;
    axiosInstance.get(`/api/organizations/${activeOrgId}/members`)
      .then(r => setSalesReps((r.data?.data || []).filter(m => m.status === "active" && m.role !== "owner" && m.role !== "admin").map(m => m.userId)))
      .catch(() => setSalesReps([]));
  }, [activeOrgId]);
  const salespersonOptions = (salesperson && !salesReps.includes(salesperson) ? [salesperson, ...salesReps] : salesReps).map(u => ({ value: u, label: u }));

  // Sender company details
  const [company, setCompany] = useState(prefill?.company || {
    name: "", address: "", trn: "", phone: "", email: "", website: "",
  });
  const [signatory, setSignatory] = useState(prefill?.signatory || { name: "", title: "" });

  // Company Name defaults to the active org's own name — a brand-new quote has
  // no reason to make the user retype what's already on their account.
  useEffect(() => {
    if (prefill || !activeOrg?.name) return;
    setCompany(c => c.name ? c : { ...c, name: activeOrg.name });
  }, [prefill, activeOrg]);

  // "Create & Send" — pick one or more email recipients before sending.
  const [sendOpen,    setSendOpen]    = useState(false);
  const [recipients,  setRecipients]  = useState([""]);
  const [sendMessage, setSendMessage] = useState("");
  const openSendModal = () => {
    if (!customerId) { nexusToast.error("Please select a customer"); return; }
    setRecipients(customerEmail ? [customerEmail] : [""]);
    setSendMessage("");
    setSendOpen(true);
  };
  const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || "").trim());
  const confirmSend = () => {
    const clean = recipients.map(r => r.trim()).filter(Boolean);
    if (!clean.length)            { nexusToast.error("Add at least one recipient"); return; }
    if (clean.some(e => !isEmail(e))) { nexusToast.error("One or more emails are invalid"); return; }
    setSendOpen(false);
    submit("sent", [...new Set(clean)]);
  };

  // Terms & Conditions
  const DEFAULT_TERMS = [
    "Pricing: Above quoted are in AED.",
    "Price Validity: Above quoted prices are valid for orders finalized within 15 days from date.",
    "Payment Terms: 30 Days PDC, cheque copy should be received prior to delivery.",
    "Availability: Ex-stock subject to prior sales. Final delivery schedule to be mutually agreed.",
    "Delivery: Delivered to your project site.",
    "Pricing: This offer has been made on the basis of items, quantities and specifications indicated. Any changes may render price adjustments.",
  ];
  const [terms, setTerms] = useState(
    prefill?.termsAndConditions?.length ? prefill.termsAndConditions : DEFAULT_TERMS
  );

  const [saving,      setSaving]      = useState(false);

  // Totals
  const computed = lineItems.map(calcLine);
  const subtotalSum  = computed.reduce((s, c) => s + c.subtotal, 0);
  const discountSum  = computed.reduce((s, c) => s + c.discAmt,  0);
  const taxSum       = computed.reduce((s, c) => s + c.taxAmt,   0);
  const grandTotal   = computed.reduce((s, c) => s + c.total,    0);

  const handleCustomer = (e) => {
    const cust = e.customer;
    setCustomerId(e.target.value);
    if (!cust) return;
    setCustomerName(cust.customerDisplayName || cust.companyName || `${cust.firstName} ${cust.lastName}`.trim());
    setCustomerEmail(cust.customerEmail || "");
    setBillTo({ name: cust.customerDisplayName || cust.companyName || "", address: fmtCustAddr(cust), trn: cust.trn || "", poBox: cust.postalCode || "" });
  };

  // Converting from an Enquiry locks the customer picker (its onChange, and
  // therefore the auto-fill above, never fires) — the enquiry itself only
  // carries a loose name/company string, not the customer's real TRN/address.
  // Look the linked customer up once the list loads and fill Bill To from it.
  useEffect(() => {
    if (!fromEnquiry?.customerId || prefill) return;
    const cust = (rawCustomers || []).find(c => c._id === fromEnquiry.customerId);
    if (!cust) return;
    setCustomerName(cust.customerDisplayName || cust.companyName || `${cust.firstName} ${cust.lastName}`.trim());
    setCustomerEmail(prev => prev || cust.customerEmail || "");
    setBillTo({ name: cust.customerDisplayName || cust.companyName || "", address: fmtCustAddr(cust), trn: cust.trn || "", poBox: cust.postalCode || "" });
  }, [fromEnquiry, prefill, rawCustomers]);

  const updateItem = (uid, updated) => setLineItems(prev => prev.map(li => li._uid === uid ? { ...li, ...updated } : li));
  const removeItem = (uid) => setLineItems(prev => prev.filter(li => li._uid !== uid));
  const addItem    = () => setLineItems(prev => [...prev, EMPTY_ITEM()]);

  const [showPaste, setShowPaste] = useState(false);
  const handlePasteConfirm = (rows) => {
    const newItems = rows.map(r => ({
      ...EMPTY_ITEM(),
      desc: r.desc, qty: r.qty, unit: r.unit || "Nos", unitPrice: r.unitPrice, stockId: r.stockId,
    }));
    setLineItems(prev => {
      // The default blank starter row (never touched) gets replaced rather than
      // left dangling as an empty line ahead of the newly pasted ones.
      const isBlankStarter = prev.length === 1 && !prev[0].desc && prev[0].unitPrice === 0;
      return isBlankStarter ? newItems : [...prev, ...newItems];
    });
    setShowPaste(false);
    nexusToast.success(`Added ${rows.length} item${rows.length === 1 ? "" : "s"}`);
  };

  async function submit(status, recipients) {
    if (!customerId) { nexusToast.error("Please select a customer"); return; }
    setSaving(true);
    try {
      const payload = {
        status,
        customerId, customerName, customerEmail,
        billTo,
        quoteDate, validUntil, currency, paymentTerms,
        attentionTo, salutation, subject, projectName, introText, salesperson,
        company, signatory,
        termsAndConditions: terms,
        lineItems: lineItems.map((li, i) => {
          const { subtotal, discAmt, taxAmt, total } = computed[i];
          return {
            partNumber: li.partNumber || "",
            desc: li.desc, qty: p(li.qty), unit: li.unit || "Nos",
            unitPrice: p(li.unitPrice), discount: p(li.discount),
            discountType: li.discountType || "percentage",
            taxRate: p(li.taxRate), subtotal, discAmt, taxAmt, total,
            stockId: li.stockId || li._enqItemId || null,
          };
        }),
        totals: { subtotal: subtotalSum, discountTotal: discountSum, taxTotal: taxSum, grandTotal },
        notes: { customer: custNote, internal: internalNote },
        sourceEnquiryId:     fromEnquiry?._id || null,
        sourceEnquiryNumber: fromEnquiry?.enquiryNumber || null,
        // Recipients ride in the payload so the backend can email on create AND after an
        // approval hold is replayed. (Re-send later uses the /send endpoint.)
        recipients:  status === "sent" ? (recipients || []) : [],
        sendMessage: status === "sent" ? sendMessage : "",
      };

      let r;
      if (isEdit && prefill?._id) {
        r = await axiosInstance.put(`/api/quotes/${prefill._id}`, payload);
      } else {
        r = await axiosInstance.post("/api/quotes/", payload);
      }
      const saved = r?.data?.data || {};
      const pendingApproval = saved.status === "pending_approval";
      if (pendingApproval) {
        nexusToast.success("Submitted for approval — it'll be emailed once approved");
      } else if (status === "sent") {
        // Backend auto-emails on create; reflect the real result.
        if (saved.emailSent) {
          nexusToast.success(`Quote created & sent to ${recipients?.length || 1} recipient${(recipients?.length || 1) > 1 ? "s" : ""}`);
        } else {
          nexusToast.error(saved.emailError ? `Quote saved, but email failed: ${saved.emailError}` : "Quote saved, but no email was sent");
        }
      } else {
        nexusToast.success(isEdit ? "Quote updated" : "Quote saved as draft");
      }
      // Mark the source enquiry as Quoted now that the quote exists (not before — so
      // cancelling the quote leaves the enquiry untouched).
      if (fromEnquiry?._id) {
        axiosInstance.patch(`/api/enquiries/${fromEnquiry._id}/status`, { status: "quoted" }).catch(() => {});
      }
      navigate("/Sales/Quotes");
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to save quote");
    } finally {
      setSaving(false);
    }
  }

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; }
    @keyframes qPop { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.13)"}; border-radius: 999px; }
  `;

  const guard = useUnsavedGuard({ hasDraft: false });

  return (
    <ThemeCtx.Provider value={T}>
    <StockCtx.Provider value={catalogItems}>
      <div onInput={guard.markDirty} onChange={guard.markDirty} style={{ background: T.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: T.text }}>
        <style>{css}</style>

        {/* Top bar */}
        <div style={{ background: T.topbar, borderBottom: `1px solid ${T.border}`, padding: isMobile ? "12px 14px" : "14px 28px", display: "flex", flexWrap: isMobile ? "wrap" : "nowrap", alignItems: "center", justifyContent: "space-between", gap: isMobile ? 10 : 0, position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button onClick={() => guard.leave(() => navigate("/Sales/Quotes"))} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0, flexShrink: 0 }}>←</button>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: isMobile ? 14 : 16, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isEdit ? "Edit Quote" : "New Quote"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
            <Btn v="ghost" onClick={() => guard.leave(() => navigate("/Sales/Quotes"))} disabled={saving}>Cancel</Btn>
            {isEdit && prefill?._id && (
              <Btn v="outline" onClick={() => navigate(`/Sales/Quotes/${prefill._id}/print`)} disabled={saving}>🖨 {isMobile ? "Print" : "Preview & Print"}</Btn>
            )}
            <Btn v="outline" onClick={() => submit("draft")} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</Btn>
            <Btn v="primary" onClick={openSendModal} disabled={saving}>{saving ? "Saving…" : (isMobile ? "Create" : "Create & Send")}</Btn>
          </div>
        </div>

        <div style={{ maxWidth: 960, margin: "0 auto", padding: isMobile ? "16px 14px" : "28px 24px" }}>

          {/* From-Enquiry banner */}
          {fromEnquiry && (
            <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ background: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"}`, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: isDark ? "#60a5fa" : "#1d4ed8", fontWeight: 600 }}>
                  Converted from Enquiry {fromEnquiry.enquiryNumber ? `#${fromEnquiry.enquiryNumber}` : ""} — {fromEnquiry.customerName}
                </span>
                <span style={{ fontSize: 12, color: isDark ? "#93c5fd" : "#3b82f6", marginLeft: "auto" }}>
                  Pre-filled from enquiry data. Select the customer from the dropdown to link the quote.
                </span>
              </div>

              {/* Price delta panel — shown only when enquiry has line items with catalog matches */}
              {(() => {
                if (!fromEnquiry.lineItems?.length || !catalogItems.length) return null;
                const deltas = fromEnquiry.lineItems
                  .filter(li => li.itemId)
                  .map(li => {
                    const cat = catalogItems.find(c => c._id === li.itemId);
                    if (!cat) return null;
                    const sys = parseFloat(cat.selling_price || 0);
                    const offered = parseFloat(li.unitPrice || 0);
                    if (sys === 0 || offered === sys) return null;
                    const pct = ((offered - sys) / sys * 100).toFixed(1);
                    return { name: li.itemName, offered, sys, pct };
                  })
                  .filter(Boolean);
                if (!deltas.length) return null;
                return (
                  <div style={{ background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb",
                    border: `1px solid ${isDark ? "rgba(245,158,11,0.3)" : "#fcd34d"}`,
                    borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.06em", color: isDark ? "#f59e0b" : "#b45309", marginBottom: 8 }}>
                      ⚠ Price Differences (Enquiry vs Catalogue)
                    </div>
                    <div style={{ overflowX: isMobile ? "auto" : "visible" }}>
                     <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "4px 16px",
                      fontSize: 12, color: T.text, minWidth: isMobile ? 360 : "auto" }}>
                      <span style={{ fontWeight: 700, color: T.muted }}>Item</span>
                      <span style={{ fontWeight: 700, color: T.muted, textAlign: "right" }}>Offered</span>
                      <span style={{ fontWeight: 700, color: T.muted, textAlign: "right" }}>Catalogue</span>
                      <span style={{ fontWeight: 700, color: T.muted, textAlign: "right" }}>Δ</span>
                      {deltas.map((d, i) => (
                        <>
                          <span key={`n${i}`}>{d.name}</span>
                          <span key={`o${i}`} style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>
                            AED {d.offered.toFixed(2)}
                          </span>
                          <span key={`s${i}`} style={{ textAlign: "right", fontFamily: "'DM Mono', monospace" }}>
                            AED {d.sys.toFixed(2)}
                          </span>
                          <span key={`p${i}`} style={{ textAlign: "right", fontFamily: "'DM Mono', monospace",
                            fontWeight: 700, color: parseFloat(d.pct) < 0 ? T.red : T.accent2 }}>
                            {parseFloat(d.pct) > 0 ? "+" : ""}{d.pct}%
                          </span>
                        </>
                      ))}
                     </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Customer + Dates */}
          <Section title="Quote Details">
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Customer *">
                <CustomerSelect value={customerId} onChange={handleCustomer} options={customerOpts} name="customerId" disabled={!!fromEnquiry} />
              </Field>
              <Field label="Customer Email">
                <Inp value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@example.com" type="email" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 16, marginBottom: 16 }}>
              <Field label="Quote Date">
                <CustomDate value={quoteDate} onChange={setQuoteDate} />
              </Field>
              <Field label="Valid Until">
                <CustomDate value={validUntil} onChange={setValidUntil} placeholder="Select date" />
              </Field>
              <Field label="Currency">
                <CustomSelect value={currency} onChange={setCurrency}
                  options={["AED","USD","EUR","GBP","SAR","INR"].map(c => ({ value: c, label: c }))} />
              </Field>
              <Field label="Payment Terms">
                <CustomSelect value={paymentTerms} onChange={setPaymentTerms}
                  options={["Due on Receipt","Net 15","Net 30","Net 60","End of Month","30 Days PDC"].map(t => ({ value: t, label: t }))} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Attention To (Contact Person)">
                <Inp value={attentionTo} onChange={e => setAttentionTo(e.target.value)} placeholder="e.g. Mr. John Smith - Procurement" />
              </Field>
              <Field label="Salutation">
                <Inp value={salutation} onChange={e => setSalutation(e.target.value)} placeholder="e.g. Madam," />
              </Field>
              <Field label="Subject">
                <Inp value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Offer for supply of…" />
              </Field>
              <Field label="Project Name">
                <Inp value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Nashama School" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
              <Field label="Salesperson">
                <CustomSelect value={salesperson} onChange={setSalesperson}
                  options={salespersonOptions}
                  placeholder={salespersonOptions.length ? "Select salesperson…" : "No sales reps yet"} />
              </Field>
            </div>
          </Section>

          {/* Intro Text */}
          <Section title="Intro Text (PDF Body)">
            <Field label="Opening Paragraph">
              <Tex
                value={introText}
                onChange={e => setIntroText(e.target.value)}
                rows={3}
                placeholder="e.g. We refer to your enquiry dated … please find the attached offer for supply of the above subject."
              />
            </Field>
          </Section>

          {/* Bill To */}
          <Section title="Bill To (Customer Address)">
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
              <Field label="Name / Company">
                <Inp value={billTo.name} onChange={e => setBillTo(b => ({ ...b, name: e.target.value }))} placeholder="Company / Contact name" />
              </Field>
              <Field label="TRN">
                <Inp value={billTo.trn} onChange={e => setBillTo(b => ({ ...b, trn: e.target.value }))} placeholder="Tax Registration Number" />
              </Field>
              <Field label="P.O. Box">
                <Inp value={billTo.poBox} onChange={e => setBillTo(b => ({ ...b, poBox: e.target.value }))} placeholder="e.g. 37579" />
              </Field>
            </div>
            <div style={{ marginTop: 16 }}>
              <Field label="Address (Street, City, Country)">
                <Tex value={billTo.address} onChange={e => setBillTo(b => ({ ...b, address: e.target.value }))} rows={2} style={{ minHeight: 0 }} placeholder={"e.g.\nDubai, United Arab Emirates"} />
              </Field>
            </div>
          </Section>

          {/* Line Items */}
          <Section title="Line Items">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: isMobile ? 760 : "auto", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Part No.", "Description", "Qty", "Unit", "Unit Price", "Discount", "Tax %", "Total", ""].map((h, i) => (
                      <th key={i} style={{ padding: "0 4px 10px", textAlign: i >= 6 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, i) => (
                    <LineRow key={li._uid} item={li}
                      onChange={updated => updateItem(li._uid, updated)}
                      onRemove={() => removeItem(li._uid)}
                      isOnly={lineItems.length === 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={addItem} style={{ background: "none", border: `1px dashed ${T.border}`, borderRadius: 7, padding: "7px 16px", color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: ".15s" }}>
                + Add Line
              </button>
              <button onClick={() => setShowPaste(true)} style={{ background: "none", border: `1px dashed ${T.border}`, borderRadius: 7, padding: "7px 16px", color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: ".15s" }}>
                📋 Paste Items
              </button>
            </div>
            {showPaste && (
              <PasteItemsModal T={T} catalogItems={catalogItems} onConfirm={handlePasteConfirm} onClose={() => setShowPaste(false)} />
            )}

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <div style={{ width: isMobile ? "100%" : 280 }}>
                {[
                  ["Subtotal",    subtotalSum],
                  ["Discount",   -discountSum],
                  ["Tax",         taxSum],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                    <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: T.text }}>{fmtMoney(val)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Total</span>
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: T.accent }}>{fmtMoney(grandTotal)}</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
              <Field label="Notes (visible on PDF — each line becomes a bullet point)">
                <Tex value={custNote} onChange={e => setCustNote(e.target.value)} placeholder={"e.g.\nAll prices are exclusive of additional taxes.\nPrices valid subject to prior sales."} />
              </Field>
              <Field label="Internal Notes">
                <Tex value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Internal only…" />
              </Field>
            </div>
          </Section>

          {/* Terms & Conditions */}
          <Section title="Terms &amp; Conditions">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {terms.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ minWidth: 20, paddingTop: 9, fontSize: 11, fontWeight: 700, color: T.muted, textAlign: "right" }}>{i + 1}</span>
                  <Tex
                    value={t}
                    onChange={e => setTerms(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                    rows={1}
                    style={{ minHeight: 0, flex: 1 }}
                  />
                  <button
                    onClick={() => setTerms(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 16, paddingTop: 6, lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
              <button
                onClick={() => setTerms(prev => [...prev, ""])}
                style={{ alignSelf: "flex-start", background: "none", border: `1px dashed ${T.border}`, borderRadius: 7, padding: "6px 14px", color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
              >+ Add Term</button>
            </div>
          </Section>

          {/* Your Company Details */}
          <Section title="Your Company (PDF Header &amp; Footer)">
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Company Name">
                <Inp value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} />
              </Field>
              <Field label="TRN">
                <Inp value={company.trn} onChange={e => setCompany(c => ({ ...c, trn: e.target.value }))} placeholder="Tax Registration Number" />
              </Field>
              <Field label="Address">
                <Tex value={company.address} onChange={e => setCompany(c => ({ ...c, address: e.target.value }))} rows={2} style={{ minHeight: 0 }} placeholder="P.O. Box 8261, Abu Dhabi, UAE" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Phone">
                <Inp value={company.phone} onChange={e => setCompany(c => ({ ...c, phone: e.target.value }))} placeholder="+971 54 4920990" />
              </Field>
              <Field label="Email">
                <Inp value={company.email} onChange={e => setCompany(c => ({ ...c, email: e.target.value }))} placeholder="sales@company.com" type="email" />
              </Field>
              <Field label="Website">
                <Inp value={company.website} onChange={e => setCompany(c => ({ ...c, website: e.target.value }))} placeholder="www.company.com" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
              <Field label="Signatory Name">
                <Inp value={signatory.name} onChange={e => setSignatory(s => ({ ...s, name: e.target.value }))} placeholder="e.g. MANU" />
              </Field>
              <Field label="Signatory Title">
                <Inp value={signatory.title} onChange={e => setSignatory(s => ({ ...s, title: e.target.value }))} placeholder="e.g. Sales Manager" />
              </Field>
            </div>
          </Section>

          {/* Bottom actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8 }}>
            <Btn v="ghost" onClick={() => guard.leave(() => navigate("/Sales/Quotes"))} disabled={saving}>Cancel</Btn>
            <Btn v="outline" onClick={() => submit("draft")} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</Btn>
            <Btn v="primary" onClick={openSendModal} disabled={saving}>{saving ? "Saving…" : "Create & Send"}</Btn>
          </div>
        </div>

        {sendOpen && (
          <div onClick={() => !saving && setSendOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 460, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: "Sora, sans-serif" }}>Send quote</div>
              <div style={{ fontSize: 12.5, color: T.muted, margin: "5px 0 16px" }}>Add one or more email recipients.</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recipients.map((rcpt, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="email" value={rcpt} placeholder="name@company.com"
                      onChange={e => setRecipients(rs => rs.map((v, j) => j === i ? e.target.value : v))}
                      style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                    {recipients.length > 1 && (
                      <button onClick={() => setRecipients(rs => rs.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setRecipients(rs => [...rs, ""])}
                style={{ marginTop: 8, background: "none", border: "none", color: T.accent || "#3b82f6", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>+ Add recipient</button>

              <textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)} rows={3}
                placeholder="Optional message to include in the email…"
                style={{ width: "100%", boxSizing: "border-box", marginTop: 14, resize: "vertical", padding: "10px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
                <Btn v="ghost" onClick={() => setSendOpen(false)} disabled={saving}>Cancel</Btn>
                <Btn v="primary" onClick={confirmSend} disabled={saving}>{saving ? "Sending…" : "Send Quote"}</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </StockCtx.Provider>
    </ThemeCtx.Provider>
  );
}
