import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit({ key: `invite:${ip}`, limit: 20, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  }

  try {
    const session = await getUserSession()
    if (!session?.isOwner) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { name, email, role } = await req.json()
    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    const validRoles = ['manager', 'receptionist', 'housekeeping']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    const supabase = await createClient()
    const normalizedEmail = email.toLowerCase().trim()

    // Reject if this email already has an active staff account for this property
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('id')
      .eq('property_id', session.propertyId)
      .eq('is_active', true)
      .not('user_id', 'is', null)
      // staff table has no email column — check via auth.users join is not possible from client
      // so we check staff_invitations for accepted invites with this email instead
      .limit(1)

    const { data: acceptedInvite } = await supabase
      .from('staff_invitations')
      .select('id')
      .eq('property_id', session.propertyId)
      .eq('email', normalizedEmail)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()

    if (acceptedInvite) {
      return NextResponse.json(
        { error: 'Un employé avec cet email a déjà rejoint l\'équipe' },
        { status: 409 }
      )
    }

    // If a pending (non-expired) invitation already exists, return its URL instead of creating a duplicate
    const { data: pendingInvite } = await supabase
      .from('staff_invitations')
      .select('token')
      .eq('property_id', session.propertyId)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle()

    if (pendingInvite) {
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${pendingInvite.token}`
      return NextResponse.json({ inviteUrl, token: pendingInvite.token, reused: true })
    }

    // Create the invitation record
    const { data: invitation, error: invError } = await supabase
      .from('staff_invitations')
      .insert({
        property_id: session.propertyId,
        invited_by: session.userId,
        email: normalizedEmail,
        name: name.trim(),
        role,
      })
      .select('token')
      .single()

    if (invError) throw invError

    // Pre-create the staff record (inactive until accepted)
    await supabase.from('staff').insert({
      property_id: session.propertyId,
      name: name.trim(),
      role,
      is_active: false,
      // user_id will be set when the invitation is accepted
    })

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${invitation.token}`

    return NextResponse.json({ inviteUrl, token: invitation.token })
  } catch (err) {
    console.error('[invite]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
