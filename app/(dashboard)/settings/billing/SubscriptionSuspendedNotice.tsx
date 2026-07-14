'use client'

import { logoutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { LockKeyhole, LogOut } from 'lucide-react'
import { useT } from '@/app/context/LanguageContext'

/**
 * Shown to non-owner staff when the property's subscription is blocked.
 * Staff cannot manage billing, so instead of redirecting them (which would
 * loop against the layout's billing gate) we show a clear "contact the owner"
 * message with a way out.
 */
export function SubscriptionSuspendedNotice() {
  const t = useT()

  async function handleSignOut() {
    await logoutAction()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-[#F4F6F8]">
      <div
        className="bg-white rounded-[20px] p-8 max-w-sm w-full text-center hp-fade-up"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
          <LockKeyhole className="w-6 h-6 text-amber-600" />
        </div>
        <h1 className="text-[18px] font-semibold tracking-tight text-[#0A1F1C] mb-2">
          {t('billing.suspendedTitle')}
        </h1>
        <p className="text-[13px] text-[#475569] leading-relaxed mb-6">
          {t('billing.suspendedStaffDesc')}
        </p>
        <Button
          variant="outline"
          className="w-full h-11 text-[13px] gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          {t('nav.logout')}
        </Button>
      </div>
    </div>
  )
}
