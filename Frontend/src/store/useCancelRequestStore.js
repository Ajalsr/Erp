import { create } from 'zustand'

/**
 * Bridges the notification panel (Navbar) and the Outbound page.
 * When an admin approves or rejects a cancellation request from the
 * notification bell, Outbound reactively removes / restores the item.
 */
const useCancelRequestStore = create((set) => ({
  // Set of outbound item IDs approved for cancellation by admin
  approvedIds: new Set(),
  // Set of outbound item IDs whose cancellation was rejected by admin
  rejectedIds: new Set(),

  approve: (itemId) =>
    set((s) => ({
      approvedIds: new Set([...s.approvedIds, itemId]),
      rejectedIds: new Set([...s.rejectedIds].filter((id) => id !== itemId)),
    })),

  reject: (itemId) =>
    set((s) => ({
      rejectedIds: new Set([...s.rejectedIds, itemId]),
      approvedIds: new Set([...s.approvedIds].filter((id) => id !== itemId)),
    })),

  clearApproved: (itemId) =>
    set((s) => ({
      approvedIds: new Set([...s.approvedIds].filter((id) => id !== itemId)),
    })),

  clearRejected: (itemId) =>
    set((s) => ({
      rejectedIds: new Set([...s.rejectedIds].filter((id) => id !== itemId)),
    })),
}))

export default useCancelRequestStore
