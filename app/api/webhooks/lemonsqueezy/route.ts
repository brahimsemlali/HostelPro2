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
        cancelled: boolean
        urls?: { customer_portal?: string }
      }
    }
  }

  const { event_name, custom_data } = payload.meta
  const propertyId = custom_data?.property_id

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

  if (!propertyId) {
    console.error('LS webhook: missing property_id in custom_data', payload.meta)
    return NextResponse.json({ error: 'Missing property_id' }, { status: 400 })
  }

  const attrs = payload.data.attributes
  const lsSubscriptionId = payload.data.id

  // Determine period end — prefer renews_at, fall back to ends_at, then null (don't fabricate)
  const periodEnd = attrs.renews_at ?? attrs.ends_at ?? null

  let status = mapLsStatus(attrs.status)
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
