import { toast } from 'react-hot-toast';
import axiosInstance from './axiosInstance/'; // ← carries Authorization header automatically

const useAddCustomer = () => {

  const handleAddcustomer = async (inputs) => {
    try {

      // ── 1. contactPersons ─────────────────────────────────────────────
      // The form gives each entry a local id: Date.now() so React can key
      // the list. The backend assigns real ObjectIDs; sending a JS timestamp
      // as _id would cause a BSON ObjectID parse error in Go.
      const contactPersons = (inputs.contactPersons || []).map(
        ({ id: _localId, ...rest }) => rest  // strip local UI key
      );

      // ── 2. documents ──────────────────────────────────────────────────
      // File() objects cannot be JSON-serialised. We forward only the
      // metadata the backend model needs; binary upload should use a
      // separate multipart endpoint.
      const documents = (inputs.documents || []).map(
        ({ file: _blob, id: _localId, ...rest }) => ({
          name:        rest.name        || '',
          type:        rest.type        || '',        // matches DOCUMENT_TYPES id
          size:        rest.size        || 0,
          uploadDate:  rest.uploadDate  || new Date().toISOString(),
          status:      rest.status      || 'pending',
          description: rest.description || '',
        })
      );

      // ── 3. Numeric fields ─────────────────────────────────────────────
      // The form stores these as strings (''); Go expects float64.
      const creditLimit = parseFloat(inputs.credit_limit) || 0;
      const creditUsed  = parseFloat(inputs.credit_used)  || 0;
      const noOfDays    = parseFloat(inputs.no_of_days)   || 0;

      // ── 4. Build payload — json keys MUST match model json tags ───────
      //
      //  Form field name     →  Backend json tag
      //  ─────────────────      ─────────────────
      //  paymentTerms        →  payment_terms
      //  reportingTags       →  reporting_tags
      //  customFields        →  custom_fields
      //  credit_limit        →  credit_limit       (already snake_case ✓)
      //  credit_used         →  credit_used        (new field)
      //  no_of_days          →  no_of_days         (new field)
      //
      const payload = {
        // ── Identity
        customerType:        inputs.customerType        || 'business',
        salutation:          inputs.salutation          || '',
        firstName:           inputs.firstName           || '',
        lastName:            inputs.lastName            || '',
        customerDisplayName: inputs.customerDisplayName || '',
        companyName:         inputs.companyName         || '',

        // ── Contact
        customerEmail: inputs.customerEmail || '',
        customerPhone: inputs.customerPhone || '',
        workPhone:     inputs.workPhone     || '',
        mobile:        inputs.mobile        || '',

        // ── Address
        streetAddress: inputs.streetAddress || '',
        city:          inputs.city          || '',
        postalCode:    inputs.postalCode    || '',
        country:       inputs.country       || '',

        // ── Finance  (form name → model json tag)
        currency:      inputs.currency     || 'UAE Dirham',
        payment_terms: inputs.paymentTerms || 'Due on Receipt',  // ← mapped
        credit_limit:  creditLimit,
        credit_used:   creditUsed,    // ← new field
        no_of_days:    noOfDays,      // ← new field

        // ── Relations
        contactPersons: contactPersons,
        documents:      documents,

        // ── Extras  (form name → model json tag)
        custom_fields:  inputs.customFields  || {},   // ← mapped
        reporting_tags: inputs.reportingTags || [],   // ← mapped
        remarks:        inputs.remarks       || '',
      };

      const response = await axiosInstance.post('/api/customers/addcustomers', payload);

      toast.success('Customer added successfully!', { duration: 4000 });
      return response.data;

    } catch (error) {
      console.error('Error during add customer:', error);
      const msg = error.response?.data?.message || 'Unable to add the customer.';
      toast.error(msg);
      throw error;
    }
  };

  return { handleAddcustomer };
};

export default useAddCustomer;