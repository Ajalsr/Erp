import { useState, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import axiosInstance from "../../helper/axiosInstance";
import useThemeStore, { getTheme } from "../../store/useThemeStore";
import useAuthStore from "../../store/useAuthStore";
import AppDatePicker from "../common/AppDatePicker";
import nexusToast from "../../helper/nexusToast";
import { usePermissions } from "../../helper/permissions";
import { loadImageDataUrl } from "../Letters/letterShared";

const fmt = (n) =>
  `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const today = () => new Date().toISOString().split("T")[0];
const firstOfQuarter = () => {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1).toISOString().split("T")[0];
};

export default function VATReport() {
  const isDark = useThemeStore((s) => s.isDark);
  const T      = getTheme(isDark);
  const { can } = usePermissions();
  const canExport = can("reports", "export");

  const [from,    setFrom]    = useState(firstOfQuarter());
  const [to,      setTo]      = useState(today());
  const [data,    setData]    = useState(null);
  const [lines,   setLines]   = useState(null);   // { sales:[], purchases:[], totals:{} }
  const [tab,     setTab]     = useState("combined"); // combined | sales | purchases
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Org letterhead for the PDF export (mirrors GRN.jsx / InvoicePrint's pattern).
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const [letterhead, setLetterhead] = useState("");
  const [letterTop,  setLetterTop]  = useState(13);
  const [letterBot,  setLetterBot]  = useState(8);
  const [orgName,    setOrgName]    = useState("");

  useEffect(() => {
    const orgId = activeOrg?._id;
    if (!orgId) return;
    axiosInstance.get(`/api/organizations/${orgId}?withImages=true`).then((r) => {
      const d = r.data?.data || {};
      setLetterhead(d.letterheadImage || "");
      setLetterTop(d.letterheadTopPad || 13);
      setLetterBot(d.letterheadBottomPad || 8);
      setOrgName(d.name || d.companyName || "");
    }).catch(() => {});
  }, [activeOrg]);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const [sumRes, lineRes] = await Promise.all([
        axiosInstance.get(`/api/reports/vat?from=${from}&to=${to}`),
        axiosInstance.get(`/api/reports/vat/lines?from=${from}&to=${to}`),
      ]);
      setData(sumRes.data?.data);
      setLines(lineRes.data?.data);
    } catch (e) {
      nexusToast.error(e.response?.data?.message || "Failed to load VAT report");
    } finally { setLoading(false); }
  }, [from, to]);

  const exportDetailExcel = () => {
    if (!lines) return;
    const section = (title, rows, partyLabel) => {
      const out = [[title], ["Ser", "Tax Invoice/Credit Note No", "Date", "Amount (before VAT)", "VAT Amount", partyLabel, `${partyLabel} TRN`, "Description"]];
      (rows || []).forEach((r, i) => out.push([i + 1, r.number, r.date, Number(r.amount || 0), Number(r.vat || 0), r.party, r.trn, r.description]));
      return out;
    };
    let rows = [["VAT Report — Transaction Detail", `${lines.period.from} to ${lines.period.to}`], []];
    if (tab !== "purchases") rows = rows.concat(section("SALES (Output VAT)", lines.sales, "Customer"), [[]]);
    if (tab !== "sales") rows = rows.concat(section("PURCHASES (Input VAT)", lines.purchases, "Supplier"), [[]]);
    rows.push(["Net VAT Payable", "", "", "", lines.totals?.netVATPayable || 0]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 5 }, { wch: 26 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "VAT Detail");
    XLSX.writeFile(wb, `vat_detail_${tab}_${from}_${to}.xlsx`);
  };

  // Print / PDF — same scope as "Export Detail Excel" (only the current tab's
  // transaction rows, not the whole dashboard), stamped with the org letterhead.
  // This is a Tauri desktop webview, not a browser tab — window.open()/popups
  // don't apply here (matches every other Print page in this app, e.g.
  // QuotePrint.jsx: load the PDF into a hidden same-window iframe and call
  // iframe.contentWindow.print() for the native print dialog).
  const printDetailPDF = async () => {
    if (!lines) return;
    setPdfLoading(true);
    try {
      const letterheadData = letterhead ? await loadImageDataUrl(letterhead) : null;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const topPadMM = letterheadData ? (letterTop / 100) * pageH : 14;
      const botPadMM = letterheadData ? (letterBot / 100) * pageH : 14;

      const cols = ["Ser", "Tax Invoice/Credit Note No", "Date", "Amount (before VAT)", "VAT Amount", "Party", "Party TRN", "Description"];
      const body = [];
      const addSection = (title, rows) => {
        body.push([{ content: title, colSpan: 8, styles: { fontStyle: "bold", fillColor: [226, 232, 240], textColor: [15, 23, 42] } }]);
        if (!rows || !rows.length) {
          body.push([{ content: "No transactions in this period.", colSpan: 8, styles: { textColor: [100, 116, 139], halign: "center" } }]);
        } else {
          rows.forEach((r, i) => body.push([i + 1, r.number || "—", r.date || "—", Number(r.amount || 0).toFixed(2), Number(r.vat || 0).toFixed(2), r.party || "—", r.trn || "—", r.description || "—"]));
        }
      };
      if (tab !== "purchases") addSection("SALES (Output VAT)", lines.sales);
      if (tab !== "sales") addSection("PURCHASES (Input VAT)", lines.purchases);
      body.push([
        { content: "Net VAT Payable", colSpan: 4, styles: { fontStyle: "bold" } },
        { content: fmt(lines.totals?.netVATPayable || 0), colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
      ]);

      autoTable(doc, {
        head: [cols],
        body,
        startY: topPadMM,
        margin: { top: topPadMM, bottom: botPadMM, left: 10, right: 10 },
        tableWidth: "auto",
        styles: { fontSize: 11, cellPadding: 4, valign: "middle" },
        headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold", fontSize: 11 },
        columnStyles: { 0: { cellWidth: 12 }, 3: { halign: "right" }, 4: { halign: "right" } },
        // willDrawPage (not didDrawPage) fires BEFORE that page's table content is
        // drawn, so the letterhead lands underneath the table instead of over it.
        willDrawPage: () => { if (letterheadData) doc.addImage(letterheadData, "PNG", 0, 0, pageW, pageH); },
      });

      doc.setProperties({ title: `VAT Detail — ${tab} — ${from} to ${to}${orgName ? ` — ${orgName}` : ""}` });
      const url = doc.output("bloburl");

      // Reuse one hidden same-window iframe across calls instead of popups —
      // load the PDF into it and trigger the OS print dialog directly (its own
      // "Save as PDF" printer covers the "PDF" half of this button).
      let iframe = document.getElementById("vat-pdf-frame");
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "vat-pdf-frame";
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
        document.body.appendChild(iframe);
      }
      iframe.onload = () => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
        catch {
          const a = document.createElement("a");
          a.href = url;
          a.download = `vat_detail_${tab}_${from}_${to}.pdf`;
          a.click();
        }
      };
      iframe.src = url;
    } catch {
      nexusToast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const card = (label, taxable, vat, color, sub) => (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${color}`, borderRadius: 12, padding: "16px 20px" }}>
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.textSec, margin: "0 0 10px" }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: T.textSec, margin: "0 0 8px" }}>{sub}</p>}
      <div style={{ display: "flex", gap: 24 }}>
        <div>
          <p style={{ fontSize: 10, color: T.textSec, margin: "0 0 2px" }}>Taxable Amount</p>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: T.textPri, margin: 0 }}>{fmt(taxable)}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: T.textSec, margin: "0 0 2px" }}>VAT Amount</p>
          <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700, color: color, margin: 0 }}>{fmt(vat)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.textPri, fontFamily: "'DM Sans', sans-serif", padding: "28px" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        @media print {
          .vat-noprint { display: none !important; }
          @page { size: A4; margin: 12mm; }
          body { background: #fff !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 22, fontWeight: 800, color: T.textPri, margin: "0 0 4px", letterSpacing: "-0.4px" }}>VAT Report</h1>
          <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>UAE VAT 201 summary — output tax, input tax, net payable</p>
        </div>
        {data && (
          <div className="vat-noprint" style={{ display: "flex", gap: 10 }}>
            <button onClick={printDetailPDF} disabled={!lines || pdfLoading} style={{ padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: (!lines || pdfLoading) ? "not-allowed" : "pointer", opacity: (!lines || pdfLoading) ? 0.6 : 1, background: "transparent", border: `1.5px solid ${T.border}`, color: T.textPri, fontFamily: "inherit" }}>
              🖨 {pdfLoading ? "Generating…" : "Print / PDF"}
            </button>
          </div>
        )}
      </div>

      {/* Date range picker */}
      <div className="vat-noprint" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: "block", marginBottom: 4 }}>From</label>
          <AppDatePicker value={from} onChange={setFrom} placeholder="From" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.textSec, display: "block", marginBottom: 4 }}>To</label>
          <AppDatePicker value={to} onChange={setTo} placeholder="To" />
        </div>
        {/* Quick presets */}
        {[
          { label: "This Quarter", fn: () => { setFrom(firstOfQuarter()); setTo(today()); } },
          { label: "This Month",   fn: () => { const d = new Date(); setFrom(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`); setTo(today()); } },
          { label: "This Year",    fn: () => { setFrom(`${new Date().getFullYear()}-01-01`); setTo(today()); } },
        ].map(p => (
          <button key={p.label} onClick={p.fn}
            style={{ padding: "8px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "transparent", border: `1.5px solid ${T.border}`, color: T.textSec, fontFamily: "inherit", alignSelf: "flex-end" }}>
            {p.label}
          </button>
        ))}
        <button onClick={load} disabled={loading}
          style={{ padding: "9px 22px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", background: T.blue || T.accent, color: "#fff", border: "none", fontFamily: "inherit", alignSelf: "flex-end", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Loading…" : "Generate Report"}
        </button>
      </div>

      {!data && !loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: T.textSec, fontSize: 14 }}>
          Select a date range and click Generate Report
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
            {card("Box 1: Output VAT (Sales)", data.sales.taxableAmount, data.sales.outputVAT, "#10b981",
              `${data.sales.invoiceCount} invoice(s)`)}
            {card("Box 9+10: Total Input VAT", data.purchases.taxableAmount + (data.purchases.rcmTaxable||0), data.purchases.box11TotalInputVAT ?? data.purchases.inputVAT, "#3b82f6",
              `${data.purchases.billCount} bill(s) · Standard + RCM`)}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${data.netVATPayable >= 0 ? "#ef4444" : "#10b981"}`, borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.textSec, margin: "0 0 10px" }}>Net VAT Payable</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: "0 0 8px" }}>Output VAT + RCM Output − Credit Notes − Input VAT</p>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 800, color: data.netVATPayable >= 0 ? "#ef4444" : "#10b981", margin: 0 }}>
                {data.netVATPayable < 0 ? "−" : ""}{fmt(Math.abs(data.netVATPayable))}
              </p>
              <p style={{ fontSize: 11, color: T.textSec, margin: "6px 0 0" }}>
                {data.netVATPayable >= 0 ? "Amount to pay to FTA" : "Refund claimable from FTA"}
              </p>
            </div>
          </div>

          {/* RCM detail banner — only shown when RCM bills exist */}
          {(data.purchases.rcmTaxable > 0) && (
            <div style={{ background: isDark ? "rgba(139,92,246,0.06)" : "#faf5ff", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Reverse Charge Mechanism (RCM)</p>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 10, color: "#7c3aed", margin: "0 0 2px", opacity: 0.7 }}>Box 3 — RCM Output VAT (self-assessed)</p>
                  <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: "#7c3aed", margin: 0 }}>{fmt(data.purchases.box10RCMOutputVAT ?? 0)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "#7c3aed", margin: "0 0 2px", opacity: 0.7 }}>Box 10 — RCM Input VAT (recoverable)</p>
                  <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: "#7c3aed", margin: 0 }}>{fmt(data.purchases.box10RCMInputVAT ?? 0)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "#7c3aed", margin: "0 0 2px", opacity: 0.7 }}>RCM Taxable Amount</p>
                  <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: "#7c3aed", margin: 0 }}>{fmt(data.purchases.rcmTaxable ?? 0)}</p>
                </div>
                <div style={{ alignSelf: "center" }}>
                  <p style={{ fontSize: 11, color: "#7c3aed", margin: 0, opacity: 0.8 }}>Net RCM impact = 0 (Box 3 − Box 10 cancel out)</p>
                </div>
              </div>
            </div>
          )}

          {/* Credit note adjustment row */}
          {(data.creditNoteAdjustments.vatAdjusted > 0) && (
            <div style={{ background: isDark ? "rgba(245,158,11,0.06)" : "#fffbeb", border: `1px solid rgba(245,158,11,0.25)`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: T.textPri }}>
              ⚠️ Credit note adjustments: <strong>{fmt(data.creditNoteAdjustments.taxableAmount)}</strong> taxable, <strong>{fmt(data.creditNoteAdjustments.vatAdjusted)}</strong> VAT reversed — deducted from output VAT above.
            </div>
          )}

          {/* Per-rate breakdown */}
          {data.rateBreakdown?.length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
                <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: T.textPri, margin: 0 }}>Sales VAT Breakdown by Rate</h2>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                    {["Tax Rate", "Taxable Amount", "VAT Collected"].map(h => (
                      <th key={h} style={{ padding: "10px 20px", textAlign: h === "Tax Rate" ? "left" : "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.textSec, borderBottom: `1px solid ${T.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rateBreakdown.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "12px 20px", fontWeight: 600 }}>{r.rate}%</td>
                      <td style={{ padding: "12px 20px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{fmt(r.taxable)}</td>
                      <td style={{ padding: "12px 20px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: "#10b981", fontWeight: 600 }}>{fmt(r.vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Filing summary box */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 24px" }}>
            <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: T.textPri, margin: "0 0 16px" }}>VAT 201 Filing Summary</h2>
            {[
              { label: "1.  Standard Rated Supplies",          taxable: data.sales.taxableAmount,                                                                              vat: data.sales.outputVAT },
              { label: "1b. Credit Note Adjustments (−)",      taxable: -(data.creditNoteAdjustments.taxableAmount||0),                                                       vat: -(data.creditNoteAdjustments.vatAdjusted||0) },
              { label: "3.  Supplies under RCM (Output)",      taxable: data.purchases.rcmTaxable ?? 0,                                                                        vat: data.purchases.box10RCMOutputVAT ?? 0, rcm: true },
              { label: "   Total Output VAT",                  taxable: (data.sales.taxableAmount||0) - (data.creditNoteAdjustments.taxableAmount||0) + (data.purchases.rcmTaxable||0),  vat: (data.sales.outputVAT||0) - (data.creditNoteAdjustments.vatAdjusted||0) + (data.purchases.box10RCMOutputVAT||0), bold: true },
              { label: "9.  Standard Rated Expenses",          taxable: data.purchases.taxableAmount,                                                                          vat: data.purchases.box9InputVAT ?? 0 },
              { label: "10. Expenses under RCM (Input)",       taxable: data.purchases.rcmTaxable ?? 0,                                                                        vat: data.purchases.box10RCMInputVAT ?? 0, rcm: true },
              { label: "11. Total Input VAT (Box 9 + 10)",     taxable: (data.purchases.taxableAmount||0) + (data.purchases.rcmTaxable||0),                                   vat: data.purchases.box11TotalInputVAT ?? data.purchases.inputVAT, bold: true },
              { label: "   Net VAT Payable / (Refundable)",    taxable: null,                                                                                                 vat: data.netVATPayable, bold: true, highlight: true },
            ].map((row, i, arr) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "9px 0",
                paddingLeft: row.label.startsWith("   ") ? 16 : 0,
                borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                fontWeight: row.bold ? 700 : 400,
                background: row.highlight ? (isDark ? "rgba(239,68,68,0.06)" : "#fef2f2")
                           : row.rcm     ? (isDark ? "rgba(139,92,246,0.05)" : "#faf5ff")
                           : "transparent",
              }}>
                <span style={{ fontSize: 13, color: row.highlight ? (data.netVATPayable >= 0 ? "#ef4444" : "#10b981") : row.rcm ? "#7c3aed" : T.textPri }}>
                  {row.label.trim()}
                  {row.rcm && <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 6, padding: "1px 5px", borderRadius: 4, background: "rgba(139,92,246,0.12)", color: "#7c3aed" }}>RCM</span>}
                </span>
                <div style={{ display: "flex", gap: 40 }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: T.textSec, minWidth: 160, textAlign: "right" }}>{row.taxable != null ? fmt(row.taxable) : "—"}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: row.highlight ? (data.netVATPayable >= 0 ? "#ef4444" : "#10b981") : row.rcm ? "#7c3aed" : T.textPri, minWidth: 140, textAlign: "right", fontWeight: row.bold ? 700 : 400 }}>{fmt(row.vat)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Transaction detail (FTA Sales / Purchases sheets) ── */}
          {lines && (
            <div style={{ marginTop: 24 }}>
              <div className="vat-noprint" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 6, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4 }}>
                  {[
                    { k: "combined",  label: "Combined" },
                    { k: "sales",     label: `Sales (${lines.sales?.length || 0})` },
                    { k: "purchases", label: `Purchases (${lines.purchases?.length || 0})` },
                    { k: "rcm",       label: `RCM (${lines.rcm?.length || 0})` },
                  ].map(t => (
                    <button key={t.k} onClick={() => setTab(t.k)}
                      style={{ padding: "7px 16px", borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: "none", fontFamily: "inherit",
                        background: tab === t.k ? (T.blue || T.accent) : "transparent",
                        color: tab === t.k ? "#fff" : T.textSec }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {canExport && (
                  <button onClick={exportDetailExcel} style={{ padding: "8px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: "transparent", border: `1.5px solid ${T.border}`, color: T.textPri, fontFamily: "inherit" }}>
                    ⬇ Export Detail Excel
                  </button>
                )}
              </div>

              {(tab === "combined" || tab === "sales") && (
                <LineTable T={T} isDark={isDark} title="VAT on Sales & Other Outputs (Output VAT)" partyLabel="Customer" accent="#10b981"
                  rows={lines.sales} totalAmount={lines.totals?.salesTaxable} totalVAT={lines.totals?.salesVAT} />
              )}
              {(tab === "combined" || tab === "purchases") && (
                <div style={{ marginTop: tab === "combined" ? 20 : 0 }}>
                  <LineTable T={T} isDark={isDark} title="VAT on Expenses & Purchases (Input VAT)" partyLabel="Supplier" accent="#3b82f6"
                    rows={lines.purchases} totalAmount={lines.totals?.purchaseTaxable} totalVAT={lines.totals?.purchaseVAT} />
                </div>
              )}

              {tab === "rcm" && (
                <>
                  <LineTable T={T} isDark={isDark} title="Goods Imported into the UAE (appearing on FTA portal)" partyLabel="Supplier" accent="#7c3aed"
                    rows={(lines.rcm || []).filter(r => r.imported)} />
                  <div style={{ marginTop: 20 }}>
                    <LineTable T={T} isDark={isDark} title="Supplies under Reverse Charge (not appearing on FTA portal)" partyLabel="Supplier" accent="#7c3aed"
                      rows={(lines.rcm || []).filter(r => !r.imported)} />
                  </div>
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: "3px solid #7c3aed", borderRadius: 10, padding: "12px 20px", fontSize: 13 }}>
                      <span style={{ color: T.textSec }}>Total RCM VAT accounted (Box 3 / Box 10): </span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 800, color: "#7c3aed" }}>{fmt(lines.totals?.rcmVAT || 0)}</span>
                    </div>
                  </div>
                </>
              )}

              {tab === "combined" && (
                <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `3px solid ${lines.totals?.netVATPayable >= 0 ? "#ef4444" : "#10b981"}`, borderRadius: 10, padding: "12px 20px", fontSize: 13 }}>
                    <span style={{ color: T.textSec }}>Net VAT (Output − Input): </span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 800, color: lines.totals?.netVATPayable >= 0 ? "#ef4444" : "#10b981" }}>
                      {lines.totals?.netVATPayable < 0 ? "−" : ""}{fmt(Math.abs(lines.totals?.netVATPayable || 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LineTable({ T, isDark, title, partyLabel, accent, rows, totalAmount, totalVAT }) {
  const fmt = (n) => `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const tAmount = totalAmount != null ? totalAmount : (rows || []).reduce((s, r) => s + (r.amount || 0), 0);
  const tVAT    = totalVAT    != null ? totalVAT    : (rows || []).reduce((s, r) => s + (r.vat || 0), 0);
  const cols = ["#", "Tax Invoice / Credit Note No", "Date", "Amount (before VAT)", "VAT Amount", partyLabel, `${partyLabel} TRN`, "Description"];
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${accent}` }}>
        <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: T.textPri, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 860 }}>
          <thead>
            <tr style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
              {cols.map((h, i) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: i === 3 || i === 4 ? "right" : "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.textSec, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(!rows || rows.length === 0) ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: T.textSec }}>No transactions in this period.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: "10px 14px", color: T.textSec }}>{i + 1}</td>
                <td style={{ padding: "10px 14px", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: T.textPri }}>{r.number || "—"}</td>
                <td style={{ padding: "10px 14px", color: T.textSec, whiteSpace: "nowrap" }}>{r.date || "—"}</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace" }}>{fmt(r.amount)}</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: accent, fontWeight: 600 }}>{fmt(r.vat)}</td>
                <td style={{ padding: "10px 14px", color: T.textPri, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.party || "—"}</td>
                <td style={{ padding: "10px 14px", fontFamily: "'DM Mono',monospace", color: T.textSec }}>{r.trn || "—"}</td>
                <td style={{ padding: "10px 14px", color: T.textSec, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description || "—"}</td>
              </tr>
            ))}
          </tbody>
          {rows && rows.length > 0 && (
            <tfoot>
              <tr style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", fontWeight: 700 }}>
                <td colSpan={3} style={{ padding: "11px 14px", color: T.textPri }}>Total</td>
                <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: T.textPri }}>{fmt(tAmount)}</td>
                <td style={{ padding: "11px 14px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: accent }}>{fmt(tVAT)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
