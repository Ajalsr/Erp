import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaPrint, FaFileDownload, FaSpinner } from 'react-icons/fa';
import api from '../../helper/axiosInstance';
import { usePermissions } from '../../helper/permissions';

/**
 * Generic PDF print/preview page. The on-screen preview embeds the same
 * server-generated PDF that Print/Save use, so preview matches print exactly
 * (server owns pagination + watermark).
 *
 * Props:
 *   apiBase   - REST base, e.g. 'purchase-orders' → /api/purchase-orders/:id/{preview,pdf}
 *   module    - permission module key, e.g. 'purchase_orders' (gates download via `export`)
 *   backPath  - route to return to
 *   title     - label for the tab/PDF, e.g. 'Purchase Order'
 *   filePrefix- download filename prefix, e.g. 'po'
 *   numberField - field on the doc holding its human number, e.g. 'orderNumber'
 */
export default function DocPrint({ apiBase, module, backPath, title, filePrefix, numberField }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canExport = can(module, 'export');

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState('');
  const iframeRef = useRef(null);

  // Doc meta — used for the download filename and a clean not-found state.
  useEffect(() => {
    api.get(`/api/${apiBase}/${id}`)
      .then(r => setDoc(r.data?.data || r.data || null))
      .catch(() => setDoc(null));
  }, [apiBase, id]);

  // Fetch the PDF once and hold a blob URL for the iframe / download / print.
  useEffect(() => {
    let url = '';
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get(`/api/${apiBase}/${id}/preview`, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        setPdfUrl(url);
      })
      .catch(e => { if (!cancelled) setError(e?.response?.status ? `Error ${e.response.status}` : (e?.message || 'Failed to load PDF')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [apiBase, id]);

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${filePrefix}-${doc?.[numberField] || id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const printPdf = () => {
    const win = iframeRef.current?.contentWindow;
    if (win) { try { win.focus(); win.print(); return; } catch { /* fall through */ } }
    if (pdfUrl) window.open(pdfUrl);
  };

  const center = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Top bar */}
      <div style={{ flexShrink: 0, background: '#1e3a5f', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => navigate(backPath)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
          <FaChevronLeft size={10} /> Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {canExport && (
            <button onClick={downloadPdf} disabled={!pdfUrl} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#f59e0b', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#0a0e1a', cursor: pdfUrl ? 'pointer' : 'not-allowed', opacity: pdfUrl ? 1 : 0.6 }}>
              <FaFileDownload size={11} /> Save as PDF
            </button>
          )}
          <button onClick={printPdf} disabled={!pdfUrl} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1e3a5f', cursor: pdfUrl ? 'pointer' : 'not-allowed', opacity: pdfUrl ? 1 : 0.6 }}>
            <FaPrint size={11} /> Print
          </button>
        </div>
      </div>

      {/* PDF preview */}
      {loading ? (
        <div style={center}><FaSpinner style={{ animation: 'spin 0.8s linear infinite', fontSize: 22, color: '#1e3a5f' }} /></div>
      ) : error ? (
        <div style={{ ...center, color: '#64748b', flexDirection: 'column', gap: 8 }}>
          <span>Could not load the {title} PDF ({error}).</span>
        </div>
      ) : (
        <iframe ref={iframeRef} src={pdfUrl} title={`${title} PDF`} style={{ flex: 1, width: '100%', border: 'none' }} />
      )}
    </div>
  );
}
