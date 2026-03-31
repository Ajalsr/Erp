import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * useAuthStore - Global auth state using Zustand
 * 
 * persist middleware saves to sessionStorage so the user stays
 * logged in on refresh but is cleared when the browser tab closes.
 * Change to localStorage if you want to stay logged in across sessions.
 *
 * Usage anywhere in the app:
 *   const { token, user, isAuthenticated } = useAuthStore()
 *   const { setAuth, clearAuth } = useAuthStore()
 */
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
      setAuth: (token, user) => set({
        token,
        user,
        isAuthenticated: true,
      }),

      clearAuth: () => set({
        token: null,
        user: null,
        isAuthenticated: false,
        activeOrg: null,
        organizations: [],
        notifications: [],
        unreadCount: 0,
      }),

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
      name: 'auth-storage',       // key name in sessionStorage
      storage: {
        // Use sessionStorage instead of localStorage:
        // - Cleared when tab/browser closes
        // - Not accessible from other tabs (more secure)
        getItem: (name) => {
          const value = sessionStorage.getItem(name)
          return value ? JSON.parse(value) : null
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name)
        },
      },
    }
  )
)

export default useAuthStore