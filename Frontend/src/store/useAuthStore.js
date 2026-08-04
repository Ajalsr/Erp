import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * useAuthStore - Global auth state using Zustand
 *
 * persist middleware saves to sessionStorage by default — the user stays
 * logged in on refresh but is cleared when the browser tab/app closes.
 * "Keep me logged in" (Login page checkbox) calls setRememberMe(true) BEFORE
 * signing in, which switches the storage backend to localStorage so the
 * session survives a full app restart too.
 *
 * Usage anywhere in the app:
 *   const { token, user, isAuthenticated } = useAuthStore()
 *   const { setAuth, clearAuth } = useAuthStore()
 */
const REMEMBER_KEY = 'auth-remember-me'

// Call before setAuth() with the Login page's "Keep me logged in" checkbox
// value. Persisted in localStorage itself (not sessionStorage) so the choice
// is still readable on a fresh tab/restart, before any session exists.
export const setRememberMe = (remember) => {
  if (remember) localStorage.setItem(REMEMBER_KEY, '1')
  else localStorage.removeItem(REMEMBER_KEY)
}

const activeBackend = () => (localStorage.getItem(REMEMBER_KEY) === '1' ? localStorage : sessionStorage)
const useAuthStore = create(
  persist(
    (set) => ({
      // State
      token: null,
      user: null,           // { userId, companyName, orgId }
      isAuthenticated: false,
      activeOrg: null,      // { _id, name, description, role }
      organizations: [],    // list of { _id, name, role, ... }
      notifications: [],    // list of Notification objects
      unreadCount: 0,

      // Actions
      // Seed orgs from the signin response (when provided) so the app skips the
      // separate GET /api/organizations fetch on first load — no post-login gate.
      setAuth: (token, user, organizations) => set(() => {
        const orgs = Array.isArray(organizations) ? organizations : []
        return {
          token,
          user,
          isAuthenticated: true,
          organizations: orgs,
          activeOrg: orgs.length > 0 ? orgs[0] : null,
        }
      }),

      clearAuth: () => {
        setRememberMe(false) // don't leave a stale "keep logged in" flag for the next signin
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          activeOrg: null,
          organizations: [],
          notifications: [],
          unreadCount: 0,
        })
      },

      setNotifications: (notifs) => set({
        notifications: notifs,
        unreadCount: notifs.filter((n) => !n.read).length,
      }),

      addNotification: (notif) => set((state) => ({
        notifications: [notif, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      })),

      markAllNotificationsRead: () => set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      })),

      removeNotification: (id) => set((state) => {
        const notif = state.notifications.find((n) => n._id === id)
        return {
          notifications: state.notifications.filter((n) => n._id !== id),
          unreadCount: notif && !notif.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        }
      }),

      // Update user fields selectively (e.g. after profile edit)
      updateUser: (updates) => set((state) => ({
        user: { ...state.user, ...updates }
      })),

      // Set / switch the active organization
      setActiveOrg: (org) => set({ activeOrg: org }),

      // Replace full list of orgs (called after fetching from API)
      setOrganizations: (orgs) => set((state) => ({
        organizations: orgs,
        // If no activeOrg yet, auto-select the first one
        activeOrg: state.activeOrg || (orgs.length > 0 ? orgs[0] : null),
      })),
    }),
    {
      name: 'auth-storage',       // key name in session/localStorage
      storage: {
        // sessionStorage by default (cleared on tab/app close, not shared
        // across tabs — more secure); localStorage instead when the user
        // checked "Keep me logged in" at sign-in (see setRememberMe above).
        getItem: (name) => {
          const value = activeBackend().getItem(name)
          return value ? JSON.parse(value) : null
        },
        setItem: (name, value) => {
          activeBackend().setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          // Clear both — avoids a leftover copy in the OTHER backend if the
          // remember-me flag changes between login and logout.
          localStorage.removeItem(name)
          sessionStorage.removeItem(name)
        },
      },
    }
  )
)

export default useAuthStore