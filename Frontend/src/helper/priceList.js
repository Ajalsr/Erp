import axiosInstance from './axiosInstance';

// resolveItemPrice — the missing half of Price Lists: given a stock item and the
// customer's assigned price list (or null/undefined if they have none), returns the
// price that should actually be charged.
//
// Resolution order:
//   1. Price list inactive, expired, or not yet valid → fall back to item's own price
//      (no fxRate applied — that's the item's own price, already in the document's
//      currency as far as this app has ever tracked it).
//   2. An explicit per-item override in the price list → use it, converted by fxRate.
//   3. A blanket adjustment (percentage or fixed) on the price list → apply it to the
//      item's base price, converted by fxRate.
//   4. No price list → item's own selling_price/price, unchanged (today's behavior).
//
// `fxRate` converts a price-list-currency amount into the document's currency — pass
// the result of getPriceListFxRate() below (defaults to 1 = no conversion, e.g. when
// the price list's currency already matches the document's).
export function resolveItemPrice(item, priceList, fxRate = 1) {
  const base = parseFloat(item?.selling_price ?? item?.price ?? 0) || 0;
  if (!priceList || priceList.status !== 'active') return base;

  const now = new Date();
  if (priceList.validFrom && now < new Date(priceList.validFrom)) return base;
  if (priceList.validTo && now > new Date(priceList.validTo)) return base;

  const itemId = item?._id || item?.itemId;
  const override = (priceList.items || []).find(i => i.itemId === itemId);
  if (override) return override.price * fxRate;

  if (priceList.adjustmentType === 'percentage') return base * (1 + (priceList.adjustment || 0) / 100) * fxRate;
  if (priceList.adjustmentType === 'fixed') return (base + (priceList.adjustment || 0)) * fxRate;
  return base;
}

// getRateToBase — 1 unit of `fromCcy` in the org's base currency, via the existing
// /api/exchange-rates/latest endpoint (which only ever resolves X→base). Returns 1
// (no-op) if fromCcy is empty, already base, or no rate is on file.
export async function getRateToBase(fromCcy) {
  if (!fromCcy) return 1;
  try {
    const res = await axiosInstance.get('/api/exchange-rates/latest', { params: { from: fromCcy } });
    return res.data?.rate > 0 ? res.data.rate : 1;
  } catch {
    return 1;
  }
}

// getPriceListFxRate — the multiplier to convert an amount in `fromCcy` (a price
// list's currency) into `toCcy` (the document's currency), pivoting through the org
// base currency since that's the only pair the backend actually stores rates for:
//   fromCcy → base (existing rate) → toCcy (existing rate, inverted)
// Same-currency (or missing either side) short-circuits to 1 — the common case,
// costs nothing extra.
export async function getPriceListFxRate(fromCcy, toCcy) {
  if (!fromCcy || !toCcy || fromCcy === toCcy) return 1;
  const [fromRate, toRate] = await Promise.all([getRateToBase(fromCcy), getRateToBase(toCcy)]);
  return toRate > 0 ? fromRate / toRate : 1;
}

export default resolveItemPrice;
