import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { FaPlus, FaTimes, FaSearch, FaFileInvoiceDollar, FaChevronLeft, FaChevronRight, FaBan, FaCheck } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const fmt = (n, cur = "AED") =>
  `${cur} ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
const DEFAULT_FORM = {
  customerId: "", customerName: "",
  sourceDocId: "", sourceDocType: "invoice", sourceDocNumber: "",
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
export default function CreditNotes() {
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

  // Auto-open create modal when arriving from "Raise Credit Note" on an invoice,
  // and pre-fetch that invoice's line items so the form is pre-filled
  useEffect(() => {
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
          const mapped = (full.lineItems || []).map(item => calcItem({
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

  // Load eligible invoices for manual CN apply (approved + no sourceDocId)
  useEffect(() => {
    if (!drawerOpen || !selected) { setApplyInvoices([]); setApplyInvoiceId(""); return; }
    if (selected.status !== "approved" || selected.sourceDocId) { setApplyInvoices([]); setApplyInvoiceId(""); return; }
    axiosInstance.get("/api/invoices")
      .then(r => {
        const all = r.data?.data?.invoices || [];
        setApplyInvoices(all.filter(inv =>
          (inv.customerId === selected.customerId) &&
          ["unpaid", "overdue", "partial"].includes(inv.status) &&
          (inv.balanceDue ?? inv.totals?.grandTotal ?? 0) > 0
        ));
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
          ["unpaid", "overdue", "partial"].includes(inv.status) &&
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
      items[idx] = calcItem({ ...items[idx], [field]: field === "description" ? val : (parseFloat(val) || 0) });
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
    setSubmitting(true);
    try {
      await axiosInstance.post("/api/credit-notes", {
        customerId:      form.customerId,
        customerName:    form.customerName,
        sourceDocId:     form.sourceDocId     || undefined,
        sourceDocType:   form.sourceDocId     ? "invoice" : undefined,
        sourceDocNumber: form.sourceDocNumber || undefined,
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
  const handleApply    = (id) => {
    const body = !selected?.sourceDocId && applyInvoiceId ? { invoiceId: applyInvoiceId } : null;
    cnAction(id, "apply", "Credit note applied to invoice", "Failed to apply", body);
  };
  const handleClose    = (id) => cnAction(id, "close",   "Credit note closed",     "Failed to close");
  const handleVoid     = (id) => cnAction(id, "void",    "Credit note voided",     "Failed to void");

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
  return (
    <>
      <style>{css}</style>
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
            {["all", "draft", "pending_approval", "approved", "applied", "closed", "void"].map(s => (
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
                      <span onClick={() => { setSelected(cn); setDrawerOpen(true); }}
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
                        <button onClick={() => { setSelected(cn); setDrawerOpen(true); }}
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
                  const bal = parseFloat(inv?.balanceDue ?? inv?.totals?.grandTotal ?? 0);
                  return (
                    <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span style={{ fontSize: 12, color: "#f59e0b" }}>
                        Credit limit: <strong>AED {bal.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</strong> — your credit note total cannot exceed this amount.
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
                    <FaPlus size={10} /> Add Manual Amount
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
                const bal = parseFloat(inv?.balanceDue ?? inv?.totals?.grandTotal ?? 0);
                if (totals.grandTotal > bal + 0.005) return (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span style={{ fontSize: 12, color: "#ef4444" }}>
                      Total <strong>AED {totals.grandTotal.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</strong> exceeds invoice balance due of <strong>AED {bal.toLocaleString("en-AE", { minimumFractionDigits: 2 })}</strong>. Reduce quantities or amounts.
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
              <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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

              {/* Drawer body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
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

                {/* Totals */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Subtotal",    value: fmt(cn.totals?.subtotal) },
                    { label: "Tax (VAT)",   value: fmt(cn.totals?.vatTotal ?? cn.totals?.taxTotal) },
                    { label: "Grand Total", value: fmt(cn.totals?.grandTotal), bold: true },
                  ].map(({ label, value, bold }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", background: bold ? (isDark ? "rgba(16,185,129,0.06)" : "#f0fdf4") : "transparent" }}>
                      <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: bold ? T.green : T.textPri }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Invoice selector for approved manual CNs (no sourceDocId) */}
                {cn.status === "approved" && !cn.sourceDocId && (
                  <div style={{ background: isDark ? "rgba(59,130,246,0.07)" : "#eff6ff", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 12, padding: "14px" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: isDark ? "#60a5fa" : "#1d4ed8", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Apply to Invoice</p>
                    <p style={{ fontSize: 12, color: T.textSec, margin: "0 0 10px" }}>This credit note has no linked invoice. Select one below to apply the credit:</p>
                    <select
                      value={applyInvoiceId}
                      onChange={e => setApplyInvoiceId(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
                      <option value="">— Select Invoice —</option>
                      {applyInvoices.map(inv => (
                        <option key={inv._id} value={inv._id}>
                          {inv.invoiceNumber} · Balance: AED {parseFloat(inv.balanceDue ?? inv.totals?.grandTotal ?? 0).toLocaleString("en-AE", { minimumFractionDigits: 2 })} ({inv.status})
                        </option>
                      ))}
                    </select>
                    {applyInvoices.length === 0 && (
                      <p style={{ fontSize: 11, color: T.textSec, marginTop: 6, margin: "6px 0 0" }}>No eligible invoices found for this customer.</p>
                    )}
                  </div>
                )}
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
                {cn.status === "approved" && (() => {
                  const canApply = !!cn.sourceDocId || !!applyInvoiceId;
                  return (
                    <button className="cn-btn" disabled={actioning || !canApply} onClick={() => handleApply(cn._id)}
                      title={!canApply ? "Select an invoice to apply this credit note to" : "Apply credit to invoice"}
                      style={{ flex: 1, padding: 10, background: T.surface2, color: canApply ? T.green : T.textMuted, border: `1px solid ${canApply ? T.greenDim : T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: (actioning || !canApply) ? "not-allowed" : "pointer", opacity: (actioning || !canApply) ? 0.6 : 1, fontFamily: "inherit" }}>
                      {actioning ? "Applying…" : "Apply to Invoice"}
                    </button>
                  );
                })()}
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
    </>
  );
}
