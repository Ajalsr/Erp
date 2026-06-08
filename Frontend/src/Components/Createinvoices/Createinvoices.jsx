import { useState, useCallback, useMemo, useEffect, useRef, createContext, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import useGetCustomers from "../../helper/useGetCustomers";
import axiosInstance from "../../helper/axiosInstance";
import useThemeStore from "../../store/useThemeStore";
import nexusToast from "../../helper/nexusToast";

/* ─── Theme ─────────────────────────────────────────────────────────────── */
const getT = (isDark) => isDark ? {
  bg:       "#0a0e1a",
  surface:  "#111827",
  surface2: "#1a2234",
  border:   "#1e2d47",
  accent:   "#f59e0b",
  accent2:  "#10b981",
  red:      "#ef4444",
  text:     "#f1f5f9",
  muted:    "#64748b",
  subtle:   "#334155",
  input:    "#0f172a",
  topbar:   "#111827",
  selectOpt:"#111827",
  shadow:   "0 16px 48px rgba(0,0,0,0.55)",
} : {
  bg:       "#f1f5f9",
  surface:  "#ffffff",
  surface2: "#f8fafc",
  border:   "#e2e8f0",
  accent:   "#d97706",
  accent2:  "#059669",
  red:      "#dc2626",
  text:     "#0f172a",
  muted:    "#64748b",
  subtle:   "#cbd5e1",
  input:    "#ffffff",
  topbar:   "#ffffff",
  selectOpt:"#ffffff",
  shadow:   "0 12px 32px rgba(0,0,0,0.1)",
};

const ThemeCtx = createContext(getT(true));
const useT = () => useContext(ThemeCtx);

const VAT_RATE = 5;

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const today = () => new Date().toISOString().split("T")[0];
const net30  = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; };
const TERMS_DAYS = { "Due on Receipt": 0, "Net 7": 7, "Net 15": 15, "Net 30": 30, "Net 45": 45, "Net 60": 60, "Net 90": 90 };
const SO_TO_INV_TERMS = {
  due_on_receipt: "Due on Receipt", net_7: "Net 7", net_10: "Net 7", net_15: "Net 15",
  net_30: "Net 30", net_45: "Net 45", net_60: "Net 60", net_90: "Net 90",
  prepaid: "100% Advance", cod: "Due on Receipt", eom: "Net 30",
  "2_10_net_30": "Net 30", "15_eom": "Net 30", "30_eom": "Net 30", letter_of_credit: "Net 30",
};
const calcDueDate = (issueDateStr, terms, customDays) => {
  let days = TERMS_DAYS[terms];
  if (days === undefined) {
    if (terms === "Custom" && customDays > 0) days = customDays;
    else return null; // unknown terms, no custom days — don't override
  }
  const d = new Date(issueDateStr || today());
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};
const p      = (v)  => parseFloat(v) || 0;
let _id = 0;
const uid = () => ++_id;

const calcLine = (item) => {
  const subtotal = p(item.qty) * p(item.unitPrice);
  const discAmt  = item.discountType === "percentage"
    ? subtotal * (p(item.discount) / 100)
    : p(item.discount);
  const taxAmt   = (subtotal - discAmt) * (p(item.taxRate) / 100);
  return { subtotal, discAmt, taxAmt, total: subtotal - discAmt + taxAmt };
};

const fmtMoney = (n) =>
  `AED ${Number(n).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCustAddr = (c) => {
  const line1 = c.streetAddress || "";
  const line2 = [c.city, c.postalCode, c.country].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join("\n");
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
  const base = { background: T.input, border: `1px solid ${T.border}`, color: T.text, fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "8px 12px", borderRadius: 7, outline: "none", width: "100%", transition: "border-color .15s" };
  return <input style={{ ...base, ...style }} {...f} {...r} />;
};
const Sel = ({ style, children, ...r }) => {
  const T = useT();
  const base = { background: T.input, border: `1px solid ${T.border}`, color: T.text, fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "8px 12px", borderRadius: 7, outline: "none", width: "100%", transition: "border-color .15s" };
  return <select style={{ ...base, cursor: "pointer", ...style }} {...r}>{children}</select>;
};
const Tex = ({ style, ...r }) => {
  const T = useT(); const f = useFF();
  const base = { background: T.input, border: `1px solid ${T.border}`, color: T.text, fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "8px 12px", borderRadius: 7, outline: "none", width: "100%", transition: "border-color .15s" };
  return <textarea style={{ ...base, resize: "vertical", minHeight: 70, lineHeight: 1.5, ...style }} {...f} {...r} />;
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
    danger:  { background: "transparent", color: T.red,     border: `1px solid ${T.red}4d` },
  };
  return <button style={{ padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: ".15s", ...map[v], ...style }} {...r}>{children}</button>;
};

/* ─── Customer Select ───────────────────────────────────────────────────── */
const CustomerSelect = ({ value, onChange, options, name, disabled }) => {
  const T = useT();
  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);

  const selected = options.find(o => o.value === value);
  const display  = selected?.label ?? null;

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(options.length * 44 + 16, 260);
    const top = (window.innerHeight - r.bottom) > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, [options.length]);

  const handleOpen = () => {
    if (disabled) return;
    if (open) { setOpen(false); setReady(false); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => measurePos());
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    if (!open) return;
    const s = () => measurePos();
    window.addEventListener('scroll', s, true);
    window.addEventListener('resize', s);
    return () => { window.removeEventListener('scroll', s, true); window.removeEventListener('resize', s); };
  }, [open, measurePos]);

  useEffect(() => {
    const h = e => {
      if (triggerRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false); setReady(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = (opt) => {
    onChange({ target: { name, value: opt.value }, customer: opt.customer || null });
    setOpen(false); setReady(false);
  };

  const dropdown = (
    <div ref={dropRef} style={{
      position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width,
      zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12,
      boxShadow: T.shadow, overflow: 'hidden',
      visibility: ready ? 'visible' : 'hidden', opacity: ready ? 1 : 0, transition: 'opacity 0.12s ease',
    }}>
      <div style={{ maxHeight: 244, overflowY: 'auto', padding: 6 }}>
        {options.map((opt, i) => {
          const isAct = opt.value === value;
          return (
            <div key={i} onClick={() => select(opt)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
              fontWeight: isAct ? 600 : 400, color: isAct ? T.accent : T.text,
              background: isAct ? `${T.accent}1a` : 'transparent', transition: 'background 0.1s',
              fontFamily: "'DM Sans', sans-serif",
            }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = `${T.border}55`; }}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}>
              {opt.label}
              {isAct && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div ref={triggerRef} onClick={handleOpen} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 36, padding: '0 12px', width: '100%', boxSizing: 'border-box',
        border: `1.5px solid ${open ? `${T.accent}88` : T.border}`,
        borderRadius: 7, background: disabled ? `${T.surface2}` : T.input,
        cursor: disabled ? 'not-allowed' : 'pointer', userSelect: 'none',
        opacity: disabled ? 0.7 : 1,
        boxShadow: open ? `0 0 0 3px ${T.accent}14` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <span style={{ fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: display ? 500 : 400, color: display ? T.text : T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display || '— Select customer —'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={open ? T.accent : T.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && createPortal(dropdown, document.body)}
    </>
  );
};

/* ─── Line Items Table ──────────────────────────────────────────────────── */
const LineItems = ({ items }) => {
  const T = useT();

  const { subtotal: gSub, discAmt: gDisc, taxAmt: gTax, total: gRawTotal } = useMemo(() =>
    items.reduce((acc, item) => {
      const c = calcLine(item);
      return { subtotal: acc.subtotal + c.subtotal, discAmt: acc.discAmt + c.discAmt, taxAmt: acc.taxAmt + c.taxAmt, total: acc.total + c.total };
    }, { subtotal: 0, discAmt: 0, taxAmt: 0, total: 0 }),
    [items]
  );
  const gTotal = gRawTotal - gDisc;

  const COLS = [
    { h: "Description", w: "30%", align: "left"  },
    { h: "Qty",         w: "7%",  align: "right" },
    { h: "Unit Price",  w: "13%", align: "right" },
    { h: "Subtotal",    w: "11%", align: "right" },
    { h: "Discount",    w: "11%", align: "right" },
    { h: "Tax %",       w: "7%",  align: "right" },
    { h: "Tax Amt",     w: "10%", align: "right" },
    { h: "Line Total",  w: "11%", align: "right" },
  ];

  const tdBase = { verticalAlign: "middle", borderBottom: `1px solid ${T.border}` };

  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: c.w }} />)}</colgroup>
        <thead>
          <tr style={{ background: T.surface2 }}>
            {COLS.map((c, i) => (
              <th key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, padding: "10px 8px", textAlign: c.align, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{c.h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const { subtotal, discAmt, taxAmt, total } = calcLine(item);
            const mono = { fontFamily: "'DM Mono', monospace", fontSize: 12, whiteSpace: "nowrap" };
            return (
              <tr key={item.id}>
                <td style={{ ...tdBase, padding: "10px 8px" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{item.desc || "—"}</div>
                  {item._stock && <span style={{ fontSize: 10, color: T.accent2, marginTop: 2, display: "block" }}>↗ inventory</span>}
                </td>
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: T.text }}>{item.qty}</td>
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: T.text }}>{p(item.unitPrice) > 0 ? p(item.unitPrice).toFixed(2) : "—"}</td>
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: subtotal > 0 ? T.text : T.muted }}>{subtotal > 0 ? subtotal.toFixed(2) : "—"}</td>
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: discAmt > 0 ? T.red : T.muted }}>{discAmt > 0 ? `− ${discAmt.toFixed(2)}` : "—"}</td>
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: T.muted }}>{item.taxRate}%</td>
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: taxAmt > 0 ? T.accent : T.muted }}>{taxAmt > 0 ? taxAmt.toFixed(2) : "—"}</td>
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, fontSize: 13, fontWeight: 700, color: total > 0 ? T.text : T.muted }}>{total > 0 ? total.toFixed(2) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: T.surface2 }}>
            <td colSpan={3} style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: T.muted }}>Totals ({items.length} item{items.length !== 1 ? "s" : ""})</td>
            <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.text }}>{gSub > 0 ? gSub.toFixed(2) : "—"}</td>
            <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.red }}>{gDisc > 0 ? `− ${gDisc.toFixed(2)}` : "—"}</td>
            <td />
            <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.accent }}>{gTax > 0 ? gTax.toFixed(2) : "—"}</td>
            <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 800, color: T.accent }}>{gTotal > 0 ? gTotal.toFixed(2) : "—"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

/* ─── Product typeahead — search inventory or free-type a description ─────── */
const ProductInput = ({ row, stockList, setItems }) => {
  const T = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const q = (row.desc || "").toLowerCase();
  const matches = (q
    ? stockList.filter(s => (s.name || "").toLowerCase().includes(q) || (s.item_code || "").toLowerCase().includes(q))
    : stockList).slice(0, 8);
  const pick = (s) => {
    setItems(prev => prev.map(r => r.id === row.id
      ? { ...r, desc: s.name || "", stockId: s._id, unitPrice: p(s.selling_price || s.sellingPrice || 0) || r.unitPrice, _stock: true }
      : r));
    setOpen(false);
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={row.desc} placeholder="Search product or type description…"
        onChange={e => { const v = e.target.value; setItems(prev => prev.map(r => r.id === row.id ? { ...r, desc: v, _stock: false, stockId: "" } : r)); setOpen(true); }}
        onFocus={() => setOpen(true)}
        style={{ width: "100%", border: "none", background: "transparent", outline: "none", fontSize: 13, color: T.text, fontFamily: "inherit", padding: "4px 0" }} />
      {row._stock && <span style={{ fontSize: 10, color: T.accent2, display: "block" }}>↗ inventory</span>}
      {open && matches.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.18)", maxHeight: 240, overflowY: "auto", marginTop: 4 }}>
          {matches.map(s => (
            <button key={s._id} type="button" onClick={() => pick(s)}
              style={{ width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", gap: 8, color: T.text }}>
              <span style={{ fontSize: 12.5 }}>{s.name}</span>
              <span style={{ fontSize: 11, color: T.muted, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{s.item_code || ""} · {p(s.quantity || 0)} in stock</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Editable line items — direct-invoice mode (add/search products) ────── */
const EditableLineItems = ({ items, setItems, stockList }) => {
  const T = useT();
  const upd = (id, field, val) => setItems(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const remove = (id) => setItems(prev => prev.filter(r => r.id !== id));
  const addRow = () => setItems(prev => [...prev, { id: uid(), desc: "", stockId: "", qty: 1, unitPrice: "", discount: 0, discountType: "fixed", taxRate: VAT_RATE, _stock: false }]);
  const inp = { width: "100%", border: "none", background: "transparent", outline: "none", fontSize: 12, color: T.text, textAlign: "right", fontFamily: "'DM Mono', monospace", padding: "4px 0" };

  return (
    <div>
      <div style={{ borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: T.surface2 }}>
              {["Product / Description", "Qty", "Unit Price", "Disc", "Tax %", "Line Total", ""].map((h, i) => (
                <th key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, padding: "10px 8px", textAlign: (i > 0 && i < 6) ? "right" : "left", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "28px", textAlign: "center", color: T.muted, fontSize: 12 }}>No items — click “Add Item” below, then search a product or type a description.</td></tr>
            ) : items.map(row => {
              const { total } = calcLine(row);
              return (
                <tr key={row.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "8px", minWidth: 200 }}><ProductInput row={row} stockList={stockList} setItems={setItems} /></td>
                  <td style={{ padding: "8px", width: "8%" }}><input type="number" min="0" value={row.qty} onChange={e => upd(row.id, "qty", e.target.value)} style={inp} /></td>
                  <td style={{ padding: "8px", width: "13%" }}><input type="number" min="0" value={row.unitPrice} onChange={e => upd(row.id, "unitPrice", e.target.value)} style={inp} /></td>
                  <td style={{ padding: "8px", width: "10%" }}><input type="number" min="0" value={row.discount} onChange={e => upd(row.id, "discount", e.target.value)} style={inp} /></td>
                  <td style={{ padding: "8px", width: "8%" }}><input type="number" min="0" max="100" value={row.taxRate} onChange={e => upd(row.id, "taxRate", e.target.value)} style={inp} /></td>
                  <td style={{ padding: "8px", width: "12%", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: total > 0 ? T.text : T.muted }}>{total > 0 ? total.toFixed(2) : "—"}</td>
                  <td style={{ padding: "8px", width: "36px", textAlign: "right" }}><button onClick={() => remove(row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 14, lineHeight: 1 }}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button onClick={addRow}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: `1.5px dashed ${T.border}`, borderRadius: 8, background: "transparent", color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        + Add Item
      </button>
    </div>
  );
};

/* ─── Main Page ─────────────────────────────────────────────────────────── */
const CreateInvoice = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getT(isDark);
  const { handleGetCustomers, data: customersData } = useGetCustomers();

  useEffect(() => { handleGetCustomers(); }, [handleGetCustomers]);

  const [issueDate,     setIssueDate]     = useState(today());
  const [dueDate,       setDueDate]       = useState(net30());
  const [currency,      setCurrency]      = useState("AED");
  const [terms,         setTerms]         = useState("Net 30");
  const [customerId,    setCustomerId]    = useState("");
  const [custName,      setCustName]      = useState("");
  const [custAddr,      setCustAddr]      = useState("");
  const [custTrn,       setCustTrn]       = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(() => `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`);
  const [fromName,      setFromName]      = useState("");
  const [fromAddr,      setFromAddr]      = useState("");
  const [fromTrn,       setFromTrn]       = useState("");
  const [custNote,      setCustNote]      = useState("");
  const [internalNote,  setInternalNote]  = useState("");
  const [status,          setStatus]          = useState("draft");
  const [invoiceDocType,  setInvoiceDocType]  = useState("invoice"); // "invoice" | "proforma"
  const [items,           setItems]           = useState([]);
  const [expenseItems,  setExpenseItems]  = useState([]);
  const [activeTab,     setActiveTab]     = useState(0);
  const [submitting,    setSubmitting]    = useState(false);
  const [draftId,       setDraftId]       = useState(null);
  const [stockList,     setStockList]     = useState([]); // inventory items for the product picker

  // Load inventory items for the direct-invoice product picker
  useEffect(() => {
    axiosInstance.get('/api/stocks/getitem')
      .then(res => setStockList(res.data?.data || []))
      .catch(() => {});
  }, []);

  // Pre-fill form when editing an existing draft from the invoice list
  useEffect(() => {
    const draft = location.state?.editDraft;
    if (!draft) return;
    setDraftId(draft._id);
    // toRow normalises: id=invoiceNumber, date=issueDate, due=dueDate, customer=billTo.name
    if (draft.id)            setInvoiceNumber(draft.id);
    if (draft.date)          setIssueDate(draft.date.split("T")[0]);
    if (draft.due)           setDueDate(draft.due.split("T")[0]);
    if (draft.currency)      setCurrency(draft.currency);
    if (draft.paymentTerms)  setTerms(draft.paymentTerms);
    if (draft.docType)       setInvoiceDocType(draft.docType);
    if (draft.notes?.customer)  setCustNote(draft.notes.customer);
    if (draft.notes?.internal)  setInternalNote(draft.notes.internal);
    if (draft.customerId) {
      setCustomerId(draft.customerId);
      axiosInstance.get(`/api/customers/${draft.customerId}`)
        .then(res => {
          const c = res.data?.data || res.data;
          if (!c) return;
          setCustName(c.customerDisplayName || c.companyName || draft.customer || "");
          setCustAddr(fmtCustAddr(c));
          setCustTrn(c.custom_fields?.trlNumber || c.customFields?.trlNumber || "");
        })
        .catch(() => { if (draft.customer) setCustName(draft.customer); });
    } else if (draft.customer) {
      setCustName(draft.customer);
    }
    if (draft.lineItems?.length) {
      setItems(draft.lineItems.map(li => ({
        id:           uid(),
        desc:         li.description || li.desc || "",
        stockId:      li.stockId || "",
        qty:          p(li.quantity || li.qty || 1),
        unitPrice:    p(li.unitPrice || li.rate || 0),
        discount:     p(li.discount || 0),
        discountType: li.discountType || "fixed",
        taxRate:      VAT_RATE,
        _stock:       false,
      })));
    }
  }, [location.state]);

  useEffect(() => {
    const state = location.state;
    if (!state?.fromDeliveryNote || !state?.prefill?.items?.length) return;
    const { prefill } = state;

    // Prefill line items — use sellingPrice (new model field) falling back to rate
    setItems(prefill.items.map(item => ({
      id:           uid(),
      desc:         item.name || item.details || "",
      stockId:      item.itemId || item._id,
      qty:          p(item.outboundQuantity || item.quantity || 1),
      unitPrice:    p(item.sellingPrice || item.rate || item.selling_price || 0),
      discount:     p(item.discount || 0),
      discountType: "fixed",
      taxRate:      VAT_RATE,
      _stock:       true,
    })));

    // Customer note: sales order reference
    if (prefill.orderNumber) setCustNote(`Ref: Sales Order ${prefill.orderNumber}`);

    // Internal note: DN reference
    if (prefill.dnNumber) setInternalNote(`Delivery Note: ${prefill.dnNumber}`);

    // Issue date: use the delivery note date
    if (prefill.date) {
      const parsed = new Date(prefill.date);
      if (!isNaN(parsed)) setIssueDate(parsed.toISOString().split("T")[0]);
    }

    // Auto-populate expense items from linked SO's shipping + adjustment
    const soId = prefill.salesOrderIds?.[0];
    if (soId) {
      axiosInstance.get(`/api/sales-orders/${soId}`)
        .then(res => {
          const so = res.data?.data || res.data;
          if (!so) return;
          const expenses = [];
          if (so.shippingCharges > 0) {
            expenses.push({ id: uid(), desc: "Shipping Charges", qty: 1, unitPrice: so.shippingCharges, taxRate: 0 });
          }
          if (so.adjustment !== 0 && so.adjustment != null) {
            expenses.push({ id: uid(), desc: "Adjustment", qty: 1, unitPrice: so.adjustment, taxRate: 0 });
          }
          if (expenses.length > 0) setExpenseItems(expenses);
        })
        .catch(() => {});
    }
  }, [location.state]);

  // Customer: look up directly by ID — no fragile name matching
  useEffect(() => {
    const state = location.state;
    if (!state?.fromDeliveryNote) return;
    const { prefill } = state;
    const cid = prefill?.customerId;

    const applyFields = (c) => {
      setCustomerId(c._id);
      setCustName(c.customerDisplayName || c.companyName || "");
      setCustAddr(fmtCustAddr(c));
      setCustTrn(c.custom_fields?.trlNumber || c.customFields?.trlNumber || "");
      const custTerms = c.payment_terms || c.paymentTerms;
      if (custTerms) setTerms(custTerms);
    };

    if (!cid) {
      const targetName = (prefill?.customer || "").toLowerCase();
      if (!targetName || !customersData.length) return;
      const match = customersData.find(c => (c.customerDisplayName || c.companyName || "").toLowerCase() === targetName);
      if (match) applyFields(match);
      else setCustName(prefill?.customer || "");
      return;
    }
    axiosInstance.get(`/api/customers/${cid}`)
      .then(res => { const c = res.data?.data || res.data; if (c) applyFields(c); })
      .catch(() => { setCustName(prefill?.customer || ""); });
  }, [location.state, customersData]);

  const isFromDN = !!location.state?.fromDeliveryNote;

  // When creating invoice from DN: fetch first linked SO and apply its payment terms
  useEffect(() => {
    if (!isFromDN) return;
    const soIds = location.state?.prefill?.salesOrderIds || [];
    if (!soIds.length) return;
    axiosInstance.get(`/api/sales-orders/${soIds[0]}`)
      .then(res => {
        const so = res.data?.data || res.data;
        const soTerms = so?.paymentTerms || so?.payment_terms;
        if (!soTerms) return;
        const invTerms = SO_TO_INV_TERMS[soTerms] || SO_TO_INV_TERMS[soTerms?.toLowerCase().replace(/ /g,'_')] || "Net 30";
        setTerms(invTerms);
      })
      .catch(() => {});
  }, [isFromDN]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-recalc due date when terms or issue date changes (skip "Custom")
  useEffect(() => {
    const due = calcDueDate(issueDate, terms);
    if (due) setDueDate(due);
  }, [terms, issueDate]);

  const applyCustomer = (c, skipTerms = false) => {
    if (!c) return;
    setCustName(c.customerDisplayName || c.companyName || "");
    setCustAddr(fmtCustAddr(c));
    setCustTrn(c.custom_fields?.trlNumber || c.customFields?.trlNumber || "");
    if (skipTerms) return;
    const custTerms = c.payment_terms || c.paymentTerms;
    if (custTerms) {
      setTerms(custTerms);
      const customDays = parseFloat(c.no_of_days) || 0;
      const due = calcDueDate(issueDate, custTerms, customDays);
      if (due) setDueDate(due);
    }
  };

  const handleCustomerChange = async (e) => {
    const id = e.target.value;
    if (!id) { setCustomerId(""); setCustName(""); setCustAddr(""); setCustTrn(""); return; }
    setCustomerId(id);
    if (e.customer && e.customer._id) { applyCustomer(e.customer); return; }
    try { const res = await axiosInstance.get(`/api/customers/${id}`); applyCustomer(res.data?.data); } catch { /* ignore */ }
  };

  const totals = useMemo(() => {
    const base = items.reduce((acc, item) => {
      const c = calcLine(item);
      return { subtotal: acc.subtotal + c.subtotal, discountTotal: acc.discountTotal + c.discAmt, taxTotal: acc.taxTotal + c.taxAmt, grandTotal: acc.grandTotal + c.total };
    }, { subtotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 });
    const expTotals = expenseItems.reduce((acc, ei) => {
      const sub = p(ei.qty) * p(ei.unitPrice);
      const tax = sub * (p(ei.taxRate) / 100);
      return { subtotal: acc.subtotal + sub, taxTotal: acc.taxTotal + tax, grandTotal: acc.grandTotal + sub + tax };
    }, { subtotal: 0, taxTotal: 0, grandTotal: 0 });
    return {
      subtotal:      base.subtotal      + expTotals.subtotal,
      discountTotal: base.discountTotal,
      taxTotal:      base.taxTotal      + expTotals.taxTotal,
      grandTotal:    base.grandTotal    + expTotals.grandTotal,
    };
  }, [items, expenseItems]);

  const taxBreakdown = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const taxRate = p(item.taxRate);
      const subtotal = p(item.qty) * p(item.unitPrice);
      const discAmt  = item.discountType === "percentage" ? subtotal * (p(item.discount) / 100) : p(item.discount);
      map[taxRate] = (map[taxRate] || 0) + (subtotal - discAmt) * (taxRate / 100);
    });
    return Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [items]);

  const completion = useMemo(() => {
    let s = 0;
    if (issueDate)  s += 10; if (dueDate)    s += 10;
    if (customerId) s += 20; if (fromName)   s += 15;
    if (items.length > 0) s += 25;
    if (items.some(i => i.desc && p(i.unitPrice) > 0)) s += 20;
    return Math.min(s, 100);
  }, [issueDate, dueDate, customerId, fromName, items]);

  const buildPayload = (overrideStatus) => {
    const prefill = location.state?.prefill || {};
    const soIds   = prefill.salesOrderIds || [];
    const dnId    = prefill.dnId;
    const dnNumber = prefill.dnNumber || "";
    return {
      invoiceNumber, issueDate, dueDate, currency, paymentTerms: terms,
      from:      { name: fromName, address: fromAddr, trn: fromTrn },
      billTo:    { name: custName, address: custAddr, trn: custTrn },
      customerId,
      lineItems: [
        ...items.map((item) => { const { id: _, ...rest } = item; return { ...rest, ...calcLine(rest) }; }),
        ...expenseItems.map((ei) => {
          const { id: _, ...rest } = ei;
          const sub = p(rest.qty) * p(rest.unitPrice);
          const taxAmt = sub * (p(rest.taxRate) / 100);
          return { ...rest, _type: "expense", subtotal: sub, discAmt: 0, taxAmt, total: sub + taxAmt };
        }),
      ],
      totals,
      amountPaid:  0,
      balanceDue:  totals.grandTotal,
      notes:       { customer: custNote, internal: internalNote },
      status:      overrideStatus ?? status,
      type:      invoiceDocType,
      // Store links on proforma so finalize can use them
      ...(invoiceDocType === "proforma" && soIds.length > 0 && { linkedSalesOrderIds: soIds }),
      ...(invoiceDocType === "proforma" && dnId && { linkedDnId: dnId, linkedDnNumber: dnNumber }),
    };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const _prefill = location.state?.prefill || {};
    const soIds    = _prefill.salesOrderIds || [];
    const dnId     = _prefill.dnId;
    try {
      // If a draft was saved in this session, update it instead of creating a new record
      const invRes = draftId
        ? await axiosInstance.put(`/api/invoices/${draftId}`, buildPayload("unpaid"))
        : await axiosInstance.post("/api/invoices", buildPayload("unpaid"));
      const invData = invRes.data?.data || {};
      const resolvedId     = invData.id     || draftId || "";
      const resolvedNumber = invData.invoiceNumber || invoiceNumber;

      const isProforma = invoiceDocType === "proforma";
      await Promise.allSettled([
        customerId && axiosInstance.post(`/api/customers/${customerId}/history`, {
          action: isProforma ? "Proforma Created" : "Invoice Issued",
          timestamp: new Date().toISOString(),
          details: { invoiceNumber: resolvedNumber, amount: totals.grandTotal, currency, status },
        }),
        // Only link SO/DN when creating a real invoice, not a proforma
        ...(!isProforma ? soIds.map(id => axiosInstance.patch(`/api/sales-orders/${id}/status`, { status: "invoiced" })) : []),
        (!isProforma && dnId) && axiosInstance.patch(`/api/delivery-notes/${dnId}/invoice`, {
          invoiceId:     resolvedId,
          invoiceNumber: resolvedNumber,
        }),
      ].filter(Boolean));
      nexusToast.success(invoiceDocType === "proforma" ? "Proforma saved" : "Invoice issued");
      navigate("/Sales/Invoices");
    } catch (err) {
      console.error(err);
      nexusToast.error(err.response?.data?.message || "Failed to issue invoice");
    } finally { setSubmitting(false); }
  };

  const handleSaveDraft = async () => {
    setSubmitting(true);
    const _prefill = location.state?.prefill || {};
    const dnId     = _prefill.dnId;
    try {
      const res = draftId
        ? await axiosInstance.put(`/api/invoices/${draftId}`, buildPayload("draft"))
        : await axiosInstance.post("/api/invoices", buildPayload("draft"));
      const saved = res.data?.data || {};
      const resolvedId     = saved.id     || draftId || "";
      const resolvedNumber = saved.invoiceNumber || invoiceNumber;
      if (resolvedId && !draftId) setDraftId(resolvedId);
      // Link DN to this draft so it can't be invoiced again
      if (dnId && resolvedId) {
        await axiosInstance.patch(`/api/delivery-notes/${dnId}/invoice`, {
          invoiceId:     resolvedId,
          invoiceNumber: resolvedNumber,
        });
      }
      nexusToast.success("Draft saved");
      navigate("/Sales/Invoices");
    }
    catch (err) {
      console.error(err);
      nexusToast.error(err.response?.data?.message || "Failed to save draft");
    } finally { setSubmitting(false); }
  };

  const STATUS_OPTS = [
    { key: "draft",    label: "Draft",            dot: T.muted,   bg: `${T.subtle}33`,  bdr: T.subtle },
    { key: "pending",  label: "Pending Approval", dot: T.accent,  bg: `${T.accent}1a`,  bdr: `${T.accent}55` },
    { key: "approved", label: "Approved",          dot: T.accent2, bg: `${T.accent2}1a`, bdr: `${T.accent2}55` },
  ];

  return (
    <ThemeCtx.Provider value={T}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=DM+Sans:wght@400;500&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        input[type=number]::-webkit-inner-spin-button{opacity:.4}
        select option{background:${T.selectOpt};color:${T.text}}
        .ci-tab-active { border-bottom: 2px solid ${T.accent} !important; color: ${T.text} !important; }
      `}</style>

      <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans', sans-serif", transition: "background 0.25s, color 0.25s" }}>

        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: `1px solid ${T.border}`, background: T.topbar, transition: "background 0.25s, border-color 0.25s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => navigate(-1)} style={{ fontSize: 12, color: T.muted, cursor: "pointer", padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", fontFamily: "inherit" }}>← Invoices</button>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 600, color: T.text }}>
              {invoiceDocType === "proforma" ? "Create Proforma" : "Create Invoice"}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.accent, background: `${T.accent}1a`, border: `1px solid ${T.accent}44`, padding: "3px 10px", borderRadius: 4 }}>{invoiceNumber}</span>

            {/* Document type toggle */}
            <div style={{ display: "flex", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 7, overflow: "hidden" }}>
              {[["invoice", "Invoice"], ["proforma", "Proforma"]].map(([val, lbl]) => (
                <button key={val} onClick={() => {
                  setInvoiceDocType(val);
                  setInvoiceNumber(n => {
                    const base = n.replace(/^(INV|PRO)-/, "");
                    return `${val === "proforma" ? "PRO" : "INV"}-${base}`;
                  });
                }} style={{
                  padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", border: "none", transition: "all 0.15s",
                  background: invoiceDocType === val ? (val === "proforma" ? "#7c3aed" : T.accent) : "transparent",
                  color: invoiceDocType === val ? "#fff" : T.muted,
                }}>{lbl}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="ghost" onClick={() => navigate(-1)}>Discard</Btn>
            <Btn v="outline" onClick={handleSaveDraft} disabled={submitting}>Save Draft</Btn>
            <Btn v="primary" onClick={handleSubmit} disabled={submitting} style={{ opacity: submitting ? .7 : 1 }}>
              {submitting ? "Saving…" : invoiceDocType === "proforma" ? "Save Proforma →" : "Issue Invoice →"}
            </Btn>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", minHeight: "calc(100vh - 57px)" }}>

          {/* ── Main ── */}
          <div style={{ padding: 24, overflowY: "auto", borderRight: `1px solid ${T.border}` }}>

            <Section title="Invoice Details">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Field label="Invoice #"><Inp value={invoiceNumber} readOnly style={{ color: T.muted }} /></Field>
                <Field label="Issue Date"><Inp type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></Field>
                <Field label="Due Date"><Inp type="date" value={dueDate} onChange={e => { if (!isFromDN) setDueDate(e.target.value); }} readOnly={isFromDN} style={isFromDN ? { color: T.muted, cursor: "not-allowed", opacity: 0.7 } : {}} /></Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Currency">
                  <Sel value={currency} onChange={e => setCurrency(e.target.value)}>
                    {["AED — UAE Dirham","USD — US Dollar","EUR — Euro","GBP — British Pound","SAR — Saudi Riyal"].map(c => <option key={c}>{c}</option>)}
                  </Sel>
                </Field>
                <Field label="Payment Terms">
                  <Sel value={terms} onChange={e => { if (!isFromDN) setTerms(e.target.value); }} disabled={isFromDN} style={isFromDN ? { opacity: 0.7, cursor: "not-allowed" } : {}}>
                    {["Due on Receipt","Net 7","Net 15","Net 30","Net 45","Net 60","Net 90","50% Advance","100% Advance","Custom"].map(t => <option key={t}>{t}</option>)}
                  </Sel>
                </Field>
              </div>
            </Section>

            <Section title="Parties">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* From */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>From (Your Company)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Field label="Company Name"><Inp placeholder="Nexus Technologies LLC" value={fromName} onChange={e => setFromName(e.target.value)} /></Field>
                    <Field label="Address"><Tex placeholder={"123 Sheikh Zayed Rd\nDubai, UAE"} value={fromAddr} onChange={e => setFromAddr(e.target.value)} /></Field>
                    <Field label="TRN / VAT Number"><Inp placeholder="100123456789012" value={fromTrn} onChange={e => setFromTrn(e.target.value)} /></Field>
                  </div>
                </div>
                {/* Bill To */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Bill To (Customer)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Field label="Customer">
                      <CustomerSelect
                        name="customerId"
                        value={customerId}
                        onChange={handleCustomerChange}
                        disabled={isFromDN}
                        options={[
                          { value: "", label: "— Select customer —", customer: null },
                          ...customersData.map(c => ({ value: c._id, label: c.customerDisplayName || c.companyName, customer: c })),
                        ]}
                      />
                    </Field>
                    <Field label="Address"><Tex placeholder="Customer billing address" value={custAddr} onChange={e => setCustAddr(e.target.value)} /></Field>
                    <Field label="TRN / VAT Number"><Inp placeholder="Optional" value={custTrn} onChange={e => setCustTrn(e.target.value)} /></Field>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Line Items">
              <div style={{ display: "flex", gap: 0, background: T.surface2, borderRadius: 7, padding: 3, marginBottom: 16, border: `1px solid ${T.border}` }}>
                {["Products & Services", "Expense Items"].map((tab, i) => (
                  <div key={tab} onClick={() => setActiveTab(i)}
                    style={{ flex: 1, textAlign: "center", padding: "6px", borderRadius: 5, fontSize: 12, cursor: "pointer", transition: ".15s", background: activeTab === i ? T.surface : "transparent", color: activeTab === i ? T.text : T.muted, fontWeight: activeTab === i ? 600 : 400, borderBottom: activeTab === i ? `2px solid ${T.accent}` : "2px solid transparent" }}>
                    {tab}{i === 1 && expenseItems.length > 0 && <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: T.accent, color: "#fff" }}>{expenseItems.length}</span>}
                  </div>
                ))}
              </div>

              {activeTab === 0 && (
                isFromDN ? (
                  // From a delivery note → items are fixed (read-only).
                  items.length === 0 ? (
                    <div style={{ border: `2px dashed ${T.border}`, borderRadius: 10, padding: "44px 24px", textAlign: "center" }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>No line items</div>
                      <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>Items will be populated from the delivery note.</div>
                    </div>
                  ) : (
                    <LineItems items={items} />
                  )
                ) : (
                  // Direct invoice → add/search products and edit lines.
                  <EditableLineItems items={items} setItems={setItems} stockList={stockList} />
                )
              )}

              {activeTab === 1 && (
                <div>
                  <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}`, marginBottom: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: T.surface2 }}>
                          {["Description", "Qty", "Unit Price", "Tax %", "Line Total", ""].map((h, i) => (
                            <th key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, padding: "10px 8px", textAlign: i > 0 ? "right" : "left", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {expenseItems.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: "28px", textAlign: "center", color: T.muted, fontSize: 12 }}>No expense items — click Add below</td></tr>
                        ) : expenseItems.map((ei, idx) => {
                          const sub = p(ei.qty) * p(ei.unitPrice);
                          const tax = sub * (p(ei.taxRate) / 100);
                          const lineTotal = sub + tax;
                          const upd = (field, val) => setExpenseItems(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
                          const inpStyle = { width: "100%", border: "none", background: "transparent", outline: "none", fontSize: 12, color: T.text, textAlign: "right", fontFamily: "'DM Mono', monospace", padding: "4px 0" };
                          return (
                            <tr key={ei.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td style={{ padding: "8px" }}>
                                <input value={ei.desc} onChange={e => upd("desc", e.target.value)} placeholder="e.g. Shipping charges"
                                  style={{ ...inpStyle, textAlign: "left", fontFamily: "inherit", fontSize: 13, width: "100%" }} />
                              </td>
                              <td style={{ padding: "8px", width: "8%" }}>
                                <input type="number" min="0" value={ei.qty} onChange={e => upd("qty", e.target.value)} style={inpStyle} />
                              </td>
                              <td style={{ padding: "8px", width: "13%" }}>
                                <input type="number" min="0" value={ei.unitPrice} onChange={e => upd("unitPrice", e.target.value)} style={inpStyle} />
                              </td>
                              <td style={{ padding: "8px", width: "8%" }}>
                                <input type="number" min="0" max="100" value={ei.taxRate} onChange={e => upd("taxRate", e.target.value)} style={inpStyle} />
                              </td>
                              <td style={{ padding: "8px", width: "12%", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: T.text }}>
                                {lineTotal > 0 ? lineTotal.toFixed(2) : "—"}
                              </td>
                              <td style={{ padding: "8px", width: "40px", textAlign: "right" }}>
                                <button onClick={() => setExpenseItems(prev => prev.filter((_, i) => i !== idx))}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 14, lineHeight: 1 }}>✕</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={() => setExpenseItems(prev => [...prev, { id: Date.now(), desc: "", qty: 1, unitPrice: "", taxRate: 5 }])}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: `1.5px dashed ${T.border}`, borderRadius: 8, background: "transparent", color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    + Add Expense Item
                  </button>
                </div>
              )}
            </Section>

            <Section title="Notes & Attachments">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Customer Note (visible on invoice)"><Tex placeholder="Thank you for your business!" value={custNote} onChange={e => setCustNote(e.target.value)} /></Field>
                <Field label="Internal Memo (not shown to customer)"><Tex placeholder="Internal reference or approval notes…" value={internalNote} onChange={e => setInternalNote(e.target.value)} /></Field>
              </div>
            </Section>
          </div>

          {/* ── Sidebar ── */}
          <div style={{ padding: 24, background: T.surface, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", transition: "background 0.25s" }}>

            {/* Status */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Status</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {STATUS_OPTS.map(s => (
                  <div key={s.key} onClick={() => setStatus(s.key)}
                    style={{ padding: "9px 14px", borderRadius: 7, fontSize: 13, cursor: "pointer", transition: ".15s", background: status === s.key ? s.bg : "transparent", border: `1px solid ${status === s.key ? s.bdr : "transparent"}`, color: status === s.key ? T.text : T.muted }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: s.dot, marginRight: 8 }} />{s.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Completion */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Completion</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Form progress</span>
                <span style={{ fontSize: 11, color: completion === 100 ? T.accent2 : T.muted }}>{completion}%</span>
              </div>
              <div style={{ height: 5, background: T.surface2, borderRadius: 4, overflow: "hidden", border: `1px solid ${T.border}` }}>
                <div style={{ height: "100%", width: `${completion}%`, background: `linear-gradient(90deg,${T.accent},${T.accent2})`, borderRadius: 4, transition: "width .4s" }} />
              </div>
            </div>

            {/* Tax Breakdown */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Tax Breakdown</div>
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 6px" }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Subtotal (excl. VAT)</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: T.text }}>{fmtMoney(totals.subtotal)}</span>
                </div>
                {totals.discountTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0 10px", borderBottom: `1px solid ${T.border}`, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: T.red }}>Discount</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: T.red }}>− {fmtMoney(totals.discountTotal)}</span>
                  </div>
                )}
                {totals.discountTotal === 0 && <div style={{ borderBottom: `1px solid ${T.border}`, marginBottom: 8 }} />}
                {taxBreakdown.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.muted, padding: "4px 0" }}>No items added yet</div>
                ) : taxBreakdown.map(([rate, amt]) => (
                  <div key={rate} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ fontSize: 12, color: T.muted }}>VAT @ {rate}%</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.accent }}>{fmtMoney(amt)}</span>
                  </div>
                ))}
                {taxBreakdown.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 0", marginTop: 4, borderTop: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 12, color: T.muted }}>Total VAT</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.accent }}>{fmtMoney(totals.taxTotal)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: `2px solid ${T.border}` }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Total Due</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color: T.accent }}>{fmtMoney(totals.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Items count */}
            {items.length > 0 && (
              <div style={{ background: `${T.accent2}12`, border: `1px solid ${T.accent2}33`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: T.accent2 }}>Line items</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, fontWeight: 700, color: T.accent2 }}>{items.length}</span>
              </div>
            )}

            {/* Quick actions */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Quick Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {["Preview Invoice PDF","Attach Documents","Link to Purchase Order","Send via Email"].map(a => (
                  <Btn key={a} v="ghost" style={{ width: "100%", textAlign: "left", fontSize: 12 }}>{a}</Btn>
                ))}
              </div>
            </div>

            <div style={{ background: `${T.accent}0d`, border: `1px solid ${T.accent}26`, borderRadius: 8, padding: 12, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
              <span style={{ color: T.accent, fontWeight: 600 }}>Tip: </span>
              Selecting from inventory will merge duplicates — adding the same product twice increments the quantity. Tax rate is editable per line.
            </div>
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
};

export default CreateInvoice;
