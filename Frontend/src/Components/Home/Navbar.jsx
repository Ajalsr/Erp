import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IoNotificationsOutline, IoChevronDown } from 'react-icons/io5'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'
import useOrganization from '../../helper/useOrganization'
import useNotifications from '../../helper/useNotifications'

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
  '/Purchase/GRN': 'GRN',
  '/Purchase/Inbound': 'Inbound',
  '/Purchase/Stock': 'Stock',
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

// ── Org Switcher ──────────────────────────────────────────────────
const OrgSwitcher = ({ isDark, D }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  const activeOrg     = useAuthStore((s) => s.activeOrg)
  const organizations = useAuthStore((s) => s.organizations)
  const { getMyOrganizations, switchOrganization } = useOrganization()

  useEffect(() => {
    if (organizations.length === 0) getMyOrganizations().catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSwitch = (org) => { switchOrganization(org); setOpen(false) }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
          background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
          border: `1px solid ${D.border}`,
          transition: 'all 0.15s',
          fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: '18px', height: '18px', borderRadius: '5px',
          background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: '#60a5fa', fontSize: '9px', fontWeight: '800', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {(activeOrg?.name || 'O').charAt(0).toUpperCase()}
          </span>
        </div>
        <span style={{ color: D.textPri, fontSize: '12px', fontWeight: '500', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeOrg?.name || 'No org'}
        </span>
        <IoChevronDown size={10} style={{ color: D.textSec, flexShrink: 0 }} />
      </button>

      {open && (
        <div className="nx-dropdown" style={{ width: '230px' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}` }}>
            <span style={{ color: D.textSec, fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Organizations
            </span>
          </div>
          <div style={{ padding: '4px 0', maxHeight: '220px', overflowY: 'auto' }}>
            {organizations.map((org) => (
              <button
                key={org._id}
                className="nx-dropdown-item"
                onClick={() => handleSwitch(org)}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                    background: activeOrg?._id === org._id ? 'rgba(59,130,246,0.2)' : (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                    border: `1px solid ${activeOrg?._id === org._id ? 'rgba(59,130,246,0.3)' : D.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: activeOrg?._id === org._id ? '#60a5fa' : D.textSec, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</span>
                </div>
                {activeOrg?._id === org._id && (
                  <svg width="12" height="12" fill="none" stroke="#60a5fa" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
            {organizations.length === 0 && (
              <p style={{ color: D.textSec, fontSize: '12px', padding: '10px 14px', margin: 0 }}>No organizations</p>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${D.border}`, padding: '4px 0' }}>
            {activeOrg && (
              <button
                className="nx-dropdown-item"
                onClick={() => { setOpen(false); navigate(`/organizations/${activeOrg._id}/settings`) }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Org Settings & Members
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
const Navbar = ({ onToggleSidebar }) => {
  const [dropdownOpen,  setDropdownOpen]  = useState(false)
  const [notifOpen,     setNotifOpen]     = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchVal,     setSearchVal]     = useState('')
  const dropdownRef = useRef(null)
  const notifRef    = useRef(null)
  const navigate    = useNavigate()
  const location    = useLocation()

  const user              = useAuthStore((s) => s.user)
  const activeOrg         = useAuthStore((s) => s.activeOrg)
  const clearAuth         = useAuthStore((s) => s.clearAuth)
  const notifications     = useAuthStore((s) => s.notifications)
  const unreadCount       = useAuthStore((s) => s.unreadCount)
  const isDark            = useThemeStore((s) => s.isDark)
  const toggleTheme       = useThemeStore((s) => s.toggleTheme)
  const { markAllRead, deleteNotification } = useNotifications()
  const isAdmin           = ["owner", "admin"].includes((activeOrg?.role || "").toLowerCase())

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
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        .nx-navbar  { font-family: 'DM Sans', sans-serif; transition: background 0.25s ease, border-color 0.25s ease; }
        .nx-navbar-title { font-family: 'Sora', sans-serif; }
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

        {/* ── Center search ── */}
        <div style={{ flex: 1, maxWidth: '420px', margin: '0 16px', position: 'relative' }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: D.textSec, pointerEvents: 'none', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" strokeWidth="2"/><path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search across Nexus…"
            style={{
              width: '100%', height: '32px',
              padding: '0 32px 0 32px',
              border: `1px solid ${searchFocused ? (isDark ? 'rgba(59,130,246,0.5)' : '#93c5fd') : D.border}`,
              borderRadius: '8px',
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
              color: D.textPri, fontSize: '12px',
              outline: 'none', fontFamily: 'inherit',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: searchFocused ? (isDark ? '0 0 0 3px rgba(59,130,246,0.15)' : '0 0 0 3px rgba(147,197,253,0.3)') : 'none',
            }}
          />
          {searchVal && (
            <button onClick={() => setSearchVal('')}
              style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.textSec, padding: 0, lineHeight: 1, fontSize: '14px' }}>
              ×
            </button>
          )}
        </div>

        {/* ── Right ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

          {/* Theme toggle */}
          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

          <div style={{ width: '1px', height: '20px', background: D.divider, margin: '0 2px' }} />

          {/* Org switcher */}
          <OrgSwitcher isDark={isDark} D={D} />

          <div style={{ width: '1px', height: '20px', background: D.divider, margin: '0 2px' }} />

          {/* Notifications */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="nx-icon-btn"
              style={{ width: '32px', height: '32px', position: 'relative' }}
            >
              <IoNotificationsOutline size={17} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '5px', right: '5px',
                  minWidth: '14px', height: '14px', borderRadius: '999px',
                  background: '#ef4444', border: `1.5px solid ${D.notifDotBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', fontWeight: '700', color: '#fff', lineHeight: 1,
                  padding: '0 2px',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="nx-dropdown" style={{ width: '300px' }}>

                {/* Header */}
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: D.textPri, fontSize: '13px', fontWeight: '600', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span style={{ fontSize: '10px', color: '#60a5fa', background: 'rgba(59,130,246,0.12)', padding: '2px 8px', borderRadius: '999px', border: '1px solid rgba(59,130,246,0.2)' }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{ color: '#60a5fa', fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: D.textSec, fontSize: '12px' }}>
                      No notifications yet
                    </div>
                  ) : notifications.map((n) => {
                    const dotColor = { invite: '#60a5fa', accepted: '#4ade80', role_changed: '#fbbf24', removed: '#f87171', cancel_request: '#ef4444' }[n.type] || '#94a3b8'
                    const ago = (() => {
                      const s = Math.floor((Date.now() - new Date(n.createdAt)) / 1000)
                      if (s < 60) return `${s}s ago`
                      if (s < 3600) return `${Math.floor(s / 60)}m ago`
                      if (s < 86400) return `${Math.floor(s / 3600)}h ago`
                      return `${Math.floor(s / 86400)}d ago`
                    })()
                    const isCancelReq = n.type === 'cancel_request' && isAdmin
                    return (
                      <div
                        key={n._id}
                        className="nx-sep"
                        onClick={isCancelReq ? () => { setNotifOpen(false); navigate('/Sales/Outbound'); } : undefined}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '10px',
                          padding: '11px 14px',
                          background: isCancelReq
                            ? (isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)')
                            : n.read ? 'transparent' : (isDark ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.03)'),
                          cursor: isCancelReq ? 'pointer' : 'default',
                        }}
                      >
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: dotColor, marginTop: '5px', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: n.read ? D.textSec : (isDark ? '#cbd5e1' : '#374151'), fontSize: '12px', margin: 0, fontWeight: n.read ? 400 : 500 }}>{n.title}</p>
                          <p style={{ color: D.subText, fontSize: '11px', margin: '2px 0 0', lineHeight: 1.4 }}>{n.message}</p>
                          <p style={{ color: D.subText, fontSize: '10px', margin: '3px 0 0', opacity: 0.7 }}>{ago}</p>
                          {isCancelReq && (
                            <p style={{ color: '#ef4444', fontSize: '10px', margin: '4px 0 0', fontWeight: '600' }}>
                              Click to review in Outbound →
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteNotification(n._id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.textSec, padding: '2px', flexShrink: 0, opacity: 0.5, lineHeight: 1 }}
                          title="Dismiss"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
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