import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { HousekeepingClient } from './HousekeepingClient'

export default async function HousekeepingPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('id, name, check_in_time')
    .eq('id', session.propertyId)
    .single()
  if (!property) redirect('/onboarding')

  const today = new Date().toISOString().split('T')[0]

  // Build tasks query — housekeeping only sees their own tasks
  let tasksQuery = supabase
    .from('housekeeping_tasks')
    .select('*, assigned_to:assigned_to_staff_id(id, name, role), bed:bed_id(id, name), room:room_id(id, name)')
    .eq('property_id', property.id)
    .order('created_at', { ascending: false })

  if (session.role === 'housekeeping' && session.staffId) {
    tasksQuery = tasksQuery.eq('assigned_to_staff_id', session.staffId)
  }

  const [bedsRes, checkoutsRes, arrivalsRes, tasksRes, staffRes, roomsRes] = await Promise.all([
    // All beds with their room
    supabase
      .from('beds')
      .select('id, name, status, room_id, room:room_id(id, name)')
      .eq('property_id', property.id)
      .order('name'),

    // Bookings checked out today
    supabase
      .from('bookings')
      .select('id, bed_id, guest:guest_id(first_name, last_name)')
      .eq('property_id', property.id)
      .eq('check_out_date', today)
      .eq('status', 'checked_out'),

    // Confirmed arrivals today
    supabase
      .from('bookings')
      .select('id, bed_id, guest:guest_id(first_name, last_name)')
      .eq('property_id', property.id)
      .eq('check_in_date', today)
      .in('status', ['confirmed', 'pending']),

    // Housekeeping tasks
    tasksQuery,

    // Active staff for task assignment (managers/owners use this)
    supabase
      .from('staff')
      .select('id, name, role')
      .eq('property_id', property.id)
      .eq('is_active', true)
      .order('name'),

    // Rooms for task creation form
    supabase
      .from('rooms')
      .select('id, name')
      .eq('property_id', property.id)
      .order('name'),
  ])

  const allBeds = bedsRes.data ?? []
  const checkoutBedIds = new Set(
    (checkoutsRes.data ?? []).map((b) => b.bed_id).filter(Boolean) as string[],
  )
  const arrivalsByBedId = new Map<string, string>()
  ;(arrivalsRes.data ?? []).forEach((b) => {
    if (b.bed_id) {
      const g = Array.isArray(b.guest) ? b.guest[0] : b.guest
      const name = g ? `${(g as { first_name: string }).first_name} ${(g as { last_name: string }).last_name}` : ''
      arrivalsByBedId.set(b.bed_id, name)
    }
  })

  const cleaningBeds = allBeds
    .filter((bed) => bed.status === 'dirty' || checkoutBedIds.has(bed.id))
    .map((bed) => {
      const room = Array.isArray(bed.room) ? bed.room[0] : bed.room
      return {
        bedId: bed.id,
        bedName: bed.name,
        roomName: (room as { name: string } | null)?.name ?? '—',
        roomId: bed.room_id,
        status: bed.status as string,
        isPriority: arrivalsByBedId.has(bed.id),
        incomingGuestName: arrivalsByBedId.get(bed.id) ?? null,
      }
    })
    .sort((a, b) => {
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1
      if (a.roomName !== b.roomName) return a.roomName.localeCompare(b.roomName)
      return a.bedName.localeCompare(b.bedName)
    })

  return (
    <HousekeepingClient
      propertyId={property.id}
      checkInTime={property.check_in_time ?? '14:00'}
      initialBeds={cleaningBeds}
      initialTasks={(tasksRes.data ?? []) as Parameters<typeof HousekeepingClient>[0]['initialTasks']}
      staffList={staffRes.data ?? []}
      roomList={roomsRes.data ?? []}
      session={session}
    />
  )
}
