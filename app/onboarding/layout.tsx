import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Server-side guard for the onboarding flow.
// A user who already owns a property must never see onboarding again — that
// path created duplicate properties (getUserSession then silently picks the
// oldest, so newly-entered data appears to vanish). Enforced here on the server
// so it can't be bypassed by navigating straight to /onboarding.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()
  if (existing) redirect('/dashboard')

  return <>{children}</>
}
