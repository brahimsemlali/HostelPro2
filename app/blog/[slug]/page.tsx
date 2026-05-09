import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BLOG_POSTS, getBlogPost } from '@/lib/blog-posts'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Clock, ArrowLeft, ArrowRight, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' })

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return {}
  return {
    title: `${post.title} | Sweet Reservation`,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `https://www.sweetreservation.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://www.sweetreservation.com/blog/${post.slug}`,
      siteName: 'Sweet Reservation',
      locale: 'fr_MA',
      type: 'article',
      publishedTime: post.publishedAt,
    },
  }
}

function renderContent(content: string) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} style={{ fontSize: 22, fontWeight: 800, color: '#0E1A1F', marginTop: 40, marginBottom: 16, letterSpacing: '-0.02em' }}>{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} style={{ fontSize: 17, fontWeight: 700, color: '#0E1A1F', marginTop: 28, marginBottom: 10 }}>{line.slice(4)}</h3>)
    } else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(<p key={key++} style={{ fontSize: 15, fontWeight: 700, color: '#0E1A1F', marginBottom: 8 }}>{line.slice(2, -2)}</p>)
    } else if (line.startsWith('- ')) {
      const items: string[] = [line.slice(2)]
      while (i + 1 < lines.length && lines[i + 1].startsWith('- ')) {
        i++
        items.push(lines[i].slice(2))
      }
      elements.push(
        <ul key={key++} style={{ listStyle: 'none', padding: 0, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, j) => (
            <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: '#334155', lineHeight: 1.7 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#21C77A', marginTop: 9, flexShrink: 0 }} />
              <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            </li>
          ))}
        </ul>
      )
    } else if (line.startsWith('| ')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!lines[i].match(/^\|[-\s|]+\|$/)) {
          rows.push(lines[i].split('|').filter((_, ci) => ci > 0 && ci < lines[i].split('|').length - 1).map((c) => c.trim()))
        }
        i++
      }
      i--
      elements.push(
        <div key={key++} style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'rgba(33,199,122,0.08)' }}>
                {rows[0]?.map((cell, j) => (
                  <th key={j} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#0E1A1F', borderBottom: '2px solid rgba(33,199,122,0.2)', whiteSpace: 'nowrap' }}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #E8EDEF' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '10px 14px', color: '#334155', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: cell.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    } else if (line.trim() === '') {
      // skip blank lines
    } else {
      elements.push(
        <p key={key++} style={{ fontSize: 15.5, color: '#334155', lineHeight: 1.85, marginBottom: 18 }}
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0E1A1F">$1</strong>') }}
        />
      )
    }
  }

  return elements
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2)

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { '@type': 'Organization', name: 'Sweet Reservation', url: 'https://www.sweetreservation.com' },
    publisher: { '@type': 'Organization', name: 'Sweet Reservation', logo: { '@type': 'ImageObject', url: 'https://www.sweetreservation.com/icon-512.png' } },
    url: `https://www.sweetreservation.com/blog/${post.slug}`,
    inLanguage: 'fr',
    about: { '@type': 'Thing', name: 'Gestion de hostel au Maroc' },
    keywords: post.keywords.join(', '),
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://www.sweetreservation.com/blog/${post.slug}` },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.sweetreservation.com' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.sweetreservation.com/blog' },
      { '@type': 'ListItem', position: 3, name: post.title, item: `https://www.sweetreservation.com/blog/${post.slug}` },
    ],
  }

  return (
    <div className={jakarta.className} style={{ background: '#fff', color: '#0E1A1F' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

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

      {/* Breadcrumb */}
      <div style={{ padding: '16px 24px', maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link href="/blog" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#64748B', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Blog
        </Link>
        <span style={{ color: '#CBD5E1', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: '#334155' }}>{post.category}</span>
      </div>

      {/* Article header */}
      <header style={{ padding: '8px 24px 48px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 999, background: 'rgba(33,199,122,0.1)', color: '#0F6E56' }}>
            {post.category}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
            <Clock size={13} />
            <span style={{ fontSize: 13 }}>{post.readTime} min de lecture</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8' }}>
            <Calendar size={13} />
            <span style={{ fontSize: 13 }}>
              {format(new Date(post.publishedAt), 'd MMMM yyyy', { locale: fr })}
            </span>
          </div>
        </div>

        <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#0E1A1F', lineHeight: 1.25, letterSpacing: '-0.025em', marginBottom: 20 }}>
          {post.title}
        </h1>
        <p style={{ fontSize: 17, color: '#64748B', lineHeight: 1.7 }}>{post.description}</p>
        <hr style={{ border: 'none', borderTop: '1px solid #E8EDEF', margin: '32px 0 0' }} />
      </header>

      {/* Article body */}
      <main style={{ padding: '0 24px 64px', maxWidth: 760, margin: '0 auto' }}>
        {renderContent(post.content)}
      </main>

      {/* CTA box */}
      <section style={{ padding: '0 24px 64px' }}>
        <div style={{
          maxWidth: 760, margin: '0 auto',
          background: 'linear-gradient(135deg, #0a1f1c 0%, #0d2b26 100%)',
          borderRadius: 20, padding: '40px 36px',
          border: '1px solid rgba(33,199,122,0.2)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#21C77A', marginBottom: 10 }}>Sweet Reservation</p>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 10 }}>Automatisez la gestion de votre hostel</h3>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.65 }}>
            Check-in 60s · Fiches de police PDF · WhatsApp · Paiements MAD · 14 jours gratuits
          </p>
          <Link href="/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 14, fontWeight: 700, color: '#fff', textDecoration: 'none',
            padding: '12px 22px', borderRadius: 12, background: '#21C77A',
            boxShadow: '0 4px 20px rgba(33,199,122,0.4)',
          }}>
            Commencer gratuitement <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Related posts */}
      {related.length > 0 && (
        <section style={{ padding: '0 24px 80px', maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0E1A1F', marginBottom: 20 }}>Articles similaires</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {related.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#F8FAFC', borderRadius: 16, padding: '20px', border: '1px solid #E8EDEF' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.category}</span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0E1A1F', marginTop: 8, lineHeight: 1.45 }}>{p.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#21C77A', fontSize: 13, fontWeight: 600, marginTop: 12 }}>
                    Lire <ArrowRight size={13} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{ background: '#0E1A1F', padding: '32px 24px', textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Sweet Reservation</span>
      </footer>
    </div>
  )
}
