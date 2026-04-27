import { redirect } from 'next/navigation'
import { createClient, getUserSession } from '@/lib/supabase/server'
import { ExpensesClient } from './ExpensesClient'

export default async function ExpensesPage() {
  const session = await getUserSession()
  if (!session) redirect('/login')
  if (session.role === 'housekeeping') redirect('/beds')

  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', session.propertyId)
    .single()

  if (!property) redirect('/onboarding')

  // Fetch last 90 days of expenses + all inventory items in parallel
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const since = ninetyDaysAgo.toISOString().split('T')[0]

  const [expensesRes, inventoryRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('property_id', property.id)
      .gte('expense_date', since)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }),

    supabase
      .from('inventory_items')
      .select('*')
      .eq('property_id', property.id)
      .order('category')
      .order('name'),
  ])

  return (
    <ExpensesClient
      propertyId={property.id}
      initialExpenses={expensesRes.data ?? []}
      initialInventory={inventoryRes.data ?? []}
    />
  )
}
