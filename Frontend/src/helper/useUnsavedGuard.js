import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useUnsavedStore from '../store/useUnsavedStore'

/**
 * useUnsavedGuard — call inside a create/edit form.
 *
 *   const guard = useUnsavedGuard({ saveDraft, hasDraft: true })
 *   <div onInput={guard.markDirty} onChange={guard.markDirty}> …form… </div>
 *   // on successful save: guard.reset()
 *   // Back/Cancel buttons: guard.leave(() => navigate('/...'))
 *
 * - markDirty: flips the global dirty flag (cheap; attach to the form root).
 * - reset: clears dirty after a successful save.
 * - leave: guarded navigation (opens the modal if dirty).
 * - Warns on tab close/refresh (beforeunload) and best-effort on browser Back.
 */
export function useUnsavedGuard({ saveDraft = null, hasDraft = false } = {}) {
  const navigate = useNavigate()

  // Keep the store's draft handler + capability in sync (does NOT touch `dirty`).
  useEffect(() => {
    useUnsavedStore.getState().arm({ saveDraft, hasDraft })
  }, [saveDraft, hasDraft])

  // Fully disarm (incl. clearing dirty) only when the form unmounts.
  useEffect(() => () => useUnsavedStore.getState().disarm(), [])

  // Reliable dirty detection: while a guarded form is mounted, ANY input/change event
  // in the document marks the form dirty. Capture phase so it fires even if a child
  // stops propagation. Covers native inputs/selects regardless of the form's structure.
  useEffect(() => {
    const mark = () => {
      if (!useUnsavedStore.getState().dirty) useUnsavedStore.getState().setDirty(true)
    }
    document.addEventListener('input', mark, true)
    document.addEventListener('change', mark, true)
    return () => {
      document.removeEventListener('input', mark, true)
      document.removeEventListener('change', mark, true)
    }
  }, [])

  // Native warning on tab close / refresh.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (useUnsavedStore.getState().dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Best-effort guard for the browser Back button. Push a sentinel; if the user
  // pops while dirty, cancel it (re-push) and open the modal. Discard/Save then
  // navigates back for real via the store's pending fn.
  useEffect(() => {
    window.history.pushState({ _guard: true }, '', window.location.href)
    const onPop = () => {
      if (!useUnsavedStore.getState().dirty) return
      window.history.pushState({ _guard: true }, '', window.location.href) // undo the pop
      useUnsavedStore.getState().attempt(() => navigate(-1))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [navigate])

  const markDirty = useCallback(() => {
    if (!useUnsavedStore.getState().dirty) useUnsavedStore.getState().setDirty(true)
  }, [])
  const reset = useCallback(() => useUnsavedStore.getState().setDirty(false), [])
  const leave = useCallback((navFn) => useUnsavedStore.getState().attempt(navFn), [])

  return { markDirty, reset, leave }
}

// guardedNavigate — for shared nav (sidebar, navbar). Routes navigation through
// the guard so a dirty form prompts before the route changes.
export function guardNav(navFn) {
  useUnsavedStore.getState().attempt(navFn)
}
