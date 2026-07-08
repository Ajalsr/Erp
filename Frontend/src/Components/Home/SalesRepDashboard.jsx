import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FaFileAlt, FaCheckCircle, FaShoppingCart, FaMoneyBillWave,
  FaExchangeAlt, FaBullseye, FaTrophy, FaTimes, FaChevronRight,
} from "react-icons/fa";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import useAuthStore from "../../store/useAuthStore";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import useGetSalesRepStats from "../../helper/useGetSalesRepStats";
import axiosInstance from "../../helper/axiosInstance";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

const fmtNum = (n) => Number(n || 0).toLocaleString("en-AE");
const fmtMoney = (n, ccy) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${ccy} ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${ccy} ${(v / 1_000).toFixed(1)}K`;
  return `${ccy} ${v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const rate = (num, den) => (den > 0 ? Math.round((num / den) * 100) : 0);
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt) ? "—" : dt.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
};

/* Single stat tile — matches the card language used across the app. Clickable when
   onClick is given (drills into the underlying records). */
const Tile = ({ T, icon, accent, label, value, sub, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
      padding: 20, display: "flex", flexDirection: "column", gap: 12, minWidth: 0,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      cursor: onClick ? "pointer" : "default", position: "relative",
      transition: "border-color .15s, transform .1s",
    }}
    onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.borderColor = accent; e.currentTarget.style.transform = "translateY(-1px)"; } }}
    onMouseLeave={(e) => { if (onClick) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "none"; } }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        background: `${accent}1f`, color: accent,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
      }}>{icon}</div>
      {onClick && <FaChevronRight size={11} style={{ color: T.textSec, opacity: 0.5, marginTop: 4 }} />}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: T.textPri, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      <div style={{ fontSize: 13, color: T.textSec, marginTop: 4 }}>{label}</div>
      {sub != null && <div style={{ fontSize: 11, color: T.textSec, marginTop: 6, opacity: 0.85 }}>{sub}</div>}
    </div>
  </div>
);

/* Drill-down modal: lists the records behind a metric. */
const DrillModal = ({ T, isDark, ccy, title, metric, onClose }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    axiosInstance.get("/api/dashboard/sales-rep/records", { params: { metric } })
      .then((r) => { if (live) setRecords(r.data?.data?.records ?? []); })
      .catch((e) => { if (live) setError(e?.response?.data?.message ?? "Failed to load records"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [metric]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100000, background: "rgba(0,0,0,.45)",
        backdropFilter: "blur(2px)", display: "flex", justifyContent: "flex-end",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: "92vw", height: "100%", background: T.bg,
          borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column",
          boxShadow: "-16px 0 48px rgba(0,0,0,.28)",
        }}
      >
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri }}>{title}</div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>
              {loading ? "Loading…" : `${records.length} record${records.length === 1 ? "" : "s"}`}
            </div>
          </div>
          <span onClick={onClose} style={{ cursor: "pointer", color: T.textSec, fontSize: 16, padding: 6 }}><FaTimes /></span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {error && <div style={{ color: "#ef4444", fontSize: 13, padding: 16 }}>{error}</div>}
          {!loading && !error && records.length === 0 && (
            <div style={{ color: T.textSec, fontSize: 13, textAlign: "center", padding: "40px 0" }}>No records.</div>
          )}
          {records.map((r) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "12px 14px", borderRadius: 12, background: T.surface,
              border: `1px solid ${T.border}`, marginBottom: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{r.number || "—"}</div>
                <div style={{ fontSize: 12, color: T.textSec, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.customer || "—"} · {fmtDate(r.date)}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{fmtMoney(r.amount, ccy)}</div>
                {r.status && <div style={{
                  fontSize: 10.5, fontWeight: 700, textTransform: "capitalize", marginTop: 3,
                  color: isDark ? "#94a3b8" : "#64748b",
                }}>{r.status}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* Chart section wrapper card. */
const ChartCard = ({ T, title, subtitle, children }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
    padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  }}>
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: T.textSec, marginTop: 3 }}>{subtitle}</div>}
    </div>
    {children}
  </div>
);

export default function SalesRepDashboard() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const user = useAuthStore((s) => s.user);
  const { stats, loading } = useGetSalesRepStats();

  const [ccy, setCcy] = useState("AED");
  useEffect(() => {
    axiosInstance.get("/api/exchange-rates/")
      .then((r) => setCcy(r.data?.baseCurrency || "AED"))
      .catch(() => {});
  }, []);

  // Name: the app stores the display name in user.userId (same as the full dashboard uses).
  const name = user?.userId || user?.name || "there";
  const {
    year, yearlyTarget, salesAchieved, achievedPct,
    quotationMade, quotationAchieved, salesMade, salesConverted,
    monthly = [],
  } = stats;

  const winRate  = rate(quotationAchieved, quotationMade); // quotes accepted/converted
  const convRate = rate(salesConverted, salesMade);        // SOs originating from a quote
  const accent = "#3b82f6";

  const { rank, rankTotal } = stats;
  const curMonth = new Date().getMonth() + 1;
  const thisMonth = Number(monthly.find((m) => m.month === curMonth)?.salesAchieved || 0);
  const avgDeal = salesMade > 0 ? salesAchieved / salesMade : 0;
  const best = useMemo(
    () => monthly.reduce((acc, m) => (Number(m.salesAchieved) > acc.val ? { label: m.label, val: Number(m.salesAchieved) } : acc), { label: "—", val: 0 }),
    [monthly],
  );

  // Cumulative sales-achieved vs a flat yearly-target line, month by month.
  const targetSeries = useMemo(() => {
    let running = 0;
    return monthly.map((m) => {
      running += Number(m.salesAchieved || 0);
      return { label: m.label, Achieved: running, Target: Number(yearlyTarget || 0) };
    });
  }, [monthly, yearlyTarget]);

  const gridStroke = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const axisTick = { fill: T.textSec, fontSize: 11 };
  const tooltipStyle = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.textPri };

  // Tile drill-down: { metric, title } or null.
  const [drill, setDrill] = useState(null);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.textPri, margin: 0 }}>
          {greeting()}, {name}
        </h1>
        <p style={{ fontSize: 13, color: T.textSec, margin: "6px 0 0" }}>
          Your sales performance for {year}
        </p>
      </div>

      {/* Yearly target hero */}
      <div style={{
        background: `linear-gradient(135deg, ${accent}, #2563eb)`,
        borderRadius: 18, padding: 24, color: "#fff", marginBottom: 22,
        boxShadow: "0 8px 24px rgba(37,99,235,.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.9 }}>
              <FaBullseye /> Yearly Target
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>
              {yearlyTarget > 0 ? fmtMoney(yearlyTarget, ccy) : "Not set"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>Achieved</div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 6 }}>{fmtMoney(salesAchieved, ccy)}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 18 }}>
          <div style={{ height: 10, borderRadius: 6, background: "rgba(255,255,255,.25)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.min(achievedPct, 100)}%`,
              background: "#fff", borderRadius: 6, transition: "width .4s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 8, opacity: 0.95 }}>
            <span>{achievedPct}% of target</span>
            <span>{yearlyTarget > 0 ? fmtMoney(Math.max(yearlyTarget - salesAchieved, 0), ccy) + " to go" : "Set a target in settings"}</span>
          </div>
        </div>

        {/* Detail chips */}
        <div style={{
          display: "grid", gap: 12, marginTop: 20,
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        }}>
          {[
            { k: "This Month",   v: fmtMoney(thisMonth, ccy) },
            { k: "Avg Deal Size", v: fmtMoney(avgDeal, ccy) },
            { k: "Best Month",   v: best.val > 0 ? `${best.label} · ${fmtMoney(best.val, ccy)}` : "—" },
            { k: "Rank",         v: rankTotal > 0 ? `#${rank} of ${rankTotal}` : "—" },
          ].map((c) => (
            <div key={c.k} style={{
              background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)",
              borderRadius: 12, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", opacity: 0.85 }}>{c.k}</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 5 }}>{c.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Target progress line graph — cumulative achieved vs target across the year */}
      <div style={{ marginBottom: 22 }}>
        <ChartCard T={T} title="Target Progress" subtitle={`Cumulative sales achieved vs yearly target · ${year}`}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={targetSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="srAch" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoney(v, ccy)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(v, ccy)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Achieved" stroke={accent} strokeWidth={2.5} fill="url(#srAch)" />
              <Line type="monotone" dataKey="Target" stroke="#16a34a" strokeWidth={2} strokeDasharray="6 5" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Stat tiles */}
      <div style={{
        display: "grid", gap: 16, marginBottom: 22,
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        opacity: loading ? 0.6 : 1, transition: "opacity .2s",
      }}>
        <Tile T={T} icon={<FaFileAlt />}     accent="#6366f1" label="Quotation Made"     value={fmtNum(quotationMade)} onClick={() => setDrill({ metric: "quotationMade", title: "Quotation Made" })} />
        <Tile T={T} icon={<FaCheckCircle />} accent="#16a34a" label="Quotation Achieved" value={fmtNum(quotationAchieved)} sub={`${winRate}% win rate`} onClick={() => setDrill({ metric: "quotationAchieved", title: "Quotation Achieved" })} />
        <Tile T={T} icon={<FaShoppingCart />} accent="#f59e0b" label="Sales Made"        value={fmtNum(salesMade)} onClick={() => setDrill({ metric: "salesMade", title: "Sales Made" })} />
        <Tile T={T} icon={<FaMoneyBillWave />} accent="#10b981" label="Sales Achieved"   value={fmtMoney(salesAchieved, ccy)} onClick={() => setDrill({ metric: "salesAchieved", title: "Sales Achieved" })} />
        <Tile T={T} icon={<FaExchangeAlt />} accent="#8b5cf6" label="Sales Converted"    value={fmtNum(salesConverted)} sub={`${convRate}% from quotes`} onClick={() => setDrill({ metric: "salesConverted", title: "Sales Converted" })} />
        <Tile T={T} icon={<FaTrophy />}      accent="#ef4444" label="Target Progress"    value={`${achievedPct}%`} sub={`of ${yearlyTarget > 0 ? fmtMoney(yearlyTarget, ccy) : "—"}`} />
      </div>

      {/* Detailed monthly trends */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        {/* Quotes: made vs achieved */}
        <ChartCard T={T} title="Quotations" subtitle="Made vs achieved (converted to a sale), by month">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={monthly} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="quotationMade" name="Made" stroke="#6366f1" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="quotationAchieved" name="Achieved" stroke="#16a34a" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Sales orders: made vs converted */}
        <ChartCard T={T} title="Sales Orders" subtitle="Made vs converted-from-quote, by month">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={monthly} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="salesMade" name="Made" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="salesConverted" name="Converted" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Sales achieved amount, by month */}
        <ChartCard T={T} title="Sales Achieved" subtitle={`Sales order value per month · ${ccy}`}>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="srMonthAch" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoney(v, ccy)} width={70} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(v, ccy)} />
              <Area type="monotone" dataKey="salesAchieved" name="Achieved" stroke="#10b981" strokeWidth={2.5} fill="url(#srMonthAch)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {drill && (
        <DrillModal
          T={T} isDark={isDark} ccy={ccy}
          title={drill.title} metric={drill.metric}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
