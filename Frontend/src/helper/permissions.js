import { useEffect, useState } from 'react';
import axiosInstance from './axiosInstance';
import useAuthStore from '../store/useAuthStore';

// Modules shown in the permission matrix. keys MUST match backend RequireModule
// keys (api.go) and the recordScope() module args in the controllers.
// group is purely for UI grouping of the matrix.
export const PERM_MODULES = [
  // Items & Inventory
  { key: 'items',            label: 'Items',            group: 'Items & Inventory' },
  { key: 'item_groups',      label: 'Item Groups',      group: 'Items & Inventory' },
  { key: 'price_lists',      label: 'Price Lists',      group: 'Items & Inventory' },
  { key: 'warehouses',       label: 'Warehouses',       group: 'Items & Inventory' },
  { key: 'adjustments',      label: 'Stock Adjustments',group: 'Items & Inventory' },
  { key: 'grns',             label: 'GRNs',             group: 'Items & Inventory' },
  // Sales
  { key: 'customers',        label: 'Customers',        group: 'Sales' },
  { key: 'enquiries',        label: 'Enquiries',        group: 'Sales' },
  { key: 'quotes',           label: 'Quotes',           group: 'Sales' },
  { key: 'sales_orders',     label: 'Sales Orders',     group: 'Sales' },
  { key: 'delivery_notes',   label: 'Delivery Notes',   group: 'Sales' },
  { key: 'invoices',         label: 'Invoices',         group: 'Sales' },
  { key: 'credit_notes',     label: 'Credit Notes',     group: 'Sales' },
  // Purchases
  { key: 'vendors',          label: 'Vendors',          group: 'Purchases' },
  { key: 'purchase_orders',  label: 'Purchase Orders',  group: 'Purchases' },
  { key: 'bills',            label: 'Bills',            group: 'Purchases' },
  { key: 'debit_notes',      label: 'Debit Notes',      group: 'Purchases' },
  { key: 'vendor_credits',   label: 'Vendor Credits',   group: 'Purchases' },
  // Finance
  { key: 'accounts',         label: 'Accounts',         group: 'Finance' },
  { key: 'journal_entries',  label: 'Journal Entries',  group: 'Finance' },
  { key: 'payments',         label: 'Payments Received', group: 'Finance' },
  { key: 'vendor_payments',  label: 'Payments Made',    group: 'Finance' },
  { key: 'advance_payments', label: 'Advance Payments', group: 'Finance' },
  // Reports
  { key: 'reports',          label: 'Reports',          group: 'Reports' },
  { key: 'dashboard',        label: 'Dashboard',        group: 'Reports' },
];

// Module keys grouped by category — used by the sidebar to show a section when the
// role can access any module inside it.
export const MODULE_GROUPS = PERM_MODULES.reduce((acc, m) => {
  (acc[m.group] = acc[m.group] || []).push(m.key);
  return acc;
}, {});

// Approval rights.
export const PERM_APPROVALS = [
  { key: 'po',      label: 'Approve Purchase Orders' },
  { key: 'grn',     label: 'Confirm / Approve GRNs' },
  { key: 'bill',    label: 'Approve Bills' },
  { key: 'invoice', label: 'Approve Invoices' },
  { key: 'payment', label: 'Approve Payments' },
];

export const PERM_LEVELS = ['none', 'view', 'edit'];

// Module capabilities (independent: a role can have any combination).
// delete/export are privileged — not granted by default, must be set explicitly.
export const PERM_CAPS = ['view', 'add', 'edit', 'delete', 'export'];

// Fallback capabilities when nothing configured for a role. Must mirror backend
// middlewares.defaultModuleCaps. Read-only default: mutations need explicit grant.
const defaultCaps = (role) =>
  (role === 'owner' || role === 'admin') ? ['view', 'add', 'edit', 'delete', 'export']
  : (role === 'member' || role === 'viewer') ? ['view'] : [];

const orgId = () => {
  const s = useAuthStore.getState();
  return s.activeOrg?._id || s.user?.orgId || '';
};
const authUserId = () => useAuthStore.getState().user?.userId || '';

const EMPTY = { orgId: '', role: '', perms: {}, roles: ['member', 'viewer'] };
const LS_KEY = 'nexus-perms';
const loadStore = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} } };
const saveStore = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(_store)) } catch { /* ignore */ } };
// Per-org cache, hydrated from localStorage so role is known synchronously on first
// paint (prevents owner-only sidebar items flickering while the fetch resolves).
// Each entry is tagged with userId so a different account on the same browser never
// reads the previous user's cached access.
let _store = loadStore();   // { [orgId]: { userId, role, perms, roles } }
let _inflight = null;
let _inflightOrg = null;

// Subscribers re-render when perms change (after a grant or logout) without needing a
// full reload — mounted hooks (e.g. the sidebar) react live.
const _listeners = new Set();
function _notify() { _listeners.forEach(fn => { try { fn() } catch { /* ignore */ } }); }
export function subscribePermissions(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }

// Synchronous cached snapshot for an org, or null if not known / belongs to another user.
export function cachedPermissions(id) {
  const c = id && _store[id];
  if (!c || (c.userId && c.userId !== authUserId())) return null;
  return { orgId: id, ...c };
}

export async function fetchPermissions(force = false) {
  const id = orgId();
  if (!id) return EMPTY;
  const uid = authUserId();
  // Cache is keyed by org + user — switching org or account must refetch, never reuse
  // another org's/user's role.
  const cached = _store[id];
  if (!force && cached && cached.userId === uid) return { orgId: id, ...cached };
  if (_inflight && _inflightOrg === id) return _inflight;
  _inflightOrg = id;
  _inflight = axiosInstance.get(`/api/organizations/${id}`)
    .then(r => {
      _store[id] = {
        userId: uid,
        role:  r.data?.data?.role || '',
        perms: r.data?.data?.rolePermissions || {},
        roles: r.data?.data?.customRoles || ['member', 'viewer'],
      };
      saveStore();
      _notify();
      return { orgId: id, ..._store[id] };
    })
    .catch(() => ({ ...EMPTY, orgId: id }))
    .finally(() => { _inflight = null; _inflightOrg = null; });
  return _inflight;
}

// Refetch the active org's perms in the background (after a role/permission change)
// without blanking the cache, so open screens never flash to "no access".
export function invalidatePermissions() { fetchPermissions(true); }

// Seed the perms cache straight from the signin payload (orgs carry role +
// rolePermissions + customRoles), so the sidebar knows the user's access on first
// paint — no GET /api/organizations/:id round-trip before the menu fills.
export function seedPermissions(organizations, userId) {
  if (!Array.isArray(organizations) || !userId) return;
  let changed = false;
  for (const org of organizations) {
    const id = org?._id;
    if (!id || !org.role) continue;
    _store[id] = {
      userId,
      role:  org.role,
      perms: org.rolePermissions || {},
      roles: org.customRoles || ['member', 'viewer'],
    };
    changed = true;
  }
  if (changed) { saveStore(); _notify(); }
}

// Wipe the perms cache (call on logout) so the next account never sees stale access.
export function clearPermissions() {
  _store = {};
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  _notify();
}

// Effective capability list for a role on a module.
function moduleCaps(state, module) {
  const { role, perms } = state;
  if (role === 'owner' || role === 'admin') return ['view', 'add', 'edit', 'delete', 'export'];
  const stored = perms?.[role]?.modules?.[module];
  return Array.isArray(stored) ? stored : defaultCaps(role);
}

// can(module, action) — action defaults to 'view'.
function evalCan(state, module, action = 'view') {
  return moduleCaps(state, module).includes(action);
}

// canAny(module) — has any access at all (for showing the module).
function evalCanAny(state, module) {
  return moduleCaps(state, module).length > 0;
}

function evalApprove(state, key) {
  const { role, perms } = state;
  if (role === 'owner' || role === 'admin') return true;
  return !!perms?.[role]?.approvals?.[key];
}

// Record scope for a module: 'all' or 'own'. owner/admin always 'all'.
function evalScope(state, module) {
  const { role, perms } = state;
  if (role === 'owner' || role === 'admin') return 'all';
  return perms?.[role]?.scope?.[module] === 'own' ? 'own' : 'all';
}

// canEditRecord — caller may edit/delete a record created by createdBy.
// owner/admin always. Otherwise needs the edit cap; and when scope is "own", must
// also be the creator. Scope "all" lets any edit-capable user edit.
function evalCanEditRecord(state, module, createdBy) {
  const { role } = state;
  if (role === 'owner' || role === 'admin') return true;
  if (!evalCan(state, module, 'edit')) return false;
  if (evalScope(state, module) !== 'own') return true;
  const uid = useAuthStore.getState().user?.userId;
  return !!createdBy && createdBy === uid;
}

// canViewRecord — caller may open a record's details. owner/admin always; scope
// "all" lets anyone with view; scope "own" only the creator.
function evalCanViewRecord(state, module, createdBy) {
  const { role } = state;
  if (role === 'owner' || role === 'admin') return true;
  if (evalScope(state, module) !== 'own') return true;
  const uid = useAuthStore.getState().user?.userId;
  return !!createdBy && createdBy === uid;
}

// Settings access: owner + admin always; other roles only if granted the flag.
function evalSettings(state) {
  const { role, perms } = state;
  if (role === 'owner' || role === 'admin') return true;
  return !!perms?.[role]?.settings;
}

// Hook: returns { can, canApprove, role, ready }.
export function usePermissions() {
  const activeOrgId = useAuthStore((s) => s.activeOrg?._id || s.user?.orgId || '');
  const [state, setState] = useState(() => cachedPermissions(activeOrgId) || EMPTY);
  const [ready, setReady] = useState(() => !!cachedPermissions(activeOrgId));
  useEffect(() => {
    let live = true;
    const apply = () => { const c = cachedPermissions(activeOrgId); if (c && live) { setState(c); setReady(true); } };
    apply();                                              // instant, no flicker
    // Honor the cache: only hit the network when perms for this org aren't cached
    // yet (first login / org switch). Avoids a redundant GET /api/organizations/:id
    // on every mount. After a grant/role change, invalidatePermissions() forces a
    // background refresh explicitly.
    fetchPermissions(false).then(s => { if (live) { setState(s); setReady(true); } })
    const unsub = subscribePermissions(apply);            // live update after grant/clear
    return () => { live = false; unsub(); };
  }, [activeOrgId]);
  return {
    role: state.role,
    roles: state.roles || ['member', 'viewer'],
    ready,
    can: (module, action) => evalCan(state, module, action),
    canAny: (module) => evalCanAny(state, module),
    canAnyOf: (modules) => (modules || []).some(m => evalCanAny(state, m)),
    canApprove: (key) => evalApprove(state, key),
    canSettings: () => evalSettings(state),
    scope: (module) => evalScope(state, module),
    canEditRecord: (module, createdBy) => evalCanEditRecord(state, module, createdBy),
    canViewRecord: (module, createdBy) => evalCanViewRecord(state, module, createdBy),
  };
}
