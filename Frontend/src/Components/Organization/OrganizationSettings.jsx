import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import useOrganization from '../../helper/useOrganization'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'
import nexusToast from '../../helper/nexusToast'
import axiosInstance from '../../helper/axiosInstance'
import { PERM_MODULES, PERM_CAPS, invalidatePermissions, usePermissions } from '../../helper/permissions'

// Grid template for the module-access matrix: module label + one column per capability.
const PERM_GRID = `minmax(104px,1.3fr) repeat(${PERM_CAPS.length}, minmax(58px,1fr))`
import ApprovalsWorkflow from './ApprovalsWorkflow'

const ROLES = ['admin', 'sales_rep']

const ROLE_COLORS = {
  owner:     { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  admin:     { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  sales_rep: { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', border: 'rgba(34,197,94,0.2)'  },
  member:    { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', border: 'rgba(34,197,94,0.2)'  },
  viewer:    { bg: 'rgba(148,163,184,0.1)',  text: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
}

// Pretty label for a role key (e.g. sales_rep → "Sales Rep").
const roleLabel = (r) => (r || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

const RoleBadge = ({ role }) => {
  const c = ROLE_COLORS[role] || ROLE_COLORS.viewer
  return (
    <span style={{
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '600',
    }}>{roleLabel(role)}</span>
  )
}

// One-click role presets for the Permissions matrix. Each sets module → capability
// list; scope is reset to "all" (empty) so reports/dashboards see org-wide data.
// Approvals & Settings-access are intentionally left untouched on apply.
const _V = ['view'], _VE = ['view', 'export'], _FULL = ['view', 'add', 'edit', 'export']
const ROLE_TEMPLATES = [
  {
    key: 'accountant', label: 'Accountant', desc: 'Read finance & reports, export — no edits',
    modules: {
      customers: _VE, invoices: _VE, credit_notes: _VE, payments: _VE, advance_payments: _V,
      vendors: _VE, bills: _VE, vendor_payments: _V, vendor_credits: _V, accounts: _VE, reports: _VE,
    },
  },
  {
    key: 'sales', label: 'Sales Rep', desc: 'Manage the sales cycle',
    modules: {
      items: _V, customers: _FULL, enquiries: _FULL, quotes: _FULL, sales_orders: _FULL,
      delivery_notes: ['view', 'add'], invoices: _FULL, credit_notes: _V,
      payments: ['view', 'add'], advance_payments: ['view', 'add'], reports: _V,
    },
  },
  {
    key: 'purchaser', label: 'Purchaser', desc: 'Manage the purchasing cycle',
    modules: {
      items: _V, vendors: _FULL, purchase_orders: _FULL, grns: _FULL, bills: _FULL,
      vendor_credits: _V, vendor_payments: ['view', 'add'], reports: _V,
    },
  },
  {
    key: 'readonly', label: 'Read-Only', desc: 'View everything, change nothing',
    modules: PERM_MODULES.reduce((a, m) => { a[m.key] = _V; return a }, {}),
  },
]

// ── Customer-code numbering format ──────────────────────────────────────────
// A format is an ordered list of segments. Mirrors backend utils/numbering.go.
const NUM_SEG_TYPES = [
  { value: 'month',    label: 'Month' },
  { value: 'year',     label: 'Year' },
  { value: 'day',      label: 'Day' },
  { value: 'literal',  label: 'Text' },
  { value: 'sequence', label: 'Counter' },
]

// Legacy default: MM + YY + 2-digit counter (e.g. "042607").
const DEFAULT_CUST_FORMAT = [
  { type: 'month', digits: 2 },
  { type: 'year', digits: 2 },
  { type: 'sequence', mode: 'digit', digits: 2, start: 1 },
]

// Entities whose auto-numbers can be configured. Keys match backend
// entityDefaultFormats in controllers/numbering.go.
const NUM_ENTITIES = [
  { key: 'customer',       label: 'Customer Code' },
  { key: 'invoice',        label: 'Invoice' },
  { key: 'quote',          label: 'Quote' },
  { key: 'sales_order',    label: 'Sales Order' },
  { key: 'delivery_note',  label: 'Delivery Note' },
  { key: 'purchase_order', label: 'Purchase Order' },
  { key: 'lpo',            label: 'LPO' },
  { key: 'grn',            label: 'GRN' },
  { key: 'bill',           label: 'Bill' },
  { key: 'payment',        label: 'Payment' },
  { key: 'advance',        label: 'Advance Payment' },
  { key: 'vendor',         label: 'Vendor Code' },
  { key: 'vendor_payment', label: 'Vendor Payment' },
  { key: 'vendor_credit',  label: 'Vendor Credit' },
  { key: 'credit_note',    label: 'Credit Note' },
  { key: 'debit_note',     label: 'Debit Note' },
  { key: 'journal_entry',  label: 'Journal Entry' },
  { key: 'project',        label: 'Project No.' },
]

// Legacy default formats per entity (mirror backend entityDefaultFormats).
const _litYS  = (p) => [{ type: 'literal', value: p }, { type: 'year', digits: 4 }, { type: 'literal', value: '-' }, { type: 'sequence', mode: 'digit', digits: 4, start: 1 }]
const _litYMS = (p) => [{ type: 'literal', value: p }, { type: 'year', digits: 4 }, { type: 'month', digits: 2 }, { type: 'literal', value: '-' }, { type: 'sequence', mode: 'digit', digits: 4, start: 1 }]
const _litS   = (p) => [{ type: 'literal', value: p }, { type: 'sequence', mode: 'digit', digits: 4, start: 1 }]
const _litMYS = (p) => [{ type: 'literal', value: p }, { type: 'month', digits: 2 }, { type: 'year', digits: 2 }, { type: 'sequence', mode: 'digit', digits: 4, start: 1 }]

const ENTITY_DEFAULTS = {
  customer: DEFAULT_CUST_FORMAT,
  invoice: _litYS('INV-'), quote: _litYS('QUO-'), delivery_note: _litYS('DN-'),
  credit_note: _litS('CN-'), debit_note: _litS('DN-'), grn: _litS('GRN-'), vendor: _litS('VEN-'), lpo: _litS('LPO-'),
  bill: _litYMS('BILL-'), payment: _litYMS('PAY-'), vendor_payment: _litYMS('VPAY-'),
  advance: _litYMS('ADV-'), vendor_credit: _litYMS('VCR-'), journal_entry: _litYMS('JE-'),
  sales_order: _litMYS('SO'), purchase_order: _litMYS('PO'),
  project: _litYS('PRJ-'),
}

const newSegment = (type) => {
  switch (type) {
    case 'literal':  return { type: 'literal', value: '-' }
    case 'year':     return { type: 'year', digits: 2 }
    case 'day':      return { type: 'day', digits: 2 }
    case 'sequence': return { type: 'sequence', mode: 'digit', digits: 4, start: 1 }
    default:         return { type: 'month', digits: 2 } // month
  }
}

// Counter (A=0) rendered base-26, left-padded to width — matches backend toBase26.
const toBase26 = (n, width) => {
  let s = ''; n = Math.max(0, n || 0)
  for (let i = 0; i < (width || 1); i++) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) }
  while (n > 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) }
  return s
}

// Live preview of the first number a format would produce.
const renderNumberPreview = (segs) => {
  const now = new Date()
  return (segs || []).map((s) => {
    const d = s.digits || 0
    switch (s.type) {
      case 'literal':  return s.value || ''
      case 'month':    return String(now.getMonth() + 1).padStart(d || 2, '0')
      case 'day':      return String(now.getDate()).padStart(d || 2, '0')
      case 'year': {
        const w = d || 4
        return String(now.getFullYear()).slice(-w).padStart(w, '0')
      }
      case 'sequence': {
        const start = s.start || 1
        return s.mode === 'alpha' ? toBase26(0, s.digits || 4) : String(start).padStart(s.digits || 4, '0')
      }
      default: return ''
    }
  }).join('')
}

// Themed dropdown (portal popover so it never clips inside the scrollable matrix).
const CustomSelect = ({ value, options, onChange, disabled, colors: c }) => {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const popRef = useRef(null)
  const sel = options.find(o => o.value === value)
  const measure = () => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 84) }) }
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false) }
    // Close on page scroll, but ignore scrolling inside the popover list itself.
    const onScroll = (e) => { if (!popRef.current?.contains(e.target)) setOpen(false) }
    const onResize = () => setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize) }
  }, [open])
  return (
    <>
      <button type="button" ref={ref} disabled={disabled}
        onClick={() => { if (disabled) return; measure(); setOpen(o => !o) }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 66, fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6, border: `1px solid ${open ? c.accent : c.border}`, background: c.inputBg, color: c.textPri, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        <span>{sel?.label || ''}</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ flexShrink: 0, opacity: .6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && pos && createPortal(
        <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99999, background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, boxShadow: c.shadow, padding: 4, maxHeight: 240, overflowY: 'auto' }}>
          {options.map(o => (
            <div key={o.value} onMouseDown={() => { onChange(o.value); setOpen(false) }}
              style={{ padding: '6px 10px', borderRadius: 5, fontSize: 12, fontWeight: o.value === value ? 700 : 500, cursor: 'pointer', color: o.value === value ? c.accent : c.textPri, background: o.value === value ? c.accentSoft : 'transparent' }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = c.inputBg }}
              onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent' }}>
              {o.label}
            </div>
          ))}
        </div>, document.body)}
    </>
  )
}

const OrganizationSettings = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isDark = useThemeStore((s) => s.isDark)
  const user = useAuthStore((s) => s.user)
  const activeOrg = useAuthStore((s) => s.activeOrg)
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg)

  const {
    getOrganization, updateOrganization, deleteOrganization,
    getMembers, inviteMember, updateMemberRole, removeMember,
    getOrgInvitations, cancelInvitation,
  } = useOrganization()

  const [org, setOrg] = useState(null)
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [myRole, setMyRole] = useState('')
  const [tab, setTab] = useState('members') // members | settings
  const [loading, setLoading] = useState(true)

  // Settings form
  const [orgName, setOrgName] = useState('')
  const [orgDesc, setOrgDesc] = useState('')
  const [orgAddress, setOrgAddress] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('AED')
  const [saving, setSaving] = useState(false)

  // Letterhead
  const [letterhead, setLetterhead] = useState('')
  const [letterheadTopPad, setLetterheadTopPad] = useState(13)
  const [letterheadBottomPad, setLetterheadBottomPad] = useState(8)
  const [letterheadSaving, setLetterheadSaving] = useState(false)
  const letterheadInputRef = useRef(null)
  // Stamp
  const [stamp, setStamp] = useState('')
  const [stampSaving, setStampSaving] = useState(false)
  const stampInputRef = useRef(null)

  // Role permissions matrix
  const [permCfg, setPermCfg] = useState({}) // { role: { modules:{}, approvals:{} } }
  const [permSaving, setPermSaving] = useState(false)
  // Custom roles (org-defined, assignable besides owner/admin)
  const [customRoles, setCustomRoles] = useState(['sales_rep'])
  const [newRoleName, setNewRoleName] = useState('')
  const [rolesSaving, setRolesSaving] = useState(false)
  const [selectedRole, setSelectedRole] = useState('sales_rep') // role being edited in the panel

  // Invite form
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteRole, setInviteRole] = useState('sales_rep')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')

  // Role change
  const [roleChanging, setRoleChanging] = useState(null)

  // Custom confirm modal — replaces native window.confirm.
  // { title, message, confirmLabel, danger, onConfirm }
  const [confirmState, setConfirmState] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const askConfirm = (opts) => setConfirmState(opts)
  const runConfirm = async () => {
    const fn = confirmState?.onConfirm
    setConfirmBusy(true)
    try { if (fn) await fn() }
    finally { setConfirmBusy(false); setConfirmState(null) }
  }

  // Salutations
  const [salutations, setSalutations]       = useState(['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.'])
  const [newSalutation, setNewSalutation]   = useState('')
  const [savingSalutations, setSavingSalutations] = useState(false)

  // Yearly sales target (single org-wide amount) — powers the sales-rep dashboard.
  const [yearlyTarget, setYearlyTarget]   = useState('')
  const [savingTarget, setSavingTarget]   = useState(false)

  useEffect(() => {
    axiosInstance.get('/api/org/settings')
      .then(res => {
        const s = res.data?.data?.salutations; if (Array.isArray(s) && s.length) setSalutations(s);
        const t = res.data?.data?.yearlySalesTarget; if (t != null) setYearlyTarget(String(t));
      })
      .catch(() => {})
  }, [])

  const saveTarget = async () => {
    const val = Number(yearlyTarget) || 0
    setSavingTarget(true)
    try {
      await axiosInstance.put('/api/org/settings', { yearlySalesTarget: val })
      nexusToast.success('Yearly sales target saved')
    } catch { nexusToast.error('Failed to save target') }
    finally { setSavingTarget(false) }
  }

  const saveSalutations = async (list) => {
    setSavingSalutations(true)
    try {
      await axiosInstance.put('/api/org/settings', { salutations: list })
      setSalutations(list)
      nexusToast.success('Salutations saved')
    } catch { nexusToast.error('Failed to save salutations') }
    finally { setSavingSalutations(false) }
  }

  const addSalutation = () => {
    const v = newSalutation.trim()
    if (!v || salutations.includes(v)) return
    saveSalutations([...salutations, v])
    setNewSalutation('')
  }

  const removeSalutation = (s) => saveSalutations(salutations.filter(x => x !== s))

  // Document/code numbering formats (per entity)
  const [numEntity, setNumEntity] = useState('customer')
  const [numSegs, setNumSegs] = useState(ENTITY_DEFAULTS.customer)
  const [savingNum, setSavingNum] = useState(false)
  const numFormatsRef = useRef({}) // all saved entity formats, preserved on save

  // Quote numbering by salesperson: <INITIALS>/<MMYY>/<MM><NN>, e.g. MS/0626/0601.
  const [quoteBySalesperson, setQuoteBySalesperson] = useState(false)
  const toggleQuoteBySalesperson = async () => {
    const next = !quoteBySalesperson
    setQuoteBySalesperson(next)
    try {
      await axiosInstance.put('/api/org/settings', { quoteNumberBySalesperson: next })
      nexusToast.success(next ? 'Quote numbering set to salesperson format' : 'Quote numbering reverted to default')
    } catch {
      setQuoteBySalesperson(!next)
      nexusToast.error('Failed to update quote numbering')
    }
  }

  // Segments for an entity: saved format if present, else the legacy default.
  const segsForEntity = (key) => {
    const saved = numFormatsRef.current?.[key]?.segments
    return (Array.isArray(saved) && saved.length) ? saved : (ENTITY_DEFAULTS[key] || [])
  }

  useEffect(() => {
    axiosInstance.get('/api/org/settings')
      .then(res => {
        const all = res.data?.data?.numberingFormats
        if (all && typeof all === 'object') numFormatsRef.current = all
        setNumSegs(segsForEntity(numEntity))
        setQuoteBySalesperson(!!res.data?.data?.quoteNumberBySalesperson)
      })
      .catch(() => {})
  }, [])

  const switchEntity = (key) => { setNumEntity(key); setNumSegs(segsForEntity(key)) }
  const resetEntity = () => setNumSegs(ENTITY_DEFAULTS[numEntity] || [])

  const updateSeg = (i, patch) => setNumSegs(segs => segs.map((s, j) => j === i ? { ...s, ...patch } : s))
  const removeSeg = (i) => setNumSegs(segs => segs.filter((_, j) => j !== i))
  const addSeg = (type) => setNumSegs(segs => [...segs, newSegment(type)])
  const addSepSeg = (ch) => setNumSegs(segs => [...segs, { type: 'literal', value: ch }])
  // Drag-and-drop reorder of segment rows.
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const moveSegTo = (from, to) => setNumSegs(segs => {
    if (from == null || to == null || from === to) return segs
    const next = segs.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  })
  const endDrag = () => { setDragIdx(null); setDragOverIdx(null) }

  const saveNumbering = async () => {
    setSavingNum(true)
    try {
      const merged = { ...numFormatsRef.current, [numEntity]: { segments: numSegs } }
      await axiosInstance.put('/api/org/settings', { numberingFormats: merged })
      numFormatsRef.current = merged
      const label = NUM_ENTITIES.find(e => e.key === numEntity)?.label || numEntity
      nexusToast.success(`${label} numbering saved`)
    } catch { nexusToast.error('Failed to save numbering format') }
    finally { setSavingNum(false) }
  }

  // Design tokens — mirror the Organization Settings reference palette.
  const accent       = isDark ? '#5d8bff' : '#2f6bf6'
  const accentFg     = isDark ? '#0a0c12' : '#ffffff'
  const accentSoft   = isDark ? 'rgba(93,139,255,0.14)' : 'rgba(47,107,246,0.10)'
  const accentLine   = isDark ? 'rgba(93,139,255,0.30)' : 'rgba(47,107,246,0.22)'
  const bgPage       = isDark ? '#08090c' : '#f5f6f8'
  const bgCard       = isDark ? '#101218' : '#ffffff'
  const bgInset      = isDark ? '#181b22' : '#f3f4f6'
  const border       = isDark ? 'rgba(255,255,255,0.075)' : '#e7e8ec'
  const textPri      = isDark ? '#e9ebf0' : '#16181d'
  const textSec      = isDark ? '#939aa7' : '#5d6370'
  const inputBg      = isDark ? '#181b22' : '#f3f4f6'
  const inputBorder  = isDark ? 'rgba(255,255,255,0.13)' : '#e7e8ec'
  const shadowSm     = isDark ? '0 1px 2px rgba(0,0,0,0.4)' : '0 1px 2px rgba(16,18,24,0.04)'

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [orgData, membersData, invData] = await Promise.all([
        getOrganization(id, true), // Settings needs the letterhead/stamp images
        getMembers(id),
        getOrgInvitations(id).catch(() => []),
      ])
      setOrg(orgData)
      setOrgName(orgData?.name || '')
      setOrgDesc(orgData?.description || '')
      setOrgAddress(orgData?.address || '')
      setBaseCurrency(orgData?.baseCurrency || 'AED')
      setLetterhead(orgData?.letterheadImage || '')
      setLetterheadTopPad(orgData?.letterheadTopPad || 13)
      setLetterheadBottomPad(orgData?.letterheadBottomPad || 8)
      setStamp(orgData?.stampImage || '')
      setPermCfg(orgData?.rolePermissions || {})
      setCustomRoles(orgData?.customRoles?.length ? orgData.customRoles : ['sales_rep'])
      setMembers(membersData)
      setInvitations(invData)
      const me = membersData.find((m) => m.userId === user?.userId)
      setMyRole(me?.role || orgData?.role || '')
    } catch (err) {
      nexusToast.error('Failed to load organization data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const canManage = myRole === 'owner' || myRole === 'admin'
  // Owner manages roles/permissions; granted roles can use other settings.
  const isOwner = myRole === 'owner'
  const { canSettings } = usePermissions()
  const settingsAllowed = isOwner || canSettings()

  const handleSave = async () => {
    if (!orgName.trim()) { nexusToast.error('Name is required'); return }
    setSaving(true)
    try {
      await updateOrganization(id, { name: orgName.trim(), description: orgDesc.trim(), address: orgAddress.trim(), baseCurrency: (baseCurrency || 'AED').trim().toUpperCase() })
      if (activeOrg?._id === id) setActiveOrg({ ...activeOrg, name: orgName.trim() })
      nexusToast.success('Organization updated')
      load()
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleLetterheadFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { nexusToast.error('Image must be under 3 MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setLetterhead(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleLetterheadSave = async () => {
    setLetterheadSaving(true)
    try {
      await axiosInstance.patch(`/api/organizations/${id}/letterhead`, {
        letterheadImage: letterhead,
        letterheadTopPad,
        letterheadBottomPad,
      })
      nexusToast.success('Letterhead saved — will appear on all delivery notes')
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save letterhead')
    } finally {
      setLetterheadSaving(false)
    }
  }

  const handleLetterheadRemove = async () => {
    setLetterhead('')
    setLetterheadSaving(true)
    try {
      await axiosInstance.patch(`/api/organizations/${id}/letterhead`, { letterheadImage: '', letterheadTopPad: 13, letterheadBottomPad: 8 })
      setLetterheadTopPad(13)
      setLetterheadBottomPad(8)
      nexusToast.success('Letterhead removed')
    } catch {
      nexusToast.error('Failed to remove letterhead')
    } finally {
      setLetterheadSaving(false)
    }
  }

  // ── Stamp (company seal) ──
  const handleStampFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { nexusToast.error('Stamp must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setStamp(ev.target.result)
    reader.readAsDataURL(file)
  }
  const handleStampSave = async () => {
    setStampSaving(true)
    try {
      await axiosInstance.patch(`/api/organizations/${id}/stamp`, { stampImage: stamp })
      nexusToast.success('Stamp saved — will appear on delivery notes')
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save stamp')
    } finally {
      setStampSaving(false)
    }
  }
  const handleStampRemove = async () => {
    setStamp('')
    setStampSaving(true)
    try {
      await axiosInstance.patch(`/api/organizations/${id}/stamp`, { stampImage: '' })
      nexusToast.success('Stamp removed')
    } catch {
      nexusToast.error('Failed to remove stamp')
    } finally {
      setStampSaving(false)
    }
  }

  // ── Role permissions ──
  // Mirror backend middlewares.defaultModuleCaps: read-only default. member/viewer
  // get view; custom roles get nothing. add/edit/delete/export need explicit grant.
  // Sales Rep can create/edit in sales modules by default (mirrors backend salesRepEditModules).
  const SALES_REP_EDIT_MODULES = new Set(['enquiries', 'quotes', 'sales_orders'])
  const defaultCapsFor = (role, mod) => {
    if (role === 'sales_rep') return SALES_REP_EDIT_MODULES.has(mod) ? ['view', 'add', 'edit'] : ['view']
    return (role === 'member' || role === 'viewer') ? ['view'] : []
  }
  const moduleCapsOf = (role, mod) => {
    const s = permCfg?.[role]?.modules?.[mod]
    return Array.isArray(s) ? s : defaultCapsFor(role, mod)
  }
  const hasModCap = (role, mod, cap) => moduleCapsOf(role, mod).includes(cap)
  const toggleModCap = (role, mod, cap) => setPermCfg(p => {
    const cur = Array.isArray(p?.[role]?.modules?.[mod]) ? p[role].modules[mod] : defaultCapsFor(role, mod)
    const next = cur.includes(cap) ? cur.filter(c => c !== cap) : [...cur, cap]
    return { ...p, [role]: { ...(p[role] || {}), modules: { ...(p[role]?.modules || {}), [mod]: next } } }
  })
  // Per-action record scope: 'all' (default) or 'own'. Falls back to legacy module-wide
  // scope when a per-action value isn't set.
  const scopeOf = (role, mod, action) => {
    const perAction = permCfg?.[role]?.scopes?.[mod]?.[action]
    if (perAction === 'own' || perAction === 'all') return perAction
    return permCfg?.[role]?.scope?.[mod] === 'own' ? 'own' : 'all'
  }
  const setScope = (role, mod, action, val) => setPermCfg(p => ({
    ...p,
    [role]: {
      ...(p[role] || {}),
      scopes: {
        ...(p[role]?.scopes || {}),
        [mod]: { ...(p[role]?.scopes?.[mod] || {}), [action]: val },
      },
    },
  }))
  const settingsGrant = (role) => !!permCfg?.[role]?.settings
  const toggleSettingsGrant = (role) => setPermCfg(p => ({
    ...p,
    [role]: { ...(p[role] || {}), settings: !p?.[role]?.settings },
  }))

  const savePermissions = async () => {
    setPermSaving(true)
    try {
      await axiosInstance.patch(`/api/organizations/${id}/role-permissions`, { rolePermissions: permCfg })
      invalidatePermissions()
      nexusToast.success('Permissions saved')
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to save permissions')
    } finally {
      setPermSaving(false)
    }
  }

  // ── Custom roles ──
  const saveRoles = async (list) => {
    setRolesSaving(true)
    try {
      const res = await axiosInstance.patch(`/api/organizations/${id}/roles`, { roles: list })
      setCustomRoles(res.data?.data || list)
      invalidatePermissions()
      nexusToast.success('Roles updated')
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to update roles')
    } finally {
      setRolesSaving(false)
    }
  }
  const addRole = () => {
    const r = newRoleName.trim().toLowerCase()
    if (!r) return
    if (['owner', 'admin'].includes(r) || customRoles.includes(r)) { nexusToast.error('Role already exists or is reserved'); return }
    saveRoles([...customRoles, r])
    // New role defaults every module's view/edit/delete scope to 'own' (least-privilege).
    const ownScopes = Object.fromEntries(PERM_MODULES.map(m => [m.key, { view: 'own', edit: 'own', delete: 'own' }]))
    setPermCfg(p => ({ ...p, [r]: { ...(p[r] || {}), scopes: { ...(p[r]?.scopes || {}), ...ownScopes } } }))
    setSelectedRole(r)
    setNewRoleName('')
  }
  // Apply a preset to the currently-selected role. Replaces module access + resets
  // scope to "all"; keeps approvals/settings. Persists only after Save Permissions.
  const applyTemplate = (tpl) => {
    const role = customRoles.includes(selectedRole) ? selectedRole : customRoles[0]
    if (!role) { nexusToast.error('Add a role first'); return }
    askConfirm({
      title: `Apply "${tpl.label}" template`,
      message: `Replace ${role}'s module access with the ${tpl.label} preset? Approvals & Settings access stay as-is. Click Save Permissions afterwards to persist.`,
      confirmLabel: 'Apply template',
      onConfirm: () => {
        setPermCfg(p => ({ ...p, [role]: { ...(p[role] || {}), modules: { ...tpl.modules }, scope: {} } }))
        nexusToast.success(`${tpl.label} template applied to "${role}" — review, then Save Permissions`)
      },
    })
  }
  const removeRole = (r) => {
    if (customRoles.length <= 1) { nexusToast.error('At least one role required'); return }
    askConfirm({
      title: 'Remove role',
      message: `Remove role "${r}"? Members with this role keep it until reassigned.`,
      confirmLabel: 'Remove role',
      danger: true,
      onConfirm: () => saveRoles(customRoles.filter(x => x !== r)),
    })
  }

  const handleDelete = () => {
    askConfirm({
      title: 'Delete organization',
      message: `Delete "${org?.name}"? This cannot be undone.`,
      confirmLabel: 'Delete organization',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteOrganization(id)
          nexusToast.success('Organization deleted')
          navigate('/Home')
        } catch (err) {
          nexusToast.error(err?.response?.data?.message || 'Delete failed')
        }
      },
    })
  }

  const handleInvite = async () => {
    const target = inviteUserId.trim()
    if (!target) { nexusToast.error('Email is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { nexusToast.error('Enter a valid email'); return }
    setInviting(true)
    try {
      const res = await inviteMember(id, { userId: inviteUserId.trim(), role: inviteRole })
      const token = res?.data?.token
      if (token) {
        const link = `spifora.com/invitations/accept?token=${token}`
       //const link = `ephemeral-cat-104b46.netlify.app/inviations/accept?token=${token}` // Frontend route only; backend accepts token without origin for flexibility across environments.
        setInviteLink(link)
      }
      nexusToast.success(`Invitation sent to ${inviteUserId.trim()}`)
      setInviteUserId('')
      setInviteRole('member')
      load()
    } catch (err) {
      nexusToast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    setRoleChanging(userId)
    try {
      await updateMemberRole(id, userId, newRole)
      nexusToast.success('Role updated')
      load()
    } catch (err) {
      nexusToast.error(err?.response?.data?.message || 'Failed to update role')
    } finally {
      setRoleChanging(null)
    }
  }

  const handleRemove = (userId, name) => {
    askConfirm({
      title: 'Remove member',
      message: `Remove ${name} from this organization?`,
      confirmLabel: 'Remove member',
      danger: true,
      onConfirm: async () => {
        try {
          await removeMember(id, userId)
          nexusToast.success('Member removed')
          load()
        } catch (err) {
          nexusToast.error(err?.response?.data?.message || 'Failed to remove member')
        }
      },
    })
  }

  const handleCancelInvite = (invitationId, invitedUserId) => {
    askConfirm({
      title: 'Cancel invitation',
      message: `Cancel invitation for ${invitedUserId}?`,
      confirmLabel: 'Cancel invitation',
      danger: true,
      onConfirm: async () => {
        try {
          await cancelInvitation(id, invitationId)
          nexusToast.success('Invitation cancelled')
          load()
        } catch (err) {
          nexusToast.error('Failed to cancel invitation')
        }
      },
    })
  }

  const inputStyle = {
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    color: textPri,
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  }

  const btnStyle = (variant = 'primary') => ({
    padding: '9px 18px',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    ...(variant === 'primary' && {
      background: accent,
      color: accentFg,
    }),
    ...(variant === 'danger' && {
      background: 'rgba(239,68,68,0.12)',
      color: '#f87171',
      border: '1px solid rgba(239,68,68,0.2)',
    }),
    ...(variant === 'ghost' && {
      background: bgInset,
      color: textSec,
      border: `1px solid ${border}`,
    }),
  })

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bgPage }}>
      <div style={{ color: textSec, fontSize: '14px' }}>Loading...</div>
    </div>
  )

  // Access gate — only owner or roles granted Settings access.
  if (!settingsAllowed) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bgPage, gap: 12 }}>
      <div style={{ fontSize: 34 }}>🔒</div>
      <div style={{ color: textPri, fontSize: 16, fontWeight: 700 }}>No access to Settings</div>
      <div style={{ color: textSec, fontSize: 13 }}>Ask the organization owner to grant you Settings access.</div>
      <button onClick={() => navigate('/Home')} style={{ marginTop: 8, padding: '8px 18px', borderRadius: 9, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Back to Home</button>
    </div>
  )

  return (
    <div style={{ background: bgPage, minHeight: '100%', padding: '28px 24px', fontFamily: '"Hanken Grotesk", system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,450;0,500;0,600;0,700;0,800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .os-select { appearance: none; -webkit-appearance: none; }
        .os-select option { background: ${bgCard}; color: ${textPri}; }
        .os-row:hover { background: ${bgInset} !important; }
        .os-tab { cursor: pointer; transition: all 0.15s; }
        .os-card { transition: border-color .2s ease, box-shadow .2s ease; }
      `}</style>

      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button onClick={() => navigate('/Home')} style={{ ...btnStyle('ghost'), padding: '7px 12px' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 style={{ color: textPri, fontSize: '18px', fontWeight: '700', margin: 0, fontFamily: 'inherit' }}>
              {org?.name}
            </h1>
            <p style={{ color: textSec, fontSize: '12px', margin: '2px 0 0' }}>
              {members.length} member{members.length !== 1 ? 's' : ''} · Your role: <span style={{ color: ROLE_COLORS[myRole]?.text }}>{myRole}</span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: bgInset, padding: '4px', borderRadius: '10px', width: 'fit-content', border: `1px solid ${border}` }}>
          {['members', 'permissions', 'approvals', 'settings', 'numbering'].map((t) => (
            <button
              key={t}
              className="os-tab"
              onClick={() => setTab(t)}
              style={{
                padding: '7px 18px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: tab === t ? '600' : '500',
                fontFamily: 'inherit',
                background: tab === t ? bgCard : 'transparent',
                color: tab === t ? accent : textSec,
                boxShadow: tab === t ? shadowSm : 'none',
                textTransform: 'capitalize',
              }}
            >{t}</button>
          ))}
        </div>

        {/* ── Members Tab ── */}
        {tab === 'members' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Invite form */}
            {canManage && (
              <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '20px', boxShadow: shadowSm }}>
                <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 14px', fontFamily: 'inherit' }}>
                  Invite Member
                </h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <input
                    type="email"
                    style={{ ...inputStyle, flex: '1', minWidth: '200px' }}
                    placeholder="Email to invite"
                    value={inviteUserId}
                    onChange={(e) => setInviteUserId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <CustomSelect
                    value={inviteRole}
                    options={['admin', ...customRoles].map((r) => ({ value: r, label: roleLabel(r) }))}
                    onChange={setInviteRole}
                    colors={{ accent, border, inputBg, textPri, bgCard, shadow: shadowSm, accentSoft }}
                  />
                  <button onClick={handleInvite} disabled={inviting} style={{ ...btnStyle('primary'), opacity: inviting ? 0.6 : 1 }}>
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
                <p style={{ color: textSec, fontSize: '11px', marginTop: '8px' }}>
                  Enter the person's email. We email them an invite link; if they don't have an account yet, sign-up pre-fills this email. They sign in with this email to accept.
                </p>

                {/* Invite link — shown after a successful invite */}
                {inviteLink && (
                  <div style={{
                    marginTop: '14px',
                    background: isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.04)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}>
                    <p style={{ color: '#4ade80', fontSize: '11px', fontWeight: '600', margin: '0 0 8px' }}>
                      Invitation link — share this with the user
                    </p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        readOnly
                        value={inviteLink}
                        style={{ ...inputStyle, flex: 1, fontSize: '11px', color: textSec, cursor: 'text' }}
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        onClick={() => { navigator.clipboard.writeText(inviteLink); nexusToast.success('Link copied!') }}
                        style={{ ...btnStyle('ghost'), whiteSpace: 'nowrap', fontSize: '12px' }}
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => setInviteLink('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: textSec, padding: '6px', lineHeight: 0 }}
                        title="Dismiss"
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Members list */}
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', overflow: 'hidden', boxShadow: shadowSm }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}` }}>
                <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: 0, fontFamily: 'inherit' }}>
                  Members ({members.length})
                </h3>
              </div>
              {members.map((m) => (
                <div
                  key={m._id}
                  className="os-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: `1px solid ${border}`,
                    gap: '12px',
                    transition: 'background 0.12s',
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: accentSoft,
                    border: `1px solid ${accentLine}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ color: accent, fontSize: '13px', fontWeight: '700', fontFamily: 'inherit' }}>
                      {m.userId.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: textPri, fontSize: '13px', fontWeight: '500', margin: 0 }}>
                      {m.userId}
                      {m.userId === user?.userId && <span style={{ color: textSec, fontSize: '11px', marginLeft: '6px' }}>(you)</span>}
                    </p>
                    <p style={{ color: textSec, fontSize: '11px', margin: '2px 0 0' }}>
                      Joined {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                      {m.invitedBy ? ` · Invited by ${m.invitedBy}` : ''}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Role selector (only for non-owner members, only if you're admin/owner) */}
                    {canManage && m.role !== 'owner' && m.userId !== user?.userId ? (
                      <CustomSelect
                        value={m.role}
                        options={['admin', ...customRoles].map((r) => ({ value: r, label: roleLabel(r) }))}
                        onChange={(v) => handleRoleChange(m.userId, v)}
                        disabled={roleChanging === m.userId}
                        colors={{ accent, border, inputBg, textPri, bgCard, shadow: shadowSm, accentSoft }}
                      />
                    ) : (
                      <RoleBadge role={m.role} />
                    )}

                    {/* Remove button */}
                    {canManage && m.role !== 'owner' && m.userId !== user?.userId && (
                      <button
                        onClick={() => handleRemove(m.userId, m.userId)}
                        title="Remove member"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px', borderRadius: '6px', lineHeight: 0 }}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: textSec, fontSize: '13px' }}>
                  No members yet.
                </div>
              )}
            </div>

            {/* Pending invitations */}
            {invitations.length > 0 && (
              <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', overflow: 'hidden', boxShadow: shadowSm }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}` }}>
                  <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: 0, fontFamily: 'inherit' }}>
                    Pending Invitations ({invitations.length})
                  </h3>
                </div>
                {invitations.map((inv) => (
                  <div key={inv._id} className="os-row" style={{
                    display: 'flex', alignItems: 'center', padding: '13px 20px',
                    borderBottom: `1px solid ${border}`, gap: '12px',
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: textPri, fontSize: '13px', margin: 0 }}>
                        {inv.userId}
                        <span style={{ marginLeft: '8px' }}><RoleBadge role={inv.role} /></span>
                      </p>
                      <p style={{ color: textSec, fontSize: '11px', margin: '3px 0 0' }}>
                        Invited by {inv.invitedBy} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {inv.token && (
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/invitations/accept?token=${inv.token}`
                            navigator.clipboard.writeText(link)
                            nexusToast.success('Invite link copied!')
                          }}
                          title="Copy invite link"
                          style={{ ...btnStyle('ghost'), padding: '6px 12px', fontSize: '12px' }}
                        >
                          Copy Link
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => handleCancelInvite(inv._id, inv.userId)}
                          style={{ ...btnStyle('danger'), padding: '6px 12px', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Permissions Tab — per-role module access + approvals ── */}
        {tab === 'permissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: 860 }}>

            {/* Manage roles */}
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Roles</h3>
              <p style={{ color: textSec, fontSize: 12, margin: '0 0 16px' }}>Create your own roles. Owner &amp; Admin are built-in (full access).</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {['owner', 'admin'].map(r => (
                  <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: inputBg, border: `1px solid ${border}`, fontSize: 12, color: textSec, textTransform: 'capitalize' }}>{r} <span style={{ fontSize: 9, opacity: .7 }}>built-in</span></span>
                ))}
                {customRoles.map(r => (
                  <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: accentSoft, border: `1px solid ${accentLine}`, fontSize: 12, color: accent }}>
                    {roleLabel(r)}
                    {canManage && <button onClick={() => removeRole(r)} disabled={rolesSaving} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>}
                  </span>
                ))}
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRole()}
                    placeholder="New role name (e.g. accountant)" maxLength={24}
                    style={{ flex: 1, maxWidth: 280, padding: '8px 12px', borderRadius: 8, border: `1px solid ${inputBorder}`, background: inputBg, color: textPri, fontSize: 13, outline: 'none' }} />
                  <button onClick={addRole} disabled={rolesSaving || !newRoleName.trim()} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add Role</button>
                </div>
              )}
            </div>

            {/* Role-scoped access editor — pick a role, edit just that role */}
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Access Per Role</h3>
              <p style={{ color: textSec, fontSize: 12, margin: '0 0 16px' }}>Pick a role to set its module access &amp; approvals. Owner &amp; Admin always have full access.</p>

              {/* Role picker */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {customRoles.map(r => {
                  const on = (selectedRole === r) || (!customRoles.includes(selectedRole) && customRoles[0] === r)
                  return (
                    <button key={r} onClick={() => setSelectedRole(r)}
                      style={{ padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${on ? accent : border}`, background: on ? accentSoft : inputBg, color: on ? accent : textPri, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                      {roleLabel(r)}
                    </button>
                  )
                })}
              </div>

              {/* Quick templates — one-click presets for the selected role */}
              {canManage && customRoles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 20, padding: '12px 14px', borderRadius: 10, background: inputBg, border: `1px dashed ${border}` }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: textSec, marginRight: 4 }}>Quick template:</span>
                  {ROLE_TEMPLATES.map(tpl => (
                    <button key={tpl.key} onClick={() => applyTemplate(tpl)} title={tpl.desc}
                      style={{ padding: '6px 13px', borderRadius: 999, border: `1px solid ${accentLine}`, background: accentSoft, color: accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {tpl.label}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, color: textSec, marginLeft: 'auto' }}>Fills the matrix below — review &amp; Save.</span>
                </div>
              )}

              {(() => {
                const role = customRoles.includes(selectedRole) ? selectedRole : customRoles[0]
                if (!role) return null
                // Only offer modules this org's license actually includes — granting
                // a capability on a module the license doesn't cover is meaningless
                // (backend blocks it regardless) and confusing to show as toggleable.
                // Empty/absent license.modules = unrestricted, same rule the backend
                // and sidebar already use (see licenseAllows in helper/permissions.js).
                const licensedKeys = org?.license?.modules
                const visibleModules = (Array.isArray(licensedKeys) && licensedKeys.length > 0)
                  ? PERM_MODULES.filter(m => licensedKeys.includes(m.key))
                  : PERM_MODULES
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Module access — independent View / Add / Edit capabilities */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Module Access</p>
                      <p style={{ fontSize: 11, color: textSec, margin: '-4px 0 10px' }}>View = read · Add = create · Edit = change · Delete = remove · Export = download/print. Combine freely; none ticked = no access. <strong style={{ color: textPri }}>All / Own</strong> next to View, Edit and Delete sets whether that action applies to every record or only the user's own. Add has no scope (creating a new record).</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[...new Set(visibleModules.map(m => m.group))].map(group => (
                          <div key={group}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 6px' }}>{group}</p>
                            {/* Column header */}
                            <div style={{ display: 'grid', gridTemplateColumns: PERM_GRID, gap: 8, alignItems: 'center', padding: '0 12px 5px' }}>
                              <span />
                              {PERM_CAPS.map(cap => (
                                <span key={cap} style={{ fontSize: 9.5, fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'center' }}>{cap}</span>
                              ))}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {visibleModules.filter(m => m.group === group).map(m => (
                                <div key={m.key} style={{ display: 'grid', gridTemplateColumns: PERM_GRID, gap: 8, alignItems: 'center', padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 10, background: inputBg }}>
                                  <span style={{ fontSize: 13, color: textPri, fontWeight: 500 }}>{m.label}</span>
                                  {PERM_CAPS.map(cap => {
                                    const on = hasModCap(role, m.key, cap)
                                    const scoped = on && (cap === 'view' || cap === 'edit' || cap === 'delete')
                                    const sv = scopeOf(role, m.key, cap)
                                    return (
                                      <div key={cap} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <input type="checkbox" checked={on} disabled={!canManage} title={cap}
                                          onChange={() => canManage && toggleModCap(role, m.key, cap)}
                                          style={{ width: 15, height: 15, cursor: canManage ? 'pointer' : 'default', accentColor: accent }} />
                                        {scoped && (
                                          <div style={{ display: 'inline-flex', border: `1px solid ${border}`, borderRadius: 6, overflow: 'hidden' }}>
                                            {['all', 'own'].map(o => (
                                              <button key={o} type="button" disabled={!canManage}
                                                onClick={() => canManage && setScope(role, m.key, cap, o)}
                                                style={{ padding: '1px 6px', fontSize: 8.5, fontWeight: 800, border: 'none', cursor: canManage ? 'pointer' : 'default', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.03em', background: sv === o ? (o === 'own' ? '#f59e0b' : accent) : 'transparent', color: sv === o ? '#fff' : textSec }}>{o}</button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Settings access grant (owner-controlled). Approval rights are now
                        configured per-module in the Approvals tab, not here. */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Settings Access</p>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', border: `1px solid ${settingsGrant(role) ? accent : border}`, borderRadius: 10, background: inputBg, cursor: isOwner ? 'pointer' : 'default' }}>
                        <span style={{ fontSize: 13, color: textPri, fontWeight: 500 }}>Can open organization Settings</span>
                        <input type="checkbox" checked={settingsGrant(role)} disabled={!isOwner}
                          onChange={() => isOwner && toggleSettingsGrant(role)}
                          style={{ width: 16, height: 16, cursor: isOwner ? 'pointer' : 'default' }} />
                      </label>
                      {!isOwner && <p style={{ fontSize: 11, color: textSec, margin: '6px 0 0' }}>Only the owner can grant Settings access.</p>}
                    </div>
                  </div>
                )
              })()}
            </div>

            {canManage && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={savePermissions} disabled={permSaving}
                  style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: permSaving ? 'wait' : 'pointer' }}>
                  {permSaving ? 'Saving…' : 'Save Permissions'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Settings Tab ── */}
        {tab === 'approvals' && (
          <ApprovalsWorkflow orgId={id} customRoles={customRoles} canManage={canManage} />
        )}

        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 18px', fontFamily: 'inherit' }}>
                General Settings
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', color: textSec, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Organization Name
                  </label>
                  <input
                    style={inputStyle}
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: textSec, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Description
                  </label>
                  <textarea
                    style={{ ...inputStyle, resize: 'none' }}
                    rows={3}
                    value={orgDesc}
                    onChange={(e) => setOrgDesc(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: textSec, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Address
                  </label>
                  <textarea
                    style={{ ...inputStyle, resize: 'none' }}
                    rows={3}
                    placeholder="Company address (shown on documents)"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: textSec, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Base Currency
                  </label>
                  <input
                    style={{ ...inputStyle, maxWidth: 140, textTransform: 'uppercase' }}
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value.toUpperCase().slice(0, 3))}
                    maxLength={3}
                    placeholder="AED"
                    disabled={!canManage}
                  />
                  <p style={{ color: textSec, fontSize: '11px', margin: '6px 0 0' }}>
                    Reporting/ledger currency. Foreign-currency invoices convert to this on the books.
                  </p>
                </div>
                {canManage && (
                  <div>
                    <button onClick={handleSave} disabled={saving} style={{ ...btnStyle('primary'), opacity: saving ? 0.6 : 1 }}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Letterhead ── */}
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 4px', fontFamily: 'inherit' }}>
                Document Letterhead
              </h3>
              <p style={{ color: textSec, fontSize: '12px', margin: '0 0 18px' }}>
                Upload your company letterhead image (PNG or JPG, max 3 MB). It will replace the default header on delivery notes and printed documents.
              </p>

              {/* Preview */}
              {letterhead ? (
                <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: `1px solid ${border}` }}>
                  <img src={letterhead} alt="Letterhead preview" style={{ width: '100%', display: 'block', maxHeight: 160, objectFit: 'contain', background: '#fff' }} />
                </div>
              ) : (
                <div style={{ marginBottom: 16, borderRadius: 10, border: `2px dashed ${border}`, padding: '28px 0', textAlign: 'center', color: textSec, fontSize: 13 }}>
                  No letterhead uploaded yet
                </div>
              )}

              {/* Padding controls — only shown when a letterhead is loaded */}
              {letterhead && canManage && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Header height (%)', value: letterheadTopPad, set: setLetterheadTopPad, hint: '% of letterhead taken by the header — increase if content overlaps logo' },
                    { label: 'Footer height (%)', value: letterheadBottomPad, set: setLetterheadBottomPad, hint: '% of letterhead taken by the footer' },
                  ].map(({ label, value, set, hint }) => (
                    <div key={label}>
                      <label style={{ display: 'block', color: textSec, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</label>
                      <input
                        type="number" min={0} max={50} value={value}
                        onChange={(e) => set(Number(e.target.value))}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${inputBorder}`, background: inputBg, color: textPri, fontSize: 13, boxSizing: 'border-box' }}
                      />
                      <p style={{ color: textSec, fontSize: 11, margin: '3px 0 0' }}>{hint}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Hidden file input */}
              <input ref={letterheadInputRef} type="file" accept="image/png,image/jpeg,image/jpg" style={{ display: 'none' }} onChange={handleLetterheadFile} />

              {canManage && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => letterheadInputRef.current?.click()}
                    style={{ ...btnStyle('ghost'), flex: 1 }}>
                    {letterhead ? '↑ Replace Image' : '↑ Upload Image'}
                  </button>
                  {letterhead && (
                    <button
                      onClick={handleLetterheadSave}
                      disabled={letterheadSaving}
                      style={{ ...btnStyle('primary'), flex: 1, opacity: letterheadSaving ? 0.6 : 1 }}>
                      {letterheadSaving ? 'Saving…' : 'Save Letterhead'}
                    </button>
                  )}
                  {letterhead && (
                    <button
                      onClick={handleLetterheadRemove}
                      disabled={letterheadSaving}
                      style={{ padding: '9px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: 'inherit', opacity: letterheadSaving ? 0.6 : 1 }}>
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Company Stamp / Seal ── */}
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 4px', fontFamily: 'inherit' }}>
                Company Stamp / Seal
              </h3>
              <p style={{ color: textSec, fontSize: '12px', margin: '0 0 18px' }}>
                Upload your company stamp (transparent PNG recommended, max 2 MB). It appears in the signature area of delivery notes.
              </p>

              {stamp ? (
                <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: `1px solid ${border}`, display: 'flex', justifyContent: 'center', background: '#fff', padding: 12 }}>
                  <img src={stamp} alt="Stamp preview" style={{ maxHeight: 130, maxWidth: 200, objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ marginBottom: 16, borderRadius: 10, border: `2px dashed ${border}`, padding: '28px 0', textAlign: 'center', color: textSec, fontSize: 13 }}>
                  No stamp uploaded yet
                </div>
              )}

              <input ref={stampInputRef} type="file" accept="image/png,image/jpeg,image/jpg" style={{ display: 'none' }} onChange={handleStampFile} />

              {canManage && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => stampInputRef.current?.click()} style={{ ...btnStyle('ghost'), flex: 1 }}>
                    {stamp ? '↑ Replace Stamp' : '↑ Upload Stamp'}
                  </button>
                  {stamp && (
                    <button onClick={handleStampSave} disabled={stampSaving} style={{ ...btnStyle('primary'), flex: 1, opacity: stampSaving ? 0.6 : 1 }}>
                      {stampSaving ? 'Saving…' : 'Save Stamp'}
                    </button>
                  )}
                  {stamp && (
                    <button onClick={handleStampRemove} disabled={stampSaving}
                      style={{ padding: '9px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: 'inherit', opacity: stampSaving ? 0.6 : 1 }}>
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Salutations */}
            {canManage && (
              <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm }}>
                <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 6px', fontFamily: 'inherit' }}>
                  Salutations
                </h3>
                <p style={{ color: textSec, fontSize: '12px', margin: '0 0 14px' }}>
                  Manage the salutation options available when creating customers.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                  {salutations.map(s => (
                    <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '999px', background: accentSoft, border: `1px solid ${accentLine}`, fontSize: '13px', fontWeight: '600', color: accent }}>
                      {s}
                      <button onClick={() => removeSalutation(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 0 0 2px', fontSize: '13px', lineHeight: 1, display: 'flex', alignItems: 'center', opacity: 0.7 }}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={newSalutation}
                    onChange={e => setNewSalutation(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSalutation(); } }}
                    placeholder="e.g. Prof., Engr."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={addSalutation} disabled={savingSalutations || !newSalutation.trim()} style={{ ...btnStyle('primary'), opacity: savingSalutations ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    {savingSalutations ? 'Saving…' : '+ Add'}
                  </button>
                </div>
              </div>
            )}

            {/* Yearly sales target — drives the sales-rep dashboard progress */}
            {canManage && (
              <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm }}>
                <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 6px', fontFamily: 'inherit' }}>
                  Yearly Sales Target
                </h3>
                <p style={{ color: textSec, fontSize: '12px', margin: '0 0 14px' }}>
                  Org-wide sales target for the year. Shown as the progress goal on each sales rep's dashboard.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    value={yearlyTarget}
                    onChange={e => setYearlyTarget(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveTarget(); } }}
                    placeholder="e.g. 1000000"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={saveTarget} disabled={savingTarget} style={{ ...btnStyle('primary'), opacity: savingTarget ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    {savingTarget ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* Danger zone */}
            {myRole === 'owner' && (
              <div style={{ background: bgCard, border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '22px' }}>
                <h3 style={{ color: '#f87171', fontSize: '14px', fontWeight: '600', margin: '0 0 8px', fontFamily: 'inherit' }}>
                  Danger Zone
                </h3>
                <p style={{ color: textSec, fontSize: '12px', margin: '0 0 14px' }}>
                  Permanently delete this organization and all its data. This action cannot be undone.
                </p>
                <button onClick={handleDelete} style={btnStyle('danger')}>
                  Delete Organization
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Numbering Tab ── */}
        {tab === 'numbering' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {!canManage && (
              <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm, color: textSec, fontSize: 13 }}>
                Only owners and admins can edit numbering formats.
              </div>
            )}
            {canManage && (
              <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm }}>
                <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 6px', fontFamily: 'inherit' }}>
                  Document & Code Numbering
                </h3>
                <p style={{ color: textSec, fontSize: '12px', margin: '0 0 14px' }}>
                  Build the format for any auto-generated number. Pick a document, order the pieces — e.g. Text + Year + Counter.
                  The counter resets each period when a Month or Year piece comes before it.
                </p>

                {/* Quote-by-salesperson toggle — only relevant to the Quote document */}
                {numEntity === 'quote' && (
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', borderRadius: 10, background: bgInset, border: `1px solid ${quoteBySalesperson ? accent : border}`, marginBottom: 16, cursor: 'pointer' }}>
                    <div>
                      <div style={{ color: textPri, fontSize: 13, fontWeight: 600 }}>Quote number by signatory</div>
                      <div style={{ color: textSec, fontSize: 11.5, marginTop: 2 }}>
                        Overrides the Quote format below. Pattern: <strong style={{ fontFamily: 'ui-monospace, monospace' }}>INITIALS/MMYY/MM##</strong> — e.g. <strong style={{ fontFamily: 'ui-monospace, monospace' }}>MS/0626/0601</strong> for a quote signed "Muhammed Shahid" (counter resets monthly per signatory).
                      </div>
                    </div>
                    <input type="checkbox" checked={quoteBySalesperson} onChange={toggleQuoteBySalesperson} style={{ width: 18, height: 18, accentColor: accent, cursor: 'pointer', flexShrink: 0 }} />
                  </label>
                )}

                {/* Entity picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  <span style={{ color: textSec, fontSize: 12, fontWeight: 600 }}>Document</span>
                  <CustomSelect
                    value={numEntity}
                    options={NUM_ENTITIES.map(e => ({ value: e.key, label: e.label }))}
                    onChange={switchEntity}
                    colors={{ accent, border, inputBg, textPri, bgCard, shadow: shadowSm, accentSoft }}
                  />
                  <button onClick={resetEntity} title="Reset to default"
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: bgInset, color: textSec, border: `1px solid ${border}`, fontFamily: 'inherit' }}>
                    Reset to default
                  </button>
                </div>

                {/* Live preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: bgInset, border: `1px solid ${border}` }}>
                  <span style={{ color: textSec, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Next number</span>
                  <span style={{ color: accent, fontSize: 18, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '.06em' }}>
                    {renderNumberPreview(numSegs) || '—'}
                  </span>
                </div>

                {/* Segment rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                  {numSegs.map((seg, i) => {
                    const sel = { ...inputStyle, width: 'auto', padding: '6px 8px', fontSize: 12, borderRadius: 8 }
                    const segColors = { border, inputBg, textPri, accent, accentSoft, bgCard, shadow: shadowSm }
                    return (
                      <div key={i}
                        onDragEnter={e => { e.preventDefault(); if (dragOverIdx !== i) setDragOverIdx(i) }}
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                        onDrop={e => { e.preventDefault(); moveSegTo(dragIdx, i); endDrag() }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10,
                          background: bgInset,
                          border: `1px solid ${dragOverIdx === i && dragIdx !== null && dragIdx !== i ? accent : border}`,
                          opacity: dragIdx === i ? 0.4 : 1, transition: 'opacity .15s, border-color .15s' }}>
                        <div draggable
                          onDragStart={e => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) }}
                          onDragEnd={endDrag}
                          title="Drag to reorder"
                          style={{ cursor: 'grab', color: textSec, opacity: 0.7, fontSize: 14, lineHeight: 1, padding: '0 2px', userSelect: 'none' }}>⠿</div>

                        <CustomSelect value={seg.type} disabled={!canManage}
                          options={NUM_SEG_TYPES.map(t => ({ value: t.value, label: t.label }))}
                          onChange={v => updateSeg(i, newSegment(v))}
                          colors={segColors} />

                        {seg.type === 'literal' && (
                          <input value={seg.value || ''} onChange={e => updateSeg(i, { value: e.target.value })}
                            placeholder="text e.g. - / CUST" style={{ ...sel, minWidth: 110 }} />
                        )}

                        {(seg.type === 'month' || seg.type === 'year' || seg.type === 'day') && (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: textSec, fontSize: 12 }}>
                            Digits
                            <CustomSelect value={String(seg.digits || (seg.type === 'year' ? 4 : 2))} disabled={!canManage}
                              options={(seg.type === 'year' ? [2, 4] : [1, 2, 3]).map(d => ({ value: String(d), label: String(d) }))}
                              onChange={v => updateSeg(i, { digits: +v })}
                              colors={segColors} />
                          </label>
                        )}

                        {seg.type === 'sequence' && (
                          <>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: textSec, fontSize: 12 }}>
                              Style
                              <CustomSelect value={seg.mode || 'digit'} disabled={!canManage}
                                options={[{ value: 'digit', label: 'Numbers (1,2,3)' }, { value: 'alpha', label: 'Letters (A,B,C)' }]}
                                onChange={v => updateSeg(i, { mode: v })}
                                colors={segColors} />
                            </label>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: textSec, fontSize: 12 }}>
                              Width
                              <CustomSelect value={String(seg.digits || 4)} disabled={!canManage}
                                options={[1, 2, 3, 4, 5, 6].map(d => ({ value: String(d), label: String(d) }))}
                                onChange={v => updateSeg(i, { digits: +v })}
                                colors={segColors} />
                            </label>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: textSec, fontSize: 12 }}>
                              Start
                              <input type="number" min={1} value={seg.start ?? 1} onChange={e => updateSeg(i, { start: Math.max(1, +e.target.value || 1) })}
                                style={{ ...sel, width: 64 }} />
                            </label>
                          </>
                        )}

                        <button onClick={() => removeSeg(i)} title="Remove"
                          style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', borderRadius: 6, width: 24, height: 24, fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    )
                  })}
                </div>

                {/* Add piece + save */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: textSec, fontSize: 12 }}>Add:</span>
                  {NUM_SEG_TYPES.map(t => (
                    <button key={t.value} onClick={() => addSeg(t.value)}
                      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: accentSoft, border: `1px solid ${accentLine}`, color: accent, fontFamily: 'inherit' }}>
                      + {t.label}
                    </button>
                  ))}
                  <span style={{ width: 1, height: 18, background: border, margin: '0 2px' }} />
                  <span style={{ color: textSec, fontSize: 12 }}>Sep:</span>
                  {[
                    { ch: '-', label: '-' },
                    { ch: '/', label: '/' },
                    { ch: '.', label: '.' },
                    { ch: ' ', label: '␣' },
                  ].map(s => (
                    <button key={s.ch} onClick={() => addSepSeg(s.ch)} title={`Add "${s.ch === ' ' ? 'space' : s.ch}" separator`}
                      style={{ width: 28, height: 28, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: bgInset, border: `1px solid ${border}`, color: textPri, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s.label}
                    </button>
                  ))}
                  <button onClick={saveNumbering} disabled={savingNum || !numSegs.some(s => s.type === 'sequence')}
                    style={{ ...btnStyle('primary'), marginLeft: 'auto', opacity: (savingNum || !numSegs.some(s => s.type === 'sequence')) ? 0.6 : 1 }}>
                    {savingNum ? 'Saving…' : 'Save Format'}
                  </button>
                </div>
                {!numSegs.some(s => s.type === 'sequence') && (
                  <p style={{ color: '#f59e0b', fontSize: 11, margin: '10px 0 0' }}>
                    Add a Counter piece so each record gets a unique number.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom confirm modal */}
      {confirmState && (
        <div
          onClick={() => !confirmBusy && setConfirmState(null)}
          style={{ position: 'fixed', inset: 0, background: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(20,22,28,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, animation: 'os-fade-in 0.12s ease' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, background: bgCard, border: `1px solid ${border}`, borderRadius: 16, boxShadow: shadowSm, padding: '22px 22px 18px', animation: 'os-pop 0.14s ease', fontFamily: 'inherit' }}
          >
            <h3 style={{ color: textPri, fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{confirmState.title}</h3>
            <p style={{ color: textSec, fontSize: 13, lineHeight: 1.55, margin: '0 0 20px' }}>{confirmState.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmState(null)} disabled={confirmBusy}
                style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: confirmBusy ? 'default' : 'pointer', fontFamily: 'inherit', background: bgInset, color: textSec, border: `1px solid ${border}` }}>
                Cancel
              </button>
              <button onClick={runConfirm} disabled={confirmBusy}
                style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: confirmBusy ? 'wait' : 'pointer', fontFamily: 'inherit', border: 'none',
                  background: confirmState.danger ? '#dc2f3c' : accent, color: '#fff', opacity: confirmBusy ? 0.7 : 1 }}>
                {confirmBusy ? 'Working…' : (confirmState.confirmLabel || 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes os-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes os-pop { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  )
}

export default OrganizationSettings
