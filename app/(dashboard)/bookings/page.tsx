import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { BookingsClient } from './BookingsClient'

// Search + status filtering in BookingsClient run client-side over the loaded
// page only. A large page size keeps them effectively global for the small
// hostels this serves (well under 200 total bookings for a long time). If a
// property genuinely outgrows this, move search + status to server-side query
// params (guest-name ilike + a Postgres RPC to preserve bed/room search).
const PAGE_SIZE = 200

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping') redirect('/beds')

  const supabase = await createClient()

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const [bookingsRes, countRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, status, source, check_in_date, check_out_date, total_price, guest:guest_id(first_name, last_name, nationality), bed:bed_id(name, room:room_id(name))',
      )
      .eq('property_id', session.propertyId)
      .order('check_in_date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),

    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', session.propertyId),
  ])

  const totalCount = countRes.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Normalize Supabase array joins → single objects
  const normalized = (bookingsRes.data ?? []).map((b) => ({
    ...b,
    guest: Array.isArray(b.guest) ? (b.guest[0] ?? null) : b.guest,
    bed: Array.isArray(b.bed)
      ? b.bed[0]
        ? { ...b.bed[0], room: Array.isArray(b.bed[0].room) ? (b.bed[0].room[0] ?? null) : b.bed[0].room }
        : null
      : b.bed,
  }))

  return (
    <BookingsClient
      bookings={normalized as Parameters<typeof BookingsClient>[0]['bookings']}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
    />
  )
}
