import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/superadmin'
import { isMissingTable } from '@/lib/admin/metrics'
import { PaymentsLedgerClient } from './PaymentsLedgerClient'

export default async function AdminPaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user)) redirect('/dashboard')

  const { data, error } = await createAdminClient()
    .from('platform_payments')
    .select('id, property_id, property_name, amount, method, months, reference, note, paid_at, recorded_by')
    .order('paid_at', { ascending: false })
    .limit(2000)

  return (
    <PaymentsLedgerClient
      rows={(data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }))}
      migrationMissing={isMissingTable(error)}
    />
  )
}
