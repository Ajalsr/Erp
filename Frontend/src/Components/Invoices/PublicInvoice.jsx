import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../helper/axiosInstance";

const fmt = (n, cur = "AED") =>
  `${cur} ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};

export default function PublicInvoice() {
  const { token } = useParams();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/api/invoices/public/${token}`)
      .then(r => setInv(r.data?.data || null))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "Inter, sans-serif" }}>
      <p style={{ color: "#64748b" }}>Loading invoice…</p>
    </div>
  );

  if (notFound || !inv) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center", color: "#64748b" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <p style={{ fontSize: 15 }}>Invoice not found or this link has expired.</p>
      </div>
    </div>
  );

  const STATUS_COLOR = {
    paid: "#10b981", partial: "#3b82f6", sent: "#8b5cf6",
    unpaid: "#f59e0b", overdue: "#ef4444", void: "#94a3b8", draft: "#94a3b8",
  };
  const statusColor = STATUS_COLOR[inv.status] || "#64748b";
  const items = inv.lineItems || [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { margin: 0; background: #f1f5f9; font-family: Inter, sans-serif; }
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden !important; }
          .pub-doc, .pub-doc * { visibility: visible !important; }
          .pub-doc { position: fixed !important; top: 0; left: 0; width: 100% !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Top bar */}
      <div className="no-print" style={{ background: "#1e3a5f", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Spifora — Invoice Portal</span>
        <button
          onClick={() => window.print()}
          style={{ padding: "6px 16px", borderRadius: 7, background: "#f59e0b", border: "none", color: "#0a0e1a", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          🖨 Print / PDF
        </button>
      </div>

      <div style={{ maxWidth: 820, margin: "32px auto 60px", padding: "0 16px" }}>
        <div className="pub-doc" style={{ background: "#fff", borderRadius: 4, border: "1px solid #e2e8f0", boxShadow: "0 2px 20px rgba(0,0,0,0.08)", overflow: "hidden" }}>

          {/* Company header */}
          <div style={{ background: "#1e3a5f", padding: "18px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>{inv.from?.name || "Company"}</p>
              {inv.from?.address && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: "3px 0 0" }}>{inv.from.address}</p>}
              {inv.from?.trn && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: "2px 0 0" }}>TRN: {inv.from.trn}</p>}
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 20, background: `${statusColor}22`, border: `1px solid ${statusColor}55`, color: statusColor, fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>
                {inv.status}
              </span>
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: "center", padding: "16px 0 10px", borderBottom: "2px solid #1e3a5f" }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#1e3a5f", margin: 0, letterSpacing: "0.12em", textDecoration: "underline", textUnderlineOffset: 4 }}>INVOICE</p>
          </div>

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ padding: "14px 20px", borderRight: "1px solid #e2e8f0" }}>
              {[
                { label: "Bill To",   value: inv.billTo?.name    || "—" },
                { label: "Address",   value: inv.billTo?.address || "—" },
                { label: "TRN",       value: inv.billTo?.trn     || "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", minWidth: 64, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 11, color: "#0f172a" }}>: {value}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 20px" }}>
              {[
                { label: "Invoice No",  value: inv.invoiceNumber, mono: true },
                { label: "Issue Date",  value: fmtDate(inv.issueDate) },
                { label: "Due Date",    value: fmtDate(inv.dueDate) },
                { label: "Currency",    value: inv.currency || "AED" },
                { label: "Pay Terms",   value: inv.paymentTerms || "—" },
              ].map(({ label, value, mono }) => (
                <div key={label} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", minWidth: 80, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 11, color: "#0f172a", fontFamily: mono ? "monospace" : "inherit" }}>: {value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "1.5px solid #1e3a5f" }}>
                {["#", "Description", "Qty", "Unit Price", "Discount", "Tax", "Total"].map((h, i) => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: i <= 1 ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#1e3a5f", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                  <td style={{ padding: "9px 12px", color: "#94a3b8", fontSize: 11 }}>{idx + 1}</td>
                  <td style={{ padding: "9px 12px", color: "#0f172a" }}>{item.desc}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right" }}>{item.qty}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right" }}>{fmt(item.unitPrice, inv.currency)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", color: "#64748b" }}>{item.discAmt > 0 ? fmt(item.discAmt, inv.currency) : "—"}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", color: "#64748b" }}>{item.taxRate}%</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>{fmt(item.total, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 20px", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ minWidth: 240 }}>
              {[
                { label: "Subtotal",   value: inv.totals?.subtotal },
                { label: "Discount",   value: -inv.totals?.discountTotal },
                { label: "Tax (VAT)",  value: inv.totals?.taxTotal },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  <span>{label}</span><span>{fmt(value || 0, inv.currency)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#0f172a", borderTop: "2px solid #1e3a5f", paddingTop: 8, marginTop: 4 }}>
                <span>Total</span><span>{fmt(inv.totals?.grandTotal, inv.currency)}</span>
              </div>
              {inv.amountPaid > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#10b981", marginTop: 6 }}>
                    <span>Amount Paid</span><span>{fmt(inv.amountPaid, inv.currency)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: inv.balanceDue > 0 ? "#ef4444" : "#10b981", marginTop: 4 }}>
                    <span>Balance Due</span><span>{fmt(inv.balanceDue, inv.currency)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {inv.notes?.customer && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</p>
              <p style={{ fontSize: 12, color: "#334155", margin: 0, lineHeight: 1.6 }}>{inv.notes.customer}</p>
            </div>
          )}

          {/* Footer */}
          <div style={{ background: "#1e3a5f", padding: "8px 20px", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>Thank you for your business</span>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.55)" }}>{inv.invoiceNumber}</span>
          </div>
        </div>
      </div>
    </>
  );
}
