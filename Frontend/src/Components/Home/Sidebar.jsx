import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { guardNav } from '../../helper/useUnsavedGuard'
import { IoHome, IoChevronDown, IoSettingsOutline } from 'react-icons/io5'
import { FaBoxOpen, FaCartArrowDown, FaClipboardCheck, FaCloudUploadAlt, FaUsers, FaProjectDiagram } from 'react-icons/fa'
import { MdInventory2 } from 'react-icons/md'
import { HiShoppingCart } from 'react-icons/hi'
import { TbReportAnalytics } from 'react-icons/tb'
import { MdAccountBalance } from 'react-icons/md'
import useAuthStore from '../../store/useAuthStore'
import useThemeStore from '../../store/useThemeStore'
import { usePermissions } from '../../helper/permissions'

const MENU = [
  { icon: IoHome,            label: 'Home',      route: '/Home', tourKey: 'nav-home' },
  { icon: FaBoxOpen,         label: 'Items',      mods: ['items','item_groups','price_lists'], tourKey: 'nav-items', subItems: [
    { name: 'Items',         route: '/Items/Items',        mod: 'items' },
    { name: 'Item Groups',   route: '/Items/item-groups',  mod: 'item_groups' },
    { name: 'Price Lists',   route: '/Items/price-lists',  mod: 'price_lists' },
  ]},
  { icon: MdInventory2,      label: 'Inventory',  mods: ['items','warehouses','adjustments'], tourKey: 'nav-inventory', subItems: [
    { name: 'Stock Summary',  route: '/Inventory/stock-summary',  mod: 'items' },
    { name: 'Reorder Alerts', route: '/Inventory/reorder-alerts', mod: 'items' },
    { name: 'Batch & Expiry', route: '/Inventory/batch-expiry',   mod: 'items' },
    { name: 'Warehouses',     route: '/Inventory/warehouses',     mod: 'warehouses' },
    { name: 'Adjustments',    route: '/Inventory/adjustments',    mod: 'adjustments' },
  ]},
  { icon: HiShoppingCart,    label: 'Sales',      mods: ['customers','enquiries','quotes','sales_orders','delivery_notes','invoices','credit_notes','payments','advance_payments'], tourKey: 'nav-sales', subItems: [
    { name: 'Customers',          route: '/Sales/Customers',        mod: 'customers' },
    { name: 'Enquiries',          route: '/Sales/Enquiries',        mod: 'enquiries' },
    { name: 'Quotes',             route: '/Sales/Quotes',           mod: 'quotes' },
    { name: 'Sales Orders',       route: '/Sales/Salesorders',      mod: 'sales_orders' },
    { name: 'Outbound',           route: '/Sales/Outbound',         mod: 'delivery_notes' },
    { name: 'Delivery Notes',     route: '/Sales/Deliverynote',     mod: 'delivery_notes' },
    { name: 'Invoices',           route: '/Sales/Invoices',         mod: 'invoices' },
    { name: 'Recurring Invoices', route: '/Sales/RecurringInvoices', mod: 'invoices' },
    { name: 'Credit Notes',       route: '/Sales/CreditNotes',      mod: 'credit_notes' },
    { name: 'Payments Received',  route: '/Sales/PaymentsReceived', mod: 'payments' },
    { name: 'Customer Advances',  route: '/Sales/AdvancePayments',  mod: 'advance_payments' },
    { name: 'Letters',            route: '/Letters',                mod: 'letters' },
  ]},
  { icon: FaCartArrowDown,   label: 'Purchases',  mods: ['vendors','purchase_orders','grns','bills','vendor_credits','vendor_payments'], tourKey: 'nav-purchases', subItems: [
    { name: 'Vendors',          route: '/Purchase/Vendors',       mod: 'vendors' },
    { name: 'Purchase Orders',  route: '/Purchase/Purchaseorders',mod: 'purchase_orders' },
    { name: 'Inbound',          route: '/Purchase/Inbound',       mod: 'grns' },
    { name: 'GRN',              route: '/Purchase/GRN',           mod: 'grns' },
    { name: 'Bills',            route: '/Purchase/Bills',         mod: 'bills' },
    { name: 'Expenses',         route: '/Purchase/Expenses',      mod: 'bills' },
    { name: 'Vendor Credits',   route: '/Purchase/VendorCredits', mod: 'vendor_credits' },
    { name: 'Payments Made',    route: '/Purchase/PaymentsMade',  mod: 'vendor_payments' },
  ]},
  { icon: TbReportAnalytics, label: 'Reports',    mods: ['reports'], tourKey: 'nav-reports', subItems: [
    { name: 'Sales Report',          route: '/Reports/sales',                mod: 'reports' },
    { name: 'Sales by Emirate',      route: '/Reports/sales-by-emirate',     mod: 'reports' },
    { name: 'Purchase Report',       route: '/Reports/purchases',            mod: 'reports' },
    { name: 'Inventory Report',      route: '/Reports/inventory',            mod: 'reports' },
    { name: 'AR Aging',              route: '/Reports/aging',                mod: 'reports' },
    { name: 'Customer Statement',    route: '/Reports/customer-statement',   mod: 'reports' },
    { name: 'VAT Report',            route: '/Reports/vat',                  mod: 'reports' },
    { name: 'Vendor Aging',          route: '/Reports/vendor-aging',         mod: 'reports' },
    { name: 'Export Transactions',   route: '/Reports/export-transactions',  mod: 'reports' },
  ]},
  { icon: MdAccountBalance,   label: 'Finance',   mods: ['accounts','journal_entries','reports'], tourKey: 'nav-finance', subItems: [
    { name: 'Chart of Accounts', route: '/Finance/Accounts',       mod: 'accounts' },
    { name: 'Journal Entries',   route: '/Finance/JournalEntries', mod: 'journal_entries' },
    { name: 'Bank Reconciliation', route: '/Finance/BankReconciliation', mod: 'accounts' },
    { name: 'Exchange Rates',    route: '/Finance/ExchangeRates',   mod: 'accounts' },
    { name: 'Trial Balance',     route: '/Reports/trial-balance',  mod: 'accounts' },
    { name: 'Profit & Loss',     route: '/Reports/profit-loss',  mod: 'reports' },
    { name: 'Balance Sheet',     route: '/Reports/balance-sheet',mod: 'reports' },
    { name: 'Cash Flow',         route: '/Reports/cash-flow',    mod: 'reports' },
  ]},
  { icon: FaUsers,            label: 'HR',        mods: ['employees','payroll','timeoff','letters'], tourKey: 'nav-hr', subItems: [
    { name: 'Employees',   route: '/HR/Employees',  mod: 'employees' },
    { name: 'Org Chart',   route: '/HR/OrgChart',   mod: 'employees' },
    { name: 'Letters',     route: '/HR/Letters',    mod: 'employees' },
    { name: 'Payroll',     route: '/HR/Payroll',    mod: 'payroll' },
    { name: 'Time Off',    route: '/HR/TimeOff',    mod: 'timeoff' },
  ]},
  { icon: FaProjectDiagram,   label: 'Projects',  route: '/Projects',  tourKey: 'nav-projects' },
  { icon: FaClipboardCheck,   label: 'Approvals', route: '/Approvals', tourKey: 'nav-approvals' },
  { icon: FaCloudUploadAlt,   label: 'Backups',   route: '/Backups',   ownerOnly: true, tourKey: 'nav-backups' },
  { icon: IoSettingsOutline,  label: 'Settings',  settings: true,   tourKey: 'nav-settings' },
]

const Sidebar = ({ isCollapsed, isMobile = false, mobileOpen = false, onClose = () => {} }) => {
  // On mobile the rail never collapses to icons — it slides in full-width.
  if (isMobile) isCollapsed = false
  const navigate    = useNavigate()
  const location    = useLocation()
  const user        = useAuthStore((s) => s.user)
  const isDark      = useThemeStore((s) => s.isDark)
  const activeOrg   = useAuthStore((s) => s.activeOrg)
  const orgId       = activeOrg?._id || user?.orgId || ''
  const { canAny, canAnyOf, canSettings, role } = usePermissions()
  // Show a section only when it leads somewhere: for sections with sub-items, at least
  // one sub-item must be permitted (so granting a module with no page — e.g.
  // journal_entries — never shows an empty section). Sections without sub-items use
  // their mods list; Settings only for owner / roles granted Settings access; Backups
  // (whole-database, cross-org) only for owner/admin, mirroring the backend gate.
  const visibleMenu = MENU.filter(item =>
    item.settings ? canSettings()
    : item.ownerOnly ? (role === 'owner' || role === 'admin')
    : item.subItems ? item.subItems.some(s => !s.mod || canAny(s.mod))
    : (!item.mods || canAnyOf(item.mods))
  )

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

  // Exact match, or a real sub-path (route + '/...') — plain startsWith would let
  // '/Reports/sales-by-emirate' match route '/Reports/sales' since one string is
  // literally a prefix of the other with no separator between them.
  const pathMatches = (route) => location.pathname === route || location.pathname.startsWith(route + '/')

  const getActiveSection = () => {
    for (const item of MENU)
      if (item.subItems?.some((s) => pathMatches(s.route))) return item.label
    return null
  }

  const [openMenu, setOpenMenu] = useState(getActiveSection)

  useEffect(() => {
    const active = getActiveSection()
    if (active) setOpenMenu(active)
  }, [location.pathname])

  const isSubActive  = (route) => pathMatches(route)
  const isMenuActive = (item) =>
    item.settings
      ? location.pathname.includes('/settings')
      : item.route
      ? location.pathname === item.route
      : item.subItems?.some((s) => pathMatches(s.route))

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

      <div className="nx-sb" data-tour="sidebar" style={{
        background:  D.bg,
        borderRight: `1px solid ${D.border}`,
        display:     'flex',
        flexDirection: 'column',
        position:    'fixed',
        zIndex:      300,
        height:      '100vh',
        flexShrink:  0,
        width:       isMobile ? '240px' : (isCollapsed ? '60px' : '220px'),
        // Mobile: slide off-canvas; show only when mobileOpen.
        transform:   isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        boxShadow:   isMobile && mobileOpen ? '4px 0 24px rgba(0,0,0,0.3)' : 'none',
        transition:  'background 0.25s ease, border-color 0.25s ease, width 0.3s ease, transform 0.3s ease',
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
          {/* Spifora icon */}
          <img src="/spifora-icon.png" alt="Spifora" style={{ height: 30, width: 30, objectFit: 'contain', flexShrink: 0 }} />
          {!isCollapsed && (
            <span className="nx-sb-logo" style={{ color: D.logoText, fontWeight: '800', fontSize: '15px', letterSpacing: '0.08em' }}>SPIFORA</span>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {visibleMenu.map((item) => {
            const Icon   = item.icon
            const isOpen = openMenu === item.label
            const active = isMenuActive(item)
            const hasSub = !!item.subItems

            return (
              <div key={item.label}>
                <button
                  title={isCollapsed ? item.label : ''}
                  data-tour={item.tourKey}
                  onClick={() => {
                    if (item.settings) { guardNav(() => { navigate(orgId ? `/organizations/${orgId}/settings` : '/Home'); if (isMobile) onClose() }) }
                    else if (hasSub) {
                      // Expanded rail: toggle the section. Collapsed rail (no room to
                      // expand): jump straight to the first sub-item the role can open,
                      // so a collapsed parent is never a dead click.
                      if (!isCollapsed) setOpenMenu(isOpen ? null : item.label)
                      else {
                        const first = item.subItems.find((sub) => !sub.mod || canAny(sub.mod))
                        if (first) guardNav(() => navigate(first.route))
                      }
                    }
                    else guardNav(() => { navigate(item.route); if (isMobile) onClose() })
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
                      {item.subItems.filter((sub) => !sub.mod || canAny(sub.mod)).map((sub) => (
                        <button key={sub.name} onClick={() => guardNav(() => { navigate(sub.route); if (isMobile) onClose() })}
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