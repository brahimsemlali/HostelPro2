import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register', '/accept-invite'],
        disallow: [
          '/dashboard',
          '/beds',
          '/guests',
          '/bookings',
          '/calendar',
          '/payments',
          '/reports',
          '/whatsapp',
          '/maintenance',
          '/night-audit',
          '/settings',
          '/onboarding',
          '/expenses',
          '/housekeeping',
          '/activities',
          '/extras',
          '/api/',
          '/checkin/',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
      {
        userAgent: 'CCBot',
        disallow: ['/'],
      },
      {
        userAgent: 'anthropic-ai',
        disallow: ['/'],
      },
    ],
    sitemap: 'https://www.sweetreservation.com/sitemap.xml',
    host: 'https://www.sweetreservation.com',
    // AI crawler guidance
    // llms.txt: https://www.sweetreservation.com/llms.txt
    // llms-full.md: https://www.sweetreservation.com/llms-full.md
  }
}
