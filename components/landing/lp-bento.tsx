'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Features — a light bento grid of the six modules. Each tile has a clay object
// breaking out of its corner and a small looping demo (demo data only) that
// plays while the tile is on screen, plus a pointer-following spotlight.
// Reduced motion shows every demo in its final, static state.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useMotionValue } from 'framer-motion'
import { BedDouble, CalendarDays, Check, FileText, MessageCircle, ScanLine, Wallet } from 'lucide-react'
import { EASE, SectionHead, useLP, useReducedMotion } from './lp-shared'
import { Clay, type ClayName } from './lp-clay'
import { CHECKIN_FIELDS, SourceChip } from './lp-ui'
import { DEMO_PAYMENTS, DEMO_REVENUE_7D, formatMAD, type BedStatus } from './lp-data'

// ── Loop driver: `started` once the tile is seen, `cycle` ticks while visible
function useDemoLoop(period: number) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const seen = useInView(ref, { once: true, margin: '-15% 0px' })
  const visible = useInView(ref, { margin: '-15% 0px' })
  const [cycle, setCycle] = useState(0)
  useEffect(() => {
    if (!visible || reduced) return
    const id = window.setInterval(() => setCycle((c) => c + 1), period)
    return () => window.clearInterval(id)
  }, [visible, reduced, period])
  return { ref, cycle, started: seen || reduced, reduced }
}

type Demo = { cycle: number; started: boolean; reduced: boolean }

// ── 1. Reservations — bookings land in the calendar one by one ────────────
const RES_ROWS = [
  { bed: 'A1', start: 0, len: 4, src: 'Direct' },
  { bed: 'A2', start: 1, len: 3, src: 'Hostelworld' },
  { bed: 'A3', start: 2, len: 3, src: 'Booking.com', highlight: true },
  { bed: 'A4', start: 4, len: 3, src: 'WhatsApp' },
  { bed: 'A5', start: 0, len: 2, src: 'Booking.com' },
]

function ReservationsDemo({ cycle, started, reduced }: Demo) {
  const { copy } = useLP()
  const origin = copy.dir === 'rtl' ? '100% 50%' : '0% 50%'
  return (
    <div className="sr-ui" style={{ width: '100%', maxWidth: 440 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, 1fr)', gap: 4, fontSize: 10.5, color: 'var(--sr-faint)', marginBottom: 6 }}>
        <span />
        {['12', '13', '14', '15', '16', '17', '18'].map((d) => (
          <span key={d} style={{ textAlign: 'center' }}>{d}</span>
        ))}
      </div>
      {RES_ROWS.map((r, i) => (
        <div key={r.bed} style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, 1fr)', gap: 4, alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{r.bed}</span>
          <motion.div
            key={cycle}
            initial={reduced ? false : { scaleX: 0, opacity: 0 }}
            animate={started ? { scaleX: 1, opacity: 1 } : undefined}
            transition={{ delay: r.highlight ? 1.1 : i * 0.12, duration: r.highlight ? 0.7 : 0.55, ease: EASE }}
            style={{
              gridColumn: `${r.start + 2} / span ${r.len}`,
              transformOrigin: origin,
              height: 26,
              borderRadius: 7,
              background: r.highlight ? 'var(--sr-accent)' : 'rgba(10, 31, 28, 0.07)',
              color: r.highlight ? 'var(--sr-on-accent)' : 'var(--sr-ink)',
              display: 'flex',
              alignItems: 'center',
              paddingInline: 8,
              fontSize: 10.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              boxShadow: r.highlight ? '0 10px 24px -10px rgba(15, 110, 86, 0.9)' : undefined,
            }}
          >
            {r.src}
          </motion.div>
        </div>
      ))}
      <motion.div
        key={`n${cycle}`}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={started ? { opacity: 1, y: 0 } : undefined}
        transition={{ delay: 1.6, duration: 0.5, ease: EASE }}
        style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}
      >
        <SourceChip source="Booking.com" />
        <span style={{ color: 'var(--sr-muted)' }}>Lena Hoffmann · A3 · 3 {copy.ui.nights}</span>
      </motion.div>
    </div>
  )
}

// ── 2. Beds — statuses flip live across a dorm ────────────────────────────
const BED_NAMES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6']
const BED_START: BedStatus[] = ['occupied', 'occupied', 'free', 'free', 'occupied', 'arriving', 'occupied', 'dirty', 'occupied', 'occupied', 'dirty', 'free']
const BED_NEXT: Record<BedStatus, BedStatus> = { free: 'occupied', arriving: 'occupied', occupied: 'dirty', dirty: 'free' }
const BED_ORDER = [2, 7, 5, 3, 10, 0, 11, 2, 7, 4]

function BedsDemo({ cycle, started, reduced }: Demo) {
  const { copy } = useLP()
  const [{ beds, flipped }, setState] = useState<{ beds: BedStatus[]; flipped: number }>({ beds: BED_START, flipped: -1 })
  useEffect(() => {
    if (!started || reduced || cycle === 0) return
    const idx = BED_ORDER[(cycle - 1) % BED_ORDER.length]
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one status change per loop tick
    setState((prev) => ({ beds: prev.beds.map((s, i) => (i === idx ? BED_NEXT[s] : s)), flipped: idx }))
  }, [cycle, started, reduced])
  const tonight = beds.filter((s) => s === 'occupied' || s === 'arriving').length
  const labels: Record<BedStatus, string> = {
    occupied: copy.ui.statuses.occupied,
    free: copy.ui.statuses.available,
    dirty: copy.ui.statuses.dirty,
    arriving: copy.ui.statuses.arriving,
  }
  return (
    <div className="sr-ui" style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="sr-label">{copy.ui.occupancy}</span>
        <span style={{ fontWeight: 600, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
          {tonight}<span style={{ color: 'var(--sr-faint)', fontSize: 13 }}> / {beds.length}</span>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {beds.map((s, i) => (
          <motion.div
            key={`${BED_NAMES[i]}-${i === flipped ? cycle : 0}`}
            className="sr-bed"
            data-s={s}
            initial={i === flipped && !reduced ? { scale: 0.82, rotateX: 90 } : false}
            animate={{ scale: 1, rotateX: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            style={{ height: 40 }}
            title={labels[s]}
          >
            {BED_NAMES[i]}
          </motion.div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 11.5, color: 'var(--sr-muted)' }}>
        {(['occupied', 'arriving', 'dirty', 'free'] as BedStatus[]).map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="sr-dot" style={{ background: s === 'free' ? '#fff' : `var(--sr-st-${s})`, boxShadow: s === 'free' ? 'inset 0 0 0 1px var(--sr-line)' : undefined }} />
            {labels[s]}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── 3. Check-in — the guest's details fill themselves in ──────────────────
function CheckinDemo({ cycle, started, reduced }: Demo) {
  const { copy, lang } = useLP()
  const fields = CHECKIN_FIELDS[lang].slice(0, 3)
  const clipFrom = copy.dir === 'rtl' ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)'
  return (
    <div className="sr-ui sr-card" style={{ width: '100%', maxWidth: 320, padding: 16 }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: 'rgba(10, 31, 28, 0.08)', overflow: 'hidden' }}>
            <motion.span
              key={cycle}
              initial={reduced ? false : { scaleX: 0 }}
              animate={started ? { scaleX: 1 } : undefined}
              transition={{ delay: 0.2 + i * 0.32, duration: 0.3 }}
              style={{ display: 'block', height: '100%', background: 'var(--sr-accent)', transformOrigin: copy.dir === 'rtl' ? 'right' : 'left' }}
            />
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {fields.map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 11px', borderRadius: 9, background: 'var(--sr-bg)', fontSize: 12 }}>
            <span style={{ color: 'var(--sr-muted)' }}>{k}</span>
            <motion.span
              key={cycle}
              initial={reduced ? false : { clipPath: clipFrom }}
              animate={started ? { clipPath: 'inset(0 0% 0 0%)' } : undefined}
              transition={{ delay: 0.3 + i * 0.45, duration: 0.5, ease: 'linear' }}
              style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {v}
            </motion.span>
          </div>
        ))}
      </div>
      <motion.div
        key={`ok${cycle}`}
        initial={reduced ? false : { opacity: 0, scale: 0.9 }}
        animate={started ? { opacity: 1, scale: 1 } : undefined}
        transition={{ delay: 1.9, type: 'spring', stiffness: 300, damping: 18 }}
        style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--sr-accent-ink)', fontWeight: 600 }}
      >
        <Check size={14} strokeWidth={3} aria-hidden="true" />
        {copy.hero.booking.confirmed} · A3
      </motion.div>
    </div>
  )
}

// ── 4. Fiche de police — the PDF prints out of the slot ───────────────────
function PoliceDemo({ cycle, started, reduced }: Demo) {
  const rows = [['Nom', 'HOFFMANN Lena'], ['Nationalité', 'Allemande'], ['N° document', 'C01X00T47']]
  return (
    <div className="sr-ui" style={{ width: '100%', maxWidth: 280, position: 'relative', paddingTop: 10 }}>
      <div style={{ position: 'relative', zIndex: 2, height: 14, borderRadius: 8, background: 'var(--sr-ink)', boxShadow: '0 6px 14px -6px rgba(10, 31, 28, 0.5)' }} />
      <div style={{ overflow: 'hidden', marginTop: -6, paddingInline: 14, paddingBottom: 12 }}>
        <motion.div
          key={cycle}
          initial={reduced ? false : { y: '-104%' }}
          animate={started ? { y: '0%' } : undefined}
          transition={{ delay: 0.2, duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
          style={{ background: '#fff', padding: '18px 14px 12px', boxShadow: 'var(--sr-shadow-1)', borderRadius: '0 0 6px 6px', position: 'relative' }}
        >
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>FICHE DE POLICE</div>
            <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--sr-font-ar), sans-serif' }} lang="ar" dir="rtl">ورقة الشرطة</div>
          </div>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 10, borderTop: '1px solid var(--sr-line-soft)' }}>
              <span style={{ padding: '5px 4px', fontWeight: 600 }}>{k}</span>
              <span style={{ padding: '5px 4px' }}>{v}</span>
            </div>
          ))}
          <motion.span
            key={`s${cycle}`}
            className="sr-chip"
            initial={reduced ? false : { opacity: 0, scale: 1.6, rotate: -14 }}
            animate={started ? { opacity: 1, scale: 1, rotate: -8 } : undefined}
            transition={{ delay: 1.9, type: 'spring', stiffness: 380, damping: 16 }}
            style={{ position: 'absolute', insetInlineEnd: 10, bottom: 8, background: 'var(--sr-accent)', color: 'var(--sr-on-accent)', height: 22, fontSize: 10 }}
          >
            <FileText size={11} aria-hidden="true" /> PDF · FR / AR
          </motion.span>
        </motion.div>
      </div>
    </div>
  )
}

// ── 5. WhatsApp — typing, sent, read, answered ────────────────────────────
const WA_TEXT = {
  fr: { msg: 'Bienvenue Lena ! 🏠 Wi‑Fi : darlina2026 · Départ le 17/03 avant 11:00', reply: 'Merci, à tout à l’heure ! 🙏' },
  en: { msg: 'Welcome Lena! 🏠 Wi‑Fi: darlina2026 · Checkout 17/03 before 11:00', reply: 'Thanks, see you soon! 🙏' },
  ar: { msg: 'مرحبا Lena! 🏠 الواي فاي: darlina2026 · المغادرة 17/03 قبل 11:00', reply: 'شكرًا، أراكم قريبًا! 🙏' },
}

function WhatsAppDemo({ cycle, started, reduced }: Demo) {
  const { lang } = useLP()
  const t = WA_TEXT[lang]
  const show = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 10, scale: 0.96 },
    animate: started ? { opacity: 1, y: 0, scale: 1 } : undefined,
    transition: { delay, duration: 0.4, ease: EASE },
  })
  return (
    <div className="sr-ui" style={{ position: 'relative', width: '100%', maxWidth: 300, borderRadius: 20, background: '#ECE5DA', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 176 }}>
      {!reduced && (
        <motion.div
          key={`t${cycle}`}
          initial={{ opacity: 0 }}
          animate={started ? { opacity: [0, 1, 1, 0] } : undefined}
          transition={{ duration: 1.1, times: [0, 0.15, 0.85, 1] }}
          style={{ position: 'absolute', top: 12, insetInlineEnd: 12, background: '#DCF5D9', borderRadius: 12, padding: '8px 12px', display: 'flex', gap: 4 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
              style={{ width: 6, height: 6, borderRadius: 6, background: 'rgba(10, 31, 28, 0.35)' }}
            />
          ))}
        </motion.div>
      )}
      <motion.div key={`m${cycle}`} {...show(1.1)} style={{ alignSelf: 'flex-end', maxWidth: '88%', background: '#DCF5D9', borderRadius: 12, borderEndEndRadius: 4, padding: '8px 10px', fontSize: 11.5, lineHeight: 1.45 }}>
        {t.msg}
        <div style={{ textAlign: 'end', fontSize: 9.5, marginTop: 2 }}>
          <span style={{ color: 'var(--sr-muted)' }}>14:06 </span>
          <motion.span
            key={`r${cycle}`}
            initial={reduced ? false : { color: '#8A9690' }}
            animate={started ? { color: '#2B8FD8' } : undefined}
            transition={{ delay: 1.9, duration: 0.3 }}
          >
            ✓✓
          </motion.span>
        </div>
      </motion.div>
      <motion.div key={`a${cycle}`} {...show(2.5)} style={{ alignSelf: 'flex-start', maxWidth: '80%', background: '#fff', borderRadius: 12, borderEndStartRadius: 4, padding: '8px 10px', fontSize: 11.5 }}>
        {t.reply}
      </motion.div>
    </div>
  )
}

// ── 6. Payments — today's takings count up, split by method ───────────────
function PaymentsDemo({ cycle, started, reduced, rich = true }: Demo & { rich?: boolean }) {
  const { copy } = useLP()
  const total = DEMO_PAYMENTS.reduce((n, p) => n + p.amount, 0)
  const byMethod = (m: 'cash' | 'transfer' | 'card') => DEMO_PAYMENTS.filter((p) => p.method === m).reduce((n, p) => n + p.amount, 0)
  const split = [
    { label: copy.ui.cash, value: byMethod('cash'), color: 'var(--sr-accent)' },
    { label: copy.ui.transfer, value: byMethod('transfer'), color: '#5DCAA5' },
    { label: copy.ui.card, value: byMethod('card'), color: '#BFE8D9' },
  ]
  const counter = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(reduced ? total : 0)
  useEffect(() => {
    const unsub = mv.on('change', (v) => {
      if (counter.current) counter.current.textContent = formatMAD(Math.round(v))
    })
    if (!started) return unsub
    if (reduced) {
      mv.set(total)
      return unsub
    }
    mv.set(0)
    const controls = animate(mv, total, { duration: 1.6, ease: EASE })
    return () => {
      controls.stop()
      unsub()
    }
  }, [cycle, started, reduced, total, mv])
  const max = Math.max(...DEMO_REVENUE_7D)
  return (
    <div className="sr-ui" style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <span className="sr-label">{copy.ui.payments}</span>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--sr-font-display), var(--sr-font-sans), sans-serif' }}>
            <span ref={counter}>{formatMAD(reduced ? total : 0)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 54 }}>
          {DEMO_REVENUE_7D.map((v, i) => (
            <motion.span
              key={`${cycle}-${i}`}
              initial={reduced ? false : { scaleY: 0 }}
              animate={started ? { scaleY: 1 } : undefined}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.5, ease: EASE }}
              style={{ width: 10, height: `${(v / max) * 100}%`, borderRadius: 3, transformOrigin: 'bottom', background: i === DEMO_REVENUE_7D.length - 1 ? 'var(--sr-accent)' : 'rgba(10, 31, 28, 0.12)' }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 10, overflow: 'hidden', background: 'rgba(10, 31, 28, 0.06)' }}>
        {split.map((s, i) => (
          <motion.span
            key={`${cycle}-${s.label}`}
            initial={reduced ? false : { width: 0 }}
            animate={started ? { width: `${(s.value / total) * 100}%` } : undefined}
            transition={{ delay: 0.6 + i * 0.2, duration: 0.6, ease: EASE }}
            style={{ background: s.color, width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 11.5 }}>
        {split.map((s) => (
          <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--sr-muted)' }}>
            <span className="sr-dot" style={{ background: s.color }} />
            {s.label} <b style={{ color: 'var(--sr-ink)', fontWeight: 600 }}>{formatMAD(s.value)}</b>
          </span>
        ))}
      </div>
      {rich && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {DEMO_PAYMENTS.slice(-3).reverse().map((p, i) => (
            <motion.div
              key={`${cycle}-${p.name}`}
              className="sr-card"
              initial={reduced ? false : { opacity: 0, x: copy.dir === 'rtl' ? -16 : 16 }}
              animate={started ? { opacity: 1, x: 0 } : undefined}
              transition={{ delay: 1.2 + i * 0.25, duration: 0.45, ease: EASE }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', fontSize: 12 }}
            >
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: 'var(--sr-muted)' }}>{p.time} · {copy.ui[p.method]}</span>
              <b style={{ fontWeight: 600 }}>+{formatMAD(p.amount)}</b>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tile ───────────────────────────────────────────────────────────────────
const TILES = [
  { area: 'res', icon: CalendarDays, Demo: ReservationsDemo, period: 5200, clay: 'calendar', wide: true },
  { area: 'beds', icon: BedDouble, Demo: BedsDemo, period: 1300, clay: 'bunk', tall: true },
  { area: 'chk', icon: ScanLine, Demo: CheckinDemo, period: 4800, clay: 'key' },
  { area: 'pol', icon: FileText, Demo: PoliceDemo, period: 4800, clay: 'passport' },
  { area: 'wa', icon: MessageCircle, Demo: WhatsAppDemo, period: 5200, clay: 'chat' },
  { area: 'pay', icon: Wallet, Demo: PaymentsDemo, period: 5600, clay: 'coins', wide: true },
] as const satisfies readonly { clay: ClayName; [k: string]: unknown }[]

function Tile({ index }: { index: number }) {
  const { copy } = useLP()
  const t = TILES[index]
  const f = copy.features.tabs[index]
  const { ref, ...demo } = useDemoLoop(t.period)
  const Icon = t.icon
  const Demo = t.Demo

  // Spotlight follows the pointer through CSS variables — no re-render.
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <motion.article
      className={`sr-tile${'wide' in t ? ' sr-tile-wide' : ''}${'tall' in t ? ' sr-tile-tall' : ''}`}
      style={{ gridArea: t.area }}
      onPointerMove={onMove}
      initial={demo.reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay: (index % 3) * 0.08, ease: EASE }}
    >
      <Clay name={t.clay} size={'wide' in t || 'tall' in t ? 150 : 124} delay={index * 0.45} className="sr-tile-clay" />
      <div className="sr-tile-copy">
        <span className="sr-tile-label">
          <span className="sr-tile-icon"><Icon size={16} aria-hidden="true" /></span>
          {f.label}
        </span>
        <h3 className="sr-h3" style={{ fontSize: 'clamp(20px, 1.7vw, 24px)' }}>{f.headline}</h3>
        <p className="sr-tile-body">{f.body}</p>
        <ul className="sr-tile-points">
          {f.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <div ref={ref} className="sr-tile-visual" aria-hidden="true">
        {/* Remount once reduced motion is known, so the demo renders in its final state */}
        <Demo key={String(demo.reduced)} {...demo} />
      </div>
    </motion.article>
  )
}

export function Features() {
  const { copy } = useLP()
  return (
    <section id="features" className="sr-section sr-features2" aria-labelledby="sr-features-title">
      <div className="sr-container">
        <SectionHead eyebrow={copy.features.eyebrow} heading={copy.features.heading} sub={copy.features.sub} center id="sr-features-title" />
        <div className="sr-bento">
          {TILES.map((t, i) => (
            <Tile key={t.area} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
