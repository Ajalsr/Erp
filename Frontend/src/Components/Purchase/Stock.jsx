import { useState } from 'react'
import useThemeStore from '../../store/useThemeStore'

const MOCK_STOCK = [
  { id: 'ITM-001', name: 'Steel Pipe 2"',         code: 'SP-200',  unit: 'Pcs',  qty: 240, reorder: 50,  cost: 45.00,  status: 'in_stock'    },
  { id: 'ITM-002', name: 'PVC Elbow 90° 1"',      code: 'PE-100',  unit: 'Pcs',  qty: 18,  reorder: 30,  cost: 3.50,   status: 'low_stock'   },
  { id: 'ITM-003', name: 'Copper Wire 6mm',        code: 'CW-006',  unit: 'Mtr',  qty: 0,   reorder: 100, cost: 12.00,  status: 'out_of_stock' },
  { id: 'ITM-004', name: 'Hydraulic Pump 5HP',     code: 'HP-005',  unit: 'Pcs',  qty: 12,  reorder: 5,   cost: 850.00, status: 'in_stock'    },
  { id: 'ITM-005', name: 'Safety Gloves L',        code: 'SG-L',    unit: 'Pair', qty: 7,   reorder: 20,  cost: 8.00,   status: 'low_stock'   },
  { id: 'ITM-006', name: 'Industrial Bolt M12',    code: 'IB-M12',  unit: 'Box',  qty: 55,  reorder: 10,  cost: 22.00,  status: 'in_stock'    },
  { id: 'ITM-007', name: 'Air Filter 12"',         code: 'AF-012',  unit: 'Pcs',  qty: 3,   reorder: 10,  cost: 65.00,  status: 'low_stock'   },
]

const STATUS_CFG = {
  in_stock:     { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)',  label: 'In Stock'     },
  low_stock:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  label: 'Low Stock'    },
  out_of_stock: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',   label: 'Out of Stock' },
}

export default function Stock() {
  const isDark = useThemeStore((s) => s.isDark)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const D = {
    bg:        isDark ? '#080d1a'                   : '#f8fafc',
    card:      isDark ? '#0d1526'                   : '#ffffff',
    border:    isDark ? 'rgba(255,255,255,0.07)'    : '#e2e8f0',
    textPri:   isDark ? '#e2e8f0'                   : '#0f172a',
    textSec:   isDark ? 'rgba(100,116,139,0.9)'     : '#64748b',
    inputBg:   isDark ? 'rgba(255,255,255,0.04)'    : '#f8fafc',
    rowHover:  isDark ? 'rgba(255,255,255,0.03)'    : '#f8fafc',
    theadBg:   isDark ? 'rgba(255,255,255,0.03)'    : '#f8fafc',
    filterActiveBg: isDark ? 'rgba(37,99,235,0.2)'  : '#eff6ff',
  }

  const filtered = MOCK_STOCK.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
                          i.code.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || i.status === filter
    return matchesSearch && matchesFilter
  })

  const filters = [
    { key: 'all',          label: 'All' },
    { key: 'in_stock',     label: 'In Stock' },
    { key: 'low_stock',    label: 'Low Stock' },
    { key: 'out_of_stock', label: 'Out of Stock' },
  ]

  return (
    <div style={{ padding: '24px', background: D.bg, minHeight: '100%', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: D.textPri, fontSize: '18px', fontWeight: '700', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Stock
          </h1>
          <p style={{ color: D.textSec, fontSize: '12px', margin: '4px 0 0' }}>
            Current inventory levels across all warehouses
          </p>
        </div>
        <button style={{
          background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px',
          padding: '8px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adjust Stock
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'In Stock',      value: MOCK_STOCK.filter(i => i.status === 'in_stock').length,     color: '#10b981' },
          { label: 'Low Stock',     value: MOCK_STOCK.filter(i => i.status === 'low_stock').length,    color: '#f59e0b' },
          { label: 'Out of Stock',  value: MOCK_STOCK.filter(i => i.status === 'out_of_stock').length, color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '12px', padding: '16px 20px' }}>
            <p style={{ color: D.textSec, fontSize: '11px', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: '24px', fontWeight: '700', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: '12px', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '300px' }}>
            <svg width="14" height="14" fill="none" stroke={D.textSec} viewBox="0 0 24 24"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              style={{
                width: '100%', paddingLeft: '32px', paddingRight: '12px', paddingTop: '7px', paddingBottom: '7px',
                background: D.inputBg, border: `1px solid ${D.border}`, borderRadius: '8px',
                color: D.textPri, fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {filters.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                  background: filter === f.key ? D.filterActiveBg : 'transparent',
                  color: filter === f.key ? '#2563eb' : D.textSec,
                  border: filter === f.key ? '1px solid rgba(37,99,235,0.3)' : `1px solid ${D.border}`,
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: D.theadBg }}>
                {['Item', 'Code', 'Unit', 'Qty on Hand', 'Reorder Point', 'Cost Price', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: D.textSec, fontWeight: '500', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${D.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const s = STATUS_CFG[row.status]
                return (
                  <tr key={row.id} style={{ borderBottom: `1px solid ${D.border}`, cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = D.rowHover}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 16px', color: D.textPri, fontWeight: '500' }}>{row.name}</td>
                    <td style={{ padding: '12px 16px', color: D.textSec, fontFamily: 'monospace', fontSize: '12px' }}>{row.code}</td>
                    <td style={{ padding: '12px 16px', color: D.textSec }}>{row.unit}</td>
                    <td style={{ padding: '12px 16px', color: row.qty === 0 ? '#ef4444' : row.qty <= row.reorder ? '#f59e0b' : D.textPri, fontWeight: '600' }}>
                      {row.qty}
                    </td>
                    <td style={{ padding: '12px 16px', color: D.textSec }}>{row.reorder}</td>
                    <td style={{ padding: '12px 16px', color: D.textPri }}>AED {row.cost.toFixed(2)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: '500' }}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: D.textSec }}>No items found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
