import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useGetItem from '../../helper/useGetItem';
import useGetCustomers from '../../helper/useGetCustomers';
import useAddSalesOrder from '../../helper/useAddSalesOrder'; // Import the new hook
import { debounce } from 'lodash';

const Newsalesorders = () => {
  const [items, setItems] = useState([{ 
    id: 1, 
    itemId: '',
    details: '', 
    sku: '',
    quantity: 1, 
    rate: '', 
    discount: '', 
    amount: '', 
    unit: ''
  }]);
  
  const [showItemDropdown, setShowItemDropdown] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  
  const [salesType, setSalesType] = useState('SO');
  const [orderDate, setOrderDate] = useState('');
  const [lpoDate, setLpoDate] = useState('');
  const [lpoNumber, setLpoNumber] = useState('');
  const [lpoValue, setLpoValue] = useState('');
  const [expectedShipmentDate, setExpectedShipmentDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('due_on_receipt');
  const [salesperson, setSalesperson] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  
  // New state variables for shipping and adjustment
  const [shippingCharges, setShippingCharges] = useState('0');
  const [adjustment, setAdjustment] = useState('0');
  
  // New state variables for customer notes and terms
  const [customerNotes, setCustomerNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  
  const { handleGetItem, data: inventoryData, loading: inventoryLoading } = useGetItem();
  const { handleGetCustomers, data: customersData, loading: customersLoading } = useGetCustomers();
  const { handleAddSalesOrder } = useAddSalesOrder(); // Initialize the hook
  
  const dropdownRef = useRef(null);
  const customerDropdownRef = useRef(null);
  
  const navigate = useNavigate();

  const salesTypeOptions = [
    { value: 'SO', label: 'SO (Standard Sale Order)' },
    { value: 'MOA', label: 'MOA (Material on Approval)' },
    { value: 'MOA_COLLECT', label: 'MOA Collect (Material on Approval Collect)' },
    { value: 'FREE_DELIVERY', label: 'Free Delivery' },
  ];

  const paymentTermsOptions = [
    { value: 'due_on_receipt', label: 'Due on Receipt' },
    { value: 'net_15', label: 'Net 15' },
    { value: 'net_30', label: 'Net 30' },
    { value: 'net_60', label: 'Net 60' },
  ];

  const salespersonOptions = [
    { value: 'john_doe', label: 'John Doe' },
    { value: 'jane_smith', label: 'Jane Smith' },
    { value: 'mike_johnson', label: 'Mike Johnson' },
  ];

  // Calculate amount for an item
  const calculateItemAmount = (quantity, rate, discount = 0) => {
    const qty = parseFloat(quantity) || 0;
    const rte = parseFloat(rate) || 0;
    const disc = parseFloat(discount) || 0;
    
    // If discount is percentage (contains %)
    if (discount.toString().includes('%')) {
      const discPercent = parseFloat(discount) || 0;
      const amount = qty * rte;
      const discountAmount = amount * (discPercent / 100);
      return (amount - discountAmount).toFixed(2);
    } else {
      // Discount is fixed amount
      const amount = qty * rte;
      return (amount - disc).toFixed(2);
    }
  };

  // Calculate Sub Total
  const calculateSubTotal = () => {
    return items.reduce((total, item) => {
      const amount = parseFloat(item.amount) || 0;
      return total + amount;
    }, 0);
  };

  // Calculate VAT 5% based on Sub Total
  const calculateVAT = () => {
    const subTotal = calculateSubTotal();
    return subTotal * 0.05;
  };

  // Calculate Total (Sub Total + VAT + Shipping + Adjustment)
  const calculateTotal = () => {
    const subTotal = calculateSubTotal();
    const vat = calculateVAT();
    const shipping = parseFloat(shippingCharges) || 0;
    const adjustmentValue = parseFloat(adjustment) || 0;
    return subTotal + vat + shipping + adjustmentValue;
  };

  // Update all calculations whenever items change
  useEffect(() => {
    // This effect will automatically update VAT and totals when items change
  }, [items]);

  useEffect(() => {
    handleGetItem();
    handleGetCustomers();
  }, []);

  useEffect(() => {
    if (!inventoryData) return;
    
    if (!searchTerm) {
      setFilteredItems(inventoryData.slice(0, 5));
    } else {
      const filtered = inventoryData.filter(item => 
        item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemId?.toString().includes(searchTerm) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5);
      setFilteredItems(filtered);
    }
  }, [searchTerm, inventoryData]);

  useEffect(() => {
    if (!customersData) return;
    
    if (!customerSearch) {
      setFilteredCustomers(customersData.slice(0, 10));
    } else {
      const filtered = customersData.filter(customer => 
        customer.customerDisplayName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        customer.companyName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        customer.customerEmail?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        customer.customerPhone?.includes(customerSearch) ||
        customer.customerCode?.toLowerCase().includes(customerSearch.toLowerCase())
      ).slice(0, 10);
      setFilteredCustomers(filtered);
    }
  }, [customerSearch, customersData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowItemDropdown(null);
      }
      
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(`${customer.customerCode} - ${customer.customerDisplayName}${customer.companyName ? ` (${customer.companyName})` : ''}`);
    setShowCustomerDropdown(false);
  };

  const addNewRow = () => {
    setItems([...items, { 
      id: items.length + 1, 
      itemId: '',
      details: '', 
      sku: '',
      quantity: 1,
      rate: '', 
      discount: '', 
      amount: '', 
      unit: ''
    }]);
  };

  const handleRemoveItem = (indexToRemove) => {
    if (items.length <= 1) {
      // Don't remove the last row
      return;
    }
    
    const updatedItems = items.filter((_, index) => index !== indexToRemove);
    setItems(updatedItems);
    
    // If the removed item had the dropdown open, close it
    if (showItemDropdown === indexToRemove) {
      setShowItemDropdown(null);
    }
  };

  const handleItemSelect = (index, selectedItem) => {
    const updatedItems = [...items];
    const rate = selectedItem.selling_price || selectedItem.price || 0;
    const quantity = 1;
    const amount = calculateItemAmount(quantity, rate, updatedItems[index].discount);
    
    updatedItems[index] = {
      ...updatedItems[index],
      itemId: selectedItem._id || selectedItem.itemId,
      details: selectedItem.name || selectedItem.itemName || 'No name',
      sku: selectedItem.sku || 'No SKU',
      rate: rate,
      unit: selectedItem.unit || selectedItem.Unit || 'pcs',
      quantity: quantity,
      amount: amount
    };
    
    setItems(updatedItems);
    setShowItemDropdown(null);
    setSearchTerm('');
  };

  const handleQuantityChange = (index, value) => {
    const quantity = parseFloat(value) || 1;
    const updatedItems = [...items];
    updatedItems[index].quantity = quantity;
    
    // Recalculate amount when quantity changes
    if (updatedItems[index].rate) {
      updatedItems[index].amount = calculateItemAmount(
        quantity, 
        updatedItems[index].rate, 
        updatedItems[index].discount
      );
    }
    
    setItems(updatedItems);
  };

  const handleRateChange = (index, value) => {
    const rate = parseFloat(value) || 0;
    const updatedItems = [...items];
    updatedItems[index].rate = rate;
    
    // Recalculate amount when rate changes
    if (updatedItems[index].quantity) {
      updatedItems[index].amount = calculateItemAmount(
        updatedItems[index].quantity, 
        rate, 
        updatedItems[index].discount
      );
    }
    
    setItems(updatedItems);
  };

  const handleDiscountChange = (index, value) => {
    const updatedItems = [...items];
    updatedItems[index].discount = value;
    
    // Recalculate amount when discount changes
    if (updatedItems[index].quantity && updatedItems[index].rate) {
      updatedItems[index].amount = calculateItemAmount(
        updatedItems[index].quantity, 
        updatedItems[index].rate, 
        value
      );
    }
    
    setItems(updatedItems);
  };

  const handleLpoValueChange = (e) => {
    const value = e.target.value;
    setLpoValue(value);
  };

  const handleLpoNumberChange = (e) => {
    setLpoNumber(e.target.value);
  };

  // New handler functions for shipping and adjustment
  const handleShippingChange = (e) => {
    const value = e.target.value;
    setShippingCharges(value);
  };

  const handleAdjustmentChange = (e) => {
    const value = e.target.value;
    setAdjustment(value);
  };

  // New handler functions for customer notes and terms
  const handleCustomerNotesChange = (e) => {
    setCustomerNotes(e.target.value);
  };

  const handleTermsChange = (e) => {
    setTermsAndConditions(e.target.value);
  };

  const handleCancel = () => {
    navigate('/sales/salesorders');
  };

  // Handle Save as Draft
  const handleSaveAsDraft = async () => {
    try {
      const salesOrderData = prepareSalesOrderData('draft');
      const result = await handleAddSalesOrder(salesOrderData);
      
      if (result && result.data && result.data.id) {
        navigate(`/sales/salesorders/${result.data.id}`);
      }
    } catch (error) {
      console.error('Failed to save as draft:', error);
    }
  };

  // Handle Save and Send
  const handleSaveAndSend = async () => {
    try {
      const salesOrderData = prepareSalesOrderData('pending');
      const result = await handleAddSalesOrder(salesOrderData);
      
      if (result && result.data && result.data.id) {
        navigate(`/sales/salesorders/${result.data.id}`);
      }
    } catch (error) {
      console.error('Failed to save and send:', error);
    }
  };

  // Prepare sales order data for API
  const prepareSalesOrderData = (status) => {
    const subTotal = calculateSubTotal();
    const vat = calculateVAT();
    const shipping = parseFloat(shippingCharges) || 0;
    const adjustmentValue = parseFloat(adjustment) || 0;
    const total = subTotal + vat + shipping + adjustmentValue;

    // Prepare items for API
    const apiItems = items
      .filter(item => item.itemId && item.quantity > 0)
      .map(item => ({
        itemId: item.itemId,
        quantity: parseFloat(item.quantity) || 0,
        discount: item.discount || '0'
      }));

    if (apiItems.length === 0) {
      throw new Error('Please add at least one item to the sales order');
    }

    if (!selectedCustomer) {
      throw new Error('Please select a customer');
    }

    return {
      orderNumber: orderNumber,
      customerId: selectedCustomer._id,
      salesType: salesType,
      orderDate: orderDate ? new Date(orderDate).toISOString() : new Date().toISOString(),
      lpoNumber: lpoNumber,
      lpoDate: lpoDate ? new Date(lpoDate).toISOString() : null,
      lpoValue: parseFloat(lpoValue) || 0,
      expectedShipmentDate: expectedShipmentDate ? new Date(expectedShipmentDate).toISOString() : null,
      paymentTerms: paymentTerms,
      salesperson: salesperson,
      items: apiItems,
      shippingCharges: shipping,
      adjustment: adjustmentValue,
      customerNotes: customerNotes,
      termsAndConditions: termsAndConditions,
      status: status
    };
  };

  const debouncedSearch = useCallback(
    debounce((term) => {
      setSearchTerm(term);
    }, 300),
    []
  );

  // Set default order date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setOrderDate(today);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 mb-10">
        <div className="px-8 py-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">New Sales Order</h1>
        </div>

        <div className="px-8 py-6">
          <div className="grid grid-cols-2 gap-6">
            <div ref={customerDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  placeholder="Search customer by name, company, email, or code..."
                />
                
                <div 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                  onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                >
                  ▼
                </div>
                
                {showCustomerDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
                    {customersLoading ? (
                      <div className="px-3 py-4 text-center">
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading customers...</p>
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-gray-500">
                          {customerSearch ? 'No customers found' : 'Start typing to search customers'}
                        </p>
                        {!customerSearch && (
                          <p className="text-xs text-gray-400 mt-1">
                            Total customers: {customersData?.length || 0}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                          {filteredCustomers.length} customer(s) found
                        </div>
                        
                        {filteredCustomers.map(customer => (
                          <div
                            key={customer._id || customer.id}
                            className={`px-3 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                              selectedCustomer?._id === customer._id ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <span className="text-blue-600 text-xs font-medium">
                                    {customer.customerDisplayName?.charAt(0) || 'C'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                  <div className="font-medium text-gray-900 truncate">
                                    {customer.customerDisplayName || 'Unnamed Customer'}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="px-2 py-1 text-xs font-mono bg-blue-100 text-blue-800 rounded">
                                      {customer.customerCode || 'N/A'}
                                    </span>
                                    <span className={`px-2 py-1 text-xs rounded ${
                                      customer.status === 'active' 
                                        ? 'bg-green-100 text-green-800' 
                                        : customer.status === 'pending'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {customer.status || 'active'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                  {customer.companyName && (
                                    <div className="flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                                      </svg>
                                      <span className="truncate">{customer.companyName}</span>
                                    </div>
                                  )}
                                  
                                  {customer.customerEmail && (
                                    <div className="flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                      </svg>
                                      <span className="truncate">{customer.customerEmail}</span>
                                    </div>
                                  )}
                                  
                                  {customer.customerPhone && (
                                    <div className="flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                      </svg>
                                      <span>{customer.customerPhone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <div 
                          className="px-3 py-3 hover:bg-gray-50 cursor-pointer border-t border-gray-200 bg-gray-50"
                          onClick={() => {
                            navigate('/sales/customers/newcustomers');
                            setShowCustomerDropdown(false);
                          }}
                        >
                          <div className="flex items-center gap-2 text-blue-600 font-medium">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Add New Customer</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Create a new customer record
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {selectedCustomer && (
                <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-blue-800">
                        {selectedCustomer.customerDisplayName}
                      </div>
                      <div className="text-sm text-blue-600 mt-1">
                        {selectedCustomer.companyName && (
                          <span className="mr-3">Company: {selectedCustomer.companyName}</span>
                        )}
                        {selectedCustomer.customerEmail && (
                          <span className="mr-3">Email: {selectedCustomer.customerEmail}</span>
                        )}
                        {selectedCustomer.customerPhone && (
                          <span>Phone: {selectedCustomer.customerPhone}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch('');
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sales Order#<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Will be auto-generated"
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
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
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
                value={lpoNumber}
                onChange={handleLpoNumberChange}
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
                value={expectedShipmentDate}
                onChange={(e) => setExpectedShipmentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Terms<span className="text-red-500">*</span>
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>Select or type to add</option>
                {paymentTermsOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Salesperson<span className="text-red-500">*</span>
              </label>
              <select
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>Select or Add Salesperson</option>
                {salespersonOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Item Table</h2>

          <div className="grid grid-cols-12 gap-4 bg-gray-100 px-4 py-3 rounded-t-md border border-gray-300 border-b-0 text-sm font-medium text-gray-700">
            <div className="col-span-4">ITEM DETAILS</div>
            <div className="col-span-2">QUANTITY</div>
            <div className="col-span-2">RATE</div>
            <div className="col-span-2">DISCOUNT</div>
            <div className="col-span-1">AMOUNT</div>
          </div>

          {items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 border border-gray-300 border-b-0 last:border-b relative">
              <div className="col-span-4" ref={index === showItemDropdown ? dropdownRef : null}>
                <div>
                  <input 
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                      {inventoryLoading ? (
                        <div className="px-3 py-2 text-gray-500">Loading items...</div>
                      ) : filteredItems.length === 0 ? (
                        <div className="px-3 py-2 text-gray-500">
                          {searchTerm ? 'No items found' : 'Start typing to search items'}
                        </div>
                      ) : (
                        <>
                          {filteredItems.map(inventoryItem => (
                            <div
                              key={inventoryItem._id || inventoryItem.itemId}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => handleItemSelect(index, inventoryItem)}
                            >
                              <div className="font-medium text-gray-800">{inventoryItem.name || inventoryItem.itemName}</div>
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
                </div>
                
                {item.sku && (
                  <div className="text-xs text-gray-500 mt-1">
                    SKU: {item.sku} {item.unit && `| Unit: ${item.unit}`}
                  </div>
                )}
              </div>
              
              <div className="col-span-2">
                <div className="flex">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                    className="w-full border border-gray-300 rounded-l px-3 py-2 bg-white text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    step="1"
                  />
                  {item.unit && (
                    <div className="border border-gray-300 border-l-0 rounded-r px-3 py-2 bg-gray-50 text-gray-500 text-sm flex items-center justify-center min-w-[60px]">
                      {item.unit}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="col-span-2">
                <div className="flex items-center">
                  <span className="mr-1 text-gray-500">AED</span>
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => handleRateChange(index, e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              
              <div className="col-span-2">
                <div className="flex items-center">
                  <input
                    type="text"
                    value={item.discount}
                    onChange={(e) => handleDiscountChange(index, e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0%"
                  />
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-700 text-sm flex items-center justify-center">
                  AED {item.amount || '0.00'}
                </div>
              </div>
              
              {/* Cross button placed in a new column */}
              <div className="col-span-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  disabled={items.length <= 1}
                  className={`text-sm font-bold ${items.length <= 1 
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'text-red-500 hover:text-red-700 cursor-pointer'}`}
                  title={items.length <= 1 ? "Cannot remove the only item" : "Remove item"}
                >
                  ✖
                </button>
              </div>
            </div>
          ))}

          <div className="mt-4">
            <button 
              onClick={addNewRow}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>+</span> Add New Row
            </button>
          </div>
        </div>

        {/* Totals Section with Auto-calculated VAT */}
        <div className="px-8 py-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Sub Total</span>
                <span className="font-medium">AED {calculateSubTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Shipping Charges</span>
                <input 
                  type='number' 
                  value={shippingCharges}
                  onChange={handleShippingChange}
                  className="w-30 border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-right"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Adjustment</span>
                <input 
                  type='number' 
                  value={adjustment}
                  onChange={handleAdjustmentChange}
                  className="w-30 border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-right"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Round Off</span>
                <span className="font-medium">0.000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">VAT 5%</span>
                <span className="font-medium">{calculateVAT().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-lg font-semibold">Total (AED)</span>
                <span className="text-lg font-semibold">
                  {calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Notes
                </label>
                <textarea
                  value={customerNotes}
                  onChange={handleCustomerNotesChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 h-20 resize-none"
                  placeholder="Enter any notes to be displayed in your transaction"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Terms & Conditions
                </label>
                <textarea
                  value={termsAndConditions}
                  onChange={handleTermsChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 h-20 resize-none"
                  placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                />
              </div>
            </div>
          </div>
        </div>

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

        <div className="px-8 py-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Additional Fields: Add custom fields to your sales orders by going to Settings → Sales → Sales orders → Field Customization.
          </div>
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-4xl ml-auto flex space-x-3 justify-end">
          <button 
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
            onClick={handleSaveAsDraft}
          >
            Save as Draft
          </button>
          <button 
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
            onClick={handleSaveAndSend}
          >
            Save and Send
          </button>
          <button 
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer" 
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Newsalesorders;