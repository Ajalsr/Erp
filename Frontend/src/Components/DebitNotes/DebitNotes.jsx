import { useEffect, useState, useCallback, useRef } from "react";
import { FaPlus, FaTimes, FaSearch, FaFileInvoiceDollar, FaChevronLeft, FaChevronRight, FaCheck } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import nexusToast from "../../helper/nexusToast";

const fmt = (n) =>
  `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_CFG = {
  draft:            { color: "#94a3b8", bg: "rgba(100,116,139,0.1)", label: "Draft"            },
  pending_approval: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Pending Approval" },
  approved:         { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  label: "Approved"         },
  applied:          { color: "#10b981", bg: "rgba(16,185,129,0.1)",  label: "Applied"          },
  closed:           { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  label: "Closed"           },
  void:             { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: "Void"             },
};

// ── Vendor typeahead ──────────────────────────────────────────────────────────
const VendorSearch = ({ value, onChange, T }) => {
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const search = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); return; }
    try {
      const res = await axiosInstance.get(`/api/vendors/search?q=${encodeURIComponent(q)}`);
      setResults(res.data?.data || []);
      setOpen(true);
    } catch { setResults([]); }
  }, []);

  const handleChange = (e) => { const v = e.target.value; setQuery(v); search(v); if (!v) onChange(null); };

  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { if (value?.name && !query) setQuery(value.name); }, [value?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input value={query} onChange={handleChange} placeholder="Search vendor name…"
        style={{ width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, zIndex: 1000, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
          {results.map((v, i) => (
            <div key={v._id || i}
              onClick={() => {
                const name = v.displayName || v.companyName || v.name;
                setQuery(name);
                onChange({ id: v._id, name });
                setOpen(false);
                setResults([]);
              }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: i < results.length - 1 ? `1px solid ${T.border}` : "none" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{v.displayName || v.companyName || v.name}</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: 0, fontFamily: "'DM Mono', monospace" }}>{v.vendorCode}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMPTY_ITEM = { description: "", qty: 1, unitPrice: 0, taxRate: 5, taxAmt: 0, total: 0 };
const DEFAULT_FORM = {
  vendorId: "", vendorName: "",
  sourceDocId: "", sourceDocType: "bill", sourceDocNumber: "",
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
  const sub = items.reduce((s, i) => s + (i.qty || 0) * (i.unitPrice || 0), 0);
  const vat = items.reduce((s, i) => s + (i.taxAmt || 0), 0);
  return { subtotal: Math.round(sub * 100) / 100, vatTotal: Math.round(vat * 100) / 100, grandTotal: Math.round((sub + vat) * 100) / 100 };
};

// ── Main component ────────────────────────────────────────────────────────────
export default function DebitNotes() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [notes,      setNotes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [form,       setForm]       = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [search,     setSearch]     = useState("");
  const [filterSt,   setFilterSt]   = useState("all");
  const [page,       setPage]       = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [actioning,  setActioning]  = useState(false);
  const [vendorBills, setVendorBills] = useState([]);

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/debit-notes");
      setNotes(res.data?.data || []);
    } catch { nexusToast.error("Failed to load debit notes"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load vendor's bills when vendor changes
  useEffect(() => {
    if (!form.vendorId) { setVendorBills([]); return; }
    axiosInstance.get("/api/bills/")
      .then(r => {
        const all = r.data?.data?.bills || r.data?.data || [];
        setVendorBills(all.filter(b =>
          b.vendorId === form.vendorId &&
          ["open", "partial", "overdue"].includes(b.status)
        ));
      })
      .catch(() => setVendorBills([]));
  }, [form.vendorId]);

  const filtered = notes.filter(n => {
    if (filterSt !== "all" && n.status !== filterSt) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (n.debitNoteNumber || "").toLowerCase().includes(q) ||
             (n.vendorName      || "").toLowerCase().includes(q) ||
             (n.sourceDocNumber || "").toLowerCase().includes(q);
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const updateItem = (idx, field, val) => {
    setForm(f => {
      const items = [...f.lineItems];
      items[idx] = calcItem({ ...items[idx], [field]: field === "description" ? val : (parseFloat(val) || 0) });
      return { ...f, lineItems: items };
    });
  };
  const addItem    = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_ITEM }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }));

  const totals = calcTotals(form.lineItems);

  const handleSubmit = async () => {
    if (!form.vendorId)    { nexusToast.error("Please select a vendor"); return; }
    if (!form.reason.trim()) { nexusToast.error("Reason is required"); return; }
    if (form.lineItems.some(i => !i.description.trim())) { nexusToast.error("All line items need a description"); return; }
    setSubmitting(true);
    try {
      await axiosInstance.post("/api/debit-notes", {
        vendorId:        form.vendorId,
        vendorName:      form.vendorName,
        sourceDocId:     form.sourceDocId     || undefined,
        sourceDocType:   form.sourceDocId     ? "bill" : undefined,
        sourceDocNumber: form.sourceDocNumber || undefined,
        reason:          form.reason,
        date:            form.date,
        lineItems:       form.lineItems,
        notes:           form.notes,
      });
      nexusToast.success("Debit note created");
      setModalOpen(false);
      setForm(DEFAULT_FORM);
      load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to create debit note");
    } finally { setSubmitting(false); }
  };

  const dnAction = async (id, endpoint, successMsg, errorMsg) => {
    setActioning(true);
    try {
      await axiosInstance.patch(`/api/debit-notes/${id}/${endpoint}`);
      nexusToast.success(successMsg);
      setDrawerOpen(false); setSelected(null);
      load();
    } catch (e) { nexusToast.error(e.response?.data?.message || errorMsg); }
    finally { setActioning(false); }
  };

  const handleSubmitDN = (id) => dnAction(id, "submit",  "Submitted for approval", "Failed to submit");
  const handleApprove  = (id) => dnAction(id, "approve", "Debit note approved",    "Failed to approve");
  const handleApply    = (id) => dnAction(id, "apply",   "Applied to bill",        "Failed to apply");
  const handleClose    = (id) => dnAction(id, "close",   "Debit note closed",      "Failed to close");
  const handleVoid     = (id) => dnAction(id, "void",    "Debit note voided",      "Failed to void");

  const card  = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };
  const inputSt = { width: "100%", padding: "10px 13px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .dn-root * { box-sizing: border-box; }
    .dn-root { font-family: 'DM Sans', sans-serif; }
    .dn-row  { transition: background 0.1s; }
    .dn-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .dn-pill { cursor: pointer; transition: all 0.15s; }
    .dn-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .dn-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }
    .dn-btn { transition: all 0.15s; }
    .dn-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    @keyframes dn-fade  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dn-modal { from { opacity: 0; transform: translate(-50%,-48%) scale(0.96); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
    @keyframes dn-slide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .dn-overlay { animation: dn-fade  0.2s ease forwards; }
    .dn-modal   { animation: dn-modal 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
    .dn-drawer  { animation: dn-slide 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
  `;

  const F = ({ label, children, req }) => (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textSec, marginBottom: 6 }}>
        {label}{req && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="dn-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Debit Notes</h1>
            <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Issue debit notes against vendor bills to reduce AP balance</p>
          </div>
          <button className="dn-btn" onClick={() => setModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11} /> New Debit Note
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: 11, pointerEvents: "none" }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search debit # or vendor…"
              style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}><FaTimes size={11} /></button>}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["all", "draft", "pending_approval", "approved", "applied", "closed", "void"].map(s => (
              <button key={s} onClick={() => { setFilterSt(s); setPage(1); }}
                className={`dn-pill${filterSt === s ? " dn-pill-active" : ""}`}
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
                {["Debit #", "Date", "Vendor", "Bill", "Reason", "Amount", "Status", ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i === 5 ? "right" : "left", fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ padding: "60px 20px", textAlign: "center", color: T.textSec }}>Loading…</td></tr>
              ) : paged.length > 0 ? paged.map((dn, i) => {
                const sc = STATUS_CFG[dn.status] || STATUS_CFG.draft;
                return (
                  <tr key={dn._id || i} className="dn-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span onClick={() => { setSelected(dn); setDrawerOpen(true); }}
                        style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: T.blueLight, cursor: "pointer" }}>
                        {dn.debitNoteNumber}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{fmtDate(dn.date)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{dn.vendorName || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{dn.sourceDocNumber || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dn.reason || "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.amber }}>{fmt(dn.totals?.grandTotal)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </td>
                    <td style={{ padding: "12px 10px" }}>
                      <button onClick={() => { setSelected(dn); setDrawerOpen(true); }}
                        style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 11, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="8" style={{ padding: "72px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textSec }}><FaFileInvoiceDollar /></div>
                    <p style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>No debit notes yet</p>
                    <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>Issue debit notes against vendor bills to reduce AP balance</p>
                    <button className="dn-btn" onClick={() => setModalOpen(true)}
                      style={{ marginTop: 4, padding: "8px 20px", background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      New Debit Note
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
          <div className="dn-overlay" onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.75)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", zIndex: 60 }} />
          <div className="dn-modal" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 620, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, zIndex: 61, boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.6)" : "0 12px 48px rgba(0,0,0,0.15)" }}>

            <div style={{ padding: "20px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>New Debit Note</h3>
              <button onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
                style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: T.textSec, display: "flex" }}>
                <FaTimes size={11} />
              </button>
            </div>

            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label="Vendor" req>
                  <VendorSearch
                    value={form.vendorId ? { id: form.vendorId, name: form.vendorName } : null}
                    onChange={v => setForm(f => ({ ...f, vendorId: v?.id || "", vendorName: v?.name || "", sourceDocId: "", sourceDocNumber: "" }))}
                    T={T} />
                </F>
                <F label="Date" req>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputSt} />
                </F>
              </div>

              <F label="Link to Bill (optional)">
                <select value={form.sourceDocId}
                  onChange={e => {
                    const bill = vendorBills.find(b => b._id === e.target.value);
                    setForm(f => ({ ...f, sourceDocId: e.target.value, sourceDocNumber: bill?.billNumber || "" }));
                  }}
                  style={{ ...inputSt, color: form.sourceDocId ? T.textPri : T.textSec }}>
                  <option value="">— None —</option>
                  {vendorBills.map(b => (
                    <option key={b._id} value={b._id}>
                      {b.billNumber} · {fmt(b.totals?.grandTotal || b.balanceDue)} ({b.status})
                    </option>
                  ))}
                </select>
                {form.vendorId && vendorBills.length === 0 && (
                  <p style={{ fontSize: 11, color: T.textSec, marginTop: 4 }}>No eligible bills for this vendor.</p>
                )}
              </F>

              <F label="Reason" req>
                <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Returned goods, overcharge, damaged shipment…"
                  style={inputSt} />
              </F>

              {/* Line items */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Line Items</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {form.lineItems.map((item, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 70px 100px 70px 90px auto", gap: 8, alignItems: "center" }}>
                      <input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Description"
                        style={{ padding: "9px 12px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
                      <input type="number" value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} placeholder="Qty"
                        style={{ padding: "9px 8px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono',monospace", textAlign: "center" }} />
                      <input type="number" value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} placeholder="Unit Price"
                        style={{ padding: "9px 8px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono',monospace" }} />
                      <input type="number" value={item.taxRate} onChange={e => updateItem(idx, "taxRate", e.target.value)} placeholder="Tax %"
                        style={{ padding: "9px 8px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono',monospace", textAlign: "center" }} />
                      <span style={{ textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: T.textPri }}>{fmt(item.total)}</span>
                      <button onClick={() => removeItem(idx)} disabled={form.lineItems.length === 1}
                        style={{ padding: "7px 8px", border: `1px solid ${T.border}`, borderRadius: 8, background: "transparent", color: T.textSec, cursor: form.lineItems.length === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", opacity: form.lineItems.length === 1 ? 0.4 : 1 }}>
                        <FaTimes size={10} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addItem} style={{ marginTop: 8, padding: "7px 14px", border: `1px dashed ${T.border}`, borderRadius: 8, background: "transparent", color: T.textSec, cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                  <FaPlus size={10} /> Add Item
                </button>
              </div>

              {/* Totals */}
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px" }}>
                {[
                  { label: "Subtotal",    value: fmt(totals.subtotal) },
                  { label: "Tax (VAT)",   value: fmt(totals.vatTotal) },
                  { label: "Grand Total", value: fmt(totals.grandTotal), bold: true },
                ].map(({ label, value, bold }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: label !== "Grand Total" ? `1px solid ${T.border}` : "none" }}>
                    <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: bold ? T.amber : T.textPri }}>{value}</span>
                  </div>
                ))}
              </div>

              <F label="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional internal notes…"
                  style={{ ...inputSt, resize: "vertical" }} />
              </F>
            </div>

            <div style={{ padding: "14px 22px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10 }}>
              <button className="dn-btn" onClick={handleSubmit} disabled={submitting}
                style={{ flex: 1, padding: 11, background: submitting ? T.surface2 : T.blue, color: submitting ? T.textSec : "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {submitting ? "Creating…" : "Create Debit Note"}
              </button>
              <button onClick={() => { setModalOpen(false); setForm(DEFAULT_FORM); }}
                style={{ padding: "11px 20px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && selected && (() => {
        const dn = selected;
        const sc = STATUS_CFG[dn.status] || STATUS_CFG.draft;
        return (
          <>
            <div className="dn-overlay" onClick={() => { setDrawerOpen(false); setSelected(null); }}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />
            <div className="dn-drawer" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 440, maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

              <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>Debit Note</h3>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.blueLight }}>{dn.debitNoteNumber}</span>
                </div>
                <button onClick={() => { setDrawerOpen(false); setSelected(null); }}
                  style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: "pointer", color: T.textSec, display: "flex" }}>
                  <FaTimes size={11} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Vendor",       value: dn.vendorName      || "—" },
                    { label: "Date",         value: fmtDate(dn.date) },
                    { label: "Reason",       value: dn.reason          || "—" },
                    { label: "Linked Bill",  value: dn.sourceDocNumber || "—" },
                  ].map(({ label, value }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri }}>{value}</span>
                    </div>
                  ))}
                </div>

                {dn.lineItems?.length > 0 && (
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {dn.lineItems.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: i < dn.lineItems.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.description}</p>
                          <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0", fontFamily: "'DM Mono', monospace" }}>
                            {item.qty} × {fmt(item.unitPrice)} + {item.taxRate}% VAT
                          </p>
                        </div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: T.amber }}>{fmt(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* VAT breakdown */}
                {dn.vatBreakdown?.length > 0 && (
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0, padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>VAT Breakdown</p>
                    {dn.vatBreakdown.map((vl, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: i < dn.vatBreakdown.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <span style={{ fontSize: 12, color: T.textSec }}>{vl.rate}% on {fmt(vl.taxableAmount)}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: T.textPri }}>{fmt(vl.vatAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Subtotal",    value: fmt(dn.totals?.subtotal),   bold: false },
                    { label: "Tax (VAT)",   value: fmt(dn.totals?.vatTotal),   bold: false },
                    { label: "Grand Total", value: fmt(dn.totals?.grandTotal), bold: true  },
                  ].map(({ label, value, bold }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", background: bold ? (isDark ? "rgba(245,158,11,0.06)" : "#fffbeb") : "transparent" }}>
                      <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: bold ? T.amber : T.textPri }}>{value}</span>
                    </div>
                  ))}
                </div>

                {dn.status === "approved" && !dn.sourceDocId && (
                  <div style={{ background: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "10px 14px" }}>
                    <p style={{ fontSize: 12, color: "#f59e0b", margin: 0 }}>No bill linked — Apply is disabled. A source bill is required to apply this debit note.</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {dn.status === "draft" && (
                  <button className="dn-btn" disabled={actioning} onClick={() => handleSubmitDN(dn._id)}
                    style={{ flex: 1, padding: 10, background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: actioning ? "not-allowed" : "pointer", opacity: actioning ? 0.6 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <FaCheck size={11} /> {actioning ? "Submitting…" : "Submit for Approval"}
                  </button>
                )}
                {dn.status === "pending_approval" && (
                  <button className="dn-btn" disabled={actioning} onClick={() => handleApprove(dn._id)}
                    style={{ flex: 1, padding: 10, background: T.blue, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: actioning ? "not-allowed" : "pointer", opacity: actioning ? 0.6 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <FaCheck size={11} /> {actioning ? "Approving…" : "Approve"}
                  </button>
                )}
                {dn.status === "approved" && (
                  <button className="dn-btn" disabled={actioning || !dn.sourceDocId} onClick={() => handleApply(dn._id)}
                    title={!dn.sourceDocId ? "No bill linked" : "Apply debit to linked bill"}
                    style={{ flex: 1, padding: 10, background: T.surface2, color: dn.sourceDocId ? T.amber : T.textMuted, border: `1px solid ${dn.sourceDocId ? "rgba(245,158,11,0.4)" : T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: (actioning || !dn.sourceDocId) ? "not-allowed" : "pointer", opacity: (actioning || !dn.sourceDocId) ? 0.6 : 1, fontFamily: "inherit" }}>
                    {actioning ? "Applying…" : "Apply to Bill"}
                  </button>
                )}
                {dn.status === "applied" && (
                  <button className="dn-btn" disabled={actioning} onClick={() => handleClose(dn._id)}
                    style={{ flex: 1, padding: 10, background: T.surface2, color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: actioning ? "not-allowed" : "pointer", opacity: actioning ? 0.6 : 1, fontFamily: "inherit" }}>
                    {actioning ? "Closing…" : "Close"}
                  </button>
                )}
                {["draft", "pending_approval", "approved"].includes(dn.status) && (
                  <button className="dn-btn" disabled={actioning} onClick={() => handleVoid(dn._id)}
                    style={{ flex: 1, padding: 10, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: actioning ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    Void
                  </button>
                )}
                <button className="dn-btn" onClick={() => { setDrawerOpen(false); setSelected(null); }}
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
