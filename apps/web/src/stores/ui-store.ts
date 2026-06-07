'use client'

import { create } from 'zustand'

export interface PosCustomerPreset {
  id: string
  name: string
  phone?: string
  totalDue?: number
}

interface UIStore {
  posOpen: boolean
  pendingCustomer: PosCustomerPreset | null
  openPos: (customer?: PosCustomerPreset) => void
  closePos: () => void
  clearPendingCustomer: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  posOpen: false,
  pendingCustomer: null,
  openPos: (customer) => set({ posOpen: true, pendingCustomer: customer ?? null }),
  closePos: () => set({ posOpen: false, pendingCustomer: null }),
  clearPendingCustomer: () => set({ pendingCustomer: null }),
}))
