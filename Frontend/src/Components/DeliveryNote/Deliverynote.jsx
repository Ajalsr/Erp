import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaPrint, FaFileDownload, FaTruck, FaBoxOpen,
  FaChevronLeft, FaCheckCircle, FaFileInvoiceDollar,
  FaPaperPlane, FaSpinner, FaArrowLeft, FaEraser, FaSave,
} from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useAuthStore from '../../store/useAuthStore';
import api from '../../helper/axiosInstance';

const today = () =>
  new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const docCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  .dn-spin { animation: spin 0.8s linear infinite; }
  .dn-doc  { animation: fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both; }
  .dn-btn  { transition: all 0.15s; }
  .dn-btn:hover:not(:disabled) { filter: brightness(0.9); transform: translateY(-1px); }
  .dn-btn:disabled { opacity: 0.45; cursor: not-allowed !important; }
  .dn-toast {
    position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
    background:#0f172a; color:#fff; padding:10px 22px; border-radius:12px;
    font-size:13px; font-weight:600; z-index:9999; white-space:nowrap;
    animation:fadeUp 0.25s ease both; box-shadow:0 8px 32px rgba(0,0,0,0.35);
    display:flex; align-items:center; gap:8px;
  }
  /* Remove browser print headers/footers (URL, date, page number) */
  @page { margin: 0; }
  /* Print: show only the document, hide everything else */
  @media print {
    /* Hide the entire page then reveal just the doc */
    body * { visibility: hidden !important; }
    .dn-doc, .dn-doc * { visibility: visible !important; }
    .dn-doc {
      position: fixed !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important; height: auto !important;
      margin: 0 !important; padding: 0 !important;
      border: none !important; border-radius: 0 !important;
      box-shadow: none !important; animation: none !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .dn-no-print { display: none !important; }
    .sig-controls { display: none !important; }
  }
`;

// ── Signature pad ─────────────────────────────────────────────────
function SignaturePad({ storageKey }) {
  const canvasRef  = useRef(null);
  const drawing    = useRef(false);
  const [hasSig,   setHasSig]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  // Load saved signature from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;
    const data = localStorage.getItem(storageKey);
    if (data && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        canvasRef.current.getContext('2d').drawImage(img, 0, 0);
        setHasSig(true);
        setSaved(true);
      };
      img.src = data;
    }
  }, [storageKey]);

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const start = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath(); ctx.moveTo(x, y);
    drawing.current = true;
    setSaved(false);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.stroke();
    setHasSig(true);
  };

  const stop = () => { drawing.current = false; };

  const clear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSig(false); setSaved(false);
    if (storageKey) localStorage.removeItem(storageKey);
  };

  const save = () => {
    if (!hasSig || !storageKey) return;
    localStorage.setItem(storageKey, canvasRef.current.toDataURL());
    setSaved(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <canvas
        ref={canvasRef}
        width={280} height={80}
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        style={{ border: '1px solid #94a3b8', borderRadius: 4, cursor: 'crosshair', background: '#fff', touchAction: 'none', display: 'block' }}
      />
      <div className="sig-controls" style={{ display: 'flex', gap: 6 }}>
        <button onClick={clear} disabled={!hasSig}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 5, background: '#f8fafc', color: '#64748b', cursor: hasSig ? 'pointer' : 'not-allowed', opacity: hasSig ? 1 : 0.4 }}>
          <FaEraser size={9} /> Clear
        </button>
        <button onClick={save} disabled={!hasSig || saved}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 5, background: hasSig && !saved ? '#3b82f6' : '#e2e8f0', color: hasSig && !saved ? '#fff' : '#94a3b8', cursor: hasSig && !saved ? 'pointer' : 'not-allowed' }}>
          <FaSave size={9} /> {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function DeliveryNote() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const isDark   = useThemeStore((s) => s.isDark);
  const T        = getTheme(isDark);
  const activeOrg = useAuthStore((s) => s.activeOrg);

  const cardRef = useRef(null);

  const [note,           setNote]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [notFound,       setNotFound]       = useState(false);
  const [letterhead,       setLetterhead]       = useState('');
  const [letterheadTopPct, setLetterheadTopPct] = useState(13); // % of letterhead height
  const [letterheadBotPct, setLetterheadBotPct] = useState(8);
  const [topPadPx,         setTopPadPx]         = useState(0);  // computed from image
  const [botPadPx,         setBotPadPx]         = useState(0);
  const [sendLoading,      setSendLoading]      = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [toast,          setToast]          = useState(null);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    api.get(`/api/delivery-notes/${id}`)
      .then((r) => setNote(r.data?.data || null))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const orgId = activeOrg?._id;
    if (!orgId) return;
    api.get(`/api/organizations/${orgId}`)
      .then((r) => {
        const d = r.data?.data || {};
        setLetterhead(d.letterheadImage || '');
        setLetterheadTopPct(d.letterheadTopPad || 13);
        setLetterheadBotPct(d.letterheadBottomPad || 8);
      })
      .catch(() => {});
  }, [activeOrg]);

  // Compute pixel padding from % of letterhead's rendered height
  useEffect(() => {
    if (!letterhead) { setTopPadPx(0); setBotPadPx(0); return; }
    const img = new Image();
    img.onload = () => {
      const cardWidth = cardRef.current?.offsetWidth || 820;
      const renderedH = cardWidth * (img.naturalHeight / img.naturalWidth);
      setTopPadPx(Math.round(renderedH * letterheadTopPct / 100));
      setBotPadPx(Math.round(renderedH * letterheadBotPct / 100));
    };
    img.src = letterhead;
  }, [letterhead, letterheadTopPct, letterheadBotPct]);

  const showToast = useCallback((msg, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3000);
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <FaSpinner size={22} style={{ color: T.blue, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (notFound || !note) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', color: T.textSec }}>
        <FaBoxOpen size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p style={{ fontSize: 14 }}>Delivery note not found.</p>
        <button onClick={() => navigate('/Sales/Deliverynote')}
          style={{ marginTop: 12, padding: '8px 18px', background: T.blue, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Back to List
        </button>
      </div>
    </div>
  );

  const items = note.items || [];
  const isDispatched = note.status === 'dispatched';
  const isDelivered  = note.status === 'delivered';

  const handleSend = async () => {
    setSendLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      showToast(`Sent to ${note.customerName || 'customer'}`, '📧');
    } catch { showToast('Failed to send.', '❌'); }
    finally { setSendLoading(false); }
  };

  const handleConfirmDispatch = async () => {
    setConfirmLoading(true);
    try {
      await Promise.allSettled(
        items.filter((i) => i.itemId && i.outboundQuantity > 0)
          .map((i) => api.patch(`/api/stocks/${i.itemId}/reduce`, { reduceBy: i.outboundQuantity }))
      );
      const soIds = [...new Set(items.map((i) => i.salesOrderId).filter(Boolean))];
      await Promise.allSettled(soIds.map((sid) => api.patch(`/api/sales-orders/${sid}/status`, { status: 'completed' })));
      await api.patch(`/api/delivery-notes/${note._id}/status`, { status: 'dispatched' });
      setNote((p) => ({ ...p, status: 'dispatched' }));
      showToast('Dispatch confirmed — stock updated!', '✅');
    } catch { showToast('Failed to confirm dispatch.', '❌'); }
    finally { setConfirmLoading(false); }
  };

  const handleMarkDelivered = async () => {
    try {
      await api.patch(`/api/delivery-notes/${note._id}/status`, { status: 'delivered' });
      setNote((p) => ({ ...p, status: 'delivered' }));
      showToast('Marked as delivered!', '✅');
    } catch { showToast('Failed to update status.', '❌'); }
  };

  const handleCreateInvoice = () => {
    navigate('/Sales/Createinvoices', {
      state: {
        fromDeliveryNote: true,
        prefill: {
          dnId:         note._id,
          customer:     note.customerName,
          customerId:   note.customerId,
          orderNumber:  note.orderNumber,
          dnNumber:     note.dnNumber,
          date:         note.date,
          salesOrderIds: note.salesOrderIds || [],
          items,
        },
      },
    });
  };

  const statusColor = {
    draft:      '#f59e0b',
    confirmed:  '#3b82f6',
    dispatched: '#8b5cf6',
    delivered:  '#10b981',
  }[note.status] || '#64748b';

  // ── Document field rows ───────────────────────────────────────────
  const addrParts = [note.customerAddress].filter(Boolean);
  const leftFields = [
    { label: 'To',            value: note.customerName  || '—' },
    { label: 'Customer Code', value: note.customerCode  || '—' },
    ...(addrParts.length ? [{ label: 'Address', value: addrParts.join(', ') }] : []),
    { label: 'Tel',           value: note.customerPhone || '—' },
    { label: 'Email',         value: note.customerEmail || '—' },
  ];
  const rightFields = [
    { label: 'Delivery Note No',  value: note.dnNumber,                mono: true  },
    { label: 'Delivery Dt',       value: note.date || today(),         mono: false },
    { label: 'Cust PO No',        value: note.custPoNo        || '—',  mono: true  },
    { label: 'Cust PO Dt',        value: note.custPoDate      || '—',  mono: false },
    { label: 'Sales Emp',         value: note.salesperson     || '—',  mono: false },
    { label: 'Sale Order Ref.',   value: note.orderNumber     || '—',  mono: true  },
    { label: 'Delivery Location', value: note.deliveryLocation || '—', mono: false },
  ];

  return (
    <>
      <style>{docCSS}</style>
      {toast && <div className="dn-toast"><span>{toast.icon}</span><span>{toast.msg}</span></div>}

      <div className="dn-page" style={{ minHeight: '100vh', background: T.bg, color: T.textPri, fontFamily: 'Inter, sans-serif' }}>

        {/* ── STICKY ACTION BAR ─────────────────────────────── */}
        <div className="dn-no-print" style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: isDark ? 'rgba(8,13,26,0.94)' : 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${T.border}`,
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
        }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="dn-btn" onClick={() => navigate('/Sales/Deliverynote')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec, cursor: 'pointer' }}>
              <FaChevronLeft size={10} /> Back
            </button>
            <div style={{ width: 1, height: 20, background: T.border }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>Delivery Note</span>
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: T.blueLight, background: T.blueDim, padding: '2px 8px', borderRadius: 5 }}>{note.dnNumber}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: `${statusColor}18`, color: statusColor, textTransform: 'capitalize', border: `1px solid ${statusColor}33` }}>
              {note.status}
            </span>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="dn-btn" onClick={handleSend} disabled={sendLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec, cursor: 'pointer' }}>
              {sendLoading ? <><FaSpinner size={11} className="dn-spin" /> Sending…</> : <><FaPaperPlane size={11} /> Send</>}
            </button>
            <button className="dn-btn" onClick={() => { showToast('Opening print dialog — choose "Save as PDF"', '📄'); setTimeout(() => window.print(), 400); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec, cursor: 'pointer' }}>
              <FaFileDownload size={11} /> PDF
            </button>
            <button className="dn-btn" onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.blue, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              <FaPrint size={11} /> Print
            </button>

            <div style={{ width: 1, height: 20, background: T.border }} />

            {!isDispatched && !isDelivered && (
              <button className="dn-btn" onClick={handleConfirmDispatch} disabled={confirmLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: confirmLoading ? 'not-allowed' : 'pointer' }}>
                {confirmLoading ? <><FaSpinner size={11} className="dn-spin" /> Confirming…</> : <><FaTruck size={11} /> Confirm Dispatch</>}
              </button>
            )}
            {isDispatched && !isDelivered && (
              <button className="dn-btn" onClick={handleMarkDelivered}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                <FaCheckCircle size={11} /> Mark Delivered
              </button>
            )}
            {note.invoiceId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                <FaCheckCircle size={11} /> Invoiced: {note.invoiceNumber}
              </div>
            ) : (
              <button className="dn-btn" onClick={handleCreateInvoice}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                <FaFileInvoiceDollar size={11} /> Create Invoice
              </button>
            )}
          </div>
        </div>

        {/* ── DOCUMENT ──────────────────────────────────────── */}
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 56px' }}>
          <div ref={cardRef} className="dn-doc" style={{
            background: '#fff', color: '#0f172a',
            border: '1px solid #e2e8f0',
            borderRadius: 4,
            boxShadow: isDark ? '0 4px 32px rgba(0,0,0,0.5)' : '0 2px 20px rgba(0,0,0,0.1)',
            fontFamily: 'Inter, sans-serif',
            overflow: 'hidden',
            position: 'relative',
          }}>

            {/* ── All content above the letterhead ── */}
            <div style={{
              position: 'relative', zIndex: 1,
              ...(letterhead ? {
                backgroundImage: `url(${letterhead})`,
                backgroundSize: '100% auto',
                backgroundPosition: 'top center',
                backgroundRepeat: 'no-repeat',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
                paddingTop: topPadPx,
                paddingBottom: botPadPx,
              } : {}),
            }}>

            {/* ── Company Header (only when no letterhead) ── */}
            {!letterhead && (
              <div style={{ background: '#1e3a5f', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', fontWeight: 900 }}>N</div>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>Nexus ERP</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '2px 0 0' }}>Dubai, United Arab Emirates · P.O.Box: 00000</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: '0 0 2px' }}>Tel: 04-0000000</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: 0 }}>info@nexuserp.com</p>
                </div>
              </div>
            )}

            {/* ── Document Title ── */}
            <div style={{ textAlign: 'center', padding: '16px 0 10px', borderBottom: '2px solid #1e3a5f' }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f', margin: 0, letterSpacing: '0.12em', textDecoration: 'underline', textUnderlineOffset: 4 }}>DELIVERY NOTE</p>
            </div>

            {/* ── Info Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
              {/* Left — Customer */}
              <div style={{ padding: '14px 20px', borderRight: '1px solid #e2e8f0' }}>
                {leftFields.map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', minWidth: 96, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 11, color: '#0f172a' }}>: {value}</span>
                  </div>
                ))}
              </div>
              {/* Right — DN details */}
              <div style={{ padding: '14px 20px' }}>
                {rightFields.map(({ label, value, mono, cap }) => (
                  <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', minWidth: 112, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 11, color: '#0f172a', fontFamily: mono ? 'monospace' : 'inherit', textTransform: cap ? 'capitalize' : 'none' }}>: {value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Items Table ── */}
            <div style={{ padding: '0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #1e3a5f' }}>
                    {[
                      { label: 'Sl.No',       w: '6%',  align: 'center' },
                      { label: 'Part Number', w: '18%', align: 'left'   },
                      { label: 'Description', w: '56%', align: 'left'   },
                      { label: 'Qty',         w: '10%', align: 'center' },
                      { label: 'Unit',        w: '10%', align: 'center' },
                    ].map(({ label, w, align }) => (
                      <th key={label} style={{ padding: '9px 12px', textAlign: align, fontSize: 11, fontWeight: 700, color: '#1e3a5f', letterSpacing: '0.04em', width: w }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.itemId || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>{idx + 1}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#334155', fontWeight: 600 }}>
                        {item.itemCode || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#0f172a', lineHeight: 1.5 }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                        {item.outboundQuantity}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>
                        {item.unit || 'Nos'}
                      </td>
                    </tr>
                  ))}
                  {/* Empty rows to pad to at least 5 rows for print aesthetics */}
                  {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      {[...Array(5)].map((__, j) => (
                        <td key={j} style={{ padding: '10px 12px', fontSize: 11 }}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Acknowledgment ── */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <p style={{ fontSize: 10, fontStyle: 'italic', color: '#475569', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                I, the undersigned hereby acknowledge that I have received and inspected the goods as described in this delivery note. I hereby confirm to have received the quantity as mentioned in this delivery note.
              </p>
            </div>

            {/* ── Signature Section ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
              {/* Receiver */}
              <div style={{ padding: '16px 20px', borderRight: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Receivers Sign &amp; Stamp</p>
                <SignaturePad storageKey={`dn_sig_receiver_${note._id}`} />
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {['Receivers Name', 'Designation', 'Date', 'Phone Number'].map((label) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', minWidth: 90 }}>{label}:</span>
                      <div style={{ flex: 1, borderBottom: '1px solid #94a3b8' }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* DO Prepared By */}
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>DO Prepared By</p>
                  <SignaturePad storageKey={`dn_sig_prepared_${note._id}`} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Delivered By &amp; Date</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {['Name', 'Date'].map((label) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', minWidth: 36 }}>{label}:</span>
                        <div style={{ flex: 1, borderBottom: '1px solid #94a3b8' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Notes ── */}
            <div style={{ padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', paddingTop: 1 }}>Notes:</span>
                <p style={{ fontSize: 11, color: '#334155', margin: 0, lineHeight: 1.6, flex: 1, minHeight: 32 }}>{note.note || ''}</p>
              </div>
            </div>

            {/* ── Document Footer (only without letterhead — letterhead has its own footer) ── */}
            {!letterhead && (
              <div style={{ padding: '8px 20px', background: '#1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Generated: {today()} · Nexus ERP</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{note.dnNumber}</span>
              </div>
            )}

            </div>{/* end content wrapper */}
          </div>{/* end document card */}

          {/* Bottom nav */}
          <div className="dn-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <button className="dn-btn" onClick={() => navigate('/Sales/Deliverynote')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: T.textSec, cursor: 'pointer' }}>
              <FaArrowLeft size={11} /> All Delivery Notes
            </button>
            {note.invoiceId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 22px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                <FaCheckCircle size={13} /> Invoice {note.invoiceNumber}
              </div>
            ) : (
              <button className="dn-btn" onClick={handleCreateInvoice}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 22px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
                <FaFileInvoiceDollar size={13} /> Create Invoice →
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
