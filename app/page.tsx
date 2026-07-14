'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Public marketing landing page — sweetreservation.com/
// Everything on this page is marketing-only: the dashboard shown in the hero
// and the product-tour visuals are hard-coded mockups (components/landing/),
// never connected to the real app. CTA destinations are unchanged:
// "Essai gratuit" → /register?plan=starter · "Se connecter" → /login.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { IBM_Plex_Sans_Arabic } from 'next/font/google'
import { LP_COPY, BRAND, type LandingLang } from '@/components/landing/lp-i18n'
import { LPLangContext, T } from '@/components/landing/lp-shared'
import {
  AnnouncementBar,
  LandingNav,
  Hero,
  TrustStrip,
  Outcomes,
  ProductTour,
  Workflow,
} from '@/components/landing/lp-sections'
import {
  LocalAdvantage,
  PropertyTypes,
  Customers,
  Ecosystem,
  Migration,
  Pricing,
  FAQ,
  FinalCTA,
  LandingFooter,
} from '@/components/landing/lp-sections2'

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
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
  const isAr = lang === 'ar'

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LPLangContext.Provider value={{ lang, setLang, copy }}>
      <div
        dir={copy.dir}
        lang={lang}
        className={`lm-root${isAr ? ` ${plexArabic.className}` : ''}`}
        style={{
          background: '#fff',
          color: T.ink,
          overflowX: 'clip',
          // Apple-style system stack for FR/EN; Arabic gets IBM Plex Sans Arabic
          // via the next/font class (inline style must be absent for it to win).
          fontFamily: isAr
            ? undefined
            : "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, system-ui, sans-serif",
        }}
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <a href="#lm-main" className="lm-skip">{copy.skipToContent}</a>
        <AnnouncementBar />
        <LandingNav />
        <main id="lm-main">
          <Hero />
          <TrustStrip />
          <Outcomes />
          <ProductTour />
          <Workflow />
          <LocalAdvantage />
          <PropertyTypes />
          <Customers />
          <Ecosystem />
          <Migration />
          <Pricing />
          <FAQ />
          <FinalCTA />
        </main>
        <LandingFooter />
      </div>
    </LPLangContext.Provider>
  )
}
