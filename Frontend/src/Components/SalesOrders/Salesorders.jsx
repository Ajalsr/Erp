import { useEffect, useState } from "react";
import { FaThList, FaThLarge, FaPlus, FaEllipsisV, FaFilter, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetAllSalesOrder from '../../helper/useGetAllSalesOrder';

const Salesorders = () => {
  const { handleGetSalesorder, data, loading, error } = useGetAllSalesOrder();
  const navigate = useNavigate();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Get status color based on status
  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'in progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format status display text
  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  };

  // Calculate pending value
  const calculatePendingValue = (item) => {
    if (!item) return 0;
    // Assuming pending value is total minus any payments made
    // You might need to adjust this based on your actual business logic
    return item.total;
  };

  // Transform API data to match your table structure
  const transformSalesOrders = (apiData) => {
    if (!apiData?.salesOrders) return [];
    
    return apiData.salesOrders.map(order => ({
      id: order.id,
      saleOrderNumber: order.orderNumber,
      status: formatStatus(order.status),
      statusColor: getStatusColor(order.status),
      customer: order.customerName || 'N/A',
      customerCode: order.customerCode,
      customerEmail: '', // You might need to fetch this separately or include it in API
      customerPhone: '', // You might need to fetch this separately or include it in API
      lpoNumber: order.lpoNumber || 'N/A',
      lpoValue: formatCurrency(order.lpoValue || 0),
      invoiceValue: formatCurrency(0), // You might need to calculate this from invoices
      pendingValue: formatCurrency(calculatePendingValue(order)),
      total: formatCurrency(order.total || 0),
      orderDate: formatDate(order.orderDate),
      lpoDate: formatDate(order.lpoDate),
      expectedShipmentDate: formatDate(order.expectedShipmentDate),
      paymentTerms: order.paymentTerms,
      salesperson: order.salesperson,
      items: order.items || [],
      subTotal: order.subTotal,
      shippingCharges: order.shippingCharges,
      adjustment: order.adjustment,
      vat: order.vat,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));
  };

  // Get sales orders from API data
  const salesOrders = data ? transformSalesOrders(data) : [];

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

  // Calculate totals for stats cards
  const calculateStats = () => {
    if (!data?.salesOrders) return {
      totalOrders: 0,
      totalValue: 0,
      pendingValue: 0,
      paidValue: 0
    };

    const orders = data.salesOrders;
    const totalOrders = orders.length;
    const totalValue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    
    // Assuming pending value is total (adjust based on your business logic)
    const pendingValue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    
    // Assuming paid value is 0 initially (you'll need to calculate from invoices)
    const paidValue = 0;

    return {
      totalOrders,
      totalValue,
      pendingValue,
      paidValue
    };
  };

  const stats = calculateStats();

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
    handleGetSalesorder();
  }, [handleGetSalesorder]);

  // Loading state
  if (loading) return (
    <div className="bg-white min-h-screen flex flex-col items-center justify-center">
      <div className="relative">
        {/* Animated spinner */}
        <div className="w-20 h-20 border-4 border-blue-100 rounded-full"></div>
        <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
        
        {/* Inner spinner */}
        <div className="absolute top-2 left-2 w-16 h-16 border-2 border-blue-200 rounded-full animate-spin border-b-transparent" 
             style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}>
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <h3 className="text-lg font-medium text-gray-700">Loading Sales Orders</h3>
        <p className="text-gray-500 mt-2">Fetching sales order data...</p>
        
        <div className="mt-4 w-48 bg-gray-200 rounded-full h-1.5 mx-auto">
          <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
        
        <div className="mt-4 flex space-x-2 justify-center">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );

  // Error state
  if (error) return (
    <div className="bg-white min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md p-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-700">Error Loading Sales Orders</h3>
        <p className="text-gray-500 mt-2">{error}</p>
        <button 
          onClick={handleGetSalesorder}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </div>
  );
  
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
          <div className="text-2xl font-bold text-gray-800 mt-1">{stats.totalOrders}</div>
          <div className="text-xs text-gray-500 mt-2">All time sales orders</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="text-sm text-green-600 font-medium">Total Value</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(stats.totalValue)}</div>
          <div className="text-xs text-gray-500 mt-2">Sum of all order values</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
          <div className="text-sm text-yellow-600 font-medium">Pending Value</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(stats.pendingValue)}</div>
          <div className="text-xs text-gray-500 mt-2">Awaiting payment</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="text-sm text-purple-600 font-medium">Paid Value</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(stats.paidValue)}</div>
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
              <th className="px-6 py-4 text-left font-medium">Customer Code</th>
              <th className="px-6 py-4 text-left font-medium">LPO Number</th>
              <th className="px-6 py-4 text-left font-medium">LPO Value</th>
              <th className="px-6 py-4 text-left font-medium">Total Value</th>
              <th className="px-6 py-4 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.length > 0 ? (
              currentItems.map((item, index) => (
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
                      <div className="text-xs text-gray-500">{item.customerEmail || 'No email'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">{item.customerCode}</td>
                  <td className="px-6 py-4 text-gray-700 font-medium">{item.lpoNumber}</td>
                  <td className="px-6 py-4 text-gray-700 font-medium">{item.lpoValue}</td>
                  <td className="px-6 py-4 text-gray-700 font-medium">{item.total}</td>
                  <td className="px-6 py-4 text-gray-600">{item.orderDate}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                  No sales orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer - Only show if there are items */}
      {displayItems.length > 0 && (
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
      )}

      {/* Drawer with Tabs */}
      <div
        className={`fixed inset-0 z-50 ${isDrawerOpen ? 'block' : 'hidden'}`}
      >
        {/* Glass Backdrop */}
        <div 
          className="absolute inset-0 bg-opacity-20 backdrop-blur-md backdrop-filter"
          onClick={closeDrawer}
        ></div>
        
        {/* Drawer Panel */}
        <div className={`absolute right-0 top-0 h-full w-full sm:w-96 md:w-128 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="h-full flex flex-col">
            {/* Drawer Header with Gray Border */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedItem?.saleOrderNumber || "Sales Order Details"}</h3>
                <p className="text-sm text-gray-500 mt-1">{selectedItem?.customer || ""} ({selectedItem?.customerCode})</p>
              </div>
              <button 
                onClick={closeDrawer}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <FaTimes className="text-gray-500 text-lg" />
              </button>
            </div>

            {/* Tabs Navigation with Gray Border */}
            <div className="flex-shrink-0 border-b border-gray-200">
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
            
            {/* Tab Content - Scrollable Area */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full overflow-y-auto">
                <div className="p-6">
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
                                  <div className="text-gray-700">{selectedItem.orderDate}</div>
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-gray-500">Customer Name</div>
                                <div className="font-medium text-gray-800 mt-1">{selectedItem.customer}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Customer Code</div>
                                <div className="font-medium text-gray-800 mt-1">{selectedItem.customerCode}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">LPO Number</div>
                                <div className="font-medium text-gray-800 mt-1">{selectedItem.lpoNumber}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Salesperson</div>
                                <div className="font-medium text-gray-800 mt-1">{selectedItem.salesperson || 'N/A'}</div>
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
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium">{formatCurrency(selectedItem.subTotal || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Shipping Charges</span>
                                <span className="font-medium">{formatCurrency(selectedItem.shippingCharges || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Adjustment</span>
                                <span className="font-medium">{formatCurrency(selectedItem.adjustment || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">VAT</span>
                                <span className="font-medium">{formatCurrency(selectedItem.vat || 0)}</span>
                              </div>
                              <div className="flex justify-between pt-3 border-t border-gray-200">
                                <span className="font-medium text-gray-800">Total Value</span>
                                <span className="font-bold text-gray-800">{selectedItem.total}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Order Items */}
                          {selectedItem.items && selectedItem.items.length > 0 && (
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                              <h4 className="font-medium text-gray-800 mb-3">Order Items</h4>
                              <div className="space-y-3">
                                {selectedItem.items.map((item, index) => (
                                  <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-white rounded border">
                                    <div className="mb-2 sm:mb-0">
                                      <div className="font-medium">{item.details || `Item ${index + 1}`}</div>
                                      <div className="text-sm text-gray-500">Qty: {item.quantity} × {formatCurrency(item.rate)}</div>
                                      {item.discount && (
                                        <div className="text-sm text-gray-500">Discount: {item.discount}</div>
                                      )}
                                    </div>
                                    <div className="text-left sm:text-right">
                                      <div className="font-medium">{formatCurrency(item.amount)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Actions */}
                          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
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
        </div>
      </div>
    </div>
  )
}

export default Salesorders;