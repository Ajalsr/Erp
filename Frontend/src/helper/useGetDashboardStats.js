import { useState, useEffect, useCallback } from 'react';
import axiosInstance from './axiosInstance';

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
  pendingInvoicesCount:     0,
  pendingInvoicesAmount:    0,
  overdueInvoicesCount:     0,
  overdueInvoicesAmount:    0,
  invoicesByStatus:         {},

  // ── Payments Received ─────────────────────────────────────────────────────
  totalRevenue:          0,
  thisMonthRevenue:      0,
  paymentsCount:         0,

  // ── Stock / Items ─────────────────────────────────────────────────────────
  totalItems:            0,
  lowStockCount:         0,
  lowStockItems:         [],
  allItems:              [],
  inventoryValue:        0,

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

  // ── Quotes ────────────────────────────────────────────────────────────────
  quotesCount:           0,
  quotesAmount:          0,

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

  // silent=true for background refreshes — keeps the current data on screen instead
  // of flashing skeletons. Only the very first load shows the loading state.
  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // One call to the server-side aggregator (was ~18 parallel requests). The
      // backend fans the queries out concurrently next to the DB and returns a
      // payload already shaped like DEFAULT_STATS, so we just merge it in.
      const res = await axiosInstance.get('/api/dashboard/summary');
      const d = res.data?.data ?? {};
      setStats({ ...DEFAULT_STATS, ...d });
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? 'Failed to load dashboard');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Refresh every 5 min (was 60s) in the background — no loading flash. The
    // summary is heavier per call and the dashboard rarely needs sub-minute data.
    const interval = setInterval(() => fetchAll({ silent: true }), 300_000);
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
