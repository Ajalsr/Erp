import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import useOrganization from '../../helper/useOrganization'
import useAuthStore from '../../store/useAuthStore'
import toast from 'react-hot-toast'

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

// There is no public backend — every org's data lives behind that org's own
// desktop install (a local Go sidecar on :8080). A browser tab has nothing to
// call, so it can't independently verify or accept an invitation; it can
// only hand off to the desktop app (or point at the installer if there isn't
// one yet). Only inside the Tauri webview does :8080 actually resolve to a
// running backend, so that's the only context that runs the real accept flow.
const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const AcceptInvitation = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const { acceptInvitation, getInvitationByToken, getMyOrganizations } = useOrganization()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg)

  const [invite, setInvite] = useState(null)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isDesktop) { setLoadingInvite(false); return } // web tab — nothing to fetch, see WebHandoff below
    if (!token) { setError('No invitation token provided.'); setLoadingInvite(false); return }
    getInvitationByToken(token)
      .then((data) => setInvite(data))
      .catch(() => setError('Invitation not found or has expired.'))
      .finally(() => setLoadingInvite(false))
  }, [token])

  // Best-effort hand off to the installed desktop app via its spifora://
  // scheme — harmless when the app isn't installed (OS just ignores the
  // unknown protocol) and WebHandoff below covers that case visibly.
  useEffect(() => {
    if (!token || isDesktop) return
    window.location.href = `spifora://invitations/accept?token=${encodeURIComponent(token)}`
  }, [token])

  if (!isDesktop) return <WebHandoff token={token} />

  const handleAccept = async () => {
    if (!isAuthenticated) {
      navigate(`/?redirect=${encodeURIComponent(`/invitations/accept?token=${token}`)}`)
      return
    }
    setAccepting(true)
    try {
      const res = await acceptInvitation(token)
      const { orgId, orgName, role } = res.data
      await getMyOrganizations()
      setActiveOrg({ _id: orgId, name: orgName, role })
      setDone(true)
      toast.success(`Joined ${orgName}!`)
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        .ai-root { font-family: 'DM Sans', sans-serif; }
        .ai-heading { font-family: 'Sora', sans-serif; }
        .ai-bg {
          background: #0a0f1e;
          background-image:
            radial-gradient(ellipse 80% 60% at 50% 30%, rgba(30,64,175,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 80%, rgba(14,165,233,0.06) 0%, transparent 50%);
        }
        .ai-card {
          background: rgba(15,23,42,0.97);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
        }
        .ai-btn-primary {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border: none; cursor: pointer; transition: all 0.2s; font-family: inherit;
        }
        .ai-btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          transform: translateY(-1px); box-shadow: 0 8px 25px rgba(37,99,235,0.4);
        }
        .ai-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .ai-btn-ghost {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer; transition: all 0.15s; font-family: inherit; color: #94a3b8;
        }
        .ai-btn-ghost:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }
      `}</style>

      <div className="ai-root ai-bg min-h-screen flex items-center justify-center p-4">
        <div className="ai-card rounded-2xl w-full max-w-md p-8 shadow-2xl">

          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <img src="/spifora-icon.png" alt="Spifora" style={{ height: 32, width: 32, objectFit: 'contain' }} />
            <span className="ai-heading text-white font-bold text-lg">SPIFORA</span>
          </div>

          {loadingInvite ? (
            <div className="text-center py-8">
              <div style={{ color: '#64748b', fontSize: '14px' }}>Loading invitation...</div>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚫</div>
              <h2 className="ai-heading text-white text-xl font-bold mb-2">Invalid Invitation</h2>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>{error}</p>
              <button onClick={() => navigate('/')} className="ai-btn-ghost w-full py-3 rounded-xl text-sm font-semibold">
                Back to Login
              </button>
            </div>
          ) : done ? (
            <div className="text-center py-4">
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎉</div>
              <h2 className="ai-heading text-white text-xl font-bold mb-2">You're in!</h2>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
                You've joined <strong style={{ color: '#e2e8f0' }}>{invite?.orgName}</strong> as <strong style={{ color: '#60a5fa' }}>{ROLE_LABELS[invite?.role]}</strong>.
              </p>
              <button onClick={() => navigate('/Home')} className="ai-btn-primary w-full py-3 rounded-xl text-white text-sm font-semibold">
                Go to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '24px' }}>
                <h1 className="ai-heading text-white text-xl font-bold mb-1">You're invited!</h1>
                <p style={{ color: '#64748b', fontSize: '13px' }}>Review the details below and accept to join.</p>
              </div>

              {/* Invite card */}
              <div style={{
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.15)',
                borderRadius: '14px',
                padding: '18px',
                marginBottom: '22px',
              }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span className="ai-heading" style={{ color: '#60a5fa', fontSize: '18px', fontWeight: '700' }}>
                      {invite?.orgName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: '600', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      {invite?.orgName}
                    </p>
                    <p style={{ color: '#64748b', fontSize: '11px', margin: '2px 0 0' }}>Organization</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Invited as</span>
                    <span style={{
                      background: 'rgba(59,130,246,0.15)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59,130,246,0.25)',
                      padding: '2px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'capitalize',
                    }}>{invite?.role}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Invited by</span>
                    <span style={{ color: '#e2e8f0', fontSize: '12px' }}>{invite?.invitedBy}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Email</span>
                    <span style={{ color: '#e2e8f0', fontSize: '12px' }}>{invite?.userId}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>Expires</span>
                    <span style={{ color: '#e2e8f0', fontSize: '12px' }}>
                      {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {invite?.status !== 'pending' && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
                  color: '#f87171', fontSize: '12px',
                }}>
                  This invitation is {invite?.status}. It can no longer be accepted.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {invite?.status === 'pending' && (
                  <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="ai-btn-primary w-full py-3 rounded-xl text-white text-sm font-semibold"
                  >
                    {accepting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Accepting...
                      </span>
                    ) : isAuthenticated ? 'Accept Invitation' : 'Log in to Accept'}
                  </button>
                )}

                {/* Not logged in — offer both login and signup paths */}
                {!isAuthenticated && invite?.status === 'pending' && (
                  <button
                    onClick={() => navigate(`/Signup?redirect=${encodeURIComponent(`/invitations/accept?token=${token}`)}&email=${encodeURIComponent(invite?.userId || '')}&token=${encodeURIComponent(token || '')}`)}
                    className="ai-btn-ghost w-full py-3 rounded-xl text-sm font-semibold"
                    style={{ color: '#94a3b8' }}
                  >
                    Don't have an account? Sign up
                  </button>
                )}

                <button onClick={() => navigate(isAuthenticated ? '/Home' : '/')} className="ai-btn-ghost w-full py-3 rounded-xl text-sm font-semibold">
                  {invite?.status === 'pending' ? 'Decline' : 'Back'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// Shown to a plain browser tab (no local backend to talk to). Not an error
// state — the invite itself may be perfectly valid, this page just can't
// check. It only ever hands off to the desktop app or to the installer.
const WebHandoff = ({ token }) => {
  const retry = () => {
    if (token) window.location.href = `spifora://invitations/accept?token=${encodeURIComponent(token)}`
  }
  const downloadUrl = `${window.location.origin}/spifora.html`

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .ai-root { font-family: 'DM Sans', sans-serif; }
        .ai-heading { font-family: 'Sora', sans-serif; }
        .ai-bg {
          background: #0a0f1e;
          background-image:
            radial-gradient(ellipse 80% 60% at 50% 30%, rgba(30,64,175,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 80%, rgba(14,165,233,0.06) 0%, transparent 50%);
        }
        .ai-card {
          background: rgba(15,23,42,0.97);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
        }
        .ai-btn-primary {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border: none; cursor: pointer; transition: all 0.2s; font-family: inherit; text-decoration: none; display: block;
        }
        .ai-btn-primary:hover { background: linear-gradient(135deg, #3b82f6, #2563eb); transform: translateY(-1px); box-shadow: 0 8px 25px rgba(37,99,235,0.4); }
        .ai-btn-ghost {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer; transition: all 0.15s; font-family: inherit; color: #94a3b8; text-decoration: none; display: block;
        }
        .ai-btn-ghost:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }
      `}</style>

      <div className="ai-root ai-bg min-h-screen flex items-center justify-center p-4">
        <div className="ai-card rounded-2xl w-full max-w-md p-8 shadow-2xl text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <img src="/spifora-icon.png" alt="Spifora" style={{ height: 32, width: 32, objectFit: 'contain' }} />
            <span className="ai-heading text-white font-bold text-lg">SPIFORA</span>
          </div>

          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🡵</div>
          <h2 className="ai-heading text-white text-xl font-bold mb-2">Opening Spifora Desktop…</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px', lineHeight: 1.6 }}>
            {token
              ? "This invitation opens inside the desktop app, not the browser. If nothing happened, use the buttons below."
              : 'This link is missing its invitation token.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {token && (
              <button onClick={retry} className="ai-btn-primary w-full py-3 rounded-xl text-white text-sm font-semibold">
                Open Spifora
              </button>
            )}
            <a href={downloadUrl} className="ai-btn-ghost w-full py-3 rounded-xl text-sm font-semibold">
              Don't have it yet? Download Spifora
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

export default AcceptInvitation
