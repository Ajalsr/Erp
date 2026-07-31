import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { FaChevronLeft, FaPlus, FaTrash, FaCheckCircle, FaSpinner, FaChevronDown } from 'react-icons/fa';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import axiosInstance from '../../helper/axiosInstance';
import { useUnsavedGuard } from '../../helper/useUnsavedGuard';
import nexusToast from '../../helper/nexusToast';
import AppDatePicker from '../common/AppDatePicker';
import useIsMobile from '../../helper/useIsMobile';

// Normalise vendor origin variants → canonical form for RCM logic
const normOrigin = (o) => {
  const s = String(o || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (s.includes('free')) return 'free_zone';
  if (s === 'overseas')   return 'overseas';
  return 'mainland';
};
const rcmForOrigin = (o) => {
  const n = normOrigin(o);
  if (n === 'overseas')  return { rcm: true, type: 'import' };
  if (n === 'free_zone') return { rcm: true, type: 'designated_zone' };
  return { rcm: false, type: '' };
};

// ── Custom dropdown — replaces native <select> ───────────────────────────────
function CustomSelect({ value, onChange, options, placeholder = 'Select…', T, isDark, style = {} }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const selected = opts.find(o => o.value === value);
  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '9px 12px', border: `1.5px solid ${open ? '#3b82f6' : T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: selected ? T.textPri : T.textSec, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', boxShadow: open ? '0 0 0 3px rgba(59,130,246,.12)' : 'none', transition: 'border-color .15s, box-shadow .15s' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected?.label || placeholder}</span>
        <FaChevronDown size={10} style={{ flexShrink: 0, color: T.textSec, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, boxShadow: isDark ? '0 8px 32px rgba(0,0,0,.5)' : '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
          {opts.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ width: '100%', padding: '9px 14px', fontSize: 13, background: o.value === value ? (isDark ? 'rgba(59,130,246,.15)' : '#eff6ff') : 'transparent', color: o.value === value ? '#3b82f6' : T.textPri, border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontWeight: o.value === value ? 700 : 400, display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background .1s' }}>
              {o.label}
              {o.value === value && <span style={{ fontSize: 10, color: '#3b82f6' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90', 'End of Month', 'Cash on Delivery', 'Custom'];
const UAE_EMIRATES  = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
const RCM_TYPES     = [
  { value: 'import',          label: 'Import (Overseas Vendor)' },
  { value: 'designated_zone', label: 'Designated Zone' },
  { value: 'domestic_rcm',    label: 'Domestic RCM' },
];

const emptyLine = () => ({ description: '', qty: 1, unitPrice: '', taxRate: 5, discount: 0, discountType: 'fixed', freight: 0, freightTaxRate: 0, gross: 0, discAmt: 0, subtotal: 0, taxAmt: 0, total: 0 });

function calcLine(line) {
  const qty   = parseFloat(line.qty)       || 0;
  const price = parseFloat(line.unitPrice) || 0;
  const disc  = parseFloat(line.discount)  || 0;
  const gross  = round2(qty * price);
  const discAmt = line.discountType === 'percentage'
    ? round2(gross * disc / 100)
    : round2(disc);
  // Allow negative lines (e.g. adjustment); only clamp discount over-reach on positive lines
  const subtotal = round2(gross >= 0 ? Math.max(0, gross - discAmt) : gross - discAmt);
  const taxAmt   = round2(subtotal * (parseFloat(line.taxRate) / 100 || 0));
  // Per-line freight, taxed at its own rate
  const freight    = round2(parseFloat(line.freight) || 0);
  const freightTax = round2(freight * (parseFloat(line.freightTaxRate) / 100 || 0));
  return { ...line, gross, discAmt, subtotal, taxAmt, freight, freightTax, total: round2(subtotal + taxAmt + freight + freightTax) };
}

export default function NewBill() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id }   = useParams();
  const isEdit   = !!id;
  const isDark = useThemeStore((s) => s.isDark);
  const T = getTheme(isDark);
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);

  const pre = location.state || {};

  const today = new Date().toISOString().slice(0, 10);

  // Form state
  const [vendorId,       setVendorId]       = useState(pre.vendorId   || '');
  const [vendorName,     setVendorName]     = useState(pre.vendorName || '');
  const [vendorTrn,      setVendorTrn]      = useState('');
  const [vendorRef,      setVendorRef]      = useState('');
  const [billDate,       setBillDate]       = useState(today);
  const [accountingDate, setAccountingDate] = useState(today);
  const [dueDate,        setDueDate]        = useState('');
  const [payTerms,       setPayTerms]       = useState('Net 30');
  const [placeOfSupply,  setPlaceOfSupply]  = useState('Dubai');
  const [rcmApplicable,  setRcmApplicable]  = useState(pre.rcmApplicable || false);
  const [rcmType,        setRcmType]        = useState(pre.rcmType || '');
  const [poNumber,         setPoNumber]         = useState(pre.poNumber        || '');
  const [purchaseOrderId,  setPurchaseOrderId]  = useState(pre.purchaseOrderId || '');
  const [grnNumber,        setGrnNumber]        = useState(pre.grnNumber       || '');
  const [grnId,            setGrnId]            = useState(pre.grnId           || '');
  const [notes,          setNotes]          = useState('');
  const [expenseAccount, setExpenseAccount] = useState(''); // non-GRN bills: which expense account
  const [expAccounts,    setExpAccounts]    = useState([]); // expense-type accounts for the picker
  const [currency,       setCurrency]       = useState('AED');
  const [baseCurrency,   setBaseCurrency]   = useState('AED');
  const [exchangeRate,   setExchangeRate]   = useState(1);
  const [shippingCharge, setShippingCharge] = useState(pre.shippingCharges != null ? String(pre.shippingCharges) : '');
  const [adjustment,     setAdjustment]     = useState(pre.adjustment      != null ? String(pre.adjustment)      : '');
  const [lines, setLines] = useState(() => {
    if (pre.items?.length) return pre.items.map(calcLine);
    return [emptyLine()];
  });

  // 3-way match reference — snapshot of GRN-received qty + total at creation time
  const fromGRN = !!pre.fromGRN;
  const refQtyTotal   = round2((pre.items || []).reduce((s, i) => s + (parseFloat(i.qty) || 0), 0));
  // Compare against the portion billed on THIS bill (matchTotal excludes charges that
  // are billed separately to their own payee). Falls back to the full GRN total.
  const refGrandTotal = round2(parseFloat(pre.matchTotal ?? pre.total) || 0);

  // Vendor search
  const [vendorSearch,  setVendorSearch]  = useState(pre.vendorName || '');
  const [vendorResults, setVendorResults] = useState([]);

  // Auto-set RCM for pre-filled vendor (GRN/new flow, not edit — edit keeps stored RCM)
  useEffect(() => {
    if (isEdit || !pre.vendorId) return;
    if (pre.vendorOrigin) {
      const r = rcmForOrigin(pre.vendorOrigin);
      setRcmApplicable(r.rcm); setRcmType(r.type);
      return;
    }
    axiosInstance.get(`/api/vendors/${pre.vendorId}`).then(res => {
      const v = res.data?.data || res.data || {};
      const r = rcmForOrigin(v.origin);
      setRcmApplicable(r.rcm); setRcmType(r.type);
      if (!vendorTrn && v.trn) setVendorTrn(v.trn);
    }).catch(() => {});
  }, []); // eslint-disable-line

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

  // Load expense-type accounts for the non-GRN expense-account picker.
  useEffect(() => {
    axiosInstance.get('/api/accounts/?limit=500&status=active&type=expense')
      .then(r => setExpAccounts(r.data?.data?.accounts || []))
      .catch(() => {});
  }, []);

  // Edit mode — load existing bill
  const [loadedEdit, setLoadedEdit] = useState(false);
  useEffect(() => {
    if (!isEdit) return;
    axiosInstance.get(`/api/bills/${id}`).then(res => {
      const b = res.data?.data || res.data || {};
      setVendorId(b.vendorId || '');
      setVendorName(b.vendorName || '');
      setVendorSearch(b.vendorName || '');
      setVendorTrn(b.vendorTrn || '');
      setVendorRef(b.vendorRef || '');
      if (b.billDate)       setBillDate(b.billDate.slice(0, 10));
      if (b.accountingDate) setAccountingDate(b.accountingDate.slice(0, 10));
      if (b.dueDate)        setDueDate(b.dueDate.slice(0, 10));
      setPayTerms(b.paymentTerms || 'Net 30');
      setPlaceOfSupply(b.placeOfSupply || 'Dubai');
      setRcmApplicable(!!b.rcmApplicable);
      setRcmType(b.rcmType || '');
      setPoNumber(b.poNumber || '');
      setPurchaseOrderId(b.purchaseOrderId || '');
      setGrnNumber(b.grnNumber || '');
      setGrnId(b.grnId || '');
      setNotes(b.notes || '');
      setExpenseAccount(b.expenseAccount || '');
      if (b.currency) setCurrency(b.currency);
      if (b.exchangeRate > 0) setExchangeRate(b.exchangeRate);
      setShippingCharge(b.totals?.shipping   != null ? String(b.totals.shipping)   : '');
      setAdjustment(b.totals?.adjustment != null ? String(b.totals.adjustment) : '');
      if (b.lineItems?.length) {
        setLines(b.lineItems.map(li => calcLine({
          description:  li.description || '',
          qty:          li.qty || 1,
          unitPrice:    li.unitPrice || 0,
          taxRate:      li.taxRate ?? 0,
          discount:     li.discount || 0,
          discountType: li.discountType || 'fixed',
          freight:      li.freight || 0,
          freightTaxRate: li.freightTaxRate || 0,
        })));
      }
      setLoadedEdit(true);
    }).catch(() => nexusToast.error('Failed to load bill'));
  }, [id]); // eslint-disable-line

  // Auto-set due date from pay terms — skip first run in edit mode (keep stored dueDate)
  useEffect(() => {
    if (!billDate) return;
    if (isEdit && !loadedEdit) return;
    const days = { 'Due on Receipt': 0, 'Net 15': 15, 'Net 30': 30, 'Net 45': 45, 'Net 60': 60, 'Net 90': 90, 'End of Month': 30, 'Cash on Delivery': 0 };
    const d = new Date(billDate);
    d.setDate(d.getDate() + (days[payTerms] ?? 30));
    setDueDate(d.toISOString().slice(0, 10));
  }, [billDate, payTerms]);

  // Load org base currency once; default a new bill to it.
  useEffect(() => {
    axiosInstance.get('/api/exchange-rates/').then((r) => {
      const base = r.data?.baseCurrency || 'AED';
      setBaseCurrency(base);
      if (!isEdit) setCurrency((c) => (c === 'AED' ? base : c));
    }).catch(() => {});
  }, []); // eslint-disable-line

  // Resolve the txn→base rate whenever currency or bill date changes.
  useEffect(() => {
    if (!currency || currency === baseCurrency) { setExchangeRate(1); return; }
    axiosInstance.get('/api/exchange-rates/latest', { params: { from: currency, date: billDate } })
      .then((r) => setExchangeRate(r.data?.rate > 0 ? r.data.rate : 1))
      .catch(() => setExchangeRate(1));
  }, [currency, baseCurrency, billDate]);

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
  const freightTotal  = round2(lines.reduce((s, l) => s + (l.freight || 0), 0));
  const freightTaxTot = round2(lines.reduce((s, l) => s + (l.freightTax || 0), 0));
  const subtotal      = round2(lines.reduce((s, l) => s + (l.subtotal || 0), 0) + freightTotal);
  const taxTotal      = round2(lines.reduce((s, l) => s + (l.taxAmt  || 0), 0) + freightTaxTot);
  const shipAmt       = round2(parseFloat(shippingCharge) || 0);
  const adjAmt        = round2(parseFloat(adjustment) || 0);
  const grandTotal    = round2(subtotal + taxTotal + shipAmt + adjAmt);

  // 3-way match: compare current bill vs GRN reference (qty + value)
  const curQtyTotal   = round2(lines.reduce((s, l) => s + (parseFloat(l.qty) || 0), 0));
  const qtyOver       = fromGRN && curQtyTotal > refQtyTotal + 0.001;
  const TOLERANCE     = 0.01; // 1% price tolerance, SAP-style
  const priceVariance = fromGRN && refGrandTotal > 0 && Math.abs(grandTotal - refGrandTotal) > refGrandTotal * TOLERANCE;
  const matchStatus   = (qtyOver || priceVariance) ? 'mismatch' : 'matched';

  const handleSubmit = async () => {
    if (!vendorId) { nexusToast.error('Vendor is required'); return; }
    if (!lines.some((l) => l.description && parseFloat(l.qty) > 0)) {
      nexusToast.error('Add at least one line item'); return;
    }
    // 3-way match is warn-only — banner already surfaces the variance; status stored on the bill.
    setSaving(true);
    try {
      const payload = {
        vendorId,
        vendorName,
        vendorTrn:      vendorTrn      || undefined,
        vendorRef:      vendorRef      || undefined,
        billDate,
        accountingDate: accountingDate || undefined,
        dueDate,
        currency,
        exchangeRate,
        paymentTerms:   payTerms,
        placeOfSupply:  placeOfSupply  || undefined,
        rcmApplicable,
        rcmType:        rcmApplicable ? rcmType : undefined,
        rcmOutputVat:   rcmApplicable ? round2(subtotal * 0.05) : undefined,
        rcmInputVat:    rcmApplicable ? round2(subtotal * 0.05) : undefined,
        poNumber:         poNumber         || undefined,
        purchaseOrderId:  purchaseOrderId  || undefined,
        grnId:            grnId            || undefined,
        grnNumber:        grnNumber        || undefined,
        // GRN bills capitalise to Inventory; only non-GRN expense bills carry an account.
        expenseAccount: grnId ? undefined : (expenseAccount || undefined),
        notes:          notes          || undefined,
        lineItems: lines.filter((l) => l.description).map((l) => ({
          description:  l.description,
          qty:          parseFloat(l.qty)       || 0,
          unitPrice:    parseFloat(l.unitPrice) || 0,
          taxRate:      parseFloat(l.taxRate)   || 0,
          discount:     parseFloat(l.discount)  || 0,
          discountType: l.discountType || 'fixed',
          discountAmt:  l.discAmt || 0,
          freight:        l.freight || 0,
          freightTaxRate: parseFloat(l.freightTaxRate) || 0,
          taxAmt:       l.taxAmt,
          subtotal:     l.subtotal,
          total:        l.total,
        })),
        totals: { grossTotal, discountTotal, subtotal, taxTotal, shipping: shipAmt, adjustment: adjAmt, grandTotal },
        threeWayMatchStatus: fromGRN ? matchStatus : 'na',
      };
      if (isEdit) {
        await axiosInstance.put(`/api/bills/${id}`, payload);
        nexusToast.success('Bill updated successfully!');
      } else {
        await axiosInstance.post('/api/bills/', { ...payload, status: 'open' });
        nexusToast.success('Bill created successfully!');
      }
      setTimeout(() => navigate('/Purchase/Bills'), 1000);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} bill`);
    } finally {
      setSaving(false);
    }
  };

  const inp = { width: '100%', padding: '9px 12px', border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, background: T.surface, color: T.textPri, fontFamily: 'inherit', outline: 'none' };
  const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 };
  const sec = { background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: isMobile ? '16px' : '20px 22px', marginBottom: 16, boxShadow: isDark ? '0 2px 10px rgba(0,0,0,.25)' : '0 1px 4px rgba(0,0,0,.05)' };

  const guard = useUnsavedGuard({ hasDraft: false });

  return (
    <div onInput={guard.markDirty} onChange={guard.markDirty} style={{ minHeight: '100vh', background: T.bg, padding: isMobile ? '14px 14px 70px' : '20px 20px 90px', color: T.textPri, fontFamily: "'DM Sans', sans-serif", overflowX: 'hidden' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');`}</style>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Top bar */}
        <div style={{ position: isMobile ? 'static' : 'sticky', top: 0, zIndex: 30, background: isMobile ? T.bg : (isDark ? 'rgba(8,13,26,.95)' : 'rgba(241,245,249,.95)'), backdropFilter: isMobile ? 'none' : 'blur(12px)', padding: isMobile ? '0' : '12px 0', marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, minWidth: 0 }}>
              <button onClick={() => guard.leave(() => navigate('/Purchase/Bills'))} style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <FaChevronLeft size={13} />
              </button>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: isMobile ? 15 : 17, fontWeight: 800, color: T.textPri, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isEdit ? 'Edit Vendor Bill' : 'New Vendor Bill'}</h1>
                {pre.fromGRN && !isMobile && <p style={{ fontSize: 11, color: T.blue, margin: '2px 0 0' }}>Created from GRN: {pre.grnNumber}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
              <button onClick={() => guard.leave(() => navigate('/Purchase/Bills'))} style={{ padding: '9px 18px', border: `1.5px solid ${T.border}`, borderRadius: 9, background: 'transparent', color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer', flex: isMobile ? 1 : 'none' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 20px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, flex: isMobile ? 1 : 'none' }}>
                {saving ? <><FaSpinner size={12} style={{ animation: 'spin .7s linear infinite' }} /> Saving…</> : <><FaCheckCircle size={12} /> {isEdit ? 'Update Bill' : 'Save Bill'}</>}
              </button>
            </div>
          </div>
        </div>

        {/* 3-way match banner */}
        {fromGRN && (
          <div style={{ ...sec, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
            background: matchStatus === 'mismatch' ? (isDark ? 'rgba(245,158,11,.08)' : '#fffbeb') : (isDark ? 'rgba(16,185,129,.08)' : '#f0fdf4'),
            borderColor: matchStatus === 'mismatch' ? (isDark ? 'rgba(245,158,11,.3)' : '#fde68a') : (isDark ? 'rgba(16,185,129,.3)' : '#bbf7d0') }}>
            <span style={{ fontSize: 16 }}>{matchStatus === 'mismatch' ? '⚠️' : '✅'}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: matchStatus === 'mismatch' ? '#d97706' : '#059669', margin: 0 }}>
                3-Way Match: {matchStatus === 'mismatch' ? 'Mismatch vs GRN' : 'Matched'}
              </p>
              <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>
                {qtyOver       && <span>Billed qty {curQtyTotal} &gt; received {refQtyTotal}. </span>}
                {priceVariance && <span>Bill total {grandTotal.toFixed(2)} vs GRN {refGrandTotal.toFixed(2)}. </span>}
                {matchStatus === 'matched' && <span>Qty {curQtyTotal} = received {refQtyTotal}, total within tolerance.</span>}
              </p>
            </div>
          </div>
        )}

        {/* Vendor + header */}
        <div style={sec}>
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: T.textPri, margin: '0 0 16px' }}>Bill Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 12 : 16, marginBottom: 16 }}>
            <div style={{ position: 'relative' }}>
              <label style={lbl}>Vendor <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={vendorSearch} onChange={(e) => { setVendorSearch(e.target.value); setVendorId(''); setVendorName(''); }}
                placeholder="Search vendor…" style={inp} />
              {vendorResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)', marginTop: 3 }}>
                  {vendorResults.map((v) => (
                    <div key={v._id} onClick={() => {
                      setVendorId(v._id);
                      setVendorName(v.displayName || v.companyName || '');
                      setVendorSearch(v.displayName || v.companyName || '');
                      setVendorTrn(v.trn || '');
                      setVendorResults([]);
                      const r = rcmForOrigin(v.origin);
                      setRcmApplicable(r.rcm);
                      setRcmType(r.type);
                    }}
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
              <CustomSelect value={payTerms} onChange={setPayTerms} options={PAYMENT_TERMS} T={T} isDark={isDark} />
            </div>
            <div>
              <label style={lbl}>Bill Date</label>
              <AppDatePicker value={billDate} onChange={setBillDate} />
            </div>
            <div>
              <label style={lbl}>Due Date</label>
              <AppDatePicker value={dueDate} onChange={setDueDate} />
            </div>
            <div>
              <label style={lbl}>Accounting Date</label>
              <AppDatePicker value={accountingDate} onChange={setAccountingDate} />
            </div>
            <div>
              <label style={lbl}>Currency</label>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
                placeholder={baseCurrency}
                style={{ ...inp, textTransform: 'uppercase' }}
              />
              {currency && currency !== baseCurrency && (
                <span style={{ display: 'block', fontSize: 11, color: T.textSec, marginTop: 4 }}>
                  1 {currency} = {Number(exchangeRate).toLocaleString('en-AE', { maximumFractionDigits: 6 })} {baseCurrency} · books in {baseCurrency}
                </span>
              )}
            </div>
            <div>
              <label style={lbl}>Vendor Ref (Invoice #)</label>
              <input value={vendorRef} onChange={(e) => setVendorRef(e.target.value)} placeholder="Vendor's own invoice number" style={inp} />
            </div>
            {vendorTrn && (
              <div>
                <label style={lbl}>Vendor TRN</label>
                <input value={vendorTrn} readOnly style={{ ...inp, background: T.surface2, color: T.textSec, fontFamily: "'DM Mono',monospace", letterSpacing: '0.05em' }} />
              </div>
            )}
            <div>
              <label style={lbl}>Place of Supply</label>
              <CustomSelect value={placeOfSupply} onChange={setPlaceOfSupply} options={UAE_EMIRATES} T={T} isDark={isDark} />
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

          {/* RCM */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 8, padding: '12px 0', borderTop: `1px solid ${T.border}` }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textPri }}>
              <input type="checkbox" checked={rcmApplicable} onChange={(e) => { setRcmApplicable(e.target.checked); if (!e.target.checked) setRcmType(''); }}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              Reverse Charge Mechanism (RCM) Applicable
            </label>
            {rcmApplicable && (
              <CustomSelect value={rcmType} onChange={setRcmType}
                options={[{ value: '', label: 'Select RCM Type…' }, ...RCM_TYPES]}
                placeholder="Select RCM Type…" T={T} isDark={isDark} style={{ width: 'auto', minWidth: 220 }} />
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
                      {(line.freight || 0) > 0 && (
                        <p style={{ fontSize: 10, color: '#f59e0b', margin: '2px 0 0', fontFamily: "'DM Mono',monospace" }}>
                          🚚 frt AED {(line.freight || 0).toFixed(2)}{line.freightTaxRate > 0 ? ` +${line.freightTaxRate}%` : ''}
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
        <div style={{ ...sec, maxWidth: isMobile ? '100%' : 380, marginLeft: isMobile ? 0 : 'auto' }}>
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
          {freightTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 13, color: '#f59e0b' }}>🚚 Freight (incl. in subtotal)</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>AED {freightTotal.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13, color: T.textSec }}>VAT</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textPri, fontFamily: "'DM Mono', monospace" }}>AED {taxTotal.toFixed(2)}</span>
          </div>
          {/* Shipping + Adjustment — editable header charges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13, color: T.textSec }}>🚚 Shipping Charges</span>
            <input type="number" min="0" step="any" value={shippingCharge} onChange={(e) => setShippingCharge(e.target.value)}
              placeholder="0.00"
              style={{ width: 110, padding: '5px 8px', border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, background: T.surface2, color: T.textPri, fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'right' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 13, color: T.textSec }}>± Adjustment</span>
            <input type="number" step="any" value={adjustment} onChange={(e) => setAdjustment(e.target.value)}
              placeholder="0.00"
              style={{ width: 110, padding: '5px 8px', border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 13, background: T.surface2, color: T.textPri, fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'right' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>Grand Total</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: T.blue, fontFamily: "'DM Mono', monospace" }}>AED {grandTotal.toFixed(2)}</span>
          </div>

          {Array.isArray(pre.separateCharges) && pre.separateCharges.length > 0 && (
            <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: isDark ? 'rgba(139,92,246,.08)' : '#f5f3ff', border: `1px solid ${isDark ? 'rgba(139,92,246,.25)' : '#ddd6fe'}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>⚡ Billed separately ({pre.separateCharges.length})</div>
              {pre.separateCharges.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: T.textSec, marginBottom: 3 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label} → {c.payeeName}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: T.textPri, flexShrink: 0 }}>AED {Number(c.total || 0).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, fontWeight: 700, color: '#7c3aed', borderTop: `1px solid ${isDark ? 'rgba(139,92,246,.2)' : '#ddd6fe'}`, marginTop: 5, paddingTop: 5 }}>
                <span>Separate bill total</span>
                <span style={{ fontFamily: "'DM Mono', monospace" }}>AED {pre.separateCharges.reduce((s, c) => s + (Number(c.total) || 0), 0).toFixed(2)}</span>
              </div>
              <p style={{ fontSize: 10, color: T.textSec, margin: '6px 0 0', lineHeight: 1.4 }}>These charges are auto-billed to their payee as a paid bill — not part of this vendor bill.</p>
            </div>
          )}
        </div>

        {/* Expense Account — only for non-GRN bills (GRN bills capitalise to Inventory) */}
        {!grnId && !fromGRN && (
          <div style={sec}>
            <label style={lbl}>Expense Account</label>
            <CustomSelect
              value={expenseAccount}
              onChange={setExpenseAccount}
              options={[
                { value: '', label: 'Cost of Goods Sold (default)' },
                ...expAccounts.map(a => ({ value: a._id, label: `[${a.accountCode}] ${a.accountName}` })),
              ]}
              T={T} isDark={isDark}
            />
            <p style={{ fontSize: 11, color: T.textSec, margin: '6px 0 0' }}>
              Which account this bill is booked to (rent, utilities, services…).
            </p>
          </div>
        )}

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
