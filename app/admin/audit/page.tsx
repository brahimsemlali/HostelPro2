import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ScrollText } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/superadmin'
import { isMissingTable } from '@/lib/admin/metrics'

const ACTION_LABELS: Record<string, string> = {
  record_payment: 'Paiement encaissé', delete_payment: 'Paiement supprimé', extend: 'Mois offert(s)',
  set_end_date: 'Date de fin modifiée', set_plan: 'Plan modifié', trial: 'Essai accordé', cancel: 'Annulé à échéance',
  expire: 'Accès coupé', suspend: 'Compte suspendu', unsuspend: 'Compte réactivé', save_notes: 'Notes modifiées',
  update_property: 'Infos modifiées', recovery_link: 'Lien mot de passe généré', login_as: 'Connexion en tant que propriétaire',
  export_tenant: 'Export des données', delete_tenant: 'Client supprimé',
}

function summarize(details: Record<string, unknown> | null): string {
  if (!details) return ''
  const parts: string[] = []
  if (typeof details.amount === 'number') parts.push(`${details.amount} MAD`)
  if (typeof details.months === 'number') parts.push(`${details.months} mois`)
  if (typeof details.date === 'string') parts.push(`jusqu'au ${details.date}`)
  if (typeof details.days === 'number') parts.push(`${details.days} j`)
  if (typeof details.reason === 'string') parts.push(details.reason)
  if (typeof details.email === 'string') parts.push(details.email)
  return parts.join(' · ')
}

export default async function AdminAuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isSuperAdmin(user)) redirect('/dashboard')

  const { data, error } = await createAdminClient()
    .from('admin_audit_log')
    .select('id, action, actor_email, property_id, property_name, details, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 hp-page-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#0A1F1C]/8 flex items-center justify-center"><ScrollText className="w-5 h-5 text-[#0A1F1C]" /></div>
        <div>
          <h1 className="text-xl font-bold text-[#0A1F1C]">Journal d&apos;audit</h1>
          <p className="text-xs text-[#94A3B8]">Chaque action effectuée depuis le panneau admin (500 dernières)</p>
        </div>
      </div>

      {isMissingTable(error) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <b>Migration 033 non appliquée</b> — le journal d&apos;audit sera rempli dès qu&apos;elle le sera.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E8ECF0] shadow-sm divide-y divide-[#F1F5F9]">
        {(data ?? []).length === 0 && <p className="px-5 py-12 text-center text-sm text-[#94A3B8]">Aucune action enregistrée.</p>}
        {(data ?? []).map((a) => (
          <div key={a.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="text-[#0A1F1C]">
                <span className="font-semibold">{ACTION_LABELS[a.action] ?? a.action}</span>
                {a.property_name && (
                  <> — {a.property_id && a.action !== 'delete_tenant'
                    ? <Link href={`/admin/tenants/${a.property_id}`} className="hover:text-[#0F6E56]">{a.property_name}</Link>
                    : a.property_name}</>
                )}
              </p>
              <p className="text-xs text-[#94A3B8]">{[a.actor_email, summarize(a.details as Record<string, unknown> | null)].filter(Boolean).join(' · ')}</p>
            </div>
            <span className="text-[11px] text-[#94A3B8] shrink-0">{format(new Date(a.created_at), 'd MMM yyyy HH:mm', { locale: fr })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
