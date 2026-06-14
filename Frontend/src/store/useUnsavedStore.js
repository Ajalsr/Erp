import { create } from 'zustand'

/**
 * useUnsavedStore — global "unsaved changes" guard.
 *
 * A form arms the guard (registers an optional saveDraft fn) and flips `dirty`
 * when the user edits. Any navigation that should be guarded calls `attempt(navFn)`:
 * if dirty, a modal opens and `navFn` is held until the user picks Discard or Save
 * Draft; otherwise `navFn` runs immediately.
 */
const useUnsavedStore = create((set, get) => ({
  dirty: false,
  hasDraft: false,
  saveDraft: null, // async () => void  (saves the in-progress form as a draft)
  modalOpen: false,
  busy: false,
  pending: null, // () => void  — navigation to run once it's safe to leave

  arm: ({ saveDraft = null, hasDraft = false } = {}) =>
    set({ saveDraft, hasDraft: !!hasDraft }),
  setDirty: (v) => set({ dirty: !!v }),
  disarm: () => set({ dirty: false, hasDraft: false, saveDraft: null, modalOpen: false, pending: null, busy: false }),

  // Guarded navigation entry point.
  attempt: (navFn) => {
    if (get().dirty) set({ modalOpen: true, pending: navFn || null });
    else if (navFn) navFn();
  },
  keepEditing: () => set({ modalOpen: false, pending: null }),
  discard: () => {
    const p = get().pending;
    set({ dirty: false, modalOpen: false, pending: null });
    if (p) p();
  },
  saveAsDraft: async () => {
    const { saveDraft, pending } = get();
    set({ busy: true });
    try {
      if (saveDraft) await saveDraft();
      set({ dirty: false, modalOpen: false, pending: null, busy: false });
      if (pending) pending();
    } catch {
      set({ busy: false }); // keep modal open on failure
    }
  },
}))

export default useUnsavedStore
