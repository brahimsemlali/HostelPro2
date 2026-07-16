import { useCallback, useEffect, useRef } from 'react'

/**
 * Trailing-edge debounce for Realtime refetch handlers: a burst of events
 * (busy check-in evening, batch import) coalesces into one refetch instead
 * of one full refetch per event. `fn` must be referentially stable
 * (useCallback) or the debounced wrapper loses its pending timer.
 */
export function useDebouncedCallback(fn: () => void, delay = 600): () => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      fn()
    }, delay)
  }, [fn, delay])
}
