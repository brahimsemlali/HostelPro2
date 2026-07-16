import { NextResponse } from 'next/server'
import { getRouteHandlerSession, createAdminClient } from '@/lib/supabase/server'
import { BILLING_PLANS } from '@/lib/constants'

export async function POST(request: Request) {
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
    const err = await res.text()
    console.error('LemonSqueezy checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 502 })
  }

  const data = await res.json() as { data: { attributes: { url: string } } }
  return NextResponse.json({ url: data.data.attributes.url })
}
