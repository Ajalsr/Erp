import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useGetItem from '../../helper/useGetItem'; // Adjust path as needed
import { debounce } from 'lodash'; // Install lodash if not installed

const Newsalesorders = () => {
  const [items, setItems] = useState([{ 
    id: 1, 
    itemId: '', // Store the actual item ID
    details: '', 
    sku: '',
    quantity: 1, 
    rate: '', 
    discount: '', 
    amount: '', 
    unit: '' // Store unit from item data
  }]);
  
  const [showItemDropdown, setShowItemDropdown] = useState(null); // Track which row is open
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [salesType, setSalesType] = useState('SO');
  const [lpoDate, setLpoDate] = useState('');
  const [lpoValue, setLpoValue] = useState('');
  const [vatAmount, setVatAmount] = useState(0);
  
  const { handleGetItem, data, loading } = useGetItem();
  const dropdownRef = useRef(null);
  
  const navigate = useNavigate();

  // Sample customer data
  const customers = [
    { id: 1, code: 'CUST001', name: 'ABC Corporation', type: 'Business' },
    { id: 2, code: 'CUST002', name: 'XYZ Enterprises', type: 'Business' },
    { id: 3, code: 'CUST003', name: 'John Smith', type: 'Individual' },
    { id: 4, code: 'CUST004', name: 'Global Traders', type: 'Business' },
    { id: 5, code: 'CUST005', name: 'Sarah Johnson', type: 'Individual' },
  ];

  const salesTypeOptions = [
    { value: 'SO', label: 'SO (Standard Sale Order)' },
    { value: 'MOA', label: 'MOA (Material on Approval)' },
    { value: 'MOA_COLLECT', label: 'MOA Collect (Material on Approval Collect)' },
    { value: 'FREE_DELIVERY', label: 'Free Delivery' },
  ];

  // Fetch inventory items on component mount
  useEffect(() => {
    handleGetItem();
    console.log(data, "this is data")
  }, []);

  // Filter items based on search term
  useEffect(() => {
    if (!data) return;
    
    if (!searchTerm) {
      setFilteredItems(data); // Show only 5 items initially
    } else {
      const filtered = data.filter(item => 
        item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemId?.toString().includes(searchTerm) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5); // Limit to 5 items for dropdown
      setFilteredItems(filtered);
    }
  }, [searchTerm, data]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowItemDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addNewRow = () => {
    setItems([...items, { 
      id: items.length + 1, 
      itemId: '',
      details: '', 
      sku: '',
      quantity: 1, // Default quantity to 1
      rate: '', 
      discount: '', 
      amount: '', 
      unit: ''
    }]);
  };

  const handleItemSelect = (index, selectedItem) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      itemId: selectedItem.itemId,
      details: selectedItem.name || 'No name',
      sku: selectedItem.sku || 'No SKU',
      rate: selectedItem.selling_price || selectedItem.price || 0,
      unit: selectedItem.Unit || 'pcs',
      quantity: 1,
      amount: (1 * (selectedItem.sellingPrice || selectedItem.price || 0))
    };
    setItems(updatedItems);
    setShowItemDropdown(null);
    setSearchTerm('');
  };

  const handleQuantityChange = (index, value) => {
    const quantity = parseFloat(value) || 1;
    const updatedItems = [...items];
    updatedItems[index].quantity = quantity;
    
    if (updatedItems[index].rate) {
      updatedItems[index].amount = (quantity * parseFloat(updatedItems[index].rate)).toFixed(2);
    }
    
    setItems(updatedItems);
  };

  const handleRateChange = (index, value) => {
    const rate = parseFloat(value) || 0;
    const updatedItems = [...items];
    updatedItems[index].rate = rate;
    
    if (updatedItems[index].quantity) {
      updatedItems[index].amount = (updatedItems[index].quantity * rate).toFixed(2);
    }
    
    setItems(updatedItems);
  };

  const calculateVAT = (value) => {
    const numericValue = parseFloat(value) || 0;
    const vat = numericValue * 0.05;
    setVatAmount(vat);
    return vat;
  };

  const handleLpoValueChange = (e) => {
    const value = e.target.value;
    setLpoValue(value);
    calculateVAT(value);
  };

  const handleCancel = () => {
    navigate('/sales/salesorders')
    console.log('Form cancelled');
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      return total + (parseFloat(item.amount) || 0);
    }, 0).toFixed(3);
  };

  const debouncedSearch = useCallback(
    debounce((term) => {
      setSearchTerm(term);
    }, 300),
    []
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 mb-10">
        <div className="px-8 py-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">New Sales Order</h1>
        </div>

        <div className="px-8 py-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search by name or type..."
                />
                {customerSearch && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {customers
                      .filter(customer => 
                        customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                        customer.code.toLowerCase().includes(customerSearch.toLowerCase())
                      )
                      .map(customer => (
                        <div 
                          key={customer.id}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => setCustomerSearch(`${customer.code} - ${customer.name}`)}
                        >
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-gray-500">
                            Code: {customer.code} | Type: {customer.type}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sales Order#<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sales Type<span className="text-red-500">*</span>
              </label>
              <select
                value={salesType}
                onChange={(e) => setSalesType(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                {salesTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sales Order Date<span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LPO Number<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter LPO Number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LPO Date
              </label>
              <input
                type="date"
                value={lpoDate}
                onChange={(e) => setLpoDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div className="col-span-2">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    LPO VALUE (AED)<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={lpoValue}
                    onChange={handleLpoValueChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter LPO Value"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    VAT 5% (AED)
                  </label>
                  <input
                    type="text"
                    value={vatAmount.toFixed(2)}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Shipment Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Terms<span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled selected>Select or type to add</option>
                <option value="due_on_receipt">Due on Receipt</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_60">Net 60</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Salesperson<span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled selected>Select or Add Salesperson</option>
                <option value="john_doe">John Doe</option>
                <option value="jane_smith">Jane Smith</option>
                <option value="mike_johnson">Mike Johnson</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Code<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Customer code will auto-fill after selecting customer"
                readOnly
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Item Table</h2>

          <div className="grid grid-cols-12 gap-4 bg-gray-100 px-4 py-3 rounded-t-md border border-gray-300 border-b-0 text-sm font-medium text-gray-700">
            <div className="col-span-5">ITEM DETAILS</div>
            <div className="col-span-2">QUANTITY</div>
            <div className="col-span-2">RATE</div>
            <div className="col-span-2">DISCOUNT</div>
            <div className="col-span-1">AMOUNT</div>
          </div>

          {items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 border border-gray-300 border-b-0 last:border-b relative">
              <div className="col-span-5" ref={index === showItemDropdown ? dropdownRef : null}>
                <input 
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type or click to select an item."
                  value={item.details}
                  onChange={(e) => {
                    const updatedItems = [...items];
                    updatedItems[index].details = e.target.value;
                    setItems(updatedItems);
                    debouncedSearch(e.target.value);
                  }}
                  onFocus={() => {
                    setShowItemDropdown(index);
                    if (!item.details) {
                      setSearchTerm('');
                    }
                  }}
                />
                
                {showItemDropdown === index && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto top-full left-0">
                    {loading ? (
                      <div className="px-3 py-2 text-gray-500">Loading items...</div>
                    ) : filteredItems.length === 0 ? (
                      <div className="px-3 py-2 text-gray-500">
                        {searchTerm ? 'No items found' : 'Start typing to search items'}
                      </div>
                    ) : (
                      <>
                        {filteredItems.map(inventoryItem => (
                          <div
                            key={inventoryItem.itemId}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleItemSelect(index, inventoryItem)}
                          >
                            <div className="font-medium text-gray-800">{inventoryItem.name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              SKU: {inventoryItem.sku || 'N/A'} | Rate: AED{inventoryItem.selling_price || inventoryItem.price || 0}
                            </div>
                          </div>
                        ))}
                        
                       
                        <div
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0 text-blue-600"
                          onClick={() => {
                            console.log('Add new item clicked');
                            setShowItemDropdown(null);
                          }}
                        >
                          <span className="font-medium">+ Add New Item</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
               
                {item.sku && (
                  <div className="text-xs text-gray-500 mt-1">
                    SKU: {item.sku} | Unit: {item.unit}
                  </div>
                )}
              </div>
              
             
              <div className="col-span-2">
                <div className="flex">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                    className="w-full border border-gray-300 rounded-l px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  {item.unit && (
                    <div className="border border-gray-300 border-l-0 rounded-r px-3 py-2 bg-gray-50 text-gray-500 text-sm h-[42px] flex items-center justify-center min-w-[60px]">
                      {item.unit}
                    </div>
                  )}
                </div>
              </div>
              
              {/* RATE */}
              <div className="col-span-2">
                <div className="flex items-center">
                  <span className="mr-1 text-gray-500">AED</span>
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => handleRateChange(index, e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              
              {/* DISCOUNT */}
              <div className="col-span-2">
                <div className="flex items-center">
                  <input
                    type="number"
                    value={item.discount}
                    onChange={(e) => {
                      const updatedItems = [...items];
                      updatedItems[index].discount = e.target.value;
                      setItems(updatedItems);
                    }}
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0%"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              
              {/* AMOUNT */}
              <div className="col-span-1">
                <div className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-700 text-sm h-[42px] flex items-center justify-center">
                  AED {item.amount || '0.00'}
                </div>
              </div>
            </div>
          ))}

          {/* Add New Row Button */}
          <div className="mt-4">
            <button 
              onClick={addNewRow}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>+</span> Add New Row
            </button>
          </div>
        </div>

        {/* Totals Section */}
        <div className="px-8 py-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-8">
            {/* Left Side - Totals */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Sub Total</span>
                <span className="font-medium">AED {calculateTotal()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Shipping Charges</span>
                <span className="font-medium">0.000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Adjustment</span>
                <span className="font-medium">0.000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Round Off</span>
                <span className="font-medium">0.000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">VAT 5%</span>
                <span className="font-medium">{vatAmount.toFixed(3)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-lg font-semibold">Total (AED)</span>
                <span className="text-lg font-semibold">
                  {(parseFloat(calculateTotal()) + vatAmount).toFixed(3)}
                </span>
              </div>
            </div>

            {/* Right Side - Notes & Terms */}
            <div className="space-y-6">
              {/* Customer Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Notes
                </label>
                <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500 h-20">
                  Enter any notes to be displayed in your transaction
                </div>
              </div>

              {/* Terms & Conditions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Terms & Conditions
                </label>
                <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-500 h-20">
                  Enter the terms and conditions of your business to be displayed in your transaction
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="px-8 py-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Attach File(s) to Sales Order
          </h3>
          <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
            <div className="text-gray-500 mb-2">Upload File</div>
            <div className="text-xs text-gray-400">
              You can upload a maximum of 10 files, 5MB each
            </div>
          </div>
        </div>

        {/* Additional Fields Note */}
        <div className="px-8 py-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Additional Fields: Add custom fields to your sales orders by going to Settings → Sales → Sales orders → Field Customization.
          </div>
        </div>

        
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-4xl ml-auto flex space-x-3 justify-end">
          <button className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100">
            Save as Draft
          </button>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Save and Send
          </button>
          <button className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer" onClick ={() => handleCancel()}>
            Cancel
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default Newsalesorders;