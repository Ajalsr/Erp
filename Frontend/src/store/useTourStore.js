import { create } from 'zustand'

const KEY = 'nexus_tours_done'

const loadDone = () => {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) }
  catch { return new Set() }
}
const saveDone = (s) => localStorage.setItem(KEY, JSON.stringify([...s]))

const useTourStore = create((set, get) => ({
  activeTour:  null,
  currentStep: 0,
  done:        loadDone(),

  start: (id) => set({ activeTour: id, currentStep: 0 }),
  next:  () => set((s) => ({ currentStep: s.currentStep + 1 })),
  prev:  () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),

  finish: () => {
    const { activeTour, done } = get()
    if (!activeTour) return
    const updated = new Set(done).add(activeTour)
    saveDone(updated)
    set({ activeTour: null, currentStep: 0, done: updated })
  },

  skip: () => set({ activeTour: null, currentStep: 0 }),
}))

export default useTourStore
