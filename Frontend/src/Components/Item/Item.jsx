import { useEffect, useState, useRef, useCallback } from "react";
import {
  FaPlus, FaTimes, FaSearch, FaBox, FaTag, FaLayerGroup,
  FaExclamationTriangle, FaCheckCircle, FaArrowRight, FaEdit,
  FaBarcode, FaCubes, FaIndustry, FaRuler,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetItem from "../../helper/useGetItem";
import useThemeStore, { getTheme } from "../../store/useThemeStore";

/* ─── Utility ───────────────────────────────────────────────────────── */
const fmt = (v) =>
  v ? `AED ${parseFloat(v).toLocaleString("en-AE", { minimumFractionDigits: 2 })}` : "—";

const stockStatus = (qty, reorder = 0) => {
  if (qty <= 0) return { label: "Out of Stock", key: "out" };
  if (reorder > 0 && qty <= reorder / 2) return { label: "Critical", key: "critical" };
  if (reorder > 0 && qty <= reorder) return { label: "Low", key: "low" };
  return { label: "In Stock", key: "ok" };
};

/* ─── Local seed data ────────────────────────────────────────────────── */
const SEED = [
  { id: 1, name: "Storage Cabinet",  item_code: "ITM001", sku: "SKU-037", type: "Product", unit: "Piece", description: "Versatile storage cabinet with adjustable shelves.", selling_price: "4610.00", quantity: 50,  reorder_point: 10, brand: "FurnitureCo", image: null },
  { id: 2, name: "Area Rug",         item_code: "ITM002", sku: "SKU-038", type: "Product", unit: "Piece", description: "Soft, high-quality area rug to add warmth to any room.", selling_price: "2990.00", quantity: 3,   reorder_point: 10, brand: "HomeDecor",  image: null },
  { id: 3, name: "Office Chair",     item_code: "ITM003", sku: "SKU-039", type: "Product", unit: "Piece", description: "Ergonomic office chair with lumbar support.", selling_price: "1890.00", quantity: 8,   reorder_point: 15, brand: "OfficePro",  image: null },
  { id: 4, name: "LED Bulb 15W",     item_code: "ITM004", sku: "SKU-040", type: "Product", unit: "Box",   description: "Energy-efficient LED bulb 15W warm white.", selling_price: "45.00",   quantity: 200, reorder_point: 20, brand: "LightTech",  image: null },
  { id: 5, name: "Ergonomic Desk",   item_code: "ITM005", sku: "SKU-041", type: "Product", unit: "Piece", description: "Height-adjustable standing desk with cable management.", selling_price: "6200.00", quantity: 12,  reorder_point: 5,  brand: "FurnitureCo", image: null },
  { id: 6, name: "Monitor Stand",    item_code: "ITM006", sku: "SKU-042", type: "Product", unit: "Piece", description: "Dual-arm monitor stand with full motion adjustment.", selling_price: "890.00",  quantity: 0,   reorder_point: 8,  brand: "OfficePro",  image: null },
];

/* ─── Status color helper (theme-aware) ─────────────────────────────── */
const statusColors = (key, T, isDark) => ({
  out:      { bg: isDark ? "rgba(239,68,68,.12)"    : "#fef2f2", color: T.red,    border: isDark ? "rgba(239,68,68,.25)"    : "#fca5a5" },
  critical: { bg: isDark ? "rgba(239,68,68,.12)"    : "#fef2f2", color: T.red,    border: isDark ? "rgba(239,68,68,.25)"    : "#fca5a5" },
  low:      { bg: isDark ? "rgba(245,158,11,.12)"   : "#fef3c7", color: T.amber,  border: isDark ? "rgba(245,158,11,.25)"   : "#fcd34d" },
  ok:       { bg: isDark ? "rgba(16,185,129,.12)"   : "#dcfce7", color: T.green,  border: isDark ? "rgba(16,185,129,.25)"   : "#86efac" },
})[key];

/* ─── Item avatar (initial based) ───────────────────────────────────── */
const ItemAvatar = ({ item, size = 36, T, isDark }) => {
  const colors = [T.blue, T.purple, T.green, T.amber, T.cyan, T.red];
  const idx = (item.name || "").charCodeAt(0) % colors.length;
  const c = colors[idx];
  return (
    <div style={{
      width: size, height: size, borderRadius: "10px", flexShrink: 0,
      background: isDark ? `${c}22` : `${c}18`,
      border: `1px solid ${isDark ? `${c}33` : `${c}44`}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: c, fontSize: size * 0.38, fontWeight: "700",
      fontFamily: "'DM Mono', monospace",
    }}>
      {(item.name || "?").charAt(0).toUpperCase()}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function Item() {
  const { handleGetItem, data, loading, error } = useGetItem();
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  /* ── State ── */
  const [selectedItem,  setSelectedItem]  = useState(null);
  const [isDrawerOpen,  setIsDrawerOpen]  = useState(false);
  const [activeTab,     setActiveTab]     = useState("overview");
  const [searchTerm,    setSearchTerm]    = useState("");
  const [, setShowDropdown]  = useState(false);
  const [filterStatus,  setFilterStatus]  = useState("all");   // all | ok | low | critical | out
  const [selectedRows,  setSelectedRows]  = useState(new Set());
  const [cmdOpen,       setCmdOpen]       = useState(false);
  const [mounted,       setMounted]       = useState(false);
  const searchRef = useRef(null);
  const cmdRef    = useRef(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { handleGetItem(); }, [handleGetItem]);

  /* ── Data ── */
  const allItems = Array.isArray(data) && data.length > 0 ? data : SEED;

  const filteredItems = allItems.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q ||
      (item.name        || "").toLowerCase().includes(q) ||
      (item.item_code   || "").toLowerCase().includes(q) ||
      (item.brand       || "").toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q);
    const s = stockStatus(item.quantity, item.reorder_point).key;
    const matchStatus = filterStatus === "all" || s === filterStatus;
    return matchSearch && matchStatus;
  });

  /* Dropdown: search-only suggestions (not status-filtered) */
  const dropdownItems = searchTerm.trim()
    ? allItems.filter((item) => {
        const q = searchTerm.toLowerCase();
        return (item.name || "").toLowerCase().includes(q) ||
               (item.item_code || "").toLowerCase().includes(q);
      }).slice(0, 6)
    : [];

  /* ── Stats ── */
  const totalItems   = allItems.length;
  const inStockCount = allItems.filter(i => stockStatus(i.quantity, i.reorder_point).key === "ok").length;
  const lowCount     = allItems.filter(i => ["low","critical"].includes(stockStatus(i.quantity, i.reorder_point).key)).length;
  const outCount     = allItems.filter(i => stockStatus(i.quantity, i.reorder_point).key === "out").length;
  const totalValue   = allItems.reduce((s, i) => s + (parseFloat(i.selling_price || 0) * (i.quantity || 0)), 0);

  /* ── Handlers ── */
  const openItem = useCallback((item) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
    setActiveTab("overview");
  }, []);

  const closeDrawer = () => { setIsDrawerOpen(false); setSelectedItem(null); };

  const toggleRow = (id) => setSelectedRows(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toggleAll = () => {
    if (selectedRows.size === filteredItems.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(filteredItems.map(i => i._id || i.id)));
  };

  /* ── Keyboard: Cmd+K ── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(v => !v); }
      if (e.key === "Escape") { setCmdOpen(false); setShowDropdown(false); closeDrawer(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Click outside ── */
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
      if (cmdRef.current && !cmdRef.current.contains(e.target)) setCmdOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Theme shortcuts ── */
  const surface   = T.surface;
  const surface2  = T.surface2;
  const border    = T.border;
  const border2   = T.border2;

  /* ── Injected CSS ── */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .itm-page { font-family:'DM Sans',sans-serif; }
    .itm-page * { box-sizing:border-box; }
    html,body,*{scrollbar-width:thin;scrollbar-color:${isDark?"rgba(255,255,255,.08) transparent":"rgba(0,0,0,.08) transparent"}}
    *::-webkit-scrollbar{width:4px;height:4px}
    *::-webkit-scrollbar-track{background:transparent}
    *::-webkit-scrollbar-thumb{background:${isDark?"rgba(255,255,255,.1)":"rgba(0,0,0,.12)"};border-radius:99px}

    @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
    @keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}

    .itm-row { transition: background .12s; }
    .itm-row:hover { background: ${isDark?"rgba(255,255,255,.028)":"rgba(37,99,235,.025)"} !important; }
    .itm-row:hover .itm-row-arrow { opacity:1; transform:translateX(0); }
    .itm-row-arrow { opacity:0; transform:translateX(-5px); transition:opacity .14s, transform .14s; }

    .itm-stat { transition:transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s; cursor:pointer; }
    .itm-stat:hover { transform:translateY(-3px) scale(1.012); box-shadow: ${isDark?"0 16px 44px rgba(0,0,0,.5)":"0 10px 32px rgba(0,0,0,.1)"} !important; }

    .itm-tab { transition: color .15s; }
    .itm-pill { transition: all .15s; cursor:pointer; }
    .itm-pill:hover { filter: brightness(${isDark?"1.12":".94"}); }

    .itm-btn { transition: all .15s; }
    .itm-btn:hover { filter: brightness(${isDark?"1.14":".95"}); transform:translateY(-1px); }
    .itm-btn:active { transform:scale(.97); }

    .itm-drawer { transition: transform .3s cubic-bezier(.4,0,.2,1); }
    .itm-cmd { animation: scaleIn .18s ease both; }
    .itm-mounted .itm-stat-0 { animation: fadeUp .32s ease both; }
    .itm-mounted .itm-stat-1 { animation: fadeUp .32s .05s ease both; }
    .itm-mounted .itm-stat-2 { animation: fadeUp .32s .10s ease both; }
    .itm-mounted .itm-stat-3 { animation: fadeUp .32s .15s ease both; }
    .itm-mounted .itm-stat-4 { animation: fadeUp .32s .20s ease both; }
    .itm-mounted .itm-table  { animation: fadeUp .32s .22s ease both; }

    .itm-check {
      appearance:none; width:15px; height:15px; border-radius:4px;
      border: 1.5px solid ${isDark?"rgba(255,255,255,.18)":"#cbd5e1"};
      background: transparent; cursor:pointer; transition: all .13s;
      display:flex; align-items:center; justify-content:center;
    }
    .itm-check:checked {
      background:${T.blue}; border-color:${T.blue};
      background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 10 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 4l3 3 5-6' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-size:10px 8px; background-repeat:no-repeat; background-position:center;
    }
    .sora { font-family:'Sora',sans-serif; }
    .mono { font-family:'DM Mono',monospace; }
  `;

  const card = (ex = {}) => ({
    background: surface,
    border: `1px solid ${border}`,
    borderRadius: "14px",
    transition: "background .25s, border-color .25s",
    ...ex,
  });

  /* ═══════════════ LOADING / ERROR ═══════════════════════════════════ */
  if (loading) return (
    <div className="itm-page" style={{ background: T.bg, minHeight: "100vh", padding: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{css}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${T.blueDim}`, borderTopColor: T.blue, animation: "spin .8s linear infinite", margin: "0 auto 14px" }} />
        <p style={{ color: T.textSec, fontSize: 13 }}>Loading inventory…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="itm-page" style={{ background: T.bg, minHeight: "100vh", padding: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{css}</style>
      <div style={{ ...card({ padding: "28px 32px", textAlign: "center" }) }}>
        <FaExclamationTriangle size={28} style={{ color: T.red, marginBottom: 12 }} />
        <p style={{ color: T.textPri, fontWeight: 600, margin: "0 0 6px" }}>Failed to load items</p>
        <p style={{ color: T.textSec, fontSize: 12 }}>{error}</p>
      </div>
    </div>
  );

  /* ═══════════════ STAT CARDS DATA ════════════════════════════════════ */
  const STATS = [
    { label: "Total Items",  val: totalItems,   icon: <FaLayerGroup />, c: T.blue,   dim: T.blueDim,   filter: "all" },
    { label: "In Stock",     val: inStockCount, icon: <FaCheckCircle />, c: T.green,  dim: T.greenDim,  filter: "ok"  },
    { label: "Low Stock",    val: lowCount,     icon: <FaExclamationTriangle />, c: T.amber, dim: T.amberDim, filter: "low" },
    { label: "Out of Stock", val: outCount,     icon: <FaTimes />,       c: T.red,    dim: T.redDim,    filter: "out" },
    {
      label: "Portfolio Value",
      val: `AED ${(totalValue / 1000).toFixed(0)}K`,
      icon: <FaTag />, c: T.purple, dim: T.purpleDim, filter: null,
    },
  ];

  /* ═══════════════ RENDER ═════════════════════════════════════════════ */
  return (
    <div className={`itm-page${mounted ? " itm-mounted" : ""}`}
      style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>
      <style>{css}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" }}>
        <div>
          <h1 className="sora" style={{ fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0, letterSpacing: "-0.03em" }}>
            Inventory
          </h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: "4px 0 0" }}>
            {allItems.length} items · {selectedRows.size > 0 ? `${selectedRows.size} selected` : "Manage your product catalog"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* ⌘K search trigger */}
          <button
            className="itm-btn"
            onClick={() => setCmdOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 14px", background: surface, border: `1px solid ${border}`,
              borderRadius: 10, color: T.textSec, fontSize: 12, cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", minWidth: 200, justifyContent: "space-between",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FaSearch size={11} />
              Search items…
            </span>
            <kbd style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 5,
              background: isDark ? "rgba(255,255,255,.07)" : "#e8eef5",
              color: T.textSec, border: `1px solid ${border}`, fontFamily: "inherit",
            }}>⌘K</kbd>
          </button>

          {/* New item */}
          <button
            className="itm-btn"
            onClick={() => navigate("/Items/Items/New")}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", background: T.blue, border: "none",
              borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              boxShadow: `0 4px 16px ${isDark ? "rgba(59,130,246,.35)" : "rgba(37,99,235,.28)"}`,
            }}
          >
            <FaPlus size={10} /> New Item
          </button>
        </div>
      </div>

      {/* ══ STAT CARDS ═════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 }}>
        {STATS.map((s, i) => (
          <div
            key={i}
            className={`itm-stat itm-stat-${i}`}
            onClick={() => s.filter !== null && setFilterStatus(filterStatus === s.filter ? "all" : s.filter)}
            style={{
              ...card({ padding: "16px 18px", position: "relative", overflow: "hidden" }),
              outline: filterStatus === s.filter ? `2px solid ${s.c}` : "2px solid transparent",
              outlineOffset: 2,
            }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,transparent 5%,${s.c},transparent 95%)`, opacity: isDark ? .4 : .6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: s.dim, color: s.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{s.icon}</div>
              {filterStatus === s.filter && s.filter && (
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.c }} />
              )}
            </div>
            <p className="sora" style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: "0 0 2px", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</p>
            <p style={{ fontSize: 11, color: T.textSec, margin: 0, fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ══ TOOLBAR ═════════════════════════════════════════════════ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        {/* Status pills */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { key: "all",      label: "All",       c: T.blue   },
            { key: "ok",       label: "In Stock",  c: T.green  },
            { key: "low",      label: "Low Stock", c: T.amber  },
            { key: "critical", label: "Critical",  c: T.red    },
            { key: "out",      label: "Out",       c: T.red    },
          ].map(p => {
            const active = filterStatus === p.key;
            return (
              <button key={p.key} className="itm-pill"
                onClick={() => setFilterStatus(p.key)}
                style={{
                  padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                  background: active
                    ? (isDark ? `${p.c}22` : `${p.c}15`)
                    : "transparent",
                  color:  active ? p.c : T.textSec,
                  border: `1px solid ${active ? (isDark ? `${p.c}44` : `${p.c}44`) : border}`,
                  transition: "all .15s",
                }}
              >{p.label}</button>
            );
          })}
        </div>

        <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>
          {filteredItems.length} of {allItems.length} items
        </p>
      </div>

      {/* ══ TABLE ════════════════════════════════════════════════════ */}
      <div className="itm-table" style={{ ...card({ padding: 0, overflow: "hidden" }) }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${border}` }}>
              <th style={{ padding: "12px 16px", width: 40, textAlign: "center" }}>
                <input
                  type="checkbox"
                  className="itm-check"
                  checked={selectedRows.size === filteredItems.length && filteredItems.length > 0}
                  onChange={toggleAll}
                />
              </th>
              {["Item", "Code", "Brand", "Unit", "Stock", "Price", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "12px 14px", textAlign: i === 5 ? "right" : "left",
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.08em", color: T.textSec,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "52px 24px", textAlign: "center" }}>
                  <FaBox size={28} style={{ color: T.textSec, opacity: .4, marginBottom: 12 }} />
                  <p style={{ color: T.textSec, fontWeight: 500, margin: "0 0 4px" }}>No items match</p>
                  <p style={{ color: T.textSec, fontSize: 12, margin: 0, opacity: .7 }}>
                    Try adjusting filters or clearing search
                  </p>
                </td>
              </tr>
            ) : filteredItems.map((item, idx) => {
              const st  = stockStatus(item.quantity, item.reorder_point);
              const sc  = statusColors(st.key, T, isDark);
              const sel = selectedRows.has(item._id || item.id);
              return (
                <tr
                  key={item._id || item.id || idx}
                  className="itm-row"
                  style={{
                    borderBottom: `1px solid ${border2}`,
                    background: sel ? (isDark ? "rgba(59,130,246,.06)" : "rgba(37,99,235,.04)") : "transparent",
                    animation: `fadeUp .28s ${idx * 0.028}s ease both`,
                  }}
                >
                  {/* Checkbox */}
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      className="itm-check"
                      checked={sel}
                      onChange={() => toggleRow(item._id || item.id)}
                    />
                  </td>

                  {/* Item */}
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ItemAvatar item={item} size={34} T={T} isDark={isDark} />
                      <div>
                        <button
                          onClick={() => openItem(item)}
                          style={{
                            background: "none", border: "none", padding: 0, cursor: "pointer",
                            color: T.blue, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                            textAlign: "left",
                          }}
                        >
                          {item.name}
                        </button>
                        <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0" }}>{item.sku || item.item_code}</p>
                      </div>
                    </div>
                  </td>

                  {/* Code */}
                  <td style={{ padding: "12px 14px" }}>
                    <span className="mono" style={{
                      fontSize: 11, padding: "3px 8px", borderRadius: 6,
                      background: isDark ? "rgba(255,255,255,.05)" : "#f1f5f9",
                      color: T.textSec, border: `1px solid ${border}`,
                    }}>
                      {item.item_code || "—"}
                    </span>
                  </td>

                  {/* Brand */}
                  <td style={{ padding: "12px 14px", color: T.textSec, fontSize: 12 }}>
                    {item.brand || "—"}
                  </td>

                  {/* Unit */}
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 999,
                      background: T.blueDim, color: T.blue,
                      border: `1px solid ${isDark ? "rgba(59,130,246,.2)" : "#93c5fd"}`,
                    }}>
                      {item.unit || "—"}
                    </span>
                  </td>

                  {/* Stock */}
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="sora" style={{ fontSize: 13, fontWeight: 700, color: sc.color }}>
                        {item.quantity ?? 0}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                        background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        {st.label}
                      </span>
                    </div>
                  </td>

                  {/* Price */}
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <span className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>
                      {fmt(item.selling_price || item.rate)}
                    </span>
                  </td>

                  {/* Arrow */}
                  <td style={{ padding: "12px 14px", width: 36 }}>
                    <button
                      className="itm-row-arrow"
                      onClick={() => openItem(item)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: T.textSec, padding: 4,
                      }}
                    >
                      <FaArrowRight size={10} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>
          {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
          {filterStatus !== "all" ? ` · Filtered: ${filterStatus}` : ""}
          {selectedRows.size > 0 ? ` · ${selectedRows.size} selected` : ""}
        </p>
        {selectedRows.size > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="itm-btn"
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: T.redDim, color: T.red, border: `1px solid ${isDark ? "rgba(239,68,68,.25)" : "#fca5a5"}`,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Delete ({selectedRows.size})
            </button>
            <button
              className="itm-btn"
              onClick={() => setSelectedRows(new Set())}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: surface, color: T.textSec, border: `1px solid ${border}`,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Deselect
            </button>
          </div>
        )}
      </div>

      {/* ══ COMMAND PALETTE ═════════════════════════════════════════ */}
      {cmdOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: isDark ? "rgba(0,0,0,.7)" : "rgba(0,0,0,.35)",
          backdropFilter: "blur(6px)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          paddingTop: "12vh",
        }}>
          <div
            className="itm-cmd"
            ref={cmdRef}
            style={{
              width: 520, background: surface, border: `1px solid ${border}`,
              borderRadius: 16, overflow: "hidden",
              boxShadow: isDark ? "0 32px 80px rgba(0,0,0,.7)" : "0 24px 60px rgba(0,0,0,.18)",
            }}
          >
            {/* Input */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
              <FaSearch size={13} style={{ color: T.textSec, flexShrink: 0 }} />
              <input
                autoFocus
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search items by name, code, or brand…"
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: T.textPri, fontSize: 14, fontFamily: "'DM Sans',sans-serif",
                }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSec, padding: 0 }}>
                  <FaTimes size={11} />
                </button>
              )}
              <kbd style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 5, flexShrink: 0,
                background: isDark ? "rgba(255,255,255,.07)" : "#e8eef5",
                color: T.textSec, border: `1px solid ${border}`,
              }}>Esc</kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {searchTerm && dropdownItems.length === 0 && (
                <div style={{ padding: "32px 18px", textAlign: "center", color: T.textSec, fontSize: 13 }}>
                  No items found for "{searchTerm}"
                </div>
              )}
              {!searchTerm && (
                <div style={{ padding: "10px 18px" }}>
                  <p style={{ fontSize: 10, color: T.textSec, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Recent Items</p>
                  {allItems.slice(0, 5).map((item, i) => (
                    <CmdRow key={i} item={item} T={T} isDark={isDark} onSelect={() => { openItem(item); setCmdOpen(false); }} />
                  ))}
                </div>
              )}
              {searchTerm && dropdownItems.length > 0 && (
                <div style={{ padding: "8px 0" }}>
                  <p style={{ fontSize: 10, color: T.textSec, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px", padding: "0 18px" }}>
                    {dropdownItems.length} result{dropdownItems.length !== 1 ? "s" : ""}
                  </p>
                  {dropdownItems.map((item, i) => (
                    <CmdRow key={i} item={item} T={T} isDark={isDark} onSelect={() => { openItem(item); setCmdOpen(false); }} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div style={{ padding: "10px 18px", borderTop: `1px solid ${border}`, display: "flex", gap: 16, alignItems: "center" }}>
              {[["↵","Open"], ["⌘K","Close"], ["↑↓","Navigate"]].map(([k, l]) => (
                <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.textSec }}>
                  <kbd style={{ padding: "1px 5px", borderRadius: 4, background: isDark ? "rgba(255,255,255,.07)" : "#e8eef5", border: `1px solid ${border}`, fontSize: 10 }}>{k}</kbd>
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ DRAWER ══════════════════════════════════════════════════ */}
      {/* Backdrop */}
      {isDrawerOpen && (
        <div
          onClick={closeDrawer}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: isDark ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.25)", backdropFilter: "blur(3px)" }}
        />
      )}

      <div
        className="itm-drawer"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 460, maxWidth: "100vw",
          background: surface,
          border: `1px solid ${border}`,
          borderRadius: "16px 0 0 16px",
          boxShadow: isDark ? "-24px 0 80px rgba(0,0,0,.6)" : "-12px 0 50px rgba(0,0,0,.14)",
          transform: isDrawerOpen ? "translateX(0)" : "translateX(100%)",
          display: "flex", flexDirection: "column",
        }}
      >
        {selectedItem && (
          <>
            {/* Drawer header */}
            <div style={{ padding: "18px 20px 0", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <ItemAvatar item={selectedItem} size={44} T={T} isDark={isDark} />
                  <div>
                    <h3 className="sora" style={{ fontSize: 16, fontWeight: 700, color: T.textPri, margin: "0 0 3px", letterSpacing: "-0.02em" }}>
                      {selectedItem.name}
                    </h3>
                    <span className="mono" style={{ fontSize: 11, color: T.textSec }}>{selectedItem.item_code}</span>
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textSec }}
                >
                  <FaTimes size={11} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${border}` }}>
                {["overview", "transactions", "history"].map(tab => (
                  <button
                    key={tab}
                    className="itm-tab"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "9px 16px", fontSize: 12, fontWeight: 600,
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif", textTransform: "capitalize",
                      color: activeTab === tab ? T.blue : T.textSec,
                      borderBottom: `2px solid ${activeTab === tab ? T.blue : "transparent"}`,
                      marginBottom: -1, transition: "color .15s",
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
              {activeTab === "overview" && <DrawerOverview item={selectedItem} T={T} isDark={isDark} surface2={surface2} border={border} />}
              {activeTab === "transactions" && (() => {
                const price      = parseFloat(selectedItem.selling_price || 0);
                const qty        = selectedItem.quantity || 0;
                const subTotal   = Math.round(price * qty * 100) / 100;
                const taxAmt     = Math.round(subTotal * 0.05 * 100) / 100;
                const grandTotal = Math.round((subTotal + taxAmt) * 100) / 100;
                const fmtV = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                    {/* Item valuation rows */}
                    <div style={{ background: surface2, border: `1px solid ${border}`, borderRadius: "12px", overflow: "hidden" }}>
                      {[
                        { label: "Unit Price",     value: fmtV(price) },
                        { label: "Qty on Hand",    value: `${qty} ${selectedItem.unit || "pcs"}` },
                        { label: "Sub Total",      value: fmtV(subTotal) },
                      ].map(({ label, value }, i, arr) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${border}` : "none" }}>
                          <span style={{ fontSize: "12px", color: T.textSec, fontWeight: "500" }}>{label}</span>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: T.textPri, fontFamily: "monospace" }}>{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* VAT breakdown */}
                    <div>
                      <p style={{ fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Tax Breakdown</p>
                      <div style={{ background: isDark ? "rgba(245,158,11,0.06)" : "#fffbeb", border: `1.5px solid ${isDark ? "rgba(245,158,11,0.2)" : "#fde68a"}`, borderRadius: "12px", padding: "12px 16px" }}>
                        <p style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: ".07em", color: "#f59e0b", margin: "0 0 10px" }}>VAT 5% — Grouped by Rate</p>
                        {price > 0 && qty > 0 ? (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                              <div>
                                <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>Rate {fmtV(price)}</p>
                                <p style={{ fontSize: "10px", color: T.textSec, margin: "1px 0 0", fontFamily: "monospace" }}>{fmtV(subTotal)} × 5%</p>
                              </div>
                              <span style={{ fontSize: "13px", fontWeight: "700", color: "#f59e0b", fontFamily: "monospace" }}>{fmtV(taxAmt)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1.5px solid ${isDark ? "rgba(245,158,11,0.25)" : "#fcd34d"}`, marginTop: "8px", paddingTop: "8px" }}>
                              <span style={{ fontSize: "11px", fontWeight: "700", color: "#f59e0b" }}>Total VAT (5%)</span>
                              <span style={{ fontSize: "13px", fontWeight: "800", color: "#f59e0b", fontFamily: "monospace" }}>{fmtV(taxAmt)}</span>
                            </div>
                          </>
                        ) : (
                          <p style={{ fontSize: "12px", color: T.textSec, margin: 0 }}>No stock value to calculate tax on.</p>
                        )}
                      </div>
                    </div>

                    {/* Grand Total */}
                    {price > 0 && qty > 0 && (
                      <div style={{ background: surface2, border: `1px solid ${border}`, borderRadius: "12px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "14px", fontWeight: "700", color: T.textPri, fontFamily: "'DM Sans',sans-serif" }}>Total Stock Value (incl. VAT)</span>
                        <span style={{ fontSize: "17px", fontWeight: "800", color: T.blue, fontFamily: "monospace" }}>{fmtV(grandTotal)}</span>
                      </div>
                    )}

                    <p style={{ fontSize: "11px", color: T.textMuted, margin: 0, textAlign: "center" }}>Transaction history will appear once sales/purchase orders are linked.</p>
                  </div>
                );
              })()}
              {activeTab === "history"      && <DrawerEmpty T={T} icon={<FaBarcode size={24} />} title="No History" sub="Activity history will appear here." />}
            </div>

            {/* Drawer footer */}
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${border}`, flexShrink: 0, display: "flex", gap: 8 }}>
              <button
                className="itm-btn"
                onClick={() => navigate(`/Items/Items/Edit/${selectedItem._id || selectedItem.id}`)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "10px", background: T.blue, border: "none", borderRadius: 10,
                  color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif",
                  boxShadow: `0 3px 12px ${isDark ? "rgba(59,130,246,.3)" : "rgba(37,99,235,.22)"}`,
                }}
              >
                <FaEdit size={11} /> Edit Item
              </button>
              <button
                className="itm-btn"
                onClick={closeDrawer}
                style={{
                  flex: 1, padding: "10px", background: surface2, border: `1px solid ${border}`,
                  borderRadius: 10, color: T.textSec, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Command palette row ────────────────────────────────────────────── */
function CmdRow({ item, T, isDark, onSelect }) {
  const st = stockStatus(item.quantity, item.reorder_point);
  const sc = statusColors(st.key, T, isDark);
  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "9px 18px",
        cursor: "pointer", transition: "background .1s",
        borderRadius: 8, margin: "1px 6px",
      }}
      onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,.05)" : "rgba(37,99,235,.04)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <ItemAvatar item={item} size={30} T={T} isDark={isDark} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.textPri }}>{item.name}</p>
        <p style={{ margin: 0, fontSize: 10, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>{item.item_code} · {item.brand || "—"}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: sc.color, fontFamily: "'Sora',sans-serif" }}>{item.quantity ?? 0}</span>
        <FaArrowRight size={9} style={{ color: T.textSec }} />
      </div>
    </div>
  );
}

/* ─── Drawer: Overview ───────────────────────────────────────────────── */
function DrawerOverview({ item, T, isDark, surface2, border }) {
  const st = stockStatus(item.quantity, item.reorder_point);
  const sc = statusColors(st.key, T, isDark);
  const reorder = item.reorder_point || 0;
  const qty = item.quantity || 0;
  const pct = reorder > 0 ? Math.min(Math.round((qty / (reorder * 2)) * 100), 100) : 100;
  const trackBg = isDark ? "rgba(255,255,255,.07)" : "#e2e8f0";

  const Field = ({ icon, label, value, mono }) => (
    <div style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ color: T.textSec, fontSize: 11 }}>{icon}</span>
        <span style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: mono ? "'DM Mono',monospace" : undefined }}>{value || "—"}</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Stock bar */}
      <div style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Stock Level</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {st.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 10 }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 28, fontWeight: 800, color: sc.color, lineHeight: 1 }}>{qty}</span>
          {reorder > 0 && <span style={{ fontSize: 12, color: T.textSec }}>/ {reorder} reorder point</span>}
        </div>
        <div style={{ height: 5, background: trackBg, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: sc.color, borderRadius: 999, transition: "width .6s .2s cubic-bezier(.34,1,.64,1)" }} />
        </div>
      </div>

      {/* Price highlight */}
      <div style={{ background: isDark ? "rgba(59,130,246,.06)" : "#eff6ff", border: `1px solid ${isDark ? "rgba(59,130,246,.18)" : "#93c5fd"}`, borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: 10, color: T.blue, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 4px" }}>Selling Price</p>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.blue, margin: 0, letterSpacing: "-0.03em" }}>
            {item.selling_price ? `AED ${parseFloat(item.selling_price).toLocaleString("en-AE", { minimumFractionDigits: 2 })}` : "—"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 10, color: T.textSec, margin: "0 0 4px" }}>Portfolio Value</p>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: T.textPri, margin: 0 }}>
            AED {((parseFloat(item.selling_price || 0) * qty) / 1000).toFixed(1)}K
          </p>
        </div>
      </div>

      {/* Fields grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field icon={<FaBarcode />}  label="Item Code" value={item.item_code} mono />
        <Field icon={<FaTag />}      label="SKU"       value={item.sku}       mono />
        <Field icon={<FaIndustry />} label="Brand"     value={item.brand}     />
        <Field icon={<FaCubes />}    label="Type"      value={item.type}      />
        <Field icon={<FaRuler />}    label="Unit"      value={item.unit}      />
        <Field icon={<FaLayerGroup/>}label="Category"  value={item.category}  />
      </div>

      {/* Description */}
      {(item.sales_description || item.description) && (
        <div style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>Description</p>
          <p style={{ fontSize: 13, color: T.textSec, margin: 0, lineHeight: 1.55 }}>
            {item.sales_description || item.description}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Drawer: empty state ────────────────────────────────────────────── */
function DrawerEmpty({ T, icon, title, sub }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center", opacity: .7 }}>
      <div style={{ color: T.textSec, marginBottom: 14 }}>{icon}</div>
      <p style={{ fontSize: 14, fontWeight: 600, color: T.textPri, margin: "0 0 6px" }}>{title}</p>
      <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>{sub}</p>
    </div>
  );
}