import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  FaFileAlt, FaMoneyBillWave, FaUsers, FaChartLine,
  FaDownload, FaSync, FaFilter
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

const fmtMoney = (n) =>
  `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtK = (n) => {
  if (n >= 1000000) return `AED ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `AED ${(n / 1000).toFixed(1)}K`;
  return `AED ${n}`;
};

const STATUS_COLOR = {
  open:        "#3b82f6",
  confirmed:   "#10b981",
  "in progress":"#8b5cf6",
  completed:   "#10b981",
  draft:       "#f59e0b",
  cancelled:   "#ef4444",
  closed:      "#64748b",
};

export default function SalesReport() {
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);

  const [range,    setRange]    = useState("month");
  const [loading,  setLoading]  = useState(true);
  const [orders,   setOrders]   = useState([]);
  const [invStats, setInvStats] = useState({});
  const [cnStats,  setCnStats]  = useState({});
  const [invoices, setInvoices] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [soRes, invRes, cnRes, invListRes] = await Promise.allSettled([
        axiosInstance.get("/api/sales-orders/getsaleorder?limit=500"),
        axiosInstance.get("/api/invoices/stats"),
        axiosInstance.get("/api/credit-notes/stats"),
        axiosInstance.get("/api/invoices/?limit=500"),
      ]);
      setOrders(soRes.status === "fulfilled" ? (soRes.value.data?.salesOrders || soRes.value.data?.data?.salesOrders || []) : []);
      setInvStats(invRes.status === "fulfilled" ? invRes.value.data?.data || invRes.value.data || {} : {});
      setCnStats(cnRes.status === "fulfilled" ? cnRes.value.data?.data || {} : {});
      setInvoices(invListRes.status === "fulfilled" ? (invListRes.value.data?.data?.invoices || invListRes.value.data?.invoices || []) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now   = new Date();
  const filtered = orders.filter(o => {
    const d = new Date(o.orderDate || o.createdAt || 0);
    if (range === "week")    return d >= new Date(now - 7  * 86400000);
    if (range === "month")   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (range === "quarter") { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear(); }
    if (range === "year")    return d.getFullYear() === now.getFullYear();
    return true;
  });

  const totalRevenue  = filtered.reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders   = filtered.length;
  const avgOrderVal   = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const completedOrds = filtered.filter(o => ["completed", "confirmed", "closed"].includes((o.status || "").toLowerCase())).length;

  const invoicedTotal   = invStats.totalAmount || invStats.total || 0;
  const creditsApplied  = cnStats.totalApplied || 0;
  const creditsPending  = cnStats.totalPending || 0;
  const netRevenue      = Math.max(0, invoicedTotal - creditsApplied);

  // Monthly trend (last 6 months)
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const mon = d.toLocaleString("en-AE", { month: "short" });
    const val = orders
      .filter(o => { const od = new Date(o.orderDate || o.createdAt || 0); return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear(); })
      .reduce((s, o) => s + (o.total || 0), 0);
    const cnt = orders.filter(o => { const od = new Date(o.orderDate || o.createdAt || 0); return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear(); }).length;
    return { month: mon, revenue: Math.round(val), orders: cnt };
  });

  // Status breakdown for pie
  const statusMap = {};
  filtered.forEach(o => {
    const s = (o.status || "draft").toLowerCase();
    statusMap[s] = (statusMap[s] || 0) + 1;
  });
  const pieData = Object.entries(statusMap).map(([name, value]) => ({ name, value, color: STATUS_COLOR[name] || "#64748b" }));

  // AR Aging
  const agingBuckets = { current: [], d30: [], d60: [], d90: [], d90p: [] };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  invoices
    .filter(inv => !["paid", "void", "draft"].includes((inv.status || "").toLowerCase()))
    .forEach(inv => {
      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      if (!due) { agingBuckets.current.push(inv); return; }
      due.setHours(0, 0, 0, 0);
      const days = Math.floor((today - due) / 86400000);
      if (days <= 0)       agingBuckets.current.push(inv);
      else if (days <= 30) agingBuckets.d30.push(inv);
      else if (days <= 60) agingBuckets.d60.push(inv);
      else if (days <= 90) agingBuckets.d90.push(inv);
      else                 agingBuckets.d90p.push(inv);
    });
  const agingSum = (arr) => arr.reduce((s, i) => s + (i.balanceDue || i.total || 0), 0);
  const agingRows = [
    { label: "Current",    key: "current", color: "#10b981", items: agingBuckets.current },
    { label: "1–30 days",  key: "d30",     color: "#3b82f6", items: agingBuckets.d30    },
    { label: "31–60 days", key: "d60",     color: "#f59e0b", items: agingBuckets.d60    },
    { label: "61–90 days", key: "d90",     color: "#f97316", items: agingBuckets.d90    },
    { label: "90+ days",   key: "d90p",    color: "#ef4444", items: agingBuckets.d90p   },
  ];
  const totalAging = agingRows.reduce((s, r) => s + agingSum(r.items), 0);

  // Top customers
  const custMap = {};
  filtered.forEach(o => {
    const c = o.customerName || "Unknown";
    if (!custMap[c]) custMap[c] = { name: c, orders: 0, revenue: 0 };
    custMap[c].orders++;
    custMap[c].revenue += o.total || 0;
  });
  const topCustomers = Object.values(custMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const card   = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
    .rpt-root { font-family: 'DM Sans', sans-serif; }
    .rpt-sora { font-family: 'Sora', sans-serif; }
    .rpt-stat { transition: transform 0.18s, box-shadow 0.18s; }
    .rpt-stat:hover { transform: translateY(-2px); }
    .rpt-pill { cursor: pointer; transition: all 0.15s; }
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="rpt-spin" style={{ width: 36, height: 36, border: `3px solid ${T.border}`, borderTopColor: "#3b82f6", borderRadius: "50%" }} />
        <span style={{ color: T.textSec, fontSize: 13 }}>Loading sales data…</span>
      </div>
    </div>
  );

  return (
    <div className="rpt-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>
      <style>{css}</style>

      {/* Header */}
      <div className="rpt-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="rpt-sora" style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: "-0.02em" }}>Sales Report</h1>
          <p style={{ color: T.textSec, fontSize: 13, margin: "4px 0 0" }}>Revenue, orders & customer performance</p>
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

      {/* Range pills */}
      <div className="rpt-up" style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {RANGES.map(r => (
          <button key={r.value} onClick={() => setRange(r.value)} className="rpt-pill"
            style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              border: range === r.value ? "1px solid rgba(59,130,246,0.4)" : `1px solid ${T.border}`,
              background: range === r.value ? (isDark ? "rgba(59,130,246,0.15)" : "#eff6ff") : "transparent",
              color: range === r.value ? (isDark ? "#60a5fa" : "#1d4ed8") : T.textSec }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="rpt-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
        {[
          { label: "Total Revenue",    value: fmtK(totalRevenue),   sub: `${totalOrders} orders`, icon: <FaMoneyBillWave />, color: "#3b82f6", dim: T.blueDim   },
          { label: "Orders",           value: totalOrders,          sub: `${completedOrds} completed`, icon: <FaFileAlt />,       color: "#10b981", dim: T.greenDim  },
          { label: "Avg Order Value",  value: fmtK(avgOrderVal),    sub: "per order",           icon: <FaChartLine />,     color: "#8b5cf6", dim: T.purpleDim },
          { label: "Invoiced",         value: fmtK(invoicedTotal), sub: `${invStats.count || 0} invoices`, icon: <FaUsers />, color: "#f59e0b", dim: T.amberDim },
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

      {/* Credit Notes Summary Band */}
      <div className="rpt-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          {
            label: "Net Revenue",
            value: fmtK(netRevenue),
            sub:   creditsApplied > 0 ? `After ${fmtK(creditsApplied)} in credits` : "No credits applied",
            color: "#10b981",
            barColor: "#10b981",
            pct: invoicedTotal > 0 ? (netRevenue / invoicedTotal) * 100 : 100,
          },
          {
            label: "Credits Applied",
            value: fmtK(creditsApplied),
            sub:   `${cnStats.countByStatus?.applied?.count || cnStats.countByStatus?.closed?.count || 0} credit notes applied`,
            color: "#f43f5e",
            barColor: "#f43f5e",
            pct: invoicedTotal > 0 ? (creditsApplied / invoicedTotal) * 100 : 0,
          },
          {
            label: "Credits Pending",
            value: fmtK(creditsPending),
            sub:   `${cnStats.totalVoid || 0} voided`,
            color: "#f59e0b",
            barColor: "#f59e0b",
            pct: invoicedTotal > 0 ? (creditsPending / invoicedTotal) * 100 : 0,
          },
        ].map((item, i) => (
          <div key={i} style={{ ...card, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 10, color: T.textSec, fontWeight: 700, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{item.label}</p>
                <p className="rpt-sora" style={{ fontSize: 18, fontWeight: 800, color: item.color, margin: "0 0 3px", lineHeight: 1 }}>{item.value}</p>
                <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{item.sub}</p>
              </div>
            </div>
            <div style={{ height: 4, background: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, item.pct).toFixed(1)}%`, background: item.barColor, borderRadius: 2, transition: "width 0.4s ease" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Trend + Status Pie */}
      <div className="rpt-up-2" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Area chart */}
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Revenue Trend — Last 6 Months</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"} />
              <XAxis dataKey="month" tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, fontFamily: "DM Sans, sans-serif" }}
                labelStyle={{ color: T.textPri, fontWeight: 700 }}
                formatter={(v) => [fmtMoney(v), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: "#3b82f6", r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Orders by Status</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={75} innerRadius={45} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: T.textSec }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 12 }}>No data for this period</div>
          )}
        </div>
      </div>

      {/* Monthly orders bar + Top customers */}
      <div className="rpt-up-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Bar chart */}
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Orders per Month</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v) => [v, "Orders"]} />
              <Bar dataKey="orders" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top customers table */}
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 14px" }}>Top Customers by Revenue</p>
          {topCustomers.length === 0 ? (
            <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", paddingTop: 40 }}>No orders in this period</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topCustomers.map((c, i) => (
                <div key={i} className="rpt-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, background: "transparent", transition: "background 0.1s" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: T.blueDim, color: T.blueLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>{c.orders} order{c.orders !== 1 ? "s" : ""}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                    {fmtK(c.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AR Aging */}
      <div className="rpt-up-3" style={{ ...card, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>AR Aging Report</p>
            <p style={{ fontSize: 11, color: T.textSec, margin: "3px 0 0" }}>Outstanding receivables by age — excludes paid, void & draft invoices</p>
          </div>
          <span className="rpt-sora" style={{ fontSize: 15, fontWeight: 800, color: "#ef4444" }}>{fmtMoney(totalAging)}</span>
        </div>

        {/* Bucket summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 0, borderBottom: `1px solid ${T.border}` }}>
          {agingRows.map((r, i) => {
            const amt = agingSum(r.items);
            const pct = totalAging > 0 ? (amt / totalAging) * 100 : 0;
            return (
              <div key={r.key} style={{ padding: "14px 18px", borderRight: i < 4 ? `1px solid ${T.border}` : "none" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>{r.label}</p>
                <p className="rpt-sora" style={{ fontSize: 16, fontWeight: 800, color: r.color, margin: "0 0 4px" }}>{fmtK(amt)}</p>
                <p style={{ fontSize: 11, color: T.textSec, margin: "0 0 8px" }}>{r.items.length} invoice{r.items.length !== 1 ? "s" : ""}</p>
                <div style={{ height: 3, background: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, pct).toFixed(1)}%`, background: r.color, borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Overdue invoice rows */}
        {[...agingBuckets.d30, ...agingBuckets.d60, ...agingBuckets.d90, ...agingBuckets.d90p].length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.surface2 }}>
                  {["Invoice #", "Customer", "Invoice Date", "Due Date", "Days Overdue", "Balance Due"].map((h, i) => (
                    <th key={i} style={{ padding: "9px 16px", textAlign: i >= 5 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agingRows.slice(1).flatMap(r => r.items.map(inv => {
                  const due = inv.dueDate ? new Date(inv.dueDate) : null;
                  const days = due ? Math.max(0, Math.floor((today - due) / 86400000)) : 0;
                  return (
                    <tr key={inv._id} className="rpt-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "10px 16px", fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.blueLight }}>{inv.invoiceNumber || inv.id || "—"}</td>
                      <td style={{ padding: "10px 16px", fontWeight: 600, color: T.textPri }}>{inv.customer || inv.customerName || "—"}</td>
                      <td style={{ padding: "10px 16px", color: T.textSec }}>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                      <td style={{ padding: "10px 16px", color: T.textSec }}>{due ? due.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                          background: days > 90 ? "rgba(239,68,68,0.12)" : days > 60 ? "rgba(249,115,22,0.12)" : days > 30 ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)",
                          color:      days > 90 ? "#ef4444"              : days > 60 ? "#f97316"              : days > 30 ? "#f59e0b"              : "#3b82f6",
                          border: `1px solid ${days > 90 ? "rgba(239,68,68,0.3)" : days > 60 ? "rgba(249,115,22,0.3)" : days > 30 ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)"}` }}>
                          {days}d overdue
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, fontFamily: "'DM Mono', monospace", color: days > 60 ? "#ef4444" : T.textPri }}>{fmtMoney(inv.balanceDue || inv.total || 0)}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        )}

        {totalAging === 0 && (
          <div style={{ padding: "32px 0", textAlign: "center", color: T.textMuted, fontSize: 13 }}>
            No outstanding receivables
          </div>
        )}
      </div>

      {/* Orders table */}
      <div className="rpt-up-3" style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Recent Sales Orders</p>
          <span style={{ fontSize: 11, color: T.textSec }}>{filtered.length} records</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.surface2 }}>
                {["Order #", "Customer", "Status", "LPO Number", "Order Date", "Total"].map((h, i) => (
                  <th key={i} style={{ padding: "10px 16px", textAlign: i >= 5 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((o, i) => {
                const sc = STATUS_COLOR[(o.status || "").toLowerCase()] || "#64748b";
                return (
                  <tr key={i} className="rpt-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "11px 16px", fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.blueLight }}>{o.orderNumber || o.saleOrderNumber || "—"}</td>
                    <td style={{ padding: "11px 16px", fontWeight: 600, color: T.textPri }}>{o.customerName || "—"}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>
                        {o.status || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{o.lpoNumber || "—"}</td>
                    <td style={{ padding: "11px 16px", color: T.textSec }}>{o.orderDate ? new Date(o.orderDate).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                    <td style={{ padding: "11px 16px", textAlign: "right", fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmtMoney(o.total)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "48px 16px", textAlign: "center", color: T.textMuted, fontSize: 13 }}>No sales orders found for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
