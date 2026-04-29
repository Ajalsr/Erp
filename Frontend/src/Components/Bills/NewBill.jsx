import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaChevronLeft, FaPlus, FaTrash, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import axiosInstance from '../../helper/axiosInstance';
import nexusToast from '../../helper/nexusToast';

const TAX_RATE = 0.05;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

const emptyLine = () => ({ description: '', qty: 1, unitPrice: '', taxRate: 5, discount: 0, discountType: 'fixed', gross: 0, discAmt: 0, subtotal: 0, taxAmt: 0, total: 0 });

function calcLine(line) {
  const qty   = parseFloat(line.qty)       || 0;
  const price = parseFloat(line.unitPrice) || 0;
  const disc  = parseFloat(line.discount)  || 0;
  const gross  = round2(qty * price);
  const discAmt = line.discountType === 'percentage'
    ? round2(gross * disc / 100)
    : round2(disc);
  const subtotal = round2(Math.max(0, gross - discAmt));
  const taxAmt   = round2(subtotal * (parseFloat(line.taxRate) / 100 || 0));
  return { ...line, gross, discAmt, subtotal, taxAmt, total: round2(subtotal + taxAmt) };
}

export default function NewBill() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const [saving, setSaving] = useState(false);

  const pre = location.state || {};

  // Form state
  const [vendorId,   setVendorId]   = useState(pre.vendorId   || '');
  const [vendorName, setVendorName] = useState(pre.vendorName || '');
  const [billDate,   setBillDate]   = useState(new Date().toISOString().slice(0, 10));
  const [dueDate,    setDueDate]    = useState('');
  const [payTerms,   setPayTerms]   = useState('Net 30');
  const [poNumber,   setPoNumber]   = useState(pre.poNumber   || '');
  const [grnNumber,  setGrnNumber]  = useState(pre.grnNumber  || '');
  const [grnId,      setGrnId]      = useState(pre.grnId      || '');
  const [notes,      setNotes]      = useState('');
  const [lines, setLines] = useState(() => {
    if (pre.items?.length) return pre.items.map(calcLine);
    return [emptyLine()];
  });

  // Vendor search
  const [vendorSearch,  setVendorSearch]  = useState(pre.vendorName || '');
  const [vendorResults, setVendorResults] = useState([]);

  useEffect(() => {
    if (!vendorSearch.trim() || vendorId) { setVendorResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await axiosInstance.get(`/api/vendors/search?q=${encodeURIComponent(vendorSearch)}`);
        setVendorResults(res.data?.data || []);
      } catch { setVendorResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [vendorSearch, vendorId]);

  // Auto-set due date from pay terms
  useEffect(() => {
    if (!billDate) return;
    const days = { 'Due on Receipt': 0, 'Net 15': 15, 'Net 30': 30, 'Net 45': 45, 'Net 60': 60 };
    const d = new Date(billDate);
    d.setDate(d.getDate() + (days[payTerms] ?? 30));
    setDueDate(d.toISOString().slice(0, 10));
  }, [billDate, payTerms]);

  const updateLine = (idx, field, val) => {
    setLines((prev) => {
      const u = [...prev];
      u[idx] = calcLine({ ...u[idx], [field]: val });
      return u;
    });
  };
  const addLine    = () => setLines((p) => [...p, emptyLine()]);
  const removeLine = (idx) => setLines((p) => p.length > 1 ? p.filter((_, i) => i !== idx) : p);

  const grossTotal    = round2(lines.reduce((s, l) => s + (l.gross   || 0), 0));
  const discountTotal = round2(lines.reduce((s, l) => s + (l.discAmt || 0), 0));
  const subtotal      = round2(lines.reduce((s, l) => s + (l.subtotal || 0), 0));
  const taxTotal      = round2(lines.reduce((s, l) => s + (l.taxAmt  || 0), 0));
  const grandTotal    = round2(subtotal + taxTotal);

  const handleSubmit = async () => {
    if (!vendorId) { nexusToast.error('Vendor is required'); return; }
    if (!lines.some((l) => l.description && parseFloat(l.qty) > 0)) {
      nexusToast.error('Add at least one line item'); return;
    }
    setSaving(true);
    try {
      const payload = {
        vendorId,
        vendorName,
        billDate,
        dueDate,
        paymentTerms: payTerms,
        poNumber:  poNumber  || undefined,
        grnId:     grnId     || undefined,
        grnNumber: grnNumber || undefined,
        notes:     notes     || undefined,
        lineItems: lines.filter((l) => l.description).map((l) => ({
          description:  l.description,
          qty:          parseFloat(l.qty)       || 0,
          unitPrice:    parseFloat(l.unitPrice) || 0,
          taxRate:      parseFloat(l.taxRate)   || 0,
          discount:     parseFloat(l.discount)  || 0,
          discountType: l.discountType || 'fixed',
          discountAmt:  l.discAmt || 0,
          taxAmt:       l.taxAmt,
          subtotal:     l.subtotal,
          total:        l.total,
        })),
        totals: { grossTotal, discountTotal, subtotal, taxTotal, grandTotal },
        status: 'open',
      };
      await axiosInstance.post('/api/bills/', payload);
      nexusToast.success('Bill created successfully!');
      setTimeout(() => navigate('/Purchase/Bills'), 1200);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  };

  const inp = { width: '100%', padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, fontFamily: 'inherit', outline: 'none' };
  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 };
  const sec = { background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '20px 22px', marginBottom: 16, boxShadow: isDark ? '0 2px 10px rgba(0,0,0,.25)' : '0 1px 4px rgba(0,0,0,.05)' };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, padding: '20px 20px 90px', color: T.textPri, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Top bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 30, background: isDark ? 'rgba(8,13,26,.95)' : 'rgba(241,245,249,.95)', backdropFilter: 'blur(12px)', padding: '12px 0', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => navigate('/Purchase/Bills')} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <FaChevronLeft size={13} />
              </button>
              <div>
                <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 17, fontWeight: 800, color: T.textPri, margin: 0 }}>New Vendor Bill</h1>
                {pre.fromGRN && <p style={{ fontSize: 11, color: T.blue, margin: '2px 0 0' }}>Created from GRN: {pre.grnNumber}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate('/Purchase/Bills')} style={{ padding: '9px 18px', border: `1.5px solid ${T.border}`, borderRadius: 9, background: 'transparent', color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? <><FaSpinner size={12} style={{ animation: 'spin .7s linear infinite' }} /> Saving…</> : <><FaCheckCircle size={12} /> Save Bill</>}
              </button>
            </div>
          </div>
        </div>

        {/* Vendor + header */}
        <div style={sec}>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: T.textPri, margin: '0 0 16px' }}>Bill Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ position: 'relative' }}>
              <label style={lbl}>Vendor <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={vendorSearch} onChange={(e) => { setVendorSearch(e.target.value); setVendorId(''); setVendorName(''); }}
                placeholder="Search vendor…" style={inp} />
              {vendorResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)', marginTop: 3 }}>
                  {vendorResults.map((v) => (
                    <div key={v._id} onClick={() => { setVendorId(v._id); setVendorName(v.displayName || v.companyName || ''); setVendorSearch(v.displayName || v.companyName || ''); setVendorResults([]); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: `1px solid ${T.border}` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = T.surface2}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <p style={{ margin: 0, fontWeight: 600, color: T.textPri }}>{v.displayName || v.companyName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: T.textSec }}>{v.vendorCode}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={lbl}>Payment Terms</label>
              <select value={payTerms} onChange={(e) => setPayTerms(e.target.value)} style={{ ...inp, appearance: 'auto' }}>
                {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Bill Date</label>
              <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inp} />
            </div>
            {poNumber && (
              <div>
                <label style={lbl}>Purchase Order #</label>
                <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} style={inp} />
              </div>
            )}
            {grnNumber && (
              <div>
                <label style={lbl}>GRN #</label>
                <input value={grnNumber} readOnly style={{ ...inp, background: T.surface2, color: T.textSec }} />
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div style={{ ...sec, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}` }}>
            <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Line Items</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.surface2 }}>
                  {['Description', 'Qty', 'Unit Price', 'Discount', 'Tax %', 'Line Total'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: i >= 1 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                  <th style={{ width: 36, borderBottom: `1px solid ${T.border}` }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${T.border}` }}>
                    {/* Description */}
                    <td style={{ padding: '8px 10px', minWidth: 200 }}>
                      <input value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)}
                        placeholder="Item description…" style={{ ...inp, padding: '7px 10px' }} />
                    </td>
                    {/* Qty */}
                    <td style={{ padding: '8px 6px', textAlign: 'right', minWidth: 70 }}>
                      <input type="number" min="0" step="any" value={line.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                        style={{ ...inp, padding: '7px 8px', textAlign: 'right', minWidth: 60 }} />
                    </td>
                    {/* Unit Price */}
                    <td style={{ padding: '8px 6px', textAlign: 'right', minWidth: 100 }}>
                      <input type="number" min="0" step="any" value={line.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                        placeholder="0.00" style={{ ...inp, padding: '7px 8px', textAlign: 'right', minWidth: 90 }} />
                    </td>
                    {/* Discount — value + type toggle */}
                    <td style={{ padding: '8px 6px', textAlign: 'right', minWidth: 130 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="number" min="0" step="any" value={line.discount} onChange={(e) => updateLine(idx, 'discount', e.target.value)}
                          placeholder="0" style={{ ...inp, padding: '7px 8px', textAlign: 'right', flex: 1, minWidth: 60 }} />
                        <button
                          onClick={() => updateLine(idx, 'discountType', line.discountType === 'percentage' ? 'fixed' : 'percentage')}
                          style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${T.border}`, background: line.discountType === 'percentage' ? T.blueDim : T.surface2, color: line.discountType === 'percentage' ? T.blue : T.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {line.discountType === 'percentage' ? '%' : 'AED'}
                        </button>
                      </div>
                      {line.discAmt > 0 && (
                        <p style={{ fontSize: 10, color: '#10b981', margin: '2px 0 0', textAlign: 'right', fontFamily: "'DM Mono',monospace" }}>
                          −AED {line.discAmt.toFixed(2)}
                        </p>
                      )}
                    </td>
                    {/* Tax % */}
                    <td style={{ padding: '8px 6px', textAlign: 'right', minWidth: 70 }}>
                      <input type="number" min="0" step="any" value={line.taxRate} onChange={(e) => updateLine(idx, 'taxRate', e.target.value)}
                        style={{ ...inp, padding: '7px 8px', textAlign: 'right', minWidth: 60 }} />
                    </td>
                    {/* Line total */}
                    <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.blue, fontFamily: "'DM Mono', monospace" }}>
                        AED {(line.total || 0).toFixed(2)}
                      </span>
                      {line.discAmt > 0 && (
                        <p style={{ fontSize: 10, color: T.textMuted, margin: '2px 0 0', textDecoration: 'line-through', fontFamily: "'DM Mono',monospace" }}>
                          AED {(line.gross || 0).toFixed(2)}
                        </p>
                      )}
                    </td>
                    {/* Delete */}
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <button onClick={() => removeLine(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                        <FaTrash size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 22px', borderTop: `1px solid ${T.border}` }}>
            <button onClick={addLine} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: `1.5px dashed ${T.blue}`, borderRadius: 8, background: isDark ? 'rgba(59,130,246,0.08)' : '#eff6ff', color: T.blue, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <FaPlus size={10} /> Add Line
            </button>
          </div>
        </div>

        {/* Totals */}
        <div style={{ ...sec, maxWidth: 380, marginLeft: 'auto' }}>
          {discountTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13, color: T.textSec }}>Gross Total</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>AED {grossTotal.toFixed(2)}</span>
            </div>
          )}
          {discountTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13, color: '#10b981' }}>Discount</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981', fontFamily: "'DM Mono', monospace" }}>−AED {discountTotal.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13, color: T.textSec }}>Subtotal (excl. VAT)</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>AED {subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13, color: T.textSec }}>VAT (5%)</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>AED {taxTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>Grand Total</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: T.blue, fontFamily: "'DM Mono', monospace" }}>AED {grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        <div style={sec}>
          <label style={lbl}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…" rows={3}
            style={{ ...inp, resize: 'vertical' }} />
        </div>
      </div>
    </div>
  );
}
