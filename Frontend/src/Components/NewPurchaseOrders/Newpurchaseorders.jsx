import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Newpurchaseorders = () => {
  const [vendor, setVendor] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('organization');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [shipmentPreference, setShipmentPreference] = useState('');
  const [items, setItems] = useState([]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [account, setAccount] = useState('');
  const [discount, setDiscount] = useState(0);

  const navigate = useNavigate();

  const handleAddItem = () => {
    setItems([...items, { 
      id: Date.now(), 
      details: '', 
      quantity: 1, 
      rate: 0, 
      discount: 0, 
      amount: 0 
    }]);
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (discount / 100);
    return subtotal - discountAmount;
  };

  const handleCancel = () => {
    navigate('/purchase/purchaseorders');
    console.log('Form cancelled');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 mb-10">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">New Purchase Order</h1>
        </div>

        {/* Vendor & Order Details - Aligned like Sales Order */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor Name<span className="text-red-500">*</span>
              </label>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>Select or type to add</option>
                <option value="vendor1">Vendor 1</option>
                <option value="vendor2">Vendor 2</option>
                <option value="vendor3">Vendor 3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Order#<span className="text-red-500">*</span>
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700">
                PO-00001
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference#
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter reference"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Order Date<span className="text-red-500">*</span>
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700">
                27 Nov 2025
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Delivery Date
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Terms<span className="text-red-500">*</span>
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700">
                Due on Receipt
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shipment Preference
              </label>
              <select
                value={shipmentPreference}
                onChange={(e) => setShipmentPreference(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>Choose preference</option>
                <option value="standard">Standard</option>
                <option value="express">Express</option>
                <option value="overnight">Overnight</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Address<span className="text-red-500">*</span>
              </label>
              <select
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="organization">Organization</option>
                <option value="customer">Customer</option>
                <option value="ariel">Ariel</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Address<span className="text-red-500">*</span>
              </label>
              <div > 
  {['organization', 'customer'].map((option) => (
    <label key={option} className="flex items-center space-x-3 cursor-pointer">
      <input
        type="radio"
        value={option}
        checked={deliveryAddress === option}
        onChange={(e) => setDeliveryAddress(e.target.value)}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
      />
      <span className="text-sm text-gray-700 capitalize">{option}</span>
    </label>
  ))}
</div>
            </div>
          </div>
        </div>

        {/* Item Table Section - Matching Sales Order Layout */}
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
          {items.length === 0 ? (
            <div className="grid grid-cols-12 gap-4 px-4 py-6 border border-gray-300 border-t-0 text-center text-gray-500">
              <div className="col-span-12">No items added. Click "Add New Row" to add items.</div>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 border border-gray-300 border-b-0 last:border-b">
                {/* ITEM DETAILS */}
                <div className="col-span-5">
                  <input
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Type or click to select an item."
                    value={item.details}
                    onChange={(e) => handleItemChange(item.id, 'details', e.target.value)}
                  />
                </div>
                
                {/* QUANTITY */}
                <div className="col-span-2">
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                  />
                </div>
                
                {/* RATE */}
                <div className="col-span-2">
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    value={item.rate}
                    onChange={(e) => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                {/* DISCOUNT */}
                <div className="col-span-2">
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm h-[42px] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0%"
                    value={item.discount}
                    onChange={(e) => handleItemChange(item.id, 'discount', parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                {/* AMOUNT */}
                <div className="col-span-1">
                  <div className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-50 text-gray-500 text-sm h-[42px] flex items-center justify-center">
                    {(item.quantity * item.rate * (1 - item.discount / 100)).toFixed(3)}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Add New Row Button */}
          <div className="mt-4">
            <button 
              onClick={handleAddItem}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>+</span> Add New Row
            </button>
          </div>
        </div>

        {/* Totals Section - Matching Sales Order Layout */}
        <div className="px-8 py-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-8">
            {/* Left Side - Totals */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Sub Total</span>
                <span className="font-medium">${calculateSubtotal().toFixed(3)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Shipping Charges</span>
                <span className="font-medium">0.000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Discount</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                  />
                  <span>%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Adjustment</span>
                <span className="font-medium">0.000</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-lg font-semibold">Total (USD)</span>
                <span className="text-lg font-semibold">${calculateTotal().toFixed(3)}</span>
              </div>
            </div>

            {/* Right Side - Notes & Terms */}
            <div className="space-y-6">
              {/* Customer Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Notes
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter any notes to be displayed in your transaction"
                />
              </div>

              {/* Terms & Conditions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Terms & Conditions
                </label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                />
              </div>

              {/* Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account
                </label>
                <select
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Select an account</option>
                  <option value="account1">Account 1</option>
                  <option value="account2">Account 2</option>
                  <option value="account3">Account 3</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="px-8 py-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Attach File(s) to Purchase Order
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
            Additional Fields: Add custom fields to your purchase orders by going to Settings → Purchases → Purchase orders → Field Customization.
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Buttons - Matching Sales Order */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-4xl ml-auto flex space-x-3 justify-end">
          <button className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100">
            Save as Draft
          </button>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
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

export default Newpurchaseorders;