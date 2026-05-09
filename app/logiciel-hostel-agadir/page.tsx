import type { Metadata } from 'next'
import { getCityData } from '@/lib/city-data'
import { CityPage } from '@/components/marketing/CityPage'

const city = getCityData('agadir')!

export const metadata: Metadata = {
  title: city.metaTitle,
  description: city.metaDescription,
  keywords: city.keywords,
  alternates: { canonical: `https://www.sweetreservation.com${city.canonicalPath}` },
  openGraph: {
    title: city.metaTitle,
    description: city.metaDescription,
    url: `https://www.sweetreservation.com${city.canonicalPath}`,
    siteName: 'Sweet Reservation',
    locale: 'fr_MA',
    type: 'website',
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Sweet Reservation',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://www.sweetreservation.com',
  description: city.metaDescription,
  areaServed: { '@type': 'City', name: 'Agadir', containedInPlace: { '@type': 'Country', name: 'Morocco' } },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Essai gratuit 14 jours' },
}

const breadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.sweetreservation.com' },
    { '@type': 'ListItem', position: 2, name: 'Logiciel Hostel Agadir', item: 'https://www.sweetreservation.com/logiciel-hostel-agadir' },
  ],
}

export default function AgadirPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <CityPage city={city} />
    </>
  )
}
