'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Navigation + hero ("The Living Property").
//
// Desktop (cinematic media query): a sticky stage scrubbed by scroll — the 3D
// riad is revealed, a reservation arrives (bed A3 turns occupied), a bed is
// cleaned (B2 turns ready), operational figures surface, then the camera rises
// to a top-down view that hands over to the real bed-map UI.
// Phones / reduced motion / no WebGL: a static editorial composition with the
// generated riad photograph and the same story cards. Same DOM, single h1.
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { CTA, LangSwitcher, Logo, START_HREF, SIGNIN_HREF, useCinematic, useLP, useScrollProgress, EASE } from './lp-shared'
import { BookingCard, StatusCard, OpsGrid, BedLegend } from './lp-ui'
import { DEMO_ROOMS, STORY_BOOKED_BED, STORY_CLEANED_BED } from './lp-data'

// ── Finale: the riad hands over to the bed map ─────────────────────────────
// Window of hero progress over which the rooms fill in, one after another.
const FILL_START = 0.885
const FILL_STEP = 0.016

function FinaleBed({ name, status, at, progress, tag }: { name: string; status: string; at: number; progress: MotionValue<number>; tag?: string }) {
  const opacity = useTransform(progress, [at, at + 0.012], [0, 1])
  const scale = useTransform(progress, [at, at + 0.016], [0.6, 1])
  const y = useTransform(progress, [at, at + 0.016], [-14, 0])
  const story = tag !== undefined
  const tagOpacity = useTransform(progress, [0.955, 0.97], [0, 1])
  return (
    <motion.div className="sr-bed sr-finale-bed" data-s={status} data-story={story} style={{ opacity, scale, y }}>
      {name}
      {story && (
        <motion.span className="sr-finale-tag" style={{ opacity: tagOpacity }}>
          {tag}
        </motion.span>
      )}
    </motion.div>
  )
}

function FinaleRoom({ ri, progress, tags }: { ri: number; progress: MotionValue<number>; tags: Record<string, string> }) {
  const { copy } = useLP()
  const room = DEMO_ROOMS[ri]
  const at = FILL_START + ri * FILL_STEP
  const opacity = useTransform(progress, [at - 0.01, at], [0, 1])
  const n = room.beds.length
  return (
    <motion.div className="sr-card" style={{ padding: 12, opacity }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.ui.rooms[ri]}</span>
        <span style={{ fontSize: 11, color: 'var(--sr-faint)' }} className="sr-mono">
          {room.beds.filter((b) => b.status !== 'free').length}/{n}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6 }}>
        {room.beds.map((b, bi) => (
          <FinaleBed key={b.name} name={b.name} status={b.status} at={at + (bi / n) * FILL_STEP} progress={progress} tag={tags[b.name]} />
        ))}
      </div>
    </motion.div>
  )
}

const LivingPropertyScene = dynamic(() => import('./LivingPropertyScene'), { ssr: false })

// ── Nav ─────────────────────────────────────────────────────────────────────
export function LandingNav() {
  const { copy } = useLP()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const links = [
    { label: copy.nav.features, href: '#features' },
    { label: copy.nav.solutions, href: '#solutions' },
    { label: copy.nav.pricing, href: '#pricing' },
    { label: copy.nav.customers, href: '#customers' },
    { label: copy.nav.resources, href: '/blog' },
  ]

  return (
    <header className="sr-nav" data-scrolled={scrolled || open}>
      <div className="sr-container sr-nav-inner">
        <Link href="/" aria-label="Sweet Reservation" style={{ borderRadius: 10 }}>
          <Logo />
        </Link>
        <nav aria-label="Navigation principale" className="sr-nav-links">
          {links.map((l) =>
            l.href.startsWith('#') ? (
              <a key={l.href} href={l.href} className="sr-nav-link">{l.label}</a>
            ) : (
              <Link key={l.href} href={l.href} className="sr-nav-link">{l.label}</Link>
            ),
          )}
        </nav>
        <div className="sr-nav-actions">
          <span className="sr-hide-md"><LangSwitcher /></span>
          <Link href={SIGNIN_HREF} className="sr-nav-link sr-hide-md">{copy.nav.signin}</Link>
          <span className="sr-hide-sm">
            <CTA href={START_HREF} size="sm" magnetic={false}>{copy.nav.start}</CTA>
          </span>
          <button
            type="button"
            className="sr-burger"
            aria-label={copy.nav.openMenu}
            aria-expanded={open}
            aria-controls="sr-mobile-menu"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="sr-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={copy.nav.openMenu}
            className="sr-mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56, marginBottom: 24 }}>
              <Logo />
              <button ref={closeRef} type="button" className="sr-burger" style={{ display: 'inline-flex' }} aria-label={copy.nav.closeMenu} onClick={() => setOpen(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Navigation mobile">
              {links.map((l, i) => (
                <motion.div key={l.href} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04, duration: 0.5, ease: EASE }}>
                  {l.href.startsWith('#') ? (
                    <a href={l.href} className="sr-mobile-link" onClick={() => setOpen(false)}>{l.label}</a>
                  ) : (
                    <Link href={l.href} className="sr-mobile-link" onClick={() => setOpen(false)}>{l.label}</Link>
                  )}
                </motion.div>
              ))}
            </nav>
            <div style={{ marginTop: 'auto', paddingTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <LangSwitcher />
              <Link href={START_HREF} className="sr-btn sr-btn-primary">{copy.nav.start}</Link>
              <Link href={SIGNIN_HREF} className="sr-btn sr-btn-ghost">{copy.nav.signin}</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ── Capability detection for the 3D scene ──────────────────────────────────
function supportsWebGL(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number }
    if ((nav.hardwareConcurrency ?? 8) < 4) return false
    if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    return !!gl
  } catch {
    return false
  }
}

// ── Story helpers ───────────────────────────────────────────────────────────
const BEATS: [number, number][] = [
  [0, 0.2],
  [0.2, 0.44],
  [0.44, 0.64],
  [0.64, 0.82],
  [0.82, 1],
]

function BeatBar({ progress, range }: { progress: MotionValue<number>; range: [number, number] }) {
  const scaleX = useTransform(progress, range, [0, 1], { clamp: true })
  return (
    <span className="sr-beat-bar" aria-hidden="true">
      <motion.span style={{ scaleX }} />
    </span>
  )
}

function StoryCard({
  progress,
  range,
  children,
}: {
  progress: MotionValue<number>
  range: [number, number, number, number]
  children: React.ReactNode
}) {
  const opacity = useTransform(progress, range, [0, 1, 1, 0])
  const y = useTransform(progress, range, [40, 0, 0, -40])
  const blur = useTransform(progress, range, ['blur(8px)', 'blur(0px)', 'blur(0px)', 'blur(8px)'])
  return (
    <div className="sr-card-slot" style={{ transform: 'translateY(-50%)' }}>
      <motion.div style={{ opacity, y, filter: blur }}>{children}</motion.div>
    </div>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────
export function Hero() {
  const { copy, lang } = useLP()
  const cinematic = useCinematic()
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollYProgress = useScrollProgress(trackRef, ['start start', 'end end'])

  const [webgl, setWebgl] = useState<'pending' | 'on' | 'off'>('pending')
  const [load3d, setLoad3d] = useState(false)
  const [sceneReady, setSceneReady] = useState(false)
  const [beat, setBeat] = useState(0)
  const [booked, setBooked] = useState(false)
  const [cleaned, setCleaned] = useState(false)
  const [pastEnd, setPastEnd] = useState(false)
  const [night, setNight] = useState(false)
  const inView = useInView(trackRef, { margin: '0px 0px 0px 0px' })

  // Decide on WebGL only in cinematic mode, then mount the scene when idle so
  // the server-rendered headline stays the LCP element.
  useEffect(() => {
    if (!cinematic) return
    const ok = supportsWebGL()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability probe after mount
    setWebgl(ok ? 'on' : 'off')
    if (!ok) return
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setLoad3d(true), { timeout: 1500 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(() => setLoad3d(true), 700)
    return () => window.clearTimeout(t)
  }, [cinematic])

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const b = BEATS.findIndex(([a, z]) => p >= a && p < z)
    const nb = b === -1 ? BEATS.length - 1 : b
    if (nb !== beat) setBeat(nb)
    if (p > 0.3 !== booked) setBooked(p > 0.3)
    if (p > 0.53 !== cleaned) setCleaned(p > 0.53)
    if (p > 0.97 !== pastEnd) setPastEnd(p > 0.97)
    const isNight = p > 0.7 && p < 0.88
    if (isNight !== night) setNight(isNight)
  })

  const copyOpacity = useTransform(scrollYProgress, [0.06, 0.16], [1, 0])
  const copyY = useTransform(scrollYProgress, [0.06, 0.16], [0, -60])
  // Once faded, the copy must not stay clickable or focusable over the scene.
  const copyVisibility = useTransform(scrollYProgress, (p) => (p > 0.165 ? 'hidden' : 'visible'))
  const canvasOpacity = useTransform(scrollYProgress, [0.87, 0.93], [1, 0])
  // Sky behind the model follows the scene's day cycle, then clears for the bed map.
  const goldOpacity = useTransform(scrollYProgress, [0.52, 0.63, 0.72, 0.8], [0, 1, 1, 0])
  const nightOpacity = useTransform(scrollYProgress, [0.66, 0.78, 0.85, 0.9], [0, 1, 1, 0])
  const finaleOpacity = useTransform(scrollYProgress, [0.86, 0.9], [0, 1])
  const finaleY = useTransform(scrollYProgress, [0.87, 0.96], [30, 0])
  // The card arrives at the riad's top-down angle and settles flat, face-on.
  const cardRotX = useTransform(scrollYProgress, [0.86, 0.95], [48, 0])
  const cardRotZ = useTransform(scrollYProgress, [0.86, 0.95], [copy.dir === 'rtl' ? 9 : -9, 0])
  const cardScale = useTransform(scrollYProgress, [0.86, 0.95], [0.84, 1])
  const cardY = useTransform(scrollYProgress, [0.86, 0.95], [80, 0])
  const hintOpacity = useTransform(scrollYProgress, [0, 0.03], [1, 0])
  const finaleVisible = useTransform(scrollYProgress, (p) => (p > 0.86 ? 'visible' : 'hidden'))

  const words = (s: string, offset: number) =>
    s.split(' ').map((w, i, arr) => (
      <span key={`${w}-${i}`} className="sr-mask sr-rise" style={{ '--i': offset + i } as React.CSSProperties}>
        <span>{w}</span>
        {i < arr.length - 1 ? ' ' : null}
      </span>
    ))
  const h1aCount = copy.hero.h1a.split(' ').length

  return (
    <section className="sr-hero" aria-labelledby="sr-hero-title">
      <div ref={trackRef} className="sr-hero-track">
        <div className="sr-stage" data-webgl={webgl} data-night={cinematic && webgl === 'on' && night}>
          {/* Sky layers (cinematic + WebGL only) */}
          {cinematic && webgl === 'on' && (
            <>
              <motion.div className="sr-stage-sky sr-sky-gold" style={{ opacity: goldOpacity }} aria-hidden="true" />
              <motion.div className="sr-stage-sky sr-sky-night" style={{ opacity: nightOpacity }} aria-hidden="true" />
            </>
          )}

          {/* 3D scene (cinematic + WebGL only) */}
          <motion.div className="sr-stage-canvas" style={{ opacity: canvasOpacity }} role="img" aria-label={copy.hero.sceneLabel}>
            {cinematic && load3d && (
              <motion.div
                style={{ position: 'absolute', inset: 0 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: sceneReady ? 1 : 0 }}
                transition={{ duration: 1.4, ease: EASE }}
              >
                <LivingPropertyScene
                  progress={scrollYProgress}
                  rtl={copy.dir === 'rtl'}
                  active={inView && !pastEnd}
                  onReady={() => setSceneReady(true)}
                />
              </motion.div>
            )}
          </motion.div>

          {/* Copy */}
          <div className="sr-stage-copy">
            <motion.div className="sr-container" style={cinematic ? { opacity: copyOpacity, y: copyY, visibility: copyVisibility } : undefined}>
              <div className="sr-hero-copy">
                <span className="sr-eyebrow sr-fade-in" style={{ '--d': '60ms' } as React.CSSProperties}>
                  {copy.hero.eyebrow}
                </span>
                <h1 id="sr-hero-title" className="sr-display" key={lang}>
                  <span style={{ display: 'block' }}>{words(copy.hero.h1a, 0)}</span>
                  <span className="sr-serif" style={{ display: 'block', color: 'var(--sr-accent-ink)' }}>
                    {words(copy.hero.h1b, h1aCount)}
                  </span>
                </h1>
                <p className="sr-lead sr-fade-in" style={{ '--d': '380ms' } as React.CSSProperties}>
                  {copy.hero.sub}
                </p>
                <div className="sr-hero-ctas sr-fade-in" style={{ '--d': '480ms' } as React.CSSProperties}>
                  <CTA href={START_HREF} arrow>{copy.hero.ctaPrimary}</CTA>
                  <CTA href="#tour" variant="ghost">{copy.hero.ctaSecondary}</CTA>
                </div>
                <ul className="sr-hero-trust sr-fade-in" style={{ '--d': '580ms' } as React.CSSProperties}>
                  {copy.hero.trust.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>

          {/* Static composition / no-WebGL poster */}
          <div className="sr-hero-photo-wrap">
            <div className="sr-container" style={{ padding: cinematic ? 0 : undefined }}>
              <div className="sr-hero-photo">
                <Image
                  src="/landing/riad.jpg"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 960px) 44vw, 100vw"
                />
                <div className="sr-hero-photo-cards" aria-hidden="true">
                  <BookingCard />
                  <span className="sr-demo-tag" style={{ background: 'rgba(255,255,255,0.86)', alignSelf: 'flex-start' }}>{copy.demo}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Story cards (cinematic) */}
          {cinematic && (
            <div className="sr-stage-cards" aria-hidden="true">
              <StoryCard progress={scrollYProgress} range={[0.19, 0.25, 0.41, 0.46]}>
                <BookingCard confirmed={booked} />
              </StoryCard>
              <StoryCard progress={scrollYProgress} range={[0.45, 0.5, 0.61, 0.66]}>
                <StatusCard ready={cleaned} />
              </StoryCard>
              <StoryCard progress={scrollYProgress} range={[0.65, 0.7, 0.8, 0.85]}>
                <OpsGrid />
              </StoryCard>
            </div>
          )}

          {/* Finale — the model hands over to the bed map */}
          {cinematic && (
            <motion.div className="sr-stage-finale" style={{ opacity: finaleOpacity, visibility: finaleVisible }}>
              <motion.p className="sr-h2" style={{ textAlign: 'center', maxWidth: 780, fontSize: 'clamp(30px, 3.4vw, 48px)', y: finaleY }}>
                {copy.hero.finale}
              </motion.p>
              <div className="sr-finale-persp">
                <motion.div
                  className="sr-card"
                  style={{ rotateX: cardRotX, rotateZ: cardRotZ, scale: cardScale, y: cardY, width: 'min(960px, 100%)', padding: 20, background: '#FAFBFB', boxShadow: 'var(--sr-shadow-3)', transformOrigin: '50% 60%' }}
                  aria-hidden="true"
                >
                  <div className="sr-ui" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{copy.ui.bedMap} · {copy.ui.property}</span>
                    <span className="sr-demo-tag">{copy.demo}</span>
                  </div>
                  <div className="sr-ui sr-bedmap">
                    {DEMO_ROOMS.map((r, ri) => (
                      <FinaleRoom
                        key={r.key}
                        ri={ri}
                        progress={scrollYProgress}
                        tags={{
                          [STORY_BOOKED_BED]: `${copy.hero.booking.guest.split(' ')[0]} · ${copy.hero.booking.source}`,
                          [STORY_CLEANED_BED]: `✓ ${copy.hero.status.to}`,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <BedLegend />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Beat indicator + scroll hint */}
          {cinematic && (
            <>
              <ol className="sr-beats" aria-hidden="true">
                {copy.hero.beats.map((b, i) => (
                  <li key={b} className="sr-beat" data-active={i === beat}>
                    <BeatBar progress={scrollYProgress} range={BEATS[i]} />
                    {b}
                  </li>
                ))}
              </ol>
              <motion.div className="sr-scroll-hint" style={{ opacity: hintOpacity }} aria-hidden="true">
                {copy.hero.scroll}
                <i />
              </motion.div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
