import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaPrint, FaFileDownload, FaTruck, FaBoxOpen,
  FaChevronLeft, FaCheckCircle, FaFileInvoiceDollar,
  FaPaperPlane, FaSpinner, FaArrowLeft, FaEraser, FaSave,
  FaTimes, FaBuilding, FaEnvelope, FaPhone,
  FaEye, FaMapMarkerAlt, FaBox, FaClipboardList,
} from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useAuthStore from '../../store/useAuthStore';
import api from '../../helper/axiosInstance';

const today = () =>
  new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META = {
  draft:      { color: '#f59e0b', dim: 'rgba(245,158,11,.12)',  label: 'Draft'      },
  confirmed:  { color: '#3b82f6', dim: 'rgba(59,130,246,.12)',  label: 'Confirmed'  },
  dispatched: { color: '#8b5cf6', dim: 'rgba(139,92,246,.12)',  label: 'Dispatched' },
  delivered:  { color: '#10b981', dim: 'rgba(16,185,129,.12)',  label: 'Delivered'  },
};
const STATUS_STEPS = ['draft', 'confirmed', 'dispatched', 'delivered'];

const pageCss = (isDark) => `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700;800&display=swap');
  .dn-root * { box-sizing: border-box; }
  .dn-root { font-family: 'DM Sans', sans-serif; }
  html,body,* { scrollbar-width:thin; scrollbar-color:${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'} transparent }
  *::-webkit-scrollbar { width:5px } *::-webkit-scrollbar-thumb { background:${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}; border-radius:99px }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .dn-spin { animation: spin 0.8s linear infinite; }
  .dn-doc  { animation: fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both; }
  .dn-btn  { transition: all 0.15s; cursor: pointer; }
  .dn-btn:hover:not(:disabled) { filter: brightness(${isDark ? '1.1' : '0.92'}); transform: translateY(-1px); }
  .dn-btn:disabled { opacity: 0.45; cursor: not-allowed !important; }
  .sora { font-family: 'Sora', sans-serif; }
  .mono { font-family: 'DM Mono', monospace; }
  .dn-toast {
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
    background: #0f172a; color: #fff; padding: 10px 22px; border-radius: 12px;
    font-size: 13px; font-weight: 600; z-index: 9999; white-space: nowrap;
    animation: fadeUp 0.25s ease both; box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    display: flex; align-items: center; gap: 8px;
  }
  @page { margin: 0; }
  @media print {
    body * { visibility: hidden !important; }
    .dn-doc, .dn-doc * { visibility: visible !important; }
    .dn-doc {
      position: fixed !important; top: 0 !important; left: 0 !important;
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

// ── Signature pad ──────────────────────────────────────────────
function SignaturePad({ storageKey }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const [hasSig, setHasSig] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    const data = localStorage.getItem(storageKey);
    if (data && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        canvasRef.current.getContext('2d').drawImage(img, 0, 0);
        setHasSig(true); setSaved(true);
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
    drawing.current = true; setSaved(false);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.stroke(); setHasSig(true);
  };
  const stop = () => { drawing.current = false; };
  const clear = () => {
    canvasRef.current.getContext('2d').clearRect(0, 0, 280, 80);
    setHasSig(false); setSaved(false);
    if (storageKey) localStorage.removeItem(storageKey);
  };
  const save = () => {
    if (!hasSig || !storageKey) return;
    localStorage.setItem(storageKey, canvasRef.current.toDataURL()); setSaved(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <canvas ref={canvasRef} width={280} height={80}
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

// ── Main component ─────────────────────────────────────────────
export default function DeliveryNote() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);
  const activeOrg = useAuthStore((s) => s.activeOrg);

  const cardRef = useRef(null);

  const [note,             setNote]             = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [notFound,         setNotFound]         = useState(false);
  const [letterhead,       setLetterhead]       = useState('');
  const [letterheadTopPct, setLetterheadTopPct] = useState(13);
  const [letterheadBotPct, setLetterheadBotPct] = useState(8);
  const [topPadPx,         setTopPadPx]         = useState(0);
  const [botPadPx,         setBotPadPx]         = useState(0);
  const [sendLoading,      setSendLoading]      = useState(false);
  const [confirmLoading,   setConfirmLoading]   = useState(false);
  const [deliverLoading,   setDeliverLoading]   = useState(false);
  const [deliverConfirm,   setDeliverConfirm]   = useState(false);
  const [toast,            setToast]            = useState(null);
  const [printPreview,     setPrintPreview]     = useState(false);
  const [mounted,          setMounted]          = useState(false);

  useEffect(() => setMounted(true), []);

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

  // Reset printPreview after printing
  useEffect(() => {
    const handler = () => setPrintPreview(false);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  const showToast = useCallback((msg, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3000);
  }, []);

  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <FaSpinner size={22} style={{ color: T.blue, animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (notFound || !note) return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
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

  const items       = note.items || [];
  const sm          = STATUS_META[note.status] || { color: '#64748b', dim: 'rgba(100,116,139,.12)', label: note.status || 'Unknown' };
  const isDispatched = note.status === 'dispatched';
  const isDelivered  = note.status === 'delivered';
  const stepIdx      = STATUS_STEPS.indexOf(note.status);

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
      if (note.status === 'draft') {
        await api.patch(`/api/delivery-notes/${note._id}/status`, { status: 'confirmed' });
      }
      await api.patch(`/api/delivery-notes/${note._id}/status`, { status: 'dispatched' });
      setNote((p) => ({ ...p, status: 'dispatched' }));
      showToast('Dispatch confirmed — stock updated!', '✅');
    } catch { showToast('Failed to confirm dispatch.', '❌'); }
    finally { setConfirmLoading(false); }
  };

  const handleMarkDelivered = async () => {
    setDeliverConfirm(false);
    setDeliverLoading(true);
    try {
      await api.patch(`/api/delivery-notes/${note._id}/status`, { status: 'delivered' });
      setNote((p) => ({ ...p, status: 'delivered', deliveredAt: new Date().toISOString() }));
      showToast('Marked as delivered!', '✅');
    } catch { showToast('Failed to update status.', '❌'); }
    finally { setDeliverLoading(false); }
  };

  const handleCreateInvoice = () => {
    navigate('/Sales/Createinvoices', {
      state: {
        fromDeliveryNote: true,
        prefill: {
          dnId: note._id, customer: note.customerName, customerId: note.customerId,
          orderNumber: note.orderNumber, dnNumber: note.dnNumber, date: note.date,
          salesOrderIds: note.salesOrderIds || [], items,
        },
      },
    });
  };

  // ── Document field data ────────────────────────────────────────
  const addrParts = [note.customerAddress].filter(Boolean);
  const leftFields = [
    { label: 'To',            value: note.customerName  || '—' },
    { label: 'Customer Code', value: note.customerCode  || '—' },
    ...(addrParts.length ? [{ label: 'Address', value: addrParts.join(', ') }] : []),
    { label: 'Tel',           value: note.customerPhone || '—' },
    { label: 'Email',         value: note.customerEmail || '—' },
  ];
  const rightFields = [
    { label: 'Delivery Note No',  value: note.dnNumber,                 mono: true  },
    { label: 'Delivery Dt',       value: note.date || today(),          mono: false },
    { label: 'Cust PO No',        value: note.custPoNo        || '—',   mono: true  },
    { label: 'Cust PO Dt',        value: note.custPoDate      || '—',   mono: false },
    { label: 'Sales Emp',         value: note.salesperson     || '—',   mono: false },
    { label: 'Sale Order Ref.',   value: note.orderNumber     || '—',   mono: true  },
    { label: 'Delivery Location', value: note.deliveryLocation || '—',  mono: false },
  ];

  // ── Shared action buttons ─────────────────────────────────────
  const WorkflowBtns = () => (
    <>
      {!isDispatched && !isDelivered && (
        <button className="dn-btn" onClick={handleConfirmDispatch} disabled={confirmLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: confirmLoading ? 'not-allowed' : 'pointer' }}>
          {confirmLoading ? <><FaSpinner size={11} className="dn-spin" /> Confirming…</> : <><FaTruck size={11} /> Confirm Dispatch</>}
        </button>
      )}
      {isDispatched && !isDelivered && (
        <button className="dn-btn" onClick={() => setDeliverConfirm(true)} disabled={deliverLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: deliverLoading ? 'not-allowed' : 'pointer' }}>
          {deliverLoading ? <><FaSpinner size={11} className="dn-spin" /> Updating…</> : <><FaCheckCircle size={11} /> Mark Delivered</>}
        </button>
      )}
      {note.invoiceId ? (
        <button className="dn-btn" onClick={() => navigate('/Sales/Invoices', { state: { openInvoiceId: note.invoiceId } })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#10b981', cursor: 'pointer' }}>
          <FaCheckCircle size={11} /> Invoiced: {note.invoiceNumber} →
        </button>
      ) : (isDispatched || isDelivered) ? (
        <button className="dn-btn" onClick={handleCreateInvoice}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
          <FaFileInvoiceDollar size={11} /> Create Invoice
        </button>
      ) : (
        <button disabled title="Confirm dispatch first to create an invoice"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: T.textSec, cursor: 'not-allowed', opacity: 0.5 }}>
          <FaFileInvoiceDollar size={11} /> Create Invoice
        </button>
      )}
    </>
  );

  // ── Print document (always in DOM) ────────────────────────────
  const PrintDocument = ({ inFlow }) => (
    <div ref={inFlow ? cardRef : null}
      className="dn-doc"
      style={{
        background: '#fff', color: '#0f172a',
        border: '1px solid #e2e8f0',
        borderRadius: inFlow ? 6 : 4,
        boxShadow: inFlow ? '0 2px 28px rgba(0,0,0,0.12)' : '0 2px 20px rgba(0,0,0,0.1)',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}>

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

        <div style={{ textAlign: 'center', padding: '16px 0 10px', borderBottom: '2px solid #1e3a5f' }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f', margin: 0, letterSpacing: '0.12em', textDecoration: 'underline', textUnderlineOffset: 4 }}>DELIVERY NOTE</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ padding: '14px 20px', borderRight: '1px solid #e2e8f0' }}>
            {leftFields.map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', minWidth: 96, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 11, color: '#0f172a' }}>: {value}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 20px' }}>
            {rightFields.map(({ label, value, mono }) => (
              <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', minWidth: 112, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 11, color: '#0f172a', fontFamily: mono ? 'monospace' : 'inherit' }}>: {value}</span>
              </div>
            ))}
          </div>
        </div>

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
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#334155', fontWeight: 600 }}>{item.itemCode || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#0f172a', lineHeight: 1.5 }}>{item.name}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{item.outboundQuantity}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{item.unit || 'Nos'}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
              <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                {[...Array(5)].map((__, j) => <td key={j} style={{ padding: '10px 12px' }}>&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <p style={{ fontSize: 10, fontStyle: 'italic', color: '#475569', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
            I, the undersigned hereby acknowledge that I have received and inspected the goods as described in this delivery note. I hereby confirm to have received the quantity as mentioned in this delivery note.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
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

        <div style={{ padding: '12px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', paddingTop: 1 }}>Notes:</span>
            <p style={{ fontSize: 11, color: '#334155', margin: 0, lineHeight: 1.6, flex: 1, minHeight: 32 }}>{note.note || ''}</p>
          </div>
        </div>

        {!letterhead && (
          <div style={{ padding: '8px 20px', background: '#1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Generated: {today()} · Nexus ERP</span>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{note.dnNumber}</span>
          </div>
        )}

      </div>
    </div>
  );

  return (
    <>
      <style>{pageCss(isDark)}</style>
      {toast && <div className="dn-toast"><span>{toast.icon}</span><span>{toast.msg}</span></div>}

      {deliverConfirm && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ background: isDark ? '#1e2433' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`, borderRadius: 16, padding: '32px 28px', width: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaCheckCircle size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>Confirm Delivery</div>
            </div>
            <div style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 24, lineHeight: 1.7, paddingLeft: 46 }}>
              Mark <strong style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}>{note.dnNumber}</strong> as delivered?<br />
              This cannot be undone and will finalize the delivery.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeliverConfirm(false)}
                style={{ padding: '9px 20px', borderRadius: 9, border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'}`, background: 'transparent', color: isDark ? '#cbd5e1' : '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleMarkDelivered}
                style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>
                Yes, Mark Delivered
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className={`dn-root${mounted ? ' dn-mounted' : ''}`}
        style={{ minHeight: 'calc(100vh - 56px)', background: T.bg, color: T.textPri }}>

        {/* ── Hidden doc for direct printing from normal view ── */}
        {!printPreview && (
          <div aria-hidden="true"
            style={{ position: 'fixed', left: '-200vw', top: 0, width: 860, zIndex: -1, pointerEvents: 'none' }}>
            <div ref={cardRef} className="dn-doc"
              style={{ background: '#fff', color: '#0f172a', fontFamily: 'Inter, sans-serif', overflow: 'hidden', position: 'relative' }}>
              {/* minimal re-render — same content as PrintDocument without inFlow styles */}
              <PrintDocument inFlow={false} />
            </div>
          </div>
        )}

        {printPreview ? (
          /* ══ PRINT PREVIEW MODE ═══════════════════════════════ */
          <>
            {/* Preview banner */}
            <div className="dn-no-print" style={{
              position: 'sticky', top: 0, zIndex: 50,
              background: isDark ? 'rgba(15,23,42,0.98)' : 'rgba(30,58,95,0.98)',
              backdropFilter: 'blur(10px)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              padding: '10px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaEye size={12} style={{ color: '#94a3b8' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>Print Preview</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: 0 }}>Review document before printing or saving as PDF</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="dn-btn" onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: '#3b82f6', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  <FaPrint size={11} /> Print
                </button>
                <button className="dn-btn" onClick={() => { showToast('Choose "Save as PDF" in the print dialog', '📄'); setTimeout(() => window.print(), 350); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  <FaFileDownload size={11} /> Save as PDF
                </button>
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
                <button className="dn-btn" onClick={() => setPrintPreview(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  <FaTimes size={11} /> Close Preview
                </button>
              </div>
            </div>

            {/* Document in flow */}
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 56px' }}>
              <PrintDocument inFlow={true} />
            </div>
          </>

        ) : (
          /* ══ NORMAL ERP VIEW ══════════════════════════════════ */
          <>
            {/* Sticky header */}
            <div className="dn-no-print" style={{
              position: 'sticky', top: 0, zIndex: 40,
              background: isDark ? 'rgba(8,13,26,0.94)' : 'rgba(255,255,255,0.94)',
              backdropFilter: 'blur(14px)',
              borderBottom: `1px solid ${T.border}`,
              padding: '10px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="dn-btn" onClick={() => navigate('/Sales/Deliverynote')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec, cursor: 'pointer' }}>
                  <FaChevronLeft size={10} /> Back
                </button>
                <div style={{ width: 1, height: 20, background: T.border }} />
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16,185,129,.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaTruck size={13} />
                </div>
                <span className="sora" style={{ fontSize: 14, fontWeight: 700, color: T.textPri }}>Delivery Note</span>
                <span className="mono" style={{ fontSize: 12, color: T.blue, background: 'rgba(59,130,246,.08)', padding: '2px 9px', borderRadius: 5, border: '1px solid rgba(59,130,246,.15)' }}>
                  {note.dnNumber}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: sm.dim, color: sm.color, textTransform: 'capitalize', border: `1px solid ${sm.color}33` }}>
                  {sm.label}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="dn-btn" onClick={handleSend} disabled={sendLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec }}>
                  {sendLoading ? <><FaSpinner size={11} className="dn-spin" /> Sending…</> : <><FaPaperPlane size={11} /> Send</>}
                </button>
                <button className="dn-btn" onClick={() => setPrintPreview(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec }}>
                  <FaEye size={11} /> Preview
                </button>
                <button className="dn-btn" onClick={() => { showToast('Choose "Save as PDF" in print dialog', '📄'); setTimeout(() => window.print(), 300); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec }}>
                  <FaFileDownload size={11} /> PDF
                </button>
                <button className="dn-btn" onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.blue, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff' }}>
                  <FaPrint size={11} /> Print
                </button>
                <div style={{ width: 1, height: 20, background: T.border }} />
                <WorkflowBtns />
              </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 56px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Status progress */}
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: '16px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {STATUS_STEPS.map((step, i) => {
                    const s = STATUS_META[step];
                    const done = i <= stepIdx;
                    const active = i === stepIdx;
                    const isLast = i === STATUS_STEPS.length - 1;
                    return (
                      <div key={step} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: done ? s.color : T.surface2,
                            border: `2px solid ${done ? s.color : T.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: active ? `0 0 0 4px ${s.dim}` : 'none',
                            transition: 'all .2s',
                          }}>
                            {done && <FaCheckCircle size={12} style={{ color: '#fff' }} />}
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, color: done ? s.color : T.textSec, whiteSpace: 'nowrap', letterSpacing: '.02em', textTransform: 'capitalize' }}>
                            {step}
                          </span>
                        </div>
                        {!isLast && (
                          <div style={{
                            flex: 1, height: 2, margin: '0 4px', marginBottom: 16,
                            background: i < stepIdx
                              ? `linear-gradient(90deg, ${STATUS_META[STATUS_STEPS[i]].color}, ${STATUS_META[STATUS_STEPS[i+1]].color})`
                              : T.border,
                            borderRadius: 2, transition: 'background .3s',
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Customer card */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(59,130,246,.1)', color: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaBuilding size={12} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.07em' }}>Customer</span>
                  </div>
                  <p className="sora" style={{ fontSize: 16, fontWeight: 700, color: T.textPri, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                    {note.customerName || '—'}
                  </p>
                  {note.customerCode && (
                    <span className="mono" style={{ fontSize: 11, color: T.blue, background: 'rgba(59,130,246,.08)', padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(59,130,246,.15)', display: 'inline-block', marginBottom: 12 }}>
                      {note.customerCode}
                    </span>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {note.customerAddress && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <FaMapMarkerAlt size={11} style={{ color: T.textSec, marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: T.textSec, lineHeight: 1.5 }}>{note.customerAddress}</span>
                      </div>
                    )}
                    {note.customerPhone && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <FaPhone size={10} style={{ color: T.textSec, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: T.textSec }}>{note.customerPhone}</span>
                      </div>
                    )}
                    {note.customerEmail && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <FaEnvelope size={10} style={{ color: T.textSec, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: T.textSec }}>{note.customerEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery details card */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(16,185,129,.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaClipboardList size={12} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.07em' }}>Delivery Details</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {[
                      { label: 'Delivery Date',    value: fmtDate(note.date),                 mono: false },
                      { label: 'Location',         value: note.deliveryLocation || '—',       mono: false },
                      { label: 'Sales Order',      value: note.orderNumber || '—',            mono: true  },
                      { label: 'Cust PO No.',      value: note.custPoNo || '—',               mono: true  },
                      { label: 'Cust PO Date',     value: fmtDate(note.custPoDate) || '—',   mono: false },
                      { label: 'Salesperson',      value: note.salesperson || '—',            mono: false },
                    ].map(({ label, value, mono }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11.5, color: T.textSec, fontWeight: 500, flexShrink: 0 }}>{label}</span>
                        <span style={{ fontSize: 12.5, color: T.textPri, fontWeight: 600, fontFamily: mono ? '"DM Mono", monospace' : 'inherit', textAlign: 'right' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Items card */}
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(139,92,246,.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaBox size={11} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>Delivery Items</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', background: 'rgba(139,92,246,.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(139,92,246,.2)' }}>
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(255,255,255,.03)' : '#f8fafc', borderBottom: `1px solid ${T.border}` }}>
                      {[
                        { h: '#',           align: 'center', w: '5%'  },
                        { h: 'Part Number', align: 'left',   w: '18%' },
                        { h: 'Description', align: 'left',   w: ''    },
                        { h: 'Qty',         align: 'center', w: '10%' },
                        { h: 'Unit',        align: 'center', w: '10%' },
                      ].map(({ h, align, w }) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: align, fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.07em', width: w || undefined }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.itemId || idx} style={{ borderBottom: `1px solid ${T.border2 || T.border}` }}>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: T.textSec, fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="mono" style={{ fontSize: 11.5, color: T.blue, background: 'rgba(59,130,246,.07)', padding: '2px 7px', borderRadius: 4 }}>
                            {item.itemCode || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: T.textPri, fontWeight: 500 }}>{item.name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: T.textPri }}>{item.outboundQuantity}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: T.textSec, fontSize: 12 }}>{item.unit || 'Nos'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              {note.note && (
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: '18px 22px' }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.07em', margin: '0 0 10px' }}>Notes</p>
                  <p style={{ fontSize: 13, color: T.textPri, margin: 0, lineHeight: 1.7 }}>{note.note}</p>
                </div>
              )}

              {/* Bottom nav */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <button className="dn-btn" onClick={() => navigate('/Sales/Deliverynote')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: T.textSec, cursor: 'pointer' }}>
                  <FaArrowLeft size={11} /> All Delivery Notes
                </button>
                {note.invoiceId ? (
                  <button className="dn-btn" onClick={() => navigate('/Sales/Invoices', { state: { openInvoiceId: note.invoiceId } })}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 22px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#10b981', cursor: 'pointer' }}>
                    <FaCheckCircle size={13} /> Invoice {note.invoiceNumber} →
                  </button>
                ) : (isDispatched || isDelivered) ? (
                  <button className="dn-btn" onClick={handleCreateInvoice}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 22px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
                    <FaFileInvoiceDollar size={13} /> Create Invoice →
                  </button>
                ) : (
                  <div title="Confirm dispatch first to create an invoice"
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 22px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: T.textSec, opacity: 0.55 }}>
                    <FaFileInvoiceDollar size={13} /> Create Invoice — confirm dispatch first
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </>
  );
}
