import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { FaPrint, FaFileDownload, FaSpinner } from "react-icons/fa";
import api from "../../helper/axiosInstance";

// Embeds the same server-rendered PDF (letterhead, watermark, everything) that
// the in-app Print/Preview page uses, via the public/token-keyed PDF route —
// so the emailed "View Invoice" link always matches Print/Preview exactly,
// with zero separately-maintained layout to drift out of sync.
export default function PublicInvoice() {
  const { token } = useParams();

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState("");
  const [notFound, setNotFound] = useState(false);
  const iframeRef = useRef(null);

  // Invoice meta — used for the download filename and a clean not-found state.
  useEffect(() => {
    api.get(`/api/invoices/public/${token}`)
      .then(r => setInv(r.data?.data || null))
      .catch(() => setNotFound(true));
  }, [token]);

  // Fetch the PDF once and hold a blob URL for the iframe / download / print.
  useEffect(() => {
    let url = "";
    let cancelled = false;
    setLoading(true);
    api.get(`/api/invoices/public/${token}/pdf`, { responseType: "blob" })
      .then(res => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        setPdfUrl(url);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [token]);

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `invoice-${inv?.invoiceNumber || token}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const printPdf = () => {
    const win = iframeRef.current?.contentWindow;
    if (win) { try { win.focus(); win.print(); return; } catch { /* fall through */ } }
    if (pdfUrl) window.open(pdfUrl);
  };

  const center = { minHeight: "calc(100vh - 46px)", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" };

  if (notFound) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "Inter, sans-serif" }}>
      <div style={{ textAlign: "center", color: "#64748b" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <p style={{ fontSize: 15 }}>Invoice not found or this link has expired.</p>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f1f5f9", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Top bar */}
      <div style={{ flexShrink: 0, background: "#1e3a5f", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Spifora — Invoice Portal</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={downloadPdf} disabled={!pdfUrl} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "#f59e0b", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#0a0e1a", cursor: pdfUrl ? "pointer" : "not-allowed", opacity: pdfUrl ? 1 : 0.6 }}>
            <FaFileDownload size={11} /> Download
          </button>
          <button onClick={printPdf} disabled={!pdfUrl} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#1e3a5f", cursor: pdfUrl ? "pointer" : "not-allowed", opacity: pdfUrl ? 1 : 0.6 }}>
            <FaPrint size={11} /> Print
          </button>
        </div>
      </div>

      {/* PDF preview */}
      {loading ? (
        <div style={center}><FaSpinner style={{ animation: "spin 0.8s linear infinite", fontSize: 22, color: "#1e3a5f" }} /></div>
      ) : (
        <iframe ref={iframeRef} src={pdfUrl} title="Invoice PDF" style={{ flex: 1, width: "100%", border: "none" }} />
      )}
    </div>
  );
}
