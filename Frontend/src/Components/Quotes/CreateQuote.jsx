import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import useGetCustomers from "../../helper/useGetCustomers";
import axiosInstance from "../../helper/axiosInstance";
import useThemeStore from "../../store/useThemeStore";
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
  const l2 = [c.city, c.postalCode, c.country].filter(Boolean).join(", ");
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
const Sel = ({ style, children, ...r }) => {
  const T = useT();
  return <select style={{ background: T.input, border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit", fontSize: 13, padding: "8px 12px", borderRadius: 7, outline: "none", width: "100%", cursor: "pointer", ...style }} {...r}>{children}</select>;
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
    ? stocks.filter(s => s.name?.toLowerCase().includes(q.toLowerCase()) || s.sku?.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
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
        <Sel value={item.unit} onChange={e => set("unit", e.target.value)}>
          {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
        </Sel>
      </td>
      <td style={{ padding: "6px 4px", width: 100 }}>
        <Inp type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => set("unitPrice", e.target.value)} style={{ textAlign: "right" }} />
      </td>
      <td style={{ padding: "6px 4px", width: 100 }}>
        <div style={{ display: "flex", gap: 3 }}>
          <Inp type="number" min="0" value={item.discount} onChange={e => set("discount", e.target.value)} style={{ textAlign: "right" }} />
          <Sel value={item.discountType} onChange={e => set("discountType", e.target.value)} style={{ width: 50, padding: "8px 4px" }}>
            <option value="percentage">%</option>
            <option value="fixed">AED</option>
          </Sel>
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

/* ─── Main Component ────────────────────────────────────────────────────── */
const EMPTY_ITEM = () => ({ _uid: uid(), partNumber: "", desc: "", qty: 1, unit: "Nos", unitPrice: 0, discount: 0, discountType: "percentage", taxRate: 5 });

const UNIT_OPTIONS = ["Nos", "Pcs", "Set", "Kg", "Ltr", "Mtr", "Sqm", "Box", "Roll", "Lot", "Job", "Month", "Hr"];

export default function CreateQuote() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useThemeStore(s => s.isDark);
  const T         = getT(isDark);

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
  const [billTo,        setBillTo]        = useState(prefill?.billTo || {
    name: fromEnquiry?.customerName || "",
    address: fromEnquiry?.company ? `${fromEnquiry.company}` : "",
    trn: "",
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
  const [attentionTo,  setAttentionTo]  = useState(prefill?.attentionTo  || "");
  const [subject,      setSubject]      = useState(prefill?.subject      || fromEnquiry?.subject || "");
  const [projectName,  setProjectName]  = useState(prefill?.projectName  || "");
  const [introText,    setIntroText]    = useState(prefill?.introText    || "");

  // Sender company details
  const [company, setCompany] = useState(prefill?.company || {
    name: "", address: "", trn: "", phone: "", email: "", website: "",
  });
  const [signatory, setSignatory] = useState(prefill?.signatory || { name: "", title: "" });

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
    setBillTo({ name: cust.customerDisplayName || cust.companyName || "", address: fmtCustAddr(cust), trn: cust.trn || "" });
  };

  const updateItem = (uid, updated) => setLineItems(prev => prev.map(li => li._uid === uid ? { ...li, ...updated } : li));
  const removeItem = (uid) => setLineItems(prev => prev.filter(li => li._uid !== uid));
  const addItem    = () => setLineItems(prev => [...prev, EMPTY_ITEM()]);

  async function submit(status) {
    if (!customerId) { nexusToast.error("Please select a customer"); return; }
    setSaving(true);
    try {
      const payload = {
        status,
        customerId, customerName, customerEmail,
        billTo,
        quoteDate, validUntil, currency, paymentTerms,
        attentionTo, subject, projectName, introText,
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
      };

      if (isEdit && prefill?._id) {
        await axiosInstance.put(`/api/quotes/${prefill._id}`, payload);
        nexusToast.success("Quote updated");
      } else {
        await axiosInstance.post("/api/quotes/", payload);
        nexusToast.success(status === "draft" ? "Quote saved as draft" : "Quote created");
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
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.13)"}; border-radius: 999px; }
  `;

  return (
    <ThemeCtx.Provider value={T}>
    <StockCtx.Provider value={catalogItems}>
      <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: T.text }}>
        <style>{css}</style>

        {/* Top bar */}
        <div style={{ background: T.topbar, borderBottom: `1px solid ${T.border}`, padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => navigate("/Sales/Quotes")} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}>←</button>
            <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 16, fontWeight: 700, color: T.text }}>
              {isEdit ? "Edit Quote" : "New Quote"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="ghost" onClick={() => navigate("/Sales/Quotes")} disabled={saving}>Cancel</Btn>
            <Btn v="outline" onClick={() => submit("draft")} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</Btn>
            <Btn v="primary" onClick={() => submit("sent")} disabled={saving}>{saving ? "Saving…" : "Create & Send"}</Btn>
          </div>
        </div>

        <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>

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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "4px 16px",
                      fontSize: 12, color: T.text }}>
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
                );
              })()}
            </div>
          )}

          {/* Customer + Dates */}
          <Section title="Quote Details">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Customer *">
                <CustomerSelect value={customerId} onChange={handleCustomer} options={customerOpts} name="customerId" disabled={!!fromEnquiry} />
              </Field>
              <Field label="Customer Email">
                <Inp value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@example.com" type="email" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 16 }}>
              <Field label="Quote Date">
                <Inp type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
              </Field>
              <Field label="Valid Until">
                <Inp type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </Field>
              <Field label="Currency">
                <Sel value={currency} onChange={e => setCurrency(e.target.value)}>
                  {["AED","USD","EUR","GBP","SAR","INR"].map(c => <option key={c}>{c}</option>)}
                </Sel>
              </Field>
              <Field label="Payment Terms">
                <Sel value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                  {["Due on Receipt","Net 15","Net 30","Net 60","End of Month","30 Days PDC"].map(t => <option key={t}>{t}</option>)}
                </Sel>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <Field label="Attention To (Contact Person)">
                <Inp value={attentionTo} onChange={e => setAttentionTo(e.target.value)} placeholder="e.g. Mr. John Smith - Procurement" />
              </Field>
              <Field label="Subject">
                <Inp value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Offer for supply of…" />
              </Field>
              <Field label="Project Name">
                <Inp value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Nashama School" />
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <Field label="Name / Company">
                <Inp value={billTo.name} onChange={e => setBillTo(b => ({ ...b, name: e.target.value }))} placeholder="Company / Contact name" />
              </Field>
              <Field label="TRN">
                <Inp value={billTo.trn} onChange={e => setBillTo(b => ({ ...b, trn: e.target.value }))} placeholder="Tax Registration Number" />
              </Field>
              <Field label="Address (Street, City, P.O. Box, Country)">
                <Tex value={billTo.address} onChange={e => setBillTo(b => ({ ...b, address: e.target.value }))} rows={2} style={{ minHeight: 0 }} placeholder={"e.g.\nP.O. Box: 37579\nDubai, U.A.E"} />
              </Field>
            </div>
          </Section>

          {/* Line Items */}
          <Section title="Line Items">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
            <button onClick={addItem} style={{ marginTop: 12, background: "none", border: `1px dashed ${T.border}`, borderRadius: 7, padding: "7px 16px", color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: ".15s" }}>
              + Add Line
            </button>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <div style={{ width: 280 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Company Name">
                <Inp value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} placeholder="Allied Building Materials L.L.C" />
              </Field>
              <Field label="TRN">
                <Inp value={company.trn} onChange={e => setCompany(c => ({ ...c, trn: e.target.value }))} placeholder="Tax Registration Number" />
              </Field>
              <Field label="Address">
                <Tex value={company.address} onChange={e => setCompany(c => ({ ...c, address: e.target.value }))} rows={2} style={{ minHeight: 0 }} placeholder="P.O. Box 8261, Abu Dhabi, UAE" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
            <Btn v="ghost" onClick={() => navigate("/Sales/Quotes")} disabled={saving}>Cancel</Btn>
            <Btn v="outline" onClick={() => submit("draft")} disabled={saving}>{saving ? "Saving…" : "Save Draft"}</Btn>
            <Btn v="primary" onClick={() => submit("sent")} disabled={saving}>{saving ? "Saving…" : "Create & Send"}</Btn>
          </div>
        </div>
      </div>
    </StockCtx.Provider>
    </ThemeCtx.Provider>
  );
}
