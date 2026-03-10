import { useState, useEffect } from "react";
import {
  FaBox, FaShoppingCart, FaTruck, FaFileInvoice,
  FaUser, FaExclamationTriangle,
  FaArrowUp, FaArrowDown, FaPlus, FaCheckCircle,
  FaTimesCircle, FaLayerGroup, FaBell,
  FaArrowRight, FaClock,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";
import useThemeStore, { getTheme } from "../../store/useThemeStore";

/* ─── SVG Sparkline ─────────────────────────────────────────────── */
const Spark = ({ data, color, h = 38, filled = true }) => {
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
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
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

export default function Dashboard() {
  const navigate  = useNavigate();
  const user      = useAuthStore((s) => s.user);
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);
  const initials  = (user?.userId || "A").charAt(0).toUpperCase();

  const [time, setTime] = useState(new Date());
  const [pendingApprovals, setPendingApprovals] = useState([
    { id: 1, type: "outbound_cancel", item: "Office Chair",        by: "John Doe",     ago: "2h ago" },
    { id: 2, type: "outbound_cancel", item: "Storage Cabinet",     by: "Sarah Smith",  ago: "4h ago" },
    { id: 3, type: "new_item",        item: "New Product Request", by: "Mike Johnson", ago: "1d ago" },
  ]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── static data ── */
  const activities = [
    { id: 1, k: "cart",    text: "New sale order #SO-2023-156 created",  by: "John Doe",     ago: "10m" },
    { id: 2, k: "truck",   text: "Outbound #OB-2023-045 approved",       by: "Sarah Smith",  ago: "25m" },
    { id: 3, k: "box",     text: "Low stock alert: Storage Cabinet",     by: "System",       ago: "1h"  },
    { id: 4, k: "invoice", text: "Invoice #INV-2023-089 sent to client", by: "Mike Johnson", ago: "2h"  },
    { id: 5, k: "user",    text: "New customer: TechCorp UAE",           by: "System",       ago: "3h"  },
  ];

  /* Icon + colors per activity type — recalculated when T changes */
  const actMeta = {
    cart:    { icon: <FaShoppingCart />, c: T.blue,   dim: T.blueDim   },
    truck:   { icon: <FaTruck />,        c: T.green,  dim: T.greenDim  },
    box:     { icon: <FaBox />,          c: T.red,    dim: T.redDim    },
    invoice: { icon: <FaFileInvoice />,  c: T.amber,  dim: T.amberDim  },
    user:    { icon: <FaUser />,         c: T.purple, dim: T.purpleDim },
  };

  const lowStock = [
    { id: 1, name: "Storage Cabinet", code: "ITM001", cur: 5,  min: 10, s: "critical" },
    { id: 2, name: "Office Chair",    code: "ITM003", cur: 8,  min: 15, s: "warning"  },
    { id: 3, name: "LED Bulb 15W",    code: "ITM004", cur: 15, min: 20, s: "warning"  },
    { id: 4, name: "Area Rug",        code: "ITM002", cur: 3,  min: 10, s: "critical" },
  ];
  const orders = [
    { id: "SO-2023-156", cust: "ABC Corporation",   amt: "45,000", st: "open",      date: "Today"      },
    { id: "SO-2023-155", cust: "XYZ Ltd",           amt: "28,500", st: "completed", date: "Yesterday"  },
    { id: "SO-2023-154", cust: "Global Industries", amt: "62,000", st: "completed", date: "2 days ago" },
    { id: "SO-2023-153", cust: "Tech Solutions",    amt: "15,750", st: "open",      date: "3 days ago" },
  ];

  const spkRevenue   = [18, 26, 21, 34, 28, 40, 35, 48, 44, 55, 50, 62];
  const spkOrders    = [4, 7, 5, 9, 6, 11, 8, 12, 9, 10, 11, 12];
  const spkCustomers = [31, 35, 37, 40, 43, 46, 45, 47, 46, 47, 48, 48];
  const spkWeek      = [8, 14, 11, 17, 13, 19, 22];

  /* ── light/dark aware shortcuts ── */
  const surfaceBg   = T.surface;
  const surface2Bg  = T.surface2;
  const borderColor = T.border;
  const trackBg     = isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0";

  /* ── CSS injected on theme change ── */
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

    html,body,*{scrollbar-width:thin;scrollbar-color:${isDark ? "rgba(255,255,255,.09) transparent" : "rgba(0,0,0,.09) transparent"}}
    *::-webkit-scrollbar{width:4px}
    *::-webkit-scrollbar-track{background:transparent}
    *::-webkit-scrollbar-thumb{background:${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)"};border-radius:99px}

    .hd *{box-sizing:border-box}
    .hd{font-family:'DM Sans',sans-serif}
    .sora{font-family:'Sora',sans-serif}

    /* stagger entrance */
    @keyframes hdup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    .s0{animation:hdup .38s ease both}
    .s1{animation:hdup .38s .06s ease both}
    .s2{animation:hdup .38s .12s ease both}
    .s3{animation:hdup .38s .18s ease both}
    .s4{animation:hdup .38s .24s ease both}
    .s5{animation:hdup .38s .30s ease both}
    .s6{animation:hdup .38s .36s ease both}

    /* live dot */
    @keyframes hdpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.75)}}
    .live{animation:hdpulse 2.4s ease infinite}

    /* progress bars */
    @keyframes hdgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    .prog{transform-origin:left;animation:hdgrow .9s .5s cubic-bezier(.34,1,.64,1) both}

    /* kpi card */
    .kpi{transition:transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .22s;cursor:pointer}
    .kpi:hover{transform:translateY(-4px) scale(1.015);box-shadow:${isDark ? "0 18px 50px rgba(0,0,0,.55)" : "0 14px 40px rgba(0,0,0,.12)"} !important}

    /* quick action */
    .qa{transition:all .18s;cursor:pointer;position:relative;overflow:hidden}
    .qa:hover{transform:translateY(-2px);border-color:${isDark ? "rgba(255,255,255,.13)" : "rgba(37,99,235,.3)"} !important;box-shadow:${isDark ? "0 10px 36px rgba(0,0,0,.45)" : "0 6px 24px rgba(0,0,0,.1)"} !important}
    .qa:active{transform:scale(.98)}

    /* activity row */
    .act{transition:background .12s,padding-left .14s;border-radius:11px}
    .act:hover{background:${isDark ? "rgba(255,255,255,.04)" : "#f0f4f8"} !important;padding-left:14px !important}
    .act .arr{opacity:0;transform:translateX(-4px);transition:opacity .14s,transform .14s}
    .act:hover .arr{opacity:1;transform:translateX(0)}

    /* approval card */
    .appc{transition:border-color .15s}
    .appc:hover{border-color:${isDark ? "rgba(255,255,255,.12)" : "#94a3b8"} !important}

    /* order row */
    .ordr{transition:all .15s;cursor:pointer}
    .ordr:hover{border-color:${isDark ? "rgba(59,130,246,.35)" : "#93c5fd"} !important;background:${isDark ? "rgba(59,130,246,.04)" : "#eff6ff"} !important}

    /* stock row */
    .stk{transition:background .12s;border-radius:10px}
    .stk:hover{background:${isDark ? "rgba(255,255,255,.035)" : "#f0f4f8"} !important}

    /* btn micro */
    .gbtn{transition:all .13s}
    .gbtn:hover{filter:brightness(${isDark ? "1.14" : ".94"});transform:translateY(-1px)}
    .rbtn{transition:all .13s}
    .rbtn:hover{filter:brightness(${isDark ? "1.14" : ".94"});transform:translateY(-1px)}
    .lnk{transition:color .12s}
    .lnk:hover{color:${isDark ? "#93c5fd" : "#1d4ed8"} !important}

    /* bar chart */
    .bar{transition:opacity .12s}
    .bar:hover{opacity:.85 !important}
  `;

  const card = (ex = {}) => ({
    background: surfaceBg,
    border: `1px solid ${borderColor}`,
    borderRadius: "16px",
    transition: "background .25s,border-color .25s",
    ...ex,
  });

  const fmtClock = (d) =>
    d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  /* ────────────────────────────── RENDER ──────────────────────────── */
  return (
    <div className="hd" style={{ minHeight: "100vh", background: T.bg, padding: "24px 28px", color: T.textPri }}>
      <style>{css}</style>

      {/* ══ HEADER ══════════════════════════════════════════════════ */}
      <div className="s0" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "26px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" }}>
            <span className="live" style={{ width: "7px", height: "7px", borderRadius: "50%", background: T.green, display: "inline-block" }} />
            <span style={{ fontSize: "10px", color: T.green, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em" }}>Live</span>
          </div>
          <h1 className="sora" style={{ fontSize: "22px", fontWeight: "700", color: T.textPri, margin: 0, letterSpacing: "-0.03em" }}>
            {greeting()},{" "}
            {/* Safe on both modes: dark uses gradient clip, light uses solid color */}
            <span style={isDark
              ? { background: `linear-gradient(120deg,${T.blue},${T.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }
              : { color: T.blue }
            }>
              {user?.userId || "Admin"}
            </span>
          </h1>
          <p style={{ fontSize: "12px", color: T.textSec, margin: "4px 0 0" }}>
            {new Date().toLocaleDateString("en-AE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* live clock */}
          <div className="sora" style={{ padding: "7px 15px", background: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: "10px", fontSize: "13px", fontWeight: "600", color: T.textPri, letterSpacing: "0.06em", minWidth: "96px", textAlign: "center" }}>
            {fmtClock(time)}
          </div>
          {/* bell */}
          <button style={{ position: "relative", width: "38px", height: "38px", borderRadius: "10px", background: surfaceBg, border: `1px solid ${borderColor}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textSec }}>
            <FaBell size={13} />
            <span style={{ position: "absolute", top: "7px", right: "7px", width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", border: `2px solid ${surfaceBg}` }} />
          </button>
          {/* avatar — gradient always fine since it has white text */}
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `linear-gradient(135deg,${T.blue},${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px ${isDark ? "rgba(59,130,246,.35)" : "rgba(59,130,246,.28)"}` }}>
            <span className="sora" style={{ color: "#fff", fontSize: "14px", fontWeight: "700" }}>{initials}</span>
          </div>
        </div>
      </div>

      {/* ══ HERO BENTO ROW ══════════════════════════════════════════ */}
      <div className="s1" style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr", gap: "14px", marginBottom: "14px" }}>

        {/* Big revenue card */}
        <div style={{
          ...card({
            padding: "26px 28px", overflow: "hidden", position: "relative",
            background: isDark
              ? "linear-gradient(145deg,#0d1526 0%,#101e3a 55%,#0c1828 100%)"
              : "linear-gradient(145deg,#f0f6ff 0%,#e8f2ff 55%,#ddeeff 100%)",
            border: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "#b8d4f8"}`,
          })
        }}>
          {/* decorative orbs */}
          <div style={{ position: "absolute", top: "-60px", right: "-50px", width: "200px", height: "200px", borderRadius: "50%", background: isDark ? "rgba(59,130,246,.07)" : "rgba(59,130,246,.08)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-30px", left: "38%", width: "130px", height: "130px", borderRadius: "50%", background: isDark ? "rgba(139,92,246,.05)" : "rgba(139,92,246,.06)", pointerEvents: "none" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", position: "relative" }}>
            <div>
              <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>Total Revenue · 2024</p>
              <p className="sora" style={{ fontSize: "34px", fontWeight: "800", margin: 0, lineHeight: 1, letterSpacing: "-0.04em", color: T.textPri }}>
                AED{" "}
                {/* gradient text only on dark; solid blue on light */}
                <span style={isDark
                  ? { background: `linear-gradient(120deg,${T.blueLight},${T.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }
                  : { color: T.blue }
                }>245,600</span>
              </p>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 11px", borderRadius: "999px", background: isDark ? "rgba(16,185,129,.14)" : "#dcfce7", color: T.green, fontSize: "11px", fontWeight: "700", border: `1px solid ${isDark ? "rgba(16,185,129,.28)" : "#86efac"}`, flexShrink: 0 }}>
              <FaArrowUp size={8} /> +18% MoM
            </span>
          </div>

          {/* Sparkline */}
          <div style={{ height: "52px", marginBottom: "16px", position: "relative" }}>
            <Spark data={spkRevenue} color={T.blue} h={52} filled />
          </div>

          {/* Month bar strip */}
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
            {["J","F","M","A","M","J","J","A","S","O","N","D"].map((m, i) => {
              const vals = [18,22,16,29,24,31,27,35,32,40,38,45];
              const last = i === 11;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                  <div style={{ width: "100%", height: "18px", borderRadius: "3px 3px 0 0", background: last ? T.blue : (isDark ? "rgba(255,255,255,.09)" : "#c7ddf5"), position: "relative", overflow: "hidden" }}>
                    {!last && (
                      <div className="prog" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${(vals[i] / 45) * 100}%`, background: isDark ? "rgba(59,130,246,.5)" : "rgba(37,99,235,.55)", borderRadius: "3px 3px 0 0" }} />
                    )}
                  </div>
                  <span style={{ fontSize: "8px", color: last ? T.blue : T.textSec, fontWeight: last ? "700" : "400" }}>{m}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* This Month card */}
        <div style={{ ...card({ padding: "22px", position: "relative", overflow: "hidden" }), display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent,${T.green},transparent)`, opacity: isDark ? .45 : .65 }} />
          <div>
            <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>This Month</p>
            <p className="sora" style={{ fontSize: "24px", fontWeight: "700", color: T.textPri, margin: "0 0 6px", letterSpacing: "-0.03em", lineHeight: 1 }}>AED 45,200</p>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "600", color: T.green }}>
              <FaArrowUp size={8} /> +18% vs last month
            </span>
          </div>
          <div style={{ marginTop: "12px" }}>
            <Spark data={spkRevenue.slice(-7)} color={T.green} h={36} filled />
          </div>
        </div>

        {/* Active Customers card */}
        <div style={{ ...card({ padding: "22px", position: "relative", overflow: "hidden" }), display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent,${T.purple},transparent)`, opacity: isDark ? .45 : .65 }} />
          <div>
            <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>Active Customers</p>
            <p className="sora" style={{ fontSize: "24px", fontWeight: "700", color: T.textPri, margin: "0 0 6px", letterSpacing: "-0.03em", lineHeight: 1 }}>48</p>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "600", color: T.purple }}>
              <FaArrowUp size={8} /> +5 this month
            </span>
          </div>
          <div style={{ marginTop: "12px" }}>
            <Spark data={spkCustomers.slice(-7)} color={T.purple} h={36} filled />
          </div>
        </div>
      </div>

      {/* ══ KPI CARDS ═══════════════════════════════════════════════ */}
      <div className="s2" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "14px" }}>
        {[
          { label: "Total Items",      val: 156, icon: <FaLayerGroup />,         c: T.blue,  dim: T.blueDim,  up: true,  trend: "+4",  spk: [90,100,108,115,120,128,156],   action: () => navigate("/Items/Items") },
          { label: "Pending Orders",   val: 12,  icon: <FaShoppingCart />,       c: T.amber, dim: T.amberDim, up: true,  trend: "+3",  spk: spkOrders,                      action: () => navigate("/Sales/Salesorders") },
          { label: "Outbound Pending", val: 5,   icon: <FaTruck />,              c: T.green, dim: T.greenDim, up: false, trend: "−2",  spk: [9,7,8,6,7,5,6,7,6,5,6,5],    action: () => navigate("/Sales/Outbound") },
          { label: "Low Stock Alerts", val: 8,   icon: <FaExclamationTriangle />, c: T.red,  dim: T.redDim,   up: false, trend: "+2",  spk: [3,4,5,4,6,5,7,6,7,7,8,8],    action: () => navigate("/Items/Items") },
        ].map((k, i) => (
          <div key={i} className="kpi" onClick={k.action}
            style={{ ...card({ padding: "18px 20px", position: "relative", overflow: "hidden" }) }}>
            {/* top accent line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent 5%,${k.c},transparent 95%)`, opacity: isDark ? .38 : .6 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: k.dim, color: k.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>{k.icon}</div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px", background: k.up ? (isDark ? "rgba(16,185,129,.12)" : "#dcfce7") : (isDark ? "rgba(239,68,68,.12)" : "#fee2e2"), color: k.up ? T.green : T.red, border: `1px solid ${k.up ? (isDark ? "rgba(16,185,129,.22)" : "#86efac") : (isDark ? "rgba(239,68,68,.22)" : "#fca5a5")}` }}>
                {k.up ? <FaArrowUp size={7} /> : <FaArrowDown size={7} />} {k.trend}
              </span>
            </div>
            <p className="sora" style={{ fontSize: "28px", fontWeight: "800", color: T.textPri, margin: "0 0 3px", letterSpacing: "-0.03em", lineHeight: 1 }}>{k.val}</p>
            <p style={{ fontSize: "11px", color: T.textSec, margin: "0 0 12px", fontWeight: "500" }}>{k.label}</p>
            <Spark data={k.spk} color={k.c} h={28} filled={false} />
          </div>
        ))}
      </div>

      {/* ══ QUICK ACTIONS ═══════════════════════════════════════════ */}
      <div className="s3" style={{ marginBottom: "14px" }}>
        <p className="sora" style={{ fontSize: "10px", fontWeight: "700", color: T.textSec, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 11px" }}>Quick Actions</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" }}>
          {[
            { label: "New Sale Order",  sub: "Create a sales order",  icon: <FaShoppingCart />, c: T.blue,   dim: T.blueDim,   path: "/Sales/Salesorders" },
            { label: "Create Outbound", sub: "Dispatch inventory",    icon: <FaTruck />,        c: T.green,  dim: T.greenDim,  path: "/Sales/Outbound"    },
            { label: "Add New Item",    sub: "Add to catalog",        icon: <FaBox />,          c: T.purple, dim: T.purpleDim, path: "/Items/Items/New"   },
            { label: "Create Invoice",  sub: "Issue an invoice",      icon: <FaFileInvoice />,  c: T.amber,  dim: T.amberDim,  path: "/Sales/Invoices"    },
          ].map((a, i) => (
            <div key={i} className="qa" onClick={() => navigate(a.path)}
              style={{ ...card({ padding: "15px 17px" }), display: "flex", alignItems: "center", gap: "13px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "11px", background: a.dim, color: a.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0 }}>{a.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: "600", color: T.textPri, margin: 0 }}>{a.label}</p>
                <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0" }}>{a.sub}</p>
              </div>
              <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: isDark ? "rgba(255,255,255,.05)" : "#e8edf2", display: "flex", alignItems: "center", justifyContent: "center", color: T.textSec, flexShrink: 0 }}>
                <FaPlus size={9} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ ACTIVITY + APPROVALS ════════════════════════════════════ */}
      <div className="s4" style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: "14px", marginBottom: "14px" }}>

        {/* Activity feed */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "17px 20px 13px", borderBottom: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <p className="sora" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri, margin: 0 }}>Activity Feed</p>
              <span className="live" style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.green, display: "inline-block" }} />
            </div>
            <button className="lnk" style={{ fontSize: "11px", color: T.textSec, fontWeight: "600", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px" }}>
              View all <FaArrowRight size={8} />
            </button>
          </div>
          <div style={{ padding: "7px 12px" }}>
            {activities.map(a => {
              const m = actMeta[a.k];
              return (
                <div key={a.id} className="act" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 10px" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: m.dim, color: m.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", flexShrink: 0 }}>{m.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "12px", color: T.textPri, fontWeight: "500", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</p>
                    <p style={{ fontSize: "10px", color: T.textSec, margin: "2px 0 0", display: "flex", alignItems: "center", gap: "5px" }}>
                      {a.by}
                      <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: T.textSec, display: "inline-block" }} />
                      <FaClock size={8} /> {a.ago} ago
                    </p>
                  </div>
                  <FaArrowRight className="arr" size={9} style={{ color: T.textSec, flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Approvals */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "17px 20px 13px", borderBottom: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="sora" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri, margin: 0 }}>Pending Approvals</p>
            {pendingApprovals.length > 0 && (
              <span style={{ padding: "3px 9px", borderRadius: "999px", background: isDark ? "rgba(239,68,68,.12)" : "#fee2e2", color: T.red, fontSize: "10px", fontWeight: "700", border: `1px solid ${isDark ? "rgba(239,68,68,.22)" : "#fca5a5"}` }}>
                {pendingApprovals.length} pending
              </span>
            )}
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {pendingApprovals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <FaCheckCircle size={26} style={{ color: T.green, opacity: .6, marginBottom: "8px" }} />
                <p style={{ fontSize: "13px", margin: 0, fontWeight: "500", color: T.textPri }}>All caught up!</p>
                <p style={{ fontSize: "11px", color: T.textSec, margin: "4px 0 0" }}>No pending approvals</p>
              </div>
            ) : pendingApprovals.map(ap => (
              <div key={ap.id} className="appc"
                style={{ border: `1px solid ${borderColor}`, borderRadius: "12px", padding: "12px 13px", background: surface2Bg }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "9px" }}>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>{ap.item}</p>
                    <span style={{ display: "inline-block", marginTop: "4px", padding: "1px 7px", borderRadius: "4px", background: ap.type === "outbound_cancel" ? T.amberDim : T.purpleDim, color: ap.type === "outbound_cancel" ? T.amber : T.purple, fontSize: "9px", fontWeight: "700" }}>
                      {ap.type === "outbound_cancel" ? "Outbound Cancel" : "New Item"}
                    </span>
                  </div>
                  <span style={{ fontSize: "10px", color: T.textSec, display: "flex", alignItems: "center", gap: "3px" }}>
                    <FaClock size={8} /> {ap.ago}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: T.textSec }}>By <strong style={{ color: T.textPri, fontWeight: "600" }}>{ap.by}</strong></span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="gbtn" onClick={() => setPendingApprovals(p => p.filter(x => x.id !== ap.id))}
                      style={{ display: "flex", alignItems: "center", gap: "4px", background: isDark ? "rgba(16,185,129,.12)" : "#dcfce7", color: T.green, border: `1px solid ${isDark ? "rgba(16,185,129,.24)" : "#86efac"}`, borderRadius: "8px", padding: "5px 10px", fontSize: "11px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                      <FaCheckCircle size={9} /> Approve
                    </button>
                    <button className="rbtn" onClick={() => setPendingApprovals(p => p.filter(x => x.id !== ap.id))}
                      style={{ display: "flex", alignItems: "center", gap: "4px", background: isDark ? "rgba(239,68,68,.1)" : "#fee2e2", color: T.red, border: `1px solid ${isDark ? "rgba(239,68,68,.22)" : "#fca5a5"}`, borderRadius: "8px", padding: "5px 10px", fontSize: "11px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
                      <FaTimesCircle size={9} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ LOW STOCK + ORDERS ══════════════════════════════════════ */}
      <div className="s5" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: "14px", marginBottom: "14px" }}>

        {/* Low Stock */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "17px 20px 13px", borderBottom: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <p className="sora" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri, margin: 0 }}>Low Stock</p>
              <span style={{ padding: "2px 8px", borderRadius: "999px", background: isDark ? "rgba(239,68,68,.1)" : "#fee2e2", color: T.red, fontSize: "9px", fontWeight: "700", border: `1px solid ${isDark ? "rgba(239,68,68,.2)" : "#fca5a5"}` }}>
                {lowStock.filter(x => x.s === "critical").length} critical
              </span>
            </div>
            <button className="lnk" onClick={() => navigate("/Items/Items")}
              style={{ fontSize: "11px", color: T.textSec, fontWeight: "600", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px" }}>
              View all <FaArrowRight size={8} />
            </button>
          </div>
          <div style={{ padding: "6px 12px" }}>
            {lowStock.map(item => {
              const crit = item.s === "critical";
              const pct  = Math.round((item.cur / item.min) * 100);
              const ic   = crit ? T.red : T.amber;
              const idim = crit ? T.redDim : T.amberDim;
              return (
                <div key={item.id} className="stk" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 10px" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: idim, color: ic, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", flexShrink: 0 }}>
                    <FaBox />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <p style={{ fontSize: "12px", fontWeight: "600", color: T.textPri, margin: 0 }}>{item.name}</p>
                      <span className="sora" style={{ fontSize: "12px", fontWeight: "700", color: ic }}>
                        {item.cur}<span style={{ fontSize: "10px", color: T.textSec, fontWeight: "400" }}> / {item.min}</span>
                      </span>
                    </div>
                    <div style={{ height: "4px", background: trackBg, borderRadius: "999px", overflow: "hidden" }}>
                      <div className="prog" style={{ height: "100%", width: `${pct}%`, background: ic, borderRadius: "999px" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                      <span style={{ fontSize: "10px", color: T.textSec, fontFamily: "monospace" }}>{item.code}</span>
                      <span style={{ fontSize: "9px", fontWeight: "700", color: ic, textTransform: "uppercase", letterSpacing: "0.05em" }}>{crit ? "Critical" : "Warning"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Orders */}
        <div style={card({ padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "17px 20px 13px", borderBottom: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p className="sora" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri, margin: 0 }}>Recent Orders</p>
            <button className="lnk" onClick={() => navigate("/Sales/Salesorders")}
              style={{ fontSize: "11px", color: T.textSec, fontWeight: "600", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px" }}>
              View all <FaArrowRight size={8} />
            </button>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {orders.map(o => {
              const open = o.st === "open";
              return (
                <div key={o.id} className="ordr" onClick={() => navigate("/Sales/Salesorders")}
                  style={{ border: `1px solid ${borderColor}`, borderRadius: "12px", padding: "12px 14px", background: surface2Bg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "9px" }}>
                    <div>
                      <p className="sora" style={{ fontSize: "12px", fontWeight: "700", color: T.textPri, margin: 0 }}>{o.id}</p>
                      <p style={{ fontSize: "11px", color: T.textSec, margin: "2px 0 0" }}>{o.cust}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p className="sora" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri, margin: 0 }}>AED {o.amt}</p>
                      <p style={{ fontSize: "10px", color: T.textSec, margin: "2px 0 0" }}>{o.date}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "10px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: open ? T.blueDim : T.greenDim, color: open ? T.blueLight : T.green, border: `1px solid ${open ? (isDark ? "rgba(59,130,246,.22)" : "#93c5fd") : (isDark ? "rgba(16,185,129,.22)" : "#86efac")}` }}>
                      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: open ? T.blue : T.green }} />
                      {open ? "Open" : "Completed"}
                    </span>
                    {open && (
                      <button onClick={e => { e.stopPropagation(); navigate("/Sales/Outbound"); }}
                        style={{ fontSize: "11px", fontWeight: "600", color: T.green, background: isDark ? "rgba(16,185,129,.08)" : "#f0fdf4", border: `1px solid ${isDark ? "rgba(16,185,129,.2)" : "#86efac"}`, borderRadius: "7px", padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                        → Outbound
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ BOTTOM ROW: bar chart + invoices + metrics ══════════════ */}
      <div className="s6" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "14px" }}>

        {/* Weekly orders bar chart */}
        <div style={card({ padding: "20px 22px" })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
            <div>
              <p className="sora" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri, margin: 0 }}>Weekly Orders</p>
              <p style={{ fontSize: "11px", color: T.textSec, margin: "3px 0 0" }}>Last 7 days</p>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", borderRadius: "999px", background: T.blueDim, color: T.blueLight, fontSize: "11px", fontWeight: "700", border: `1px solid ${isDark ? "rgba(59,130,246,.22)" : "#93c5fd"}` }}>
              <FaArrowUp size={8} /> 22 today
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "7px", height: "64px", marginBottom: "10px" }}>
            {spkWeek.map((v, i) => {
              const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
              const maxV = Math.max(...spkWeek);
              const last = i === spkWeek.length - 1;
              return (
                <div key={i} className="bar" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", height: "100%" }}>
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                    <div style={{ width: "100%", height: `${(v / maxV) * 100}%`, minHeight: "5px", borderRadius: "4px 4px 0 0", background: last ? T.blue : (isDark ? "rgba(59,130,246,.22)" : "#bfdbfe"), position: "relative" }}>
                      {last && (
                        <div style={{ position: "absolute", top: "-18px", left: "50%", transform: "translateX(-50%)", fontSize: "9px", fontWeight: "700", color: T.blue, whiteSpace: "nowrap" }}>{v}</div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: "8px", color: last ? T.blue : T.textSec, fontWeight: last ? "700" : "400" }}>{days[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Invoices */}
        <div style={{ ...card({ padding: "20px 22px", position: "relative", overflow: "hidden" }), display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,transparent,${T.amber},transparent)`, opacity: isDark ? .45 : .65 }} />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <p style={{ fontSize: "10px", color: T.textSec, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>Pending Invoices</p>
              <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: T.amberDim, color: T.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>
                <FaFileInvoice />
              </div>
            </div>
            <p className="sora" style={{ fontSize: "34px", fontWeight: "800", color: T.textPri, margin: "0 0 4px", letterSpacing: "-0.04em", lineHeight: 1 }}>7</p>
            <p style={{ fontSize: "11px", color: T.textSec, margin: 0 }}>Awaiting payment · AED 128,400</p>
          </div>
          <button className="qa" onClick={() => navigate("/Sales/Invoices")}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "9px", marginTop: "18px", background: T.amberDim, color: T.amber, border: `1px solid ${isDark ? "rgba(245,158,11,.22)" : "#fcd34d"}`, borderRadius: "9px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
            View Invoices <FaArrowRight size={9} />
          </button>
        </div>

        {/* Today's Metrics */}
        <div style={card({ padding: "20px 22px" })}>
          <p className="sora" style={{ fontSize: "13px", fontWeight: "700", color: T.textPri, margin: "0 0 18px" }}>Today's Metrics</p>
          {[
            { label: "New Orders",      value: "4",     color: T.blue,   pct: 72 },
            { label: "Dispatched",      value: "2",     color: T.green,  pct: 40 },
            { label: "Revenue Today",   value: "AED 6,200", color: T.purple, pct: 60 },
            { label: "Pending Actions", value: "11",    color: T.amber,  pct: 86 },
          ].map(m => (
            <div key={m.label} style={{ marginBottom: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontSize: "11px", color: T.textSec }}>{m.label}</span>
                <span className="sora" style={{ fontSize: "12px", fontWeight: "700", color: T.textPri }}>{m.value}</span>
              </div>
              <div style={{ height: "4px", background: trackBg, borderRadius: "999px", overflow: "hidden" }}>
                <div className="prog" style={{ height: "100%", width: `${m.pct}%`, background: m.color, borderRadius: "999px" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}