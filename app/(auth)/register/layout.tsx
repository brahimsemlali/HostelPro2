import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Créer un compte gratuit',
  description: "Créez votre compte Sweet Reservation et commencez à gérer votre hostel au Maroc. Essai gratuit 14 jours, sans carte bancaire. Check-in digital, fiches de police, WhatsApp intégré.",
  alternates: {
    canonical: 'https://www.sweetreservation.com/register',
  },
  openGraph: {
    title: 'Créer un compte — Sweet Reservation',
    description: "Démarrez votre essai gratuit 14 jours. Logiciel de gestion hostel pour le Maroc.",
    url: 'https://www.sweetreservation.com/register',
  },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
