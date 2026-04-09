import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import useGetItem from '../../helper/useGetItem';
import axiosInstance from '../../helper/axiosInstance';
import nexusToast from '../../helper/nexusToast';
import { debounce } from 'lodash';
import {
  FaPlus, FaTrash, FaChevronLeft, FaSearch,
  FaBox, FaPercent, FaMoneyBillWave, FaTag,
  FaCheckCircle, FaFileInvoiceDollar, FaBarcode,
  FaWarehouse, FaMoneyBill,
} from 'react-icons/fa';

/* ─── CSS ──────────────────────────────────────────────────────────────── */
const buildCSS = (isDark) => {
  const bg       = isDark ? '#080d1a' : '#f1f5f9';
  const surface  = isDark ? '#0d1526' : '#ffffff';
  const surface2 = isDark ? '#111d30' : '#f8fafc';
  const border   = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
  const border2  = isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9';
  const text     = isDark ? '#e2e8f0' : '#0f172a';
  const textSec  = isDark ? '#64748b' : '#64748b';
  const textMuted= isDark ? '#475569' : '#94a3b8';
  const inp      = isDark ? '#111d30' : '#ffffff';
  const inpBdr   = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
  const tblHead  = isDark ? '#0a1220' : '#f8fafc';
  const scrollThumb = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';

  return `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');
  .npo-root*,.npo-root *::before,.npo-root *::after{box-sizing:border-box;}
  .npo-root{font-family:'DM Sans',sans-serif;color:${text};background:${bg};}
  .npo-root input,.npo-root select,.npo-root textarea,.npo-root button{font-family:'DM Sans',sans-serif;color:${text};}
  .npo-root input::placeholder,.npo-root textarea::placeholder{color:${textMuted};}
  .npo-root *::-webkit-scrollbar{width:5px;height:5px;}
  .npo-root *::-webkit-scrollbar-track{background:transparent;}
  .npo-root *::-webkit-scrollbar-thumb{background:${scrollThumb};border-radius:99px;}
  @keyframes npoFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes npoSlide{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes npoSpin{to{transform:rotate(360deg)}}
  .npo-card{animation:npoFadeUp .3s ease both;}
  .npo-dd{animation:npoSlide .18s ease both;}
  .npo-inp{width:100%;padding:10px 14px;border:1.5px solid ${inpBdr};border-radius:10px;font-size:13px;color:${text};background:${inp};outline:none;transition:border-color .15s,box-shadow .15s;}
  .npo-inp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12);}
  .npo-lbl{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${textSec};margin-bottom:6px;}
  .npo-req{color:#ef4444;margin-left:2px;}
  .npo-section{background:${surface};border-radius:16px;border:1.5px solid ${border};overflow:hidden;margin-bottom:16px;box-shadow:${isDark?'0 2px 12px rgba(0,0,0,.3)':'0 1px 4px rgba(0,0,0,.04)'};}
  .npo-sbar{height:3px;}
  .npo-sin{padding:22px 24px;}
  .npo-stitle{font-family:'Sora',sans-serif;font-size:14px;font-weight:700;color:${text};margin:0 0 18px;letter-spacing:-.02em;display:flex;align-items:center;gap:9px;}
  .npo-sicon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
  .npo-table{width:100%;border-collapse:separate;border-spacing:0;}
  .npo-table thead tr th{padding:11px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${textMuted};background:${tblHead};border-bottom:1.5px solid ${border};text-align:left;white-space:nowrap;}
  .npo-table tbody tr{transition:background .12s;}
  .npo-table tbody tr:hover{background:${surface2};}
  .npo-table tbody tr td{padding:12px 14px;border-bottom:1.5px solid ${border2};vertical-align:middle;}
  .npo-table tbody tr:last-child td{border-bottom:none;}
  .npo-tinp{width:100%;padding:8px 11px;border:1.5px solid ${inpBdr};border-radius:8px;font-size:13px;color:${text};background:${inp};outline:none;transition:border-color .15s,box-shadow .15s;font-family:'DM Sans',sans-serif;}
  .npo-tinp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
  .npo-qty{display:flex;align-items:center;}
  .npo-qbtn{width:28px;height:34px;border:1.5px solid ${inpBdr};background:${surface2};color:${textSec};cursor:pointer;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:all .12s;flex-shrink:0;}
  .npo-qbtn:first-child{border-radius:8px 0 0 8px;border-right:none;}
  .npo-qbtn:last-child{border-radius:0 8px 8px 0;border-left:none;}
  .npo-qbtn:hover{background:${isDark?'rgba(255,255,255,0.08)':'#e0e7ef'};color:${text};}
  .npo-qnum{width:44px;height:34px;text-align:center;border:1.5px solid ${inpBdr};border-left:none;border-right:none;font-size:13px;font-weight:600;color:${text};background:${inp};outline:none;font-family:'DM Mono',monospace;}
  .npo-amt{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${text};white-space:nowrap;padding:8px 12px;background:${surface2};border:1.5px solid ${border};border-radius:8px;min-width:110px;text-align:right;display:inline-block;}
  .npo-dtype{padding:8px 10px;border:1.5px solid ${inpBdr};border-radius:8px 0 0 8px;border-right:none;background:${surface2};color:${textSec};cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;transition:all .12s;display:flex;align-items:center;gap:4px;}
  .npo-dtype:hover{background:${isDark?'rgba(59,130,246,0.15)':'#eff6ff'};color:#3b82f6;border-color:#3b82f6;}
  .npo-dinp{flex:1;min-width:60px;padding:8px 10px;border:1.5px solid ${inpBdr};border-radius:0 8px 8px 0;font-size:13px;color:${text};background:${inp};outline:none;transition:border-color .15s;font-family:'DM Mono',monospace;}
  .npo-dinp:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
  .npo-srow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;}
  .npo-srow+.npo-srow{border-top:1px solid ${border2};}
  .npo-bg{padding:10px 20px;border:1.5px solid ${border};border-radius:10px;background:${surface};color:${textSec};font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
  .npo-bg:hover{background:${surface2};color:${text};}
  .npo-bp{padding:10px 24px;border:none;border-radius:10px;background:#3b82f6;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;font-family:'DM Sans',sans-serif;box-shadow:0 4px 12px rgba(59,130,246,.3);display:flex;align-items:center;gap:7px;}
  .npo-bp:hover:not(:disabled){background:#2563eb;box-shadow:0 8px 20px rgba(59,130,246,.4);transform:translateY(-1px);}
  .npo-bp:disabled{opacity:.45;cursor:not-allowed;}
  .npo-addrow{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border:1.5px dashed #3b82f6;border-radius:10px;background:${isDark?'rgba(59,130,246,0.1)':'#eff6ff'};color:#3b82f6;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
  .npo-addrow:hover{background:${isDark?'rgba(59,130,246,0.18)':'#dbeafe'};border-color:#2563eb;}
  .npo-idd{background:${surface};border:1.5px solid ${border};border-radius:14px;box-shadow:${isDark?'0 20px 60px rgba(0,0,0,.5)':'0 20px 60px rgba(0,0,0,.12)'};max-height:380px;overflow-y:auto;}
  .npo-irow{padding:11px 14px;cursor:pointer;border-bottom:1px solid ${border2};transition:background .1s;display:flex;gap:12px;align-items:flex-start;}
  .npo-irow:last-child{border-bottom:none;}
  .npo-irow:hover{background:${isDark?'rgba(59,130,246,0.08)':'#eff6ff'};}
  .npo-bottombar{position:fixed;bottom:0;left:220px;right:0;z-index:20;background:${isDark?'rgba(8,13,26,.97)':'rgba(255,255,255,.97)'};backdrop-filter:blur(14px);border-top:1.5px solid ${border};padding:14px 32px;display:flex;align-items:center;justify-content:space-between;box-shadow:${isDark?'0 -8px 32px rgba(0,0,0,.4)':'0 -8px 32px rgba(0,0,0,.06)'};}
  `;
};

/* ─── DropdownPortal (same as Newsalesorders) ──────────────────────────── */
const DropdownPortal = ({ children, targetRef, isVisible }) => {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  useEffect(() => {
    if (targetRef?.current && isVisible) {
      const r = targetRef.current.getBoundingClientRect();
      setPos({ top: r.bottom, left: r.left, width: r.width });
    }
  }, [targetRef, isVisible]);
  if (!children || !isVisible) return null;
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', zIndex: 9999, top: pos.top + 4, left: pos.left, width: Math.max(pos.width, 480) }}>
      {children}
    </div>,
    document.body
  );
};

/* ─── Field ────────────────────────────────────────────────────────────── */
const Field = ({ label, req, children }) => (
  <div>
    <label className="npo-lbl">{label}{req && <span className="npo-req">*</span>}</label>
    {children}
  </div>
);

/* ─── Constants ─────────────────────────────────────────────────────────── */
const TAX_RATE = 0.05;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const calcLineBase = (qty, rate, discount, discountType) => {
  const base = qty * rate;
  if (discountType === 'percentage') return round2(base - base * (discount / 100));
  if (discountType === 'fixed')      return round2(Math.max(0, base - discount));
  return round2(base);
};

const buildTaxGroups = (items) => {
  const order = [], groups = {};
  items.forEach(item => {
    if (!item.rate || !item.quantity) return;
    const base = calcLineBase(parseFloat(item.quantity)||0, parseFloat(item.rate)||0, parseFloat(item.discount)||0, item.discountType);
    const key = item.rate;
    if (!groups[key]) { groups[key] = { rate: item.rate, base: 0 }; order.push(key); }
    groups[key].base = round2(groups[key].base + base);
  });
  return order.map(rate => ({
    rate, taxRate: 5,
    baseAmount: round2(groups[rate].base),
    taxAmount: round2(groups[rate].base * TAX_RATE),
  }));
};

/* ════════════════════ MAIN ════════════════════════════════════════════════ */
export default function Newpurchaseorders() {
  const navigate = useNavigate();
  const isDark   = useThemeStore(s => s.isDark);
  const T        = getTheme(isDark);

  /* ── Item state ── */
  const [items, setItems] = useState([{
    id: 1, itemId: '', details: '', sku: '', quantity: 1,
    rate: '', discount: '', discountType: 'percentage', amount: '', unit: '',
  }]);
  const [showItemDropdown, setShowItemDropdown] = useState(null);
  const [searchTerm,       setSearchTerm]       = useState('');
  const [filteredItems,    setFilteredItems]     = useState([]);
  const itemInputRefs = useRef([]);

  /* ── Form state ── */
  const [vendor,        setVendor]        = useState('');
  const [orderDate,     setOrderDate]     = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate,  setExpectedDate]  = useState('');
  const [paymentTerms,  setPaymentTerms]  = useState('Due on Receipt');
  const [deliveryAddr,  setDeliveryAddr]  = useState('organization');
  const [shipPref,      setShipPref]      = useState('');
  const [referenceNo,   setReferenceNo]   = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [terms,         setTerms]         = useState('');
  const [shipping,      setShipping]      = useState('0');
  const [adjustment,    setAdjustment]    = useState('0');
  const [saving,        setSaving]        = useState(false);

  /* ── Inventory ── */
  const { handleGetItem, data: inventoryData, loading: inventoryLoading } = useGetItem();

  useEffect(() => { handleGetItem(); }, []);

  /* ── Filter — same pattern as Newsalesorders ── */
  useEffect(() => {
    if (!inventoryData) return;
    setFilteredItems(
      !searchTerm
        ? inventoryData.slice(0, 10)
        : inventoryData.filter(i =>
            i.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.sku?.toLowerCase().includes(searchTerm.toLowerCase())
          ).slice(0, 10)
    );
  }, [searchTerm, inventoryData]);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const h = e => {
      if (showItemDropdown !== null) {
        const onInput    = itemInputRefs.current[showItemDropdown]?.contains(e.target);
        const onDropdown = document.querySelector('.item-dropdown-po')?.contains(e.target);
        if (!onInput && !onDropdown) setShowItemDropdown(null);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showItemDropdown]);

  const debouncedSearch = useCallback(debounce(t => setSearchTerm(t), 300), []);

  /* ── Computed totals ── */
  const computedItems = items.map(item => {
    const qty  = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate)     || 0;
    const disc = parseFloat(item.discount) || 0;
    const base = calcLineBase(qty, rate, disc, item.discountType);
    const tax  = round2(base * TAX_RATE);
    return { ...item, base, tax, amount: round2(base + tax) };
  });

  const taxGroups  = buildTaxGroups(computedItems);
  const subTotal   = round2(computedItems.reduce((s, i) => s + i.base, 0));
  const totalTax   = round2(taxGroups.reduce((s, g) => s + g.taxAmount, 0));
  const shipAmt    = round2(parseFloat(shipping)   || 0);
  const adjAmt     = round2(parseFloat(adjustment) || 0);
  const grandTotal = round2(subTotal + totalTax + shipAmt + adjAmt);
  const hasItemsAdded = items.some(i => i.details && i.quantity > 0);
  const fmtAED = (n) => `AED ${(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`;

  /* ── Item handlers ── */
  const addNewRow = () => {
    const id = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems([...items, { id, itemId: '', details: '', sku: '', quantity: 1, rate: '', discount: '', discountType: 'percentage', amount: '', unit: '' }]);
  };

  const handleRemoveItem = (idx) => {
    if (items.length <= 1) {
      const u = [...items];
      u[idx] = { id: u[idx].id, itemId: '', details: '', sku: '', quantity: 1, rate: '', discount: '', discountType: 'percentage', amount: '', unit: '' };
      setItems(u); return;
    }
    setItems(items.filter((_, i) => i !== idx));
    if (showItemDropdown === idx) setShowItemDropdown(null);
  };

  const handleItemSelect = (idx, sel) => {
    const u    = [...items];
    const rate = parseFloat(sel.selling_price || sel.price || 0);
    const qty  = parseFloat(u[idx].quantity) || 1;
    const disc = parseFloat(u[idx].discount) || 0;
    const base = calcLineBase(qty, rate, disc, u[idx].discountType);
    u[idx] = { ...u[idx], itemId: sel._id, details: sel.name || 'No name', sku: sel.sku || sel.item_code || '', rate, unit: sel.unit || sel.Unit || 'pcs', quantity: qty, amount: String(round2(base + base * TAX_RATE)) };
    setItems(u);
    setShowItemDropdown(null);
    setSearchTerm('');
  };

  const handleQuantityChange = (idx, val) => {
    const u = [...items], qty = parseFloat(val) || 1;
    u[idx].quantity = qty;
    if (u[idx].rate) { const base = calcLineBase(qty, parseFloat(u[idx].rate), parseFloat(u[idx].discount)||0, u[idx].discountType); u[idx].amount = String(round2(base + base * TAX_RATE)); }
    setItems(u);
  };

  const handleRateChange = (idx, val) => {
    const u = [...items], rate = parseFloat(val) || 0;
    u[idx].rate = val;
    if (u[idx].quantity) { const base = calcLineBase(parseFloat(u[idx].quantity)||0, rate, parseFloat(u[idx].discount)||0, u[idx].discountType); u[idx].amount = String(round2(base + base * TAX_RATE)); }
    setItems(u);
  };

  const handleDiscountChange = (idx, val) => {
    const u = [...items];
    u[idx].discount = val;
    if (u[idx].quantity && u[idx].rate) { const base = calcLineBase(parseFloat(u[idx].quantity)||0, parseFloat(u[idx].rate)||0, parseFloat(val)||0, u[idx].discountType); u[idx].amount = String(round2(base + base * TAX_RATE)); }
    setItems(u);
  };

  const handleDiscountTypeChange = (idx, type) => {
    const u = [...items];
    u[idx].discountType = type;
    if (u[idx].quantity && u[idx].rate && u[idx].discount) { const base = calcLineBase(parseFloat(u[idx].quantity)||0, parseFloat(u[idx].rate)||0, parseFloat(u[idx].discount)||0, type); u[idx].amount = String(round2(base + base * TAX_RATE)); }
    setItems(u);
  };

  /* ── Submit ── */
  const handleSubmit = async (status = 'draft') => {
    if (!vendor.trim()) { nexusToast.error('Vendor name is required'); return; }
    if (!hasItemsAdded) { nexusToast.error('Add at least one item'); return; }
    setSaving(true);
    try {
      const payload = {
        vendorName: vendor, orderDate: new Date(orderDate).toISOString(),
        expectedDeliveryDate: expectedDate ? new Date(expectedDate).toISOString() : null,
        paymentTerms, deliveryAddress: deliveryAddr, shipmentPreference: shipPref, referenceNo,
        items: computedItems.filter(i => i.details && i.quantity > 0).map(i => ({
          itemId: i.itemId, details: i.details, quantity: parseFloat(i.quantity),
          rate: parseFloat(i.rate)||0, discount: parseFloat(i.discount)||0, discountType: i.discountType, unit: i.unit,
        })),
        shippingCharges: shipAmt, adjustment: adjAmt, customerNotes, termsAndConditions: terms, status,
      };
      await axiosInstance.post('/api/purchase-orders/', payload);
      nexusToast.success('Purchase order created successfully!');
      setTimeout(() => navigate('/Purchase/Purchaseorders'), 1500);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to create purchase order');
    } finally { setSaving(false); }
  };

  /* ─────────────────────────── RENDER ─────────────────────────────────── */
  return (
    <div className="npo-root" style={{ minHeight: '100vh', background: T.bg, padding: '20px 20px 90px' }}>
      <style>{buildCSS(isDark)}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Top bar ── */}
        <div style={{ position: 'sticky', top: 0, zIndex: 30, background: isDark ? 'rgba(8,13,26,.95)' : 'rgba(241,245,249,.95)', backdropFilter: 'blur(12px)', padding: '12px 0', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => navigate('/Purchase/Purchaseorders')} style={{ width: 36, height: 36, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <FaChevronLeft size={13} />
              </button>
              <div style={{ width: 1, height: 24, background: T.border }} />
              <div>
                <h1 style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: T.textPri, margin: 0, letterSpacing: '-.02em' }}>New Purchase Order</h1>
                <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>Purchase → Purchase Orders</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ padding: '5px 12px', borderRadius: 99, background: '#fef9c3', border: '1.5px solid #fef08a', fontSize: 11, fontWeight: 700, color: '#854d0e', letterSpacing: '.04em' }}>● DRAFT</span>
              <button onClick={() => navigate('/Purchase/Purchaseorders')} className="npo-bg">Cancel</button>
              <button onClick={() => handleSubmit('draft')} className="npo-bg" disabled={saving || !hasItemsAdded} style={{ fontWeight: 700 }}>{saving ? 'Saving…' : 'Save Draft'}</button>
              <button onClick={() => handleSubmit('open')} className="npo-bp" disabled={saving || !vendor.trim() || !hasItemsAdded}>
                {saving ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'npoSpin .7s linear infinite' }} />Processing…</> : <><FaCheckCircle size={12} />Save & Submit</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Order Info ── */}
        <div className="npo-section npo-card">
          <div className="npo-sbar" style={{ background: 'linear-gradient(90deg,#3b82f6,transparent 80%)' }} />
          <div className="npo-sin">
            <div className="npo-stitle"><div className="npo-sicon" style={{ background: '#3b82f618', color: '#3b82f6' }}><FaFileInvoiceDollar /></div>Order Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <Field label="Vendor Name" req><input className="npo-inp" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Enter vendor name" /></Field>
              </div>
              <Field label="Reference #"><input className="npo-inp" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="PO-REF-001" style={{ fontFamily: "'DM Mono',monospace" }} /></Field>
              <Field label="Order Date" req><input className="npo-inp" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} /></Field>
              <Field label="Expected Delivery"><input className="npo-inp" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></Field>
              <Field label="Payment Terms">
                <select className="npo-inp" style={{ appearance: 'none', cursor: 'pointer' }} value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                  {['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'].map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Shipment Preference">
                <select className="npo-inp" style={{ appearance: 'none', cursor: 'pointer' }} value={shipPref} onChange={e => setShipPref(e.target.value)}>
                  <option value="">Choose preference</option>
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="overnight">Overnight</option>
                </select>
              </Field>
              <div style={{ gridColumn: '1/-1' }}>
                <Field label="Delivery Address">
                  <div style={{ display: 'flex', gap: 20 }}>
                    {['organization', 'customer'].map(opt => (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: T.textPri }}>
                        <input type="radio" value={opt} checked={deliveryAddr === opt} onChange={e => setDeliveryAddr(e.target.value)} style={{ accentColor: '#3b82f6' }} />
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* ── Line Items ── */}
        <div className="npo-section npo-card">
          <div className="npo-sbar" style={{ background: 'linear-gradient(90deg,#10b981,transparent 80%)' }} />
          <div className="npo-sin">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div className="npo-stitle" style={{ margin: 0 }}>
                <div className="npo-sicon" style={{ background: '#10b98118', color: '#10b981' }}><FaBox /></div>
                Line Items
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: '#d1fae5', padding: '2px 9px', borderRadius: 99, marginLeft: 4 }}>{items.filter(i => i.details).length} added</span>
              </div>
              <button onClick={addNewRow} className="npo-addrow"><FaPlus style={{ fontSize: 11 }} /> Add Item Row</button>
            </div>

            <div style={{ borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${T.border}` }}>
              <table className="npo-table">
                <thead><tr>
                  <th style={{ width: '35%' }}>Item Details</th>
                  <th>Quantity</th>
                  <th>Rate (AED)</th>
                  <th>Discount</th>
                  <th style={{ textAlign: 'right' }}>Amount (excl. VAT)</th>
                  <th style={{ width: 40 }}></th>
                </tr></thead>
                <tbody>
                  {items.map((item, index) => {
                    const comp = computedItems[index];
                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ position: 'relative' }} ref={el => itemInputRefs.current[index] = el}>
                            <input className="npo-tinp" placeholder="Search or type item name…" value={item.details}
                              onChange={e => {
                                const u = [...items]; u[index].details = e.target.value; setItems(u);
                                debouncedSearch(e.target.value);
                                setShowItemDropdown(index);
                              }}
                              onFocus={() => { setShowItemDropdown(index); if (!item.details) setSearchTerm(''); }}
                            />
                            {item.sku && (
                              <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: T.textSec }}>
                                <FaBarcode style={{ fontSize: 9 }} />
                                <span style={{ fontFamily: "'DM Mono',monospace" }}>{item.sku}</span>
                                {item.unit && <span>· {item.unit}</span>}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="npo-qty">
                            <button className="npo-qbtn" onClick={() => handleQuantityChange(index, Math.max(1, (parseFloat(item.quantity)||1) - 1))}>−</button>
                            <input type="number" className="npo-qnum" value={item.quantity} onChange={e => handleQuantityChange(index, e.target.value)} min="1" />
                            <button className="npo-qbtn" onClick={() => handleQuantityChange(index, (parseFloat(item.quantity)||1) + 1)}>+</button>
                          </div>
                        </td>
                        <td><input type="text" value={item.rate} onChange={e => handleRateChange(index, e.target.value)} className="npo-tinp" placeholder="0.00" style={{ fontFamily: "'DM Mono',monospace", width: 110 }} /></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <button type="button" className="npo-dtype"
                              onClick={() => handleDiscountTypeChange(index, item.discountType === 'percentage' ? 'fixed' : 'percentage')}
                              style={{ minWidth: 52, fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700 }}>
                              {item.discountType === 'percentage' ? <><FaPercent style={{ fontSize: 9 }} />&nbsp;<span>%</span></> : <><span style={{ fontSize: 10 }}>AED</span></>}
                            </button>
                            <input type="number" value={item.discount} onChange={e => handleDiscountChange(index, e.target.value)} className="npo-dinp"
                              placeholder={item.discountType === 'percentage' ? '0' : '0.00'} min="0" style={{ width: 72 }} />
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}><div className="npo-amt">{fmtAED(comp?.base || 0)}</div></td>
                        <td>
                          <button onClick={() => handleRemoveItem(index)}
                            style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, transition: 'all .12s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}>
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!hasItemsAdded && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: T.textSec }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📦</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No items added yet</div>
                        <div style={{ fontSize: 11 }}>Click "Add Item Row" to start</div>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Item Dropdown Portal */}
            <DropdownPortal targetRef={{ current: itemInputRefs.current[showItemDropdown] }} isVisible={showItemDropdown !== null}>
              <div className="item-dropdown-po npo-idd npo-dd">
                {inventoryLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: T.textSec, fontSize: 13 }}>
                    <div style={{ width: 16, height: 16, border: `2px solid ${T.border}`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'npoSpin .7s linear infinite', margin: '0 auto 8px' }} />
                    Loading items…
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: T.textSec, fontSize: 13 }}>
                    {searchTerm ? 'No items match your search' : 'Start typing to search items'}
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '8px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: T.textSec, borderBottom: `1.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}</span><span>Click to select</span>
                    </div>
                    {filteredItems.map(inv => (
                      <div key={inv._id} className="npo-irow" onClick={() => handleItemSelect(showItemDropdown, inv)}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(59,130,246,0.15)' : 'linear-gradient(135deg,#eff6ff,#dbeafe)', color: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                          <FaBox />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.name || 'No name'}</span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: '2px 7px', background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: T.blue, borderRadius: 5, flexShrink: 0 }}>{inv.item_code || inv.sku || 'N/A'}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 8 }}>
                            {[
                              { icon: <FaMoneyBill style={{ color: '#10b981' }} />, label: 'Price', val: `AED ${inv.selling_price || 0}`, mono: true },
                              { icon: <FaWarehouse style={{ color: '#f59e0b' }} />, label: 'Stock', val: `${inv.quantity || 0} units`, color: (inv.quantity||0)>10?'#10b981':(inv.quantity||0)>0?'#f59e0b':'#ef4444' },
                              { icon: <FaTag style={{ color: '#8b5cf6' }} />, label: 'Unit', val: inv.unit || inv.Unit || 'pcs' },
                            ].map(m => (
                              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ fontSize: 11 }}>{m.icon}</div>
                                <div>
                                  <div style={{ fontSize: 9, color: T.textSec, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>{m.label}</div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: m.color || T.textPri, fontFamily: m.mono ? "'DM Mono',monospace" : undefined }}>{m.val}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {inv.item_code && <div style={{ marginTop: 6, fontSize: 10, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>Code: {inv.item_code}</div>}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </DropdownPortal>
          </div>
        </div>

        {/* ── Summary + Notes ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Tax Breakdown */}
          <div className="npo-section npo-card" style={{ marginBottom: 0 }}>
            <div className="npo-sbar" style={{ background: 'linear-gradient(90deg,#f59e0b,transparent 80%)' }} />
            <div className="npo-sin">
              <div className="npo-stitle"><div className="npo-sicon" style={{ background: '#f59e0b18', color: '#f59e0b' }}><FaMoneyBillWave /></div>Tax Breakdown</div>
              <div className="npo-srow"><span style={{ fontSize: 13, color: T.textSec, fontWeight: 500 }}>Sub Total</span><span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: T.textPri }}>{fmtAED(subTotal)}</span></div>
              {taxGroups.length > 0 && (
                <div style={{ margin: '10px 0', padding: '10px 12px', background: isDark ? 'rgba(245,158,11,.06)' : '#fffbeb', borderRadius: 10, border: `1.5px solid ${isDark ? 'rgba(245,158,11,.2)' : '#fde68a'}` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#f59e0b', margin: '0 0 8px' }}>VAT 5% — Grouped by Rate</p>
                  {taxGroups.map((g, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 7, marginBottom: i < taxGroups.length - 1 ? 4 : 0 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: T.textPri, margin: 0 }}>Rate AED {g.rate}</p>
                        <p style={{ fontSize: 10, color: T.textSec, margin: '2px 0 0', fontFamily: "'DM Mono',monospace" }}>{fmtAED(g.baseAmount)} × 5%</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', fontFamily: "'DM Mono',monospace" }}>{fmtAED(g.taxAmount)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: `1.5px solid ${isDark ? 'rgba(245,158,11,.25)' : '#fcd34d'}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>Total VAT (5%)</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', fontFamily: "'DM Mono',monospace" }}>{fmtAED(totalTax)}</span>
                  </div>
                </div>
              )}
              {taxGroups.length === 0 && <div style={{ padding: '12px 0', textAlign: 'center', color: T.textSec, fontSize: 12 }}>Add items to see tax breakdown</div>}
              <div className="npo-srow" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: T.textSec, fontWeight: 500 }}>Shipping</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>AED</span><input type="number" value={shipping} onChange={e => setShipping(e.target.value)} className="npo-tinp" placeholder="0.00" step="0.01" min="0" style={{ width: 88, textAlign: 'right', fontFamily: "'DM Mono',monospace" }} /></div>
              </div>
              <div className="npo-srow" style={{ alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: T.textSec, fontWeight: 500 }}>Adjustment</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>AED</span><input type="number" value={adjustment} onChange={e => setAdjustment(e.target.value)} className="npo-tinp" placeholder="0.00" step="0.01" style={{ width: 88, textAlign: 'right', fontFamily: "'DM Mono',monospace" }} /></div>
              </div>
              <div style={{ borderTop: `1.5px solid ${T.border}`, marginTop: 12, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: T.textPri }}>Grand Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: T.blue, fontFamily: "'DM Mono',monospace" }}>{fmtAED(grandTotal)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, paddingTop: 16, borderTop: `1.5px solid ${T.border}` }}>
                {[
                  { label: 'Line Items', val: items.filter(i => i.details).length, color: T.blue, bg: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff' },
                  { label: 'Total Qty', val: items.reduce((t, i) => t + (parseFloat(i.quantity)||0), 0), color: T.green, bg: isDark ? 'rgba(16,185,129,0.12)' : '#f0fdf4' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: s.bg, borderRadius: 12 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="npo-section npo-card" style={{ marginBottom: 0 }}>
            <div className="npo-sbar" style={{ background: 'linear-gradient(90deg,#8b5cf6,transparent 80%)' }} />
            <div className="npo-sin">
              <div className="npo-stitle"><div className="npo-sicon" style={{ background: '#8b5cf618', color: '#8b5cf6' }}>📝</div>Notes & Terms</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Customer Notes"><textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} className="npo-inp" placeholder="Notes visible to vendor…" style={{ resize: 'none', height: 96, lineHeight: 1.6 }} /></Field>
                <Field label="Terms & Conditions"><textarea value={terms} onChange={e => setTerms(e.target.value)} className="npo-inp" placeholder="Enter terms and conditions…" style={{ resize: 'none', height: 96, lineHeight: 1.6 }} /></Field>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="npo-bottombar">
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>
              {items.filter(i => i.details).length} item{items.filter(i => i.details).length !== 1 ? 's' : ''}&nbsp;·&nbsp;
              <span style={{ fontFamily: "'DM Mono',monospace", color: T.blue }}>{fmtAED(grandTotal)}</span>
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Fields marked with <span style={{ color: '#ef4444' }}>*</span> are required</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/Purchase/Purchaseorders')} className="npo-bg">Cancel</button>
            <button onClick={() => handleSubmit('draft')} className="npo-bg" disabled={saving || !hasItemsAdded} style={{ fontWeight: 700 }}>{saving ? 'Saving…' : 'Save as Draft'}</button>
            <button onClick={() => handleSubmit('open')} className="npo-bp" disabled={saving || !vendor.trim() || !hasItemsAdded}>
              {saving ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'npoSpin .7s linear infinite' }} />Processing…</> : <><FaCheckCircle size={12} />Save & Submit</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}