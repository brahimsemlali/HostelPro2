import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

    const admin = createAdminClient()

    // Fetch and validate the invitation (admin client bypasses RLS)
    const { data: invitation, error: invError } = await admin
      .from('staff_invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Invitation invalide ou expirée' }, { status: 400 })
    }

    // Find the pre-created inactive staff record linked to this invite
    const { data: existingStaff } = await admin
      .from('staff')
      .select('id')
      .eq('property_id', invitation.property_id)
      .eq('name', invitation.name)
      .eq('role', invitation.role)
      .is('user_id', null)
      .eq('is_active', false)
      .maybeSingle()

    if (existingStaff) {
      await admin
        .from('staff')
        .update({ user_id: userId, is_active: true })
        .eq('id', existingStaff.id)
    } else {
      await admin.from('staff').insert({
        property_id: invitation.property_id,
        user_id: userId,
        name: invitation.name,
        role: invitation.role,
        is_active: true,
      })
    }

    // Mark invitation as accepted
    await admin
      .from('staff_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[accept-invite]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
