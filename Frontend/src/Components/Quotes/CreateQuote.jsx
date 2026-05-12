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

const ThemeCtx = createContext(getT(true));
const useT = () => useContext(ThemeCtx);

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
const CustomerSelect = ({ value, onChange, options, name }) => {
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
        background: T.input, border: `1px solid ${T.border}`, borderRadius: 7,
        padding: "8px 12px", cursor: "pointer", fontSize: 13, color: selected ? T.text : T.muted,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>{selected?.label || "Select customer…"}</span>
        <span style={{ color: T.muted, fontSize: 10 }}>▾</span>
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

/* ─── Line Item Row ─────────────────────────────────────────────────────── */
const LineRow = ({ item, onChange, onRemove, isOnly }) => {
  const T = useT();
  const set = (k, v) => onChange({ ...item, [k]: v });
  const { subtotal, discAmt, taxAmt, total } = calcLine(item);

  return (
    <tr>
      <td style={{ padding: "6px 4px" }}>
        <Inp value={item.desc} onChange={e => set("desc", e.target.value)} placeholder="Description" />
      </td>
      <td style={{ padding: "6px 4px", width: 72 }}>
        <Inp type="number" min="1" value={item.qty} onChange={e => set("qty", e.target.value)} style={{ textAlign: "right" }} />
      </td>
      <td style={{ padding: "6px 4px", width: 110 }}>
        <Inp type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => set("unitPrice", e.target.value)} style={{ textAlign: "right" }} />
      </td>
      <td style={{ padding: "6px 4px", width: 110 }}>
        <div style={{ display: "flex", gap: 3 }}>
          <Inp type="number" min="0" value={item.discount} onChange={e => set("discount", e.target.value)} style={{ textAlign: "right" }} />
          <Sel value={item.discountType} onChange={e => set("discountType", e.target.value)} style={{ width: 50, padding: "8px 4px" }}>
            <option value="percentage">%</option>
            <option value="fixed">AED</option>
          </Sel>
        </div>
      </td>
      <td style={{ padding: "6px 4px", width: 72 }}>
        <Inp type="number" min="0" max="100" value={item.taxRate} onChange={e => set("taxRate", e.target.value)} style={{ textAlign: "right" }} />
      </td>
      <td style={{ padding: "6px 4px", width: 110, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 13, color: T.text, whiteSpace: "nowrap" }}>
        {fmtMoney(total)}
      </td>
      <td style={{ padding: "6px 4px", width: 28, textAlign: "center" }}>
        <button onClick={onRemove} disabled={isOnly} style={{ background: "none", border: "none", cursor: isOnly ? "not-allowed" : "pointer", color: isOnly ? T.subtle : T.red, fontSize: 14, lineHeight: 1 }}>×</button>
      </td>
    </tr>
  );
};

/* ─── Main Component ────────────────────────────────────────────────────── */
const EMPTY_ITEM = () => ({ _uid: uid(), desc: "", qty: 1, unitPrice: 0, discount: 0, discountType: "percentage", taxRate: 5 });

export default function CreateQuote() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useThemeStore(s => s.isDark);
  const T         = getT(isDark);

  const { customers: rawCustomers } = useGetCustomers({ page: 1, limit: 200 });
  const customerOpts = (rawCustomers || []).map(c => ({
    value: c._id,
    label: c.customerDisplayName || c.companyName || `${c.firstName} ${c.lastName}`.trim(),
    customer: c,
  }));

  // Pre-fill from edit/clone state
  const prefill = location.state?.edit || location.state?.clone || null;
  const isEdit  = !!location.state?.edit;

  const [customerId,    setCustomerId]    = useState(prefill?.customerId || "");
  const [customerName,  setCustomerName]  = useState(prefill?.customerName || "");
  const [customerEmail, setCustomerEmail] = useState(prefill?.customerEmail || "");
  const [billTo,        setBillTo]        = useState(prefill?.billTo || { name: "", address: "", trn: "" });
  const [quoteDate,     setQuoteDate]     = useState(today());
  const [validUntil,    setValidUntil]    = useState(net30());
  const [currency,      setCurrency]      = useState(prefill?.currency || "AED");
  const [paymentTerms,  setPaymentTerms]  = useState(prefill?.paymentTerms || "Net 30");
  const [lineItems,     setLineItems]     = useState(
    prefill?.lineItems?.length
      ? prefill.lineItems.map(li => ({ ...li, _uid: uid(), discountType: li.discountType || "percentage" }))
      : [EMPTY_ITEM()]
  );
  const [custNote,    setCustNote]    = useState(prefill?.notes?.customer || "");
  const [internalNote,setInternalNote]= useState(prefill?.notes?.internal || "");
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
        lineItems: lineItems.map((li, i) => {
          const { subtotal, discAmt, taxAmt, total } = computed[i];
          return { desc: li.desc, qty: p(li.qty), unitPrice: p(li.unitPrice), discount: p(li.discount), taxRate: p(li.taxRate), subtotal, discAmt, taxAmt, total };
        }),
        totals: { subtotal: subtotalSum, discountTotal: discountSum, taxTotal: taxSum, grandTotal },
        notes: { customer: custNote, internal: internalNote },
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

          {/* Customer + Dates */}
          <Section title="Quote Details">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Customer *">
                <CustomerSelect value={customerId} onChange={handleCustomer} options={customerOpts} name="customerId" />
              </Field>
              <Field label="Customer Email">
                <Inp value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@example.com" type="email" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
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
                  {["Due on Receipt","Net 15","Net 30","Net 60","End of Month"].map(t => <option key={t}>{t}</option>)}
                </Sel>
              </Field>
            </div>
          </Section>

          {/* Bill To */}
          <Section title="Bill To">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <Field label="Name">
                <Inp value={billTo.name} onChange={e => setBillTo(b => ({ ...b, name: e.target.value }))} placeholder="Company / Contact name" />
              </Field>
              <Field label="TRN">
                <Inp value={billTo.trn} onChange={e => setBillTo(b => ({ ...b, trn: e.target.value }))} placeholder="Tax Registration Number" />
              </Field>
              <Field label="Address">
                <Tex value={billTo.address} onChange={e => setBillTo(b => ({ ...b, address: e.target.value }))} rows={2} style={{ minHeight: 0 }} />
              </Field>
            </div>
          </Section>

          {/* Line Items */}
          <Section title="Line Items">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Description", "Qty", "Unit Price", "Discount", "Tax %", "Total", ""].map((h, i) => (
                      <th key={i} style={{ padding: "0 4px 10px", textAlign: i >= 5 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
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
              <Field label="Customer Notes">
                <Tex value={custNote} onChange={e => setCustNote(e.target.value)} placeholder="Visible on the quote…" />
              </Field>
              <Field label="Internal Notes">
                <Tex value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Internal only…" />
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
    </ThemeCtx.Provider>
  );
}
