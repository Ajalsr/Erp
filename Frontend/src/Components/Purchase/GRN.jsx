import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FaPrint, FaTimes, FaFileDownload,
  FaBoxOpen, FaChevronLeft, FaCheckCircle,
  FaHashtag, FaBuilding, FaClipboardCheck,
  FaPaperPlane, FaSpinner, FaWarehouse,
  FaFileInvoiceDollar,
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

// ── CSS ───────────────────────────────────────────────────────────
const buildCSS = (isDark) => `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');

  .grn-root * { box-sizing: border-box; }
  .grn-root { font-family: 'Sora', sans-serif; }

  @keyframes grnFadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes grnFade   { from { opacity:0; } to { opacity:1; } }
  @keyframes spin      { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .grn-doc  { animation: grnFadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both; }
  .grn-bar  { animation: grnFade 0.2s ease both; }
  .grn-spin { animation: spin 0.8s linear infinite; }

  .grn-action-btn { transition: all 0.15s; }
  .grn-action-btn:hover:not(:disabled) { filter: brightness(${isDark ? '1.15' : '0.93'}); transform: translateY(-1px); }
  .grn-action-btn:disabled { opacity: 0.45; cursor: not-allowed !important; }

  .grn-confirm-btn { transition: all 0.18s cubic-bezier(0.16,1,0.3,1); }
  .grn-confirm-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(16,185,129,0.35) !important; }

  .grn-row { transition: background 0.1s; }
  .grn-row:hover { background: ${isDark ? 'rgba(255,255,255,0.025)' : '#f8fafc'} !important; }

  .grn-toast {
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
    background: ${isDark ? '#1e293b' : '#0f172a'}; color: #fff;
    padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 600;
    z-index: 9999; white-space: nowrap;
    animation: grnFadeUp 0.25s cubic-bezier(0.16,1,0.3,1) both;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    display: flex; align-items: center; gap: 8px;
  }

  @media print {
    .grn-no-print { display: none !important; }
    .grn-root     { background: #fff !important; }
    .grn-doc      { box-shadow: none !important; border: none !important; }
  }
`;

export default function GRN() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useThemeStore((s) => s.isDark);
  const T         = getTheme(isDark);
  const printRef  = useRef(null);

  const [sendLoading,    setSendLoading]    = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmed,      setConfirmed]      = useState(false);
  const [toast,          setToast]          = useState(null);

  const { inboundData, grn } = location.state || {};

  // ── Redirect if no data ──
  if (!inboundData || !grn) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div style={{ textAlign: 'center', color: T.textSec }}>
          <FaBoxOpen size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 14 }}>No GRN data found.</p>
          <button
            onClick={() => navigate('/Purchase/Inbound')}
            style={{ marginTop: 12, padding: '8px 18px', background: T.blue, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Go to Inbound
          </button>
        </div>
      </div>
    );
  }

  const items   = inboundData.items || [];
  const grnNote = inboundData.note || '';

  // ── Calculations ─────────────────────────────────────────────────
  const subTotal   = round2(items.reduce((s, i) => s + (i.receiveQty || 0) * parseFloat(i.costPrice || 0), 0));
  const taxGroups  = buildTaxGroups(items);
  const totalTax   = round2(taxGroups.reduce((s, g) => s + g.taxAmount, 0));
  const grandTotal = round2(subTotal + totalTax);

  // ── Show toast ───────────────────────────────────────────────────
  const showToast = (msg, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Print / Download ─────────────────────────────────────────────
  const handlePrint    = () => window.print();
  const handleDownload = () => {
    showToast('Opening print dialog — choose "Save as PDF"', '📄');
    setTimeout(() => window.print(), 400);
  };

  // ── Send (simulated) ─────────────────────────────────────────────
  const handleSend = async () => {
    setSendLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      showToast(`GRN sent to ${grn.vendor || 'vendor'}`, '📧');
    } catch {
      showToast('Failed to send. Please try again.', '❌');
    } finally {
      setSendLoading(false);
    }
  };

  const [savedGRN, setSavedGRN] = useState(null);

  // ── Confirm Receipt ───────────────────────────────────────────────
  const handleConfirm = async () => {
    setConfirmLoading(true);
    try {
      // Build GRN payload for backend
      const grnPayload = {
        grnNumber:        grn.number,
        purchaseOrderId:  items[0]?.poId || '',
        poNumber:         grn.poNumber || '',
        vendorId:         inboundData.vendorId || '',
        vendorName:       grn.vendor || '',
        receiptDate:      new Date().toISOString(),
        notes:            grnNote,
        requiresApproval: inboundData.requiresApproval || false,
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
      setSavedGRN({ id: saved.id, grnNumber: saved.grnNumber || grn.number, total: saved.total || grandTotal });

      // Increase stock for each received item
      const stockUpdates = items
        .filter((i) => i.itemId && (i.receiveQty || 0) > 0)
        .map((i) => api.patch(`/api/stocks/${i.itemId}/increase`, { increaseBy: i.receiveQty }));
      await Promise.allSettled(stockUpdates);

      setConfirmed(true);
      showToast(`Receipt confirmed! GRN ${saved.grnNumber || grn.number} saved.`, '✅');
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
        grnId:     savedGRN?.id || '',
        grnNumber: savedGRN?.grnNumber || grn.number,
        poNumber:  grn.poNumber || '',
        vendorId:  inboundData.vendorId || '',
        vendorName: grn.vendor || '',
        total:     savedGRN?.total || grandTotal,
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

  // ── Shared card style ────────────────────────────────────────────
  const card = {
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: '14px',
    boxShadow: isDark ? '0 2px 16px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.06)',
  };

  // ── Status steps ─────────────────────────────────────────────────
  const steps = [
    { label: 'Received',  done: true      },
    { label: 'Inspected', done: true      },
    { label: 'Stocked',   done: confirmed },
    { label: 'Invoiced',  done: false     },
  ];

  return (
    <>
      <style>{buildCSS(isDark)}</style>

      {/* Toast */}
      {toast && (
        <div className="grn-toast">
          <span>{toast.icon}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="grn-root" style={{ minHeight: '100vh', background: T.bg, color: T.textPri }}>

        {/* ── STICKY ACTION BAR ─────────────────────────────── */}
        <div className="grn-bar grn-no-print" style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: isDark ? 'rgba(8,13,26,0.92)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${T.border}`,
          padding: '12px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="grn-action-btn" onClick={() => navigate('/Purchase/Inbound')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: T.textSec, cursor: 'pointer' }}>
              <FaChevronLeft size={11} /> Back
            </button>
            <div style={{ width: 1, height: 22, background: T.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>Goods Receipt Note</span>
              <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: T.blueLight, background: T.blueDim, padding: '2px 9px', borderRadius: 6, border: `1px solid rgba(59,130,246,0.2)` }}>{grn.number}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="grn-action-btn" onClick={handleSend} disabled={sendLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: T.textSec, cursor: sendLoading ? 'not-allowed' : 'pointer' }}>
              {sendLoading
                ? <><FaSpinner size={12} className="grn-spin" /> Sending…</>
                : <><FaPaperPlane size={12} /> Send</>}
            </button>

            <button className="grn-action-btn" onClick={handleDownload}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: 13, fontWeight: 600, color: T.textSec, cursor: 'pointer' }}>
              <FaFileDownload size={12} /> Download PDF
            </button>

            <button className="grn-action-btn" onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', background: T.blue, border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              <FaPrint size={12} /> Print
            </button>

            <div style={{ width: 1, height: 22, background: T.border }} />

            <button
              className="grn-confirm-btn grn-action-btn"
              onClick={handleConfirm}
              disabled={confirmLoading || confirmed}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
                background: confirmed ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #10b981, #059669)',
                border: confirmed ? '1px solid rgba(16,185,129,0.3)' : 'none',
                borderRadius: 9, fontSize: 13, fontWeight: 700,
                color: confirmed ? '#10b981' : '#fff',
                cursor: (confirmLoading || confirmed) ? 'not-allowed' : 'pointer',
                boxShadow: confirmed ? 'none' : '0 4px 14px rgba(16,185,129,0.3)',
              }}>
              {confirmLoading
                ? <><FaSpinner size={13} className="grn-spin" /> Confirming…</>
                : confirmed
                  ? <><FaCheckCircle size={13} /> Receipt Confirmed</>
                  : <><FaWarehouse size={13} /> Confirm Receipt</>}
            </button>

            {confirmed && (
              <button
                className="grn-action-btn"
                onClick={handleCreateBill}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}>
                <FaFileInvoiceDollar size={13} /> Create Bill
              </button>
            )}
          </div>
        </div>

        {/* ── DOCUMENT ──────────────────────────────────────── */}
        <div ref={printRef} style={{ maxWidth: 920, margin: '0 auto', padding: '28px 20px 48px' }}>

          {/* Success / prompt banner */}
          <div className="grn-no-print" style={{ ...card, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                <FaCheckCircle />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.textPri, margin: 0 }}>Goods Receipt Note Created</p>
                <p style={{ fontSize: 12, color: T.textSec, margin: '2px 0 0' }}>
                  {confirmed
                    ? 'Goods have been marked as received.'
                    : 'Review items below, then click "Confirm Receipt" to mark goods as received.'}
                </p>
              </div>
            </div>
            {!confirmed && (
              <button className="grn-confirm-btn grn-action-btn" onClick={handleConfirm} disabled={confirmLoading}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 9, fontSize: 12, fontWeight: 700, color: '#10b981', cursor: confirmLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {confirmLoading
                  ? <><FaSpinner size={11} className="grn-spin" /> Confirming…</>
                  : <><FaWarehouse size={12} /> Confirm Receipt →</>}
              </button>
            )}
          </div>

          {/* ── THE DOCUMENT CARD ── */}
          <div className="grn-doc" style={{ ...card, overflow: 'hidden' }}>

            {/* Document accent bar */}
            <div style={{ height: 4, background: `linear-gradient(90deg, #10b981, #059669 50%, ${T.blue})` }} />

            {/* ── Document Header ── */}
            <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>

                {/* Company branding */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', fontWeight: 900, flexShrink: 0 }}>
                    N
                  </div>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-0.02em' }}>Nexus ERP</p>
                    <p style={{ fontSize: 12, color: T.textSec, margin: '2px 0 0' }}>Dubai, United Arab Emirates</p>
                  </div>
                </div>

                {/* Document title */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: T.textSec, margin: '0 0 4px' }}>Document</p>
                  <p style={{ fontSize: 26, fontWeight: 900, color: T.textPri, margin: '0 0 6px', letterSpacing: '-0.02em' }}>GOODS RECEIPT NOTE</p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', fontWeight: 600, background: T.blueDim, color: T.blueLight, padding: '4px 12px', borderRadius: 8, border: `1px solid rgba(59,130,246,0.25)` }}>
                      {grn.number}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <MdMoveToInbox size={10} /> {grn.status || 'Received'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Status Timeline ── */}
            <div style={{ padding: '16px 32px', background: isDark ? 'rgba(255,255,255,0.02)' : '#fafbfc', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 0 }}>
              {steps.map((step, i) => (
                <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: step.done ? '#10b981' : T.surface2, border: `2px solid ${step.done ? '#10b981' : T.border}`, transition: 'all 0.3s', flexShrink: 0 }}>
                      {step.done ? <FaCheckCircle size={13} color="#fff" /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.border }} />}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: step.done ? 700 : 500, color: step.done ? '#10b981' : T.textSec, whiteSpace: 'nowrap' }}>{step.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: steps[i + 1].done ? '#10b981' : T.border, margin: '0 12px', transition: 'background 0.3s' }} />
                  )}
                </div>
              ))}
            </div>

            {/* ── Info Grid ── */}
            <div style={{ padding: '24px 32px', borderBottom: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

              {/* Vendor */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textSec, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FaBuilding size={9} /> Vendor
                </p>
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: T.textPri, margin: '0 0 4px' }}>{grn.vendor || 'Vendor'}</p>
                  <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 6px' }}>Dubai, United Arab Emirates</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FaHashtag size={10} style={{ color: T.textMuted }} />
                    <span style={{ fontSize: 12, fontFamily: 'DM Mono, monospace', color: T.textSec }}>
                      PO: {grn.poNumber || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Receipt Details */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textSec, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FaClipboardCheck size={9} /> Receipt Details
                </p>
                <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {[
                    { label: 'GRN Number',        value: grn.number,                                    mono: true  },
                    { label: 'Receipt Date',       value: grn.date || today(),                           mono: false },
                    { label: 'Purchase Order',     value: grn.poNumber || '—',                           mono: true  },
                    { label: 'Requires Approval',  value: inboundData.requiresApproval ? 'Yes' : 'No',  mono: false },
                  ].map(({ label, value, mono }, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                      <span style={{ fontSize: 11, color: T.textSec, fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.textPri, fontFamily: mono ? 'DM Mono, monospace' : 'inherit' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Items Table ── */}
            <div style={{ padding: '24px 32px', borderBottom: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textSec, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FaBoxOpen size={10} /> Items Received ({items.length})
              </p>

              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderBottom: `1px solid ${T.border}` }}>
                      {['#', 'Item', 'SKU', 'Ordered', 'Received', 'Unit Cost (excl.)', 'VAT 5%', 'Line Total'].map((h, i) => (
                        <th key={i} style={{ padding: '10px 14px', textAlign: i >= 3 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
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
                        <tr key={item._id || idx} className="grn-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: '12px 14px', color: T.textMuted, fontSize: 12, fontFamily: 'DM Mono, monospace' }}>{String(idx + 1).padStart(2, '0')}</td>
                          <td style={{ padding: '12px 14px', maxWidth: 200 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>{item.name}</p>
                            {item.unit && <p style={{ fontSize: 10, color: T.textMuted, margin: '1px 0 0' }}>per {item.unit}</p>}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: T.textSec, background: T.surface2, padding: '2px 8px', borderRadius: 5, border: `1px solid ${T.border}` }}>
                              {item.item_code || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.textSec, fontFamily: 'DM Mono, monospace' }}>{item.orderedQty || 0}</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri, fontFamily: 'DM Mono, monospace' }}>{qty}</span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0, fontFamily: 'DM Mono, monospace' }}>{fmtAED(unitCost)}</p>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', margin: 0, fontFamily: 'DM Mono, monospace' }}>{fmtAED(lineVat)}</p>
                            <p style={{ fontSize: 10, color: T.textMuted, margin: '1px 0 0', fontFamily: 'DM Mono, monospace' }}>{fmtAED(lineBase)} ×5%</p>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: T.blue, margin: 0, fontFamily: 'DM Mono, monospace' }}>{fmtAED(lineTotal)}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Summary ── */}
            <div style={{ padding: '24px 32px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', maxWidth: 420 }}>

                {/* Subtotal row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 13, color: T.textSec, fontWeight: 500 }}>Subtotal (excl. VAT)</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri, fontFamily: 'DM Mono, monospace' }}>{fmtAED(subTotal)}</span>
                </div>

                {/* Grouped VAT box */}
                <div style={{ margin: '12px 0', padding: '12px 14px', background: isDark ? 'rgba(245,158,11,0.06)' : '#fffbeb', border: `1.5px solid ${isDark ? 'rgba(245,158,11,0.2)' : '#fde68a'}`, borderRadius: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#f59e0b', margin: '0 0 8px' }}>VAT 5% — Grouped by Rate</p>
                  {taxGroups.length === 0 && <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>—</p>}
                  {taxGroups.map((g, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < taxGroups.length - 1 ? `1px solid ${isDark ? 'rgba(245,158,11,0.12)' : '#fef3c7'}` : 'none' }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0 }}>Rate {fmtAED(g.rate)}</p>
                        <p style={{ fontSize: 10, color: T.textSec, margin: '1px 0 0', fontFamily: 'DM Mono, monospace' }}>{fmtAED(g.baseAmount)} × 5%</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', fontFamily: 'DM Mono, monospace' }}>{fmtAED(g.taxAmount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1.5px solid ${isDark ? 'rgba(245,158,11,0.25)' : '#fcd34d'}`, marginTop: 8, paddingTop: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>Total VAT (5%)</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', fontFamily: 'DM Mono, monospace' }}>{fmtAED(totalTax)}</span>
                  </div>
                </div>

                {/* Grand total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: isDark ? 'rgba(59,130,246,0.08)' : '#eff6ff', borderRadius: 10, border: `1.5px solid ${isDark ? 'rgba(59,130,246,0.2)' : '#bfdbfe'}` }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>Grand Total (incl. VAT)</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: T.blue, fontFamily: 'DM Mono, monospace' }}>{fmtAED(grandTotal)}</span>
                </div>

                {/* Quick stats strip */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {[
                    { label: 'Items',      value: items.length,                                          color: T.blue,    bg: T.blueDim  },
                    { label: 'Total Qty',  value: items.reduce((s, i) => s + (i.receiveQty || 0), 0),   color: T.green,   bg: T.greenDim },
                    { label: 'Total Cost', value: fmtAED(subTotal),                                      color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb' },
                  ].map((s) => (
                    <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 9, padding: '10px 12px', textAlign: 'center' }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: s.color, margin: 0, fontFamily: 'DM Mono, monospace' }}>{s.value}</p>
                      <p style={{ fontSize: 9, fontWeight: 700, color: s.color, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Notes ── */}
            {(grnNote || inboundData.requiresApproval) && (
              <div style={{ padding: '20px 32px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {grnNote && (
                  <div style={{ background: isDark ? 'rgba(59,130,246,0.06)' : '#f0f7ff', border: `1px solid ${isDark ? 'rgba(59,130,246,0.15)' : '#bfdbfe'}`, borderRadius: 10, padding: '12px 16px' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: T.blue, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 5px' }}>Receipt Notes</p>
                    <p style={{ fontSize: 13, color: T.textSec, margin: 0, lineHeight: 1.65 }}>{grnNote}</p>
                  </div>
                )}
                {inboundData.requiresApproval && (
                  <div style={{ background: isDark ? 'rgba(245,158,11,0.06)' : '#fffbeb', border: `1px solid ${isDark ? 'rgba(245,158,11,0.2)' : '#fde68a'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13 }}>⚠️</span>
                    <p style={{ fontSize: 13, color: '#92400e', margin: 0, fontWeight: 500 }}>This goods receipt requires manager approval before stocking.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Signature Footer ── */}
            <div style={{ padding: '28px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
              {['Received By', 'Inspected By', 'Authorized By'].map((label) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ height: 1, background: T.border, marginBottom: 10 }} />
                  <p style={{ fontSize: 11, color: T.textSec, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 10, color: T.textMuted, margin: '3px 0 0' }}>Signature & Date</p>
                </div>
              ))}
            </div>

            {/* Document footer */}
            <div style={{ padding: '14px 32px', background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: T.textMuted }}>Generated: {today()} · Nexus ERP System</span>
              <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: T.textMuted }}>{grn.number}</span>
            </div>

          </div>{/* end document card */}

          {/* ── Bottom action bar ── */}
          <div className="grn-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 20 }}>
            <button className="grn-action-btn" onClick={() => navigate('/Purchase/Inbound')}
              style={{ padding: '9px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
              <FaTimes size={11} /> Close
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="grn-action-btn" onClick={handlePrint}
                style={{ padding: '9px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: T.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <FaPrint size={11} /> Print
              </button>
              <button
                className="grn-confirm-btn grn-action-btn"
                onClick={handleConfirm}
                disabled={confirmLoading || confirmed}
                style={{
                  padding: '9px 24px',
                  background: confirmed ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #10b981, #059669)',
                  border: confirmed ? '1px solid rgba(16,185,129,0.3)' : 'none',
                  borderRadius: 10, fontSize: 13, fontWeight: 700,
                  color: confirmed ? '#10b981' : '#fff',
                  cursor: (confirmLoading || confirmed) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: confirmed ? 'none' : '0 4px 14px rgba(16,185,129,0.35)',
                }}>
                {confirmLoading
                  ? <><FaSpinner size={13} className="grn-spin" /> Confirming…</>
                  : confirmed
                    ? <><FaCheckCircle size={13} /> Receipt Confirmed ✓</>
                    : <><FaWarehouse size={13} /> Confirm Receipt →</>}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
