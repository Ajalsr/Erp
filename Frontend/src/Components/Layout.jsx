import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Home/Sidebar'
import Navbar  from './Home/Navbar'
import useThemeStore from '../store/useThemeStore'

export default function Layout() {
  const [sidebarToggle, setSidebarToggle] = useState(false)
  const isDark = useThemeStore((s) => s.isDark)

  const sidebarWidth = sidebarToggle ? '60px' : '220px'

  return (
    <div style={{
      display:    'flex',
      height:     '100vh',
      background: isDark ? '#080d1a' : '#f1f5f9',
      transition: 'background 0.25s ease',
    }}>
      <Sidebar isCollapsed={sidebarToggle} />

      <div style={{
        marginLeft:    sidebarWidth,
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        minWidth:      0,
        transition:    'margin-left 0.3s ease',
      }}>
        <Navbar onToggleSidebar={() => setSidebarToggle(!sidebarToggle)} />

        <main style={{
          flex:       1,
          overflowY:  'auto',
          background: isDark ? '#080d1a' : '#f1f5f9',
          transition: 'background 0.25s ease',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}