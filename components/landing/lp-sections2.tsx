'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Landing sections 2/2 — local advantage, property types, customers,
// feature ecosystem, migration, pricing, FAQ, final CTA, footer.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  FileCheck2, Coins, Languages, MessageCircle, BedDouble, Palmtree, Smartphone,
  ClipboardList, PlugZap, Wallet, TrendingUp, Import, DoorOpen, Link2, GraduationCap,
} from 'lucide-react'
import { T, emeraldGrad, darkGrad, shadowCard, useLP, Reveal, SectionHead, ZelligePattern, ArrowIcon, CheckIcon } from './lp-shared'
import { BRAND } from './lp-i18n'
import { MiniCalendar, MiniCheckinSteps, MiniReconcile, MiniPolice } from './lp-mocks'
import { START_HREF, SIGNIN_HREF, CONTACT_WA, Logo, LangSwitcher } from './lp-sections'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

// ── Local advantage (deep navy) ─────────────────────────────────────────────
export function LocalAdvantage() {
  const { copy } = useLP()
  const icons = [FileCheck2, Coins, Languages, MessageCircle, BedDouble, Palmtree, Smartphone]
  return (
    <section className="lm-section" style={{ background: darkGrad, position: 'relative', overflow: 'hidden' }}>
      <ZelligePattern id="lm-z-local" color="#9FE8D2" opacity={0.07} style={{ inset: 0, maskImage: 'radial-gradient(ellipse 80% 90% at 50% 0%, #000 10%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 90% at 50% 0%, #000 10%, transparent 80%)' }} />
      <div
        aria-hidden="true"
        style={{ position: 'absolute', bottom: -220, insetInlineStart: '30%', width: 640, height: 420, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.10) 0%, transparent 65%)', pointerEvents: 'none' }}
      />
      <div className="lm-container" style={{ position: 'relative' }}>
        <SectionHead dark eyebrow={copy.local.eyebrow} heading={copy.local.heading} sub={copy.local.sub} />
        <div className="lm-local-grid">
          {copy.local.points.map((p, i) => {
            const Icon = icons[i] ?? FileCheck2
            return (
              <Reveal key={p.title} delay={i * 0.06} className="lm-local-card">
                <span
                  aria-hidden="true"
                  style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.18)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={18} color="#9FE8D2" strokeWidth={2} />
                </span>
                <div>
                  <h3 style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', marginBottom: 5 }}>{p.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.68)' }}>{p.desc}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Property-type selector ──────────────────────────────────────────────────
export function PropertyTypes() {
  const { copy } = useLP()
  const [active, setActive] = useState(0)
  const type = copy.properties.types[active]
  const minis = [<MiniCalendar key="h" />, <MiniCheckinSteps key="r" />, <MiniReconcile key="s" />, <MiniPolice key="g" />]

  return (
    <section id="solutions" className="lm-section" style={{ background: '#fff' }}>
      <div className="lm-container">
        <SectionHead eyebrow={copy.properties.eyebrow} heading={copy.properties.heading} sub={copy.properties.sub} />

        <Reveal style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <div role="tablist" aria-label={copy.properties.eyebrow} className="lm-seg">
            {copy.properties.types.map((t, i) => (
              <button
                key={t.label}
                role="tab"
                id={`lm-prop-tab-${i}`}
                aria-selected={active === i}
                aria-controls="lm-prop-panel"
                tabIndex={active === i ? 0 : -1}
                type="button"
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  const count = copy.properties.types.length
                  if (e.key === 'ArrowRight') { e.preventDefault(); setActive((active + 1) % count) }
                  if (e.key === 'ArrowLeft') { e.preventDefault(); setActive((active - 1 + count) % count) }
                }}
                className="lm-seg-btn lm-focusable"
                style={{
                  background: active === i ? '#fff' : 'transparent',
                  color: active === i ? T.ink : T.muted,
                  boxShadow: active === i ? '0 1px 5px rgba(10,31,28,0.12)' : 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Reveal>

        <div id="lm-prop-panel" role="tabpanel" aria-labelledby={`lm-prop-tab-${active}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="lm-props-panel"
            >
              <div className="lm-card" style={{ padding: 26 }}>
                <p className="lm-mini-heading">{copy.properties.challengesLabel}</p>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {type.challenges.map((c) => (
                    <li key={c} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.55, color: T.muted }}>
                      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: T.terracotta, marginTop: 7, flexShrink: 0 }} />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lm-card" style={{ padding: 26 }}>
                <p className="lm-mini-heading">{copy.properties.featuresLabel}</p>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {type.features.map((f) => (
                    <li key={f} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.55, color: T.ink, fontWeight: 600 }}>
                      <span style={{ marginTop: 3 }}><CheckIcon size={13} color={T.emerald} /></span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lm-card" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 18, background: '#FBFCFD' }}>
                <div style={{ background: '#fff', border: `1px solid ${T.lineCard}`, borderRadius: 12, padding: 14 }}>
                  {minis[active]}
                </div>
                <p style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.5, color: T.emeraldDeep, letterSpacing: '-0.01em' }}>
                  {type.benefit}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

// ── Customer success ────────────────────────────────────────────────────────
// The premium case-study layout below is fully built but intentionally NOT
// rendered publicly: we have no verified customer story yet, and this page
// never presents fictional content as real. Flip SHOW_CASE_STUDY to true and
// replace every [PLACEHOLDER] once a real customer has approved their story.
const SHOW_CASE_STUDY = false

const CASE_STUDY_PLACEHOLDER = {
  property: '[PLACEHOLDER — nom de l’établissement]',
  city: '[PLACEHOLDER — ville]',
  name: '[PLACEHOLDER — nom du client]',
  role: '[PLACEHOLDER — rôle, ex. Propriétaire]',
  problem: '[PLACEHOLDER — problème opérationnel avant]',
  result: '[PLACEHOLDER — résultat mesurable vérifié]',
  quote: '[PLACEHOLDER — témoignage réel approuvé par le client]',
  imageAlt: '[PLACEHOLDER — photo authentique de l’établissement]',
}

function CaseStudyCard() {
  const cs = CASE_STUDY_PLACEHOLDER
  return (
    <Reveal className="lm-case-grid lm-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ background: T.bluegray, minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: 13 }}>
        {cs.imageAlt}
      </div>
      <div style={{ padding: '34px 34px 30px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: T.faint, marginBottom: 14 }}>
          {cs.property} · {cs.city}
        </p>
        <blockquote style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.55, color: T.ink, letterSpacing: '-0.01em', marginBottom: 18 }}>
          “{cs.quote}”
        </blockquote>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <p className="lm-mini-heading">Avant</p>
            <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.6 }}>{cs.problem}</p>
          </div>
          <div>
            <p className="lm-mini-heading">Résultat</p>
            <p style={{ fontSize: 13.5, color: T.emeraldDeep, fontWeight: 700, lineHeight: 1.6 }}>{cs.result}</p>
          </div>
        </div>
        <p style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{cs.name}</p>
        <p style={{ fontSize: 12.5, color: T.faint }}>{cs.role}</p>
      </div>
    </Reveal>
  )
}

export function Customers() {
  const { copy } = useLP()
  return (
    <section id="customers" className="lm-section" style={{ background: T.ivory }}>
      <div className="lm-container" style={{ maxWidth: 880 }}>
        <SectionHead eyebrow={copy.customers.eyebrow} heading={copy.customers.heading} />
        {SHOW_CASE_STUDY ? (
          <CaseStudyCard />
        ) : (
          <Reveal className="lm-card" style={{ padding: 'clamp(28px, 4vw, 44px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <ZelligePattern color={T.navy} opacity={0.04} style={{ inset: 0 }} />
            <p style={{ fontSize: 16, lineHeight: 1.75, color: T.muted, maxWidth: 620, margin: '0 auto 26px', position: 'relative' }}>
              {copy.customers.body}
            </p>
            <a href={CONTACT_WA} target="_blank" rel="noopener noreferrer" className="lm-btn lm-btn-navy lm-focusable" style={{ position: 'relative' }}>
              {copy.customers.cta}
              <span className="lm-arrow-flip"><ArrowIcon size={15} /></span>
            </a>
          </Reveal>
        )}
      </div>
    </section>
  )
}

// ── Feature ecosystem ───────────────────────────────────────────────────────
export function Ecosystem() {
  const { copy } = useLP()
  const icons = [ClipboardList, PlugZap, Wallet, TrendingUp]
  return (
    <section id="features" className="lm-section" style={{ background: '#fff' }}>
      <div className="lm-container">
        <SectionHead eyebrow={copy.ecosystem.eyebrow} heading={copy.ecosystem.heading} />
        <div className="lm-eco-grid">
          {copy.ecosystem.groups.map((g, i) => {
            const Icon = icons[i]
            return (
              <Reveal key={g.title} delay={i * 0.07} className="lm-card lm-hoverable" style={{ padding: 26 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 42, height: 42, borderRadius: 12, marginBottom: 18,
                    background: T.emeraldTint,
                    border: '1px solid rgba(15,110,86,0.16)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color={T.teal} strokeWidth={2} />
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: T.ink, letterSpacing: '-0.015em', marginBottom: 14 }}>{g.title}</h3>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {g.items.map((it) => (
                    <li key={it} style={{ display: 'flex', gap: 9, fontSize: 13.5, lineHeight: 1.55, color: T.muted }}>
                      <span style={{ marginTop: 3, flexShrink: 0 }}><CheckIcon size={12} color={T.emerald} strokeWidth={3} /></span>
                      {it}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Migration & onboarding ──────────────────────────────────────────────────
export function Migration() {
  const { copy } = useLP()
  const icons = [Import, DoorOpen, Link2, GraduationCap]
  return (
    <section className="lm-section" style={{ background: T.ivory }}>
      <div className="lm-container">
        <SectionHead eyebrow={copy.migration.eyebrow} heading={copy.migration.heading} />
        <ol className="lm-migration-grid">
          {copy.migration.steps.map((s, i) => {
            const Icon = icons[i]
            return (
              <Reveal as="li" key={s.title} delay={i * 0.08} className="lm-card lm-hoverable" style={{ padding: 24, position: 'relative' }}>
                <span style={{ position: 'absolute', top: 20, insetInlineEnd: 20, fontSize: 34, fontWeight: 800, color: T.bluegray, lineHeight: 1, letterSpacing: '-0.04em' }} aria-hidden="true">
                  {i + 1}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 40, height: 40, borderRadius: 11, marginBottom: 16,
                    background: T.emeraldTint, border: '1px solid rgba(15,110,86,0.16)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={19} color={T.emeraldDeep} strokeWidth={2} />
                </span>
                <h3 style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, letterSpacing: '-0.01em', marginBottom: 7 }}>{s.title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: T.muted }}>{s.desc}</p>
              </Reveal>
            )
          })}
        </ol>
        <Reveal delay={0.3}>
          <p style={{ textAlign: 'center', marginTop: 32, fontSize: 14, fontWeight: 600, color: T.emeraldDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <MessageCircle size={16} aria-hidden="true" />
            {copy.migration.note}
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ── Pricing ─────────────────────────────────────────────────────────────────
// Prices come from the live billing configuration (lib/constants.ts):
// Starter $35/mo (LS variant 1633090), Business/Pro $100/mo (LS 1633110).
// Enterprise $999/mo is the previously published price (contact-only, no
// self-serve checkout). Billing is in USD via LemonSqueezy; the MAD figure is
// an explicitly approximate reference (~10 MAD/USD) — adjust if rates move.
// NOTE: the -20% annual display mirrors the previously published claim;
// annual variants do not exist in LemonSqueezy yet — verify before promoting.
const PLAN_DATA = [
  { monthlyUsd: 35, href: START_HREF, external: false, featured: false },
  { monthlyUsd: 100, href: '/register?plan=pro', external: false, featured: true },
  { monthlyUsd: 999, href: CONTACT_WA, external: true, featured: false },
]
const MAD_PER_USD = 10 // approximate, display-only

export function Pricing() {
  const { copy } = useLP()
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="lm-section" style={{ background: '#fff' }}>
      <div className="lm-container">
        <SectionHead eyebrow={copy.pricing.eyebrow} heading={copy.pricing.heading} sub={copy.pricing.sub} />

        <Reveal style={{ display: 'flex', justifyContent: 'center', marginBottom: 44 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: T.ivory, borderRadius: 999, padding: '7px 18px', border: `1px solid ${T.line}` }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: annual ? T.faint : T.ink }}>{copy.pricing.monthly}</span>
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              aria-label={copy.pricing.annual}
              onClick={() => setAnnual((p) => !p)}
              className="lm-focusable"
              style={{
                width: 46, height: 25, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0,
                background: annual ? T.emerald : '#CDD6DD', position: 'relative', transition: 'background 0.25s',
              }}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                style={{
                  position: 'absolute', top: 3, insetInlineStart: annual ? 24 : 3,
                  width: 19, height: 19, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                }}
              />
            </button>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: annual ? T.ink : T.faint }}>
              {copy.pricing.annual}
              <span style={{ marginInlineStart: 7, fontSize: 11.5, fontWeight: 800, color: T.emeraldDeep, background: T.emeraldTint, padding: '2px 8px', borderRadius: 999 }}>
                {copy.pricing.save}
              </span>
            </span>
          </div>
        </Reveal>

        <div className="lm-pricing-grid">
          {copy.pricing.plans.map((plan, i) => {
            const data = PLAN_DATA[i]
            const usd = annual ? Math.round(data.monthlyUsd * 0.8) : data.monthlyUsd
            const mad = usd * MAD_PER_USD
            const ctaClass = `lm-btn lm-focusable ${data.featured ? 'lm-btn-primary' : 'lm-btn-outline'}`
            return (
              <Reveal
                key={plan.name}
                delay={i * 0.08}
                className={`lm-card lm-pricing-card${data.featured ? ' lm-pricing-featured' : ''}`}
                style={{
                  padding: '30px 28px',
                  border: data.featured ? `1.5px solid ${T.emerald}` : undefined,
                  boxShadow: data.featured ? '0 16px 48px rgba(15,110,86,0.16), 0 0 0 5px rgba(22,163,125,0.06)' : shadowCard,
                }}
              >
                {data.featured && (
                  <span style={{
                    position: 'absolute', top: -13, insetInlineStart: '50%', transform: 'translateX(-50%)',
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap',
                    color: '#fff', background: emeraldGrad, borderRadius: 999, padding: '5px 16px',
                    boxShadow: '0 4px 12px rgba(15,110,86,0.35)',
                  }}>
                    {copy.pricing.popular}
                  </span>
                )}
                <h3 style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: T.muted, marginBottom: 4 }}>{plan.name}</h3>
                <p style={{ fontSize: 12.5, color: T.faint, marginBottom: 20, minHeight: 34 }}>{plan.tagline}</p>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={annual ? 'a' : 'm'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    <p style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em', color: T.ink, lineHeight: 1 }}>${usd}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.faint }}>USD / {copy.pricing.perMonth}</span>
                    </p>
                    <p style={{ fontSize: 12, color: T.faint, marginTop: 6 }}>
                      ≈ {mad.toLocaleString('fr-MA')} MAD{annual ? ` · ${copy.pricing.billedAnnually}` : ''}
                    </p>
                  </motion.div>
                </AnimatePresence>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, margin: '22px 0 26px' }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', gap: 9, fontSize: 13.5, lineHeight: 1.5, color: T.muted }}>
                      <span
                        style={{
                          width: 17, height: 17, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                          background: data.featured ? emeraldGrad : T.emeraldTint,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <CheckIcon size={9} color={data.featured ? '#fff' : T.teal} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                {data.external ? (
                  <a href={data.href} target="_blank" rel="noopener noreferrer" className={ctaClass} style={{ width: '100%', justifyContent: 'center' }}>
                    {plan.cta}
                  </a>
                ) : (
                  <Link href={data.href} className={ctaClass} style={{ width: '100%', justifyContent: 'center' }}>
                    {plan.cta}
                  </Link>
                )}
              </Reveal>
            )
          })}
        </div>
        <Reveal delay={0.25}>
          <p style={{ textAlign: 'center', fontSize: 12.5, color: T.faint, marginTop: 28 }}>{copy.pricing.approxNote}</p>
        </Reveal>
      </div>
    </section>
  )
}

// ── FAQ ─────────────────────────────────────────────────────────────────────
export function FAQ() {
  const { copy } = useLP()
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="lm-section" style={{ background: T.ivory }}>
      <div className="lm-container" style={{ maxWidth: 780 }}>
        <SectionHead eyebrow={copy.faq.eyebrow} heading={copy.faq.heading} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {copy.faq.items.map((item, i) => {
            const isOpen = open === i
            return (
              <Reveal key={item.q} delay={Math.min(i * 0.04, 0.25)} className="lm-card" style={{ padding: 0, overflow: 'hidden' }}>
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`lm-faq-${i}`}
                    id={`lm-faq-btn-${i}`}
                    className="lm-faq-btn lm-focusable"
                  >
                    <span>{item.q}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                      style={{
                        flexShrink: 0, width: 27, height: 27, borderRadius: '50%',
                        background: isOpen ? emeraldGrad : T.emeraldTint,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      aria-hidden="true"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isOpen ? '#fff' : T.teal} strokeWidth="2.6" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`lm-faq-${i}`}
                      role="region"
                      aria-labelledby={`lm-faq-btn-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p style={{ padding: '0 24px 22px', fontSize: 14.5, lineHeight: 1.75, color: T.muted }}>{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ───────────────────────────────────────────────────────────────
export function FinalCTA() {
  const { copy } = useLP()
  return (
    <section className="lm-section" style={{ background: '#fff', paddingBottom: 110 }}>
      <div className="lm-container" style={{ maxWidth: 880 }}>
        <Reveal
          className="lm-final-cta"
          style={{
            background: darkGrad,
            position: 'relative', overflow: 'hidden', textAlign: 'center',
          }}
        >
          <ZelligePattern id="lm-z-cta" color="#9FE8D2" opacity={0.08} style={{ inset: 0, maskImage: 'radial-gradient(ellipse 90% 90% at 50% 0%, #000 15%, transparent 90%)', WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 0%, #000 15%, transparent 90%)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 480, height: 280, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.16) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <h2 className="lm-h2" style={{ color: '#fff', position: 'relative', marginBottom: 14 }}>
            {copy.finalCta.heading}
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: 'rgba(255,255,255,0.7)', maxWidth: 480, margin: '0 auto 34px', position: 'relative' }}>
            {copy.finalCta.sub}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
            <Link href={START_HREF} className="lm-btn lm-btn-lg lm-focusable" style={{ background: '#fff', color: T.teal, boxShadow: '0 10px 30px rgba(4,26,20,0.3)' }}>
              {copy.finalCta.ctaPrimary}
              <span className="lm-arrow-flip"><ArrowIcon size={16} /></span>
            </Link>
            <a href={CONTACT_WA} target="_blank" rel="noopener noreferrer" className="lm-btn lm-btn-lg lm-focusable" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.28)' }}>
              {copy.finalCta.ctaDemo}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ── Footer ──────────────────────────────────────────────────────────────────
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
        { label: 'Fiche de police — guide', href: '/blog/fiche-de-police-hostel-maroc' },
        { label: 'Booking.com vs Hostelworld', href: '/blog/booking-com-vs-hostelworld-maroc' },
        { label: 'Ouvrir un hostel au Maroc', href: '/blog/ouvrir-hostel-maroc-guide' },
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
    <footer style={{ background: T.ivory, borderTop: `1px solid ${T.line}`, color: T.muted }}>
      <div className="lm-container" style={{ paddingBlock: '64px 32px' }}>
        <div className="lm-footer-grid" style={{ borderBottom: `1px solid ${T.line}` }}>
          <div>
            <Logo />
            <p style={{ fontSize: 13, lineHeight: 1.7, color: T.faint, margin: '16px 0 20px', maxWidth: 280 }}>
              {copy.footer.tagline}
            </p>
            <LangSwitcher />
          </div>
          {cols.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.faint, marginBottom: 16 }}>
                {col.title}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('http') ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="lm-footer-link lm-focusable">{l.label}</a>
                    ) : l.href.startsWith('#') ? (
                      <a href={l.href} className="lm-footer-link lm-focusable">{l.label}</a>
                    ) : (
                      <Link href={l.href} className="lm-footer-link lm-focusable">{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div style={{ paddingTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <span style={{ fontSize: 12, color: T.faint }}>
            © {new Date().getFullYear()} {BRAND}. {copy.footer.rights}
          </span>
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Legal pages do not exist yet — safe placeholders per brief */}
            <a href="#" className="lm-footer-link lm-focusable" style={{ fontSize: 12 }}>{copy.footer.privacy}</a>
            <a href="#" className="lm-footer-link lm-focusable" style={{ fontSize: 12 }}>{copy.footer.terms}</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
