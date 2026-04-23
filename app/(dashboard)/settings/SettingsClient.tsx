'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import type { Property } from '@/types'
import { Loader2, BedDouble, Users, Plug, TrendingUp, Globe, ShoppingBag } from 'lucide-react'
import { useLang, useT } from '@/app/context/LanguageContext'
import { cn } from '@/lib/utils'
import type { Lang } from '@/lib/i18n'

export function SettingsClient({ property }: { property: Property }) {
  const router = useRouter()
  const t = useT()
  const { lang, setLang } = useLang()
  const [loading, setLoading] = useState(false)
  const [langLoading, setLangLoading] = useState(false)
  const [form, setForm] = useState({
    name: property.name,
    address: property.address ?? '',
    city: property.city,
    phone: property.phone ?? '',
    email: property.email ?? '',
    wifi_password: property.wifi_password ?? '',
    check_in_time: property.check_in_time,
    check_out_time: property.check_out_time,
    police_prefecture: property.police_prefecture ?? '',
    review_url: property.review_url ?? '',
    whatsapp_phone_number_id: property.whatsapp_phone_number_id ?? '',
    whatsapp_access_token: property.whatsapp_access_token ?? '',
  })

  async function handleSave() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('properties').update(form).eq('id', property.id)
      if (error) throw error
      toast.success(t('settings.property.saved'))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleLangSave(newLang: Lang) {
    setLang(newLang)
    setLangLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('properties')
        .update({ default_language: newLang })
        .eq('id', property.id)
      if (error) throw error
      toast.success(t('lang.saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLangLoading(false)
    }
  }

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[#475569]">{label}</Label>
      <Input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        className="bg-white border-[#E8ECF0] rounded-[10px] h-10 px-3"
      />
    </div>
  )

  const langOptions: { value: Lang; label: string; flag: string }[] = [
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'en', label: 'English',  flag: '🇬🇧' },
  ]

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto bg-[#F4F6F8] min-h-full hp-page-in">

      {/* Property Info */}
      <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <p className="text-[15px] font-semibold text-[#0A1F1C] mb-4">{t('settings.property.title')}</p>
        <div className="space-y-4">
          {field('name',               t('settings.property.name'))}
          <div className="grid grid-cols-2 gap-3">
            {field('city',             t('settings.property.city'))}
            {field('phone',            t('settings.property.phone'), 'tel')}
          </div>
          {field('address',            t('settings.property.address'))}
          {field('email',              t('settings.property.email'), 'email')}
          {field('wifi_password',      t('settings.property.wifi'))}
          <div className="grid grid-cols-2 gap-3">
            {field('check_in_time',    t('settings.property.checkin'), 'time')}
            {field('check_out_time',   t('settings.property.checkout'), 'time')}
          </div>
          {field('police_prefecture',  t('settings.property.prefecture'))}
          {field('review_url',         t('settings.property.reviewUrl'), 'url')}

          <Button
            className="bg-[#0F6E56] hover:bg-[#0c5a46] text-white rounded-[10px] px-5 h-10"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {t('common.save')}
          </Button>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-4 h-4 text-[#0F6E56]" />
          <p className="text-[15px] font-semibold text-[#0A1F1C]">{t('lang.title')}</p>
        </div>
        <p className="text-sm text-[#94A3B8] mb-4">{t('lang.subtitle')}</p>
        <div className="flex gap-3">
          {langOptions.map(({ value, label, flag }) => (
            <button
              key={value}
              onClick={() => handleLangSave(value)}
              disabled={langLoading}
              className={cn(
                'flex items-center gap-2.5 px-4 py-2.5 rounded-[10px] border-2 transition-all duration-200 text-sm font-medium',
                lang === value
                  ? 'border-[#0F6E56] bg-[#0F6E56]/5 text-[#0F6E56]'
                  : 'border-[#E8ECF0] text-[#475569] hover:border-[#0F6E56]/30',
              )}
            >
              <span className="text-lg">{flag}</span>
              {label}
              {langLoading && lang === value && <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-sections grid */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/settings/rooms">
          <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-5 flex items-center gap-3 hover:border-[#0F6E56]/30 transition-colors cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <BedDouble className="w-5 h-5 text-[#0F6E56]" />
            <div>
              <p className="font-medium text-sm text-[#0A1F1C]">{t('settings.rooms.title')}</p>
              <p className="text-xs text-[#94A3B8]">{t('settings.rooms.manage')}</p>
            </div>
          </div>
        </Link>
        <Link href="/settings/staff">
          <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-5 flex items-center gap-3 hover:border-[#0F6E56]/30 transition-colors cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <Users className="w-5 h-5 text-[#0F6E56]" />
            <div>
              <p className="font-medium text-sm text-[#0A1F1C]">{t('settings.staff.title')}</p>
              <p className="text-xs text-[#94A3B8]">{t('settings.staff.manage')}</p>
            </div>
          </div>
        </Link>
        <Link href="/settings/pricing">
          <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-5 flex items-center gap-3 hover:border-[#0F6E56]/30 transition-colors cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <TrendingUp className="w-5 h-5 text-[#0F6E56]" />
            <div>
              <p className="font-medium text-sm text-[#0A1F1C]">{t('settings.pricing.title')}</p>
              <p className="text-xs text-[#94A3B8]">{t('settings.pricing.manage')}</p>
            </div>
          </div>
        </Link>
        <Link href="/settings/extras">
          <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-5 flex items-center gap-3 hover:border-[#0F6E56]/30 transition-colors cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <ShoppingBag className="w-5 h-5 text-[#0F6E56]" />
            <div>
              <p className="font-medium text-sm text-[#0A1F1C]">Catalogue suppléments</p>
              <p className="text-xs text-[#94A3B8]">Vos extras avec vos prix</p>
            </div>
          </div>
        </Link>
        <Link href="/settings/integrations">
          <div className="bg-white border border-[#E8ECF0] rounded-[16px] p-5 flex items-center gap-3 hover:border-[#0F6E56]/30 transition-colors cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.04)] col-span-2 sm:col-span-1">
            <Plug className="w-5 h-5 text-[#003580]" />
            <div>
              <p className="font-medium text-sm text-[#0A1F1C]">{t('settings.integrations.title')}</p>
              <p className="text-xs text-[#94A3B8]">{t('settings.integrations.manage')}</p>
            </div>
            <span className="ml-auto text-xs bg-[#003580]/10 text-[#003580] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
              {t('settings.integrations.badge')}
            </span>
          </div>
        </Link>
      </div>
    </div>
  )
}
