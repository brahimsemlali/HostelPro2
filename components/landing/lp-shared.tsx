'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Landing-page shared primitives — theme tokens, language context, motion.
// Apple-minimal skin matching the app's design system (teal on white, soft
// shadows, hairlines). Everything here is landing-only.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useInView, useReducedMotion } from 'framer-motion'
import { LP_COPY, type LandingLang, type LPCopy } from './lp-i18n'

// ── Palette — the app's Apple-minimal teal system ───────────────────────────
export const T = {
  ink: '#0A1F1C',                    // near-black teal — headings
  body: '#3F4E49',
  muted: '#5F6F6A',
  faint: '#8C9B96',
  teal: '#0F6E56',                   // primary (dark)
  mint: '#16a37d',                   // primary (light)
  tealDeep: '#0A4B3C',
  // Dark sections use the deep-teal gradient family instead of navy
  navy: '#0B3D30',
  navyDeep: '#073226',
  ivory: '#F5F5F7',                  // Apple light gray — section wash
  bluegray: '#EEF1F0',
  emerald: '#16a37d',
  emeraldDeep: '#0F6E56',
  terracotta: '#D97706',             // warm amber, used very sparingly
  line: '#E5E9E7',
  lineCard: '#E9EDEB',
  card: '#FFFFFF',
  emeraldTint: 'rgba(15,110,86,0.08)',
  navyOnDark: 'rgba(255,255,255,0.72)',
}

export const emeraldGrad = `linear-gradient(135deg, ${T.mint} 0%, ${T.teal} 100%)`
export const darkGrad = `linear-gradient(150deg, #10745B 0%, ${T.tealDeep} 55%, #073226 100%)`

export const shadowCard = '0 1px 2px rgba(10,31,28,0.04), 0 12px 36px rgba(10,31,28,0.06)'
export const shadowLift = '0 2px 6px rgba(10,31,28,0.05), 0 24px 56px rgba(10,31,28,0.10)'

// ── Language context (landing-local; supports 'ar' unlike the app i18n) ────
interface LPLangValue {
  lang: LandingLang
  setLang: (l: LandingLang) => void
  copy: LPCopy
}

export const LPLangContext = createContext<LPLangValue>({
  lang: 'fr',
  setLang: () => {},
  copy: LP_COPY.fr,
})

export function useLP(): LPLangValue {
  return useContext(LPLangContext)
}

// ── Reveal — scroll-in animation that respects prefers-reduced-motion ──────
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  style,
  as = 'div',
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  className?: string
  style?: React.CSSProperties
  as?: 'div' | 'li' | 'span'
}) {
  const reduced = useReducedMotion()
  const Comp = as === 'li' ? motion.li : as === 'span' ? motion.span : motion.div
  return (
    <Comp
      initial={reduced ? { opacity: 1 } : { opacity: 0, y, filter: 'blur(5px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className={className}
      style={style}
    >
      {children}
    </Comp>
  )
}

// ── 3D tilt wrapper for the hero product shot ──────────────────────────────
export function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotX = useSpring(useTransform(y, [-0.5, 0.5], [4.5, -4.5]), { stiffness: 150, damping: 20 })
  const rotY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 150, damping: 20 })

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    x.set((e.clientX - r.left) / r.width - 0.5)
    y.set((e.clientY - r.top) / r.height - 0.5)
  }
  function onLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={reduced ? undefined : { rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d', perspective: 1200 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Soft atmospheric glow ───────────────────────────────────────────────────
export function Glow({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(22,163,125,0.14) 0%, transparent 65%)',
        filter: 'blur(20px)',
        ...style,
      }}
    />
  )
}

// ── Section scaffolding ─────────────────────────────────────────────────────
export function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className="lm-eyebrow"
      style={{
        color: dark ? '#9FE8D2' : T.teal,
        background: dark ? 'rgba(255,255,255,0.10)' : T.emeraldTint,
        border: `1px solid ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(15,110,86,0.16)'}`,
      }}
    >
      {children}
    </span>
  )
}

export function SectionHead({
  eyebrow,
  heading,
  sub,
  dark = false,
  align = 'center',
  id,
}: {
  eyebrow?: string
  heading: string
  sub?: string
  dark?: boolean
  align?: 'center' | 'start'
  id?: string
}) {
  return (
    <Reveal
      className="lm-section-head"
      style={{ textAlign: align === 'center' ? 'center' : 'start', alignItems: align === 'center' ? 'center' : 'flex-start' }}
    >
      {eyebrow && <Eyebrow dark={dark}>{eyebrow}</Eyebrow>}
      <h2 id={id} className="lm-h2" style={{ color: dark ? '#fff' : T.ink }}>
        {heading}
      </h2>
      {sub && (
        <p className="lm-sub" style={{ color: dark ? T.navyOnDark : T.muted }}>
          {sub}
        </p>
      )}
    </Reveal>
  )
}

// ── Zellige — subtle eight-point-star pattern (Moroccan geometric detail) ──
export function ZelligePattern({
  color = T.teal,
  opacity = 0.04,
  className,
  style,
  id = 'lm-zellige',
}: {
  color?: string
  opacity?: number
  className?: string
  style?: React.CSSProperties
  id?: string
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', pointerEvents: 'none', ...style }}
      width="100%"
      height="100%"
    >
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <path
            d="M28 8 L33 23 L48 28 L33 33 L28 48 L23 33 L8 28 L23 23 Z"
            fill="none"
            stroke={color}
            strokeWidth="1"
            opacity={opacity}
          />
          <circle cx="28" cy="28" r="2.5" fill={color} opacity={opacity * 0.8} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

export function useOnceInView(margin = '-60px') {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: margin as never })
  return { ref, inView }
}

// ── Icons ───────────────────────────────────────────────────────────────────
export function CheckIcon({ size = 12, color = '#fff', strokeWidth = 3 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function ArrowIcon({ size = 16, flip = false }: { size?: number; flip?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}
