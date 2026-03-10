import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IoNotificationsOutline, IoChevronDown } from 'react-icons/io5'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'

const PAGE_TITLES = {
  '/Home': 'Dashboard',
  '/Items/Items': 'Items',
  '/Items/item-groups': 'Item Groups',
  '/Items/price-lists': 'Price Lists',
  '/Inventory/stock-summary': 'Stock Summary',
  '/Inventory/warehouses': 'Warehouses',
  '/Sales/Customers': 'Customers',
  '/Sales/Salesorders': 'Sales Orders',
  '/Sales/Invoices': 'Invoices',
  '/Sales/Deliverynote': 'Delivery Notes',
  '/Sales/Outbound': 'Outbound',
  '/Sales/PaymentsReceived': 'Payments Received',
  '/Sales/CreditNotes': 'Credit Notes',
  '/Purchase/Vendors': 'Vendors',
  '/Purchase/Purchaseorders': 'Purchase Orders',
  '/Purchase/Bills': 'Bills',
  '/Purchase/PaymentsMade': 'Payments Made',
  '/Purchase/VendorCredits': 'Vendor Credits',
}

const BREADCRUMB_PARENTS = {
  '/Sales': 'Sales',
  '/Purchase': 'Purchases',
  '/Items': 'Items',
  '/Inventory': 'Inventory',
  '/Reports': 'Reports',
}

const getPageInfo = (pathname) => {
  if (PAGE_TITLES[pathname]) return { title: PAGE_TITLES[pathname], parent: null }
  const match  = Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k))
  const parent = Object.keys(BREADCRUMB_PARENTS).find((k) => pathname.startsWith(k))
  return {
    title:  match  ? PAGE_TITLES[match]         : 'Dashboard',
    parent: parent ? BREADCRUMB_PARENTS[parent] : null,
  }
}

// ── Animated theme toggle ─────────────────────────────────────────
const ThemeToggle = ({ isDark, onToggle }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '7px',
        padding:      '5px 10px',
        borderRadius: '20px',
        border:       isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
        background:   isDark
          ? (hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)')
          : (hovered ? '#f1f5f9' : '#f8fafc'),
        cursor:     'pointer',
        transition: 'all 0.2s ease',
        userSelect: 'none',
        outline:    'none',
      }}
    >
      {/* Sun */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        style={{ color: isDark ? 'rgba(100,116,139,0.55)' : '#f59e0b', transition: 'color 0.25s', flexShrink: 0 }}>
        <circle cx="12" cy="12" r="5" strokeWidth="2" />
        <path strokeWidth="2" strokeLinecap="round"
          d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>

      {/* Track */}
      <div style={{
        position:     'relative',
        width:        '34px',
        height:       '18px',
        borderRadius: '9px',
        background:   isDark ? '#3b82f6' : '#cbd5e1',
        transition:   'background 0.25s ease',
        flexShrink:   0,
      }}>
        {/* Thumb */}
        <div style={{
          position:     'absolute',
          top:          '2px',
          left:         isDark ? '16px' : '2px',
          width:        '14px',
          height:       '14px',
          borderRadius: '50%',
          background:   'white',
          boxShadow:    '0 1px 4px rgba(0,0,0,0.3)',
          transition:   'left 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </div>

      {/* Moon */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        style={{ color: isDark ? '#60a5fa' : 'rgba(148,163,184,0.45)', transition: 'color 0.25s', flexShrink: 0 }}>
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
const Navbar = ({ onToggleSidebar }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen,    setNotifOpen]    = useState(false)
  const dropdownRef = useRef(null)
  const notifRef    = useRef(null)
  const navigate    = useNavigate()
  const location    = useLocation()

  const user        = useAuthStore((s) => s.user)
  const clearAuth   = useAuthStore((s) => s.clearAuth)
  const isDark      = useThemeStore((s) => s.isDark)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  const { title, parent } = getPageInfo(location.pathname)
  const initials = (user?.userId || 'U').charAt(0).toUpperCase()

  const handleSignOut = () => { clearAuth(); navigate('/') }

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
      if (notifRef.current    && !notifRef.current.contains(e.target))    setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Token shortcuts ────────────────────────────────────────────
  const D = {
    navBg:       isDark ? '#0c1220'                   : '#ffffff',
    border:      isDark ? 'rgba(255,255,255,0.06)'    : '#e2e8f0',
    textPri:     isDark ? '#e2e8f0'                   : '#0f172a',
    textSec:     isDark ? 'rgba(100,116,139,0.9)'     : '#64748b',
    iconHoverBg: isDark ? 'rgba(255,255,255,0.05)'    : '#f1f5f9',
    divider:     isDark ? 'rgba(255,255,255,0.08)'    : '#e2e8f0',
    dropdownBg:  isDark ? '#0f172a'                   : '#ffffff',
    dropdownBorder: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    dropdownShadow: isDark ? '0 20px 48px rgba(0,0,0,0.55)' : '0 12px 32px rgba(0,0,0,0.1)',
    itemColor:   isDark ? '#94a3b8'                   : '#475569',
    itemHoverBg: isDark ? 'rgba(255,255,255,0.05)'    : '#f8fafc',
    itemHoverColor: isDark ? '#e2e8f0'                : '#0f172a',
    avatarBg:    isDark ? 'rgba(59,130,246,0.18)'     : '#eff6ff',
    avatarBorder:isDark ? 'rgba(59,130,246,0.28)'     : '#bfdbfe',
    avatarText:  isDark ? '#93c5fd'                   : '#1d4ed8',
    notifDotBorder: isDark ? '#0c1220'                : '#ffffff',
    subText:     isDark ? '#475569'                   : '#94a3b8',
    notifItemBorder: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;500&display=swap');
        .nx-navbar  { font-family: 'Inter', sans-serif; transition: background 0.25s ease, border-color 0.25s ease; }
        .nx-navbar-title { font-family: 'Plus Jakarta Sans', sans-serif; }
        .nx-icon-btn {
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px; background: transparent; cursor: pointer;
          transition: all 0.15s; border: 1px solid transparent;
          color: ${D.textSec};
        }
        .nx-icon-btn:hover {
          background: ${D.iconHoverBg};
          color: ${isDark ? '#94a3b8' : '#374151'};
          border-color: ${D.divider};
        }
        .nx-notif-dot {
          position: absolute; top: 6px; right: 6px;
          width: 6px; height: 6px; border-radius: 50%;
          background: #ef4444; border: 1.5px solid ${D.notifDotBorder};
        }
        .nx-dropdown {
          background: ${D.dropdownBg};
          border: 1px solid ${D.dropdownBorder};
          box-shadow: ${D.dropdownShadow};
          position: absolute; right: 0; top: calc(100% + 8px);
          border-radius: 14px; overflow: hidden; z-index: 50;
        }
        .nx-dropdown-item {
          width: 100%; text-align: left; display: flex; align-items: center;
          gap: 10px; background: none; border: none; cursor: pointer;
          font-family: inherit; color: ${D.itemColor}; transition: all 0.13s;
          padding: 9px 16px; font-size: 13px;
        }
        .nx-dropdown-item:hover { background: ${D.itemHoverBg}; color: ${D.itemHoverColor}; }
        .nx-dropdown-item.danger { color: #f87171; }
        .nx-dropdown-item.danger:hover { background: rgba(239,68,68,0.08); }
        .nx-avatar-btn {
          background: ${D.avatarBg};
          border: 1.5px solid ${D.avatarBorder};
          transition: all 0.15s;
        }
        .nx-avatar-btn:hover { border-color: ${isDark ? 'rgba(59,130,246,0.6)' : '#93c5fd'}; }
        .nx-sep { border-top: 1px solid ${D.notifItemBorder}; }
      `}</style>

      <nav className="nx-navbar" style={{
        background:   D.navBg,
        borderBottom: `1px solid ${D.border}`,
        height:       '56px',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
        padding:      '0 16px',
        flexShrink:   0,
      }}>

        {/* ── Left ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onToggleSidebar} className="nx-icon-btn"
            style={{ width: '32px', height: '32px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {parent && (
              <>
                <span style={{ fontSize: '13px', color: isDark ? '#64748b' : '#94a3b8' }}>{parent}</span>
                <span style={{ fontSize: '13px', color: isDark ? 'rgba(71,85,105,0.55)' : '#cbd5e1' }}>/</span>
              </>
            )}
            <span className="nx-navbar-title" style={{ fontSize: '13px', fontWeight: '600', color: D.textPri }}>{title}</span>
          </div>
        </div>

        {/* ── Right ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

          {/* Theme toggle */}
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

          <div style={{ width: '1px', height: '20px', background: D.divider, margin: '0 2px' }} />

          {/* Notifications */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button onClick={() => setNotifOpen(!notifOpen)} className="nx-icon-btn"
              style={{ width: '32px', height: '32px', position: 'relative' }}>
              <IoNotificationsOutline size={17} />
              <span className="nx-notif-dot" />
            </button>

            {notifOpen && (
              <div className="nx-dropdown" style={{ width: '280px' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: D.textPri, fontSize: '13px', fontWeight: '600', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Notifications</span>
                  <span style={{ fontSize: '10px', color: '#60a5fa', background: 'rgba(59,130,246,0.12)', padding: '2px 8px', borderRadius: '999px', border: '1px solid rgba(59,130,246,0.2)' }}>3 new</span>
                </div>
                {[
                  { text: 'New sales order received',  time: '2m ago',  dot: '#3b82f6' },
                  { text: 'Stock level low: Item A',   time: '1h ago',  dot: '#f59e0b' },
                  { text: 'Invoice #1042 overdue',     time: '3h ago',  dot: '#ef4444' },
                ].map((n, i) => (
                  <div key={i} className="nx-dropdown-item nx-sep" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '11px 16px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: n.dot, marginTop: '5px', flexShrink: 0 }} />
                    <div>
                      <p style={{ color: isDark ? '#cbd5e1' : '#374151', fontSize: '12px', margin: 0 }}>{n.text}</p>
                      <p style={{ color: D.subText, fontSize: '11px', margin: '3px 0 0' }}>{n.time}</p>
                    </div>
                  </div>
                ))}
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${D.border}` }}>
                  <button style={{ color: '#60a5fa', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    View all notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ width: '1px', height: '20px', background: D.divider }} />

          {/* User menu */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="nx-icon-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', width: 'auto', height: 'auto' }}>
              <div className="nx-avatar-btn" style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: D.avatarText, fontSize: '12px', fontWeight: '700', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{initials}</span>
              </div>
              {user && (
                <div style={{ textAlign: 'left' }}>
                  <p style={{ color: isDark ? '#cbd5e1' : '#374151', fontSize: '12px', fontWeight: '500', margin: 0, lineHeight: 1.3 }}>{user.userId}</p>
                  <p style={{ color: D.subText, fontSize: '11px', margin: 0, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.companyName || 'Organization'}
                  </p>
                </div>
              )}
              <IoChevronDown size={12} style={{ color: D.subText }} />
            </button>

            {dropdownOpen && (
              <div className="nx-dropdown" style={{ width: '210px' }}>
                <div style={{ padding: '13px 16px', borderBottom: `1px solid ${D.border}` }}>
                  <p style={{ color: D.textPri, fontSize: '13px', fontWeight: '600', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{user?.userId || 'User'}</p>
                  <p style={{ color: D.subText, fontSize: '11px', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.companyName || 'Organization'}
                  </p>
                </div>
                <div style={{ padding: '4px 0' }}>
                  <button className="nx-dropdown-item">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </button>
                  <button className="nx-dropdown-item">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>
                </div>
                <div style={{ borderTop: `1px solid ${D.border}`, padding: '4px 0' }}>
                  <button onClick={handleSignOut} className="nx-dropdown-item danger">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}

export default Navbar