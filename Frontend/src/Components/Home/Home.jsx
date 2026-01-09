import { useState, useEffect } from "react";
import { 
  FaBox, FaShoppingCart, FaTruck, FaFileInvoice, 
  FaChartLine, FaUser, FaWarehouse, FaBell,
  FaCalendar, FaDollarSign, FaExclamationTriangle,
  FaArrowUp, FaArrowDown, FaEye, FaPlus
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalItems: 156,
    pendingOrders: 12,
    outboundPending: 5,
    lowStock: 8,
    totalRevenue: "245,600.50",
    thisMonthRevenue: "45,200.75",
    activeCustomers: 48,
    pendingInvoices: 7
  });

  const [recentActivities, setRecentActivities] = useState([
    { id: 1, type: 'sale', description: 'New sale order #SO-2023-156 created', user: 'John Doe', time: '10 mins ago', icon: 'cart' },
    { id: 2, type: 'outbound', description: 'Outbound #OB-2023-045 approved', user: 'Sarah Smith', time: '25 mins ago', icon: 'truck' },
    { id: 3, type: 'item', description: 'Low stock alert: Storage Cabinet', user: 'System', time: '1 hour ago', icon: 'box' },
    { id: 4, type: 'invoice', description: 'Invoice #INV-2023-089 sent', user: 'Mike Johnson', time: '2 hours ago', icon: 'invoice' },
    { id: 5, type: 'customer', description: 'New customer registered: TechCorp', user: 'System', time: '3 hours ago', icon: 'user' }
  ]);

  const [lowStockItems, setLowStockItems] = useState([
    { id: 1, name: "Storage Cabinet", code: "ITM001", currentStock: 5, minStock: 10, status: "critical" },
    { id: 2, name: "Office Chair", code: "ITM003", currentStock: 8, minStock: 15, status: "warning" },
    { id: 3, name: "LED Bulb 15W", code: "ITM004", currentStock: 15, minStock: 20, status: "warning" },
    { id: 4, name: "Area Rug", code: "ITM002", currentStock: 3, minStock: 10, status: "critical" }
  ]);

  const [pendingApprovals, setPendingApprovals] = useState([
    { id: 1, type: 'outbound_cancel', item: "Office Chair", requestBy: "John Doe", time: "2 hours ago" },
    { id: 2, type: 'outbound_cancel', item: "Storage Cabinet", requestBy: "Sarah Smith", time: "4 hours ago" },
    { id: 3, type: 'new_item', item: "New Product Addition", requestBy: "Mike Johnson", time: "1 day ago" }
  ]);

  const [recentOrders, setRecentOrders] = useState([
    { id: "SO-2023-156", customer: "ABC Corporation", amount: "45,000.00", status: "open", date: "Today" },
    { id: "SO-2023-155", customer: "XYZ Ltd", amount: "28,500.00", status: "completed", date: "Yesterday" },
    { id: "SO-2023-154", customer: "Global Industries", amount: "62,000.00", status: "completed", date: "2 days ago" },
    { id: "SO-2023-153", customer: "Tech Solutions", amount: "15,750.00", status: "open", date: "3 days ago" }
  ]);

  const [quickActions] = useState([
    { title: "New Sale Order", icon: "cart", color: "bg-blue-500", path: "/sale-order/new" },
    { title: "Create Outbound", icon: "truck", color: "bg-green-500", path: "/outbound" },
    { title: "Add New Item", icon: "box", color: "bg-purple-500", path: "/Items/Items/New" },
    { title: "Create Invoice", icon: "invoice", color: "bg-orange-500", path: "/invoices/new" }
  ]);

  const getIcon = (iconName) => {
    const icons = {
      cart: <FaShoppingCart className="text-blue-500" />,
      truck: <FaTruck className="text-green-500" />,
      box: <FaBox className="text-purple-500" />,
      invoice: <FaFileInvoice className="text-orange-500" />,
      user: <FaUser className="text-teal-500" />
    };
    return icons[iconName] || <FaBox />;
  };

  const handleQuickAction = (path) => {
    navigate(path);
  };

  const handleViewDetails = (type, id) => {
    switch(type) {
      case 'item':
        navigate(`/Items/Items/${id}`);
        break;
      case 'sale':
        navigate(`/sale-orders/${id}`);
        break;
      case 'outbound':
        navigate(`/outbound/${id}`);
        break;
      default:
        break;
    }
  };

  const handleApprove = (approvalId) => {
    // Handle approval logic
    setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
  };

  const handleReject = (approvalId) => {
    // Handle rejection logic
    setPendingApprovals(prev => prev.filter(a => a.id !== approvalId));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button className="p-2 bg-white border rounded-full hover:bg-gray-50">
              <FaBell className="text-gray-600" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              JD
            </div>
            <div>
              <p className="font-medium text-gray-800">John Doe</p>
              <p className="text-sm text-gray-500">Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">Total Items</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-2">{stats.totalItems}</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <FaBox className="text-blue-500 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            <button 
              onClick={() => navigate("/Items")}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
            >
              View All <FaEye className="ml-2" size={14} />
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">Pending Orders</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-2">{stats.pendingOrders}</h3>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <FaShoppingCart className="text-orange-500 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center text-green-600 text-sm">
              <FaArrowUp className="mr-1" /> 12% from last month
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">Outbound Pending</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-2">{stats.outboundPending}</h3>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <FaTruck className="text-green-500 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            <button 
              onClick={() => navigate("/outbound")}
              className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center"
            >
              Manage Outbound <FaEye className="ml-2" size={14} />
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">Low Stock Items</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-2">{stats.lowStock}</h3>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <FaExclamationTriangle className="text-red-500 text-xl" />
            </div>
          </div>
          <div className="mt-4">
            <button 
              onClick={() => navigate("/Items?filter=low-stock")}
              className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
            >
              View Details <FaEye className="ml-2" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleQuickAction(action.path)}
              className={`${action.color} text-white p-4 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-between`}
            >
              <div className="flex items-center space-x-3">
                <div className="text-xl">
                  {action.icon === 'cart' && <FaShoppingCart />}
                  {action.icon === 'truck' && <FaTruck />}
                  {action.icon === 'box' && <FaBox />}
                  {action.icon === 'invoice' && <FaFileInvoice />}
                </div>
                <span className="font-medium">{action.title}</span>
              </div>
              <FaPlus />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Activities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Recent Activities</h2>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4 p-3 hover:bg-gray-50 rounded-lg">
                <div className="p-2 bg-gray-50 rounded-lg">
                  {getIcon(activity.icon)}
                </div>
                <div className="flex-1">
                  <p className="text-gray-800">{activity.description}</p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-gray-500">{activity.user}</span>
                    <span className="text-sm text-gray-400">•</span>
                    <span className="text-sm text-gray-500">{activity.time}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleViewDetails(activity.type, activity.id)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Pending Approvals</h2>
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {pendingApprovals.length} pending
            </span>
          </div>
          <div className="space-y-4">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-gray-800">{approval.item}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {approval.type === 'outbound_cancel' ? 'Outbound Cancellation Request' : 'New Item Request'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">{approval.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Requested by <span className="font-medium">{approval.requestBy}</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApprove(approval.id)}
                      className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-md hover:bg-green-200"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(approval.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {pendingApprovals.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FaBell className="text-3xl mx-auto mb-3 text-gray-300" />
                <p>No pending approvals</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Low Stock Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Low Stock Items</h2>
            <button 
              onClick={() => navigate("/Items?filter=low-stock")}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-3">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    item.status === 'critical' ? 'bg-red-50' : 'bg-yellow-50'
                  }`}>
                    <FaBox className={`${item.status === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">{item.name}</h4>
                    <p className="text-sm text-gray-500">{item.code}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${
                    item.status === 'critical' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {item.currentStock} / {item.minStock}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.status === 'critical' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.status === 'critical' ? 'Critical' : 'Warning'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Recent Orders</h2>
            <button 
              onClick={() => navigate("/sale-orders")}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <div key={order.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-800">{order.id}</h4>
                    <p className="text-sm text-gray-500">{order.customer}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-gray-800">AED {order.amount}</span>
                    <span className="text-xs text-gray-500">{order.date}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    order.status === 'open' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {order.status === 'open' ? 'Open' : 'Completed'}
                  </span>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => navigate(`/sale-orders/${order.id}`)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View
                    </button>
                    {order.status === 'open' && (
                      <button 
                        onClick={() => navigate(`/outbound?so=${order.id}`)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Outbound
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Revenue Summary</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">This Month</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span className="text-sm text-gray-600">Last Month</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FaDollarSign className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <h3 className="text-2xl font-bold text-gray-800">AED {stats.totalRevenue}</h3>
              </div>
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaChartLine className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <h3 className="text-2xl font-bold text-gray-800">AED {stats.thisMonthRevenue}</h3>
              </div>
            </div>
            <div className="mt-2 text-green-600 text-sm flex items-center">
              <FaArrowUp className="mr-1" /> 18% increase
            </div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaUser className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Customers</p>
                <h3 className="text-2xl font-bold text-gray-800">{stats.activeCustomers}</h3>
              </div>
            </div>
            <div className="mt-2 text-gray-600 text-sm">
              <span className="text-green-600">+5</span> this month
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}