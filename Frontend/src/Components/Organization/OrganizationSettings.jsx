import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useOrganization from '../../helper/useOrganization'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'
import toast from 'react-hot-toast'
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
      toast.success('Salutations saved')
    } catch { toast.error('Failed to save salutations') }
    finally { setSavingSalutations(false) }
  }

  const addSalutation = () => {
    const v = newSalutation.trim()
    if (!v || salutations.includes(v)) return
    saveSalutations([...salutations, v])
    setNewSalutation('')
  }

  const removeSalutation = (s) => saveSalutations(salutations.filter(x => x !== s))

  const bgPage = isDark ? '#080d1a' : '#f1f5f9'
  const bgCard = isDark ? '#0c1220' : '#ffffff'
  const border  = isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'
  const textPri = isDark ? '#e2e8f0' : '#0f172a'
  const textSec = isDark ? '#64748b' : '#94a3b8'
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc'
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'

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
      setPermCfg(orgData?.rolePermissions || {})
      setCustomRoles(orgData?.customRoles?.length ? orgData.customRoles : ['member', 'viewer'])
      setMembers(membersData)
      setInvitations(invData)
      const me = membersData.find((m) => m.userId === user?.userId)
      setMyRole(me?.role || orgData?.role || '')
    } catch (err) {
      toast.error('Failed to load organization data')
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
    if (!orgName.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      await updateOrganization(id, { name: orgName.trim(), description: orgDesc.trim() })
      if (activeOrg?._id === id) setActiveOrg({ ...activeOrg, name: orgName.trim() })
      toast.success('Organization updated')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleLetterheadFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return }
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
      toast.success('Letterhead saved — will appear on all delivery notes')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save letterhead')
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
      toast.success('Letterhead removed')
    } catch {
      toast.error('Failed to remove letterhead')
    } finally {
      setLetterheadSaving(false)
    }
  }

  // ── Role permissions ──
  const defaultCapsFor = (role) => role === 'viewer' ? ['view'] : ['view', 'add', 'edit']
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
      toast.success('Permissions saved')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save permissions')
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
      toast.success('Roles updated')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update roles')
    } finally {
      setRolesSaving(false)
    }
  }
  const addRole = () => {
    const r = newRoleName.trim().toLowerCase()
    if (!r) return
    if (['owner', 'admin'].includes(r) || customRoles.includes(r)) { toast.error('Role already exists or is reserved'); return }
    saveRoles([...customRoles, r])
    setNewRoleName('')
  }
  const removeRole = (r) => {
    if (customRoles.length <= 1) { toast.error('At least one role required'); return }
    if (!window.confirm(`Remove role "${r}"? Members with this role keep it until reassigned.`)) return
    saveRoles(customRoles.filter(x => x !== r))
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${org?.name}"? This cannot be undone.`)) return
    try {
      await deleteOrganization(id)
      toast.success('Organization deleted')
      navigate('/Home')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed')
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error('Email is required'); return }
    setInviting(true)
    try {
      const res = await inviteMember(id, { email: inviteEmail.trim(), role: inviteRole })
      const token = res?.data?.token
      if (token) {
        const link = `${window.location.origin}/invitations/accept?token=${token}`
        setInviteLink(link)
      }
      toast.success(`Invitation sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      setInviteRole('member')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    setRoleChanging(userId)
    try {
      await updateMemberRole(id, userId, newRole)
      toast.success('Role updated')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update role')
    } finally {
      setRoleChanging(null)
    }
  }

  const handleRemove = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from this organization?`)) return
    try {
      await removeMember(id, userId)
      toast.success('Member removed')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove member')
    }
  }

  const handleCancelInvite = async (invitationId, invitedUserId) => {
    if (!window.confirm(`Cancel invitation for ${invitedUserId}?`)) return
    try {
      await cancelInvitation(id, invitationId)
      toast.success('Invitation cancelled')
      load()
    } catch (err) {
      toast.error('Failed to cancel invitation')
    }
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
      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
      color: '#fff',
    }),
    ...(variant === 'danger' && {
      background: 'rgba(239,68,68,0.12)',
      color: '#f87171',
      border: '1px solid rgba(239,68,68,0.2)',
    }),
    ...(variant === 'ghost' && {
      background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
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
      <button onClick={() => navigate('/Home')} style={{ marginTop: 8, padding: '8px 18px', borderRadius: 9, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Back to Home</button>
    </div>
  )

  return (
    <div style={{ background: bgPage, minHeight: '100%', padding: '28px 24px', fontFamily: '"Inter", "DM Sans", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        .os-select { appearance: none; -webkit-appearance: none; }
        .os-select option { background: #0f172a; color: #e2e8f0; }
        .os-row:hover { background: ${isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'} !important; }
        .os-tab { cursor: pointer; transition: all 0.15s; }
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
            <h1 style={{ color: textPri, fontSize: '18px', fontWeight: '700', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {org?.name}
            </h1>
            <p style={{ color: textSec, fontSize: '12px', margin: '2px 0 0' }}>
              {members.length} member{members.length !== 1 ? 's' : ''} · Your role: <span style={{ color: ROLE_COLORS[myRole]?.text }}>{myRole}</span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
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
                fontWeight: '500',
                fontFamily: 'inherit',
                background: tab === t ? (isDark ? '#1e293b' : '#ffffff') : 'transparent',
                color: tab === t ? textPri : textSec,
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
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
              <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '20px' }}>
                <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 14px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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
                        onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Link copied!') }}
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
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}` }}>
                <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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
                    background: 'rgba(59,130,246,0.12)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ color: '#60a5fa', fontSize: '13px', fontWeight: '700', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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
              <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}` }}>
                  <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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
                            toast.success('Invite link copied!')
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
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px' }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Roles</h3>
              <p style={{ color: textSec, fontSize: 12, margin: '0 0 16px' }}>Create your own roles. Owner &amp; Admin are built-in (full access).</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {['owner', 'admin'].map(r => (
                  <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: inputBg, border: `1px solid ${border}`, fontSize: 12, color: textSec, textTransform: 'capitalize' }}>{r} <span style={{ fontSize: 9, opacity: .7 }}>built-in</span></span>
                ))}
                {customRoles.map(r => (
                  <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', fontSize: 12, color: '#60a5fa', textTransform: 'capitalize' }}>
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
                  <button onClick={addRole} disabled={rolesSaving || !newRoleName.trim()} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add Role</button>
                </div>
              )}
            </div>

            {/* Role-scoped access editor — pick a role, edit just that role */}
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px' }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Access Per Role</h3>
              <p style={{ color: textSec, fontSize: 12, margin: '0 0 16px' }}>Pick a role to set its module access &amp; approvals. Owner &amp; Admin always have full access.</p>

              {/* Role picker */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {customRoles.map(r => {
                  const on = (selectedRole === r) || (!customRoles.includes(selectedRole) && customRoles[0] === r)
                  return (
                    <button key={r} onClick={() => setSelectedRole(r)}
                      style={{ padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${on ? '#3b82f6' : border}`, background: on ? 'rgba(59,130,246,0.12)' : inputBg, color: on ? '#3b82f6' : textPri, fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {r}
                    </button>
                  )
                })}
              </div>

              {(() => {
                const role = customRoles.includes(selectedRole) ? selectedRole : customRoles[0]
                if (!role) return null
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Module access — independent View / Add / Edit capabilities */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Module Access</p>
                      <p style={{ fontSize: 11, color: textSec, margin: '-4px 0 10px' }}>View = read · Add = create new · Edit = change existing. Combine freely; none ticked = no access.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {PERM_MODULES.map(m => (
                          <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', border: `1px solid ${border}`, borderRadius: 10, background: inputBg }}>
                            <span style={{ fontSize: 13, color: textPri, fontWeight: 500 }}>{m.label}</span>
                            <div style={{ display: 'flex', gap: 10 }}>
                              {PERM_CAPS.map(cap => {
                                const on = hasModCap(role, m.key, cap)
                                return (
                                  <label key={cap} title={cap} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: canManage ? 'pointer' : 'default', fontSize: 11, fontWeight: 600, color: on ? '#3b82f6' : textSec, textTransform: 'capitalize' }}>
                                    <input type="checkbox" checked={on} disabled={!canManage}
                                      onChange={() => canManage && toggleModCap(role, m.key, cap)}
                                      style={{ width: 14, height: 14, cursor: canManage ? 'pointer' : 'default' }} />
                                    {cap}
                                  </label>
                                )
                              })}
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
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', border: `1px solid ${settingsGrant(role) ? '#3b82f6' : border}`, borderRadius: 10, background: inputBg, cursor: isOwner ? 'pointer' : 'default' }}>
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
                  style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: permSaving ? 'wait' : 'pointer' }}>
                  {permSaving ? 'Saving…' : 'Save Permissions'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Settings Tab ── */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px' }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 18px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px' }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 4px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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
                      style={{ padding: '9px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: 'Plus Jakarta Sans, sans-serif', opacity: letterheadSaving ? 0.6 : 1 }}>
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Salutations */}
            {canManage && (
              <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px' }}>
                <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 6px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Salutations
                </h3>
                <p style={{ color: textSec, fontSize: '12px', margin: '0 0 14px' }}>
                  Manage the salutation options available when creating customers.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                  {salutations.map(s => (
                    <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '999px', background: isDark ? 'rgba(59,130,246,0.12)' : '#eff6ff', border: `1px solid ${isDark ? 'rgba(59,130,246,0.25)' : '#bfdbfe'}`, fontSize: '13px', fontWeight: '600', color: isDark ? '#60a5fa' : '#1d4ed8' }}>
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
            <div style={{ background: bgCard, border: `1px solid ${border}`, borderRadius: '14px', padding: '22px' }}>
              <h3 style={{ color: textPri, fontSize: '14px', fontWeight: '600', margin: '0 0 14px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                Role Permissions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { role: 'owner',  desc: 'Full control. Can delete organization, manage all members and settings.' },
                  { role: 'admin',  desc: 'Can invite/remove members, change roles, and update organization settings.' },
                  { role: 'member', desc: 'Can access all data, create and edit records.' },
                  { role: 'viewer', desc: 'Read-only access to all organization data.' },
                ].map(({ role, desc }) => (
                  <div key={role} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 12px', borderRadius: '10px', background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: `1px solid ${border}` }}>
                    <RoleBadge role={role} />
                    <p style={{ color: textSec, fontSize: '12px', margin: 0, lineHeight: 1.5 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger zone */}
            {myRole === 'owner' && (
              <div style={{ background: bgCard, border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '22px' }}>
                <h3 style={{ color: '#f87171', fontSize: '14px', fontWeight: '600', margin: '0 0 8px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
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
    </div>
  )
}

export default OrganizationSettings
