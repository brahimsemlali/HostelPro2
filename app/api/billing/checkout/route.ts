import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const session = await getUserSession()
  if (!session || !session.isOwner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { variantId } = await request.json() as { variantId: string }
  if (!variantId) {
    return NextResponse.json({ error: 'variantId required' }, { status: 400 })
  }

  const supabase = await createClient()
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
