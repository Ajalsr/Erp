import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import useUnsavedStore from '../../store/useUnsavedStore'
import useThemeStore, { getTheme } from '../../store/useThemeStore'

/**
 * Global keyboard shortcuts. Mounted once (in Layout) so it is only active
 * when the user is logged in and inside the app shell.
 *
 * Combo form: Alt + <key>. Alt is used so shortcuts never clash with the
 * browser (Ctrl+*) or with normal typing in inputs.
 *
 * Alt+/  toggles a help overlay listing every shortcut.
 *
 * To add a shortcut: add one line to SHORTCUTS below.
 *   key   -> the letter/number pressed together with Alt (lowercase)
 *   path  -> the route to navigate to
 *   label -> human-readable name for the destination
 */
const SHORTCUTS = [
  { key: 's', path: '/Sales/Salesorders/Newsalesorders',          label: 'New Sales Order' },
  { key: 'p', path: '/Purchase/Purchaseorders/Newpurchaseorders', label: 'New Purchase Order' },
  { key: 'i', path: '/Items/Items/New',                           label: 'New Item' },
  { key: 'c', path: '/Sales/Customers/Newcustomers',              label: 'New Customer' },
  { key: 'v', path: '/Purchase/Vendors/NewVendor',                label: 'New Vendor' },
  { key: 'n', path: '/Sales/Createinvoices',                      label: 'New Invoice' },
  { key: 'h', path: '/Home',                                      label: 'Home' },
]

export default function KeyboardShortcuts() {
  const navigate = useNavigate()
  const isDark = useThemeStore((s) => s.isDark)
  const T = getTheme(isDark)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const onKeyDown = (e) => {
      // Only react to Alt combos (no Ctrl/Meta) to avoid browser conflicts.
      if (!e.altKey || e.ctrlKey || e.metaKey) return

      const key = e.key.toLowerCase()

      // Alt+/  -> toggle the shortcuts help overlay.
      if (key === '/') {
        e.preventDefault()
        setShowHelp((v) => !v)
        return
      }

      const match = SHORTCUTS.find((s) => s.key === key)
      if (!match) return

      e.preventDefault()
      setShowHelp(false)
      // Route through the unsaved guard: if a create/edit form is dirty, this
      // opens the "unsaved changes will be lost" modal instead of navigating.
      // If nothing is dirty, it navigates immediately.
      useUnsavedStore.getState().attempt(() => navigate(match.path))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  // Close on Escape while the overlay is open.
  useEffect(() => {
    if (!showHelp) return
    const onEsc = (e) => { if (e.key === 'Escape') setShowHelp(false) }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [showHelp])

  if (!showHelp) return null

  return createPortal(
    <div
      onClick={() => setShowHelp(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380, maxWidth: '90vw',
          background: T.surface, color: T.textPri,
          border: `1px solid ${T.border}`, borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,.35)', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Keyboard shortcuts</span>
          <span
            onClick={() => setShowHelp(false)}
            style={{ cursor: 'pointer', color: T.textSec, fontSize: 18, lineHeight: 1 }}
          >×</span>
        </div>
        <div style={{ padding: '8px 12px' }}>
          {SHORTCUTS.map((s) => (
            <div key={s.key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 8px', fontSize: 13,
            }}>
              <span style={{ color: T.textPri }}>{s.label}</span>
              <kbd style={{
                fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                background: T.surface2, color: T.textSec,
                border: `1px solid ${T.border}`, borderRadius: 6,
                padding: '2px 8px',
              }}>Alt + {s.key.toUpperCase()}</kbd>
            </div>
          ))}
        </div>
        <div style={{
          padding: '10px 20px', borderTop: `1px solid ${T.border}`,
          fontSize: 11, color: T.textSec,
        }}>
          Press <b>Alt + /</b> to toggle · <b>Esc</b> to close
        </div>
      </div>
    </div>,
    document.body,
  )
}
