import { NextResponse } from 'next/server'
import { createClient, getUserId } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

    const supabase = await createClient()

    // Fetch and validate the invitation
    const { data: invitation, error: invError } = await supabase
      .from('staff_invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Invitation invalide ou expirée' }, { status: 400 })
    }

    // Link the new user to a staff record for this property
    // Find the pending (is_active=false, user_id=null) staff record created at invite time
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('id')
      .eq('property_id', invitation.property_id)
      .eq('name', invitation.name)
      .eq('role', invitation.role)
      .is('user_id', null)
      .eq('is_active', false)
      .single()

    if (existingStaff) {
      // Activate the pre-created staff record
      await supabase
        .from('staff')
        .update({ user_id: userId, is_active: true })
        .eq('id', existingStaff.id)
    } else {
      // Create a fresh staff record
      await supabase.from('staff').insert({
        property_id: invitation.property_id,
        user_id: userId,
        name: invitation.name,
        role: invitation.role,
        is_active: true,
      })
    }

    // Mark invitation as accepted
    await supabase
      .from('staff_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[accept-invite]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
