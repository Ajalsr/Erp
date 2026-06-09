import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { FaBoxOpen, FaWarehouse, FaExclamationTriangle, FaSync, FaDownload, FaSearch, FaTimes } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import { useBaseCurrency, baseCurrency } from "../../helper/currency";

const fmtM = (n) => `${baseCurrency()} ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = (n) => { if (n >= 1000000) return `${baseCurrency()} ${(n / 1000000).toFixed(1)}M`; if (n >= 1000) return `${baseCurrency()} ${(n / 1000).toFixed(1)}K`; return `${baseCurrency()} ${Math.round(n)}`; };

const CATEGORY_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

// Normalize raw Stock model fields to consistent shape
const norm = (it) => ({
  _raw:       it,
  name:       it.name || "—",
  sku:        it.sku || it.item_code || "—",
  category:   it.category || it.type || "Uncategorised",
  qty:        parseFloat(it.quantity || it.opening_stock || "0"),
  reorder:    parseFloat(it.reorder_point || "5"),
  price:      parseFloat(it.selling_price || it.cost_price || "0"),
  get value() { return this.price * this.qty; },
});

export default function InventoryReport() {
  useBaseCurrency();
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);

  const [loading, setLoading] = useState(true);
  const [items,   setItems]   = useState([]);
  const [search,  setSearch]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/stocks/getitem?limit=500");
      const raw = res.data?.data?.items || res.data?.items || res.data?.data || [];
      setItems((Array.isArray(raw) ? raw : []).map(norm));
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // KPIs — items are already normalized via norm()
  const totalItems    = items.length;
  const totalStockVal = items.reduce((s, it) => s + it.value, 0);
  const lowStock      = items.filter(it => it.qty > 0 && it.qty <= it.reorder).length;
  const outOfStock    = items.filter(it => it.qty === 0).length;
  const inStock       = items.filter(it => it.qty > 0).length;

  // Category breakdown
  const catMap = {};
  items.forEach(it => {
    if (!catMap[it.category]) catMap[it.category] = { name: it.category, count: 0, value: 0 };
    catMap[it.category].count++;
    catMap[it.category].value += it.value;
  });
  const catData = Object.values(catMap).sort((a, b) => b.value - a.value);

  // Top items by stock value
  const topByValue = [...items].sort((a, b) => b.value - a.value).slice(0, 10);

  // Stock level distribution for bar chart
  const stockBuckets = [
    { label: "0 (Out)", count: items.filter(it => it.qty === 0).length,                        color: "#ef4444" },
    { label: "1–10",    count: items.filter(it => it.qty >= 1   && it.qty <= 10).length,       color: "#f59e0b" },
    { label: "11–50",   count: items.filter(it => it.qty >= 11  && it.qty <= 50).length,       color: "#3b82f6" },
    { label: "51–200",  count: items.filter(it => it.qty >= 51  && it.qty <= 200).length,      color: "#10b981" },
    { label: "200+",    count: items.filter(it => it.qty > 200).length,                        color: "#8b5cf6" },
  ];

  // Search-filtered items for table
  const tableItems = items.filter(it => {
    const q = search.toLowerCase();
    return !q || it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q) || it.category.toLowerCase().includes(q);
  });

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
    .rpt-root { font-family: 'DM Sans', sans-serif; }
    .rpt-sora { font-family: 'Sora', sans-serif; }
    .rpt-stat { transition: transform 0.18s, box-shadow 0.18s; }
    .rpt-stat:hover { transform: translateY(-2px); }
    .rpt-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    .rpt-up { animation: fadeUp 0.35s ease both; }
    .rpt-up-1 { animation: fadeUp 0.35s 0.05s ease both; }
    .rpt-up-2 { animation: fadeUp 0.35s 0.10s ease both; }
    .rpt-up-3 { animation: fadeUp 0.35s 0.15s ease both; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .rpt-spin { animation: spin 0.8s linear infinite; }
  `;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", background: T.bg }}>
      <style>{css}</style>
      <div className="rpt-spin" style={{ width: 36, height: 36, border: `3px solid ${T.border}`, borderTopColor: "#10b981", borderRadius: "50%" }} />
    </div>
  );

  return (
    <div className="rpt-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>
      <style>{css}</style>

      {/* Header */}
      <div className="rpt-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="rpt-sora" style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: "-0.02em" }}>Inventory Report</h1>
          <p style={{ color: T.textSec, fontSize: 13, margin: "4px 0 0" }}>Stock levels, valuation & category breakdown</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: `1px solid ${T.border}`, borderRadius: 9, background: "transparent", color: T.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaSync size={11} /> Refresh
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", border: `1px solid ${T.border}`, borderRadius: 9, background: "transparent", color: T.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <FaDownload size={11} /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="rpt-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Items",    value: totalItems,          sub: `${inStock} in stock`,     icon: <FaBoxOpen />,             color: "#3b82f6", dim: T.blueDim   },
          { label: "Stock Value",    value: fmtK(totalStockVal), sub: "total valuation",         icon: <FaWarehouse />,           color: "#10b981", dim: T.greenDim  },
          { label: "Low Stock",      value: lowStock,            sub: "below reorder point",     icon: <FaExclamationTriangle />, color: "#f59e0b", dim: T.amberDim  },
          { label: "Out of Stock",   value: outOfStock,          sub: "need restocking",         icon: <FaExclamationTriangle />, color: "#ef4444", dim: "rgba(239,68,68,0.1)" },
        ].map((kpi, i) => (
          <div key={i} className="rpt-stat" style={{ ...card, padding: "20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 16, right: 16, height: 1, background: `linear-gradient(90deg, transparent, ${kpi.color}50, transparent)` }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</p>
                <p className="rpt-sora" style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: "0 0 4px", lineHeight: 1 }}>{kpi.value}</p>
                <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{kpi.sub}</p>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: kpi.dim, color: kpi.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                {kpi.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="rpt-up-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Stock level distribution */}
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Stock Level Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stockBuckets} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.textSec, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v) => [v, "Items"]} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={38}>
                {stockBuckets.map((b, i) => <Cell key={i} fill={b.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category value pie */}
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Value by Category</p>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="44%" outerRadius={72} innerRadius={42} dataKey="value" paddingAngle={3}>
                  {catData.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v) => [fmtM(v), "Value"]} />
                <Legend iconSize={7} iconType="circle" wrapperStyle={{ fontSize: 10, color: T.textSec }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 12 }}>No data</div>
          )}
        </div>

        {/* Top by stock value */}
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 14px" }}>Top Items by Value</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {topByValue.slice(0, 6).map((it, i) => {
              const pct = totalStockVal > 0 ? ((it.value / totalStockVal) * 100).toFixed(0) : 0;
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{it.name}</span>
                    <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.textSec }}>{fmtK(it.value)}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: T.surface2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full inventory table */}
      <div className="rpt-up-3" style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>All Inventory Items</p>
          <div style={{ position: "relative" }}>
            <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted, fontSize: 11, pointerEvents: "none" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
              style={{ padding: "7px 30px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, background: T.surface2, color: T.textPri, outline: "none", fontFamily: "inherit", width: 220 }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 0 }}><FaTimes size={10} /></button>}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.surface2 }}>
                {["Item Name", "SKU / Code", "Category", "Stock on Hand", "Reorder Point", "Unit Price", "Stock Value", "Status"].map((h, i) => (
                  <th key={i} style={{ padding: "10px 16px", textAlign: i >= 3 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableItems.slice(0, 50).map((it, i) => {
                const isOut    = it.qty === 0;
                const isLow    = it.qty > 0 && it.qty <= it.reorder;
                const statusC  = isOut ? "#ef4444" : isLow ? "#f59e0b" : "#10b981";
                const statusL  = isOut ? "Out" : isLow ? "Low" : "OK";
                const statusBg = isOut ? "rgba(239,68,68,0.1)" : isLow ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)";
                return (
                  <tr key={i} className="rpt-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 16px", fontWeight: 600, color: T.textPri }}>{it.name}</td>
                    <td style={{ padding: "10px 16px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.textSec }}>{it.sku}</td>
                    <td style={{ padding: "10px 16px", color: T.textSec }}>{it.category}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: isOut ? "#ef4444" : isLow ? "#f59e0b" : T.textPri, fontFamily: "'DM Mono', monospace" }}>{it.qty}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{it.reorder}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", color: T.textPri }}>{fmtM(it.price)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, fontFamily: "'DM Mono', monospace", color: T.textPri }}>{fmtM(it.value)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: statusBg, color: statusC, border: `1px solid ${statusC}30` }}>{statusL}</span>
                    </td>
                  </tr>
                );
              })}
              {tableItems.length === 0 && (
                <tr><td colSpan={8} style={{ padding: "48px", textAlign: "center", color: T.textMuted, fontSize: 13 }}>No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {tableItems.length > 50 && (
          <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.textSec, textAlign: "center" }}>
            Showing 50 of {tableItems.length} items
          </div>
        )}
      </div>
    </div>
  );
}
