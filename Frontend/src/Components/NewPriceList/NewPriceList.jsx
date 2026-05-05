import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoMdClose } from 'react-icons/io';
import { FaPlus, FaTrash } from 'react-icons/fa';
import axiosInstance from '../../helper/axiosInstance';
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import nexusToast from '../../helper/nexusToast';

const CURRENCIES = ['AED','USD','EUR','GBP','SAR','INR'];

export default function NewPriceList() {
  const navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [saving, setSaving] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemSearch, setShowItemSearch] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    currency: 'AED',
    adjustmentType: 'percentage',
    adjustment: 0,
    validFrom: '',
    validTo: '',
    isDefault: false,
    status: 'active',
    items: [],
  });

  useEffect(() => {
    axiosInstance.get('/api/stocks/getitem')
      .then(res => setAllItems(res.data?.data || res.data || []))
      .catch(() => {});
  }, []);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const addItem = (stock) => {
    if (form.items.find(i => i.itemId === stock._id)) return;
    const basePrice = parseFloat(stock.selling_price || 0);
    const price = form.adjustment
      ? +(basePrice * (1 + form.adjustment / 100)).toFixed(2)
      : basePrice;
    setForm(p => ({
      ...p,
      items: [...p.items, { itemId: stock._id, itemName: stock.name, itemCode: stock.item_code, basePrice, price }],
    }));
    setItemSearch('');
    setShowItemSearch(false);
  };

  const updateItemPrice = (idx, price) => {
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], price: parseFloat(price) || 0 };
      return { ...p, items };
    });
  };

  const removeItem = (idx) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { nexusToast.error('Price list name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        adjustment: parseFloat(form.adjustment) || 0,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
      };
      await axiosInstance.post('/api/price-lists/', payload);
      nexusToast.success('Price list created!');
      setTimeout(() => navigate('/Items/price-lists'), 1200);
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to create price list');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = allItems.filter(s =>
    itemSearch && (
      s.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
      s.item_code?.toLowerCase().includes(itemSearch.toLowerCase())
    )
  ).slice(0, 8);

  const inp = (extra = {}) => ({
    height: 40, padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: 10,
    fontSize: 13, color: T.textPri, background: T.surface, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', width: '100%', ...extra,
  });

  return (
    <div style={{ background: T.bg, minHeight: '100vh', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, height: 58, background: isDark ? 'rgba(13,21,38,.92)' : 'rgba(255,255,255,.92)', backdropFilter: 'blur(12px)', borderBottom: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 28px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/Items/price-lists')} style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
            <IoMdClose size={16} />
          </button>
          <div style={{ width: 1, height: 22, background: T.border }} />
          <p style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>New Price List</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/Items/price-lists')} style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface2, color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'Save Price List'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Basic info */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 16px' }}>Basic Information</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Wholesale Pricing" style={inp()} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} style={{ ...inp(), cursor: 'pointer', appearance: 'none' }}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional description…" rows={2}
              style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        {/* Adjustment */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 16px' }}>Global Price Adjustment</p>
          <p style={{ fontSize: 12, color: T.textSec, margin: '0 0 14px' }}>Apply a percentage markup or markdown to all item base prices. You can override individual items below.</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['percentage','% Markup/down'],['fixed','Fixed Amount']].map(([val, lbl]) => (
                <div key={val} onClick={() => set('adjustmentType', val)}
                  style={{ padding: '9px 16px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${form.adjustmentType === val ? '#3b82f6' : T.border}`, background: form.adjustmentType === val ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface2, fontSize: 12, fontWeight: 600, color: form.adjustmentType === val ? '#3b82f6' : T.textSec }}>
                  {lbl}
                </div>
              ))}
            </div>
            <input type="number" value={form.adjustment} onChange={e => set('adjustment', e.target.value)}
              placeholder="0"
              style={{ ...inp(), width: 100 }} />
            <span style={{ fontSize: 13, color: T.textSec }}>{form.adjustmentType === 'percentage' ? '%' : form.currency}</span>
          </div>
          {form.adjustment !== 0 && form.adjustment !== '' && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: parseFloat(form.adjustment) > 0 ? (isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2'), borderRadius: 10, fontSize: 12, color: parseFloat(form.adjustment) > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {parseFloat(form.adjustment) > 0 ? '↑' : '↓'} Items in this list will be priced {Math.abs(form.adjustment)}{form.adjustmentType === 'percentage' ? '%' : ` ${form.currency}`} {parseFloat(form.adjustment) > 0 ? 'above' : 'below'} their base price.
            </div>
          )}
        </div>

        {/* Validity */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 16px' }}>Validity & Options</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Valid From</label>
              <input type="date" value={form.validFrom} onChange={e => set('validFrom', e.target.value)} style={inp()} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, display: 'block', marginBottom: 6 }}>Valid To</label>
              <input type="date" value={form.validTo} onChange={e => set('validTo', e.target.value)} style={inp()} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
            <div onClick={() => set('isDefault', !form.isDefault)}
              style={{ width: 40, height: 22, borderRadius: 999, background: form.isDefault ? '#f59e0b' : T.border, position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 3, left: form.isDefault ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s' }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.textPri, margin: 0 }}>Set as default price list</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: '2px 0 0' }}>Used when no specific price list is assigned to a customer</p>
            </div>
          </label>
        </div>

        {/* Item overrides */}
        <div style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec, margin: '0 0 3px' }}>Item Price Overrides</p>
              <p style={{ fontSize: 11, color: T.textSec, margin: 0 }}>Override specific item prices (overrides the global adjustment above)</p>
            </div>
            <button onClick={() => setShowItemSearch(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: T.textPri, fontFamily: 'inherit' }}>
              <FaPlus size={9} /> Add Item
            </button>
          </div>

          {/* Item search */}
          {showItemSearch && (
            <div style={{ marginBottom: 14, position: 'relative' }}>
              <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} autoFocus
                placeholder="Search items by name or code…"
                style={{ ...inp(), marginBottom: 0 }}
                onBlur={() => setTimeout(() => setShowItemSearch(false), 150)} />
              {filteredItems.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 10, marginTop: 4, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
                  {filteredItems.map(s => (
                    <div key={s._id} onMouseDown={() => addItem(s)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{s.name}</p>
                        <p style={{ fontSize: 11, color: T.textSec, margin: '1px 0 0', fontFamily: "'DM Mono',monospace" }}>{s.item_code}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', fontFamily: "'DM Mono',monospace" }}>AED {parseFloat(s.selling_price || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {form.items.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: T.surface2, borderRadius: 10 }}>
              <p style={{ fontSize: 12, color: T.textSec, margin: 0 }}>No item overrides added. The global adjustment above will apply to all items.</p>
            </div>
          ) : (
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 36px', padding: '8px 12px', background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {['Item', 'Base Price', 'Override Price', ''].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.textSec }}>{h}</span>
                ))}
              </div>
              {form.items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 36px', padding: '10px 12px', borderBottom: i < form.items.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'center', background: T.surface }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.textPri, margin: 0 }}>{item.itemName}</p>
                    <p style={{ fontSize: 11, color: T.textSec, margin: '1px 0 0', fontFamily: "'DM Mono',monospace" }}>{item.itemCode}</p>
                  </div>
                  <span style={{ fontSize: 12, color: T.textSec, fontFamily: "'DM Mono',monospace" }}>
                    {item.basePrice?.toFixed(2)}
                  </span>
                  <input type="number" value={item.price} onChange={e => updateItemPrice(i, e.target.value)}
                    style={{ height: 32, padding: '0 8px', border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 12, color: T.textPri, background: T.surface2, outline: 'none', fontFamily: "'DM Mono',monospace", width: '100%' }} />
                  <button onClick={() => removeItem(i)}
                    style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FaTrash size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
