import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { GuestsClient } from './GuestsClient'

const PAGE_SIZE = 100

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping') redirect('/beds')

  const supabase = await createClient()

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE
  // Search runs server-side: client-side filtering only sees the current
  // page, so past 100 guests it silently misses matches on other pages.
  const q = (params.q ?? '').trim().replace(/[,%()]/g, '').slice(0, 100)
  const searchOr = q
    ? `first_name.ilike.%${q}%,last_name.ilike.%${q}%,document_number.ilike.%${q}%,phone.ilike.%${q}%`
    : null

  let guestsQuery = supabase
    .from('guests')
    .select('id, first_name, last_name, nationality, document_number, phone, whatsapp, total_stays, total_spent, is_flagged, created_at')
    .eq('property_id', session.propertyId)
  if (searchOr) guestsQuery = guestsQuery.or(searchOr)

  let filteredCountQuery = supabase
    .from('guests')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', session.propertyId)
  if (searchOr) filteredCountQuery = filteredCountQuery.or(searchOr)

  const [guestsRes, checkedInRes, filteredCountRes, totalCountRes, loyalCountRes, flaggedCountRes] = await Promise.all([
    guestsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),

    supabase
      .from('bookings')
      .select('guest_id')
      .eq('property_id', session.propertyId)
      .eq('status', 'checked_in')
      .limit(1000),

    filteredCountQuery,

    // Property-wide stats — computed in SQL so the strip doesn't just
    // count the currently loaded page.
    supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', session.propertyId),

    supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', session.propertyId)
      .gte('total_stays', 3)
      .eq('is_flagged', false),

    supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', session.propertyId)
      .eq('is_flagged', true),
  ])

  const checkedInGuestIds = new Set(
    (checkedInRes.data ?? []).map((b) => b.guest_id).filter(Boolean) as string[]
  )

  const filteredCount = filteredCountRes.count ?? 0
  const totalPages = Math.ceil(filteredCount / PAGE_SIZE)

  return (
    <GuestsClient
      guests={guestsRes.data ?? []}
      checkedInGuestIds={Array.from(checkedInGuestIds)}
      page={page}
      totalPages={totalPages}
      totalCount={filteredCount}
      initialQuery={q}
      stats={{
        total: totalCountRes.count ?? 0,
        staying: checkedInGuestIds.size,
        loyal: loyalCountRes.count ?? 0,
        flagged: flaggedCountRes.count ?? 0,
      }}
    />
  )
}
