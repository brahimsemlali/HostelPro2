'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { formatTime } from '@/lib/utils'
import { buildWhatsAppLink, WHATSAPP_TEMPLATES } from '@/lib/whatsapp/templates'
import type { Property, Booking, Guest, WhatsAppMessage } from '@/types'

type WhatsAppProperty = Pick<Property, 'id' | 'name' | 'phone' | 'wifi_password' | 'check_out_time'>
import { MessageSquare, Send, CheckCheck } from 'lucide-react'
import { useT } from '@/app/context/LanguageContext'

interface Props {
  property: WhatsAppProperty
  messages: (WhatsAppMessage & { guest?: Guest | null })[]
  activeBookings: (Booking & { guest?: Guest })[]
}

export function WhatsAppClient({ property, messages, activeBookings }: Props) {
  const t = useT()
  const [selectedBooking, setSelectedBooking] = useState<string>('')

  const TEMPLATE_NAMES: Record<string, string> = {
    welcome: t('whatsapp.template.welcome'),
    payment_reminder: t('whatsapp.template.payment'),
    checkout_reminder: t('whatsapp.template.checkout'),
    review_request: t('whatsapp.template.review'),
  }
  const [customMessage, setCustomMessage] = useState('')
  const [preview, setPreview] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')

  const booking = activeBookings.find((b) => b.id === selectedBooking)
  const guest = booking?.guest

  function applyTemplate(key: string) {
    if (!guest || !booking) {
      toast.error(t('whatsapp.selectFirst'))
      return
    }
    setSelectedTemplate(key)
    let msg = ''
    if (key === 'welcome') {
      msg = WHATSAPP_TEMPLATES.welcome.fr(guest, property, booking)
    } else if (key === 'payment_reminder') {
      msg = WHATSAPP_TEMPLATES.payment_reminder.fr(guest, 0)
    } else if (key === 'checkout_reminder') {
      msg = WHATSAPP_TEMPLATES.checkout_reminder.fr(guest, property)
    } else if (key === 'review_request') {
      msg = WHATSAPP_TEMPLATES.review_request.fr(guest, property)
    }
    setCustomMessage(msg)
    setPreview(msg)
  }

  async function handleSend() {
    const msg = customMessage || preview
    if (!msg || !guest) return

    const phone = guest.whatsapp ?? guest.phone
    if (!phone) {
      toast.error(t('whatsapp.noPhone'))
      return
    }

    const link = buildWhatsAppLink(phone, msg)

    // Log message — fire and forget (open WhatsApp regardless)
    try {
      const supabase = createClient()
      await supabase.from('whatsapp_messages').insert({
        property_id: property.id,
        guest_id: guest.id,
        booking_id: booking?.id ?? null,
        template_key: selectedTemplate || null,
        phone,
        message: msg,
        status: 'sent',
      })
    } catch {
      // Log failure silently — don't block opening WhatsApp
    }

    window.open(link, '_blank')
    toast.success(t('whatsapp.opened'))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto hp-page-in bg-[#F4F6F8] min-h-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send panel */}
        <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-4">
          <h2 className="font-semibold text-[15px] text-[#0A1F1C]">{t('whatsapp.sendMessage')}</h2>

          {/* Guest selector */}
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-[#475569]">{t('whatsapp.activeGuest')}</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeBookings.length === 0 ? (
                <p className="text-sm text-[#94A3B8]">{t('whatsapp.noActiveGuests')}</p>
              ) : (
                activeBookings.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBooking(b.id)}
                    className={`w-full text-left rounded-[12px] border p-3 transition-colors ${
                      selectedBooking === b.id
                        ? 'border-[#0F6E56] bg-[#0F6E56]/5'
                        : 'border-[#E8ECF0] hover:border-[#D1D9E0] bg-[#F8FAFC]'
                    }`}
                  >
                    <p className="text-sm font-medium text-[#0A1F1C]">
                      {b.guest?.first_name} {b.guest?.last_name}
                    </p>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {t('bookings.checkout')} {b.check_out_date} · {b.guest?.whatsapp ?? b.guest?.phone ?? t('common.noPhone')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Templates */}
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-[#475569]">{t('whatsapp.templates')}</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TEMPLATE_NAMES).map(([key, label]) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  className={`rounded-[10px] border-[#E8ECF0] text-xs ${selectedTemplate === key ? 'border-[#0F6E56] text-[#0F6E56] bg-[#0F6E56]/5' : 'text-[#475569]'}`}
                  onClick={() => applyTemplate(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-[#475569]">{t('whatsapp.message')}</p>
            <Textarea
              rows={6}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={t('whatsapp.messagePlaceholder')}
              className="resize-none text-sm border-[#E8ECF0] rounded-[10px]"
            />
          </div>

          <Button
            className="w-full bg-[#25D366] hover:bg-[#1da952] text-white rounded-[10px]"
            onClick={handleSend}
            disabled={!customMessage && !preview}
          >
            <Send className="w-4 h-4 mr-2" />
            {t('whatsapp.openWhatsApp')}
          </Button>
        </div>

        {/* Message log */}
        <div className="space-y-4">
          <h2 className="font-semibold text-[15px] text-[#0A1F1C]">{t('whatsapp.log')}</h2>
          {messages.length === 0 ? (
            <div className="bg-white border border-[#E8ECF0] rounded-[16px] flex flex-col items-center justify-center py-12 text-center shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <MessageSquare className="w-10 h-10 text-[#94A3B8]/40 mb-3" />
              <p className="text-sm text-[#94A3B8]">{t('whatsapp.noMessages')}</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E8ECF0] rounded-[16px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)] max-h-[600px] overflow-y-auto">
              {messages.map((m, i) => {
                const g = m.guest as { first_name: string; last_name: string } | null
                return (
                  <div key={m.id} className={`px-4 py-3 ${i < messages.length - 1 ? 'border-b border-[#F0F4F7]' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="text-sm font-medium text-[#0A1F1C]">
                          {g ? `${g.first_name} ${g.last_name}` : m.phone}
                        </p>
                        {m.template_key && (
                          <Badge variant="outline" className="text-[11px] mt-0.5 border-[#E8ECF0] text-[#475569]">
                            {TEMPLATE_NAMES[m.template_key] ?? m.template_key}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#94A3B8] flex-shrink-0">
                        <CheckCheck className="w-3 h-3 text-[#25D366]" />
                        {formatTime(m.sent_at)}
                      </div>
                    </div>
                    <p className="text-xs text-[#94A3B8] line-clamp-2">{m.message}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
