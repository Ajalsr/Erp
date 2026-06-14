import useUnsavedStore from '../../store/useUnsavedStore'
import useThemeStore, { getTheme } from '../../store/useThemeStore'

/**
 * UnsavedModal — global "you have unsaved changes" dialog. Mounted once in Layout.
 * Driven entirely by useUnsavedStore; appears whenever a guarded navigation is
 * attempted while a form is dirty.
 */
export default function UnsavedModal() {
  const isDark = useThemeStore((s) => s.isDark)
  const T = getTheme(isDark)
  const { modalOpen, hasDraft, busy, keepEditing, discard, saveAsDraft } = useUnsavedStore()

  if (!modalOpen) return null

  return (
    <div onClick={() => !busy && keepEditing()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: 20, fontFamily: "'DM Sans', sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, background: isDark ? T.surface : '#fff', border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 8 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚠️</span>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.textPri, fontFamily: 'Sora, sans-serif' }}>Unsaved changes</h3>
        </div>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: T.textSec, lineHeight: 1.55 }}>
          You have unsaved changes. Leaving now will discard them.
          {hasDraft ? ' Save as a draft to keep your work, or discard and leave.' : ' Discard and leave, or keep editing.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={keepEditing} disabled={busy}
            style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'transparent', color: T.textSec, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Keep editing
          </button>
          <button onClick={discard} disabled={busy}
            style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(239,68,68,.4)', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Discard changes
          </button>
          {hasDraft && (
            <button onClick={saveAsDraft} disabled={busy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Saving…' : 'Save as draft'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
