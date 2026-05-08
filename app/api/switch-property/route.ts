import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { propertyId } = await req.json() as { propertyId?: string }
    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId requis' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // Allow access if user is the property owner OR an active staff member of that property
    const [ownerRes, staffRes] = await Promise.all([
      supabase.from('properties').select('id').eq('id', propertyId).eq('owner_id', user.id).maybeSingle(),
      supabase.from('staff').select('id').eq('property_id', propertyId).eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ])

    if (!ownerRes.data && !staffRes.data) {
      return NextResponse.json({ error: 'Propriété introuvable' }, { status: 403 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set('hp-active-property', propertyId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
