import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../helper/axiosInstance";
import useThemeStore, { getTheme } from "../../store/useThemeStore";

const fmt = (n) =>
  `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BUCKETS = [
  { key: "current", label: "Current",   color: "#10b981", glow: "rgba(16,185,129,0.15)" },
  { key: "1-30",    label: "1–30 days", color: "#f59e0b", glow: "rgba(245,158,11,0.15)"  },
  { key: "31-60",   label: "31–60 days",color: "#f97316", glow: "rgba(249,115,22,0.15)"  },
  { key: "61-90",   label: "61–90 days",color: "#ef4444", glow: "rgba(239,68,68,0.15)"   },
  { key: "90+",     label: "90+ days",  color: "#7c3aed", glow: "rgba(124,58,237,0.15)"  },
];

const CUST_COLS = [
  { key: "customerName", label: "Customer",    w: "22%" },
  { key: "current",      label: "Current",     w: "13%" },
  { key: "days1_30",     label: "1–30 days",   w: "13%" },
  { key: "days31_60",    label: "31–60 days",  w: "13%" },
  { key: "days61_90",    label: "61–90 days",  w: "13%" },
  { key: "days90Plus",   label: "90+ days",    w: "13%" },
  { key: "total",        label: "Total",       w: "13%" },
];

export default function AgingReport() {
  const navigate = useNavigate();
  const isDark   = useThemeStore((s) => s.isDark);
  const T        = getTheme(isDark);

  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [expandedBucket, setExpandedBucket] = useState(null);
  const [search,    setSearch]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/api/invoices/aging");
      setData(res.data?.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .ag-root * { box-sizing: border-box; }
    .ag-root { font-family: 'DM Sans', sans-serif; }
    .ag-row:hover td { background: ${isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)"} !important; }
    .ag-inv-row:hover td { background: ${isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.014)"} !important; }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
  `;

  const customerSummary = (data?.customerSummary || []).filter(c =>
    !search || c.customerName?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => b.total - a.total);

  const totalOverall = BUCKETS.reduce((sum, b) => sum + (data?.bucketTotals?.[b.key] || 0), 0);

  return (
    <div className="ag-root" style={{ background: T.bg, minHeight: "100vh", color: T.text }}>
      <style>{css}</style>

      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 28px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 12, color: T.muted, cursor: "pointer", padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", fontFamily: "inherit" }}>← Reports</button>
        <div>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 800, margin: 0, color: T.textPri || T.text }}>Accounts Receivable Aging</h1>
          {data?.asOf && <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0" }}>As of {data.asOf}</p>}
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>

        {/* Bucket summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
          {BUCKETS.map((b) => {
            const total = data?.bucketTotals?.[b.key] || 0;
            const count = (data?.buckets?.[b.key] || []).length;
            const pct   = totalOverall > 0 ? (total / totalOverall) * 100 : 0;
            return (
              <div
                key={b.key}
                onClick={() => setExpandedBucket(expandedBucket === b.key ? null : b.key)}
                style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderTop: `3px solid ${b.color}`,
                  borderRadius: 10, padding: "14px 16px", cursor: "pointer",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  boxShadow: expandedBucket === b.key ? `0 0 0 2px ${b.color}60` : "none",
                }}
              >
                <p style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>{b.label}</p>
                <p style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 800, color: b.color, margin: "0 0 2px", lineHeight: 1 }}>
                  {count} inv
                </p>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: T.muted, margin: "0 0 8px" }}>{fmt(total)}</p>
                {/* Progress bar */}
                <div style={{ height: 3, borderRadius: 2, background: T.border }}>
                  <div style={{ height: "100%", borderRadius: 2, width: `${pct}%`, background: b.color, transition: "width 0.4s" }} />
                </div>
                <p style={{ fontSize: 10, color: T.muted, margin: "4px 0 0" }}>{pct.toFixed(1)}% of total</p>
              </div>
            );
          })}
        </div>

        {/* Expanded bucket invoice list */}
        {expandedBucket && (
          <div style={{ marginBottom: 28, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: BUCKETS.find(b => b.key === expandedBucket)?.color, display: "inline-block" }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                {BUCKETS.find(b => b.key === expandedBucket)?.label} — {(data?.buckets?.[expandedBucket] || []).length} invoices
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.surface2 }}>
                    {["Invoice #","Customer","Issue Date","Due Date","Grand Total","Paid","Balance","Days Overdue"].map(h => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: h === "Invoice #" || h === "Customer" ? "left" : "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.buckets?.[expandedBucket] || []).map((inv) => (
                    <tr key={inv.invoiceId} className="ag-inv-row">
                      <td style={{ padding: "8px 14px", fontSize: 12, fontFamily: "'DM Mono', monospace", color: T.blue || "#3b82f6", borderBottom: `1px solid ${T.border}` }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, borderBottom: `1px solid ${T.border}` }}>{inv.customerName || "—"}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.border}` }}>{inv.issueDate}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, textAlign: "right", color: inv.daysOverdue > 0 ? "#ef4444" : T.muted, borderBottom: `1px solid ${T.border}` }}>{inv.dueDate}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, textAlign: "right", fontFamily: "'DM Mono', monospace", borderBottom: `1px solid ${T.border}` }}>{fmt(inv.grandTotal)}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, textAlign: "right", fontFamily: "'DM Mono', monospace", color: "#10b981", borderBottom: `1px solid ${T.border}` }}>{fmt(inv.amountPaid)}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#ef4444", borderBottom: `1px solid ${T.border}` }}>{fmt(inv.balanceDue)}</td>
                      <td style={{ padding: "8px 14px", fontSize: 12, textAlign: "right", color: inv.daysOverdue > 0 ? "#ef4444" : "#10b981", fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>
                        {inv.daysOverdue > 0 ? `+${inv.daysOverdue}d` : "On time"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customer summary table */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Customer Summary</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer…"
              style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 12, fontFamily: "inherit", outline: "none", width: 200 }}
            />
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>Loading…</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: T.surface2 }}>
                    {CUST_COLS.map(col => (
                      <th key={col.key} style={{ padding: "10px 16px", textAlign: col.key === "customerName" ? "left" : "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, borderBottom: `1px solid ${T.border}`, width: col.w }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customerSummary.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13 }}>No outstanding receivables</td></tr>
                  ) : customerSummary.map((cust) => (
                    <tr key={cust.customerId} className="ag-row">
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{cust.customerName || cust.customerId}</td>
                      {[
                        { val: cust.current,    color: "#10b981" },
                        { val: cust.days1_30,   color: "#f59e0b" },
                        { val: cust.days31_60,  color: "#f97316" },
                        { val: cust.days61_90,  color: "#ef4444" },
                        { val: cust.days90Plus, color: "#7c3aed" },
                        { val: cust.total,      color: T.text, bold: true },
                      ].map((cell, i) => (
                        <td key={i} style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", color: cell.val > 0 ? cell.color : T.muted, fontWeight: cell.bold ? 700 : 400, borderBottom: `1px solid ${T.border}` }}>
                          {cell.val > 0 ? fmt(cell.val) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {customerSummary.length > 0 && (
                  <tfoot>
                    <tr style={{ background: T.surface2 }}>
                      <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, borderTop: `1px solid ${T.border}` }}>Total</td>
                      {["current","days1_30","days31_60","days61_90","days90Plus","total"].map((k) => {
                        const sum = customerSummary.reduce((a, c) => a + (c[k] || 0), 0);
                        const bIdx = ["current","days1_30","days31_60","days61_90","days90Plus"].indexOf(k);
                        const color = bIdx >= 0 ? BUCKETS[bIdx]?.color : T.text;
                        return (
                          <td key={k} style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, color, borderTop: `1px solid ${T.border}` }}>
                            {fmt(sum)}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
