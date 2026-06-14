import { useEffect, useState, useCallback } from "react";
import { FaSync, FaMapMarkerAlt } from "react-icons/fa";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import axiosInstance from "../../helper/axiosInstance";
import { baseCurrency } from "../../helper/currency";

const fmtMoney = (n) =>
  `${baseCurrency()} ${parseFloat(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EMIRATE_COLOR = {
  "Abu Dhabi": "#6366f1", Dubai: "#3b82f6", Sharjah: "#10b981", Ajman: "#f59e0b",
  "Umm Al Quwain": "#ec4899", "Ras Al Khaimah": "#8b5cf6", Fujairah: "#14b8a6", Unassigned: "#94a3b8",
};

export default function SalesByEmirate() {
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [grandCount, setGrandCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    axiosInstance.get(`/api/delivery-notes/sales-by-emirate?${params}`)
      .then((r) => {
        const d = r.data?.data || {};
        setRows(Array.isArray(d.rows) ? d.rows : []);
        setGrandTotal(d.grandTotal || 0);
        setGrandCount(d.grandCount || 0);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const maxTotal = Math.max(1, ...rows.map((r) => r.total || 0));
  const card = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14 };
  const inp = { padding: "7px 10px", borderRadius: 8, fontSize: 13, background: isDark ? T.inputBg : T.surface2, border: `1px solid ${T.border}`, color: T.textPri, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: "24px 28px", color: T.textPri, fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "Sora, sans-serif", fontSize: 20, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
            <FaMapMarkerAlt color={T.blue} /> Sales by Emirate
          </h1>
          <p style={{ color: T.textSec, fontSize: 13, marginTop: 4 }}>Dispatched &amp; delivered value grouped by delivery location.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inp} title="From" />
          <span style={{ color: T.textSec }}>–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inp} title="To" />
          <button onClick={load} style={{ ...inp, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
            <FaSync size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 18 }}>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: ".05em" }}>Total Sales</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 5, fontFamily: "'DM Mono', monospace", color: T.blue }}>{fmtMoney(grandTotal)}</div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: ".05em" }}>Deliveries</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 5 }}>{grandCount}</div>
        </div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: "uppercase", letterSpacing: ".05em" }}>Emirates</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 5 }}>{rows.length}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
              {["Emirate", "Deliveries", "Share", "Total Value"].map((h, i) => (
                <th key={h} style={{ padding: "11px 16px", textAlign: i >= 1 && i !== 2 ? "right" : "left", fontSize: 11, fontWeight: 600, color: T.textSec, textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 50, textAlign: "center", color: T.textSec }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 54, textAlign: "center", color: T.textSec }}>No dispatched/delivered sales yet. Set a Location on delivery notes to track here.</td></tr>
            ) : rows.map((r) => {
              const color = EMIRATE_COLOR[r.emirate] || "#64748b";
              const pct = grandTotal > 0 ? (r.total / grandTotal) * 100 : 0;
              return (
                <tr key={r.emirate} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />{r.emirate}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: T.textSec }}>{r.count}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 7, borderRadius: 20, background: isDark ? "rgba(255,255,255,.06)" : "#eef2f7", overflow: "hidden" }}>
                        <div style={{ width: `${(r.total / maxTotal) * 100}%`, height: "100%", background: color, borderRadius: 20 }} />
                      </div>
                      <span style={{ fontSize: 11, color: T.textSec, minWidth: 38, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{fmtMoney(r.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
