import type { MetadataRoute } from 'next'
import { ALL_CITY_SLUGS } from '@/lib/city-data'
import { BLOG_POSTS } from '@/lib/blog-posts'

const BASE = 'https://www.sweetreservation.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const corePages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/llms.txt`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  const cityPages: MetadataRoute.Sitemap = ALL_CITY_SLUGS.map((slug) => ({
    url: `${BASE}/logiciel-hostel-${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.85,
  }))

  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.75,
  }))

  return [...corePages, ...cityPages, ...blogPages]
}
