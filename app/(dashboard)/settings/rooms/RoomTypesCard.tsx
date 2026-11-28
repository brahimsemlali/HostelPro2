'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import type { Room, Bed, RoomType } from '@/types'
import { Loader2 } from 'lucide-react'
import { useT } from '@/app/context/LanguageContext'

interface Props {
  roomTypes: RoomType[]
  rooms: Room[]
  beds: Bed[]
}

const NEW_TYPE = '__new__'

type Draft = { name: string; default_rate: string; max_occupancy: string }

const toDraft = (rt: RoomType): Draft => ({
  name: rt.name,
  default_rate: rt.default_rate == null ? '' : String(rt.default_rate),
  max_occupancy: String(rt.max_occupancy),
})

/**
 * Room types = what channels sell (migration 036). Owners rename a type, set
 * its nightly price and max guests, and group identical rooms into one type
 * so the sellable count covers all of them.
 */
export function RoomTypesCard({ roomTypes, rooms, beds }: Props) {
  const router = useRouter()
  const t = useT()
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    () => Object.fromEntries(roomTypes.map((rt) => [rt.id, toDraft(rt)])),
  )
  const [busy, setBusy] = useState<string | null>(null)

  const isDirty = (rt: RoomType) => {
    const d = drafts[rt.id]
    if (!d) return false
    const o = toDraft(rt)
    return d.name !== o.name || d.default_rate !== o.default_rate || d.max_occupancy !== o.max_occupancy
  }

  const unitsOf = (rt: RoomType) => {
    const typeRooms = rooms.filter((r) => r.room_type_id === rt.id)
    if (rt.sell_unit === 'room') return typeRooms.length
    const ids = new Set(typeRooms.map((r) => r.id))
    return beds.filter((b) => ids.has(b.room_id)).length
  }

  // Today's price from the beds: the average bed (dorm) or one room's beds together (private).
  const bedPriceOf = (rt: RoomType) => {
    const typeRooms = rooms.filter((r) => r.room_type_id === rt.id)
    const ids = new Set(typeRooms.map((r) => r.id))
    const prices = beds.filter((b) => ids.has(b.room_id)).map((b) => Number(b.base_price))
    if (!prices.length) return null
    const sum = prices.reduce((a, b) => a + b, 0)
    return Math.round(rt.sell_unit === 'room' ? sum / Math.max(1, typeRooms.length) : sum / prices.length)
  }

  async function save(rt: RoomType) {
    const d = drafts[rt.id]
    const name = d.name.trim()
    const rate = d.default_rate.trim() === '' ? null : Number(d.default_rate)
    const occ = Number(d.max_occupancy)
    if (!name || (rate !== null && (!Number.isFinite(rate) || rate < 0)) || !Number.isInteger(occ) || occ < 1 || occ > 50) {
      toast.error(t('common.error'))
      return
    }
    setBusy(rt.id)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('room_types')
        .update({ name, default_rate: rate, max_occupancy: occ })
        .eq('id', rt.id)
      if (error) throw error
      toast.success(t('roomTypes.saved'))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  async function moveRoom(room: Room, target: string) {
    setBusy(room.id)
    try {
      const supabase = createClient()
      let roomTypeId = target
      if (target === NEW_TYPE) {
        // Split the room out into its own type, named after the room.
        const source = roomTypes.find((rt) => rt.id === room.room_type_id)
        const { data, error: insErr } = await supabase
          .from('room_types')
          .insert({
            property_id: room.property_id,
            name: room.name,
            kind: source?.kind ?? (room.type === 'private' ? 'private' : 'dorm'),
            sell_unit: source?.sell_unit ?? (room.type === 'private' ? 'room' : 'bed'),
            gender_policy: room.gender_policy,
            max_occupancy: source?.max_occupancy ?? 1,
            default_rate: source?.default_rate ?? null,
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        roomTypeId = data.id
      }
      const { error } = await supabase.from('rooms').update({ room_type_id: roomTypeId }).eq('id', room.id)
      if (error) throw error
      toast.success(t('roomTypes.moved'))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t('roomTypes.title')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('roomTypes.intro')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {roomTypes.length === 0 && <p className="text-sm text-muted-foreground">{t('roomTypes.empty')}</p>}
        {roomTypes.map((rt) => {
          const d = drafts[rt.id] ?? toDraft(rt)
          const typeRooms = rooms.filter((r) => r.room_type_id === rt.id)
          const sameKind = roomTypes.filter((o) => o.kind === rt.kind)
          const bedPrice = bedPriceOf(rt)
          return (
            <div key={rt.id} className="rounded-xl border p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {rt.sell_unit === 'bed' ? t('roomTypes.sellsBed') : t('roomTypes.sellsRoom')}
                </Badge>
                {rt.gender_policy !== 'mixed' && (
                  <Badge variant="outline" className="text-xs">
                    {rt.gender_policy === 'female' ? t('rooms.female') : t('rooms.male')}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {unitsOf(rt)} {unitsOf(rt) === 1 ? t('roomTypes.unit') : t('roomTypes.units')}
                </span>
                {rt.channex_room_type_id && (
                  <Badge className="text-xs bg-[#0F6E56]/10 text-[#0F6E56] border-0">{t('roomTypes.mapped')}</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor={`rt-name-${rt.id}`}>{t('common.name')}</Label>
                  <Input
                    id={`rt-name-${rt.id}`}
                    value={d.name}
                    onChange={(e) => setDrafts((p) => ({ ...p, [rt.id]: { ...d, name: e.target.value } }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`rt-rate-${rt.id}`}>{t('roomTypes.rate')}</Label>
                  <Input
                    id={`rt-rate-${rt.id}`}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={d.default_rate}
                    placeholder={bedPrice != null ? String(bedPrice) : ''}
                    onChange={(e) => setDrafts((p) => ({ ...p, [rt.id]: { ...d, default_rate: e.target.value } }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {rt.sell_unit === 'bed' ? t('roomTypes.rateHintBed') : t('roomTypes.rateHintRoom')}
                    {bedPrice != null && d.default_rate === '' ? ` · ${t('roomTypes.ratePlaceholder')} : ${bedPrice} MAD` : ''}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`rt-occ-${rt.id}`}>{t('roomTypes.occupancy')}</Label>
                  <Input
                    id={`rt-occ-${rt.id}`}
                    type="number"
                    min={1}
                    max={50}
                    inputMode="numeric"
                    disabled={rt.sell_unit === 'bed'}
                    value={rt.sell_unit === 'bed' ? '1' : d.max_occupancy}
                    onChange={(e) => setDrafts((p) => ({ ...p, [rt.id]: { ...d, max_occupancy: e.target.value } }))}
                  />
                </div>
              </div>

              {typeRooms.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{t('roomTypes.rooms')}</p>
                  <div className="flex flex-wrap gap-2">
                    {typeRooms.map((room) => (
                      <div key={room.id} className="flex items-center gap-2 rounded-lg border px-2 py-1">
                        <span className="text-sm">{room.name}</span>
                        {(sameKind.length > 1 || typeRooms.length > 1) && (
                          <Select
                            value={rt.id}
                            onValueChange={(v) => { if (v && v !== rt.id) moveRoom(room, v) }}
                          >
                            <SelectTrigger className="h-7 text-xs" aria-label={`${t('roomTypes.moveTo')} — ${room.name}`}>
                              <span className="text-xs">{busy === room.id ? '…' : t('roomTypes.moveTo')}</span>
                            </SelectTrigger>
                            <SelectContent>
                              {sameKind.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                              {typeRooms.length > 1 && <SelectItem value={NEW_TYPE}>{t('roomTypes.ownType')}</SelectItem>}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isDirty(rt) && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDrafts((p) => ({ ...p, [rt.id]: toDraft(rt) }))}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#0F6E56] hover:bg-[#0c5a46]"
                    disabled={busy === rt.id}
                    onClick={() => save(rt)}
                  >
                    {busy === rt.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    {t('common.save')}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
