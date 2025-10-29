import React, { useState } from 'react';

const New = () => {
  const [formData, setFormData] = useState({
    type: 'goods',
    name: '',
    sku: '',
    unit: '',
    length: '',
    width: '',
    height: '',
    manufacturer: '',
    upc: '',
    mpn: '',
    ean: '',
    isbn: '',
    weight: '',
    brand: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // Handle form submission logic here
  };

  const handleCancel = () => {
    // Handle cancel logic here
    console.log('Form cancelled');
  };

  return (
    <div className="bg-gray-50 min-h-screen p-6 pb-24"> {/* Added pb-24 for bottom padding */}
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">New Item</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Type Section */}
          <div className='flex items-baseline'>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Type</h2>
            <div className="flex space-x-4 ml-30">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="goods"
                  checked={formData.type === 'goods'}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">Goods</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="service"
                  checked={formData.type === 'service'}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-gray-700">Service</span>
              </label>
            </div>
          </div>

          {/* Name and SKU Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SKU
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="relative">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Unit *
  </label>
  <select
    name="unit"
    value={formData.unit}
    onChange={handleChange}
    required
    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white pr-10"
  >
    <option value="">Select or type to add</option>
    <option value="piece">Piece</option>
    <option value="box">Box</option>
    <option value="kg">Kg</option>
    <option value="liter">Liter</option>
  </select>
  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 pt-6">
    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  </div>
</div>
          </div>

          <hr className="border-gray-200" />

         {/* Dimensions & Manufacturer Section */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

  {/* Dimensions */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Dimensions <span className="text-gray-500 text-xs">(Length × Width × Height)</span>
    </label>
    <div className="flex items-center border border-gray-300 rounded-md overflow-hidden shadow-sm bg-white">
      {/* Length */}
      <input
        type="text"
        name="length"
        value={formData.length}
        onChange={handleChange}
        placeholder="0"
        className="w-1/4 px-3 py-2 text-center focus:outline-none border-none"
      />

      <span className="text-gray-400 text-lg px-1">×</span>

      {/* Width */}
      <input
        type="text"
        name="width"
        value={formData.width}
        onChange={handleChange}
        placeholder="0"
        className="w-1/4 px-3 py-2 text-center focus:outline-none border-none"
      />

      <span className="text-gray-400 text-lg px-1">×</span>

      {/* Height */}
      <input
        type="text"
        name="height"
        value={formData.height}
        onChange={handleChange}
        placeholder="0"
        className="w-1/4 px-3 py-2 text-center focus:outline-none border-none"
      />

      {/* Unit Select */}
      <select
        name="dimensionUnit"
        value={formData.dimensionUnit}
        onChange={handleChange}
        className="px-3 py-2 bg-white text-gray-700 focus:outline-none border-l border-gray-300 cursor-pointer"
      >
        <option value="cm">cm</option>
        <option value="in">in</option>
        <option value="mm">mm</option>
        <option value="m">m</option>
      </select>
    </div>
  </div>

  {/* Manufacturer */}
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Manufacturer
    </label>
    <select
      name="manufacturer"
      value={formData.manufacturer}
      onChange={handleChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="">Select or Add Manufacturer</option>
      <option value="manufacturer1">Manufacturer 1</option>
      <option value="manufacturer2">Manufacturer 2</option>
    </select>
  </div>
</div>



          {/* Manufacturer and Codes Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manufacturer
              </label>
              <select
                name="manufacturer"
                value={formData.manufacturer}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select or Add Manufacturer</option>
                <option value="manufacturer1">Manufacturer 1</option>
                <option value="manufacturer2">Manufacturer 2</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight
              </label>
              <input
                type="text"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">UPC</label>
                  <input
                    type="text"
                    name="upc"
                    value={formData.upc}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">MPN</label>
                  <input
                    type="text"
                    name="mpn"
                    value={formData.mpn}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">EAN</label>
                  <input
                    type="text"
                    name="ean"
                    value={formData.ean}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ISBN</label>
                  <input
                    type="text"
                    name="isbn"
                    value={formData.isbn}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Image Upload Section */}
          <div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="mt-4">
                <p className="text-lg font-medium text-gray-900">Drag image(s) here or</p>
                <button 
                  type="button"
                  className="mt-2 px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Browse images
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                You can add up to 15 images, each not exceeding 5 MB in size and 7000 X 7000 pixels resolution.
              </p>
            </div>
          </div>

          {/* Weight and Brand Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight
              </label>
              <input
                type="text"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand
              </label>
              <select
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select or Add Brand</option>
                <option value="brand1">Brand 1</option>
                <option value="brand2">Brand 2</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Fixed Buttons - Moved outside the form and main content div */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-4xl ml-auto flex space-x-3 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default New;