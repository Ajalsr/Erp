import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../helper/axiosInstance";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import nexusToast from "../../helper/nexusToast";

const fmt = (n) =>
  `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toISO = (date) => new Date(date).toISOString().split("T")[0];
const today = () => toISO(new Date());
const threeMonthsAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return toISO(d);
};

export default function CustomerStatement() {
  const navigate = useNavigate();
  const isDark   = useThemeStore((s) => s.isDark);
  const T        = getTheme(isDark);

  const [customerId,   setCustomerId]   = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customers,    setCustomers]    = useState([]);
  const [custSearch,   setCustSearch]   = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [fromDate,     setFromDate]     = useState(threeMonthsAgo());
  const [toDate,       setToDate]       = useState(today());
  const [statement,    setStatement]    = useState(null);
  const [loading,      setLoading]      = useState(false);

  const searchCustomers = useCallback(async (q) => {
    if (!q || q.length < 2) { setCustomers([]); return; }
    try {
      const res = await axiosInstance.get(`/api/customers/search?q=${encodeURIComponent(q)}&limit=10`);
      setCustomers(res.data?.data?.customers || res.data?.customers || []);
    } catch { setCustomers([]); }
  }, []);

  const handleCustInput = (e) => {
    const val = e.target.value;
    setCustSearch(val);
    setShowDropdown(true);
    searchCustomers(val);
  };

  const selectCustomer = (c) => {
    setCustomerId(c._id);
    setCustomerName(c.customerDisplayName || c.companyName || "");
    setCustSearch(c.customerDisplayName || c.companyName || "");
    setShowDropdown(false);
    setCustomers([]);
  };

  const load = async () => {
    if (!customerId) { nexusToast.error("Select a customer first"); return; }
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/customers/${customerId}/statement?from=${fromDate}&to=${toDate}`
      );
      setStatement(res.data?.data);
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to load statement");
    } finally { setLoading(false); }
  };

  const handlePrint = () => window.print();

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .cs-root * { box-sizing: border-box; }
    .cs-root { font-family: 'DM Sans', sans-serif; }
    .cs-row:hover td { background: ${isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.016)"} !important; }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
    @media print {
      .cs-no-print { display: none !important; }
      .cs-root { background: #fff !important; color: #000 !important; }
    }
  `;

  return (
    <div className="cs-root" style={{ background: T.bg, minHeight: "100vh", color: T.text }}>
      <style>{css}</style>

      {/* Topbar */}
      <div className="cs-no-print" style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 28px", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 12, color: T.muted, cursor: "pointer", padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", fontFamily: "inherit" }}>← Reports</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 800, margin: 0, color: T.textPri || T.text }}>Customer Statement</h1>
          <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0" }}>Account statement with running balance</p>
        </div>
        {statement && (
          <button onClick={handlePrint} style={{ padding: "8px 18px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit" }}>
            🖨 Print / PDF
          </button>
        )}
      </div>

      <div style={{ padding: "24px 28px" }}>

        {/* Filter bar */}
        <div className="cs-no-print" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "18px 20px", marginBottom: 24, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* Customer picker */}
          <div style={{ flex: "1 1 240px", minWidth: 200 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, display: "block", marginBottom: 6 }}>Customer</label>
            <div style={{ position: "relative" }}>
              <input
                value={custSearch}
                onChange={handleCustInput}
                onFocus={() => { if (custSearch.length >= 2) setShowDropdown(true); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Search customer…"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              {showDropdown && customers.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 7, marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
                  {customers.map((c) => (
                    <div key={c._id} onMouseDown={() => selectCustomer(c)} style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ fontWeight: 600 }}>{c.customerDisplayName || c.companyName}</span>
                      {c.customerCode && <span style={{ color: T.muted, fontSize: 11, marginLeft: 8 }}>{c.customerCode}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Date range */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, display: "block", marginBottom: 6 }}>From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, display: "block", marginBottom: 6 }}>To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface2, color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>

          <button onClick={load} disabled={loading} style={{ padding: "8px 22px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", background: T.accent || "#f59e0b", color: "#0a0e1a", border: "none", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Loading…" : "Generate"}
          </button>
        </div>

        {/* Statement */}
        {statement && (
          <div>
            {/* Header */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 800, margin: 0 }}>Account Statement</h2>
                  <p style={{ color: T.muted, fontSize: 13, margin: "4px 0 0" }}>
                    {statement.from} — {statement.to}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, margin: "0 0 4px" }}>Customer</p>
                  <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{statement.customerName}</p>
                </div>
              </div>

              {/* Summary chips */}
              <div style={{ display: "flex", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
                {[
                  { label: "Opening Balance", value: fmt(statement.openingBalance), color: T.muted },
                  { label: "Closing Balance", value: fmt(statement.closingBalance), color: statement.closingBalance > 0 ? "#ef4444" : "#10b981" },
                  { label: "Transactions",    value: statement.lines?.length || 0,  color: T.textPri || T.text },
                ].map(chip => (
                  <div key={chip.label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 16px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, margin: "0 0 4px" }}>{chip.label}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700, color: chip.color, margin: 0 }}>{chip.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Lines table */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: T.surface2 }}>
                      {["Date","Type","Reference","Description","Debit","Credit","Balance"].map((h, i) => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: i >= 4 ? "right" : "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {statement.lines.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13 }}>No transactions in this period</td></tr>
                    ) : statement.lines.map((line, idx) => (
                      <tr key={idx} className="cs-row">
                        <td style={{ padding: "9px 16px", fontSize: 12, color: T.muted, borderBottom: `1px solid ${T.border}` }}>{line.date}</td>
                        <td style={{ padding: "9px 16px", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                            background: line.type === "invoice" ? "rgba(59,130,246,0.12)" : line.type === "payment" ? "rgba(16,185,129,0.12)" : "rgba(124,58,237,0.12)",
                            color: line.type === "invoice" ? "#3b82f6" : line.type === "payment" ? "#10b981" : "#7c3aed",
                          }}>{line.type}</span>
                        </td>
                        <td style={{ padding: "9px 16px", fontSize: 12, fontFamily: "'DM Mono', monospace", color: T.blue || "#3b82f6", borderBottom: `1px solid ${T.border}` }}>{line.reference}</td>
                        <td style={{ padding: "9px 16px", fontSize: 12, color: T.muted, borderBottom: `1px solid ${T.border}` }}>{line.description}</td>
                        <td style={{ padding: "9px 16px", fontSize: 12, textAlign: "right", fontFamily: "'DM Mono', monospace", color: line.debit > 0 ? "#ef4444" : T.muted, borderBottom: `1px solid ${T.border}` }}>
                          {line.debit > 0 ? fmt(line.debit) : "—"}
                        </td>
                        <td style={{ padding: "9px 16px", fontSize: 12, textAlign: "right", fontFamily: "'DM Mono', monospace", color: line.credit > 0 ? "#10b981" : T.muted, borderBottom: `1px solid ${T.border}` }}>
                          {line.credit > 0 ? fmt(line.credit) : "—"}
                        </td>
                        <td style={{ padding: "9px 16px", fontSize: 12, textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: line.balance > 0 ? "#ef4444" : "#10b981", borderBottom: `1px solid ${T.border}` }}>
                          {fmt(Math.abs(line.balance))}{line.balance > 0 ? " Dr" : line.balance < 0 ? " Cr" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!statement && !loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>📄</p>
            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>Select a customer and date range</p>
            <p style={{ fontSize: 12 }}>Then click Generate to produce the account statement</p>
          </div>
        )}
      </div>
    </div>
  );
}
