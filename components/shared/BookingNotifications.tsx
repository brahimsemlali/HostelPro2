'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/app/context/SessionContext'
import { toast } from 'sonner'
import { BOOKING_SOURCES } from '@/lib/constants'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Layout-level Realtime listener — shows a toast to reception whenever a new
 * booking is inserted, wherever they are in the app.
 * Renders nothing. Housekeeping is excluded (they don't handle bookings).
 */
export function BookingNotifications() {
  const session = useSession()
  const propertyId = session?.propertyId
  const role = session?.role

  useEffect(() => {
    if (!propertyId || role === 'housekeeping') return

    const supabase = createClient()
    // Channel name must stay stable — no page state in it (see CLAUDE.md)
    const channel = supabase
      .channel(`booking-notify-${propertyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings', filter: `property_id=eq.${propertyId}` },
        async (payload) => {
          const b = payload.new as { guest_id: string | null; source: string; check_in_date: string }

          let guestName = ''
          try {
            if (b.guest_id) {
              const { data: g } = await supabase
                .from('guests')
                .select('first_name, last_name')
                .eq('id', b.guest_id)
                .single()
              if (g) guestName = `${g.first_name} ${g.last_name}`
            }
          } catch {
            // name is cosmetic — never block the notification
          }

          const source = BOOKING_SOURCES[b.source] ?? b.source
          const arrival = format(new Date(`${b.check_in_date}T00:00:00`), 'd MMM', { locale: fr })
          toast.info(`Nouvelle réservation${guestName ? ` — ${guestName}` : ''}`, {
            description: `${source} · arrivée ${arrival}`,
            duration: 8000,
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [propertyId, role])

  return null
}
