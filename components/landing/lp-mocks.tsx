'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Marketing product mockups — pure visual demonstrations for the landing page.
// These render fake, hard-coded demo data and are NOT connected to the real
// dashboard, database or any API. Product UI is shown in French (the app's
// primary language), so mocks are forced dir="ltr" even on the Arabic page.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { LayoutDashboard, BedDouble, Users, Wallet, BarChart3, MessageCircle, Bell } from 'lucide-react'
import { T, emeraldGrad, CheckIcon } from './lp-shared'

// Product-UI palette (matches the app)
const P = {
  ink: '#0A1F1C',
  muted: '#5F6F6A',
  faint: '#94A29D',
  line: '#EAEEEC',
  surface: '#F6F8F7',
  teal: T.teal,
  mint: T.mint,
  tint: 'rgba(15,110,86,0.08)',
  amber: '#B45309',
  amberSoft: '#FCEFC7',
  booking: '#0B5AA5',
  bookingSoft: '#E7F0FA',
  hostelworld: '#E05B2B',
  hostelworldSoft: '#FCECE4',
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

function useStep(count: number, interval = 1600, enabled = true) {
  const [step, setStep] = useState(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!enabled || reduced) return
    const id = setInterval(() => setStep((s) => (s + 1) % count), interval)
    return () => clearInterval(id)
  }, [count, interval, enabled, reduced])
  return reduced ? count - 1 : step
}

function Enter({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      style={style}
    >
      {children}
    </motion.div>
  )
}

function SourceBadge({ source }: { source: 'booking' | 'hostelworld' | 'direct' }) {
  const map = {
    booking: { label: 'Booking.com', bg: P.bookingSoft, fg: P.booking },
    hostelworld: { label: 'Hostelworld', bg: P.hostelworldSoft, fg: P.hostelworld },
    direct: { label: 'Direct', bg: P.tint, fg: P.teal },
  }
  const s = map[source]
  return (
    <span style={{ fontSize: 8.5, fontWeight: 700, color: s.fg, background: s.bg, padding: '2.5px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function Avatar({ name, hue }: { name: string; hue: 'teal' | 'blue' | 'orange' }) {
  const map = {
    teal: { bg: P.tint, fg: P.teal },
    blue: { bg: P.bookingSoft, fg: P.booking },
    orange: { bg: P.hostelworldSoft, fg: P.hostelworld },
  }
  const c = map[hue]
  return (
    <span
      style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: c.bg, color: c.fg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 800,
      }}
    >
      {name[0]}
    </span>
  )
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: P.faint }}>
      {children}
    </div>
  )
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${P.line}`, borderRadius: 14, padding: 13, boxShadow: '0 1px 2px rgba(10,31,28,0.03)', ...style }}>
      {children}
    </div>
  )
}

function Spark({ color = P.mint, delay = 0 }: { color?: string; delay?: number }) {
  return (
    <svg width="46" height="18" viewBox="0 0 46 18" aria-hidden="true">
      <motion.path
        d="M1,14 C6,13 8,8 13,9 C18,10 20,5 25,5 C30,5 32,9 37,7 C41,5.5 43,3 45,2"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay, ease: EASE }}
      />
    </svg>
  )
}

// ── Hero dashboard mock ─────────────────────────────────────────────────────
export function HeroDashboardMock() {
  const reduced = useReducedMotion()
  const [toast, setToast] = useState(false)

  // Recurring "new reservation" toast — the memorable live moment.
  // With reduced motion it renders statically (see showToast below).
  useEffect(() => {
    if (reduced) return
    let hide: ReturnType<typeof setTimeout>
    const show = () => {
      setToast(true)
      hide = setTimeout(() => setToast(false), 3600)
    }
    const first = setTimeout(show, 2200)
    const loop = setInterval(show, 7500)
    return () => {
      clearTimeout(first)
      clearTimeout(hide)
      clearInterval(loop)
    }
  }, [reduced])

  const showToast = toast || reduced

  const sideItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', active: true },
    { icon: BedDouble, label: 'Plan des lits', active: false },
    { icon: Users, label: 'Clients', active: false },
    { icon: Wallet, label: 'Paiements', active: false },
    { icon: BarChart3, label: 'Rapports', active: false },
    { icon: MessageCircle, label: 'WhatsApp', active: false },
  ]
  const arrivals = [
    { name: 'Lena Hoffmann', bed: 'Dortoir A · A3 · 14:30', source: 'booking' as const, hue: 'blue' as const },
    { name: 'Omar El Idrissi', bed: 'Chambre 1 · 15:00', source: 'direct' as const, hue: 'teal' as const },
    { name: 'Jack Miller', bed: 'Dortoir B · B2 · 17:45', source: 'hostelworld' as const, hue: 'orange' as const },
  ]
  const payments = [
    { who: 'L. Hoffmann', amount: '540 MAD', method: 'Espèces' },
    { who: 'O. El Idrissi', amount: '820 MAD', method: 'CMI' },
    { who: 'M. Dubois', amount: '360 MAD', method: 'Virement' },
  ]
  const housekeeping = [
    { bed: 'A5 · À nettoyer', tone: 'amber' },
    { bed: 'B4 · À nettoyer', tone: 'amber' },
    { bed: 'C1 · Prêt', tone: 'green' },
  ]
  const calRows: Array<{ bed: string; bars: Array<[number, number, 'booking' | 'hostelworld' | 'direct']> }> = [
    { bed: 'A1', bars: [[0, 3, 'booking'], [4, 3, 'direct']] },
    { bed: 'A2', bars: [[1, 4, 'hostelworld']] },
    { bed: 'A3', bars: [[0, 2, 'direct'], [3, 4, 'booking']] },
    { bed: 'B1', bars: [[2, 5, 'booking']] },
    { bed: 'B2', bars: [[0, 4, 'direct']] },
  ]
  const barColor = { booking: P.booking, hostelworld: P.hostelworld, direct: P.mint }

  return (
    <div dir="ltr" className="lm-mock-frame" role="img" aria-label="Aperçu du tableau de bord Sweet Reservation (données de démonstration)">
      {/* Browser chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${P.line}`, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: P.faint, background: P.surface, border: `1px solid ${P.line}`, borderRadius: 8, padding: '3px 16px' }}>
            🔒 sweetreservation.com/dashboard
          </span>
        </div>
        <Bell size={12} color={P.faint} aria-hidden="true" />
      </div>

      <div style={{ display: 'flex', position: 'relative', background: P.surface }}>
        {/* Sidebar */}
        <div className="lm-mock-side" style={{ width: 168, flexShrink: 0, borderRight: `1px solid ${P.line}`, background: 'rgba(255,255,255,0.7)', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 8px 12px' }}>
            <span style={{ width: 22, height: 22, borderRadius: 7, background: emeraldGrad, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8.5C3 6 4.5 4 8 4C11.5 4 13 6 13 8.5C13 11 11 13 8 13C5 13 3 11 3 8.5Z" fill="white" opacity="0.94" />
                <rect x="6" y="3" width="4" height="2" rx="1" fill="white" />
              </svg>
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: P.ink, letterSpacing: '-0.01em' }}>Sweet Reservation</span>
          </div>
          {sideItems.map((it) => (
            <div
              key={it.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 9,
                fontSize: 10.5, fontWeight: it.active ? 700 : 500,
                background: it.active ? P.tint : 'transparent',
                color: it.active ? P.teal : P.muted,
              }}
            >
              <it.icon size={12} strokeWidth={2.2} aria-hidden="true" />
              {it.label}
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: P.ink, letterSpacing: '-0.02em' }}>Tableau de bord</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 8.5, fontWeight: 700, color: P.teal, background: P.tint, borderRadius: 999, padding: '3px 9px' }}>
              <motion.span
                animate={reduced ? undefined : { opacity: [1, 0.35, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: P.mint }}
              />
              En direct
            </span>
          </div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'Occupation ce soir', val: '21/26', sub: '81 %', spark: true },
              { label: 'Revenus du jour', val: '4 320 MAD', sub: '+12 %', spark: true },
              { label: 'Arrivées', val: '3', sub: 'aujourd’hui', spark: false },
              { label: 'Départs', val: '2', sub: 'avant 11h', spark: false },
            ].map((k, i) => (
              <Enter key={k.label} delay={0.35 + i * 0.08}>
                <Panel style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 8, color: P.faint, marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{k.label}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: P.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.val}</div>
                      <div style={{ fontSize: 8, color: i < 2 ? P.teal : P.faint, marginTop: 4, fontWeight: i < 2 ? 700 : 500 }}>{k.sub}</div>
                    </div>
                    {k.spark && <Spark delay={0.6 + i * 0.1} />}
                  </div>
                </Panel>
              </Enter>
            ))}
          </div>

          {/* Calendar strip */}
          <Enter delay={0.65}>
            <Panel>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                <MiniLabel>Calendrier des lits — 7 jours</MiniLabel>
                <div style={{ display: 'flex', gap: 9 }}>
                  {[
                    { c: P.mint, l: 'Direct' },
                    { c: P.booking, l: 'Booking.com' },
                    { c: P.hostelworld, l: 'Hostelworld' },
                  ].map((s) => (
                    <span key={s.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 8, color: P.muted, fontWeight: 600 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2.5, background: s.c }} />
                      {s.l}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {calRows.map((row, ri) => (
                  <div key={row.bed} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 7, alignItems: 'center' }}>
                    <span style={{ fontSize: 8.5, fontWeight: 800, color: P.muted }}>{row.bed}</span>
                    <div style={{ position: 'relative', height: 13, background: P.surface, borderRadius: 5 }}>
                      {row.bars.map(([start, span, src], bi) => (
                        <motion.span
                          key={bi}
                          initial={{ scaleX: 0, opacity: 0 }}
                          whileInView={{ scaleX: 1, opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, delay: 0.8 + ri * 0.05 + bi * 0.04, ease: EASE }}
                          style={{
                            position: 'absolute',
                            left: `${(start / 7) * 100}%`,
                            width: `calc(${(span / 7) * 100}% - 3px)`,
                            top: 2, bottom: 2,
                            borderRadius: 4,
                            background: barColor[src],
                            transformOrigin: 'left',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </Enter>

          {/* Bottom: arrivals + payments/housekeeping */}
          <div className="lm-mock-cols" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 8 }}>
            <Enter delay={0.9}>
              <Panel style={{ height: '100%' }}>
                <div style={{ marginBottom: 8 }}><MiniLabel>Arrivées du jour</MiniLabel></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {arrivals.map((a) => (
                    <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: P.surface, borderRadius: 10 }}>
                      <Avatar name={a.name} hue={a.hue} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                        <div style={{ fontSize: 8, color: P.faint }}>{a.bed}</div>
                      </div>
                      <SourceBadge source={a.source} />
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: '#fff', background: emeraldGrad, borderRadius: 999, padding: '3.5px 10px', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(15,110,86,0.3)' }}>
                        Check-in
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </Enter>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Enter delay={1.0}>
                <Panel>
                  <div style={{ marginBottom: 7 }}><MiniLabel>Paiements récents</MiniLabel></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {payments.map((p) => (
                      <div key={p.who} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 8.5 }}>
                        <span style={{ color: P.muted, fontWeight: 600 }}>{p.who} <span style={{ color: P.faint, fontWeight: 400 }}>· {p.method}</span></span>
                        <span style={{ fontWeight: 800, color: P.teal }}>{p.amount}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </Enter>
              <Enter delay={1.1}>
                <Panel>
                  <div style={{ marginBottom: 7 }}><MiniLabel>Ménage</MiniLabel></div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {housekeeping.map((h) => (
                      <span
                        key={h.bed}
                        style={{
                          fontSize: 8.5, fontWeight: 700, padding: '3.5px 9px', borderRadius: 999,
                          background: h.tone === 'amber' ? P.amberSoft : P.tint,
                          color: h.tone === 'amber' ? P.amber : P.teal,
                        }}
                      >
                        {h.bed}
                      </span>
                    ))}
                  </div>
                </Panel>
              </Enter>
            </div>
          </div>
        </div>

        {/* Live "new reservation" toast */}
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              style={{
                position: 'absolute', bottom: 12, right: 12,
                display: 'flex', alignItems: 'center', gap: 9,
                background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)',
                border: `1px solid ${P.line}`, borderRadius: 13,
                padding: '9px 13px',
                boxShadow: '0 8px 28px rgba(10,31,28,0.16)',
              }}
            >
              <span style={{ width: 26, height: 26, borderRadius: 9, background: P.bookingSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: P.booking }}>
                B.
              </span>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: P.ink }}>Nouvelle réservation</div>
                <div style={{ fontSize: 8.5, color: P.muted }}>Booking.com · Lit B3 · 2 nuits</div>
              </div>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: P.mint, marginLeft: 2 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Tour mock: reservations calendar ───────────────────────────────────────
export function CalendarMock() {
  const rows: Array<{ bed: string; bars: Array<[number, number, 'booking' | 'hostelworld' | 'direct', string]> }> = [
    { bed: 'A1', bars: [[0, 3, 'booking', 'L. Hoffmann'], [4, 3, 'direct', 'S. Alaoui']] },
    { bed: 'A2', bars: [[1, 4, 'hostelworld', 'J. Miller']] },
    { bed: 'A3', bars: [[0, 2, 'direct', 'M. Dubois'], [3, 3, 'booking', 'A. Rossi']] },
    { bed: 'A4', bars: [[2, 4, 'booking', 'K. Tanaka']] },
    { bed: 'B1', bars: [[0, 5, 'direct', 'Y. Benjelloun']] },
    { bed: 'B2', bars: [[1, 3, 'hostelworld', 'E. Novak'], [5, 2, 'direct', 'R. García']] },
    { bed: 'B3', bars: [[3, 4, 'booking', 'T. Schmidt']] },
  ]
  const barColor = { booking: P.booking, hostelworld: P.hostelworld, direct: P.mint }
  const days = ['Lun 12', 'Mar 13', 'Mer 14', 'Jeu 15', 'Ven 16', 'Sam 17', 'Dim 18']
  return (
    <div dir="ltr" style={{ padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 8, marginBottom: 7 }}>
        <span />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((d) => (
            <span key={d} style={{ fontSize: 8.5, fontWeight: 700, color: P.faint, textAlign: 'center' }}>{d}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row, ri) => (
          <div key={row.bed} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: P.muted }}>{row.bed}</span>
            <div style={{ position: 'relative', height: 22, background: P.surface, borderRadius: 7 }}>
              {row.bars.map(([start, span, src, guest], bi) => (
                <motion.span
                  key={bi}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.45, delay: 0.1 + ri * 0.06, ease: EASE }}
                  style={{
                    position: 'absolute',
                    left: `${(start / 7) * 100}%`,
                    width: `calc(${(span / 7) * 100}% - 3px)`,
                    top: 2.5, bottom: 2.5,
                    borderRadius: 6,
                    background: barColor[src],
                    transformOrigin: 'left',
                    display: 'flex', alignItems: 'center',
                    overflow: 'hidden',
                    paddingInline: 7,
                    boxShadow: '0 1px 3px rgba(10,31,28,0.12)',
                  }}
                >
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{guest}</span>
                </motion.span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
        {[
          { c: P.mint, l: 'Direct · 0 % commission' },
          { c: P.booking, l: 'Booking.com · 15 %' },
          { c: P.hostelworld, l: 'Hostelworld · 12 %' },
        ].map((s) => (
          <span key={s.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: P.muted, fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2.5, background: s.c }} />
            {s.l}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Tour mock: digital pre-check-in (phone) ────────────────────────────────
export function CheckinMock() {
  const step = useStep(4, 1500)
  const fields = [
    { label: 'Nom complet', value: 'Lena Hoffmann' },
    { label: 'N° de passeport', value: 'C01X45T89' },
    { label: 'Nationalité', value: 'Allemande' },
  ]
  return (
    <div dir="ltr" style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px' }}>
      <div style={{
        width: 210, borderRadius: 26, border: `1px solid ${P.line}`, background: '#fff',
        boxShadow: '0 16px 40px rgba(10,31,28,0.12)', overflow: 'hidden',
      }}>
        <div style={{ height: 20, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
          <span style={{ width: 58, height: 5.5, borderRadius: 999, background: P.line }} />
        </div>
        <div style={{ padding: '12px 15px 18px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: P.ink, marginBottom: 2, letterSpacing: '-0.01em' }}>Check-in en ligne</div>
          <div style={{ fontSize: 9, color: P.faint, marginBottom: 11 }}>Auberge Atlas · arrivée 14/07</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fields.map((f, i) => (
              <div key={f.label}>
                <div style={{ fontSize: 7.5, fontWeight: 700, color: P.faint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3.5 }}>{f.label}</div>
                <div style={{
                  border: `1.5px solid ${step > i ? P.mint : P.line}`, borderRadius: 10,
                  padding: '7px 9px', fontSize: 9.5, color: P.ink, fontWeight: 600,
                  background: step > i ? 'rgba(22,163,125,0.05)' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color 0.3s, background 0.3s',
                  minHeight: 28,
                }}>
                  <span>{step > i ? f.value : ''}</span>
                  {step > i && <CheckIcon size={10} color={P.mint} />}
                </div>
              </div>
            ))}
            <motion.div
              animate={{ opacity: step === 3 ? 1 : 0.5 }}
              style={{
                marginTop: 5, textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#fff',
                background: emeraldGrad, borderRadius: 999, padding: '9px 0',
                boxShadow: '0 4px 12px rgba(15,110,86,0.3)',
              }}
            >
              {step === 3 ? 'Envoyé ✓' : 'Envoyer mes informations'}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tour mock: police form PDF ─────────────────────────────────────────────
export function PoliceMock() {
  const rows = [
    ['Nom complet', 'HOFFMANN Lena'],
    ['Nationalité', 'Allemande'],
    ['N° passeport', 'C01X45T89'],
    ['Date d’arrivée', '14/07/2026'],
    ['Adresse au Maroc', 'Auberge Atlas, Agadir'],
    ['Destination suivante', 'Essaouira'],
  ]
  return (
    <div dir="ltr" style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px' }}>
      <div style={{ position: 'relative', width: 262 }}>
        <motion.div
          initial={{ rotate: 0 }}
          whileInView={{ rotate: -3 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{
            position: 'absolute', inset: 0, background: '#fff', borderRadius: 12,
            border: `1px solid ${P.line}`, boxShadow: '0 8px 24px rgba(10,31,28,0.08)',
          }}
          aria-hidden="true"
        />
        <div style={{
          position: 'relative', background: '#fff', borderRadius: 12, border: `1px solid ${P.line}`,
          boxShadow: '0 14px 36px rgba(10,31,28,0.12)', padding: '16px 18px',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 11 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: P.ink, letterSpacing: '0.02em' }}>FICHE DE POLICE · فيشة الشرطة</div>
            <div style={{ fontSize: 8, color: P.faint, marginTop: 2 }}>Auberge Atlas — Préfecture d’Agadir</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map(([k, v], i) => (
              <motion.div
                key={k}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.09 }}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 8,
                  padding: '5.5px 0', borderBottom: i < rows.length - 1 ? `1px solid ${P.surface}` : 'none',
                }}
              >
                <span style={{ fontSize: 8.5, color: P.faint, fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 9, color: P.ink, fontWeight: 700 }}>{v}</span>
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
            whileInView={{ opacity: 1, scale: 1, rotate: -8 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.85, ease: EASE }}
            style={{
              position: 'absolute', right: 13, bottom: 11,
              border: `2px solid ${P.mint}`, color: P.teal, borderRadius: 7,
              fontSize: 9, fontWeight: 800, padding: '3px 9px', letterSpacing: '0.08em',
              background: 'rgba(255,255,255,0.88)',
            }}
          >
            PDF GÉNÉRÉ ✓
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ── Tour mock: WhatsApp thread ─────────────────────────────────────────────
export function WhatsAppMock() {
  const step = useStep(4, 1400)
  const bubbles = [
    { from: 'recv' as const, text: 'Bonjour ! C’est quoi le code WiFi ?', time: '14:03' },
    { from: 'sent' as const, text: 'Bienvenue Lena ! 🏠 WiFi : AtlasGuest\nCheckout : 18/07 avant 11h00', time: '14:03 ✓✓' },
    { from: 'recv' as const, text: 'Merci ! 🙏', time: '14:04' },
  ]
  return (
    <div dir="ltr" style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px' }}>
      <div style={{ width: 250, background: '#F0EBE3', borderRadius: 16, padding: 13, border: `1px solid ${P.line}`, boxShadow: '0 10px 28px rgba(10,31,28,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: emeraldGrad, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>L</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: P.ink }}>Lena Hoffmann</div>
            <div style={{ fontSize: 8.5, color: '#0A7C6A' }}>en ligne</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 132 }}>
          {bubbles.map((b, i) => (
            <motion.div
              key={i}
              initial={false}
              animate={step > i ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              style={{
                alignSelf: b.from === 'sent' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: b.from === 'sent' ? '#DCF5CB' : '#fff',
                borderRadius: b.from === 'sent' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                padding: '7px 10px', fontSize: 10, lineHeight: 1.5, color: P.ink,
                whiteSpace: 'pre-line',
                boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
              }}
            >
              {b.text}
              <div style={{ fontSize: 7.5, color: P.faint, textAlign: 'right', marginTop: 2 }}>{b.time}</div>
            </motion.div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 5 }}>
          {['Bienvenue', 'Rappel solde', 'Avis ⭐'].map((t) => (
            <span key={t} style={{ fontSize: 8.5, fontWeight: 700, color: P.teal, background: '#fff', border: `1px solid rgba(15,110,86,0.25)`, borderRadius: 999, padding: '3.5px 9px' }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tour mock: payments + reconciliation ───────────────────────────────────
export function PaymentsMock() {
  const rows = [
    { who: 'Lena Hoffmann', method: 'Espèces', amount: '540 MAD', state: 'ok' },
    { who: 'Omar El Idrissi', method: 'CMI', amount: '820 MAD', state: 'ok' },
    { who: 'Jack Miller', method: 'Solde restant', amount: '380 MAD', state: 'due' },
    { who: 'Marie Dubois', method: 'Virement', amount: '360 MAD', state: 'ok' },
  ]
  return (
    <div dir="ltr" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Panel>
        <div style={{ marginBottom: 9 }}><MiniLabel>Paiements du jour</MiniLabel></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rows.map((r, i) => (
            <motion.div
              key={r.who}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.08 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}
            >
              <span style={{ color: P.ink, fontWeight: 700 }}>{r.who} <span style={{ color: P.faint, fontWeight: 400 }}>· {r.method}</span></span>
              <span style={{
                fontWeight: 800,
                color: r.state === 'due' ? P.amber : P.teal,
                background: r.state === 'due' ? P.amberSoft : 'transparent',
                borderRadius: 999, padding: r.state === 'due' ? '2px 9px' : 0,
              }}>
                {r.amount}
              </span>
            </motion.div>
          ))}
        </div>
      </Panel>
      <Panel style={{ background: P.surface }}>
        <div style={{ marginBottom: 9 }}><MiniLabel>Réconciliation de caisse</MiniLabel></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
          {[
            { l: 'Attendu', v: '2 140 MAD', c: P.ink },
            { l: 'Compté', v: '2 140 MAD', c: P.ink },
            { l: 'Écart', v: '0 MAD ✓', c: P.teal },
          ].map((x) => (
            <div key={x.l} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${P.line}`, padding: '9px 4px' }}>
              <div style={{ fontSize: 8, color: P.faint, marginBottom: 3 }}>{x.l}</div>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: x.c }}>{x.v}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ── Tour mock: reports ─────────────────────────────────────────────────────
export function ReportsMock() {
  const bars = [46, 58, 40, 72, 64, 88, 100]
  return (
    <div dir="ltr" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { l: 'Occupation', v: '78 %' },
          { l: 'RevPAR', v: '96 MAD' },
          { l: 'Durée moy.', v: '3,2 nuits' },
        ].map((k) => (
          <Panel key={k.l} style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 8.5, color: P.faint, marginBottom: 4 }}>{k.l}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: P.ink, letterSpacing: '-0.02em' }}>{k.v}</div>
          </Panel>
        ))}
      </div>
      <Panel>
        <div style={{ marginBottom: 9 }}><MiniLabel>Revenus — 7 derniers jours</MiniLabel></div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 66 }}>
          {bars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.07, ease: EASE }}
              style={{
                flex: 1, height: `${h}%`, borderRadius: '5px 5px 2px 2px',
                background: i === 6 ? emeraldGrad : 'rgba(22,163,125,0.20)',
                transformOrigin: 'bottom',
              }}
            />
          ))}
        </div>
      </Panel>
      <Panel>
        <div style={{ marginBottom: 9 }}><MiniLabel>Revenu net par canal (après commission)</MiniLabel></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[
            { l: 'Direct', pct: 100, v: '14 400 MAD', c: P.mint },
            { l: 'Booking.com', pct: 82, v: '11 810 MAD', c: P.booking },
            { l: 'Hostelworld', pct: 44, v: '6 340 MAD', c: P.hostelworld },
          ].map((r, i) => (
            <div key={r.l} style={{ display: 'grid', gridTemplateColumns: '66px 1fr 60px', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: P.muted, fontWeight: 700 }}>{r.l}</span>
              <div style={{ height: 9, background: P.surface, borderRadius: 999 }}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${r.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.15 + i * 0.1, ease: EASE }}
                  style={{ height: '100%', borderRadius: 999, background: r.c }}
                />
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, color: P.ink, textAlign: 'right' }}>{r.v}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

// ── Outcome minis ───────────────────────────────────────────────────────────
export function MiniCheckinSteps() {
  const steps = ['Client trouvé', 'Lit A3 choisi', 'Paiement encaissé', 'Terminé']
  const active = useStep(5, 1100)
  return (
    <div dir="ltr" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <motion.span
            animate={{ background: i < active ? P.mint : '#E9EEEC', scale: i === active - 1 ? 1.12 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ width: 18, height: 18, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {i < active && <CheckIcon size={9} />}
          </motion.span>
          <span style={{ fontSize: 12, fontWeight: i < active ? 700 : 500, color: i < active ? P.ink : P.faint, transition: 'color 0.3s' }}>
            {s}
          </span>
          {i === 3 && active > 3 && (
            <span style={{ fontSize: 9.5, fontWeight: 800, color: P.teal, background: P.tint, borderRadius: 999, padding: '2px 9px' }}>58 s</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function MiniPolice() {
  return (
    <div dir="ltr" style={{ position: 'relative', padding: '4px 2px' }}>
      <div style={{ background: '#fff', border: `1px solid ${P.line}`, borderRadius: 11, padding: '10px 12px', boxShadow: '0 4px 14px rgba(10,31,28,0.06)' }}>
        <div style={{ fontSize: 8.5, fontWeight: 800, color: P.ink, marginBottom: 7 }}>FICHE DE POLICE · فيشة الشرطة</div>
        {['HOFFMANN Lena', 'Passeport C01X45T89', 'Auberge Atlas, Agadir'].map((v, i) => (
          <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: i < 2 ? 5 : 0 }}>
            <span style={{ width: 42, height: 5, borderRadius: 999, background: P.surface }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: P.muted }}>{v}</span>
          </div>
        ))}
      </div>
      <span style={{
        position: 'absolute', right: 8, bottom: -7, transform: 'rotate(-6deg)',
        border: `1.5px solid ${P.mint}`, color: P.teal, background: '#fff',
        fontSize: 8, fontWeight: 800, borderRadius: 6, padding: '2.5px 8px', letterSpacing: '0.06em',
      }}>
        AUTO-REMPLIE ✓
      </span>
    </div>
  )
}

export function MiniCalendar() {
  const cells: Array<'e' | 'b' | 'h' | ''> = ['e', 'e', '', 'b', 'b', 'b', '', 'h', 'h', 'e', 'e', '', 'b', 'b', 'e', '', 'e', 'e', 'h', 'h', 'b', '', 'e', 'b']
  const color = { e: P.mint, b: P.booking, h: P.hostelworld, '': P.surface }
  return (
    <div dir="ltr" style={{ padding: '4px 2px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4.5 }}>
        {cells.map((c, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.25, delay: i * 0.02 }}
            style={{ aspectRatio: '1.5', borderRadius: 5, background: color[c], opacity: c === '' ? 1 : 0.92 }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        {[{ c: P.mint, l: 'Direct' }, { c: P.booking, l: 'Booking' }, { c: P.hostelworld, l: 'Hostelworld' }].map((s) => (
          <span key={s.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: P.muted, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2.5, background: s.c }} />
            {s.l}
          </span>
        ))}
      </div>
    </div>
  )
}

export function MiniReconcile() {
  return (
    <div dir="ltr" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 2px' }}>
      {[
        { l: 'Espèces attendues', v: '2 140 MAD', strong: false },
        { l: 'Espèces comptées', v: '2 140 MAD', strong: false },
        { l: 'Écart', v: '0 MAD ✓', strong: true },
      ].map((r) => (
        <div
          key={r.l}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 11, padding: '7px 11px', borderRadius: 10,
            background: r.strong ? P.tint : P.surface,
          }}
        >
          <span style={{ color: r.strong ? P.teal : P.muted, fontWeight: r.strong ? 800 : 500 }}>{r.l}</span>
          <span style={{ fontWeight: 800, color: r.strong ? P.teal : P.ink }}>{r.v}</span>
        </div>
      ))}
    </div>
  )
}
