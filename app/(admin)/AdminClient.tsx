'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Shield, Activity, Globe, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Property {
  id: string
  name: string
  city: string
  created_at: string
  subscriptions: {
    status: string
    provider: string
    current_period_end: string
  }[] | null
}

interface Props {
  properties: Property[]
}

export function AdminClient({ properties }: Props) {
  const [query, setQuery] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const filtered = properties.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.city.toLowerCase().includes(query.toLowerCase())
  )

  const activateSubscription = async (propertyId: string, months: number) => {
    setLoadingId(propertyId)
    try {
      const expiry = new Date()
      expiry.setMonth(expiry.getMonth() + months)

      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          property_id: propertyId,
          status: 'active',
          provider: 'manual_wire',
          current_period_end: expiry.toISOString(),
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      toast.success(`Abonnement activé pour ${months} mois`)
      router.refresh()
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto hp-page-in min-h-screen bg-[#F8FAFC]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0A1F1C] text-white flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0A1F1C]">Command Center</h1>
            <p className="text-sm text-[#64748B]">Superadmin Dashboard — HostelPro SaaS</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-white border border-[#E8ECF0] px-4 py-2 rounded-xl flex items-center gap-3">
            <Activity className="w-4 h-4 text-[#0F6E56]" />
            <div className="text-xs">
              <p className="text-[#94A3B8] font-medium">Total Propriétés</p>
              <p className="font-bold text-[#0A1F1C]">{properties.length}</p>
            </div>
          </div>
          <div className="bg-white border border-[#E8ECF0] px-4 py-2 rounded-xl flex items-center gap-3">
            <Globe className="w-4 h-4 text-blue-500" />
            <div className="text-xs">
              <p className="text-[#94A3B8] font-medium">Actifs</p>
              <p className="font-bold text-[#0A1F1C]">
                {properties.filter(p => p.subscriptions?.[0]?.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <Input 
          placeholder="Rechercher une propriété..." 
          className="pl-10 h-11 bg-white border-[#E8ECF0] rounded-xl"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="bg-white border border-[#E8ECF0] rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E8ECF0]">
              <th className="px-6 py-4 text-xs font-bold text-[#64748B] uppercase tracking-wider">Propriété</th>
              <th className="px-6 py-4 text-xs font-bold text-[#64748B] uppercase tracking-wider">Statut</th>
              <th className="px-6 py-4 text-xs font-bold text-[#64748B] uppercase tracking-wider">Expiration</th>
              <th className="px-6 py-4 text-xs font-bold text-[#64748B] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {filtered.map((p) => {
              const sub = p.subscriptions?.[0]
              const isExpired = sub && new Date(sub.current_period_end) < new Date()
              const isActive = sub?.status === 'active' && !isExpired

              return (
                <tr key={p.id} className="hover:bg-[#F8FAFC]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-[#0A1F1C]">{p.name}</div>
                    <div className="text-xs text-[#94A3B8]">{p.city} · Inscrit le {new Date(p.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    {isActive ? (
                      <Badge className="bg-[#0F6E56]/10 text-[#0F6E56] border-0 hover:bg-[#0F6E56]/10">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Actif
                      </Badge>
                    ) : sub?.status === 'trialing' ? (
                      <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Essai</Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-500 border-red-100 bg-red-50">
                        <AlertCircle className="w-3 h-3 mr-1" /> Expiré
                      </Badge>
                    )}
                    <span className="ml-2 text-[10px] text-[#94A3B8] uppercase">{sub?.provider}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#475569]">
                    {sub ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-xs border-[#E8ECF0]"
                        disabled={loadingId === p.id}
                        onClick={() => activateSubscription(p.id, 6)}
                      >
                        +6m
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-xs border-[#E8ECF0]"
                        disabled={loadingId === p.id}
                        onClick={() => activateSubscription(p.id, 12)}
                      >
                        +12m
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-[#94A3B8] hover:text-[#0A1F1C]"
                        title="Impersonnaliser (God Mode)"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
