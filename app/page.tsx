'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Public marketing landing page — sweetreservation.com/
// Everything on this page is marketing-only: the 3D riad, the dashboard and
// every product preview are static renderings with demo data
// (components/landing/), never connected to the real app.
// CTA destinations are unchanged: "Essai gratuit" → /register?plan=starter,
// Business → /register?plan=pro, "Se connecter" → /login, demo → WhatsApp.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { Inter, Bricolage_Grotesque, IBM_Plex_Sans_Arabic } from 'next/font/google'
import { LP_COPY, BRAND, type LandingLang } from '@/components/landing/lp-i18n'
import { LPLangContext } from '@/components/landing/lp-shared'
import { LandingNav, Hero } from '@/components/landing/lp-hero'
import { Showcase } from '@/components/landing/lp-story'
import { Features } from '@/components/landing/lp-bento'
import { Complexity, LocalAdvantage, PropertyTypes } from '@/components/landing/lp-clay'
import {
  Customers,
  Pricing,
  FAQ,
  FinalCTA,
  LandingFooter,
} from '@/components/landing/lp-close'
import '@/components/landing/landing.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--sr-font-sans',
})

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz'],
  variable: '--sr-font-display',
})

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--sr-font-ar',
})

const LANG_KEY = 'lm-lang'

// ── Structured data — built from the French (server-rendered default) copy ──
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: LP_COPY.fr.faq.items.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}

const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: BRAND,
  url: 'https://www.sweetreservation.com',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: ['fr', 'en'],
  offers: [
    { '@type': 'Offer', name: 'Starter', price: '35', priceCurrency: 'USD', description: 'Essai gratuit 14 jours' },
    { '@type': 'Offer', name: 'Business', price: '100', priceCurrency: 'USD', description: 'Essai gratuit 14 jours' },
  ],
}

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND,
  url: 'https://www.sweetreservation.com',
  logo: 'https://www.sweetreservation.com/icon-512.png',
  areaServed: 'MA',
}

export default function LandingPage() {
  const [lang, setLangState] = useState<LandingLang>('fr')

  // Restore the visitor's landing-language choice (after hydration on purpose:
  // the server-rendered, indexable content is always the French default).
  useEffect(() => {
    const saved = window.localStorage.getItem(LANG_KEY)
    // Must run post-hydration: the server always renders the French default,
    // so initialising state from localStorage would mismatch the SSR output.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'en' || saved === 'ar') setLangState(saved)
  }, [])

  const setLang = (l: LandingLang) => {
    setLangState(l)
    try {
      window.localStorage.setItem(LANG_KEY, l)
    } catch {
      // storage unavailable (private mode) — language still switches for the session
    }
  }

  const copy = LP_COPY[lang]

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LPLangContext.Provider value={{ lang, setLang, copy }}>
      <MotionConfig reducedMotion="user">
        <div
          dir={copy.dir}
          lang={lang}
          className={`sr-root ${inter.variable} ${bricolage.variable} ${plexArabic.variable}`}
        >
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
          <a href="#sr-main" className="sr-skip">{copy.skipToContent}</a>
          <LandingNav />
          <main id="sr-main">
            <Hero />
            <Complexity />
            <Features />
            <Showcase />
            <LocalAdvantage />
            <PropertyTypes />
            <Customers />
            <Pricing />
            <FAQ />
            <FinalCTA />
          </main>
          <LandingFooter />
        </div>
      </MotionConfig>
    </LPLangContext.Provider>
  )
}
