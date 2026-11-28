import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ChannexClient, isRetryable } from '@/lib/channex/client'
import { processRevision } from '@/lib/channex/worker'
import { secretMatches } from '@/lib/channex/secret'

// Channex webhook (public route). Configure it in Channex with the header
// `X-Channex-Webhook-Secret: <CHANNEX_WEBHOOK_SECRET>` and send_data on.
// The payload only carries the revision id: the revision is fetched, stored,
// applied and acked. Channex retries on 5xx only, so a temporary failure to
// fetch returns 500; anything already stored is retried by the worker.
const BOOKING_EVENTS = new Set(['booking', 'booking_new', 'booking_modification', 'booking_cancellation'])

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get('x-channex-webhook-secret'), process.env.CHANNEX_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  let body: { event?: string; payload?: { revision_id?: string } }
  try {
    body = JSON.parse(await request.text())
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const revisionId = body.payload?.revision_id
  if (!body.event || !BOOKING_EVENTS.has(body.event) || !revisionId) {
    return NextResponse.json({ ignored: body.event ?? null })
  }

  const cx = ChannexClient.fromEnv()
  if (!cx) return NextResponse.json({ error: 'channex disabled' }, { status: 503 })
  const rev = await cx.getRevision(revisionId)
  if (!rev.ok || !rev.data) {
    return NextResponse.json({ error: rev.error }, { status: isRetryable(rev) ? 502 : 200 })
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  try {
    const outcome = await processRevision(db, cx, rev.data)
    // 'failed' is stored with its error and retried by the worker's feed pull.
    return NextResponse.json({ outcome })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
