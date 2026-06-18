import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { FaDownload, FaSync, FaChevronDown, FaCheck, FaTrophy, FaCoins, FaReceipt, FaHashtag, FaUsers, FaBoxOpen, FaChartLine } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import { useBaseCurrency, baseCurrency } from "../../helper/currency";

const fmtMoney = (n) =>
  `${baseCurrency()} ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 1000000) return `${baseCurrency()} ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000)    return `${baseCurrency()} ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `${baseCurrency()} ${v.toFixed(0)}`;
};
const fmtKbare = (n) => {
  const v = parseFloat(n || 0);
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000)    return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `${v.toFixed(0)}`;
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const PERIOD_LABELS = {
  day: "Today", week: "This week", month: "This month",
  quarter: "This quarter", ytd: "Year to date",
};

const STATUS_COLOR = {
  open: "#3b82f6", confirmed: "#10b981", "in progress": "#8b5cf6",
  completed: "#10b981", draft: "#f59e0b", cancelled: "#ef4444", closed: "#64748b",
};

// ── Ring SVG ──────────────────────────────────────────────────────────
function Ring({ pct, size = 108, stroke = 9, accent = "#6366f1", trackColor }) {
  const r = (size / 2) - stroke / 2 - 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * c;
  const cx = size / 2, cy = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} stroke={trackColor || "rgba(255,255,255,0.08)"} strokeWidth={stroke} fill="none" />
      <circle cx={cx} cy={cy} r={r} stroke={accent} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
    </svg>
  );
}

// ── Sales chart (SVG bars / area) ─────────────────────────────────────
function SalesChart({ data, type, isDark, accent }) {
  const W = 900, H = 200, PL = 44, PR = 16, PT = 8, PB = 28;
  const iW = W - PL - PR, iH = H - PT - PB;
  const max = Math.max(...data.map(d => d.v), 1) * 1.18;
  const bW  = iW / data.length;
  const yTicks = [0, Math.round(max * 0.33), Math.round(max * 0.67), Math.round(max)];
  const pts = data.map((d, i) => [PL + i * bW + bW / 2, PT + iH - (d.v / max) * iH]);
  const linePts = pts.map(p => p.join(",")).join(" ");
  const areaPts = `${PL + bW / 2},${PT + iH} ${linePts} ${PL + (data.length - 1) * bW + bW / 2},${PT + iH}`;
  const trackClr = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const mutedClr = isDark ? "#64748b" : "#94a3b8";
  const today = new Date().getDate() - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }} preserveAspectRatio="none">
      {yTicks.map((tv, i) => {
        const y = PT + iH - (tv / max) * iH;
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={trackClr} strokeDasharray="3 5" />
            <text x={PL - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill={mutedClr} fontFamily="DM Mono, monospace">{fmtKbare(tv)}</text>
          </g>
        );
      })}
      {type === "bars" && data.map((d, i) => {
        const x = PL + i * bW + 3;
        const h = (d.v / max) * iH;
        const y = PT + iH - h;
        const isToday = i === today;
        const isFut   = i > today;
        const fill = isFut ? trackClr : accent;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bW - 6} height={h} rx={3}
              fill={fill} opacity={isFut ? 0.5 : isToday ? 1 : 0.82} />
            {isToday && (
              <text x={x + (bW - 6) / 2} y={y - 5} textAnchor="middle"
                fontSize={8} fill={accent} fontWeight={700} fontFamily="DM Mono, monospace">TODAY</text>
            )}
          </g>
        );
      })}
      {type === "area" && (
        <>
          <polygon points={areaPts} fill={accent} opacity={0.15} />
          <polyline points={linePts} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => i === today && (
            <circle key={i} cx={p[0]} cy={p[1]} r={4} fill={accent} stroke={isDark ? "#14161b" : "#fff"} strokeWidth={2} />
          ))}
        </>
      )}
      {data.map((d, i) => i % 3 === 2 && (
        <text key={i} x={PL + i * bW + bW / 2} y={H - 8} textAnchor="middle"
          fontSize={9} fill={mutedClr} fontFamily="DM Mono, monospace">{d.label}</text>
      ))}
    </svg>
  );
}

// ── Channel donut (SVG) ───────────────────────────────────────────────
function ChannelDonut({ channels, isDark }) {
  const total = channels.reduce((s, c) => s + c.v, 0) || 1;
  const r = 38, circ = 2 * Math.PI * r;
  let acc = 0;
  const colors = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b"];
  const muted   = isDark ? "#64748b" : "#94a3b8";
  const surface = isDark ? "#14161b" : "#fff";
  const text    = isDark ? "#ecebe6" : "#16181c";
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
        <svg viewBox="0 0 100 100" style={{ width: 110, height: 110, transform: "rotate(-90deg)" }}>
          <circle cx={50} cy={50} r={r} stroke={isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0"} strokeWidth={10} fill="none" />
          {channels.map((ch, i) => {
            const len = (ch.v / total) * circ;
            const off = circ - acc;
            acc += len;
            return (
              <circle key={i} cx={50} cy={50} r={r} stroke={colors[i] || "#64748b"} strokeWidth={10} fill="none"
                strokeDasharray={`${len} ${circ}`} strokeDashoffset={off} strokeLinecap="butt" />
            );
          })}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: text, fontFamily: "DM Mono, monospace", lineHeight: 1 }}>{fmtKbare(total)}</span>
          <span style={{ fontSize: 9, color: muted, marginTop: 2 }}>total</span>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {channels.map((ch, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i > 0 ? `1px dashed ${isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0"}` : "none" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: text }}>{ch.l}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: text, fontFamily: "DM Mono, monospace" }}>{fmtKbare(ch.v)}</span>
            <span style={{ fontSize: 10, color: muted, width: 30, textAlign: "right" }}>{Math.round((ch.v / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Lb row (customers / products) ────────────────────────────────────
function LbRow({ pos, name, sub, amt, delta, down, pct, hue, isDark }) {
  const bg   = `linear-gradient(135deg, oklch(0.62 0.13 ${hue}), oklch(0.40 0.10 ${hue}))`;
  const init = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const text = isDark ? "#ecebe6" : "#16181c";
  const muted = isDark ? "#64748b" : "#94a3b8";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "28px 30px 1fr auto", gap: 10, alignItems: "center",
      padding: "9px 4px", borderTop: pos > 1 ? `1px dashed ${border}` : "none" }}>
      <div style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: muted, textAlign: "center" }}>
        {String(pos).padStart(2, "0")}
      </div>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: "flex", alignItems: "center",
        justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11 }}>{init}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 10.5, color: muted }}>{sub}</div>
        <div style={{ height: 3, background: isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0",
          borderRadius: 99, overflow: "hidden", marginTop: 4, maxWidth: 160 }}>
          <div style={{ height: "100%", width: `${Math.max(6, pct)}%`, background: "#6366f1", borderRadius: 99 }} />
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: text, fontFamily: "DM Mono, monospace" }}>{fmtKbare(amt)}</div>
        <div style={{ fontSize: 10.5, color: down ? "#ef4444" : "#10b981" }}>{delta}</div>
      </div>
    </div>
  );
}

// ── Feed row ──────────────────────────────────────────────────────────
function FeedRow({ type, who, what, amt, dir, time, isDark }) {
  const iconBg = { invoice: "rgba(99,102,241,0.12)", payment: "rgba(16,185,129,0.12)", refund: "rgba(239,68,68,0.12)", lead: "rgba(245,158,11,0.12)" };
  const iconClr= { invoice: "#6366f1", payment: "#10b981", refund: "#ef4444", lead: "#f59e0b" };
  const text   = isDark ? "#ecebe6" : "#16181c";
  const muted  = isDark ? "#64748b" : "#94a3b8";
  const border = isDark ? "rgba(255,255,255,0.07)" : "#e2e8f0";
  const iconMap = { invoice: "📄", payment: "💰", refund: "↩", lead: "✨" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "30px 1fr auto", gap: 10, alignItems: "center",
      padding: "9px 4px", borderTop: `1px dashed ${border}` }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg[type] || iconBg.invoice,
        color: iconClr[type] || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
        {iconMap[type] || "📄"}
      </div>
      <div>
        <div style={{ fontSize: 12.5, color: text, lineHeight: 1.4 }}>
          <b style={{ fontWeight: 600 }}>{who}</b>{" "}
          <span style={{ color: muted }}>{what}</span>
        </div>
        <div style={{ fontSize: 11, color: muted }}>{time}</div>
      </div>
      <div style={{ textAlign: "right", fontFamily: "DM Mono, monospace" }}>
        {amt != null ? (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: dir === "in" ? "#10b981" : dir === "out" ? "#ef4444" : text }}>
              {dir === "in" ? "+" : dir === "out" ? "−" : ""}{fmtKbare(amt)}
            </div>
            <div style={{ fontSize: 10, color: muted }}>{dir === "in" ? "received" : dir === "out" ? "returned" : ""}</div>
          </>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
            background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>Lead</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function SalesReport() {
  useBaseCurrency();
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);
  const accent = "#6366f1";

  const [period,      setPeriod]      = useState("month");
  const [periodOpen,  setPeriodOpen]  = useState(false);
  const [exportOpen,  setExportOpen]  = useState(false);
  const [chartType,   setChartType]   = useState("bars");
  const [loading,     setLoading]     = useState(true);
  const [orders,      setOrders]      = useState([]);
  const [invoices,    setInvoices]    = useState([]);
  const [invStats,    setInvStats]    = useState({});
  const [cnStats,     setCnStats]     = useState({});
  const periodRef = useRef(null);
  const exportRef = useRef(null);

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
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!periodOpen && !exportOpen) return;
    const close = (e) => {
      if (periodRef.current && !periodRef.current.contains(e.target)) setPeriodOpen(false);
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [periodOpen, exportOpen]);

  const now = new Date();
  const filtered = useMemo(() => orders.filter(o => {
    const d = new Date(o.orderDate || o.createdAt || 0);
    if (period === "day")     return d.toDateString() === now.toDateString();
    if (period === "week")    return d >= new Date(now - 7 * 86400000);
    if (period === "month")   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "quarter") { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear(); }
    if (period === "ytd")     return d.getFullYear() === now.getFullYear();
    return true;
  }), [orders, period, now]);

  const totalRevenue  = filtered.reduce((s, o) => s + (o.total || 0), 0);
  const totalOrders   = filtered.length;
  const avgOrderVal   = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const completedOrds = filtered.filter(o => ["completed","confirmed","closed"].includes((o.status||"").toLowerCase())).length;
  const invoicedTotal = invStats.totalAmount || invStats.total || 0;
  const creditsApplied= cnStats.totalApplied || 0;
  const creditsPending= cnStats.totalPending || 0;
  const netRevenue    = Math.max(0, invoicedTotal - creditsApplied);

  // QUOTA
  const TARGET     = Math.max(totalRevenue * 1.25, 1000);
  const QUOTA_PCT  = Math.min(100, Math.round((totalRevenue / TARGET) * 100));
  const daysInPeriod = period === "month" ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : 30;
  const dayIdx       = now.getDate() - 1;
  const onPace       = QUOTA_PCT >= Math.round((dayIdx + 1) / daysInPeriod * 100);

  // Daily chart data (current month)
  const dailyData = useMemo(() => {
    const daysInMon = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const buckets = Array.from({ length: daysInMon }, (_, i) => ({ v: 0, label: String(i + 1) }));
    orders.forEach(o => {
      const d = new Date(o.orderDate || o.createdAt || 0);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        buckets[d.getDate() - 1].v += o.total || 0;
      }
    });
    return buckets;
  }, [orders, now]);

  // 6-month trend
  const trendData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const mon = d.toLocaleString("en-AE", { month: "short" });
    const val = orders.filter(o => {
      const od = new Date(o.orderDate || o.createdAt || 0);
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    }).reduce((s, o) => s + (o.total || 0), 0);
    const cnt = orders.filter(o => {
      const od = new Date(o.orderDate || o.createdAt || 0);
      return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    }).length;
    return { month: mon, revenue: Math.round(val), orders: cnt, label: mon };
  }), [orders, now]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const c = o.customerName || "Unknown";
      if (!map[c]) map[c] = { name: c, orders: 0, revenue: 0 };
      map[c].orders++;
      map[c].revenue += o.total || 0;
    });
    const list = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    const maxR = list[0]?.revenue || 1;
    return list.map((c, i) => ({ ...c, pct: (c.revenue / maxR) * 100, hue: [200, 260, 158, 30, 320, 50][i] || 200 }));
  }, [filtered]);

  // Top products
  const topProducts = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      (o.items || []).forEach(item => {
        const name = item.itemName || item.name || item.description || "Unknown";
        if (!map[name]) map[name] = { name, units: 0, revenue: 0, code: item.itemCode || item.sku || "" };
        map[name].units += item.quantity || 0;
        map[name].revenue += (item.quantity || 0) * (item.rate || item.price || 0);
      });
    });
    const list = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    const maxR = list[0]?.revenue || 1;
    return list.map((p, i) => ({ ...p, pct: (p.revenue / maxR) * 100, hue: [200, 30, 158, 260, 50, 300][i] || 200 }));
  }, [filtered]);

  // Channels (order status groups)
  const channels = useMemo(() => {
    const statusMap = {};
    filtered.forEach(o => {
      const s = (o.status || "draft").toLowerCase();
      statusMap[s] = (statusMap[s] || 0) + (o.total || 0);
    });
    const entries = Object.entries(statusMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (!entries.length) return [{ l: "No data", v: 0 }];
    const labels = { confirmed: "Confirmed", completed: "Completed", open: "Open", draft: "Draft", cancelled: "Cancelled", closed: "Closed" };
    return entries.map(([k, v]) => ({ l: labels[k] || k, v }));
  }, [filtered]);

  // Activity feed
  const feed = useMemo(() =>
    [...invoices]
      .sort((a, b) => new Date(b.invoiceDate || b.createdAt || 0) - new Date(a.invoiceDate || a.createdAt || 0))
      .slice(0, 7)
      .map(inv => {
        const isPaid = ["paid", "closed"].includes((inv.status || "").toLowerCase());
        const d = inv.invoiceDate || inv.createdAt;
        const ago = d ? (() => {
          const diff = Date.now() - new Date(d).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 60) return `${mins} min ago`;
          if (mins < 1440) return `${Math.floor(mins / 60)} hr ago`;
          return new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short" });
        })() : "";
        return {
          type: isPaid ? "payment" : "invoice",
          who: inv.customer || inv.customerName || "Customer",
          what: isPaid ? `paid ${inv.invoiceNumber || "invoice"}` : `issued ${inv.invoiceNumber || "invoice"}`,
          amt: inv.total || 0,
          dir: "in",
          time: ago,
        };
      })
  , [invoices]);

  // AR Aging
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const agingBuckets = { current: [], d30: [], d60: [], d90: [], d90p: [] };
  invoices.filter(inv => !["paid", "void", "draft"].includes((inv.status || "").toLowerCase())).forEach(inv => {
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    if (!due) { agingBuckets.current.push(inv); return; }
    due.setHours(0, 0, 0, 0);
    const days = Math.floor((today - due) / 86400000);
    if (days <= 0) agingBuckets.current.push(inv);
    else if (days <= 30) agingBuckets.d30.push(inv);
    else if (days <= 60) agingBuckets.d60.push(inv);
    else if (days <= 90) agingBuckets.d90.push(inv);
    else agingBuckets.d90p.push(inv);
  });
  const agingSum = (arr) => arr.reduce((s, i) => s + (i.balanceDue || i.total || 0), 0);
  const agingRows = [
    { label: "Current",    items: agingBuckets.current, color: "#10b981" },
    { label: "1–30 days",  items: agingBuckets.d30,     color: "#3b82f6" },
    { label: "31–60 days", items: agingBuckets.d60,     color: "#f59e0b" },
    { label: "61–90 days", items: agingBuckets.d90,     color: "#f97316" },
    { label: "90+ days",   items: agingBuckets.d90p,    color: "#ef4444" },
  ];
  const totalAging = agingRows.reduce((s, r) => s + agingSum(r.items), 0);

  // CSS
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500;600&display=swap');
    .sr-root{font-family:'DM Sans',sans-serif}
    .sr-root *{box-sizing:border-box}
    html,body,*{scrollbar-width:thin;scrollbar-color:${isDark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)"} transparent}
    *::-webkit-scrollbar{width:5px}*::-webkit-scrollbar-thumb{background:${isDark?"rgba(255,255,255,.09)":"rgba(0,0,0,.09)"};border-radius:99px}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .sr-spin{animation:spin .8s linear infinite}
    .sr-card{background:${T.surface};border:1px solid ${T.border};border-radius:13px;overflow:hidden}
    .sr-card-h{display:flex;align-items:center;justify-content:space-between;padding:11px 15px;border-bottom:1px solid ${T.border};font-size:12px;font-weight:600;color:${T.textPri};gap:8px}
    .sr-card-b{padding:12px 15px 15px}
    .sr-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;font:inherit;font-size:12.5px;font-weight:500;background:${T.surface};color:${T.textSec};border:1px solid ${T.border};cursor:pointer;transition:all .15s}
    .sr-btn:hover{background:${T.surface2};color:${T.textPri}}
    .sr-btn.primary{background:#6366f1;color:#fff;border-color:transparent}
    .sr-btn.primary:hover{filter:brightness(1.1)}
    .sr-seg{display:flex;padding:3px;background:${T.surface2};border:1px solid ${T.border};border-radius:8px;gap:2px}
    .sr-seg button{padding:4px 10px;border:0;background:transparent;border-radius:6px;color:${T.textSec};cursor:pointer;font:inherit;font-size:12px;font-weight:500}
    .sr-seg button.on{background:${T.surface};color:${T.textPri};box-shadow:0 1px 0 rgba(20,22,28,.04),0 1px 2px rgba(20,22,28,.04)}
    .sr-pill{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:8px;background:${T.surface2};border:1px solid ${T.border};color:${T.textSec};font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
    .sr-pill:hover{background:${T.surface3||T.surface2}}
    .sr-pill.on{background:rgba(99,102,241,.12);color:#818cf8;border-color:rgba(99,102,241,.25)}
    .sr-menu{position:absolute;top:calc(100% + 6px);right:0;background:${T.surface};border:1px solid ${T.border};border-radius:11px;box-shadow:0 8px 32px rgba(0,0,0,${isDark?.45:.12});padding:6px;min-width:190px;z-index:200}
    .sr-menu button{width:100%;text-align:left;display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:7px;background:transparent;border:0;color:${T.textSec};font:inherit;font-size:12.5px;cursor:pointer}
    .sr-menu button:hover{background:${T.surface2};color:${T.textPri}}
    .sr-menu .sep{height:1px;background:${T.border};margin:5px 2px}
    .sr-menu .head{font-size:10px;color:${isDark?"#475569":"#94a3b8"};padding:6px 9px 2px;letter-spacing:.05em;text-transform:uppercase}
    .sr-kpi-card{background:${T.surface};border:1px solid ${T.border};border-radius:13px;padding:16px;position:relative;overflow:hidden;transition:transform .2s}
    .sr-kpi-card:hover{transform:translateY(-2px)}
    .sr-row-hover:hover td{background:${isDark?"rgba(255,255,255,.025)":"rgba(99,102,241,.025)"} !important}
    .sr-s0{animation:fadeUp .3s .00s ease both}
    .sr-s1{animation:fadeUp .3s .05s ease both}
    .sr-s2{animation:fadeUp .3s .10s ease both}
    .sr-s3{animation:fadeUp .3s .15s ease both}
    .sr-s4{animation:fadeUp .3s .20s ease both}
    .sr-s5{animation:fadeUp .3s .25s ease both}
    .sora{font-family:'Sora',sans-serif}
    .mono{font-family:'DM Mono',monospace}
  `;

  const surface = T.surface, border = T.border, text = T.textPri, muted = T.textSec;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 56px)", background: T.bg }}>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="sr-spin" style={{ width: 32, height: 32, border: `3px solid ${T.border}`, borderTopColor: accent, borderRadius: "50%" }} />
        <span style={{ color: muted, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>Loading sales data…</span>
      </div>
    </div>
  );

  return (
    <div className="sr-root" style={{ background: T.bg, minHeight: "calc(100vh - 56px)", color: text, padding: "20px 24px 48px" }}>
      <style>{css}</style>

      {/* ── Page header ── */}
      <div className="sr-s0" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10, position: "relative", zIndex: 1000 }}>
        <div>
          <h1 className="sora" style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.03em" }}>Sales Performance</h1>
          <p style={{ fontSize: 12.5, color: muted, margin: "3px 0 0" }}>
            {now.toLocaleString("en-AE", { month: "long", year: "numeric" })} · updated just now
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Period picker */}
          <div style={{ position: "relative", zIndex: 100 }} ref={periodRef}>
            <button className="sr-btn" onClick={() => { setPeriodOpen(v => !v); setExportOpen(false); }}>
              📅 {PERIOD_LABELS[period]} <FaChevronDown size={10} style={{ opacity: .6 }} />
            </button>
            {periodOpen && (
              <div className="sr-menu">
                <div className="head">Period</div>
                {Object.entries(PERIOD_LABELS).map(([k, l]) => (
                  <button key={k} onClick={() => { setPeriod(k); setPeriodOpen(false); }}>
                    {k === period ? <FaCheck size={10} /> : <span style={{ width: 10 }} />} {l}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="sr-btn" onClick={load}><FaSync size={11} /> Refresh</button>
          {/* Export */}
          <div style={{ position: "relative", zIndex: 100 }} ref={exportRef}>
            <button className="sr-btn primary" onClick={() => { setExportOpen(v => !v); setPeriodOpen(false); }}>
              <FaDownload size={11} /> Export <FaChevronDown size={10} style={{ opacity: .8 }} />
            </button>
            {exportOpen && (
              <div className="sr-menu">
                <div className="head">Download</div>
                <button>🖨 PDF report</button>
                <button>📊 Excel / CSV</button>
                <div className="sep" />
                <div className="head">Send</div>
                <button>✉️ Email this report</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Hero + leaderboard ── */}
      <div className="sr-s1" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Hero card */}
        <div className="sr-card" style={{
          padding: "20px 22px",
          background: isDark
            ? `radial-gradient(800px 180px at 80% 0%, rgba(99,102,241,0.12), transparent 70%), ${T.surface}`
            : `radial-gradient(800px 180px at 80% 0%, rgba(99,102,241,0.07), transparent 70%), ${T.surface}`,
        }}>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700 }}>J</span>
                Sales · {now.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="sora" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em", marginBottom: 8 }}>
                Closed <span style={{ color: accent }}>{fmtK(totalRevenue)}</span> this period
                <br />
                <span style={{ color: muted, fontSize: 16, fontWeight: 600 }}>
                  {onPace ? "on pace ✓" : "a touch behind pace"} for {fmtK(TARGET)} target
                </span>
              </div>
              <div style={{ fontSize: 13, color: muted, lineHeight: 1.6 }}>
                <b style={{ color: text }}>{totalOrders} orders</b> · avg{" "}
                <b style={{ color: text }}>{fmtK(avgOrderVal)}</b> each ·{" "}
                {completedOrds > 0 && <><b style={{ color: text }}>{completedOrds}</b> completed</>}
              </div>
            </div>
            {/* Ring */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
              <div style={{ position: "relative", width: 100, height: 100 }}>
                <Ring pct={QUOTA_PCT} size={100} stroke={9} accent={accent}
                  trackColor={isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span className="sora" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{QUOTA_PCT}%</span>
                  <span style={{ fontSize: 9, color: muted, marginTop: 2, textTransform: "uppercase", letterSpacing: ".04em" }}>of target</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { k: "Closed",   v: fmtK(totalRevenue), col: text },
                  { k: "Target",   v: fmtK(TARGET),        col: muted },
                  { k: "Invoiced", v: fmtK(invoicedTotal), col: text },
                ].map(m => (
                  <div key={m.k}>
                    <div style={{ fontSize: 9.5, color: muted, textTransform: "uppercase", letterSpacing: ".04em" }}>{m.k}</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: m.col }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top customers mini leaderboard */}
        <div className="sr-card">
          <div className="sr-card-h">
            Top customers <span style={{ color: muted, fontWeight: 400 }}>· {PERIOD_LABELS[period].toLowerCase()}</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "rgba(245,158,11,.12)", color: "#f59e0b", fontWeight: 600 }}>
              <FaTrophy size={9} style={{ marginRight: 4 }} />{topCustomers.length} accounts
            </span>
          </div>
          <div className="sr-card-b" style={{ paddingTop: 6 }}>
            {topCustomers.slice(0, 4).length === 0 ? (
              <div style={{ textAlign: "center", color: muted, fontSize: 12, padding: "24px 0" }}>No orders this period</div>
            ) : (
              topCustomers.slice(0, 4).map((c, i) => (
                <LbRow key={i} pos={i + 1} name={c.name} sub={`${c.orders} order${c.orders !== 1 ? "s" : ""}`}
                  amt={c.revenue} delta={"+—"} pct={c.pct} hue={c.hue} isDark={isDark} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="sr-s2" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 12 }}>
        {[
          { k: "Revenue",         icon: <FaCoins size={12} />,    v: fmtK(totalRevenue),     delta: `${totalOrders} orders`,   up: true,  color: accent          },
          { k: "Net Revenue",     icon: <FaChartLine size={12} />, v: fmtK(netRevenue),       delta: `${fmtKbare(creditsApplied)} credits`, up: netRevenue > 0, color: "#10b981" },
          { k: "Orders",          icon: <FaReceipt size={12} />,  v: totalOrders,            delta: `${completedOrds} completed`, up: true, color: "#3b82f6"      },
          { k: "Avg order value", icon: <FaHashtag size={12} />,  v: fmtK(avgOrderVal),      delta: "per order",                up: true,  color: "#8b5cf6"      },
          { k: "Invoiced",        icon: <FaUsers size={12} />,    v: fmtK(invoicedTotal),    delta: `${invStats.count || 0} invoices`, up: true, color: "#f59e0b" },
        ].map((kpi, i) => (
          <div key={i} className="sr-kpi-card">
            <div style={{ position: "absolute", top: 0, left: 14, right: 14, height: 1.5,
              background: `linear-gradient(90deg, transparent, ${kpi.color}55, transparent)` }} />
            <div style={{ fontSize: 10.5, color: muted, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: ".05em", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: kpi.color }}>{kpi.icon}</span> {kpi.k}
            </div>
            <div className="sora" style={{ fontSize: 20, fontWeight: 800, color: text, lineHeight: 1, marginBottom: 5 }}>{kpi.v}</div>
            <div style={{ fontSize: 11, color: kpi.up ? "#10b981" : "#ef4444" }}>{kpi.delta}</div>
          </div>
        ))}
      </div>

      {/* ── Daily chart ── */}
      <div className="sr-s3 sr-card" style={{ marginBottom: 12 }}>
        <div className="sr-card-h">
          Sales over time
          <span style={{ color: muted, fontWeight: 400 }}>· daily · {now.toLocaleString("en-AE", { month: "long", year: "numeric" })}</span>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99,
              background: onPace ? "rgba(16,185,129,.12)" : "rgba(245,158,11,.12)",
              color: onPace ? "#10b981" : "#f59e0b", fontWeight: 600 }}>
              {QUOTA_PCT}% of target
            </span>
            <div className="sr-seg">
              <button className={chartType === "bars" ? "on" : ""} onClick={() => setChartType("bars")}>Bars</button>
              <button className={chartType === "area" ? "on" : ""} onClick={() => setChartType("area")}>Area</button>
            </div>
          </div>
        </div>
        <div style={{ padding: "8px 14px 14px" }}>
          <div style={{ display: "flex", gap: 14, paddingBottom: 8, fontSize: 11, color: muted, flexWrap: "wrap" }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: accent, marginRight: 5 }} />Daily sales</span>
            <span style={{ marginLeft: "auto", color: muted }}>Total <b className="mono" style={{ color: text }}>{fmtMoney(totalRevenue)}</b></span>
          </div>
          <SalesChart data={dailyData} type={chartType} isDark={isDark} accent={accent} />
        </div>
      </div>

      {/* ── Top customers + top products ── */}
      <div className="sr-s3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div className="sr-card">
          <div className="sr-card-h">Top customers <span style={{ color: muted, fontWeight: 400 }}>· by revenue</span></div>
          <div className="sr-card-b">
            {topCustomers.length === 0
              ? <div style={{ textAlign: "center", color: muted, fontSize: 12, padding: "24px 0" }}>No orders this period</div>
              : topCustomers.map((c, i) => (
                <LbRow key={i} pos={i + 1} name={c.name} sub={`${c.orders} orders`}
                  amt={c.revenue} delta="—" pct={c.pct} hue={c.hue} isDark={isDark} />
              ))}
          </div>
        </div>
        <div className="sr-card">
          <div className="sr-card-h">Top products <span style={{ color: muted, fontWeight: 400 }}>· by revenue</span></div>
          <div className="sr-card-b">
            {topProducts.length === 0
              ? <div style={{ textAlign: "center", color: muted, fontSize: 12, padding: "24px 0" }}>No product data</div>
              : topProducts.map((p, i) => (
                <LbRow key={i} pos={i + 1} name={p.name} sub={`${p.code || "—"} · ${p.units} units`}
                  amt={p.revenue} delta="—" pct={p.pct} hue={p.hue} isDark={isDark} />
              ))}
          </div>
        </div>
      </div>

      {/* ── Channel donut + activity feed ── */}
      <div className="sr-s4" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
        <div className="sr-card">
          <div className="sr-card-h">By order status</div>
          <div className="sr-card-b" style={{ paddingTop: 8 }}>
            <ChannelDonut channels={channels} isDark={isDark} />
          </div>
        </div>
        <div className="sr-card">
          <div className="sr-card-h">
            Recent activity
            <span style={{ fontSize: 11, color: muted, fontWeight: 400, cursor: "pointer" }}>View full feed →</span>
          </div>
          <div className="sr-card-b">
            {feed.length === 0
              ? <div style={{ textAlign: "center", color: muted, fontSize: 12, padding: "24px 0" }}>No recent activity</div>
              : feed.map((f, i) => <FeedRow key={i} {...f} isDark={isDark} />)}
          </div>
        </div>
      </div>

      {/* ── Credit notes band ── */}
      <div className="sr-s4" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
        {[
          { label: "Net Revenue",      value: fmtK(netRevenue),       sub: creditsApplied > 0 ? `After ${fmtK(creditsApplied)} in credits` : "No credits applied", color: "#10b981", pct: invoicedTotal > 0 ? (netRevenue / invoicedTotal) * 100 : 100 },
          { label: "Credits Applied",  value: fmtK(creditsApplied),   sub: `${cnStats.countByStatus?.applied?.count || 0} credit notes`, color: "#f43f5e", pct: invoicedTotal > 0 ? (creditsApplied / invoicedTotal) * 100 : 0 },
          { label: "Credits Pending",  value: fmtK(creditsPending),   sub: `${cnStats.totalVoid || 0} voided`, color: "#f59e0b", pct: invoicedTotal > 0 ? (creditsPending / invoicedTotal) * 100 : 0 },
        ].map((item, i) => (
          <div key={i} className="sr-card" style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{item.label}</div>
            <div className="sora" style={{ fontSize: 18, fontWeight: 800, color: item.color, marginBottom: 3 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: muted, marginBottom: 10 }}>{item.sub}</div>
            <div style={{ height: 4, background: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, item.pct).toFixed(1)}%`, background: item.color, borderRadius: 2, transition: "width .4s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── AR Aging ── */}
      <div className="sr-s5 sr-card" style={{ marginBottom: 12 }}>
        <div className="sr-card-h">
          <div>
            <div>AR Aging Report</div>
            <div style={{ fontSize: 10.5, color: muted, fontWeight: 400, marginTop: 1 }}>Outstanding receivables · excludes paid, void & draft</div>
          </div>
          <span className="sora" style={{ fontSize: 14, fontWeight: 800, color: "#ef4444" }}>{fmtMoney(totalAging)}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", borderBottom: `1px solid ${border}` }}>
          {agingRows.map((r, i) => {
            const amt = agingSum(r.items);
            const pct = totalAging > 0 ? (amt / totalAging) * 100 : 0;
            return (
              <div key={r.label} style={{ padding: "12px 16px", borderRight: i < 4 ? `1px solid ${border}` : "none" }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{r.label}</div>
                <div className="sora" style={{ fontSize: 15, fontWeight: 800, color: r.color, marginBottom: 3 }}>{fmtK(amt)}</div>
                <div style={{ fontSize: 10.5, color: muted, marginBottom: 7 }}>{r.items.length} invoice{r.items.length !== 1 ? "s" : ""}</div>
                <div style={{ height: 3, background: isDark ? "rgba(255,255,255,.06)" : "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, pct).toFixed(1)}%`, background: r.color, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
        {[...agingBuckets.d30, ...agingBuckets.d60, ...agingBuckets.d90, ...agingBuckets.d90p].length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: isDark ? "rgba(255,255,255,.03)" : "#f8fafc" }}>
                  {["Invoice #", "Customer", "Invoice Date", "Due Date", "Days Overdue", "Balance Due"].map((h, i) => (
                    <th key={i} style={{ padding: "9px 14px", textAlign: i >= 5 ? "right" : "left", fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap", borderBottom: `1px solid ${border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agingRows.slice(1).flatMap(r => r.items.map(inv => {
                  const due  = inv.dueDate ? new Date(inv.dueDate) : null;
                  const days = due ? Math.max(0, Math.floor((today - due) / 86400000)) : 0;
                  return (
                    <tr key={inv._id} className="sr-row-hover" style={{ borderBottom: `1px solid ${border}` }}>
                      <td style={{ padding: "10px 14px" }}><span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "#6366f1" }}>{inv.invoiceNumber || "—"}</span></td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: text }}>{inv.customer || inv.customerName || "—"}</td>
                      <td style={{ padding: "10px 14px", color: muted }}>{fmtDate(inv.invoiceDate)}</td>
                      <td style={{ padding: "10px 14px", color: muted }}>{due ? fmtDate(due) : "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                          background: days > 90 ? "rgba(239,68,68,.12)" : days > 60 ? "rgba(249,115,22,.12)" : days > 30 ? "rgba(245,158,11,.12)" : "rgba(59,130,246,.12)",
                          color:      days > 90 ? "#ef4444"             : days > 60 ? "#f97316"             : days > 30 ? "#f59e0b"             : "#3b82f6",
                          border: `1px solid ${days > 90 ? "rgba(239,68,68,.3)" : days > 60 ? "rgba(249,115,22,.3)" : days > 30 ? "rgba(245,158,11,.3)" : "rgba(59,130,246,.3)"}` }}>
                          {days}d overdue
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontFamily: "DM Mono, monospace", color: days > 60 ? "#ef4444" : text }}>{fmtMoney(inv.balanceDue || inv.total || 0)}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "28px 0", textAlign: "center", color: muted, fontSize: 13 }}>No outstanding receivables</div>
        )}
      </div>

      {/* ── Orders table ── */}
      {/* <div className="sr-s5 sr-card">
        <div className="sr-card-h">
          Recent sales orders
          <span style={{ fontSize: 11, color: muted, fontWeight: 400 }}>{filtered.length} records</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: isDark ? "rgba(255,255,255,.03)" : "#f8fafc" }}>
                {["Order #", "Customer", "Status", "LPO Number", "Order Date", "Total"].map((h, i) => (
                  <th key={i} style={{ padding: "9px 14px", textAlign: i >= 5 ? "right" : "left", fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap", borderBottom: `1px solid ${border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((o, i) => {
                const sc = STATUS_COLOR[(o.status || "").toLowerCase()] || "#64748b";
                return (
                  <tr key={i} className="sr-row-hover" style={{ borderBottom: `1px solid ${border}` }}>
                    <td style={{ padding: "10px 14px" }}><span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "#6366f1" }}>{o.orderNumber || o.saleOrderNumber || "—"}</span></td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: text }}>{o.customerName || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: `${sc}18`, color: sc, border: `1px solid ${sc}30` }}>
                        {o.status || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: muted, fontFamily: "DM Mono, monospace" }}>{o.lpoNumber || "—"}</td>
                    <td style={{ padding: "10px 14px", color: muted }}>{fmtDate(o.orderDate)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: text, fontFamily: "DM Mono, monospace" }}>{fmtMoney(o.total)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "48px 14px", textAlign: "center", color: muted, fontSize: 13 }}>No sales orders found for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div> */}
    </div>
  );
}
