'use client'

import Link from 'next/link'
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
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

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

// ── Palette — matches the app's Apple-minimal teal design system ───────────
const C = {
  ink: '#0A1F1C',          // near-black teal — headings
  body: '#42524D',         // body copy
  muted: '#5F6F6A',        // secondary text
  faint: '#8C9B96',        // tertiary text
  teal: '#0F6E56',         // primary teal (dark)
  tealDeep: '#0A4B3C',     // pressed / gradient end
  mint: '#16a37d',         // primary teal (light)
  tint: 'rgba(15,110,86,0.08)',   // soft teal wash
  tintStrong: 'rgba(15,110,86,0.14)',
  border: '#E3EBE7',       // hairline
  surface: '#F6F9F7',      // section wash
  card: '#FFFFFF',
}

const tealGradient = `linear-gradient(135deg, ${C.mint} 0%, ${C.teal} 100%)`

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
  if (s === 'O' || s === 'new') return { bg: C.mint, text: '#fff', border: '#12876A' }
  if (s === 'A') return { bg: C.teal, text: '#fff', border: C.tealDeep }
  if (s === 'D') return { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' }
  return { bg: '#F2F6F4', text: '#B7C4BF', border: C.border }
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.55, delay: i * 0.07, ease: [0.25, 0.4, 0.25, 1] },
  }),
}

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
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

// ── Soft atmospheric glow (light theme) ────────────────────────────────────
function GlowBlob({ className, w, h, color, delay }: {
  className: string; w: number; h: number; color: string; delay: number
}) {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 2.4, delay, ease: [0.23, 0.86, 0.39, 0.96] }}
    >
      <motion.div
        animate={{ y: [0, 22, 0] }}
        transition={{ duration: 12 + delay * 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: w, height: h, borderRadius: '50%',
          background: `radial-gradient(ellipse, ${color} 0%, transparent 65%)`,
          filter: 'blur(24px)',
        }}
      />
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
      className={`relative overflow-hidden rounded-[22px] border bg-white ${className ?? ''}`}
      style={{ borderColor: C.border, boxShadow: '0 1px 2px rgba(10,31,28,0.04), 0 12px 36px rgba(10,31,28,0.06)' }}
    >
      {children}
    </motion.div>
  )
}

// ── Card eyebrow label ─────────────────────────────────────────────────────
function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, marginBottom: 12 }}>
      {children}
    </div>
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
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.mint }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.faint }}>
          Live Bed Map
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: C.teal, background: C.tint, padding: '2px 8px', borderRadius: 999 }}>
          17/24 occupied
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5 }}>
        {beds.map((s, i) => {
          const c = bedColors(s)
          return (
            <motion.div
              key={i}
              animate={s === 'new' ? { scale: [0.85, 1.08, 1] } : { scale: 1 }}
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
          { color: C.mint, label: 'Occupied' },
          { color: C.teal, label: 'Arriving' },
          { color: '#FCD34D', label: 'Dirty' },
          { color: '#F2F6F4', label: 'Available', border: '#C6D2CD' },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: C.muted }}>
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
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, marginBottom: 4 }}>
          Revenue — 7 days
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.03em', marginBottom: 14 }}>
          38 450 MAD <span style={{ fontSize: 12, fontWeight: 600, color: C.teal, background: C.tint, padding: '2px 8px', borderRadius: 999 }}>+18%</span>
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
                background: i === 6 ? tealGradient : 'rgba(22,163,125,0.22)',
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
      <CardLabel>WhatsApp Hub</CardLabel>
      <div style={{ background: '#ECE5DD', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.mint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>Y</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>Youssef Benali</div>
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
                  color: C.ink,
                  whiteSpace: 'pre-line',
                }}
              >
                {b.text}
                <div style={{ fontSize: 9, color: C.faint, textAlign: 'right', marginTop: 2 }}>{b.time}</div>
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
      <CardLabel>Check-in</CardLabel>
      <div className={fraunces.className} style={{ fontSize: 30, fontWeight: 600, color: C.teal, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>
        60s
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>Average check-in time</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
              animate={{ background: i <= active ? C.mint : '#EAF0ED', scale: i === active ? 1.15 : 1 }}
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
              animate={{ color: i <= active ? C.ink : C.faint, fontWeight: i === active ? 600 : 400 }}
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
      <CardLabel>Police Form</CardLabel>
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
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.teal }}>PDF Generated!</div>
            <div style={{ fontSize: 10, color: C.faint }}>fiche-police-benali.pdf</div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
          >
            <div style={{ background: '#F4F9F6', borderRadius: 8, padding: '8px 10px', border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 20, height: 24, background: C.teal, borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>PDF</span>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.ink }}>FICHE DE POLICE</div>
                  <div style={{ fontSize: 9, color: C.faint }}>1 click generation</div>
                </div>
              </div>
            </div>
            <motion.div
              animate={{ width: ['0%', '100%'] }}
              transition={{ duration: 2.3, ease: 'easeInOut', repeat: Infinity }}
              style={{ height: 3, background: tealGradient, borderRadius: 999 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </BentoCard>
  )
}

// ── FAQ — single source for the visible section AND the JSON-LD schema ────
const FAQ_ITEMS = [
  {
    q: 'Qu\'est-ce que Sweet Reservation ?',
    a: 'Sweet Reservation est un logiciel SaaS de gestion pour hostels et auberges au Maroc. Il permet le check-in digital en 60 secondes, la génération automatique de fiches de police, l\'intégration WhatsApp, la gestion des paiements en MAD et les rapports de revenus.',
  },
  {
    q: 'Comment Sweet Reservation génère-t-il les fiches de police ?',
    a: 'Sweet Reservation génère automatiquement les fiches de police en PDF au format standard marocain lors de chaque check-in. Toutes les informations requises (nom, passeport, nationalité, adresse au Maroc, destination suivante) sont collectées dans le formulaire de check-in et exportées en un seul clic.',
  },
  {
    q: 'Sweet Reservation fonctionne-t-il avec Booking.com et Hostelworld ?',
    a: 'Oui. Sweet Reservation s\'intègre avec Booking.com, Hostelworld et d\'autres canaux OTA. Vous pouvez importer les réservations, suivre les commissions et calculer le revenu net après déduction des frais de canal.',
  },
  {
    q: 'Puis-je utiliser Sweet Reservation sur mobile ?',
    a: 'Oui, Sweet Reservation est entièrement optimisé pour mobile. L\'application web progressive (PWA) fonctionne sur tous les smartphones. Une navigation simplifiée est disponible en bas de l\'écran pour un accès rapide au check-in, plan des lits et paiements.',
  },
  {
    q: 'Quel est le prix de Sweet Reservation ?',
    a: 'Sweet Reservation propose un essai gratuit de 14 jours sans carte bancaire. Des plans mensuels et annuels sont disponibles pour les hostels de toutes tailles, de la petite auberge au grand établissement.',
  },
  {
    q: 'Sweet Reservation est-il disponible en arabe ?',
    a: 'Oui, Sweet Reservation est disponible en français, arabe et anglais. L\'interface s\'adapte à la langue choisie par l\'utilisateur.',
  },
]

// ── FAQ accordion item ─────────────────────────────────────────────────────
function FAQRow({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(10,31,28,0.03)' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '18px 22px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: C.ink, lineHeight: 1.4 }}>{q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          style={{
            flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
            background: open ? tealGradient : C.tint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={open ? '#fff' : C.teal} strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.25, 0.4, 0.25, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p style={{ padding: '0 22px 20px', fontSize: 14, lineHeight: 1.7, color: C.muted }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Logo mark ──────────────────────────────────────────────────────────────
function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, background: tealGradient, borderRadius: size * 0.28,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(15,110,86,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
    }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5C3 6 4.5 4 8 4C11.5 4 13 6 13 8.5C13 11 11 13 8 13C5 13 3 11 3 8.5Z" fill="white" opacity="0.92"/>
        <rect x="6" y="3" width="4" height="2" rx="1" fill="white"/>
      </svg>
    </div>
  )
}

// ── Main landing page ─────────────────────────────────────────────────────
export default function LandingPage() {
  const t = useT()
  const [annual, setAnnual] = useState(false)
  const { scrollY } = useScroll()
  const navBg = useTransform(scrollY, [0, 80], ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.92)'])
  const navShadow = useTransform(scrollY, [0, 80], ['0 0 0 rgba(10,31,28,0)', '0 2px 24px rgba(10,31,28,0.08)'])

  const HERO_WORDS = ['Every', 'bed', 'booked.', 'Every', 'guest', 'happy.', 'Every', 'night', 'effortless.']
  const ACCENTS = new Set(['booked.', 'happy.', 'effortless.'])

  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Sweet Reservation',
    url: 'https://www.sweetreservation.com',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'MAD',
      description: 'Essai gratuit 14 jours',
    },
  }

  return (
    <div className={jakarta.className} style={{ background: '#fff', color: C.ink, overflowX: 'hidden' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

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
          border: `1px solid ${C.border}`,
          boxShadow: navShadow,
          whiteSpace: 'nowrap',
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <LogoMark />
          <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: '-0.3px' }}>Sweet Reservation</span>
        </Link>
        <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {['Features', 'Pricing'].map((l) => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 13.5, fontWeight: 500, color: C.muted, textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <Link href="/login" style={{ fontSize: 13.5, fontWeight: 500, color: C.muted, textDecoration: 'none', padding: '7px 14px', borderRadius: 999 }}>
            Sign in
          </Link>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link href="/register?plan=starter" style={{
              fontSize: 13.5, fontWeight: 600, color: '#fff', textDecoration: 'none',
              padding: '8px 18px', borderRadius: 999, background: tealGradient,
              boxShadow: '0 2px 12px rgba(15,110,86,0.35), inset 0 1px 0 rgba(255,255,255,0.2)', display: 'block',
            }}>
              Start free
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="lp-hero-section" style={{
        position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', overflow: 'hidden',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FBF9 45%, #EEF6F2 100%)',
      }}>
        {/* Grid dot pattern */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'radial-gradient(rgba(15,110,86,0.13) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 38%, #000 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 38%, #000 30%, transparent 100%)',
        }} />

        {/* Soft glows */}
        <GlowBlob className="left-[-10%] top-[18%]" w={620} h={260} color="rgba(22,163,125,0.16)" delay={0.3} />
        <GlowBlob className="right-[-6%] top-[55%]" w={520} h={230} color="rgba(15,110,86,0.12)" delay={0.5} />
        <GlowBlob className="left-[12%] bottom-[4%]" w={340} h={170} color="rgba(22,163,125,0.10)" delay={0.4} />

        {/* Badge */}
        <motion.div
          custom={0} variants={fadeUp} initial="hidden" animate="visible"
          style={{
            position: 'relative', zIndex: 1,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 12.5, fontWeight: 600, color: C.teal,
            background: 'rgba(255,255,255,0.75)', border: `1px solid ${C.border}`,
            padding: '7px 16px', borderRadius: 999, marginBottom: 28,
            boxShadow: '0 1px 4px rgba(10,31,28,0.05)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C.mint, opacity: 0.5, animation: 'ping 1.8s cubic-bezier(0,0,0.2,1) infinite' }} />
            <span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', background: C.mint }} />
          </span>
          Built for Moroccan hospitality
        </motion.div>

        {/* H1 — word by word, serif accents */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 24, maxWidth: 860 }}>
          <h1 style={{
            fontSize: 'clamp(40px, 6.2vw, 74px)', fontWeight: 700, lineHeight: 1.06,
            letterSpacing: '-0.03em', color: C.ink,
          }}>
            {HERO_WORDS.map((word, i) => (
              <motion.span
                key={i}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className={ACCENTS.has(word) ? fraunces.className : undefined}
                style={{
                  display: 'inline-block',
                  marginRight: word === 'effortless.' ? '0' : '0.28em',
                  fontStyle: ACCENTS.has(word) ? 'italic' : 'normal',
                  fontWeight: ACCENTS.has(word) ? 500 : 700,
                  letterSpacing: ACCENTS.has(word) ? '-0.015em' : undefined,
                  background: ACCENTS.has(word) ? tealGradient : undefined,
                  WebkitBackgroundClip: ACCENTS.has(word) ? 'text' : undefined,
                  backgroundClip: ACCENTS.has(word) ? 'text' : undefined,
                  color: ACCENTS.has(word) ? 'transparent' : C.ink,
                  paddingRight: ACCENTS.has(word) ? '0.06em' : undefined,
                }}
              >
                {word}
              </motion.span>
            ))}
          </h1>
        </div>

        {/* Subtitle */}
        <motion.p
          custom={10} variants={fadeUp} initial="hidden" animate="visible"
          style={{ position: 'relative', zIndex: 1, fontSize: 17, lineHeight: 1.65, color: C.muted, maxWidth: 560, marginBottom: 40 }}
        >
          Check in a guest, generate the police fiche, collect payment, send a WhatsApp welcome — all in under 2 minutes. Built for Moroccan hospitality.
        </motion.p>

        {/* CTA */}
        <motion.div
          custom={12} variants={fadeUp} initial="hidden" animate="visible"
          style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}
        >
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link href="/register?plan=starter" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none',
              padding: '14px 28px', borderRadius: 14, background: tealGradient,
              boxShadow: '0 8px 28px rgba(15,110,86,0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              Start 14-day free trial
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <a href="#pricing" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 15, fontWeight: 600, color: C.ink, textDecoration: 'none',
              padding: '14px 24px', borderRadius: 14,
              border: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 1px 4px rgba(10,31,28,0.05)',
            }}>
              See pricing
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </a>
          </motion.div>
        </motion.div>

        {/* Reassurance line */}
        <motion.div
          custom={14} variants={fadeUp} initial="hidden" animate="visible"
          style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 56, fontSize: 12.5, color: C.faint, fontWeight: 500 }}
        >
          {['No credit card required', 'Setup in 5 minutes', 'Français · العربية · English'].map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.mint} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {s}
            </span>
          ))}
        </motion.div>

        {/* Dashboard mock — light */}
        <motion.div
          initial={{ opacity: 0, y: 36, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.65, delay: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
          className="lp-hero-mock"
          style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 900 }}
        >
          <TiltCard>
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 40px 100px rgba(10,31,28,0.18), 0 8px 28px rgba(10,31,28,0.08), 0 0 0 1px rgba(10,31,28,0.05)',
              background: '#fff',
            }}>
              {/* Chrome bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#F6F9F7', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#FF5F57','#FEBC2E','#28C840'].map((c) => (
                    <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ fontSize: 11, color: C.faint, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 14px' }}>
                    sweetreservation.com/dashboard
                  </div>
                </div>
              </div>
              {/* Body */}
              <div style={{ display: 'flex', height: 380 }}>
                {/* Sidebar */}
                <div style={{ width: 200, background: '#FAFCFB', borderRight: `1px solid ${C.border}`, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 10 }}>
                    <LogoMark size={26} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, letterSpacing: '-0.2px' }}>Sweet Reservation</span>
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
                        background: item.active ? C.tint : 'transparent',
                        color: item.active ? C.teal : C.faint,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{item.icon}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
                {/* Main */}
                <div style={{ flex: 1, padding: '18px 18px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14, background: '#fff' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, textAlign: 'left' }}>Tableau de bord</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
                    {[
                      { label: 'Occupancy', val: '17/24', sub: '70%', delay: '0s', color: C.teal },
                      { label: 'Revenue', val: '4 320 MAD', sub: '+12%', delay: '0.08s', color: C.mint },
                      { label: 'Check-ins', val: '3', sub: 'pending', delay: '0.16s', color: C.ink },
                      { label: 'Check-outs', val: '2', sub: 'before 11h', delay: '0.24s', color: '#B45309' },
                    ].map((c) => (
                      <motion.div
                        key={c.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 + parseFloat(c.delay), duration: 0.4 }}
                        style={{
                          background: '#FAFCFB', border: `1px solid ${C.border}`,
                          borderRadius: 10, padding: '10px 12px', textAlign: 'left',
                        }}
                      >
                        <div style={{ fontSize: 9.5, color: C.faint, marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.val}</div>
                        <div style={{ fontSize: 8.5, color: '#AEBBB6', marginTop: 3 }}>{c.sub}</div>
                      </motion.div>
                    ))}
                  </div>
                  {/* Mini charts */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, flex: 1 }}>
                    {/* Bar chart */}
                    <div style={{ background: '#FAFCFB', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'left' }}>
                      <div style={{ fontSize: 9.5, color: C.faint, marginBottom: 8 }}>Revenue 7 days</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 52 }}>
                        {[40, 55, 35, 70, 60, 85, 100].map((h, i) => (
                          <motion.div
                            key={i}
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: 1 + i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                              flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0',
                              background: i === 6 ? C.mint : 'rgba(22,163,125,0.22)',
                              transformOrigin: 'bottom',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Line chart */}
                    <div style={{ background: '#FAFCFB', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                      <div style={{ fontSize: 9.5, color: C.faint, marginBottom: 6 }}>Occupancy rate</div>
                      <svg style={{ flex: 1 }} viewBox="0 0 200 60" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="dg1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={C.mint} stopOpacity="0.28"/>
                            <stop offset="100%" stopColor={C.mint} stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d="M0,50 C20,44 30,26 50,30 C70,34 80,16 100,14 C120,12 130,24 150,18 C170,12 180,7 200,5 L200,60 L0,60 Z" fill="url(#dg1)"/>
                        <path d="M0,50 C20,44 30,26 50,30 C70,34 80,16 100,14 C120,12 130,24 150,18 C170,12 180,7 200,5" fill="none" stroke={C.mint} strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    {/* Activity */}
                    <div style={{ background: '#FAFCFB', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'left' }}>
                      <div style={{ fontSize: 9.5, color: C.faint, marginBottom: 6 }}>Activity</div>
                      {[
                        { icon: '✅', text: 'Check-in · Karim B.', time: '14:32' },
                        { icon: '💰', text: 'Payment · 650 MAD', time: '14:10' },
                        { icon: '🛏', text: 'Bed A3 marked clean', time: '13:55' },
                      ].map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 10 }}>{a.icon}</span>
                          <span style={{ fontSize: 9.5, color: C.muted, flex: 1 }}>{a.text}</span>
                          <span style={{ fontSize: 8.5, color: '#AEBBB6' }}>{a.time}</span>
                        </div>
                      ))}
                    </div>
                    {/* Donut */}
                    <div style={{ background: '#FAFCFB', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                      <div style={{ fontSize: 9.5, color: C.faint, marginBottom: 6 }}>Sources</div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="46" height="46" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="24" fill="none" stroke="#EAF0ED" strokeWidth="10"/>
                          <circle cx="32" cy="32" r="24" fill="none" stroke={C.mint} strokeWidth="10" strokeDasharray="75.4 75.4" strokeDashoffset="-56.5" strokeLinecap="round" transform="rotate(-90 32 32)"/>
                          <circle cx="32" cy="32" r="24" fill="none" stroke={C.teal} strokeWidth="10" strokeDasharray="37.7 113.1" strokeDashoffset="-131.9" strokeLinecap="round" transform="rotate(-90 32 32)"/>
                        </svg>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {[{ c: C.mint, l: 'Direct 40%' }, { c: C.teal, l: 'Bk.com 20%' }].map((d) => (
                            <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9 }}>
                              <div style={{ width: 7, height: 7, borderRadius: 2, background: d.c }} />
                              <span style={{ color: C.muted }}>{d.l}</span>
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
          className="lp-stats-grid"
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
              className="lp-stat-item"
              style={{ borderRight: i < 3 ? `1px solid ${C.border}` : undefined }}
            >
              <div className={fraunces.className} style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1, marginBottom: 8 }}>
                <Counter to={s.val} suffix={s.suffix} prefix={s.prefix} />
              </div>
              <div style={{ fontSize: 13, color: C.faint, fontWeight: 500 }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Features bento ───────────────────────────────────────────────── */}
      <section id="features" className="lp-section" style={{ background: C.surface }}>
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
              background: C.tint, color: C.teal, marginBottom: 16,
            }}>
              Everything you need
            </motion.span>
            <motion.h2 variants={fadeUp} className={fraunces.className} style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 500, letterSpacing: '-0.02em', color: C.ink, marginBottom: 16, lineHeight: 1.12 }}>
              One app. <em style={{ color: C.teal }}>Zero paper.</em>
            </motion.h2>
            <motion.p variants={fadeUp} style={{ fontSize: 16, color: C.muted, maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
              From check-in to police report, payments to WhatsApp — all in one calm interface built for Moroccan hospitality.
            </motion.p>
          </motion.div>

          {/* Bento grid */}
          <div className="lp-bento-grid">
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
              <CardLabel>Night Audit</CardLabel>
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
                    <span style={{ color: C.faint }}>{r.label}</span>
                    <span style={{ fontWeight: 600, color: C.teal }}>{r.val}</span>
                  </motion.div>
                ))}
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── Audience ─────────────────────────────────────────────────────── */}
      <section id="audience" className="lp-section" style={{ background: '#fff' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
            style={{ textAlign: 'center', marginBottom: 56 }}
          >
            <motion.span variants={fadeUp} style={{
              display: 'inline-flex', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '5px 14px', borderRadius: 999,
              background: C.tint, color: C.teal, marginBottom: 16,
            }}>
              Who it&apos;s for
            </motion.span>
            <motion.h2 variants={fadeUp} className={fraunces.className} style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 500, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1.12 }}>
              Built for every kind of <em style={{ color: C.teal }}>Moroccan host</em>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer}
            className="lp-audience-grid"
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
                whileHover={{ y: -4, boxShadow: '0 16px 44px rgba(10,31,28,0.09)', transition: { type: 'spring', stiffness: 300, damping: 22 } }}
                style={{
                  background: '#fff', border: `1px solid ${C.border}`, borderRadius: 20,
                  padding: '28px 24px', cursor: 'default',
                  boxShadow: '0 1px 2px rgba(10,31,28,0.03)',
                  transition: 'box-shadow 0.2s',
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: C.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 16 }}>
                  {a.icon}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{a.title}</div>
                <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>{a.desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="lp-section" style={{ background: C.surface }}>
        <div style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
          >
            <motion.span variants={fadeUp} style={{
              display: 'inline-flex', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '5px 14px', borderRadius: 999,
              background: C.tint, color: C.teal, marginBottom: 16,
            }}>
              Pricing
            </motion.span>
            <motion.h2 variants={fadeUp} className={fraunces.className} style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 500, letterSpacing: '-0.02em', color: C.ink, marginBottom: 12, lineHeight: 1.12 }}>
              Simple pricing, <em style={{ color: C.teal }}>no surprises</em>
            </motion.h2>
            <motion.p variants={fadeUp} style={{ fontSize: 16, color: C.muted, marginBottom: 32, lineHeight: 1.65 }}>
              All plans include full access to core features. Change or cancel at any time.
            </motion.p>

            {/* Annual toggle */}
            <motion.div variants={fadeUp} style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 999, padding: '6px 20px', border: `1px solid ${C.border}`, marginBottom: 48, boxShadow: '0 1px 4px rgba(10,31,28,0.04)' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: annual ? C.faint : C.ink }}>Monthly</span>
              <motion.button
                onClick={() => setAnnual((p) => !p)}
                style={{
                  width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0,
                  background: annual ? C.mint : '#DCE5E1', position: 'relative',
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
              <span style={{ fontSize: 13, fontWeight: 500, color: annual ? C.ink : C.faint }}>
                Annual
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: C.teal, background: C.tint, padding: '1px 7px', borderRadius: 999 }}>-20%</span>
              </span>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer}
            className="lp-pricing-grid"
          >
            {[
              {
                name: 'Starter', monthly: 35, planKey: 'starter', features: ['Up to 45 beds', 'Unlimited check-ins', 'Police form PDF', 'Live bed map', '1 staff account'],
                featured: false,
              },
              {
                name: 'Business', monthly: 100, planKey: 'pro', features: ['Unlimited beds', 'Auto OTA sync (Booking.com, Hostelworld…)', 'Unlimited staff', 'Revenue analytics', 'Night audit wizard', 'Cash reconciliation', 'Priority WhatsApp support'],
                featured: true,
              },
              {
                name: 'Enterprise', monthly: 999, planKey: 'enterprise', features: ['Everything in Business', 'Multi-property', 'Custom onboarding', 'Dedicated account manager', 'SLA guarantee'],
                featured: false,
              },
            ].map((plan, i) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -4, transition: { type: 'spring', stiffness: 300, damping: 22 } }}
                className={plan.featured ? 'lp-pricing-featured' : undefined}
                style={{
                  background: '#fff',
                  border: `1.5px solid ${plan.featured ? C.mint : C.border}`,
                  borderRadius: 22, padding: '28px 24px', textAlign: 'left',
                  boxShadow: plan.featured
                    ? '0 12px 44px rgba(15,110,86,0.16), 0 0 0 4px rgba(22,163,125,0.08)'
                    : '0 1px 2px rgba(10,31,28,0.03)',
                  transform: plan.featured ? 'translateY(-8px)' : undefined,
                  position: 'relative',
                }}
              >
                {plan.featured && (
                  <div style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: tealGradient, color: '#fff', marginBottom: 16, boxShadow: '0 2px 8px rgba(15,110,86,0.3)' }}>
                    Most popular
                  </div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>{plan.name}</div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={annual ? 'annual' : 'monthly'}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={fraunces.className} style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1, marginBottom: 4 }}>
                      {annual ? Math.round(plan.monthly * 0.8) : plan.monthly}
                      <span className={jakarta.className} style={{ fontSize: 16, fontWeight: 600, color: C.faint }}> USD</span>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div style={{ fontSize: 13, color: C.faint, marginBottom: 24 }}>per month{annual ? ', billed annually' : ''}</div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: C.body }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: plan.featured ? tealGradient : C.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={plan.featured ? '#fff' : C.teal} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href={plan.planKey === 'enterprise' ? 'https://wa.me/212679760746' : `/register?plan=${plan.planKey}`}
                    style={{
                      display: 'block', textAlign: 'center', fontSize: 14, fontWeight: 700,
                      padding: '12px 20px', borderRadius: 12, textDecoration: 'none',
                      background: plan.featured ? tealGradient : 'transparent',
                      color: plan.featured ? '#fff' : C.teal,
                      border: plan.featured ? undefined : `1.5px solid rgba(15,110,86,0.25)`,
                      boxShadow: plan.featured ? '0 4px 16px rgba(15,110,86,0.3), inset 0 1px 0 rgba(255,255,255,0.2)' : undefined,
                    }}
                  >
                    {plan.planKey === 'enterprise' ? 'Contact us' : plan.planKey === 'starter' ? 'Start 14-day free trial' : 'Get started'}
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonial ──────────────────────────────────────────────────── */}
      <section className="lp-section" style={{ background: '#fff', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <GlowBlob className="left-[6%] top-[10%]" w={420} h={220} color="rgba(22,163,125,0.09)" delay={0.2} />
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
          style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}
        >
          <motion.div variants={fadeUp} className={fraunces.className} style={{ fontSize: 64, color: C.mint, opacity: 0.4, marginBottom: 8, lineHeight: 1 }}>&ldquo;</motion.div>
          <motion.p
            variants={fadeUp}
            className={fraunces.className}
            style={{ fontSize: 'clamp(22px,3.5vw,30px)', fontWeight: 500, lineHeight: 1.45, color: C.ink, marginBottom: 36, letterSpacing: '-0.01em' }}
          >
            Before Sweet Reservation, I was spending{' '}
            <em style={{ color: C.teal }}>two hours every night</em>{' '}
            writing spreadsheets and filling forms by hand. Now I run the whole hostel from my phone.
          </motion.p>
          <motion.div variants={fadeUp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: tealGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', boxShadow: '0 4px 14px rgba(15,110,86,0.3)' }}>Y</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Youssef Benali</div>
              <div style={{ fontSize: 12, color: C.faint }}>Owner, Auberge Atlas · Agadir</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="lp-section" style={{ background: C.surface }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            variants={staggerContainer}
            style={{ textAlign: 'center', marginBottom: 48 }}
          >
            <motion.span variants={fadeUp} style={{
              display: 'inline-flex', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', padding: '5px 14px', borderRadius: 999,
              background: C.tint, color: C.teal, marginBottom: 16,
            }}>
              FAQ
            </motion.span>
            <motion.h2 variants={fadeUp} className={fraunces.className} style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 500, letterSpacing: '-0.02em', color: C.ink, marginBottom: 12, lineHeight: 1.12 }}>
              Questions <em style={{ color: C.teal }}>fréquentes</em>
            </motion.h2>
            <motion.p variants={fadeUp} style={{ fontSize: 16, color: C.muted, lineHeight: 1.65 }}>
              Tout ce qu&apos;il faut savoir avant de commencer.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }}
            variants={staggerContainer}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {FAQ_ITEMS.map((item, i) => (
              <motion.div key={item.q} variants={fadeUp} custom={i}>
                <FAQRow
                  q={item.q}
                  a={item.a}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px 100px', background: '#fff' }}>
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
          className="lp-cta-box"
          style={{
            maxWidth: 760, margin: '0 auto',
            background: `linear-gradient(135deg, ${C.teal} 0%, #0C5B47 55%, ${C.tealDeep} 100%)`,
            borderRadius: 28, padding: '60px 48px', textAlign: 'center',
            boxShadow: '0 24px 64px rgba(15,110,86,0.28), inset 0 1px 0 rgba(255,255,255,0.15)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Glow + dots */}
          <div style={{ position: 'absolute', top: '-30%', left: '50%', transform: 'translateX(-50%)', width: 460, height: 240, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.16) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'radial-gradient(ellipse 90% 80% at 50% 0%, #000 20%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 0%, #000 20%, transparent 100%)',
            pointerEvents: 'none',
          }} />
          <motion.h3 variants={fadeUp} className={fraunces.className} style={{ fontSize: 'clamp(26px,3.5vw,34px)', fontWeight: 500, color: '#fff', marginBottom: 12, letterSpacing: '-0.015em', position: 'relative', lineHeight: 1.2 }}>
            Ready to run your hostel <em>from your phone?</em>
          </motion.h3>
          <motion.p variants={fadeUp} style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', marginBottom: 32, lineHeight: 1.65, position: 'relative' }}>
            Join 200+ Moroccan properties on Sweet Reservation. 14-day free trial, no credit card required.
          </motion.p>
          <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/register?plan=starter" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 15, fontWeight: 700, color: C.teal, textDecoration: 'none',
                padding: '14px 28px', borderRadius: 14, background: '#fff',
                boxShadow: '0 8px 28px rgba(4,26,20,0.3)',
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
                fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)', textDecoration: 'none',
                padding: '14px 24px', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.08)',
              }}>
                Sign in
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ background: '#FAFCFB', borderTop: `1px solid ${C.border}`, padding: '64px 24px 32px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className="lp-footer-grid" style={{ borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <LogoMark />
                <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: '-0.3px' }}>Sweet Reservation</span>
              </div>
              <p style={{ fontSize: 13, color: C.faint, lineHeight: 1.7, marginTop: 14, marginBottom: 18 }}>
                The all-in-one management platform for hostels, riads, and guesthouses across Morocco and North Africa.
              </p>
            </div>
            {[
              {
                title: 'Produit',
                links: [
                  { label: 'Fonctionnalités', href: '#features' },
                  { label: 'Tarifs', href: '#pricing' },
                  { label: 'Connexion', href: '/login' },
                  { label: 'Essai gratuit', href: '/register?plan=starter' },
                ],
              },
              {
                title: 'Ressources',
                links: [
                  { label: 'Blog', href: '/blog' },
                  { label: 'Fiche de police guide', href: '/blog/fiche-de-police-hostel-maroc' },
                  { label: 'Booking.com vs Hostelworld', href: '/blog/booking-com-vs-hostelworld-maroc' },
                  { label: 'Ouvrir un hostel au Maroc', href: '/blog/ouvrir-hostel-maroc-guide' },
                ],
              },
              {
                title: 'Villes',
                links: [
                  { label: 'Hostel Marrakech', href: '/logiciel-hostel-marrakech' },
                  { label: 'Hostel Agadir', href: '/logiciel-hostel-agadir' },
                  { label: 'Hostel Casablanca', href: '/logiciel-hostel-casablanca' },
                  { label: 'Hostel Fès', href: '/logiciel-hostel-fes' },
                  { label: 'Hostel Tanger', href: '/logiciel-hostel-tanger' },
                  { label: 'Hostel Chefchaouen', href: '/logiciel-hostel-chefchaouen' },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, marginBottom: 18 }}>{col.title}</div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map((l) => (
                    <li key={l.label}><Link href={l.href} style={{ fontSize: 13.5, color: C.muted, textDecoration: 'none' }}>{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#A5B3AE' }}>© {new Date().getFullYear()} Sweet Reservation. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 20 }}>
              {['Privacy', 'Terms', 'Cookies'].map((l) => (
                <a key={l} href="#" style={{ fontSize: 12, color: '#A5B3AE', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
