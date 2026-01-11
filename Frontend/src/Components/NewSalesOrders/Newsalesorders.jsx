import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useGetItem from '../../helper/useGetItem';
import useGetCustomers from '../../helper/useGetCustomers';
import useAddSalesOrder from '../../helper/useAddSalesOrder';
import { debounce } from 'lodash';
import DatePicker from 'react-datepicker';
import { format, addDays, addMonths, addYears, isSameDay } from 'date-fns';
import { 
  FaCalendarAlt, 
  FaChevronLeft, 
  FaChevronRight, 
  FaTimes,
  FaClock,
  FaRegCalendarAlt,
  FaCheck,
  FaSearch,
  FaBox,
  FaPlus,
  FaTrash,
  FaPaperclip,
  FaEye,
  FaEdit,
  FaFilter,
  FaThList,
  FaThLarge,
  FaEllipsisV,
  FaBarcode,
  FaWarehouse,
  FaMoneyBill,
  FaTag,
  FaPercent,
  FaMoneyBillWave
} from 'react-icons/fa';
import ReactDOM from 'react-dom';

// Import date picker styles
import 'react-datepicker/dist/react-datepicker.css';

// Portal component for dropdown
const DropdownPortal = ({ children, targetRef, isVisible }) => {
  const [position, setPosition] = useState({ top: 0, left: 500, width: 0 });
  const portalRef = useRef(null);

  useEffect(() => {
    if (targetRef?.current && isVisible) {
      const rect = targetRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [targetRef, isVisible]);

  useEffect(() => {
    const handleResize = () => {
      if (targetRef?.current && isVisible) {
        const rect = targetRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [targetRef, isVisible]);

  if (!children || !isVisible) return null;

  return ReactDOM.createPortal(
    <div 
      ref={portalRef}
      className="fixed z-[9999]"
      style={{
        top: position.top + 4, // Add small gap
        left: position.left,
        width: Math.max(position.width, 500), // Minimum width
      }}
    >
      {children}
    </div>,
    document.body
  );
};

// Modern Date Picker Component
const ModernDatePicker = ({ 
  value, 
  onChange, 
  label, 
  required = false,
  minDate,
  maxDate,
  placeholder = "Select date"
}) => {
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [viewMode, setViewMode] = useState('calendar');
  const datePickerRef = useRef(null);

  const quickPresets = [
    { label: 'Today', value: new Date() },
    { label: 'Tomorrow', value: addDays(new Date(), 1) },
    { label: 'Next Week', value: addDays(new Date(), 7) },
    { label: 'Next Month', value: addMonths(new Date(), 1) },
    { label: '3 Months', value: addMonths(new Date(), 3) },
    { label: '6 Months', value: addMonths(new Date(), 6) },
    { label: '1 Year', value: addYears(new Date(), 1) },
  ];

  const handleDateSelect = (date) => {
    onChange(date.toISOString().split('T')[0]);
    setIsCustomPickerOpen(false);
  };

  const handlePresetSelect = (date) => {
    onChange(date.toISOString().split('T')[0]);
    setIsCustomPickerOpen(false);
  };

  const formatDisplayDate = (date) => {
    if (!date) return '';
    return format(new Date(date), 'MMM dd, yyyy');
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsCustomPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedDate = value ? new Date(value) : null;

  return (
    <div className="relative" ref={datePickerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsCustomPickerOpen(!isCustomPickerOpen)}
          className={`
            w-full pl-10 pr-10 py-2.5 border rounded-lg shadow-sm 
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
            bg-white text-left transition-all duration-200 flex items-center justify-between
            ${selectedDate ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          `}
        >
          <span className={selectedDate ? 'text-gray-800 font-medium' : 'text-gray-500'}>
            {selectedDate ? formatDisplayDate(selectedDate) : placeholder}
          </span>
          <FaCalendarAlt className={`${selectedDate ? 'text-blue-500' : 'text-gray-400'}`} />
        </button>
        
        {selectedDate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {isCustomPickerOpen && (
        <div className="absolute z-50 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 
                      w-96 overflow-hidden animate-fade-in">
          {/* Header with tabs */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-gray-200">
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'calendar' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FaRegCalendarAlt className="inline mr-2" />
                Calendar
              </button>
              <button
                onClick={() => setViewMode('presets')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'presets' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FaClock className="inline mr-2" />
                Quick Select
              </button>
            </div>
            
            {viewMode === 'calendar' && (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {selectedDate ? format(selectedDate, 'MMMM yyyy') : format(new Date(), 'MMMM yyyy')}
                  </h3>
                  <p className="text-sm text-gray-600">Select a date</p>
                </div>
                <button
                  onClick={() => handlePresetSelect(new Date())}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors"
                >
                  Today
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-4">
            {viewMode === 'calendar' ? (
              <div className="custom-datepicker">
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateSelect}
                  inline
                  calendarClassName="custom-calendar"
                  dayClassName={() => "day-cell"}
                  renderCustomHeader={({
                    date,
                    decreaseMonth,
                    increaseMonth,
                    prevMonthButtonDisabled,
                    nextMonthButtonDisabled,
                  }) => (
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={decreaseMonth}
                        disabled={prevMonthButtonDisabled}
                        className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 transition-colors"
                      >
                        <FaChevronLeft />
                      </button>
                      <div className="text-lg font-semibold text-gray-800">
                        {format(date, 'MMMM yyyy')}
                      </div>
                      <button
                        onClick={increaseMonth}
                        disabled={nextMonthButtonDisabled}
                        className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50 transition-colors"
                      >
                        <FaChevronRight />
                      </button>
                    </div>
                  )}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-700 mb-3">Quick Dates</h4>
                <div className="grid grid-cols-2 gap-3">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handlePresetSelect(preset.value)}
                      className={`
                        p-3 rounded-lg border text-left transition-all duration-200
                        hover:shadow-md hover:border-blue-300 hover:bg-blue-50
                        ${selectedDate && isSameDay(selectedDate, preset.value) 
                          ? 'bg-blue-100 border-blue-400 text-blue-700' 
                          : 'bg-white border-gray-200 text-gray-700'
                        }
                      `}
                    >
                      <div className="font-medium">{preset.label}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {format(preset.value, 'MMM dd, yyyy')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Date Preview */}
            {selectedDate && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-600">Selected Date</div>
                    <div className="font-semibold text-gray-800">
                      {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
                    </div>
                  </div>
                  <FaCheck className="text-green-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Newsalesorders = () => {
  const [items, setItems] = useState([{ 
    id: 1, 
    itemId: '',
    details: '', 
    sku: '',
    quantity: 1, 
    rate: '', 
    discount: '', 
    discountType: 'percentage', // 'percentage' or 'fixed'
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
  
  const [shippingCharges, setShippingCharges] = useState('0');
  const [adjustment, setAdjustment] = useState('0');
  const [customerNotes, setCustomerNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);

  const { handleGetItem, data: inventoryData, loading: inventoryLoading } = useGetItem();
  const { handleGetCustomers, data: customersData, loading: customersLoading } = useGetCustomers();
  const { handleAddSalesOrder, loading: addSalesOrderLoading } = useAddSalesOrder();

  const itemInputRefs = useRef([]);
  const discountTypeRefs = useRef([]);
  const customerDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  
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
  const calculateItemAmount = (quantity, rate, discount = 0, discountType = 'percentage') => {
    const qty = parseFloat(quantity) || 0;
    const rte = parseFloat(rate) || 0;
    const disc = parseFloat(discount) || 0;
    
    const baseAmount = qty * rte;
    
    if (discountType === 'percentage') {
      const discountAmount = baseAmount * (disc / 100);
      return (baseAmount - discountAmount).toFixed(2);
    } else {
      // Discount is fixed amount
      return (baseAmount - disc).toFixed(2);
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

  // Set default order date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setOrderDate(today);
    
    // Generate auto order number
    const randomNum = Math.floor(Math.random() * 1000);
    const date = new Date();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    setOrderNumber(`SO-${year}${month}-${randomNum.toString().padStart(3, '0')}`);
  }, []);

  useEffect(() => {
    handleGetItem();
    handleGetCustomers();
  }, []);

  // Filter items based on search term
  useEffect(() => {
    if (!inventoryData) return;
    
    if (!searchTerm) {
      setFilteredItems(inventoryData.slice(0, 10));
    } else {
      const filtered = inventoryData.filter(item => 
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item._id?.toString().includes(searchTerm) ||
        item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10);
      setFilteredItems(filtered);
    }
  }, [searchTerm, inventoryData]);

  // Filter customers based on search term
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside all item dropdowns
      if (showItemDropdown !== null) {
        const clickedElement = event.target;
        const isClickOnItemInput = itemInputRefs.current[showItemDropdown]?.contains(clickedElement);
        const isClickOnDropdown = document.querySelector('.item-dropdown-container')?.contains(clickedElement);
        
        if (!isClickOnItemInput && !isClickOnDropdown) {
          setShowItemDropdown(null);
        }
      }
      
      // Check if click is outside customer dropdown
      if (showCustomerDropdown && customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showItemDropdown, showCustomerDropdown]);

  // Handle customer selection
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(`${customer.customerCode} - ${customer.customerDisplayName}${customer.companyName ? ` (${customer.companyName})` : ''}`);
    setShowCustomerDropdown(false);
  };

  // Add new item row
  const addNewRow = () => {
    const newId = items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
    setItems([...items, { 
      id: newId, 
      itemId: '',
      details: '', 
      sku: '',
      quantity: 1,
      rate: '', 
      discount: '', 
      discountType: 'percentage',
      amount: '', 
      unit: ''
    }]);
  };

  // Remove item row
  const handleRemoveItem = (indexToRemove) => {
    if (items.length <= 1) {
      // Don't remove the last row, just clear it
      const updatedItems = [...items];
      updatedItems[indexToRemove] = {
        id: updatedItems[indexToRemove].id,
        itemId: '',
        details: '',
        sku: '',
        quantity: 1,
        rate: '',
        discount: '',
        discountType: 'percentage',
        amount: '',
        unit: ''
      };
      setItems(updatedItems);
      return;
    }
    
    const updatedItems = items.filter((_, index) => index !== indexToRemove);
    setItems(updatedItems);
    
    if (showItemDropdown === indexToRemove) {
      setShowItemDropdown(null);
    }
  };

  // Handle item selection from dropdown
  const handleItemSelect = (index, selectedItem) => {
    const updatedItems = [...items];
    const rate = selectedItem.selling_price || selectedItem.price || 0;
    const quantity = 1;
    const amount = calculateItemAmount(quantity, rate, updatedItems[index].discount, updatedItems[index].discountType);
    
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

  // Handle quantity change
  const handleQuantityChange = (index, value) => {
    const quantity = parseFloat(value) || 1;
    const updatedItems = [...items];
    updatedItems[index].quantity = quantity;
    
    // Recalculate amount when quantity changes
    if (updatedItems[index].rate) {
      updatedItems[index].amount = calculateItemAmount(
        quantity, 
        updatedItems[index].rate, 
        updatedItems[index].discount,
        updatedItems[index].discountType
      );
    }
    
    setItems(updatedItems);
  };

  // Handle rate change
  const handleRateChange = (index, value) => {
    const rate = parseFloat(value) || 0;
    const updatedItems = [...items];
    updatedItems[index].rate = rate;
    
    // Recalculate amount when rate changes
    if (updatedItems[index].quantity) {
      updatedItems[index].amount = calculateItemAmount(
        updatedItems[index].quantity, 
        rate, 
        updatedItems[index].discount,
        updatedItems[index].discountType
      );
    }
    
    setItems(updatedItems);
  };

  // Handle discount change
  const handleDiscountChange = (index, value) => {
    const updatedItems = [...items];
    updatedItems[index].discount = value;
    
    // Recalculate amount when discount changes
    if (updatedItems[index].quantity && updatedItems[index].rate) {
      updatedItems[index].amount = calculateItemAmount(
        updatedItems[index].quantity, 
        updatedItems[index].rate, 
        value,
        updatedItems[index].discountType
      );
    }
    
    setItems(updatedItems);
  };

  // Handle discount type change
  const handleDiscountTypeChange = (index, type) => {
    const updatedItems = [...items];
    updatedItems[index].discountType = type;
    
    // Recalculate amount when discount type changes
    if (updatedItems[index].quantity && updatedItems[index].rate && updatedItems[index].discount) {
      updatedItems[index].amount = calculateItemAmount(
        updatedItems[index].quantity, 
        updatedItems[index].rate, 
        updatedItems[index].discount,
        type
      );
    }
    
    setItems(updatedItems);
  };

  // Handle LPO value change
  const handleLpoValueChange = (e) => {
    setLpoValue(e.target.value);
  };

  // Handle LPO number change
  const handleLpoNumberChange = (e) => {
    setLpoNumber(e.target.value);
  };

  // Handle shipping charges change
  const handleShippingChange = (e) => {
    setShippingCharges(e.target.value);
  };

  // Handle adjustment change
  const handleAdjustmentChange = (e) => {
    setAdjustment(e.target.value);
  };

  // Handle customer notes change
  const handleCustomerNotesChange = (e) => {
    setCustomerNotes(e.target.value);
  };

  // Handle terms and conditions change
  const handleTermsChange = (e) => {
    setTermsAndConditions(e.target.value);
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (attachedFiles.length + files.length > 10) {
      alert('Maximum 10 files allowed');
      return;
    }
    
    const newFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2), // MB
      type: file.type,
      file
    }));
    
    setAttachedFiles([...attachedFiles, ...newFiles]);
  };

  // Handle file removal
  const handleRemoveFile = (fileId) => {
    setAttachedFiles(attachedFiles.filter(file => file.id !== fileId));
  };

  // Handle cancel button
  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      navigate('/sales/salesorders');
    }
  };

  // Handle Save as Draft
  const handleSaveAsDraft = async () => {
    try {
      const salesOrderData = prepareSalesOrderData('draft');
      const result = await handleAddSalesOrder(salesOrderData);
      
      if (result && result.data && result.data.id) {
        alert('Sales order saved as draft successfully!');
        navigate(`/sales/salesorders/${result.data.id}`);
      }
    } catch (error) {
      console.error('Failed to save as draft:', error);
      alert('Failed to save as draft. Please try again.');
    }
  };


  const handleSaveAndSend = async () => {
    try {
      const salesOrderData = prepareSalesOrderData('open');
      console.log(salesOrderData,"sales order data")
      const result = await handleAddSalesOrder(salesOrderData);
      
      if (result && result.data && result.data.id) {
        alert('Sales order created and sent successfully!');
        navigate("/sales/salesorders");
      }
    } catch (error) {
      console.error('Failed to save and send:', error);
      alert(error.message || 'Failed to save and send. Please check all required fields.');
    }
  };

  // Prepare sales order data for API
  const prepareSalesOrderData = (status) => {
    const subTotal = calculateSubTotal();
    const vat = calculateVAT();
    const shipping = parseFloat(shippingCharges) || 0;
    const adjustmentValue = parseFloat(adjustment) || 0;
    const total = subTotal + vat + shipping + adjustmentValue;

    // Prepare items for API - keep all fields
    const apiItems = items
      .filter(item => item.details && item.quantity > 0)
      .map(item => ({
        itemId: item.itemId,
        name: item.details,
        sku: item.sku,
        quantity: parseFloat(item.quantity) || 0,
        rate: parseFloat(item.rate) || 0,
        discount: item.discount || '0',
        discountType: item.discountType,
        amount: parseFloat(item.amount) || 0,
        unit: item.unit || 'pcs'
      }));

    console.log(apiItems,"api items")

    if (apiItems.length === 0) {
      throw new Error('Please add at least one item to the sales order');
    }

    if (!selectedCustomer) {
      throw new Error('Please select a customer');
    }

    if (!lpoNumber.trim()) {
      throw new Error('LPO Number is required');
    }

    // Prepare attachments for API
    const apiAttachments = attachedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file.file) // In real app, upload to server first
    }));

    return {
      orderNumber: orderNumber,
      customerId: selectedCustomer._id,
      customerName: selectedCustomer.customerDisplayName,
      customerCode: selectedCustomer.customerCode,
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
      attachments: apiAttachments,
      status: status,
      subTotal: subTotal,
      vat: vat,
      total: total,
      createdBy: 'current_user_id' // In real app, get from auth context
    };
  };

  // Debounced search for items
  const debouncedSearch = useCallback(
    debounce((term) => {
      setSearchTerm(term);
    }, 300),
    []
  );

  // Check if any item has been added
  const hasItemsAdded = items.some(item => item.details && item.quantity > 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 mb-16">
        {/* Header */}
        <div className="px-6 md:px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">New Sales Order</h1>
              <p className="text-gray-600 mt-1">Create a new sales order for your customer</p>
            </div>
            <div className="mt-3 sm:mt-0 flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                <FaBox className="mr-1" /> Draft
              </span>
              <button className="p-2 border rounded-md hover:bg-gray-100">
                <FaThList className="text-gray-600" />
              </button>
              <button className="p-2 border rounded-md hover:bg-gray-100">
                <FaThLarge className="text-gray-600" />
              </button>
              <button className="p-2 border rounded-md hover:bg-gray-100">
                <FaEllipsisV className="text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Form Content */}
        <div className="px-4 md:px-8 py-6">
          {/* Customer and Order Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Selection */}
            <div ref={customerDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                    placeholder="Search customer by name, company, email, or code..."
                  />
                  
                  <div 
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                    onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                  >
                    ▼
                  </div>
                </div>
                
                {showCustomerDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-xl max-h-80 overflow-y-auto">
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
                            <FaPlus />
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
                <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
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
            
            {/* Order Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sales Order#<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                placeholder="Auto-generated"
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">Auto-generated order number</p>
            </div>
          </div>

          {/* Sales Type and Order Date */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sales Type<span className="text-red-500">*</span>
              </label>
              <select
                value={salesType}
                onChange={(e) => setSalesType(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                {salesTypeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Modern Date Picker for Order Date */}
            <ModernDatePicker
              value={orderDate}
              onChange={setOrderDate}
              label="Sales Order Date"
              required={true}
              placeholder="Select order date"
            />
          </div>

          {/* LPO Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LPO Number<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={lpoNumber}
                onChange={handleLpoNumberChange}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="LPO-2023-001"
              />
            </div>
            
            {/* Modern Date Picker for LPO Date */}
            <ModernDatePicker
              value={lpoDate}
              onChange={setLpoDate}
              label="LPO Date"
              placeholder="Select LPO date"
            />
          </div>

          {/* LPO Value and Expected Shipment Date */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                LPO VALUE (AED)<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">AED</span>
                <input
                  type="number"
                  value={lpoValue}
                  onChange={handleLpoValueChange}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            
            {/* Expected Shipment Date */}
            <ModernDatePicker
              value={expectedShipmentDate}
              onChange={setExpectedShipmentDate}
              label="Expected Shipment Date"
              placeholder="Select shipment date"
            />
          </div>

          {/* Payment Terms and Salesperson */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Terms<span className="text-red-500">*</span>
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>Select payment terms</option>
                {paymentTermsOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Salesperson<span className="text-red-500">*</span>
              </label>
              <select
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>Select salesperson</option>
                {salespersonOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items Table Section */}
          <div className="mt-8 relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Items</h2>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  {items.filter(item => item.details).length} item(s) added
                </span>
                <button 
                  onClick={addNewRow}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <FaPlus /> Add New Row
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">Item Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-6">
  <div className="relative">
    <div 
      ref={el => itemInputRefs.current[index] = el}
      className="relative"
    >
      <input 
        className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Type or click to select an item"
        value={item.details}
        onChange={(e) => {
          const updatedItems = [...items];
          updatedItems[index].details = e.target.value;
          setItems(updatedItems);
          debouncedSearch(e.target.value);
          setShowItemDropdown(index);
        }}
        onFocus={() => {
          setShowItemDropdown(index);
          if (!item.details) {
            setSearchTerm('');
          }
        }}
      />
    </div>
    
    {/* SKU and Unit info - position absolutely so it doesn't affect layout */}
    {item.sku && (
      <div className="absolute bottom-0 left-0 right-0 transform translate-y-full mt-1 text-xs text-gray-500 flex items-center gap-2">
        <FaBarcode className="text-gray-400" />
        <span>SKU: {item.sku}</span>
        {item.unit && <span className="ml-2">| Unit: {item.unit}</span>}
      </div>
    )}
  </div>
</td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            className="w-24 border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            min="1"
                            step="1"
                          />
                          {item.unit && (
                            <span className="ml-2 text-gray-500 text-sm">{item.unit}</span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="mr-2 text-gray-500">AED</span>
                          <input
                            type="text"
                            value={item.rate}
                            onChange={(e) => handleRateChange(index, e.target.value)}
                            className="w-32 border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          
                          
                          <input
                            type="text"
                            value={item.discount}
                            onChange={(e) => handleDiscountChange(index, e.target.value)}
                            className="w-24 border border-gray-300 rounded-r px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={item.discountType === 'percentage' ? "0%" : "0.00"}
                          />
                          <div className="relative" ref={el => discountTypeRefs.current[index] = el}>
                            <button
                              type="button"
                              className="flex items-center px-3 py-2 border border-gray-300 rounded-l bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onClick={() => {
                                
                                const newType = item.discountType === 'percentage' ? 'fixed' : 'percentage';
                                handleDiscountTypeChange(index, newType);
                              }}
                            >
                              {item.discountType === 'percentage' ? (
                                <>
                                  <FaPercent className="text-gray-600 mr-1" />
                                  <span className="text-xs">%</span>
                                </>
                              ) : (
                                <>
                                  <FaMoneyBillWave className="text-gray-600 mr-1" />
                                  <span className="text-xs">AED</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="absolute text-xs text-gray-500 mt-1">
                          {item.discountType === 'percentage' ? 'Percentage discount' : 'Fixed amount discount'}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="w-32 border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-700 text-sm font-medium">
                          AED {item.amount || '0.00'}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Item Dropdown Portal */}
            <DropdownPortal 
              targetRef={itemInputRefs.current[showItemDropdown]}
              isVisible={showItemDropdown !== null}
            >
              <div className="item-dropdown-container bg-white border border-gray-300 rounded-lg shadow-xl shadow-gray-400/50 max-h-[400px] overflow-y-auto w-[500px]">
                {inventoryLoading ? (
                  <div className="px-3 py-4 text-center">
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading items...</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <p className="text-gray-500">
                      {searchTerm ? 'No items found' : 'Start typing to search items'}
                    </p>
                    {!searchTerm && (
                      <p className="text-xs text-gray-400 mt-1">
                        Total items: {inventoryData?.length || 0}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 flex justify-between items-center">
                      <span>{filteredItems.length} item(s) found</span>
                      <span className="text-gray-400">Press Enter to select first item</span>
                    </div>
                    
                    <div className="p-2">
                      {filteredItems.map(inventoryItem => (
                        <div
                          key={inventoryItem._id || inventoryItem.itemId}
                          className="px-3 py-3 hover:bg-blue-50 cursor-pointer rounded-lg border-b border-gray-100 last:border-b-0 transition-all duration-200 hover:shadow-sm"
                          onClick={() => handleItemSelect(showItemDropdown, inventoryItem)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-sm">
                                <FaBox className="text-blue-600 text-lg" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between">
                                <div className="font-medium text-gray-900 truncate text-base">
                                  {inventoryItem.name || inventoryItem.itemName || 'No name'}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 text-xs font-mono bg-blue-100 text-blue-800 rounded">
                                    SKU: {inventoryItem.sku || 'N/A'}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <FaMoneyBill className="text-green-500 w-3 h-3" />
                                  <div>
                                    <div className="text-gray-500 text-xs">Price</div>
                                    <div className="font-semibold text-gray-800">
                                      AED {inventoryItem.selling_price || inventoryItem.price || 0}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <FaWarehouse className="text-orange-500 w-3 h-3" />
                                  <div>
                                    <div className="text-gray-500 text-xs">Stock</div>
                                    <div className={`font-semibold ${
                                      (inventoryItem.quantity || 0) > 10 
                                        ? 'text-green-600' 
                                        : (inventoryItem.quantity || 0) > 0 
                                          ? 'text-yellow-600' 
                                          : 'text-red-600'
                                    }`}>
                                      {inventoryItem.quantity || 0} units
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <FaTag className="text-purple-500 w-3 h-3" />
                                  <div>
                                    <div className="text-gray-500 text-xs">Unit</div>
                                    <div className="font-semibold text-gray-800">
                                      {inventoryItem.unit || inventoryItem.Unit || 'pcs'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {inventoryItem.item_code && (
                                <div className="mt-2 text-xs text-gray-500">
                                  <span className="bg-gray-100 px-2 py-1 rounded">Code: {inventoryItem.item_code}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </DropdownPortal>
            
            {/* No items message */}
            {!hasItemsAdded && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                <p className="text-yellow-700">No items added yet. Add items to create the sales order.</p>
              </div>
            )}
          </div>

          {/* Totals and Notes Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            {/* Totals Section */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Sub Total</span>
                  <span className="font-medium">AED {calculateSubTotal().toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Shipping Charges</span>
                  <div className="flex items-center">
                    <span className="mr-2 text-gray-500">AED</span>
                    <input 
                      type="number" 
                      value={shippingCharges}
                      onChange={handleShippingChange}
                      className="w-32 border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Adjustment</span>
                  <div className="flex items-center">
                    <span className="mr-2 text-gray-500">AED</span>
                    <input 
                      type="number" 
                      value={adjustment}
                      onChange={handleAdjustmentChange}
                      className="w-32 border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">VAT 5%</span>
                  <span className="font-medium">AED {calculateVAT().toFixed(2)}</span>
                </div>
                
                <div className="pt-4 border-t border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-800">Total (AED)</span>
                    <span className="text-xl font-bold text-blue-600">
                      AED {calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Summary Stats */}
              <div className="mt-4 pt-4 border-t border-gray-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-600">Items</div>
                    <div className="text-lg font-bold text-blue-700">
                      {items.filter(item => item.details).length}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-sm text-green-600">Quantity</div>
                    <div className="text-lg font-bold text-green-700">
                      {items.reduce((total, item) => total + (parseFloat(item.quantity) || 0), 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Notes
                </label>
                <textarea
                  value={customerNotes}
                  onChange={handleCustomerNotesChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32 resize-none"
                  placeholder="Enter any notes to be displayed in your transaction"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Terms & Conditions
                </label>
                <textarea
                  value={termsAndConditions}
                  onChange={handleTermsChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32 resize-none"
                  placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* File Attachments Section */}
          <div className="mt-8">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <FaPaperclip /> Attach File(s) to Sales Order
            </h3>
            
            <div 
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FaPaperclip className="text-3xl text-gray-400 mx-auto mb-3" />
              <div className="text-gray-600 mb-2">Click to upload or drag and drop</div>
              <div className="text-xs text-gray-400">
                Max 10 files, 5MB each. Supports: PDF, DOC, XLS, JPG, PNG
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />
            </div>
            
            {/* Attached Files List */}
            {attachedFiles.length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-gray-600 mb-2">
                  Attached Files ({attachedFiles.length}/10)
                </div>
                <div className="space-y-2">
                  {attachedFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3">
                        <FaPaperclip className="text-gray-400" />
                        <div>
                          <div className="font-medium text-sm text-gray-800">{file.name}</div>
                          <div className="text-xs text-gray-500">{file.size} MB</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 md:px-8 py-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-4 sm:mb-0">
              <div className="text-sm text-gray-600">
                Items: {items.filter(item => item.details).length} | 
                Total: AED {calculateTotal().toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Required fields are marked with *
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button 
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSaveAsDraft}
                disabled={addSalesOrderLoading || !selectedCustomer || !hasItemsAdded}
              >
                {addSalesOrderLoading ? 'Saving...' : 'Save as Draft'}
              </button>
              <button 
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSaveAndSend}
                disabled={addSalesOrderLoading || !selectedCustomer || !hasItemsAdded || !lpoNumber.trim()}
              >
                {addSalesOrderLoading ? 'Processing...' : 'Save and Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for react-datepicker */}
      <style jsx global>{`
        .react-datepicker {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          background-color: white;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .react-datepicker__header {
          background-color: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          padding-top: 12px;
          border-top-left-radius: 0.75rem;
          border-top-right-radius: 0.75rem;
        }

        .react-datepicker__current-month {
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }

        .react-datepicker__day-name {
          color: #6b7280;
          font-weight: 500;
          font-size: 0.875rem;
        }

        .react-datepicker__day {
          width: 2.5rem;
          height: 2.5rem;
          line-height: 2.5rem;
          margin: 0.166rem;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .react-datepicker__day:hover {
          background-color: #e5e7eb;
          transform: scale(1.05);
        }

        .react-datepicker__day--selected {
          background-color: #2563eb !important;
          color: white !important;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
        }

        .react-datepicker__day--today {
          font-weight: 600;
          color: #2563eb;
          background-color: #dbeafe;
        }

        .react-datepicker__navigation {
          top: 16px;
        }

        .react-datepicker__navigation--previous {
          border-right-color: #6b7280;
        }

        .react-datepicker__navigation--next {
          border-left-color: #6b7280;
        }

        .react-datepicker__navigation:hover *::before {
          border-color: #2563eb;
        }

        /* Animation for date picker */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }

        /* Item dropdown styles */
        .item-dropdown-container {
          max-height: 400px !important;
          width: 500px !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          border: 1px solid #d1d5db !important;
          border-radius: 0.75rem !important;
        }

        .item-dropdown-container::-webkit-scrollbar {
          width: 6px;
        }

        .item-dropdown-container::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }

        .item-dropdown-container::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }

        .item-dropdown-container::-webkit-scrollbar-thumb:hover {
          background: #a1a1a1;
        }
      `}</style>
    </div>
  );
};

export default Newsalesorders;