import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import useAddCustomer from '../../helper/useAddCustomer';
import useUpdateCustomer from '../../helper/useUpdateCustomer';
import axiosInstance from '../../helper/axiosInstance';
import toast from "../../helper/nexusToast";
import PhoneInput, { getCountryCallingCode } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { AiOutlineFileAdd, AiOutlineDelete } from "react-icons/ai";
import {
  FaFilePdf, FaFileImage, FaFileWord, FaFileExcel, FaFile,
  FaUser, FaBuilding, FaEnvelope, FaPhone, FaMapMarkerAlt,
  FaFileAlt, FaTags, FaStickyNote, FaWallet, FaChevronLeft,
  FaPlus, FaTimes, FaCheckCircle
} from "react-icons/fa";
import useThemeStore, { getTheme } from '../../store/useThemeStore';
import cc from 'currency-codes';

// All ISO 4217 currencies: { label: "UAE Dirham (AED)", value: "AED" }
const CURRENCY_OPTIONS = cc.codes().map(code => {
  const d = cc.code(code);
  return d ? { label: `${d.currency} (${code})`, value: code } : null;
}).filter(Boolean);

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Due on Receipt', label: 'Due on Receipt' },
  { value: 'Net 7',          label: 'Net 7 — due in 7 days' },
  { value: 'Net 15',         label: 'Net 15 — due in 15 days' },
  { value: 'Net 30',         label: 'Net 30 — due in 30 days' },
  { value: 'Net 45',         label: 'Net 45 — due in 45 days' },
  { value: 'Net 60',         label: 'Net 60 — due in 60 days' },
  { value: 'Net 90',         label: 'Net 90 — due in 90 days' },
  { value: '50% Advance',    label: '50% Advance — balance on delivery' },
  { value: '100% Advance',   label: '100% Advance — full payment upfront' },
  { value: 'Custom',         label: 'Custom — specify No. of Days' },
];

// ── Dynamic CSS (theme-aware) ──────────────────────────────────────
const makeStyles = (T, isDark) => `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
  .nc-root { font-family: 'DM Sans', sans-serif; }

  .PhoneInput { width: 100%; display: flex; }
  .PhoneInputInput {
    flex: 1; height: 42px; padding: 0 14px;
    border: 1.5px solid ${T.border}; border-left: none;
    border-radius: 0 10px 10px 0;
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    background: ${T.surface}; color: ${T.textPri}; outline: none;
    transition: border-color 0.15s;
  }
  .PhoneInputInput::placeholder { color: ${isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}; }
  .PhoneInputInput:focus { border-color: ${isDark ? 'rgba(59,130,246,0.55)' : '#93c5fd'}; }
  .PhoneInputCountry {
    border: 1.5px solid ${T.border}; border-right: none;
    border-radius: 10px 0 0 10px;
    background: ${T.surface2}; padding: 0;
    height: 42px; display: flex; align-items: center;
  }

  .nc-input {
    width: 100%; height: 42px; padding: 0 14px;
    border: 1.5px solid ${T.border}; border-radius: 10px;
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    color: ${T.textPri}; background: ${T.surface}; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }
  .nc-input:focus { border-color: ${isDark ? 'rgba(59,130,246,0.55)' : '#93c5fd'}; box-shadow: 0 0 0 3px ${isDark ? 'rgba(59,130,246,0.1)' : 'rgba(147,197,253,0.2)'}; }
  .nc-input::placeholder { color: ${isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}; }

  .nc-select {
    width: 100%; height: 42px; padding: 0 14px;
    border: 1.5px solid ${T.border}; border-radius: 10px;
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    color: ${T.textPri}; background: ${T.surface}; outline: none;
    cursor: pointer; transition: border-color 0.15s;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 36px;
  }
  .nc-select:focus { border-color: ${isDark ? 'rgba(59,130,246,0.55)' : '#93c5fd'}; box-shadow: 0 0 0 3px ${isDark ? 'rgba(59,130,246,0.1)' : 'rgba(147,197,253,0.2)'}; }

  .nc-textarea {
    width: 100%; padding: 12px 14px;
    border: 1.5px solid ${T.border}; border-radius: 10px;
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    color: ${T.textPri}; background: ${T.surface}; outline: none;
    resize: vertical; min-height: 100px;
    transition: border-color 0.15s; box-sizing: border-box;
  }
  .nc-textarea:focus { border-color: ${isDark ? 'rgba(59,130,246,0.55)' : '#93c5fd'}; box-shadow: 0 0 0 3px ${isDark ? 'rgba(59,130,246,0.1)' : 'rgba(147,197,253,0.2)'}; }
  .nc-textarea::placeholder { color: ${isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}; }

  .tab-btn { transition: all 0.15s; }
  .tab-btn:hover { background: ${T.surface2} !important; }
  .tab-btn-active { background: ${T.surface} !important; color: ${isDark ? '#60a5fa' : '#1d4ed8'} !important; box-shadow: 0 1px 4px rgba(0,0,0,${isDark ? '0.3' : '0.08'}); }

  .type-card { transition: all 0.18s; cursor: pointer; }
  .type-card:hover { border-color: ${isDark ? 'rgba(59,130,246,0.5)' : '#93c5fd'} !important; }
  .type-card-active { border-color: ${isDark ? '#3b82f6' : '#2563eb'} !important; background: ${isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff'} !important; }

  .upload-zone { transition: all 0.15s; cursor: pointer; }
  .upload-zone:hover { border-color: ${isDark ? 'rgba(59,130,246,0.5)' : '#93c5fd'} !important; background: ${isDark ? 'rgba(59,130,246,0.07)' : '#f0f7ff'} !important; }

  .action-btn-secondary { transition: all 0.15s; }
  .action-btn-secondary:hover { background: ${T.surface2} !important; border-color: ${T.border} !important; }

  .save-btn { transition: all 0.15s; }
  .save-btn:hover:not(:disabled) { background: ${isDark ? '#2563eb' : '#1d4ed8'} !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37,99,235,0.3) !important; }

  .contact-card { transition: all 0.15s; }
  .contact-card:hover { border-color: ${isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'} !important; }

  .tag-chip { transition: all 0.12s; }
  .tag-chip:hover { background: ${isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2'} !important; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes ncModalIn { from { opacity: 0; transform: scale(.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
`;

// ── Shared sub-components (accept T + isDark as props) ─────────────
const Label = ({ children, required, T }) => (
  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>
    {children}{required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
  </label>
);

const SectionHeader = ({ icon, title, subtitle, T, isDark }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: isDark ? '#60a5fa' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <p style={{ fontSize: '15px', fontWeight: '700', color: T.textPri, margin: 0 }}>{title}</p>
      {subtitle && <p style={{ fontSize: '12px', color: T.textSec, margin: '2px 0 0' }}>{subtitle}</p>}
    </div>
  </div>
);

// ── Document types ─────────────────────────────────────────────────
const DOCUMENT_TYPES = [
  { id: 'trade_license',     label: 'Trade License',    required: true  },
  { id: 'trl_copy',          label: 'TRL Copy',          required: true  },
  { id: 'owners_passport',   label: "Owner's Passport",  required: true  },
  { id: 'eid_copy',          label: 'EID Copy',          required: true  },
  { id: 'power_of_attorney', label: 'Power of Attorney', required: false },
  { id: 'other',             label: 'Other Documents',   required: false },
];

// ── Tab panel components ───────────────────────────────────────────
const FinanceTab = ({ formData, handleChange, T, isDark }) => (
  <div>
    <SectionHeader icon={<FaWallet />} title="Finance Details" subtitle="Set credit limits and payment terms" T={T} isDark={isDark} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <div>
        <Label T={T}>Credit Limit</Label>
        <input className="nc-input" name="credit_limit" value={formData.credit_limit || ''} onChange={handleChange} placeholder="e.g. 50,000" />
      </div>
      <div>
        <Label T={T} style={{ opacity: formData.paymentTerms === 'Custom' ? 1 : 0.4 }}>
          No. of Days {formData.paymentTerms !== 'Custom' && <span style={{ fontSize: 10, fontWeight: 400 }}>(only for Custom terms)</span>}
        </Label>
        <input className="nc-input" name="no_of_days" value={formData.no_of_days || ''}
          onChange={handleChange} placeholder="e.g. 45"
          disabled={formData.paymentTerms !== 'Custom'}
          style={{ opacity: formData.paymentTerms === 'Custom' ? 1 : 0.35, cursor: formData.paymentTerms !== 'Custom' ? 'not-allowed' : 'text' }} />
      </div>
      <div>
        <Label T={T}>Payment Terms</Label>
        <CustomSelect
          name="paymentTerms"
          value={formData.paymentTerms || 'Due on Receipt'}
          onChange={handleChange}
          options={PAYMENT_TERMS_OPTIONS}
          placeholder="Select payment terms"
          T={T}
          isDark={isDark}
        />
      </div>
      <div>
        <Label T={T}>Currency</Label>
        <CustomSelect name="currency" value={formData.currency} onChange={handleChange}
          options={CURRENCY_OPTIONS} placeholder="Select currency" T={T} isDark={isDark} />
      </div>
      <div>
        <Label T={T}>Credit Limit Action</Label>
        <CustomSelect
          name="credit_limit_action"
          value={formData.credit_limit_action || 'warn'}
          onChange={handleChange}
          options={[
            { value: 'warn',  label: 'Warn only — allow order with warning' },
            { value: 'block', label: 'Block — reject order when limit exceeded' },
          ]}
          placeholder="Select action"
          T={T}
          isDark={isDark}
        />
      </div>
    </div>
  </div>
);

const AddressTab = ({ formData, handleChange, T, isDark }) => (
  <div>
    <SectionHeader icon={<FaMapMarkerAlt />} title="Address" subtitle="Customer's billing and shipping address" T={T} isDark={isDark} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <Label T={T}>Street Address</Label>
        <textarea className="nc-textarea" name="streetAddress" value={formData.streetAddress}
          onChange={handleChange} placeholder="Enter full street address" rows={3} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <Label T={T}>City</Label>
          <input className="nc-input" name="city" value={formData.city} onChange={handleChange} placeholder="Dubai" />
        </div>
        <div>
          <Label T={T}>Postal Code</Label>
          <input className="nc-input" name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="00000" />
        </div>
      </div>
      <div>
        <Label T={T}>Country</Label>
        <input className="nc-input" name="country" value={formData.country} onChange={handleChange} placeholder="United Arab Emirates" />
      </div>
    </div>
  </div>
);

const ContactPersonsTab = ({ contactPersons, setContactPersons, T, isDark }) => {
  const handleAdd = useCallback(() => {
    setContactPersons(prev => [...prev, { id: Date.now(), name: '', email: '', phone: '' }]);
  }, [setContactPersons]);

  const handleUpdate = useCallback((index, field, value) => {
    setContactPersons(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, [setContactPersons]);

  const handleRemove = useCallback((index) => {
    setContactPersons(prev => prev.filter((_, i) => i !== index));
  }, [setContactPersons]);

  return (
    <div>
      <SectionHeader icon={<FaUser />} title="Contact Persons" subtitle="Add additional contacts for this customer" T={T} isDark={isDark} />
      {contactPersons.length === 0 ? (
        <div style={{ border: `1.5px dashed ${T.border}`, borderRadius: '12px', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: T.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: T.textSec, margin: '0 auto 12px' }}>
            <FaUser />
          </div>
          <p style={{ fontWeight: '600', color: T.textPri, fontSize: '14px', margin: '0 0 4px' }}>No contacts yet</p>
          <p style={{ color: T.textSec, fontSize: '12px', margin: '0 0 16px' }}>Add contact persons for this customer</p>
          <button type="button" onClick={handleAdd}
            style={{ padding: '8px 18px', background: isDark ? T.blue : '#2563eb', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FaPlus size={11} /> Add Contact
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {contactPersons.map((contact, index) => (
            <div key={contact.id} className="contact-card"
              style={{ border: `1.5px solid ${T.border}`, borderRadius: '12px', padding: '18px', background: T.surface2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: isDark ? '#60a5fa' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>
                    {index + 1}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: T.textPri }}>Contact Person</span>
                </div>
                <button type="button" onClick={() => handleRemove(index)}
                  style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '7px', padding: '5px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', fontFamily: 'inherit' }}>
                  <FaTimes size={10} /> Remove
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <Label T={T}>Name</Label>
                  <input className="nc-input" type="text" value={contact.name}
                    onChange={e => handleUpdate(index, 'name', e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <Label T={T}>Email</Label>
                  <input className="nc-input" type="email" value={contact.email}
                    onChange={e => handleUpdate(index, 'email', e.target.value)} placeholder="email@company.com" />
                </div>
                <div>
                  <Label T={T}>Phone</Label>
                  <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                    countrySelectComponent={CountrySelect}
                    value={contact.phone || ''} onChange={val => handleUpdate(index, 'phone', val || '')} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={handleAdd}
            style={{ padding: '10px', border: `1.5px dashed ${isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'}`, borderRadius: '10px', background: isDark ? 'rgba(59,130,246,0.05)' : '#f8fbff', color: isDark ? '#60a5fa' : '#2563eb', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
            <FaPlus size={11} /> Add Another Contact
          </button>
        </div>
      )}
    </div>
  );
};

const DocumentsTab = ({ documents, handleFileUpload, removeDocument, getFileIcon, formatFileSize, T, isDark }) => (
  <div>
    <SectionHeader icon={<FaFileAlt />} title="Documents" subtitle="Upload required verification documents (max 5MB each)" T={T} isDark={isDark} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {DOCUMENT_TYPES.map(docType => {
        const docs = documents.filter(d => d.type === docType.id);
        return (
          <div key={docType.id} style={{ border: `1.5px solid ${T.border}`, borderRadius: '12px', padding: '16px', background: T.surface2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: docs.length > 0 ? '14px' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {docs.length > 0 && (
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(22,163,74,0.15)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                    <FaCheckCircle />
                  </div>
                )}
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: T.textPri, margin: 0 }}>
                    {docType.label}{docType.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                  </p>
                  <p style={{ fontSize: '11px', color: T.textSec, margin: '2px 0 0' }}>
                    {docType.required ? 'Required' : 'Optional'}{docs.length > 0 ? ` · ${docs.length} file(s)` : ''}
                  </p>
                </div>
              </div>
              <label className="upload-zone"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: `1.5px dashed ${isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe'}`, borderRadius: '9px', background: isDark ? 'rgba(59,130,246,0.05)' : '#f8fbff', color: isDark ? '#60a5fa' : '#2563eb', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                <AiOutlineFileAdd size={14} /> Upload
                <input type="file" style={{ display: 'none' }} multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={e => handleFileUpload(docType.id, e)} />
              </label>
            </div>
            {docs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {docs.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: T.surface, borderRadius: '9px', border: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '18px' }}>{getFileIcon(doc.name)}</div>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: '600', color: T.textPri, margin: 0 }}>{doc.name}</p>
                        <p style={{ fontSize: '11px', color: T.textSec, margin: '2px 0 0' }}>{formatFileSize(doc.size)} · {new Date(doc.uploadDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeDocument(doc.id)}
                      style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '7px', padding: '5px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                      <AiOutlineDelete size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ padding: '14px 16px', background: isDark ? 'rgba(3,105,161,0.1)' : '#f0f9ff', borderRadius: '10px', border: `1px solid ${isDark ? 'rgba(3,105,161,0.3)' : '#bae6fd'}` }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#38bdf8' : '#0369a1', margin: '0 0 6px' }}>Upload Guidelines</p>
        <p style={{ fontSize: '12px', color: isDark ? '#7dd3fc' : '#0284c7', margin: 0, lineHeight: 1.6 }}>
          Max 10 files · 5MB each · PDF, JPG, PNG, DOC, XLS accepted · Clear, readable scans preferred
        </p>
      </div>
    </div>
  </div>
);

// ── Discard Modal ─────────────────────────────────────────────────
function DiscardModal({ onConfirm, onCancel, T, isDark }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onCancel} />
      <div style={{
        position: 'relative', zIndex: 1, width: 360, background: T.surface,
        border: `1.5px solid ${T.border}`, borderRadius: 20,
        padding: '32px 28px', textAlign: 'center',
        boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(0,0,0,0.14)',
        animation: 'ncModalIn .2s cubic-bezier(.34,1.56,.64,1) both',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>⚠</div>
        <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: T.textPri, margin: '0 0 8px', fontWeight: 700 }}>Discard this customer?</h2>
        <p style={{ fontSize: 13, color: T.textSec, margin: '0 0 24px', lineHeight: 1.5 }}>All unsaved data will be permanently lost.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onConfirm} style={{ flex: 1, padding: '11px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Yes, discard
          </button>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px', background: T.surface2, color: T.textPri, border: `1.5px solid ${T.border}`, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom Select — portal-based dropdown ──────────────────────────
const CustomSelect = ({ value, onChange, options, label, placeholder = 'Select', name, T, isDark }) => {
  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const [query,   setQuery]   = useState('');
  const triggerRef  = useRef(null);
  const dropRef     = useRef(null);
  const rafRef      = useRef(null);
  const searchRef   = useRef(null);

  const searchable = options.length > 10;
  const filtered   = searchable && query
    ? options.filter(o => (o.label ?? o).toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = options.find(o => (o.value ?? o) === value);
  const display  = selected ? (selected.label ?? selected) : null;

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const listH   = Math.min(filtered.length * 44, 244); // matches maxHeight:244 in render
    const headerH = searchable ? 56 : 0;
    const dropH   = listH + headerH + 16;                // +16 for inner padding
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top, left: r.left, width: r.width });
    setReady(true);
  }, [filtered.length, searchable]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); setQuery(''); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        measurePos();
        setTimeout(() => searchRef.current?.focus(), 50);
      });
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    if (!open) return;
    const s = () => measurePos(), r = () => measurePos();
    window.addEventListener('scroll', s, true);
    window.addEventListener('resize', r);
    return () => { window.removeEventListener('scroll', s, true); window.removeEventListener('resize', r); };
  }, [open, measurePos]);

  useEffect(() => {
    const h = e => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          dropRef.current    && !dropRef.current.contains(e.target)) {
        setOpen(false); setReady(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = (opt) => {
    onChange({ target: { name, value: opt.value ?? opt } });
    setOpen(false); setReady(false); setQuery('');
  };

  const activeColor = isDark ? '#60a5fa' : '#1d4ed8';
  const activeBg    = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff';
  const hoverBg     = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc';

  const dropdown = (
    <div ref={dropRef}
      style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width,
               zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: '12px',
               boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 16px 48px rgba(0,0,0,0.12)',
               overflow: 'hidden', fontFamily: "'DM Sans', sans-serif",
               boxSizing: 'border-box', visibility: ready ? 'visible' : 'hidden',
               opacity: ready ? 1 : 0, transition: 'opacity 0.12s ease' }}>
      {searchable && (
        <div style={{ padding: '8px 8px 4px', borderBottom: `1px solid ${T.border}` }}>
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search currency…"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', height: '34px', padding: '0 12px', border: `1.5px solid ${T.border}`, borderRadius: '8px',
                     fontSize: '12px', background: T.surface2, color: T.textPri, outline: 'none',
                     fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
      )}
      <div style={{ maxHeight: '244px', overflowY: 'auto', padding: '6px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: T.textMuted }}>No results</div>
        ) : filtered.map((opt, i) => {
          const val   = opt.value ?? opt;
          const lbl   = opt.label ?? opt;
          const isAct = val === value;
          return (
            <div key={i} onClick={() => select(opt)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                       padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                       fontWeight: isAct ? '600' : '400',
                       color: isAct ? activeColor : T.textPri,
                       background: isAct ? activeBg : 'transparent',
                       transition: 'background 0.1s' }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = hoverBg; }}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}>
              {lbl}
              {isAct && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      {label && <Label T={T}>{label}</Label>}
      <div ref={triggerRef} onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                 height: '42px', padding: '0 14px',
                 border: `1.5px solid ${open ? (isDark ? 'rgba(59,130,246,0.55)' : '#93c5fd') : T.border}`,
                 borderRadius: '10px', background: T.surface, cursor: 'pointer',
                 boxShadow: open ? `0 0 0 3px ${isDark ? 'rgba(59,130,246,0.1)' : 'rgba(147,197,253,0.2)'}` : 'none',
                 transition: 'border-color 0.15s, box-shadow 0.15s',
                 boxSizing: 'border-box', userSelect: 'none' }}>
        <span style={{ fontSize: '13px', color: display ? T.textPri : (isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'),
                       fontFamily: "'DM Sans', sans-serif", fontWeight: display ? '500' : '400' }}>
          {display || placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={open ? (isDark ? '#60a5fa' : '#2563eb') : T.textSec}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
};

// ── CountrySelect — custom portal dropdown for PhoneInput ─────────
const CountrySelect = ({ value, onChange, options, iconComponent }) => {
  const FlagIcon = iconComponent;
  const isDark = useThemeStore(s => s.isDark);
  const T = { ...getTheme(isDark), isDark };

  const [open,    setOpen]    = useState(false);
  const [ready,   setReady]   = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 260 });
  const [query,   setQuery]   = useState('');
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);
  const searchRef  = useRef(null);

  const countryOptions = options.filter(o => o.value);
  const filtered = query
    ? countryOptions.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : countryOptions;

  const getCode = code => { try { return '+' + getCountryCallingCode(code); } catch { return ''; } };

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(filtered.length * 42 + 60, 320);
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 6 : r.top - dropH - 6;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: 260 });
    setReady(true);
  }, [filtered.length]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); setQuery(''); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        measurePos();
        setTimeout(() => searchRef.current?.focus(), 50);
      });
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    if (!open) return;
    const repos = () => measurePos();
    window.addEventListener('scroll', repos, true);
    window.addEventListener('resize', repos);
    return () => { window.removeEventListener('scroll', repos, true); window.removeEventListener('resize', repos); };
  }, [open, measurePos]);

  useEffect(() => {
    const h = e => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          dropRef.current    && !dropRef.current.contains(e.target)) {
        setOpen(false); setReady(false); setQuery('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = code => { onChange(code); setOpen(false); setReady(false); setQuery(''); };

  const activeColor = isDark ? '#60a5fa' : '#2563eb';
  const activeBg    = isDark ? 'rgba(59,130,246,.15)' : '#eff6ff';
  const hoverBg     = isDark ? 'rgba(255,255,255,.05)' : '#f8fafc';

  const dropdown = (
    <div ref={dropRef} style={{
      position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width,
      zIndex: 99999, background: T.surface, border: `1.5px solid ${T.border}`,
      borderRadius: 14, fontFamily: "'DM Sans', sans-serif",
      boxShadow: isDark ? '0 20px 60px rgba(0,0,0,.6)' : '0 20px 60px rgba(0,0,0,.15)',
      overflow: 'hidden', visibility: ready ? 'visible' : 'hidden',
      opacity: ready ? 1 : 0, transition: 'opacity .12s ease',
    }}>
      <div style={{ padding: '10px 10px 6px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 10px', height: 36,
          border: `1.5px solid ${T.border}`, borderRadius: 9, background: T.surface2,
        }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T.textSec} strokeWidth={2.5} strokeLinecap="round">
            <circle cx={11} cy={11} r={8}/><line x1={21} y1={21} x2={16.65} y2={16.65}/>
          </svg>
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search country…" onClick={e => e.stopPropagation()}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                     fontSize: 12, color: T.textPri, fontFamily: 'inherit' }} />
          {query && (
            <button onClick={e => { e.stopPropagation(); setQuery(''); }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.textSec, display: 'flex' }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/>
              </svg>
            </button>
          )}
        </div>
      </div>
      <div style={{ maxHeight: 252, overflowY: 'auto', padding: 6 }}>
        {filtered.length === 0
          ? <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: T.textSec }}>No results</div>
          : filtered.map(opt => {
              const isAct = opt.value === value;
              return (
                <div key={opt.value} onClick={() => select(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 9, cursor: 'pointer',
                    background: isAct ? activeBg : 'transparent', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = hoverBg; }}
                  onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: 24, height: 16, borderRadius: 3, overflow: 'hidden', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}>
                    <FlagIcon country={opt.value} />
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: isAct ? activeColor : T.textPri,
                                 fontWeight: isAct ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 11, color: isAct ? activeColor : T.textSec, fontWeight: 500, flexShrink: 0 }}>
                    {getCode(opt.value)}
                  </span>
                  {isAct && (
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth={2.5} strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              );
            })
        }
      </div>
    </div>
  );

  return (
    <div ref={triggerRef} onClick={handleOpen}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px 0 10px',
               cursor: 'pointer', height: '100%', userSelect: 'none', flexShrink: 0 }}>
      <div style={{ width: 22, height: 15, borderRadius: 3, overflow: 'hidden', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.25)' }}>
        {value ? <FlagIcon country={value} /> : <span style={{ fontSize: 14 }}>🌐</span>}
      </div>
      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={T.textSec}
        strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
};

// ── Custom DatePicker — portal-based ──────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const DatePicker = ({ value, onChange, label, placeholder = 'Select date' }) => {
  const isDark = useThemeStore(s => s.isDark);
  const T = getTheme(isDark);
  const [open,      setOpen]      = useState(false);
  const [ready,     setReady]     = useState(false);
  const [viewYear,  setViewYear]  = useState(() => value ? new Date(value).getFullYear()  : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? new Date(value).getMonth()     : new Date().getMonth());
  const [pickingY,  setPickingY]  = useState(false);
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = 360;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 6 : r.top - dropH - 6;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, []);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); setPickingY(false); return; }
    setReady(false); setOpen(true);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => measurePos());
    });
  };

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    if (!open) return;
    const s = () => measurePos(), r = () => measurePos();
    window.addEventListener('scroll', s, true);
    window.addEventListener('resize', r);
    return () => { window.removeEventListener('scroll', s, true); window.removeEventListener('resize', r); };
  }, [open, measurePos]);

  useEffect(() => {
    const h = e => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          dropRef.current    && !dropRef.current.contains(e.target)) {
        setOpen(false); setReady(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const parsed      = value ? new Date(value + 'T00:00:00') : null;
  const display     = parsed ? `${String(parsed.getDate()).padStart(2,'0')} ${MONTHS[parsed.getMonth()].slice(0,3)} ${parsed.getFullYear()}` : '';
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const yearRange   = Array.from({ length: 31 }, (_, i) => new Date().getFullYear() - 10 + i);

  const selectDay = d => {
    const iso = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    onChange(iso); setOpen(false); setReady(false);
  };

  const prevMonth = e => { e.stopPropagation(); if (viewMonth === 0) { setViewMonth(11); setViewYear(y=>y-1); } else setViewMonth(m=>m-1); };
  const nextMonth = e => { e.stopPropagation(); if (viewMonth === 11) { setViewMonth(0); setViewYear(y=>y+1); } else setViewMonth(m=>m+1); };

  const isSelected = d => parsed && parsed.getDate() === d && parsed.getMonth() === viewMonth && parsed.getFullYear() === viewYear;
  const isToday    = d => { const t = new Date(); return t.getDate() === d && t.getMonth() === viewMonth && t.getFullYear() === viewYear; };

  const blueC   = isDark ? '#60a5fa' : '#2563eb';
  const blueDim = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff';
  const blueBrd = isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe';

  const calendar = (
    <div ref={dropRef}
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, zIndex: 99999,
               background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: '14px',
               boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.15)',
               padding: '12px', width: '260px',
               fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
               visibility: ready ? 'visible' : 'hidden',
               opacity: ready ? 1 : 0, transition: 'opacity 0.12s ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button type="button" onClick={prevMonth}
          style={{ width: '30px', height: '30px', border: `1.5px solid ${T.border}`, borderRadius: '8px', background: T.surface2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec, flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); setPickingY(p => !p); }}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: pickingY ? blueDim : 'transparent', border: pickingY ? `1.5px solid ${blueBrd}` : '1.5px solid transparent', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: T.textPri }}>
          {MONTHS[viewMonth]} {viewYear}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.textSec} strokeWidth="2.5">
            <polyline points={pickingY ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
          </svg>
        </button>
        <button type="button" onClick={nextMonth}
          style={{ width: '30px', height: '30px', border: `1.5px solid ${T.border}`, borderRadius: '8px', background: T.surface2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec, flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {pickingY ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
          {yearRange.map(y => (
            <button key={y} type="button"
              onClick={e => { e.stopPropagation(); setViewYear(y); setPickingY(false); }}
              style={{ padding: '7px 2px', borderRadius: '7px', fontSize: '12px', fontWeight: y === viewYear ? '700' : '400', border: 'none', cursor: 'pointer', background: y === viewYear ? blueC : 'transparent', color: y === viewYear ? 'white' : T.textPri }}>
              {y}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '6px' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '600', color: T.textSec, padding: '3px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
              <button key={d} type="button" onClick={e => { e.stopPropagation(); selectDay(d); }}
                style={{ aspectRatio: '1', borderRadius: '8px', fontSize: '12px',
                         fontWeight: isSelected(d) ? '700' : isToday(d) ? '600' : '400',
                         border: isToday(d) && !isSelected(d) ? `1.5px solid ${blueBrd}` : 'none',
                         cursor: 'pointer', background: isSelected(d) ? blueC : 'transparent',
                         color: isSelected(d) ? 'white' : isToday(d) ? blueC : T.textPri,
                         display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '26px' }}
                onMouseEnter={e => { if (!isSelected(d)) e.currentTarget.style.background = blueDim; }}
                onMouseLeave={e => { if (!isSelected(d)) e.currentTarget.style.background = 'transparent'; }}>
                {d}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${T.border}` }}>
            <button type="button" onClick={e => { e.stopPropagation(); const t = new Date(); setViewMonth(t.getMonth()); setViewYear(t.getFullYear()); selectDay(t.getDate()); }}
              style={{ flex: 1, padding: '7px', background: blueDim, border: `1.5px solid ${blueBrd}`, borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: blueC, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Today
            </button>
            <button type="button" onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); setReady(false); }}
              style={{ flex: 1, padding: '7px', background: T.surface2, border: `1.5px solid ${T.border}`, borderRadius: '8px', fontSize: '12px', fontWeight: '500', color: T.textSec, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div>
      {label && <Label T={T}>{label}</Label>}
      <div ref={triggerRef} onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                 height: '42px', padding: '0 14px',
                 border: `1.5px solid ${open ? (isDark ? 'rgba(59,130,246,0.55)' : '#93c5fd') : T.border}`,
                 borderRadius: '10px', background: T.surface, cursor: 'pointer',
                 boxShadow: open ? `0 0 0 3px ${isDark ? 'rgba(59,130,246,0.1)' : 'rgba(147,197,253,0.2)'}` : 'none',
                 transition: 'border-color 0.15s, box-shadow 0.15s',
                 boxSizing: 'border-box', width: '100%', userSelect: 'none' }}>
        <span style={{ fontSize: '13px', color: display ? T.textPri : (isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'), fontFamily: "'DM Sans', sans-serif", fontWeight: display ? '500' : '400' }}>
          {display || placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open ? blueC : T.textSec} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      {open && createPortal(calendar, document.body)}
    </div>
  );
};

const CustomFieldsTab = ({ customFields, setFormData, customerType, T, isDark }) => (
  <div>
    <SectionHeader icon={<FaBuilding />} title="Custom Fields" subtitle="Additional business registration details" T={T} isDark={isDark} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {customerType === 'business' && (
        <>
          <div>
            <Label T={T}>Trade License Number</Label>
            <input className="nc-input" type="text" value={customFields?.tradeLicenseNumber || ''} placeholder="TL-XXXXXXXX"
              onChange={e => setFormData(prev => ({ ...prev, customFields: { ...prev.customFields, tradeLicenseNumber: e.target.value } }))} />
          </div>
          <DatePicker label="Registration Date" T={T} isDark={isDark}
            value={customFields?.registrationDate || ''}
            onChange={v => setFormData(prev => ({ ...prev, customFields: { ...prev.customFields, registrationDate: v } }))} />
          <DatePicker label="License Expiry Date" T={T} isDark={isDark}
            value={customFields?.licenseExpiryDate || ''}
            onChange={v => setFormData(prev => ({ ...prev, customFields: { ...prev.customFields, licenseExpiryDate: v } }))} />
        </>
      )}
    </div>
  </div>
);

const ReportingTagsTab = ({ reportingTags, setFormData, T, isDark }) => {
  const [tagInput, setTagInput] = useState('');
  const blueC   = isDark ? '#60a5fa' : '#1d4ed8';
  const blueDim = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff';
  const blueBrd = isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe';

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    setFormData(prev => ({ ...prev, reportingTags: [...prev.reportingTags, v] }));
    setTagInput('');
  };

  return (
    <div>
      <SectionHeader icon={<FaTags />} title="Reporting Tags" subtitle="Categorize this customer with tags" T={T} isDark={isDark} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input className="nc-input" value={tagInput} onChange={e => setTagInput(e.target.value)}
          placeholder="Type a tag and press Add…" style={{ flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
        <button type="button" onClick={addTag}
          style={{ padding: '0 18px', background: isDark ? T.blue : '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FaPlus size={11} /> Add Tag
        </button>
      </div>
      {reportingTags.length === 0 ? (
        <div style={{ border: `1.5px dashed ${T.border}`, borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <FaTags size={24} style={{ color: T.textSec, marginBottom: '10px' }} />
          <p style={{ color: T.textSec, fontSize: '13px', margin: 0 }}>No tags added yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {reportingTags.map((tag, i) => (
            <div key={i} className="tag-chip"
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 12px', background: blueDim, border: `1.5px solid ${blueBrd}`, borderRadius: '999px', fontSize: '12px', fontWeight: '600', color: blueC }}>
              {tag}
              <button type="button"
                onClick={() => setFormData(prev => ({ ...prev, reportingTags: prev.reportingTags.filter((_, idx) => idx !== i) }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#60a5fa' : '#93c5fd', padding: 0, display: 'flex', alignItems: 'center' }}>
                <FaTimes size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RemarksTab = ({ remarks, handleChange, T, isDark }) => (
  <div>
    <SectionHeader icon={<FaStickyNote />} title="Remarks" subtitle="Internal notes about this customer" T={T} isDark={isDark} />
    <textarea className="nc-textarea" name="remarks" value={remarks} onChange={handleChange}
      rows={6} placeholder="Add any notes, special instructions, or relevant information about this customer…" />
  </div>
);

// ── Configurable Salutation Input ──────────────────────────────────
const DEFAULT_SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Prof.', 'Engr.'];

function SalutationInput({ value, onChange, name, T, isDark }) {
  const [salutations, setSalutations] = useState(() => {
    try {
      const saved = localStorage.getItem('erp_salutations');
      return saved ? JSON.parse(saved) : DEFAULT_SALUTATIONS;
    } catch { return DEFAULT_SALUTATIONS; }
  });
  const [showManage, setShowManage] = useState(false);
  const [newSal, setNewSal] = useState('');

  const addSalutation = () => {
    const v = newSal.trim();
    if (!v || salutations.includes(v)) return;
    const updated = [...salutations, v];
    setSalutations(updated);
    localStorage.setItem('erp_salutations', JSON.stringify(updated));
    setNewSal('');
  };

  const removeSalutation = (s) => {
    const updated = salutations.filter(x => x !== s);
    setSalutations(updated);
    localStorage.setItem('erp_salutations', JSON.stringify(updated));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '7px' }}>
        <label style={{ fontSize: '11px', fontWeight: '600', color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Salutation</label>
        <button type="button" onClick={() => setShowManage(true)}
          style={{ fontSize: '10px', color: T.textSec, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          + Manage
        </button>
      </div>
      <select className="nc-select" name={name} value={value} onChange={onChange}>
        <option value="">Select</option>
        {salutations.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {showManage && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: T.surface, borderRadius: '16px', padding: '24px', width: '340px', border: `1.5px solid ${T.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '15px', fontWeight: '700', color: T.textPri, margin: 0 }}>Manage Salutations</p>
              <button type="button" onClick={() => setShowManage(false)}
                style={{ width: '28px', height: '28px', border: `1px solid ${T.border}`, borderRadius: '7px', background: 'transparent', cursor: 'pointer', color: T.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FaTimes size={11} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input className="nc-input" value={newSal} onChange={e => setNewSal(e.target.value)}
                placeholder="e.g. Prof., Engr., HH" style={{ flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSalutation(); } }} />
              <button type="button" onClick={addSalutation}
                style={{ padding: '0 16px', background: isDark ? '#3b82f6' : '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                Add
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {salutations.map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: T.surface2, borderRadius: '999px', border: `1px solid ${T.border}`, fontSize: '12px', fontWeight: '600', color: T.textPri }}>
                  {s}
                  <button type="button" onClick={() => removeSalutation(s)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <FaTimes size={9} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
const Newcustomers = () => {
  const { handleAddcustomer }    = useAddCustomer();
  const { handleUpdateCustomer } = useUpdateCustomer();
  const { id: editId }           = useParams();
  const isEditMode               = !!editId;
  const navigate    = useNavigate();
  const isDark      = useThemeStore((s) => s.isDark);
  const T           = getTheme(isDark);

  const [activeTab,     setActiveTab]     = useState('finance');
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [showDiscard,   setShowDiscard]   = useState(false);
  const [contactPersons,setContactPersons]= useState([]);

  const [salutations, setSalutations] = useState(['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.']);

  // Load org-configured salutations if available
  useEffect(() => {
    axiosInstance.get('/api/org/settings').then(res => {
      const s = res.data?.data?.salutations;
      if (Array.isArray(s) && s.length > 0) setSalutations(s);
    }).catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    customerType: 'business', customerCode: '', salutation: '',
    firstName: '', lastName: '', companyName: '', customerDisplayName: '',
    trnNumber: '', legalForm: '',
    customerEmail: '', customerPhone: '', workPhone: '', mobile: '',
    streetAddress: '', city: '', postalCode: '', country: '',
    customFields: {}, reportingTags: [], remarks: '', documents: [],
    currency: 'AED', paymentTerms: 'Due on Receipt',
    credit_limit: '', no_of_days: '', credit_limit_action: 'warn',
  });

  // Load existing customer when editing
  useEffect(() => {
    if (!isEditMode) return;
    axiosInstance.get(`/api/customers/${editId}`)
      .then(res => {
        const c = res.data?.data || res.data;
        setFormData({
          customerType:        c.customerType        || 'business',
          customerCode:        c.customerCode        || '',
          salutation:          c.salutation          || '',
          firstName:           c.firstName           || '',
          lastName:            c.lastName            || '',
          companyName:         c.companyName         || '',
          customerDisplayName: c.customerDisplayName || '',
          trnNumber:           c.trnNumber           || '',
          legalForm:           c.legalForm           || '',
          customerEmail:       c.customerEmail       || '',
          customerPhone:       c.customerPhone       || '',
          workPhone:           c.workPhone           || '',
          mobile:              c.mobile              || '',
          streetAddress:       c.streetAddress       || '',
          city:                c.city                || '',
          postalCode:          c.postalCode          || '',
          country:             c.country             || '',
          customFields:        c.custom_fields       || {},
          reportingTags:       c.reporting_tags      || [],
          remarks:             c.remarks             || '',
          documents:           c.documents           || [],
          currency:            c.currency            || 'AED',
          paymentTerms:        c.payment_terms       || 'Due on Receipt',
          credit_limit:        c.credit_limit        != null ? String(c.credit_limit) : '',
          no_of_days:          c.no_of_days          != null ? String(c.no_of_days)   : '',
          credit_limit_action: c.credit_limit_action || 'warn',
        });
        setContactPersons(c.contactPersons || []);
      })
      .catch(() => toast.error('Failed to load customer'));
  }, [isEditMode, editId]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }, []);

  const handlePhoneChange = useCallback((value, fieldName) => {
    setFormData(prev => ({ ...prev, [fieldName]: value || '' }));
  }, []);

  const handleFileUpload = useCallback((documentType, e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newDocs = files.map(file => ({
        id: Date.now() + Math.random(), type: documentType, name: file.name, file,
        size: file.size, uploadDate: new Date().toISOString(), status: 'uploaded'
      }));
      setFormData(prev => ({ ...prev, documents: [...prev.documents, ...newDocs] }));
      toast.success(`${files.length} file(s) uploaded`);
    }
    e.target.value = '';
  }, []);

  const removeDocument = useCallback((docId) => {
    setFormData(prev => ({ ...prev, documents: prev.documents.filter(d => d.id !== docId) }));
    toast.success('Document removed');
  }, []);

  const getFileIcon = useCallback((fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'pdf') return <FaFilePdf style={{ color: '#ef4444' }} />;
    if (['jpg','jpeg','png','gif'].includes(ext)) return <FaFileImage style={{ color: '#10b981' }} />;
    if (['doc','docx'].includes(ext)) return <FaFileWord style={{ color: '#2563eb' }} />;
    if (['xls','xlsx'].includes(ext)) return <FaFileExcel style={{ color: '#16a34a' }} />;
    return <FaFile style={{ color: '#94a3b8' }} />;
  }, []);

  const formatFileSize = useCallback((bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerDisplayName.trim()) { toast.error("Customer display name is required"); return; }
    if (!formData.trnNumber.trim()) { toast.error("TRN Number is required"); return; }
    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await handleUpdateCustomer(editId, { ...formData, contactPersons });
        toast.success("Customer updated successfully!");
      } else {
        await handleAddcustomer({ ...formData, contactPersons });
        setFormData({
          customerType: 'business', customerCode: '', salutation: '', firstName: '', lastName: '',
          companyName: '', customerDisplayName: '', trnNumber: '', legalForm: '',
          customerEmail: '', customerPhone: '',
          workPhone: '', mobile: '', streetAddress: '', city: '', postalCode: '', country: '',
          customFields: {}, reportingTags: [], remarks: '', documents: [],
          currency: 'AED', paymentTerms: 'Due on Receipt',
          credit_limit: '', no_of_days: '', credit_limit_action: 'warn',
        });
        setContactPersons([]);
        toast.success("Customer created successfully!");
      }
      setTimeout(() => navigate("/Sales/Customers"), 1800);
    } catch {
      // toast already shown by helper
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'finance',         label: 'Finance',       icon: <FaWallet size={12} /> },
    { id: 'address',         label: 'Address',       icon: <FaMapMarkerAlt size={12} /> },
    { id: 'contact-persons', label: 'Contacts',      icon: <FaUser size={12} /> },
    { id: 'documents',       label: 'Documents',     icon: <FaFileAlt size={12} />, badge: formData.documents.length },
    { id: 'custom-fields',   label: 'Custom Fields', icon: <FaBuilding size={12} /> },
    { id: 'reporting-tags',  label: 'Tags',          icon: <FaTags size={12} />, badge: formData.reportingTags.length },
    { id: 'remarks',         label: 'Remarks',       icon: <FaStickyNote size={12} /> },
  ];

  const completionPct = Math.round(
    [formData.customerDisplayName, formData.companyName, formData.customerEmail,
     formData.customerPhone, formData.streetAddress, formData.city]
    .filter(Boolean).length / 6 * 100
  );

  const blueC   = isDark ? '#60a5fa' : '#2563eb';
  const blueDim = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff';
  const card    = { background: T.surface, borderRadius: '16px', padding: '24px', border: `1px solid ${T.border}`, boxShadow: isDark ? '0 1px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.04)' };

  return (
    <div className="nc-root" style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px' }}>
      <style>{makeStyles(T, isDark)}</style>

      {showDiscard && (
        <DiscardModal
          T={T} isDark={isDark}
          onConfirm={() => { setShowDiscard(false); navigate('/Sales/Customers'); }}
          onCancel={() => setShowDiscard(false)}
        />
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
        <button type="button" onClick={() => setShowDiscard(true)}
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: T.surface, border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textSec }}>
          <FaChevronLeft size={13} />
        </button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: T.textPri, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{isEditMode ? 'Edit Customer' : 'New Customer'}</h1>
          <p style={{ fontSize: '12px', color: T.textSec, margin: '2px 0 0' }}>{isEditMode ? 'Update the customer details below' : 'Fill in the details to create a new customer record'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>

          {/* ── LEFT: main form ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Customer Type */}
            <div style={card}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: T.textPri, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer Type</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { value: 'business',   label: 'Business',   icon: <FaBuilding size={18} />, desc: 'Company or organization' },
                  { value: 'individual', label: 'Individual', icon: <FaUser size={18} />,     desc: 'Personal customer'       },
                ].map(type => {
                  const active = formData.customerType === type.value;
                  return (
                    <div key={type.value}
                      className={`type-card${active ? ' type-card-active' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, customerType: type.value }))}
                      style={{ flex: 1, border: `1.5px solid ${T.border}`, borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', background: T.surface }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: active ? blueDim : T.surface2, color: active ? blueC : T.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                        {type.icon}
                      </div>
                      <div>
                        <p style={{ fontWeight: '700', fontSize: '14px', color: active ? blueC : T.textPri, margin: 0 }}>{type.label}</p>
                        <p style={{ fontSize: '11px', color: T.textSec, margin: '2px 0 0' }}>{type.desc}</p>
                      </div>
                      <div style={{ marginLeft: 'auto', width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${active ? blueC : T.border}`, background: active ? blueC : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                        {active && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Primary Contact */}
            <div style={card}>
              <SectionHeader icon={<FaUser />} title="Primary Contact" subtitle="Basic identification information" T={T} isDark={isDark} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Individual: salutation + first/last name */}
                {formData.customerType === 'individual' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: '14px' }}>
                    <CustomSelect name="salutation" label="Salutation" value={formData.salutation}
                      onChange={handleChange} options={salutations} placeholder="Select" T={T} isDark={isDark} />
                    <div>
                      <Label T={T}>First Name</Label>
                      <input className="nc-input" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" />
                    </div>
                    <div>
                      <Label T={T}>Last Name</Label>
                      <input className="nc-input" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Smith" />
                    </div>
                  </div>
                )}

                {/* Business: company name only */}
                {formData.customerType === 'business' && (
                  <div>
                    <Label T={T}>Company Name</Label>
                    <input className="nc-input" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="ACME Corp" />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <Label required T={T}>Customer Display Name</Label>
                    <input className="nc-input" name="customerDisplayName" value={formData.customerDisplayName}
                      onChange={handleChange} placeholder="Name shown on documents" required />
                  </div>
                  {/* TRN — mandatory for all */}
                  <div>
                    <Label required T={T}>TRN Number</Label>
                    <input className="nc-input" name="trnNumber" value={formData.trnNumber}
                      onChange={handleChange} placeholder="Tax Registration Number" />
                  </div>
                </div>

                {/* Legal Form — business only */}
                {formData.customerType === 'business' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <Label T={T}>Legal Form</Label>
                      <input className="nc-input" name="legalForm" value={formData.legalForm}
                        onChange={handleChange} placeholder="e.g. LLC, FZCO, Sole Proprietorship" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div style={card}>
              <SectionHeader icon={<FaEnvelope />} title="Contact Information" subtitle="Email and phone numbers" T={T} isDark={isDark} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <Label T={T}>Email Address</Label>
                  <div style={{ position: 'relative' }}>
                    <FaEnvelope style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: T.textSec, fontSize: '13px', pointerEvents: 'none' }} />
                    <input className="nc-input" type="email" name="customerEmail" value={formData.customerEmail}
                      onChange={handleChange} placeholder="customer@company.com" style={{ paddingLeft: '38px' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <Label T={T}>Customer Phone</Label>
                    <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                      countrySelectComponent={CountrySelect}
                      value={formData.customerPhone} onChange={val => handlePhoneChange(val, 'customerPhone')} />
                  </div>
                  <div>
                    <Label T={T}>Mobile</Label>
                    <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                      countrySelectComponent={CountrySelect}
                      value={formData.mobile} onChange={val => handlePhoneChange(val, 'mobile')} />
                  </div>
                </div>
                <div>
                  <Label T={T}>Work Phone <span style={{ color: T.textSec, fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>(optional)</span></Label>
                  <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                    countrySelectComponent={CountrySelect}
                    value={formData.workPhone} onChange={val => handlePhoneChange(val, 'workPhone')} />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', background: T.surface2, borderBottom: `1px solid ${T.border}`, padding: '6px', gap: '4px', overflowX: 'auto' }}>
                {tabs.map(tab => (
                  <button key={tab.id} type="button"
                    className={`tab-btn${activeTab === tab.id ? ' tab-btn-active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', color: activeTab === tab.id ? blueC : T.textSec, whiteSpace: 'nowrap', background: 'transparent' }}>
                    {tab.icon}{tab.label}
                    {tab.badge > 0 && (
                      <span style={{ minWidth: '18px', height: '18px', borderRadius: '999px', background: blueC, color: 'white', fontSize: '10px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div style={{ padding: '24px' }}>
                {activeTab === 'finance'         && <FinanceTab formData={formData} handleChange={handleChange} T={T} isDark={isDark} />}
                {activeTab === 'address'         && <AddressTab formData={formData} handleChange={handleChange} T={T} isDark={isDark} />}
                {activeTab === 'contact-persons' && <ContactPersonsTab contactPersons={contactPersons} setContactPersons={setContactPersons} T={T} isDark={isDark} />}
                {activeTab === 'documents'       && <DocumentsTab documents={formData.documents} handleFileUpload={handleFileUpload} removeDocument={removeDocument} getFileIcon={getFileIcon} formatFileSize={formatFileSize} T={T} isDark={isDark} />}
                {activeTab === 'custom-fields'   && <CustomFieldsTab customFields={formData.customFields} customerType={formData.customerType} setFormData={setFormData} T={T} isDark={isDark} />}
                {activeTab === 'reporting-tags'  && <ReportingTagsTab reportingTags={formData.reportingTags} setFormData={setFormData} T={T} isDark={isDark} />}
                {activeTab === 'remarks'         && <RemarksTab remarks={formData.remarks} handleChange={handleChange} T={T} isDark={isDark} />}
              </div>
            </div>
          </div>

          {/* ── RIGHT: sticky sidebar ── */}
          <div style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Live Preview */}
            <div style={{ ...card, padding: '22px' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>Preview</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: blueDim, color: blueC, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', flexShrink: 0, border: `1px solid ${isDark ? 'rgba(59,130,246,0.2)' : '#bfdbfe'}` }}>
                  {formData.customerDisplayName ? formData.customerDisplayName.charAt(0).toUpperCase() : <FaUser size={20} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '15px', fontWeight: '800', color: formData.customerDisplayName ? T.textPri : T.textSec, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                    {formData.customerDisplayName || 'Display Name'}
                  </p>
                  <p style={{ fontSize: '12px', color: T.textSec, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formData.companyName || 'Company name'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { icon: <FaEnvelope />,     value: formData.customerEmail,  placeholder: 'Email not set'    },
                  { icon: <FaPhone />,         value: formData.customerPhone,  placeholder: 'Phone not set'    },
                  { icon: <FaMapMarkerAlt />,  value: [formData.city, formData.country].filter(Boolean).join(', '), placeholder: 'Location not set' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: T.surface2, borderRadius: '9px' }}>
                    <span style={{ color: T.textSec, fontSize: '12px', flexShrink: 0 }}>{row.icon}</span>
                    <span style={{ fontSize: '12px', color: row.value ? T.textPri : T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.value || row.placeholder}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: T.textSec, fontWeight: '600' }}>Profile completion</span>
                  <span style={{ fontSize: '11px', color: blueC, fontWeight: '700' }}>{completionPct}%</span>
                </div>
                <div style={{ height: '5px', background: T.surface2, borderRadius: '999px', overflow: 'hidden', border: `1px solid ${T.border}` }}>
                  <div style={{ height: '100%', background: `linear-gradient(90deg, ${blueC}, ${isDark ? '#93c5fd' : '#60a5fa'})`, borderRadius: '999px', width: `${completionPct}%`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ ...card, padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="submit" className="save-btn" disabled={isSubmitting}
                style={{ width: '100%', padding: '13px', background: blueC, color: 'white', border: 'none', borderRadius: '11px', fontSize: '14px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Saving…
                  </>
                ) : (
                  <><FaCheckCircle size={14} /> {isEditMode ? 'Update Customer' : 'Save Customer'}</>
                )}
              </button>
              <button type="button" className="action-btn-secondary" onClick={() => setShowDiscard(true)} disabled={isSubmitting}
                style={{ width: '100%', padding: '12px', background: T.surface2, color: T.textSec, border: `1.5px solid ${T.border}`, borderRadius: '11px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>

            {/* Checklist */}
            <div style={{ ...card, padding: '18px' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Checklist</p>
              {[
                { label: 'Display name set',   done: !!formData.customerDisplayName },
                { label: 'Email provided',     done: !!formData.customerEmail       },
                { label: 'Phone number added', done: !!formData.customerPhone       },
                { label: 'Address filled',     done: !!formData.streetAddress       },
                { label: 'Documents uploaded', done: formData.documents.length > 0  },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 0' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: item.done ? 'rgba(22,163,74,0.15)' : T.surface2, color: item.done ? '#16a34a' : T.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0, transition: 'all 0.2s', border: `1px solid ${item.done ? 'rgba(22,163,74,0.25)' : T.border}` }}>
                    <FaCheckCircle />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: item.done ? T.textPri : T.textSec }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Newcustomers;
