import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IoHome, IoChevronDown } from 'react-icons/io5'
import { FaBoxOpen, FaCartArrowDown } from 'react-icons/fa'
import { MdInventory2 } from 'react-icons/md'
import { HiShoppingCart } from 'react-icons/hi'
import { TbReportAnalytics } from 'react-icons/tb'
import useAuthStore from '../../store/useAuthStore'

const MENU = [
  {
    icon: IoHome,
    label: 'Home',
    route: '/Home',
  },
  {
    icon: FaBoxOpen,
    label: 'Items',
    subItems: [
      { name: 'Items', route: '/Items/Items' },
      { name: 'Item Groups', route: '/Items/item-groups' },
      { name: 'Price Lists', route: '/Items/price-lists' },
    ],
  },
  {
    icon: MdInventory2,
    label: 'Inventory',
    subItems: [
      { name: 'Stock Summary', route: '/Inventory/stock-summary' },
      { name: 'Warehouses', route: '/Inventory/warehouses' },
      { name: 'Adjustments', route: '/Inventory/adjustments' },
    ],
  },
  {
    icon: HiShoppingCart,
    label: 'Sales',
    subItems: [
      { name: 'Customers', route: '/Sales/Customers' },
      { name: 'Sales Orders', route: '/Sales/Salesorders' },
      { name: 'Invoices', route: '/Sales/Invoices' },
      { name: 'Delivery Notes', route: '/Sales/Deliverynote' },
      { name: 'Outbound', route: '/Sales/Outbound' },
      { name: 'Payments Received', route: '/Sales/PaymentsReceived' },
      { name: 'Credit Notes', route: '/Sales/CreditNotes' },
    ],
  },
  {
    icon: FaCartArrowDown,
    label: 'Purchases',
    subItems: [
      { name: 'Vendors', route: '/Purchase/Vendors' },
      { name: 'Purchase Orders', route: '/Purchase/Purchaseorders' },
      { name: 'Bills', route: '/Purchase/Bills' },
      { name: 'Payments Made', route: '/Purchase/PaymentsMade' },
      { name: 'Vendor Credits', route: '/Purchase/VendorCredits' },
    ],
  },
  {
    icon: TbReportAnalytics,
    label: 'Reports',
    subItems: [
      { name: 'Sales Report', route: '/Reports/sales' },
      { name: 'Purchase Report', route: '/Reports/purchases' },
      { name: 'Inventory Report', route: '/Reports/inventory' },
    ],
  },
]

const Sidebar = ({ isCollapsed }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)

  const getActiveSection = () => {
    for (const item of MENU) {
      if (item.subItems?.some((s) => location.pathname.startsWith(s.route))) return item.label
    }
    return null
  }

  const [openMenu, setOpenMenu] = useState(getActiveSection)

  useEffect(() => {
    const active = getActiveSection()
    if (active) setOpenMenu(active)
  }, [location.pathname])

  const isSubActive = (route) => location.pathname.startsWith(route)
  const isMenuActive = (item) =>
    item.route ? location.pathname === item.route
    : item.subItems?.some((s) => location.pathname.startsWith(s.route))

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
        .sidebar-root { font-family: 'DM Sans', sans-serif; }
        .sidebar-logo { font-family: 'Syne', sans-serif; }
        .sidebar-bg {
          background: #080d1a;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .nav-item {
          transition: all 0.15s ease;
          color: rgba(148,163,184,0.8);
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
        .nav-item.active { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .nav-item.active .nav-icon { color: #3b82f6; }
        .sub-item {
          transition: all 0.15s ease;
          color: rgba(100,116,139,0.9);
          position: relative;
        }
        .sub-item:hover { color: #94a3b8; background: rgba(255,255,255,0.03); }
        .sub-item.active { color: #60a5fa; }
        .sub-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 60%;
          background: #3b82f6;
          border-radius: 0 2px 2px 0;
        }
        .sidebar-divider { border-color: rgba(255,255,255,0.05); }
        .collapse-btn {
          transition: all 0.15s;
          color: rgba(100,116,139,0.7);
        }
        .collapse-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.05); }
        .user-chip {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
        }
        .section-label {
          color: rgba(71,85,105,0.8);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
      `}</style>

      <div className={`sidebar-root sidebar-bg flex flex-col fixed md:relative z-20 transition-all duration-300 ease-in-out h-screen flex-shrink-0 ${isCollapsed ? 'w-[60px]' : 'w-[220px]'}`}>

        {/* Logo */}
        <div className={`flex items-center h-14 px-4 border-b sidebar-divider flex-shrink-0 ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
            </svg>
          </div>
          {!isCollapsed && (
            <span className="sidebar-logo text-white font-bold text-base tracking-wide">NEXUS</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {MENU.map((item) => {
            const Icon = item.icon
            const isOpen = openMenu === item.label
            const active = isMenuActive(item)
            const hasSub = !!item.subItems

            return (
              <div key={item.label}>
                <button
                  title={isCollapsed ? item.label : ''}
                  onClick={() => {
                    if (hasSub) {
                      if (!isCollapsed) setOpenMenu(isOpen ? null : item.label)
                    } else {
                      navigate(item.route)
                    }
                  }}
                  className={`nav-item w-full flex items-center rounded-lg px-2.5 py-2 text-sm ${isCollapsed ? 'justify-center' : 'justify-between'} ${active ? 'active' : ''}`}
                >
                  <div className={`flex items-center ${isCollapsed ? '' : 'gap-2.5'}`}>
                    <Icon className="nav-icon flex-shrink-0 text-base" />
                    {!isCollapsed && <span className="font-medium">{item.label}</span>}
                  </div>
                  {!isCollapsed && hasSub && (
                    <IoChevronDown
                      className={`text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  )}
                </button>

                {/* Subitems */}
                {!isCollapsed && hasSub && (
                  <div className={`overflow-hidden transition-all duration-250 ease-in-out ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                    <div className="pl-4 pr-1 py-1 space-y-0.5">
                      {item.subItems.map((sub) => (
                        <button
                          key={sub.name}
                          onClick={() => navigate(sub.route)}
                          className={`sub-item w-full text-left px-3 py-1.5 text-xs rounded-md ${isSubActive(sub.route) ? 'active' : ''}`}
                        >
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

        {/* User chip at bottom */}
        {!isCollapsed && user && (
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="user-chip rounded-xl p-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600/40 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-300 text-xs font-bold">
                  {(user.userId || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-slate-300 text-xs font-medium truncate">{user.userId}</p>
                <p className="text-slate-600 text-xs truncate">{user.companyName || 'Organization'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default Sidebar