import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Home/Sidebar'
import Navbar from './Home/Navbar'

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <>
      <style>{`
        .layout-root {
          background: #0a0f1e;
          min-height: 100vh;
        }
        .layout-main {
          background: #0d1526;
          overflow-y: auto;
        }
        /* Custom scrollbar */
        .layout-main::-webkit-scrollbar { width: 5px; }
        .layout-main::-webkit-scrollbar-track { background: transparent; }
        .layout-main::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
        }
        .layout-main::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>

      <div className="layout-root flex h-screen overflow-hidden">
        <Sidebar isCollapsed={sidebarCollapsed} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
          <main className="layout-main flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  )
}