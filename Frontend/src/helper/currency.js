import { useEffect, useState } from 'react'
import api from './axiosInstance'

// Org reporting/base currency, shared across report screens. Fetched once and cached
// process-wide; subscribers (via useBaseCurrency) re-render when it resolves so figures
// stop showing the default and pick up the real code.
let _base = 'AED'
let _fetched = false
const _subs = new Set()

export function primeBaseCurrency() {
  if (_fetched) return
  _fetched = true
  api.get('/api/exchange-rates/')
    .then((r) => {
      const b = r.data?.baseCurrency || 'AED'
      if (b !== _base) { _base = b; _subs.forEach((fn) => fn()) }
    })
    .catch(() => {})
}

// Synchronous accessor — safe to call inside module-level formatters.
export function baseCurrency() { return _base }

// Hook: returns the base currency and re-renders the caller once it loads.
export function useBaseCurrency() {
  const [, tick] = useState(0)
  useEffect(() => {
    primeBaseCurrency()
    const fn = () => tick((t) => t + 1)
    _subs.add(fn)
    return () => _subs.delete(fn)
  }, [])
  return _base
}

// Money formatter in the base currency (or an explicit code).
export const money = (n, ccy = _base) =>
  `${ccy} ${Number(n || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
