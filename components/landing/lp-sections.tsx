'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Landing sections 1/2 — announcement, nav, hero, trust, outcomes, tour,
// daily workflow. Landing-only; never imported by the SaaS app.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { T, useLP, Reveal, TiltCard, Glow, SectionHead, ZelligePattern, ArrowIcon, CheckIcon } from './lp-shared'
import { BRAND, LANG_LABELS, type LandingLang } from './lp-i18n'
import {
  HeroDashboardMock,
  CalendarMock,
  CheckinMock,
  PoliceMock,
  WhatsAppMock,
  PaymentsMock,
  ReportsMock,
  MiniCheckinSteps,
  MiniPolice,
  MiniCalendar,
  MiniReconcile,
} from './lp-mocks'

// Existing CTA destinations — do not change (see brief).
export const START_HREF = '/register?plan=starter'
export const SIGNIN_HREF = '/login'
export const CONTACT_WA = 'https://wa.me/212679760746'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

// ── Logo — uses the real app icon (served from app/icon.png) ───────────────
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <Image
        src="/icon.png"
        alt=""
        width={30}
        height={30}
        style={{ borderRadius: 8, flexShrink: 0 }}
        priority
      />
      <span style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.02em', color: dark ? '#fff' : T.ink, whiteSpace: 'nowrap' }}>
        {BRAND}
      </span>
    </span>
  )
}

// ── Language switcher ───────────────────────────────────────────────────────
export function LangSwitcher({ dark = false, full = false }: { dark?: boolean; full?: boolean }) {
  const { lang, setLang, copy } = useLP()
  const langs: LandingLang[] = ['fr', 'en', 'ar']
  return (
    <div
      role="group"
      aria-label={copy.nav.langLabel}
      style={{
        display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999,
        background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(10,31,28,0.05)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.16)' : T.line}`,
      }}
    >
      {langs.map((l) => {
        const active = lang === l
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={active}
            lang={l}
            className="lm-focusable"
            style={{
              fontSize: full ? 13 : 11.5,
              fontWeight: 700,
              padding: full ? '7px 14px' : '4px 10px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: active ? (dark ? 'rgba(255,255,255,0.94)' : '#fff') : 'transparent',
              color: active ? T.ink : dark ? 'rgba(255,255,255,0.78)' : T.muted,
              boxShadow: active ? '0 1px 4px rgba(10,31,28,0.14)' : 'none',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {full ? LANG_LABELS[l] : l === 'ar' ? 'ع' : l.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

// ── Announcement bar — discreet, closable ───────────────────────────────────
export function AnnouncementBar() {
  const { copy } = useLP()
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div
      role="region"
      aria-label={copy.announce}
      style={{
        background: '#fff', color: T.muted,
        fontSize: 12.5, fontWeight: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        padding: '8px 44px', position: 'relative', textAlign: 'center',
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: T.teal, background: T.emeraldTint, borderRadius: 999, padding: '2px 9px', flexShrink: 0,
        }}
      >
        New
      </span>
      <span style={{ color: T.body }}>{copy.announce}</span>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={copy.announceClose}
        className="lm-focusable"
        style={{
          position: 'absolute', insetInlineEnd: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', color: T.faint,
          cursor: 'pointer', padding: 6, borderRadius: 8, lineHeight: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Nav — frosted glass, like the app's TopBar ──────────────────────────────
export function LandingNav() {
  const { copy } = useLP()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const links = [
    { label: copy.nav.features, href: '#features' },
    { label: copy.nav.solutions, href: '#solutions' },
    { label: copy.nav.pricing, href: '#pricing' },
    { label: copy.nav.customers, href: '#customers' },
    { label: copy.nav.resources, href: '/blog' },
  ]

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: `1px solid ${scrolled ? T.line : 'rgba(229,233,231,0.5)'}`,
        boxShadow: scrolled ? '0 2px 24px rgba(10,31,28,0.06)' : 'none',
        transition: 'border-color 0.25s, box-shadow 0.25s',
      }}
    >
      <nav className="lm-container" aria-label={BRAND} style={{ display: 'flex', alignItems: 'center', gap: 24, height: 60 }}>
        <Link href="/" className="lm-focusable" style={{ textDecoration: 'none', borderRadius: 10 }}>
          <Logo />
        </Link>

        <div className="lm-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 2, marginInlineStart: 'auto' }}>
          {links.map((l) =>
            l.href.startsWith('#') ? (
              <a key={l.href} href={l.href} className="lm-navlink lm-focusable">{l.label}</a>
            ) : (
              <Link key={l.href} href={l.href} className="lm-navlink lm-focusable">{l.label}</Link>
            )
          )}
        </div>

        <div className="lm-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LangSwitcher />
          <Link href={SIGNIN_HREF} className="lm-navlink lm-focusable lm-nav-signin">{copy.nav.signin}</Link>
          <Link href={START_HREF} className="lm-btn lm-btn-primary lm-focusable" style={{ fontSize: 13.5, padding: '9px 20px' }}>
            {copy.nav.start}
          </Link>
        </div>

        <button
          type="button"
          className="lm-burger lm-focusable"
          aria-expanded={menuOpen}
          aria-controls="lm-mobile-menu"
          aria-label={menuOpen ? copy.nav.closeMenu : copy.nav.openMenu}
          onClick={() => setMenuOpen((p) => !p)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="lm-mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: 'hidden', borderTop: `1px solid ${T.line}`, background: 'rgba(255,255,255,0.98)' }}
          >
            <div className="lm-container" style={{ padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {links.map((l) =>
                l.href.startsWith('#') ? (
                  <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="lm-mobile-link lm-focusable">{l.label}</a>
                ) : (
                  <Link key={l.href} href={l.href} className="lm-mobile-link lm-focusable">{l.label}</Link>
                )
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <Link href={START_HREF} className="lm-btn lm-btn-primary lm-focusable" style={{ flex: 1, justifyContent: 'center', minWidth: 160 }}>
                  {copy.nav.start}
                </Link>
                <Link href={SIGNIN_HREF} className="lm-btn lm-btn-ghost lm-focusable" style={{ flex: 1, justifyContent: 'center', minWidth: 140 }}>
                  {copy.nav.signin}
                </Link>
              </div>
              <div style={{ marginTop: 14 }}>
                <LangSwitcher full />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ── Hero — centered, Apple-style product-first ──────────────────────────────
export function Hero() {
  const { copy } = useLP()
  const reduced = useReducedMotion()
  const enter = (delay: number) => ({
    initial: reduced ? { opacity: 1 } : { opacity: 0, y: 18, filter: 'blur(5px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.65, delay, ease: EASE },
  })

  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FAF9 55%, #EEF4F1 100%)' }}>
      {/* Dot grid + zellige atmosphere */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(15,110,86,0.12) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          maskImage: 'radial-gradient(ellipse 75% 55% at 50% 32%, #000 25%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 55% at 50% 32%, #000 25%, transparent 100%)',
        }}
      />
      <ZelligePattern id="lm-z-hero" color={T.teal} opacity={0.05} style={{ inset: 0, maskImage: 'radial-gradient(ellipse 45% 45% at 88% 12%, #000 15%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 45% 45% at 88% 12%, #000 15%, transparent 80%)' }} />
      <Glow style={{ width: 640, height: 300, top: '8%', insetInlineStart: '-12%' }} />
      <Glow style={{ width: 560, height: 280, top: '48%', insetInlineEnd: '-10%' }} />

      <div className="lm-container lm-hero-center">
        <motion.p
          {...enter(0.05)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12.5, fontWeight: 700, color: T.teal,
            background: 'rgba(255,255,255,0.8)', border: `1px solid ${T.line}`,
            padding: '7px 16px', borderRadius: 999, marginBottom: 26,
            boxShadow: '0 1px 4px rgba(10,31,28,0.05)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }} aria-hidden="true">
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: T.mint, opacity: 0.5, animation: reduced ? 'none' : 'ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }} />
            <span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', background: T.mint }} />
          </span>
          {copy.hero.eyebrow}
        </motion.p>

        <h1 className="lm-h1" style={{ color: T.ink }}>
          <motion.span {...enter(0.14)} style={{ display: 'block' }}>{copy.hero.h1a}</motion.span>
          <motion.span
            {...enter(0.26)}
            style={{
              display: 'block',
              background: `linear-gradient(120deg, ${T.mint} 10%, ${T.teal} 60%, ${T.tealDeep} 100%)`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              paddingBottom: '0.08em',
            }}
          >
            {copy.hero.h1b}
          </motion.span>
        </h1>

        <motion.p {...enter(0.36)} className="lm-hero-sub" style={{ color: T.muted }}>
          {copy.hero.sub}
        </motion.p>

        <motion.div {...enter(0.46)} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
          <Link href={START_HREF} className="lm-btn lm-btn-primary lm-btn-lg lm-focusable">
            {copy.hero.ctaPrimary}
            <span className="lm-arrow-flip"><ArrowIcon size={16} /></span>
          </Link>
          <a href="#tour" className="lm-btn lm-btn-ghost lm-btn-lg lm-focusable">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
            {copy.hero.ctaSecondary}
          </a>
        </motion.div>

        <motion.ul {...enter(0.56)} style={{ listStyle: 'none', display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', padding: 0, fontSize: 12.5, color: T.faint, fontWeight: 600, marginBottom: 54 }}>
          {copy.hero.trust.map((s) => (
            <li key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CheckIcon size={12} color={T.mint} />
              {s}
            </li>
          ))}
        </motion.ul>

        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
          className="lm-hero-visual"
        >
          <TiltCard>
            <HeroDashboardMock />
          </TiltCard>
          <p style={{ fontSize: 11, color: T.faint, textAlign: 'center', marginTop: 14 }}>{copy.hero.mockCaption}</p>
        </motion.div>
      </div>
    </section>
  )
}

// ── Trust strip ─────────────────────────────────────────────────────────────
export function TrustStrip() {
  const { copy } = useLP()
  return (
    <section aria-label={copy.trustStrip.heading} style={{ background: '#fff', borderBottom: `1px solid ${T.lineCard}` }}>
      <div className="lm-container" style={{ paddingBlock: 40 }}>
        <Reveal>
          <p style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.faint, marginBottom: 24 }}>
            {copy.trustStrip.heading}
          </p>
        </Reveal>
        <div className="lm-trust-grid">
          {copy.trustStrip.items.map((it, i) => (
            <Reveal key={it.name} delay={i * 0.06} className="lm-trust-item">
              <span style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>{it.name}</span>
              <span style={{ fontSize: 11.5, color: T.muted }}>{it.note}</span>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <p style={{ textAlign: 'center', fontSize: 12.5, color: T.faint, marginTop: 24 }}>{copy.trustStrip.statement}</p>
        </Reveal>
      </div>
    </section>
  )
}

// ── Outcomes ────────────────────────────────────────────────────────────────
export function Outcomes() {
  const { copy } = useLP()
  const minis = [<MiniCheckinSteps key="a" />, <MiniPolice key="b" />, <MiniCalendar key="c" />, <MiniReconcile key="d" />]
  return (
    <section id="outcomes" className="lm-section" style={{ background: T.ivory }}>
      <div className="lm-container">
        <SectionHead eyebrow={copy.outcomes.eyebrow} heading={copy.outcomes.heading} />
        <div className="lm-outcomes-grid">
          {copy.outcomes.items.map((o, i) => (
            <Reveal key={o.title} delay={i * 0.08} className="lm-card lm-hoverable" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 26 }}>
              <div style={{ background: '#FAFCFB', border: `1px solid ${T.lineCard}`, borderRadius: 18, padding: 16, minHeight: 138, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {minis[i]}
              </div>
              <div>
                <h3 style={{ fontSize: 17.5, fontWeight: 700, color: T.ink, letterSpacing: '-0.015em', marginBottom: 6 }}>{o.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: T.muted }}>{o.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Interactive product tour ────────────────────────────────────────────────
export function ProductTour() {
  const { copy } = useLP()
  const [active, setActive] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const mocks = [
    <CalendarMock key="cal" />,
    <CheckinMock key="chk" />,
    <PoliceMock key="pol" />,
    <WhatsAppMock key="wa" />,
    <PaymentsMock key="pay" />,
    <ReportsMock key="rep" />,
  ]
  const tab = copy.tour.tabs[active]

  function onKeyDown(e: React.KeyboardEvent) {
    const count = copy.tour.tabs.length
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (active + 1) % count
    else if (e.key === 'ArrowLeft') next = (active - 1 + count) % count
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = count - 1
    if (next !== null) {
      e.preventDefault()
      setActive(next)
      tabRefs.current[next]?.focus()
    }
  }

  return (
    <section id="tour" className="lm-section" style={{ background: '#fff' }}>
      <div className="lm-container">
        <SectionHead eyebrow={copy.tour.eyebrow} heading={copy.tour.heading} sub={copy.tour.sub} />

        <Reveal style={{ display: 'flex', justifyContent: 'center', marginBottom: 44 }}>
          <div role="tablist" aria-label={copy.tour.heading} className="lm-seg" onKeyDown={onKeyDown}>
            {copy.tour.tabs.map((t, i) => (
              <button
                key={t.label}
                ref={(el) => { tabRefs.current[i] = el }}
                role="tab"
                id={`lm-tab-${i}`}
                aria-selected={active === i}
                aria-controls="lm-tour-panel"
                tabIndex={active === i ? 0 : -1}
                type="button"
                onClick={() => setActive(i)}
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

        <div
          id="lm-tour-panel"
          role="tabpanel"
          aria-labelledby={`lm-tab-${active}`}
          className="lm-tour-panel"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: EASE }}
              className="lm-tour-inner"
            >
              <div className="lm-tour-text">
                <h3 style={{ fontSize: 'clamp(21px, 2.6vw, 27px)', fontWeight: 700, letterSpacing: '-0.02em', color: T.ink, lineHeight: 1.2, marginBottom: 14 }}>
                  {tab.headline}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: T.muted, marginBottom: 22 }}>{tab.body}</p>
                <p style={{
                  display: 'inline-flex', alignItems: 'flex-start', gap: 9,
                  fontSize: 13.5, fontWeight: 700, color: T.teal,
                  background: T.emeraldTint, border: '1px solid rgba(15,110,86,0.15)',
                  borderRadius: 14, padding: '11px 15px', lineHeight: 1.5,
                }}>
                  <span style={{ marginTop: 2 }}><CheckIcon size={13} color={T.teal} /></span>
                  {tab.outcome}
                </p>
              </div>
              <div className="lm-tour-mock" style={{ background: '#FAFCFB', border: `1px solid ${T.lineCard}`, borderRadius: 24, boxShadow: '0 1px 2px rgba(10,31,28,0.04), 0 16px 44px rgba(10,31,28,0.08)', overflow: 'hidden' }}>
                {mocks[active]}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

// ── Daily workflow ──────────────────────────────────────────────────────────
export function Workflow() {
  const { copy } = useLP()
  return (
    <section className="lm-section" style={{ background: T.ivory, position: 'relative', overflow: 'hidden' }}>
      <div className="lm-container" style={{ maxWidth: 820 }}>
        <SectionHead eyebrow={copy.workflow.eyebrow} heading={copy.workflow.heading} />
        <ol className="lm-timeline">
          {copy.workflow.steps.map((s, i) => (
            <Reveal as="li" key={s.time} delay={i * 0.07} className="lm-timeline-item">
              <span className="lm-timeline-time">{s.time}</span>
              <div className="lm-card lm-hoverable" style={{ flex: 1, padding: '19px 24px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em', marginBottom: 4 }}>{s.title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: T.muted }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
