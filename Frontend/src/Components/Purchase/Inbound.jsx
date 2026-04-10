import { useState, useEffect, useRef } from "react";
import {
  FaTimes, FaSearch, FaBoxOpen, FaChevronLeft, FaChevronRight,
  FaCheck, FaBan, FaExclamationTriangle, FaTag, FaWarehouse,
  FaFileInvoice, FaClipboardList,
} from "react-icons/fa";
import { MdMoveToInbox } from "react-icons/md";
import useThemeStore, { getTheme } from "../../store/useThemeStore";

// ── Helpers ───────────────────────────────────────────────────────
const fmtAED  = (n) =>
  `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2  = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const TAX_RATE = 0.05;

const buildInboundTaxGroups = (selItems) => {
  const order = [], groups = {};
  selItems.forEach(item => {
    const price = parseFloat(item.costPrice || 0);
    const qty   = item.receiveQty || 0;
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
  received:         { color: "#10b981", dim: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)",  label: "Received"         },
  rejected:         { color: "#ef4444", dim: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   label: "Rejected"         },
  cancelled:        { color: "#64748b", dim: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.25)", label: "Cancelled"        },
  pending_approval: { color: "#8b5cf6", dim: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.25)",  label: "Awaiting Approval"},
};
const getStatus = (s) => STATUS_CFG[s] || STATUS_CFG.pending;

// ── Mock data ─────────────────────────────────────────────────────
const MOCK_ITEMS = [
  { _id: "1", name: "Steel Pipe 2\"",      item_code: "SP-200",  unit: "Pcs", vendor: "Al Futtaim Trading",  poNumber: "PO-2024-001", orderedQty: 100, stockOnHand: 40,  costPrice: 45.00,  receiveQty: 100, status: "pending"          },
  { _id: "2", name: "PVC Elbow 90° 1\"",  item_code: "PE-100",  unit: "Pcs", vendor: "Gulf Supplies LLC",   poNumber: "PO-2024-002", orderedQty: 200, stockOnHand: 18,  costPrice: 3.50,   receiveQty: 200, status: "pending"          },
  { _id: "3", name: "Copper Wire 6mm",    item_code: "CW-006",  unit: "Mtr", vendor: "Emirates Wholesale",  poNumber: "PO-2024-003", orderedQty: 500, stockOnHand: 0,   costPrice: 12.00,  receiveQty: 500, status: "pending_approval" },
  { _id: "4", name: "Hydraulic Pump 5HP", item_code: "HP-005",  unit: "Pcs", vendor: "Nasser Trading Co.",  poNumber: "PO-2024-004", orderedQty: 5,   stockOnHand: 12,  costPrice: 850.00, receiveQty: 5,   status: "pending"          },
  { _id: "5", name: "Safety Gloves L",    item_code: "SG-L",    unit: "Pair",vendor: "Al Ain Distribution", poNumber: "PO-2024-005", orderedQty: 50,  stockOnHand: 7,   costPrice: 8.00,   receiveQty: 50,  status: "pending"          },
  { _id: "6", name: "Industrial Bolt M12",item_code: "IB-M12",  unit: "Box", vendor: "Al Futtaim Trading",  poNumber: "PO-2024-001", orderedQty: 20,  stockOnHand: 55,  costPrice: 22.00,  receiveQty: 20,  status: "received"         },
  { _id: "7", name: "Air Filter 12\"",    item_code: "AF-012",  unit: "Pcs", vendor: "Gulf Supplies LLC",   poNumber: "PO-2024-002", orderedQty: 10,  stockOnHand: 3,   costPrice: 65.00,  receiveQty: 10,  status: "pending"          },
  { _id: "8", name: "Valve Ball 1/2\"",   item_code: "VB-050",  unit: "Pcs", vendor: "Emirates Wholesale",  poNumber: "PO-2024-003", orderedQty: 30,  stockOnHand: 0,   costPrice: 18.00,  receiveQty: 30,  status: "pending"          },
];

export default function Inbound() {
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);

  const [items,            setItems]            = useState(MOCK_ITEMS.map(i => ({ ...i })));
  const [selectedIds,      setSelectedIds]      = useState(new Set(MOCK_ITEMS.map(i => i._id)));
  const [searchTerm,       setSearchTerm]       = useState("");
  const [showDrop,         setShowDrop]         = useState(false);
  const [filteredItems,    setFilteredItems]    = useState([]);
  const [drawer,           setDrawer]           = useState(false);
  const [selected,         setSelected]         = useState(null);
  const [inboundNote,      setInboundNote]      = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvedItems,    setApprovedItems]    = useState(new Set());
  const [showCancelModal,  setShowCancelModal]  = useState(false);
  const [itemToCancel,     setItemToCancel]     = useState(null);
  const [cancelReason,     setCancelReason]     = useState("");
  const [page,             setPage]             = useState(1);
  const perPage   = 8;
  const searchRef = useRef(null);

  // ── Search filter ────────────────────────────────────────────────
  useEffect(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) { setFilteredItems([]); setShowDrop(false); return; }
    const f = items.filter(i =>
      i.item_code?.toLowerCase().includes(q) ||
      i.name?.toLowerCase().includes(q) ||
      i.poNumber?.toLowerCase().includes(q)
    );
    setFilteredItems(f);
    setShowDrop(true);
  }, [searchTerm, items]);

  useEffect(() => {
    const h = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────
  const toggleId   = (id) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };
  const selectAll   = () => setSelectedIds(new Set(items.map(i => i._id)));
  const deselectAll = () => setSelectedIds(new Set());

  const updateQty = (id, val) => {
    setItems(p => p.map(i => {
      if (i._id !== id) return i;
      const qty = Math.max(1, Math.min(parseInt(val) || 1, i.orderedQty));
      return { ...i, receiveQty: qty };
    }));
    if (selected?._id === id) {
      setSelected(prev => {
        const qty = Math.max(1, Math.min(parseInt(val) || 1, prev.orderedQty));
        return { ...prev, receiveQty: qty };
      });
    }
  };

  const handleReceive = () => {
    const sel = items.filter(i => selectedIds.has(i._id));
    setItems(p => p.map(i => selectedIds.has(i._id) ? { ...i, status: requiresApproval ? "pending_approval" : "received" } : i));
    alert(`Received ${sel.length} item(s). GRN would be created here.`);
  };

  const handleCancelRequest = (id) => { setItemToCancel(id); setShowCancelModal(true); };
  const confirmCancel = () => {
    if (!cancelReason.trim()) { alert("Please provide a reason"); return; }
    setItems(p => p.map(i => i._id === itemToCancel ? { ...i, status: "cancelled" } : i));
    const s = new Set(selectedIds); s.delete(itemToCancel); setSelectedIds(s);
    setShowCancelModal(false); setCancelReason(""); setItemToCancel(null);
  };
  const handleApprove = (id) => {
    const s = new Set(approvedItems); s.add(id); setApprovedItems(s);
    setItems(p => p.map(i => i._id === id ? { ...i, status: "received" } : i));
  };
  const handleReject = (id) => setItems(p => p.map(i => i._id === id ? { ...i, status: "rejected" } : i));

  // ── Derived stats ─────────────────────────────────────────────────
  const selItems       = items.filter(i => selectedIds.has(i._id));
  const totalQty       = selItems.reduce((s, i) => s + (i.receiveQty || 0), 0);
  const subTotal       = round2(selItems.reduce((s, i) => s + (i.receiveQty || 0) * (i.costPrice || 0), 0));
  const inboundTaxGroups = buildInboundTaxGroups(selItems);
  const totalTax       = round2(inboundTaxGroups.reduce((s, g) => s + g.taxAmount, 0));
  const totalValue     = round2(subTotal + totalTax);
  const zeroStock   = items.filter(i => i.stockOnHand === 0).length;

  // ── Pagination ────────────────────────────────────────────────────
  const totalPages   = Math.max(1, Math.ceil(items.length / perPage));
  const currentItems = items.slice((page - 1) * perPage, page * perPage);

  // ── Dynamic CSS ───────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
    .ob-root * { box-sizing: border-box; }
    .ob-root { font-family: 'DM Sans', sans-serif; }
    .ob-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }

    .ob-row { transition: background 0.1s; }
    .ob-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    .ob-row:hover .ob-name { color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .ob-stat { transition: transform 0.18s ease, box-shadow 0.18s ease; cursor: default; }
    .ob-stat:hover { transform: translateY(-2px); box-shadow: ${isDark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.1)"} !important; }

    .ob-btn { transition: all 0.15s ease; }
    .ob-btn:hover { opacity: 0.85; transform: translateY(-1px); }

    .ob-icon-btn { transition: all 0.12s; }
    .ob-icon-btn:hover { background: ${isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9"} !important; }

    .ob-qty-input { outline: none; -moz-appearance: textfield; }
    .ob-qty-input::-webkit-outer-spin-button,
    .ob-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .ob-qty-input:focus { border-color: ${isDark ? "rgba(59,130,246,0.6)" : "#93c5fd"} !important; box-shadow: 0 0 0 3px ${isDark ? "rgba(59,130,246,0.12)" : "rgba(147,197,253,0.25)"} !important; }

    .ob-note:focus { outline: none; border-color: ${isDark ? "rgba(59,130,246,0.5)" : "#93c5fd"} !important; box-shadow: 0 0 0 3px ${isDark ? "rgba(59,130,246,0.1)" : "rgba(147,197,253,0.2)"} !important; }

    .search-item:hover { background: ${isDark ? "rgba(59,130,246,0.08)" : "#eff6ff"} !important; }

    html, body, * { scrollbar-width: thin; scrollbar-color: ${isDark ? "rgba(255,255,255,0.12) transparent" : "rgba(0,0,0,0.14) transparent"}; }
    html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { width: 5px; height: 5px; }
    html::-webkit-scrollbar-track, body::-webkit-scrollbar-track, *::-webkit-scrollbar-track { background: transparent; }
    html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.13)"}; border-radius: 999px; }
    html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover, *::-webkit-scrollbar-thumb:hover { background: ${isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.24)"}; }
    html::-webkit-scrollbar-corner, body::-webkit-scrollbar-corner, *::-webkit-scrollbar-corner { background: transparent; }

    @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

    .ob-slide { animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
    .ob-fade  { animation: fadeIn 0.2s ease forwards; }
    .ob-up    { animation: fadeUp 0.3s ease both; }
    .ob-up-1  { animation: fadeUp 0.3s 0.05s ease both; }
    .ob-up-2  { animation: fadeUp 0.3s 0.10s ease both; }
    .ob-pulse { animation: pulse 1.8s ease infinite; }

    .qty-btn { transition: background 0.1s, color 0.1s; }
    .qty-btn:hover { background: ${isDark ? "rgba(59,130,246,0.18)" : "#dbeafe"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }

    .pg-btn { transition: all 0.12s; }
    .pg-btn:hover:not(:disabled) { border-color: ${isDark ? "rgba(59,130,246,0.4)" : "#93c5fd"} !important; color: ${isDark ? "#60a5fa" : "#1d4ed8"} !important; }
  `;

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", transition: "background 0.25s, border-color 0.25s" };

  return (
    <>
      <style>{css}</style>
      <div className="ob-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div className="ob-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: T.blueDim, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>
                <MdMoveToInbox />
              </div>
              <h1 className="ob-jakarta" style={{ fontSize: "19px", fontWeight: "800", color: T.textPri, margin: 0 }}>Inbound</h1>
            </div>
            <p style={{ color: T.textSec, fontSize: "12px", margin: 0, paddingLeft: "42px" }}>
              Receive and inspect incoming goods from purchase orders
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Search */}
            <div ref={searchRef} style={{ position: "relative" }}>
              <FaSearch style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", color: T.textSec, fontSize: "11px", pointerEvents: "none" }} />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                onFocus={() => searchTerm.trim() && setShowDrop(true)}
                placeholder="Search items, orders…"
                style={{ padding: "8px 32px 8px 32px", width: "240px", border: `1px solid ${T.border}`, borderRadius: "9px", fontSize: "12px", background: T.surface, color: T.textPri, fontFamily: "inherit", outline: "none" }} />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(""); setShowDrop(false); }}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}>
                  <FaTimes size={10} />
                </button>
              )}
              {showDrop && filteredItems.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: "11px", boxShadow: isDark ? "0 16px 48px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)", maxHeight: "260px", overflowY: "auto" }}>
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
                        <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0" }}>{item.item_code} · {item.poNumber}</p>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: item.stockOnHand === 0 ? "#ef4444" : T.green }}>
                        {item.stockOnHand} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Receive button */}
            <button className="ob-btn" onClick={handleReceive} disabled={selectedIds.size === 0}
              style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 18px", background: selectedIds.size === 0 ? T.surface2 : T.blue, color: selectedIds.size === 0 ? T.textMuted : "white", border: `1px solid ${selectedIds.size === 0 ? T.border : "transparent"}`, borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: selectedIds.size === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              <MdMoveToInbox size={14} />
              Receive Goods
              {selectedIds.size > 0 && <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: "999px", padding: "1px 7px", fontSize: "11px" }}>{selectedIds.size}</span>}
            </button>
          </div>
        </div>

        {/* ── STAT CARDS ──────────────────────────────────────────── */}
        <div className="ob-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "18px" }}>
          {[
            { label: "Total Items",    value: items.length,         icon: <FaWarehouse />,          color: T.blue,   dim: T.blueDim,   sub: `${selectedIds.size} selected` },
            { label: "Receive Value",  value: fmtAED(totalValue),   icon: <FaTag />,                color: T.green,  dim: T.greenDim,  sub: `${totalQty} units total`, small: true },
            { label: "Purchase Orders",value: new Set(items.map(i => i.poNumber)).size, icon: <FaFileInvoice />, color: T.purple, dim: T.purpleDim, sub: "Linked POs" },
            { label: "Zero Stock",     value: zeroStock,            icon: <FaExclamationTriangle />, color: zeroStock > 0 ? "#ef4444" : T.green, dim: zeroStock > 0 ? "rgba(239,68,68,0.12)" : T.greenDim, sub: zeroStock > 0 ? "Items with 0 on hand" : "All stocked" },
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

        {/* ── CONTROLS BAR ────────────────────────────────────────── */}
        <div className="ob-up-2" style={{ ...card, padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          {/* Select all */}
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox"
              checked={selectedIds.size === items.length && items.length > 0}
              onChange={e => e.target.checked ? selectAll() : deselectAll()}
              style={{ accentColor: T.blue, width: "15px", height: "15px" }} />
            <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500" }}>
              {selectedIds.size} of {items.length} selected
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
          <input value={inboundNote} onChange={e => setInboundNote(e.target.value)}
            placeholder="Add receiving note (optional)…"
            style={{ flex: 1, minWidth: "200px", padding: "7px 12px", border: `1px solid ${T.border}`, borderRadius: "8px", fontSize: "12px", background: T.surface2, color: T.textPri, fontFamily: "inherit", outline: "none" }} />

          {zeroStock > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "7px" }}>
              <FaExclamationTriangle size={10} color="#ef4444" />
              <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "600" }}>{zeroStock} zero stock</span>
            </div>
          )}
        </div>

        {/* ── TABLE ───────────────────────────────────────────────── */}
        <div style={{ ...card, overflow: "hidden", marginBottom: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                <th style={{ padding: "11px 14px", width: "32px" }}>
                  <input type="checkbox" style={{ accentColor: T.blue }}
                    checked={selectedIds.size === items.length && items.length > 0}
                    onChange={e => e.target.checked ? selectAll() : deselectAll()} />
                </th>
                {["Item", "On Hand", "Ordered", "Receive Qty", "Status", "Purchase Order", "Cost / Unit", "VAT (5%)", "Line Total", "Actions"].map((h, i) => (
                  <th key={i} style={{ padding: "11px 14px", textAlign: i >= 6 ? "right" : "left", fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? currentItems.map((item) => {
                const sc         = getStatus(item.status);
                const isZeroStock = item.stockOnHand === 0;
                return (
                  <tr key={item._id} className="ob-row" style={{ borderBottom: `1px solid ${T.border}` }}>
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
                          <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0", fontFamily: "monospace" }}>{item.item_code}</p>
                        </div>
                      </div>
                    </td>

                    {/* On Hand */}
                    <td style={{ padding: "12px 14px" }}>
                      <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: isZeroStock ? "#ef4444" : T.green }}>
                        {item.stockOnHand}
                      </span>
                      <span style={{ fontSize: "11px", color: T.textSec, marginLeft: "4px" }}>{item.unit}</span>
                      {isZeroStock && <span className="ob-pulse" style={{ display: "block", fontSize: "10px", color: "#ef4444", fontWeight: "600", marginTop: "2px" }}>Zero stock</span>}
                    </td>

                    {/* Ordered qty */}
                    <td style={{ padding: "12px 14px" }}>
                      <span className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "600", color: T.textPri }}>{item.orderedQty}</span>
                      <span style={{ fontSize: "11px", color: T.textSec, marginLeft: "4px" }}>{item.unit}</span>
                    </td>

                    {/* Receive qty — stepper */}
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <button className="qty-btn" onClick={() => updateQty(item._id, (item.receiveQty || 1) - 1)}
                          style={{ width: "24px", height: "24px", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.surface2, color: T.textSec, cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          −
                        </button>
                        <input type="number" min="1" max={item.orderedQty} value={item.receiveQty}
                          onChange={e => updateQty(item._id, parseInt(e.target.value) || 1)}
                          className="ob-qty-input"
                          style={{ width: "44px", height: "24px", textAlign: "center", border: `1px solid ${T.border}`, borderRadius: "6px", background: T.surface2, color: T.textPri, fontSize: "12px", fontWeight: "600", fontFamily: "inherit" }} />
                        <button className="qty-btn" onClick={() => updateQty(item._id, (item.receiveQty || 1) + 1)}
                          style={{ width: "24px", height: "24px", borderRadius: "6px", border: `1px solid ${T.border}`, background: T.surface2, color: T.textSec, cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          +
                        </button>
                      </div>
                      <p style={{ fontSize: "10px", color: T.textMuted, margin: "3px 0 0 0" }}>max {item.orderedQty}</p>
                    </td>

                    {/* Status */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: sc.dim, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: "nowrap" }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                        {sc.label}
                      </span>
                    </td>

                    {/* Purchase Order */}
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 8px", borderRadius: "6px", background: T.blueDim, color: T.blueLight, border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, fontFamily: "monospace" }}>
                        {item.poNumber}
                      </span>
                    </td>

                    {/* Cost / Unit */}
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <p className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri, margin: 0, fontFamily: "monospace" }}>{fmtAED(item.costPrice)}</p>
                      <p style={{ fontSize: "10px", color: T.textMuted, margin: "1px 0 0" }}>excl. VAT</p>
                    </td>

                    {/* VAT (5%) */}
                    {(() => {
                      const lineBase = round2((item.receiveQty || 0) * (item.costPrice || 0));
                      const lineVat  = round2(lineBase * TAX_RATE);
                      return (
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <p style={{ fontSize: "12px", fontWeight: "700", color: "#f59e0b", margin: 0, fontFamily: "monospace" }}>{fmtAED(lineVat)}</p>
                          <p style={{ fontSize: "10px", color: T.textMuted, margin: "1px 0 0" }}>{fmtAED(lineBase)} × 5%</p>
                        </td>
                      );
                    })()}

                    {/* Line Total (incl. VAT) */}
                    {(() => {
                      const lineBase  = round2((item.receiveQty || 0) * (item.costPrice || 0));
                      const lineVat   = round2(lineBase * TAX_RATE);
                      const lineTotal = round2(lineBase + lineVat);
                      return (
                        <td style={{ padding: "12px 14px", textAlign: "right" }}>
                          <p className="ob-jakarta" style={{ fontSize: "13px", fontWeight: "800", color: T.blue, margin: 0, fontFamily: "monospace" }}>{fmtAED(lineTotal)}</p>
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
                              style={{ padding: "5px 9px", borderRadius: "7px", border: `1px solid rgba(16,185,129,0.25)`, background: "rgba(16,185,129,0.1)", color: "#10b981", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>
                              <FaCheck size={9} />
                            </button>
                            <button className="ob-icon-btn" onClick={() => handleReject(item._id)}
                              style={{ padding: "5px 9px", borderRadius: "7px", border: `1px solid rgba(239,68,68,0.25)`, background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontSize: "11px", fontFamily: "inherit" }}>
                              <FaTimes size={9} />
                            </button>
                          </>
                        )}
                        <button className="ob-icon-btn" onClick={() => handleCancelRequest(item._id)}
                          disabled={item.status === "cancelled" || item.status === "received"}
                          style={{ padding: "5px 9px", borderRadius: "7px", border: `1px solid ${T.border}`, background: "transparent", color: item.status === "cancelled" || item.status === "received" ? T.textMuted : T.textSec, cursor: item.status === "cancelled" || item.status === "received" ? "not-allowed" : "pointer", fontSize: "11px", fontFamily: "inherit" }}>
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
                      <p className="ob-jakarta" style={{ fontWeight: "700", color: T.textPri, fontSize: "15px", margin: 0 }}>No inbound items</p>
                      <p style={{ color: T.textSec, fontSize: "13px", margin: 0 }}>No items pending receipt from purchase orders</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION ──────────────────────────────────────────── */}
        {items.length > 0 && (
          <div style={{ ...card, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", color: T.textSec }}>
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, items.length)} of {items.length} items
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

        {/* ── SUMMARY FOOTER ──────────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div style={{ ...card, padding: "18px 22px", background: isDark ? "rgba(59,130,246,0.04)" : "#f8faff", borderColor: isDark ? "rgba(59,130,246,0.15)" : "#dbeafe" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>

              {/* Left — quick stats */}
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
                {[
                  { label: "Items",       value: selectedIds.size },
                  { label: "Total Units", value: `${totalQty} pcs` },
                  { label: "Subtotal",    value: fmtAED(subTotal) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 3px" }}>{label}</p>
                    <p className="ob-jakarta" style={{ fontSize: "14px", fontWeight: "700", color: T.textPri, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Centre — tax breakdown box */}
              <div style={{ flex: 1, minWidth: "220px", maxWidth: "340px", background: isDark ? "rgba(245,158,11,0.06)" : "#fffbeb", border: `1.5px solid ${isDark ? "rgba(245,158,11,0.2)" : "#fde68a"}`, borderRadius: "10px", padding: "10px 14px" }}>
                <p style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: ".07em", color: "#f59e0b", margin: "0 0 7px" }}>VAT 5% — Grouped by Rate</p>
                {inboundTaxGroups.length === 0 && (
                  <p style={{ fontSize: "12px", color: T.textSec, margin: 0 }}>—</p>
                )}
                {inboundTaxGroups.map((g, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < inboundTaxGroups.length - 1 ? `1px solid ${isDark ? "rgba(245,158,11,0.12)" : "#fef3c7"}` : "none" }}>
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>Rate {fmtAED(g.rate)}</p>
                      <p style={{ fontSize: "10px", color: T.textSec, margin: "1px 0 0", fontFamily: "monospace" }}>{fmtAED(g.baseAmount)} × 5%</p>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#f59e0b", fontFamily: "monospace" }}>{fmtAED(g.taxAmount)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1.5px solid ${isDark ? "rgba(245,158,11,0.25)" : "#fcd34d"}`, marginTop: "7px", paddingTop: "7px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#f59e0b" }}>Total VAT (5%)</span>
                  <span style={{ fontSize: "13px", fontWeight: "800", color: "#f59e0b", fontFamily: "monospace" }}>{fmtAED(totalTax)}</span>
                </div>
              </div>

              {/* Right — grand total + action */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 3px" }}>Grand Total (incl. VAT)</p>
                  <p className="ob-jakarta" style={{ fontSize: "20px", fontWeight: "800", color: T.blue, margin: 0, fontFamily: "monospace" }}>{fmtAED(totalValue)}</p>
                </div>
                <button className="ob-btn" onClick={handleReceive}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 22px", background: T.blue, color: "white", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>
                  <MdMoveToInbox size={14} /> Receive Goods
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── CANCEL MODAL ────────────────────────────────────────────── */}
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

      {/* ── ITEM DRAWER ─────────────────────────────────────────────── */}
      {drawer && selected && (
        <>
          <div className="ob-fade" onClick={() => { setDrawer(false); setSelected(null); }}
            style={{ position: "fixed", inset: 0, background: isDark ? "rgba(5,9,20,0.7)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)", zIndex: 50 }} />
          <div className="ob-slide"
            style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "420px", maxWidth: "100vw", background: T.surface, border: `1px solid ${T.border}`, borderRight: "none", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.6)" : "-8px 0 40px rgba(0,0,0,0.12)" }}>

            {(() => {
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
                          <span style={{ fontSize: "11px", fontFamily: "monospace", color: T.textSec }}>{selected.item_code}</span>
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
                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Qty overview */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "On Hand",  value: selected.stockOnHand, unit: selected.unit, warn: selected.stockOnHand === 0 },
                        { label: "Ordered",  value: selected.orderedQty,  unit: selected.unit },
                        { label: "Receive",  value: selected.receiveQty,  unit: selected.unit, blue: true },
                      ].map(({ label, value, unit, warn, blue }) => (
                        <div key={label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "12px 14px", textAlign: "center" }}>
                          <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>{label}</p>
                          <p className="ob-jakarta" style={{ fontSize: "18px", fontWeight: "800", color: warn ? "#ef4444" : blue ? T.blue : T.textPri, margin: 0, lineHeight: 1 }}>{value}</p>
                          <p style={{ fontSize: "10px", color: T.textSec, margin: "3px 0 0" }}>{unit}</p>
                        </div>
                      ))}
                    </div>

                    {/* Purchase order */}
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "13px 14px" }}>
                      <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Linked Purchase Order</p>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", padding: "4px 10px", borderRadius: "7px", background: T.blueDim, color: T.blueLight, border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}`, fontFamily: "monospace" }}>
                          {selected.poNumber}
                        </span>
                        <span style={{ fontSize: "12px", color: T.textSec }}>{selected.vendor}</span>
                      </div>
                    </div>

                    {/* Pricing breakdown */}
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", overflow: "hidden" }}>
                      <div style={{ padding: "11px 14px", borderBottom: `1px solid ${T.border}` }}>
                        <p className="ob-jakarta" style={{ fontSize: "11px", fontWeight: "700", color: T.textPri, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pricing</p>
                      </div>
                      {[
                        { label: "Cost / unit",  value: fmtAED(selected.costPrice) },
                        { label: "Receive Qty",  value: `${selected.receiveQty} ${selected.unit}` },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: "12px", color: T.textSec }}>{label}</span>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: T.textPri }}>{value}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: isDark ? "rgba(59,130,246,0.06)" : "#eff6ff" }}>
                        <span className="ob-jakarta" style={{ fontSize: "12px", fontWeight: "700", color: T.textPri }}>Line Total</span>
                        <span className="ob-jakarta" style={{ fontSize: "15px", fontWeight: "800", color: T.blue }}>
                          {fmtAED((selected.receiveQty || 1) * selected.costPrice)}
                        </span>
                      </div>
                    </div>

                    {/* Receive qty adjuster */}
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px" }}>
                      <p style={{ fontSize: "11px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 10px" }}>Adjust Receive Qty</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button className="qty-btn" onClick={() => updateQty(selected._id, (selected.receiveQty || 1) - 1)}
                          style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <input type="number" min="1" max={selected.orderedQty} value={selected.receiveQty}
                          onChange={e => updateQty(selected._id, parseInt(e.target.value) || 1)}
                          className="ob-qty-input"
                          style={{ flex: 1, height: "32px", textAlign: "center", border: `1px solid ${T.border}`, borderRadius: "8px", background: T.surface, color: T.textPri, fontSize: "14px", fontWeight: "700", fontFamily: "inherit" }} />
                        <button className="qty-btn" onClick={() => updateQty(selected._id, (selected.receiveQty || 1) + 1)}
                          style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${T.border}`, background: T.surface, color: T.textSec, cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                      <p style={{ fontSize: "11px", color: T.textSec, margin: "7px 0 0" }}>Max receivable: <strong>{selected.orderedQty}</strong></p>
                    </div>
                  </div>

                  {/* Drawer footer */}
                  <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", gap: "8px" }}>
                    <button className="ob-btn" onClick={() => handleCancelRequest(selected._id)}
                      disabled={selected.status === "cancelled" || selected.status === "received"}
                      style={{ flex: 1, padding: "9px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "9px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: selected.status === "cancelled" || selected.status === "received" ? 0.5 : 1 }}>
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
