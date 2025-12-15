import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAddCustomer from '../../helper/useAddCustomer';
import toast, {Toaster} from "react-hot-toast";
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { IoIosClose } from "react-icons/io";


const Newcustomers = () => {
  const { handleAddcustomer } = useAddCustomer();
  const [activeTab, setActiveTab] = useState('other-details');
  const [isSubmitting, setIsSubmitting] = useState(false); 
  
  const [phoneNumbers, setPhoneNumbers] = useState({
    customerPhone: '',
    workPhone: '',
    mobile: ''
  });

  const [formData, setFormData] = useState({
    customerType: 'business',
    customerCode:'',
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


  const handlePhoneChange = (value, country, name) => {
    setPhoneNumbers(prev => ({
      ...prev,
      [name]: value
    }));
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // const handleSubmit = async (e) => { 
  //   e.preventDefault(); 
    
  //   console.log('Form submitted:', formData);
    
  //   if (!formData.customerDisplayName.trim()) {
  //     toast.error("Please fill customer display name");
  //     return;
  //   }
    
  //   setIsSubmitting(true);
    
  //   try {
  //     await handleAddcustomer(formData);
      
  //     setFormData({
  //       customerType: 'business',
  //       customerCode: '',
  //       salutation: '',
  //       firstName: '',
  //       lastName: '',
  //       companyName: '',
  //       customerDisplayName: '',
  //       customerEmail: '',
  //       customerPhone: '',
  //       workPhone: '',
  //       mobile: '',
  //       streetAddress: '',
  //       city: '',
  //       postalCode: '',
  //       country: '',
  //       contactPersons: [],
  //       customFields: {},
  //       reportingTags: [],
  //       remarks: '',
  //       documents: [],
  //       currency: 'UAE Dirham',
  //       paymentTerms: 'Due on Receipt'
  //     });
      
  //     setPhoneNumbers({
  //       customerPhone: '',
  //       workPhone: '',
  //       mobile: ''
  //     });
      
      
  //     setTimeout(() => {
  //       navigate("/sales/customers"); 
  //     }, 2000);
      
  //   } catch (error) {
  //     toast.error("Error adding customer");
  //     console.error("Error adding customer:", error);
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };


  const handleSubmit = async (e) => { 
  e.preventDefault(); 
  
  console.log('Form submitted:', formData);
  
  if (!formData.customerDisplayName.trim()) {
    toast.error("Please fill customer display name");
    return;
  }
  
  setIsSubmitting(true);
  
  try {
    // Format phone numbers properly
    const formattedData = {
      ...formData,
      customerPhone: phoneNumbers.customerPhone,
      workPhone: phoneNumbers.workPhone,
      mobile: phoneNumbers.mobile
    };
    
    await handleAddCustomer(formattedData);
    
    // Reset form
    setFormData({
      customerType: 'business',
      customerCode: '',
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
    
    setPhoneNumbers({
      customerPhone: '',
      workPhone: '',
      mobile: ''
    });
    
    // Show success message
    toast.success("Customer created successfully!");
    
    // Redirect after 2 seconds
    setTimeout(() => {
      navigate("/sales/customers"); 
    }, 2000);
    
  } catch (error) {
    console.error("Error adding customer:", error);
  } finally {
    setIsSubmitting(false);
  }
};


  const handleCancel = () => {
    navigate('/sales/customers'); 
  };

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

            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Payment Terms</h2>
              <div className="bg-gray-100 px-4 py-3 rounded-md inline-block">
                <span className="text-gray-700 font-medium">{formData.paymentTerms}</span>
              </div>
            </div>

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
              <textarea
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
                <div key={contact.id} className="border border-gray-200 rounded-lg p-4">
  <div className="grid grid-cols-12 gap-4 items-end">
    <div className="col-span-12 md:col-span-3">
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
    
    <div className="col-span-12 md:col-span-3">
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
    
   
    <div className="col-span-12 md:col-span-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
      <PhoneInput
        country={'ae'}
        value={contact.phone || ''}
        autoFormat={false}
        onChange={(value, country, e, formattedValue) => {
          const updatedContacts = [...formData.contactPersons];
          updatedContacts[index] = { ...contact, phone: value };
          setFormData(prev => ({ ...prev, contactPersons: updatedContacts }));
        }}
        inputProps={{
          name: 'contactPhone',
          required: false,
        }}
        inputStyle={{
          width: '100%',
          height: '38px',
          paddingLeft: '48px'
        }}
        buttonStyle={{
          padding: '0 8px',
          background: '#f9fafb',
          border: '1px solid #d1d5db',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px'
        }}
        containerStyle={{
          width: '100%'
        }}
        placeholder="Phone"
      />
    </div>
    
    <div className="col-span-12 md:col-span-2 flex items-center justify-center md:justify-end">
      <button
        type="button"
        onClick={() => {
          const updatedContacts = formData.contactPersons.filter((_, i) => i !== index);
          setFormData(prev => ({ ...prev, contactPersons: updatedContacts }));
        }}
        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-full transition-colors mt-5 md:mt-0"
        title="Remove Contact"
      >
        <IoIosClose size='25px'/>
      </button>
    </div>
  </div>
</div>
              ))
            )}
          </div>
        );
      
      case 'custom-fields':
        return (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-700">Custom Fields</h3>
            {/* <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-center text-gray-500">
                <p>No custom fields defined</p>
                <p className="text-sm mt-1">Custom fields can be configured in settings</p>
              </div>
            </div> */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trade License Number</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Trade License Number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TRL Number</label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="TRL Number"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Registration Date</label>
                <input
                  type="date"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Company Registration Date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry Date</label>
                <input
                  type="date"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="License Expiry Date"
                />
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
      {/* <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      /> */}
      
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">New Customer</h1>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6">
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

            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
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
                  <PhoneInput
                    prefix='+'
                    country={'ae'} 
                    value={phoneNumbers.customerPhone}
                    onChange={(value, country, e, formattedValue) => 
                      handlePhoneChange(value, country, 'customerPhone')
                    }
                    inputProps={{
                      name: 'customerPhone',
                      required: false,
                    }}
                    inputStyle={{
                      width: '100%',
                      height: '42px',
                      paddingLeft: '48px',
                      fontSize: '14px'
                    }}
                    buttonStyle={{
                      padding: '0 8px',
                      background: '#f9fafb',
                      border: '1px solid #d1d5db',
                      borderRight: 'none',
                      borderRadius: '6px 0 0 6px'
                    }}
                    dropdownStyle={{
                      fontSize: '14px'
                    }}
                    containerStyle={{
                      width: '100%'
                    }}
                    placeholder="Customer Phone"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile
                  </label>
                  <PhoneInput
                    prefix='+'
                    country={'ae'} 
                    value={phoneNumbers.mobile}
                    onChange={(value, country, e, formattedValue) => 
                      handlePhoneChange(value, country, 'mobile')
                    }
                    inputProps={{
                      name: 'mobile',
                      required: false,
                    }}
                    inputStyle={{
                      width: '100%',
                      height: '42px',
                      paddingLeft: '48px',
                      fontSize: '14px'
                    }}
                    buttonStyle={{
                      padding: '0 8px',
                      background: '#f9fafb',
                      border: '1px solid #d1d5db',
                      borderRight: 'none',
                      borderRadius: '6px 0 0 6px'
                    }}
                    dropdownStyle={{
                      fontSize: '14px'
                    }}
                    containerStyle={{
                      width: '100%'
                    }}
                    placeholder="Mobile Number"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work Phone (Optional)
                  </label>
                  <PhoneInput
                    prefix='+'
                    countryCodeEditable={true}
                    enableAreaCodes={true}
                    disableCountryCode={false}
                    country={'ae'}
                    value={phoneNumbers.workPhone}
                    onChange={(value, country) => {
                    const finalValue = value.startsWith('+') 
              ? value 
      : `+${value.replace('.', '')}`;

    handlePhoneChange(finalValue, country, 'workPhone');
  }}
                    inputProps={{
                      name: 'workPhone',
                      required: false,
                    }}
                    inputStyle={{
                      width: '100%',
                      height: '42px',
                      paddingLeft: '48px',
                      fontSize: '14px'
                    }}
                    buttonStyle={{
                      padding: '0 8px',
                      background: '#f9fafb',
                      border: '1px solid #d1d5db',
                      borderRight: 'none',
                      borderRadius: '6px 0 0 6px'
                    }}
                    dropdownStyle={{
                      fontSize: '14px'
                    }}
                    containerStyle={{
                      width: '100%'
                    }}
                    placeholder="Work Phone"
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
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

              <div className="mt-6">
                <TabContent />
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Newcustomers;