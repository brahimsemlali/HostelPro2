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

  // Show on internal link clicks
  useEffect(() => {
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

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
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
