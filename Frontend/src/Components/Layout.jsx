import { Outlet } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./Home/Sidebar";
import Navbar from "./Home/Navbar";


export default function Layout() {
  const [sidebarToggle, setSidebarToggle] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      
      <Sidebar isCollapsed={sidebarToggle} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarToggle(!sidebarToggle)} />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
