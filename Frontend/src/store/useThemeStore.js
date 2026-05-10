import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * useThemeStore — Global light/dark theme state
 *
 * Persisted to localStorage so preference survives refreshes.
 *
 * Usage anywhere in the app:
 *   const { isDark, toggleTheme } = useThemeStore()
 *
 * Design tokens are exported as THEME so any component can
 * consume them without prop-drilling:
 *   import useThemeStore, { getTheme } from '../../store/useThemeStore'
 *   const { isDark } = useThemeStore()
 *   const T = getTheme(isDark)
 */
const useThemeStore = create(
  persist(
    (set) => ({
      isDark: true,
      toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
      setDark:  () => set({ isDark: true }),
      setLight: () => set({ isDark: false }),
    }),
    {
      name: 'nexus-theme',
    }
  )
)

// ─── Shared design tokens consumed by all pages ───────────────────
export const getTheme = (isDark) =>
  isDark
    ? {
        // ── Dark ──────────────────────────────────────────────────
        bg:        '#0f1623',
        surface:   '#1a2236',
        surface2:  '#1f2a40',
        navBg:     '#151e30',
        sidebarBg: '#0f1623',
        border:    'rgba(255,255,255,0.10)',
        border2:   'rgba(255,255,255,0.06)',
        borderFoc: 'rgba(59,130,246,0.5)',
        textPri:   '#e8edf5',
        textSec:   '#7a8ba8',
        textMuted: '#4a5568',
        blue:      '#3b82f6',
        blueLight: '#60a5fa',
        blueDim:   'rgba(59,130,246,0.15)',
        green:     '#10b981',
        greenDim:  'rgba(16,185,129,0.12)',
        amber:     '#f59e0b',
        amberDim:  'rgba(245,158,11,0.12)',
        red:       '#ef4444',
        redDim:    'rgba(239,68,68,0.12)',
        purple:    '#8b5cf6',
        purpleDim: 'rgba(139,92,246,0.12)',
        cyan:      '#06b6d4',
        cyanDim:   'rgba(6,182,212,0.12)',
        inputBg:   '#1f2a40',
        scrollbar: '#2a3a55',
      }
    : {
        // ── Light ─────────────────────────────────────────────────
        bg:        '#f1f5f9',
        surface:   '#ffffff',
        surface2:  '#f8fafc',
        navBg:     '#ffffff',
        sidebarBg: '#ffffff',
        border:    '#e2e8f0',
        border2:   '#f1f5f9',
        borderFoc: 'rgba(37,99,235,0.4)',
        textPri:   '#0f172a',
        textSec:   '#64748b',
        textMuted: '#94a3b8',
        blue:      '#2563eb',
        blueLight: '#1d4ed8',
        blueDim:   '#eff6ff',
        green:     '#16a34a',
        greenDim:  '#dcfce7',
        amber:     '#d97706',
        amberDim:  '#fef3c7',
        red:       '#dc2626',
        redDim:    '#fef2f2',
        purple:    '#7c3aed',
        purpleDim: '#ede9fe',
        cyan:      '#0891b2',
        cyanDim:   '#ecfeff',
        inputBg:   '#f8fafc',
        scrollbar: '#e2e8f0',
      }

export default useThemeStore