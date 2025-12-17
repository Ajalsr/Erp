import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'

const Newsalesorders = () => {
  const [items, setItems] = useState([{ id: 1, details: '', quantity: '', rate: '', discount: '', amount: '' }]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [salesType, setSalesType] = useState('SO');
  const [lpoDate, setLpoDate] = useState('');
  const [lpoValue, setLpoValue] = useState('');
  const [vatAmount, setVatAmount] = useState(0);

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

  const addNewRow = () => {
    setItems([...items, { 
      id: items.length + 1, 
      details: '', 
      quantity: '', 
      rate: '', 
      discount: '', 
      amount: '' 
    }]);
  };

  // Calculate VAT (5% of LPO VALUE)
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 mb-10">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">New Sales Order</h1>
        </div>

        {/* Customer & Order Details */}
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

        {/* Item Table Section */}
        <div className="px-8 py-6 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Item Table</h2>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 bg-gray-100 px-4 py-3 rounded-t-md border border-gray-300 border-b-0 text-sm font-medium text-gray-700">
            <div className="col-span-5">ITEM DETAILS</div>
            <div className="col-span-2">QUANTITY</div>
            <div className="col-span-2">RATE</div>
            <div className="col-span-2">DISCOUNT</div>
            <div className="col-span-1">AMOUNT</div>
          </div>

          {/* Table Rows */}
          {items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 border border-gray-300 border-b-0 last:border-b">
              {/* ITEM DETAILS */}
              <div className="col-span-5">
                <input className=" w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-500 text-sm h-[42px] flex items-center"  placeholder="Type or click to select an item."  />
                 
              </div>
              
              {/* QUANTITY */}
              <div className="col-span-2">
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              
              {/* RATE */}
              <div className="col-span-2">
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              
              {/* DISCOUNT */}
              <div className="col-span-2">
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0%"
                />
              </div>
              
              {/* AMOUNT */}
              <div className="col-span-1">
                <div className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-500 text-sm h-[42px] flex items-center justify-center">
                  0.00
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
                <span className="font-medium">0.000</span>
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
                <span className="text-lg font-semibold">{(parseFloat(lpoValue) || 0).toFixed(3)}</span>
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