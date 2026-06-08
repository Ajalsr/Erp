import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import useOrganization from '../../helper/useOrganization'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'
import nexusToast from '../../helper/nexusToast'
import axiosInstance from '../../helper/axiosInstance'
import { PERM_MODULES, PERM_APPROVALS, PERM_CAPS, invalidatePermissions, usePermissions } from '../../helper/permissions'

const ROLES = ['admin', 'member', 'viewer']

const ROLE_COLORS = {
  owner:  { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  admin:  { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  member: { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80', border: 'rgba(34,197,94,0.2)'  },
  viewer: { bg: 'rgba(148,163,184,0.1)',  text: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
}

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
      textTransform: 'capitalize',
    }}>{role}</span>
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

// Themed dropdown (portal popover so it never clips inside the scrollable matrix).
const CustomSelect = ({ value, options, onChange, disabled, colors: c }) => {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const sel = options.find(o => o.value === value)
  const measure = () => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 84) }) }
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const reposition = () => setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition) }
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
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99999, background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, boxShadow: c.shadow, padding: 4 }}>
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
  const [customRoles, setCustomRoles] = useState(['member', 'viewer'])
  const [newRoleName, setNewRoleName] = useState('')
  const [rolesSaving, setRolesSaving] = useState(false)
  const [selectedRole, setSelectedRole] = useState('member') // role being edited in the panel

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
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

  useEffect(() => {
    axiosInstance.get('/api/org/settings')
      .then(res => { const s = res.data?.data?.salutations; if (Array.isArray(s) && s.length) setSalutations(s); })
      .catch(() => {})
  }, [])

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
        getOrganization(id),
        getMembers(id),
        getOrgInvitations(id).catch(() => []),
      ])
      setOrg(orgData)
      setOrgName(orgData?.name || '')
      setOrgDesc(orgData?.description || '')
      setLetterhead(orgData?.letterheadImage || '')
      setLetterheadTopPad(orgData?.letterheadTopPad || 13)
      setLetterheadBottomPad(orgData?.letterheadBottomPad || 8)
      setStamp(orgData?.stampImage || '')
      setPermCfg(orgData?.rolePermissions || {})
      setCustomRoles(orgData?.customRoles?.length ? orgData.customRoles : ['member', 'viewer'])
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
      await updateOrganization(id, { name: orgName.trim(), description: orgDesc.trim() })
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
  const defaultCapsFor = (role) =>
    (role === 'member' || role === 'viewer') ? ['view'] : []
  const moduleCapsOf = (role, mod) => {
    const s = permCfg?.[role]?.modules?.[mod]
    return Array.isArray(s) ? s : defaultCapsFor(role)
  }
  const hasModCap = (role, mod, cap) => moduleCapsOf(role, mod).includes(cap)
  const toggleModCap = (role, mod, cap) => setPermCfg(p => {
    const cur = Array.isArray(p?.[role]?.modules?.[mod]) ? p[role].modules[mod] : defaultCapsFor(role)
    const next = cur.includes(cap) ? cur.filter(c => c !== cap) : [...cur, cap]
    return { ...p, [role]: { ...(p[role] || {}), modules: { ...(p[role]?.modules || {}), [mod]: next } } }
  })
  // Record scope per module: 'all' (default) or 'own' (only records the user created).
  const scopeOf = (role, mod) => permCfg?.[role]?.scope?.[mod] === 'own' ? 'own' : 'all'
  const setScope = (role, mod, val) => setPermCfg(p => ({
    ...p,
    [role]: { ...(p[role] || {}), scope: { ...(p[role]?.scope || {}), [mod]: val } },
  }))
  const approvalOn = (role, key) => !!permCfg?.[role]?.approvals?.[key]
  const toggleApproval = (role, key) => setPermCfg(p => ({
    ...p,
    [role]: { ...(p[role] || {}), approvals: { ...(p[role]?.approvals || {}), [key]: !p?.[role]?.approvals?.[key] } },
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
    // New role defaults every module record-scope to 'own' (least-privilege). Persists on Save Permissions.
    const ownScope = Object.fromEntries(PERM_MODULES.map(m => [m.key, 'own']))
    setPermCfg(p => ({ ...p, [r]: { ...(p[r] || {}), scope: { ...(p[r]?.scope || {}), ...ownScope } } }))
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
    if (!inviteEmail.trim()) { nexusToast.error('Email is required'); return }
    setInviting(true)
    try {
      const res = await inviteMember(id, { email: inviteEmail.trim(), role: inviteRole })
      const token = res?.data?.token
      if (token) {
        const link = `${window.location.origin}/invitations/accept?token=${token}`
        setInviteLink(link)
      }
      nexusToast.success(`Invitation sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
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
          {['members', 'permissions', 'settings'].map((t) => (
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
                    placeholder="Email address to invite"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <select
                    className="os-select"
                    style={{ ...inputStyle, width: 'auto', minWidth: '110px', paddingRight: '32px', cursor: 'pointer' }}
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    {['admin', ...customRoles].map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                  <button onClick={handleInvite} disabled={inviting} style={{ ...btnStyle('primary'), opacity: inviting ? 0.6 : 1 }}>
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
                <p style={{ color: textSec, fontSize: '11px', marginTop: '8px' }}>
                  Enter the person's email. They'll receive a link — no existing account needed.
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
                      <select
                        className="os-select"
                        style={{
                          ...inputStyle,
                          width: 'auto',
                          padding: '5px 10px',
                          fontSize: '12px',
                          opacity: roleChanging === m.userId ? 0.6 : 1,
                        }}
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                        disabled={roleChanging === m.userId}
                      >
                        {['admin', ...customRoles].map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
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
                  <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: accentSoft, border: `1px solid ${accentLine}`, fontSize: 12, color: accent, textTransform: 'capitalize' }}>
                    {r}
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
                      style={{ padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${on ? accent : border}`, background: on ? accentSoft : inputBg, color: on ? accent : textPri, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {r}
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
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Module access — independent View / Add / Edit capabilities */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Module Access</p>
                      <p style={{ fontSize: 11, color: textSec, margin: '-4px 0 10px' }}>View = read · Add = create · Edit = change · Delete = remove · Export = download/print. Combine freely; none ticked = no access. Scope = which records are visible (All / Own only).</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[...new Set(PERM_MODULES.map(m => m.group))].map(group => (
                          <div key={group}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 6px' }}>{group}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {PERM_MODULES.filter(m => m.group === group).map(m => (
                                <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', border: `1px solid ${border}`, borderRadius: 10, background: inputBg }}>
                                  <span style={{ fontSize: 13, color: textPri, fontWeight: 500, minWidth: 120 }}>{m.label}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {PERM_CAPS.map(cap => {
                                      const on = hasModCap(role, m.key, cap)
                                      return (
                                        <label key={cap} title={cap} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: canManage ? 'pointer' : 'default', fontSize: 11, fontWeight: 600, color: on ? accent : textSec, textTransform: 'capitalize' }}>
                                          <input type="checkbox" checked={on} disabled={!canManage}
                                            onChange={() => canManage && toggleModCap(role, m.key, cap)}
                                            style={{ width: 14, height: 14, cursor: canManage ? 'pointer' : 'default' }} />
                                          {cap}
                                        </label>
                                      )
                                    })}
                                    <CustomSelect
                                      value={scopeOf(role, m.key)}
                                      options={[{ value: 'all', label: 'All' }, { value: 'own', label: 'Own' }]}
                                      onChange={(v) => canManage && setScope(role, m.key, v)}
                                      disabled={!canManage}
                                      colors={{ border, inputBg, textPri, accent, accentSoft, bgCard, shadow: shadowSm }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Approvals */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Approval Permissions</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {PERM_APPROVALS.map(a => (
                          <label key={a.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 10, background: inputBg, cursor: canManage ? 'pointer' : 'default' }}>
                            <span style={{ fontSize: 13, color: textPri, fontWeight: 500 }}>{a.label}</span>
                            <input type="checkbox" checked={approvalOn(role, a.key)} disabled={!canManage}
                              onChange={() => canManage && toggleApproval(role, a.key)}
                              style={{ width: 16, height: 16, cursor: canManage ? 'pointer' : 'default' }} />
                          </label>
                        ))}
                      </div>

                      {/* Settings access grant (owner-controlled) */}
                      <p style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '.06em', margin: '18px 0 10px' }}>Settings Access</p>
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

            {/* Role reference */}
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px', boxShadow: shadowSm }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 14px', fontFamily: 'inherit' }}>
                Role Permissions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { role: 'owner',  desc: 'Full control. Can delete organization, manage all members and settings.' },
                  { role: 'admin',  desc: 'Can invite/remove members, change roles, and update organization settings.' },
                  { role: 'member', desc: 'Can access all data, create and edit records.' },
                  { role: 'viewer', desc: 'Read-only access to all organization data.' },
                ].map(({ role, desc }) => (
                  <div key={role} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 12px', borderRadius: '10px', background: bgInset, border: `1px solid ${border}` }}>
                    <RoleBadge role={role} />
                    <p style={{ color: textSec, fontSize: '12px', margin: 0, lineHeight: 1.5 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

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
