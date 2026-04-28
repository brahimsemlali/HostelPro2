'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus, Calendar, Clock, MapPin, Trash2, MessageCircle, PhoneForwarded } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
const CreateActivityModal = dynamic(
  () => import('./CreateActivityModal').then((m) => ({ default: m.CreateActivityModal })),
  { ssr: false },
)
import { deleteActivityAction, notifyGuestsAction } from '@/app/actions/activities'
import { buildWhatsAppLink } from '@/lib/whatsapp/templates'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Activity } from '@/types'
import { useT } from '@/app/context/LanguageContext'

interface Props {
  propertyId: string
  currency: string
  initialActivities: Activity[]
}

export function ActivitiesClient({ propertyId, currency, initialActivities }: Props) {
  const router = useRouter()
  const t = useT()
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  // WhatsApp Queue State (reused from Modal logic for existing activities)
  const [queue, setQueue] = useState<{ phones: string[]; message: string; activityId: string } | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isNotifying, setIsNotifying] = useState<string | null>(null)

  const handleCreateSuccess = (newActivity: Activity) => {
    setActivities((prev) => [...prev, newActivity].sort((a, b) => {
      const dateA = new Date(`${a.activity_date}T${a.start_time}`)
      const dateB = new Date(`${b.activity_date}T${b.start_time}`)
      return dateA.getTime() - dateB.getTime()
    }))
    setIsCreateOpen(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('activities.deleteConfirm'))) return
    
    setIsDeleting(id)
    const result = await deleteActivityAction(id)
    setIsDeleting(null)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(t('activities.deleted'))
      setActivities((prev) => prev.filter((a) => a.id !== id))
      router.refresh()
    }
  }

  const handleNotifyGuests = async (activityId: string) => {
    setIsNotifying(activityId)
    const result = await notifyGuestsAction(activityId)
    setIsNotifying(null)

    if (result.error) {
      toast.error(result.error)
    } else if (result.phonesToNotify && result.phonesToNotify.length > 0) {
      setQueue({ phones: result.phonesToNotify, message: result.message || '', activityId })
      setCurrentIndex(0)
    }
  }

  const handleSendNext = () => {
    if (!queue) return
    const link = buildWhatsAppLink(queue.phones[currentIndex], queue.message)
    window.open(link, '_blank')

    if (currentIndex + 1 < queue.phones.length) {
      setCurrentIndex((c) => c + 1)
    } else {
      toast.success(t('activities.allMessagesSent'))
      setQueue(null)
      setCurrentIndex(0)
      router.refresh()
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 hp-page-in space-y-10 bg-[#F4F6F8] min-h-full">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#0A1F1C] tracking-tight">{t('activities.title')}</h1>
          <p className="text-[#475569] font-medium mt-1">
            {t('activities.subtitle')}
          </p>
        </div>
        <Button
          size="lg"
          className="bg-[#0F6E56] hover:bg-[#0c5c48] text-white transition-all rounded-[12px] h-11 px-6 font-semibold"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('activities.new')}
        </Button>
      </div>

      {/* ── WhatsApp Queue Overlay (Dynamic) ── */}
      {queue && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
           <Card className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl border-none animate-in zoom-in-95 duration-300">
             <div className="p-8 text-center space-y-6">
                <div className="relative mx-auto w-20 h-20">
                  <div className="absolute inset-0 bg-[#25D366]/10 rounded-full animate-ping duration-[2000ms]" />
                  <div className="relative w-full h-full bg-[#25D366] rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/30">
                    <MessageCircle className="w-10 h-10 text-white fill-white/10" />
                  </div>
                </div>

                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-[#0A1F1C] tracking-tight">{t('activities.broadcasting')}</h3>
                   <p className="text-sm text-muted-foreground font-medium">
                     {t('activities.messageFor')} <span className="text-[#0F6E56] font-bold">{t('activities.client')} {currentIndex + 1}</span> {t('activities.outOf')} {queue.phones.length}
                   </p>
                </div>

                <div className="bg-muted/30 p-4 rounded-xl text-left text-xs font-medium text-muted-foreground border-2 border-dashed border-muted leading-relaxed max-h-32 overflow-y-auto">
                   {queue.message}
                </div>

                <div className="space-y-3">
                   <Button
                     onClick={handleSendNext}
                     className="w-full h-14 bg-[#25D366] hover:bg-[#1da851] text-white text-base font-black rounded-2xl shadow-xl shadow-[#25D366]/20 group transition-all"
                   >
                     {t('activities.openWhatsApp')} ({currentIndex + 1}/{queue.phones.length})
                     <PhoneForwarded className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                   </Button>
                   <Button
                     variant="ghost"
                     onClick={() => { setQueue(null); setCurrentIndex(0); }}
                     className="w-full h-12 text-sm font-bold text-muted-foreground hover:bg-transparent hover:text-red-500"
                   >
                     {t('activities.stopBroadcast')}
                   </Button>
                </div>

                <div className="w-full bg-muted/50 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#25D366] h-full transition-all duration-500" 
                    style={{ width: `${((currentIndex) / queue.phones.length) * 100}%` }}
                  />
                </div>
             </div>
           </Card>
        </div>
      )}

      {/* ── Activities List ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activities.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border-2 border-dashed rounded-3xl space-y-6 group hover:border-[#0F6E56]/30 transition-all">
            <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
              <Calendar className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold text-[#0A1F1C]">{t('activities.empty')}</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t('activities.emptyDesc')}
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-xl font-bold border-2"
              onClick={() => setIsCreateOpen(true)}
            >
              {t('activities.createFirst')}
            </Button>
          </div>
        ) : (
          activities.map((activity) => (
            <Card key={activity.id} className="group overflow-hidden rounded-[16px] border border-[#E8ECF0] bg-white hover:border-[#0F6E56]/30 hover:shadow-lg hover:shadow-[#0F6E56]/5 transition-all duration-300 flex flex-col shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <CardHeader className="p-6 pb-4">
                <div className="flex justify-between items-center mb-4">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm",
                    activity.type === 'free' ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  )}>
                    {activity.type === 'free' ? `🆓 ${t('activities.free')}` : `💰 ${activity.price} ${currency}`}
                  </div>
                  {activity.whatsapp_message_sent && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 border-[#25D366]/20 bg-[#25D366]/5 text-[#25D366] text-[10px] font-black uppercase tracking-tighter">
                      <MessageCircle className="w-3.5 h-3.5" /> {t('activities.broadcast')}
                    </div>
                  )}
                </div>
                <CardTitle className="text-xl font-semibold text-[#0A1F1C] group-hover:text-[#0F6E56] transition-colors line-clamp-1">{activity.title}</CardTitle>
                {activity.description && (
                  <CardDescription className="line-clamp-2 mt-2 text-sm font-medium leading-relaxed">
                    {activity.description}
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent className="p-5 pt-2 mt-auto border-t border-[#F0F4F7] bg-[#F8FAFC] space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest">{t('common.date')}</p>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0A1F1C]">
                      <Calendar className="w-4 h-4 text-[#0F6E56]" />
                      <span>{new Date(activity.activity_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest">{t('common.time')}</p>
                    <div className="flex items-center gap-2 justify-end text-sm font-semibold text-[#0A1F1C]">
                      <Clock className="w-4 h-4 text-[#0F6E56]" />
                      <span>{activity.start_time.substring(0, 5)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    className="flex-1 h-10 bg-white text-[#0F6E56] border border-[#E8ECF0] hover:border-[#0F6E56]/30 hover:bg-[#0F6E56]/5 rounded-[10px] font-semibold text-xs"
                    onClick={() => handleNotifyGuests(activity.id)}
                    disabled={isNotifying === activity.id}
                  >
                    {isNotifying === activity.id ? t('activities.checking') : `📢 ${t('activities.notifyGuests')}`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-[10px] text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 border border-[#E8ECF0]"
                    onClick={() => handleDelete(activity.id)}
                    disabled={isDeleting === activity.id}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateActivityModal 
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCreateSuccess}
        propertyId={propertyId}
      />
    </div>
  )
}
