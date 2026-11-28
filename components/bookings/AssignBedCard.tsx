'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BedDouble, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { isBedConflictError, isRoomTypeFullError } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

export type FreeBed = { id: string; name: string; roomName: string; genderPolicy: 'mixed' | 'female' | 'male' }

interface Props {
  bookingId: string
  /** Beds of the booking's room type (or all beds if untyped) free for its whole stay. */
  freeBeds: FreeBed[]
  /** Online bookings arrive without a bed (Booking.com sells "1 dorm bed"). */
  fromChannel: boolean
}

/** Place a bed-less booking (online or iCal import) in a specific bed. */
export function AssignBedCard({ bookingId, freeBeds, fromChannel }: Props) {
  const router = useRouter()
  const t = useT()
  const [bedId, setBedId] = useState('')
  const [saving, setSaving] = useState(false)
  const selected = freeBeds.find((b) => b.id === bedId)

  async function assign() {
    if (!bedId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('bookings').update({ bed_id: bedId }).eq('id', bookingId)
      if (error) {
        if (isRoomTypeFullError(error)) throw new Error(t('checkin.roomTypeFull'))
        if (isBedConflictError(error)) throw new Error(t('checkin.bedConflict'))
        throw error
      }
      toast.success(t('assignBed.done'))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <BedDouble className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">{t('assignBed.title')}</p>
          <p className="text-xs text-amber-800">
            {fromChannel ? t('assignBed.introChannel') : t('assignBed.intro')}
          </p>
        </div>
      </div>
      {freeBeds.length === 0 ? (
        <p className="text-sm text-amber-900">{t('assignBed.none')}</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={bedId} onValueChange={(v) => setBedId(v ?? '')}>
            <SelectTrigger className="bg-white sm:w-72" aria-label={t('assignBed.pick')}>
              <span className={selected ? 'text-sm' : 'text-sm text-muted-foreground'}>
                {selected ? `${selected.roomName} — ${selected.name}` : t('assignBed.pick')}
              </span>
            </SelectTrigger>
            <SelectContent>
              {freeBeds.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.roomName} — {b.name}
                  {b.genderPolicy === 'female' ? ` · ${t('rooms.female')}` : b.genderPolicy === 'male' ? ` · ${t('rooms.male')}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="bg-[#0F6E56] hover:bg-[#0c5a46]" disabled={!bedId || saving} onClick={assign}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {t('assignBed.confirm')}
          </Button>
        </div>
      )}
    </div>
  )
}
