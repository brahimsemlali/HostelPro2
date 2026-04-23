export type Property = {
  id: string
  owner_id: string
  name: string
  address: string | null
  city: string
  phone: string | null
  email: string | null
  wifi_password: string | null
  check_in_time: string
  check_out_time: string
  currency: string
  default_language: string
  police_prefecture: string | null
  review_url: string | null
  whatsapp_phone_number_id: string | null
  whatsapp_access_token: string | null
  booking_com_ical_url: string | null
  last_ical_sync: string | null
  created_at: string
}

export type Room = {
  id: string
  property_id: string
  name: string
  type: 'dorm' | 'private'
  floor: number
  gender_policy: 'mixed' | 'female' | 'male'
  created_at: string
}

export type BedStatus = 'available' | 'occupied' | 'dirty' | 'maintenance' | 'blocked'

export type Bed = {
  id: string
  room_id: string
  property_id: string
  name: string
  bunk_position: 'top' | 'bottom' | null
  base_price: number
  status: BedStatus
  notes: string | null
  created_at: string
}

export type Guest = {
  id: string
  property_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  nationality: string | null
  document_type: 'passport' | 'cin' | 'id_card'
  document_number: string | null
  date_of_birth: string | null
  gender: 'M' | 'F' | null
  country_of_residence: string | null
  profession: string | null
  address_in_morocco: string | null
  next_destination: string | null
  total_stays: number
  total_spent: number
  notes: string | null
  is_flagged: boolean
  flag_reason: string | null
  created_at: string
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show'

export type BookingSource =
  | 'direct'
  | 'booking_com'
  | 'hostelworld'
  | 'airbnb'
  | 'phone'
  | 'walkin'

export type Booking = {
  id: string
  property_id: string
  guest_id: string | null
  bed_id: string | null
  source: BookingSource
  external_booking_id: string | null
  status: BookingStatus
  check_in_date: string
  check_out_date: string
  nights: number
  adults: number
  total_price: number
  commission_rate: number
  net_revenue: number
  special_requests: string | null
  internal_notes: string | null
  check_in_time: string | null
  check_out_time: string | null
  police_fiche_generated: boolean
  police_fiche_url: string | null
  pre_checkin_token: string | null
  pre_checkin_completed: boolean
  arrival_notes: string | null
  expected_arrival_time: string | null
  created_at: string
  // Joined fields
  guest?: Guest
  bed?: Bed & { room?: Room }
}

export type BookingExtra = {
  id: string
  booking_id: string
  property_id: string
  name: string
  quantity: number
  unit_price: number
  created_at: string
}

export type PricingRule = {
  id: string
  property_id: string
  name: string
  condition_type: 'occupancy_above' | 'day_of_week' | 'days_before_arrival'
  threshold: number | null
  days_of_week: number[] | null
  adjustment_type: 'percentage' | 'fixed'
  adjustment_value: number
  is_active: boolean
  created_at: string
}

export type PaymentMethod = 'cash' | 'virement' | 'cmi' | 'wave' | 'other'
export type PaymentType = 'payment' | 'deposit' | 'refund'
export type PaymentStatus = 'pending' | 'completed' | 'failed'

export type Payment = {
  id: string
  property_id: string
  booking_id: string | null
  guest_id: string | null
  amount: number
  method: PaymentMethod
  type: PaymentType
  status: PaymentStatus
  reference: string | null
  recorded_by: string | null
  notes: string | null
  payment_date: string
  created_at: string
  // Joined
  booking?: Booking
  guest?: Guest
}

export type MaintenancePriority = 'low' | 'normal' | 'high' | 'urgent'
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved'

export type MaintenanceRequest = {
  id: string
  property_id: string
  room_id: string | null
  bed_id: string | null
  title: string
  description: string | null
  priority: MaintenancePriority
  status: MaintenanceStatus
  reported_by: string | null
  assigned_to: string | null
  resolved_at: string | null
  created_at: string
  room?: Room
  bed?: Bed
}

export type WhatsAppMessage = {
  id: string
  property_id: string
  guest_id: string | null
  booking_id: string | null
  template_key: string | null
  phone: string
  message: string
  status: 'sent' | 'failed'
  sent_at: string
  guest?: Guest
}

export type StaffRole = 'owner' | 'manager' | 'receptionist' | 'housekeeping'

export type Staff = {
  id: string
  property_id: string
  user_id: string | null
  name: string
  role: StaffRole
  phone: string | null
  is_active: boolean
  hide_revenue: boolean
  created_at: string
}

export type StaffInvitation = {
  id: string
  property_id: string
  invited_by: string
  email: string
  name: string
  role: StaffRole
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export type SubscriptionStatus = 'active' | 'past_due' | 'trialing' | 'expired' | 'cancelled'
export type BillingProvider = 'lemonsqueezy' | 'manual_wire' | 'free_trial'

export type Subscription = {
  id: string
  property_id: string
  status: SubscriptionStatus
  provider: BillingProvider
  ls_subscription_id: string | null
  current_period_end: string
  cancel_at_period_end: boolean
  created_at: string
}

/** Resolved session for the current logged-in user — owner or staff member */
export type UserSession = {
  userId: string
  role: StaffRole
  propertyId: string
  isOwner: boolean
  staffId: string | null
  staffName: string | null
  hideRevenue: boolean
  isSuperAdmin: boolean
  subscriptionStatus: SubscriptionStatus | null
  /** All properties this owner controls — only populated for owners, empty for staff */
  allProperties: { id: string; name: string; city: string }[]
}

export type NightAudit = {
  id: string
  property_id: string
  audit_date: string
  performed_by: string | null
  expected_cash: number | null
  actual_cash: number | null
  difference: number | null
  total_revenue: number | null
  occupancy_rate: number | null
  notes: string | null
  police_report_sent: boolean
  created_at: string
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskStatus = 'pending' | 'in_progress' | 'done'

export type HousekeepingTask = {
  id: string
  property_id: string
  title: string
  description: string | null
  room_id: string | null
  bed_id: string | null
  priority: TaskPriority
  status: TaskStatus
  assigned_to_staff_id: string | null
  created_by: string | null
  due_date: string | null
  notes: string | null
  completed_at: string | null
  created_at: string
  // Joined fields from Supabase query
  assigned_to?: { id: string; name: string; role: string } | null
  bed?: { id: string; name: string } | null
  room?: { id: string; name: string } | null
}

export type CurrentOccupancy = {
  bed_id: string
  bed_name: string
  status: BedStatus
  room_id: string
  room_name: string
  room_type: 'dorm' | 'private'
  booking_id: string | null
  check_in_date: string | null
  check_out_date: string | null
  guest_id: string | null
  guest_name: string | null
  nationality: string | null
  phone: string | null
  property_id: string
}

export type Activity = {
  id: string
  property_id: string
  title: string
  description: string | null
  activity_date: string
  start_time: string
  type: 'free' | 'paid'
  price: number | null
  whatsapp_message_sent: boolean
  created_by: string | null
  created_at: string
}

export type ExpenseCategory = 'alimentation' | 'menage' | 'maintenance' | 'toiletries' | 'utilities' | 'personnel' | 'autre'

export type Expense = {
  id: string
  property_id: string
  category: ExpenseCategory
  description: string
  amount: number
  payment_method: 'cash' | 'virement' | 'card'
  expense_date: string
  notes: string | null
  created_at: string
}

export type InventoryItem = {
  id: string
  property_id: string
  name: string
  category: string
  unit: string
  current_stock: number
  reorder_level: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type ActivityLog = {
  id: string
  property_id: string
  user_id: string | null
  staff_name: string | null
  action_type: string
  entity_type: string | null
  entity_id: string | null
  description: string
  meta: Record<string, unknown>
  created_at: string
}
