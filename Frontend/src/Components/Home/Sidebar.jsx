import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IoHome, IoChevronDown } from 'react-icons/io5'
import { FaBoxOpen, FaCartArrowDown } from 'react-icons/fa'
import { MdInventory2 } from 'react-icons/md'
import { HiShoppingCart } from 'react-icons/hi'
import { TbReportAnalytics } from 'react-icons/tb'
import { MdAccountBalance } from 'react-icons/md'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'

const MENU = [
  { icon: IoHome,            label: 'Home',      route: '/Home' },
  { icon: FaBoxOpen,         label: 'Items',      subItems: [
    { name: 'Items',         route: '/Items/Items' },
    { name: 'Item Groups',   route: '/Items/item-groups' },
    { name: 'Price Lists',   route: '/Items/price-lists' },
  ]},
  { icon: MdInventory2,      label: 'Inventory',  subItems: [
    { name: 'Stock Summary', route: '/Inventory/stock-summary' },
    { name: 'Warehouses',    route: '/Inventory/warehouses' },
    { name: 'Adjustments',   route: '/Inventory/adjustments' },
  ]},
  { icon: HiShoppingCart,    label: 'Sales',      subItems: [
    { name: 'Customers',          route: '/Sales/Customers' },
    { name: 'Sales Orders',       route: '/Sales/Salesorders' },
    { name: 'Invoices',           route: '/Sales/Invoices' },
    { name: 'Delivery Notes',     route: '/Sales/Deliverynote' },
    { name: 'Outbound',           route: '/Sales/Outbound' },
    { name: 'Payments Received',  route: '/Sales/PaymentsReceived' },
    { name: 'Credit Notes',       route: '/Sales/CreditNotes' },
  ]},
  { icon: FaCartArrowDown,   label: 'Purchases',  subItems: [
    { name: 'Vendors',          route: '/Purchase/Vendors' },
    { name: 'Purchase Orders',  route: '/Purchase/Purchaseorders' },
    { name: 'GRN',              route: '/Purchase/GRN' },
    { name: 'Inbound',          route: '/Purchase/Inbound' },
    { name: 'Stock',            route: '/Purchase/Stock' },
    { name: 'Bills',            route: '/Purchase/Bills' },
    { name: 'Payments Made',    route: '/Purchase/PaymentsMade' },
    { name: 'Vendor Credits',   route: '/Purchase/VendorCredits' },
  ]},
  { icon: TbReportAnalytics, label: 'Reports',    subItems: [
    { name: 'Sales Report',     route: '/Reports/sales' },
    { name: 'Purchase Report',  route: '/Reports/purchases' },
    { name: 'Inventory Report', route: '/Reports/inventory' },
  ]},
  { icon: MdAccountBalance,   label: 'Finance',    subItems: [
    { name: 'Chart of Accounts', route: '/Finance/Accounts' },
  ]},
]

const Sidebar = ({ isCollapsed }) => {
  const navigate    = useNavigate()
  const location    = useLocation()
  const user        = useAuthStore((s) => s.user)
  const isDark      = useThemeStore((s) => s.isDark)

  const D = {
    bg:                 isDark ? '#080d1a'                      : '#ffffff',
    border:             isDark ? 'rgba(255,255,255,0.06)'       : '#e2e8f0',
    logoText:           isDark ? '#ffffff'                      : '#0f172a',
    navItemColor:       isDark ? 'rgba(148,163,184,0.8)'        : '#64748b',
    navItemHoverBg:     isDark ? 'rgba(255,255,255,0.05)'       : '#f8fafc',
    navItemHoverColor:  isDark ? '#e2e8f0'                      : '#1e293b',
    navItemActiveBg:    isDark ? 'rgba(59,130,246,0.15)'        : '#eff6ff',
    navItemActiveColor: isDark ? '#60a5fa'                      : '#1d4ed8',
    navIconActive:      isDark ? '#3b82f6'                      : '#2563eb',
    subItemColor:       isDark ? 'rgba(100,116,139,0.9)'        : '#64748b',
    subItemHoverColor:  isDark ? '#94a3b8'                      : '#374151',
    subItemHoverBg:     isDark ? 'rgba(255,255,255,0.03)'       : '#f8fafc',
    subItemActive:      isDark ? '#60a5fa'                      : '#1d4ed8',
    subItemActiveLine:  isDark ? '#3b82f6'                      : '#2563eb',
    chipBg:             isDark ? 'rgba(255,255,255,0.05)'       : '#f8fafc',
    chipBorder:         isDark ? 'rgba(255,255,255,0.07)'       : '#e2e8f0',
    chipAvatarBg:       isDark ? 'rgba(59,130,246,0.3)'         : '#eff6ff',
    chipAvatarBorder:   isDark ? 'rgba(59,130,246,0.35)'        : '#bfdbfe',
    chipAvatarText:     isDark ? '#93c5fd'                      : '#1d4ed8',
    chipName:           isDark ? '#cbd5e1'                      : '#1e293b',
    chipOrg:            isDark ? '#475569'                      : '#94a3b8',
  }

  const getActiveSection = () => {
    for (const item of MENU)
      if (item.subItems?.some((s) => location.pathname.startsWith(s.route))) return item.label
    return null
  }

  const [openMenu, setOpenMenu] = useState(getActiveSection)

  useEffect(() => {
    const active = getActiveSection()
    if (active) setOpenMenu(active)
  }, [location.pathname])

  const isSubActive  = (route) => location.pathname.startsWith(route)
  const isMenuActive = (item) =>
    item.route
      ? location.pathname === item.route
      : item.subItems?.some((s) => location.pathname.startsWith(s.route))

  const iconStyle   = { fontSize: '15px', flexShrink: 0, transition: 'color 0.15s' }
  const subBtnStyle = { background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '400' }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        .nx-sb            { font-family: 'DM Sans', sans-serif; transition: background 0.25s ease, border-color 0.25s ease; }
        .nx-sb-logo       { font-family: 'Sora', sans-serif; }
        .nx-nav-item      { color: ${D.navItemColor}; transition: all 0.15s; }
        .nx-nav-item:hover { background: ${D.navItemHoverBg} !important; color: ${D.navItemHoverColor} !important; }
        .nx-nav-item.active { background: ${D.navItemActiveBg} !important; color: ${D.navItemActiveColor} !important; }
        .nx-nav-item.active .nx-ni { color: ${D.navIconActive} !important; }
        .nx-sub           { color: ${D.subItemColor}; transition: all 0.15s; position: relative; }
        .nx-sub:hover     { color: ${D.subItemHoverColor} !important; background: ${D.subItemHoverBg}; }
        .nx-sub.active    { color: ${D.subItemActive} !important; }
        .nx-sub.active::before {
          content: ''; position: absolute; left: 0; top: 50%;
          transform: translateY(-50%); width: 2px; height: 60%;
          background: ${D.subItemActiveLine}; border-radius: 0 2px 2px 0;
        }
          html, body, * { scrollbar-width: thin; scrollbar-color: ${isDark ? "rgba(255,255,255,0.12) transparent" : "rgba(0,0,0,0.14) transparent"}; }
    html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { width: 5px; height: 5px; }
    html::-webkit-scrollbar-track, body::-webkit-scrollbar-track, *::-webkit-scrollbar-track { background: transparent; }
    html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb { background: ${isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.13)"}; border-radius: 999px; transition: background 0.2s; }
    html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover, *::-webkit-scrollbar-thumb:hover { background: ${isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.24)"}; }
    html::-webkit-scrollbar-corner, body::-webkit-scrollbar-corner, *::-webkit-scrollbar-corner { background: transparent; }
      `}</style>

      <div className="nx-sb" style={{
        background:  D.bg,
        borderRight: `1px solid ${D.border}`,
        display:     'flex',
        flexDirection: 'column',
        position:    'fixed',
        zIndex:      20,
        height:      '100vh',
        flexShrink:  0,
        width:       isCollapsed ? '60px' : '220px',
        transition:  'background 0.25s ease, border-color 0.25s ease, width 0.3s ease',
      }}>

        {/* Logo */}
        <div style={{
          display:    'flex',
          alignItems: 'center',
          height:     '56px',
          padding:    isCollapsed ? '0' : '0 16px',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          gap:        isCollapsed ? 0 : '10px',
          borderBottom: `1px solid ${D.border}`,
          flexShrink: 0,
        }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
            </svg>
          </div>
          {!isCollapsed && (
            <span className="nx-sb-logo" style={{ color: D.logoText, fontWeight: '800', fontSize: '15px', letterSpacing: '0.04em' }}>NEXUS</span>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {MENU.map((item) => {
            const Icon   = item.icon
            const isOpen = openMenu === item.label
            const active = isMenuActive(item)
            const hasSub = !!item.subItems

            return (
              <div key={item.label}>
                <button
                  title={isCollapsed ? item.label : ''}
                  onClick={() => {
                    if (hasSub) { if (!isCollapsed) setOpenMenu(isOpen ? null : item.label) }
                    else navigate(item.route)
                  }}
                  className={`nx-nav-item ${active ? 'active' : ''}`}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    padding: '8px 10px', borderRadius: '8px',
                    background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? 0 : '10px' }}>
                    <Icon className="nx-ni" style={iconStyle} />
                    {!isCollapsed && <span style={{ fontSize: '13px', fontWeight: '500' }}>{item.label}</span>}
                  </div>
                  {!isCollapsed && hasSub && (
                    <IoChevronDown style={{ fontSize: '11px', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', color: D.subItemColor }} />
                  )}
                </button>

                {!isCollapsed && hasSub && (
                  <div style={{ overflow: 'hidden', maxHeight: isOpen ? '400px' : 0, transition: 'max-height 0.25s ease' }}>
                    <div style={{ paddingLeft: '16px', paddingRight: '4px', paddingTop: '2px', paddingBottom: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      {item.subItems.map((sub) => (
                        <button key={sub.name} onClick={() => navigate(sub.route)}
                          className={`nx-sub ${isSubActive(sub.route) ? 'active' : ''}`}
                          style={subBtnStyle}>
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* User chip */}
        {!isCollapsed && user && (
          <div style={{ padding: '10px 12px 12px', flexShrink: 0 }}>
            <div style={{ background: D.chipBg, border: `1px solid ${D.chipBorder}`, borderRadius: '12px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: D.chipAvatarBg, border: `1px solid ${D.chipAvatarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: D.chipAvatarText, fontSize: '11px', fontWeight: '700', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {(user.userId || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: D.chipName, fontSize: '12px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.userId}</p>
                <p style={{ color: D.chipOrg,  fontSize: '11px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.companyName || 'Organization'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default Sidebar