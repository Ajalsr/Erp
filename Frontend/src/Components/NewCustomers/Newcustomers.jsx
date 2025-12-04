import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAddCustomer from '../../helper/useAddCustomer';
import toast, { Toaster } from "react-hot-toast";


const Newcustomers = () => {
  const {handleAddcustomer} = useAddCustomer();
  const [activeTab, setActiveTab] = useState('other-details');
  const [formData, setFormData] = useState({
    customerType: 'business',
    salutation: '',
    firstName: '',
    lastName: '',
    companyName: '',
    customerDisplayName: '',
    customerEmail: '',
    customerPhone: '',
    workPhone: '',
    mobile: '',
    streetAddress: '',
    city: '',
    postalCode: '',
    country: '',
    contactPersons: [],
    customFields: {},
    reportingTags: [],
    remarks: '',
    documents: [],
    currency: 'UAE Dirham',
    paymentTerms: 'Due on Receipt'
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'radio') {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    } else if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async () => {
    //e.preventDefault();
    console.log('Form submitted:', formData);
    
    if (!formData.customerDisplayName) {
    toast.error("Please fill customer display name");
    return;
    }
        
        
        try {
          await handleAddcustomer(formData);
          
          setFormData({
    customerType: 'business',
    salutation: '',
    firstName: '',
    lastName: '',
    companyName: '',
    customerDisplayName: '',
    customerEmail: '',
    customerPhone: '',
    workPhone: '',
    mobile: '',
    streetAddress: '',
    city: '',
    postalCode: '',
    country: '',
    contactPersons: [],
    customFields: {},
    reportingTags: [],
    remarks: '',
    documents: [],
    currency: 'UAE Dirham',
    paymentTerms: 'Due on Receipt'
  });
          setTimeout(() => {
              navigate("/Sales/Customers")
          }, 3000)
          console.log("its a yes")
        } catch (error) {
          toast.error(error.error)
          return;
        } finally {
          
        }


  };

  const handleCancel = () => {
    navigate('/sales/customers');
    console.log('Form cancelled');
  };

  // Tab content components
  const TabContent = () => {
    switch (activeTab) {
      case 'other-details':
        return (
          <div className="space-y-4">
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Currency</h2>
              <div className="bg-gray-100 px-4 py-3 rounded-md inline-block">
                <span className="text-gray-700 font-medium">{formData.currency}</span>
              </div>
            </div>

            {/* Payment Terms Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Payment Terms</h2>
              <div className="bg-gray-100 px-4 py-3 rounded-md inline-block">
                <span className="text-gray-700 font-medium">{formData.paymentTerms}</span>
              </div>
            </div>

            {/* Documents Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Documents</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <div className="flex items-center justify-center mb-2">
                  <input
                    type="checkbox"
                    name="uploadFile"
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-gray-700">Upload File</span>
                </div>
                <p className="text-sm text-gray-500">
                  You can upload a maximum of 10 files, 5MB each
                </p>
              </div>
            </div>

            {/* Add more details link */}
            <div className="mb-8">
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Add more details
              </button>
            </div>
          </div>
        );
      
      case 'address':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                name="streetAddress"
                value={formData.streetAddress}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter street address"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Postal Code"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Country"
              />
            </div>
          </div>
        );
      
      case 'contact-persons':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-medium text-gray-700">Contact Persons</h3>
              <button
                type="button"
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                onClick={() => {
                  const newContact = {
                    id: Date.now(),
                    name: '',
                    email: '',
                    phone: ''
                  };
                  setFormData(prev => ({
                    ...prev,
                    contactPersons: [...prev.contactPersons, newContact]
                  }));
                }}
              >
                Add Contact
              </button>
            </div>
            {formData.contactPersons.length === 0 ? (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-center text-gray-500">
                  <p>No contact persons added yet</p>
                  <p className="text-sm mt-1">Click "Add Contact" to add a new contact person</p>
                </div>
              </div>
            ) : (
              formData.contactPersons.map((contact, index) => (
                <div key={contact.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => {
                          const updatedContacts = [...formData.contactPersons];
                          updatedContacts[index] = { ...contact, name: e.target.value };
                          setFormData(prev => ({ ...prev, contactPersons: updatedContacts }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => {
                          const updatedContacts = [...formData.contactPersons];
                          updatedContacts[index] = { ...contact, email: e.target.value };
                          setFormData(prev => ({ ...prev, contactPersons: updatedContacts }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => {
                          const updatedContacts = [...formData.contactPersons];
                          updatedContacts[index] = { ...contact, phone: e.target.value };
                          setFormData(prev => ({ ...prev, contactPersons: updatedContacts }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Phone"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const updatedContacts = formData.contactPersons.filter((_, i) => i !== index);
                      setFormData(prev => ({ ...prev, contactPersons: updatedContacts }));
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove Contact
                  </button>
                </div>
              ))
            )}
          </div>
        );
      
      case 'custom-fields':
        return (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-700">Custom Fields</h3>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-center text-gray-500">
                <p>No custom fields defined</p>
                <p className="text-sm mt-1">Custom fields can be configured in settings</p>
              </div>
            </div>
          </div>
        );
      
      case 'reporting-tags':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-md font-medium text-gray-700">Reporting Tags</h3>
              <button
                type="button"
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                onClick={() => {
                  const newTag = prompt('Enter new tag name:');
                  if (newTag && newTag.trim()) {
                    setFormData(prev => ({
                      ...prev,
                      reportingTags: [...prev.reportingTags, newTag.trim()]
                    }));
                  }
                }}
              >
                Add Tag
              </button>
            </div>
            {formData.reportingTags.length === 0 ? (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-center text-gray-500">
                  <p>No reporting tags added</p>
                  <p className="text-sm mt-1">Click "Add Tag" to add reporting tags</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.reportingTags.map((tag, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="text-gray-700">{tag}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedTags = formData.reportingTags.filter((_, i) => i !== index);
                        setFormData(prev => ({ ...prev, reportingTags: updatedTags }));
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      
      case 'remarks':
        return (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-700">Remarks</h3>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="4"
              placeholder="Enter any additional remarks or notes about this customer..."
            ></textarea>
          </div>
        );
      
      default:
        return null;
    }
  };

  const tabs = [
    { id: 'other-details', label: 'Other Details' },
    { id: 'address', label: 'Address' },
    { id: 'contact-persons', label: 'Contact Persons' },
    { id: 'custom-fields', label: 'Custom Fields' },
    { id: 'reporting-tags', label: 'Reporting Tags' },
    { id: 'remarks', label: 'Remarks' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">New Customer</h1>
          </div>

          <form  className="px-6 py-6">
            {/* Customer Type Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Customer Type</h2>
              <div className="flex space-x-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="customerType"
                    value="business"
                    checked={formData.customerType === 'business'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-gray-700">Business</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="customerType"
                    value="individual"
                    checked={formData.customerType === 'individual'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-gray-700">Individual</span>
                </label>
              </div>
            </div>

            {/* Primary Contact Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Primary Contact</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salutation
                  </label>
                  <select
                    name="salutation"
                    value={formData.salutation}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Salutation</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Miss">Miss</option>
                    <option value="Dr.">Dr.</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Last Name"
                  />
                </div>
              </div>
            </div>

            {/* Company Name Section */}
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Display Name*
                  </label>
                  <input
                    type="text"
                    name="customerDisplayName"
                    value={formData.customerDisplayName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Customer Display Name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Company Name"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Customer Email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Phone
                  </label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={formData.customerPhone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Customer Phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile
                  </label>
                  <input
                    type="tel"
                    name="mobile"
                    value={formData.mobile}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Work Phone"
                  />
                </div>
              </div>
            </div>

            {/* Other Details Section with Tabs */}
            <div className="mb-8">
              {/* Tabs Navigation */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="mt-6">
                <TabContent />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={handleSubmit}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Newcustomers;