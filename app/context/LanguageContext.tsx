'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { createT } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'fr',
  setLang: () => {},
})

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang: Lang
  children: React.ReactNode
}) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang)
    // Persist in cookie — 1 year, accessible to JS (not httpOnly)
    document.cookie = `hp-lang=${newLang};path=/;max-age=31536000;SameSite=Lax`
  }, [])

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext)
}

/** Returns a translation function bound to the current language. */
export function useT(): (key: string) => string {
  const { lang } = useLang()
  return createT(lang)
}
