import { create } from 'zustand'
import type { Property } from '@/types'

interface AppState {
  property: Property | null
  setProperty: (property: Property | null) => void
  /** null = no active subscription (initialising or page without realtime); true = live; false = reconnecting */
  realtimeConnected: boolean | null
  setRealtimeConnected: (connected: boolean | null) => void
  /** Count of beds currently needing cleaning (status = 'dirty').
   *  Set by DashboardClient and HousekeepingClient on every beds refresh.
   *  MobileNav reads this to promote the housekeeping shortcut. */
  dirtyBedsCount: number
  setDirtyBedsCount: (count: number) => void
  /** Global ⌘K command palette visibility. Toggled by TopBar and the
   *  keyboard shortcut listener in CommandPalette. */
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  property: null,
  setProperty: (property) => set({ property }),
  realtimeConnected: null,
  setRealtimeConnected: (realtimeConnected) => set({ realtimeConnected }),
  dirtyBedsCount: 0,
  setDirtyBedsCount: (dirtyBedsCount) => set({ dirtyBedsCount }),
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}))
