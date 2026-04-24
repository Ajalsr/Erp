import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";
import { FaFileInvoiceDollar, FaStore, FaMoneyBillWave, FaDownload, FaSync } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";

const RANGES = [
  { label: "This Week",    value: "week"    },
  { label: "This Month",   value: "month"   },
  { label: "This Quarter", value: "quarter" },
  { label: "This Year",    value: "year"    },
  { label: "All Time",     value: "all"     },
];

const fmtM  = (n) => `AED ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK  = (n) => { if (n >= 1000000) return `AED ${(n / 1000000).toFixed(1)}M`; if (n >= 1000) return `AED ${(n / 1000).toFixed(1)}K`; return `AED ${n}`; };
const fmtD  = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const BILL_STATUS_COLOR = {
  open:    "#3b82f6", partial: "#8b5cf6", paid: "#10b981",
  overdue: "#ef4444", draft:   "#f59e0b", void: "#64748b",
};

export default function PurchaseReport() {
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);

  const [range,      setRange]      = useState("month");
  const [loading,    setLoading]    = useState(true);
  const [bills,      setBills]      = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [poStats,    setPoStats]    = useState({});
  const [billStats,  setBillStats]  = useState({});
  const [vendStats,  setVendStats]  = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [billRes, pmtRes, poStRes, bStRes, vStRes] = await Promise.allSettled([
        axiosInstance.get("/api/bills/?limit=500"),
        axiosInstance.get("/api/vendor-payments/?limit=500"),
        axiosInstance.get("/api/purchase-orders/stats"),
        axiosInstance.get("/api/bills/stats"),
        axiosInstance.get("/api/vendors/stats"),
      ]);
      setBills(billRes.status === "fulfilled"   ? billRes.value.data?.data?.bills || billRes.value.data?.bills || [] : []);
      setPayments(pmtRes.status === "fulfilled" ? pmtRes.value.data?.data?.payments || pmtRes.value.data?.payments || [] : []);
      setPoStats(poStRes.status === "fulfilled" ? poStRes.value.data?.data || poStRes.value.data || {} : {});
      setBillStats(bStRes.status === "fulfilled"? bStRes.value.data?.data || bStRes.value.data || {} : {});
      setVendStats(vStRes.status === "fulfilled"? vStRes.value.data?.data || vStRes.value.data || {} : {});
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const inRange = (dateStr) => {
    const d = new Date(dateStr || 0);
    if (range === "week")    return d >= new Date(now - 7 * 86400000);
    if (range === "month")   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (range === "quarter") { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear(); }
    if (range === "year")    return d.getFullYear() === now.getFullYear();
    return true;
  };

  const filteredBills    = bills.filter(b => inRange(b.billDate || b.createdAt));
  const filteredPayments = payments.filter(p => inRange(p.date || p.createdAt));

  const totalBilled  = filteredBills.reduce((s, b) => s + (b.grandTotal || b.total || 0), 0);
  const totalPaid    = filteredPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding  = totalBilled - totalPaid;
  const overdueBills = filteredBills.filter(b => b.status === "overdue").length;

  // Monthly spend trend (6 months)
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const mon = d.toLocaleString("en-AE", { month: "short" });
    const spend = bills
      .filter(b => { const bd = new Date(b.billDate || b.createdAt || 0); return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear(); })
      .reduce((s, b) => s + (b.grandTotal || 0), 0);
    const paid = payments
      .filter(p => { const pd = new Date(p.date || p.createdAt || 0); return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear(); })
      .reduce((s, p) => s + (p.amount || 0), 0);
    return { month: mon, spend: Math.round(spend), paid: Math.round(paid) };
  });

  // Bill status breakdown
  const statusMap = {};
  filteredBills.forEach(b => { const s = b.status || "draft"; statusMap[s] = (statusMap[s] || 0) + 1; });
  const pieData = Object.entries(statusMap).map(([name, value]) => ({ name, value, color: BILL_STATUS_COLOR[name] || "#64748b" }));

  // Top vendors by spend
  const vendMap = {};
  filteredBills.forEach(b => {
    const v = b.vendorName || b.vendor?.displayName || "Unknown";
    if (!vendMap[v]) vendMap[v] = { name: v, bills: 0, spend: 0 };
    vendMap[v].bills++;
    vendMap[v].spend += b.grandTotal || 0;
  });
  const topVendors = Object.values(vendMap).sort((a, b) => b.spend - a.spend).slice(0, 5);

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
      <div className="rpt-spin" style={{ width: 36, height: 36, border: `3px solid ${T.border}`, borderTopColor: "#f59e0b", borderRadius: "50%" }} />
    </div>
  );

  return (
    <div className="rpt-root" style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri }}>
      <style>{css}</style>

      {/* Header */}
      <div className="rpt-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="rpt-sora" style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: "-0.02em" }}>Purchase Report</h1>
          <p style={{ color: T.textSec, fontSize: 13, margin: "4px 0 0" }}>Bills, payments & vendor spend analysis</p>
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
              border: range === r.value ? "1px solid rgba(245,158,11,0.4)" : `1px solid ${T.border}`,
              background: range === r.value ? (isDark ? "rgba(245,158,11,0.12)" : "#fffbeb") : "transparent",
              color: range === r.value ? "#f59e0b" : T.textSec }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="rpt-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Billed",     value: fmtK(totalBilled),   sub: `${filteredBills.length} bills`,        icon: <FaFileInvoiceDollar />, color: "#f59e0b", dim: T.amberDim  },
          { label: "Total Paid",       value: fmtK(totalPaid),     sub: `${filteredPayments.length} payments`,  icon: <FaMoneyBillWave />,      color: "#10b981", dim: T.greenDim  },
          { label: "Outstanding",      value: fmtK(Math.max(0, outstanding)), sub: "balance due",              icon: <FaStore />,              color: "#ef4444", dim: "rgba(239,68,68,0.1)"  },
          { label: "Overdue Bills",    value: overdueBills,        sub: "need attention",                       icon: <FaFileInvoiceDollar />, color: "#8b5cf6", dim: T.purpleDim },
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

      {/* Spend vs Paid trend + Status pie */}
      <div className="rpt-up-2" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Spend vs Paid — Last 6 Months</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fill: T.textSec, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v, n) => [fmtM(v), n === "spend" ? "Billed" : "Paid"]} />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="spend" name="Billed" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="paid"  name="Paid"   fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Bills by Status</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={75} innerRadius={45} dataKey="value" paddingAngle={3}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: T.textSec }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontSize: 12 }}>No data</div>
          )}
        </div>
      </div>

      {/* Top vendors + Bills table */}
      <div className="rpt-up-3" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
        <div style={{ ...card, padding: "20px" }}>
          <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 14px" }}>Top Vendors by Spend</p>
          {topVendors.length === 0 ? (
            <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", paddingTop: 40 }}>No data</div>
          ) : topVendors.map((v, i) => (
            <div key={i} className="rpt-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 9, transition: "background 0.1s" }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: T.amberDim, color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</p>
                <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>{v.bills} bill{v.bills !== 1 ? "s" : ""}</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{fmtK(v.spend)}</span>
            </div>
          ))}
        </div>

        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="rpt-sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Recent Bills</p>
            <span style={{ fontSize: 11, color: T.textSec }}>{filteredBills.length} records</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.surface2 }}>
                  {["Bill #", "Vendor", "Status", "Bill Date", "Due Date", "Total"].map((h, i) => (
                    <th key={i} style={{ padding: "10px 14px", textAlign: i >= 5 ? "right" : "left", fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBills.slice(0, 15).map((b, i) => {
                  const sc = BILL_STATUS_COLOR[b.status] || "#64748b";
                  return (
                    <tr key={i} className="rpt-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "10px 14px", fontFamily: "'DM Mono', monospace", fontWeight: 600, color: T.blueLight }}>{b.billNumber || "—"}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: T.textPri }}>{b.vendorName || b.vendor?.displayName || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>{b.status || "—"}</span>
                      </td>
                      <td style={{ padding: "10px 14px", color: T.textSec }}>{fmtD(b.billDate)}</td>
                      <td style={{ padding: "10px 14px", color: b.status === "overdue" ? "#ef4444" : T.textSec }}>{fmtD(b.dueDate)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>{fmtM(b.grandTotal || b.total)}</td>
                    </tr>
                  );
                })}
                {filteredBills.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: "40px 14px", textAlign: "center", color: T.textMuted, fontSize: 12 }}>No bills in this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
