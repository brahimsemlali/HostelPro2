'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, ExternalLink, Landmark, Zap, MessageCircle, Loader2 } from 'lucide-react'
import { BILLING_PLANS, BANK_WIRE_DETAILS } from '@/lib/constants'
import type { Subscription } from '@/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  propertyId: string
  subscription: Subscription | null
}

export function BillingClient({ propertyId, subscription }: Props) {
  const [loadingVariant, setLoadingVariant] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // Show success toast when returning from LemonSqueezy checkout
    if (params.get('success') === '1') {
      toast.success('Paiement confirmé — votre abonnement est actif !')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    // Auto-trigger checkout when arriving from register → onboarding flow
    const planKey = params.get('checkout')
    if (!planKey) return
    const match = BILLING_PLANS.find((p) => p.id.startsWith(planKey))
    if (match) handleCheckout(match.ls_variant_id)
    window.history.replaceState({}, '', window.location.pathname)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCheckout(variantId: string) {
    setLoadingVariant(variantId)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'Erreur lors de la création du paiement')
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Impossible de contacter le service de paiement')
    } finally {
      setLoadingVariant(null)
    }
  }

  const now = new Date()
  const periodEnd = subscription ? new Date(subscription.current_period_end) : null
  const isExpired = periodEnd ? periodEnd < now : false
  const isActive = subscription && (subscription.status === 'active' || subscription.status === 'trialing') && !isExpired
  const isTrial = subscription?.status === 'trialing' && !isExpired
  const trialDaysLeft = isTrial && periodEnd
    ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto hp-page-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-[#0A1F1C]">Abonnement & Facturation</h1>
        <p className="text-[#94A3B8] text-sm">Gérez votre accès à Sweet Reservation et vos méthodes de paiement.</p>
      </div>

      {/* Current Status Banner */}
      <Card className={cn(
        "border-0 shadow-sm",
        isActive ? "bg-[#0F6E56]/5 border border-[#0F6E56]/10" : "bg-amber-50 border border-amber-100"
      )}>
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              isActive ? "bg-[#0F6E56] text-white" : "bg-amber-500 text-white"
            )}>
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-[#0A1F1C]">
                Statut : {isActive ? (isTrial ? `Essai Gratuit${trialDaysLeft !== null ? ` — ${trialDaysLeft}j restants` : ''}` : 'Actif') : 'Inactif / Expiré'}
              </p>
              <p className="text-sm text-[#475569]">
                {subscription
                  ? isTrial
                    ? `Votre essai gratuit se termine le ${periodEnd!.toLocaleDateString('fr-FR')}. Souscrivez pour continuer.`
                    : `Votre abonnement ${subscription.provider === 'manual_wire' ? 'manuel' : 'automatique'} se renouvelle le ${periodEnd!.toLocaleDateString('fr-FR')}`
                  : "Vous n&apos;avez pas encore d&apos;abonnement actif."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive && (
              <Badge className={cn("hover:opacity-90", isTrial ? "bg-amber-500" : "bg-[#0F6E56]")}>
                {isTrial ? 'Essai' : subscription?.provider === 'manual_wire' ? 'Virement' : 'LemonSqueezy'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pricing Plans */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-semibold text-[#0A1F1C]">Choisir un forfait</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BILLING_PLANS.map((plan) => (
              <Card key={plan.id} className="relative overflow-hidden border-[#E8ECF0] hover:border-[#0F6E56]/30 transition-all">
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-bold text-[#0A1F1C]">${plan.price}</span>
                    <span className="text-[#94A3B8] text-sm">/mois</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-[#475569]">
                        <Check className="w-4 h-4 text-[#0F6E56]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full bg-[#0F6E56] hover:bg-[#0c5a46] rounded-xl py-6"
                    disabled={loadingVariant === plan.ls_variant_id}
                    onClick={() => handleCheckout(plan.ls_variant_id)}
                  >
                    {loadingVariant === plan.ls_variant_id
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Chargement…</>
                      : 'Sélectionner'
                    }
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Local Payment (Virement) */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-[#0A1F1C]">Paiement Local (Maroc)</h2>
          <Card className="border-[#E8ECF0] bg-[#F8FAFC]">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-[#0F6E56] mb-1">
                <Landmark className="w-5 h-5" />
                <span className="font-semibold">Virement Bancaire</span>
              </div>
              <CardDescription>
                Payez en MAD par virement national sans frais de change.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 bg-white p-4 rounded-xl border border-[#E8ECF0] text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">Banque</p>
                  <p className="font-medium text-[#0A1F1C]">{BANK_WIRE_DETAILS.bank_name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">Titulaire</p>
                  <p className="font-medium text-[#0A1F1C]">{BANK_WIRE_DETAILS.account_holder}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-bold">RIB</p>
                  <p className="font-mono text-[13px] bg-[#F4F6F8] p-2 rounded mt-1 select-all">{BANK_WIRE_DETAILS.rib}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs text-[#64748B] italic">
                  * Après le virement, envoyez une capture d'écran sur WhatsApp pour activation immédiate.
                </p>
                <Button variant="outline" className="w-full border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/5 gap-2"
                  onClick={() => window.open('https://wa.me/212600000000', '_blank')}>
                  <MessageCircle className="w-4 h-4" />
                  Envoyer le reçu (WhatsApp)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
