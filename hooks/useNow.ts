'use client'

import { useSyncExternalStore } from 'react'

// One shared minute-resolution clock for every subscriber. The snapshot only
// changes when the minute changes, so components re-render at most once a minute.
let current = Math.floor(Date.now() / 60_000) * 60_000
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!timer) {
    timer = setInterval(() => {
      const next = Math.floor(Date.now() / 60_000) * 60_000
      if (next !== current) {
        current = next
        listeners.forEach((l) => l())
      }
    }, 15_000)
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && timer) { clearInterval(timer); timer = null }
  }
}

function getSnapshot() {
  const next = Math.floor(Date.now() / 60_000) * 60_000
  if (next !== current) current = next
  return current
}

/**
 * Current time (ms, rounded down to the minute) — or null during SSR and
 * hydration. Time-dependent UI must render nothing for null, which keeps the
 * server HTML and the first client render identical (no hydration mismatch).
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
