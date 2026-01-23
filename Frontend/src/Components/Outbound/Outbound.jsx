import { useState, useEffect, useRef } from "react";
import { 
  FaThList, FaThLarge, FaPlus, FaEllipsisV, FaFilter, 
  FaTimes, FaSearch, FaChevronDown, FaChevronUp, FaCheck,
  FaEdit, FaTrash, FaClipboardCheck, FaBoxOpen, FaShippingFast
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import useGetItem from '../../helper/useGetItem';
import useGetAllSalesOrder from '../../helper/useGetAllSalesOrder';

export default function Outbound() {
  const { handleGetItem, data: itemsData, loading: itemsLoading, error: itemsError } = useGetItem();
  const { handleGetSalesorder, data: salesOrdersData, loading: salesOrdersLoading, error: salesOrdersError } = useGetAllSalesOrder();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedSearchItem, setSelectedSearchItem] = useState(null);
  const searchRef = useRef(null);
  
  // Outbound specific state
  const [outboundItems, setOutboundItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isBulkSelect, setIsBulkSelect] = useState(false);
  const [outboundNote, setOutboundNote] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [itemToCancel, setItemToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvedItems, setApprovedItems] = useState(new Set());
  const [approvalNote, setApprovalNote] = useState("");

  // Function to parse quantity from API response
  const parseQuantity = (value) => {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Handle empty string
      if (value.trim() === '') return 0;
      const parsed = parseInt(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Function to parse amount from API response
  const parseAmount = (value) => {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Handle empty string
      if (value.trim() === '') return 0;
      // Remove currency symbols and commas
      const cleaned = value.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Function to find item details from items API by itemId
  const findItemDetails = (itemId) => {
    if (!itemsData || !Array.isArray(itemsData)) return null;
    return itemsData.find(i => i._id === itemId);
  };

  // Transform sales order items to outbound items format
  const transformSalesOrderItems = () => {
    if (!salesOrdersData?.salesOrders) return [];
    
    const allOutboundItems = [];
    
    salesOrdersData.salesOrders.forEach(salesOrder => {
      if (salesOrder.items && Array.isArray(salesOrder.items)) {
        salesOrder.items.forEach(orderItem => {
          const inventoryItem = findItemDetails(orderItem.itemId);
          
          // Parse quantities
          const orderedQuantity = parseQuantity(orderItem.quantity);
          
          // Parse available quantity - if empty, return 0
          let availableQuantity = 0;
          if (inventoryItem) {
            availableQuantity = parseQuantity(inventoryItem.quantity);
          }
          
          // Initial outbound quantity should be ordered quantity
          const initialOutboundQuantity = orderedQuantity > 0 ? orderedQuantity : 1;
          
          // Parse prices and discount
          const rate = parseAmount(orderItem.rate) || 0;
          const discount = parseAmount(orderItem.discount) || 0;
          
          // Calculate actual selling price after discount
          // Based on the example: Qty: 4 × AED 5,263.00, Discount: 123, Total: AED 20,929.00
          // This suggests discount is per unit, not total
          const sellingPricePerUnit = rate;
          const totalDiscount = discount; // This appears to be total discount, not per unit
          
          // Calculate final unit price after discount
          const finalUnitPrice = rate - (discount / orderedQuantity);
          
          // Use item name from inventory or details from sales order
          const itemName = orderItem.details || inventoryItem?.name || `Item ${orderItem.itemId}`;
          const itemCode = inventoryItem?.item_code || orderItem.itemId;
          
          allOutboundItems.push({
            _id: orderItem._id || orderItem.itemId,
            itemId: orderItem.itemId,
            name: itemName,
            item_code: itemCode,
            sku: "",
            type: "Product",
            unit: orderItem.unit || inventoryItem?.Unit || "Piece",
            description: orderItem.details || "",
            rate: rate, // Original rate before discount
            discount: discount, // Total discount
            selling_price: finalUnitPrice.toFixed(2), // Price per unit after discount
            quantity: availableQuantity,
            availableQuantity: availableQuantity,
            brand: inventoryItem?.brand || "",
            image: "https://via.placeholder.com/40",
            outboundQuantity: initialOutboundQuantity, // Set to ordered quantity
            maxQuantity: availableQuantity, // Available stock (could be 0)
            orderedQuantity: orderedQuantity,
            status: "pending",
            salesOrderNumber: salesOrder.orderNumber,
            salesOrderId: salesOrder.id
          });
        });
      }
    });
    
    console.log("Transformed outbound items:", allOutboundItems);
    return allOutboundItems;
  };

  // Get all items - combine from both sources
  const getAllItems = () => {
    const salesOrderItems = transformSalesOrderItems();
    
    // If we have sales order items, use them
    if (salesOrderItems.length > 0) {
      return salesOrderItems;
    }
    
    // Otherwise use the items from items API (fallback)
    if (itemsData && Array.isArray(itemsData)) {
      return itemsData.map(item => ({
        _id: item._id,
        itemId: item._id,
        name: item.name || "Unnamed Item",
        item_code: item.item_code || item._id,
        sku: "",
        type: "Product",
        unit: item.Unit || "Piece",
        description: "",
        rate: parseAmount(item.selling_price) || 0,
        discount: 0,
        selling_price: item.selling_price || "0.00",
        quantity: parseQuantity(item.quantity),
        availableQuantity: parseQuantity(item.quantity),
        brand: item.brand || "",
        image: "https://via.placeholder.com/40",
        outboundQuantity: 1,
        maxQuantity: parseQuantity(item.quantity),
        orderedQuantity: 1,
        status: "pending"
      }));
    }
    
    return [];
  };

  useEffect(() => {
    // Fetch both data sources
    handleGetItem();
    handleGetSalesorder();
  }, []);

  // Update outbound items when data is loaded
  useEffect(() => {
    const allItems = getAllItems();
    
    if (allItems.length > 0) {
      // Select all items by default
      const initialSelected = new Set(allItems.map(item => item._id));
      setSelectedItems(initialSelected);
      
      // Initialize outbound items
      const initializedItems = allItems.map(item => ({
        ...item,
        isSelected: initialSelected.has(item._id),
        status: "pending"
      }));
      setOutboundItems(initializedItems);
      
      console.log("Initialized outbound items:", initializedItems);
    }
  }, [itemsData, salesOrdersData]);

  // Search filter
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredItems([]);
      setShowDropdown(false);
    } else {
      const filtered = outboundItems.filter(item => 
        (item.item_code && item.item_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.salesOrderNumber && item.salesOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredItems(filtered);
      setShowDropdown(true);
    }
  }, [searchTerm, outboundItems]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toggle item selection
  const toggleItemSelection = (itemId) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    
    // Update outbound items
    setOutboundItems(prev => prev.map(item => ({
      ...item,
      isSelected: newSelected.has(item._id)
    })));
  };

  // Select all items
  const selectAllItems = () => {
    const allItemIds = new Set(outboundItems.map(item => item._id));
    setSelectedItems(allItemIds);
    setOutboundItems(prev => prev.map(item => ({
      ...item,
      isSelected: true
    })));
    setIsBulkSelect(true);
  };

  // Deselect all items
  const deselectAllItems = () => {
    setSelectedItems(new Set());
    setOutboundItems(prev => prev.map(item => ({
      ...item,
      isSelected: false
    })));
    setIsBulkSelect(false);
  };

  // Update outbound quantity
  const updateQuantity = (itemId, newQuantity) => {
    const item = outboundItems.find(i => i._id === itemId);
    if (!item) return;
    
    // Ensure newQuantity is a number
    const numericQuantity = parseInt(newQuantity) || 1;
    
    // Max cannot exceed ordered quantity
    const maxQty = Math.min(item.orderedQuantity, item.availableQuantity);
    
    // Ensure quantity is between 1 and max (if max > 0, otherwise max is ordered quantity)
    const effectiveMax = maxQty > 0 ? maxQty : item.orderedQuantity;
    const quantity = Math.max(1, Math.min(numericQuantity, effectiveMax));
    
    setOutboundItems(prev => prev.map(item => 
      item._id === itemId ? { ...item, outboundQuantity: quantity } : item
    ));
  };

  // Handle outbound save
  const handleSaveOutbound = () => {
    const selectedOutboundItems = outboundItems
      .filter(item => selectedItems.has(item._id))
      .map(item => ({
        itemId: item._id,
        name: item.name,
        itemCode: item.item_code,
        quantity: item.outboundQuantity,
        orderedQuantity: item.orderedQuantity,
        availableQuantity: item.availableQuantity,
        unit: item.unit,
        rate: item.rate,
        discount: item.discount,
        price: item.selling_price, // This is the price per unit after discount
        status: requiresApproval ? "pending_approval" : "approved",
        salesOrderNumber: item.salesOrderNumber,
        salesOrderId: item.salesOrderId
      }));

    console.log("Saving outbound items:", selectedOutboundItems);
    
    // Calculate totals
    const totalItems = selectedOutboundItems.length;
    const totalQuantity = selectedOutboundItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = selectedOutboundItems.reduce((sum, item) => 
      sum + (item.quantity * parseFloat(item.price || 0)), 0);
    const totalDiscount = selectedOutboundItems.reduce((sum, item) => 
      sum + parseFloat(item.discount || 0), 0);
    
    alert(`Outbound saved for ${totalItems} items (Total Qty: ${totalQuantity}, Value: AED ${totalValue.toFixed(2)}, Discount: AED ${totalDiscount.toFixed(2)})${requiresApproval ? ' (Pending Approval)' : ''}`);
    
    // In real app, you would make API call here
    // navigate("/outbound/history");
  };

  // Handle cancellation
  const handleCancelRequest = (itemId) => {
    setItemToCancel(itemId);
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    if (!cancelReason.trim()) {
      alert("Please provide a cancellation reason");
      return;
    }
    
    // Update item status to cancelled
    setOutboundItems(prev => prev.map(item => 
      item._id === itemToCancel ? { 
        ...item, 
        status: "cancelled",
        cancelReason,
        requiresApproval: true 
      } : item
    ));
    
    // Remove from selected items
    const newSelected = new Set(selectedItems);
    newSelected.delete(itemToCancel);
    setSelectedItems(newSelected);
    
    setShowCancelModal(false);
    setCancelReason("");
    setItemToCancel(null);
    alert("Cancellation request submitted for approval");
  };

  // Handle approval
  const handleApproveItem = (itemId) => {
    const newApproved = new Set(approvedItems);
    newApproved.add(itemId);
    setApprovedItems(newApproved);
    
    setOutboundItems(prev => prev.map(item => 
      item._id === itemId ? { ...item, status: "approved" } : item
    ));
  };

  const handleRejectItem = (itemId) => {
    setOutboundItems(prev => prev.map(item => 
      item._id === itemId ? { ...item, status: "rejected" } : item
    ));
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      pending: { color: "bg-yellow-100 text-yellow-800", text: "Pending" },
      approved: { color: "bg-green-100 text-green-800", text: "Approved" },
      rejected: { color: "bg-red-100 text-red-800", text: "Rejected" },
      cancelled: { color: "bg-gray-100 text-gray-800", text: "Cancelled" },
      pending_approval: { color: "bg-orange-100 text-orange-800", text: "Pending Approval" }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.text}
      </span>
    );
  };

  // Search handlers
  const handleSearchChange = (e) => setSearchTerm(e.target.value);
  
  const clearSearch = () => {
    setSearchTerm('');
    setSelectedSearchItem(null);
    setShowDropdown(false);
  };
  
  const toggleDropdown = () => {
    if (searchTerm.trim()) setShowDropdown(!showDropdown);
  };
  
  const handleSelectItemFromDropdown = (item) => {
    setSelectedSearchItem(item);
    setSearchTerm(`${item.item_code} - ${item.name}`);
    setShowDropdown(false);
  };

  // Drawer handlers
  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
    setActiveTab('overview');
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedItem(null);
  };

  // Combine loading and error states
  const loading = itemsLoading || salesOrdersLoading;
  const error = itemsError || salesOrdersError;

  // Debug: Log current state
  useEffect(() => {
    if (outboundItems.length > 0) {
      console.log("Current outbound items:", outboundItems.map(item => ({
        name: item.name,
        orderedQuantity: item.orderedQuantity,
        outboundQuantity: item.outboundQuantity,
        availableQuantity: item.availableQuantity,
        maxQuantity: item.maxQuantity,
        rate: item.rate,
        discount: item.discount,
        selling_price: item.selling_price
      })));
    }
  }, [outboundItems]);

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
        <h3 className="text-lg font-medium text-gray-700">Preparing Outbound Items</h3>
        <p className="text-gray-500 mt-2">Fetching items and sales orders...</p>
        
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
        <h3 className="text-lg font-medium text-gray-700">Error Loading Data</h3>
        <p className="text-gray-500 mt-2">{error}</p>
        <button 
          onClick={() => {
            handleGetItem();
            handleGetSalesorder();
          }}
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
          <h2 className="text-lg font-semibold">Outbound Items</h2>
          <button className="text-gray-500 hover:text-gray-700">
            <FaFilter />
          </button>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search Bar */}
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                onFocus={() => searchTerm.trim() && setShowDropdown(true)}
                className="pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                placeholder="Search by item name, code, or sales order..."
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
                      key={item._id}
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
                          {item.item_code} • Available: {item.availableQuantity} • Ordered: {item.orderedQuantity}
                          {item.salesOrderNumber && ` • SO: ${item.salesOrderNumber}`}
                        </div>
                      </div>
                    </div>
                  ))}
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
        </div>
      </div>

      {/* Outbound Controls */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedItems.size === outboundItems.length && outboundItems.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    selectAllItems();
                  } else {
                    deselectAllItems();
                  }
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">
                {selectedItems.size} of {outboundItems.length} items selected
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">Requires Approval</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setRequiresApproval(!requiresApproval)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
            >
              {requiresApproval ? "Disable Approval" : "Enable Approval"}
            </button>
            <button
              onClick={handleSaveOutbound}
              disabled={selectedItems.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <FaShippingFast />
              <span>Save Outbound ({selectedItems.size})</span>
            </button>
          </div>
        </div>

        {/* Outbound Note */}
        <div className="mt-4">
          <textarea
            value={outboundNote}
            onChange={(e) => setOutboundNote(e.target.value)}
            placeholder="Add notes for this outbound (optional)"
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            rows="2"
          />
        </div>
      </div>

      {/* Outbound Items Table */}
      <div className="border border-gray-200 rounded-md overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-8">
                <input
                  type="checkbox"
                  checked={selectedItems.size === outboundItems.length && outboundItems.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      selectAllItems();
                    } else {
                      deselectAllItems();
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium">Item</th>
              <th className="px-4 py-3 text-left font-medium">Available Qty</th>
              <th className="px-4 py-3 text-left font-medium">Ordered Qty</th>
              <th className="px-4 py-3 text-left font-medium">Outbound Qty</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Sales Order</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {outboundItems.length > 0 ? (
              outboundItems.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item._id)}
                      onChange={() => toggleItemSelection(item._id)}
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
                      <div>
                        <span 
                          className="text-blue-600 hover:underline font-medium cursor-pointer"
                          onClick={() => handleItemClick(item)}
                        >
                          {item.name}
                        </span>
                        <div className="text-xs text-gray-500">{item.item_code}</div>
                        {item.description && (
                          <div className="text-xs text-gray-400 truncate max-w-xs">{item.description}</div>
                        )}
                        {item.discount > 0 && (
                          <div className="text-xs text-red-500 mt-1">
                            Discount: AED {parseFloat(item.discount).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${item.availableQuantity === 0 ? 'text-red-600' : 'text-gray-800'}`}>
                      {item.availableQuantity}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{item.orderedQuantity}</span>
                    <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        max={Math.min(item.orderedQuantity, item.availableQuantity > 0 ? item.availableQuantity : item.orderedQuantity)}
                        value={item.outboundQuantity}
                        onChange={(e) => updateQuantity(item._id, parseInt(e.target.value) || 1)}
                        className="w-20 p-1 border border-gray-300 rounded text-center"
                      />
                      <span className="text-xs text-gray-500">
                        max {Math.min(item.orderedQuantity, item.availableQuantity > 0 ? item.availableQuantity : item.orderedQuantity)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3">
                    {item.salesOrderNumber ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {item.salesOrderNumber}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      {item.status === "pending_approval" && requiresApproval && (
                        <>
                          <button
                            onClick={() => handleApproveItem(item._id)}
                            className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectItem(item._id)}
                            className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleCancelRequest(item._id)}
                        disabled={item.status === "cancelled" || item.status === "approved"}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end">
                      {item.rate > parseFloat(item.selling_price) ? (
                        <>
                          <span className="text-xs text-gray-500 line-through">
                            AED {parseFloat(item.rate).toFixed(2)}
                          </span>
                          <span className="font-medium text-gray-800">
                            AED {parseFloat(item.selling_price).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="font-medium text-gray-800">
                          AED {parseFloat(item.selling_price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <FaBoxOpen className="text-gray-400 text-3xl mb-2" />
                    <p className="text-lg">No outbound items found</p>
                    <p className="text-sm mt-1">No sales order items or inventory items available for outbound</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {selectedItems.size > 0 && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-medium mb-3">Outbound Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded border">
              <div className="text-sm text-gray-500">Total Items</div>
              <div className="text-lg font-bold">{selectedItems.size}</div>
            </div>
            <div className="bg-white p-3 rounded border">
              <div className="text-sm text-gray-500">Total Outbound Qty</div>
              <div className="text-lg font-bold">
                {outboundItems
                  .filter(item => selectedItems.has(item._id))
                  .reduce((sum, item) => sum + (item.outboundQuantity || 0), 0)}
                <span className="text-sm text-gray-500 ml-1">
                  / {outboundItems
                    .filter(item => selectedItems.has(item._id))
                    .reduce((sum, item) => sum + (item.orderedQuantity || 0), 0)} ordered
                </span>
              </div>
            </div>
            <div className="bg-white p-3 rounded border">
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="text-lg font-bold">
                AED {outboundItems
                  .filter(item => selectedItems.has(item._id))
                  .reduce((sum, item) => 
                    sum + ((item.outboundQuantity || 0) * parseFloat(item.selling_price || 0)), 0)
                  .toFixed(2)}
              </div>
            </div>
            <div className="bg-white p-3 rounded border">
              <div className="text-sm text-gray-500">Total Discount</div>
              <div className="text-lg font-bold text-red-600">
                AED {outboundItems
                  .filter(item => selectedItems.has(item._id))
                  .reduce((sum, item) => sum + parseFloat(item.discount || 0), 0)
                  .toFixed(2)}
              </div>
            </div>
          </div>
          
          {/* Additional info */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <strong>Note:</strong> Outbound quantity is initially set to ordered quantity. 
              If available quantity is 0, it will be shown in red. You can adjust outbound quantity down if needed.
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Cancel Outbound Item</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">Reason for Cancellation</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md"
                rows="3"
                placeholder="Please provide reason for cancellation..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Submit for Approval
              </button>
            </div>
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
        
        <div className="absolute right-0 top-0 h-full w-full sm:w-96 md:w-128 bg-white shadow-xl flex flex-col">
          <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{selectedItem?.name || "Item Details"}</h3>
              <p className="text-sm text-gray-500 mt-1">{selectedItem?.item_code}</p>
            </div>
            <button 
              onClick={closeDrawer}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <FaTimes className="text-gray-500 text-lg" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto p-6">
              {selectedItem && (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-800 mb-3">Item Information</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Item Name</div>
                          <div className="font-medium text-gray-800 mt-1">{selectedItem.name}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Item Code</div>
                          <div className="font-medium text-gray-800 mt-1">{selectedItem.item_code}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Available Quantity</div>
                          <div className={`font-medium ${selectedItem.availableQuantity === 0 ? 'text-red-600' : 'text-gray-800'} mt-1`}>
                            {selectedItem.availableQuantity} {selectedItem.unit}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Ordered Quantity</div>
                          <div className="font-medium text-gray-800 mt-1">{selectedItem.orderedQuantity} {selectedItem.unit}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {selectedItem.salesOrderNumber && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <h4 className="font-medium text-gray-800 mb-3">Sales Order Information</h4>
                      <div className="space-y-2">
                        <div>
                          <div className="text-sm text-gray-500">Sales Order Number</div>
                          <div className="font-medium text-gray-800 mt-1">{selectedItem.salesOrderNumber}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-800 mb-3">Outbound Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Outbound Quantity</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{selectedItem.outboundQuantity}</span>
                          <span className="text-sm text-gray-500">of {selectedItem.orderedQuantity} ordered</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Original Rate</span>
                        <span className="font-medium">AED {parseFloat(selectedItem.rate || 0).toFixed(2)}</span>
                      </div>
                      {selectedItem.discount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Discount</span>
                          <span className="font-medium text-red-600">- AED {parseFloat(selectedItem.discount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Selling Price (per unit)</span>
                        <span className="font-medium">AED {parseFloat(selectedItem.selling_price || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-medium text-gray-800">Total Value</span>
                        <span className="font-bold text-gray-800">
                          AED {((selectedItem.outboundQuantity || 1) * parseFloat(selectedItem.selling_price || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}