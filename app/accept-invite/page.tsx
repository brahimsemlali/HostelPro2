import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AcceptInviteClient } from './AcceptInviteClient'

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) redirect('/login')

  const supabase = await createClient()

  // Look up the invitation
  const { data: invitation } = await supabase
    .from('staff_invitations')
    .select('id, name, email, role, property_id, expires_at, accepted_at, properties:property_id(name)')
    .eq('token', token)
    .single()

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.972_0_0)] p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-md border border-black/[0.06]">
          <p className="text-2xl mb-2">❌</p>
          <h1 className="font-semibold text-lg mb-2">Invitation invalide</h1>
          <p className="text-sm text-muted-foreground">
            Ce lien d&apos;invitation est invalide ou a expiré.
          </p>
        </div>
      </div>
    )
  }

  if (invitation.accepted_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.972_0_0)] p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-md border border-black/[0.06]">
          <p className="text-2xl mb-2">✅</p>
          <h1 className="font-semibold text-lg mb-2">Déjà acceptée</h1>
          <p className="text-sm text-muted-foreground">
            Cette invitation a déjà été acceptée.
          </p>
        </div>
      </div>
    )
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.972_0_0)] p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-md border border-black/[0.06]">
          <p className="text-2xl mb-2">⏰</p>
          <h1 className="font-semibold text-lg mb-2">Invitation expirée</h1>
          <p className="text-sm text-muted-foreground">
            Ce lien a expiré. Demandez au propriétaire de vous envoyer une nouvelle invitation.
          </p>
        </div>
      </div>
    )
  }

  const propertyName = Array.isArray(invitation.properties)
    ? (invitation.properties[0] as { name: string })?.name
    : (invitation.properties as { name: string } | null)?.name

  return (
    <AcceptInviteClient
      token={token}
      invitation={{
        id: invitation.id,
        name: invitation.name,
        email: invitation.email,
        role: invitation.role as 'manager' | 'receptionist' | 'housekeeping',
        propertyName: propertyName ?? 'Votre établissement',
      }}
    />
  )
}
