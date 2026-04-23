'use client'

import { createContext, useContext } from 'react'
import type { UserSession, StaffRole } from '@/types'

const SessionContext = createContext<UserSession | null>(null)

export function SessionProvider({
  session,
  children,
}: {
  session: UserSession | null
  children: React.ReactNode
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}

/** Returns the current user's session (role, propertyId, isOwner, etc.) */
export function useSession(): UserSession | null {
  return useContext(SessionContext)
}

/** Returns true if the current user has at least the required role */
export function useHasRole(minRole: StaffRole): boolean {
  const session = useContext(SessionContext)
  if (!session) return false
  return roleRank(session.role) >= roleRank(minRole)
}

/** Check if current user can access a specific permission */
export function useCanDo(permission: Permission): boolean {
  const session = useContext(SessionContext)
  if (!session) return false
  // Revenue permissions are blocked for staff with hide_revenue=true
  if (session.hideRevenue && (permission === 'view_revenue' || permission === 'view_reports')) return false
  return PERMISSIONS[session.role]?.includes(permission) ?? false
}

export type Permission =
  | 'view_reports'
  | 'view_revenue'
  | 'manage_staff'
  | 'manage_settings'
  | 'check_in_guests'
  | 'record_payments'
  | 'manage_maintenance'
  | 'update_bed_status'
  | 'view_night_audit'
  | 'send_whatsapp'

/** Role hierarchy — higher number = more access */
function roleRank(role: StaffRole): number {
  const ranks: Record<StaffRole, number> = {
    housekeeping: 1,
    receptionist: 2,
    manager: 3,
    owner: 4,
  }
  return ranks[role] ?? 0
}

/** What each role is allowed to do */
const PERMISSIONS: Record<StaffRole, Permission[]> = {
  owner: [
    'view_reports', 'view_revenue', 'manage_staff', 'manage_settings',
    'check_in_guests', 'record_payments', 'manage_maintenance',
    'update_bed_status', 'view_night_audit', 'send_whatsapp',
  ],
  manager: [
    'view_reports', 'view_revenue', 'check_in_guests', 'record_payments',
    'manage_maintenance', 'update_bed_status', 'view_night_audit', 'send_whatsapp',
  ],
  receptionist: [
    'check_in_guests', 'record_payments', 'update_bed_status',
    'manage_maintenance', 'send_whatsapp',
  ],
  housekeeping: [
    'update_bed_status',
  ],
}
