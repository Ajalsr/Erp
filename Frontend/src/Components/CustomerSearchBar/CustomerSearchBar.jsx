// Update your CustomerSearchBar.jsx to match your data fields
import React, { useState, useRef, useEffect } from 'react';
import { Search, X, User, Hash, Building, Phone, Mail, Filter } from 'lucide-react';

const CustomerSearchBar = ({ 
  onSearch, 
  totalCustomers, 
  placeholder = "Search customers...",
  showFilterButton = true,
  data = []  // Pass your customers data for local filtering
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);

  // Generate customer code from your data structure
  const getCustomerCode = (customer) => {
    if (customer.customerCode) return customer.customerCode;
    
    // Generate from customerDisplayName and _id
    const name = customer.customerDisplayName || '';
    const initials = name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 3);
    
    const idSuffix = customer._id ? customer._id.slice(-4).toUpperCase() : '0000';
    return `${initials}${idSuffix}`;
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.trim().length >= 2) {
      // Use API suggestions if endpoint exists, otherwise filter locally
      if (typeof fetchSuggestions === 'function') {
        fetchSuggestions(value);
      } else {
        filterLocalSuggestions(value);
      }
    } else {
      setSuggestions([]);
    }
  };

  // Local filtering for suggestions
  const filterLocalSuggestions = (query) => {
    if (!data || data.length === 0) return;
    
    const term = query.toLowerCase();
    const filtered = data.filter(customer => 
      (customer.customerDisplayName && customer.customerDisplayName.toLowerCase().includes(term)) ||
      (customer.companyName && customer.companyName.toLowerCase().includes(term)) ||
      (customer.customerEmail && customer.customerEmail.toLowerCase().includes(term)) ||
      (customer.customerPhone && customer.customerPhone.toLowerCase().includes(term)) ||
      (customer.customerCode && customer.customerCode.includes(term))
    ).slice(0, 8); // Limit to 8 suggestions
    
    setSuggestions(filtered);
  };

  // Optional: API-based suggestions
  const fetchSuggestions = async (query) => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/customers/suggestions?q=${encodeURIComponent(query)}&limit=8`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // Fallback to local filtering
      filterLocalSuggestions(query);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm);
      setSuggestions([]);
      searchRef.current?.blur();
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSuggestions([]);
    onSearch('');
  };

  const handleSuggestionClick = (customer) => {
    setSearchTerm(customer.customerDisplayName || customer.customerName || customer.customerCode || '');
    setSuggestions([]);
    onSearch(customer.customerDisplayName || customer.customerName || '');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSuggestions([]);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCustomerIcon = (customer) => {
    if (customer.customerCode || customer.customerDisplayName) {
      return <Hash size={16} className="text-blue-500" />;
    }
    if (customer.customerEmail) {
      return <Mail size={16} className="text-green-500" />;
    }
    return <User size={16} className="text-gray-500" />;
  };

  return (
    <div className="relative mb-6" ref={searchRef}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Search size={20} />
            </div>
            
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => setIsFocused(true)}
              placeholder={placeholder}
              className="w-full pl-10 pr-10 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
            
            <button
              type="submit"
              className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Search"
            >
              ↵
            </button>
          </form>

          {isFocused && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              <div className="p-2 border-b border-gray-100 bg-gray-50">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quick Results ({suggestions.length})
                </div>
              </div>
              
              {suggestions.map((customer, index) => (
                <div
                  key={customer._id || customer.id || index}
                  onClick={() => handleSuggestionClick(customer)}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getCustomerIcon(customer)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-medium text-gray-900 truncate">
                          {customer.customerDisplayName || customer.customerName || 'Unnamed Customer'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-mono bg-blue-100 text-blue-800 rounded">
                            {getCustomerCode(customer)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        {customer.customerEmail && customer.customerEmail !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <Mail size={12} />
                            <span className="truncate">{customer.customerEmail}</span>
                          </div>
                        )}
                        
                        {customer.customerPhone && customer.customerPhone !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <Phone size={12} />
                            <span>{customer.customerPhone}</span>
                          </div>
                        )}
                        
                        {customer.companyName && customer.companyName !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <Building size={12} />
                            <span className="font-mono text-xs">
                              {customer.companyName}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {customer.companyName && customer.companyName !== 'N/A' && (
                        <div className="mt-1 text-xs text-gray-500">
                          {customer.companyName}
                        </div>
                      )}
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

          {loading && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">Searching...</span>
              </div>
            </div>
          )}
        </div>

        
        {showFilterButton && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="hidden sm:block">
              <span className="font-medium">{totalCustomers}</span> customers
            </div>
            <button
              type="button"
              onClick={() => {
                // Handle filter toggle
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter size={16} />
              Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSearchBar;