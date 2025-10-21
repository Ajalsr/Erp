import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Home = () => {
  const [sidebarToggle, setSidebarToggle] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isCollapsed={sidebarToggle} />
      <div className="flex-1 flex flex-col min-w-0"> {/* Remove transition classes from here */}
        <Navbar onToggleSidebar={() => setSidebarToggle(!sidebarToggle)} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-500">
                    <i className="fas fa-users text-xl"></i>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Total Users</h3>
                    <p className="text-2xl font-bold">1,248</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-green-500">
                    <i className="fas fa-arrow-up mr-1"></i>
                    12% increase from last month
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Home;