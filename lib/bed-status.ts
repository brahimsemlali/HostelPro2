import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * True when another checked-in booking is using this bed. Status changes on one
 * booking (checkout, cancellation, no-show) must not overwrite the bed status
 * of a guest who is actually sleeping in it — e.g. a same-day turnover where the
 * new guest was checked in before the previous one was checked out.
 * On a query error it answers true, so the bed is left untouched rather than
 * wrongly freed.
 */
export async function bedHasOtherOccupant(
  supabase: SupabaseClient,
  bedId: string,
  excludeBookingId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('bed_id', bedId)
    .eq('status', 'checked_in')
    .neq('id', excludeBookingId)
    .limit(1)
  if (error) return true
  return (data?.length ?? 0) > 0
}
