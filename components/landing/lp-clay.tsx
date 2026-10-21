'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Clay sections — complexity → clarity, local advantage and property types.
// The clay objects are original Higgsfield renders (public/landing/clay/,
// transparent WebP); the property-type buildings are also served as GLB models
// (public/landing/3d/) for the desktop turntable. Light app palette throughout.
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useTransform, type MotionValue } from 'framer-motion'
import { BarChart3, BedDouble, CalendarDays, FileText, MessageCircle, Wallet } from 'lucide-react'
import { CTA, EASE, SectionHead, START_HREF, useCinematic, useLP, useReducedMotion, useScrollProgress } from './lp-shared'

const ClayTurntable = dynamic(() => import('./ClayTurntable'), { ssr: false })

// ── Clay object ────────────────────────────────────────────────────────────
export type ClayName =
  | 'notebook' | 'calculator' | 'forms' | 'phone' | 'cashbox' | 'calendar' | 'bunk' | 'passport' | 'chat'
  | 'key' | 'tea' | 'zellige' | 'bell' | 'coins' | 'hostel' | 'riad' | 'surf' | 'guesthouse'

/** A clay render with a soft contact shadow and an idle float (CSS, off under reduced motion). */
export function Clay({
  name,
  size,
  float = true,
  delay = 0,
  className = '',
  style,
  priority = false,
}: {
  name: ClayName
  size: number | string
  float?: boolean
  delay?: number
  className?: string
  style?: React.CSSProperties
  priority?: boolean
}) {
  return (
    <span
      className={`sr-clay${float ? ' sr-clay-float' : ''} ${className}`.trim()}
      style={{ width: size, '--d': `${delay}s`, ...style } as React.CSSProperties}
      aria-hidden="true"
    >
      <Image src={`/landing/clay/${name}.webp`} alt="" width={640} height={640} sizes="240px" priority={priority} />
    </span>
  )
}

// ── 1. From complexity to clarity ──────────────────────────────────────────
const TOOLS: ClayName[] = ['notebook', 'calculator', 'forms', 'phone', 'cashbox', 'calendar']
const MODULE_ICONS = [CalendarDays, BedDouble, FileText, MessageCircle, Wallet, BarChart3]
// Scattered start positions (vw / vh from the centre), rotation and size
const SCATTER: { x: number; y: number; r: number; s: number }[] = [
  { x: -34, y: -22, r: -12, s: 200 },
  { x: 33, y: -26, r: 10, s: 180 },
  { x: -38, y: 18, r: 8, s: 210 },
  { x: 36, y: 16, r: -8, s: 150 },
  { x: -14, y: 30, r: -6, s: 190 },
  { x: 16, y: -34, r: 6, s: 180 },
]
// Where each tool lands: the matching module chip in the app card (px from centre)
const LAND: [number, number][] = [
  [-200, -17],
  [0, -17],
  [200, -17],
  [-200, 59],
  [0, 59],
  [200, 59],
]

function FlyingTool({ i, progress, rtl }: { i: number; progress: MotionValue<number>; rtl: boolean }) {
  const { copy } = useLP()
  const sc = SCATTER[i]
  const [lx, ly] = LAND[i]
  const dir = rtl ? -1 : 1
  const start = 0.12 + i * 0.05
  const end = start + 0.32
  const x = useTransform(progress, [start, end], [`calc(${sc.x * dir}vw + 0px)`, `calc(0vw + ${lx * dir}px)`])
  const y = useTransform(progress, [start, end], [`calc(${sc.y}vh + 0px)`, `calc(0vh + ${ly}px)`])
  const rotate = useTransform(progress, [start, end], [sc.r * dir, 0])
  const scale = useTransform(progress, [start, end], [1, 0.16])
  const opacity = useTransform(progress, [end - 0.06, end], [1, 0])
  const labelOpacity = useTransform(progress, [start, start + 0.08], [1, 0])
  const frag = copy.complexity.fragments[i]
  return (
    <motion.div className="sr-cx2-tool" style={{ x, y, rotate, scale, opacity }}>
      <Clay name={TOOLS[i]} size={sc.s} delay={i * 0.4} />
      <motion.span className="sr-cx2-tag" style={{ opacity: labelOpacity }}>
        <b>{frag.title}</b>
        <span>{frag.detail}</span>
      </motion.span>
    </motion.div>
  )
}

function ModuleChip({ i, progress }: { i: number; progress: MotionValue<number> }) {
  const { copy } = useLP()
  const Icon = MODULE_ICONS[i]
  const land = 0.12 + i * 0.05 + 0.32
  const lit = useTransform(progress, [land - 0.04, land + 0.02], [0, 1])
  return (
    <li className="sr-cx2-chip">
      <motion.span className="sr-cx2-chip-glow" style={{ opacity: lit }} />
      <span className="sr-cx2-chip-icon"><Icon size={18} aria-hidden="true" /></span>
      {copy.complexity.unifiedItems[i]}
    </li>
  )
}

function AppCardBody({ chips }: { chips: React.ReactNode }) {
  const { copy } = useLP()
  return (
    <>
      <div className="sr-cx2-card-head">
        <span className="sr-ch-dots"><i /><i /><i /></span>
        <b>Sweet Reservation</b>
        <span>· {copy.complexity.unified}</span>
      </div>
      <ul className="sr-cx2-chips">{chips}</ul>
    </>
  )
}

/** Cinematic card: grows in, each chip lights up as its tool lands. */
function AppCardLive({ progress }: { progress: MotionValue<number> }) {
  const { copy } = useLP()
  const scale = useTransform(progress, [0.05, 0.4], [0.86, 1])
  const opacity = useTransform(progress, [0.02, 0.2], [0.5, 1])
  return (
    <motion.div className="sr-cx2-card" style={{ scale, opacity }}>
      <AppCardBody chips={copy.complexity.unifiedItems.map((u, i) => <ModuleChip key={u} i={i} progress={progress} />)} />
    </motion.div>
  )
}

function AppCardStatic() {
  const { copy } = useLP()
  return (
    <div className="sr-cx2-card">
      <AppCardBody
        chips={copy.complexity.unifiedItems.map((u, i) => {
          const Icon = MODULE_ICONS[i]
          return (
            <li key={u} className="sr-cx2-chip sr-cx2-chip-on">
              <span className="sr-cx2-chip-icon"><Icon size={18} aria-hidden="true" /></span>
              {u}
            </li>
          )
        })}
      />
    </div>
  )
}

export function Complexity() {
  const { copy } = useLP()
  const cinematic = useCinematic()
  const track = useRef<HTMLDivElement>(null)
  const progress = useScrollProgress(track, ['start start', 'end end'])
  const rtl = copy.dir === 'rtl'
  return (
    <section className="sr-cx2" aria-labelledby="sr-cx-title">
      <div className="sr-container" style={{ paddingTop: 'clamp(88px, 12vw, 160px)' }}>
        <SectionHead eyebrow={copy.complexity.eyebrow} heading={copy.complexity.heading} sub={copy.complexity.sub} center id="sr-cx-title" />
      </div>

      {/* Cinematic: the old tools fly into the app card */}
      <div ref={track} className="sr-cx2-track">
        {cinematic && (
          <div className="sr-cx2-stage">
            <div className="sr-cx2-center">
              <AppCardLive progress={progress} />
              {TOOLS.map((t, i) => (
                <FlyingTool key={t} i={i} progress={progress} rtl={rtl} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Static composition: before → after */}
      <div className="sr-container sr-cx2-static">
        <ul className="sr-cx2-before">
          {copy.complexity.fragments.map((f, i) => (
            <li key={f.title}>
              <Clay name={TOOLS[i]} size={96} delay={i * 0.3} />
              <span>
                <b>{f.title}</b>
                <span>{f.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <AppCardStatic />
      </div>
    </section>
  )
}

// ── 2. Local advantage — a Moroccan clay still life with hotspots ──────────
const LOCAL_OBJECTS: ClayName[] = ['passport', 'coins', 'chat', 'forms', 'phone', 'bunk', 'tea']
// Positions around the zellige centrepiece (% of the scene box)
const LOCAL_POS: [number, number, number][] = [
  [20, 18, 150],
  [78, 14, 140],
  [90, 50, 120],
  [74, 84, 140],
  [36, 88, 96],
  [8, 62, 140],
  [50, 6, 96],
]

export function LocalAdvantage() {
  const { copy } = useLP()
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const [active, setActive] = useState(0)
  const [touched, setTouched] = useState(false)
  const n = copy.local.points.length

  // Tour the points while visible, until the visitor picks one.
  useEffect(() => {
    if (!inView || touched || reduced) return
    const id = window.setInterval(() => setActive((a) => (a + 1) % n), 3600)
    return () => window.clearInterval(id)
  }, [inView, touched, reduced, n])

  const pick = (i: number) => {
    setTouched(true)
    setActive(i)
  }
  const p = copy.local.points[active]

  return (
    <section className="sr-section sr-local2" aria-labelledby="sr-local-title">
      <div className="sr-container sr-local2-grid">
        <div className="sr-local2-copy">
          <SectionHead eyebrow={copy.local.eyebrow} heading={copy.local.heading} sub={copy.local.sub} id="sr-local-title" />
          <div className="sr-local2-detail" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <span className="sr-local2-n">{String(active + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
                <h3 className="sr-h3">{p.title}</h3>
                <p>{p.desc}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <ul className="sr-local2-list">
            {copy.local.points.map((pt, i) => (
              <li key={pt.title}>
                <button type="button" aria-pressed={i === active} onClick={() => pick(i)}>
                  {pt.title}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div ref={ref} className="sr-local2-scene" aria-hidden="true">
          <div className="sr-local2-disc" />
          <Clay name="zellige" size="34%" className="sr-local2-center" float={false} />
          {LOCAL_OBJECTS.map((o, i) => {
            const [x, y, s] = LOCAL_POS[i]
            return (
              <button
                key={o}
                type="button"
                tabIndex={-1}
                className="sr-local2-obj"
                data-active={i === active}
                style={{ left: `${x}%`, top: `${y}%`, width: `${s / 6.2}%` }}
                onClick={() => pick(i)}
              >
                <Clay name={o} size="100%" delay={i * 0.35} />
                <span className="sr-local2-pin">{copy.local.points[i].title}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── 3. Property types — clay buildings on a turntable ──────────────────────
const BUILDINGS: ClayName[] = ['hostel', 'riad', 'surf', 'guesthouse']
const TYPE_PHOTOS = ['/landing/hostel.jpg', '/landing/riad-suite.jpg', '/landing/surf.jpg', '/landing/guesthouse.jpg']

function supportsWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function PropertyTypes() {
  const { copy } = useLP()
  const reduced = useReducedMotion()
  const cinematic = useCinematic()
  const stage = useRef<HTMLDivElement>(null)
  const near = useInView(stage, { once: true, margin: '400px 0px' })
  const visible = useInView(stage)
  const [i, setI] = useState(0)
  const [ready, setReady] = useState(false)
  const [webgl, setWebgl] = useState(false)
  const t = copy.properties.types[i]

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability probe after mount
    setWebgl(supportsWebGL())
  }, [])
  const use3d = cinematic && webgl && near

  function onKey(e: React.KeyboardEvent, idx: number) {
    const count = copy.properties.types.length
    const rtl = copy.dir === 'rtl'
    let to = -1
    if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) to = (idx + 1) % count
    else if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) to = (idx - 1 + count) % count
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = count - 1
    if (to < 0) return
    e.preventDefault()
    setI(to)
    e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[to]?.focus()
  }

  return (
    <section id="solutions" className="sr-section sr-pt2" aria-labelledby="sr-types-title">
      <div className="sr-container">
        <SectionHead eyebrow={copy.properties.eyebrow} heading={copy.properties.heading} sub={copy.properties.sub} center id="sr-types-title" />
        <div role="tablist" aria-label={copy.properties.tablistLabel} className="sr-pt-tabs sr-pt2-tabs">
          {copy.properties.types.map((pt, idx) => (
            <button
              key={pt.label}
              type="button"
              role="tab"
              id={`sr-pt-tab-${idx}`}
              aria-selected={i === idx}
              aria-controls="sr-pt-panel"
              tabIndex={i === idx ? 0 : -1}
              className="sr-pt-tab"
              onClick={() => setI(idx)}
              onKeyDown={(e) => onKey(e, idx)}
            >
              {i === idx && <motion.span layoutId="sr-pt-bg" className="sr-pt-tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              {pt.label}
            </button>
          ))}
        </div>

        <div id="sr-pt-panel" role="tabpanel" aria-labelledby={`sr-pt-tab-${i}`} className="sr-pt2-grid">
          <div ref={stage} className="sr-pt2-stage">
            <div className="sr-pt2-disc" aria-hidden="true" />
            {/* Clay image (mobile, reduced motion, no WebGL, or until the models load) */}
            <div className="sr-pt2-img" data-hidden={use3d && ready} aria-hidden="true">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={i}
                  initial={reduced ? false : { opacity: 0, rotateY: -50, scale: 0.9 }}
                  animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, rotateY: 50, scale: 0.9 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  style={{ display: 'flex', justifyContent: 'center' }}
                >
                  <Clay name={BUILDINGS[i]} size="78%" />
                </motion.div>
              </AnimatePresence>
            </div>
            {use3d && (
              <motion.div
                className="sr-pt2-canvas"
                initial={{ opacity: 0 }}
                animate={{ opacity: ready ? 1 : 0 }}
                transition={{ duration: 0.8, ease: EASE }}
                aria-hidden="true"
              >
                <ClayTurntable active={i} running={visible} rtl={copy.dir === 'rtl'} onReady={() => setReady(true)} />
              </motion.div>
            )}
            {/* The real place, as a small photo card */}
            <div className="sr-pt2-photo">
              <AnimatePresence initial={false}>
                <motion.div
                  key={i}
                  initial={reduced ? false : { opacity: 0, scale: 1.08 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  style={{ position: 'absolute', inset: 0 }}
                >
                  <Image src={TYPE_PHOTOS[i]} alt={t.imageAlt} fill sizes="240px" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={i}
              initial={reduced ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="sr-pt2-copy"
            >
              <span className="sr-pt2-kicker">{t.label}</span>
              <h3 className="sr-h3" style={{ fontSize: 'clamp(26px, 2.8vw, 38px)' }}>{t.headline}</h3>
              <p className="sr-lead">{t.body}</p>
              <ul className="sr-points" style={{ gap: 14 }}>
                {t.features.map((f) => (
                  <li key={f} style={{ fontSize: 16 }}>{f}</li>
                ))}
              </ul>
              <div style={{ marginTop: 8 }}>
                <CTA href={START_HREF} arrow>{copy.hero.ctaPrimary}</CTA>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
