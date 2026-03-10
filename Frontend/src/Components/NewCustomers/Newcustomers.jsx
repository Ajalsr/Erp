import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useAddCustomer from '../../helper/useAddCustomer';
import toast, { Toaster } from "react-hot-toast";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { AiOutlineFileAdd, AiOutlineDelete } from "react-icons/ai";
import {
  FaFilePdf, FaFileImage, FaFileWord, FaFileExcel, FaFile,
  FaUser, FaBuilding, FaEnvelope, FaPhone, FaMapMarkerAlt,
  FaFileAlt, FaTags, FaStickyNote, FaWallet, FaChevronLeft,
  FaPlus, FaTimes, FaCheckCircle
} from "react-icons/fa";

// ─── Styles ───────────────────────────────────────────────────────
const phoneStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
  .nc-root { font-family: 'Outfit', 'Segoe UI', sans-serif; }
  .PhoneInput { width: 100%; display: flex; }
  .PhoneInputInput {
    flex: 1; height: 42px; padding: 0 14px;
    border: 1.5px solid #e2e8f0; border-left: none;
    border-radius: 0 10px 10px 0;
    font-size: 13px; font-family: 'Outfit', sans-serif;
    background: white; color: #1e293b; outline: none;
    transition: border-color 0.15s;
  }
  .PhoneInputInput:focus { border-color: #93c5fd; }
  .PhoneInputCountry {
    border: 1.5px solid #e2e8f0; border-right: none;
    border-radius: 10px 0 0 10px;
    background: #f8fafc; padding: 0 10px;
    height: 42px; display: flex; align-items: center;
  }
  .PhoneInputCountrySelectArrow { border-top-color: #94a3b8; }
  .nc-input {
    width: 100%; height: 42px; padding: 0 14px;
    border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: 13px; font-family: 'Outfit', sans-serif;
    color: #1e293b; background: white; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }
  .nc-input:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(147,197,253,0.2); }
  .nc-input::placeholder { color: #cbd5e1; }
  .nc-select {
    width: 100%; height: 42px; padding: 0 14px;
    border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: 13px; font-family: 'Outfit', sans-serif;
    color: #1e293b; background: white; outline: none;
    cursor: pointer; transition: border-color 0.15s;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 36px;
  }
  .nc-select:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(147,197,253,0.2); }
  .nc-textarea {
    width: 100%; padding: 12px 14px;
    border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: 13px; font-family: 'Outfit', sans-serif;
    color: #1e293b; background: white; outline: none;
    resize: vertical; min-height: 100px;
    transition: border-color 0.15s; box-sizing: border-box;
  }
  .nc-textarea:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(147,197,253,0.2); }
  .nc-textarea::placeholder { color: #cbd5e1; }
  .tab-btn { transition: all 0.15s; }
  .tab-btn:hover { background: #f1f5f9 !important; }
  .tab-btn-active { background: white !important; color: #1d4ed8 !important; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .type-card { transition: all 0.18s; cursor: pointer; }
  .type-card:hover { border-color: #93c5fd !important; }
  .type-card-active { border-color: #2563eb !important; background: #eff6ff !important; }
  .upload-zone { transition: all 0.15s; cursor: pointer; }
  .upload-zone:hover { border-color: #93c5fd !important; background: #f0f7ff !important; }
  .action-btn-secondary { transition: all 0.15s; }
  .action-btn-secondary:hover { background: #f1f5f9 !important; border-color: #cbd5e1 !important; }
  .save-btn { transition: all 0.15s; }
  .save-btn:hover:not(:disabled) { background: #1d4ed8 !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37,99,235,0.3) !important; }
  .contact-card { transition: all 0.15s; }
  .contact-card:hover { border-color: #bfdbfe !important; }
  .tag-chip { transition: all 0.12s; }
  .tag-chip:hover { background: #fef2f2 !important; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ─── Tiny shared helpers — defined OUTSIDE every component ────────
const Label = ({ children, required }) => (
  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>
    {children}{required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
  </label>
);

const SectionHeader = ({ icon, title, subtitle }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <p style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>{title}</p>
      {subtitle && <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>{subtitle}</p>}
    </div>
  </div>
);

// ─── Document types — stable constant outside components ──────────
const DOCUMENT_TYPES = [
  { id: 'trade_license',     label: 'Trade License',    required: true  },
  { id: 'trl_copy',          label: 'TRL Copy',          required: true  },
  { id: 'owners_passport',   label: "Owner's Passport",  required: true  },
  { id: 'eid_copy',          label: 'EID Copy',          required: true  },
  { id: 'power_of_attorney', label: 'Power of Attorney', required: false },
  { id: 'other',             label: 'Other Documents',   required: false },
];

// ─── TAB PANEL COMPONENTS — all defined at module level ───────────
// Key rule: NEVER define a component inside another component.
// Doing so creates a new component *type* on every render → React
// unmounts + remounts the subtree → input focus is lost.

const FinanceTab = ({ formData, handleChange }) => (
  <div>
    <SectionHeader icon={<FaWallet />} title="Finance Details" subtitle="Set credit limits and payment terms" />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {[
        { label: 'Credit Limit',  name: 'credit_limit', placeholder: 'e.g. 50,000' },
        { label: 'Payment Terms', name: 'paymentTerms', placeholder: 'e.g. Net 30'  },
        { label: 'Credit Used',   name: 'credit_used',  placeholder: 'e.g. 10,000' },
        { label: 'No. of Days',   name: 'no_of_days',   placeholder: 'e.g. 30'      },
      ].map(f => (
        <div key={f.name}>
          <Label>{f.label}</Label>
          <input className="nc-input" name={f.name} value={formData[f.name] || ''}
            onChange={handleChange} placeholder={f.placeholder} />
        </div>
      ))}
      <div>
        <Label>Currency</Label>
        <CustomSelect name="currency" value={formData.currency} onChange={handleChange}
          options={['UAE Dirham', 'USD', 'EUR', 'GBP', 'SAR']} placeholder="Select currency" />
      </div>
    </div>
  </div>
);

const AddressTab = ({ formData, handleChange }) => (
  <div>
    <SectionHeader icon={<FaMapMarkerAlt />} title="Address" subtitle="Customer's billing and shipping address" />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <Label>Street Address</Label>
        <textarea className="nc-textarea" name="streetAddress" value={formData.streetAddress}
          onChange={handleChange} placeholder="Enter full street address" rows={3} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <Label>City</Label>
          <input className="nc-input" name="city" value={formData.city} onChange={handleChange} placeholder="Dubai" />
        </div>
        <div>
          <Label>Postal Code</Label>
          <input className="nc-input" name="postalCode" value={formData.postalCode} onChange={handleChange} placeholder="00000" />
        </div>
      </div>
      <div>
        <Label>Country</Label>
        <input className="nc-input" name="country" value={formData.country} onChange={handleChange} placeholder="United Arab Emirates" />
      </div>
    </div>
  </div>
);

const ContactPersonsTab = ({ contactPersons, setContactPersons }) => {
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
      <SectionHeader icon={<FaUser />} title="Contact Persons" subtitle="Add additional contacts for this customer" />
      {contactPersons.length === 0 ? (
        <div style={{ border: '1.5px dashed #e2e8f0', borderRadius: '12px', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#cbd5e1', margin: '0 auto 12px' }}>
            <FaUser />
          </div>
          <p style={{ fontWeight: '600', color: '#475569', fontSize: '14px', margin: '0 0 4px' }}>No contacts yet</p>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 16px' }}>Add contact persons for this customer</p>
          <button type="button" onClick={handleAdd}
            style={{ padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FaPlus size={11} /> Add Contact
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {contactPersons.map((contact, index) => (
            <div key={contact.id} className="contact-card"
              style={{ border: '1.5px solid #f1f5f9', borderRadius: '12px', padding: '18px', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700' }}>
                    {index + 1}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Contact Person</span>
                </div>
                <button type="button" onClick={() => handleRemove(index)}
                  style={{ background: '#fef2f2', border: 'none', borderRadius: '7px', padding: '5px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600', fontFamily: 'inherit' }}>
                  <FaTimes size={10} /> Remove
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <Label>Name</Label>
                  <input className="nc-input" type="text" value={contact.name}
                    onChange={e => handleUpdate(index, 'name', e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <Label>Email</Label>
                  <input className="nc-input" type="email" value={contact.email}
                    onChange={e => handleUpdate(index, 'email', e.target.value)} placeholder="email@company.com" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                    value={contact.phone || ''} onChange={val => handleUpdate(index, 'phone', val || '')} />
                </div>
              </div>
            </div>
          ))}
          <button type="button" onClick={handleAdd}
            style={{ padding: '10px', border: '1.5px dashed #bfdbfe', borderRadius: '10px', background: '#f8fbff', color: '#2563eb', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
            <FaPlus size={11} /> Add Another Contact
          </button>
        </div>
      )}
    </div>
  );
};

const DocumentsTab = ({ documents, handleFileUpload, removeDocument, getFileIcon, formatFileSize }) => (
  <div>
    <SectionHeader icon={<FaFileAlt />} title="Documents" subtitle="Upload required verification documents (max 5MB each)" />
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {DOCUMENT_TYPES.map(docType => {
        const docs = documents.filter(d => d.type === docType.id);
        return (
          <div key={docType.id} style={{ border: '1.5px solid #f1f5f9', borderRadius: '12px', padding: '16px', background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: docs.length > 0 ? '14px' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {docs.length > 0 && (
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                    <FaCheckCircle />
                  </div>
                )}
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                    {docType.label}{docType.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                  </p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>
                    {docType.required ? 'Required' : 'Optional'}{docs.length > 0 ? ` · ${docs.length} file(s)` : ''}
                  </p>
                </div>
              </div>
              <label className="upload-zone"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: '1.5px dashed #bfdbfe', borderRadius: '9px', background: '#f8fbff', color: '#2563eb', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                <AiOutlineFileAdd size={14} /> Upload
                <input type="file" style={{ display: 'none' }} multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  onChange={e => handleFileUpload(docType.id, e)} />
              </label>
            </div>
            {docs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {docs.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'white', borderRadius: '9px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '18px' }}>{getFileIcon(doc.name)}</div>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b', margin: 0 }}>{doc.name}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>{formatFileSize(doc.size)} · {new Date(doc.uploadDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeDocument(doc.id)}
                      style={{ background: '#fef2f2', border: 'none', borderRadius: '7px', padding: '5px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                      <AiOutlineDelete size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ padding: '14px 16px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#0369a1', margin: '0 0 6px' }}>Upload Guidelines</p>
        <p style={{ fontSize: '12px', color: '#0284c7', margin: 0, lineHeight: 1.6 }}>
          Max 10 files · 5MB each · PDF, JPG, PNG, DOC, XLS accepted · Clear, readable scans preferred
        </p>
      </div>
    </div>
  </div>
);

// ─── Custom Select — portal-based dropdown, no native <select> ───
const CustomSelect = ({ value, onChange, options, label, placeholder = 'Select', name }) => {
  const [open,      setOpen]    = useState(false);
  const [ready,     setReady]   = useState(false);
  const [dropPos,   setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);
  const rafRef     = useRef(null);

  const selected = options.find(o => (o.value ?? o) === value);
  const display  = selected ? (selected.label ?? selected) : null;

  const measurePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min(options.length * 44 + 16, 260);
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow > dropH ? r.bottom + 4 : r.top - dropH - 4;
    setDropPos({ top: top + window.scrollY, left: r.left + window.scrollX, width: r.width });
    setReady(true);
  }, [options.length]);

  const handleOpen = () => {
    if (open) { setOpen(false); setReady(false); return; }
    setReady(false);
    setOpen(true);
    // Two rAF frames — first lets React render the portal, second lets browser paint it
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

  const select = (opt) => {
    onChange({ target: { name, value: opt.value ?? opt } });
    setOpen(false); setReady(false);
  };

  const dropdown = (
    <div ref={dropRef}
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width,
               zIndex: 99999, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px',
               boxShadow: '0 16px 48px rgba(0,0,0,0.12)', overflow: 'hidden',
               fontFamily: "'Outfit', sans-serif", boxSizing: 'border-box',
               visibility: ready ? 'visible' : 'hidden',
               opacity: ready ? 1 : 0, transition: 'opacity 0.12s ease' }}>
      <div style={{ maxHeight: '244px', overflowY: 'auto', padding: '6px' }}>
        {options.map((opt, i) => {
          const val   = opt.value ?? opt;
          const lbl   = opt.label ?? opt;
          const isAct = val === value;
          return (
            <div key={i} onClick={() => select(opt)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                       padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                       fontWeight: isAct ? '600' : '400',
                       color: isAct ? '#1d4ed8' : '#1e293b',
                       background: isAct ? '#eff6ff' : 'transparent',
                       transition: 'background 0.1s' }}
              onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}>
              {lbl}
              {isAct && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
      {label && <Label>{label}</Label>}
      <div ref={triggerRef} onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                 height: '42px', padding: '0 14px', border: `1.5px solid ${open ? '#93c5fd' : '#e2e8f0'}`,
                 borderRadius: '10px', background: 'white', cursor: 'pointer',
                 boxShadow: open ? '0 0 0 3px rgba(147,197,253,0.2)' : 'none',
                 transition: 'border-color 0.15s, box-shadow 0.15s',
                 boxSizing: 'border-box', userSelect: 'none' }}>
        <span style={{ fontSize: '13px', color: display ? '#1e293b' : '#cbd5e1',
                       fontFamily: "'Outfit', sans-serif", fontWeight: display ? '500' : '400' }}>
          {display || placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={open ? '#2563eb' : '#94a3b8'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && createPortal(dropdown, document.body)}
    </div>
  );
};

// ─── Custom DatePicker — portal-based so it's never clipped ──────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const DatePicker = ({ value, onChange, label, placeholder = 'Select date' }) => {
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
    setReady(false);
    setOpen(true);
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

  const parsed   = value ? new Date(value + 'T00:00:00') : null;
  const display  = parsed ? `${String(parsed.getDate()).padStart(2,'0')} ${MONTHS[parsed.getMonth()].slice(0,3)} ${parsed.getFullYear()}` : '';

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();

  const selectDay = d => {
    const iso = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    onChange(iso);
    setOpen(false); setReady(false);
  };

  const prevMonth = e => { e.stopPropagation(); if (viewMonth === 0) { setViewMonth(11); setViewYear(y=>y-1); } else setViewMonth(m=>m-1); };
  const nextMonth = e => { e.stopPropagation(); if (viewMonth === 11) { setViewMonth(0);  setViewYear(y=>y+1); } else setViewMonth(m=>m+1); };

  const yearRange = Array.from({ length: 31 }, (_, i) => new Date().getFullYear() - 10 + i);

  const isSelected = d => parsed && parsed.getDate() === d && parsed.getMonth() === viewMonth && parsed.getFullYear() === viewYear;
  const isToday    = d => { const t = new Date(); return t.getDate() === d && t.getMonth() === viewMonth && t.getFullYear() === viewYear; };

  const calendar = (
    <div ref={dropRef}
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, zIndex: 99999,
               background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '14px',
               boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '16px',
               width: Math.max(dropPos.width, 280) + 'px', fontFamily: "'Outfit', sans-serif",
               boxSizing: 'border-box',
               visibility: ready ? 'visible' : 'hidden',
               opacity: ready ? 1 : 0, transition: 'opacity 0.12s ease' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button type="button" onClick={prevMonth}
          style={{ width: '30px', height: '30px', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <button type="button" onClick={e => { e.stopPropagation(); setPickingY(p => !p); }}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: pickingY ? '#eff6ff' : 'transparent', border: pickingY ? '1.5px solid #bfdbfe' : '1.5px solid transparent', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
          {MONTHS[viewMonth]} {viewYear}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
            <polyline points={pickingY ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/>
          </svg>
        </button>

        <button type="button" onClick={nextMonth}
          style={{ width: '30px', height: '30px', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Year grid */}
      {pickingY ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
          {yearRange.map(y => (
            <button key={y} type="button"
              onClick={e => { e.stopPropagation(); setViewYear(y); setPickingY(false); }}
              style={{ padding: '7px 2px', borderRadius: '7px', fontSize: '12px', fontWeight: y === viewYear ? '700' : '400', border: 'none', cursor: 'pointer', background: y === viewYear ? '#2563eb' : 'transparent', color: y === viewYear ? 'white' : '#374151' }}>
              {y}
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '6px' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '600', color: '#94a3b8', padding: '3px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
              <button key={d} type="button" onClick={e => { e.stopPropagation(); selectDay(d); }}
                style={{ aspectRatio: '1', borderRadius: '8px', fontSize: '12px', fontWeight: isSelected(d) ? '700' : isToday(d) ? '600' : '400',
                         border: isToday(d) && !isSelected(d) ? '1.5px solid #bfdbfe' : 'none',
                         cursor: 'pointer', background: isSelected(d) ? '#2563eb' : 'transparent',
                         color: isSelected(d) ? 'white' : isToday(d) ? '#2563eb' : '#374151',
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
                         minHeight: '32px' }}
                onMouseEnter={e => { if (!isSelected(d)) e.currentTarget.style.background = '#eff6ff'; }}
                onMouseLeave={e => { if (!isSelected(d)) e.currentTarget.style.background = 'transparent'; }}>
                {d}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" onClick={e => { e.stopPropagation(); const t = new Date(); setViewMonth(t.getMonth()); setViewYear(t.getFullYear()); selectDay(t.getDate()); }}
              style={{ flex: 1, padding: '7px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#1d4ed8', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
              Today
            </button>
            <button type="button" onClick={e => { e.stopPropagation(); onChange(''); setOpen(false); setReady(false); }}
              style={{ flex: 1, padding: '7px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: '500', color: '#64748b', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div>
      {label && <Label>{label}</Label>}

      {/* Trigger */}
      <div ref={triggerRef}
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                 height: '42px', padding: '0 14px', border: `1.5px solid ${open ? '#93c5fd' : '#e2e8f0'}`,
                 borderRadius: '10px', background: 'white', cursor: 'pointer',
                 transition: 'border-color 0.15s, box-shadow 0.15s',
                 boxShadow: open ? '0 0 0 3px rgba(147,197,253,0.2)' : 'none',
                 boxSizing: 'border-box', width: '100%', userSelect: 'none' }}>
        <span style={{ fontSize: '13px', color: display ? '#1e293b' : '#cbd5e1', fontFamily: "'Outfit', sans-serif", fontWeight: display ? '500' : '400' }}>
          {display || placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>

      {/* Portal — renders directly on body, never clipped */}
      {open && createPortal(calendar, document.body)}
    </div>
  );
};

const CustomFieldsTab = ({ customFields, setFormData }) => (
  <div>
    <SectionHeader icon={<FaBuilding />} title="Custom Fields" subtitle="Additional business registration details" />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

      {/* Text fields */}
      {[
        { label: 'Trade License Number', key: 'tradeLicenseNumber', placeholder: 'TL-XXXXXXXX' },
        { label: 'TRL Number',           key: 'trlNumber',          placeholder: 'TRL-XXXXXX'  },
      ].map(f => (
        <div key={f.key}>
          <Label>{f.label}</Label>
          <input className="nc-input" type="text" value={customFields?.[f.key] || ''} placeholder={f.placeholder}
            onChange={e => setFormData(prev => ({ ...prev, customFields: { ...prev.customFields, [f.key]: e.target.value } }))} />
        </div>
      ))}

      {/* Custom date pickers */}
      <DatePicker
        label="Registration Date"
        value={customFields?.registrationDate || ''}
        onChange={v => setFormData(prev => ({ ...prev, customFields: { ...prev.customFields, registrationDate: v } }))}
      />
      <DatePicker
        label="License Expiry Date"
        value={customFields?.licenseExpiryDate || ''}
        onChange={v => setFormData(prev => ({ ...prev, customFields: { ...prev.customFields, licenseExpiryDate: v } }))}
      />
    </div>
  </div>
);

// ReportingTagsTab has its own local state for the text input — perfectly fine
// because it is a stable top-level component, not recreated on parent renders.
const ReportingTagsTab = ({ reportingTags, setFormData }) => {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    setFormData(prev => ({ ...prev, reportingTags: [...prev.reportingTags, v] }));
    setTagInput('');
  };

  return (
    <div>
      <SectionHeader icon={<FaTags />} title="Reporting Tags" subtitle="Categorize this customer with tags" />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input className="nc-input" value={tagInput} onChange={e => setTagInput(e.target.value)}
          placeholder="Type a tag and press Add…" style={{ flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
        <button type="button" onClick={addTag}
          style={{ padding: '0 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FaPlus size={11} /> Add Tag
        </button>
      </div>
      {reportingTags.length === 0 ? (
        <div style={{ border: '1.5px dashed #e2e8f0', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <FaTags size={24} style={{ color: '#cbd5e1', marginBottom: '10px' }} />
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No tags added yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {reportingTags.map((tag, i) => (
            <div key={i} className="tag-chip"
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 12px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '999px', fontSize: '12px', fontWeight: '600', color: '#1d4ed8' }}>
              {tag}
              <button type="button"
                onClick={() => setFormData(prev => ({ ...prev, reportingTags: prev.reportingTags.filter((_, idx) => idx !== i) }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', padding: 0, display: 'flex', alignItems: 'center' }}>
                <FaTimes size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RemarksTab = ({ remarks, handleChange }) => (
  <div>
    <SectionHeader icon={<FaStickyNote />} title="Remarks" subtitle="Internal notes about this customer" />
    <textarea className="nc-textarea" name="remarks" value={remarks} onChange={handleChange}
      rows={6} placeholder="Add any notes, special instructions, or relevant information about this customer…" />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────
const Newcustomers = () => {
  const { handleAddcustomer } = useAddCustomer();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('finance');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactPersons, setContactPersons] = useState([]);

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
    customFields: {},
    reportingTags: [],
    remarks: '',
    documents: [],
    currency: 'UAE Dirham',
    paymentTerms: 'Due on Receipt',
    credit_limit: '',
    credit_used: '',
    no_of_days: '',
  });

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
        id: Date.now() + Math.random(),
        type: documentType, name: file.name, file,
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
    setIsSubmitting(true);
    try {
      await handleAddcustomer({ ...formData, contactPersons });
      setFormData({
        customerType: 'business', customerCode: '', salutation: '', firstName: '', lastName: '',
        companyName: '', customerDisplayName: '', customerEmail: '', customerPhone: '',
        workPhone: '', mobile: '', streetAddress: '', city: '', postalCode: '', country: '',
        customFields: {}, reportingTags: [], remarks: '', documents: [],
        currency: 'UAE Dirham', paymentTerms: 'Due on Receipt',
        credit_limit: '', credit_used: '', no_of_days: '',
      });
      setContactPersons([]);
      toast.success("Customer created successfully!");
      setTimeout(() => navigate("/Sales/Customers"), 1800);
    } catch {
      toast.error("Error adding customer");
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

  return (
    <div className="nc-root" style={{ background: '#f8fafc', minHeight: '100vh', padding: '28px 32px' }}>
      <style>{phoneStyle}</style>
      <Toaster position="top-right" />

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
        <button type="button" onClick={() => navigate('/Sales/Customers')}
          style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
          <FaChevronLeft size={13} />
        </button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>New Customer</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>Fill in the details to create a new customer record</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>

          {/* ── LEFT: main form ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Customer Type */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer Type</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { value: 'business',   label: 'Business',   icon: <FaBuilding size={18} />, desc: 'Company or organization' },
                  { value: 'individual', label: 'Individual', icon: <FaUser size={18} />,     desc: 'Personal customer'       },
                ].map(type => (
                  <div key={type.value}
                    className={`type-card${formData.customerType === type.value ? ' type-card-active' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, customerType: type.value }))}
                    style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', background: 'white' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: formData.customerType === type.value ? '#dbeafe' : '#f1f5f9', color: formData.customerType === type.value ? '#2563eb' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                      {type.icon}
                    </div>
                    <div>
                      <p style={{ fontWeight: '700', fontSize: '14px', color: formData.customerType === type.value ? '#1d4ed8' : '#1e293b', margin: 0 }}>{type.label}</p>
                      <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>{type.desc}</p>
                    </div>
                    <div style={{ marginLeft: 'auto', width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${formData.customerType === type.value ? '#2563eb' : '#e2e8f0'}`, background: formData.customerType === type.value ? '#2563eb' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
                      {formData.customerType === type.value && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Primary Contact */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <SectionHeader icon={<FaUser />} title="Primary Contact" subtitle="Basic identification information" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: '14px' }}>
                  <div>
                    <CustomSelect name="salutation" label="Salutation" value={formData.salutation}
                      onChange={handleChange} options={['Mr.','Mrs.','Ms.','Miss','Dr.']} placeholder="Select" />
                  </div>
                  <div>
                    <Label>First Name</Label>
                    <input className="nc-input" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <input className="nc-input" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Smith" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <Label required>Customer Display Name</Label>
                    <input className="nc-input" name="customerDisplayName" value={formData.customerDisplayName}
                      onChange={handleChange} placeholder="Name shown on documents" required />
                  </div>
                  <div>
                    <Label>Company Name</Label>
                    <input className="nc-input" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="ACME Corp" />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <SectionHeader icon={<FaEnvelope />} title="Contact Information" subtitle="Email and phone numbers" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <Label>Email Address</Label>
                  <div style={{ position: 'relative' }}>
                    <FaEnvelope style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1', fontSize: '13px', pointerEvents: 'none' }} />
                    <input className="nc-input" type="email" name="customerEmail" value={formData.customerEmail}
                      onChange={handleChange} placeholder="customer@company.com" style={{ paddingLeft: '38px' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <Label>Customer Phone</Label>
                    <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                      value={formData.customerPhone} onChange={val => handlePhoneChange(val, 'customerPhone')} />
                  </div>
                  <div>
                    <Label>Mobile</Label>
                    <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                      value={formData.mobile} onChange={val => handlePhoneChange(val, 'mobile')} />
                  </div>
                </div>
                <div>
                  <Label>Work Phone <span style={{ color: '#94a3b8', fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>(optional)</span></Label>
                  <PhoneInput international countryCallingCodeEditable={false} defaultCountry="AE"
                    value={formData.workPhone} onChange={val => handlePhoneChange(val, 'workPhone')} />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', padding: '6px', gap: '4px', overflowX: 'auto' }}>
                {tabs.map(tab => (
                  <button key={tab.id} type="button"
                    className={`tab-btn${activeTab === tab.id ? ' tab-btn-active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', color: activeTab === tab.id ? '#1d4ed8' : '#64748b', whiteSpace: 'nowrap', background: 'transparent' }}>
                    {tab.icon}{tab.label}
                    {tab.badge > 0 && (
                      <span style={{ minWidth: '18px', height: '18px', borderRadius: '999px', background: '#2563eb', color: 'white', fontSize: '10px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content — conditional rendering of stable top-level components */}
              <div style={{ padding: '24px' }}>
                {activeTab === 'finance' && <FinanceTab formData={formData} handleChange={handleChange} />}
                {activeTab === 'address' && <AddressTab formData={formData} handleChange={handleChange} />}
                {activeTab === 'contact-persons' && <ContactPersonsTab contactPersons={contactPersons} setContactPersons={setContactPersons} />}
                {activeTab === 'documents' && <DocumentsTab documents={formData.documents} handleFileUpload={handleFileUpload} removeDocument={removeDocument} getFileIcon={getFileIcon} formatFileSize={formatFileSize} />}
                {activeTab === 'custom-fields' && <CustomFieldsTab customFields={formData.customFields} setFormData={setFormData} />}
                {activeTab === 'reporting-tags' && <ReportingTagsTab reportingTags={formData.reportingTags} setFormData={setFormData} />}
                {activeTab === 'remarks' && <RemarksTab remarks={formData.remarks} handleChange={handleChange} />}
              </div>
            </div>
          </div>

          {/* ── RIGHT: sticky sidebar ── */}
          <div style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Live Preview */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '22px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>Preview</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #dbeafe, #eff6ff)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', flexShrink: 0 }}>
                  {formData.customerDisplayName ? formData.customerDisplayName.charAt(0).toUpperCase() : <FaUser size={20} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '15px', fontWeight: '800', color: formData.customerDisplayName ? '#0f172a' : '#cbd5e1', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formData.customerDisplayName || 'Display Name'}
                  </p>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formData.companyName || 'Company name'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { icon: <FaEnvelope />,    value: formData.customerEmail,  placeholder: 'Email not set'    },
                  { icon: <FaPhone />,       value: formData.customerPhone,  placeholder: 'Phone not set'    },
                  { icon: <FaMapMarkerAlt />,value: [formData.city, formData.country].filter(Boolean).join(', '), placeholder: 'Location not set' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: '#f8fafc', borderRadius: '9px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px', flexShrink: 0 }}>{row.icon}</span>
                    <span style={{ fontSize: '12px', color: row.value ? '#475569' : '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.value || row.placeholder}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Profile completion</span>
                  <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '700' }}>{completionPct}%</span>
                </div>
                <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #2563eb, #60a5fa)', borderRadius: '999px', width: `${completionPct}%`, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '18px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="submit" className="save-btn" disabled={isSubmitting}
                style={{ width: '100%', padding: '13px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '11px', fontSize: '14px', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Saving…
                  </>
                ) : (
                  <><FaCheckCircle size={14} /> Save Customer</>
                )}
              </button>
              <button type="button" className="action-btn-secondary" onClick={() => navigate('/Sales/Customers')} disabled={isSubmitting}
                style={{ width: '100%', padding: '12px', background: '#f8fafc', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: '11px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>

            {/* Checklist */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '18px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Checklist</p>
              {[
                { label: 'Display name set',   done: !!formData.customerDisplayName },
                { label: 'Email provided',     done: !!formData.customerEmail       },
                { label: 'Phone number added', done: !!formData.customerPhone       },
                { label: 'Address filled',     done: !!formData.streetAddress       },
                { label: 'Documents uploaded', done: formData.documents.length > 0  },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 0' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: item.done ? '#dcfce7' : '#f1f5f9', color: item.done ? '#16a34a' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0, transition: 'all 0.2s' }}>
                    <FaCheckCircle />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: item.done ? '#475569' : '#94a3b8' }}>{item.label}</span>
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