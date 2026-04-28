import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/app/context/LanguageContext";
import type { Lang } from "@/lib/i18n";
import { NavigationLoader } from "@/components/shared/NavigationLoader";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HostelPro — Gestion d'auberge",
  description: "Solution de gestion pour auberges et hostels au Maroc",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon-32.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HostelPro',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

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
