import { useEffect, useState, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  FaFileInvoiceDollar, FaShoppingCart, FaMoneyBillWave,
  FaBuilding, FaDownload, FaSync, FaBoxOpen,
} from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";

const RANGES = [
  { label: "This Week",    value: "week"    },
  { label: "This Month",   value: "month"   },
  { label: "This Quarter", value: "quarter" },
  { label: "This Year",    value: "year"    },
  { label: "All Time",     value: "all"     },
];

const fmtM = (n) =>
  `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = (n) => {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `AED ${(n / 1_000).toFixed(1)}K`;
  return `AED ${parseFloat(n || 0).toFixed(0)}`;
};
const fmtD = (d) =>
  d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PO_STATUS_COLOR = {
  draft:     "#64748b",
  pending:   "#f59e0b",
  approved:  "#3b82f6",
  ordered:   "#8b5cf6",
  received:  "#10b981",
  partial:   "#06b6d4",
  cancelled: "#ef4444",
};
const BILL_STATUS_COLOR = {
  open:    "#3b82f6",
  partial: "#8b5cf6",
  paid:    "#10b981",
  overdue: "#ef4444",
  draft:   "#f59e0b",
  void:    "#64748b",
};

export default function PurchaseReport() {
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);

  const [range,      setRange]      = useState("month");
  const [loading,    setLoading]    = useState(true);
  const [pos,        setPos]        = useState([]);
  const [bills,      setBills]      = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [billStats,  setBillStats]  = useState({});
  const [vendStats,  setVendStats]  = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, billRes, pmtRes, bStRes, vStRes] = await Promise.allSettled([
        axiosInstance.get("/api/purchase-orders/getorders?limit=500"),
        axiosInstance.get("/api/bills/?limit=500"),
        axiosInstance.get("/api/vendor-payments/?limit=500"),
        axiosInstance.get("/api/bills/stats"),
        axiosInstance.get("/api/vendors/?limit=1"),
      ]);
      const poData = poRes.status === "fulfilled" ? poRes.value.data?.data?.purchaseOrders || poRes.value.data?.purchaseOrders || [] : [];
      setPos(poData);
      setBills(billRes.status === "fulfilled"   ? billRes.value.data?.data?.bills || billRes.value.data?.bills || [] : []);
      setPayments(pmtRes.status === "fulfilled" ? pmtRes.value.data?.data?.payments || pmtRes.value.data?.payments || [] : []);
      setBillStats(bStRes.status === "fulfilled" ? bStRes.value.data?.data || bStRes.value.data || {} : {});
      setVendStats(vStRes.status === "fulfilled"  ? vStRes.value.data?.data || vStRes.value.data || {} : {});
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const inRange = useCallback((dateStr) => {
    const d = new Date(dateStr || 0);
    if (range === "week")    return d >= new Date(now - 7 * 86400000);
    if (range === "month")   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (range === "quarter") { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear(); }
    if (range === "year")    return d.getFullYear() === now.getFullYear();
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const filteredPOs    = useMemo(() => pos.filter(p => inRange(p.orderDate || p.createdAt)), [pos, inRange]);
  const filteredBills  = useMemo(() => bills.filter(b => inRange(b.billDate || b.createdAt)), [bills, inRange]);

  // KPI aggregates
  const totalPOValue  = filteredPOs.reduce((s, p) => s + (p.total || 0), 0);
  const totalBilled   = filteredBills.reduce((s, b) => s + (b.totals?.grandTotal || b.grandTotal || 0), 0);
  const totalPaid     = filteredBills.reduce((s, b) => s + (b.amountPaid || 0), 0);
  const outstanding   = filteredBills.reduce((s, b) => s + (b.balanceDue || Math.max(0, (b.totals?.grandTotal || 0) - (b.amountPaid || 0))), 0);
  const overdueBills  = filteredBills.filter(b => b.status === "overdue").length;
  const totalVendors  = billStats?.totalVendors || vendStats?.total || 0;

  // Monthly 6-month trend (PO value + Bills spend + Paid)
  const trendData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const mon = d.toLocaleString("en-AE", { month: "short" });
    const match = (arr, dateField) => arr.filter(x => {
      const xd = new Date(x[dateField] || x.createdAt || 0);
      return xd.getMonth() === d.getMonth() && xd.getFullYear() === d.getFullYear();
    });
    const poVal   = match(pos,      "orderDate").reduce((s, p) => s + (p.total || 0), 0);
    const billed  = match(bills,    "billDate").reduce((s, b) => s + (b.totals?.grandTotal || 0), 0);
    const paid    = match(payments, "date").reduce((s, p) => s + (p.amount || 0), 0);
    return { month: mon, po: Math.round(poVal), billed: Math.round(billed), paid: Math.round(paid) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pos, bills, payments]);

  // PO status pie
  const poStatusMap = useMemo(() => {
    const m = {};
    filteredPOs.forEach(p => { const s = p.status || "draft"; m[s] = (m[s] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value, color: PO_STATUS_COLOR[name] || "#64748b" }));
  }, [filteredPOs]);

  // Bills status pie
  const billStatusMap = useMemo(() => {
    const m = {};
    filteredBills.forEach(b => { const s = b.status || "draft"; m[s] = (m[s] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value, color: BILL_STATUS_COLOR[name] || "#64748b" }));
  }, [filteredBills]);

  // Top vendors by PO value
  const topVendors = useMemo(() => {
    const m = {};
    filteredPOs.forEach(p => {
      const v = p.vendorName || "Unknown";
      if (!m[v]) m[v] = { name: v, pos: 0, value: 0 };
      m[v].pos++;
      m[v].value += p.total || 0;
    });
    return Object.values(m).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filteredPOs]);

  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
    .rpt-root { font-family: 'DM Sans', sans-serif; }
    .rpt-sora { font-family: 'Sora', sans-serif; }
    .rpt-stat { transition: transform 0.18s, box-shadow 0.18s; }
    .rpt-stat:hover { transform: translateY(-2px); }
    .rpt-pill { cursor: pointer; transition: all 0.15s; }
    .rpt-row:hover { background: ${isDark ? "rgba(255,255,255,0.025)" : "#f8fafc"} !important; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    .rpt-up   { animation: fadeUp 0.35s ease both; }
    .rpt-up-1 { animation: fadeUp 0.35s 0.05s ease both; }
    .rpt-up-2 { animation: fadeUp 0.35s 0.10s ease both; }
    .rpt-up-3 { animation: fadeUp 0.35s 0.15s ease both; }
    .rpt-up-4 { animation: fadeUp 0.35s 0.20s ease both; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .rpt-spin { animation: spin 0.8s linear infinite; }
  `;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", background: T.bg }}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="rpt-spin" style={{ width: 36, height: 36, border: `3px solid ${T.border}`, borderTopColor: "#f59e0b", borderRadius: "50%" }} />
        <span style={{ color: T.textSec, fontSize: 13 }}>Loading purchase data…</span>
      </div>
    </div>
  );

  return (
    <div className="rpt-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>
      <style>{css}</style>

      {/* ── Header ── */}
      <div className="rpt-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="rpt-sora" style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: "-0.02em" }}>Purchase Report</h1>
          <p style={{ color: T.textSec, fontSize: 13, margin: "4px 0 0" }}>Purchase orders, bills & vendor spend analysis</p>
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

      {/* ── Range pills ── */}
      <div className="rpt-up" style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {RANGES.map(r => (
          <button key={r.value} onClick={() => setRange(r.value)} className="rpt-pill"
            style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              border: range === r.value ? "1px solid rgba(245,158,11,0.4)" : `1px solid ${T.border}`,
              background: range === r.value ? (isDark ? "rgba(245,158,11,0.12)" : "#fffbeb") : "transparent",
              color: range === r.value ? "#f59e0b" : T.textSec }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* ── KPI Cards (6) ── */}
      <div className="rpt-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "PO Total Value",  value: fmtK(totalPOValue),       sub: `${filteredPOs.length} POs`,          icon: <FaShoppingCart />,      color: "#8b5cf6", dim: T.purpleDim },
          { label: "Total Billed",    value: fmtK(totalBilled),        sub: `${filteredBills.length} bills`,       icon: <FaFileInvoiceDollar />, color: "#f59e0b", dim: T.amberDim  },
          { label: "Amount Paid",      value: fmtK(totalPaid),          sub: `from ${filteredBills.length} bills`,  icon: <FaMoneyBillWave />,     color: "#10b981", dim: T.greenDim  },
          { label: "Balance Due",     value: fmtK(outstanding),        sub: "total outstanding",                   icon: <FaFileInvoiceDollar />, color: "#ef4444", dim: "rgba(239,68,68,0.1)" },
          { label: "Overdue Bills",   value: overdueBills,             sub: "need attention",                      icon: <FaBoxOpen />,           color: "#06b6d4", dim: "rgba(6,182,212,0.1)" },
          { label: "Vendors",         value: totalVendors || "—",      sub: "in system",                           icon: <FaBuilding />,          color: "#3b82f6", dim: T.blueDim   },
        ].map((kpi, i) => (
          <div key={i} className="rpt-stat" style={{ ...card, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 12, right: 12, height: 1, background: `linear-gradient(90deg, transparent, ${kpi.color}50, transparent)` }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{kpi.label}</p>
                <p className="rpt-sora" style={{ fontSize: 18, fontWeight: 800, color: T.textPri, margin: "0 0 3px", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kpi.value}</p>
                <p style={{ fontSize: 10, color: T.textMuted, margin: 0 }}>{kpi.sub}</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.dim, color: kpi.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginLeft: 6 }}>
                {kpi.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Spend Trend + PO Status Pie ── */}
      <div className="rpt-up-2" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Purchase Trend — Last 6 Months</p>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="poGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"} />
              <XAxis dataKey="month" tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }}
                formatter={(v, name) => [fmtM(v), name === "po" ? "PO Value" : name === "billed" ? "Billed" : "Paid"]}
              />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "po" ? "PO Value" : v === "billed" ? "Billed" : "Paid"} />
              <Area type="monotone" dataKey="po"     stroke="#8b5cf6" strokeWidth={2}   fill="url(#poGrad)"     dot={false} />
              <Area type="monotone" dataKey="billed" stroke="#f59e0b" strokeWidth={2}   fill="url(#billedGrad)" dot={false} />
              <Line  type="monotone" dataKey="paid"  stroke="#10b981" strokeWidth={2}   dot={{ fill: "#10b981", r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* PO status pie */}
          <div style={{ ...card, padding: "16px 20px", flex: 1 }}>
            <p className="rpt-sora" style={{ fontSize: 12, fontWeight: 700, color: T.textPri, margin: "0 0 10px" }}>PO by Status</p>
            {poStatusMap.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={poStatusMap} cx="50%" cy="50%" outerRadius={48} innerRadius={26} dataKey="value" paddingAngle={3}>
                    {poStatusMap.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 11 }} />
                  <Legend iconSize={7} iconType="circle" wrapperStyle={{ fontSize: 10, color: T.textSec }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 12 }}>No data</div>
            )}
          </div>

          {/* Bills status pie */}
          <div style={{ ...card, padding: "16px 20px", flex: 1 }}>
            <p className="rpt-sora" style={{ fontSize: 12, fontWeight: 700, color: T.textPri, margin: "0 0 10px" }}>Bills by Status</p>
            {billStatusMap.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={billStatusMap} cx="50%" cy="50%" outerRadius={48} innerRadius={26} dataKey="value" paddingAngle={3}>
                    {billStatusMap.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 11 }} />
                  <Legend iconSize={7} iconType="circle" wrapperStyle={{ fontSize: 10, color: T.textSec }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 12 }}>No data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Vendors + Monthly bar ── */}
      <div className="rpt-up-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Top vendors */}
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 14px" }}>Top Vendors by PO Value</p>
          {topVendors.length === 0 ? (
            <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", paddingTop: 40 }}>No purchase orders in this period</div>
          ) : topVendors.map((v, i) => {
            const pct = topVendors[0].value > 0 ? Math.round((v.value / topVendors[0].value) * 100) : 0;
            return (
              <div key={i} className="rpt-row" style={{ padding: "8px 8px", borderRadius: 9, marginBottom: 4, transition: "background 0.1s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: T.purpleDim, color: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</p>
                    <p style={{ fontSize: 10, color: T.textSec, margin: 0 }}>{v.pos} PO{v.pos !== 1 ? "s" : ""}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{fmtK(v.value)}</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9", overflow: "hidden", marginLeft: 34 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", borderRadius: 2, transition: "width 0.5s" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Monthly PO count bar */}
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Monthly Spend Overview</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }}
                formatter={(v, name) => [fmtM(v), name === "billed" ? "Billed" : "Paid"]} />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "billed" ? "Billed" : "Paid"} />
              <Bar dataKey="billed" name="billed" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="paid"   name="paid"   fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Purchase Orders Table ── */}
      <div className="rpt-up-3" style={{ ...card, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Purchase Orders</p>
          <span style={{ fontSize: 11, color: T.textSec }}>{filteredPOs.length} records</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.surface2 }}>
                {["PO #", "Vendor", "Status", "Order Date", "Expected Delivery", "Total"].map((h, i) => (
                  <th key={i} style={{ padding: "10px 16px", textAlign: i >= 5 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPOs.slice(0, 20).map((po, i) => {
                const sc = PO_STATUS_COLOR[po.status] || "#64748b";
                const overdue = po.expectedDeliveryDate && new Date(po.expectedDeliveryDate) < now && !["received","cancelled"].includes(po.status);
                return (
                  <tr key={i} className="rpt-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 16px", fontFamily: "'DM Mono', monospace", fontWeight: 600, color: "#8b5cf6" }}>{po.orderNumber || "—"}</td>
                    <td style={{ padding: "10px 16px", fontWeight: 600, color: T.textPri }}>{po.vendorName || "—"}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${sc}18`, color: sc, border: `1px solid ${sc}30`, textTransform: "capitalize" }}>{po.status || "—"}</span>
                    </td>
                    <td style={{ padding: "10px 16px", color: T.textSec }}>{fmtD(po.orderDate)}</td>
                    <td style={{ padding: "10px 16px", color: overdue ? "#ef4444" : T.textSec }}>{fmtD(po.expectedDeliveryDate)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmtM(po.total)}</td>
                  </tr>
                );
              })}
              {filteredPOs.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "40px 16px", textAlign: "center", color: T.textMuted, fontSize: 12 }}>No purchase orders in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bills Table ── */}
      <div className="rpt-up-4" style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Bills</p>
          <span style={{ fontSize: 11, color: T.textSec }}>{filteredBills.length} records</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.surface2 }}>
                {["Bill #", "PO #", "Vendor", "Status", "Bill Date", "Due Date", "Total", "Balance Due"].map((h, i) => (
                  <th key={i} style={{ padding: "10px 16px", textAlign: i >= 6 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBills.slice(0, 20).map((b, i) => {
                const sc = BILL_STATUS_COLOR[b.status] || "#64748b";
                const balDue = b.balanceDue ?? (b.totals?.grandTotal || 0) - (b.amountPaid || 0);
                const isPartiallyPaid = b.status === "partial" || (b.amountPaid > 0 && b.status !== "paid");
                return (
                  <tr key={i} className="rpt-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 16px", fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.blueLight }}>{b.billNumber || "—"}</td>
                    <td style={{ padding: "10px 16px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.textSec }}>{b.poNumber || "—"}</td>
                    <td style={{ padding: "10px 16px", fontWeight: 600, color: T.textPri }}>{b.vendorName || b.vendor?.displayName || "—"}</td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>{b.status || "—"}</span>
                    </td>
                    <td style={{ padding: "10px 16px", color: T.textSec }}>{fmtD(b.billDate)}</td>
                    <td style={{ padding: "10px 16px", color: b.status === "overdue" ? "#ef4444" : T.textSec }}>{fmtD(b.dueDate)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{fmtM(b.totals?.grandTotal || b.grandTotal)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: isPartiallyPaid ? "#f59e0b" : b.status === "paid" ? "#10b981" : b.status === "overdue" ? "#ef4444" : T.textPri, fontFamily: "'DM Mono', monospace" }}>
                      {b.status === "paid" ? <span style={{ color: "#10b981" }}>Paid</span> : fmtM(balDue)}
                    </td>
                  </tr>
                );
              })}
              {filteredBills.length === 0 && (
                <tr><td colSpan={8} style={{ padding: "40px 16px", textAlign: "center", color: T.textMuted, fontSize: 12 }}>No bills in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
