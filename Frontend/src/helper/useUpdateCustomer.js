import nexusToast from './nexusToast';
import axiosInstance from './axiosInstance';

const useUpdateCustomer = () => {

  const handleUpdateCustomer = async (id, inputs) => {
    try {
      const contactPersons = (inputs.contactPersons || []).map(cp => {
        const entry = { ...cp };
        delete entry.id;
        return entry;
      });

      const documents = (inputs.documents || [])
        .filter(doc => doc.status !== 'uploading')
        .map(doc => {
          const entry = {
            name:        doc.name        || '',
            type:        doc.type        || '',
            url:         doc.url         || '',
            size:        doc.size        || 0,
            uploadDate:  doc.uploadDate  || new Date().toISOString(),
            status:      doc.url ? 'uploaded' : (doc.status || 'pending'),
            description: doc.description || '',
          };
          // Preserve existing server-side _id so backend doesn't create duplicates
          if (doc._id) entry._id = doc._id;
          return entry;
        });

      const creditLimit = parseFloat(inputs.credit_limit) || 0;
      const creditUsed  = parseFloat(inputs.credit_used)  || 0;
      const noOfDays    = parseFloat(inputs.no_of_days)   || 0;

      const payload = {
        customerType:        inputs.customerType        || 'business',
        salutation:          inputs.salutation          || '',
        firstName:           inputs.firstName           || '',
        lastName:            inputs.lastName            || '',
        customerDisplayName: inputs.customerDisplayName || '',
        companyName:         inputs.companyName         || '',

        customerEmail: inputs.customerEmail || '',
        customerPhone: inputs.customerPhone || '',
        workPhone:     inputs.workPhone     || '',
        mobile:        inputs.mobile        || '',

        streetAddress: inputs.streetAddress || '',
        city:          inputs.city          || '',
        postalCode:    inputs.postalCode    || '',
        country:       inputs.country       || '',

        currency:             inputs.currency             || 'UAE Dirham',
        payment_terms:        inputs.paymentTerms         || 'Due on Receipt',
        credit_limit:         creditLimit,
        credit_limit_action:  inputs.credit_limit_action  || 'warn',
        credit_used:          creditUsed,
        no_of_days:           noOfDays,

        trnNumber: inputs.trnNumber || '',
        legalForm: inputs.legalForm || '',

        contactPersons: contactPersons,
        documents:      documents,

        custom_fields:  inputs.customFields  || {},
        reporting_tags: inputs.reportingTags || [],
        remarks:        inputs.remarks       || '',
      };

      console.log('[useUpdateCustomer] documents payload:', JSON.stringify(documents, null, 2));
      const response = await axiosInstance.put(`/api/customers/${id}`, payload);

      nexusToast.success('Customer updated successfully!');
      return response.data;

    } catch (error) {
      console.error('Error during update customer:', error);
      const msg = error.response?.data?.message || 'Unable to update the customer.';
      nexusToast.error(msg);
      throw error;
    }
  };

  return { handleUpdateCustomer };
};

export default useUpdateCustomer;
