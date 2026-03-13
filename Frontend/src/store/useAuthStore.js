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
      user: null,        // { userId, companyName, orgId }
      isAuthenticated: false,

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
      }),

      // Update user fields selectively (e.g. after profile edit)
      updateUser: (updates) => set((state) => ({
        user: { ...state.user, ...updates }
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