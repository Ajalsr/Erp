import { useEffect, useState, useRef, useCallback } from "react";
import { 
  FaThList, FaThLarge, FaPlus, FaEllipsisV, FaFilter, FaTimes, 
  FaSearch, FaUser, FaBuilding, FaEnvelope, FaPhone, FaIdCard,
  FaDownload, FaUpload, FaUsers, FaCheckCircle, FaClock, FaCreditCard,
  FaChevronLeft, FaChevronRight, FaBoxOpen
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  
  const searchRef = useRef(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Calculate stats
  const getStats = () => {
    if (!data) return { total: 0, active: 0, pending: 0, receivables: 0 };
    
    const total = data.length;
    const active = data.filter(item => (item.status || 'active') === 'active').length;
    const pending = data.filter(item => (item.status || 'active') === 'pending').length;
    const receivables = data.reduce((sum, item) => sum + (parseFloat(item.selling_price) || 0), 0);
    
    return { total, active, pending, receivables };
  };

  const stats = getStats();

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

  // Filter and sort items (for table only - doesn't include search filter)
  const getFilteredAndSortedItems = () => {
    if (!data) return [];
    
    let filtered = [...data];
    
    // Apply status filter only (no search filter here)
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(item => {
        const status = item.status || 'active';
        return status.toLowerCase() === selectedStatus.toLowerCase();
      });
    }
    
    // Apply sorting
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
    
    return filtered;
  };

  const filteredItems = getFilteredAndSortedItems();

  // Update total pages when filtered items change
  useEffect(() => {
    if (!filteredItems || filteredItems.length === 0) {
      setTotalPages(1);
      return;
    }
    
    const pages = Math.ceil(filteredItems.length / itemsPerPage);
    setTotalPages(pages > 0 ? pages : 1);
    
    // Adjust current page if it's out of bounds
    if (currentPage > pages && pages > 0) {
      setCurrentPage(pages);
    }
  }, [filteredItems, itemsPerPage, currentPage]);

  // Get current page items (for table display)
  const getCurrentItems = () => {
    if (!filteredItems || filteredItems.length === 0) return [];
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredItems.length);
    
    return filteredItems.slice(startIndex, endIndex);
  };

  const currentItems = getCurrentItems();

  // Handle page change
  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages if total pages is less than or equal to maxPagesToShow
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);
      
      // Calculate start and end of middle pages
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if we're at the beginning
      if (currentPage <= 3) {
        end = 4;
      }
      
      // Adjust if we're at the end
      if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }
      
      // Add ellipsis if needed after first page
      if (start > 2) {
        pageNumbers.push('...');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        pageNumbers.push(i);
      }
      
      // Add ellipsis if needed before last page
      if (end < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
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
      // Only update search term for suggestions, not for table filtering
      // The table remains unchanged
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

  // Fetch suggestions for dropdown only
  const fetchSuggestions = async (query) => {
    if (!query.trim() || !data) return;
    
    const term = query.toLowerCase();
    const suggestions = data.filter(item => {
      const name = (item.customerDisplayName || '').toLowerCase();
      const company = (item.companyName || '').toLowerCase();
      const email = (item.customerEmail || '').toLowerCase();
      const phone = (item.customerPhone || '').toLowerCase();
      const code = (getCustomerCode(item) || '').toLowerCase();
      
      return name.includes(term) || 
             company.includes(term) || 
             email.includes(term) || 
             phone.includes(term) || 
             code.includes(term);
    }).slice(0, 10); // Increased to show more results
    
    setSearchSuggestions(suggestions);
  };

  const handleSuggestionClick = (item) => {
    // When a suggestion is clicked, you could:
    // 1. Navigate to the customer detail page
    // 2. Open the drawer with the customer details
    // 3. Or just clear the search and focus on that item
    
    // For now, let's open the drawer with the selected customer
    setSelectedItem(item);
    setIsDrawerOpen(true);
    setActiveTab('overview');
    
    // Clear search
    setSearchTerm('');
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

  const handleExportCustomers = () => {
    if (!data || data.length === 0) {
      alert('No customers to export');
      return;
    }

    const exportData = data.map(item => ({
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

  useEffect(() => {
    handleGetCustomers();
  }, [handleGetCustomers]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (error) return <div className="text-red-500 p-4">Error: {error}</div>;

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredItems.length);

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
              disabled={!data || data.length === 0}
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
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
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
                  {stats.active}
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
                  {stats.pending}
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
                  AED {stats.receivables.toLocaleString()}
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
              placeholder="Search customers by name, company, email, phone, or code..."
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

          {/* Search Suggestions Dropdown */}
          {isSearchFocused && searchSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              <div className="p-2 border-b border-gray-100 bg-gray-50">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Search Results ({searchSuggestions.length})
                </div>
              </div>
              
              {searchSuggestions.map((item, index) => (
                <div
                  key={item._id || index}
                  onClick={() => handleSuggestionClick(item)}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <FaUser className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <div className="font-medium text-gray-900 truncate">
                          {item.customerDisplayName || 'Unnamed Customer'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-mono bg-blue-100 text-blue-800 rounded">
                            {getCustomerCode(item)}
                          </span>
                          {item.status && item.status !== 'active' && (
                            <span className={`px-2 py-1 text-xs rounded ${
                              item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                              item.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {item.status}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        {item.companyName && item.companyName !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <FaBuilding className="text-xs" />
                            <span className="truncate">{item.companyName}</span>
                          </div>
                        )}
                        
                        {item.customerEmail && item.customerEmail !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <FaEnvelope className="text-xs" />
                            <span className="truncate">{item.customerEmail}</span>
                          </div>
                        )}
                        
                        {item.customerPhone && item.customerPhone !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <FaPhone className="text-xs" />
                            <span>{item.customerPhone}</span>
                          </div>
                        )}
                      </div>
                      
                      {item.selling_price && parseFloat(item.selling_price) > 0 && (
                        <div className="mt-1 text-xs font-medium text-purple-600">
                          Receivables: AED {item.selling_price}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="p-2 border-t border-gray-100 bg-gray-50">
                <div className="text-xs text-gray-500">
                  Click on a customer to view details
                </div>
              </div>
            </div>
          )}

          {/* Show message when searching but no results */}
          {isSearchFocused && searchTerm.trim().length >= 2 && searchSuggestions.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
              <div className="p-4 text-center">
                <FaUser className="text-gray-400 text-xl mx-auto mb-2" />
                <p className="text-gray-500">No customers found for "{searchTerm}"</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-gray-600">
            Total <span className="font-semibold">{data?.length || 0}</span> customers
            {searchTerm && searchSuggestions.length > 0 && (
              <span className="ml-2">
                • <span className="font-semibold">{searchSuggestions.length}</span> search results for "{searchTerm}"
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
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1); // Reset to first page when filtering
              }}
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
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1); // Reset to first page when sorting
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="name">Name</option>
              <option value="company">Company</option>
              <option value="date">Created Date</option>
              <option value="receivables">Receivables</option>
            </select>
            
            <button
              onClick={() => {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                setCurrentPage(1); // Reset to first page when changing sort order
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          Showing {startIndex}-{endIndex} of {filteredItems.length} customers
        </div>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm mb-4">
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
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Receivables</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.length > 0 ? (
              currentItems.map((item, index) => (
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
                          {item.status && item.status !== 'active' && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                              item.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {item.status}
                            </span>
                          )}
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
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <FaBoxOpen className="text-gray-400 text-3xl mb-2" />
                    <p className="text-lg font-medium text-gray-900 mb-2">No customers found</p>
                    <p className="text-gray-500 mb-4">
                      {selectedStatus !== 'all' 
                        ? `No customers with status "${selectedStatus}"` 
                        : 'Start by adding your first customer'}
                    </p>
                    <button 
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      onClick={() => navigate("/Sales/Customers/Newcustomers")}
                    >
                      Add Customer
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredItems.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-700">
            Showing {startIndex}-{endIndex} of {filteredItems.length} customers
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FaChevronLeft />
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {getPageNumbers().map((pageNum, index) => (
                pageNum === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-3 py-2 text-sm text-gray-500">
                    ...
                  </span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 text-sm rounded ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              ))}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Next
              <FaChevronRight />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // Reset to first page when changing items per page
              }}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}

      {/* Drawer Component */}
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
                          {selectedItem.status && selectedItem.status !== 'active' && (
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              selectedItem.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                              selectedItem.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {selectedItem.status}
                            </span>
                          )}
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
                  // Add edit functionality here
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