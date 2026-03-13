import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { IoIosClose } from "react-icons/io";

const EditCustomer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
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
    paymentTerms: 'Due on Receipt',
    remarks: '',
    status: 'active'
  });

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const response = await axios.get(`http://localhost:8080/api/customers/${id}`);
      if (response.data && response.data.data) {
        setFormData(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch customer details');
      navigate('/sales/customers');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhoneChange = (value, name) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customerDisplayName.trim()) {
      toast.error("Please fill customer display name");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await axios.put(`http://localhost:8080/api/customers/${id}`, formData);
      toast.success("Customer updated successfully!");
      setTimeout(() => {
        navigate("/sales/customers");
      }, 1500);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/sales/customers');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">Edit Customer</h1>
            <p className="text-blue-100 mt-1">Editing: {formData.customerDisplayName}</p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6">
            {/* Copy the form fields from Newcustomers.jsx */}
            {/* Make sure to use formData state and handleChange */}
            
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Update Customer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditCustomer;