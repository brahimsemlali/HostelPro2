import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { todayISO } from '@/lib/dates'
import { INVOICE_COLUMNS, type Invoice } from '@/lib/invoicing'
import { InvoicesClient } from './InvoicesClient'

function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  return { from: `${month}-01`, to: `${next}-01` }
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping') redirect('/beds')
  if (session.role === 'receptionist') redirect('/dashboard')

  const { month: rawMonth } = await searchParams
  const month = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : todayISO().slice(0, 7)
  const { from, to } = monthBounds(month)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_COLUMNS)
    .eq('property_id', session.propertyId)
    .gte('issue_date', from)
    .lt('issue_date', to)
    .order('issue_date', { ascending: false })
    .order('number', { ascending: false })
    .limit(2000)

  return (
    <InvoicesClient
      month={month}
      invoices={(data ?? []) as unknown as Invoice[]}
      unavailable={!!error}
      isOwner={session.isOwner}
    />
  )
}
