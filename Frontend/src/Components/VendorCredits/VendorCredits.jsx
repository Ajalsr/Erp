import { useEffect, useState, useCallback, useRef } from "react";
import {
  FaPlus, FaTimes, FaSearch, FaFileInvoiceDollar,
  FaChevronLeft, FaChevronRight, FaBan, FaChevronDown,
  FaBuilding, FaCheck, FaFileAlt,
} from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import useRealtime from "../../helper/useRealtime";
import nexusToast from "../../helper/nexusToast";

const fmtAED  = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const r2      = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const STATUS_CFG = {
  draft:   { color: "#94a3b8", bg: "rgba(100,116,139,0.12)", label: "Draft"   },
  open:    { color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  label: "Open"    },
  applied: { color: "#10b981", bg: "rgba(16,185,129,0.12)",  label: "Applied" },
  void:    { color: "#6b7280", bg: "rgba(107,114,128,0.12)", label: "Void"    },
};

// ── Generic search dropdown ───────────────────────────────────────────────────
function SearchDropdown({ value, onSelect, onClear, fetchFn, renderTrigger, renderItem, placeholder, T, isDark, dropup }) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref   = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => input.current?.focus(), 60); doFetch(""); }
  }, [open]); // eslint-disable-line

  const doFetch = useCallback(async (q) => {
    setLoading(true);
    try { setResults(await fetchFn(q)); }
    catch { setResults([]); }
    finally { setLoading(false); }
  }, [fetchFn]);

  const handleQuery = (e) => { const v = e.target.value; setQuery(v); doFetch(v); };

  const select = (item) => { onSelect(item); setOpen(false); setQuery(""); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", border: `1.5px solid ${open ? T.blue : T.border}`,
          borderRadius: 10, background: T.surface, cursor: "pointer",
          outline: "none", textAlign: "left",
          boxShadow: open ? `0 0 0 3px ${isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)"}` : "none",
          transition: "border-color 0.15s",
        }}>
        {value ? renderTrigger(value, () => { onClear(); }, T, isDark) : (
          <>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: T.surface2, color: T.textSec, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FaSearch size={11} />
            </div>
            <span style={{ flex: 1, fontSize: 13, color: T.textMuted }}>{placeholder}</span>
            <FaChevronDown size={10} style={{ color: T.textSec, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
          </>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          ...(dropup ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
          left: 0, right: 0,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, zIndex: 1000,
          overflow: "hidden", boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,0,0.15)",
        }}>
          <div style={{ padding: "10px 10px 6px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: 11, pointerEvents: "none" }} />
              <input ref={input} value={query} onChange={handleQuery} placeholder="Type to search…"
                style={{ width: "100%", padding: "8px 10px 8px 30px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
            </div>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: T.textSec }}>Searching…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", fontSize: 12, color: T.textSec }}>No results</div>
            ) : results.map((item, i) => renderItem(item, i, results.length, select, value, T, isDark))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vendor dropdown ───────────────────────────────────────────────────────────
const fetchVendors = async (q) => {
  const res = await axiosInstance.get(`/api/vendors/search?q=${encodeURIComponent(q)}&limit=30`);
  return res.data?.data || [];
};

function VendorDropdown({ value, onChange, T, isDark }) {
  const renderTrigger = (v, onClear) => {
    const init = v.name?.slice(0, 2).toUpperCase();
    return (
      <>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: isDark ? "rgba(59,130,246,0.15)" : "#eff6ff", color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{init}</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0, lineHeight: 1.3 }}>{v.name}</p>
          {v.code && <p style={{ fontSize: 10, color: T.textSec, margin: 0, fontFamily: "'DM Mono',monospace" }}>{v.code}</p>}
        </div>
        <span onClick={(e) => { e.stopPropagation(); onClear(); }} style={{ padding: "2px 5px", cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center" }}><FaTimes size={9} /></span>
      </>
    );
  };
  const renderItem = (v, i, total, select, selected, T, isDark) => {
    const name = v.displayName || v.companyName || "—";
    const sel  = selected?.id === v._id;
    return (
      <div key={v._id || i} onClick={() => select({ id: v._id, name, code: v.vendorCode, trn: v.trnNumber || "" })}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderBottom: i < total - 1 ? `1px solid ${T.border}` : "none", background: sel ? (isDark ? "rgba(59,130,246,0.1)" : "#eff6ff") : "transparent", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"; }}
        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: sel ? (isDark ? "rgba(59,130,246,0.2)" : "#dbeafe") : T.surface2, color: sel ? T.blue : T.textSec, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
          {v.vendorCode && <p style={{ fontSize: 10, color: T.textSec, margin: 0, fontFamily: "'DM Mono',monospace" }}>{v.vendorCode}</p>}
        </div>
        {sel && <FaCheck size={10} style={{ color: T.blue }} />}
      </div>
    );
  };
  return <SearchDropdown value={value} onSelect={onChange} onClear={() => onChange(null)}
    fetchFn={fetchVendors} renderTrigger={renderTrigger} renderItem={renderItem}
    placeholder="Select vendor…" T={T} isDark={isDark} />;
}

// ── Bill reference dropdown ───────────────────────────────────────────────────
function BillDropdown({ value, onChange, vendorId, T, isDark, dropup, onlyOpen }) {
  const fetchBills = useCallback(async (q) => {
    const params = new URLSearchParams({ limit: "30" });
    if (vendorId) params.set("vendorId", vendorId);
    if (q) params.set("search", q);
    const res = await axiosInstance.get(`/api/bills/?${params}`);
    const bills = res.data?.data?.bills || res.data?.data || [];
    // When onlyOpen=true, filter to unpaid bills only
    if (onlyOpen) return bills.filter(b => b.status !== "paid" && b.status !== "void" && b.status !== "draft");
    return bills;
  }, [vendorId, onlyOpen]);

  const renderTrigger = (v, onClear) => (
    <>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: isDark ? "rgba(16,185,129,0.15)" : "#f0fdf4", color: T.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <FaFileAlt size={11} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{v.billNumber}</p>
        {v.total && <p style={{ fontSize: 10, color: T.textSec, margin: 0, fontFamily: "'DM Mono',monospace" }}>{fmtAED(v.total)}</p>}
      </div>
      <span onClick={(e) => { e.stopPropagation(); onClear(); }} style={{ padding: "2px 5px", cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center" }}><FaTimes size={9} /></span>
    </>
  );
  const renderItem = (b, i, total, select, selected, T, isDark) => {
    const sel = selected?.id === b._id;
    return (
      <div key={b._id || i} onClick={() => select({ id: b._id, billNumber: b.billNumber, total: b.totals?.grandTotal || b.total })}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderBottom: i < total - 1 ? `1px solid ${T.border}` : "none", background: sel ? (isDark ? "rgba(16,185,129,0.08)" : "#f0fdf4") : "transparent", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"; }}
        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: T.surface2, color: T.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FaFileAlt size={12} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{b.billNumber}</p>
          <p style={{ fontSize: 10, color: T.textSec, margin: 0, fontFamily: "'DM Mono',monospace" }}>{fmtAED(b.totals?.grandTotal || b.total)} · {b.status}</p>
        </div>
        {sel && <FaCheck size={10} style={{ color: T.green }} />}
      </div>
    );
  };
  return <SearchDropdown value={value} onSelect={onChange} onClear={() => onChange(null)}
    fetchFn={fetchBills} renderTrigger={renderTrigger} renderItem={renderItem}
    placeholder="Link to a bill (optional)…" T={T} isDark={isDark} dropup={dropup} />;
}

// ── Item selector for line items ──────────────────────────────────────────────
function ItemSelector({ value, onSelect, onClear, T, isDark }) {
  const fetchItems = useCallback(async (q) => {
    const res = await axiosInstance.get(`/api/stocks/getitem?search=${encodeURIComponent(q)}&limit=30`);
    return res.data?.data || res.data || [];
  }, []);

  const renderTrigger = (v, onClear) => (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: T.textPri, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</p>
        {v.code && <p style={{ fontSize: 10, color: T.textSec, margin: 0, fontFamily: "'DM Mono',monospace" }}>{v.code}</p>}
      </div>
      <span onClick={(e) => { e.stopPropagation(); onClear(); }} style={{ padding: "2px 4px", cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", flexShrink: 0 }}><FaTimes size={8} /></span>
    </>
  );
  const renderItem = (item, i, total, select, selected, T) => {
    const sel = selected?.id === item._id;
    return (
      <div key={item._id || i} onClick={() => select({ id: item._id, name: item.name, code: item.item_code, unit: item.unit || "", costPrice: parseFloat(item.cost_price || 0) })}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", borderBottom: i < total - 1 ? `1px solid ${T.border}` : "none", background: sel ? (isDark ? "rgba(59,130,246,0.08)" : "#eff6ff") : "transparent", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "#f8fafc"; }}
        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: T.textPri, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</p>
          <p style={{ fontSize: 10, color: T.textSec, margin: 0, fontFamily: "'DM Mono',monospace" }}>{item.item_code} {item.unit ? `· ${item.unit}` : ""}</p>
        </div>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: T.green, flexShrink: 0 }}>{fmtAED(item.cost_price)}</span>
      </div>
    );
  };
  return (
    <SearchDropdown value={value} onSelect={onSelect} onClear={onClear}
      fetchFn={fetchItems} renderTrigger={renderTrigger} renderItem={renderItem}
      placeholder="Select item…" T={T} isDark={isDark} />
  );
}

// ── Calc helpers ──────────────────────────────────────────────────────────────
const EMPTY_ITEM   = { itemId: "", itemCode: "", description: "", unit: "", qty: 1, unitPrice: 0, discount: 0, discountAmt: 0, taxRate: 5, taxAmt: 0, total: 0 };
const DEFAULT_FORM = { vendorId: "", vendorName: "", vendorCode: "", vendorTrn: "", billId: "", billNumber: "", reason: "", date: new Date().toISOString().split("T")[0], lineItems: [{ ...EMPTY_ITEM }], notes: "" };

const calcItem = (item) => {
  const gross       = (item.qty || 0) * (item.unitPrice || 0);
  const discountAmt = r2(gross * ((item.discount || 0) / 100));
  const base        = r2(gross - discountAmt);
  const taxAmt      = r2(base * ((item.taxRate || 0) / 100));
  return { ...item, discountAmt, taxAmt, total: r2(base + taxAmt) };
};

const calcTotals = (items) => {
  const subtotal      = r2(items.reduce((s, i) => s + (i.qty || 0) * (i.unitPrice || 0), 0));
  const discountTotal = r2(items.reduce((s, i) => s + (i.discountAmt || 0), 0));
  const taxTotal      = r2(items.reduce((s, i) => s + (i.taxAmt || 0), 0));
  const grandTotal    = r2(subtotal - discountTotal + taxTotal);
  return { subtotal, discountTotal, taxTotal, grandTotal };
};

// ── Field label ───────────────────────────────────────────────────────────────
const F = ({ label, children, req, T }) => (
  <div>
    <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.textSec, marginBottom: 6 }}>
      {label}{req && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
    </label>
    {children}
  </div>
);

const iStyle = (T) => ({
  width: "100%", padding: "10px 12px", border: `1.5px solid ${T.border}`,
  borderRadius: 10, fontSize: 13, background: T.surface, color: T.textPri,
  outline: "none", fontFamily: "inherit", transition: "border-color 0.15s",
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VendorCredits() {
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);

  const [credits,        setCredits]        = useState([]);
  const [stats,          setStats]          = useState({});
  const [loading,        setLoading]        = useState(true);
  const [modalOpen,      setModalOpen]      = useState(false);
  const [form,           setForm]           = useState(DEFAULT_FORM);
  const [submitting,     setSubmitting]     = useState(false);
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [page,           setPage]           = useState(1);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [selected,       setSelected]       = useState(null);
  const [applyingCredit, setApplyingCredit] = useState(false);
  const [applyBillId,    setApplyBillId]    = useState("");
  const [applyBillNum,   setApplyBillNum]   = useState("");
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [credRes, statsRes] = await Promise.allSettled([
        axiosInstance.get("/api/vendor-credits/"),
        axiosInstance.get("/api/vendor-credits/stats"),
      ]);
      if (credRes.status  === "fulfilled") setCredits(credRes.value.data?.data?.credits || []);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data?.data || {});
    } catch { nexusToast.error("Failed to load vendor credits"); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(['vendor_credits_updated','bills_updated','debit_notes_updated'], load);

  const filtered   = credits.filter(c => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (c.creditNumber || "").toLowerCase().includes(q) || (c.vendorName || "").toLowerCase().includes(q);
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paged      = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  const updateItem = (idx, field, val) => {
    setForm(f => {
      const items = [...f.lineItems];
      items[idx]  = calcItem({ ...items[idx], [field]: ["description", "unit"].includes(field) ? val : parseFloat(val) || 0 });
      return { ...f, lineItems: items };
    });
  };
  const setItemFromCatalog = (idx, catalogItem) => {
    if (!catalogItem) {
      setForm(f => { const items = [...f.lineItems]; items[idx] = { ...items[idx], itemId: "", itemCode: "", unit: "" }; return { ...f, lineItems: items }; });
      return;
    }
    setForm(f => {
      const items = [...f.lineItems];
      items[idx]  = calcItem({ ...items[idx], itemId: catalogItem.id, itemCode: catalogItem.code, description: catalogItem.name, unit: catalogItem.unit, unitPrice: catalogItem.costPrice });
      return { ...f, lineItems: items };
    });
  };
  const addItem    = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { ...EMPTY_ITEM }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }));

  const totals = calcTotals(form.lineItems);

  const handleSubmit = async () => {
    if (!form.vendorId)                                   { nexusToast.error("Please select a vendor"); return; }
    if (!form.reason.trim())                              { nexusToast.error("Reason is required"); return; }
    if (form.lineItems.some(i => !i.description.trim())) { nexusToast.error("All line items need a description"); return; }
    setSubmitting(true);
    try {
      await axiosInstance.post("/api/vendor-credits/", {
        vendorId: form.vendorId, vendorName: form.vendorName, vendorTrn: form.vendorTrn,
        billId: form.billId, billNumber: form.billNumber,
        reason: form.reason, date: form.date,
        lineItems: form.lineItems, totals,
        notes: form.notes,
      });
      nexusToast.success("Vendor credit created");
      setModalOpen(false); setForm(DEFAULT_FORM); load();
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to create credit");
    } finally { setSubmitting(false); }
  };

  const handleVoid = async (id) => {
    try { await axiosInstance.patch(`/api/vendor-credits/${id}/void`); nexusToast.success("Credit voided"); load(); }
    catch { nexusToast.error("Failed to void"); }
  };

  const handleApplyCredit = async (id) => {
    if (!applyBillId) { nexusToast.error("Select an open bill to apply this credit to"); return; }
    setApplyingCredit(true);
    try {
      await axiosInstance.post(`/api/vendor-credits/${id}/apply`, { billId: applyBillId });
      nexusToast.success("Credit applied to " + applyBillNum);
      closeDrawer(); load();
    }
    catch (e) { nexusToast.error(e.response?.data?.message || "Failed to apply"); }
    finally { setApplyingCredit(false); }
  };

  const closeModal  = () => { setModalOpen(false); setForm(DEFAULT_FORM); };
  const closeDrawer = () => { setDrawerOpen(false); setSelected(null); setApplyBillId(""); setApplyBillNum(""); };

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .vc-root * { box-sizing: border-box; }
    .vc-root   { font-family: 'DM Sans', sans-serif; }
    .vc-row    { transition: background 0.1s; }
    .vc-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .vc-pill   { cursor: pointer; transition: all 0.15s; }
    .vc-pill:hover { border-color: ${isDark ? "rgba(59,130,246,0.3)" : "#bfdbfe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
    .vc-pill-active { background: ${isDark ? "rgba(59,130,246,0.15)" : "#eff6ff"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-color: ${isDark ? "rgba(59,130,246,0.35)" : "#bfdbfe"} !important; font-weight: 600 !important; }
    .vc-btn    { transition: all 0.15s; }
    .vc-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
    .vc-btn:disabled { opacity: 0.5; cursor: not-allowed !important; }
    .vc-inp:focus { border-color: ${T.blue} !important; box-shadow: 0 0 0 3px ${isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)"} !important; }
    @keyframes vc-fade   { from{opacity:0} to{opacity:1} }
    @keyframes vc-modal  { from{opacity:0;transform:translate(-50%,-48%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
    @keyframes vc-slide  { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
    .vc-overlay { animation: vc-fade 0.2s ease forwards; }
    .vc-modal   { animation: vc-modal 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
    .vc-drawer  { animation: vc-slide 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
  `;

  const statCards = [
    { label: "Total Credits", value: Object.values(stats.byStatus || {}).reduce((s, v) => s + (v.count || 0), 0), color: T.blue,  dim: T.blueDim  },
    { label: "Open Credits",  value: stats.byStatus?.open?.count || 0,                                            color: T.amber, dim: T.amberDim },
    { label: "Open Value",    value: fmtAED(stats.openTotal),                                                     color: T.green, dim: T.greenDim, small: true },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="vc-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "Sora,sans-serif", fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0 }}>Vendor Credits</h1>
            <p style={{ color: T.textSec, fontSize: 13, margin: "4px 0 0" }}>Manage credit notes from vendors</p>
          </div>
          <button className="vc-btn" onClick={() => setModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: T.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaPlus size={11} /> New Credit
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
          {statCards.map((c, i) => (
            <div key={i} style={{ ...card, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent 10%,${c.color}55,transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>{c.label}</p>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}><FaFileInvoiceDollar /></div>
              </div>
              <p style={{ fontFamily: "Sora,sans-serif", fontSize: c.small ? 17 : 26, fontWeight: 800, color: T.textPri, margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: 11, pointerEvents: "none" }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search credit # or vendor…" className="vc-inp"
              style={{ width: "100%", padding: "8px 32px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0, display: "flex" }}><FaTimes size={11} /></button>}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["all","draft","open","applied","void"].map(s => (
              <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                className={`vc-pill${filterStatus === s ? " vc-pill-active" : ""}`}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "transparent", color: T.textSec, border: `1px solid ${T.border}`, fontFamily: "inherit", cursor: "pointer" }}>
                {s === "all" ? "All" : STATUS_CFG[s]?.label || s}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: T.textSec, marginLeft: "auto" }}>{filtered.length} credit{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div style={{ ...card, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {["Credit #","Date","Vendor","Reason","Amount","Status",""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 16px", textAlign: i === 4 ? "right" : "left", fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: "60px 20px", textAlign: "center", color: T.textSec }}>Loading…</td></tr>
              ) : paged.length > 0 ? paged.map((cr, i) => {
                const sc = STATUS_CFG[cr.status] || STATUS_CFG.open;
                return (
                  <tr key={cr._id || i} className="vc-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <span onClick={() => { setSelected(cr); setDrawerOpen(true); }} style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 600, color: T.blueLight, cursor: "pointer" }}>{cr.creditNumber}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec }}>{fmtDate(cr.date)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: T.textPri }}>{cr.vendorName || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: T.textSec, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cr.reason || "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: T.green }}>{fmtAED(cr.totals?.grandTotal)}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span></td>
                    <td style={{ padding: "12px 10px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { setSelected(cr); setDrawerOpen(true); }} style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 11, color: T.textSec, cursor: "pointer", fontFamily: "inherit" }}>View</button>
                        {cr.status === "open" && (
                          <button onClick={() => handleVoid(cr._id)} style={{ padding: "4px 8px", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 7, background: "rgba(239,68,68,0.06)", fontSize: 11, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }} title="Void"><FaBan size={10} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7" style={{ padding: "72px 20px", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: T.textSec }}><FaFileInvoiceDollar /></div>
                    <p style={{ fontFamily: "Sora,sans-serif", fontWeight: 700, color: T.textPri, fontSize: 15, margin: 0 }}>No vendor credits yet</p>
                    <button className="vc-btn" onClick={() => setModalOpen(true)} style={{ marginTop: 4, padding: "8px 20px", background: T.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>New Credit</button>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > LIMIT && (
          <div style={{ ...card, padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: T.textSec }}>Showing {(page-1)*LIMIT+1}–{Math.min(page*LIMIT, filtered.length)} of {filtered.length}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 12, color: page===1?T.textMuted:T.textSec, cursor: page===1?"not-allowed":"pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}><FaChevronLeft size={10}/> Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding: "5px 11px", border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", fontSize: 12, color: page===totalPages?T.textMuted:T.textSec, cursor: page===totalPages?"not-allowed":"pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}>Next <FaChevronRight size={10}/></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Credit Modal ───────────────────────────────────────────── */}
      {modalOpen && (
        <>
          <div className="vc-overlay" onClick={closeModal}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.78)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(8px)", zIndex: 60 }} />
          <div className="vc-modal" style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 860, maxWidth: "97vw", maxHeight: "93vh", overflowY: "auto",
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, zIndex: 61,
            boxShadow: isDark ? "0 28px 80px rgba(0,0,0,0.65)" : "0 16px 56px rgba(0,0,0,0.18)",
          }}>
            {/* Modal header */}
            <div style={{ padding: "20px 24px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: isDark ? "rgba(59,130,246,0.15)" : "#eff6ff", color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}><FaFileInvoiceDollar /></div>
                <div>
                  <h3 style={{ fontFamily: "Sora,sans-serif", fontSize: 15, fontWeight: 800, color: T.textPri, margin: 0 }}>New Vendor Credit</h3>
                  <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>Record a credit received from a vendor</p>
                </div>
              </div>
              <button onClick={closeModal} style={{ width: 30, height: 30, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><FaTimes size={11} /></button>
            </div>

            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Row 1: Vendor + Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <F label="Vendor" req T={T}>
                  <VendorDropdown
                    value={form.vendorId ? { id: form.vendorId, name: form.vendorName, code: form.vendorCode } : null}
                    onChange={v => setForm(f => ({ ...f, vendorId: v?.id || "", vendorName: v?.name || "", vendorCode: v?.code || "", vendorTrn: v?.trn || "" }))}
                    T={T} isDark={isDark}
                  />
                </F>
                <F label="Date" req T={T}>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="vc-inp"
                    style={{ ...iStyle(T) }} />
                </F>
              </div>

              {/* Row 2: Bill Reference + Reason */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <F label="Bill Reference" T={T}>
                  <BillDropdown
                    value={form.billId ? { id: form.billId, billNumber: form.billNumber } : null}
                    onChange={async (b) => {
                      if (!b?.id) { setForm(f => ({ ...f, billId: "", billNumber: "", lineItems: [{ ...EMPTY_ITEM }] })); return; }
                      setForm(f => ({ ...f, billId: b.id, billNumber: b.billNumber }));
                      try {
                        const res = await axiosInstance.get(`/api/bills/${b.id}`);
                        const bill = res.data?.data || res.data;
                        if (bill?.lineItems?.length) {
                          const mapped = bill.lineItems.map(li => calcItem({
                            itemId:    li.itemId    || "",
                            itemCode:  li.itemCode  || "",
                            description: li.description || "",
                            unit:      li.unit      || "Pcs",
                            qty:       li.qty       || 1,
                            unitPrice: li.unitPrice || 0,
                            discount:  0,
                            taxRate:   li.taxRate   ?? 0,
                          }));
                          setForm(f => ({ ...f, lineItems: mapped }));
                        }
                      } catch { /* keep default if fetch fails */ }
                    }}
                    vendorId={form.vendorId}
                    T={T} isDark={isDark}
                  />
                </F>
                <F label="Reason" req T={T}>
                  <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="e.g. Returned goods, pricing error…" className="vc-inp"
                    style={{ ...iStyle(T) }} />
                </F>
              </div>

              {/* Line items */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Line Items</p>
                  <span style={{ fontSize: 11, color: T.textSec }}>{form.lineItems.length} item{form.lineItems.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "155px 1fr 54px 52px 82px 62px 62px 80px 26px", gap: 6, marginBottom: 6, padding: "0 2px" }}>
                  {["Item","Description","Unit","Qty","Unit Price","Disc %","Tax %","Total",""].map((h, i) => (
                    <span key={i} style={{ fontSize: 9.5, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i >= 3 && i <= 7 ? "center" : "left" }}>{h}</span>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {form.lineItems.map((item, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "155px 1fr 54px 52px 82px 62px 62px 80px 26px", gap: 6, alignItems: "center" }}>
                      {/* Item selector */}
                      <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 9, overflow: "hidden", background: T.surface }}>
                        <ItemSelector
                          value={item.itemId ? { id: item.itemId, name: item.description, code: item.itemCode } : null}
                          onSelect={(v) => setItemFromCatalog(idx, v)}
                          onClear={() => setItemFromCatalog(idx, null)}
                          T={T} isDark={isDark}
                        />
                      </div>
                      {/* Description */}
                      <input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)}
                        placeholder="Description" className="vc-inp"
                        style={{ padding: "9px 10px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 12, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit" }} />
                      {/* Unit */}
                      <input value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)}
                        placeholder="Pcs" className="vc-inp"
                        style={{ padding: "9px 8px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 12, background: T.surface, color: T.textPri, outline: "none", fontFamily: "inherit", textAlign: "center" }} />
                      {/* Qty */}
                      <input type="number" min="0" value={item.qty} onChange={e => updateItem(idx, "qty", e.target.value)} className="vc-inp"
                        style={{ padding: "9px 6px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 12, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono',monospace", textAlign: "center" }} />
                      {/* Unit Price */}
                      <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} className="vc-inp"
                        style={{ padding: "9px 8px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 12, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono',monospace", textAlign: "right" }} />
                      {/* Discount % */}
                      <input type="number" min="0" max="100" value={item.discount} onChange={e => updateItem(idx, "discount", e.target.value)} className="vc-inp"
                        style={{ padding: "9px 6px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 12, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono',monospace", textAlign: "center" }} />
                      {/* Tax % */}
                      <input type="number" min="0" max="100" value={item.taxRate} onChange={e => updateItem(idx, "taxRate", e.target.value)} className="vc-inp"
                        style={{ padding: "9px 6px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 12, background: T.surface, color: T.textPri, outline: "none", fontFamily: "'DM Mono',monospace", textAlign: "center" }} />
                      {/* Total (read-only) */}
                      <div style={{ padding: "9px 8px", border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 12, background: T.surface2, color: T.green, fontFamily: "'DM Mono',monospace", textAlign: "right", fontWeight: 700 }}>
                        {fmtAED(item.total).replace("AED ", "")}
                      </div>
                      {/* Remove */}
                      <button onClick={() => removeItem(idx)} disabled={form.lineItems.length === 1}
                        style={{ width: 26, height: 26, border: `1px solid ${T.border}`, borderRadius: 7, background: "transparent", color: T.textSec, cursor: form.lineItems.length === 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: form.lineItems.length === 1 ? 0.3 : 0.7, padding: 0 }}>
                        <FaTimes size={9} />
                      </button>
                    </div>
                  ))}
                </div>

                <button onClick={addItem}
                  style={{ marginTop: 8, padding: "7px 14px", border: `1.5px dashed ${T.border}`, borderRadius: 9, background: "transparent", color: T.textSec, cursor: "pointer", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.blue; e.currentTarget.style.color = T.blue; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSec; }}>
                  <FaPlus size={9} /> Add Item
                </button>
              </div>

              {/* Totals */}
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                {[
                  { label: "Subtotal (before discount)",  value: fmtAED(totals.subtotal),       show: true,                          bold: false },
                  { label: `Discount`,                    value: `- ${fmtAED(totals.discountTotal)}`, show: totals.discountTotal > 0, bold: false, color: "#f59e0b" },
                  { label: "Tax (VAT)",                   value: fmtAED(totals.taxTotal),        show: true,                          bold: false },
                  { label: "Grand Total",                 value: fmtAED(totals.grandTotal),      show: true,                          bold: true  },
                ].filter(r => r.show).map(({ label, value, bold, color }, i, arr) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "11px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                    background: bold ? (isDark ? "rgba(59,130,246,0.07)" : "#eff6ff") : "transparent",
                  }}>
                    <span style={{ fontSize: 12.5, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: bold ? 15 : 13, fontWeight: bold ? 800 : 600, color: color || (bold ? T.blue : T.textPri) }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <F label="Notes" T={T}>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  placeholder="Optional internal notes…" className="vc-inp"
                  style={{ ...iStyle(T), resize: "vertical", lineHeight: 1.5 }} />
              </F>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10 }}>
              <button className="vc-btn" onClick={handleSubmit} disabled={submitting}
                style={{ flex: 1, padding: "11px 0", background: T.blue, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {submitting ? "Creating…" : <><FaFileInvoiceDollar size={13} /> Create Credit</>}
              </button>
              <button onClick={closeModal}
                style={{ padding: "11px 22px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && selected && (() => {
        const cr = selected;
        const sc = STATUS_CFG[cr.status] || STATUS_CFG.open;
        return (
          <>
            <div className="vc-overlay" onClick={closeDrawer}
              style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />
            <div className="vc-drawer" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 460, maxWidth: "100vw", background: T.surface, borderLeft: `1px solid ${T.border}`, zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>
              <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                    <h3 style={{ fontFamily: "Sora,sans-serif", fontSize: 16, fontWeight: 800, color: T.textPri, margin: 0 }}>Credit Note</h3>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: T.blueLight }}>{cr.creditNumber}</span>
                </div>
                <button onClick={closeDrawer} style={{ width: 30, height: 30, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", color: T.textSec, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><FaTimes size={11} /></button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Info */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Vendor",      value: cr.vendorName || "—" },
                    { label: "Vendor TRN",  value: cr.vendorTrn  || "—", mono: true },
                    { label: "Date",        value: fmtDate(cr.date) },
                    { label: "Reason",      value: cr.reason || "—" },
                    { label: "Linked Bill", value: cr.billNumber || "—", mono: true },
                  ].filter(r => r.value !== "—" || r.label === "Vendor" || r.label === "Date" || r.label === "Reason").map(({ label, value, mono }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <span style={{ fontSize: 12, color: T.textSec }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: mono ? "'DM Mono',monospace" : "inherit" }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Line items */}
                {cr.lineItems?.length > 0 && (
                  <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {cr.lineItems.map((item, i) => (
                      <div key={i} style={{ padding: "11px 14px", borderBottom: i < cr.lineItems.length - 1 ? `1px solid ${T.border}` : "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.description}</p>
                            <p style={{ fontSize: 11, color: T.textSec, margin: "3px 0 0", fontFamily: "'DM Mono',monospace" }}>
                              {item.qty} {item.unit ? `${item.unit} ` : ""}× {fmtAED(item.unitPrice)}
                              {item.discount > 0 && <span style={{ color: "#f59e0b", marginLeft: 6 }}>− {item.discount}%</span>}
                              {item.taxRate > 0 && <span style={{ color: T.textSec, marginLeft: 6 }}>VAT {item.taxRate}%</span>}
                            </p>
                          </div>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, color: T.green, flexShrink: 0, marginLeft: 10 }}>{fmtAED(item.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Subtotal",       value: fmtAED(cr.totals?.subtotal),       bold: false },
                    { label: "Discount",        value: `- ${fmtAED(cr.totals?.discountTotal)}`, bold: false, show: (cr.totals?.discountTotal || 0) > 0, color: "#f59e0b" },
                    { label: "Tax (VAT)",       value: fmtAED(cr.totals?.taxTotal),       bold: false },
                    { label: "Grand Total",     value: fmtAED(cr.totals?.grandTotal),     bold: true  },
                  ].filter(r => r.show !== false).map(({ label, value, bold, color }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none", background: bold ? (isDark ? "rgba(16,185,129,0.06)" : "#f0fdf4") : "transparent" }}>
                      <span style={{ fontSize: 12, color: T.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: bold ? 800 : 600, color: color || (bold ? T.green : T.textPri) }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {cr.status === "open" && (
                <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Bill picker — must select open bill before applying */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>
                      Apply to Bill <span style={{ color: "#ef4444" }}>*</span>
                    </p>
                    <BillDropdown
                      value={applyBillId ? { id: applyBillId, billNumber: applyBillNum } : null}
                      onChange={b => { setApplyBillId(b?.id || ""); setApplyBillNum(b?.billNumber || ""); }}
                      vendorId={cr.vendorId}
                      T={T} isDark={isDark} dropup onlyOpen
                    />
                    {!applyBillId && <p style={{ fontSize: 10, color: "#f59e0b", margin: "4px 0 0" }}>Select an open bill to apply this credit to</p>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                  <button className="vc-btn" disabled={applyingCredit || !applyBillId} onClick={() => handleApplyCredit(cr._id)}
                    style={{ flex: 1, padding: 10, background: applyBillId ? (isDark ? "rgba(16,185,129,0.12)" : "#f0fdf4") : T.surface2, color: applyBillId ? T.green : T.textMuted, border: `1px solid ${applyBillId ? (isDark ? "rgba(16,185,129,0.25)" : "#bbf7d0") : T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: applyBillId ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                    {applyingCredit ? "Applying…" : "Apply Credit"}
                  </button>
                  <button className="vc-btn" onClick={() => handleVoid(cr._id)}
                    style={{ flex: 1, padding: 10, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Void
                  </button>
                  <button className="vc-btn" onClick={closeDrawer}
                    style={{ padding: "10px 16px", background: T.surface2, color: T.textSec, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Close
                  </button>
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </>
  );
}
