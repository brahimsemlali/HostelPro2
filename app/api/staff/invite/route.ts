import { NextRequest, NextResponse } from 'next/server'
import { getRouteHandlerSession, createAdminClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit({ key: `invite:${ip}`, limit: 20, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  }

  try {
    const session = await getRouteHandlerSession()
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

    const admin = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()

    const { data: acceptedInvite } = await admin
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
    const { data: pendingInvite } = await admin
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
    const { data: invitation, error: invError } = await admin
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
    await admin.from('staff').insert({
      property_id: session.propertyId,
      name: name.trim(),
      role,
      is_active: false,
    })

    const acceptInvitePath = `/accept-invite?token=${invitation.token}`
    // PKCE callback route exchanges the auth code, then redirects to acceptInvitePath
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback?next=${encodeURIComponent(acceptInvitePath)}`
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}${acceptInvitePath}`

    // Send the invite email via Supabase Auth.
    // inviteUserByEmail creates the user (or re-invites if they exist) and sends an email
    // with a magic link that authenticates them and redirects to callbackUrl → acceptInvitePath.
    let emailSent = false
    try {
      const { error: emailError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo: callbackUrl,
        data: { full_name: name.trim(), staff_role: role },
      })
      if (!emailError) emailSent = true
      else console.warn('[invite] inviteUserByEmail failed:', emailError.message)
    } catch (e) {
      console.warn('[invite] inviteUserByEmail threw:', e)
    }

    return NextResponse.json({ inviteUrl, token: invitation.token, emailSent })
  } catch (err) {
    console.error('[invite]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
