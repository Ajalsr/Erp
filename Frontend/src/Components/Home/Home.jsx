import { useState, useEffect, useMemo } from "react";
import {
  FaBox, FaShoppingCart, FaTruck, FaFileInvoice, FaUser,
  FaExclamationTriangle, FaArrowUp, FaArrowRight, FaArrowDown,
  FaClock, FaMoneyBillWave, FaBuilding, FaFileAlt, FaReceipt,
  FaWarehouse,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import useGetDashboardStats from "../../helper/useGetDashboardStats";

/* ─── Sparkline ──────────────────────────────────────────────────── */
const Spark = ({ data, color, h = 38 }) => {
  if (!data || data.length < 2) return null;
  const W = 120, min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, h - ((v - min) / rng) * (h * 0.82) - h * 0.08]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const uid = `sg${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: "100%", height: h }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${W},${h} L0,${h} Z`} fill={`url(#${uid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="3" fill={color} />
    </svg>
  );
};

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

const fmtAED = (n, compact = false) => {
  const v = Number(n || 0);
  if (compact && v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`;
  if (compact && v >= 1_000)     return `AED ${(v / 1_000).toFixed(1)}K`;
  return `AED ${v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtNum = (n) => Number(n || 0).toLocaleString("en-AE");

const fmtAgo = (date) => {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "numeric", month: "short" }) : "—";

const STATUS_COLORS = (status, T) => {
  const s = (status || "").toLowerCase();
  if (["paid", "completed", "received", "delivered"].includes(s)) return { bg: T.greenDim, c: T.green, dot: T.green };
  if (["partial", "ordered", "open"].includes(s))                  return { bg: T.blueDim,  c: T.blue,  dot: T.blue };
  if (["overdue", "cancelled", "void"].includes(s))                return { bg: T.redDim,   c: T.red,   dot: T.red };
  if (["pending", "draft"].includes(s))                            return { bg: T.amberDim, c: T.amber, dot: T.amber };
  return { bg: T.surface2, c: T.textSec, dot: T.textSec };
};

/* ─── Stat pill used inside cards ───────────────────────────────── */
const StatRow = ({ label, value, color, T, loading }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", background: T.surface2, borderRadius: 9, border: `1px solid ${T.border}` }}>
    <span style={{ fontSize: 11, color: T.textSec }}>{label}</span>
    {loading
      ? <div style={{ width: 56, height: 12, borderRadius: 4, background: T.border, animation: "pulse 1.2s ease infinite" }} />
      : <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{value}</span>}
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const user   = useAuthStore((s) => s.user);
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);


  const { stats, loading, error, refresh } = useGetDashboardStats();

  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const {
    totalCustomers, activeCustomers, pendingCustomers, todayNewCustomers,
    pendingOrders, todayNewOrders, todayRevenue,
    totalItems, lowStockCount, lowStockItems, inventoryValue,
    recentOrders, activeCustomersList,
    pendingInvoicesCount, pendingInvoicesAmount,
    overdueInvoicesCount, overdueInvoicesAmount,
    totalRevenue, thisMonthRevenue, paymentsCount,
    totalPayable, openBillsCount, partialBillsCount, overdueBillsCount, recentBills,
    pendingPOs, receivedPOs, totalPOValue, recentPOs,
    totalVendors, thisMonthPaid, vendorPaymentsCount,
    quotesCount, quotesAmount,
    arAging, apAging, cashflowIn, cashflowOut, cashflowNet,
  } = stats;

  const netPL = thisMonthRevenue - thisMonthPaid;

  const weeklyOrders = useMemo(() => {
    const map = [0, 0, 0, 0, 0, 0, 0];
    const now = Date.now();
    recentOrders.forEach(o => {
      const daysAgo = Math.floor((now - new Date(o.createdAt || 0).getTime()) / 86400000);
      if (daysAgo >= 0 && daysAgo < 7) map[6 - daysAgo]++;
    });
    return map;
  }, [recentOrders]);

  const activities = useMemo(() => {
    const evts = [];
    recentOrders.slice(0, 3).forEach((o, i) => {
      const num = o.salesOrderNumber ?? o._id?.slice(-6) ?? "—";
      evts.push({ id: `so-${i}`, k: "cart", text: `Sale order #${num}${o.customerName ? " — " + o.customerName : ""}`, ago: fmtAgo(o.updatedAt ?? o.createdAt), _ts: new Date(o.updatedAt ?? o.createdAt ?? 0).getTime() });
    });
    recentBills.slice(0, 3).forEach((b, i) => {
      evts.push({ id: `bl-${i}`, k: "invoice", text: `Bill ${b.billNumber} — ${b.vendorName || "Vendor"}`, ago: fmtAgo(b.createdAt), _ts: new Date(b.createdAt ?? 0).getTime() });
    });
    recentPOs.slice(0, 2).forEach((p, i) => {
      evts.push({ id: `po-${i}`, k: "truck", text: `PO ${p.orderNumber} — ${p.vendorName || "Vendor"}`, ago: fmtAgo(p.createdAt), _ts: new Date(p.createdAt ?? 0).getTime() });
    });
    activeCustomersList.slice(0, 2).forEach((cu, i) => {
      const name = cu.customerDisplayName ?? cu.companyName ?? "Unknown";
      evts.push({ id: `cu-${i}`, k: "user", text: `New customer: ${name}`, ago: fmtAgo(cu.created_at ?? cu.createdAt), _ts: new Date(cu.created_at ?? cu.createdAt ?? 0).getTime() });
    });
    lowStockItems.slice(0, 2).forEach((item, i) => {
      evts.push({ id: `ls-${i}`, k: "box", text: `Low stock: ${item.name} (${item.cur} left)`, ago: "now", _ts: Date.now() - i * 1000 });
    });
    return evts.sort((a, b) => b._ts - a._ts).slice(0, 12);
  }, [recentOrders, recentBills, recentPOs, activeCustomersList, lowStockItems]);

  const actMeta = {
    cart:    { icon: <FaShoppingCart />, c: T.blue,   dim: T.blueDim   },
    truck:   { icon: <FaTruck />,        c: T.green,  dim: T.greenDim  },
    box:     { icon: <FaBox />,          c: T.red,    dim: T.redDim    },
    invoice: { icon: <FaFileInvoice />,  c: T.amber,  dim: T.amberDim  },
    user:    { icon: <FaUser />,         c: T.purple, dim: T.purpleDim },
  };

  const surf  = T.surface;
  const surf2 = T.surface2;
  const bdr   = T.border;
  const track = isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0";

  const card = (ex = {}) => ({
    background: surf, border: `1px solid ${bdr}`, borderRadius: "14px",
    transition: "background .25s, border-color .25s", ...ex,
  });

  const Sk = ({ w = "100%", h = 14, r = 6 }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: isDark ? "rgba(255,255,255,.06)" : "#e2e8f0", animation: "pulse 1.2s ease infinite" }} />
  );

  const css = `
    *{box-sizing:border-box}
    .hd{font-family:'DM Sans',sans-serif}
    .sora{font-family:'Sora',sans-serif}
    @keyframes hdup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .s0{animation:hdup .3s ease both}
    .s1{animation:hdup .3s .05s ease both}
    .s2{animation:hdup .3s .10s ease both}
    .s3{animation:hdup .3s .15s ease both}
    .s4{animation:hdup .3s .20s ease both}
    .s5{animation:hdup .3s .25s ease both}
    .s6{animation:hdup .3s .30s ease both}
    .s7{animation:hdup .3s .35s ease both}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    .live{animation:pulse 2.4s ease infinite}
    @keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    .prog{transform-origin:left;animation:grow .9s .4s cubic-bezier(.34,1,.64,1) both}
    .kpi{transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s;cursor:pointer}
    .kpi:hover{transform:translateY(-3px) scale(1.013);box-shadow:${isDark ? "0 14px 40px rgba(0,0,0,.5)" : "0 8px 28px rgba(0,0,0,.09)"} !important}
    .qa{transition:all .15s;cursor:pointer}
    .qa:hover{transform:translateY(-2px);border-color:${isDark ? "rgba(255,255,255,.12)" : "rgba(37,99,235,.25)"} !important}
    .act{transition:background .1s,padding-left .1s;border-radius:10px}
    .act:hover{background:${isDark ? "rgba(255,255,255,.04)" : "#f0f4f8"} !important;padding-left:14px !important}
    .ordr{transition:all .13s;cursor:pointer}
    .ordr:hover{border-color:${isDark ? "rgba(59,130,246,.4)" : "#93c5fd"} !important;background:${isDark ? "rgba(59,130,246,.05)" : "#eff6ff"} !important}
    .stk{transition:background .1s;border-radius:10px}
    .stk:hover{background:${isDark ? "rgba(255,255,255,.03)" : "#f0f4f8"} !important}
    .lnk{transition:color .1s}
    .lnk:hover{color:${isDark ? "#93c5fd" : "#1d4ed8"} !important}
    .bar{transition:opacity .1s}.bar:hover{opacity:.75 !important}
    @keyframes spin{to{transform:rotate(360deg)}}
    *::-webkit-scrollbar{width:4px;height:4px}
    *::-webkit-scrollbar-track{background:transparent}
    *::-webkit-scrollbar-thumb{background:${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"};border-radius:99px}
    .sec-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:${T.textSec};margin:0 0 10px;display:flex;align-items:center;gap:8px}
    .sec-label::after{content:'';flex:1;height:1px;background:${bdr}}
  `;

  return (
    <div className="hd" style={{ minHeight: "100vh", background: T.bg, padding: "20px 24px", color: T.textPri }}>
      <style>{css}</style>

      {error && (
        <div style={{ marginBottom: 12, padding: "10px 16px", borderRadius: 10, background: isDark ? "rgba(239,68,68,.1)" : "#fef2f2", border: `1px solid ${isDark ? "rgba(239,68,68,.2)" : "#fca5a5"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.red, fontWeight: 500 }}>⚠ Some dashboard data could not be loaded.</span>
          <button onClick={refresh} style={{ fontSize: 11, fontWeight: 700, color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Retry</button>
        </div>
      )}

      {/* ══ HEADER ══════════════════════════════════════════════════ */}
      <div className="s0" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span className="live" style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, display: "inline-block" }} />
            <span style={{ fontSize: 10, color: T.green, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>Live · Auto-refresh 60s</span>
          </div>
          <h1 className="sora" style={{ fontSize: 20, fontWeight: 700, color: T.textPri, margin: 0, letterSpacing: "-0.03em" }}>
            {greeting()},{" "}
            <span style={isDark ? { background: `linear-gradient(120deg,${T.blue},${T.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } : { color: T.blue }}>
              {user?.userId || "Admin"}
            </span>
          </h1>
          <p style={{ fontSize: 11, color: T.textSec, margin: "3px 0 0" }}>
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
        </div>
      </div>

      {/* ══ SECTION LABEL ═══════════════════════════════════════════ */}
      <p className="sec-label s1">Financial Overview — This Month</p>

      {/* ══ P&L SUMMARY STRIP (6 tiles) ════════════════════════════ */}
      <div className="s1" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Revenue",       value: thisMonthRevenue,  color: T.green,  dim: T.greenDim,  icon: <FaArrowUp size={10} />,   nav: "/Sales/PaymentsReceived",   prefix: true },
          { label: "Expenses",      value: thisMonthPaid,     color: T.red,    dim: T.redDim,    icon: <FaArrowDown size={10} />, nav: "/Purchase/Vendorpayments",  prefix: true },
          { label: "Net P&L",       value: netPL,             color: netPL >= 0 ? T.green : T.red, dim: netPL >= 0 ? T.greenDim : T.redDim, icon: <span style={{ fontSize: 11, fontWeight: 800 }}>{netPL >= 0 ? "+" : "−"}</span>, prefix: true },
          { label: "AR Outstanding",value: pendingInvoicesAmount, color: T.amber, dim: T.amberDim, icon: <FaFileInvoice size={10} />, nav: "/Sales/Invoices",        prefix: true },
          { label: "AP Outstanding",value: totalPayable,      color: T.amber,  dim: T.amberDim,  icon: <FaReceipt size={10} />,   nav: "/Purchase/Bills",           prefix: true },
          { label: "Inventory Value",value: inventoryValue,   color: T.blue,   dim: T.blueDim,   icon: <FaWarehouse size={10} />, nav: "/Items/Items",              prefix: true },
        ].map((t, i) => (
          <div key={i} className={t.nav ? "kpi" : ""} onClick={() => t.nav && navigate(t.nav)}
            style={{ ...card({ padding: "14px 16px", position: "relative", overflow: "hidden", cursor: t.nav ? "pointer" : "default" }) }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent,${t.color},transparent)`, opacity: isDark ? .4 : .55 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: T.textSec }}>{t.label}</span>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: t.dim, color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.icon}</div>
            </div>
            {loading ? <Sk w="80%" h={20} r={5} /> : (
              <p className="sora" style={{ fontSize: 16, fontWeight: 800, color: t.color, margin: 0, lineHeight: 1, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {fmtAED(t.value, true)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ══ MAIN FINANCIAL ROW ══════════════════════════════════════ */}
      <div className="s2" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* ── Revenue Master Card ───────────────────────────────── */}
        <div style={{ ...card({
          padding: "22px 24px", overflow: "hidden", position: "relative",
          background: isDark
            ? "linear-gradient(145deg,#0b1628,#0f1e3a,#0d1930)"
            : "linear-gradient(145deg,#eef5ff,#e4f0ff,#d8ebff)",
          border: `1px solid ${isDark ? "rgba(59,130,246,.1)" : "#b8d4f8"}`,
        }) }}>
          <div style={{ position: "absolute", top: -70, right: -60, width: 220, height: 220, borderRadius: "50%", background: isDark ? "rgba(59,130,246,.05)" : "rgba(59,130,246,.07)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -40, left: -30, width: 150, height: 150, borderRadius: "50%", background: isDark ? "rgba(16,185,129,.04)" : "rgba(16,185,129,.06)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 8px" }}>Total Revenue Received</p>
                {loading ? <Sk w={200} h={38} r={8} /> : (
                  <p className="sora" style={{ fontSize: 34, fontWeight: 800, margin: 0, lineHeight: 1, letterSpacing: "-0.05em", color: T.textPri }}>
                    {fmtAED(totalRevenue, true)}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
                  <span style={{ fontSize: 12, color: T.green, fontWeight: 700 }}>
                    <FaArrowUp size={9} style={{ marginRight: 3 }} />
                    {fmtAED(thisMonthRevenue, true)} this month
                  </span>
                  <span style={{ fontSize: 11, color: T.textSec }}>{paymentsCount} payments</span>
                </div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: isDark ? "rgba(16,185,129,.15)" : "#dcfce7", color: T.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, border: `1px solid ${isDark ? "rgba(16,185,129,.25)" : "#86efac"}` }}>
                <FaMoneyBillWave />
              </div>
            </div>

            {/* Sparkline — weekly orders trend */}
            <div style={{ margin: "14px 0", height: 46 }}>
              <Spark data={weeklyOrders.some(v => v > 0) ? weeklyOrders : [0, 0, 1, 0, 2, 1, 3]} color={T.green} h={46} />
            </div>

            {/* 3 mini-stat tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "This Month Out",  value: fmtAED(thisMonthPaid, true),  color: T.red    },
                { label: "Net P&L",         value: fmtAED(netPL, true),          color: netPL >= 0 ? T.green : T.red },
                { label: "AR Outstanding",  value: fmtAED(pendingInvoicesAmount, true), color: T.amber },
              ].map(s => (
                <div key={s.label} style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.85)", borderRadius: 10, padding: "9px 11px", border: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"}` }}>
                  <p style={{ fontSize: 9, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 4px" }}>{s.label}</p>
                  {loading ? <Sk w="80%" h={13} /> : <p className="sora" style={{ fontSize: 12, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Accounts Receivable ───────────────────────────────── */}
        <div style={{ ...card({ padding: "20px", position: "relative", overflow: "hidden" }), display: "flex", flexDirection: "column" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent,${T.amber},transparent)`, opacity: isDark ? .5 : .7 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".09em", margin: "0 0 8px" }}>Accounts Receivable</p>
              {loading ? <Sk w="75%" h={30} r={7} /> : (
                <p className="sora" style={{ fontSize: 26, fontWeight: 800, color: T.amber, margin: "0 0 2px", lineHeight: 1 }}>{fmtAED(pendingInvoicesAmount, true)}</p>
              )}
              <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>total outstanding</p>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: T.amberDim, color: T.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
              <FaFileInvoice />
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            <StatRow label="Pending invoices"  value={fmtNum(pendingInvoicesCount)}      color={T.blue}  T={T} loading={loading} />
            <StatRow label="Overdue invoices"  value={fmtNum(overdueInvoicesCount)}      color={T.red}   T={T} loading={loading} />
            <StatRow label="Overdue amount"    value={fmtAED(overdueInvoicesAmount,true)} color={T.red}   T={T} loading={loading} />
          </div>

          {overdueInvoicesCount > 0 && !loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: isDark ? "rgba(239,68,68,.08)" : "#fef2f2", border: `1px solid ${isDark ? "rgba(239,68,68,.18)" : "#fca5a5"}`, borderRadius: 9, marginBottom: 10 }}>
              <FaExclamationTriangle size={10} color={T.red} />
              <span style={{ fontSize: 11, color: T.red, fontWeight: 600 }}>{overdueInvoicesCount} invoice{overdueInvoicesCount > 1 ? "s" : ""} overdue</span>
            </div>
          )}

          <button className="qa" onClick={() => navigate("/Sales/Invoices")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", background: T.amberDim, color: T.amber, border: `1px solid ${isDark ? "rgba(245,158,11,.22)" : "#fcd34d"}`, borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            View Invoices <FaArrowRight size={9} />
          </button>
        </div>

        {/* ── Accounts Payable ──────────────────────────────────── */}
        <div style={{ ...card({ padding: "20px", position: "relative", overflow: "hidden" }), display: "flex", flexDirection: "column" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent,${T.red},transparent)`, opacity: isDark ? .5 : .7 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".09em", margin: "0 0 8px" }}>Accounts Payable</p>
              {loading ? <Sk w="75%" h={30} r={7} /> : (
                <p className="sora" style={{ fontSize: 26, fontWeight: 800, color: T.red, margin: "0 0 2px", lineHeight: 1 }}>{fmtAED(totalPayable, true)}</p>
              )}
              <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>bills outstanding</p>
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: T.redDim, color: T.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
              <FaReceipt />
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            <StatRow label="Open bills"       value={fmtNum(openBillsCount)}    color={T.blue}  T={T} loading={loading} />
            <StatRow label="Partially paid"   value={fmtNum(partialBillsCount)} color={T.amber} T={T} loading={loading} />
            <StatRow label="Overdue bills"    value={fmtNum(overdueBillsCount)} color={T.red}   T={T} loading={loading} />
          </div>

          <div style={{ padding: "7px 12px", background: surf2, borderRadius: 9, border: `1px solid ${bdr}`, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: T.textSec }}>Paid this month</span>
              {loading ? <Sk w={60} h={11} /> : <span className="sora" style={{ fontSize: 11, fontWeight: 700, color: T.green }}>{fmtAED(thisMonthPaid, true)}</span>}
            </div>
          </div>

          <button className="qa" onClick={() => navigate("/Purchase/Bills")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", background: T.redDim, color: T.red, border: `1px solid ${isDark ? "rgba(239,68,68,.22)" : "#fca5a5"}`, borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            View Bills <FaArrowRight size={9} />
          </button>
        </div>
      </div>

      {/* ══ SECTION LABEL ═══════════════════════════════════════════ */}
      <p className="sec-label s3">Operations at a Glance</p>

      {/* ══ OPERATIONS KPI CARDS ════════════════════════════════════ */}
      <div className="s3" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 11, marginBottom: 14 }}>
        {[
          {
            label: "Active Customers", val: activeCustomers, icon: <FaUser />,
            sub: `${totalCustomers} total · ${pendingCustomers} pending`,
            c: T.purple, dim: T.purpleDim, nav: "/Sales/Customers",
          },
          {
            label: "Pending Orders", val: pendingOrders, icon: <FaShoppingCart />,
            sub: `${todayNewOrders} new today`,
            subColor: todayNewOrders > 0 ? T.green : undefined,
            c: T.blue, dim: T.blueDim, nav: "/Sales/Salesorders",
          },
          {
            label: "Open Quotes", val: quotesCount, icon: <FaFileAlt />,
            sub: fmtAED(quotesAmount, true) + " pipeline",
            c: T.cyan, dim: T.cyanDim, nav: "/Sales/Quotes",
          },
          {
            label: "Items in Catalog", val: totalItems, icon: <FaBox />,
            sub: lowStockCount > 0 ? `⚠ ${lowStockCount} low stock` : "All stock OK",
            subColor: lowStockCount > 0 ? T.red : T.green,
            c: T.green, dim: T.greenDim, nav: "/Items/Items",
          },
          {
            label: "Vendors", val: totalVendors, icon: <FaBuilding />,
            sub: `${pendingPOs} POs pending · ${receivedPOs} received`,
            c: T.amber, dim: T.amberDim, nav: "/Purchase/Vendor",
          },
        ].map((k, i) => (
          <div key={i} className="kpi" onClick={() => navigate(k.nav)}
            style={{ ...card({ padding: "16px 18px", position: "relative", overflow: "hidden" }) }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent 5%,${k.c},transparent 95%)`, opacity: isDark ? .35 : .5 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 11 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: k.dim, color: k.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{k.icon}</div>
              <FaArrowRight size={9} style={{ color: T.textSec, marginTop: 3 }} />
            </div>
            {loading ? <Sk w="50%" h={26} r={7} /> : <p className="sora" style={{ fontSize: 26, fontWeight: 800, color: T.textPri, margin: "0 0 2px", lineHeight: 1 }}>{fmtNum(k.val)}</p>}
            <p style={{ fontSize: 11, fontWeight: 600, color: T.textSec, margin: "0 0 3px" }}>{k.label}</p>
            <p style={{ fontSize: 10, color: k.subColor || T.textSec, margin: 0, lineHeight: 1.3 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ══ QUICK ACTIONS ═══════════════════════════════════════════ */}
      <div className="s4" style={{ marginBottom: 14 }}>
        <p className="sec-label">Quick Actions</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {[
            { label: "New Sale",        icon: <FaShoppingCart />, c: T.blue,   dim: T.blueDim,   path: "/Sales/Salesorders/Newsalesorders" },
            { label: "New Invoice",     icon: <FaFileInvoice />,  c: T.amber,  dim: T.amberDim,  path: "/Sales/Createinvoices" },
            { label: "Receive Payment", icon: <FaMoneyBillWave/>, c: T.green,  dim: T.greenDim,  path: "/Sales/PaymentsReceived" },
            { label: "Add Item",        icon: <FaBox />,          c: T.purple, dim: T.purpleDim, path: "/Items/Items/New" },
            { label: "New Customer",    icon: <FaUser />,         c: T.cyan,   dim: T.cyanDim,   path: "/Sales/Customers/Newcustomers" },
            { label: "New Bill",        icon: <FaReceipt />,      c: T.red,    dim: T.redDim,    path: "/Purchase/Bills/New" },
            { label: "New PO",          icon: <FaTruck />,        c: T.blue,   dim: T.blueDim,   path: "/Purchase/Purchaseorders/New" },
          ].map((a, i) => (
            <div key={i} className="qa" onClick={() => navigate(a.path)}
              style={{ ...card({ padding: "12px 10px" }), display: "flex", flexDirection: "column", alignItems: "center", gap: 7, textAlign: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: a.dim, color: a.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{a.icon}</div>
              <p style={{ fontSize: 10, fontWeight: 600, color: T.textPri, margin: 0, lineHeight: 1.3 }}>{a.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ SECTION LABEL ═══════════════════════════════════════════ */}
      <p className="sec-label s5">Cash Flow & Aging Analysis</p>

      {/* ══ AR AGING + AP AGING + CASH FLOW ════════════════════════ */}
      <div className="s5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>

        {[
          { title: "AR Aging", subtitle: "Receivables overdue breakdown", aging: arAging, nav: "/Sales/Invoices" },
          { title: "AP Aging", subtitle: "Payables overdue breakdown",    aging: apAging, nav: "/Purchase/Bills" },
        ].map(({ title, subtitle, aging, nav }) => {
          const buckets = [
            { label: "Current",   val: aging.current, color: T.green  },
            { label: "1–30 days", val: aging.d30,     color: T.blue   },
            { label: "31–60 d",   val: aging.d60,     color: T.amber  },
            { label: "61–90 d",   val: aging.d90,     color: "#f97316"},
            { label: "90+ days",  val: aging.d90p,    color: T.red    },
          ];
          const total = buckets.reduce((s, b) => s + b.val, 0);
          return (
            <div key={title} style={card({ padding: 0, overflow: "hidden" })}>
              <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>{title}</p>
                  <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0" }}>{subtitle}</p>
                </div>
                <button className="lnk" onClick={() => navigate(nav)}
                  style={{ fontSize: 11, color: T.textSec, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                  View all <FaArrowRight size={8} />
                </button>
              </div>
              <div style={{ padding: "12px 18px" }}>
                {/* Stacked bar */}
                <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", marginBottom: 12, gap: 1 }}>
                  {buckets.map((b, i) => {
                    const pct = total > 0 ? (b.val / total) * 100 : 0;
                    return pct > 0 ? <div key={i} style={{ width: `${pct}%`, background: b.color, borderRadius: i === 0 ? "4px 0 0 4px" : i === buckets.length-1 ? "0 4px 4px 0" : 0 }} /> : null;
                  })}
                  {total === 0 && <div style={{ width: "100%", background: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0", borderRadius: 4 }} />}
                </div>
                {loading ? [1,2,3].map(i => <div key={i} style={{ marginBottom: 8 }}><Sk w="100%" h={11} /></div>) :
                  buckets.map((b, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: T.textSec }}>{b.label}</span>
                      </div>
                      <span className="sora" style={{ fontSize: 12, fontWeight: 700, color: b.val > 0 ? b.color : T.textSec }}>{fmtAED(b.val, true)}</span>
                    </div>
                  ))
                }
                <div style={{ height: 1, background: bdr, margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.textSec }}>Total</span>
                  <span className="sora" style={{ fontSize: 13, fontWeight: 800, color: T.textPri }}>{fmtAED(total, true)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* 30-Day Cash Flow */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${bdr}` }}>
            <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>30-Day Cash Flow</p>
            <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0" }}>Expected in & out — next 30 days</p>
          </div>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 10, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 4px" }}>Net Position</p>
              {loading ? <Sk w={130} h={28} r={7} style={{ margin: "0 auto" }} /> : (
                <p className="sora" style={{ fontSize: 24, fontWeight: 800, color: cashflowNet >= 0 ? T.green : T.red, margin: 0 }}>
                  {cashflowNet >= 0 ? "+" : ""}{fmtAED(cashflowNet, true)}
                </p>
              )}
            </div>
            {[
              { label: "Expected In",  value: cashflowIn,  color: T.green, dim: T.greenDim, icon: <FaArrowDown size={9} style={{ transform: "rotate(180deg)" }} /> },
              { label: "Expected Out", value: cashflowOut, color: T.red,   dim: T.redDim,   icon: <FaArrowDown size={9} /> },
            ].map(row => {
              const maxVal = Math.max(cashflowIn, cashflowOut, 1);
              const pct    = Math.min((row.value / maxVal) * 100, 100);
              return (
                <div key={row.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ color: row.color }}>{row.icon}</span>
                      <span style={{ fontSize: 11, color: T.textSec }}>{row.label}</span>
                    </div>
                    {loading ? <Sk w={70} h={11} /> : <span className="sora" style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{fmtAED(row.value, true)}</span>}
                  </div>
                  <div style={{ height: 6, background: track, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: row.color, borderRadius: 3, transition: "width .6s ease" }} />
                  </div>
                </div>
              );
            })}
            <div style={{ height: 1, background: bdr, margin: "10px 0 8px" }} />
            <p style={{ fontSize: 10, color: T.textSec, margin: 0, lineHeight: 1.5 }}>
              Based on invoice &amp; bill due dates within next 30 days.
            </p>
          </div>
        </div>
      </div>

      {/* ══ SECTION LABEL ═══════════════════════════════════════════ */}
      <p className="sec-label s6">Recent Activity</p>

      {/* ══ RECENT ORDERS + ACTIVITY FEED ══════════════════════════ */}
      <div className="s6" style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 14, marginBottom: 14 }}>

        {/* Recent Sales Orders */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Recent Sales Orders</p>
            <button className="lnk" onClick={() => navigate("/Sales/Salesorders")}
              style={{ fontSize: 11, color: T.textSec, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              View all <FaArrowRight size={8} />
            </button>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7, maxHeight: 340, overflowY: "auto" }}>
            {loading ? [1,2,3,4].map(i => (
              <div key={i} style={{ border: `1px solid ${bdr}`, borderRadius: 11, padding: "11px 14px", background: surf2 }}>
                <Sk w="60%" h={12} /><div style={{ marginTop: 6 }}><Sk w="40%" h={10} /></div>
              </div>
            )) : recentOrders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🛒</div>
                <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>No orders yet</p>
              </div>
            ) : recentOrders.slice(0, 7).map((o, idx) => {
              const sc = STATUS_COLORS(o.status, T);
              return (
                <div key={o._id || idx} className="ordr" onClick={() => navigate("/Sales/Salesorders")}
                  style={{ border: `1px solid ${bdr}`, borderRadius: 11, padding: "10px 13px", background: surf2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <p className="sora" style={{ fontSize: 12, fontWeight: 700, color: T.textPri, margin: 0 }}>{o.salesOrderNumber ?? `#${idx+1}`}</p>
                      <p style={{ fontSize: 11, color: T.textSec, margin: "1px 0 0" }}>{o.customerName ?? "—"}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p className="sora" style={{ fontSize: 12, fontWeight: 700, color: T.textPri, margin: 0 }}>AED {Number(o.total ?? o.totalAmount ?? 0).toLocaleString("en-AE")}</p>
                      <p style={{ fontSize: 10, color: T.textSec, margin: "1px 0 0" }}>{fmtDate(o.createdAt)}</p>
                    </div>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: sc.bg, color: sc.c, border: `1px solid ${sc.dot}44` }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot }} />{o.status || "open"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Feed */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Activity Feed</p>
              <span className="live" style={{ width: 6, height: 6, borderRadius: "50%", background: loading ? T.amber : T.green, display: "inline-block" }} />
            </div>
            <span style={{ fontSize: 10, color: T.textSec }}>{activities.length} events</span>
          </div>
          <div style={{ padding: "6px 10px", maxHeight: 340, overflowY: "auto" }}>
            {loading ? [1,2,3,4,5].map(i => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: isDark ? "rgba(255,255,255,.06)" : "#e2e8f0", animation: "pulse 1.2s ease infinite", flexShrink: 0 }} />
                <div style={{ flex: 1 }}><Sk w={`${80 - i * 10}%`} h={11} /><div style={{ marginTop: 5 }}><Sk w="40%" h={9} /></div></div>
              </div>
            )) : activities.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0", color: T.textSec }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                <p style={{ fontSize: 13, margin: 0 }}>No recent activity</p>
              </div>
            ) : activities.map(a => {
              const m = actMeta[a.k] || actMeta.cart;
              return (
                <div key={a.id} className="act" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: m.dim, color: m.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{m.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: T.textPri, fontWeight: 500, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</p>
                    <p style={{ fontSize: 10, color: T.textSec, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                      <FaClock size={8} /> {a.ago}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ SECTION LABEL ═══════════════════════════════════════════ */}
      <p className="sec-label s7">Inventory, Trends &amp; Daily Summary</p>

      {/* ══ LOW STOCK + WEEKLY ORDERS + TODAY'S METRICS ═════════════ */}
      <div className="s7" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

        {/* Low Stock Alerts */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Low Stock</p>
              {!loading && lowStockCount > 0 && (
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
          <div style={{ padding: "6px 12px", maxHeight: 300, overflowY: "auto" }}>
            {loading ? [1,2,3].map(i => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 8px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: isDark ? "rgba(255,255,255,.06)" : "#e2e8f0", animation: "pulse 1.2s ease infinite", flexShrink: 0 }} />
                <div style={{ flex: 1 }}><Sk w="70%" h={11} /><div style={{ marginTop: 6 }}><Sk w="100%" h={4} /></div></div>
              </div>
            )) : lowStockItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>✅</div>
                <p style={{ fontSize: 13, color: T.textSec, margin: 0 }}>All stock levels OK</p>
              </div>
            ) : lowStockItems.slice(0, 6).map(item => {
              const crit = item.s === "critical";
              const pct  = Math.min(Math.round((item.cur / item.min) * 100), 100);
              const ic   = crit ? T.red : T.amber;
              return (
                <div key={item.id} className="stk" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: crit ? T.redDim : T.amberDim, color: ic, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}><FaBox /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: T.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>{item.name}</p>
                      <span className="sora" style={{ fontSize: 11, fontWeight: 700, color: ic }}>{item.cur}<span style={{ fontSize: 9, color: T.textSec, fontWeight: 400 }}>/{item.min}</span></span>
                    </div>
                    <div style={{ height: 4, background: track, borderRadius: 999, overflow: "hidden" }}>
                      <div className="prog" style={{ height: "100%", width: `${pct}%`, background: ic, borderRadius: 999 }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                      <span style={{ fontSize: 9, color: T.textSec, fontFamily: "'DM Mono', monospace" }}>{item.code}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: ic, textTransform: "uppercase" }}>{crit ? "Critical" : "Warning"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Orders Bar Chart */}
        <div style={card({ padding: "18px 20px" })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Weekly Orders</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: "3px 0 0" }}>Last 7 days</p>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: T.blueDim, color: T.blueLight ?? T.blue, fontSize: 11, fontWeight: 700, border: `1px solid ${isDark ? "rgba(59,130,246,.22)" : "#93c5fd"}` }}>
              {weeklyOrders.reduce((s, v) => s + v, 0)} total
            </span>
          </div>

          {/* Bar chart */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 72, marginBottom: 8 }}>
            {weeklyOrders.map((v, i) => {
              const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
              const maxV = Math.max(...weeklyOrders, 1);
              const last = i === weeklyOrders.length - 1;
              return (
                <div key={i} className="bar" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                    <div style={{ width: "100%", height: `${Math.max((v / maxV) * 100, 5)}%`, borderRadius: "4px 4px 0 0", background: last ? T.blue : isDark ? "rgba(59,130,246,.22)" : "#bfdbfe", position: "relative" }}>
                      {v > 0 && <div style={{ position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: last ? T.blue : T.textSec, whiteSpace: "nowrap" }}>{v}</div>}
                    </div>
                  </div>
                  <span style={{ fontSize: 8, color: last ? T.blue : T.textSec, fontWeight: last ? 700 : 400 }}>{days[i]}</span>
                </div>
              );
            })}
          </div>

          {/* Mini sparkline */}
          <Spark data={weeklyOrders.some(v => v > 0) ? weeklyOrders : [0,0,1,0,2,1,3]} color={T.blue} h={28} />

          <div style={{ height: 1, background: bdr, margin: "12px 0 10px" }} />

          {/* Inventory value callout */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: surf2, borderRadius: 10, border: `1px solid ${bdr}`, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: T.blueDim, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}><FaWarehouse /></div>
              <span style={{ fontSize: 11, color: T.textSec }}>Inventory Value</span>
            </div>
            {loading ? <Sk w={80} h={14} /> : <span className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.blue }}>{fmtAED(inventoryValue, true)}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
            {[
              { label: "Received In",   value: fmtAED(thisMonthRevenue, true), color: T.green },
              { label: "Paid Out",      value: fmtAED(thisMonthPaid, true),    color: T.red   },
            ].map(m => (
              <div key={m.label} style={{ background: surf2, borderRadius: 9, padding: "9px 11px", border: `1px solid ${bdr}` }}>
                <p style={{ fontSize: 9, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 4px" }}>{m.label}</p>
                {loading ? <Sk w="80%" h={12} /> : <p className="sora" style={{ fontSize: 12, fontWeight: 700, color: m.color, margin: 0 }}>{m.value}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Today's Summary */}
        <div style={card({ padding: "18px 20px" })}>
          <p className="sora" style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: "0 0 14px" }}>Today's Summary</p>

          {/* Today's key numbers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
            {[
              { label: "New Orders",    value: todayNewOrders,   color: T.blue,   icon: <FaShoppingCart size={10} /> },
              { label: "New Customers", value: todayNewCustomers, color: T.purple, icon: <FaUser size={10} />        },
              { label: "Revenue",       value: 0,                 color: T.green,  icon: <FaMoneyBillWave size={10}/>, special: fmtAED(todayRevenue, true) },
              { label: "Pending SO",    value: pendingOrders,    color: T.amber,  icon: <FaFileAlt size={10} />     },
            ].map(m => (
              <div key={m.label} style={{ background: surf2, borderRadius: 9, padding: "10px 11px", border: `1px solid ${bdr}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span style={{ fontSize: 9, color: T.textSec, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{m.label}</span>
                </div>
                {loading ? <Sk w="60%" h={18} r={5} /> : (
                  <p className="sora" style={{ fontSize: 18, fontWeight: 800, color: m.color, margin: 0, lineHeight: 1 }}>
                    {m.special ?? fmtNum(m.value)}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: bdr, margin: "0 0 12px" }} />

          {/* Purchase metrics */}
          {[
            { label: "Total PO Value",    value: fmtAED(totalPOValue, true),  color: T.blue   },
            { label: "Vendor Payments",   value: fmtNum(vendorPaymentsCount), color: T.cyan   },
            { label: "POs Received",      value: fmtNum(receivedPOs),         color: T.green  },
            { label: "Bills Outstanding", value: fmtNum(openBillsCount + partialBillsCount + overdueBillsCount), color: T.amber },
            { label: "Low Stock Items",   value: fmtNum(lowStockCount),       color: lowStockCount > 0 ? T.red : T.green },
            { label: "Total Vendors",     value: fmtNum(totalVendors),        color: T.cyan   },
          ].map(m => (
            <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${bdr}` }}>
              <span style={{ fontSize: 11, color: T.textSec }}>{m.label}</span>
              {loading ? <Sk w={60} h={11} /> : <span className="sora" style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.value}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
