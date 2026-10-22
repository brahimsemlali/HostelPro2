import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PauseCircle, MessageCircle } from 'lucide-react'
import { getUserSession, createAdminClient } from '@/lib/supabase/server'
import { AppLogo } from '@/components/shared/AppLogo'
import { SuspendedLogout } from './SuspendedLogout'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function SuspendedPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const { data: flag } = await createAdminClient()
    .from('tenant_admin')
    .select('suspended_at, suspended_reason')
    .eq('property_id', session.propertyId)
    .maybeSingle()
  if (!flag?.suspended_at) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[28px] border border-[#E8ECF0] shadow-sm p-8 text-center space-y-5">
        <div className="flex justify-center"><AppLogo /></div>
        <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
          <PauseCircle className="w-7 h-7 text-orange-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-[#0A1F1C]">Compte suspendu</h1>
          <p className="text-sm text-[#475569]">
            L&apos;accès à Sweet Reservation est temporairement suspendu pour votre établissement.
            {flag.suspended_reason ? <><br /><span className="text-[#0A1F1C]">Motif : {flag.suspended_reason}</span></> : null}
          </p>
          <p className="text-sm text-[#475569]">Vos données sont conservées. Contactez-nous pour réactiver votre compte.</p>
        </div>
        <a
          href="https://wa.me/212679760746"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F6E56] py-3 text-sm font-medium text-white hover:bg-[#0c5a46]"
        >
          <MessageCircle className="w-4 h-4" /> Nous contacter sur WhatsApp
        </a>
        <SuspendedLogout />
      </div>
    </div>
  )
}
