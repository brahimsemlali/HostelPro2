'use client'

import { useRouter } from 'next/navigation'
import { logoutAction } from '@/app/actions/auth'

export function SuspendedLogout() {
  const router = useRouter()
  return (
    <button
      className="text-xs text-[#94A3B8] hover:text-[#0A1F1C]"
      onClick={async () => {
        await logoutAction()
        router.push('/login')
        router.refresh()
      }}
    >
      Se déconnecter
    </button>
  )
}
