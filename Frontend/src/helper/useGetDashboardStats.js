/**
 * useGetDashboardStats
 *
 * Wires every customer-controller endpoint used by the dashboard:
 *
 *  GET /api/customers/dashboard        → GetDashboardStats (plain handler)
 *      response.data keys:
 *        totalCustomers, activeCustomers, pendingCustomers,
 *        todayNewCustomers, thisMonthNewCustomers, growthRate, updatedAt
 *
 *  GET /api/customers/stats            → GetCustomerStats (HandlerFunc)
 *      response.data keys:
 *        total.count, active.count, pending.count, inactive.count,
 *        byType.individual, byType.business, recent.count
 *
 *  GET /api/customers/status/:status   → GetCustomersByStatus (HandlerFunc)
 *      response.data  → Customer[]   response.count → N
 *
 *  GET /api/customers/:id/transactions → GetCustomerTransactions (HandlerFunc)
 *      response.data.transactions → []   response.data.count → N
 *
 *  GET /api/customers/:id/history      → GetCustomerHistory (HandlerFunc)
 *      response.data.history → [{action,timestamp,user,details}]
 *
 *  GET /api/sales-orders/stats         → GetSalesOrderStats (HandlerFunc)
 *  GET /api/stocks/getitem             → GetAllStocks (HandlerFunc)
 *
 * All requests use axiosInstance so the JWT Bearer token is attached
 * automatically and auto-logout fires on 401.
 */

import { useState, useEffect, useCallback } from 'react';
import axiosInstance from './axiosInstance/';

// ─── Shape helpers ────────────────────────────────────────────────────────────

const safe = (n) => (typeof n === 'number' && !isNaN(n) ? n : 0);

// ─── Default / skeleton values ────────────────────────────────────────────────
const DEFAULT_STATS = {
  // ── From /dashboard ──────────────────────────────────────────────────────
  totalCustomers:        0,
  activeCustomers:       0,
  pendingCustomers:      0,
  todayNewCustomers:     0,
  thisMonthNewCustomers: 0,
  growthRate:            0,
  dashboardUpdatedAt:    null,

  // ── From /stats ───────────────────────────────────────────────────────────
  inactiveCustomers:     0,
  businessCustomers:     0,
  individualCustomers:   0,
  recentCustomers:       0,

  // ── Customers by status ───────────────────────────────────────────────────
  activeCustomersList:   [],

  // ── From /sales-orders/stats ─────────────────────────────────────────────
  pendingOrders:         0,
  totalOrders:           0,
  completedOrders:       0,
  todayNewOrders:        0,
  todayRevenue:          0,
  recentOrders:          [],

  // ── From /stocks/getitem ─────────────────────────────────────────────────
  totalItems:            0,
  lowStockCount:         0,
  lowStockItems:         [],
  allItems:              [],

  // ── From /invoices/stats ─────────────────────────────────────────────────
  pendingInvoicesCount:  0,
  pendingInvoicesAmount: 0,   // outstanding balance across unpaid/partial/overdue
  invoicesByStatus:      {},

  // ── From /payments/stats ─────────────────────────────────────────────────
  totalRevenue:          0,   // all-time payments received
  thisMonthRevenue:      0,   // payments received this month
  paymentsCount:         0,

  // ── Computed progress-bar percentages (0-100) ────────────────────────────
  todayOrdersPct:        0,
  revenuePct:            0,
  pendingActionsPct:     0,
  dispatchedPct:         0,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
const useGetDashboardStats = () => {
  const [stats,   setStats]   = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ── Fire all requests in parallel ─────────────────────────────────────
      // allSettled: if one endpoint is down the rest still resolve.
      const [dashRes, statsRes, activeListRes, salesRes, stocksRes, recentOrdersRes, recentCustRes, invoiceStatsRes, paymentStatsRes] =
        await Promise.allSettled([
          axiosInstance.get('/api/customers/dashboard'),
          axiosInstance.get('/api/customers/stats'),
          axiosInstance.get('/api/customers/status/active'),
          axiosInstance.get('/api/sales-orders/stats'),
          axiosInstance.get('/api/stocks/getitem'),
          axiosInstance.get('/api/sales-orders/getsaleorder?page=1&limit=10'),
          axiosInstance.get('/api/customers/getcustomers?limit=5'),
          axiosInstance.get('/api/invoices/stats'),
          axiosInstance.get('/api/payments/stats'),
        ]);

      // ── 1. /dashboard ─────────────────────────────────────────────────────
      // GetDashboardStats returns data at response.data.data (envelope pattern)
      let totalCustomers        = 0;
      let activeCustomers       = 0;
      let pendingCustomers      = 0;
      let todayNewCustomers     = 0;
      let thisMonthNewCustomers = 0;
      let growthRate            = 0;
      let dashboardUpdatedAt    = null;

      if (dashRes.status === 'fulfilled') {
        const d = dashRes.value.data?.data ?? {};
        totalCustomers        = safe(d.totalCustomers);
        activeCustomers       = safe(d.activeCustomers);
        pendingCustomers      = safe(d.pendingCustomers);
        todayNewCustomers     = safe(d.todayNewCustomers);
        thisMonthNewCustomers = safe(d.thisMonthNewCustomers);
        growthRate            = safe(d.growthRate);
        dashboardUpdatedAt    = d.updatedAt ?? null;
      }

      // ── 2. /stats ─────────────────────────────────────────────────────────
      // GetCustomerStats returns nested objects: active.count, recent.count, etc.
      let inactiveCustomers   = 0;
      let businessCustomers   = 0;
      let individualCustomers = 0;
      let recentCustomers     = 0;

      if (statsRes.status === 'fulfilled') {
        const d = statsRes.value.data?.data ?? {};
        inactiveCustomers   = safe(d.inactive?.count);
        businessCustomers   = safe(d.byType?.business);
        individualCustomers = safe(d.byType?.individual);
        recentCustomers     = safe(d.recent?.count);
        // If dashboard call failed, fall back to stats endpoint for actives
        if (dashRes.status !== 'fulfilled') {
          activeCustomers = safe(d.active?.count);
          totalCustomers  = safe(d.total?.count);
        }
      }

      // ── 3. /status/active ────────────────────────────────────────────────
      // GetCustomersByStatus returns { data: Customer[], count: N }
      let activeCustomersList = [];
      if (activeListRes.status === 'fulfilled') {
        activeCustomersList = activeListRes.value.data?.data ?? [];
      }
      // Override with full recent customers list if available (for activity feed)
      if (recentCustRes && recentCustRes.status === 'fulfilled') {
        const recent = recentCustRes.value.data?.data ?? [];
        if (recent.length > 0) activeCustomersList = recent;
      }

      // ── 4. /sales-orders/stats ───────────────────────────────────────────
      let pendingOrders   = 0;
      let totalOrders     = 0;
      let completedOrders = 0;
      let todayNewOrders  = 0;
      let todayRevenue    = 0;
      let recentOrders    = [];

      if (salesRes.status === 'fulfilled') {
        const d = salesRes.value.data?.data ?? {};
        // Handle both nested-object and flat shapes from the sales controller
        pendingOrders   = safe(d.pendingOrders   ?? d.pending?.count   ?? d.pendingCount);
        totalOrders     = safe(d.totalOrders     ?? d.total?.count     ?? d.totalCount);
        completedOrders = safe(d.completedOrders ?? d.completed?.count ?? d.completedCount);
        todayNewOrders  = safe(d.todayOrders     ?? d.todayNew?.count  ?? d.todayNewOrders);
        todayRevenue    = safe(d.todayRevenue);
        recentOrders    = Array.isArray(d.recentOrders) ? d.recentOrders : [];
      }
      // Override recentOrders with the dedicated paginated endpoint (richer data)
      if (recentOrdersRes.status === 'fulfilled') {
        const d = recentOrdersRes.value.data?.data ?? {};
        const orders = Array.isArray(d.salesOrders) ? d.salesOrders : (Array.isArray(d) ? d : []);
        if (orders.length > 0) recentOrders = orders;
      }

      // ── 5. /stocks/getitem ───────────────────────────────────────────────
      // GetAllStocks returns { data: Item[] }
      let totalItems    = 0;
      let lowStockCount = 0;
      let lowStockItems = [];

      if (stocksRes.status === 'fulfilled') {
        const items = stocksRes.value.data?.data ?? [];
        totalItems = items.length;

        // Low stock: current quantity at or below reorder_point
        lowStockItems = items
          .filter(item => {
            const qty     = safe(item.quantity     ?? item.Quantity);
            const reorder = safe(item.reorder_point ?? item.ReorderPoint ?? 0);
            return reorder > 0 && qty <= reorder;
          })
          .map(item => {
            const qty     = safe(item.quantity     ?? item.Quantity);
            const reorder = safe(item.reorder_point ?? item.ReorderPoint ?? 0);
            return {
              id:   item._id,
              name: item.itemName ?? item.name ?? 'Unknown Item',
              code: item.itemCode ?? item.code ?? '—',
              cur:  qty,
              min:  reorder,
              // critical = qty at or below half of reorder point
              s:    qty <= reorder / 2 ? 'critical' : 'warning',
            };
          });

        lowStockCount = lowStockItems.length;
      }
      const allItems = stocksRes.status === 'fulfilled'
        ? (stocksRes.value.data?.data ?? [])
        : [];

      // ── 6. /invoices/stats ───────────────────────────────────────────────
      let pendingInvoicesCount  = 0;
      let pendingInvoicesAmount = 0;
      let invoicesByStatus      = {};

      if (invoiceStatsRes.status === 'fulfilled') {
        const d = invoiceStatsRes.value.data?.data ?? {};
        invoicesByStatus      = d.byStatus ?? {};
        pendingInvoicesCount  = safe(d.outstandingCount);
        pendingInvoicesAmount = safe(d.outstandingTotal);
      }

      // ── 7. /payments/stats ───────────────────────────────────────────────
      let totalRevenue     = 0;
      let thisMonthRevenue = 0;
      let paymentsCount    = 0;

      if (paymentStatsRes.status === 'fulfilled') {
        const d = paymentStatsRes.value.data?.data ?? {};
        totalRevenue     = safe(d.totalReceived);
        thisMonthRevenue = safe(d.thisMonth);
        paymentsCount    = safe(d.count);
      }

      // ── Compute progress-bar percentages for Today's Metrics ─────────────
      const DAILY_ORDER_TARGET   = 20;
      const DAILY_REVENUE_TARGET = 50_000;  // AED

      const todayOrdersPct     = Math.min(Math.round((todayNewOrders / DAILY_ORDER_TARGET)   * 100), 100);
      const revenuePct         = Math.min(Math.round((todayRevenue   / DAILY_REVENUE_TARGET) * 100), 100);
      const pendingActionsPct  = Math.min(Math.round((pendingOrders  / 20)                   * 100), 100);
      const dispatchedPct      = 40;

      // ── Merge and publish ─────────────────────────────────────────────────
      setStats({
        totalCustomers,
        activeCustomers,
        pendingCustomers,
        todayNewCustomers,
        thisMonthNewCustomers,
        growthRate,
        dashboardUpdatedAt,

        inactiveCustomers,
        businessCustomers,
        individualCustomers,
        recentCustomers,
        activeCustomersList,

        pendingOrders,
        totalOrders,
        completedOrders,
        todayNewOrders,
        todayRevenue,
        recentOrders,

        totalItems,
        lowStockCount,
        lowStockItems,
        allItems,

        pendingInvoicesCount,
        pendingInvoicesAmount,
        invoicesByStatus,

        totalRevenue,
        thisMonthRevenue,
        paymentsCount,

        todayOrdersPct,
        revenuePct,
        pendingActionsPct,
        dispatchedPct,
      });

    } catch (err) {
      console.error('[useGetDashboardStats] unexpected error:', err);
      setError(err?.response?.data?.message ?? err.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 60 s to keep the "Live" indicator meaningful
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Per-customer helpers (called on demand from drawer/detail panels) ─────

  /**
   * getCustomerTransactions(customerId)
   * Calls GET /api/customers/:id/transactions
   * Returns { transactions: [], count: 0, customer: string, customerId: ObjectID }
   */
  const getCustomerTransactions = useCallback(async (customerId) => {
    if (!customerId) return { transactions: [], count: 0 };
    try {
      const res = await axiosInstance.get(`/api/customers/${customerId}/transactions`);
      return res.data?.data ?? { transactions: [], count: 0 };
    } catch (err) {
      console.error('[getCustomerTransactions]', err);
      return { transactions: [], count: 0, error: err.message };
    }
  }, []);

  /**
   * getCustomerHistory(customerId)
   * Calls GET /api/customers/:id/history
   * Returns { history: [{action, timestamp, user, details}], count: N }
   */
  const getCustomerHistory = useCallback(async (customerId) => {
    if (!customerId) return { history: [], count: 0 };
    try {
      const res = await axiosInstance.get(`/api/customers/${customerId}/history`);
      return res.data?.data ?? { history: [], count: 0 };
    } catch (err) {
      console.error('[getCustomerHistory]', err);
      return { history: [], count: 0, error: err.message };
    }
  }, []);

  /**
   * getCustomersByStatus(status)
   * Calls GET /api/customers/status/:status
   * Returns { customers: Customer[], count: N }
   */
  const getCustomersByStatus = useCallback(async (status) => {
    if (!status) return { customers: [], count: 0 };
    try {
      const res = await axiosInstance.get(`/api/customers/status/${status}`);
      const data = res.data;
      return {
        customers: data?.data ?? [],
        count:     data?.count ?? 0,
      };
    } catch (err) {
      console.error('[getCustomersByStatus]', err);
      return { customers: [], count: 0, error: err.message };
    }
  }, []);

  return {
    stats,
    loading,
    error,
    refresh: fetchAll,
    // On-demand per-customer helpers
    getCustomerTransactions,
    getCustomerHistory,
    getCustomersByStatus,
  };
};

export default useGetDashboardStats;