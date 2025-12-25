import { useEffect, useState, useRef } from "react";
import { FaThList, FaThLarge, FaPlus, FaEllipsisV, FaFilter, FaTimes, FaSearch, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetItem from '../../helper/useGetItem';

export default function Item() {
  const { handleGetItem, data, loading, error } = useGetItem();
  const navigate = useNavigate();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedSearchItem, setSelectedSearchItem] = useState(null);
  const searchRef = useRef(null);
  
  const [localItems] = useState([
    {
      id: 1,
      name: "Storage Cabinet",
      item_code: "ITM001",
      sku: "Item 37 sku",
      type: "Product",
      unit: "Piece",
      description: "A versatile storage cabinet with adjustable shelves.",
      selling_price: "4610.00",
      quantity: 50,
      brand: "FurnitureCo",
      image: "https://via.placeholder.com/40",
    },
    {
      id: 2,
      name: "Area Rug",
      item_code: "ITM002",
      sku: "Item 38 sku",
      type: "Product",
      unit: "Piece",
      description: "A soft, high-quality area rug to add warmth to any room.",
      selling_price: "2990.00",
      quantity: 30,
      brand: "HomeDecor",
      image: "https://via.placeholder.com/40",
    },
    {
      id: 3,
      name: "Office Chair",
      item_code: "ITM003",
      sku: "Item 39 sku",
      type: "Product",
      unit: "Piece",
      description: "Ergonomic office chair with lumbar support",
      selling_price: "1890.00",
      quantity: 25,
      brand: "OfficePro",
      image: "https://via.placeholder.com/40",
    },
    {
      id: 4,
      name: "LED Bulb 15W",
      item_code: "ITM004",
      sku: "Item 40 sku",
      type: "Product",
      unit: "Box",
      description: "Energy efficient LED bulb 15W warm white",
      selling_price: "45.00",
      quantity: 200,
      brand: "LightTech",
      image: "https://via.placeholder.com/40",
    }
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 200;

  // Merge API data with local items for display
  const allItems = Array.isArray(data) && data.length > 0 ? data : localItems;
  
  // Apply search filter for dropdown
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredItems([]);
      setShowDropdown(false);
    } else {
      const filtered = allItems.filter(item => 
        (item.item_code && item.item_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredItems(filtered);
      setShowDropdown(true);
    }
  }, [searchTerm, allItems]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Items to display in table (show all or filtered items)
  const displayItems = selectedSearchItem ? [selectedSearchItem] : allItems;
  
  const totalPages = Math.ceil(displayItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = displayItems.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // This function opens the drawer with the selected item details
  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
    setActiveTab('overview'); 
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedItem(null);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleSelectItemFromDropdown = (item) => {
    setSelectedSearchItem(item);
    setSearchTerm(`${item.item_code} - ${item.name}`);
    setShowDropdown(false);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedSearchItem(null);
    setShowDropdown(false);
    setCurrentPage(1);
  };

  const toggleDropdown = () => {
    if (searchTerm.trim()) {
      setShowDropdown(!showDropdown);
    }
  };

  useEffect(() => {
    handleGetItem();
  }, [handleGetItem]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="bg-white min-h-screen p-6 text-gray-800">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">All Items</h2>
          <button className="text-gray-500 hover:text-gray-700">
            <FaFilter />
          </button>
        </div>

        <div className="flex items-center space-x-3">
          {/* Enhanced Search Bar with Dropdown */}
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                onFocus={() => searchTerm.trim() && setShowDropdown(true)}
                className="pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                placeholder="Search items..."
              />
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <button
                onClick={toggleDropdown}
                className="absolute right-10 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showDropdown ? <FaChevronUp /> : <FaChevronDown />}
              </button>
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            {/* Search Dropdown */}
            {showDropdown && filteredItems.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div className="py-1">
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b">
                    {filteredItems.length} item(s) found
                  </div>
                  {filteredItems.map((item) => (
                    <div
                      key={item._id || item.id}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center space-x-3 border-b border-gray-100 last:border-b-0"
                      onClick={() => handleItemClick(item)}
                    >
                      <img
                        src={item.image || "https://via.placeholder.com/30"}
                        alt={item.name}
                        className="w-6 h-6 rounded border border-gray-200"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{item.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {item.item_code} • {item.brand || 'No brand'} • AED {item.selling_price || '0.00'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Results Message */}
            {showDropdown && searchTerm.trim() && filteredItems.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                <div className="px-3 py-4 text-center text-gray-500">
                  <FaSearch className="mx-auto mb-2 text-gray-400" />
                  <p>No items found for "{searchTerm}"</p>
                  <p className="text-xs mt-1">Try different search terms</p>
                </div>
              </div>
            )}
          </div>

          <button className="p-2 border rounded-md hover:bg-gray-100">
            <FaThList className="text-gray-600" />
          </button>
          <button className="p-2 border rounded-md hover:bg-gray-100">
            <FaThLarge className="text-gray-600" />
          </button>
          <button 
            className="bg-blue-600 text-white px-3 py-2 rounded-md flex items-center space-x-2 hover:bg-blue-700 cursor-pointer" 
            onClick={() => navigate("/Items/Items/New")}
          >
            <FaPlus />
            <span>New</span>
          </button>
          <button className="p-2 border rounded-md hover:bg-gray-100">
            <FaEllipsisV className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Search Status */}
      {selectedSearchItem && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img
              src={selectedSearchItem.image || "https://via.placeholder.com/30"}
              alt={selectedSearchItem.name}
              className="w-8 h-8 rounded border border-gray-200"
            />
            <div>
              <span className="font-medium text-blue-700">
                Showing: {selectedSearchItem.item_code} - {selectedSearchItem.name}
              </span>
              <p className="text-sm text-blue-600">
                Brand: {selectedSearchItem.brand || 'N/A'} • 
                Price: AED {selectedSearchItem.selling_price || '0.00'} • 
                Quantity: {selectedSearchItem.quantity || '0'}
              </p>
            </div>
          </div>
          <button
            onClick={clearSearch}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1 cursor-pointer"
          >
            <FaTimes />
            <span>Clear filter</span>
          </button>
        </div>
      )}

      <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-8">
                <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
              </th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Item Code</th>
              <th className="px-4 py-3 text-left font-medium">Unit</th>
              <th className="px-4 py-3 text-left font-medium">Brand</th>
              <th className="px-4 py-3 text-left font-medium">Quantity</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Selling Price</th>
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
                      <img
                        src={item.image || "https://via.placeholder.com/40"}
                        alt={item.name}
                        className="w-8 h-8 rounded border border-gray-200"
                      />
                      <span 
                        className="text-blue-600 hover:underline font-medium cursor-pointer"
                        onClick={() => handleItemClick(item)} // This opens the drawer
                      >
                        {item.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="font-mono text-sm">{item.item_code || "N/A"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {item.unit || "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.brand || "N/A"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="truncate" title={item.quantity}>
                      {item.quantity || "0"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <div className="truncate" title={item.sales_description || item.description}>
                      {item.sales_description || item.description || "No description"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    {item.selling_price ? `AED ${parseFloat(item.selling_price).toFixed(2)}` : 
                     item.rate ? item.rate : "N/A"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <FaSearch className="text-gray-400 text-3xl mb-2" />
                    <p className="text-lg">No items found</p>
                    <p className="text-sm mt-1">Try adjusting your search terms</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {currentItems.length > 0 && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
          <div>
            Showing {startIndex + 1} -{" "}
            {Math.min(startIndex + itemsPerPage, displayItems.length)} of {displayItems.length}
            {selectedSearchItem && " (Filtered)"}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50"
            >
              Prev
            </button>

            {[...Array(totalPages)].map((_, index) => (
              <button
                key={index}
                onClick={() => handlePageChange(index + 1)}
                className={`px-3 py-1 border rounded-md ${
                  currentPage === index + 1
                    ? "bg-blue-500 text-white"
                    : "hover:bg-gray-100"
                }`}
              >
                {index + 1}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Drawer Component - This remains exactly as before */}
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
            <h3 className="text-lg font-semibold">{selectedItem?.name || "Item Details"}</h3>
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
                      <img
                        src={selectedItem.image || "https://via.placeholder.com/60"}
                        alt={selectedItem.name}
                        className="w-12 h-12 rounded border border-gray-200"
                      />
                      <div>
                        <h4 className="text-lg font-bold text-gray-800">{selectedItem.name}</h4>
                        <p className="text-gray-600 text-sm">Code: {selectedItem.item_code || "N/A"}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500">Brand</label>
                        <p className="font-medium text-gray-800">{selectedItem.brand || "N/A"}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500">Type</label>
                        <p className="font-medium text-gray-800">{selectedItem.type || "N/A"}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500">Unit</label>
                        <p className="font-medium text-gray-800">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {selectedItem.unit || "N/A"}
                          </span>
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500">Quantity</label>
                        <p className="font-medium text-gray-800">{selectedItem.quantity || "0"}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500">Selling Price</label>
                        <p className="font-medium text-gray-800">
                          {selectedItem.selling_price ? `AED ${selectedItem.selling_price}` : 
                           selectedItem.rate ? selectedItem.rate : "N/A"}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <label className="text-sm text-gray-500">SKU</label>
                        <p className="font-medium text-gray-800">{selectedItem.sku || "N/A"}</p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <label className="text-sm text-gray-500">Description</label>
                      <p className="mt-1 text-gray-700">
                        {selectedItem.sales_description || selectedItem.description || "No description available"}
                      </p>
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
                    <p className="text-gray-400 text-sm mt-1">There are no transactions for this item yet.</p>
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
                    <p className="text-gray-400 text-sm mt-1">There is no recent history for this item.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Drawer Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
            <div className="flex space-x-2">
              <button 
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                onClick={() => {
                  console.log("Edit item:", selectedItem);
                  navigate(`/Items/Items/Edit/${selectedItem.id || selectedItem._id}`);
                }}
              >
                Edit
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
}