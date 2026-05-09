import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getUserSession } from '@/lib/supabase/server'
import type { SubscriptionStatus } from '@/types'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/app/context/SessionContext'

const GRACE_DAYS = 7

function isBlocked(status: SubscriptionStatus | null, periodEnd: string | null, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return false
  if (status === 'active') return false

  const now = new Date()
  const end = periodEnd ? new Date(periodEnd) : null
  const graceCutoff = end ? new Date(end.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000) : null

  if (status === 'trialing') {
    if (!end) return false
    return now > graceCutoff!
  }
  if (status === 'past_due') {
    if (!graceCutoff) return true
    return now > graceCutoff
  }
  if (status === 'cancelled') {
    // Access until period ends, then hard wall
    if (!end) return true
    return now > end
  }
  if (status === 'expired') return true

  // null = no subscription row at all
  return true
}

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

  if (!onBillingPage && isBlocked(session.subscriptionStatus, session.subscriptionPeriodEnd, session.isSuperAdmin)) {
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
      <Toaster richColors position="top-right" />
    </SessionProvider>
  )
}
