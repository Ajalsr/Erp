import { Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import Sidebar    from './Home/Sidebar'
import Navbar     from './Home/Navbar'
import UnsavedModal from './common/UnsavedModal'
// import TourGuide  from './Tour/TourGuide'
import useThemeStore from '../store/useThemeStore'
import useWebSocket from '../helper/useWebSocket'
import useNotifications from '../helper/useNotifications'
import useOrganization from '../helper/useOrganization'
import useAuthStore from '../store/useAuthStore'
import useIsMobile from '../helper/useIsMobile'
import KeyboardShortcuts from './common/KeyboardShortcuts'

export default function Layout() {
  const isMobile = useIsMobile()
  const [sidebarToggle, setSidebarToggle] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Only show the full-screen gate when we have NO org info yet (first login).
  // On a refresh/return the active org is restored from sessionStorage, so render
  // the app immediately and refresh orgs in the background — no blank "Loading...".
  const [orgLoading, setOrgLoading] = useState(() => !useAuthStore.getState().activeOrg)
  const isDark = useThemeStore((s) => s.isDark)
  const navigate = useNavigate()

  const addNotification = useAuthStore((s) => s.addNotification)
  const activeOrg = useAuthStore((s) => s.activeOrg)
  const organizations = useAuthStore((s) => s.organizations)
  const { fetchNotifications } = useNotifications()
  const { getMyOrganizations } = useOrganization()

  useEffect(() => {
    fetchNotifications()
    // Always fetch orgs on mount to handle page refreshes
    getMyOrganizations().catch(() => {}).finally(() => setOrgLoading(false))
  }, [])

  const onEvent = useCallback((event) => {
    if (event.type === 'notification' && event.payload) {
      addNotification(event.payload)
    }
  }, [addNotification])

  useWebSocket(onEvent)

  // Mobile: sidebar is an off-canvas drawer, main takes full width.
  const sidebarWidth = isMobile ? '0px' : (sidebarToggle ? '60px' : '220px')
  const bg = isDark ? '#080d1a' : '#f1f5f9'

  // Hamburger: toggles the drawer on mobile, collapse on desktop.
  const onToggleSidebar = () => isMobile ? setMobileOpen(o => !o) : setSidebarToggle(t => !t)

  // Show "no org" screen while loading or if user has no org
  if (orgLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: bg, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  if (!activeOrg && organizations.length === 0) {
    return (
      <div style={{
        display: 'flex', height: '100vh', background: '#0a0f1e',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(30,64,175,0.12) 0%, transparent 60%)',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif',
      }}>
        <div style={{
          background: 'rgba(15,23,42,0.97)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#60a5fa">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
            </svg>
          </div>

          <h1 style={{ color: '#f1f5f9', fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
            No Organization Yet
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
            You're not part of any organization yet. If a teammate invited you, open that invitation link to join theirs — you don't need anything below.
          </p>

          <button
            onClick={() => navigate('/organizations/create')}
            style={{
              width: '100%', padding: '12px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer', marginBottom: '10px',
            }}
          >
            Set up a new organization
          </button>

          <p style={{ color: '#475569', fontSize: '12px', marginTop: '16px' }}>
            Requires a license key — <a href="https://spifora.com/spifora.html#modules" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>get one at spifora.com</a> if you don't have one yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: bg, transition: 'background 0.25s ease' }}>
      <KeyboardShortcuts />
      <Sidebar
        isCollapsed={!isMobile && sidebarToggle}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Mobile drawer backdrop */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 19, background: 'rgba(0,0,0,0.5)' }} />
      )}

      <div style={{
        marginLeft:    sidebarWidth,
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        minWidth:      0,
        transition:    'margin-left 0.3s ease',
      }}>
        <Navbar onToggleSidebar={onToggleSidebar} />

        <main style={{
          flex:       1,
          overflowY:  'auto',
          overflowX:  'hidden',
          background: bg,
          transition: 'background 0.25s ease',
        }}>
          <Outlet />
        </main>
      </div>

      {/* <TourGuide /> */}
      <UnsavedModal />
    </div>
  )
}
