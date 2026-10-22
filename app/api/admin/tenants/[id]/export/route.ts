import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withoutSecrets } from '@/lib/constants'
import { requireSuperAdmin, logAdminAction } from '@/lib/admin/server'

// Full JSON backup of one tenant (take one before deleting a tenant).
// select('*') on purpose: this is an export, and the production schema
// varies by which migrations were applied.
const TENANT_TABLES = [
  'rooms', 'beds', 'guests', 'bookings', 'payments', 'booking_extras', 'staff',
  'maintenance', 'night_audits', 'whatsapp_messages', 'expenses', 'inventory_items',
  'pricing_rules', 'extra_catalog', 'housekeeping_tasks', 'activities', 'activity_log',
  'subscriptions',
] as const
const PAGE = 1000

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Strict: a full dump of guest identity documents.
  const actor = await requireSuperAdmin({ strict: true })
  if (!actor) return NextResponse.json({ error: 'Accès refusé : définissez SUPERADMIN_USER_IDS dans Vercel.' }, { status: 403 })

  const { id: propertyId } = await params
  const admin = createAdminClient()
  const { data: property } = await admin.from('properties').select('*').eq('id', propertyId).maybeSingle()
  if (!property) return NextResponse.json({ error: 'Propriété introuvable' }, { status: 404 })

  // PostgREST caps every response (1000 rows by default) regardless of
  // .limit(), so page through each table until a short page comes back.
  async function readAll(table: string): Promise<unknown[] | null> {
    const rows: unknown[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin.from(table).select('*').eq('property_id', propertyId).order('id').range(from, from + PAGE - 1)
      if (error) return null
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE) return rows
    }
  }
  const results = await Promise.all(TENANT_TABLES.map(readAll))
  const tables: Record<string, unknown[]> = {}
  const skipped: string[] = []
  TENANT_TABLES.forEach((t, i) => {
    const rows = results[i]
    if (rows === null) skipped.push(t)
    else tables[t] = rows
  })

  const prop = withoutSecrets(property as Record<string, unknown>)
  await logAdminAction(actor, 'export_tenant', { id: propertyId, name: String(prop.name ?? '') })

  const slug = String(prop.name ?? 'tenant').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  return new NextResponse(
    JSON.stringify({ exported_at: new Date().toISOString(), property: prop, tables, skipped }, null, 2),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="export-${slug}-${propertyId.slice(0, 8)}.json"`,
        'Cache-Control': 'no-store',
      },
    },
  )
}
