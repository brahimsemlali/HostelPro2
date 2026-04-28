'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Check, ChevronRight, ChevronLeft, Loader2, Plus, Trash2, Bed } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { useLang, useT } from '@/app/context/LanguageContext'
import type { Lang } from '@/lib/i18n'

type Step = 0 | 1 | 2 | 3

interface RoomDef {
  id: string
  name: string
  type: 'dorm' | 'private'
  beds: number
  price: number
}

function uid() {
  return Math.random().toString(36).slice(2)
}

const DEFAULT_ROOMS: RoomDef[] = [
  { id: uid(), name: 'Dortoir A', type: 'dorm', beds: 6, price: 120 },
  { id: uid(), name: 'Dortoir B', type: 'dorm', beds: 6, price: 120 },
  { id: uid(), name: 'Chambre Privée 1', type: 'private', beds: 2, price: 350 },
]

export default function OnboardingPage() {
  const t = useT()
  const { lang, setLang } = useLang()
  const [step, setStep] = useState<Step>(0)
  const [loading, setLoading] = useState(false)

  const [property, setProperty] = useState({
    name: '',
    city: 'Agadir',
    phone: '',
    wifi_password: '',
  })

  const [rooms, setRooms] = useState<RoomDef[]>(DEFAULT_ROOMS)

  function addRoom() {
    setRooms(prev => [
      ...prev,
      { id: uid(), name: `Chambre ${prev.length + 1}`, type: 'dorm', beds: 4, price: 120 },
    ])
  }

  function removeRoom(id: string) {
    setRooms(prev => prev.filter(r => r.id !== id))
  }

  function updateRoom(id: string, field: keyof RoomDef, value: string | number) {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const totalBeds = rooms.reduce((sum, r) => sum + r.beds, 0)

  async function handleFinish() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: prop, error: propErr } = await supabase.from('properties').insert({
        owner_id: user.id,
        name: property.name,
        city: property.city,
        phone: property.phone || null,
        wifi_password: property.wifi_password || null,
        check_in_time: '14:00',
        check_out_time: '11:00',
        default_language: lang,
      }).select().single()
      if (propErr) throw new Error(propErr.message)

      for (const roomDef of rooms) {
        const { data: room, error: roomErr } = await supabase.from('rooms').insert({
          property_id: prop.id,
          name: roomDef.name,
          type: roomDef.type,
          gender_policy: 'mixed',
        }).select().single()
        if (roomErr) throw new Error(`Chambre "${roomDef.name}": ${roomErr.message}`)

        const words = roomDef.name.trim().split(/\s+/)
        const lastWord = words[words.length - 1]
        const prefix = (lastWord.length === 1 && /[A-Za-z]/.test(lastWord))
          ? lastWord.toUpperCase()
          : words.map((w) => w[0]).join('').slice(0, 2).toUpperCase()
        const bunkable = roomDef.type === 'dorm' && roomDef.beds > 4
        const bedsToCreate = Array.from({ length: roomDef.beds }, (_, i) => ({
          property_id: prop.id,
          room_id: room.id,
          name: `${prefix}${i + 1}`,
          bunk_position: bunkable ? (i % 2 === 0 ? 'bottom' : 'top') : null,
          base_price: roomDef.price,
          status: 'available',
        }))
        const { error: bedsErr } = await supabase.from('beds').insert(bedsToCreate)
        if (bedsErr) throw new Error(`Lits "${roomDef.name}": ${bedsErr.message}`)
      }

      const { error: staffErr } = await supabase.from('staff').insert({
        property_id: prop.id,
        user_id: user.id,
        name: user.email?.split('@')[0] || 'Admin',
        role: 'owner',
        is_active: true
      })

      toast.success(t('onboarding.success'))
      window.location.href = '/dashboard'
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const langOptions: { value: Lang; label: string; flag: string; desc: string }[] = [
    { value: 'fr', label: 'Français', flag: '🇫🇷', desc: 'Interface en français' },
    { value: 'en', label: 'English',  flag: '🇬🇧', desc: 'English interface' },
  ]

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <AppLogo size={48} className="rounded-xl" />
        </div>

        {/* Step 0 — Language selection */}
        {step === 0 && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-1 text-center">
                <h2 className="text-xl font-medium">{t('onboarding.lang.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('onboarding.lang.subtitle')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {langOptions.map(({ value, label, flag, desc }) => (
                  <button
                    key={value}
                    onClick={() => setLang(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all duration-200',
                      lang === value
                        ? 'border-[#0F6E56] bg-[#0F6E56]/5'
                        : 'border-border hover:border-[#0F6E56]/40 hover:bg-muted/50',
                    )}
                  >
                    <span className="text-3xl">{flag}</span>
                    <span className="font-semibold text-[15px]">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                    {lang === value && (
                      <div className="w-5 h-5 rounded-full bg-[#0F6E56] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <Button
                className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]"
                onClick={() => setStep(1)}
              >
                {t('common.next')} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step indicator (only for steps 1–3) */}
        {step > 0 && (
          <div className="flex items-center justify-center gap-3 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-3">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  s < step ? 'bg-[#0F6E56] text-white'
                  : s === step ? 'bg-[#0F6E56]/20 text-[#0F6E56] ring-2 ring-[#0F6E56]'
                  : 'bg-muted text-muted-foreground'
                )}>
                  {s < step ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={cn('h-0.5 w-12 transition-colors', s < step ? 'bg-[#0F6E56]' : 'bg-muted')} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1 — Property info */}
        {step === 1 && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1">
                <h2 className="text-xl font-medium">{t('onboarding.step1.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('onboarding.step1.subtitle')}</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t('onboarding.step1.propertyName')}</Label>
                  <Input
                    placeholder={t('onboarding.step1.propertyPlaceholder')}
                    value={property.name}
                    onChange={(e) => setProperty(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t('onboarding.step1.city')}</Label>
                    <Input
                      value={property.city}
                      onChange={(e) => setProperty(p => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('onboarding.step1.phone')}</Label>
                    <Input
                      type="tel"
                      placeholder="+212..."
                      value={property.phone}
                      onChange={(e) => setProperty(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('onboarding.step1.wifi')}</Label>
                  <Input
                    value={property.wifi_password}
                    onChange={(e) => setProperty(p => ({ ...p, wifi_password: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back')}
                </Button>
                <Button
                  className="flex-1 bg-[#0F6E56] hover:bg-[#0c5a46]"
                  disabled={!property.name.trim()}
                  onClick={() => setStep(2)}
                >
                  {t('common.next')} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Room setup */}
        {step === 2 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-medium">{t('onboarding.step2.title')}</h2>
                  <p className="text-sm text-muted-foreground">
                    {rooms.length} {rooms.length > 1 ? (lang === 'en' ? 'rooms' : 'chambres') : (lang === 'en' ? 'room' : 'chambre')} · {totalBeds} {lang === 'en' ? 'beds total' : 'lits au total'}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={addRoom}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t('onboarding.step2.add')}
                </Button>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {rooms.map((room) => (
                  <div key={room.id} className="border rounded-xl p-4 space-y-3 bg-background">
                    <div className="flex items-center gap-2">
                      <Input
                        className="flex-1 h-8 text-sm font-medium"
                        value={room.name}
                        onChange={(e) => updateRoom(room.id, 'name', e.target.value)}
                        placeholder={t('onboarding.step2.roomName')}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeRoom(room.id)}
                        disabled={rooms.length === 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-3 flex rounded-lg overflow-hidden border text-sm">
                        <button
                          onClick={() => updateRoom(room.id, 'type', 'dorm')}
                          className={cn(
                            'flex-1 py-1.5 text-center transition-colors',
                            room.type === 'dorm'
                              ? 'bg-[#0F6E56] text-white font-medium'
                              : 'hover:bg-muted text-muted-foreground'
                          )}
                        >
                          {t('onboarding.step2.dorm')}
                        </button>
                        <button
                          onClick={() => updateRoom(room.id, 'type', 'private')}
                          className={cn(
                            'flex-1 py-1.5 text-center transition-colors',
                            room.type === 'private'
                              ? 'bg-[#0F6E56] text-white font-medium'
                              : 'hover:bg-muted text-muted-foreground'
                          )}
                        >
                          {t('onboarding.step2.private')}
                        </button>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('onboarding.step2.beds')}</Label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateRoom(room.id, 'beds', Math.max(1, room.beds - 1))}
                            className="w-7 h-7 rounded border flex items-center justify-center text-sm hover:bg-muted"
                          >−</button>
                          <span className="w-8 text-center text-sm font-medium">{room.beds}</span>
                          <button
                            onClick={() => updateRoom(room.id, 'beds', Math.min(30, room.beds + 1))}
                            className="w-7 h-7 rounded border flex items-center justify-center text-sm hover:bg-muted"
                          >+</button>
                        </div>
                      </div>

                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('onboarding.step2.price')}</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          value={room.price}
                          onChange={(e) => updateRoom(room.id, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {Array.from({ length: Math.min(room.beds, 20) }).map((_, i) => (
                        <div key={i} className="w-5 h-5 rounded bg-[#0F6E56]/15 flex items-center justify-center">
                          <Bed className="w-3 h-3 text-[#0F6E56]" />
                        </div>
                      ))}
                      {room.beds > 20 && (
                        <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[9px] text-muted-foreground font-medium">
                          +{room.beds - 20}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back')}
                </Button>
                <Button
                  className="flex-1 bg-[#0F6E56] hover:bg-[#0c5a46]"
                  disabled={rooms.length === 0}
                  onClick={() => setStep(3)}
                >
                  {t('common.next')} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Summary */}
        {step === 3 && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1">
                <h2 className="text-xl font-medium">{t('onboarding.step3.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('onboarding.step3.subtitle')}</p>
              </div>

              <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step3.property')}</span>
                  <span className="font-medium">{property.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step3.city')}</span>
                  <span className="font-medium">{property.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step3.rooms')}</span>
                  <span className="font-medium">{rooms.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('onboarding.step3.totalBeds')}</span>
                  <span className="font-medium">{totalBeds} {t('onboarding.step3.beds')}</span>
                </div>
              </div>

              <div className="space-y-2">
                {rooms.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm px-1">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        r.type === 'dorm' ? 'bg-[#0F6E56]/10 text-[#0F6E56]' : 'bg-blue-100 text-blue-700'
                      )}>
                        {r.type === 'dorm' ? t('onboarding.step3.dorm') : t('onboarding.step3.private')}
                      </div>
                      <span className="font-medium">{r.name}</span>
                    </div>
                    <span className="text-muted-foreground">{r.beds} {t('onboarding.step3.beds')} · {r.price} MAD</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back')}
                </Button>
                <Button
                  className="flex-1 bg-[#0F6E56] hover:bg-[#0c5a46]"
                  onClick={handleFinish}
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('onboarding.step3.launching')}</>
                  ) : (
                    <><Check className="w-4 h-4 mr-2" />{t('onboarding.step3.launch')}</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
