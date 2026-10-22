'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Landing-page shared primitives — language context, CTA destinations, motion
// helpers (masked reveals, magnetic buttons), logo and language switcher.
// Landing-only; styled by components/landing/landing.css (sr-*).
// ─────────────────────────────────────────────────────────────────────────────

import Image from 'next/image'
import Link from 'next/link'
import { Fragment, createContext, useContext, useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useMotionValueEvent, useScroll, useSpring, type MotionValue } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { BRAND, LANG_LABELS, LP_COPY, type LandingLang, type LPCopy } from './lp-i18n'

// Existing conversion routes — do not change.
export const START_HREF = '/register?plan=starter'
export const PRO_HREF = '/register?plan=pro'
export const SIGNIN_HREF = '/login'
export const CONTACT_WA = 'https://wa.me/212679760746'

export const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

// ── Language context ────────────────────────────────────────────────────────
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

// ── Cinematic mode — mirrors the CSS media query in landing.css ────────────
export const CINE_QUERY = '(min-width: 960px) and (prefers-reduced-motion: no-preference)'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}

export function useCinematic(): boolean {
  return useMediaQuery(CINE_QUERY)
}

/** Like framer's useReducedMotion, but false on the first render (matching
 *  the server) so SSR and hydration produce identical markup. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

// ── Scroll progress as a plain MotionValue ─────────────────────────────────
// framer-motion v12 may hand useScroll→useTransform opacity to a native
// ScrollTimeline, which mis-maps ranges on sticky tracks. Copying progress into
// an ordinary MotionValue keeps every scroll-linked style JS-driven and in
// lock-step with the WebGL scene.
type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>['offset']

export function useScrollProgress(target: React.RefObject<HTMLElement | null>, offset: ScrollOffset): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target, offset })
  const progress = useMotionValue(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => progress.set(v))
  return progress
}

// ── Reveal — fade/rise on first view, static under reduced motion ──────────
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  style,
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  className?: string
  style?: React.CSSProperties
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ── MaskText — words rise from behind a mask when scrolled into view ──────
export function MaskText({
  text,
  as = 'h2',
  className,
  style,
  delay = 0,
  id,
  accent = false,
}: {
  text: string
  accent?: boolean
  as?: 'h2' | 'h3' | 'p' | 'span'
  className?: string
  style?: React.CSSProperties
  delay?: number
  id?: string
}) {
  const reduced = useReducedMotion()
  const Tag = as
  // With `accent`, a two-sentence heading ("Simple pricing. Serious capability.")
  // sets its second sentence on its own line in the italic serif, like the hero.
  const cut = accent ? text.search(/[.!?]\s+\S/) : -1
  const lines = cut > 0 ? [text.slice(0, cut + 1), text.slice(cut + 1).trim()] : [text]
  let n = 0
  return (
    <Tag className={className} style={style} id={id}>
      <span className="sr-vh">{text}</span>
      <span aria-hidden="true">
        {lines.map((line, li) => {
          const words = line.split(' ')
          return (
            <span key={li} className={li > 0 ? 'sr-accent-line' : undefined}>
              {words.map((w, i) => {
                const k = n++
                return (
                  <Fragment key={`${w}-${i}`}>
                    <span className="sr-mask">
                      <motion.span
                        initial={reduced ? false : { y: '105%' }}
                        whileInView={{ y: '0%' }}
                        viewport={{ once: true, margin: '-60px' }}
                        transition={{ duration: 0.9, delay: delay + k * 0.045, ease: EASE }}
                      >
                        {w}
                      </motion.span>
                    </span>
                    {i < words.length - 1 ? ' ' : null}
                  </Fragment>
                )
              })}
            </span>
          )
        })}
      </span>
    </Tag>
  )
}

// ── Section head ───────────────────────────────────────────────────────────
export function SectionHead({
  eyebrow,
  heading,
  sub,
  center = false,
  id,
}: {
  eyebrow?: string
  heading: string
  sub?: string
  center?: boolean
  id?: string
}) {
  return (
    <div className={`sr-head${center ? ' sr-head-center' : ''}`}>
      {eyebrow && (
        <Reveal y={12}>
          <span className="sr-eyebrow">{eyebrow}</span>
        </Reveal>
      )}
      <MaskText text={heading} className="sr-h2" id={id} accent />
      {sub && (
        <Reveal delay={0.15}>
          <p className="sr-lead">{sub}</p>
        </Reveal>
      )}
    </div>
  )
}

// ── Magnetic — subtle pull toward the pointer (fine pointers only) ─────────
export function Magnetic({ children, strength = 0.22 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 })
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 })

  function onMove(e: React.PointerEvent<HTMLSpanElement>) {
    if (reduced || e.pointerType !== 'mouse') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  function onLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.span
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ display: 'inline-flex', x, y }}
    >
      {children}
    </motion.span>
  )
}

// ── CTA button (internal route or external link) ───────────────────────────
export function CTA({
  href,
  children,
  variant = 'primary',
  size,
  arrow = false,
  magnetic = true,
  className = '',
  style,
}: {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'ink' | 'ghost' | 'ghost-dark'
  size?: 'sm'
  arrow?: boolean
  magnetic?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const cls = `sr-btn sr-btn-${variant}${size ? ` sr-btn-${size}` : ''} ${className}`.trim()
  const inner = (
    <>
      {children}
      {arrow && (
        <span className="sr-btn-arrow" aria-hidden="true">
          <ArrowRight size={17} strokeWidth={2.2} />
        </span>
      )}
    </>
  )
  const el = href.startsWith('http') ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
      {inner}
    </a>
  ) : href.startsWith('#') ? (
    <a href={href} className={cls} style={style}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls} style={style}>
      {inner}
    </Link>
  )
  return magnetic ? <Magnetic>{el}</Magnetic> : el
}

// ── Logo — the real app icon + wordmark ────────────────────────────────────
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <Image src="/icon.png" alt="" width={30} height={30} style={{ borderRadius: 8, flexShrink: 0 }} />
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          color: dark ? 'var(--sr-bg)' : 'var(--sr-ink)',
          whiteSpace: 'nowrap',
        }}
      >
        {BRAND}
      </span>
    </span>
  )
}

// ── Language switcher ──────────────────────────────────────────────────────
export function LangSwitcher({ dark = false }: { dark?: boolean }) {
  const { lang, setLang, copy } = useLP()
  const langs: LandingLang[] = ['fr', 'en', 'ar']
  return (
    <div role="group" aria-label={copy.nav.langLabel} className={`sr-lang${dark ? ' sr-lang-dark' : ''}`}>
      {langs.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          aria-label={LANG_LABELS[l]}
          lang={l}
        >
          {l === 'ar' ? 'ع' : l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
