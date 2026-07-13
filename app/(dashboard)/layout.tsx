import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getUserSession } from '@/lib/supabase/server'
import { isSubscriptionBlocked } from '@/lib/billing'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/app/context/SessionContext'
import { BookingNotifications } from '@/components/shared/BookingNotifications'
import { CommandPalette } from '@/components/shared/CommandPalette'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const onBillingPage = pathname.startsWith('/settings/billing')

  if (!onBillingPage && isSubscriptionBlocked(session.subscriptionStatus, session.subscriptionPeriodEnd, session.isSuperAdmin)) {
    redirect('/settings/billing')
  }

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen bg-[#F4F6F8] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {children}
          </main>
        </div>
      </div>
      <MobileNav />
      <BookingNotifications />
      <CommandPalette />
      <Toaster richColors position="top-right" />
    </SessionProvider>
  )
}
