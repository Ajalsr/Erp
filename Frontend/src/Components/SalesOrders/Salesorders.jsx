import { useEffect, useState } from "react";
import { FaThList, FaThLarge, FaPlus, FaEllipsisV, FaFilter, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetItem from '../../helper/useGetItem';

const Salesorders = () => {
  const { handleGetItem, data, loading, error } = useGetItem();
  const navigate = useNavigate();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Mock sales orders data
  const [salesOrders] = useState([
    {
      id: 1,
      saleOrderNumber: "SO-2024-001",
      status: "Draft",
      statusColor: "bg-yellow-100 text-yellow-800",
      customer: "ABC Corporation",
      lpoNumber: "LPO-2024-001",
      lpoValue: "AED 15,000.00",
      invoiceValue: "AED 0.00",
      pendingValue: "AED 15,000.00",
      date: "2024-01-15",
      customerEmail: "contact@abccorp.com",
      customerPhone: "+971 50 123 4567"
    },
    {
      id: 2,
      saleOrderNumber: "SO-2024-002",
      status: "Confirmed",
      statusColor: "bg-green-100 text-green-800",
      customer: "XYZ Enterprises",
      lpoNumber: "LPO-2024-002",
      lpoValue: "AED 25,000.00",
      invoiceValue: "AED 10,000.00",
      pendingValue: "AED 15,000.00",
      date: "2024-01-16",
      customerEmail: "info@xyzenterprises.com",
      customerPhone: "+971 50 987 6543"
    },
    {
      id: 3,
      saleOrderNumber: "SO-2024-003",
      status: "In Progress",
      statusColor: "bg-blue-100 text-blue-800",
      customer: "Global Traders LLC",
      lpoNumber: "LPO-2024-003",
      lpoValue: "AED 50,000.00",
      invoiceValue: "AED 25,000.00",
      pendingValue: "AED 25,000.00",
      date: "2024-01-17",
      customerEmail: "sales@globaltraders.ae",
      customerPhone: "+971 50 555 1234"
    },
    {
      id: 4,
      saleOrderNumber: "SO-2024-004",
      status: "Completed",
      statusColor: "bg-gray-100 text-gray-800",
      customer: "Middle East Solutions",
      lpoNumber: "LPO-2024-004",
      lpoValue: "AED 30,000.00",
      invoiceValue: "AED 30,000.00",
      pendingValue: "AED 0.00",
      date: "2024-01-14",
      customerEmail: "support@mesolutions.ae",
      customerPhone: "+971 50 444 7890"
    },
    {
      id: 5,
      saleOrderNumber: "SO-2024-005",
      status: "Cancelled",
      statusColor: "bg-red-100 text-red-800",
      customer: "Tech Innovations Ltd",
      lpoNumber: "LPO-2024-005",
      lpoValue: "AED 20,000.00",
      invoiceValue: "AED 0.00",
      pendingValue: "AED 20,000.00",
      date: "2024-01-13",
      customerEmail: "hello@techinnovations.com",
      customerPhone: "+971 50 333 4567"
    }
  ]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const displayItems = salesOrders;
  
  const totalPages = Math.ceil(displayItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = displayItems.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // Handle item click to open drawer
  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
    setActiveTab('overview'); // Reset to overview tab when opening drawer
  };

  // Close drawer
  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedItem(null);
  };

  useEffect(() => {
    handleGetItem();
  }, [handleGetItem]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div className="bg-white min-h-screen p-6 text-gray-800">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <h2 className="text-2xl font-bold text-gray-900">Sales Orders</h2>
          <button className="text-gray-500 hover:text-gray-700">
            <FaFilter />
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button className="p-2 border rounded-md hover:bg-gray-100">
            <FaThList className="text-gray-600" />
          </button>
          <button className="p-2 border rounded-md hover:bg-gray-100">
            <FaThLarge className="text-gray-600" />
          </button>
          <button 
            className="bg-blue-600 text-white px-4 py-2.5 rounded-md flex items-center space-x-2 hover:bg-blue-700 cursor-pointer transition-colors" 
            onClick={() => navigate("/Sales/Salesorders/Newsalesorders")}
          >
            <FaPlus />
            <span>New Sales Order</span>
          </button>
          <button className="p-2 border rounded-md hover:bg-gray-100">
            <FaEllipsisV className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="text-sm text-blue-600 font-medium">Total Orders</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{salesOrders.length}</div>
          <div className="text-xs text-gray-500 mt-2">All time sales orders</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="text-sm text-green-600 font-medium">Total Value</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">AED 140,000</div>
          <div className="text-xs text-gray-500 mt-2">Sum of all LPO values</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
          <div className="text-sm text-yellow-600 font-medium">Pending Value</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">AED 75,000</div>
          <div className="text-xs text-gray-500 mt-2">Awaiting payment</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="text-sm text-purple-600 font-medium">Paid Value</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">AED 65,000</div>
          <div className="text-xs text-gray-500 mt-2">Received payments</div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-6 py-4 text-left w-8">
                <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
              </th>
              <th className="px-6 py-4 text-left font-medium">Sale Order #</th>
              <th className="px-6 py-4 text-left font-medium">Status</th>
              <th className="px-6 py-4 text-left font-medium">Customer</th>
              <th className="px-6 py-4 text-left font-medium">LPO Number</th>
              <th className="px-6 py-4 text-left font-medium">LPO Value</th>
              <th className="px-6 py-4 text-left font-medium">Invoice Value</th>
              <th className="px-6 py-4 text-left font-medium">Pending Value</th>
              <th className="px-6 py-4 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.map((item, index) => (
              <tr key={item.id || index} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4">
                  <span 
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    {item.saleOrderNumber}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.statusColor}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-800">{item.customer}</div>
                    <div className="text-xs text-gray-500">{item.customerEmail}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-700 font-medium">{item.lpoNumber}</td>
                <td className="px-6 py-4 text-gray-700 font-medium">{item.lpoValue}</td>
                <td className="px-6 py-4 text-gray-700 font-medium">{item.invoiceValue}</td>
                <td className="px-6 py-4">
                  <div className={`font-medium ${parseFloat(item.pendingValue.replace(/[^0-9.]/g, '')) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.pendingValue}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{item.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-between items-center mt-6 text-sm text-gray-600">
        <div>
          Showing {startIndex + 1} -{" "}
          {Math.min(startIndex + itemsPerPage, displayItems.length)} of {displayItems.length} sales orders
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          {[...Array(totalPages)].map((_, index) => (
            <button
              key={index}
              onClick={() => handlePageChange(index + 1)}
              className={`px-3 py-1.5 border rounded-md transition-colors ${
                currentPage === index + 1
                  ? "bg-blue-500 text-white border-blue-500"
                  : "hover:bg-gray-100"
              }`}
            >
              {index + 1}
            </button>
          ))}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 border rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Drawer with Tabs */}
      <div
        className={`fixed inset-0 z-50 transform transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Glass Backdrop */}
        <div 
          className="absolute inset-0 bg-black bg-opacity-20 backdrop-blur-sm"
          onClick={closeDrawer}
        ></div>
        
        {/* Drawer Panel */}
        <div className="absolute right-0 top-0 h-full w-128 bg-white shadow-xl">
          {/* Drawer Header with Gray Border */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{selectedItem?.saleOrderNumber || "Sales Order Details"}</h3>
              <p className="text-sm text-gray-500 mt-1">{selectedItem?.customer || ""}</p>
            </div>
            <button 
              onClick={closeDrawer}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <FaTimes className="text-gray-500 text-lg" />
            </button>
          </div>

          {/* Tabs Navigation with Gray Border */}
          <div className="border-b border-gray-200">
            <div className="flex space-x-1 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'transactions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Transactions
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                History
              </button>
            </div>
          </div>
          
          {/* Tab Content */}
          <div className="p-6 overflow-y-auto h-full">
            {selectedItem && (
              <div className="space-y-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Status Card */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm text-gray-500">Status</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${selectedItem.statusColor}`}>
                              {selectedItem.status}
                            </span>
                            <div className="text-gray-700">{selectedItem.date}</div>
                          </div>
                        </div>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                          Change Status
                        </button>
                      </div>
                    </div>
                    
                    {/* Customer Details */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-medium text-gray-800 mb-3">Customer Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Customer Name</div>
                          <div className="font-medium text-gray-800 mt-1">{selectedItem.customer}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Email</div>
                          <div className="font-medium text-gray-800 mt-1">{selectedItem.customerEmail}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Phone</div>
                          <div className="font-medium text-gray-800 mt-1">{selectedItem.customerPhone}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">LPO Number</div>
                          <div className="font-medium text-gray-800 mt-1">{selectedItem.lpoNumber}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Financial Details */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h4 className="font-medium text-gray-800 mb-3">Financial Summary</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">LPO Value</span>
                          <span className="font-medium">{selectedItem.lpoValue}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Invoice Value</span>
                          <span className="font-medium">{selectedItem.invoiceValue}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-gray-200">
                          <span className="font-medium text-gray-800">Pending Value</span>
                          <span className={`font-bold ${parseFloat(selectedItem.pendingValue.replace(/[^0-9.]/g, '')) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {selectedItem.pendingValue}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex space-x-3">
                      <button className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                        Generate Invoice
                      </button>
                      <button className="flex-1 bg-gray-200 text-gray-800 py-2.5 px-4 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium">
                        Edit Order
                      </button>
                      <button className="flex-1 bg-red-50 text-red-600 py-2.5 px-4 rounded-md hover:bg-red-100 transition-colors text-sm font-medium">
                        Cancel Order
                      </button>
                    </div>
                  </div>
                )}

                {/* Transactions Tab */}
                {activeTab === 'transactions' && (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 text-lg">No transactions found</p>
                    <p className="text-gray-400 text-sm mt-2">There are no transactions for this sales order yet.</p>
                  </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-4">
                      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 text-lg">No Recent History</p>
                    <p className="text-gray-400 text-sm mt-2">There is no recent history for this sales order.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Salesorders;