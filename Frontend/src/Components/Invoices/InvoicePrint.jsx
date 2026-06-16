import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaPrint, FaFileDownload, FaSpinner } from 'react-icons/fa';
import api from '../../helper/axiosInstance';
import useAuthStore from '../../store/useAuthStore';
import { usePermissions } from '../../helper/permissions';

const fmt = (n) => `${Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return d; } };

// Number → words (AED Dirhams + Fils)
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function three(n) {
  let s = '';
  if (n >= 100) { s += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
  if (n >= 20) { s += tens[Math.floor(n / 10)] + ' '; n %= 10; }
  if (n > 0) s += ones[n] + ' ';
  return s.trim();
}
function toWords(num) {
  num = Math.floor(num);
  if (num === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion'];
  let i = 0, words = '';
  while (num > 0) {
    const chunk = num % 1000;
    if (chunk) words = three(chunk) + (scales[i] ? ' ' + scales[i] : '') + ' ' + words;
    num = Math.floor(num / 1000); i++;
  }
  return words.trim();
}
const amountInWords = (total) => {
  const dh = Math.floor(total);
  const fils = Math.round((total - dh) * 100);
  let s = `${toWords(dh)} Dirham`;
  s += fils > 0 ? ` and ${toWords(fils)} Fils` : ' and No Fils';
  return s;
};

export default function InvoicePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const { can } = usePermissions();
  const canExport = can('invoices', 'export');

  const [inv, setInv]   = useState(null);
  const [cust, setCust] = useState(null);
  const [so, setSo]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [letterhead, setLetterhead] = useState('');
  const [letterTop, setLetterTop]   = useState(13);
  const [letterBot, setLetterBot]   = useState(8);
  const [stamp, setStamp]   = useState('');
  const [orgName, setOrgName] = useState('');
  const [topPadPx, setTopPadPx] = useState(0);
  const [botPadPx, setBotPadPx] = useState(0);
  const cardRef = useRef(null);

  useEffect(() => {
    api.get(`/api/invoices/${id}`).then(r => {
      const d = r.data?.data || null;
      setInv(d);
      // Enrich: customer (code, phone) + linked sales order (cust PO, sales emp)
      if (d?.customerId) {
        api.get(`/api/customers/${d.customerId}`).then(cr => setCust(cr.data?.data || cr.data || null)).catch(() => {});
      }
      const soId = d?.linkedSalesOrderIds?.[0];
      if (soId) {
        api.get(`/api/sales-orders/${soId}`).then(sr => setSo(sr.data?.data || sr.data || null)).catch(() => {});
      }
    }).catch(() => setInv(null)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const orgId = activeOrg?._id;
    if (!orgId) return;
    api.get(`/api/organizations/${orgId}?withImages=true`).then(r => {
      const d = r.data?.data || {};
      setLetterhead(d.letterheadImage || '');
      setLetterTop(d.letterheadTopPad || 13);
      setLetterBot(d.letterheadBottomPad || 8);
      setStamp(d.stampImage || '');
      setOrgName(d.name || d.companyName || '');
    }).catch(() => {});
  }, [activeOrg]);

  useEffect(() => {
    if (!letterhead) { setTopPadPx(0); setBotPadPx(0); return; }
    const img = new Image();
    img.onload = () => {
      const w = cardRef.current?.offsetWidth || 820;
      const h = w * (img.naturalHeight / img.naturalWidth);
      setTopPadPx(Math.round(h * letterTop / 100));
      setBotPadPx(Math.round(h * letterBot / 100));
    };
    img.src = letterhead;
  }, [letterhead, letterTop, letterBot]);

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}><FaSpinner style={{ animation: 'spin 0.8s linear infinite', fontSize: 22, color: '#1e3a5f' }} /></div>;
  if (!inv) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b' }}>Invoice not found</div>;

  // Split product lines (main table) from charge lines (shown in totals box only)
  const isCharge = (li) => li._type === 'expense'
    || /^(shipping|adjustment|freight|delivery|handling)\b/i.test((li.desc || '').trim());
  const items   = (inv.lineItems || []).filter(li => !isCharge(li));
  const charges = (inv.lineItems || []).filter(isCharge);
  const cur      = inv.currency || 'AED';
  // Product-only subtotal (charges shown separately in the box)
  const prodNet = items.reduce((s, li) => s + (li.subtotal ?? ((li.qty || 0) * (li.unitPrice || 0) - (li.discAmt || 0))), 0);
  const grand    = inv.totals?.grandTotal || 0;
  const vat        = inv.totals?.taxTotal  || 0;
  const advance     = inv.amountPaid || 0;
  const balance      = inv.balanceDue ?? (grand - advance);
  const isProforma    = inv.type === 'proforma';

  const custCode = cust?.customerCode || '';
  const custPhone = cust?.customerPhone || cust?.phone || '';
  const relatedInfo = [
    { label: 'Currency',        value: cur },
    { label: 'Sale Order Ref',  value: so?.orderNumber || '—' },
    { label: 'Cust PO No',      value: so?.lpoNumber || '—' },
    { label: 'Cust PO Dt',      value: so?.lpoDate ? fmtDate(so.lpoDate) : '—' },
    { label: 'Payment Terms',   value: inv.paymentTerms || '—' },
    { label: 'Sales Divn',      value: orgName || inv.from?.name || '—' },
    { label: 'Sales Emp',       value: so?.salesperson || '—' },
    { label: 'Delivery Ref',    value: inv.linkedDnNumber || '—' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        @media print {
          @page { margin: 0; size: A4; }
          body * { visibility: hidden !important; }
          .inv-doc, .inv-doc * { visibility: visible !important; }
          .inv-doc { position: absolute !important; left: 0; top: 0; width: 100% !important; box-shadow: none !important; border: none !important; }
          .inv-no-print { display: none !important; }
        }
      `}</style>

      {/* Top bar */}
      <div className="inv-no-print" style={{ position: 'sticky', top: 0, zIndex: 50, background: '#1e3a5f', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => navigate('/Sales/Invoices')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
          <FaChevronLeft size={10} /> Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {canExport && (
            <button onClick={() => { window.print(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#f59e0b', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#0a0e1a', cursor: 'pointer' }}>
              <FaFileDownload size={11} /> Save as PDF
            </button>
          )}
          <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1e3a5f', cursor: 'pointer' }}>
            <FaPrint size={11} /> Print
          </button>
        </div>
      </div>

      <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '28px 16px 60px' }}>
        <div ref={cardRef} className="inv-doc" style={{ maxWidth: 820, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 2px 24px rgba(0,0,0,0.1)', fontFamily: 'Inter, sans-serif', color: '#0f172a', overflow: 'hidden', position: 'relative' }}>
          <div style={{ ...(letterhead ? { backgroundImage: `url(${letterhead})`, backgroundSize: '100% auto', backgroundPosition: 'top center', backgroundRepeat: 'no-repeat', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', paddingTop: topPadPx, paddingBottom: botPadPx } : {}) }}>

            {/* Fallback header */}
            {!letterhead && (
              <div style={{ background: '#1e3a5f', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>{orgName || inv.from?.name || 'Company'}</p>
                  {inv.from?.address && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '2px 0 0' }}>{inv.from.address}</p>}
                </div>
              </div>
            )}

            {/* Title */}
            <div style={{ textAlign: 'center', padding: '14px 0 8px' }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f', margin: 0, letterSpacing: '0.1em', textDecoration: 'underline', textUnderlineOffset: 4 }}>
                {isProforma ? 'PROFORMA INVOICE' : 'TAX INVOICE'}
              </p>
              {inv.from?.trn && <p style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', margin: '4px 0 0' }}>TRN : {inv.from.trn}</p>}
            </div>

            {/* Invoice number + date strip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ padding: '8px 20px', borderRight: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f' }}>INVOICE NUMBER</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{inv.invoiceNumber}</span>
              </div>
              <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f' }}>DATE INVOICE</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{fmtDate(inv.issueDate)}</span>
              </div>
            </div>

            {/* Bill To + Related Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #1e3a5f' }}>
              <div style={{ padding: '12px 20px', borderRight: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#1e3a5f', margin: '0 0 8px', textTransform: 'uppercase' }}>Bill To</p>
                {custCode && <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 3px' }}>Customer Code: {custCode}</p>}
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>{inv.billTo?.name || '—'}</p>
                {inv.billTo?.address && <p style={{ fontSize: 11, color: '#334155', margin: '0 0 3px', lineHeight: 1.5 }}>{inv.billTo.address}</p>}
                {custPhone && <p style={{ fontSize: 11, color: '#334155', margin: '0 0 3px' }}>Tel: {custPhone}</p>}
                {inv.billTo?.trn && <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>TRN: {inv.billTo.trn}</p>}
              </div>
              <div style={{ padding: '12px 20px' }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#1e3a5f', margin: '0 0 8px', textTransform: 'uppercase' }}>Related Info</p>
                {relatedInfo.map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#64748b', minWidth: 110, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 11, color: '#0f172a' }}>: {value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #1e3a5f' }}>
                  {[
                    { l: 'Sl.No',              w: '5%',  a: 'center' },
                    { l: 'Material Description', w: '32%', a: 'left'   },
                    { l: 'Qty',                w: '6%',  a: 'center' },
                    { l: 'Unit Price',         w: '11%', a: 'right'  },
                    { l: 'Gross Price',        w: '12%', a: 'right'  },
                    { l: 'Discount',           w: '9%',  a: 'right'  },
                    { l: 'VAT %',              w: '7%',  a: 'center' },
                    { l: 'Net Value',          w: '9%',  a: 'right'  },
                    { l: 'Total Value',        w: '12%', a: 'right'  },
                  ].map(({ l, w, a }) => (
                    <th key={l} style={{ padding: '8px 8px', textAlign: a, width: w, fontSize: 10, fontWeight: 700, color: '#1e3a5f' }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const gross = (it.qty || 0) * (it.unitPrice || 0);
                  const net   = it.subtotal ?? (gross - (it.discAmt || 0));
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '9px 8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '9px 8px', color: '#0f172a', lineHeight: 1.5 }}>{it.desc}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center' }}>{it.qty}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right' }}>{fmt(it.unitPrice)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right' }}>{fmt(gross)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: (it.discAmt || 0) > 0 ? '#0f172a' : '#94a3b8' }}>{fmt(it.discAmt || 0)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center' }}>{it.taxRate || 0}%</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right' }}>{fmt(net)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(it.total)}</td>
                    </tr>
                  );
                })}
                {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
                  <tr key={`e-${i}`} style={{ borderBottom: '1px solid #e2e8f0' }}>{[...Array(9)].map((__, j) => <td key={j} style={{ padding: '9px 8px' }}>&nbsp;</td>)}</tr>
                ))}
              </tbody>
            </table>

            {/* Totals box — 3 columns like the PDF */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', borderTop: '1.5px solid #1e3a5f' }}>
              <div style={{ padding: '12px 20px', borderRight: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', margin: '0 0 4px' }}>TOTAL IN WORDS</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0, lineHeight: 1.5 }}>
                  {cur} {amountInWords(grand)}
                </p>
              </div>
              <div>
                {[
                  { label: 'Invoice Value (excl. VAT)', value: prodNet },
                  ...charges.map(c => ({ label: c.desc || 'Charge', value: c.total })),
                  { label: 'VAT',                       value: vat },
                  { label: 'Total Value (incl. VAT)',   value: grand, bold: true },
                  ...(advance > 0 ? [{ label: 'Advance / Paid', value: advance, green: true }] : []),
                  ...(advance > 0 ? [{ label: 'Balance Payable', value: balance, red: balance > 0 }] : []),
                ].map(({ label, value, bold, green, red }, i, arr) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none', background: bold ? '#eff6ff' : 'transparent' }}>
                    <span style={{ fontSize: 11, color: bold ? '#1e3a5f' : '#64748b', fontWeight: bold ? 700 : 500 }}>{label}</span>
                    <span style={{ fontSize: bold ? 13 : 11, fontWeight: bold ? 800 : 600, color: red ? '#ef4444' : green ? '#10b981' : bold ? '#1e3a5f' : '#0f172a', fontFamily: 'monospace' }}>{cur} {fmt(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Signature block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1.5px solid #1e3a5f' }}>
              <div style={{ padding: '16px 20px', borderRight: '1px solid #e2e8f0', minHeight: 140 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 30px' }}>Receiver Name, Signature &amp; Stamp</p>
                <div style={{ borderBottom: '1px solid #94a3b8', width: '80%' }} />
              </div>
              <div style={{ padding: '16px 20px', position: 'relative' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                  For {orgName || inv.from?.name || 'Company'}
                </p>
                <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>Prepared By</p>
                {stamp && (
                  <img src={stamp} alt="Company stamp" style={{ position: 'absolute', right: 24, top: 24, width: 120, height: 120, objectFit: 'contain', opacity: 0.9, pointerEvents: 'none', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', transform: 'rotate(-6deg)' }} />
                )}
              </div>
            </div>

            {/* Notes */}
            {inv.notes?.customer && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', margin: '0 0 3px', textTransform: 'uppercase' }}>Notes</p>
                <p style={{ fontSize: 11, color: '#334155', margin: 0, lineHeight: 1.5 }}>{inv.notes.customer}</p>
              </div>
            )}

            {!letterhead && (
              <div style={{ background: '#1e3a5f', padding: '7px 20px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Thank you for your business</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{inv.invoiceNumber}</span>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
