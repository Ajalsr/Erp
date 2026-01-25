import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAddCustomer from '../../helper/useAddCustomer';
import toast, { Toaster } from "react-hot-toast";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { IoIosClose } from "react-icons/io";
import { AiOutlineFileAdd, AiOutlineDelete } from "react-icons/ai";
import { FaFilePdf, FaFileImage, FaFileWord, FaFileExcel, FaFile } from "react-icons/fa";

// Contact Persons Component with its own state
const ContactPersonsTab = ({ contactPersons, setContactPersons }) => {
  const handleAddContact = useCallback(() => {
    const newContact = {
      id: Date.now(),
      name: '',
      email: '',
      phone: ''
    };
    setContactPersons(prev => [...prev, newContact]);
  }, [setContactPersons]);

  const handleUpdateContact = useCallback((index, field, value) => {
    setContactPersons(prev => {
      const updatedContacts = [...prev];
      updatedContacts[index] = { ...updatedContacts[index], [field]: value };
      return updatedContacts;
    });
  }, [setContactPersons]);

  const handleRemoveContact = useCallback((index) => {
    setContactPersons(prev => prev.filter((_, i) => i !== index));
  }, [setContactPersons]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-md font-medium text-gray-700">Contact Persons</h3>
        <button
          type="button"
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          onClick={handleAddContact}
        >
          Add Contact
        </button>
      </div>
      {contactPersons.length === 0 ? (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-center text-gray-500">
            <p>No contact persons added yet</p>
            <p className="text-sm mt-1">Click "Add Contact" to add a new contact person</p>
          </div>
        </div>
      ) : (
        contactPersons.map((contact, index) => (
          <div key={contact.id} className="border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-12 md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => handleUpdateContact(index, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Name"
                />
              </div>
              
              <div className="col-span-12 md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => handleUpdateContact(index, 'email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Email"
                />
              </div>
              
              <div className="col-span-12 md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <PhoneInput
                  international
                  countryCallingCodeEditable={false}
                  defaultCountry="AE"
                  value={contact.phone || ''}
                  onChange={(value) => handleUpdateContact(index, 'phone', value || '')}
                  className="w-full contact-phone-input"
                />
              </div>
              
              <div className="col-span-12 md:col-span-2 flex items-center justify-center md:justify-end">
                <button
                  type="button"
                  onClick={() => handleRemoveContact(index)}
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
};

const Newcustomers = () => {
  const { handleAddcustomer } = useAddCustomer();
  const [activeTab, setActiveTab] = useState('finance');
  const [isSubmitting, setIsSubmitting] = useState(false); 
  
  // Separate state for contact persons to prevent re-renders
  const [contactPersons, setContactPersons] = useState([]);
  
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
    customFields: {},
    reportingTags: [],
    remarks: '',
    documents: [],
    currency: 'UAE Dirham',
    paymentTerms: 'Due on Receipt'
  });

  const navigate = useNavigate();

  // Define document types
  const documentTypes = [
    { id: 'trade_license', label: 'Trade License Copy', required: true },
    { id: 'trl_copy', label: 'TRL Copy', required: true },
    { id: 'owners_passport', label: 'Owner\'s Passport Copy', required: true },
    { id: 'eid_copy', label: 'EID Copy', required: true },
    { id: 'power_of_attorney', label: 'Power of Attorney', required: false },
    { id: 'other', label: 'Other Documents', required: false }
  ];

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => {
      if (type === 'radio') {
        return { ...prev, [name]: value };
      } else if (type === 'checkbox') {
        return { ...prev, [name]: checked };
      } else {
        return { ...prev, [name]: value };
      }
    });
  }, []);

  const handlePhoneChange = useCallback((value, fieldName) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value || ''
    }));
  }, []);

  const handleFileUpload = useCallback((documentType, e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 0) {
      const newDocuments = files.map(file => ({
        id: Date.now() + Math.random(),
        type: documentType,
        name: file.name,
        file: file,
        size: file.size,
        uploadDate: new Date().toISOString(),
        status: 'uploaded'
      }));

      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, ...newDocuments]
      }));

      toast.success(`${files.length} file(s) uploaded for ${documentType}`);
    }
    
    // Reset file input
    e.target.value = '';
  }, []);

  const removeDocument = useCallback((documentId) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter(doc => doc.id !== documentId)
    }));
    toast.success('Document removed');
  }, []);

  const getFileIcon = useCallback((fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch(extension) {
      case 'pdf':
        return <FaFilePdf className="text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FaFileImage className="text-green-500" />;
      case 'doc':
      case 'docx':
        return <FaFileWord className="text-blue-500" />;
      case 'xls':
      case 'xlsx':
        return <FaFileExcel className="text-green-600" />;
      default:
        return <FaFile className="text-gray-500" />;
    }
  }, []);

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    
    // Combine formData with contactPersons for submission
    const completeFormData = {
      ...formData,
      contactPersons: contactPersons
    };
    
    console.log('Form submitted:', completeFormData);
    
    if (!formData.customerDisplayName.trim()) {
      toast.error("Please fill customer display name");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await handleAddcustomer(completeFormData);
      
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
        customFields: {},
        reportingTags: [],
        remarks: '',
        documents: [],
        currency: 'UAE Dirham',
        paymentTerms: 'Due on Receipt'
      });
      
      setContactPersons([]);
      
      // Show success message
      toast.success("Customer created successfully!");
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate("/sales/customers"); 
      }, 2000);
      
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error("Error adding customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = useCallback(() => {
    navigate('/sales/customers'); 
  }, [navigate]);

  const TabContent = () => {
    switch (activeTab) {
      case 'finance':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
                <input
                  type="text"
                  name="credit_limit"
                  value={formData.credit_limit || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Credit Limit"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Postal Code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Used</label>
                <input
                  type="text"
                  name="credit_limit"
                  value={formData.credit_limit || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Credit Limit"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No of Days</label>
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
          </div>
        );
      
      case 'documents':
        return (
          <div className="space-y-6">
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                Upload required documents for customer verification. Maximum file size: 5MB per file.
              </p>
            </div>
            
            {documentTypes.map((docType) => (
              <div key={docType.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-medium text-gray-800">
                      {docType.label}
                      {docType.required && <span className="text-red-500 ml-1">*</span>}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {docType.required ? 'Required document' : 'Optional document'}
                    </p>
                  </div>
                  <label className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 cursor-pointer">
                    <AiOutlineFileAdd className="inline mr-2" />
                    Upload File
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => handleFileUpload(docType.id, e)}
                    />
                  </label>
                </div>
                
                {/* Uploaded files for this document type */}
                {formData.documents.filter(doc => doc.type === docType.id).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.documents
                      .filter(doc => doc.type === docType.id)
                      .map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex items-center space-x-3">
                            <div className="text-xl">
                              {getFileIcon(doc.name)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(doc.size)} • Uploaded: {new Date(doc.uploadDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDocument(doc.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Remove document"
                          >
                            <AiOutlineDelete size={20} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Upload Guidelines:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Maximum 10 files total, 5MB each</li>
                <li>• Accepted formats: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX</li>
                <li>• Required documents are marked with *</li>
                <li>• Clear, readable scans are recommended</li>
              </ul>
            </div>
            
            {/* Summary of uploaded documents */}
            {formData.documents.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Upload Summary:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {documentTypes.map(docType => {
                    const count = formData.documents.filter(doc => doc.type === docType.id).length;
                    if (count > 0) {
                      return (
                        <div key={docType.id} className="flex items-center justify-between p-2 bg-white rounded border">
                          <span className="text-sm text-gray-700">{docType.label}</span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {count} file{count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  }).filter(Boolean)}
                </div>
              </div>
            )}
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
          <ContactPersonsTab 
            contactPersons={contactPersons}
            setContactPersons={setContactPersons}
          />
        );
      
      case 'custom-fields':
        return (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-700">Custom Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trade License Number</label>
                <input
                  type="text"
                  name="tradeLicenseNumber"
                  value={formData.customFields?.tradeLicenseNumber || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    customFields: {
                      ...prev.customFields,
                      tradeLicenseNumber: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Trade License Number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TRL Number</label>
                <input
                  type="text"
                  name="trlNumber"
                  value={formData.customFields?.trlNumber || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    customFields: {
                      ...prev.customFields,
                      trlNumber: e.target.value
                    }
                  }))}
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
                  name="registrationDate"
                  value={formData.customFields?.registrationDate || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    customFields: {
                      ...prev.customFields,
                      registrationDate: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry Date</label>
                <input
                  type="date"
                  name="licenseExpiryDate"
                  value={formData.customFields?.licenseExpiryDate || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    customFields: {
                      ...prev.customFields,
                      licenseExpiryDate: e.target.value
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
    { id: 'finance', label: 'Finance' },
    { id: 'documents', label: 'Documents' },
    { id: 'address', label: 'Address' },
    { id: 'contact-persons', label: 'Contact Persons' },
    { id: 'custom-fields', label: 'Custom Fields' },
    { id: 'reporting-tags', label: 'Reporting Tags' },
    { id: 'remarks', label: 'Remarks' }
  ];

  // Custom CSS for react-phone-number-input
  const phoneInputStyle = `
    .PhoneInput {
      width: 100%;
    }
    .PhoneInputInput {
      width: 100%;
      height: 38px;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      background-color: white;
    }
    .PhoneInputInput:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
    .PhoneInputCountry {
      border: 1px solid #d1d5db;
      border-right: none;
      border-radius: 0.375rem 0 0 0.375rem;
      background-color: #f9fafb;
      padding: 0 8px;
      height: 38px;
    }
    .PhoneInputCountrySelect {
      padding: 8px;
    }
    .PhoneInputCountrySelectArrow {
      border-top-color: #6b7280;
    }
    
    /* Specific styling for contact person phone inputs */
    .contact-phone-input .PhoneInputInput {
      height: 38px;
    }
    .contact-phone-input .PhoneInputCountry {
      height: 38px;
    }
  `;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <style>{phoneInputStyle}</style>
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
                    international
                    countryCallingCodeEditable={false}
                    defaultCountry="AE"
                    value={formData.customerPhone}
                    onChange={(value) => handlePhoneChange(value, 'customerPhone')}
                    className="w-full"
                    placeholder="Customer Phone"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile
                  </label>
                  <PhoneInput
                    international
                    countryCallingCodeEditable={false}
                    defaultCountry="AE"
                    value={formData.mobile}
                    onChange={(value) => handlePhoneChange(value, 'mobile')}
                    className="w-full"
                    placeholder="Mobile Number"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work Phone (Optional)
                  </label>
                  <PhoneInput
                    international
                    countryCallingCodeEditable={false}
                    defaultCountry="AE"
                    value={formData.workPhone}
                    onChange={(value) => handlePhoneChange(value, 'workPhone')}
                    className="w-full"
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
                      {tab.id === 'documents' && formData.documents.length > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                          {formData.documents.length}
                        </span>
                      )}
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
                {isSubmitting ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default Newcustomers;