import { useEffect, useState } from 'react';
import axiosInstance from './axiosInstance';
import useAuthStore from '../store/useAuthStore';

// Modules shown in the permission matrix (keys must match backend RequireModule keys).
export const PERM_MODULES = [
  { key: 'items',     label: 'Items' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'sales',     label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'reports',   label: 'Reports' },
  { key: 'finance',   label: 'Finance' },
];

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
export const PERM_CAPS = ['view', 'add', 'edit'];

// Fallback capabilities when nothing configured for a role.
const defaultCaps = (role) =>
  (role === 'owner' || role === 'admin' || role === 'member') ? ['view', 'add', 'edit']
  : role === 'viewer' ? ['view'] : [];

const orgId = () => {
  const s = useAuthStore.getState();
  return s.activeOrg?._id || s.user?.orgId || '';
};

let _cache = null;   // { role, perms }
let _inflight = null;

export async function fetchPermissions(force = false) {
  if (_cache && !force) return _cache;
  if (_inflight) return _inflight;
  const id = orgId();
  if (!id) return { role: '', perms: {} };
  _inflight = axiosInstance.get(`/api/organizations/${id}`)
    .then(r => {
      _cache = {
        role:  r.data?.data?.role || '',
        perms: r.data?.data?.rolePermissions || {},
        roles: r.data?.data?.customRoles || ['member', 'viewer'],
      };
      return _cache;
    })
    .catch(() => ({ role: '', perms: {}, roles: ['member', 'viewer'] }))
    .finally(() => { _inflight = null; });
  return _inflight;
}

export function invalidatePermissions() { _cache = null; }

// Effective capability list for a role on a module.
function moduleCaps(state, module) {
  const { role, perms } = state;
  if (role === 'owner' || role === 'admin') return ['view', 'add', 'edit'];
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

// Settings access: owner always; others only if granted (admin NOT auto-granted).
function evalSettings(state) {
  const { role, perms } = state;
  if (role === 'owner') return true;
  return !!perms?.[role]?.settings;
}

// Hook: returns { can, canApprove, role, ready }.
export function usePermissions() {
  const [state, setState] = useState(_cache || { role: '', perms: {}, roles: ['member', 'viewer'] });
  const [ready, setReady] = useState(!!_cache);
  useEffect(() => {
    let live = true;
    fetchPermissions().then(s => { if (live) { setState(s); setReady(true); } });
    return () => { live = false; };
  }, []);
  return {
    role: state.role,
    roles: state.roles || ['member', 'viewer'],
    ready,
    can: (module, action) => evalCan(state, module, action),
    canAny: (module) => evalCanAny(state, module),
    canApprove: (key) => evalApprove(state, key),
    canSettings: () => evalSettings(state),
  };
}
