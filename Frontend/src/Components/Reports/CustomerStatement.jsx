import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../helper/axiosInstance";
import AppDatePicker from "../common/AppDatePicker";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import nexusToast from "../../helper/nexusToast";
import { useBaseCurrency, baseCurrency } from "../../helper/currency";

const fmt = (n) =>
  `${baseCurrency()} ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toISO = (date) => new Date(date).toISOString().split("T")[0];
const today = () => toISO(new Date());
const threeMonthsAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return toISO(d);
};
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
};

export default function CustomerStatement() {
  useBaseCurrency();
  const navigate = useNavigate();
  const isDark   = useThemeStore((s) => s.isDark);
  const T        = getTheme(isDark);

  const [customerId,    setCustomerId]    = useState("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [customers,     setCustomers]     = useState([]);
  const [ddOpen,        setDdOpen]        = useState(false);
  const [search,        setSearch]        = useState("");
  const [fromDate,      setFromDate]      = useState(threeMonthsAgo());
  const [toDate,        setToDate]        = useState(today());
  const [statement,     setStatement]     = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [exporting,     setExporting]     = useState(false);
  const ddRef = useRef(null);

  useEffect(() => {
    axiosInstance.get("/api/customers/getcustomers")
      .then(res => {
        const list = Array.isArray(res.data?.data) ? res.data.data : (res.data?.data?.customers || []);
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const name = (c.customerDisplayName || c.companyName || "").toLowerCase();
    const code = (c.customerCode || "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  const selectCustomer = (c) => {
    setCustomerId(c._id);
    setCustomerLabel(c.customerDisplayName || c.companyName || "");
    setSearch("");
    setDdOpen(false);
  };

  const load = async () => {
    if (!customerId) { nexusToast.error("Select a customer first"); return; }
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/api/customers/${customerId}/statement?startDate=${fromDate}&endDate=${toDate}`
      );
      setStatement(res.data?.data);
    } catch (e) {
      nexusToast.error(e.response?.data?.message || e.response?.data?.error || "Failed to load statement");
    } finally { setLoading(false); }
  };

  const handlePrint = () => window.print();

  // Export the customer's OUTSTANDING invoices (remaining balance per invoice) to an
  // Excel-openable .xls. Answers "what's still owed and on which invoices".
  const balanceOf = (i) => Math.max(0, (i.totals?.grandTotal ?? 0) - (i.amountPaid ?? 0));
  const exportExcel = async () => {
    if (!customerId) { nexusToast.error("Select a customer first"); return; }
    setExporting(true);
    try {
      const res = await axiosInstance.get(`/api/invoices?customerId=${customerId}&limit=500`);
      const list = res.data?.data?.invoices || res.data?.data || [];
      const open = list
        .filter(i => i.status !== "paid" && i.status !== "void" && i.type !== "proforma" && balanceOf(i) > 0)
        .sort((a, b) => new Date(a.issueDate || 0) - new Date(b.issueDate || 0));
      if (!open.length) { nexusToast.error("No outstanding invoices to export"); return; }
      const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const num = (n) => Number(n || 0).toFixed(2);
      const rows = open.map(i => {
        const total = i.totals?.grandTotal ?? 0, paid = i.amountPaid ?? 0;
        return `<tr><td>${esc(i.invoiceNumber)}</td><td>${esc(fmtDate(i.issueDate))}</td><td>${esc(fmtDate(i.dueDate))}</td><td>${num(total)}</td><td>${num(paid)}</td><td>${num(balanceOf(i))}</td><td>${esc(i.status)}</td></tr>`;
      }).join("");
      const totalRem = open.reduce((s, i) => s + balanceOf(i), 0);
      const html =
        `<table border="1">` +
        `<tr><th colspan="7" style="text-align:left">Outstanding Statement — ${esc(customerLabel)}</th></tr>` +
        `<tr><th>Invoice #</th><th>Invoice Date</th><th>Due Date</th><th>Invoice Amount</th><th>Paid</th><th>Remaining</th><th>Status</th></tr>` +
        rows +
        `<tr><td colspan="5"><b>Total Remaining</b></td><td><b>${num(totalRem)}</b></td><td></td></tr>` +
        `</table>`;
      const bom = String.fromCharCode(0xFEFF);
      const blob = new Blob([`${bom}<html><head><meta charset="utf-8"></head><body>${html}</body></html>`], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `statement-${(customerLabel || "customer").replace(/\s+/g, "_")}.xls`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      nexusToast.success("Customer statement downloaded");
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Export failed");
    } finally { setExporting(false); }
  };

  const inputStyle = {
    padding: "8px 12px", borderRadius: 7, border: `1px solid ${T.border}`,
    background: T.surface2, color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none",
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
    .cs-root * { box-sizing: border-box; }
    .cs-root { font-family: 'DM Sans', sans-serif; }
    .cs-row:hover td { background: ${isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.016)"} !important; }
    .cs-dd-item:hover { background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"} !important; }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
    @media print {
      body * { visibility: hidden !important; }
      .cs-print-area, .cs-print-area * { visibility: visible !important; }
      .cs-print-area {
        position: absolute !important; top: 0 !important; left: 0 !important;
        width: 100% !important; height: auto !important; margin: 0 !important; padding: 20px !important;
        background: #fff !important; color: #000 !important;
      }
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
        {customerId && (
          <button onClick={exportExcel} disabled={exporting} style={{ padding: "8px 18px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: exporting ? "not-allowed" : "pointer", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontFamily: "inherit", opacity: exporting ? 0.6 : 1 }}>
            {exporting ? "Exporting…" : "⬇ Export Excel"}
          </button>
        )}
        {statement && (
          <button onClick={handlePrint} style={{ padding: "8px 18px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit" }}>
            🖨 Print / PDF
          </button>
        )}
      </div>

      <div style={{ padding: "24px 28px" }}>

        {/* Filter bar */}
        <div className="cs-no-print" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "18px 20px", marginBottom: 24, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>

          {/* Custom customer dropdown */}
          <div style={{ flex: "1 1 240px", minWidth: 220 }} ref={ddRef}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, display: "block", marginBottom: 6 }}>Customer</label>
            <div style={{ position: "relative" }}>
              {/* Trigger button */}
              <button
                onClick={() => setDdOpen((o) => !o)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 7, border: `1px solid ${ddOpen ? (T.accent || "#f59e0b") : T.border}`,
                  background: T.surface2, color: customerId ? T.text : T.muted,
                  fontSize: 13, fontFamily: "inherit", cursor: "pointer", outline: "none",
                  transition: "border-color 0.15s",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {customerLabel || "— Select customer —"}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginLeft: 8, transform: ddOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", opacity: 0.5 }}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Dropdown panel */}
              {ddOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
                  boxShadow: `0 8px 24px rgba(0,0,0,${isDark ? 0.4 : 0.12})`,
                  overflow: "hidden",
                }}>
                  {/* Search inside dropdown */}
                  <div style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}` }}>
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search…"
                      style={{ ...inputStyle, width: "100%", padding: "6px 10px", fontSize: 12 }}
                    />
                  </div>

                  {/* List */}
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {filteredCustomers.length === 0 ? (
                      <div style={{ padding: "14px 14px", fontSize: 12, color: T.muted, textAlign: "center" }}>No customers found</div>
                    ) : filteredCustomers.map((c) => (
                      <div
                        key={c._id}
                        className="cs-dd-item"
                        onClick={() => selectCustomer(c)}
                        style={{
                          padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center",
                          justifyContent: "space-between", gap: 8,
                          background: c._id === customerId ? (isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.08)") : "transparent",
                          borderLeft: c._id === customerId ? `3px solid ${T.accent || "#f59e0b"}` : "3px solid transparent",
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.customerDisplayName || c.companyName}
                        </span>
                        {c.customerCode && (
                          <span style={{ fontSize: 10, color: T.muted, background: T.surface2, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>
                            {c.customerCode}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Date range */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, display: "block", marginBottom: 6 }}>From</label>
            <AppDatePicker value={fromDate} onChange={setFromDate} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, display: "block", marginBottom: 6 }}>To</label>
            <AppDatePicker value={toDate} onChange={setToDate} />
          </div>

          <button onClick={load} disabled={loading} style={{ padding: "8px 22px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", background: T.accent || "#f59e0b", color: "#0a0e1a", border: "none", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Loading…" : "Generate"}
          </button>
        </div>

        {/* Statement */}
        {statement && (
          <div className="cs-print-area">
            {/* Header */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 800, margin: 0 }}>Account Statement</h2>
                  <p style={{ color: T.muted, fontSize: 13, margin: "4px 0 0" }}>
                    {statement.period?.startDate} — {statement.period?.endDate}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, margin: "0 0 4px" }}>Customer</p>
                  <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{statement.customer?.name || statement.customer?.companyName}</p>
                  {statement.customer?.code && <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0" }}>{statement.customer.code}</p>}
                </div>
              </div>

              {/* Summary chips */}
              <div style={{ display: "flex", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
                {[
                  { label: "Opening Balance", value: fmt(statement.openingBalance), color: T.muted },
                  { label: "Closing Balance", value: fmt(statement.closingBalance), color: statement.closingBalance > 0 ? "#ef4444" : "#10b981" },
                  { label: "Transactions",    value: statement.transactions?.length || 0, color: T.textPri || T.text },
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
                    {!statement.transactions?.length ? (
                      <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13 }}>No transactions in this period</td></tr>
                    ) : statement.transactions.map((line, idx) => (
                      <tr key={idx} className="cs-row">
                        <td style={{ padding: "9px 16px", fontSize: 12, color: T.muted, borderBottom: `1px solid ${T.border}` }}>{fmtDate(line.date)}</td>
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
