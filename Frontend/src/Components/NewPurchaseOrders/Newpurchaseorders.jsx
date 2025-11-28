import React, { useState } from 'react';

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

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), description: '', quantity: 1, price: 0 }]);
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - (subtotal * discount / 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">New Purchase Order</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
          {/* Left Column - Vendor Details */}
          <div className="space-y-6">
            {/* Vendor Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Vendor Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor Name*
                  </label>
                  <select 
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a Vendor</option>
                    <option value="vendor1">Vendor 1</option>
                    <option value="vendor2">Vendor 2</option>
                    <option value="vendor3">Vendor 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Delivery Address*
                  </label>
                  <div className="space-y-2">
                    {['organization', 'customer', 'ariel'].map((option) => (
                      <label key={option} className="flex items-center space-x-3">
                        <input
                          type="radio"
                          value={option}
                          checked={deliveryAddress === option}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 capitalize">{option}</span>
                      </label>
                    ))}
                  </div>
                  
                  {/* Address Display */}
                  <div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-sm text-gray-600">Lake Bereniceworth, California</p>
                    <p className="text-sm text-gray-600">Aruba, 235-034</p>
                    <p className="text-sm text-gray-600">539-379-0205 ×4231</p>
                    <button className="mt-2 text-sm text-blue-600 hover:text-blue-800">
                      Change destination to deliver
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Details */}
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Order Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purchase Order**
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
                    PO-00001
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference#
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter reference"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
                    27 Nov 2025
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shipment Preference
                </label>
                <select
                  value={shipmentPreference}
                  onChange={(e) => setShipmentPreference(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose preference</option>
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="overnight">Overnight</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Terms
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm">
                  Due on Receipt
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Items and Totals */}
          <div className="space-y-6">
            {/* Item Table */}
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Item Table</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ITEM DETAILS
                </label>
                <p className="text-sm text-gray-500 mb-4">Type or click to select an item.</p>
                
                {/* Items List */}
                <div className="space-y-3 mb-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4 p-3 border border-gray-200 rounded-md">
                      <input
                        type="text"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleAddItem}
                  className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors"
                >
                  + Add New Row
                </button>
              </div>
            </div>

            {/* Customer Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Notes
              </label>
              <p className="text-sm text-gray-500 mb-2">Will be displayed on purchase order</p>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter customer notes..."
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter terms and conditions..."
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select an account</option>
                <option value="account1">Account 1</option>
                <option value="account2">Account 2</option>
                <option value="account3">Account 3</option>
              </select>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sub Total</span>
                  <span>${calculateSubtotal().toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Discount</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-right"
                    />
                    <span>%</span>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>${calculateTotal().toFixed(3)}</span>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach File(s) to Purchase Order
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  Upload File
                </button>
                <p className="mt-2 text-sm text-gray-500">
                  You can upload a maximum of 10 files, 5MB each
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <div className="text-sm text-gray-500">
              Additional Fields: Start adding custom fields for your purchase orders by going to 
              <span className="text-blue-600 cursor-pointer"> Settings ► Purchases ► Purchase orders</span>.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 flex justify-end space-x-4">
          <button className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
            Save as Draft
          </button>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Save and Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Newpurchaseorders;