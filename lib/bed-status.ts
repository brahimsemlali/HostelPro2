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

/**
 * Bed-map booking columns. Deliberately excludes the guest's identity document,
 * date of birth, contact details and staff notes: /beds is housekeeping's
 * landing page, and anything selected here ships to every role's browser.
 * Full guest details are fetched on demand by roles allowed to see them
 * (BookingDetailSheet).
 */
export const BED_MAP_BOOKING_SELECT =
  'id, property_id, guest_id, bed_id, source, status, check_in_date, check_out_date, nights, adults, total_price, created_at, guest:guest_id(id, first_name, last_name, nationality)'
