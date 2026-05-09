import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Must use service-role client — RLS blocks anon writes to subscriptions
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function mapStatus(lsStatus: string): string {
  const map: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    unpaid: 'past_due',
    cancelled: 'cancelled',
    expired: 'expired',
    paused: 'cancelled',
    on_trial: 'trialing',
  }
  return map[lsStatus] ?? 'active'
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('X-Signature') ?? ''
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''

  // Verify HMAC-SHA256 signature
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } catch {
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
        cancelled: boolean
        urls?: { customer_portal?: string }
      }
    }
  }

  const { event_name, custom_data } = payload.meta
  const propertyId = custom_data?.property_id

  const HANDLED_EVENTS = [
    'subscription_created',
    'subscription_updated',
    'subscription_cancelled',
    'subscription_expired',
    'subscription_payment_success',
    'subscription_payment_failed',
    'subscription_resumed',
  ]

  if (!HANDLED_EVENTS.includes(event_name)) {
    return NextResponse.json({ received: true })
  }

  if (!propertyId) {
    console.error('LS webhook: missing property_id in custom_data', payload.meta)
    return NextResponse.json({ error: 'Missing property_id' }, { status: 400 })
  }

  const attrs = payload.data.attributes
  const lsSubscriptionId = payload.data.id

  // Determine period end — prefer renews_at, fall back to ends_at, then 30 days
  const periodEnd =
    attrs.renews_at ??
    attrs.ends_at ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  let status = mapStatus(attrs.status)
  if (event_name === 'subscription_cancelled') status = 'cancelled'
  if (event_name === 'subscription_expired') status = 'expired'

  const supabase = getServiceClient()

  const { error } = await supabase.from('subscriptions').upsert(
    {
      property_id: propertyId,
      status,
      provider: 'lemonsqueezy',
      ls_subscription_id: lsSubscriptionId,
      ls_customer_id: String(attrs.customer_id),
      ls_variant_id: String(attrs.variant_id),
      current_period_end: periodEnd,
      cancel_at_period_end: attrs.cancelled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'property_id' },
  )

  if (error) {
    console.error('LS webhook: supabase upsert error', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
