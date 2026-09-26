// ── QuickAddItemModal — mandatory-fields-only item creation, for inline "+ Create
// new item" shortcuts on item search/select fields (enquiries, sales orders, …).
// Posts to the same /api/stocks/additem endpoint the full item form uses, and lets
// the caller nest-create a Category/Group or Unit of Measure without leaving it.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import axiosInstance from '../../helper/axiosInstance';
import nexusToast from '../../helper/nexusToast';
import PortalSelect from './PortalSelect';
import QuickCreateModal from './QuickCreateModal';
import { usePermissions } from '../../helper/permissions';

const QUICK_ITEM_GROUP_FIELDS = [
  { name: 'name',   label: 'Group Name',       placeholder: 'e.g. Electronics',      required: true, autoFocus: true },
  { name: 'prefix', label: 'Item Code Prefix', placeholder: 'e.g. ELEC (optional)',  mono: true },
];
const QUICK_ITEM_UNIT_FIELDS = [
  { name: 'name',   label: 'Unit Name', placeholder: 'e.g. Kilogram',      required: true, autoFocus: true },
  { name: 'symbol', label: 'Symbol',    placeholder: 'e.g. kg (optional)', mono: true },
];

export default function QuickAddItemModal({ T, isDark, uomOptions, fetchUomOptions, groupOptions, groupMap, fetchGroupOptions, onClose, onCreated }) {
  const [type, setType]           = useState('goods'); // 'goods' | 'service'
  const [name, setName]           = useState('');
  const [itemCode, setItemCode]   = useState('');
  const [groupId, setGroupId]     = useState('');
  const [unit, setUnit]           = useState('');
  const [saving, setSaving]       = useState(false);
  const [nestedCreate, setNestedCreate] = useState(null); // null | 'group' | 'unit'
  // The nested "create group / unit" shortcuts follow their own modules' add permission.
  const { can } = usePermissions();
  const canAddGroup = can('item_groups', 'add');
  const canAddUnit = can('uom', 'add');

  const groupPrefix = groupId && groupMap[groupId]?.prefix ? groupMap[groupId].prefix + '-' : '';

  const handleGroupChange = (e) => {
    const value = e.target.value;
    setGroupId(value);
    const grp = groupMap[value];
    if (grp?.prefix) {
      const prefixStem = grp.prefix + '-';
      if (!itemCode || /^[A-Z]+-$/.test(itemCode)) setItemCode(prefixStem);
    }
  };

  const handleCreateGroup = async (form) => {
    const res = await axiosInstance.post('/api/item-groups/', { name: form.name, prefix: form.prefix });
    await fetchGroupOptions();
    const newId = res.data?.data?.id;
    if (newId) {
      setGroupId(newId);
      const prefixStem = form.prefix ? form.prefix.toUpperCase().replace(/\s/g, '') + '-' : '';
      if (prefixStem && (!itemCode || /^[A-Z]+-$/.test(itemCode))) setItemCode(prefixStem);
    }
    nexusToast.success('Group created');
  };

  const handleCreateUnit = async (form) => {
    const res = await axiosInstance.post('/api/uoms/', { name: form.name, symbol: form.symbol });
    await fetchUomOptions();
    const newId = res.data?.data?.id;
    if (newId) setUnit(newId);
    nexusToast.success('Unit created');
  };

  const handleSave = async () => {
    const codeSuffix = groupPrefix ? itemCode.slice(groupPrefix.length).trim() : itemCode.trim();
    if (!name.trim()) { nexusToast.error('Item name is required'); return; }
    if (!codeSuffix)  { nexusToast.error(groupPrefix ? `Enter a code after the "${groupPrefix}" prefix` : 'Item code is required'); return; }
    if (type !== 'service' && !unit) { nexusToast.error('Unit of measure is required'); return; }
    setSaving(true);
    try {
      const payload = { type, name: name.trim(), item_code: itemCode.trim(), unit: type === 'service' ? '' : unit, category: groupId || undefined };
      const res = await axiosInstance.post('/api/stocks/additem', payload);
      const newId = res.data?.data?._id;
      const unitLabel = uomOptions.find(o => o.value === unit)?.label || '';
      nexusToast.success('Item created');
      onCreated({ _id: newId, name: payload.name, item_code: payload.item_code, unit: payload.unit, unitLabel, category: groupId, selling_price: 0 });
    } catch (err) {
      nexusToast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', height: 38, padding: '0 11px', border: `1.5px solid ${T.border}`, borderRadius: 9,
    fontSize: 13, color: T.textPri, background: T.surface, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.textSec,
    display: 'block', marginBottom: 6,
  };

  return (
    <>
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: 360, maxWidth: '90vw', background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: 22, zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 700, color: T.textPri, margin: 0 }}>New Item</h3>
              <button onClick={onClose} style={{ width: 28, height: 28, border: `1px solid ${T.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                <FaTimes size={12} />
              </button>
            </div>
            <p style={{ fontSize: 11, color: T.textSec, margin: '0 0 16px' }}>Only the mandatory fields — refine the rest later from Items.</p>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['goods', 'Goods'], ['service', 'Service']].map(([val, lbl]) => (
                  <div key={val} onClick={() => setType(val)}
                    style={{ flex: 1, padding: '9px', textAlign: 'center', borderRadius: 9, cursor: 'pointer',
                      border: `1.5px solid ${type === val ? '#3b82f6' : T.border}`,
                      background: type === val ? (isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff') : T.surface }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: type === val ? '#3b82f6' : T.textSec, margin: 0 }}>{lbl}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Item Name<span style={{ color: '#ef4444' }}> *</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ergonomic Office Chair" autoFocus style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Category / Group</label>
              <PortalSelect T={T} isDark={isDark} name="category" value={groupId} onChange={handleGroupChange}
                placeholder={groupOptions.length ? 'Select group…' : 'No groups yet…'}
                options={groupOptions}
                onCreateNew={canAddGroup ? () => setNestedCreate('group') : undefined} createLabel="Create new group" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Item Code<span style={{ color: '#ef4444' }}> *</span></label>
              <div style={{ display: 'flex', border: `1.5px solid ${T.border}`, borderRadius: 9, overflow: 'hidden', background: T.surface }}>
                {groupPrefix && (
                  <span style={{ padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: T.textSec, background: T.surface2, borderRight: `1.5px solid ${T.border}`, flexShrink: 0 }}>
                    {groupPrefix}
                  </span>
                )}
                <input
                  value={groupPrefix ? itemCode.slice(groupPrefix.length) : itemCode}
                  onChange={e => setItemCode(groupPrefix ? groupPrefix + e.target.value : e.target.value)}
                  placeholder={groupPrefix ? 'suffix…' : 'e.g. ITM-001'}
                  style={{ flex: 1, minWidth: 0, height: 38, padding: '0 11px', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T.textPri, fontFamily: "'DM Mono', monospace", boxSizing: 'border-box' }} />
              </div>
            </div>
            {type !== 'service' && (
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Unit of Measure<span style={{ color: '#ef4444' }}> *</span></label>
                <PortalSelect T={T} isDark={isDark} name="unit" value={unit} onChange={e => setUnit(e.target.value)}
                  placeholder={uomOptions.length ? 'Select unit…' : 'No units yet…'}
                  options={uomOptions}
                  onCreateNew={canAddUnit ? () => setNestedCreate('unit') : undefined} createLabel="Create new unit" />
              </div>
            )}
            <button onClick={handleSave} disabled={saving}
              style={{ width: '100%', padding: 11, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Creating…' : 'Create & Use Item'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {nestedCreate === 'group' && (
        <QuickCreateModal title="New Item Group" fields={QUICK_ITEM_GROUP_FIELDS} T={T}
          onClose={() => setNestedCreate(null)} onSubmit={handleCreateGroup} />
      )}
      {nestedCreate === 'unit' && (
        <QuickCreateModal title="New Unit of Measure" fields={QUICK_ITEM_UNIT_FIELDS} T={T}
          onClose={() => setNestedCreate(null)} onSubmit={handleCreateUnit} />
      )}
    </>
  );
}
