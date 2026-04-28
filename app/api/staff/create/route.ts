import { NextRequest, NextResponse } from 'next/server'
import { getRouteHandlerSession, createAdminClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit({ key: `staff-create:${ip}`, limit: 20, windowSeconds: 3600 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 })
  }

  try {
    const session = await getRouteHandlerSession()
    if (!session?.isOwner) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { name, email, password, role, phone } = await req.json()

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 })
    }

    const validRoles = ['manager', 'receptionist', 'housekeeping']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    const admin = createAdminClient()
    const normalizedEmail = email.toLowerCase().trim()

    // Create the auth user — email_confirm:true skips email verification
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: name.trim(), staff_role: role },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('already registered') ||
          authError.message.toLowerCase().includes('already exists') ||
          authError.code === 'email_exists') {
        return NextResponse.json(
          { error: 'Cet email est déjà utilisé sur la plateforme' },
          { status: 409 }
        )
      }
      throw authError
    }

    const userId = authData.user.id

    // Insert the staff row — rollback auth user if this fails
    const { error: staffError } = await admin.from('staff').insert({
      property_id: session.propertyId,
      user_id: userId,
      name: name.trim(),
      role,
      phone: phone?.trim() || null,
      is_active: true,
    })

    if (staffError) {
      // Clean up the auth user to avoid orphaning it
      await admin.auth.admin.deleteUser(userId)
      throw staffError
    }

    return NextResponse.json({ ok: true, name: name.trim(), email: normalizedEmail })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
