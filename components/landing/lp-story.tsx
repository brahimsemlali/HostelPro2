'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Product tour — the real dashboard (demo data) on a laptop whose lid opens as
// the section scrolls in, with live notifications around it.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import {
  CalendarDays,
  FileText,
  Wallet,
} from 'lucide-react'
import { Reveal, SectionHead, useLP, useScrollProgress, useReducedMotion } from './lp-shared'
import { Dashboard, type DashView } from './lp-ui'

// ── Keyboard support for tablists (roving focus, arrows/Home/End) ──────────
function onTabKey(e: React.KeyboardEvent, index: number, count: number, select: (i: number) => void, vertical = false) {
  const rtl = (e.currentTarget as HTMLElement).closest('[dir]')?.getAttribute('dir') === 'rtl'
  const next = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight'
  const prev = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft'
  let to = -1
  if (e.key === next) to = (index + 1) % count
  else if (e.key === prev) to = (index - 1 + count) % count
  else if (e.key === 'Home') to = 0
  else if (e.key === 'End') to = count - 1
  if (to < 0) return
  e.preventDefault()
  select(to)
  const list = (e.currentTarget as HTMLElement).parentElement
  const target = list?.querySelectorAll<HTMLElement>('[role="tab"]')[to]
  target?.focus()
}

// ── 2. Product showcase ────────────────────────────────────────────────────
// Notifications that pop around the dashboard, as they would in the app.
const TOAST_ICONS = [CalendarDays, Wallet, FileText]

function LiveToasts() {
  const { copy } = useLP()
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.3 })
  return (
    <div ref={ref} className="sr-toasts" aria-hidden="true">
      {copy.showcase.toasts.map((t, i) => {
        const Icon = TOAST_ICONS[i]
        return (
          <motion.div
            key={t.title}
            className={`sr-toast sr-toast-${i}`}
            initial={reduced ? false : { opacity: 0, scale: 0.86, y: 24 }}
            animate={seen ? { opacity: 1, scale: 1, y: 0 } : undefined}
            transition={{ delay: 0.5 + i * 0.7, type: 'spring', stiffness: 260, damping: 20 }}
          >
            <motion.div
              className="sr-toast-inner"
              animate={reduced ? undefined : { y: [0, -7, 0] }}
              transition={{ duration: 5 + i * 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
            >
              <span className="sr-toast-icon"><Icon size={16} /></span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <b>{t.title}</b>
                <span>{t.sub}</span>
              </span>
              <span className="sr-toast-time">{copy.showcase.now}</span>
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}

export function Showcase() {
  const { copy } = useLP()
  const reduced = useReducedMotion()
  const [view, setView] = useState<DashView>(0)
  const [touched, setTouched] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const scrollYProgress = useScrollProgress(ref, ['start end', 'center center'])
  // The lid opens from nearly closed to upright as the laptop scrolls in.
  const lid = useTransform(scrollYProgress, [0.05, 0.85], [reduced ? 0 : -78, 0])
  const scale = useTransform(scrollYProgress, [0, 0.85], [reduced ? 1 : 0.88, 1])
  const y = useTransform(scrollYProgress, [0, 0.85], [reduced ? 0 : 80, 0])

  // Progressive UI states: cycle the preview while visible, until the visitor
  // takes control. Never under reduced motion.
  useEffect(() => {
    if (!inView || touched || reduced) return
    const id = window.setInterval(() => setView((v) => ((v + 1) % 3) as DashView), 4200)
    return () => window.clearInterval(id)
  }, [inView, touched, reduced])

  const select = (i: number) => {
    setTouched(true)
    setView(i as DashView)
  }

  // Pointer tilt + glare (fine pointers only, never under reduced motion)
  const tiltX = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 })
  const tiltY = useSpring(useMotionValue(0), { stiffness: 150, damping: 18 })
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== 'mouse') return
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    tiltY.set(nx * 7)
    tiltX.set(-ny * 5)
    el.style.setProperty('--gx', `${(nx + 0.5) * 100}%`)
    el.style.setProperty('--gy', `${(ny + 0.5) * 100}%`)
  }
  const onLeave = () => {
    tiltX.set(0)
    tiltY.set(0)
  }

  return (
    <section id="tour" className="sr-section" aria-labelledby="sr-tour-title" style={{ background: 'var(--sr-bg)' }}>
      <div className="sr-container">
        <SectionHead eyebrow={copy.showcase.eyebrow} heading={copy.showcase.heading} sub={copy.showcase.sub} center id="sr-tour-title" />
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div role="tablist" aria-label={copy.showcase.statesLabel} className="sr-seg">
              {copy.showcase.states.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  id={`sr-show-tab-${i}`}
                  aria-selected={view === i}
                  aria-controls="sr-show-panel"
                  tabIndex={view === i ? 0 : -1}
                  onClick={() => select(i)}
                  onKeyDown={(e) => onTabKey(e, i, 3, select)}
                >
                  {view === i && <motion.span layoutId="sr-seg-pill" className="sr-seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
        <div ref={ref} className="sr-showcase-wrap" onPointerMove={onMove} onPointerLeave={onLeave}>
          <motion.div className="sr-laptop" style={{ scale, y, rotateX: tiltX, rotateY: tiltY }}>
            <motion.div
              id="sr-show-panel"
              role="tabpanel"
              aria-labelledby={`sr-show-tab-${view}`}
              className="sr-laptop-lid"
              style={{ rotateX: lid }}
            >
              <div className="sr-laptop-screen">
                <span className="sr-laptop-cam" aria-hidden="true" />
                <Dashboard view={view} />
                <div className="sr-glare" aria-hidden="true" />
              </div>
            </motion.div>
            <div className="sr-laptop-base" aria-hidden="true">
              <span />
            </div>
          </motion.div>
          <LiveToasts />
        </div>
      </div>
    </section>
  )
}
