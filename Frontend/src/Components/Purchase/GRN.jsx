import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  FaPrint, FaFileDownload, FaBoxOpen,
  FaChevronLeft, FaCheckCircle, FaFileInvoiceDollar,
  FaPaperPlane, FaSpinner, FaArrowLeft,
  FaTimes, FaBuilding, FaEye, FaBox,
  FaClipboardCheck, FaWarehouse, FaHashtag,
} from 'react-icons/fa';
import { MdMoveToInbox } from 'react-icons/md';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import api from '../../helper/axiosInstance';

// ── helpers ───────────────────────────────────────────────────────
const round2   = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const TAX_RATE = 0.05;
const fmtAED   = (n) =>
  `AED ${parseFloat(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () =>
  new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const buildTaxGroups = (items) => {
  const order = {}, groups = {};
  items.forEach((item, idx) => {
    const price = parseFloat(item.costPrice || item.rate || 0);
    const qty   = item.receiveQty || 0;
    if (!price || !qty) return;
    const key = String(price);
    if (!groups[key]) { groups[key] = { rate: price, base: 0 }; order[key] = idx; }
    groups[key].base = round2(groups[key].base + qty * price);
  });
  return Object.keys(groups).sort((a, b) => order[a] - order[b]).map(key => ({
    rate:       groups[key].rate,
    baseAmount: round2(groups[key].base),
    taxAmount:  round2(groups[key].base * TAX_RATE),
  }));
};

// ── status meta ───────────────────────────────────────────────────
const GRN_META = {
  received:  { color: '#10b981', dim: 'rgba(16,185,129,.12)', label: 'Received'  },
  inspected: { color: '#10b981', dim: 'rgba(16,185,129,.12)', label: 'Inspected' },
  stocked:   { color: '#8b5cf6', dim: 'rgba(139,92,246,.12)', label: 'Stocked'   },
  invoiced:  { color: '#3b82f6', dim: 'rgba(59,130,246,.12)', label: 'Invoiced'  },
};
const GRN_STEPS = ['received', 'inspected', 'stocked', 'invoiced'];

// ── page CSS (mirrors Deliverynote pageCss exactly) ───────────────
const pageCss = (isDark) => `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700;800&display=swap');
  .grn-root * { box-sizing: border-box; }
  .grn-root { font-family: 'DM Sans', sans-serif; }
  html,body,* { scrollbar-width:thin; scrollbar-color:${isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'} transparent }
  *::-webkit-scrollbar { width:5px } *::-webkit-scrollbar-thumb { background:${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}; border-radius:99px }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .grn-spin { animation: spin 0.8s linear infinite; }
  .grn-doc  { animation: fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both; }
  .grn-btn  { transition: all 0.15s; cursor: pointer; }
  .grn-btn:hover:not(:disabled) { filter: brightness(${isDark ? '1.1' : '0.92'}); transform: translateY(-1px); }
  .grn-btn:disabled { opacity: 0.45; cursor: not-allowed !important; }
  .sora { font-family: 'Sora', sans-serif; }
  .mono { font-family: 'DM Mono', monospace; }
  .grn-toast {
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
    background: #0f172a; color: #fff; padding: 10px 22px; border-radius: 12px;
    font-size: 13px; font-weight: 600; z-index: 9999; white-space: nowrap;
    animation: fadeUp 0.25s ease both; box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    display: flex; align-items: center; gap: 8px;
  }
  .grn-row { transition: background .1s; }
  .grn-row:hover td { background: ${isDark ? 'rgba(255,255,255,.025)' : 'rgba(37,99,235,.018)'} !important; }
  @page { margin: 0; }
  @media print {
    body * { visibility: hidden !important; }
    .grn-doc, .grn-doc * { visibility: visible !important; }
    .grn-doc {
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 100% !important; height: auto !important;
      margin: 0 !important; padding: 0 !important;
      border: none !important; border-radius: 0 !important;
      box-shadow: none !important; animation: none !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .grn-no-print { display: none !important; }
  }
`;

// ── Print document ─────────────────────────────────────────────
function PrintDocument({ grn, inboundData, items, subTotal, taxGroups, totalTax, grandTotal, grnNote, inFlow }) {
  return (
    <div className="grn-doc" style={{
      background: '#fff', color: '#0f172a',
      border: '1px solid #e2e8f0',
      borderRadius: inFlow ? 6 : 4,
      boxShadow: inFlow ? '0 2px 28px rgba(0,0,0,0.12)' : '0 2px 20px rgba(0,0,0,0.1)',
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Company header */}
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

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '16px 0 10px', borderBottom: '2px solid #1e3a5f' }}>
        <p style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f', margin: 0, letterSpacing: '0.12em', textDecoration: 'underline', textUnderlineOffset: 4 }}>GOODS RECEIPT NOTE</p>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ padding: '14px 20px', borderRight: '1px solid #e2e8f0' }}>
          {[
            { label: 'Vendor',  value: grn.vendor || '—' },
            { label: 'Address', value: 'Dubai, United Arab Emirates' },
            { label: 'PO No',   value: grn.poNumber || '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', minWidth: 60, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 11, color: '#0f172a' }}>: {value}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 20px' }}>
          {[
            { label: 'GRN Number',       value: grn.number,                                   mono: true  },
            { label: 'Receipt Date',      value: grn.date || today(),                          mono: false },
            { label: 'Purchase Order',    value: grn.poNumber || '—',                          mono: true  },
            { label: 'Requires Approval', value: inboundData.requiresApproval ? 'Yes' : 'No', mono: false },
          ].map(({ label, value, mono }) => (
            <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', minWidth: 112, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 11, color: '#0f172a', fontFamily: mono ? 'monospace' : 'inherit' }}>: {value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #1e3a5f' }}>
            {[
              { label: 'Sl.No',       w: '5%',  align: 'center' },
              { label: 'Part Number', w: '14%', align: 'left'   },
              { label: 'Description', w: '31%', align: 'left'   },
              { label: 'Ordered',     w: '9%',  align: 'center' },
              { label: 'Received',    w: '9%',  align: 'center' },
              { label: 'Unit',        w: '7%',  align: 'center' },
              { label: 'Unit Cost',   w: '12%', align: 'right'  },
              { label: 'VAT 5%',      w: '10%', align: 'right'  },
              { label: 'Line Total',  w: '13%', align: 'right'  },
            ].map(({ label, w, align }) => (
              <th key={label} style={{ padding: '9px 10px', textAlign: align, fontSize: 10, fontWeight: 700, color: '#1e3a5f', letterSpacing: '0.04em', width: w }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const unitCost  = parseFloat(item.costPrice || item.rate || 0);
            const qty       = item.receiveQty || 0;
            const lineBase  = round2(unitCost * qty);
            const lineVat   = round2(lineBase * TAX_RATE);
            const lineTotal = round2(lineBase + lineVat);
            return (
              <tr key={item._id || idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>{idx + 1}</td>
                <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 10, color: '#334155', fontWeight: 600 }}>{item.item_code || '—'}</td>
                <td style={{ padding: '9px 10px', color: '#0f172a', lineHeight: 1.4, fontSize: 11 }}>{item.name}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>{item.orderedQty || 0}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: '#0f172a', fontSize: 11 }}>{qty}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b', fontSize: 11 }}>{item.unit || 'Pcs'}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{fmtAED(unitCost)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: '#b45309' }}>{fmtAED(lineVat)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: '#1d4ed8' }}>{fmtAED(lineTotal)}</td>
              </tr>
            );
          })}
          {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
            <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
              {[...Array(9)].map((__, j) => <td key={j} style={{ padding: '9px 10px' }}>&nbsp;</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Subtotal (excl. VAT)</span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmtAED(subTotal)}</span>
          </div>
          {taxGroups.map((g, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>VAT 5% on {fmtAED(g.baseAmount)}</span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#b45309' }}>{fmtAED(g.taxAmount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '10px 12px', background: '#eff6ff', borderRadius: 6, border: '1.5px solid #bfdbfe' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Grand Total (incl. VAT)</span>
            <span style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: '#1d4ed8' }}>{fmtAED(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {(grnNote || inboundData.requiresApproval) && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
          {grnNote && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', paddingTop: 1 }}>Notes:</span>
              <p style={{ fontSize: 11, color: '#334155', margin: 0, lineHeight: 1.6, flex: 1 }}>{grnNote}</p>
            </div>
          )}
          {inboundData.requiresApproval && (
            <p style={{ fontSize: 11, color: '#92400e', margin: grnNote ? '8px 0 0' : 0 }}>⚠️ Requires manager approval before stocking.</p>
          )}
        </div>
      )}

      {/* Signature footer */}
      <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        {['Received By', 'Inspected By', 'Authorized By'].map((label) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ height: 1, background: '#e2e8f0', marginBottom: 8 }} />
            <p style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 0 0' }}>Signature & Date</p>
          </div>
        ))}
      </div>

      {/* Doc footer */}
      <div style={{ padding: '8px 20px', background: '#1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Generated: {today()} · Nexus ERP</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{grn.number}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function GRN() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);

  const isNew = !id || id === 'new';

  const [loading,        setLoading]        = useState(true);
  const [notFound,       setNotFound]       = useState(false);
  const [grnData,        setGrnData]        = useState(null);
  const [inboundData,    setInboundData]    = useState(null);
  const [sendLoading,    setSendLoading]    = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmed,      setConfirmed]      = useState(false);
  const [toast,          setToast]          = useState(null);
  const [printPreview,   setPrintPreview]   = useState(false);
  const [savedGRN,       setSavedGRN]       = useState(null);
  const [mounted,        setMounted]        = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = () => setPrintPreview(false);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  // Load data — from state (new creation) or API (existing GRN)
  useEffect(() => {
    if (isNew) {
      const { inboundData: si, grn: sg } = location.state || {};
      if (sg && si) { setGrnData(sg); setInboundData(si); }
      else setNotFound(true);
      setLoading(false);
      return;
    }
    api.get(`/api/grns/${id}`)
      .then((r) => {
        const d = r.data?.data;
        if (!d) { setNotFound(true); return; }
        setGrnData({
          number:   d.grnNumber,
          date:     d.receiptDate
            ? new Date(d.receiptDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : today(),
          vendor:   d.vendorName,
          poNumber: d.poNumber,
          status:   d.status || 'confirmed',
        });
        setInboundData({
          items: (d.items || []).map((i) => ({
            itemId:     i.itemId,
            name:       i.details || i.name || '',
            item_code:  i.itemCode,
            orderedQty: i.orderedQty,
            receiveQty: i.receivedQty,
            unit:       i.unit,
            costPrice:  i.rate,
          })),
          note:             d.notes || '',
          requiresApproval: d.requiresApproval || false,
          vendorId:         d.vendorId || '',
        });
        if (['confirmed', 'stocked', 'invoiced'].includes(d.status)) {
          setConfirmed(true);
          setSavedGRN({ id: d._id || d.id, grnNumber: d.grnNumber, total: d.total || 0 });
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <FaSpinner size={22} style={{ color: T.blue, animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (notFound || !grnData || !inboundData) return (
    <div style={{ minHeight: 'calc(100vh - 56px)', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ textAlign: 'center', color: T.textSec }}>
        <FaBoxOpen size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p style={{ fontSize: 14 }}>No GRN data found.</p>
        <button onClick={() => navigate('/Purchase/GRN')}
          style={{ marginTop: 12, padding: '8px 18px', background: T.blue, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          View All GRNs
        </button>
      </div>
    </div>
  );

  // Alias for rest of component
  const grn = grnData;

  const items      = inboundData.items || [];
  const grnNote    = inboundData.note || '';
  const subTotal   = round2(items.reduce((s, i) => s + (i.receiveQty || 0) * parseFloat(i.costPrice || 0), 0));
  const taxGroups  = buildTaxGroups(items);
  const totalTax   = round2(taxGroups.reduce((s, g) => s + g.taxAmount, 0));
  const grandTotal = round2(subTotal + totalTax);

  const stepIdx = savedGRN ? 3 : confirmed ? 2 : 1;
  const sm = confirmed
    ? { color: '#10b981', dim: 'rgba(16,185,129,.12)', label: 'Confirmed' }
    : { color: '#f59e0b', dim: 'rgba(245,158,11,.12)', label: 'Pending'   };

  const showToast = (msg, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSend = async () => {
    setSendLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      showToast(`GRN sent to ${grn.vendor || 'vendor'}`, '📧');
    } catch { showToast('Failed to send.', '❌'); }
    finally { setSendLoading(false); }
  };

  const handleConfirm = async () => {
    setConfirmLoading(true);
    try {
      if (!isNew) {
        // GRN already saved as pending — PATCH status to confirmed, then update stock
        await api.patch(`/api/grns/${id}`, { status: 'confirmed' });
        await Promise.allSettled(
          items.filter((i) => i.itemId && (i.receiveQty || 0) > 0)
            .map((i) => api.patch(`/api/stocks/${i.itemId}/increase`, { increaseBy: i.receiveQty }))
        );
        setSavedGRN({ id, grnNumber: grn.number, total: grandTotal });
        setConfirmed(true);
        showToast(`Receipt confirmed! GRN ${grn.number} updated.`, '✅');
      } else {
        // Legacy new-from-state path (fallback)
        const grnPayload = {
          grnNumber:        grn.number,
          purchaseOrderId:  items[0]?.poId || '',
          poNumber:         grn.poNumber || '',
          vendorId:         inboundData.vendorId || '',
          vendorName:       grn.vendor || '',
          receiptDate:      new Date().toISOString(),
          notes:            grnNote,
          requiresApproval: inboundData.requiresApproval || false,
          status:           'confirmed',
          items: items.map((i) => ({
            itemId:      i.itemId || '',
            details:     i.name || '',
            itemCode:    i.item_code || '',
            orderedQty:  i.orderedQty || 0,
            receivedQty: i.receiveQty || 0,
            unit:        i.unit || 'Pcs',
            rate:        parseFloat(i.costPrice || 0),
          })),
        };
        const res = await api.post('/api/grns/', grnPayload);
        const saved = res.data?.data || {};
        const savedId = saved._id || saved.id;
        setSavedGRN({ id: savedId, grnNumber: saved.grnNumber || grn.number, total: saved.total || grandTotal });
        await Promise.allSettled(
          items.filter((i) => i.itemId && (i.receiveQty || 0) > 0)
            .map((i) => api.patch(`/api/stocks/${i.itemId}/increase`, { increaseBy: i.receiveQty }))
        );
        setConfirmed(true);
        showToast(`Receipt confirmed! GRN ${saved.grnNumber || grn.number} saved.`, '✅');
        if (savedId) setTimeout(() => navigate(`/Purchase/GRN/${savedId}`, { replace: true }), 1200);
      }
    } catch (err) {
      console.error('GRN confirm error:', err);
      showToast('Failed to confirm receipt. Please try again.', '❌');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCreateBill = () => {
    navigate('/Purchase/Bills/New', {
      state: {
        fromGRN: true,
        grnId:      savedGRN?.id || '',
        grnNumber:  savedGRN?.grnNumber || grn.number,
        poNumber:   grn.poNumber || '',
        vendorId:   inboundData.vendorId || '',
        vendorName: grn.vendor || '',
        total:      savedGRN?.total || grandTotal,
        items: items.map((i) => ({
          description:  i.name,
          qty:          i.receiveQty || 0,
          unitPrice:    parseFloat(i.costPrice || 0),
          taxRate:      5,
          discount:     i.discount || 0,
          discountType: i.discountType || 'fixed',
        })),
      },
    });
  };

  const docProps = { grn, inboundData, items, subTotal, taxGroups, totalTax, grandTotal, grnNote };

  return (
    <>
      <style>{pageCss(isDark)}</style>
      {toast && <div className="grn-toast"><span>{toast.icon}</span><span>{toast.msg}</span></div>}

      <div className={`grn-root${mounted ? ' grn-mounted' : ''}`}
        style={{ minHeight: 'calc(100vh - 56px)', background: T.bg, color: T.textPri }}>

        {/* Hidden doc for direct print from normal view */}
        {!printPreview && (
          <div aria-hidden="true"
            style={{ position: 'fixed', left: '-200vw', top: 0, width: 920, zIndex: -1, pointerEvents: 'none' }}>
            <PrintDocument {...docProps} inFlow={false} />
          </div>
        )}

        {printPreview ? (
          /* ══ PRINT PREVIEW MODE ══════════════════════════════ */
          <>
            <div className="grn-no-print" style={{
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
                <button className="grn-btn" onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: '#3b82f6', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  <FaPrint size={11} /> Print
                </button>
                <button className="grn-btn" onClick={() => { showToast('Choose "Save as PDF" in the print dialog', '📄'); setTimeout(() => window.print(), 350); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff' }}>
                  <FaFileDownload size={11} /> Save as PDF
                </button>
                <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
                <button className="grn-btn" onClick={() => setPrintPreview(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  <FaTimes size={11} /> Close Preview
                </button>
              </div>
            </div>

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 56px' }}>
              <PrintDocument {...docProps} inFlow={true} />
            </div>
          </>

        ) : (
          /* ══ NORMAL ERP VIEW ═════════════════════════════════ */
          <>
            {/* Sticky header — mirrors Deliverynote exactly */}
            <div className="grn-no-print" style={{
              position: 'sticky', top: 0, zIndex: 40,
              background: isDark ? 'rgba(8,13,26,0.94)' : 'rgba(255,255,255,0.94)',
              backdropFilter: 'blur(14px)',
              borderBottom: `1px solid ${T.border}`,
              padding: '10px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="grn-btn" onClick={() => navigate('/Purchase/GRN')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec }}>
                  <FaChevronLeft size={10} /> Back
                </button>
                <div style={{ width: 1, height: 20, background: T.border }} />
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16,185,129,.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FaWarehouse size={13} />
                </div>
                <span className="sora" style={{ fontSize: 14, fontWeight: 700, color: T.textPri }}>Goods Receipt Note</span>
                <span className="mono" style={{ fontSize: 12, color: T.blue, background: 'rgba(59,130,246,.08)', padding: '2px 9px', borderRadius: 5, border: '1px solid rgba(59,130,246,.15)' }}>
                  {grn.number}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: sm.dim, color: sm.color, border: `1px solid ${sm.color}33` }}>
                  {sm.label}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="grn-btn" onClick={handleSend} disabled={sendLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec }}>
                  {sendLoading ? <><FaSpinner size={11} className="grn-spin" /> Sending…</> : <><FaPaperPlane size={11} /> Send</>}
                </button>
                <button className="grn-btn" onClick={() => setPrintPreview(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec }}>
                  <FaEye size={11} /> Preview
                </button>
                <button className="grn-btn" onClick={() => { showToast('Choose "Save as PDF" in print dialog', '📄'); setTimeout(() => window.print(), 300); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.textSec }}>
                  <FaFileDownload size={11} /> PDF
                </button>
                <button className="grn-btn" onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: T.blue, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff' }}>
                  <FaPrint size={11} /> Print
                </button>
                <div style={{ width: 1, height: 20, background: T.border }} />
                <button className="grn-btn" onClick={handleConfirm} disabled={confirmLoading || confirmed}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px',
                    background: confirmed ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg,#10b981,#059669)',
                    border: confirmed ? '1px solid rgba(16,185,129,0.3)' : 'none',
                    borderRadius: 8, fontSize: 12, fontWeight: 700,
                    color: confirmed ? '#10b981' : '#fff',
                    boxShadow: confirmed ? 'none' : '0 4px 14px rgba(16,185,129,.3)',
                  }}>
                  {confirmLoading ? <><FaSpinner size={11} className="grn-spin" /> Confirming…</>
                    : confirmed ? <><FaCheckCircle size={11} /> Confirmed</>
                    : <><FaWarehouse size={11} /> Confirm Receipt</>}
                </button>
                {confirmed && (
                  <button className="grn-btn" onClick={handleCreateBill}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', boxShadow: '0 4px 14px rgba(59,130,246,.3)' }}>
                    <FaFileInvoiceDollar size={11} /> Create Bill
                  </button>
                )}
              </div>
            </div>

            {/* Content — mirrors Deliverynote layout */}
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 56px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Status progress — identical to Deliverynote */}
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: '16px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {GRN_STEPS.map((step, i) => {
                    const s    = GRN_META[step];
                    const done = i <= stepIdx;
                    const active = i === stepIdx;
                    const isLast = i === GRN_STEPS.length - 1;
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
                            {s.label}
                          </span>
                        </div>
                        {!isLast && (
                          <div style={{
                            flex: 1, height: 2, margin: '0 4px', marginBottom: 16,
                            background: i < stepIdx
                              ? `linear-gradient(90deg,${GRN_META[GRN_STEPS[i]].color},${GRN_META[GRN_STEPS[i+1]].color})`
                              : T.border,
                            borderRadius: 2, transition: 'background .3s',
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2-col info grid — identical card structure to Deliverynote */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Vendor card (mirrors Customer card) */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(59,130,246,.1)', color: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaBuilding size={12} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.07em' }}>Vendor</span>
                  </div>
                  <p className="sora" style={{ fontSize: 16, fontWeight: 700, color: T.textPri, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                    {grn.vendor || '—'}
                  </p>
                  {grn.poNumber && (
                    <span className="mono" style={{ fontSize: 11, color: T.blue, background: 'rgba(59,130,246,.08)', padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(59,130,246,.15)', display: 'inline-block', marginBottom: 12 }}>
                      PO: {grn.poNumber}
                    </span>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <FaHashtag size={10} style={{ color: T.textSec, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: T.textSec }}>Dubai, United Arab Emirates</span>
                    </div>
                    {inboundData.requiresApproval && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>
                        ⚠️ Requires Approval
                      </div>
                    )}
                  </div>
                </div>

                {/* Receipt details card (mirrors Delivery Details card) */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(16,185,129,.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaClipboardCheck size={12} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.07em' }}>Receipt Details</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {[
                      { label: 'GRN Number',       value: grn.number,                                   mono: true  },
                      { label: 'Receipt Date',      value: grn.date || today(),                          mono: false },
                      { label: 'Purchase Order',    value: grn.poNumber || '—',                          mono: true  },
                      { label: 'Requires Approval', value: inboundData.requiresApproval ? 'Yes' : 'No', mono: false },
                    ].map(({ label, value, mono }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11.5, color: T.textSec, fontWeight: 500, flexShrink: 0 }}>{label}</span>
                        <span style={{ fontSize: 12.5, color: T.textPri, fontWeight: 600, fontFamily: mono ? '"DM Mono",monospace' : 'inherit', textAlign: 'right' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Items table card — same card as Deliverynote, more columns */}
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(139,92,246,.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaBox size={11} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>Items Received</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', background: 'rgba(139,92,246,.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(139,92,246,.2)' }}>
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(255,255,255,.03)' : '#f8fafc', borderBottom: `1px solid ${T.border}` }}>
                      {[
                        { h: '#',           align: 'left',   w: '4%'  },
                        { h: 'Item',        align: 'left',   w: ''    },
                        { h: 'SKU',         align: 'left',   w: '11%' },
                        { h: 'Ordered',     align: 'center', w: '8%'  },
                        { h: 'Received',    align: 'center', w: '9%'  },
                        { h: 'Unit',        align: 'center', w: '7%'  },
                        { h: 'Unit Cost',   align: 'right',  w: '12%' },
                        { h: 'VAT 5%',      align: 'right',  w: '10%' },
                        { h: 'Line Total',  align: 'right',  w: '13%' },
                      ].map(({ h, align, w }) => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: align, fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap', width: w || undefined }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const unitCost  = parseFloat(item.costPrice || item.rate || 0);
                      const qty       = item.receiveQty || 0;
                      const lineBase  = round2(unitCost * qty);
                      const lineVat   = round2(lineBase * TAX_RATE);
                      const lineTotal = round2(lineBase + lineVat);
                      return (
                        <tr key={item._id || idx} className="grn-row" style={{ borderBottom: `1px solid ${T.border2 || T.border}` }}>
                          <td style={{ padding: '12px 14px', color: T.textSec, fontSize: 12 }}>{idx + 1}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.name}</p>
                            {item.unit && <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>per {item.unit}</p>}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span className="mono" style={{ fontSize: 11, color: T.blue, background: 'rgba(59,130,246,.07)', padding: '2px 7px', borderRadius: 4 }}>
                              {item.item_code || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: T.textSec }}>{item.orderedQty || 0}</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{qty}</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: T.textSec, fontSize: 12 }}>{item.unit || 'Pcs'}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: T.textPri }}>{fmtAED(unitCost)}</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{fmtAED(lineVat)}</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: T.blue }}>{fmtAED(lineTotal)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals card (GRN-specific, not in Deliverynote) */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: '20px 22px', width: 380 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 12.5, color: T.textSec, fontWeight: 500 }}>Subtotal (excl. VAT)</span>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{fmtAED(subTotal)}</span>
                  </div>

                  {taxGroups.length > 0 && (
                    <div style={{ padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
                      {taxGroups.map((g, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < taxGroups.length - 1 ? 6 : 0 }}>
                          <span style={{ fontSize: 11.5, color: T.textSec }}>VAT 5% on {fmtAED(g.baseAmount)}</span>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{fmtAED(g.taxAmount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '14px 16px', background: isDark ? 'rgba(59,130,246,.08)' : '#eff6ff', border: `1.5px solid ${isDark ? 'rgba(59,130,246,.2)' : '#bfdbfe'}`, borderRadius: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.textPri }}>Grand Total (incl. VAT)</span>
                    <span className="mono" style={{ fontSize: 20, fontWeight: 900, color: T.blue }}>{fmtAED(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Notes card — identical to Deliverynote */}
              {grnNote && (
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 13, padding: '18px 22px' }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.07em', margin: '0 0 10px' }}>Notes</p>
                  <p style={{ fontSize: 13, color: T.textPri, margin: 0, lineHeight: 1.7 }}>{grnNote}</p>
                </div>
              )}

              {inboundData.requiresApproval && (
                <div style={{ background: isDark ? 'rgba(245,158,11,.06)' : '#fffbeb', border: `1px solid ${isDark ? 'rgba(245,158,11,.2)' : '#fde68a'}`, borderRadius: 13, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <p style={{ fontSize: 13, color: isDark ? '#fbbf24' : '#92400e', margin: 0, fontWeight: 500 }}>
                    This goods receipt requires manager approval before stocking.
                  </p>
                </div>
              )}

              {/* Bottom nav — identical to Deliverynote */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <button className="grn-btn" onClick={() => navigate('/Purchase/GRN')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: T.textSec, cursor: 'pointer' }}>
                  <FaArrowLeft size={11} /> Back to GRN List
                </button>
                {confirmed && (
                  <button className="grn-btn" onClick={handleCreateBill}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 22px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,.3)' }}>
                    <FaFileInvoiceDollar size={13} /> Create Bill →
                  </button>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </>
  );
}
