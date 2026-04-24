import { useState, useEffect, useRef } from "react";
import {
  FaTimes, FaSearch, FaShippingFast, FaBoxOpen,
  FaChevronLeft, FaChevronRight, FaCheck, FaBan,
  FaClipboardCheck, FaExclamationTriangle, FaTag,
  FaWarehouse, FaTruck, FaFileAlt
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetItem from "../../helper/useGetItem";
import useGetAllSalesOrder from "../../helper/useGetAllSalesOrder";
import useThemeStore, { getTheme } from "../../store/useThemeStore";

// ── Helpers ───────────────────────────────────────────────────────
const parseQty = (v) => {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") { const p = parseInt(v); return isNaN(p) ? 0 : p; }
  return 0;
};
const parseAmt = (v) => {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") { const p = parseFloat(v.replace(/[^\d.-]/g, "")); return isNaN(p) ? 0 : p; }
  return 0;
};
const fmtAED  = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2  = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const TAX_RATE = 0.05;

const buildObTaxGroups = (selItems) => {
  const order = [], groups = {};
  selItems.forEach(item => {
    const price = parseFloat(item.selling_price || 0);
    const qty   = item.outboundQuantity || 0;
    if (!price || !qty) return;
    const key = String(price);
    if (!groups[key]) { groups[key] = { rate: price, base: 0 }; order.push(key); }
    groups[key].base = round2(groups[key].base + qty * price);
  });
  return order.map(key => ({
    rate:       groups[key].rate,
    baseAmount: round2(groups[key].base),
    taxAmount:  round2(groups[key].base * TAX_RATE),
  }));
};

const STATUS_CFG = {
  pending:          { color: "#f59e0b", dim: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)",  label: "Pending"          },
  approved:         { color: "#10b981", dim: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)",  label: "Approved"         },
  rejected:         { color: "#ef4444", dim: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   label: "Rejected"         },
  cancelled:        { color: "#64748b", dim: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.25)", label: "Cancelled"        },
  pending_approval: { color: "#8b5cf6", dim: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.25)",  label: "Awaiting Approval"},
};
const getStatus = (s) => STATUS_CFG[s] || STATUS_CFG.pending;

export default function Outbound() {
  const { handleGetItem, data: itemsData, loading: itemsLoading, error: itemsError } = useGetItem();
  const { handleGetSalesorder, data: salesOrdersData, loading: soLoading, error: soError } = useGetAllSalesOrder();
  const navigate  = useNavigate();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);

  const [drawer,           setDrawer]           = useState(false);
  const [selected,         setSelected]         = useState(null);
  const [searchTerm,       setSearchTerm]       = useState("");
  const [showDrop,         setShowDrop]         = useState(false);
  const [filteredItems,    setFilteredItems]    = useState([]);
  const [outboundItems,    setOutboundItems]    = useState([]);
  const [selectedIds,      setSelectedIds]      = useState(new Set());
  const [outboundNote,     setOutboundNote]     = useState("");
  const [showCancelModal,  setShowCancelModal]  = useState(false);
  const [itemToCancel,     setItemToCancel]     = useState(null);
  const [cancelReason,     setCancelReason]     = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvedItems,    setApprovedItems]    = useState(new Set());
  const [page,             setPage]             = useState(1);
  const perPage = 8;
  const searchRef = useRef(null);

  // ── Data transform ───────────────────────────────────────────
  const findItem = (id) => Array.isArray(itemsData) ? itemsData.find(i => i._id === id) : null;

  const transformItems = () => {
    if (salesOrdersData?.salesOrders?.length) {
      const result = [];
      salesOrdersData.salesOrders.filter(so => !["invoiced","cancelled","completed"].includes(so.status)).forEach(so => {
        (so.items || []).forEach(oi => {
          const inv = findItem(oi.itemId);
          const ordQty = parseQty(oi.quantity);
          const avail  = inv ? parseQty(inv.quantity) : 0;
          const rate   = parseAmt(oi.rate);
          // Always use the pre-computed AED discount value so % discounts display correctly
          const discAED = parseAmt(oi.discountAed ?? oi.discountAED ?? 0);
          const finalUnit = rate - (ordQty > 0 ? discAED / ordQty : 0);
          result.push({
            _id:              oi._id || oi.itemId,
            itemId:           oi.itemId,
            name:             oi.details || inv?.name || `Item ${oi.itemId}`,
            item_code:        inv?.item_code || oi.itemId,
            unit:             oi.unit || inv?.Unit || "Piece",
            description:      oi.details || "",
            rate,
            discount:         discAED,
            discountType:     oi.discountType || "fixed",
            discountRaw:      parseAmt(oi.discount),
            selling_price:    finalUnit.toFixed(2),
            availableQuantity:avail,
            orderedQuantity:  ordQty,
            outboundQuantity: ordQty > 0 ? ordQty : 1,
            maxQuantity:      avail > 0 ? avail : ordQty,
            brand:            inv?.brand || "",
            status:           "pending",
            salesOrderNumber: so.orderNumber,
            salesOrderId:     so.id,
          });
        });
      });
      return result;
    }
    if (Array.isArray(itemsData)) {
      return itemsData.map(i => ({
        _id:              i._id,
        itemId:           i._id,
        name:             i.name || "Unnamed Item",
        item_code:        i.item_code || i._id,
        unit:             i.Unit || "Piece",
        description:      "",
        rate:             parseAmt(i.selling_price),
        discount:         0,
        selling_price:    i.selling_price || "0.00",
        availableQuantity:parseQty(i.quantity),
        orderedQuantity:  1,
        outboundQuantity: 1,
        maxQuantity:      parseQty(i.quantity),
        brand:            i.brand || "",
        status:           "pending",
        salesOrderNumber: null,
        salesOrderId:     null,
      }));
    }
    return [];
  };

  useEffect(() => { handleGetItem(); handleGetSalesorder(); }, []);

  useEffect(() => {
    const items = transformItems();
    if (items.length) {
      const ids = new Set(items.map(i => i._id));
      setSelectedIds(ids);
      setOutboundItems(items.map(i => ({ ...i, isSelected: true })));
    }
  }, [itemsData, salesOrdersData]);

  useEffect(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) { setFilteredItems([]); setShowDrop(false); return; }
    const f = outboundItems.filter(i =>
      i.item_code?.toLowerCase().includes(q) ||
      i.name?.toLowerCase().includes(q) ||
      i.salesOrderNumber?.toLowerCase().includes(q)
    );
    setFilteredItems(f);
    setShowDrop(true);
  }, [searchTerm, outboundItems]);

  useEffect(() => {
    const h = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Actions ──────────────────────────────────────────────────
  const toggleId = (id) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
    setOutboundItems(p => p.map(i => ({ ...i, isSelected: s.has(i._id) })));
  };
  const selectAll   = () => { const s = new Set(outboundItems.map(i => i._id)); setSelectedIds(s); setOutboundItems(p => p.map(i => ({ ...i, isSelected: true }))); };
  const deselectAll = () => { setSelectedIds(new Set()); setOutboundItems(p => p.map(i => ({ ...i, isSelected: false }))); };

  const updateQty = (id, val) => {
    const item = outboundItems.find(i => i._id === id);
    if (!item) return;
    const max = item.availableQuantity > 0 ? item.availableQuantity : item.orderedQuantity;
    const qty = Math.max(1, Math.min(parseInt(val) || 1, max));
    setOutboundItems(p => p.map(i => i._id === id ? { ...i, outboundQuantity: qty } : i));
  };

  const handleSave = () => {
    const sel = outboundItems.filter(i => selectedIds.has(i._id)).map(i => ({
      ...i, quantity: i.outboundQuantity,
      status: requiresApproval ? "pending_approval" : "approved",
      sku: i.sku || i.item_code,
    }));
    const first = sel[0];
    const so = salesOrdersData?.salesOrders?.find(s => s.id === first?.salesOrderId);
    const totalQty   = sel.reduce((s, i) => s + i.outboundQuantity, 0);
    const totalValue = sel.reduce((s, i) => s + i.outboundQuantity * parseFloat(i.selling_price || 0), 0);
    const totalDisc  = sel.reduce((s, i) => s + parseFloat(i.discount || 0), 0);
    const subtotal   = sel.reduce((s, i) => s + i.outboundQuantity * parseFloat(i.rate || 0), 0);
    const dn = `DN-${Date.now().toString().slice(-6).padStart(6, "0")}`;
    navigate("/sales/deliverynote", {
      state: {
        outboundData: {
          items: sel,
          summary: { totalItems: sel.length, totalQuantity: totalQty, totalValue, totalDiscount: totalDisc, subtotal },
          customerInfo: { name: so?.customerName || "Customer", orderNumber: first?.salesOrderNumber || "N/A", orderId: first?.salesOrderId },
          note: outboundNote, requiresApproval,
        },
        deliveryNote: {
          number: dn,
          date: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
          orderNumber: first?.salesOrderNumber || "N/A",
          customer: so?.customerName || "Customer",
          status: "Shipped",
          note: outboundNote,
        },
      },
    });
  };

  const handleCancelRequest = (id) => { setItemToCancel(id); setShowCancelModal(true); };
  const confirmCancel = () => {
    if (!cancelReason.trim()) { alert("Please provide a reason"); return; }
    setOutboundItems(p => p.map(i => i._id === itemToCancel ? { ...i, status: "cancelled", cancelReason, requiresApproval: true } : i));
    const s = new Set(selectedIds); s.delete(itemToCancel); setSelectedIds(s);
    setShowCancelModal(false); setCancelReason(""); setItemToCancel(null);
  };
  const handleApprove = (id) => {
    const s = new Set(approvedItems); s.add(id); setApprovedItems(s);
    setOutboundItems(p => p.map(i => i._id === id ? { ...i, status: "approved" } : i));
  };
  const handleReject = (id) => setOutboundItems(p => p.map(i => i._id === id ? { ...i, status: "rejected" } : i));

  // ── Derived stats ────────────────────────────────────────────
  const selItems    = outboundItems.filter(i => selectedIds.has(i._id));
  const totalQty    = selItems.reduce((s, i) => s + (i.outboundQuantity || 0), 0);
  const totalDisc   = selItems.reduce((s, i) => s + parseFloat(i.discount || 0), 0);
  const subTotal    = round2(selItems.reduce((s, i) => s + (i.outboundQuantity || 0) * parseFloat(i.selling_price || 0), 0));
  const obTaxGroups = buildObTaxGroups(selItems);
  const totalTax    = round2(obTaxGroups.reduce((s, g) => s + g.taxAmount, 0));
  const totalValue  = round2(subTotal + totalTax);
  const stockWarn  = outboundItems.filter(i => i.availableQuantity === 0).length;

  // ── Pagination ───────────────────────────────────────────────
  const totalPages   = Math.max(1, Math.ceil(outboundItems.length / perPage));
  const currentItems = outboundItems.slice((page - 1) * perPage, page * perPage);

  const loading = itemsLoading || soLoading;
  const error   = itemsError   || soError;

  // ── Dynamic CSS ──────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
    .ob-root * { box-sizing: border-box; }
    .ob-root { font-family: 'DM Sans', sans-serif; }
    .ob-jakarta { font-family: 'Sora', sans-serif; }

    .ob-row { transition: background 0.1s; }
    .ob-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .ob-row:hover .ob-name { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .ob-stat { transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: default; }
    .ob-stat:hover { transform: translateY(-2px); box-shadow: ${isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.1)"} !important; }

    .ob-btn { transition: all 0.15s ease; }
    .ob-btn:hover { opacity: 0.85; transform: translateY(-1px); }

    .ob-icon-btn { transition: all 0.12s; }
    .ob-icon-btn:hover { background: ${isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9"} !important; }

    .ob-tab { transition: all 0.15s; border-bottom: 2px solid transparent; cursor: pointer; }
    .ob-tab:hover { color: ${isDark ? "#94a3b8" : "#374151"} !important; }
    .ob-tab-active { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; border-bottom-color: ${isDark ? "#3b82f6" : "#2563eb"} !important; }

    .ob-qty-input { outline: none; -moz-appearance: textfield; }
    .ob-qty-input::-webkit-outer-spin-button,
    .ob-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .ob-qty-input:focus { border-color: ${isDark ? "rgba(59,130,246,0.6)" : "#93c5fd"} !important; box-shadow: 0 0 0 3px ${isDark ? "rgba(59,130,246,0.12)" : "rgba(147,197,253,0.25)"} !important; }

    .ob-note:focus { outline: none; border-color: ${isDark ? "rgba(59,130,246,0.5)" : "#93c5fd"} !important; box-shadow: 0 0 0 3px ${isDark ? "rgba(59,130,246,0.1)" : "rgba(147,197,253,0.2)"} !important; }

    .search-item:hover { background: ${isDark ? "rgba(59,130,246,0.08)" : "#eff6ff"} !important; }

    /* ── Custom scrollbar — global + local ─────── */
    html, body, * { scrollbar-width: thin; scrollbar-color: ${isDark ? "rgba(255,255,255,0.12) transparent" : "rgba(0,0,0,0.14) transparent"}; }
    html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { width: 5px; height: 5px; }
    html::-webkit-scrollbar-track, body::-webkit-scrollbar-track, *::-webkit-scrollbar-track { background: transparent; }
    html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.13)"}; border-radius: 999px; transition: background 0.2s; }
    html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover, *::-webkit-scrollbar-thumb:hover { background: ${isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.24)"}; }
    html::-webkit-scrollbar-corner, body::-webkit-scrollbar-corner, *::-webkit-scrollbar-corner { background: transparent; }

    @keyframes slideIn  { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeUp   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin     { to { transform: rotate(360deg); } }
    @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

    .ob-slide  { animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .ob-fade   { animation: fadeIn 0.2s ease forwards; }
    .ob-up     { animation: fadeUp 0.3s ease both; }
    .ob-up-1   { animation: fadeUp 0.3s 0.05s ease both; }
    .ob-up-2   { animation: fadeUp 0.3s 0.10s ease both; }
    .ob-spin   { animation: spin 0.8s linear infinite; }
    .ob-pulse  { animation: pulse 1.8s ease infinite; }

    .qty-btn { transition: background 0.1s, color 0.1s; }
    .qty-btn:hover { background: ${isDark ? "rgba(59,130,246,0.18)" : "#dbeafe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .pg-btn { transition: all 0.12s; }
    .pg-btn:hover:not(:disabled) { border-color: ${isDark ? "rgba(59,130,246,0.4)" : "#93c5fd"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
  `;

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", transition: "background 0.25s, border-color 0.25s" };

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: T.bg }}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <div className="ob-spin" style={{ width: "36px", height: "36px", border: `3px solid ${T.border}`, borderTopColor: T.blue, borderRadius: "50%" }} />
        <span style={{ color: T.textSec, fontSize: "13px", fontFamily: "'DM Sans', sans-serif" }}>Preparing outbound items…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="ob-root" style={{ padding: "24px", background: T.bg, minHeight: "100vh" }}>
      <style>{css}</style>
      <div style={{ ...card, padding: "24px", display: "flex", alignItems: "center", gap: "14px", maxWidth: "480px", margin: "40px auto" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", flexShrink: 0, fontSize: "18px" }}>
          <FaExclamationTriangle />
        </div>
        <div style={{ flex: 1 }}>
          <p className="ob-jakarta" style={{ fontWeight: "700", color: T.textPri, margin: "0 0 4px", fontSize: "14px" }}>Failed to load data</p>
          <p style={{ color: T.textSec, fontSize: "12px", margin: "0 0 12px" }}>{error}</p>
          <button className="ob-btn" onClick={() => { handleGetItem(); handleGetSalesorder(); }}
            style={{ padding: "7px 18px", background: T.blue, color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
            Retry
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      <div className="ob-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div className="ob-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: T.blueDim, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                <FaTruck />
              </div>
              <h1 className="ob-jakarta" style={{ fontSize: "19px", fontWeight: "800", color: T.textPri, margin: 0 }}>Outbound</h1>
            </div>
            <p style={{ color: T.textSec, fontSize: "12px", margin: 0, paddingLeft: "42px" }}>
              Prepare and dispatch items from sales orders
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Search */}
            <div ref={searchRef} style={{ position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: "11px", pointerEvents: "none" }} />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                onFocus={() => searchTerm.trim() && setShowDrop(true)}
                placeholder="Search items, orders…"
                style={{ padding: "8px 32px 8px 32px", width: "240px", border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "12px", background: T.surface, color: T.textPri, fontFamily: "inherit" }} />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(""); setShowDrop(false); }}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}>
                  <FaTimes size={10} />
                </button>
              )}
              {/* Search dropdown */}
              {showDrop && filteredItems.length > 0 && (
                <div className="ob-search-drop" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: "11px", boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)", maxHeight: "260px", overflowY: "auto" }}>
                  <div style={{ padding: "8px 12px", fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}` }}>
                    {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""}
                  </div>
                  {filteredItems.map(item => (
                    <div key={item._id} className="search-item" onClick={() => { setSelected(item); setDrawer(true); setShowDrop(false); setSearchTerm(""); }}
                      style={{ padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", gap: "10px", alignItems: "center" }}>
                      <div style={{ width: "30px", height: "30px", borderRadius: "7px", background: T.blueDim, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>
                        <FaBoxOpen />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</p>
                        <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0" }}>{item.item_code}{item.salesOrderNumber ? ` · ${item.salesOrderNumber}` : ""}</p>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: item.availableQuantity === 0 ? "#ef4444" : T.green }}>
                        {item.availableQuantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save button */}
            <button className="ob-btn" onClick={handleSave} disabled={selectedIds.size === 0}
              style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 18px", background: selectedIds.size === 0 ? T.surface2 : T.blue, color: selectedIds.size === 0 ? T.textMuted : "white", border: `1px solid ${selectedIds.size === 0 ? T.border : "transparent"}`, borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: selectedIds.size === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              <FaShippingFast size={12} />
              Create Delivery Note
              {selectedIds.size > 0 && <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: "999px", padding: "1px 7px", fontSize: "11px" }}>{selectedIds.size}</span>}
            </button>
          </div>
        </div>

        {/* ── STAT CARDS ─────────────────────────────────────── */}
        <div className="ob-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "18px" }}>
          {[
            { label: "Total Items",    value: outboundItems.length,          icon: <FaWarehouse />,      color: T.blue,   dim: T.blueDim,   sub: `${selectedIds.size} selected` },
            { label: "Selected Value", value: fmtAED(totalValue),            icon: <FaTag />,            color: T.green,  dim: T.greenDim,  sub: `${totalQty} units total`, small: true },
            { label: "Total Discount", value: fmtAED(totalDisc),             icon: <FaFileAlt />,        color: T.purple, dim: T.purpleDim, sub: "Across selected items", small: true },
            { label: "Stock Warnings", value: stockWarn,                     icon: <FaExclamationTriangle />, color: stockWarn > 0 ? "#ef4444" : T.green, dim: stockWarn > 0 ? "rgba(239,68,68,0.12)" : T.greenDim, sub: stockWarn > 0 ? "Items with 0 stock" : "All stocked" },
          ].map((c, i) => (
            <div key={i} className="ob-stat" style={{ ...card, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, transparent 10%, ${c.color}55, transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.label}</p>
                <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: c.dim, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>{c.icon}</div>
              </div>
              <p className="ob-jakarta" style={{ fontSize: c.small ? "14px" : "22px", fontWeight: "800", color: T.textPri, margin: "0 0 6px", lineHeight: 1 }}>{c.value}</p>
              <p style={{ fontSize: "11px", color: T.textSec, margin: 0 }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── CONTROLS BAR ───────────────────────────────────── */}
        <div className="ob-up-2" style={{ ...card, padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          {/* Select all checkbox */}
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox"
              checked={selectedIds.size === outboundItems.length && outboundItems.length > 0}
              onChange={e => e.target.checked ? selectAll() : deselectAll()}
              style={{ accentColor: T.blue, width: "15px", height: "15px" }} />
            <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500" }}>
              {selectedIds.size} of {outboundItems.length} selected
            </span>
          </label>

          <div style={{ width: "1px", height: "20px", background: T.border }} />

          {/* Approval toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
            <div onClick={() => setRequiresApproval(v => !v)}
              style={{ width: "36px", height: "20px", borderRadius: "999px", background: requiresApproval ? T.blue : (isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"), position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: "2px", left: requiresApproval ? "18px" : "2px", width: "16px", height: "16px", borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
            </div>
            <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500" }}>Requires Approval</span>
          </label>

          <div style={{ width: "1px", height: "20px", background: T.border }} />

          {/* Note input */}
          <input value={outboundNote} onChange={e => setOutboundNote(e.target.value)}
            placeholder="Add dispatch note (optional)…"
            style={{ flex: 1, minWidth: "200px", padding: "7px 12px", border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: "12px", background: T.surface2, color: T.textPri, fontFamily: "inherit" }} />

          {/* Stock warning badge */}
          {stockWarn > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "7px" }}>
              <FaExclamationTriangle size={10} color="#ef4444" />
              <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "600" }}>{stockWarn} out of stock</span>
            </div>
          )}
        </div>

        {/* ── TABLE ──────────────────────────────────────────── */}
        <div style={{ ...card, overflow: "hidden", marginBottom: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                <th style={{ padding: "11px 14px", width: "32px" }}>
                  <input type="checkbox" style={{ accentColor: T.blue }}
                    checked={selectedIds.size === outboundItems.length && outboundItems.length > 0}
                    onChange={e => e.target.checked ? selectAll() : deselectAll()} />
                </th>
                {["Item", "Available", "Ordered", "Dispatch Qty", "Status", "Sales Order", "Price / Unit", "VAT (5%)", "Line Total", "Actions"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 14px", textAlign: i >= 6 ? "right" : "left", fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? currentItems.map((item) => {
                const sc = getStatus(item.status);
                const isZeroStock = item.availableQuantity === 0;
                const hasDiscount = item.discount > 0;
                return (
                  <tr key={item._id} className="ob-row" style={{ borderBottom: `1px solid ${T.border || T.border}` }}>
                    <td style={{ padding: "12px 14px" }}>
                      <input type="checkbox" style={{ accentColor: T.blue }}
                        checked={selectedIds.has(item._id)}
                        onChange={() => toggleId(item._id)} />
                    </td>

                    {/* Item */}
                    <td style={{ padding: "12px 14px", maxWidth: "220px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.textSec, fontSize: "13px", flexShrink: 0 }}>
                          <FaBoxOpen />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p className="ob-name" onClick={() => { setSelected(item); setDrawer(true); }}
                            style={{ fontSize: "13px", fontWeight: "700", color: T.blue, margin: 0, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.15s" }}>
                            {item.name}
                          </p>
                          <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0", fontFamily: "'DM Mono', monospace" }}>{item.item_code}</p>
                          {hasDiscount && (
                            <p style={{ fontSize: "10px", color: "#f59e0b", margin: "2px 0 0", fontWeight: "600" }}>
                              Disc: {fmtAED(item.discount)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Available qty */}
                    <td style={{ padding: "12px 14px" }}>
                      <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: isZeroStock ? "#ef4444" : T.green }}>
                        {item.availableQuantity}
                      </span>
                      <span style={{ fontSize: "11px", color: T.textSec, marginLeft: "4px" }}>{item.unit}</span>
                      {isZeroStock && <span className="ob-pulse" style={{ display: "block", fontSize: "10px", color: "#ef4444", fontWeight: "600", marginTop: "2px" }}>Out of stock</span>}
                    </td>

                    {/* Ordered qty */}
                    <td style={{ padding: "12px 14px" }}>
                      <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "600", color: T.textPri }}>{item.orderedQuantity}</span>
                      <span style={{ fontSize: "11px", color: T.textSec, marginLeft: "4px" }}>{item.unit}</span>
                    </td>

                    {/* Dispatch qty — custom stepper */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <button className="qty-btn" onClick={() => updateQty(item._id, (item.outboundQuantity || 1) - 1)}
                          style={{ width: "24px", height: "24px", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.surface2, color: T.textSec, cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          −
                        </button>
                        <input type="number" min="1" max={item.maxQuantity} value={item.outboundQuantity}
                          onChange={e => updateQty(item._id, parseInt(e.target.value) || 1)}
                          className="ob-qty-input"
                          style={{ width: "44px", height: "24px", textAlign: "center", border: `1px solid ${T.border}`, borderRadius: "6px", background: T.surface2, color: T.textPri, fontSize: "12px", fontWeight: "600", fontFamily: "inherit" }} />
                        <button className="qty-btn" onClick={() => updateQty(item._id, (item.outboundQuantity || 1) + 1)}
                          style={{ width: "24px", height: "24px", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.surface2, color: T.textSec, cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          +
                        </button>
                      </div>
                      <p style={{ fontSize: "10px", color: T.textMuted, margin: "3px 0 0 0" }}>max {item.maxQuantity}</p>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: sc.dim, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: "nowrap" }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                        {sc.label}
                      </span>
                    </td>

                    {/* Sales order */}
                    <td style={{ padding: "12px 14px" }}>
                      {item.salesOrderNumber ? (
                        <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: T.blueDim, color: T.blueLight, border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, fontFamily: "'DM Mono', monospace" }}>
                          {item.salesOrderNumber}
                        </span>
                      ) : <span style={{ color: T.textMuted, fontSize: "12px" }}>—</span>}
                    </td>

                    {/* Price / Unit */}
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      {item.rate > parseFloat(item.selling_price) && (
                        <p style={{ fontSize: "10px", color: T.textMuted, textDecoration: "line-through", margin: "0 0 1px", fontFamily: "'DM Mono', monospace" }}>{fmtAED(item.rate)}</p>
                      )}
                      <p className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: item.rate > parseFloat(item.selling_price) ? T.green : T.textPri, margin: 0, fontFamily: "'DM Mono', monospace" }}>
                        {fmtAED(item.selling_price)}
                      </p>
                      <p style={{ fontSize: "10px", color: T.textMuted, margin: "1px 0 0" }}>excl. VAT</p>
                    </td>

                    {/* VAT (5%) */}
                    {(() => {
                      const unitPrice = parseFloat(item.selling_price || 0);
                      const qty       = item.outboundQuantity || 0;
                      const lineBase  = round2(unitPrice * qty);
                      const lineVat   = round2(lineBase * TAX_RATE);
                      return (
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <p style={{ fontSize: "12px", fontWeight: "700", color: "#f59e0b", margin: 0, fontFamily: "'DM Mono', monospace" }}>{fmtAED(lineVat)}</p>
                          <p style={{ fontSize: "10px", color: T.textMuted, margin: "1px 0 0" }}>{fmtAED(lineBase)} × 5%</p>
                        </td>
                      );
                    })()}

                    {/* Line Total (incl. VAT) */}
                    {(() => {
                      const unitPrice  = parseFloat(item.selling_price || 0);
                      const qty        = item.outboundQuantity || 0;
                      const lineBase   = round2(unitPrice * qty);
                      const lineVat    = round2(lineBase * TAX_RATE);
                      const lineTotal  = round2(lineBase + lineVat);
                      return (
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <p className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "800", color: T.blue, margin: 0, fontFamily: "'DM Mono', monospace" }}>{fmtAED(lineTotal)}</p>
                          <p style={{ fontSize: "10px", color: T.textMuted, margin: "1px 0 0" }}>incl. VAT</p>
                        </td>
                      );
                    })()}

                    {/* Actions */}
                    <td style={{ padding: "12px 10px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                        {item.status === "pending_approval" && requiresApproval && (
                          <>
                            <button className="ob-icon-btn" onClick={() => handleApprove(item._id)}
                              style={{ padding: "5px 9px", borderRadius: "7px", border: `1px solid rgba(16,185,129,0.25)`, background: "rgba(16,185,129,0.1)", color: "#10b981", cursor: "pointer", fontSize: "11px", fontWeight: "600", fontFamily: "inherit" }}>
                              <FaCheck size={9} />
                            </button>
                            <button className="ob-icon-btn" onClick={() => handleReject(item._id)}
                              style={{ padding: "5px 9px", borderRadius: "7px", border: `1px solid rgba(239,68,68,0.25)`, background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontSize: "11px", fontWeight: "600", fontFamily: "inherit" }}>
                              <FaTimes size={9} />
                            </button>
                          </>
                        )}
                        <button className="ob-icon-btn" onClick={() => handleCancelRequest(item._id)}
                          disabled={item.status === "cancelled" || item.status === "approved"}
                          style={{ padding: "5px 9px", borderRadius: "7px", border: `1px solid ${T.border}`, background: "transparent", color: item.status === "cancelled" || item.status === "approved" ? T.textMuted : T.textSec, cursor: item.status === "cancelled" || item.status === "approved" ? "not-allowed" : "pointer", fontSize: "11px", fontWeight: "600", fontFamily: "inherit" }}>
                          <FaBan size={9} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="9" style={{ padding: "64px 20px", textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: T.textSec }}>
                        <FaBoxOpen />
                      </div>
                      <p className="ob-jakarta" style={{ fontWeight: "700", color: T.textPri, fontSize: "15px", margin: 0 }}>No outbound items</p>
                      <p style={{ color: T.textSec, fontSize: "13px", margin: 0 }}>No sales order items found for dispatch</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ─────────────────────────────────────── */}
        {outboundItems.length > 0 && (
          <div style={{ ...card, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", color: T.textSec }}>
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, outboundItems.length)} of {outboundItems.length} items
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "5px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", color: page === 1 ? T.textMuted : T.textSec, cursor: page === 1 ? "not-allowed" : "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                <FaChevronLeft size={9} /> Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className="pg-btn" onClick={() => setPage(p)}
                  style={{ padding: "5px 10px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${page === p ? "rgba(59,130,246,0.35)" : T.border}`, background: page === p ? T.blueDim : "transparent", color: page === p ? T.blueLight : T.textSec }}>
                  {p}
                </button>
              ))}
              <button className="pg-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "5px 10px", border: `1px solid ${T.border}`, borderRadius: "7px", background: "transparent", color: page === totalPages ? T.textMuted : T.textSec, cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}>
                Next <FaChevronRight size={9} />
              </button>
            </div>
            <span style={{ fontSize: "12px", color: T.textSec }}>{totalPages} page{totalPages !== 1 ? "s" : ""}</span>
          </div>
        )}

        {/* ── SUMMARY FOOTER ─────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div style={{ ...card, padding: "18px 22px", background: isDark ? "rgba(59,130,246,0.04)" : "#f8faff", borderColor: isDark ? "rgba(59,130,246,0.15)" : "#dbeafe" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>

              {/* Left — quick stats */}
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
                {[
                  { label: "Items",      value: selectedIds.size },
                  { label: "Total Units", value: `${totalQty} pcs` },
                  { label: "Discount",   value: fmtAED(totalDisc), red: totalDisc > 0 },
                ].map(({ label, value, red }) => (
                  <div key={label}>
                    <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 3px" }}>{label}</p>
                    <p className="ob-jakarta" style={{ fontSize: "14px", fontWeight: "700", color: red ? "#ef4444" : T.textPri, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Centre — tax breakdown box */}
              <div style={{ flex: 1, minWidth: "220px", maxWidth: "340px", background: isDark ? "rgba(245,158,11,0.06)" : "#fffbeb", border: `1.5px solid ${isDark ? "rgba(245,158,11,0.2)" : "#fde68a"}`, borderRadius: "10px", padding: "10px 14px" }}>
                <p style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: ".07em", color: "#f59e0b", margin: "0 0 7px" }}>VAT 5% — Grouped by Rate</p>
                {obTaxGroups.length === 0 && (
                  <p style={{ fontSize: "12px", color: T.textSec, margin: 0 }}>—</p>
                )}
                {obTaxGroups.map((g, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < obTaxGroups.length - 1 ? `1px solid ${isDark ? "rgba(245,158,11,0.12)" : "#fef3c7"}` : "none" }}>
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>Rate {fmtAED(g.rate)}</p>
                      <p style={{ fontSize: "10px", color: T.textSec, margin: "1px 0 0", fontFamily: "'DM Mono', monospace" }}>{fmtAED(g.baseAmount)} × 5%</p>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>{fmtAED(g.taxAmount)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1.5px solid ${isDark ? "rgba(245,158,11,0.25)" : "#fcd34d"}`, marginTop: "7px", paddingTop: "7px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#f59e0b" }}>Total VAT (5%)</span>
                  <span style={{ fontSize: "13px", fontWeight: "800", color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>{fmtAED(totalTax)}</span>
                </div>
              </div>

              {/* Right — grand total + action */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 3px" }}>Grand Total (incl. VAT)</p>
                  <p className="ob-jakarta" style={{ fontSize: "20px", fontWeight: "800", color: T.blue, margin: 0, fontFamily: "'DM Mono', monospace" }}>{fmtAED(totalValue)}</p>
                </div>
                <button className="ob-btn" onClick={handleSave}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 22px", background: T.blue, color: "white", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>
                  <FaShippingFast size={13} /> Create Delivery Note
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── CANCEL MODAL ──────────────────────────────────────── */}
      {showCancelModal && (
        <>
          <div className="ob-fade" onClick={() => { setShowCancelModal(false); setCancelReason(""); }}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.75)" : "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", zIndex: 100 }} />
          <div className="ob-up" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 101, width: "400px", maxWidth: "calc(100vw - 32px)", ...card, padding: "24px", boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.6)" : "0 16px 48px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                <FaBan />
              </div>
              <div>
                <h3 className="ob-jakarta" style={{ fontSize: "15px", fontWeight: "700", color: T.textPri, margin: 0 }}>Cancel Item</h3>
                <p style={{ fontSize: "12px", color: T.textSec, margin: "2px 0 0" }}>This will require manager approval</p>
              </div>
            </div>
            <label style={{ fontSize: "11px", fontWeight: "600", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "6px" }}>
              Reason for Cancellation <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="Please describe the reason…"
              rows={3}
              className="ob-note"
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "12px", background: T.surface2, color: T.textPri, fontFamily: "inherit", resize: "none" }} />
            <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button className="ob-btn" onClick={() => { setShowCancelModal(false); setCancelReason(""); }}
                style={{ padding: "8px 18px", border: `1px solid ${T.border}`, borderRadius: "9px", background: "transparent", color: T.textSec, fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                Dismiss
              </button>
              <button className="ob-btn" onClick={confirmCancel}
                style={{ padding: "8px 18px", background: "#ef4444", color: "white", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                Submit for Approval
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── ITEM DRAWER ───────────────────────────────────────── */}
      {drawer && (
        <>
          <div className="ob-fade" onClick={() => { setDrawer(false); setSelected(null); }}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />
          <div className="ob-slide"
            style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "420px", maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

            {selected && (() => {
              const sc = getStatus(selected.status);
              return (
                <>
                  {/* Drawer header */}
                  <div style={{ padding: "20px 20px 0", borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                          <h3 className="ob-jakarta" style={{ fontSize: "15px", fontWeight: "800", color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</h3>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "11px", fontFamily: "'DM Mono', monospace", color: T.textSec }}>{selected.item_code}</span>
                          <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px", background: sc.dim, color: sc.color, border: `1px solid ${sc.border}`, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: sc.color, display: "inline-block" }} />{sc.label}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => { setDrawer(false); setSelected(null); }}
                        style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", padding: "6px", cursor: "pointer", color: T.textSec, display: "flex", flexShrink: 0, marginLeft: "10px" }}>
                        <FaTimes size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Drawer body */}
                  <div className="ob-drawer-body" style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Qty overview */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "Available", value: selected.availableQuantity, unit: selected.unit, warn: selected.availableQuantity === 0 },
                        { label: "Ordered",   value: selected.orderedQuantity,   unit: selected.unit },
                        { label: "Dispatch",  value: selected.outboundQuantity,  unit: selected.unit, blue: true },
                      ].map(({ label, value, unit, warn, blue }) => (
                        <div key={label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 14px", textAlign: "center" }}>
                          <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>{label}</p>
                          <p className="ob-jakarta" style={{ fontSize: "18px", fontWeight: "800", color: warn ? "#ef4444" : blue ? T.blue : T.textPri, margin: 0, lineHeight: 1 }}>{value}</p>
                          <p style={{ fontSize: "10px", color: T.textSec, margin: "3px 0 0" }}>{unit}</p>
                        </div>
                      ))}
                    </div>

                    {/* Sales order */}
                    {selected.salesOrderNumber && (
                      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "13px 14px" }}>
                        <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Linked Sales Order</p>
                        <span style={{ fontSize: "12px", fontWeight: "700", padding: "4px 10px", borderRadius: "7px", background: T.blueDim, color: T.blueLight, border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, fontFamily: "'DM Mono', monospace" }}>
                          {selected.salesOrderNumber}
                        </span>
                      </div>
                    )}

                    {/* Pricing breakdown */}
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
                      <div style={{ padding: "11px 14px", borderBottom: `1px solid ${T.border}` }}>
                        <p className="ob-jakarta" style={{ fontSize: "11px", fontWeight: "700", color: T.textPri, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pricing</p>
                      </div>
                      {[
                        { label: "Original Rate",  value: fmtAED(selected.rate) },
                        selected.discount > 0 && { label: "Discount",       value: `− ${fmtAED(selected.discount)}`, red: true },
                        { label: "Price / unit",   value: fmtAED(selected.selling_price) },
                      ].filter(Boolean).map(({ label, value, red }) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: "12px", color: T.textSec }}>{label}</span>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: red ? "#ef4444" : T.textPri }}>{value}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: isDark ? "rgba(59,130,246,0.06)" : "#eff6ff" }}>
                        <span className="ob-jakarta" style={{ fontSize: "12px", fontWeight: "700", color: T.textPri }}>Line Total</span>
                        <span className="ob-jakarta" style={{ fontSize: "15px", fontWeight: "800", color: T.blue }}>
                          {fmtAED((selected.outboundQuantity || 1) * parseFloat(selected.selling_price || 0))}
                        </span>
                      </div>
                    </div>

                    {/* Dispatch qty adjuster */}
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px" }}>
                      <p style={{ fontSize: "11px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Adjust Dispatch Qty</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button className="qty-btn" onClick={() => updateQty(selected._id, (selected.outboundQuantity || 1) - 1)}
                          style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <input type="number" min="1" max={selected.maxQuantity} value={selected.outboundQuantity}
                          onChange={e => { updateQty(selected._id, parseInt(e.target.value) || 1); setSelected(prev => ({ ...prev, outboundQuantity: Math.max(1, Math.min(parseInt(e.target.value) || 1, prev.maxQuantity)) })); }}
                          className="ob-qty-input"
                          style={{ flex: 1, height: "32px", textAlign: "center", border: `1px solid ${T.border}`, borderRadius: "8px", background: T.surface, color: T.textPri, fontSize: "14px", fontWeight: "700", fontFamily: "inherit" }} />
                        <button className="qty-btn" onClick={() => updateQty(selected._id, (selected.outboundQuantity || 1) + 1)}
                          style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                      <p style={{ fontSize: "11px", color: T.textSec, margin: "7px 0 0" }}>Max dispatchable: <strong>{selected.maxQuantity}</strong></p>
                    </div>
                  </div>

                  {/* Drawer footer */}
                  <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "8px" }}>
                    <button className="ob-btn" onClick={() => handleCancelRequest(selected._id)}
                      disabled={selected.status === "cancelled" || selected.status === "approved"}
                      style={{ flex: 1, padding: "9px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "9px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: selected.status === "cancelled" || selected.status === "approved" ? 0.5 : 1 }}>
                      <FaBan size={11} /> Cancel
                    </button>
                    {selected.status === "pending_approval" && requiresApproval && (
                      <>
                        <button className="ob-btn" onClick={() => { handleApprove(selected._id); setDrawer(false); }}
                          style={{ flex: 1, padding: "9px", background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "9px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <FaCheck size={10} /> Approve
                        </button>
                        <button className="ob-btn" onClick={() => { handleReject(selected._id); setDrawer(false); }}
                          style={{ flex: 1, padding: "9px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "9px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <FaTimes size={10} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </>
      )}
    </>
  );
}