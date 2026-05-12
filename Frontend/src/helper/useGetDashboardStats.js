import { useState, useEffect, useCallback } from 'react';
import axiosInstance from './axiosInstance';

const safe = (n) => (typeof n === 'number' && !isNaN(n) ? n : 0);

const DEFAULT_STATS = {
  // ── Customers ──────────────────────────────────────────────────────────────
  totalCustomers:        0,
  activeCustomers:       0,
  pendingCustomers:      0,
  todayNewCustomers:     0,
  thisMonthNewCustomers: 0,
  growthRate:            0,
  activeCustomersList:   [],
  inactiveCustomers:     0,
  businessCustomers:     0,
  individualCustomers:   0,

  // ── Sales Orders ──────────────────────────────────────────────────────────
  pendingOrders:         0,
  totalOrders:           0,
  completedOrders:       0,
  todayNewOrders:        0,
  todayRevenue:          0,
  recentOrders:          [],

  // ── Invoices ──────────────────────────────────────────────────────────────
  pendingInvoicesCount:  0,
  pendingInvoicesAmount: 0,
  invoicesByStatus:      {},

  // ── Payments Received ─────────────────────────────────────────────────────
  totalRevenue:          0,
  thisMonthRevenue:      0,
  paymentsCount:         0,

  // ── Stock / Items ─────────────────────────────────────────────────────────
  totalItems:            0,
  lowStockCount:         0,
  lowStockItems:         [],
  allItems:              [],

  // ── Bills (Accounts Payable) ──────────────────────────────────────────────
  totalPayable:          0,
  totalBillsCount:       0,
  openBillsCount:        0,
  partialBillsCount:     0,
  overdueBillsCount:     0,
  recentBills:           [],

  // ── Purchase Orders ───────────────────────────────────────────────────────
  totalPOs:              0,
  pendingPOs:            0,
  orderedPOs:            0,
  receivedPOs:           0,
  totalPOValue:          0,
  recentPOs:             [],

  // ── Vendors ───────────────────────────────────────────────────────────────
  totalVendors:          0,
  activeVendors:         0,

  // ── Vendor Payments ───────────────────────────────────────────────────────
  totalPaid:             0,
  thisMonthPaid:         0,
  vendorPaymentsCount:   0,

  // ── Computed % ────────────────────────────────────────────────────────────
  todayOrdersPct:        0,
  revenuePct:            0,
  pendingActionsPct:     0,

  // ── AR / AP Aging ─────────────────────────────────────────────────────────
  arAging:  { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 },
  apAging:  { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 },

  // ── 30-day Cash Flow Projection ───────────────────────────────────────────
  cashflowIn:  0,
  cashflowOut: 0,
  cashflowNet: 0,
};

const useGetDashboardStats = () => {
  const [stats,   setStats]   = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        dashRes, statsRes, activeListRes, salesRes, stocksRes,
        recentOrdersRes, recentCustRes, invoiceStatsRes, paymentStatsRes,
        billStatsRes, billsRes, poStatsRes, poisRes, vendorRes, vendorPayStatsRes,
        allInvoicesRes, allBillsRes,
      ] = await Promise.allSettled([
        axiosInstance.get('/api/customers/dashboard'),
        axiosInstance.get('/api/customers/stats'),
        axiosInstance.get('/api/customers/status/active'),
        axiosInstance.get('/api/sales-orders/stats'),
        axiosInstance.get('/api/stocks/getitem'),
        axiosInstance.get('/api/sales-orders/getsaleorder?page=1&limit=10'),
        axiosInstance.get('/api/customers/getcustomers?limit=5'),
        axiosInstance.get('/api/invoices/stats'),
        axiosInstance.get('/api/payments/stats'),
        axiosInstance.get('/api/bills/stats'),
        axiosInstance.get('/api/bills/?limit=5'),
        axiosInstance.get('/api/purchase-orders/stats'),
        axiosInstance.get('/api/purchase-orders/getorders?limit=5'),
        axiosInstance.get('/api/vendors/?limit=1'),
        axiosInstance.get('/api/vendor-payments/stats'),
        axiosInstance.get('/api/invoices/?limit=300'),
        axiosInstance.get('/api/bills/?limit=300'),
      ]);

      // ── Customers ──────────────────────────────────────────────────────────
      let totalCustomers = 0, activeCustomers = 0, pendingCustomers = 0;
      let todayNewCustomers = 0, thisMonthNewCustomers = 0, growthRate = 0;
      let inactiveCustomers = 0, businessCustomers = 0, individualCustomers = 0;
      let activeCustomersList = [];

      if (dashRes.status === 'fulfilled') {
        const d = dashRes.value.data?.data ?? {};
        totalCustomers = safe(d.totalCustomers); activeCustomers = safe(d.activeCustomers);
        pendingCustomers = safe(d.pendingCustomers); todayNewCustomers = safe(d.todayNewCustomers);
        thisMonthNewCustomers = safe(d.thisMonthNewCustomers); growthRate = safe(d.growthRate);
      }
      if (statsRes.status === 'fulfilled') {
        const d = statsRes.value.data?.data ?? {};
        inactiveCustomers = safe(d.inactive?.count); businessCustomers = safe(d.byType?.business);
        individualCustomers = safe(d.byType?.individual);
        if (dashRes.status !== 'fulfilled') { activeCustomers = safe(d.active?.count); totalCustomers = safe(d.total?.count); }
      }
      if (recentCustRes?.status === 'fulfilled') {
        const r = recentCustRes.value.data?.data ?? [];
        activeCustomersList = r.length > 0 ? r : (activeListRes.status === 'fulfilled' ? (activeListRes.value.data?.data ?? []) : []);
      } else if (activeListRes.status === 'fulfilled') {
        activeCustomersList = activeListRes.value.data?.data ?? [];
      }

      // ── Sales Orders ───────────────────────────────────────────────────────
      let pendingOrders = 0, totalOrders = 0, completedOrders = 0, todayNewOrders = 0, todayRevenue = 0;
      let recentOrders = [];

      if (salesRes.status === 'fulfilled') {
        const d = salesRes.value.data?.data ?? {};
        pendingOrders   = safe(d.pendingOrders   ?? d.pending?.count   ?? d.pendingCount);
        totalOrders     = safe(d.totalOrders     ?? d.total?.count     ?? d.totalCount);
        completedOrders = safe(d.completedOrders ?? d.completed?.count ?? d.completedCount);
        todayNewOrders  = safe(d.todayOrders     ?? d.todayNew?.count  ?? d.todayNewOrders);
        todayRevenue    = safe(d.todayRevenue);
        recentOrders    = Array.isArray(d.recentOrders) ? d.recentOrders : [];
      }
      if (recentOrdersRes.status === 'fulfilled') {
        const d = recentOrdersRes.value.data?.data ?? {};
        const orders = Array.isArray(d.salesOrders) ? d.salesOrders : (Array.isArray(d) ? d : []);
        if (orders.length > 0) recentOrders = orders;
      }

      // ── Stock ──────────────────────────────────────────────────────────────
      let totalItems = 0, lowStockCount = 0, lowStockItems = [], allItems = [];
      if (stocksRes.status === 'fulfilled') {
        const items = stocksRes.value.data?.data ?? [];
        totalItems = items.length; allItems = items;
        lowStockItems = items.filter(item => {
          const qty    = parseFloat(item.quantity    ?? item.Quantity    ?? 0) || 0;
          const reorder = parseFloat(item.reorder_point ?? item.ReorderPoint ?? 0) || 0;
          return reorder > 0 && qty <= reorder;
        }).map(item => {
          const qty    = parseFloat(item.quantity    ?? item.Quantity    ?? 0) || 0;
          const reorder = parseFloat(item.reorder_point ?? item.ReorderPoint ?? 0) || 0;
          return { id: item._id, name: item.itemName ?? item.name ?? 'Unknown', code: item.itemCode ?? item.code ?? '—', cur: qty, min: reorder, s: qty <= reorder / 2 ? 'critical' : 'warning' };
        });
        lowStockCount = lowStockItems.length;
      }

      // ── Invoices ───────────────────────────────────────────────────────────
      let pendingInvoicesCount = 0, pendingInvoicesAmount = 0, invoicesByStatus = {};
      if (invoiceStatsRes.status === 'fulfilled') {
        const d = invoiceStatsRes.value.data?.data ?? {};
        invoicesByStatus = d.byStatus ?? {};
        pendingInvoicesCount  = safe(d.outstandingCount);
        pendingInvoicesAmount = safe(d.outstandingTotal);
      }

      // ── Payments Received ──────────────────────────────────────────────────
      let totalRevenue = 0, thisMonthRevenue = 0, paymentsCount = 0;
      if (paymentStatsRes.status === 'fulfilled') {
        const d = paymentStatsRes.value.data?.data ?? {};
        totalRevenue = safe(d.totalReceived); thisMonthRevenue = safe(d.thisMonth); paymentsCount = safe(d.count);
      }

      // ── Bills ──────────────────────────────────────────────────────────────
      let totalPayable = 0, totalBillsCount = 0;
      let openBillsCount = 0, partialBillsCount = 0, overdueBillsCount = 0;
      let recentBills = [];

      if (billStatsRes.status === 'fulfilled') {
        const d = billStatsRes.value.data?.data ?? {};
        totalPayable      = safe(d.totalPayable);
        totalBillsCount   = safe(d.totalCount);
        const bs          = d.byStatus ?? {};
        openBillsCount    = safe(bs.open?.count);
        partialBillsCount = safe(bs.partial?.count);
        overdueBillsCount = safe(bs.overdue?.count);
      }
      if (billsRes.status === 'fulfilled') {
        recentBills = billsRes.value.data?.data?.bills ?? [];
      }

      // ── Purchase Orders ────────────────────────────────────────────────────
      let totalPOs = 0, pendingPOs = 0, orderedPOs = 0, receivedPOs = 0, totalPOValue = 0;
      let recentPOs = [];

      if (poStatsRes.status === 'fulfilled') {
        const d = poStatsRes.value.data?.data ?? {};
        totalPOs   = safe(d.totalOrders);
        pendingPOs = safe(d.pendingOrders);
        orderedPOs = safe(d.orderedOrders);
        receivedPOs= safe(d.receivedOrders);
        totalPOValue = safe(d.totalAmount);
      }
      if (poisRes.status === 'fulfilled') {
        const d = poisRes.value.data?.data ?? {};
        recentPOs = Array.isArray(d.purchaseOrders) ? d.purchaseOrders : [];
      }

      // ── Vendors ────────────────────────────────────────────────────────────
      let totalVendors = 0, activeVendors = 0;
      if (vendorRes.status === 'fulfilled') {
        const d = vendorRes.value.data?.data ?? {};
        totalVendors  = safe(d.total);
        activeVendors = safe(d.active ?? totalVendors);
      }

      // ── Vendor Payments ────────────────────────────────────────────────────
      let totalPaid = 0, thisMonthPaid = 0, vendorPaymentsCount = 0;
      if (vendorPayStatsRes.status === 'fulfilled') {
        const d = vendorPayStatsRes.value.data?.data ?? {};
        totalPaid           = safe(d.totalPaid);
        thisMonthPaid       = safe(d.thisMonth);
        vendorPaymentsCount = safe(d.count);
      }

      // ── AR / AP Aging + Cash Flow Projection ──────────────────────────────
      const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
      const in30 = new Date(todayMidnight); in30.setDate(in30.getDate() + 30);

      const arAging  = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
      let   cfIn     = 0; // cash expected in (next 30 days)

      if (allInvoicesRes.status === 'fulfilled') {
        const invs = allInvoicesRes.value.data?.data?.invoices ?? [];
        invs.filter(inv => !['paid','void','draft'].includes((inv.status||'').toLowerCase()))
            .forEach(inv => {
              const bal = safe(inv.balanceDue ?? inv.totals?.grandTotal);
              const due = inv.dueDate ? new Date(inv.dueDate) : null;
              if (due) {
                due.setHours(0,0,0,0);
                if (due >= todayMidnight && due <= in30) cfIn += bal;
              }
              if (!due || due >= todayMidnight) { arAging.current += bal; return; }
              const d = Math.floor((todayMidnight - due) / 86400000);
              if      (d <= 30) arAging.d30  += bal;
              else if (d <= 60) arAging.d60  += bal;
              else if (d <= 90) arAging.d90  += bal;
              else              arAging.d90p += bal;
            });
      }

      const apAging  = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
      let   cfOut    = 0; // cash expected out (next 30 days)

      if (allBillsRes.status === 'fulfilled') {
        const bills = allBillsRes.value.data?.data?.bills ?? [];
        bills.filter(b => !['paid'].includes((b.status||'').toLowerCase()))
             .forEach(b => {
               const bal = safe(b.balanceDue ?? (safe(b.totals?.grandTotal) - safe(b.amountPaid)));
               const due = b.dueDate ? new Date(b.dueDate) : null;
               if (due) {
                 due.setHours(0,0,0,0);
                 if (due >= todayMidnight && due <= in30) cfOut += bal;
               }
               if (!due || due >= todayMidnight) { apAging.current += bal; return; }
               const d = Math.floor((todayMidnight - due) / 86400000);
               if      (d <= 30) apAging.d30  += bal;
               else if (d <= 60) apAging.d60  += bal;
               else if (d <= 90) apAging.d90  += bal;
               else              apAging.d90p += bal;
             });
      }

      const cashflowIn  = cfIn;
      const cashflowOut = cfOut;
      const cashflowNet = cfIn - cfOut;

      // ── Progress bar percentages ───────────────────────────────────────────
      const todayOrdersPct    = Math.min(Math.round((todayNewOrders / 20)     * 100), 100);
      const revenuePct        = Math.min(Math.round((todayRevenue   / 50_000) * 100), 100);
      const pendingActionsPct = Math.min(Math.round((pendingOrders  / 20)     * 100), 100);

      setStats({
        totalCustomers, activeCustomers, pendingCustomers, todayNewCustomers,
        thisMonthNewCustomers, growthRate, activeCustomersList,
        inactiveCustomers, businessCustomers, individualCustomers,
        pendingOrders, totalOrders, completedOrders, todayNewOrders, todayRevenue, recentOrders,
        totalItems, lowStockCount, lowStockItems, allItems,
        pendingInvoicesCount, pendingInvoicesAmount, invoicesByStatus,
        totalRevenue, thisMonthRevenue, paymentsCount,
        totalPayable, totalBillsCount, openBillsCount, partialBillsCount, overdueBillsCount, recentBills,
        totalPOs, pendingPOs, orderedPOs, receivedPOs, totalPOValue, recentPOs,
        totalVendors, activeVendors,
        totalPaid, thisMonthPaid, vendorPaymentsCount,
        todayOrdersPct, revenuePct, pendingActionsPct,
        arAging, apAging,
        cashflowIn, cashflowOut, cashflowNet,
      });

    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const getCustomerTransactions = useCallback(async (customerId) => {
    if (!customerId) return { transactions: [], count: 0 };
    try {
      const res = await axiosInstance.get(`/api/customers/${customerId}/transactions`);
      return res.data?.data ?? { transactions: [], count: 0 };
    } catch (err) { return { transactions: [], count: 0, error: err.message }; }
  }, []);

  const getCustomerHistory = useCallback(async (customerId) => {
    if (!customerId) return { history: [], count: 0 };
    try {
      const res = await axiosInstance.get(`/api/customers/${customerId}/history`);
      return res.data?.data ?? { history: [], count: 0 };
    } catch (err) { return { history: [], count: 0, error: err.message }; }
  }, []);

  const getCustomersByStatus = useCallback(async (status) => {
    if (!status) return { customers: [], count: 0 };
    try {
      const res = await axiosInstance.get(`/api/customers/status/${status}`);
      return { customers: res.data?.data ?? [], count: res.data?.count ?? 0 };
    } catch (err) { return { customers: [], count: 0, error: err.message }; }
  }, []);

  return { stats, loading, error, refresh: fetchAll, getCustomerTransactions, getCustomerHistory, getCustomersByStatus };
};

export default useGetDashboardStats;
