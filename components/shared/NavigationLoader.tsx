'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'

export function NavigationLoader() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startLoading = () => {
    setLoading(true)
    if (safetyTimer.current) clearTimeout(safetyTimer.current)
    safetyTimer.current = setTimeout(() => setLoading(false), 4000)
  }

  const stopLoading = () => {
    if (safetyTimer.current) clearTimeout(safetyTimer.current)
    setLoading(false)
  }

  // Hide when the new page has rendered
  useEffect(() => {
    stopLoading()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    // 1. <a> / <Link> clicks
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (
        !href ||
        href.startsWith('#') ||
        href.includes('/#') ||
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.getAttribute('target') === '_blank' ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      ) return
      startLoading()
    }

    // 2. router.push() / router.replace() — Next.js calls history.pushState internally
    const originalPush = window.history.pushState.bind(window.history)
    window.history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
      const next = url ? new URL(String(url), location.href) : null
      const pathChanged = next ? next.pathname !== location.pathname : false
      if (pathChanged) startLoading()
      return originalPush(state, title, url)
    }

    // 3. Browser back / forward
    const handlePopState = () => startLoading()

    // 4. Hash-only navigation — clear loader immediately (no page change)
    const handleHashChange = () => stopLoading()

    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('hashchange', handleHashChange)
      window.history.pushState = originalPush
    }
  }, [])

  if (!loading) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(244,246,248,0.75)', backdropFilter: 'blur(10px) saturate(160%)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* Outer pulse ring */}
          <span
            className="absolute inset-0 rounded-full bg-[#0F6E56]/10"
            style={{ animation: 'hp-nav-pulse 1.8s ease-out infinite' }}
          />
          {/* Globe icon */}
          <div className="relative w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center">
            <Globe
              className="w-8 h-8 text-[#0F6E56]"
              style={{ animation: 'hp-nav-spin 1.4s linear infinite' }}
            />
          </div>
        </div>
        <p className="text-sm font-medium text-[#0F6E56]/70 tracking-wide">Chargement…</p>
      </div>
    </div>
  )
}
