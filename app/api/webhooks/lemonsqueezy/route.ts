import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWebhookSignature, mapLsStatus } from '@/lib/billing'

// Must use service-role client — RLS blocks anon writes to subscriptions
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('X-Signature') ?? ''
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody) as {
    meta: {
      event_name: string
      custom_data?: { property_id?: string }
    }
    data: {
      id: string
      attributes: {
        customer_id: number
        variant_id: number
        status: string
        renews_at: string | null
        ends_at: string | null
        updated_at?: string
        cancelled: boolean
        urls?: { customer_portal?: string }
      }
    }
  }

  const { event_name, custom_data } = payload.meta

  // NOTE: subscription_payment_success/failed are deliberately NOT handled —
  // those events carry a subscription-invoice object (no variant_id/renews_at,
  // and data.id is the invoice id), which would corrupt the subscriptions row.
  // Renewals and failures also fire subscription_updated with the real subscription.
  const HANDLED_EVENTS = [
    'subscription_created',
    'subscription_updated',
    'subscription_cancelled',
    'subscription_expired',
    'subscription_resumed',
  ]

  if (!HANDLED_EVENTS.includes(event_name)) {
    return NextResponse.json({ received: true })
  }

  const attrs = payload.data.attributes
  const lsSubscriptionId = payload.data.id
  const supabase = getServiceClient()

  // Resolve the tenant. Checkout-originated events carry custom_data.property_id,
  // but lifecycle events (cancel/expire/update) can arrive WITHOUT it — so fall
  // back to the row we already keyed on the unique ls_subscription_id. Without
  // this a cancellation silently no-ops and the account stays active forever.
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('property_id, ls_updated_at')
    .eq('ls_subscription_id', lsSubscriptionId)
    .maybeSingle()

  const propertyId = custom_data?.property_id ?? existing?.property_id
  if (!propertyId) {
    // Unknown subscription and no custom_data — nothing to update. Ack so LS
    // stops retrying (a 4xx/5xx would just be redelivered forever).
    return NextResponse.json({ received: true, note: 'unresolved subscription' })
  }

  // Ordering / idempotency guard: LS retries and does not guarantee order. If
  // this event is older than (or identical to) the last one we applied, drop it
  // so a stale/retried 'active' can't resurrect a cancelled subscription.
  if (existing?.ls_updated_at && attrs.updated_at &&
      new Date(attrs.updated_at) <= new Date(existing.ls_updated_at)) {
    return NextResponse.json({ received: true, note: 'stale event ignored' })
  }

  // Determine period end — prefer renews_at, fall back to ends_at, then null (don't fabricate)
  const periodEnd = attrs.renews_at ?? attrs.ends_at ?? null

  let status = mapLsStatus(attrs.status)
  if (event_name === 'subscription_cancelled') status = 'cancelled'
  if (event_name === 'subscription_expired') status = 'expired'

  const row: Record<string, unknown> = {
    property_id: propertyId,
    status,
    provider: 'lemonsqueezy',
    ls_subscription_id: lsSubscriptionId,
    ls_customer_id: String(attrs.customer_id),
    ls_variant_id: String(attrs.variant_id),
    current_period_end: periodEnd,
    cancel_at_period_end: attrs.cancelled,
    updated_at: new Date().toISOString(),
  }
  // Only write these when the event actually carries them, so an event that
  // omits them can't wipe a previously-stored value.
  if (attrs.urls?.customer_portal) row.customer_portal_url = attrs.urls.customer_portal
  if (attrs.updated_at) row.ls_updated_at = attrs.updated_at

  const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'property_id' })

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
