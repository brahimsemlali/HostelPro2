'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Closing sections — pilot customers, pricing, FAQ, final CTA, footer.
//
// Pricing mirrors the live billing configuration (lib/constants.ts →
// BILLING_PLANS): Starter 350 MAD/mo (LS variant 1633090), Pro 1 000 MAD/mo
// (LS 1633110). Enterprise is contact-only. LemonSqueezy charges in MAD, so
// MAD is the price shown. No annual variant exists in LemonSqueezy.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, MessageCircle, Plus } from 'lucide-react'
import {
  CTA,
  CONTACT_WA,
  EASE,
  LangSwitcher,
  Logo,
  MaskText,
  PRO_HREF,
  Reveal,
  SectionHead,
  SIGNIN_HREF,
  START_HREF,
  useLP,
  useReducedMotion,
} from './lp-shared'
import { BRAND } from './lp-i18n'
import { Clay, type ClayName } from './lp-clay'

// ── Pilot customers (honest — no testimonials yet) ─────────────────────────
export function Customers() {
  const { copy } = useLP()
  return (
    <section id="customers" aria-labelledby="sr-customers-title" style={{ background: 'var(--sr-bg)', paddingBottom: 'clamp(40px, 6vw, 80px)' }}>
      <div className="sr-container">
        <Reveal>
          <div
            style={{
              borderRadius: 'var(--sr-radius-xl)',
              padding: 'clamp(28px, 5vw, 56px)',
              background: '#fff',
              boxShadow: '0 0 0 1px var(--sr-line-soft)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: 28,
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className="sr-eyebrow">{copy.customers.eyebrow}</span>
              <h2 id="sr-customers-title" className="sr-h3" style={{ fontSize: 'clamp(26px, 2.6vw, 34px)', letterSpacing: '-0.03em' }}>{copy.customers.heading}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'flex-start' }}>
              <p style={{ color: 'var(--sr-body)' }}>{copy.customers.body}</p>
              <CTA href={CONTACT_WA} variant="ghost">
                <MessageCircle size={16} aria-hidden="true" />
                {copy.customers.cta}
              </CTA>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── Pricing ────────────────────────────────────────────────────────────────
const PLAN_DATA: { monthlyMad: number; href: string; featured: boolean; clay: ClayName }[] = [
  { monthlyMad: 350, href: START_HREF, featured: false, clay: 'key' },
  { monthlyMad: 1000, href: PRO_HREF, featured: true, clay: 'bell' },
  { monthlyMad: 9990, href: CONTACT_WA, featured: false, clay: 'hostel' },
]

export function Pricing() {
  const { copy } = useLP()
  return (
    <section id="pricing" className="sr-section" aria-labelledby="sr-pricing-title" style={{ background: 'var(--sr-bg)' }}>
      <div className="sr-container">
        <SectionHead eyebrow={copy.pricing.eyebrow} heading={copy.pricing.heading} sub={copy.pricing.sub} center id="sr-pricing-title" />
        <div className="sr-pricing">
          {copy.pricing.plans.map((plan, i) => {
            const d = PLAN_DATA[i]
            return (
              <Reveal key={plan.name} delay={i * 0.08} style={{ display: 'flex' }}>
                <article className={`sr-plan${d.featured ? ' sr-plan-featured' : ''}`} style={{ width: '100%' }} aria-labelledby={`sr-plan-${i}`}>
                  <Clay name={d.clay} size={96} delay={i * 0.5} className="sr-plan-clay" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <h3 id={`sr-plan-${i}`} style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>{plan.name}</h3>
                    {d.featured && (
                      <span className="sr-chip" style={{ background: 'var(--sr-accent)', color: 'var(--sr-on-accent)' }}>{copy.pricing.popular}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 14.5, color: d.featured ? 'var(--sr-on-dark)' : 'var(--sr-muted)', marginTop: -12 }}>{plan.tagline}</p>
                  <div>
                    <div className="sr-plan-price">
                      <b>{d.monthlyMad.toLocaleString('fr-MA')}</b>
                      <span style={{ fontSize: 14, color: d.featured ? 'var(--sr-on-dark)' : 'var(--sr-muted)' }}>MAD / {copy.pricing.perMonth}</span>
                    </div>
                  </div>
                  <CTA
                    href={d.href}
                    variant={d.featured ? 'primary' : 'ghost'}
                    magnetic={false}
                    style={{ width: '100%' }}
                  >
                    {plan.cta}
                  </CTA>
                  <ul>
                    {plan.features.map((f) => (
                      <li key={f}>
                        <Check size={15} strokeWidth={2.6} className="sr-plan-check" aria-hidden="true" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            )
          })}
        </div>
        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 13.5, color: 'var(--sr-muted)' }}>{copy.pricing.approxNote}</p>
      </div>
    </section>
  )
}

// ── FAQ ────────────────────────────────────────────────────────────────────
export function FAQ() {
  const { copy } = useLP()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="sr-section" aria-labelledby="sr-faq-title" style={{ background: 'var(--sr-bg)', paddingTop: 0 }}>
      <div className="sr-container sr-faq">
        <div>
          <SectionHead eyebrow={copy.faq.eyebrow} heading={copy.faq.heading} id="sr-faq-title" />
        </div>
        <div>
          {copy.faq.items.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q} className="sr-faq-item">
                <h3 style={{ margin: 0 }}>
                  <button
                    type="button"
                    className="sr-faq-btn"
                    aria-expanded={isOpen}
                    aria-controls={`sr-faq-${i}`}
                    id={`sr-faq-btn-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    {item.q}
                    <span className="sr-acc-icon" aria-hidden="true"><Plus size={15} /></span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`sr-faq-${i}`}
                      role="region"
                      aria-labelledby={`sr-faq-btn-${i}`}
                      initial={reduced ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduced ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p style={{ paddingBottom: 26, paddingInlineEnd: 48, color: 'var(--sr-body)', fontSize: 15.5 }}>{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ──────────────────────────────────────────────────────────────
export function FinalCTA() {
  const { copy } = useLP()
  return (
    <section className="sr-final" aria-labelledby="sr-final-title">
      <div className="sr-final-glow" aria-hidden="true" />
      <Clay name="bell" size="clamp(110px, 13vw, 200px)" className="sr-final-clay" style={{ insetInlineStart: '6%', top: '18%' }} />
      <Clay name="key" size="clamp(90px, 10vw, 160px)" delay={0.8} className="sr-final-clay" style={{ insetInlineEnd: '8%', top: '12%' }} />
      <Clay name="tea" size="clamp(70px, 7vw, 120px)" delay={1.4} className="sr-final-clay" style={{ insetInlineStart: '14%', bottom: '10%' }} />
      <Clay name="coins" size="clamp(90px, 9vw, 150px)" delay={0.4} className="sr-final-clay" style={{ insetInlineEnd: '12%', bottom: '12%' }} />
      <div className="sr-container" style={{ position: 'relative', paddingBlock: 'clamp(112px, 14vw, 200px)' }}>
        <div style={{ maxWidth: 820, marginInline: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 26 }}>
          <Reveal y={12}>
            <span className="sr-eyebrow">{copy.finalCta.eyebrow}</span>
          </Reveal>
          <MaskText text={copy.finalCta.heading} className="sr-display" style={{ fontSize: 'clamp(40px, 5.6vw, 84px)' }} id="sr-final-title" />
          <Reveal delay={0.2}>
            <p className="sr-lead" style={{ marginInline: 'auto' }}>{copy.finalCta.sub}</p>
          </Reveal>
          <Reveal delay={0.3}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <CTA href={START_HREF} arrow>{copy.finalCta.ctaPrimary}</CTA>
              <CTA href={CONTACT_WA} variant="ghost-dark">{copy.finalCta.ctaDemo}</CTA>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────
export function LandingFooter() {
  const { copy } = useLP()
  const cols = [
    {
      title: copy.footer.product,
      links: [
        { label: copy.footer.features, href: '#features' },
        { label: copy.footer.tour, href: '#tour' },
        { label: copy.footer.pricing, href: '#pricing' },
        { label: copy.footer.faq, href: '#faq' },
        { label: copy.footer.signin, href: SIGNIN_HREF },
        { label: copy.footer.start, href: START_HREF },
      ],
    },
    {
      title: copy.footer.resources,
      links: [
        { label: copy.footer.blog, href: '/blog' },
        { label: copy.footer.policeGuide, href: '/blog/fiche-de-police-hostel-maroc' },
        { label: 'Booking.com vs Hostelworld', href: '/blog/booking-com-vs-hostelworld-maroc' },
        { label: 'Ouvrir un hostel au Maroc', href: '/blog/ouvrir-hostel-maroc-guide' },
        { label: 'Excel vs logiciel PMS', href: '/blog/excel-vs-logiciel-pms-hostel' },
        { label: copy.footer.contact, href: CONTACT_WA },
      ],
    },
    {
      title: copy.footer.cities,
      links: [
        { label: 'Marrakech', href: '/logiciel-hostel-marrakech' },
        { label: 'Agadir', href: '/logiciel-hostel-agadir' },
        { label: 'Casablanca', href: '/logiciel-hostel-casablanca' },
        { label: 'Fès', href: '/logiciel-hostel-fes' },
        { label: 'Tanger', href: '/logiciel-hostel-tanger' },
        { label: 'Chefchaouen', href: '/logiciel-hostel-chefchaouen' },
      ],
    },
  ]
  return (
    <footer className="sr-footer">
      <div className="sr-container">
        <div className="sr-footer-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'flex-start' }}>
            <Logo dark />
            <p style={{ fontSize: 14, maxWidth: 320 }}>{copy.footer.tagline}</p>
            <LangSwitcher dark />
          </div>
          {cols.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3>{col.title}</h3>
              <ul>
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.href.startsWith('http') ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="sr-link-u">{l.label}</a>
                    ) : l.href.startsWith('#') ? (
                      <a href={l.href} className="sr-link-u">{l.label}</a>
                    ) : (
                      <Link href={l.href} className="sr-link-u">{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div style={{ paddingBlock: 28, fontSize: 13, color: 'var(--sr-on-dark-faint)' }}>
          © {new Date().getFullYear()} {BRAND}. {copy.footer.rights}
        </div>
      </div>
    </footer>
  )
}
