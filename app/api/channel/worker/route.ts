import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ChannexClient } from '@/lib/channex/client'
import { pullBookings, pushAri } from '@/lib/channex/worker'
import { secretMatches } from '@/lib/channex/secret'

// Called every minute by Supabase pg_cron (pg_net) with
// `Authorization: Bearer <CHANNEL_WORKER_SECRET>` — see DEPLOY_CHECKLIST.md.
// Bookings first: an imported booking queues availability for the push below.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function run(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  if (!secretMatches(bearer, process.env.CHANNEL_WORKER_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const cx = ChannexClient.fromEnv()
  if (!cx) return NextResponse.json({ disabled: true })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  try {
    const bookings = await pullBookings(db, cx)
    const ari = await pushAri(db, cx)
    return NextResponse.json({ bookings, ari })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'worker failed' }, { status: 500 })
  }
}

export const GET = run
export const POST = run
