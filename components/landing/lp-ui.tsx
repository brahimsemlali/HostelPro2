'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Product-UI previews for the landing page. They mirror real Sweet Reservation
// screens (bed map, dashboard, check-in, fiche de police, WhatsApp, payments)
// but are static marketing renderings filled with demo data — never connected
// to the app or the database.
// ─────────────────────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion'
import {
  BedDouble,
  CalendarDays,
  Check,
  CreditCard,
  LayoutGrid,
  BarChart3,
  Wallet,
  Sparkles,
} from 'lucide-react'
import { useLP, EASE, useReducedMotion } from './lp-shared'
import {
  DEMO_ROOMS,
  DEMO_ARRIVALS,
  DEMO_PAYMENTS,
  DEMO_REVENUE_7D,
  TOTAL_BEDS,
  TONIGHT_BEDS,
  STATUS_COLORS,
  formatMAD,
  type BedStatus,
} from './lp-data'

const SOURCE_TINT: Record<string, { bg: string; fg: string }> = {
  'Booking.com': { bg: 'rgba(43,92,190,0.10)', fg: '#2B5CBE' },
  Hostelworld: { bg: 'rgba(234,88,12,0.10)', fg: '#C2410C' },
  Direct: { bg: 'rgba(10, 31, 28,0.07)', fg: '#0A1F1C' },
  WhatsApp: { bg: 'rgba(37,160,90,0.12)', fg: '#1C7A45' },
}

export function SourceChip({ source }: { source: string }) {
  const t = SOURCE_TINT[source] ?? SOURCE_TINT.Direct
  return (
    <span className="sr-chip" style={{ background: t.bg, color: t.fg }}>
      {source}
    </span>
  )
}

function Initials({ name, tone = 0 }: { name: string; tone?: number }) {
  const tones = ['#BFE8D9', '#E3E8EA', '#C9D6EE', '#F3D9A4']
  const parts = name.split(' ')
  return (
    <span
      aria-hidden="true"
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: tones[tone % tones.length],
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11.5,
        fontWeight: 700,
        color: '#0A1F1C',
        flexShrink: 0,
      }}
    >
      {parts[0][0]}
      {parts[1]?.[0]}
    </span>
  )
}

function useStatusLabel() {
  const { copy } = useLP()
  return (s: BedStatus) =>
    s === 'occupied' ? copy.ui.statuses.occupied : s === 'free' ? copy.ui.statuses.available : s === 'dirty' ? copy.ui.statuses.dirty : copy.ui.statuses.arriving
}

// ── Floating story cards (hero) ────────────────────────────────────────────
export function BookingCard({ confirmed = true }: { confirmed?: boolean }) {
  const { copy } = useLP()
  const b = copy.hero.booking
  return (
    <div className="sr-ui sr-float-card" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <span className="sr-label">{b.label}</span>
        <SourceChip source={b.source} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Initials name={b.guest} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{b.guest}</div>
          <div style={{ fontSize: 12.5, color: 'var(--sr-muted)' }}>{b.stay}</div>
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--sr-line-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
          <BedDouble size={15} aria-hidden="true" />
          {b.bed}
        </span>
        <span
          className="sr-chip"
          style={{
            background: confirmed ? 'var(--sr-ink)' : 'rgba(10, 31, 28,0.06)',
            color: confirmed ? 'var(--sr-bg)' : 'var(--sr-muted)',
            transition: 'background 0.4s, color 0.4s',
          }}
        >
          <Check size={12} strokeWidth={3} aria-hidden="true" />
          {b.confirmed}
        </span>
      </div>
    </div>
  )
}

export function StatusCard({ ready = true }: { ready?: boolean }) {
  const { copy } = useLP()
  const s = copy.hero.status
  return (
    <div className="sr-ui sr-float-card" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600 }}>
          <Sparkles size={15} aria-hidden="true" style={{ color: 'var(--sr-accent-ink)' }} />
          {s.label}
        </span>
        <span className="sr-label">{copy.ui.rooms[1]}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
        <span
          className="sr-chip"
          style={{ justifyContent: 'center', background: 'rgba(232,182,90,0.22)', color: '#7A5512', opacity: ready ? 0.45 : 1, textDecoration: ready ? 'line-through' : 'none', transition: 'opacity 0.4s' }}
        >
          <span className="sr-dot" style={{ background: STATUS_COLORS.dirty }} />
          {s.from}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--sr-faint)' }}>→</span>
        <span
          className="sr-chip"
          style={{
            justifyContent: 'center',
            background: ready ? 'var(--sr-ink)' : 'rgba(10, 31, 28,0.05)',
            color: ready ? 'var(--sr-bg)' : 'var(--sr-faint)',
            transition: 'background 0.4s, color 0.4s',
          }}
        >
          <Check size={12} strokeWidth={3} aria-hidden="true" />
          {s.to}
        </span>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--sr-muted)' }}>{s.by}</div>
    </div>
  )
}

export function OpsGrid() {
  const { copy } = useLP()
  const o = copy.hero.ops
  const pct = Math.round((TONIGHT_BEDS / TOTAL_BEDS) * 100)
  const items = [
    { label: o.occupancy, value: `${pct} %`, sub: `${TONIGHT_BEDS} / ${TOTAL_BEDS}` },
    { label: o.arrivals, value: '6', sub: DEMO_ARRIVALS.slice(0, 2).map((a) => a.name.split(' ')[0]).join(', ') + '…' },
    { label: o.cash, value: formatMAD(2340), sub: `${copy.ui.cash} · ${copy.ui.transfer} · ${copy.ui.card}` },
    { label: o.police, value: '4', sub: 'PDF · FR / AR' },
  ]
  return (
    <div className="sr-ui" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {items.map((it) => (
        <div key={it.label} className="sr-float-card" style={{ padding: '14px 16px' }}>
          <div className="sr-label" style={{ marginBottom: 6 }}>{it.label}</div>
          <div className="sr-mono" style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.03em' }}>{it.value}</div>
          <div style={{ fontSize: 11.5, color: 'var(--sr-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ── Bed map ─────────────────────────────────────────────────────────────────
export function BedMap({ compact = false, overrides }: { compact?: boolean; overrides?: Record<string, BedStatus> }) {
  const { copy } = useLP()
  return (
    <div className={`sr-ui sr-bedmap${compact ? ' sr-bedmap-compact' : ''}`}>
      {DEMO_ROOMS.map((room, ri) => (
        <div key={room.key} className="sr-card" style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{copy.ui.rooms[ri]}</span>
            <span style={{ fontSize: 11, color: 'var(--sr-faint)' }} className="sr-mono">
              {room.beds.filter((b) => (overrides?.[b.name] ?? b.status) !== 'free').length}/{room.beds.length}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 6 }}>
            {room.beds.map((b) => (
              <div key={b.name} className="sr-bed" data-s={overrides?.[b.name] ?? b.status}>
                {b.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function BedLegend({ dark = false }: { dark?: boolean }) {
  const label = useStatusLabel()
  const statuses: BedStatus[] = ['occupied', 'arriving', 'dirty', 'free']
  return (
    <div className="sr-ui" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 12, color: dark ? 'var(--sr-on-dark)' : 'var(--sr-muted)' }}>
      {statuses.map((s) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="sr-dot" style={{ background: STATUS_COLORS[s], boxShadow: s === 'free' ? 'inset 0 0 0 1px rgba(10, 31, 28,0.25)' : undefined }} />
          {label(s)}
        </span>
      ))}
    </div>
  )
}

// ── Lists ───────────────────────────────────────────────────────────────────
export function ArrivalsList({ max = 4 }: { max?: number }) {
  const { copy } = useLP()
  return (
    <div className="sr-ui sr-card" style={{ padding: 6 }}>
      {DEMO_ARRIVALS.slice(0, max).map((a, i) => (
        <div
          key={a.name}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            alignItems: 'center',
            gap: 12,
            padding: '10px 10px',
            borderTop: i ? '1px solid var(--sr-line-soft)' : undefined,
          }}
        >
          <Initials name={a.name} tone={i} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {a.name} <span style={{ color: 'var(--sr-faint)', fontWeight: 500 }}>· {a.country}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3, fontSize: 12, color: 'var(--sr-muted)' }}>
              <span className="sr-mono">{a.time}</span>
              <span>·</span>
              <span>{a.bed}</span>
              <SourceChip source={a.source} />
            </div>
          </div>
          <span
            className="sr-chip"
            style={{
              background: a.paid === 'paid' ? 'rgba(37,160,90,0.12)' : 'rgba(232,182,90,0.22)',
              color: a.paid === 'paid' ? '#1C7A45' : '#7A5512',
            }}
          >
            {a.paid === 'paid' ? copy.ui.paid : copy.ui.partial}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PaymentsList() {
  const { copy } = useLP()
  const methodLabel = { cash: copy.ui.cash, transfer: copy.ui.transfer, card: copy.ui.card }
  const MethodIcon = { cash: Wallet, transfer: CreditCard, card: CreditCard }
  const totals = DEMO_PAYMENTS.reduce(
    (acc, p) => ({ ...acc, [p.method]: acc[p.method] + p.amount }),
    { cash: 0, transfer: 0, card: 0 } as Record<'cash' | 'transfer' | 'card', number>,
  )
  return (
    <div className="sr-ui" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="sr-card" style={{ padding: 6 }}>
        {DEMO_PAYMENTS.map((p, i) => {
          const Icon = MethodIcon[p.method]
          return (
            <div
              key={`${p.name}-${p.time}`}
              style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', padding: '9px 10px', borderTop: i ? '1px solid var(--sr-line-soft)' : undefined }}
            >
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--sr-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} aria-hidden="true" />
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--sr-muted)' }}>
                  <span className="sr-mono">{p.time}</span> · {methodLabel[p.method]}
                </div>
              </div>
              <span className="sr-mono" style={{ fontWeight: 600, fontSize: 13 }}>{formatMAD(p.amount)}</span>
            </div>
          )
        })}
      </div>
      <div className="sr-card" style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, auto)', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
        {(['cash', 'transfer', 'card'] as const).map((m) => (
          <div key={m}>
            <div style={{ color: 'var(--sr-muted)' }}>{methodLabel[m]}</div>
            <div className="sr-mono" style={{ fontWeight: 600 }}>{formatMAD(totals[m])}</div>
          </div>
        ))}
        <div>
          <div style={{ color: 'var(--sr-muted)' }}>{copy.ui.total}</div>
          <div className="sr-mono" style={{ fontWeight: 700 }}>{formatMAD(2340)}</div>
        </div>
      </div>
    </div>
  )
}

export function RevenueBars({ height = 96 }: { height?: number }) {
  const max = Math.max(...DEMO_REVENUE_7D)
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {DEMO_REVENUE_7D.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            borderRadius: 6,
            background: i === DEMO_REVENUE_7D.length - 1 ? 'var(--sr-accent)' : 'rgba(10, 31, 28,0.12)',
          }}
        />
      ))}
    </div>
  )
}

// ── Full dashboard ─────────────────────────────────────────────────────────
export type DashView = 0 | 1 | 2

export function Dashboard({ view = 0 }: { view?: DashView }) {
  const { copy } = useLP()
  const reduced = useReducedMotion()
  const navIcons = [LayoutGrid, BedDouble, CalendarDays, Wallet, BarChart3]
  const activeNav = view === 0 ? 1 : view === 1 ? 0 : 3
  const pct = Math.round((TONIGHT_BEDS / TOTAL_BEDS) * 100)
  const metrics = [
    { label: copy.ui.occupancy, value: `${pct} %`, sub: `${TONIGHT_BEDS}/${TOTAL_BEDS} · ${copy.ui.tonight}` },
    { label: copy.ui.revenue, value: formatMAD(2340), sub: `${copy.ui.cash} 1 040` },
    { label: copy.ui.arrivals, value: '6', sub: '2 · 14:00 → 17:00' },
    { label: copy.ui.pending, value: formatMAD(860), sub: '3 · WhatsApp' },
  ]
  return (
    <div className="sr-ui sr-dash">
      <aside className="sr-dash-side">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 18px' }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--sr-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sr-accent)', fontWeight: 700, fontSize: 12 }}>
            SR
          </span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{copy.ui.property}</span>
        </div>
        {copy.ui.nav.map((n, i) => {
          const Icon = navIcons[i]
          return (
            <div key={n} className="sr-dash-nav" data-active={i === activeNav}>
              <Icon size={15} aria-hidden="true" />
              {n}
            </div>
          )
        })}
      </aside>
      <div className="sr-dash-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>{copy.ui.nav[activeNav]}</div>
            <div style={{ fontSize: 12, color: 'var(--sr-muted)' }}>{copy.ui.today}</div>
          </div>
          <span className="sr-demo-tag">{copy.demo}</span>
        </div>
        <div className="sr-metrics">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className="sr-card sr-metric"
              style={{
                boxShadow: i === [0, 2, 1][view] ? '0 0 0 1.5px var(--sr-accent), var(--sr-shadow-1)' : undefined,
                transition: 'box-shadow 0.4s',
              }}
            >
              <span className="sr-label">{m.label}</span>
              <b>{m.value}</b>
              <span style={{ fontSize: 11.5, color: 'var(--sr-muted)' }}>{m.sub}</span>
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 300 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={reduced ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduced ? undefined : { opacity: 0, y: -10, filter: 'blur(6px)' }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {view === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <BedMap />
                  <BedLegend />
                </div>
              )}
              {view === 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 12 }} className="sr-dash-split">
                  <ArrivalsList />
                  <div className="sr-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span className="sr-label">{copy.ui.departures}</span>
                    {['Sofia Rossi · B1', 'Tom Becker · S2', 'Inès Benali · C1'].map((d) => (
                      <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                        <span className="sr-dot" style={{ background: STATUS_COLORS.dirty }} />
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {view === 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 12 }} className="sr-dash-split">
                  <PaymentsList />
                  <div className="sr-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span className="sr-label">7 j · MAD</span>
                    <RevenueBars height={150} />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ── Journey / feature previews ─────────────────────────────────────────────
export const CHECKIN_FIELDS = {
  fr: [['Nom', 'HOFFMANN Lena'], ['Nationalité', 'Allemagne'], ['Passeport', 'C01X00T47'], ['Destination suivante', 'Essaouira']],
  en: [['Name', 'HOFFMANN Lena'], ['Nationality', 'Germany'], ['Passport', 'C01X00T47'], ['Next destination', 'Essaouira']],
  ar: [['الاسم', 'HOFFMANN Lena'], ['الجنسية', 'ألمانيا'], ['جواز السفر', 'C01X00T47'], ['الوجهة التالية', 'الصويرة']],
}
