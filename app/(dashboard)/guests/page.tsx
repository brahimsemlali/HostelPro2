import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { GuestsClient } from './GuestsClient'

const PAGE_SIZE = 100

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const [guestsRes, checkedInRes, countRes] = await Promise.all([
    supabase
      .from('guests')
      .select('id, first_name, last_name, nationality, document_number, phone, whatsapp, total_stays, total_spent, is_flagged, created_at')
      .eq('property_id', session.propertyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),

    supabase
      .from('bookings')
      .select('guest_id')
      .eq('property_id', session.propertyId)
      .eq('status', 'checked_in'),

    supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', session.propertyId),
  ])

  const checkedInGuestIds = new Set(
    (checkedInRes.data ?? []).map((b) => b.guest_id).filter(Boolean) as string[]
  )

  const totalCount = countRes.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <GuestsClient
      guests={guestsRes.data ?? []}
      checkedInGuestIds={Array.from(checkedInGuestIds)}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
    />
  )
}
