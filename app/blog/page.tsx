import type { Metadata } from 'next'
import Link from 'next/link'
import { BLOG_POSTS } from '@/lib/blog-posts'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Clock, ArrowRight } from 'lucide-react'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Blog — Gestion Hostel & Auberge au Maroc | Sweet Reservation',
  description: 'Guides pratiques, conseils légaux et meilleures pratiques pour gérer votre hostel ou auberge au Maroc. Fiches de police, OTA, rentabilité, et plus.',
  alternates: { canonical: 'https://www.sweetreservation.com/blog' },
  openGraph: {
    title: 'Blog Sweet Reservation — Gestion Hostel Maroc',
    description: 'Guides et conseils pour les propriétaires de hostels et auberges au Maroc.',
    url: 'https://www.sweetreservation.com/blog',
    siteName: 'Sweet Reservation',
    locale: 'fr_MA',
    type: 'website',
  },
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Légal & Conformité': { bg: 'rgba(239,68,68,0.08)', text: '#DC2626' },
  'Distribution & OTA': { bg: 'rgba(59,130,246,0.08)', text: '#2563EB' },
  'Guide & Conseils': { bg: 'rgba(33,199,122,0.1)', text: '#0F6E56' },
  'Gestion & Productivité': { bg: 'rgba(168,85,247,0.08)', text: '#7C3AED' },
}

export default function BlogIndexPage() {
  return (
    <div className={jakarta.className} style={{ background: '#fff', color: '#0E1A1F', minHeight: '100vh' }}>

      {/* Nav */}
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
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0E1A1F' }}>Sweet Reservation</span>
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/login" style={{ fontSize: 13, fontWeight: 500, color: '#5C6B72', textDecoration: 'none', padding: '7px 14px', borderRadius: 999 }}>Connexion</Link>
          <Link href="/register" style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none', padding: '8px 16px', borderRadius: 999, background: '#21C77A' }}>Essai gratuit</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(160deg, #030f0b 0%, #0a1f1c 60%, #0E1A1F 100%)', padding: '72px 24px 80px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: '5px 12px', borderRadius: 999, border: '1px solid rgba(33,199,122,0.3)', background: 'rgba(33,199,122,0.08)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#21C77A', letterSpacing: '0.04em' }}>RESSOURCES & GUIDES</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, color: '#fff', lineHeight: 1.18, letterSpacing: '-0.025em', marginBottom: 18 }}>
            Le blog des propriétaires<br />de hostels au Maroc
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
            Guides pratiques, conformité légale, et stratégies de rentabilité pour gérer votre hostel ou auberge.
          </p>
        </div>
      </section>

      {/* Articles grid */}
      <section style={{ padding: '64px 24px', maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
          {BLOG_POSTS.map((post) => {
            const cat = CATEGORY_COLORS[post.category] ?? { bg: 'rgba(14,26,31,0.06)', text: '#334155' }
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <article style={{
                  background: '#fff', borderRadius: 20, padding: '28px',
                  border: '1.5px solid #E8EDEF', height: '100%',
                  boxShadow: '0 2px 12px rgba(14,26,31,0.05)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(14,26,31,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(14,26,31,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999, background: cat.bg, color: cat.text }}>
                      {post.category}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
                      <Clock size={12} />
                      <span style={{ fontSize: 12 }}>{post.readTime} min</span>
                    </div>
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0E1A1F', lineHeight: 1.4, marginBottom: 12 }}>{post.title}</h2>
                  <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.7, marginBottom: 20 }}>{post.description}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#21C77A', fontSize: 13, fontWeight: 600 }}>
                    Lire l&apos;article <ArrowRight size={14} />
                  </div>
                </article>
              </Link>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{
          maxWidth: 680, margin: '0 auto',
          background: 'linear-gradient(135deg, #0a1f1c 0%, #0d2b26 100%)',
          borderRadius: 24, padding: '48px 40px', textAlign: 'center',
          border: '1px solid rgba(33,199,122,0.2)',
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Prêt à moderniser votre hostel ?</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>14 jours gratuits. Sans carte bancaire.</p>
          <Link href="/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 14, fontWeight: 700, color: '#fff', textDecoration: 'none',
            padding: '12px 24px', borderRadius: 12, background: '#21C77A',
            boxShadow: '0 4px 20px rgba(33,199,122,0.4)',
          }}>
            Commencer gratuitement <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0E1A1F', padding: '32px 24px', textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Sweet Reservation</span>
      </footer>
    </div>
  )
}
