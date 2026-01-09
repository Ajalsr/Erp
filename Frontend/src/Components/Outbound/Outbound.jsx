import { useState, useEffect, useRef } from "react";
import { 
  FaThList, FaThLarge, FaPlus, FaEllipsisV, FaFilter, 
  FaTimes, FaSearch, FaChevronDown, FaChevronUp, FaCheck,
  FaEdit, FaTrash, FaClipboardCheck, FaBoxOpen, FaShippingFast
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import useGetItem from '../../helper/useGetItem';

export default function Outbound() {
  const { handleGetItem, data, loading, error } = useGetItem();
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

  // Get items from sale order or API
  const allItems = Array.isArray(data) && data.length > 0 ? data : [
    {
      _id: "688b09cb4c5900a2c0bf16eb",
      name: "Storage Cabinet",
      item_code: "ITM001",
      sku: "Item 37 sku",
      type: "Product",
      unit: "Piece",
      description: "A versatile storage cabinet with adjustable shelves.",
      selling_price: "4610.00",
      quantity: 50,
      availableQuantity: 50,
      brand: "FurnitureCo",
      image: "https://via.placeholder.com/40",
      outboundQuantity: 5,
      maxQuantity: 50,
      status: "pending"
    },
    {
      _id: "688b09cb4c5900a2c0bf16ec",
      name: "Area Rug",
      item_code: "ITM002",
      sku: "Item 38 sku",
      type: "Product",
      unit: "Piece",
      description: "A soft, high-quality area rug to add warmth to any room.",
      selling_price: "2990.00",
      quantity: 30,
      availableQuantity: 30,
      brand: "HomeDecor",
      image: "https://via.placeholder.com/40",
      outboundQuantity: 3,
      maxQuantity: 30,
      status: "pending"
    },
    {
      _id: "688b09cb4c5900a2c0bf16ed",
      name: "Office Chair",
      item_code: "ITM003",
      sku: "Item 39 sku",
      type: "Product",
      unit: "Piece",
      description: "Ergonomic office chair with lumbar support",
      selling_price: "1890.00",
      quantity: 25,
      availableQuantity: 25,
      brand: "OfficePro",
      image: "https://via.placeholder.com/40",
      outboundQuantity: 2,
      maxQuantity: 25,
      status: "pending"
    }
  ];

  // Initialize outbound items from sale order or all items
  useEffect(() => {
    // In real app, you would get selected items from sale order
    // For demo, we'll mark first 2 items as selected
    const initialSelected = new Set([allItems[0]?._id, allItems[1]?._id,  allItems[2]?._id]);
    setSelectedItems(initialSelected);
    
    // Initialize outbound items with default quantities
    const initializedItems = allItems.map(item => ({
      ...item,
      outboundQuantity: item.outboundQuantity || 1,
      isSelected: initialSelected.has(item._id),
      status: "pending"
    }));
    setOutboundItems(initializedItems);
  }, [data]);

  // Search filter
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredItems([]);
      setShowDropdown(false);
    } else {
      const filtered = outboundItems.filter(item => 
        (item.item_code && item.item_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
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
    
    const maxQty = item.maxQuantity || item.availableQuantity || item.quantity;
    const quantity = Math.min(Math.max(1, newQuantity), maxQty);
    
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
        maxQuantity: item.maxQuantity || item.quantity,
        unit: item.unit,
        price: item.selling_price,
        status: requiresApproval ? "pending_approval" : "approved"
      }));

    console.log("Saving outbound items:", selectedOutboundItems);
    
    // Show success message
    alert(`Outbound saved for ${selectedOutboundItems.length} items${requiresApproval ? ' (Pending Approval)' : ''}`);
    
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

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

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
                placeholder="Search outbound items..."
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
                          {item.item_code} • Qty: {item.outboundQuantity} • {item.status}
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
              <th className="px-4 py-3 text-left font-medium">Outbound Qty</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
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
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{item.availableQuantity || item.quantity}</span>
                    <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        max={item.maxQuantity || item.availableQuantity || item.quantity}
                        value={item.outboundQuantity}
                        onChange={(e) => updateQuantity(item._id, parseInt(e.target.value) || 1)}
                        className="w-20 p-1 border border-gray-300 rounded text-center"
                      />
                      <span className="text-xs text-gray-500">of {item.maxQuantity || item.availableQuantity || item.quantity}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
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
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    AED {parseFloat(item.selling_price || 0).toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <FaBoxOpen className="text-gray-400 text-3xl mb-2" />
                    <p className="text-lg">No outbound items</p>
                    <p className="text-sm mt-1">Add items from sale order to create outbound</p>
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
              <div className="text-sm text-gray-500">Total Quantity</div>
              <div className="text-lg font-bold">
                {outboundItems
                  .filter(item => selectedItems.has(item._id))
                  .reduce((sum, item) => sum + (item.outboundQuantity || 0), 0)}
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
              <div className="text-sm text-gray-500">Approval Status</div>
              <div className="text-lg font-bold">
                {requiresApproval ? "Required" : "Not Required"}
              </div>
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

      {/* Drawer Component (similar to Item.jsx) */}
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
          {/* Drawer content from Item.jsx */}
          {/* ... (same drawer implementation as Item.jsx) ... */}
        </div>
      </div>
    </div>
  );
}