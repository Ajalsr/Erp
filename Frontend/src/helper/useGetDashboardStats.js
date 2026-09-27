import { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from './axiosInstance';
import useRealtime from './useRealtime';

// Mutations that change a dashboard number. A ws "<entity>_updated" event for any of
// these refreshes the summary — no need to poll every few seconds.
const DASH_EVENTS = [
  'invoices_updated', 'payments_updated', 'bills_updated', 'vendor_payments_updated',
  'sales_orders_updated', 'purchase_orders_updated', 'customers_updated', 'vendors_updated',
  'stocks_updated', 'adjustments_updated', 'quotes_updated', 'grns_updated', 'delivery_notes_updated',
  'credit_notes_updated', 'debit_notes_updated', 'advance_payments_updated', 'vendor_credits_updated',
  'journal_entries_updated',
];

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
      // 403 here means the org's plan doesn't include the dashboard module (or
      // the role lacks it) — a deliberate restriction, not a failure. Showing
      // the "some data could not be loaded" banner for that is misleading (it
      // reads as a bug); stay quiet and keep the zero-state defaults instead.
      // Anything else (network drop, 500, ...) is a real error, still surfaced.
      if (err?.response?.status !== 403) {
        setError(err?.response?.data?.message ?? err.message ?? 'Failed to load dashboard');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // ws-driven refresh: when any relevant mutation broadcasts, refresh once. Debounced
  // so a burst (e.g. a payment that touches bill + vendor + JE) triggers ONE summary
  // call, not several.
  const debounceRef = useRef(null);
  const onRealtime = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAll({ silent: true }), 2500);
  }, [fetchAll]);
  useRealtime(DASH_EVENTS, onRealtime);

  useEffect(() => {
    fetchAll();
    // Safety fallback only — ws drives normal refreshes. 10 min catches any missed
    // event (dropped socket, cross-tab) without polling every few seconds.
    const interval = setInterval(() => fetchAll({ silent: true }), 600_000);
    return () => { clearInterval(interval); if (debounceRef.current) clearTimeout(debounceRef.current); };
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
