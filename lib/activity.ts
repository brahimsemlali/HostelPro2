import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivityActionType =
  | 'check_in'
  | 'check_out'
  | 'payment'
  | 'maintenance_open'
  | 'maintenance_resolved'
  | 'booking_created'
  | 'booking_cancelled'
  | 'bed_status'

export interface LogActivityParams {
  propertyId: string
  userId: string | null
  staffName: string | null
  actionType: ActivityActionType
  entityType?: 'booking' | 'payment' | 'maintenance' | 'bed'
  entityId?: string
  description: string
  meta?: Record<string, unknown>
}

/**
 * Logs an activity event from the browser (client-side).
 * Fire-and-forget — errors are swallowed so they never break the primary action.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from('activity_log').insert({
      property_id: params.propertyId,
      user_id:     params.userId,
      staff_name:  params.staffName,
      action_type: params.actionType,
      entity_type: params.entityType ?? null,
      entity_id:   params.entityId ?? null,
      description: params.description,
      meta:        params.meta ?? {},
    })
  } catch {
    // Never let logging break the primary action
  }
}

/**
 * Server-side version — accepts a pre-built supabase server client.
 * Use this inside API routes and Server Components.
 */
export async function logActivityServer(
  supabase: SupabaseClient,
  params: LogActivityParams,
): Promise<void> {
  try {
    await supabase.from('activity_log').insert({
      property_id: params.propertyId,
      user_id:     params.userId,
      staff_name:  params.staffName,
      action_type: params.actionType,
      entity_type: params.entityType ?? null,
      entity_id:   params.entityId ?? null,
      description: params.description,
      meta:        params.meta ?? {},
    })
  } catch {
    // Never let logging break the primary action
  }
}
