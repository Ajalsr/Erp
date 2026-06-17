// Shared item matcher for line-item search boxes (quotes, sales orders, enquiries).
// Matches against item name, SKU and item code. Supports `*` wildcards:
//   "AC*"  → starts with "AC"
//   "*123" → ends with "123"
//   "AC*34"→ starts "AC", ends "34"
// Without a `*`, falls back to a case-insensitive substring match (friendlier).
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function matchItem(item, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const fields = [item?.name, item?.sku, item?.item_code, item?.itemName, item?.code]
    .filter(Boolean)
    .map((f) => String(f).toLowerCase());
  if (q.includes('*')) {
    const re = new RegExp('^' + q.split('*').map(escapeRegex).join('.*') + '$');
    return fields.some((f) => re.test(f));
  }
  return fields.some((f) => f.includes(q));
}

export default matchItem;
