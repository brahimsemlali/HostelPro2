'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Building2 } from 'lucide-react'
import { useSession } from '@/app/context/SessionContext'
import { cn } from '@/lib/utils'

export function PropertySwitcher() {
  const session = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  // Only show for owners with 2+ properties
  if (!session?.isOwner || session.allProperties.length < 2) return null

  const current = session.allProperties.find(p => p.id === session.propertyId)
    ?? session.allProperties[0]

  async function switchTo(propertyId: string) {
    if (propertyId === session?.propertyId) { setOpen(false); return }
    setSwitching(true)
    try {
      await fetch('/api/switch-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      setOpen(false)
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={switching}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors select-none',
          'border border-black/[0.08] bg-white/80 text-[#0A1F1C]',
          'hover:bg-white hover:border-black/[0.12]',
          'active:scale-[0.97]',
          switching && 'opacity-60 pointer-events-none'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Building2 className="w-3 h-3 text-[#0F6E56] flex-shrink-0" />
        <span className="max-w-[120px] truncate">{current.name}</span>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />

          {/* Dropdown */}
          <div
            className="absolute left-0 top-full mt-1.5 z-40 min-w-[200px] rounded-xl bg-white border border-black/[0.08] shadow-lg overflow-hidden"
            role="listbox"
          >
            <div className="px-3 py-2 border-b border-black/[0.06]">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Propriétés</p>
            </div>
            {session.allProperties.map((p) => (
              <button
                key={p.id}
                role="option"
                aria-selected={p.id === session.propertyId}
                onClick={() => switchTo(p.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors',
                  'hover:bg-[#0F6E56]/[0.06]',
                  p.id === session.propertyId && 'bg-[#0F6E56]/[0.04]'
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white',
                  p.id === session.propertyId
                    ? 'bg-gradient-to-br from-[#0F6E56] to-[#16a37d]'
                    : 'bg-gradient-to-br from-gray-300 to-gray-400'
                )}>
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.city}</p>
                </div>
                {p.id === session.propertyId && (
                  <Check className="w-3.5 h-3.5 text-[#0F6E56] flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
