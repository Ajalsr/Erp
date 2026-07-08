import { useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from './axiosInstance';
import useRealtime from './useRealtime';

// A ws "<entity>_updated" event for either of these refreshes the rep summary.
const REP_EVENTS = ['quotes_updated', 'sales_orders_updated'];

const DEFAULT_STATS = {
  year:              new Date().getFullYear(),
  yearlyTarget:      0,
  salesAchieved:     0,
  achievedPct:       0,
  quotationMade:     0,
  quotationAchieved: 0,
  salesMade:         0,
  salesConverted:    0,
  monthly:           [],
  rank:              0,
  rankTotal:         0,
};

// Sales-rep dashboard data: the caller's OWN quotes/sales for the current year,
// plus the org-wide yearly target. Mirrors useGetDashboardStats' shape but smaller.
const useGetSalesRepStats = () => {
  const [stats,   setStats]   = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get('/api/dashboard/sales-rep');
      const d = res.data?.data ?? {};
      setStats({ ...DEFAULT_STATS, ...d });
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? 'Failed to load dashboard');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // ws-driven refresh, debounced so a burst triggers one call.
  const debounceRef = useRef(null);
  const onRealtime = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAll({ silent: true }), 2500);
  }, [fetchAll]);
  useRealtime(REP_EVENTS, onRealtime);

  useEffect(() => {
    fetchAll();
    // Safety fallback only — ws drives normal refreshes.
    const interval = setInterval(() => fetchAll({ silent: true }), 600_000);
    return () => { clearInterval(interval); if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchAll]);

  return { stats, loading, error, refresh: fetchAll };
};

export default useGetSalesRepStats;
