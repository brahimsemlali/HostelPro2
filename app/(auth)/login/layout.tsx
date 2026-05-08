import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à votre compte Sweet Reservation pour gérer votre hostel ou auberge au Maroc.',
  alternates: {
    canonical: 'https://www.sweetreservation.com/login',
  },
  openGraph: {
    title: 'Connexion — Sweet Reservation',
    description: 'Accédez à votre tableau de bord Sweet Reservation.',
    url: 'https://www.sweetreservation.com/login',
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
