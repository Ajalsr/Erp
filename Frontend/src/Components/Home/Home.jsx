import { useState, useEffect, useMemo } from "react";
import {
  FaBox, FaShoppingCart, FaTruck, FaFileInvoice,
  FaUser, FaExclamationTriangle,
  FaArrowUp, FaPlus,
  FaArrowRight, FaClock, FaMoneyBillWave,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import useGetDashboardStats from "../../helper/useGetDashboardStats";

/* ─── Sparkline ──────────────────────────────────────────────────── */
const Spark = ({ data, color, h = 38, filled = true }) => {
  if (!data || data.length < 2) return null;
  const W = 120;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    h - ((v - min) / rng) * (h * 0.82) - h * 0.08,
  ]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const uid = `sg${color.replace(/[^a-z0-9]/gi, "")}${h}`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: "100%", height: h }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled && <path d={`${d} L${W},${h} L0,${h} Z`} fill={`url(#${uid})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="2.8" fill={color} />
    </svg>
  );
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const fmtAED = (n, compact = false) => {
  const v = Number(n || 0);
  if (compact && v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`;
  if (compact && v >= 1_000) return `AED ${(v / 1_000).toFixed(1)}K`;
  return `AED ${v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtAgo = (date) => {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 0)     return "just now";
  if (secs < 60)    return `${secs}s ago`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const user     = useAuthStore((s) => s.user);
  const isDark   = useThemeStore((s) => s.isDark);
  const T        = getTheme(isDark);
  const initials = (user?.userId || "A").charAt(0).toUpperCase();

  const { stats, loading, error, refresh } = useGetDashboardStats();

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Destructure live stats ── */
  const {
    totalCustomers, activeCustomers, pendingCustomers,
    todayNewCustomers, thisMonthNewCustomers,
    pendingOrders, todayNewOrders, todayRevenue,
    totalItems, lowStockCount, lowStockItems,
    recentOrders, activeCustomersList, allItems,
    pendingInvoicesCount, pendingInvoicesAmount,
    totalRevenue, thisMonthRevenue,
    todayOrdersPct, revenuePct, pendingActionsPct,
  } = stats;

  /* ── Derive weekly order counts from recentOrders ── */
  const weeklyOrders = useMemo(() => {
    const map = [0, 0, 0, 0, 0, 0, 0];
    const now = Date.now();
    recentOrders.forEach(o => {
      const ts = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      const daysAgo = Math.floor((now - ts) / 86400000);
      if (daysAgo >= 0 && daysAgo < 7) map[6 - daysAgo]++;
    });
    return map;
  }, [recentOrders]);

  /* ── Build activity feed from live data ── */
  const activities = useMemo(() => {
    const evts = [];
    recentOrders.slice(0, 4).forEach((o, i) => {
      const num  = o.salesOrderNumber ?? o._id?.slice(-6) ?? "—";
      const cust = o.customerName ?? "";
      const ts   = o.updatedAt ?? o.createdAt;
      evts.push({ id: `so-${i}`, k: "cart", text: `Sale order #${num}${cust ? " — " + cust : ""}`, ago: fmtAgo(ts), _ts: ts ? new Date(ts).getTime() : 0 });
    });
    activeCustomersList.slice(0, 3).forEach((cu, i) => {
      const name = cu.customerDisplayName ?? cu.companyName ?? "Unknown";
      const ts   = cu.created_at ?? cu.createdAt;
      evts.push({ id: `cu-${i}`, k: "user", text: `New customer: ${name}`, ago: fmtAgo(ts), _ts: ts ? new Date(ts).getTime() : 0 });
    });
    lowStockItems.slice(0, 3).forEach((item, i) => {
      evts.push({ id: `ls-${i}`, k: "box", text: `Low stock: ${item.name} (${item.cur} left)`, ago: "now", _ts: Date.now() - i * 1000 });
    });
    allItems.filter(item => {
      const ts = item.created_at || item.createdAt;
      return ts && Date.now() - new Date(ts).getTime() < 7 * 86400000;
    }).slice(0, 3).forEach((item, i) => {
      const ts = item.created_at || item.createdAt;
      evts.push({ id: `ni-${i}`, k: "invoice", text: `New item: ${item.itemName || item.name || "Unknown"}`, ago: fmtAgo(ts), _ts: ts ? new Date(ts).getTime() : 0 });
    });
    return evts.sort((a, b) => (b._ts || 0) - (a._ts || 0)).slice(0, 8);
  }, [recentOrders, activeCustomersList, lowStockItems, allItems]);

  const actMeta = {
    cart:    { icon: <FaShoppingCart />, c: T.blue,   dim: T.blueDim   },
    truck:   { icon: <FaTruck />,        c: T.green,  dim: T.greenDim  },
    box:     { icon: <FaBox />,          c: T.red,    dim: T.redDim    },
    invoice: { icon: <FaFileInvoice />,  c: T.amber,  dim: T.amberDim  },
    user:    { icon: <FaUser />,         c: T.purple, dim: T.purpleDim },
  };

  /* ── Theme shortcuts ── */
  const surf  = T.surface;
  const surf2 = T.surface2;
  const bdr   = T.border;
  const track = isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0";

  const card = (ex = {}) => ({
    background: surf, border: `1px solid ${bdr}`, borderRadius: "16px",
    transition: "background .25s,border-color .25s", ...ex,
  });

  const css = `
    *{box-sizing:border-box}
    .hd{font-family:'DM Sans',sans-serif}
    .sora{font-family:'Sora',sans-serif}
    @keyframes hdup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .s0{animation:hdup .35s ease both}
    .s1{animation:hdup .35s .06s ease both}
    .s2{animation:hdup .35s .12s ease both}
    .s3{animation:hdup .35s .18s ease both}
    .s4{animation:hdup .35s .24s ease both}
    .s5{animation:hdup .35s .30s ease both}
    .s6{animation:hdup .35s .36s ease both}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    .live{animation:pulse 2.4s ease infinite}
    @keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    .prog{transform-origin:left;animation:grow .9s .4s cubic-bezier(.34,1,.64,1) both}
    .kpi{transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;cursor:pointer}
    .kpi:hover{transform:translateY(-3px) scale(1.012);box-shadow:${isDark ? "0 16px 48px rgba(0,0,0,.5)" : "0 10px 32px rgba(0,0,0,.1)"} !important}
    .qa{transition:all .16s;cursor:pointer}
    .qa:hover{transform:translateY(-2px);border-color:${isDark ? "rgba(255,255,255,.12)" : "rgba(37,99,235,.25)"} !important}
    .act{transition:background .12s,padding-left .12s;border-radius:10px}
    .act:hover{background:${isDark ? "rgba(255,255,255,.04)" : "#f0f4f8"} !important;padding-left:14px !important}
    .ordr{transition:all .14s;cursor:pointer}
    .ordr:hover{border-color:${isDark ? "rgba(59,130,246,.4)" : "#93c5fd"} !important;background:${isDark ? "rgba(59,130,246,.05)" : "#eff6ff"} !important}
    .stk{transition:background .12s;border-radius:10px}
    .stk:hover{background:${isDark ? "rgba(255,255,255,.03)" : "#f0f4f8"} !important}
    .lnk{transition:color .12s}
    .lnk:hover{color:${isDark ? "#93c5fd" : "#1d4ed8"} !important}
    .bar{transition:opacity .12s}
    .bar:hover{opacity:.8 !important}
    @keyframes spin{to{transform:rotate(360deg)}}
    input::-webkit-scrollbar,textarea::-webkit-scrollbar{width:4px}
    *::-webkit-scrollbar{width:4px;height:4px}
    *::-webkit-scrollbar-track{background:transparent}
    *::-webkit-scrollbar-thumb{background:${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"};border-radius:99px}
  `;

  const Skeleton = ({ w = "100%", h = 14, r = 6 }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: isDark ? "rgba(255,255,255,.06)" : "#e2e8f0", animation: "pulse 1.2s ease infinite" }} />
  );

  return (
    <div className="hd" style={{ minHeight: "100vh", background: T.bg, padding: "22px 26px", color: T.textPri }}>
      <style>{css}</style>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ marginBottom: 14, padding: "10px 16px", borderRadius: 10, background: isDark ? "rgba(239,68,68,.1)" : "#fef2f2", border: `1px solid ${isDark ? "rgba(239,68,68,.2)" : "#fca5a5"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.red, fontWeight: 500 }}>⚠ Could not load dashboard data.</span>
          <button onClick={refresh} style={{ fontSize: 11, fontWeight: 700, color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Retry</button>
        </div>
      )}

      {/* ══ HEADER ══════════════════════════════════════════════════ */}
      <div className="s0" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className="live" style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, display: "inline-block" }} />
            <span style={{ fontSize: 10, color: T.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>Live Dashboard</span>
          </div>
          <h1 className="sora" style={{ fontSize: 21, fontWeight: 700, color: T.textPri, margin: 0, letterSpacing: "-0.03em" }}>
            {greeting()},{" "}
            <span style={isDark
              ? { background: `linear-gradient(120deg,${T.blue},${T.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }
              : { color: T.blue }}>
              {user?.userId || "Admin"}
            </span>
          </h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: "3px 0 0" }}>
            {new Date().toLocaleDateString("en-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="sora" style={{ padding: "7px 14px", background: surf, border: `1px solid ${bdr}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.textPri, letterSpacing: ".06em", minWidth: 90, textAlign: "center" }}>
            {time.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </div>
          <button onClick={refresh} title="Refresh" style={{ width: 36, height: 36, borderRadius: 10, background: loading ? T.blueDim : surf, border: `1px solid ${loading ? T.blue : bdr}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: loading ? T.blue : T.textSec }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? "spin .9s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${T.blue},${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="sora" style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{initials}</span>
          </div>
        </div>
      </div>

      {/* ══ HERO ROW — Revenue + Invoices + Customers ═══════════════ */}
      <div className="s1" style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Total Revenue (from payments) */}
        <div style={{ ...card({ padding: "24px 26px", overflow: "hidden", position: "relative",
          background: isDark ? "linear-gradient(145deg,#0d1526,#101e3a,#0c1828)" : "linear-gradient(145deg,#f0f6ff,#e8f2ff,#ddeeff)",
          border: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "#b8d4f8"}`,
        }) }}>
          <div style={{ position: "absolute", top: -60, right: -50, width: 180, height: 180, borderRadius: "50%", background: isDark ? "rgba(59,130,246,.07)" : "rgba(59,130,246,.09)", pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, position: "relative" }}>
            <div>
              <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 8px" }}>Total Revenue Received</p>
              {loading ? <Skeleton w={180} h={36} r={8} /> : (
                <p className="sora" style={{ fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1, letterSpacing: "-0.04em", color: T.textPri }}>
                  {fmtAED(totalRevenue, true)}
                </p>
              )}
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: isDark ? "rgba(16,185,129,.14)" : "#dcfce7", color: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: `1px solid ${isDark ? "rgba(16,185,129,.25)" : "#86efac"}` }}>
              <FaMoneyBillWave />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "This Month", value: fmtAED(thisMonthRevenue, true), color: T.green },
              { label: "Outstanding", value: fmtAED(pendingInvoicesAmount, true), color: T.amber },
              { label: "Payments", value: String(stats.paymentsCount), color: T.blue },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.7)", borderRadius: 10, padding: "10px 12px", border: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"}` }}>
                <p style={{ fontSize: 9, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".07em", margin: "0 0 4px" }}>{label}</p>
                {loading ? <Skeleton w="80%" h={16} /> : (
                  <p className="sora" style={{ fontSize: 14, fontWeight: 700, color, margin: 0 }}>{value}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pending Invoices */}
        <div style={{ ...card({ padding: "22px", position: "relative", overflow: "hidden" }), display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent,${T.amber},transparent)`, opacity: isDark ? .45 : .6 }} />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", margin: 0 }}>Pending Invoices</p>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: T.amberDim, color: T.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                <FaFileInvoice />
              </div>
            </div>
            {loading ? <Skeleton w="60%" h={34} r={8} /> : (
              <p className="sora" style={{ fontSize: 32, fontWeight: 800, color: T.textPri, margin: "0 0 4px", lineHeight: 1 }}>{pendingInvoicesCount}</p>
            )}
            {loading ? <Skeleton w="90%" h={12} r={4} style={{ marginTop: 4 }} /> : (
              <p style={{ fontSize: 11, color: T.textSec, margin: "4px 0 0" }}>Awaiting · {fmtAED(pendingInvoicesAmount, true)}</p>
            )}
          </div>
          <button className="qa" onClick={() => navigate("/Sales/Invoices")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", marginTop: 16, background: T.amberDim, color: T.amber, border: `1px solid ${isDark ? "rgba(245,158,11,.22)" : "#fcd34d"}`, borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            View Invoices <FaArrowRight size={9} />
          </button>
        </div>

        {/* Active Customers */}
        <div style={{ ...card({ padding: "22px", position: "relative", overflow: "hidden" }), display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent,${T.purple},transparent)`, opacity: isDark ? .45 : .6 }} />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", margin: 0 }}>Active Customers</p>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: T.purpleDim, color: T.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                <FaUser />
              </div>
            </div>
            {loading ? <Skeleton w="50%" h={34} r={8} /> : (
              <p className="sora" style={{ fontSize: 32, fontWeight: 800, color: T.textPri, margin: "0 0 4px", lineHeight: 1 }}>{activeCustomers}</p>
            )}
            <p style={{ fontSize: 11, color: T.textSec, margin: "4px 0 0" }}>{totalCustomers} total · {pendingCustomers} pending</p>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: T.purple, marginTop: 6 }}>
              <FaArrowUp size={8} /> +{thisMonthNewCustomers} this month
            </span>
          </div>
          <button className="qa" onClick={() => navigate("/Sales/Customers")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", marginTop: 16, background: T.purpleDim, color: T.purple, border: `1px solid ${isDark ? "rgba(139,92,246,.22)" : "#c4b5fd"}`, borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            View Customers <FaArrowRight size={9} />
          </button>
        </div>
      </div>

      {/* ══ KPI CARDS ═══════════════════════════════════════════════ */}
      <div className="s2" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
        {[
          { label: "Total Items",      val: loading ? "…" : totalItems,          icon: <FaBox />,                  c: T.blue,  dim: T.blueDim,  trend: null,    action: () => navigate("/Items/Items") },
          { label: "Pending Orders",   val: loading ? "…" : pendingOrders,        icon: <FaShoppingCart />,         c: T.amber, dim: T.amberDim, trend: null,    action: () => navigate("/Sales/Salesorders") },
          { label: "Orders Today",     val: loading ? "…" : todayNewOrders,       icon: <FaTruck />,                c: T.green, dim: T.greenDim, trend: null,    action: () => navigate("/Sales/Salesorders") },
          { label: "Low Stock Alerts", val: loading ? "…" : lowStockCount,        icon: <FaExclamationTriangle />,  c: T.red,   dim: T.redDim,   trend: null,    action: () => navigate("/Items/Items") },
        ].map((k, i) => (
          <div key={i} className="kpi" onClick={k.action}
            style={{ ...card({ padding: "18px 20px", position: "relative", overflow: "hidden" }) }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent 5%,${k.c},transparent 95%)`, opacity: isDark ? .35 : .55 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: k.dim, color: k.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{k.icon}</div>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: isDark ? "rgba(255,255,255,.05)" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: T.textSec }}>
                <FaArrowRight size={9} />
              </div>
            </div>
            <p className="sora" style={{ fontSize: 30, fontWeight: 800, color: T.textPri, margin: "0 0 3px", lineHeight: 1 }}>{k.val}</p>
            <p style={{ fontSize: 11, color: T.textSec, margin: 0, fontWeight: 500 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* ══ QUICK ACTIONS ═══════════════════════════════════════════ */}
      <div className="s3" style={{ marginBottom: 14 }}>
        <p className="sora" style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 10px" }}>Quick Actions</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {[
            { label: "New Sale Order",   sub: "Create sales order",  icon: <FaShoppingCart />, c: T.blue,   dim: T.blueDim,   path: "/Sales/Salesorders/Newsalesorders" },
            { label: "New Invoice",      sub: "Issue an invoice",    icon: <FaFileInvoice />,  c: T.amber,  dim: T.amberDim,  path: "/Sales/Createinvoices" },
            { label: "Record Payment",   sub: "Log a payment",       icon: <FaMoneyBillWave/>, c: T.green,  dim: T.greenDim,  path: "/Sales/PaymentsReceived" },
            { label: "Add Item",         sub: "Add to catalog",      icon: <FaBox />,          c: T.purple, dim: T.purpleDim, path: "/Items/Items/New" },
            { label: "New Customer",     sub: "Add a customer",      icon: <FaUser />,         c: "#06b6d4", dim: isDark ? "rgba(6,182,212,.12)" : "#ecfeff", path: "/Sales/Customers/Newcustomers" },
          ].map((a, i) => (
            <div key={i} className="qa" onClick={() => navigate(a.path)}
              style={{ ...card({ padding: "13px 15px" }), display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: a.dim, color: a.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{a.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.label}</p>
                <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0" }}>{a.sub}</p>
              </div>
              <FaPlus size={9} style={{ color: T.textSec, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>

      {/* ══ ACTIVITY + RECENT ORDERS ════════════════════════════════ */}
      <div className="s4" style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 14, marginBottom: 14 }}>

        {/* Activity Feed */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Activity Feed</p>
              <span className="live" style={{ width: 6, height: 6, borderRadius: "50%", background: loading ? T.amber : T.green, display: "inline-block" }} />
            </div>
            <span style={{ fontSize: 10, color: T.textSec }}>{activities.length} events</span>
          </div>
          <div style={{ padding: "6px 12px", maxHeight: 300, overflowY: "auto" }}>
            {loading
              ? [1,2,3,4].map(i => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, opacity: 1 - i * 0.15 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: isDark ? "rgba(255,255,255,.06)" : "#e2e8f0", flexShrink: 0, animation: "pulse 1.2s ease infinite" }} />
                    <div style={{ flex: 1 }}>
                      <Skeleton w={`${80 - i * 10}%`} h={11} />
                      <div style={{ marginTop: 5 }}><Skeleton w="40%" h={9} /></div>
                    </div>
                  </div>
                ))
              : activities.length === 0
                ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: T.textMuted }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
                      <p style={{ fontSize: 13, margin: 0 }}>No recent activity</p>
                    </div>
                  )
                : activities.map(a => {
                    const m = actMeta[a.k] || actMeta.cart;
                    return (
                      <div key={a.id} className="act" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: m.dim, color: m.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>{m.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: T.textPri, fontWeight: 500, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</p>
                          <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                            <FaClock size={8} /> {a.ago}
                          </p>
                        </div>
                      </div>
                    );
                  })
            }
          </div>
        </div>

        {/* Recent Orders */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Recent Orders</p>
            <button className="lnk" onClick={() => navigate("/Sales/Salesorders")}
              style={{ fontSize: 11, color: T.textSec, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              View all <FaArrowRight size={8} />
            </button>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
            {loading
              ? [1,2,3].map(i => (
                  <div key={i} style={{ border: `1px solid ${bdr}`, borderRadius: 12, padding: "12px 14px", background: surf2 }}>
                    <Skeleton w="60%" h={13} />
                    <div style={{ marginTop: 6 }}><Skeleton w="40%" h={10} /></div>
                  </div>
                ))
              : recentOrders.length === 0
                ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: T.textMuted }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>🛒</div>
                      <p style={{ fontSize: 13, margin: 0 }}>No orders yet</p>
                    </div>
                  )
                : recentOrders.slice(0, 5).map((o, idx) => {
                    const open = !["completed","delivered","cancelled"].includes((o.status||"").toLowerCase());
                    const num  = o.salesOrderNumber ?? `#${idx+1}`;
                    const cust = o.customerName ?? "—";
                    const amt  = Number(o.total ?? o.totalAmount ?? 0).toLocaleString("en-AE");
                    const date = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-AE", { day: "numeric", month: "short" }) : "—";
                    return (
                      <div key={o._id || idx} className="ordr" onClick={() => navigate("/Sales/Salesorders")}
                        style={{ border: `1px solid ${bdr}`, borderRadius: 12, padding: "11px 14px", background: surf2 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                          <div>
                            <p className="sora" style={{ fontSize: 12, fontWeight: 700, color: T.textPri, margin: 0 }}>{num}</p>
                            <p style={{ fontSize: 11, color: T.textSec, margin: "2px 0 0" }}>{cust}</p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p className="sora" style={{ fontSize: 12, fontWeight: 700, color: T.textPri, margin: 0 }}>AED {amt}</p>
                            <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0" }}>{date}</p>
                          </div>
                        </div>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: open ? T.blueDim : T.greenDim, color: open ? T.blueLight : T.green, border: `1px solid ${open ? (isDark ? "rgba(59,130,246,.22)" : "#93c5fd") : (isDark ? "rgba(16,185,129,.22)" : "#86efac")}` }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: open ? T.blue : T.green }} />
                          {o.status || "open"}
                        </span>
                      </div>
                    );
                  })
            }
          </div>
        </div>
      </div>

      {/* ══ LOW STOCK + WEEKLY ORDERS + TODAY'S METRICS ═════════════ */}
      <div className="s5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

        {/* Low Stock */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Low Stock</p>
              {lowStockCount > 0 && (
                <span style={{ padding: "2px 8px", borderRadius: 999, background: isDark ? "rgba(239,68,68,.1)" : "#fee2e2", color: T.red, fontSize: 9, fontWeight: 700, border: `1px solid ${isDark ? "rgba(239,68,68,.2)" : "#fca5a5"}` }}>
                  {lowStockItems.filter(x => x.s === "critical").length} critical
                </span>
              )}
            </div>
            <button className="lnk" onClick={() => navigate("/Items/Items")}
              style={{ fontSize: 11, color: T.textSec, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              View all <FaArrowRight size={8} />
            </button>
          </div>
          <div style={{ padding: "6px 12px", maxHeight: 260, overflowY: "auto" }}>
            {loading
              ? [1,2,3].map(i => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "11px 10px" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: isDark ? "rgba(255,255,255,.06)" : "#e2e8f0", flexShrink: 0, animation: "pulse 1.2s ease infinite" }} />
                    <div style={{ flex: 1 }}><Skeleton w="70%" h={12} /><div style={{ marginTop: 6 }}><Skeleton w="100%" h={4} /></div></div>
                  </div>
                ))
              : lowStockItems.length === 0
                ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: T.textMuted }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                      <p style={{ fontSize: 13, margin: 0 }}>All stock levels OK</p>
                    </div>
                  )
                : lowStockItems.slice(0, 6).map(item => {
                    const crit = item.s === "critical";
                    const pct  = Math.min(Math.round((item.cur / item.min) * 100), 100);
                    const ic   = crit ? T.red : T.amber;
                    const idim = crit ? T.redDim : T.amberDim;
                    return (
                      <div key={item.id} className="stk" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: idim, color: ic, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                          <FaBox />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>{item.name}</p>
                            <span className="sora" style={{ fontSize: 12, fontWeight: 700, color: ic }}>{item.cur}<span style={{ fontSize: 10, color: T.textSec, fontWeight: 400 }}>/{item.min}</span></span>
                          </div>
                          <div style={{ height: 4, background: track, borderRadius: 999, overflow: "hidden" }}>
                            <div className="prog" style={{ height: "100%", width: `${pct}%`, background: ic, borderRadius: 999 }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                            <span style={{ fontSize: 10, color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{item.code}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: ic, textTransform: "uppercase" }}>{crit ? "Critical" : "Warning"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
            }
          </div>
        </div>

        {/* Weekly Orders Bar Chart */}
        <div style={card({ padding: "20px 22px" })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Weekly Orders</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: "3px 0 0" }}>Last 7 days</p>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: T.blueDim, color: T.blueLight, fontSize: 11, fontWeight: 700, border: `1px solid ${isDark ? "rgba(59,130,246,.22)" : "#93c5fd"}` }}>
              {weeklyOrders.reduce((s, v) => s + v, 0)} total
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 70, marginBottom: 10 }}>
            {weeklyOrders.map((v, i) => {
              const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
              const maxV = Math.max(...weeklyOrders, 1);
              const last = i === weeklyOrders.length - 1;
              return (
                <div key={i} className="bar" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%" }}>
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                    <div style={{ width: "100%", height: `${Math.max((v / maxV) * 100, 5)}%`, borderRadius: "4px 4px 0 0", background: last ? T.blue : (isDark ? "rgba(59,130,246,.22)" : "#bfdbfe"), position: "relative" }}>
                      {v > 0 && (
                        <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: last ? T.blue : T.textSec, whiteSpace: "nowrap" }}>{v}</div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 8, color: last ? T.blue : T.textSec, fontWeight: last ? 700 : 400 }}>{days[i]}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8 }}>
            <Spark data={weeklyOrders.length > 1 ? weeklyOrders : [0, 1]} color={T.blue} h={30} filled />
          </div>
        </div>

        {/* Today's Metrics */}
        <div style={card({ padding: "20px 22px" })}>
          <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>Today's Metrics</p>
          {[
            { label: "New Orders",      value: loading ? "…" : String(todayNewOrders),                                   color: T.blue,   pct: todayOrdersPct },
            { label: "New Customers",   value: loading ? "…" : String(todayNewCustomers),                                 color: T.purple, pct: Math.min(Math.round((todayNewCustomers / 10) * 100), 100) },
            { label: "Revenue Today",   value: loading ? "…" : fmtAED(todayRevenue, true),                                color: T.green,  pct: revenuePct },
            { label: "Pending Actions", value: loading ? "…" : String(pendingOrders + pendingInvoicesCount),              color: T.amber,  pct: pendingActionsPct },
            { label: "Low Stock Items", value: loading ? "…" : String(lowStockCount),                                     color: T.red,    pct: Math.min(lowStockCount * 10, 100) },
          ].map(m => (
            <div key={m.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: T.textSec }}>{m.label}</span>
                <span className="sora" style={{ fontSize: 12, fontWeight: 700, color: T.textPri }}>{m.value}</span>
              </div>
              <div style={{ height: 4, background: track, borderRadius: 999, overflow: "hidden" }}>
                <div className="prog" style={{ height: "100%", width: `${m.pct}%`, background: m.color, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
