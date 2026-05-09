import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Essai gratuit 14 jours — Sweet Reservation | Logiciel Hostel Maroc',
  description: 'Créez votre compte Sweet Reservation gratuitement. Gérez votre hostel au Maroc : check-in 60s, fiches de police PDF, WhatsApp, paiements MAD. Sans carte bancaire.',
  keywords: [
    'essai gratuit logiciel hostel maroc',
    'inscription sweet reservation',
    'logiciel hostel gratuit maroc',
    'démo pms hostel maroc',
    'créer compte gestion auberge',
    'tester logiciel hostel maroc',
  ],
  alternates: { canonical: 'https://www.sweetreservation.com/register' },
  openGraph: {
    title: 'Essai gratuit 14 jours — Sweet Reservation',
    description: 'Gérez votre hostel au Maroc. Check-in 60s · Fiches de police · WhatsApp · MAD. Sans carte bancaire.',
    url: 'https://www.sweetreservation.com/register',
    siteName: 'Sweet Reservation',
    locale: 'fr_MA',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
