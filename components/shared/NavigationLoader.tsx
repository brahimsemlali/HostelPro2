'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'

export function NavigationLoader() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  // Hide when the new page has rendered
  useEffect(() => {
    setLoading(false)
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
        href.startsWith('http') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.getAttribute('target') === '_blank' ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      ) return
      setLoading(true)
    }

    // 2. router.push() / router.replace() — Next.js calls history.pushState internally
    const originalPush = window.history.pushState.bind(window.history)
    window.history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
      const newPath = url ? new URL(String(url), location.href).pathname : location.pathname
      if (newPath !== location.pathname) setLoading(true)
      return originalPush(state, title, url)
    }

    // 3. Browser back / forward
    const handlePopState = () => setLoading(true)

    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', handlePopState)
    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', handlePopState)
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
