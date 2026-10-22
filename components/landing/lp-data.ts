// ─────────────────────────────────────────────────────────────────────────────
// Demo data shared by the 3D "Living Property" scene and the product-UI
// previews, so the riad model and the bed map tell the same story.
// Everything here is clearly-labelled demonstration data, never real guests.
// ─────────────────────────────────────────────────────────────────────────────

export type BedStatus = 'occupied' | 'free' | 'dirty' | 'arriving'

export type DemoRoom = { key: 'A' | 'B' | 'C' | 'P'; beds: { name: string; status: BedStatus }[] }

// Final state of the story: A3 has just been booked, B2 has just been cleaned.
export const DEMO_ROOMS: DemoRoom[] = [
  {
    key: 'A',
    beds: [
      { name: 'A1', status: 'occupied' },
      { name: 'A2', status: 'occupied' },
      { name: 'A3', status: 'occupied' },
      { name: 'A4', status: 'free' },
      { name: 'A5', status: 'occupied' },
      { name: 'A6', status: 'arriving' },
    ],
  },
  {
    key: 'B',
    beds: [
      { name: 'B1', status: 'occupied' },
      { name: 'B2', status: 'free' },
      { name: 'B3', status: 'occupied' },
      { name: 'B4', status: 'occupied' },
      { name: 'B5', status: 'dirty' },
      { name: 'B6', status: 'free' },
    ],
  },
  {
    key: 'C',
    beds: [
      { name: 'C1', status: 'occupied' },
      { name: 'C2', status: 'occupied' },
      { name: 'C3', status: 'arriving' },
      { name: 'C4', status: 'free' },
    ],
  },
  {
    // Private rooms — one double bed each
    key: 'P',
    beds: [
      { name: 'P1', status: 'occupied' },
      { name: 'P2', status: 'occupied' },
      { name: 'P3', status: 'arriving' },
    ],
  },
]

// The two beds that change during the hero story, and their "before" state.
export const STORY_BOOKED_BED = 'A3'
export const STORY_CLEANED_BED = 'B2'

export const TOTAL_BEDS = DEMO_ROOMS.reduce((n, r) => n + r.beds.length, 0)
export const TONIGHT_BEDS = DEMO_ROOMS.reduce(
  (n, r) => n + r.beds.filter((b) => b.status === 'occupied' || b.status === 'arriving').length,
  0,
)

export const STATUS_COLORS: Record<BedStatus, string> = {
  occupied: '#0F6E56',
  free: '#FFFFFF',
  dirty: '#E8B65A',
  arriving: '#7C9CE0',
}

export const DEMO_ARRIVALS = [
  { name: 'Lena Hoffmann', country: 'DE', bed: 'A3', source: 'Booking.com', time: '14:00', paid: 'partial' as const, nights: 3 },
  { name: 'Youssef Amrani', country: 'MA', bed: 'A6', source: 'Direct', time: '15:30', paid: 'paid' as const, nights: 2 },
  { name: 'Camille Martin', country: 'FR', bed: 'C3', source: 'Hostelworld', time: '17:00', paid: 'partial' as const, nights: 4 },
  { name: 'Diego Ruiz', country: 'ES', bed: 'P3', source: 'WhatsApp', time: '19:15', paid: 'paid' as const, nights: 5 },
]

export const DEMO_PAYMENTS = [
  { name: 'Sofia Rossi', method: 'cash' as const, amount: 360, time: '09:12' },
  { name: 'Youssef Amrani', method: 'transfer' as const, amount: 520, time: '10:40' },
  { name: 'Tom Becker', method: 'card' as const, amount: 780, time: '12:05' },
  { name: 'Lena Hoffmann', method: 'cash' as const, amount: 180, time: '14:08' },
  { name: 'Diego Ruiz', method: 'cash' as const, amount: 500, time: '19:20' },
]

export const DEMO_REVENUE_7D = [3120, 2840, 3560, 4010, 3780, 4460, 2340]

export function formatMAD(n: number): string {
  return `${new Intl.NumberFormat('fr-MA').format(n)} MAD`
}
