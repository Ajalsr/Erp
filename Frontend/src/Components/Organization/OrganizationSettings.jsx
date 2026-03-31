import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useOrganization from '../../helper/useOrganization'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'
import toast from 'react-hot-toast'

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

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')

  // Role change
  const [roleChanging, setRoleChanging] = useState(null)

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

  return (
    <div style={{ background: bgPage, minHeight: '100%', padding: '28px 24px', fontFamily: '"Inter", "DM Sans", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;500&display=swap');
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
          {['members', 'settings'].map((t) => (
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
                    {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
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
                        {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
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
