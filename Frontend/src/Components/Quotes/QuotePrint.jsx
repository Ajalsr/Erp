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

export default function QuotePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const activeOrg = useAuthStore((s) => s.activeOrg);
  const { can } = usePermissions();
  const canExport = can('quotes', 'export');

  const [q, setQ] = useState(null);
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
    api.get(`/api/quotes/${id}`).then(r => {
      setQ(r.data?.data || r.data || null);
    }).catch(() => setQ(null)).finally(() => setLoading(false));
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

  const [lhHeight, setLhHeight] = useState(0);
  useEffect(() => {
    if (!letterhead) { setTopPadPx(0); setBotPadPx(0); setLhHeight(0); return; }
    const img = new Image();
    img.onload = () => {
      const w = cardRef.current?.offsetWidth || 820;
      const h = w * (img.naturalHeight / img.naturalWidth);
      setTopPadPx(Math.round(h * letterTop / 100));
      setBotPadPx(Math.round(h * letterBot / 100));
      setLhHeight(Math.round(h)); // so the letterhead footer (image bottom) lands at the page bottom
    };
    img.src = letterhead;
  }, [letterhead, letterTop, letterBot]);

  const [downloading, setDownloading] = useState(false);
  const fetchPdfUrl = async () => {
    const res = await api.get(`/api/quotes/${id}/pdf`, { responseType: 'blob' });
    return URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  };
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const url = await fetchPdfUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${q?.quoteNumber || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      alert('Could not generate the PDF (' + (e?.response?.status || e?.message || 'error') + '). Try again.');
    } finally {
      setDownloading(false);
    }
  };
  // Print the server PDF (correct layout) via a hidden iframe — avoids the HTML gap.
  const printPdf = async () => {
    setDownloading(true);
    try {
      const url = await fetchPdfUrl();
      const ifr = document.createElement('iframe');
      ifr.style.position = 'fixed';
      ifr.style.right = '0';
      ifr.style.bottom = '0';
      ifr.style.width = '0';
      ifr.style.height = '0';
      ifr.style.border = '0';
      ifr.src = url;
      ifr.onload = () => { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch { window.open(url); } };
      document.body.appendChild(ifr);
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}><FaSpinner style={{ animation: 'spin 0.8s linear infinite', fontSize: 22, color: '#1e3a5f' }} /></div>;
  if (!q) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#64748b' }}>Quote not found</div>;

  const items = q.lineItems || [];
  const cur   = q.currency || 'AED';
  const prodNet = items.reduce((s, li) => s + (li.subtotal ?? ((li.qty || 0) * (li.unitPrice || 0) - (li.discAmt || 0))), 0);
  const grand = q.totals?.grandTotal || 0;
  const vat   = q.totals?.taxTotal  || 0;

  const company = q.company || {};
  const senderName = company.name || orgName || 'Company';

  const relatedInfo = [
    { label: 'Currency',      value: cur },
    { label: 'Quote Date',    value: fmtDate(q.quoteDate) },
    { label: 'Valid Until',   value: fmtDate(q.validUntil) },
    { label: 'Payment Terms', value: q.paymentTerms || '—' },
    { label: 'Attention To',  value: q.attentionTo || '—' },
    { label: 'Subject',       value: q.subject || '—' },
    { label: 'Project',       value: q.projectName || '—' },
  ];

  const noteLines = (q.notes?.customer || '').split('\n').map(s => s.trim()).filter(Boolean);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        @media print {
          @page { margin: 0; size: A4; }
          body * { visibility: hidden !important; }
          .qt-doc, .qt-doc * { visibility: visible !important; }
          .qt-doc { position: absolute !important; left: 0; top: 0; width: 100% !important; box-shadow: none !important; border: none !important; }
          .qt-no-print { display: none !important; }
        }
      `}</style>

      {/* Top bar */}
      <div className="qt-no-print" style={{ position: 'sticky', top: 0, zIndex: 50, background: '#1e3a5f', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <button onClick={() => navigate('/Sales/Quotes')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
          <FaChevronLeft size={10} /> Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {canExport && (
            <button onClick={downloadPdf} disabled={downloading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#f59e0b', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#0a0e1a', cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? 0.7 : 1 }}>
              <FaFileDownload size={11} /> {downloading ? 'Generating…' : 'Save as PDF'}
            </button>
          )}
          <button onClick={canExport ? printPdf : () => window.print()} disabled={downloading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#1e3a5f', cursor: downloading ? 'wait' : 'pointer' }}>
            <FaPrint size={11} /> Print
          </button>
        </div>
      </div>

      <div style={{ background: '#f1f5f9', minHeight: '100vh', padding: '28px 16px 60px' }}>
        <div ref={cardRef} className="qt-doc" style={{ maxWidth: 820, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 2px 24px rgba(0,0,0,0.1)', fontFamily: 'Inter, sans-serif', color: '#0f172a', overflow: 'hidden', position: 'relative' }}>
          <div style={{ ...(letterhead ? { backgroundImage: `url(${letterhead})`, backgroundSize: '100% auto', backgroundPosition: 'top center', backgroundRepeat: 'no-repeat', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', paddingTop: topPadPx, paddingBottom: botPadPx, minHeight: lhHeight || undefined } : {}) }}>

            {/* Fallback header — full company details */}
            {!letterhead && (
              <div style={{ background: '#1e3a5f', padding: '16px 28px' }}>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>{senderName}</p>
                {company.address && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: '3px 0 0', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{company.address}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', marginTop: 5 }}>
                  {company.phone   && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Tel: {company.phone}</span>}
                  {company.email   && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Email: {company.email}</span>}
                  {company.website && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{company.website}</span>}
                  {company.trn     && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>TRN: {company.trn}</span>}
                </div>
              </div>
            )}

            {/* Title */}
            <div style={{ textAlign: 'center', padding: '14px 0 8px' }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#1e3a5f', margin: 0, letterSpacing: '0.1em', textDecoration: 'underline', textUnderlineOffset: 4 }}>
                QUOTATION
              </p>
              {company.trn && <p style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', margin: '4px 0 0' }}>TRN : {company.trn}</p>}
            </div>

            {/* Quote number + date strip */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ padding: '8px 20px', borderRight: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f' }}>QUOTE NUMBER</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{q.quoteNumber}</span>
              </div>
              <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f' }}>DATE</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{fmtDate(q.quoteDate)}</span>
              </div>
            </div>

            {/* Bill To + Related Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1.5px solid #1e3a5f' }}>
              <div style={{ padding: '12px 20px', borderRight: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#1e3a5f', margin: '0 0 8px', textTransform: 'uppercase' }}>To</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', margin: '0 0 3px' }}>{q.billTo?.name || q.customerName || '—'}</p>
                {q.billTo?.address && <p style={{ fontSize: 11, color: '#334155', margin: '0 0 3px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{q.billTo.address}</p>}
                {q.customerEmail && <p style={{ fontSize: 11, color: '#334155', margin: '0 0 3px' }}>{q.customerEmail}</p>}
                {q.billTo?.trn && <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>TRN: {q.billTo.trn}</p>}
              </div>
              <div style={{ padding: '12px 20px' }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#1e3a5f', margin: '0 0 8px', textTransform: 'uppercase' }}>Details</p>
                {relatedInfo.map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#64748b', minWidth: 100, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: 11, color: '#0f172a' }}>: {value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Intro text */}
            {q.introText && (
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 11.5, color: '#334155', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{q.introText}</p>
              </div>
            )}

            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #1e3a5f' }}>
                  {[
                    { l: 'Sl.No',       w: '5%',  a: 'center' },
                    { l: 'Part No',     w: '11%', a: 'left'   },
                    { l: 'Description', w: '26%', a: 'left'   },
                    { l: 'Qty',         w: '6%',  a: 'center' },
                    { l: 'Unit',        w: '7%',  a: 'center' },
                    { l: 'Unit Price',  w: '11%', a: 'right'  },
                    { l: 'Discount',    w: '9%',  a: 'right'  },
                    { l: 'VAT %',       w: '7%',  a: 'center' },
                    { l: 'Net Value',   w: '9%',  a: 'right'  },
                    { l: 'Total Value', w: '9%',  a: 'right'  },
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
                      <td style={{ padding: '9px 8px', color: '#64748b' }}>{it.partNumber || '—'}</td>
                      <td style={{ padding: '9px 8px', color: '#0f172a', lineHeight: 1.5 }}>{it.desc}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center' }}>{it.qty}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center' }}>{it.unit || ''}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right' }}>{fmt(it.unitPrice)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', color: (it.discAmt || 0) > 0 ? '#0f172a' : '#94a3b8' }}>{fmt(it.discAmt || 0)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center' }}>{it.taxRate || 0}%</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right' }}>{fmt(net)}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(it.total)}</td>
                    </tr>
                  );
                })}
                {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
                  <tr key={`e-${i}`} style={{ borderBottom: '1px solid #e2e8f0' }}>{[...Array(10)].map((__, j) => <td key={j} style={{ padding: '9px 8px' }}>&nbsp;</td>)}</tr>
                ))}
              </tbody>
            </table>

            {/* Totals box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', borderTop: '1.5px solid #1e3a5f' }}>
              <div style={{ padding: '12px 20px', borderRight: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', margin: '0 0 4px' }}>TOTAL IN WORDS</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', margin: 0, lineHeight: 1.5 }}>
                  {cur} {amountInWords(grand)}
                </p>
              </div>
              <div>
                {[
                  { label: 'Quote Value (excl. VAT)', value: prodNet },
                  { label: 'VAT',                     value: vat },
                  { label: 'Total Value (incl. VAT)', value: grand, bold: true },
                ].map(({ label, value, bold }, i, arr) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none', background: bold ? '#eff6ff' : 'transparent' }}>
                    <span style={{ fontSize: 11, color: bold ? '#1e3a5f' : '#64748b', fontWeight: bold ? 700 : 500 }}>{label}</span>
                    <span style={{ fontSize: bold ? 13 : 11, fontWeight: bold ? 800 : 600, color: bold ? '#1e3a5f' : '#0f172a', fontFamily: 'monospace' }}>{cur} {fmt(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Terms & Conditions */}
            {(q.termsAndConditions || []).filter(Boolean).length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1.5px solid #1e3a5f' }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#1e3a5f', margin: '0 0 8px', textTransform: 'uppercase' }}>Terms &amp; Conditions</p>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {q.termsAndConditions.filter(Boolean).map((t, i) => (
                    <li key={i} style={{ fontSize: 10.5, color: '#334155', margin: '0 0 3px', lineHeight: 1.5 }}>{t}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Notes */}
            {noteLines.length > 0 && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase' }}>Notes</p>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {noteLines.map((n, i) => (
                    <li key={i} style={{ fontSize: 11, color: '#334155', margin: 0, lineHeight: 1.5 }}>{n}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Signature block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1.5px solid #1e3a5f' }}>
              <div style={{ padding: '16px 20px', borderRight: '1px solid #e2e8f0', minHeight: 140 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 30px' }}>Customer Acceptance (Name, Signature &amp; Stamp)</p>
                <div style={{ borderBottom: '1px solid #94a3b8', width: '80%' }} />
              </div>
              <div style={{ padding: '16px 20px', position: 'relative' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                  For {senderName}
                </p>
                {q.signatory?.name && <p style={{ fontSize: 11, color: '#0f172a', fontWeight: 600, margin: '20px 0 0' }}>{q.signatory.name}</p>}
                {q.signatory?.title && <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>{q.signatory.title}</p>}
                {stamp && (
                  <img src={stamp} alt="Company stamp" style={{ position: 'absolute', right: 24, top: 24, width: 120, height: 120, objectFit: 'contain', opacity: 0.9, pointerEvents: 'none', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', transform: 'rotate(-6deg)' }} />
                )}
              </div>
            </div>

            {/* Company contact footer — only when there's no letterhead (the letterhead supplies its own footer) */}
            {!letterhead && (company.name || company.address || company.phone || company.email || company.website || company.trn) && (
              <div style={{ borderTop: '1px solid #e2e8f0', padding: '10px 20px', background: '#f8fafc', textAlign: 'center' }}>
                {company.name && <p style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>{company.name}</p>}
                {company.address && <p style={{ fontSize: 10, color: '#64748b', margin: '2px 0 0', whiteSpace: 'pre-line', lineHeight: 1.4 }}>{company.address}</p>}
                <p style={{ fontSize: 10, color: '#64748b', margin: '3px 0 0' }}>
                  {[
                    company.phone   && `Tel: ${company.phone}`,
                    company.email   && `Email: ${company.email}`,
                    company.website && company.website,
                    company.trn     && `TRN: ${company.trn}`,
                  ].filter(Boolean).join('   |   ')}
                </p>
              </div>
            )}

            {!letterhead && (
              <div style={{ background: '#1e3a5f', padding: '7px 20px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Thank you for your business</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>{q.quoteNumber}</span>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
