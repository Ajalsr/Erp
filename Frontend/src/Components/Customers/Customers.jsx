import { useEffect, useState, useRef, useCallback } from "react";
import { 
  FaThList, FaThLarge, FaPlus, FaEllipsisV, FaFilter, FaTimes, 
  FaSearch, FaUser, FaBuilding, FaEnvelope, FaPhone, FaIdCard,
  FaDownload, FaUpload, FaUsers, FaCheckCircle, FaClock, FaCreditCard 
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetCustomers from '../../helper/useGetCustomers';
import debounce from 'lodash/debounce';

const Customers = () => {
  const { handleGetCustomers, data, loading, error } = useGetCustomers();
  const navigate = useNavigate();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  
  const searchRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const displayItems = data || [];
  const totalCustomers = displayItems.length;
  
  useEffect(() => {
    let filtered = [...displayItems];
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        (item.customerDisplayName && item.customerDisplayName.toLowerCase().includes(term)) ||
        (item.companyName && item.companyName.toLowerCase().includes(term)) ||
        (item.customerEmail && item.customerEmail.toLowerCase().includes(term)) ||
        (item.customerPhone && item.customerPhone.toLowerCase().includes(term)) ||
        (item.customerCode && item.customerCode.toLowerCase().includes(term))
      );
    }
    
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(item => {
        const status = item.status || 'active';
        return status.toLowerCase() === selectedStatus.toLowerCase();
      });
    }
    
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = (a.customerDisplayName || '').toLowerCase();
          bValue = (b.customerDisplayName || '').toLowerCase();
          break;
        case 'company':
          aValue = (a.companyName || '').toLowerCase();
          bValue = (b.companyName || '').toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.createdAt || Date.now());
          bValue = new Date(b.createdAt || Date.now());
          break;
        case 'receivables':
          aValue = parseFloat(a.selling_price) || 0;
          bValue = parseFloat(b.selling_price) || 0;
          break;
        default:
          aValue = (a.customerDisplayName || '').toLowerCase();
          bValue = (b.customerDisplayName || '').toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setFilteredItems(filtered);
  }, [displayItems, searchTerm, selectedStatus, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
    setActiveTab('overview'); 
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedItem(null);
  };

  const handleSearchChange = useCallback(
    debounce((term) => {
      setSearchTerm(term);
    }, 300),
    []
  );

  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    handleSearchChange(value);
    
    if (value.trim().length >= 2) {
      fetchSuggestions(value);
    } else {
      setSearchSuggestions([]);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchSuggestions([]);
    setIsSearchFocused(false);
  };

  const fetchSuggestions = async (query) => {
    if (!query.trim()) return;
    
    const term = query.toLowerCase();
    const suggestions = displayItems.filter(item => 
      (item.customerDisplayName && item.customerDisplayName.toLowerCase().includes(term)) ||
      (item.companyName && item.companyName.toLowerCase().includes(term)) ||
      (item.customerEmail && item.customerEmail.toLowerCase().includes(term)) ||
      (item.customerPhone && item.customerPhone.toLowerCase().includes(term))
    ).slice(0, 5); 
    
    setSearchSuggestions(suggestions);
  };

  const handleSuggestionClick = (item) => {
    setSearchTerm(item.customerDisplayName);
    setSearchSuggestions([]);
    setIsSearchFocused(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchSuggestions([]);
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCustomerCode = (item) => {
    if (item.customerCode) return item.customerCode;
    
    const name = item.customerDisplayName || '';
    const initials = name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 3);
    
    const idSuffix = item._id ? item._id.slice(-4).toUpperCase() : '0000';
    return `${initials}${idSuffix}`;
  };

  const handleExportCustomers = () => {
    const exportData = displayItems.map(item => ({
      'Customer Code': getCustomerCode(item),
      'Customer Name': item.customerDisplayName || 'Unnamed Customer',
      'Company Name': item.companyName || 'N/A',
      'Email': item.customerEmail || 'N/A',
      'Phone': item.customerPhone || 'N/A',
      'Receivables': item.selling_price ? `AED ${item.selling_price}` : 'N/A',
      'Description': item.sales_description || 'No description',
      'Status': item.status || 'active',
    }));

    const headers = Object.keys(exportData[0]).join(',');
    const rows = exportData.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const activeCustomers = displayItems.filter(item => (item.status || 'active') === 'active').length;
  const pendingCustomers = displayItems.filter(item => (item.status || 'active') === 'pending').length;
  const totalReceivables = displayItems.reduce((sum, item) => sum + (parseFloat(item.selling_price) || 0), 0);

  useEffect(() => {
    handleGetCustomers();
  }, [handleGetCustomers]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (error) return <div className="text-red-500 p-4">Error: {error}</div>;

  return (
    <div className="bg-white min-h-screen p-6 text-gray-800">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-1">Manage your customer relationships</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportCustomers}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FaDownload />
              <span className="hidden sm:inline">Export</span>
            </button>
            
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <FaUpload />
              <span className="hidden sm:inline">Import</span>
            </button>
            
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center space-x-2 hover:bg-blue-700 cursor-pointer" 
              onClick={() => navigate("/Sales/Customers/Newcustomers")}
            >
              <FaPlus />
              <span>New Customer</span>
            </button>
            
            <button className="p-2 border rounded-md hover:bg-gray-100">
              <FaEllipsisV className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{totalCustomers}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <FaUsers className="text-blue-600 text-xl" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {activeCustomers}
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <FaCheckCircle className="text-green-600 text-xl" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {pendingCustomers}
                </p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FaClock className="text-yellow-600 text-xl" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Receivables</p>
                <p className="text-2xl font-bold text-purple-600">
                  AED {totalReceivables.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaCreditCard className="text-purple-600 text-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6" ref={searchRef}>
        <div className="relative">
          <form onSubmit={(e) => e.preventDefault()} className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <FaSearch />
            </div>
            
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchInput}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Search by customer name, company, email, phone, or customer code..."
              className="w-full pl-10 pr-10 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            )}
          </form>

          {isSearchFocused && searchSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              <div className="p-2 border-b border-gray-100 bg-gray-50">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quick Results ({searchSuggestions.length})
                </div>
              </div>
              
              {searchSuggestions.map((item, index) => (
                <div
                  key={item._id || index}
                  onClick={() => handleItemClick(item)}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <FaUser className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline  gap-2">
                        <div className="font-medium text-gray-900 truncate">
                          {item.customerDisplayName || 'Unnamed Customer'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-mono bg-blue-100 text-blue-800 rounded">
                            {getCustomerCode(item)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        {item.companyName && item.companyName !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <FaBuilding />
                            <span className="truncate">{item.companyName}</span>
                          </div>
                        )}
                        
                        {item.customerEmail && item.customerEmail !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <FaEnvelope />
                            <span className="truncate">{item.customerEmail}</span>
                          </div>
                        )}
                        
                        {item.customerPhone && item.customerPhone !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <FaPhone />
                            <span>{item.customerPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="p-2 border-t border-gray-100 bg-gray-50">
                <div className="text-xs text-gray-500">
                  Press Enter to search for "{searchTerm}"
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-gray-600">
            {searchTerm ? (
              <span>
                Found <span className="font-semibold">{filteredItems.length}</span> customers matching "{searchTerm}"
              </span>
            ) : (
              <span>
                Total <span className="font-semibold">{displayItems.length}</span> customers
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              <FaFilter />
              <span>Filter</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter by:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="name">Name</option>
              <option value="company">Company</option>
              <option value="date">Created Date</option>
              <option value="receivables">Receivables</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} customers
        </div>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-8">
                <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
              </th>
              <th className="px-4 py-3 text-left font-medium">Name & Customer Code</th>
              <th className="px-4 py-3 text-left font-medium">Company Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Work Phone</th>
              <th className="px-4 py-3 text-left font-medium">Receivables</th>
              <th className="px-4 py-3 text-right font-medium">Unused Credits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.map((item, index) => (
              <tr key={item._id || item.id || index} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-md flex items-center justify-center">
                      <FaUser className="text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span 
                          className="text-blue-600 hover:underline font-medium cursor-pointer"
                          onClick={() => handleItemClick(item)}
                        >
                          {item.customerDisplayName || 'Unnamed Customer'}
                        </span>
                        <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {getCustomerCode(item)}
                        </span>
                      </div>
                      {item.companyName && item.companyName !== 'N/A' && (
                        <div className="text-xs text-gray-500 mt-1">
                          {item.companyName}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {item.companyName && item.companyName !== 'N/A' ? item.companyName : 'N/A'}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {item.customerEmail && item.customerEmail !== 'N/A' ? (
                    <div className="flex items-center gap-1">
                      <FaEnvelope className="text-gray-400 text-xs" />
                      <span>{item.customerEmail}</span>
                    </div>
                  ) : 'N/A'}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {item.customerPhone && item.customerPhone !== 'N/A' ? (
                    <div className="flex items-center gap-1">
                      <FaPhone className="text-gray-400 text-xs" />
                      <span>{item.customerPhone}</span>
                    </div>
                  ) : 'N/A'}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs">
                  <div className="truncate" title={item.sales_description}>
                    {item.sales_description || "No description"}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">
                  {item.selling_price ? `AED ${item.selling_price}` : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {currentItems.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <FaUser className="text-gray-400 text-2xl" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? `No results for "${searchTerm}"` : 'Start by adding your first customer'}
            </p>
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              onClick={() => navigate("/Sales/Customers/Newcustomers")}
            >
              Add Customer
            </button>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      )}

      <div
        className={`fixed inset-0 z-50 transform transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div 
          className="absolute inset-0 bg-opacity-20 backdrop-blur-md backdrop-filter"
          onClick={closeDrawer}
        ></div>
        
        <div className="absolute right-0 top-0 h-full w-196 max-w-full bg-white shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">{selectedItem?.customerDisplayName || "Customer Details"}</h3>
            <button 
              onClick={closeDrawer}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <FaTimes className="text-gray-500" />
            </button>
          </div>

          <div className="border-b border-gray-200">
            <div className="flex space-x-1 px-4">
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
          
          <div className="p-4 overflow-y-auto h-full">
            {selectedItem && (
              <div className="space-y-4">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FaUser className="text-blue-600 text-xl" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-800">{selectedItem.customerDisplayName || 'Unnamed Customer'}</h4>
                        <p className="text-gray-600 text-sm flex items-center gap-2">
                          <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {getCustomerCode(selectedItem)}
                          </span>
                          <span>Customer Code</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500 flex items-center gap-1">
                          <FaBuilding /> Company
                        </label>
                        <p className="font-medium text-gray-800">{selectedItem.companyName || "N/A"}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500 flex items-center gap-1">
                          <FaEnvelope /> Email
                        </label>
                        <p className="font-medium text-gray-800">{selectedItem.customerEmail || "N/A"}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500 flex items-center gap-1">
                          <FaPhone /> Phone
                        </label>
                        <p className="font-medium text-gray-800">{selectedItem.customerPhone || "N/A"}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500">Receivables</label>
                        <p className="font-medium text-gray-800">
                          {selectedItem.selling_price ? `AED ${selectedItem.selling_price}` : "N/A"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <label className="text-sm text-gray-500">Description</label>
                      <p className="mt-1 text-gray-700">
                        {selectedItem.sales_description || "No description available"}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <label className="text-sm text-gray-500">Customer ID</label>
                      <p className="font-medium text-gray-800 font-mono">{selectedItem._id || "N/A"}</p>
                    </div>
                  </div>
                )}

                {activeTab === 'transactions' && (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">No transactions found</p>
                    <p className="text-gray-400 text-sm mt-1">There are no transactions for this customer yet.</p>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">No Recent History</p>
                    <p className="text-gray-400 text-sm mt-1">There is no recent history for this customer.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
         
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
            <div className="flex space-x-2">
              <button 
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                onClick={() => {
                  console.log("Edit customer:", selectedItem);
                 
                }}
              >
                Edit Customer
              </button>
              <button 
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
                onClick={closeDrawer}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Customers;