// DeliveryNote.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  FaPrint, FaTimes, FaEdit, FaEnvelope, FaFileDownload,
  FaCheckCircle, FaTruck, FaBoxOpen, FaListAlt
} from 'react-icons/fa';
import { format } from 'date-fns';

export default function DeliveryNote() {
  const navigate = useNavigate();
  const location = useLocation();
  const { outboundData, deliveryNote: deliveryNoteFromState } = location.state || {};
  
  const [deliveryNote, setDeliveryNote] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [customerInfo, setCustomerInfo] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Format currency
  const formatCurrency = (amount) => {
    return `AED ${parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  // Initialize data
  useEffect(() => {
    if (outboundData && deliveryNoteFromState) {
      setLoading(true);
      try {
        // Transform items to match the table format from your image
        const transformedItems = outboundData.items.map((item, index) => ({
          id: item._id || item.itemId || `item-${index}`,
          description: item.name,
          sku: item.sku || item.item_code || `SKU-${index}`,
          quantity: item.quantity,
          unitPrice: formatCurrency(item.rate),
          total: formatCurrency(item.quantity * parseFloat(item.selling_price || 0)),
          discount: item.discount,
          sellingPrice: item.selling_price,
          orderedQuantity: item.orderedQuantity,
          unit: item.unit
        }));

        console.log('Transformed Items:', transformedItems);

        // Calculate summary
        const subtotal = transformedItems.reduce((sum, item) => 
          sum + (item.quantity * parseFloat(item.rate?.replace(/[^\d.-]/g, '') || 0)), 0);
        
        const totalDiscount = transformedItems.reduce((sum, item) => 
          sum + parseFloat(item.discount || 0), 0);
        
        const total = transformedItems.reduce((sum, item) => 
  sum + (item.quantity * parseFloat(item.sellingPrice || 0)), 0);

        setItems(transformedItems);
        setSummary({
          subtotal: formatCurrency(subtotal),
          totalDiscount: formatCurrency(totalDiscount),
          total: formatCurrency(total),
          totalItems: transformedItems.length,
          totalQuantity: transformedItems.reduce((sum, item) => sum + item.quantity, 0)
        });
        
        setCustomerInfo(outboundData.customerInfo || {});
        setDeliveryNote({
          ...deliveryNoteFromState,
          // Ensure we have a proper date format
          date: deliveryNoteFromState.date || format(new Date(), 'MM/dd/yyyy')
        });

      } catch (err) {
        setError('Failed to process delivery note data');
        console.error('Error processing data:', err);
      } finally {
        setLoading(false);
      }
    } else {
      // If no data was passed, redirect back
      setTimeout(() => {
        navigate('/outbound');
      }, 2000);
    }
  }, [outboundData, deliveryNoteFromState, navigate]);

  // Handle print
  const handlePrint = () => {
    const printContent = document.getElementById('delivery-note-content');
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Delivery Note ${deliveryNote?.number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .company-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .document-title { font-size: 20px; margin: 20px 0; }
          .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
          .detail-item { margin-bottom: 10px; }
          .label { font-weight: bold; color: #666; }
          .value { margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .summary { margin-top: 30px; }
          .summary-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #000; padding-top: 10px; }
          .footer { margin-top: 50px; font-size: 12px; color: #666; text-align: center; }
          .status-badge { display: inline-block; padding: 5px 10px; border-radius: 20px; font-size: 12px; }
          .shipped { background-color: #d1fae5; color: #065f46; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">ERP SYSTEM</div>
          <div class="document-title">DELIVERY NOTE</div>
        </div>
        
        <div class="details-grid">
          <div>
            <div class="detail-item">
              <div class="label">Delivery Note #</div>
              <div class="value">${deliveryNote?.number || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="label">Date</div>
              <div class="value">${deliveryNote?.date || 'N/A'}</div>
            </div>
          </div>
          <div>
            <div class="detail-item">
              <div class="label">Order #</div>
              <div class="value">${deliveryNote?.orderNumber || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="label">Customer</div>
              <div class="value">${deliveryNote?.customer || 'N/A'}</div>
            </div>
            <div class="detail-item">
              <div class="label">Status</div>
              <div class="value">
                <span class="status-badge shipped">${deliveryNote?.status || 'Shipped'}</span>
              </div>
            </div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th>SKU</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td>${item.sku}</td>
                <td>${item.quantity}</td>
                <td>${item.unitPrice}</td>
                <td>${item.total}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="summary">
          <div class="summary-row">
            <span>Subtotal:</span>
            <span>${summary.subtotal || 'AED 0.00'}</span>
          </div>
          <div class="summary-row">
            <span>Discount:</span>
            <span>- ${summary.totalDiscount || 'AED 0.00'}</span>
          </div>
          <div class="summary-row total-row">
            <span>TOTAL:</span>
            <span>${summary.total || 'AED 0.00'}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>The discount has been applied as per the outbound item order.</p>
          <p>Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Handle send
  const handleSend = () => {
    alert('Delivery note sent to customer');
    // In real app, implement email/sms sending
  };

  // Handle download
  const handleDownload = () => {
    const data = {
      deliveryNote,
      items,
      summary,
      customerInfo
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deliveryNote?.number || 'delivery-note'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  
  const handleClose = () => {
    navigate('/outbound');
  };

 
  if (loading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading delivery note...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-700">Error</h3>
          <p className="text-gray-500 mt-2">{error}</p>
          <button
            onClick={handleClose}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Return to Outbound
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!deliveryNote) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No delivery note data found. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen p-6 text-gray-800" id="delivery-note-content">
      {/* Header Navigation */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">ERP</h1>
        <div className="flex flex-wrap items-center text-sm text-gray-600">
          <span className="font-medium">Home</span>
          <span className="mx-2">›</span>
          <span className="text-gray-800">Outbound</span>
          <span className="mx-2">›</span>
          <span className="text-blue-600 font-medium">Delivery Note</span>
        </div>
      </div>

      {/* Success Message */}
      <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
            <FaCheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">Delivery Note Created!</h2>
            <p className="text-gray-600 mt-1">
              The outbound items have been successfully saved as a delivery note. Here are the details:
            </p>
            
            {/* Delivery Note Details Card */}
            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Delivery Note #</p>
                  <p className="font-bold text-lg text-gray-800">{deliveryNote.number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                  <p className="font-medium text-gray-800">{deliveryNote.date}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Order #</p>
                  <p className="font-medium text-gray-800">{deliveryNote.orderNumber}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
                  <p className="font-medium text-gray-800">{deliveryNote.customer}</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">Delivery Status:</span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full flex items-center ${
                    deliveryNote.status === 'Shipped' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <FaTruck className="mr-2" />
                    {deliveryNote.status}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => navigate('/outbound')}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center"
                  >
                    <FaListAlt className="mr-2" />
                    Delivery List
                  </button>
                  <button 
                    onClick={() => navigate(`/outbound/edit/${deliveryNote.number}`)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center"
                  >
                    <FaEdit className="mr-2" />
                    Edit
                  </button>
                  <button 
                    onClick={handleSend}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                  >
                    <FaEnvelope className="mr-2" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 border-r border-gray-200 whitespace-nowrap">
                  Item Description
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 border-r border-gray-200 whitespace-nowrap">
                  SKU
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 border-r border-gray-200 whitespace-nowrap">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 border-r border-gray-200 whitespace-nowrap">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 border-r border-gray-200">
                    <div className="font-medium text-gray-800">{item.description}</div>
                    {item.orderedQuantity && (
                      <div className="text-xs text-gray-500 mt-1">
                        Ordered: {item.orderedQuantity} {item.unit}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 border-r border-gray-200">
                    <span className="font-mono text-gray-700">{item.sku}</span>
                  </td>
                  <td className="px-4 py-3 border-r border-gray-200">
                    <span className="font-medium">{item.quantity}</span>
                    <span className="text-xs text-gray-500 ml-1">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3 border-r border-gray-200">
                    {item.discount > 0 ? (
                      <div>
                        <div className="text-xs text-gray-500 line-through">
                          {item.unitPrice}
                        </div>
                        <div className="font-medium text-gray-800">
                          {formatCurrency(item.sellingPrice)}
                        </div>
                      </div>
                    ) : (
                      <div className="font-medium text-gray-800">{item.unitPrice}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {item.total}
                  </td>
                </tr>
              ))}
              
              {/* Summary Rows */}
              <tr className="bg-gray-50">
                <td colSpan="3" className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right font-medium text-gray-600 border-r border-gray-200">
                  Subtotal
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {summary.subtotal}
                </td>
              </tr>
              
              <tr>
                <td colSpan="3" className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right text-gray-600 border-r border-gray-200">
                  Discount
                </td>
                <td className="px-4 py-3 text-red-600 font-medium">
                  - {summary.totalDiscount}
                </td>
              </tr>
              
              <tr className="bg-blue-50">
                <td colSpan="3" className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right font-bold text-gray-800 border-r border-gray-200">
                  TOTAL
                </td>
                <td className="px-4 py-3 font-bold text-lg text-gray-800">
                  {summary.total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Note */}
      <div className="mb-8 p-4 bg-yellow-50 border border-yellow-100 rounded">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Note:</span> The discount has been applied as per the outbound item order.
          {deliveryNote.note && (
            <>
              <br />
              <span className="mt-1 block">Additional Notes: {deliveryNote.note}</span>
            </>
          )}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3">
        <button
          onClick={handleDownload}
          className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
        >
          <FaFileDownload className="mr-2" />
          Download JSON
        </button>
        <button
          onClick={handleClose}
          className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center"
        >
          <FaTimes className="mr-2" />
          Close
        </button>
        <button
          onClick={handlePrint}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <FaPrint className="mr-2" />
          Print Delivery Note
        </button>
      </div>

      {/* Summary Stats */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Total Items</div>
            <div className="text-xl font-bold text-gray-800">{summary.totalItems || 0}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Total Quantity</div>
            <div className="text-xl font-bold text-gray-800">{summary.totalQuantity || 0}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Total Discount</div>
            <div className="text-xl font-bold text-red-600">{summary.totalDiscount || 'AED 0.00'}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-xl font-bold text-gray-800">{summary.total || 'AED 0.00'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}