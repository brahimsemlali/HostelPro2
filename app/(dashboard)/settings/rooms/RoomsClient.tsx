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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Room, Bed } from '@/types'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { useT } from '@/app/context/LanguageContext'

interface Props {
  propertyId: string
  rooms: Room[]
  beds: Bed[]
}

export function RoomsClient({ propertyId, rooms, beds }: Props) {
  const router = useRouter()
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [roomDialog, setRoomDialog] = useState(false)
  const [bedDialog, setBedDialog] = useState(false)
  const [roomForm, setRoomForm] = useState({ name: '', type: 'dorm', gender_policy: 'mixed' })
  const [bedForm, setBedForm] = useState({
    name: '', room_id: '', bunk_position: '', base_price: '120',
  })

  async function createRoom() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('rooms').insert({
        property_id: propertyId,
        name: roomForm.name,
        type: roomForm.type,
        gender_policy: roomForm.gender_policy,
      })
      if (error) throw error
      toast.success(t('rooms.roomCreated'))
      setRoomDialog(false)
      setRoomForm({ name: '', type: 'dorm', gender_policy: 'mixed' })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  async function createBed() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('beds').insert({
        property_id: propertyId,
        room_id: bedForm.room_id,
        name: bedForm.name,
        bunk_position: bedForm.bunk_position || null,
        base_price: parseFloat(bedForm.base_price),
      })
      if (error) throw error
      toast.success(t('rooms.bedCreated'))
      setBedDialog(false)
      setBedForm({ name: '', room_id: '', bunk_position: '', base_price: '120' })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  async function deleteRoom(id: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('rooms').delete().eq('id', id)
      if (error) throw error
      router.refresh()
    } catch {
      toast.error(t('rooms.deleteRoomError'))
    }
  }

  async function deleteBed(id: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('beds').delete().eq('id', id)
      if (error) throw error
      router.refresh()
    } catch {
      toast.error(t('rooms.deleteBedError'))
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex gap-3 justify-end">
        <Button variant="outline" size="sm" onClick={() => setRoomDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('rooms.room')}
          </Button>
          <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('rooms.newRoom')}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>{t('common.name')} *</Label>
                <Input value={roomForm.name} onChange={(e) => setRoomForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Dortoir A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('common.type')}</Label>
                  <Select value={roomForm.type} onValueChange={(v) => setRoomForm(p => ({ ...p, type: v ?? 'dorm' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dorm">{t('onboarding.step2.dorm')}</SelectItem>
                      <SelectItem value="private">{t('onboarding.step2.private')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('rooms.gender')}</Label>
                  <Select value={roomForm.gender_policy} onValueChange={(v) => setRoomForm(p => ({ ...p, gender_policy: v ?? 'mixed' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mixed">{t('rooms.mixed')}</SelectItem>
                      <SelectItem value="female">{t('rooms.female')}</SelectItem>
                      <SelectItem value="male">{t('rooms.male')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={createRoom} disabled={loading || !roomForm.name}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} {t('common.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button size="sm" className="bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={() => setBedDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t('rooms.bed')}
          </Button>
          <Dialog open={bedDialog} onOpenChange={setBedDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('rooms.newBed')}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('common.name')} *</Label>
                  <Input value={bedForm.name} onChange={(e) => setBedForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: A1" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('rooms.room')} *</Label>
                  <Select value={bedForm.room_id} onValueChange={(v) => setBedForm(p => ({ ...p, room_id: v ?? '' }))}>
                    <SelectTrigger>
                      <span className={bedForm.room_id ? 'text-sm' : 'text-sm text-muted-foreground'}>
                        {bedForm.room_id ? rooms.find(r => r.id === bedForm.room_id)?.name : t('common.select')}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('rooms.bunkPosition')}</Label>
                  <Select value={bedForm.bunk_position} onValueChange={(v) => setBedForm(p => ({ ...p, bunk_position: v ?? '' }))}>
                    <SelectTrigger><SelectValue placeholder={t('rooms.bunkNone')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t('rooms.bunkNone')}</SelectItem>
                      <SelectItem value="bottom">{t('rooms.bunkBottom')}</SelectItem>
                      <SelectItem value="top">{t('rooms.bunkTop')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('rooms.pricePerNight')}</Label>
                  <Input type="number" value={bedForm.base_price} onChange={(e) => setBedForm(p => ({ ...p, base_price: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full bg-[#0F6E56] hover:bg-[#0c5a46]" onClick={createBed} disabled={loading || !bedForm.name || !bedForm.room_id}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} {t('common.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rooms.map((room) => {
        const roomBeds = beds.filter((b) => b.room_id === room.id)
        return (
          <Card key={room.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{room.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {room.type === 'dorm' ? t('onboarding.step2.dorm') : t('onboarding.step2.private')}
                  </Badge>
                  {room.gender_policy !== 'mixed' && (
                    <Badge variant="outline" className="text-xs">
                      {room.gender_policy === 'female' ? t('rooms.female') : t('rooms.male')}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{roomBeds.length} {t('rooms.beds')}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteRoom(room.id)} className="text-muted-foreground hover:text-destructive h-7 w-7">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {roomBeds.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('rooms.noBeds')}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {roomBeds.map((bed) => (
                    <div key={bed.id} className="rounded-lg border p-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{bed.name}</p>
                        <p className="text-xs text-muted-foreground">{bed.base_price} MAD</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteBed(bed.id)} className="text-muted-foreground hover:text-destructive h-6 w-6">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
