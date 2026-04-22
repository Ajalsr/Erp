import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import useGetCustomers from "../../helper/useGetCustomers";
import axiosInstance from "../../helper/axiosInstance";

/* ─── Theme ─────────────────────────────────────────────────────────────── */
const T = {
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
};


const VAT_RATE  = 5; // UAE default VAT %

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const today = () => new Date().toISOString().split("T")[0];
const net30  = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; };
const p      = (v)  => parseFloat(v) || 0;
let _id = 0;
const uid = () => ++_id;

/** Calculate one line: subtotal (ex-tax), discAmt, taxAmt, total (inc-tax). */
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
const base = {
  background: T.input, border: `1px solid ${T.border}`, color: T.text,
  fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: "8px 12px",
  borderRadius: 7, outline: "none", width: "100%", transition: "border-color .15s",
};

const useFF = () => ({
  onFocus: (e) => { e.target.style.borderColor = "rgba(245,158,11,.55)"; e.target.style.boxShadow = "0 0 0 3px rgba(245,158,11,.08)"; },
  onBlur:  (e) => { e.target.style.borderColor = T.border;               e.target.style.boxShadow = "none"; },
});

const Inp = ({ style, ...r }) => { const f = useFF(); return <input  style={{ ...base, ...style }} {...f} {...r} />; };
const Sel = ({ style, children, ...r }) => <select style={{ ...base, cursor: "pointer", ...style }} {...r}>{children}</select>;
const Tex = ({ style, ...r }) => { const f = useFF(); return <textarea style={{ ...base, resize: "vertical", minHeight: 70, lineHeight: 1.5, ...style }} {...f} {...r} />; };

const Field = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", color: T.muted, textTransform: "uppercase" }}>{label}</label>
    {children}
  </div>
);

const Section = ({ title, children }) => (
  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.accent, fontFamily: "'Sora', sans-serif" }}>
      {title}<span style={{ flex: 1, height: 1, background: T.border }} />
    </div>
    {children}
  </div>
);

const Btn = ({ v = "ghost", style, children, ...r }) => {
  const map = {
    ghost:   { background: "transparent", color: T.muted,   border: `1px solid ${T.border}` },
    outline: { background: "transparent", color: T.accent,  border: "1px solid rgba(245,158,11,.4)" },
    primary: { background: T.accent,      color: "#0a0e1a", border: "none", fontWeight: 700 },
    success: { background: T.accent2,     color: "#0a0e1a", border: "none", fontWeight: 700 },
    danger:  { background: "transparent", color: T.red,     border: "1px solid rgba(239,68,68,.3)" },
  };
  return <button style={{ padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: ".15s", ...map[v], ...style }} {...r}>{children}</button>;
};

/* ─── Customer Select ───────────────────────────────────────────────────── */
const CustomerSelect = ({ value, onChange, options, name }) => {
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
      boxShadow: '0 16px 48px rgba(0,0,0,0.55)', overflow: 'hidden',
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
              background: isAct ? 'rgba(245,158,11,.12)' : 'transparent', transition: 'background 0.1s',
              fontFamily: "'DM Sans', sans-serif",
            }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
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
        border: `1.5px solid ${open ? 'rgba(245,158,11,.55)' : T.border}`,
        borderRadius: 7, background: T.input, cursor: 'pointer', userSelect: 'none',
        boxShadow: open ? '0 0 0 3px rgba(245,158,11,.08)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <span style={{
          fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: display ? 500 : 400,
          color: display ? T.text : T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
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

  /* grand totals */
  const { subtotal: gSub, discAmt: gDisc, taxAmt: gTax, total: gRawTotal } = useMemo(() =>
    items.reduce((acc, item) => {
      const c = calcLine(item);
      return { subtotal: acc.subtotal + c.subtotal, discAmt: acc.discAmt + c.discAmt, taxAmt: acc.taxAmt + c.taxAmt, total: acc.total + c.total };
    }, { subtotal: 0, discAmt: 0, taxAmt: 0, total: 0 }),
    [items]
  );
  const gTotal = gRawTotal - gDisc;

  const COLS = [
    { h: "Description",    w: "30%", align: "left"   },
    { h: "Qty",            w: "7%",  align: "right"  },
    { h: "Unit Price",     w: "13%", align: "right"  },
    { h: "Subtotal",       w: "11%", align: "right"  },
    { h: "Discount",       w: "11%", align: "right"  },
    { h: "Tax %",          w: "7%",  align: "right"  },
    { h: "Tax Amt",        w: "10%", align: "right"  },
    { h: "Line Total",     w: "11%", align: "right"  },
  ];

  const tdBase = { verticalAlign: "middle", borderBottom: `1px solid rgba(30,45,71,.4)` };

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
                {/* Description */}
                <td style={{ ...tdBase, padding: "10px 8px" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{item.desc || "—"}</div>
                  {item._stock && <span style={{ fontSize: 10, color: T.accent2, marginTop: 2, display: "block" }}>↗ inventory</span>}
                </td>
                {/* Qty */}
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: T.text }}>
                  {item.qty}
                </td>
                {/* Unit Price */}
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: T.text }}>
                  {p(item.unitPrice) > 0 ? p(item.unitPrice).toFixed(2) : "—"}
                </td>
                {/* Subtotal */}
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: subtotal > 0 ? T.text : T.muted }}>
                  {subtotal > 0 ? subtotal.toFixed(2) : "—"}
                </td>
                {/* Discount */}
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: discAmt > 0 ? T.red : T.muted }}>
                  {discAmt > 0 ? `− ${discAmt.toFixed(2)}` : "—"}
                </td>
                {/* Tax % */}
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: T.muted }}>
                  {item.taxRate}%
                </td>
                {/* Tax Amt */}
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, color: taxAmt > 0 ? T.accent : T.muted }}>
                  {taxAmt > 0 ? taxAmt.toFixed(2) : "—"}
                </td>
                {/* Line Total */}
                <td style={{ ...tdBase, padding: "10px 8px", textAlign: "right", ...mono, fontSize: 13, fontWeight: 700, color: total > 0 ? T.text : T.muted }}>
                  {total > 0 ? total.toFixed(2) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        {/* Totals footer row */}
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

/* ─── Main Page ─────────────────────────────────────────────────────────── */
const CreateInvoice = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { handleGetCustomers, data: customersData } = useGetCustomers();

  useEffect(() => { handleGetCustomers(); }, [handleGetCustomers]);

  /* form state */
  const [issueDate,    setIssueDate]    = useState(today());
  const [dueDate,      setDueDate]      = useState(net30());
  const [currency,     setCurrency]     = useState("AED");
  const [terms,        setTerms]        = useState("Net 30");
  const [customerId,   setCustomerId]   = useState("");
  const [custName,     setCustName]     = useState("");
  const [custAddr,     setCustAddr]     = useState("");
  const [custTrn,      setCustTrn]      = useState("");
  const [invoiceNumber] = useState(() => `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`);
  const [fromName,     setFromName]     = useState("");
  const [fromAddr,     setFromAddr]     = useState("");
  const [fromTrn,      setFromTrn]      = useState("");
  const [custNote,     setCustNote]     = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [status,       setStatus]       = useState("draft");
  const [items,        setItems]        = useState([]);
  const [activeTab,    setActiveTab]    = useState(0);
  const [submitting,   setSubmitting]   = useState(false);

  /* pre-populate from outbound / delivery note */
  useEffect(() => {
    const state = location.state;
    if (!state?.fromDeliveryNote || !state?.prefill?.items?.length) return;

    const { prefill, outboundData, deliveryNote: dn } = state;
    const custInfo = outboundData?.customerInfo || {};

    /* line items */
    setItems(prefill.items.map(item => ({
      id:           uid(),
      desc:         item.name || item.details || "",
      stockId:      item.itemId || item._id,
      qty:          p(item.outboundQuantity || item.quantity || 1),
      unitPrice:    p(item.rate || item.selling_price || 0),
      // Use pre-computed AED discount; invoice always works in fixed AED amounts
      discount:     p(item.discount || 0),
      discountType: "fixed",
      taxRate:      VAT_RATE,
      _stock:       true,
    })));

    /* notes & references */
    const orderRef = prefill.orderNumber || custInfo.orderNumber || "";
    if (orderRef) setCustNote(`Ref: Sales Order ${orderRef}`);
    const parts = [];
    if (prefill.dnNumber) parts.push(`Delivery Note: ${prefill.dnNumber}`);
    if (outboundData?.note) parts.push(outboundData.note);
    if (parts.length) setInternalNote(parts.join(" · "));

    /* issue date from delivery note date if available */
    if (dn?.date) {
      const parsed = new Date(dn.date);
      if (!isNaN(parsed)) setIssueDate(parsed.toISOString().split("T")[0]);
    }
  }, [location.state]);

  /* match customer from delivery note once API data is loaded */
  useEffect(() => {
    if (!location.state?.fromDeliveryNote || !customersData.length) return;
    const { prefill, outboundData } = location.state;
    const targetName = (prefill?.customer || outboundData?.customerInfo?.name || "").toLowerCase();
    if (!targetName) return;
    const match = customersData.find(c =>
      (c.customerDisplayName || c.companyName || "").toLowerCase() === targetName
    );
    if (match) {
      setCustomerId(match._id);
      setCustName(match.customerDisplayName || match.companyName || "");
      setCustAddr(fmtCustAddr(match));
      setCustTrn(match.custom_fields?.trlNumber || "");
    } else {
      setCustName(prefill?.customer || outboundData?.customerInfo?.name || "");
      setCustAddr(prev => prev || (prefill?.customer || outboundData?.customerInfo?.name || ""));
    }
  }, [customersData, location.state]);

  const applyCustomer = (c) => {
    if (!c) return;
    setCustName(c.customerDisplayName || c.companyName || "");
    setCustAddr(fmtCustAddr(c));
    setCustTrn(c.custom_fields?.trlNumber || c.customFields?.trlNumber || "");
  };

  const handleCustomerChange = async (e) => {
    const id = e.target.value;
    if (!id) { setCustomerId(""); setCustName(""); setCustAddr(""); setCustTrn(""); return; }
    setCustomerId(id);

    // First try the pre-attached object (fastest)
    if (e.customer && e.customer._id) {
      applyCustomer(e.customer);
      return;
    }

    // Fallback: always fetch directly from API to guarantee full field set
    try {
      const res = await axiosInstance.get(`/api/customers/${id}`);
      applyCustomer(res.data?.data);
    } catch {
      // ignore — user can type address manually
    }
  };


  /* totals */
  const totals = useMemo(() => {
    return items.reduce((acc, item) => {
      const c = calcLine(item);
      return {
        subtotal:      acc.subtotal      + c.subtotal,
        discountTotal: acc.discountTotal + c.discAmt,
        taxTotal:      acc.taxTotal      + c.taxAmt,
        grandTotal:    acc.grandTotal    + c.total,   // total already has discount & tax applied
      };
    }, { subtotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 });
  }, [items]);

  /* per-rate breakdown for sidebar */
  const taxBreakdown = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const taxRate = p(item.taxRate);
      const subtotal = p(item.qty) * p(item.unitPrice);
      const discAmt  = item.discountType === "percentage"
        ? subtotal * (p(item.discount) / 100)
        : p(item.discount);
      const taxableBase = subtotal - discAmt;
      map[taxRate] = (map[taxRate] || 0) + taxableBase * (taxRate / 100);
    });
    return Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [items]);

  /* completion */
  const completion = useMemo(() => {
    let s = 0;
    if (issueDate)  s += 10; if (dueDate)    s += 10;
    if (customerId) s += 20; if (fromName)   s += 15;
    if (items.length > 0) s += 25;
    if (items.some(i => i.desc && p(i.unitPrice) > 0)) s += 20;
    return Math.min(s, 100);
  }, [issueDate, dueDate, customerId, fromName, items]);

  /* submit */
  const handleSubmit = async () => {
    setSubmitting(true);
    const payload = {
      invoiceNumber,
      issueDate, dueDate, currency, paymentTerms: terms,
      from:       { name: fromName, address: fromAddr, trn: fromTrn },
      billTo:     { name: custName, address: custAddr, trn: custTrn },
      customerId,
      lineItems:  items.map((item) => { const { id: _UNUSED, ...rest } = item; return { ...rest, ...calcLine(rest) }; }),
      totals,
      notes:      { customer: custNote, internal: internalNote },
      status,
    };
    const orderId = location.state?.outboundData?.customerInfo?.orderId;
    try {
      await axiosInstance.post("/api/invoices", payload);
      await Promise.all([
        customerId && axiosInstance.post(`/api/customers/${customerId}/history`, {
          action: "Invoice Issued",
          timestamp: new Date().toISOString(),
          details: {
            invoiceNumber,
            amount: totals.grandTotal,
            currency,
            status,
          },
        }),
        orderId && axiosInstance.patch(`/api/sales-orders/${orderId}/status`, { status: "invoiced" }),
      ].filter(Boolean));
      navigate("/Sales/Invoices");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setSubmitting(true);
    const payload = {
      invoiceNumber,
      issueDate, dueDate, currency, paymentTerms: terms,
      from:       { name: fromName, address: fromAddr, trn: fromTrn },
      billTo:     { name: custName, address: custAddr, trn: custTrn },
      customerId,
      lineItems:  items.map((item) => { const { id: _UNUSED, ...rest } = item; return { ...rest, ...calcLine(rest) }; }),
      totals,
      notes:      { customer: custNote, internal: internalNote },
      status: "draft",
    };
    try {
      await axiosInstance.post("/api/invoices", payload);
      navigate("/Sales/Invoices");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const STATUS_OPTS = [
    { key: "draft",    label: "Draft",           dot: T.muted,   bg: "rgba(100,116,139,.15)", bdr: T.subtle },
    { key: "pending",  label: "Pending Approval", dot: T.accent,  bg: "rgba(245,158,11,.1)",  bdr: "rgba(245,158,11,.35)" },
    { key: "approved", label: "Approved",         dot: T.accent2, bg: "rgba(16,185,129,.1)",  bdr: "rgba(16,185,129,.35)" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600&family=DM+Sans:wght@400;500&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1e2d47;border-radius:3px}
        input[type=number]::-webkit-inner-spin-button{opacity:.4}
        select option{background:#111827}
      `}</style>


      <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans', sans-serif" }}>

        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: T.accent }}>Nexus</span>
              <span style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>ERP</span>
            </div>
            <span style={{ color: T.border }}>|</span>
            <button onClick={() => navigate(-1)} style={{ fontSize: 12, color: T.muted, cursor: "pointer", padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent" }}>← Invoices</button>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 15, fontWeight: 600 }}>Create Invoice</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.accent, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)", padding: "3px 10px", borderRadius: 4 }}>{invoiceNumber}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="ghost" onClick={() => navigate(-1)}>Discard</Btn>
            <Btn v="outline" onClick={handleSaveDraft} disabled={submitting}>Save Draft</Btn>
            <Btn v="primary" onClick={handleSubmit} disabled={submitting} style={{ opacity: submitting ? .7 : 1 }}>
              {submitting ? "Issuing…" : "Issue Invoice →"}
            </Btn>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", minHeight: "calc(100vh - 57px)" }}>

          {/* ── Main ── */}
          <div style={{ padding: 24, overflowY: "auto", borderRight: `1px solid ${T.border}` }}>

            {/* Invoice Details */}
            <Section title="Invoice Details">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Field label="Invoice #"><Inp value={invoiceNumber} readOnly style={{ color: T.muted }} /></Field>
                <Field label="Issue Date"><Inp type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></Field>
                <Field label="Due Date"><Inp type="date" value={dueDate}   onChange={e => setDueDate(e.target.value)} /></Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Currency">
                  <Sel value={currency} onChange={e => setCurrency(e.target.value)}>
                    {["AED — UAE Dirham","USD — US Dollar","EUR — Euro","GBP — British Pound","SAR — Saudi Riyal"].map(c => <option key={c}>{c}</option>)}
                  </Sel>
                </Field>
                <Field label="Payment Terms">
                  <Sel value={terms} onChange={e => setTerms(e.target.value)}>
                    {["Net 30","Net 15","Net 60","Due on Receipt","Custom"].map(t => <option key={t}>{t}</option>)}
                  </Sel>
                </Field>
              </div>
            </Section>

            {/* Parties */}
            <Section title="Parties">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>From (Your Company)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Field label="Company Name"><Inp placeholder="Nexus Technologies LLC" value={fromName} onChange={e => setFromName(e.target.value)} /></Field>
                    <Field label="Address"><Tex placeholder={"123 Sheikh Zayed Rd\nDubai, UAE"} value={fromAddr} onChange={e => setFromAddr(e.target.value)} /></Field>
                    <Field label="TRN / VAT Number"><Inp placeholder="100123456789012" value={fromTrn} onChange={e => setFromTrn(e.target.value)} /></Field>
                  </div>
                </div>
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Bill To (Customer)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Field label="Customer">
                      <CustomerSelect
                        name="customerId"
                        value={customerId}
                        onChange={handleCustomerChange}
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

            {/* Line Items */}
            <Section title="Line Items">
              {/* Tabs */}
              <div style={{ display: "flex", gap: 2, background: T.surface2, borderRadius: 7, padding: 3, marginBottom: 16 }}>
                {["Products & Services", "Expense Items", "Recurring"].map((tab, i) => (
                  <div key={tab} onClick={() => setActiveTab(i)} style={{ flex: 1, textAlign: "center", padding: "6px", borderRadius: 5, fontSize: 12, cursor: "pointer", transition: ".15s", background: activeTab === i ? T.surface : "transparent", color: activeTab === i ? T.text : T.muted, fontWeight: activeTab === i ? 500 : 400 }}>{tab}</div>
                ))}
              </div>

              {items.length === 0 ? (
                <div style={{ border: `2px dashed ${T.border}`, borderRadius: 10, padding: "44px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No line items</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>Items will be populated from the delivery note.</div>
                </div>
              ) : (
                <LineItems items={items} />
              )}
            </Section>

            {/* Notes */}
            <Section title="Notes & Attachments">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Customer Note (visible on invoice)"><Tex placeholder="Thank you for your business!" value={custNote} onChange={e => setCustNote(e.target.value)} /></Field>
                <Field label="Internal Memo (not shown to customer)"><Tex placeholder="Internal reference or approval notes…" value={internalNote} onChange={e => setInternalNote(e.target.value)} /></Field>
              </div>
            </Section>
          </div>

          {/* ── Sidebar ── */}
          <div style={{ padding: 24, background: T.surface, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>

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
              <div style={{ height: 4, background: T.surface2, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${completion}%`, background: `linear-gradient(90deg,${T.accent},${T.accent2})`, borderRadius: 4, transition: "width .4s" }} />
              </div>
            </div>

            {/* Tax Breakdown */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, marginBottom: 10 }}>Tax Breakdown</div>
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                {/* Subtotal */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", paddingBottom: 6 }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Subtotal (excl. VAT)</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{fmtMoney(totals.subtotal)}</span>
                </div>
                {totals.discountTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.border}`, paddingBottom: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: T.red }}>Discount</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: T.red }}>− {fmtMoney(totals.discountTotal)}</span>
                  </div>
                )}
                {totals.discountTotal === 0 && <div style={{ borderBottom: `1px solid ${T.border}`, marginBottom: 8 }} />}
                {/* Per-rate rows */}
                {taxBreakdown.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.muted, padding: "4px 0" }}>No items added yet</div>
                ) : taxBreakdown.map(([rate, amt]) => (
                  <div key={rate} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span style={{ fontSize: 12, color: T.muted }}>VAT @ {rate}%</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.accent }}>{fmtMoney(amt)}</span>
                  </div>
                ))}
                {/* Total Tax */}
                {taxBreakdown.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 0", marginTop: 4, borderTop: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 12, color: T.muted }}>Total VAT</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.accent }}>{fmtMoney(totals.taxTotal)}</span>
                  </div>
                )}
                {/* Grand total */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: `2px solid ${T.border}` }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Total Due</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, color: T.accent }}>{fmtMoney(totals.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Items count */}
            {items.length > 0 && (
              <div style={{ background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.2)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
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

            <div style={{ background: "rgba(245,158,11,.05)", border: "1px solid rgba(245,158,11,.15)", borderRadius: 8, padding: 12, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
              <span style={{ color: T.accent, fontWeight: 600 }}>Tip: </span>
              Selecting from inventory will merge duplicates — adding the same product twice increments the quantity. Tax rate is editable per line.
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateInvoice;