'use client'

import { useLang } from '@/app/context/LanguageContext'
import { cn } from '@/lib/utils'
import type { Lang } from '@/lib/i18n'

interface Props {
  className?: string
  variant?: 'pill' | 'subtle'
}

export function LanguageSwitcher({ className, variant = 'pill' }: Props) {
  const { lang, setLang } = useLang()

  const options: { value: Lang; label: string }[] = [
    { value: 'fr', label: 'FR' },
    { value: 'en', label: 'EN' },
  ]

  if (variant === 'subtle') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {options.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setLang(value)}
            className={cn(
              'text-[12px] font-medium px-2 py-0.5 rounded-md transition-colors',
              lang === value
                ? 'text-[#0F6E56] bg-[#0F6E56]/10'
                : 'text-[oklch(0.55_0_0)] hover:text-foreground hover:bg-black/[0.04]',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center rounded-lg overflow-hidden border border-[#E8ECF0] bg-white',
        className,
      )}
    >
      {options.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setLang(value)}
          className={cn(
            'px-3 py-1.5 text-[12px] font-semibold transition-colors',
            lang === value
              ? 'bg-[#0F6E56] text-white'
              : 'text-[oklch(0.55_0_0)] hover:bg-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
