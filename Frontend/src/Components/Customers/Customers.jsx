import { useEffect, useState, useRef, useCallback } from "react";
import {
  FaPlus, FaTimes, FaSearch, FaUser, FaBuilding,
  FaEnvelope, FaPhone, FaDownload, FaUpload,
  FaUsers, FaCheckCircle, FaClock, FaCreditCard,
  FaChevronLeft, FaChevronRight, FaBoxOpen, FaEdit,
  FaSortAmountDown, FaSortAmountUp
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import useGetCustomers from '../../helper/useGetCustomers';
import debounce from 'lodash/debounce';

const Customers = () => {
  const { handleGetCustomers, data, loading, error } = useGetCustomers();
  const navigate = useNavigate();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const searchRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const getStats = () => {
    if (!data) return { total: 0, active: 0, pending: 0, receivables: 0 };
    const total = data.length;
    const active = data.filter(item => (item.status || 'active') === 'active').length;
    const pending = data.filter(item => (item.status || 'active') === 'pending').length;
    const receivables = data.reduce((sum, item) => sum + (parseFloat(item.selling_price) || 0), 0);
    return { total, active, pending, receivables };
  };
  const stats = getStats();

  const getCustomerCode = (item) => {
    if (item.customerCode) return item.customerCode;
    const name = item.customerDisplayName || '';
    const initials = name.split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 3);
    const idSuffix = item._id ? item._id.slice(-4).toUpperCase() : '0000';
    return `${initials}${idSuffix}`;
  };

  const getAvatarColor = (name) => {
    const colors = [
      ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'], ['#fef3c7', '#b45309'],
      ['#fce7f3', '#be185d'], ['#ede9fe', '#6d28d9'], ['#cffafe', '#0e7490'],
    ];
    const idx = (name || '').charCodeAt(0) % colors.length;
    return colors[idx];
  };

  const getFilteredAndSortedItems = () => {
    if (!data) return [];
    let filtered = [...data];
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(item => (item.status || 'active').toLowerCase() === selectedStatus.toLowerCase());
    }
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'name': aVal = (a.customerDisplayName || '').toLowerCase(); bVal = (b.customerDisplayName || '').toLowerCase(); break;
        case 'company': aVal = (a.companyName || '').toLowerCase(); bVal = (b.companyName || '').toLowerCase(); break;
        case 'date': aVal = new Date(a.createdAt || 0); bVal = new Date(b.createdAt || 0); break;
        case 'receivables': aVal = parseFloat(a.selling_price) || 0; bVal = parseFloat(b.selling_price) || 0; break;
        default: aVal = (a.customerDisplayName || '').toLowerCase(); bVal = (b.customerDisplayName || '').toLowerCase();
      }
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
    return filtered;
  };

  const filteredItems = getFilteredAndSortedItems();

  useEffect(() => {
    if (!filteredItems || filteredItems.length === 0) { setTotalPages(1); return; }
    const pages = Math.ceil(filteredItems.length / itemsPerPage);
    setTotalPages(pages > 0 ? pages : 1);
    if (currentPage > pages && pages > 0) setCurrentPage(pages);
  }, [filteredItems, itemsPerPage, currentPage]);

  const getCurrentItems = () => {
    if (!filteredItems || filteredItems.length === 0) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, Math.min(startIndex + itemsPerPage, filteredItems.length));
  };
  const currentItems = getCurrentItems();

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const nums = [];
    if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) nums.push(i); }
    else {
      nums.push(1);
      let start = Math.max(2, currentPage - 1), end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) end = 4;
      if (currentPage >= totalPages - 2) start = totalPages - 3;
      if (start > 2) nums.push('...');
      for (let i = start; i <= end; i++) nums.push(i);
      if (end < totalPages - 1) nums.push('...');
      if (totalPages > 1) nums.push(totalPages);
    }
    return nums;
  };

  const handleItemClick = (item) => { setSelectedItem(item); setIsDrawerOpen(true); setActiveTab('overview'); };
  const closeDrawer = () => { setIsDrawerOpen(false); setSelectedItem(null); };

  const handleSearchChange = useCallback(debounce(() => {}, 300), []);
  const handleSearchInput = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    handleSearchChange(value);
    if (value.trim().length >= 2) fetchSuggestions(value);
    else setSearchSuggestions([]);
  };
  const handleClearSearch = () => { setSearchTerm(''); setSearchSuggestions([]); setIsSearchFocused(false); };

  const fetchSuggestions = (query) => {
    if (!query.trim() || !data) return;
    const term = query.toLowerCase();
    setSearchSuggestions(data.filter(item =>
      (item.customerDisplayName || '').toLowerCase().includes(term) ||
      (item.companyName || '').toLowerCase().includes(term) ||
      (item.customerEmail || '').toLowerCase().includes(term) ||
      (item.customerPhone || '').toLowerCase().includes(term) ||
      (getCustomerCode(item) || '').toLowerCase().includes(term)
    ).slice(0, 8));
  };

  const handleSuggestionClick = (item) => {
    setSelectedItem(item); setIsDrawerOpen(true); setActiveTab('overview');
    setSearchTerm(''); setSearchSuggestions([]); setIsSearchFocused(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchSuggestions([]); setIsSearchFocused(false); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExportCustomers = () => {
    if (!data || data.length === 0) { alert('No customers to export'); return; }
    const exportData = data.map(item => ({
      'Customer Code': getCustomerCode(item),
      'Customer Name': item.customerDisplayName || 'Unnamed',
      'Company': item.companyName || 'N/A',
      'Email': item.customerEmail || 'N/A',
      'Phone': item.customerPhone || 'N/A',
      'Receivables': item.selling_price ? `AED ${item.selling_price}` : 'N/A',
      'Status': item.status || 'active',
    }));
    const csv = Object.keys(exportData[0]).join(',') + '\n' + exportData.map(r => Object.values(r).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  useEffect(() => { handleGetCustomers(); }, [handleGetCustomers]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#94a3b8', fontSize: '14px' }}>Loading customers…</span>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: '20px', color: '#ef4444', background: '#fef2f2', borderRadius: '12px', margin: '24px' }}>Error: {error}</div>
  );

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredItems.length);

  const statusColors = {
    active: { bg: '#dcfce7', color: '#15803d' },
    pending: { bg: '#fef3c7', color: '#b45309' },
    inactive: { bg: '#f1f5f9', color: '#64748b' },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        .cust-root { font-family: 'Outfit', 'Segoe UI', sans-serif; }
        .cust-row:hover { background: #f8fafc !important; }
        .cust-row:hover .cust-row-name { color: #1d4ed8 !important; }
        .stat-card { transition: all 0.2s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; }
        .action-btn { transition: all 0.15s ease; }
        .action-btn:hover { opacity: 0.85; transform: translateY(-1px); }
        .page-btn:hover { background: #eff6ff !important; color: #1d4ed8 !important; }
        .suggestion-row:hover { background: #f0f7ff !important; }
        .drawer-tab { color: #94a3b8; border-bottom: 2px solid transparent; transition: all 0.15s; }
        .drawer-tab:hover { color: #475569; }
        .drawer-tab-active { color: #1d4ed8 !important; border-bottom: 2px solid #2563eb !important; }
        .detail-chip { transition: background 0.15s; }
        .detail-chip:hover { background: #f1f5f9 !important; }
        .filter-pill { cursor: pointer; transition: all 0.15s; border: 1px solid transparent; }
        .filter-pill:hover { border-color: #bfdbfe !important; background: #eff6ff !important; color: #1d4ed8 !important; }
        .filter-pill-active { background: #eff6ff !important; color: #1d4ed8 !important; border-color: #bfdbfe !important; font-weight: 600 !important; }
        .tbl-action-btn:hover { background: #f1f5f9 !important; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .drawer-anim { animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
        .overlay-anim { animation: fadeIn 0.2s ease forwards; }
      `}</style>

      <div className="cust-root" style={{ background: '#f8fafc', minHeight: '100vh', padding: '28px 32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Customers</h1>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '3px' }}>Manage and track your customer relationships</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="action-btn" onClick={handleExportCustomers} disabled={!data || data.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: '1px solid #e2e8f0', borderRadius: '10px', background: 'white', fontSize: '13px', fontWeight: '500', color: '#475569', cursor: 'pointer' }}>
              <FaDownload size={12} /> Export
            </button>
            <button className="action-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: '1px solid #e2e8f0', borderRadius: '10px', background: 'white', fontSize: '13px', fontWeight: '500', color: '#475569', cursor: 'pointer' }}>
              <FaUpload size={12} /> Import
            </button>
            <button className="action-btn" onClick={() => navigate("/Sales/Customers/Newcustomers")}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', border: 'none', borderRadius: '10px', background: '#2563eb', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              <FaPlus size={11} /> New Customer
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Customers', value: stats.total, icon: <FaUsers />, iconBg: '#eff6ff', iconColor: '#2563eb' },
            { label: 'Active', value: stats.active, icon: <FaCheckCircle />, iconBg: '#dcfce7', iconColor: '#16a34a' },
            { label: 'Pending', value: stats.pending, icon: <FaClock />, iconBg: '#fef3c7', iconColor: '#d97706' },
            { label: 'Total Receivables', value: `AED ${stats.receivables.toLocaleString()}`, icon: <FaCreditCard />, iconBg: '#ede9fe', iconColor: '#7c3aed', small: true },
          ].map((card, i) => (
            <div key={i} className="stat-card" style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{card.label}</p>
                <p style={{ fontSize: card.small ? '18px' : '26px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>{card.value}</p>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: card.iconBg, color: card.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                {card.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '14px 18px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Search */}
            <div ref={searchRef} style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '12px', pointerEvents: 'none' }} />
              <input type="text" value={searchTerm} onChange={handleSearchInput}
                onFocus={(e) => { setIsSearchFocused(true); e.target.style.borderColor = '#93c5fd'; e.target.style.background = 'white'; }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                placeholder="Search by name, email, phone, code…"
                style={{ width: '100%', padding: '9px 34px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', background: '#f8fafc', color: '#1e293b', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s, background 0.15s' }} />
              {searchTerm && (
                <button onClick={handleClearSearch} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 0 }}>
                  <FaTimes size={11} />
                </button>
              )}
              {/* Suggestions */}
              {isSearchFocused && searchSuggestions.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px 6px', fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{searchSuggestions.length} results</div>
                  {searchSuggestions.map((item, idx) => {
                    const [bg, fg] = getAvatarColor(item.customerDisplayName);
                    return (
                      <div key={item._id || idx} className="suggestion-row" onClick={() => handleSuggestionClick(item)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', cursor: 'pointer', borderTop: '1px solid #f8fafc' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>
                          {(item.customerDisplayName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.customerDisplayName || 'Unnamed'}</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{item.customerEmail || item.companyName || ''}</p>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '600', fontFamily: 'monospace', background: '#eff6ff', color: '#2563eb', padding: '2px 7px', borderRadius: '5px' }}>{getCustomerCode(item)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {isSearchFocused && searchTerm.trim().length >= 2 && searchSuggestions.length === 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 100, padding: '20px', textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No results for "{searchTerm}"</p>
                </div>
              )}
            </div>

            {/* Status pills */}
            <div style={{ display: 'flex', gap: '5px' }}>
              {['all', 'active', 'pending', 'inactive'].map(s => (
                <button key={s} onClick={() => { setSelectedStatus(s); setCurrentPage(1); }}
                  className={`filter-pill ${selectedStatus === s ? 'filter-pill-active' : ''}`}
                  style={{ padding: '7px 13px', borderRadius: '8px', fontSize: '12px', fontWeight: '500', background: '#f8fafc', color: '#64748b', border: '1px solid transparent', fontFamily: 'inherit', cursor: 'pointer' }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#475569', background: '#f8fafc', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                <option value="name">Name</option>
                <option value="company">Company</option>
                <option value="date">Date</option>
                <option value="receivables">Receivables</option>
              </select>
              <button onClick={() => { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); setCurrentPage(1); }}
                style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {sortOrder === 'asc' ? <FaSortAmountDown size={13} /> : <FaSortAmountUp size={13} />}
              </button>
            </div>

            <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {filteredItems.length} customer{filteredItems.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: '14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <th style={{ padding: '12px 16px', width: '32px' }}><input type="checkbox" style={{ accentColor: '#2563eb' }} /></th>
                {['Customer', 'Company', 'Contact', 'Description', 'Receivables', ''].map((h, i) => (
                  <th key={i} style={{ padding: '12px 16px', textAlign: i === 4 ? 'right' : 'left', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? currentItems.map((item, idx) => {
                const [avBg, avFg] = getAvatarColor(item.customerDisplayName);
                const sColor = statusColors[item.status] || statusColors.active;
                return (
                  <tr key={item._id || idx} className="cust-row" style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '14px 16px' }}><input type="checkbox" style={{ accentColor: '#2563eb' }} /></td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: avBg, color: avFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 }}>
                          {(item.customerDisplayName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="cust-row-name" onClick={() => handleItemClick(item)}
                              style={{ fontWeight: '600', color: '#1e293b', cursor: 'pointer', transition: 'color 0.15s' }}>
                              {item.customerDisplayName || 'Unnamed Customer'}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: '600', fontFamily: 'monospace', background: '#eff6ff', color: '#2563eb', padding: '2px 7px', borderRadius: '5px' }}>
                              {getCustomerCode(item)}
                            </span>
                            {item.status && (
                              <span style={{ fontSize: '10px', fontWeight: '600', background: sColor.bg, color: sColor.color, padding: '2px 8px', borderRadius: '999px' }}>
                                {item.status}
                              </span>
                            )}
                          </div>
                          {item.companyName && item.companyName !== 'N/A' && (
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>{item.companyName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>
                      {item.companyName && item.companyName !== 'N/A' ? item.companyName : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {item.customerEmail && item.customerEmail !== 'N/A' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', fontSize: '12px' }}>
                            <FaEnvelope style={{ color: '#cbd5e1', fontSize: '10px' }} />{item.customerEmail}
                          </div>
                        )}
                        {item.customerPhone && item.customerPhone !== 'N/A' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', fontSize: '12px' }}>
                            <FaPhone style={{ color: '#cbd5e1', fontSize: '10px' }} />{item.customerPhone}
                          </div>
                        )}
                        {!item.customerEmail && !item.customerPhone && <span style={{ color: '#cbd5e1' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', maxWidth: '180px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', color: '#64748b' }}>
                        {item.sales_description || <span style={{ color: '#cbd5e1' }}>No description</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#1e293b' }}>
                      {item.selling_price ? `AED ${item.selling_price}` : <span style={{ color: '#cbd5e1', fontWeight: '400' }}>—</span>}
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="tbl-action-btn" onClick={() => handleItemClick(item)}
                          style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', background: 'white', fontSize: '11px', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500', transition: 'background 0.12s' }}>
                          View
                        </button>
                        <button className="tbl-action-btn" onClick={() => navigate(`/sales/customers/edit/${item._id}`)}
                          style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', background: 'white', fontSize: '11px', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', transition: 'background 0.12s' }}>
                          <FaEdit size={10} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="7" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', color: '#cbd5e1' }}>
                        <FaBoxOpen />
                      </div>
                      <p style={{ fontWeight: '700', color: '#475569', fontSize: '15px', margin: 0 }}>No customers found</p>
                      <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                        {selectedStatus !== 'all' ? `No customers with status "${selectedStatus}"` : 'Start by adding your first customer'}
                      </p>
                      <button onClick={() => navigate("/Sales/Customers/Newcustomers")}
                        style={{ marginTop: '8px', padding: '9px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Add Customer
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'white', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Showing {startIndex}–{endIndex} of {filteredItems.length}</span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '12px', color: currentPage === 1 ? '#cbd5e1' : '#475569', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
                <FaChevronLeft size={10} /> Prev
              </button>
              {getPageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} style={{ padding: '6px 8px', color: '#94a3b8', fontSize: '12px' }}>…</span>
                ) : (
                  <button key={p} onClick={() => handlePageChange(p)} className="page-btn"
                    style={{ padding: '6px 11px', border: '1px solid', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', borderColor: currentPage === p ? '#bfdbfe' : '#e2e8f0', background: currentPage === p ? '#eff6ff' : 'white', color: currentPage === p ? '#1d4ed8' : '#475569', transition: 'all 0.12s' }}>
                    {p}
                  </button>
                )
              )}
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '12px', color: currentPage === totalPages ? '#cbd5e1' : '#475569', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
                Next <FaChevronRight size={10} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Per page:</span>
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#475569', background: '#f8fafc', fontFamily: 'inherit', outline: 'none' }}>
                {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {isDrawerOpen && (
        <>
          <div className="overlay-anim" onClick={closeDrawer}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)', zIndex: 50 }} />
          <div className="drawer-anim" style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '420px', maxWidth: '100vw', background: 'white', zIndex: 51, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.1)' }}>

            {/* Drawer header */}
            <div style={{ padding: '20px 22px 0', borderBottom: '1px solid #f1f5f9' }}>
              {selectedItem && (() => {
                const [bg, fg] = getAvatarColor(selectedItem.customerDisplayName);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', flexShrink: 0 }}>
                      {(selectedItem.customerDisplayName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedItem.customerDisplayName || 'Customer'}
                        </h3>
                        <span style={{ fontSize: '10px', fontWeight: '700', fontFamily: 'monospace', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '6px', flexShrink: 0 }}>
                          {getCustomerCode(selectedItem)}
                        </span>
                      </div>
                      {selectedItem.companyName && (
                        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>{selectedItem.companyName}</p>
                      )}
                    </div>
                    <button onClick={closeDrawer}
                      style={{ background: '#f1f5f9', border: 'none', borderRadius: '9px', padding: '7px', cursor: 'pointer', color: '#64748b', display: 'flex', flexShrink: 0 }}>
                      <FaTimes size={13} />
                    </button>
                  </div>
                );
              })()}
              <div style={{ display: 'flex' }}>
                {['overview', 'transactions', 'history'].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`drawer-tab ${activeTab === tab ? 'drawer-tab-active' : ''}`}
                    style={{ padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
              {selectedItem && activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Company', value: selectedItem.companyName || 'N/A', icon: <FaBuilding /> },
                    { label: 'Email', value: selectedItem.customerEmail || 'N/A', icon: <FaEnvelope /> },
                    { label: 'Phone', value: selectedItem.customerPhone || 'N/A', icon: <FaPhone /> },
                    { label: 'Receivables', value: selectedItem.selling_price ? `AED ${selectedItem.selling_price}` : 'N/A', icon: <FaCreditCard /> },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="detail-chip"
                      style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', background: '#f8fafc', borderRadius: '12px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'white', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#94a3b8', flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>{label}</p>
                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', margin: '2px 0 0' }}>{value}</p>
                      </div>
                    </div>
                  ))}
                  {selectedItem.sales_description && (
                    <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: '12px' }}>
                      <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Description</p>
                      <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.6 }}>{selectedItem.sales_description}</p>
                    </div>
                  )}
                  <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Customer ID</p>
                    <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b', margin: 0, wordBreak: 'break-all' }}>{selectedItem._id || 'N/A'}</p>
                  </div>
                </div>
              )}
              {activeTab !== 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', gap: '10px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#cbd5e1' }}>
                    {activeTab === 'transactions' ? <FaCreditCard /> : <FaClock />}
                  </div>
                  <p style={{ fontWeight: '700', color: '#475569', fontSize: '14px', margin: 0 }}>No {activeTab} yet</p>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Data will appear here once available.</p>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div style={{ padding: '16px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px' }}>
              <button onClick={() => selectedItem && navigate(`/sales/customers/edit/${selectedItem._id}`)}
                style={{ flex: 1, padding: '11px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
                <FaEdit size={12} /> Edit Customer
              </button>
              <button onClick={closeDrawer}
                style={{ flex: 1, padding: '11px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Customers;