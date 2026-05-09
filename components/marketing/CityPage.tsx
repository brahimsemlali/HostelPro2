'use client'

import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { motion } from 'framer-motion'
import type { CityData } from '@/lib/city-data'
import { ALL_CITY_SLUGS } from '@/lib/city-data'
import { CheckCircle2, MapPin, ArrowRight, MessageCircle, FileText, LayoutGrid, BarChart3, Users } from 'lucide-react'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const CITY_NAMES: Record<string, string> = {
  marrakech: 'Marrakech',
  agadir: 'Agadir',
  casablanca: 'Casablanca',
  fes: 'Fès',
  tanger: 'Tanger',
  chefchaouen: 'Chefchaouen',
}

function fadeUpProps(i: number = 0) {
  return {
    initial: { opacity: 0, y: 24, filter: 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
  }
}

const FEATURE_ICONS = [FileText, LayoutGrid, MessageCircle, BarChart3]

interface Props { city: CityData }

export function CityPage({ city }: Props) {
  const otherCities = ALL_CITY_SLUGS.filter((s) => s !== city.slug)

  return (
    <div className={jakarta.className} style={{ background: '#fff', color: '#0E1A1F', overflowX: 'hidden' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 60,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(14,26,31,0.07)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, background: '#21C77A', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5C3 6 4.5 4 8 4C11.5 4 13 6 13 8.5C13 11 11 13 8 13C5 13 3 11 3 8.5Z" fill="white" opacity="0.9"/>
              <rect x="6" y="3" width="4" height="2" rx="1" fill="white"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0E1A1F', letterSpacing: '-0.3px' }}>Sweet Reservation</span>
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/login" style={{ fontSize: 13, fontWeight: 500, color: '#5C6B72', textDecoration: 'none', padding: '7px 14px', borderRadius: 999 }}>
            Connexion
          </Link>
          <Link href="/register" style={{
            fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none',
            padding: '8px 16px', borderRadius: 999, background: '#21C77A',
          }}>
            Essai gratuit
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(160deg, #030f0b 0%, #0a1f1c 50%, #0E1A1F 100%)',
        padding: '80px 24px 90px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(33,199,122,0.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, #000 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, #000 30%, transparent 100%)',
        }} />
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 250, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(33,199,122,0.13) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <motion.div {...fadeUpProps(0)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(33,199,122,0.3)', background: 'rgba(33,199,122,0.08)' }}>
            <MapPin size={12} color="#21C77A" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#21C77A', letterSpacing: '0.04em' }}>{city.name}, {city.region}</span>
          </motion.div>

          <motion.h1 {...fadeUpProps(1)} style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: 20 }}>
            {city.heroTitle}
          </motion.h1>

          <motion.p {...fadeUpProps(2)} style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 36, maxWidth: 580, margin: '0 auto 36px' }}>
            {city.heroSub}
          </motion.p>

          <motion.div {...fadeUpProps(3)} style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none',
                padding: '13px 26px', borderRadius: 14, background: '#21C77A',
                boxShadow: '0 6px 28px rgba(33,199,122,0.4)',
              }}>
                Essai gratuit 14 jours
                <ArrowRight size={16} />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/login" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
                padding: '13px 22px', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
              }}>
                Se connecter
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <section style={{ background: '#F1F9F4', padding: '32px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 0 }}>
          {city.stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              style={{ textAlign: 'center', padding: '16px 24px', borderRight: i < city.stats.length - 1 ? '1px solid rgba(14,26,31,0.08)' : 'none' }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0F6E56', letterSpacing: '-0.02em' }}>{stat.value}</div>
              <div style={{ fontSize: 12.5, color: '#5C6B72', marginTop: 4, fontWeight: 500 }}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Intro ───────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px', maxWidth: 780, margin: '0 auto' }}>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ fontSize: 17, lineHeight: 1.8, color: '#334155', textAlign: 'center' }}
        >
          {city.intro}
        </motion.p>
      </section>

      {/* ── Challenges / Features ────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 48 }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#21C77A', marginBottom: 10 }}>Conçu pour {city.name}</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0E1A1F', letterSpacing: '-0.02em' }}>Ce que Sweet Reservation résout pour vous</h2>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {city.challenges.map((c, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]
              return (
                <motion.div
                  key={c.title}
                  initial={{ opacity: 0, y: 28, filter: 'blur(4px)' }}
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.55, delay: i * 0.08 }}
                  style={{
                    background: '#fff', borderRadius: 20, padding: '28px 28px 24px',
                    border: '1.5px solid #E8EDEF',
                    boxShadow: '0 2px 16px rgba(14,26,31,0.05)',
                  }}
                >
                  <div style={{ width: 40, height: 40, background: 'rgba(33,199,122,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Icon size={18} color="#21C77A" />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0E1A1F', marginBottom: 10, lineHeight: 1.4 }}>{c.title}</h3>
                  <p style={{ fontSize: 13.5, color: '#5C6B72', lineHeight: 1.7 }}>{c.body}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonial ─────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #0a1f1c 0%, #0d2b26 100%)', padding: '72px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}
        >
          <div style={{ fontSize: 48, color: 'rgba(33,199,122,0.4)', lineHeight: 1, marginBottom: 16 }}>&ldquo;</div>
          <blockquote style={{ fontSize: 19, fontWeight: 500, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, marginBottom: 28, fontStyle: 'italic' }}>
            {city.testimonial.quote}
          </blockquote>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #21C77A, #0F6B41)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#fff' }}>
              {city.testimonial.author[0]}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{city.testimonial.author}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{city.testimonial.property}</div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Feature list ────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 40 }}
          >
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0E1A1F', letterSpacing: '-0.02em' }}>
              Tout ce dont votre hostel à {city.name} a besoin
            </h2>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {[
              'Check-in digital en 60 secondes',
              'Fiche de police PDF automatique',
              'Plan des lits en temps réel',
              'Messages WhatsApp en 3 langues',
              'Paiements en MAD (cash, virement, CMI)',
              'Rapports de revenus et occupation',
              'Gestion du staff multi-rôles',
              'Audit de nuit guidé',
              'Sync Booking.com & Hostelworld',
              'Application mobile (PWA)',
              'Inventaire et dépenses',
              'Essai gratuit 14 jours',
            ].map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <CheckCircle2 size={16} color="#21C77A" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#334155' }}>{feature}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      {city.faq.length > 0 && (
        <section style={{ background: '#F8FAFC', padding: '72px 24px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ fontSize: 24, fontWeight: 800, color: '#0E1A1F', textAlign: 'center', marginBottom: 40 }}
            >
              Questions fréquentes — {city.name}
            </motion.h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {city.faq.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', border: '1px solid #E8EDEF' }}
                >
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0E1A1F', marginBottom: 10 }}>{item.q}</p>
                  <p style={{ fontSize: 14, color: '#5C6B72', lineHeight: 1.7 }}>{item.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Other cities ────────────────────────────────────────────────── */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 28 }}
          >
            <div style={{ fontSize: 13, color: '#5C6B72', marginBottom: 16 }}>Sweet Reservation est disponible dans toutes les villes du Maroc</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {otherCities.map((slug) => (
                <Link
                  key={slug}
                  href={`/logiciel-hostel-${slug}`}
                  style={{
                    fontSize: 13, fontWeight: 500, color: '#0F6E56', textDecoration: 'none',
                    padding: '6px 14px', borderRadius: 999,
                    border: '1px solid rgba(15,110,86,0.25)', background: 'rgba(15,110,86,0.04)',
                  }}
                >
                  {CITY_NAMES[slug]}
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 80px' }}>
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            maxWidth: 680, margin: '0 auto',
            background: 'linear-gradient(135deg, #0a1f1c 0%, #0d2b26 100%)',
            borderRadius: 28, padding: '52px 40px', textAlign: 'center',
            border: '1px solid rgba(33,199,122,0.2)',
            boxShadow: '0 24px 60px rgba(14,26,31,0.15)',
          }}
        >
          <Users size={28} color="#21C77A" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: '-0.02em' }}>
            Prêt à moderniser votre hostel à {city.name} ?
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 30, lineHeight: 1.65 }}>
            14 jours gratuits. Sans carte bancaire. Configuration en 5 minutes.
          </p>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link href="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 15, fontWeight: 700, color: '#fff', textDecoration: 'none',
              padding: '14px 28px', borderRadius: 14, background: '#21C77A',
              boxShadow: '0 6px 28px rgba(33,199,122,0.45)',
            }}>
              Commencer gratuitement
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ background: '#0E1A1F', padding: '40px 24px 28px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <div style={{ width: 26, height: 26, background: '#21C77A', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5C3 6 4.5 4 8 4C11.5 4 13 6 13 8.5C13 11 11 13 8 13C5 13 3 11 3 8.5Z" fill="white" opacity="0.9"/>
                <rect x="6" y="3" width="4" height="2" rx="1" fill="white"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Sweet Reservation</span>
          </Link>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Accueil</Link>
            <Link href="/register" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Essai gratuit</Link>
            <Link href="/login" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Connexion</Link>
            <Link href="/blog" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Blog</Link>
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Sweet Reservation — Logiciel gestion hostel {city.name}</span>
        </div>
      </footer>
    </div>
  )
}
