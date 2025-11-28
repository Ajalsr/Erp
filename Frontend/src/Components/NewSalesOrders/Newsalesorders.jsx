import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'
const Newsalesorders = () => {
  const [items, setItems] = useState([{ id: 1, details: '', quantity: '', rate: '', discount: '', amount: '' }]);

  const navigate = useNavigate();

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

  const handleCancel = () => {
    navigate('/sales/salesorders')
    console.log('Form cancelled');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
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
              <select
                name="unit" 
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled selected>Select or type to add</option>
                <option value="piece">Piece</option>
                <option value="box">Box</option>
                <option value="kg">Kg</option>
                <option value="liter">Liter</option>
              </select>
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
                Reference#
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
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
                name="unit" 
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled selected>Select or type to add</option>
                <option value="piece">Piece</option>
                <option value="box">Box</option>
                <option value="kg">Kg</option>
                <option value="liter">Liter</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Method<span className="text-red-500">*</span>
              </label>
              <select
                name="unit" 
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled selected>Select a delivery method or type to add</option>
                <option value="piece">Piece</option>
                <option value="box">Box</option>
                <option value="kg">Kg</option>
                <option value="liter">Liter</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Salesperson<span className="text-red-500">*</span>
              </label>
              <select
                name="unit" 
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled selected>Select or Add Salesperson</option>
                <option value="piece">Piece</option>
                <option value="box">Box</option>
                <option value="kg">Kg</option>
                <option value="liter">Liter</option>
              </select>
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
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-lg font-semibold">Total (AED)</span>
                <span className="text-lg font-semibold">0.000</span>
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

        {/* Footer Actions */}
        <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end space-x-4">
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