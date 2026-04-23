'use client'

import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  AnimatePresence,
  animate,
  useInView,
  type Variants,
} from 'framer-motion'
import { useT } from '@/app/context/LanguageContext'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

type BedState = 'O' | 'A' | 'D' | '_' | 'new'

const INITIAL_BED_STATES: BedState[] = [
  'O','O','_','O','O','A','_','O',
  'O','D','O','_','O','O','O','A',
  '_','O','O','D','_','O','O','O',
]

const BED_LABELS = [
  'A1','A2','A3','A4','A5','A6','A7','A8',
  'B1','B2','B3','B4','B5','B6','B7','B8',
  'C1','C2','C3','C4','C5','C6','C7','C8',
]

function bedColors(s: BedState) {
  if (s === 'O' || s === 'new') return { bg: '#21C77A', text: '#fff', border: '#1AAE6A' }
  if (s === 'A') return { bg: '#0F6B41', text: '#fff', border: '#0A5032' }
  if (s === 'D') return { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' }
  return { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.2)', border: 'rgba(255,255,255,0.1)' }
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(8px)' },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.8, delay: i * 0.13, ease: [0.25, 0.4, 0.25, 1] },
  }),
}

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
}

// ── Animated counter on scroll ─────────────────────────────────────────────
function Counter({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  useEffect(() => {
    if (!inView) return
    const ctrl = animate(0, to, {
      duration: 2.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    })
    return ctrl.stop
  }, [inView, to])
  return <span ref={ref}>{prefix}{val.toLocaleString('fr-MA')}{suffix}</span>
}

// ── Hero background shape ──────────────────────────────────────────────────
function HeroShape({ className, w, h, rotate, color, delay }: {
  className: string; w: number; h: number; rotate: number; color: string; delay: number
}) {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      initial={{ opacity: 0, y: -120, rotate: rotate - 12 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ duration: 2.6, delay, ease: [0.23, 0.86, 0.39, 0.96] }}
    >
      <motion.div
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 11 + delay * 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: w, height: h }}
      >
        <div style={{
          width: '100%', height: '100%', borderRadius: 999,
          background: `radial-gradient(ellipse, ${color} 0%, transparent 65%)`,
          border: '1.5px solid rgba(33,199,122,0.18)',
        }} />
      </motion.div>
    </motion.div>
  )
}

// ── 3D tilt card (for dashboard mock) ────────────────────────────────────
function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 150, damping: 20 })
  const rotY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 150, damping: 20 })

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    x.set((e.clientX - r.left) / r.width - 0.5)
    y.set((e.clientY - r.top) / r.height - 0.5)
  }
  function onLeave() { x.set(0); y.set(0) }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d', perspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ── Bento feature card shell ───────────────────────────────────────────────
function BentoCard({ children, className, delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] }}
      whileHover={{ y: -4, scale: 1.01, transition: { type: 'spring', stiffness: 300, damping: 22 } }}
      className={`relative overflow-hidden rounded-[20px] border border-[#E8EDEF] bg-white ${className ?? ''}`}
      style={{ boxShadow: '0 2px 20px rgba(14,26,31,0.05)' }}
    >
      {children}
    </motion.div>
  )
}

// ── Live bed map card ──────────────────────────────────────────────────────
function BedMapCard() {
  const [beds, setBeds] = useState<BedState[]>([...INITIAL_BED_STATES])
  const animating = useRef<Set<number>>(new Set())

  useEffect(() => {
    const id = setInterval(() => {
      setBeds((prev) => {
        const candidates = prev
          .map((s, i) => ({ s, i }))
          .filter(({ s, i }) => s !== 'O' && s !== 'A' && s !== 'new' && !animating.current.has(i))
          .map(({ i }) => i)
        if (!candidates.length) return prev
        const idx = candidates[Math.floor(Math.random() * candidates.length)]
        animating.current.add(idx)
        const next = [...prev] as BedState[]
        next[idx] = 'new'
        setTimeout(() => {
          setBeds((cur) => {
            const u = [...cur] as BedState[]
            u[idx] = 'O'
            animating.current.delete(idx)
            return u
          })
        }, 600)
        return next
      })
    }, 3500)
    return () => clearInterval(id)
  }, [])

  return (
    <BentoCard className="p-5 col-span-2 row-span-2" delay={0}>
      <div className="mb-3 flex items-center gap-2">
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#21C77A' }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5C6B72' }}>
          Live Bed Map
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#21C77A', background: '#E2F4EA', padding: '2px 8px', borderRadius: 999 }}>
          17/24 occupied
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5 }}>
        {beds.map((s, i) => {
          const c = bedColors(s)
          return (
            <motion.div
              key={i}
              animate={s === 'new' ? { scale: [0.85, 1.08, 1], backgroundColor: ['#21C77A', '#21C77A'] } : { scale: 1 }}
              transition={{ duration: 0.5 }}
              style={{
                aspectRatio: '1',
                borderRadius: 6,
                background: c.bg,
                color: c.text,
                border: `1.5px solid ${c.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 700,
              }}
            >
              {BED_LABELS[i].slice(0, 2)}
            </motion.div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        {[
          { color: '#21C77A', label: 'Occupied' },
          { color: '#0F6B41', label: 'Arriving' },
          { color: '#FCD34D', label: 'Dirty' },
          { color: '#E8EDEF', label: 'Available', border: '#C0CBCE' },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#5C6B72' }}>
            <div style={{ width: 9, height: 9, borderRadius: 3, background: l.color, border: l.border ? `1px solid ${l.border}` : undefined }} />
            {l.label}
          </div>
        ))}
      </div>
    </BentoCard>
  )
}

// ── Revenue card ───────────────────────────────────────────────────────────
function RevenueCard() {
  const bars = [40, 55, 35, 70, 60, 88, 100]
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  return (
    <BentoCard className="p-5 col-span-2" delay={0.1} >
      <div ref={ref}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5C6B72', marginBottom: 4 }}>
          Revenue — 7 days
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0E1A1F', letterSpacing: '-0.03em', marginBottom: 14 }}>
          38 450 MAD <span style={{ fontSize: 12, fontWeight: 600, color: '#21C77A', background: '#E2F4EA', padding: '2px 8px', borderRadius: 999 }}>+18%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 56 }}>
          {bars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              style={{
                flex: 1,
                height: `${h}%`,
                borderRadius: '3px 3px 0 0',
                background: i === 6 ? '#21C77A' : '#C9EBD7',
                transformOrigin: 'bottom',
              }}
            />
          ))}
        </div>
      </div>
    </BentoCard>
  )
}

// ── WhatsApp card ──────────────────────────────────────────────────────────
function WhatsAppCard() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const msgs = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 1800),
      setTimeout(() => setStep(3), 3000),
    ]
    return () => msgs.forEach(clearTimeout)
  }, [])

  const bubbles = [
    { from: 'recv', text: "Bonjour! C'est quoi le code WiFi?", time: '14:03' },
    { from: 'sent', text: 'Bienvenue Youssef! 🏠 WiFi: AtlasGuest2024\nCheckout: 25/04 avant 11h00 😊', time: '14:03 ✓✓' },
    { from: 'recv', text: 'Merci! 🙏', time: '14:04' },
  ]

  return (
    <BentoCard className="p-4 row-span-2" delay={0.2}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5C6B72', marginBottom: 10 }}>
        WhatsApp Hub
      </div>
      <div style={{ background: '#ECE5DD', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#21C77A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>Y</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0E1A1F' }}>Youssef Benali</div>
            <div style={{ fontSize: 10, color: '#00a884' }}>online</div>
          </div>
        </div>
        {bubbles.map((b, i) => (
          <AnimatePresence key={i}>
            {step > i && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                style={{
                  alignSelf: b.from === 'sent' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: b.from === 'sent' ? '#DCF8C6' : '#fff',
                  borderRadius: b.from === 'sent' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  padding: '8px 11px',
                  fontSize: 11.5,
                  lineHeight: 1.55,
                  color: '#0E1A1F',
                  whiteSpace: 'pre-line',
                }}
              >
                {b.text}
                <div style={{ fontSize: 9, color: '#8593A0', textAlign: 'right', marginTop: 2 }}>{b.time}</div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </BentoCard>
  )
}

// ── Check-in speed card ────────────────────────────────────────────────────
function CheckInCard() {
  const steps = ['Guest info', 'Bed select', 'Payment', 'Done ✓']
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setActive((p) => (p + 1) % 4), 1200)
    return () => clearInterval(id)
  }, [])

  return (
    <BentoCard className="p-5" delay={0.15}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5C6B72', marginBottom: 12 }}>
        Check-in
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0E1A1F', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 4 }}>
        60s
      </div>
      <div style={{ fontSize: 11, color: '#5C6B72', marginBottom: 14 }}>Average check-in time</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
              animate={{ background: i <= active ? '#21C77A' : '#E8EDEF', scale: i === active ? 1.15 : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              {i < active && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </motion.div>
            <motion.span
              animate={{ color: i <= active ? '#0E1A1F' : '#8593A0', fontWeight: i === active ? 600 : 400 }}
              style={{ fontSize: 12 }}
            >
              {s}
            </motion.span>
          </div>
        ))}
      </div>
    </BentoCard>
  )
}

// ── Police PDF card ────────────────────────────────────────────────────────
function PDFCard() {
  const [generated, setGenerated] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setGenerated((p) => !p), 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <BentoCard className="p-5" delay={0.25}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5C6B72', marginBottom: 12 }}>
        Police Form
      </div>
      <AnimatePresence mode="wait">
        {generated ? (
          <motion.div
            key="done"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
          >
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E2F4EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#21C77A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F6B41' }}>PDF Generated!</div>
            <div style={{ fontSize: 10, color: '#8593A0' }}>fiche-police-benali.pdf</div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
          >
            <div style={{ background: '#F1F9F4', borderRadius: 8, padding: '8px 10px', border: '1px solid #E2F4EA' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 20, height: 24, background: '#0F6B41', borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>PDF</span>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#0E1A1F' }}>FICHE DE POLICE</div>
                  <div style={{ fontSize: 9, color: '#8593A0' }}>1 click generation</div>
                </div>
              </div>
            </div>
            <motion.div
              animate={{ width: ['0%', '100%'] }}
              transition={{ duration: 2.3, ease: 'easeInOut', repeat: Infinity }}
              style={{ height: 3, background: 'linear-gradient(90deg, #21C77A, #0F6B41)', borderRadius: 999 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </BentoCard>
  )
}

// ── Main landing page ─────────────────────────────────────────────────────
export default function LandingPage() {
  const t = useT()
  const [annual, setAnnual] = useState(false)
  const { scrollY } = useScroll()
  const navBg = useTransform(scrollY, [0, 80], ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.88)'])
  const navShadow = useTransform(scrollY, [0, 80], ['0 0 0 rgba(14,26,31,0)', '0 2px 24px rgba(14,26,31,0.08)'])

  const HERO_WORDS = ['Every', 'bed', 'booked.', 'Every', 'guest', 'happy.', 'Every', 'night', 'effortless.']

  return (
    <div className={jakarta.className} style={{ background: '#fff', color: '#0E1A1F', overflowX: 'hidden' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <motion.nav
        style={{
          position: 'fixed', top: 18, left: '50%', x: '-50%', zIndex: 100,
          display: 'flex', alignItems: 'center', gap: 28,
          padding: '10px 18px 10px 14px',
          borderRadius: 999,
          background: navBg,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(232,237,239,0.9)',
          boxShadow: navShadow,
          whiteSpace: 'nowrap',
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <div style={{ width: 30, height: 30, background: '#21C77A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5C3 6 4.5 4 8 4C11.5 4 13 6 13 8.5C13 11 11 13 8 13C5 13 3 11 3 8.5Z" fill="white" opacity="0.9"/>
              <rect x="6" y="3" width="4" height="2" rx="1" fill="white"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0E1A1F', letterSpacing: '-0.3px' }}>HostelPro</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {['Features', 'Pricing'].map((l) => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 13.5, fontWeight: 500, color: '#5C6B72', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <Link href="/login" style={{ fontSize: 13.5, fontWeight: 500, color: '#5C6B72', textDecoration: 'none', padding: '7px 14px', borderRadius: 999 }}>
            Sign in
          </Link>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link href="/register" style={{
              fontSize: 13.5, fontWeight: 600, color: '#fff', textDecoration: 'none',
              padding: '8px 18px', borderRadius: 999, background: '#21C77A',
              boxShadow: '0 2px 12px rgba(33,199,122,0.4)', display: 'block',
            }}>
              Start free
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px',
        textAlign: 'center', overflow: 'hidden',
        background: 'linear-gradient(180deg, #030f0b 0%, #0a1f1c 40%, #0d2b26 70%, #0E1A1F 100%)',
      }}>
        {/* Grid dot pattern */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'radial-gradient(rgba(33,199,122,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 100%)',
        }} />

        {/* Glowing orbs */}
        <HeroShape className="left-[-8%] top-[22%]" w={580} h={140} rotate={10} color="rgba(33,199,122,0.18)" delay={0.3} />
        <HeroShape className="right-[-4%] top-[60%]" w={460} h={110} rotate={-14} color="rgba(15,107,65,0.22)" delay={0.5} />
        <HeroShape className="left-[8%] bottom-[8%]" w={300} h={80} rotate={-6} color="rgba(33,199,122,0.12)" delay={0.4} />
        <HeroShape className="right-[18%] top-[8%]" w={200} h={55} rotate={18} color="rgba(33,199,122,0.15)" delay={0.65} />

        {/* Centre glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 600, height: 300, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(33,199,122,0.12) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* H1 — word by word */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 24, maxWidth: 820 }}>
          <h1 style={{
            fontSize: 'clamp(38px, 6vw, 68px)', fontWeight: 800, lineHeight: 1.05,
            letterSpacing: '-0.035em',
          }}>
            {HERO_WORDS.map((word, i) => (
              <motion.span
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                style={{
                  display: 'inline-block',
                  marginRight: word === 'booked.' || word === 'happy.' || word === 'effortless.' ? '0' : '0.28em',
                  color: word === 'booked.' || word === 'happy.' || word === 'effortless.' ? '#21C77A' : 'rgba(255,255,255,0.92)',
                }}
              >
                {word}{(word === 'booked.' || word === 'happy.') ? ' ' : ''}
              </motion.span>
            ))}
          </h1>
        </div>

        {/* Subtitle */}
        <motion.p
          custom={10} variants={fadeUp} initial="hidden" animate="visible"
          style={{ position: 'relative', zIndex: 1, fontSize: 17, lineHeight: 1.65, color: 'rgba(255,255,255,0.45)', maxWidth: 560, marginBottom: 40 }}
        >
          Beds, guests, payments, police declarations, WhatsApp — one calm command center for hostels, riads and guesthouses across Morocco.
        </motion.p>

        {/* CTA */}
        <motion.div
          custom={12} variants={fadeUp} initial="hidden" animate="visible"
          style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 64 }}
        >
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link href="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none',
              padding: '14px 28px', borderRadius: 14, background: '#21C77A',
              boxShadow: '0 6px 30px rgba(33,199,122,0.45), 0 0 0 1px rgba(33,199,122,0.3)',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              Start 14-day free trial
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <a href="#features" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
              padding: '14px 24px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(8px)',
            }}>
              See how it works
            </a>
          </motion.div>
        </motion.div>

        {/* Dashboard mock */}
        <motion.div
          initial={{ opacity: 0, y: 60, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, delay: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
          style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 900 }}
        >
          <TiltCard>
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(33,199,122,0.2)',
              background: '#0a1a15',
            }}>
              {/* Chrome bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#FF5F57','#FEBC2E','#28C840'].map((c) => (
                    <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '2px 14px' }}>
                    hostelpro.ma/dashboard
                  </div>
                </div>
              </div>
              {/* Body */}
              <div style={{ display: 'flex', height: 380 }}>
                {/* Sidebar */}
                <div style={{ width: 200, background: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: '#21C77A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8.5C3 6 4.5 4 8 4C11.5 4 13 6 13 8.5C13 11 11 13 8 13C5 13 3 11 3 8.5Z" fill="white" opacity="0.9"/>
                        <rect x="6" y="3" width="4" height="2" rx="1" fill="white"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.2px' }}>HostelPro</span>
                  </div>
                  {[
                    { icon: '🏠', label: t('nav.dashboard'), active: true },
                    { icon: '🛏', label: 'Beds', active: false },
                    { icon: '👤', label: 'Guests', active: false },
                    { icon: '💰', label: 'Payments', active: false },
                    { icon: '📊', label: 'Reports', active: false },
                    { icon: '💬', label: 'WhatsApp', active: false },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 9px', borderRadius: 8,
                        fontSize: 12, fontWeight: item.active ? 600 : 400,
                        background: item.active ? 'rgba(33,199,122,0.15)' : 'transparent',
                        color: item.active ? '#21C77A' : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{item.icon}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
                {/* Main */}
                <div style={{ flex: 1, padding: '18px 18px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Tableau de bord</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
                    {[
                      { label: "Occupancy", val: '17/24', sub: '70%', delay: '0s', color: '#21C77A' },
                      { label: "Revenue", val: '4 320 MAD', sub: '+12%', delay: '0.08s', color: '#5DCAA5' },
                      { label: 'Check-ins', val: '3', sub: 'pending', delay: '0.16s', color: 'rgba(255,255,255,0.7)' },
                      { label: 'Check-outs', val: '2', sub: 'before 11h', delay: '0.24s', color: '#FCD34D' },
                    ].map((c) => (
                      <motion.div
                        key={c.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 + parseFloat(c.delay), duration: 0.4 }}
                        style={{
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 10, padding: '10px 12px',
                        }}
                      >
                        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.val}</div>
                        <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.2)', marginTop: 3 }}>{c.sub}</div>
                      </motion.div>
                    ))}
                  </div>
                  {/* Mini charts */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, flex: 1 }}>
                    {/* Bar chart */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Revenue 7 days</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 52 }}>
                        {[40, 55, 35, 70, 60, 85, 100].map((h, i) => (
                          <motion.div
                            key={i}
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: 1 + i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                              flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0',
                              background: i === 6 ? '#21C77A' : 'rgba(33,199,122,0.25)',
                              transformOrigin: 'bottom',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Line chart */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Occupancy rate</div>
                      <svg style={{ flex: 1 }} viewBox="0 0 200 60" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="dg1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#21C77A" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="#21C77A" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d="M0,50 C20,44 30,26 50,30 C70,34 80,16 100,14 C120,12 130,24 150,18 C170,12 180,7 200,5 L200,60 L0,60 Z" fill="url(#dg1)"/>
                        <path d="M0,50 C20,44 30,26 50,30 C70,34 80,16 100,14 C120,12 130,24 150,18 C170,12 180,7 200,5" fill="none" stroke="#21C77A" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    {/* Activity */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Activity</div>
                      {[
                        { icon: '✅', text: 'Check-in · Karim B.', time: '14:32' },
                        { icon: '💰', text: 'Payment · 650 MAD', time: '14:10' },
                        { icon: '🛏', text: 'Bed A3 marked clean', time: '13:55' },
                      ].map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 10 }}>{a.icon}</span>
                          <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', flex: 1 }}>{a.text}</span>
                          <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.2)' }}>{a.time}</span>
                        </div>
                      ))}
                    </div>
                    {/* Donut */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Sources</div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="46" height="46" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"/>
                          <circle cx="32" cy="32" r="24" fill="none" stroke="#21C77A" strokeWidth="10" strokeDasharray="75.4 75.4" strokeDashoffset="-56.5" strokeLinecap="round" transform="rotate(-90 32 32)"/>
                          <circle cx="32" cy="32" r="24" fill="none" stroke="#0F6B41" strokeWidth="10" strokeDasharray="37.7 113.1" strokeDashoffset="-131.9" strokeLinecap="round" transform="rotate(-90 32 32)"/>
                        </svg>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {[{ c: '#21C77A', l: 'Direct 40%' }, { c: '#0F6B41', l: 'Bk.com 20%' }].map((d) => (
                            <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9 }}>
                              <div style={{ width: 7, height: 7, borderRadius: 2, background: d.c }} />
                              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{d.l}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TiltCard>
        </motion.div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={staggerContainer}
          style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}
        >
          {[
            { val: 200, suffix: '+', label: 'Properties in Morocco' },
            { val: 15000, suffix: '+', label: 'Check-ins processed' },
            { val: 3, prefix: '< ', suffix: 's', label: 'Avg API response' },
            { val: 98, suffix: '%', label: 'Uptime SLA' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              custom={i}
              style={{ textAlign: 'center', padding: '24px 20px', borderRight: i < 3 ? '1px solid #E8EDEF' : undefined }}
            >
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', color: '#0E1A1F', lineHeight: 1, marginBottom: 8 }}>
                <Counter to={s.val} suffix={s.suffix} prefix={s.prefix} />
              </div>
              <div style={{ fontSize: 13, color: '#8593A0', fontWeight: 500 }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Features bento ───────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '100px 24px', background: '#F9FBFA' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
            style={{ textAlign: 'center', marginBottom: 64 }}
          >
            <motion.span variants={fadeUp} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '5px 14px', borderRadius: 999,
              background: 'linear-gradient(90deg, rgba(33,199,122,0.15), rgba(26,174,106,0.08))',
              color: '#0F6B41', marginBottom: 16,
            }}>
              Everything you need
            </motion.span>
            <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#0E1A1F', marginBottom: 16, lineHeight: 1.1 }}>
              One app. Zero paper.
            </motion.h2>
            <motion.p variants={fadeUp} style={{ fontSize: 16, color: '#5C6B72', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
              From check-in to police report, payments to WhatsApp — all in one calm interface built for Moroccan hospitality.
            </motion.p>
          </motion.div>

          {/* Bento grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'auto auto', gap: 16, gridAutoRows: 'minmax(180px, auto)' }}>
            {/* Large: bed map 2x2 */}
            <BedMapCard />

            {/* Revenue 2x1 */}
            <RevenueCard />

            {/* WhatsApp 1x2 */}
            <WhatsAppCard />

            {/* Check-in 1x1 */}
            <CheckInCard />

            {/* PDF 1x1 */}
            <PDFCard />

            {/* Night audit card */}
            <BentoCard className="p-5" delay={0.3}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5C6B72', marginBottom: 12 }}>
                Night Audit
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Cash in drawer', val: '3 640 MAD', done: true },
                  { label: 'Expected', val: '3 640 MAD', done: true },
                  { label: 'Difference', val: '0 MAD ✓', done: true },
                  { label: 'Police report', val: 'Generated', done: true },
                ].map((r, i) => (
                  <motion.div
                    key={r.label}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}
                  >
                    <span style={{ color: '#8593A0' }}>{r.label}</span>
                    <span style={{ fontWeight: 600, color: '#0F6B41' }}>{r.val}</span>
                  </motion.div>
                ))}
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── Audience ─────────────────────────────────────────────────────── */}
      <section id="audience" style={{ padding: '100px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
            style={{ textAlign: 'center', marginBottom: 56 }}
          >
            <motion.span variants={fadeUp} style={{
              display: 'inline-flex', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '5px 14px', borderRadius: 999,
              background: 'rgba(33,199,122,0.1)', color: '#0F6B41', marginBottom: 16,
            }}>
              Who it&apos;s for
            </motion.span>
            <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#0E1A1F', lineHeight: 1.1 }}>
              Built for every kind of Moroccan host
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}
          >
            {[
              { icon: '🏨', title: 'Hostels & backpackers', desc: 'Manage dorm beds, shared facilities, and high guest turnover with ease. Built for the pace of budget hospitality.' },
              { icon: '🏡', title: 'Riads & guesthouses', desc: 'Elegant check-ins for boutique properties. Handle private rooms, tours, and personalized service without the chaos.' },
              { icon: '🏄', title: 'Surf camps & long stays', desc: 'Weekly and monthly guests, activity bookings, and recurring payments — all tracked in one place.' },
            ].map((a, i) => (
              <motion.div
                key={a.title}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(14,26,31,0.1)', transition: { type: 'spring', stiffness: 300, damping: 22 } }}
                style={{
                  background: '#fff', border: '1px solid #DDE4E7', borderRadius: 18,
                  padding: '28px 24px', cursor: 'default',
                  transition: 'box-shadow 0.2s',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E2F4EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 16 }}>
                  {a.icon}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0E1A1F', marginBottom: 8 }}>{a.title}</div>
                <div style={{ fontSize: 13.5, color: '#5C6B72', lineHeight: 1.6 }}>{a.desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '100px 24px', background: '#F1F9F4' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
          >
            <motion.span variants={fadeUp} style={{
              display: 'inline-flex', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '5px 14px', borderRadius: 999,
              background: 'rgba(33,199,122,0.12)', color: '#0F6B41', marginBottom: 16,
            }}>
              Pricing
            </motion.span>
            <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#0E1A1F', marginBottom: 12, lineHeight: 1.1 }}>
              Simple pricing, no surprises
            </motion.h2>
            <motion.p variants={fadeUp} style={{ fontSize: 16, color: '#5C6B72', marginBottom: 32, lineHeight: 1.65 }}>
              All plans include full access to core features. Change or cancel at any time.
            </motion.p>

            {/* Annual toggle */}
            <motion.div variants={fadeUp} style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.8)', borderRadius: 999, padding: '6px 20px', border: '1px solid #DDE4E7', marginBottom: 48 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: annual ? '#8593A0' : '#0E1A1F' }}>Monthly</span>
              <motion.button
                onClick={() => setAnnual((p) => !p)}
                style={{
                  width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0,
                  background: annual ? '#21C77A' : '#DDE4E7', position: 'relative',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={{
                    position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    left: annual ? 23 : 3,
                  }}
                />
              </motion.button>
              <span style={{ fontSize: 13, fontWeight: 500, color: annual ? '#0E1A1F' : '#8593A0' }}>
                Annual
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#21C77A', background: '#E2F4EA', padding: '1px 7px', borderRadius: 999 }}>-20%</span>
              </span>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}
          >
            {[
              {
                name: 'Starter', monthly: 249, features: ['Up to 10 beds', 'Unlimited check-ins', 'Police form PDF', 'Live bed map', '1 staff account'],
                featured: false,
              },
              {
                name: 'Business', monthly: 549, features: ['Unlimited beds', 'Unlimited staff', 'WhatsApp integration', 'Revenue analytics', 'Night audit wizard', 'Cash reconciliation', 'Priority support'],
                featured: true,
              },
              {
                name: 'Enterprise', monthly: 999, features: ['Everything in Business', 'Multi-property', 'Custom onboarding', 'Dedicated account manager', 'SLA guarantee'],
                featured: false,
              },
            ].map((plan, i) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -4, transition: { type: 'spring', stiffness: 300, damping: 22 } }}
                style={{
                  background: '#fff',
                  border: `1.5px solid ${plan.featured ? '#21C77A' : '#DDE4E7'}`,
                  borderRadius: 20, padding: '28px 24px', textAlign: 'left',
                  boxShadow: plan.featured ? '0 8px 40px rgba(33,199,122,0.18)' : undefined,
                  transform: plan.featured ? 'translateY(-8px)' : undefined,
                  position: 'relative',
                }}
              >
                {plan.featured && (
                  <div style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: '#21C77A', color: '#fff', marginBottom: 16 }}>
                    Most popular
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5C6B72', marginBottom: 8 }}>{plan.name}</div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={annual ? 'annual' : 'monthly'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', color: '#0E1A1F', lineHeight: 1, marginBottom: 4 }}>
                      {annual ? Math.round(plan.monthly * 0.8) : plan.monthly}
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#8593A0' }}> MAD</span>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div style={{ fontSize: 13, color: '#8593A0', marginBottom: 24 }}>per month{annual ? ', billed annually' : ''}</div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: '#1F2D33' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: plan.featured ? '#21C77A' : '#E2F4EA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={plan.featured ? '#fff' : '#21C77A'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/register"
                    style={{
                      display: 'block', textAlign: 'center', fontSize: 14, fontWeight: 700,
                      padding: '12px 20px', borderRadius: 12, textDecoration: 'none',
                      background: plan.featured ? '#21C77A' : 'transparent',
                      color: plan.featured ? '#fff' : '#0F6B41',
                      border: plan.featured ? undefined : '1.5px solid #C9EBD7',
                      boxShadow: plan.featured ? '0 4px 16px rgba(33,199,122,0.35)' : undefined,
                    }}
                  >
                    {plan.featured ? 'Start 14-day free trial' : plan.name === 'Enterprise' ? 'Contact us' : 'Get started'}
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonial ──────────────────────────────────────────────────── */}
      <section style={{ padding: '100px 24px', background: '#0E1A1F', textAlign: 'center' }}>
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
          style={{ maxWidth: 680, margin: '0 auto' }}
        >
          <motion.div variants={fadeUp} style={{ fontSize: 52, opacity: 0.35, color: '#21C77A', marginBottom: 20, lineHeight: 1 }}>&ldquo;</motion.div>
          <motion.p
            variants={fadeUp}
            style={{ fontSize: 'clamp(20px,3.5vw,26px)', fontWeight: 600, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)', marginBottom: 36 }}
          >
            Before HostelPro, I was spending{' '}
            <em style={{ fontStyle: 'normal', color: '#21C77A' }}>two hours every night</em>{' '}
            writing spreadsheets and filling forms by hand. Now I run the whole hostel from my phone.
          </motion.p>
          <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #21C77A, #0F6B41)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>Y</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Youssef Benali</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Owner, Auberge Atlas · Agadir</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
          style={{
            maxWidth: 700, margin: '0 auto',
            background: 'linear-gradient(135deg, #0a1f1c 0%, #0d2b26 50%, #0E1A1F 100%)',
            borderRadius: 28, padding: '56px 48px', textAlign: 'center',
            border: '1px solid rgba(33,199,122,0.2)',
            boxShadow: '0 24px 60px rgba(14,26,31,0.2), inset 0 1px 0 rgba(33,199,122,0.1)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Glow */}
          <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: 400, height: 200, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(33,199,122,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <motion.h3 variants={fadeUp} style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: '-0.025em', position: 'relative' }}>
            Ready to run your hostel from your phone?
          </motion.h3>
          <motion.p variants={fadeUp} style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 1.65, position: 'relative' }}>
            Join 200+ Moroccan properties on HostelPro. 14-day free trial, no credit card required.
          </motion.p>
          <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none',
                padding: '14px 28px', borderRadius: 14, background: '#21C77A',
                boxShadow: '0 6px 28px rgba(33,199,122,0.45)',
              }}>
                Start free trial
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/login" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textDecoration: 'none',
                padding: '14px 24px', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
              }}>
                Sign in
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ background: '#0E1A1F', padding: '64px 24px 32px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 40, paddingBottom: 48, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 30, height: 30, background: '#21C77A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5C3 6 4.5 4 8 4C11.5 4 13 6 13 8.5C13 11 11 13 8 13C5 13 3 11 3 8.5Z" fill="white" opacity="0.9"/>
                    <rect x="6" y="3" width="4" height="2" rx="1" fill="white"/>
                  </svg>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>HostelPro</span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7, marginTop: 14, marginBottom: 18 }}>
                The all-in-one management platform for hostels, riads, and guesthouses across Morocco and North Africa.
              </p>
            </div>
            {[
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
              { title: 'Help', links: ['Documentation', 'Getting started', 'FAQ', 'Service status'] },
              { title: 'Resources', links: ['Hostel guide', 'Police form templates', 'WhatsApp templates', 'Morocco tourism'] },
            ].map((col) => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 18 }}>{col.title}</div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map((l) => (
                    <li key={l}><a href="#" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>© {new Date().getFullYear()} HostelPro. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Privacy', 'Terms', 'Cookies'].map((l) => (
                <a key={l} href="#" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
