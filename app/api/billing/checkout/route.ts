import { NextResponse } from 'next/server'
import { getRouteHandlerSession, createAdminClient } from '@/lib/supabase/server'
import { BILLING_PLANS } from '@/lib/constants'

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_CARD_PAYMENTS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Paiement par carte indisponible — payez par virement ou en espèces.' }, { status: 503 })
  }

  // getRouteHandlerSession — React.cache()'d getUserSession is unreliable in Route Handlers
  const session = await getRouteHandlerSession()
  if (!session || !session.isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let variantId: string
  try {
    const body = await request.json() as { variantId?: string }
    variantId = String(body.variantId ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!BILLING_PLANS.some((p) => p.ls_variant_id === variantId)) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
  }

  // session.propertyId is ownership-verified — admin client just reads that one row
  const supabase = createAdminClient()
  const { data: property } = await supabase
    .from('properties')
    .select('id, email, name')
    .eq('id', session.propertyId)
    .single()

  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  // One live LemonSqueezy subscription per property: a second checkout would
  // bill the owner twice and overwrite ls_subscription_id, so cancelling one
  // would leave the other charging. Plan changes go through the LS portal.
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('status, provider, ls_subscription_id')
    .eq('property_id', property.id)
    .maybeSingle()
  if (
    existingSub?.provider === 'lemonsqueezy' &&
    existingSub.ls_subscription_id &&
    ['active', 'trialing', 'past_due'].includes(existingSub.status)
  ) {
    return NextResponse.json({ error: 'Un abonnement est déjà actif — gérez-le depuis le portail client.' }, { status: 409 })
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const storeId = process.env.LEMONSQUEEZY_STORE_ID

  if (!apiKey || !storeId) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
  }

  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          custom: { property_id: property.id },
          email: property.email ?? undefined,
        },
        product_options: {
          redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=1`,
        },
      },
      relationships: {
        store: { data: { type: 'stores', id: storeId } },
        variant: { data: { type: 'variants', id: variantId } },
      },
    },
  }

  const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 502 })
  }

  const data = await res.json() as { data: { attributes: { url: string } } }
  return NextResponse.json({ url: data.data.attributes.url })
}
