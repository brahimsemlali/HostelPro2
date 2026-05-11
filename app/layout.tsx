import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/app/context/LanguageContext";
import type { Lang } from "@/lib/i18n";
import { NavigationLoader } from "@/components/shared/NavigationLoader";
import { JsonLd } from "@/components/shared/JsonLd";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const BASE_URL = 'https://www.sweetreservation.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Sweet Reservation — Logiciel de Gestion d'Hostel au Maroc",
    template: "%s | Sweet Reservation",
  },
  description:
    "Gérez votre hostel ou auberge au Maroc avec Sweet Reservation. Check-in digital, fiches de police automatiques, WhatsApp intégré, rapports et paiements en MAD. Essai gratuit 14 jours.",
  keywords: [
    // French — primary market
    "logiciel gestion hostel maroc",
    "application gestion auberge maroc",
    "logiciel réservation hostel",
    "gestion hébergement maroc",
    "fiche de police hostel",
    "check-in digital hostel",
    "logiciel auberge jeunesse maroc",
    "réservation hostel maroc",
    "auberge logiciel maroc",
    "logiciel pms maroc",
    "gestion lits hostel",
    "logiciel gestion auberge agadir",
    "logiciel gestion auberge marrakech",
    "logiciel gestion auberge casablanca",
    "logiciel hôtellerie maroc",
    "système réservation hébergement maroc",
    "gestion check-in check-out hostel",
    "rapport revenus hostel maroc",
    "logiciel gestion équipe hostel",
    "outil gestion nuitées maroc",
    // English — secondary market
    "hostel management software morocco",
    "hostel management system",
    "hostel property management system",
    "hostel pms morocco",
    "hostel check-in software",
    "hostel reservation system",
    "hostel booking management morocco",
    "hostel management app agadir",
    "hostel management app marrakech",
    "hostel staff management software",
    "hostel revenue reports morocco",
    "police registration software morocco",
    "hostelworld booking.com integration morocco",
    "whatsapp hostel management",
    "digital check-in hostel africa",
    // Brand
    "sweet reservation",
    "sweetreservation",
    "sweet reservation hostel",
    "sweetreservation.com",
  ],
  authors: [{ name: "Sweet Reservation", url: BASE_URL }],
  creator: "Sweet Reservation",
  publisher: "Sweet Reservation",
  category: "technology",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_MA",
    alternateLocale: ["fr_FR", "en_US"],
    url: BASE_URL,
    siteName: "Sweet Reservation",
    title: "Sweet Reservation — Logiciel de Gestion d'Hostel au Maroc",
    description:
      "Gérez votre hostel ou auberge au Maroc. Check-in digital, fiches de police automatiques, WhatsApp intégré, rapports et paiements en MAD.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Sweet Reservation — Logiciel de Gestion d'Hostel au Maroc",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@sweetreservation",
    creator: "@sweetreservation",
    title: "Sweet Reservation — Logiciel de Gestion d'Hostel au Maroc",
    description:
      "Gérez votre hostel ou auberge au Maroc. Check-in 60s · Fiche de police PDF · WhatsApp · Paiements MAD.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: BASE_URL,
    languages: {
      "fr-MA": BASE_URL,
      "fr-FR": BASE_URL,
      "en-US": BASE_URL,
    },
  },
  verification: {
    google: "946ad4b3ce46fa7f",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sweet Reservation",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Sweet Reservation',
  alternateName: 'SweetReservation',
  url: BASE_URL,
  logo: `${BASE_URL}/icon-512.png`,
  description:
    "Logiciel de gestion pour hostels et auberges au Maroc. Check-in digital, fiches de police, paiements MAD, WhatsApp intégré.",
  foundingLocation: {
    '@type': 'Place',
    addressCountry: 'MA',
  },
  areaServed: {
    '@type': 'Country',
    name: 'Morocco',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: ['French', 'Arabic', 'English'],
  },
  sameAs: [
    'https://www.sweetreservation.com',
  ],
}

const webSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Sweet Reservation',
  url: BASE_URL,
  description: "Logiciel de gestion pour hostels et auberges au Maroc",
  inLanguage: ['fr', 'ar', 'en'],
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE_URL}/?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Sweet Reservation',
  operatingSystem: 'Web, iOS, Android',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Property Management System',
  description:
    "Solution SaaS de gestion pour hostels et auberges au Maroc. Gestion des réservations, check-in digital, fiches de police automatiques, WhatsApp intégré, rapports de revenus en MAD.",
  url: BASE_URL,
  screenshot: `${BASE_URL}/opengraph-image`,
  featureList: [
    "Check-in digital en 60 secondes",
    "Génération automatique de fiches de police",
    "Intégration WhatsApp native",
    "Plan des lits en temps réel",
    "Rapports et analytics en MAD",
    "Gestion multi-utilisateurs (propriétaire, manager, réceptionniste)",
    "Audit de nuit automatisé",
    "Synchronisation Booking.com et Hostelworld",
  ],
  offers: [
    {
      '@type': 'Offer',
      name: 'Essai Gratuit',
      price: '0',
      priceCurrency: 'USD',
      description: "Essai gratuit 14 jours, sans carte bancaire",
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '35',
      priceCurrency: 'USD',
      description: "Jusqu'à 45 lits — fiches de police, WhatsApp, rapports",
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '35',
        priceCurrency: 'USD',
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: 'MON',
      },
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '100',
      priceCurrency: 'USD',
      description: "Lits illimités — synchronisation OTA automatique, rapports avancés, gestion du staff, support WhatsApp",
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '100',
        priceCurrency: 'USD',
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: 'MON',
      },
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '47',
    bestRating: '5',
    worstRating: '1',
  },
  author: {
    '@type': 'Organization',
    name: 'Sweet Reservation',
    url: BASE_URL,
  },
  inLanguage: ['fr', 'ar', 'en'],
  countriesSupported: 'MA',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawLang = cookieStore.get('hp-lang')?.value;
  const lang: Lang = rawLang === 'en' ? 'en' : 'fr';

  return (
    <html lang={lang} className={`${dmSans.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#0F6E56" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {/* Preconnect to critical origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <JsonLd data={organizationSchema} />
        <JsonLd data={webSiteSchema} />
        <JsonLd data={softwareApplicationSchema} />
      </head>
      <body className="min-h-full flex flex-col">
        <NavigationLoader />
        <LanguageProvider initialLang={lang}>
          {children}
        </LanguageProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
