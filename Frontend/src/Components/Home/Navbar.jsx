import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { IoSearchOutline, IoNotificationsOutline, IoChevronDown } from 'react-icons/io5'
import useAuthStore from '../../store/useAuthStore'

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
  const match = Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k))
  const parent = Object.keys(BREADCRUMB_PARENTS).find((k) => pathname.startsWith(k))
  return {
    title: match ? PAGE_TITLES[match] : 'Dashboard',
    parent: parent ? BREADCRUMB_PARENTS[parent] : null,
  }
}

const Navbar = ({ onToggleSidebar }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const { title, parent } = getPageInfo(location.pathname)
  const initials = (user?.userId || 'U').charAt(0).toUpperCase()

  const handleSignOut = () => {
    clearAuth()
    navigate('/')
  }

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:wght@400;500&display=swap');
        .navbar-root {
          font-family: 'DM Sans', sans-serif;
          background: #0c1220;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .navbar-title { font-family: 'Syne', sans-serif; }
        .nav-icon-btn {
          color: rgba(100,116,139,0.9);
          transition: all 0.15s;
          border: 1px solid transparent;
        }
        .nav-icon-btn:hover {
          color: #94a3b8;
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.07);
        }
        .notif-dot {
          width: 6px; height: 6px;
          background: #ef4444;
          border-radius: 50%;
          position: absolute;
          top: 6px; right: 6px;
          border: 1.5px solid #0c1220;
        }
        .user-dropdown {
          background: #0f172a;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }
        .dropdown-item {
          color: #94a3b8;
          transition: all 0.15s;
        }
        .dropdown-item:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
        .dropdown-item.danger { color: #f87171; }
        .dropdown-item.danger:hover { background: rgba(239,68,68,0.08); }
        .notif-panel {
          background: #0f172a;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }
        .avatar-btn {
          background: rgba(59,130,246,0.2);
          border: 1.5px solid rgba(59,130,246,0.3);
          transition: all 0.15s;
        }
        .avatar-btn:hover { border-color: rgba(59,130,246,0.6); }
        .breadcrumb-sep { color: rgba(71,85,105,0.6); }
      `}</style>

      <nav className="navbar-root h-14 flex items-center justify-between px-4 flex-shrink-0">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="nav-icon-btn w-8 h-8 rounded-lg flex items-center justify-center"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5">
            {parent && (
              <>
                <span className="text-slate-500 text-sm">{parent}</span>
                <span className="breadcrumb-sep text-sm">/</span>
              </>
            )}
            <span className="navbar-title text-white text-sm font-semibold">{title}</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="nav-icon-btn w-8 h-8 rounded-lg flex items-center justify-center relative"
            >
              <IoNotificationsOutline size={17} />
              <span className="notif-dot" />
            </button>

            {notifOpen && (
              <div className="notif-panel absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-white text-sm font-semibold">Notifications</span>
                  <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">3 new</span>
                </div>
                {[
                  { text: 'New sales order received', time: '2m ago', dot: 'bg-blue-500' },
                  { text: 'Stock level low: Item A', time: '1h ago', dot: 'bg-yellow-500' },
                  { text: 'Invoice #1042 overdue', time: '3h ago', dot: 'bg-red-500' },
                ].map((n, i) => (
                  <div key={i} className="dropdown-item px-4 py-3 flex items-start gap-3 cursor-pointer">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.dot}`} />
                    <div>
                      <p className="text-slate-300 text-xs">{n.text}</p>
                      <p className="text-slate-600 text-xs mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5 border-t border-white/5">
                  <button className="text-blue-400 text-xs hover:text-blue-300 transition-colors">
                    View all notifications →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* User menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg nav-icon-btn"
            >
              <div className="avatar-btn w-7 h-7 rounded-lg flex items-center justify-center">
                <span className="text-blue-300 text-xs font-bold">{initials}</span>
              </div>
              {user && (
                <div className="hidden sm:block text-left">
                  <p className="text-slate-300 text-xs font-medium leading-tight">{user.userId}</p>
                  <p className="text-slate-600 text-xs leading-tight truncate max-w-[100px]">
                    {user.companyName || 'Organization'}
                  </p>
                </div>
              )}
              <IoChevronDown size={12} className="text-slate-600" />
            </button>

            {dropdownOpen && (
              <div className="user-dropdown absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-white text-sm font-semibold">{user?.userId || 'User'}</p>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">{user?.companyName || 'Organization'}</p>
                </div>
                <div className="py-1">
                  <button className="dropdown-item w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </button>
                  <button className="dropdown-item w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>
                </div>
                <div className="border-t border-white/5 py-1">
                  <button
                    onClick={handleSignOut}
                    className="dropdown-item danger w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5"
                  >
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