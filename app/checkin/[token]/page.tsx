'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Loader2, Calendar, MapPin } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { NATIONALITIES, COUNTRIES } from '@/lib/constants'
import { useT } from '@/app/context/LanguageContext'

type BookingInfo = {
  id: string
  guest_id: string | null
  pre_checkin_completed: boolean
  check_in_date: string
  check_out_date: string
  property: { name: string; wifi_password: string | null; check_in_time: string; check_out_time: string } | null
  bed: { name: string; room: { name: string } | null } | null
}

type FormState = {
  first_name: string; last_name: string; nationality: string
  document_type: string; document_number: string
  date_of_birth: string; gender: string; phone: string
  country_of_residence: string; profession: string
  address_in_morocco: string; next_destination: string
}

const emptyForm: FormState = {
  first_name: '', last_name: '', nationality: '',
  document_type: 'passport', document_number: '',
  date_of_birth: '', gender: '', phone: '',
  country_of_residence: '', profession: '',
  address_in_morocco: '', next_destination: '',
}

export default function PreArrivalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const t = useT()

  const [status, setStatus] = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [booking, setBooking] = useState<BookingInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, guest_id, pre_checkin_completed, check_in_date, check_out_date,
          property:property_id(name, wifi_password, check_in_time, check_out_time),
          bed:bed_id(name, room:room_id(name))
        `)
        .eq('pre_checkin_token', token)
        .single()

      if (error || !data) { setStatus('error'); return }

      const rawProp = data.property
      const prop = Array.isArray(rawProp) ? (rawProp[0] ?? null) : rawProp
      const rawBed = data.bed
      const rawBedObj = Array.isArray(rawBed) ? (rawBed[0] ?? null) : rawBed
      const bed = rawBedObj
        ? {
            name: rawBedObj.name as string,
            room: Array.isArray(rawBedObj.room)
              ? (rawBedObj.room[0] ?? null)
              : (rawBedObj.room ?? null),
          }
        : null
      const b = { ...data, property: prop, bed } as BookingInfo
      setBooking(b)

      if (b.pre_checkin_completed) { setStatus('done'); return }

      if (b.guest_id) {
        const { data: g } = await supabase
          .from('guests')
          .select('first_name, last_name, nationality, document_type, document_number, date_of_birth, gender, phone, country_of_residence, profession')
          .eq('id', b.guest_id)
          .single()
        if (g) {
          setForm((prev) => ({
            ...prev,
            first_name: g.first_name ?? '',
            last_name: g.last_name ?? '',
            nationality: g.nationality ?? '',
            document_type: g.document_type ?? 'passport',
            document_number: g.document_number ?? '',
            date_of_birth: g.date_of_birth ?? '',
            gender: g.gender ?? '',
            phone: g.phone ?? '',
            country_of_residence: g.country_of_residence ?? '',
            profession: g.profession ?? '',
          }))
        }
      }

      setStatus('form')
    }
    load()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!booking) return
    setSaving(true)

    try {
      const res = await fetch(`/api/checkin/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        throw new Error(error ?? 'Erreur serveur')
      }

      setStatus('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error')
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  function field(key: keyof FormState, value: string) {
    setForm(p => ({ ...p, [key]: value }))
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'oklch(0.973 0.005 230)' }}>
        <Loader2 className="w-6 h-6 animate-spin text-[#0F6E56]" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'oklch(0.973 0.005 230)' }}>
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔗</span>
          </div>
          <p className="text-lg font-semibold mb-1">{t('precheckin.invalid')}</p>
          <p className="text-sm text-muted-foreground">{t('precheckin.invalidDesc')}</p>
        </div>
      </div>
    )
  }

  const prop = booking?.property
  const bed = booking?.bed

  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'oklch(0.973 0.005 230)' }}>
        <div className="text-center max-w-sm space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#0F6E56]/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[#0F6E56]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t('precheckin.done')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('precheckin.doneSubtitle')}</p>
          </div>
          {prop && (
            <div className="rounded-2xl border bg-white p-4 text-left space-y-3 text-sm shadow-sm">
              <p className="font-semibold text-[#0F6E56] text-base">{prop.name}</p>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {t('precheckin.arrival')} <strong className="text-foreground">{prop.check_in_time}</strong>
                  {' · '}{t('precheckin.departure')} <strong className="text-foreground">{prop.check_out_time}</strong>
                </span>
              </div>
              {bed && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{t('precheckin.bed')} <strong className="text-foreground">{bed.name}</strong>
                    {bed.room ? ` — ${bed.room.name}` : ''}
                  </span>
                </div>
              )}
              {prop.wifi_password && (
                <div className="pt-2 border-t">
                  <p className="text-muted-foreground text-xs mb-0.5">{t('precheckin.wifi')}</p>
                  <p className="font-mono font-semibold text-base">{prop.wifi_password}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'oklch(0.973 0.005 230)' }}>
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <AppLogo size={48} className="rounded-xl mx-auto mb-3" />
          {prop && <h1 className="text-lg font-semibold">{prop.name}</h1>}
          <p className="text-sm text-muted-foreground">{t('precheckin.title')}</p>
          {booking && (
            <p className="text-xs text-muted-foreground">
              {t('precheckin.arrival.label')} : {new Date(booking.check_in_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {bed ? ` · ${t('precheckin.bed')} ${bed.name}` : ''}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader className="pb-2">
              <p className="text-sm font-semibold">{t('precheckin.sectionTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('precheckin.sectionDesc')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('precheckin.firstName')}</Label>
                  <Input required value={form.first_name} onChange={(e) => field('first_name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('precheckin.lastName')}</Label>
                  <Input required value={form.last_name} onChange={(e) => field('last_name', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('checkin.step2.nationality')} *</Label>
                  <Select value={form.nationality} onValueChange={(v) => field('nationality', v ?? '')}>
                    <SelectTrigger>
                      <span className={form.nationality ? 'text-sm' : 'text-sm text-muted-foreground'}>
                        {form.nationality || t('precheckin.selectPlaceholder')}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {NATIONALITIES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('checkin.step2.gender')} *</Label>
                  <Select value={form.gender} onValueChange={(v) => field('gender', v ?? '')}>
                    <SelectTrigger>
                      <span className={form.gender ? 'text-sm' : 'text-sm text-muted-foreground'}>
                        {form.gender === 'M' ? t('precheckin.genderMale') : form.gender === 'F' ? t('precheckin.genderFemale') : t('precheckin.selectPlaceholder')}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">{t('precheckin.genderMale')}</SelectItem>
                      <SelectItem value="F">{t('precheckin.genderFemale')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('checkin.step2.docType')} *</Label>
                  <Select value={form.document_type} onValueChange={(v) => field('document_type', v ?? 'passport')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passport">{t('precheckin.docPassport')}</SelectItem>
                      <SelectItem value="cin">{t('precheckin.docCin')}</SelectItem>
                      <SelectItem value="id_card">{t('precheckin.docIdCard')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('checkin.step2.docNumber')} *</Label>
                  <Input required value={form.document_number} onChange={(e) => field('document_number', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('precheckin.dob')}</Label>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => field('date_of_birth', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('precheckin.phone')}</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => field('phone', e.target.value)} placeholder="+212…" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('checkin.step2.residence')}</Label>
                <Select value={form.country_of_residence} onValueChange={(v) => field('country_of_residence', v ?? '')}>
                  <SelectTrigger>
                    <span className={form.country_of_residence ? 'text-sm' : 'text-sm text-muted-foreground'}>
                      {form.country_of_residence || t('precheckin.selectPlaceholder')}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('checkin.step2.profession')}</Label>
                <Input value={form.profession} onChange={(e) => field('profession', e.target.value)} placeholder={t('precheckin.professionPlaceholder')} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('checkin.step2.addressMorocco')}</Label>
                  <Input value={form.address_in_morocco} onChange={(e) => field('address_in_morocco', e.target.value)} placeholder={t('precheckin.addressPlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('checkin.step2.nextDest')}</Label>
                  <Input value={form.next_destination} onChange={(e) => field('next_destination', e.target.value)} placeholder={t('precheckin.nextDestPlaceholder')} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full h-12 text-base rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #16a37d 100%)' }}
            disabled={saving || !form.first_name || !form.last_name || !form.document_number}
          >
            {saving
              ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('precheckin.submitting')}</>
              : <><CheckCircle2 className="w-5 h-5 mr-2" /> {t('precheckin.submit')}</>
            }
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t('precheckin.securityNote')}
          </p>
        </form>
      </div>
    </div>
  )
}
