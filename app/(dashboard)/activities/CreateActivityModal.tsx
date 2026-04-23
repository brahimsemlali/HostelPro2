'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createActivityAction } from '@/app/actions/activities'
import { toast } from 'sonner'
import type { Activity } from '@/types'
import { MessageCircle, CheckCircle2, PhoneForwarded } from 'lucide-react'
import { buildWhatsAppLink } from '@/lib/whatsapp/templates'
import { cn } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (activity: Activity) => void
  propertyId: string
}

export function CreateActivityModal({ isOpen, onClose, onSuccess, propertyId }: Props) {
  const t = useT()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState<'free' | 'paid'>('free')
  const [sendWhatsapp, setSendWhatsapp] = useState(true)

  // WhatsApp Queue State
  const [queue, setQueue] = useState<{ phones: string[]; message: string; activity: Activity } | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    formData.append('property_id', propertyId)
    formData.append('type', type)
    formData.append('sendWhatsapp', sendWhatsapp.toString())

    const result = await createActivityAction(formData)
    
    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      if (result.phonesToNotify && result.phonesToNotify.length > 0) {
        setQueue({ phones: result.phonesToNotify, message: result.message || '', activity: result.data })
        setCurrentIndex(0)
      } else {
        toast.success(t('activities.created'))
        if (sendWhatsapp) toast.error(t('activities.noClientsForDate'))
        
        handleResetAndClose(result.data)
      }
    }
  }

  function handleSendNext() {
    if (!queue) return

    const link = buildWhatsAppLink(queue.phones[currentIndex], queue.message)
    window.open(link, '_blank')

    if (currentIndex + 1 < queue.phones.length) {
      setCurrentIndex((c) => c + 1)
    } else {
      toast.success(t('activities.allMessagesSent'))
      handleResetAndClose(queue.activity)
    }
  }

  function handleResetAndClose(activity: Activity) {
    onSuccess(activity)
    setQueue(null)
    setCurrentIndex(0)
    setType('free')
    setSendWhatsapp(true)
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {
      // Prevent closing accidentally if queue is active
      if (!queue) onClose()
    }}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
        {!queue ? (
          <>
            <div className="bg-[#0F6E56] p-6 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
               <DialogHeader className="relative z-10">
                 <DialogTitle className="text-2xl font-black tracking-tight text-white">{t('activities.create')}</DialogTitle>
                 <DialogDescription className="text-emerald-100/80 font-medium">
                   {t('activities.createDesc')}
                 </DialogDescription>
               </DialogHeader>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-muted-foreground font-bold text-xs uppercase tracking-widest px-1">{t('activities.titleLabel')}</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  placeholder={t('activities.titlePlaceholder')}
                  className="h-12 text-base rounded-xl border-2 bg-muted/5 focus-visible:ring-0 focus-visible:border-[#0F6E56]/30 transition-all font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-muted-foreground font-bold text-xs uppercase tracking-widest px-1">{t('activities.detailsLabel')}</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t('activities.detailsPlaceholder')}
                  rows={3}
                  className="resize-none rounded-xl border-2 bg-muted/5 focus-visible:ring-0 focus-visible:border-[#0F6E56]/30 transition-all font-medium text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="activity_date" className="text-muted-foreground font-bold text-xs uppercase tracking-widest px-1">{t('common.date')}</Label>
                  <Input 
                    id="activity_date" 
                    name="activity_date" 
                    type="date" 
                    required 
                    min={new Date().toISOString().split('T')[0]} 
                    className="h-12 rounded-xl border-2 bg-muted/5 font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="start_time" className="text-muted-foreground font-bold text-xs uppercase tracking-widest px-1">{t('common.time')}</Label>
                  <Input 
                    id="start_time" 
                    name="start_time" 
                    type="time" 
                    required 
                    className="h-12 rounded-xl border-2 bg-muted/5 font-semibold"
                  />
                </div>
              </div>

              <div className="bg-muted/5 p-4 rounded-2xl border-2 border-muted/50 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-sm">{t('activities.typeLabel')}</Label>
                  <div className="flex bg-white rounded-lg p-1 border shadow-inner">
                    <button 
                      type="button"
                      onClick={() => setType('free')}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                        type === 'free' ? "bg-[#0F6E56] text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {t('activities.free')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('paid')}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                        type === 'paid' ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {t('activities.paid')}
                    </button>
                  </div>
                </div>

                {type === 'paid' && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="price" className="text-muted-foreground font-bold text-xs uppercase tracking-widest px-1">{t('activities.priceLabel')}</Label>
                    <Input id="price" name="price" type="number" step="0.01" min="0" required placeholder="0.00" className="h-12 rounded-xl border-2 border-amber-200 focus-visible:border-amber-500 font-black text-lg" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-4 border-2 border-[#25D366]/20 rounded-2xl bg-[#25D366]/5 transition-all hover:bg-[#25D366]/10">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-[#25D366]/20 rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-[#25D366]" />
                  </div>
                  <div className="space-y-0.5">
                    <Label htmlFor="send-whatsapp" className="text-sm font-black text-[#0A1F1C] cursor-pointer">
                      {t('activities.notifyClients')}
                    </Label>
                    <p className="text-[11px] font-medium text-muted-foreground leading-tight">
                      {t('activities.notifyClientsDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center h-5">
                  <input
                    id="send-whatsapp"
                    type="checkbox"
                    checked={sendWhatsapp}
                    onChange={(e) => setSendWhatsapp(e.target.checked)}
                    className="w-6 h-6 rounded-lg border-2 border-[#25D366]/30 text-[#25D366] focus:ring-[#25D366]/30 accent-[#25D366] cursor-pointer transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold text-muted-foreground">
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="h-12 px-8 bg-[#0F6E56] hover:bg-[#0c5c48] text-white rounded-xl font-black shadow-md hover:shadow-lg transition-all active:scale-[0.98]">
                  {isSubmitting ? t('activities.creating') : t('activities.createBtn')}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="p-10 text-center space-y-8 animate-in zoom-in-95 duration-500">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-emerald-100 rounded-3xl rotate-6" />
              <div className="absolute inset-0 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-12 h-12 text-white stroke-[3]" />
              </div>
            </div>
            
            <div className="space-y-2">
              <DialogTitle className="text-3xl font-black tracking-tight text-[#0A1F1C]">{t('activities.readyTitle')}</DialogTitle>
              <p className="text-muted-foreground font-medium">
                {t('activities.readyDesc1')} <span className="text-[#0F6E56] font-bold">{queue.phones.length} {t('activities.clients')}</span> {t('activities.readyDesc2')}
                <br /><span className="text-sm opacity-80 italic">{t('activities.readyHint')}</span>
              </p>
            </div>

            <div className="p-5 bg-muted/10 border-2 border-dashed border-muted rounded-2xl text-left text-[13px] font-medium text-muted-foreground leading-relaxed">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#0F6E56] mb-2">{t('activities.messageSent')}:</div>
              {queue.message}
            </div>

            <div className="pt-2 space-y-3">
              <Button 
                onClick={handleSendNext} 
                className="w-full h-16 bg-[#25D366] hover:bg-[#1da851] text-white text-lg font-black rounded-2xl shadow-xl shadow-[#25D366]/20 transition-all active:scale-95 group"
              >
                <PhoneForwarded className="w-6 h-6 mr-3 transition-transform group-hover:translate-x-1" />
                {t('activities.startWhatsApp')} ({currentIndex + 1}/{queue.phones.length})
              </Button>
              <Button
                variant="ghost"
                className="w-full h-12 text-sm font-bold text-muted-foreground hover:text-red-500 hover:bg-transparent"
                onClick={() => handleResetAndClose(queue.activity)}
              >
                {t('activities.leaveQueue')}
              </Button>
            </div>

            <div className="w-full bg-muted/30 h-1.5 rounded-full overflow-hidden">
               <div 
                 className="bg-[#25D366] h-full transition-all duration-500 ease-out" 
                 style={{ width: `${((currentIndex) / queue.phones.length) * 100}%` }}
               />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
