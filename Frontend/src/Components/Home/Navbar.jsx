import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IoNotificationsOutline, IoChevronDown } from 'react-icons/io5'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'
import useTourStore from '../../store/useTourStore'
import useOrganization from '../../helper/useOrganization'
import useNotifications from '../../helper/useNotifications'
import { clearPermissions } from '../../helper/permissions'
import axiosInstance from '../../helper/axiosInstance'

// ── Global search result types → icon, label, and the route to open ──
// Keys match the backend SearchResult.type (search_controller.go).
const RESULT_TYPES = {
  customer:       { label: 'Customer',       color: '#3b82f6', route: (r) => `/Sales/Customers/edit/${r.id}` },
  item:           { label: 'Item',           color: '#8b5cf6', route: ()  => `/Items/Items` },
  invoice:        { label: 'Invoice',        color: '#10b981', route: (r) => `/Sales/Invoices/${r.id}/print` },
  sales_order:    { label: 'Sales Order',    color: '#0ea5e9', route: (r) => `/Sales/Salesorders/Newsalesorders/${r.id}` },
  quote:          { label: 'Quote',          color: '#f59e0b', route: (r) => `/Sales/Quotes/${r.id}` },
  vendor:         { label: 'Vendor',         color: '#ec4899', route: (r) => `/Purchase/Vendors/Edit/${r.id}` },
  bill:           { label: 'Bill',           color: '#ef4444', route: (r) => `/Purchase/Bills/Edit/${r.id}` },
  purchase_order: { label: 'Purchase Order', color: '#f97316', route: ()  => `/Purchase/Purchaseorders` },
}

const PAGE_TITLES = {
  '/Home': 'Dashboard',
  '/Items/Items': 'Items',
  '/Items/item-groups': 'Item Groups',
  '/Items/price-lists': 'Price Lists',
  '/Inventory/stock-summary': 'Stock Summary',
  '/Inventory/warehouses': 'Warehouses',
  '/Inventory/reorder-alerts': 'Reorder Alerts',
  '/Inventory/batch-expiry': 'Batch & Expiry',
  '/Inventory/adjustments': 'Adjustments',
  '/Sales/Customers': 'Customers',
  '/Sales/Enquiries': 'Enquiries',
  '/Sales/Quotes': 'Quotes',
  '/Sales/Salesorders': 'Sales Orders',
  '/Sales/Invoices': 'Invoices',
  '/Sales/Createinvoices': 'New Invoice',
  '/Sales/RecurringInvoices': 'Recurring Invoices',
  '/Sales/Deliverynote': 'Delivery Notes',
  '/Sales/Outbound': 'Outbound',
  '/Sales/PaymentsReceived': 'Payments Received',
  '/Sales/AdvancePayments': 'Customer Advances',
  '/Sales/CreditNotes': 'Credit Notes',
  '/Purchase/Vendors': 'Vendors',
  '/Purchase/Purchaseorders': 'Purchase Orders',
  '/Purchase/GRN': 'GRN',
  '/Purchase/Inbound': 'Inbound',
  '/Purchase/Stock': 'Stock',
  '/Purchase/Bills': 'Bills',
  '/Purchase/PaymentsMade': 'Payments Made',
  '/Purchase/VendorCredits': 'Vendor Credits',
  '/Reports/sales': 'Sales Report',
  '/Reports/purchases': 'Purchase Report',
  '/Reports/inventory': 'Inventory Report',
  '/Reports/aging': 'AR Aging',
  '/Reports/customer-statement': 'Customer Statement',
  '/Reports/vat': 'VAT Report',
  '/Reports/vendor-aging': 'Vendor Aging',
  '/Reports/trial-balance': 'Trial Balance',
  '/Reports/profit-loss': 'Profit & Loss',
  '/Reports/balance-sheet': 'Balance Sheet',
  '/Reports/cash-flow': 'Cash Flow',
  '/Finance/Accounts': 'Chart of Accounts',
  '/Finance/JournalEntries': 'Journal Entries',
  '/Finance/BankReconciliation': 'Bank Reconciliation',
  '/Finance/ExchangeRates': 'Exchange Rates',
}

const BREADCRUMB_PARENTS = {
  '/Sales': 'Sales',
  '/Purchase': 'Purchases',
  '/Items': 'Items',
  '/Inventory': 'Inventory',
  '/Reports': 'Reports',
  '/Finance': 'Finance',
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
  const [results,       setResults]       = useState([])
  const [searchOpen,    setSearchOpen]    = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeIdx,     setActiveIdx]     = useState(-1)
  const dropdownRef = useRef(null)
  const notifRef    = useRef(null)
  const searchRef   = useRef(null)
  const inputRef    = useRef(null)
  const searchSeq   = useRef(0)
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
  const startTour         = useTourStore((s) => s.start)

  const { title, parent } = getPageInfo(location.pathname)
  const initials = (user?.userId || 'U').charAt(0).toUpperCase()

  const handleSignOut = () => { clearPermissions(); clearAuth(); navigate('/') }

  // ── Global search: debounced fetch, stale-response guard ──────────
  useEffect(() => {
    const q = searchVal.trim()
    if (q.length < 2) { setResults([]); setSearchOpen(false); setSearchLoading(false); return }
    setSearchLoading(true)
    const seq = ++searchSeq.current
    const t = setTimeout(() => {
      axiosInstance.get('/api/search', { params: { q } })
        .then((r) => {
          if (seq !== searchSeq.current) return       // a newer query already fired
          setResults(r.data?.results || [])
          setActiveIdx(-1)
          setSearchOpen(true)
        })
        .catch(() => { if (seq === searchSeq.current) setResults([]) })
        .finally(() => { if (seq === searchSeq.current) setSearchLoading(false) })
    }, 250)
    return () => clearTimeout(t)
  }, [searchVal])

  const closeSearch = () => { setSearchOpen(false); setActiveIdx(-1) }

  const selectResult = (r) => {
    if (!r) return
    const meta = RESULT_TYPES[r.type]
    if (meta) navigate(meta.route(r))
    setSearchVal('')
    setResults([])
    closeSearch()
    inputRef.current?.blur()
  }

  const onSearchKeyDown = (e) => {
    if (e.key === 'Escape') { closeSearch(); inputRef.current?.blur(); return }
    if (!searchOpen || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => (i + 1) % results.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => (i - 1 + results.length) % results.length) }
    else if (e.key === 'Enter') { e.preventDefault(); selectResult(results[activeIdx >= 0 ? activeIdx : 0]) }
  }

  // ── Cmd/Ctrl+K focuses the search from anywhere ───────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
      if (notifRef.current    && !notifRef.current.contains(e.target))    setNotifOpen(false)
      if (searchRef.current   && !searchRef.current.contains(e.target))   closeSearch()
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
          border-radius: 14px; overflow: hidden; z-index: 1100;
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
        minHeight:    '56px',
        // Pad past the device status bar — Android/iOS draw edge-to-edge.
        padding:      'var(--safe-top) 16px 0 16px',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
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
        <div ref={searchRef} data-tour="navbar-search" style={{ flex: 1, maxWidth: '420px', margin: '0 16px', position: 'relative' }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: D.textSec, pointerEvents: 'none', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" strokeWidth="2"/><path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onFocus={() => { setSearchFocused(true); if (results.length) setSearchOpen(true) }}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search across Nexus…   (Ctrl+K)"
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
            <button onClick={() => { setSearchVal(''); setResults([]); closeSearch() }}
              style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.textSec, padding: 0, lineHeight: 1, fontSize: '14px' }}>
              ×
            </button>
          )}

          {/* Results dropdown */}
          {searchOpen && searchVal.trim().length >= 2 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: D.dropdownBg, border: `1px solid ${D.dropdownBorder}`,
              borderRadius: '12px', boxShadow: D.dropdownShadow, overflow: 'hidden',
              zIndex: 1100, maxHeight: '420px', overflowY: 'auto',
            }}>
              {searchLoading && results.length === 0 && (
                <div style={{ padding: '14px 16px', fontSize: '12px', color: D.textSec }}>Searching…</div>
              )}
              {!searchLoading && results.length === 0 && (
                <div style={{ padding: '14px 16px', fontSize: '12px', color: D.textSec }}>No matches for “{searchVal.trim()}”.</div>
              )}
              {results.map((r, i) => {
                const meta = RESULT_TYPES[r.type] || { label: r.type, color: D.textSec }
                const active = i === activeIdx
                return (
                  <button
                    key={`${r.type}-${r.id}-${i}`}
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseDown={(e) => { e.preventDefault(); selectResult(r) }}
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 14px', background: active ? D.itemHoverBg : 'transparent',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: D.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title || '—'}
                      </span>
                      {r.subtitle && (
                        <span style={{ display: 'block', fontSize: '11px', color: D.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.subtitle}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                      {meta.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

          {/* Theme toggle */}
          <div data-tour="navbar-theme">
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          </div>

          <div style={{ width: '1px', height: '20px', background: D.divider, margin: '0 2px' }} />

          {/* Org switcher */}
          <div data-tour="navbar-org">
            <OrgSwitcher isDark={isDark} D={D} />
          </div>

          <div style={{ width: '1px', height: '20px', background: D.divider, margin: '0 2px' }} />

          {/* Notifications */}
          <div data-tour="navbar-notif" style={{ position: 'relative' }} ref={notifRef}>
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
                    const dotColor = { invite: '#60a5fa', accepted: '#4ade80', role_changed: '#fbbf24', removed: '#f87171', cancel_request: '#ef4444', approval_request: '#3b82f6', approval_result: n.metadata?.result === 'rejected' ? '#ef4444' : '#10b981', enquiry_followup: '#f59e0b' }[n.type] || '#94a3b8'
                    const ago = (() => {
                      const s = Math.floor((Date.now() - new Date(n.createdAt)) / 1000)
                      if (s < 60) return `${s}s ago`
                      if (s < 3600) return `${Math.floor(s / 60)}m ago`
                      if (s < 86400) return `${Math.floor(s / 3600)}h ago`
                      return `${Math.floor(s / 86400)}d ago`
                    })()
                    const isCancelReq = n.type === 'cancel_request' && isAdmin
                    const isApproval = n.type === 'approval_request' || n.type === 'approval_result'
                    const isEnquiry = n.type === 'enquiry_followup'
                    const clickable = isCancelReq || isApproval || isEnquiry
                    const onClickNotif = isCancelReq
                      ? () => { setNotifOpen(false); navigate('/Sales/Outbound'); }
                      : isApproval
                        // All approval notifications open the Approvals page focused on the
                        // request — the page auto-opens its detail modal (review + Open & Edit).
                        // SOs carry orderId (= the approvals row id); generic docs carry approvalId.
                        ? () => {
                            setNotifOpen(false);
                            const focus = n.metadata?.orderId || n.metadata?.approvalId;
                            navigate(focus ? `/Approvals?id=${focus}` : '/Approvals');
                          }
                        : isEnquiry
                          ? () => {
                              setNotifOpen(false);
                              const focus = n.metadata?.enquiryId;
                              navigate(focus ? `/Sales/Enquiries?id=${focus}` : '/Sales/Enquiries');
                            }
                          : undefined
                    return (
                      <div
                        key={n._id}
                        className="nx-sep"
                        onClick={onClickNotif}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '10px',
                          padding: '11px 14px',
                          background: isCancelReq
                            ? (isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)')
                            : n.read ? 'transparent' : (isDark ? 'rgba(59,130,246,0.04)' : 'rgba(59,130,246,0.03)'),
                          cursor: clickable ? 'pointer' : 'default',
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
                          {isApproval && (
                            <p style={{ color: '#3b82f6', fontSize: '10px', margin: '4px 0 0', fontWeight: '600' }}>
                              Click to review in Approvals →
                            </p>
                          )}
                          {isEnquiry && (
                            <p style={{ color: '#f59e0b', fontSize: '10px', margin: '4px 0 0', fontWeight: '600' }}>
                              Click to open Enquiries →
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
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

          {/* Tour help */}
          <button
            data-tour="tour-help"
            onClick={() => startTour('welcome')}
            className="nx-icon-btn"
            title="Start guided tour"
            style={{ width: '28px', height: '28px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: D.textSec, fontFamily: 'inherit' }}
          >
            ?
          </button>

          {/* User menu */}
          <div data-tour="navbar-user" style={{ position: 'relative' }} ref={dropdownRef}>
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
                  <button className="nx-dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/profile'); }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </button>
                  <button className="nx-dropdown-item" onClick={() => { setDropdownOpen(false); if (activeOrg?._id) navigate(`/organizations/${activeOrg._id}/settings`); }}>
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