'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, Link2, Copy, Check, CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

interface ParsedEvent {
  uid: string
  external_booking_id: string
  check_in_date: string
  check_out_date: string
  guest_name: string | null
  first_name: string | null
  last_name: string | null
  is_blocked: boolean
  summary: string
}

interface Props {
  propertyId: string
  savedIcalUrl: string | null
  lastSync: string | null
  importedRefs: string[]
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function IntegrationsClient({ propertyId, savedIcalUrl, lastSync, importedRefs }: Props) {
  const router = useRouter()
  const t = useT()

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('time.justNow')
    if (mins < 60) return t('time.minutesAgo').replace('{n}', String(mins))
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('time.hoursAgo').replace('{n}', String(hours))
    return t('time.daysAgo').replace('{n}', String(Math.floor(hours / 24)))
  }

  const STEPS = [
    {
      num: 1,
      title: t('integrations.step1.title'),
      detail: t('integrations.step1.detail'),
      highlight: 'admin.booking.com',
    },
    {
      num: 2,
      title: t('integrations.step2.title'),
      detail: t('integrations.step2.detail'),
      highlight: t('integrations.step2.highlight'),
    },
    {
      num: 3,
      title: t('integrations.step3.title'),
      detail: t('integrations.step3.detail'),
      highlight: t('integrations.step3.highlight'),
    },
    {
      num: 4,
      title: t('integrations.step4.title'),
      detail: t('integrations.step4.detail'),
      highlight: 'https://admin.booking.com/hotel/...',
    },
  ]

  const [url, setUrl] = useState(savedIcalUrl ?? '')
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [connected, setConnected] = useState(!!savedIcalUrl)
  const [testError, setTestError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewEvents, setPreviewEvents] = useState<ParsedEvent[]>([])
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const importedSet = new Set(importedRefs)
  const newEvents = previewEvents.filter((e) => !e.is_blocked && !importedSet.has(e.external_booking_id))
  const alreadyImported = previewEvents.filter((e) => !e.is_blocked && importedSet.has(e.external_booking_id))
  const blocked = previewEvents.filter((e) => e.is_blocked)

  async function handleTest() {
    if (!url.trim()) return
    setTesting(true)
    setTestError(null)
    try {
      const res = await fetch('/api/sync-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icalUrl: url.trim() }),
      })
      const data = await res.json() as { error?: string; events?: ParsedEvent[] }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur')

      // Save URL to DB (silently ignore if column doesn't exist yet)
      const supabase = createClient()
      await supabase.from('properties').update({ booking_com_ical_url: url.trim() }).eq('id', propertyId)

      setConnected(true)
      setPreviewEvents(data.events ?? [])
      setPreviewOpen(true)
      toast.success(t('integrations.connected'))
    } catch (err) {
      setTestError(err instanceof Error ? err.message : t('common.error'))
      setConnected(false)
    } finally {
      setTesting(false)
    }
  }

  async function handleSync() {
    if (!url.trim()) return
    setSyncing(true)
    setTestError(null)
    try {
      const res = await fetch('/api/sync-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icalUrl: url.trim() }),
      })
      const data = await res.json() as { error?: string; events?: ParsedEvent[] }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur')

      setPreviewEvents(data.events ?? [])
      setPreviewOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('integrations.syncError'))
    } finally {
      setSyncing(false)
    }
  }

  async function handleImport() {
    setImporting(true)
    try {
      const supabase = createClient()
      let count = 0

      for (const event of newEvents) {
        // Create guest
        const { data: guest } = await supabase
          .from('guests')
          .insert({
            property_id: propertyId,
            first_name: event.first_name ?? t('common.unknown'),
            last_name: event.last_name ?? '—',
          })
          .select('id')
          .single()

        if (!guest) continue

        // Create booking
        await supabase.from('bookings').insert({
          property_id: propertyId,
          guest_id: guest.id,
          bed_id: null,           // to be assigned at check-in
          source: 'booking_com',
          external_booking_id: event.external_booking_id,
          status: 'confirmed',
          check_in_date: event.check_in_date,
          check_out_date: event.check_out_date,
          adults: 1,
          total_price: 0,         // to be filled by staff
          commission_rate: 15,    // Booking.com default
        })
        count++
      }

      // Update last sync timestamp
      const supabase2 = createClient()
      await supabase2.from('properties')
        .update({ last_ical_sync: new Date().toISOString() })
        .eq('id', propertyId)

      toast.success(t('integrations.importSuccess').replace('{n}', String(count)))
      setPreviewOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('integrations.importError'))
    } finally {
      setImporting(false)
    }
  }

  function copyMigrationSQL() {
    const sql = `ALTER TABLE properties\n  ADD COLUMN IF NOT EXISTS booking_com_ical_url TEXT,\n  ADD COLUMN IF NOT EXISTS last_ical_sync TIMESTAMPTZ;`
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success(t('integrations.sqlCopied'))
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto">
      <Link href="/settings">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('common.settings')}
        </Button>
      </Link>

      {/* Migration notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium text-amber-800">{t('integrations.migrationRequired')}</p>
              <p className="text-xs text-amber-700">
                {t('integrations.migrationDesc')}
              </p>
              <div className="bg-amber-100 rounded-lg px-3 py-2 font-mono text-xs text-amber-900 border border-amber-200">
                ALTER TABLE properties<br />
                &nbsp;&nbsp;ADD COLUMN IF NOT EXISTS booking_com_ical_url TEXT,<br />
                &nbsp;&nbsp;ADD COLUMN IF NOT EXISTS last_ical_sync TIMESTAMPTZ;
              </div>
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 h-7 text-xs" onClick={copyMigrationSQL}>
                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {copied ? t('common.copied') : t('integrations.copySQL')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking.com integration card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#003580] flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">B.</span>
              </div>
              <div>
                <CardTitle className="text-base">Booking.com</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{t('integrations.icalFreeReadOnly')}</p>
              </div>
            </div>
            {connected && (
              <Badge className="bg-[#0F6E56]/10 text-[#0F6E56] border-0">
                <CheckCircle2 className="w-3 h-3 mr-1" />{t('integrations.connectedBadge')}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Step-by-step guide */}
          {!connected && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{t('integrations.howToGetIcal')}</p>
              <div className="space-y-2">
                {STEPS.map((step) => (
                  <div key={step.num} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#003580]/10 text-[#003580] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {step.num}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.detail.split(step.highlight).map((part, i, arr) => (
                          <span key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <span className="font-medium text-foreground bg-muted px-1 rounded">{step.highlight}</span>
                            )}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* URL input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {connected ? t('integrations.icalLinkLabel') : t('integrations.pasteIcalHere')}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setConnected(false); setTestError(null) }}
                  placeholder="https://admin.booking.com/hotel/ical/..."
                  className={cn('pl-9 font-mono text-xs', connected && 'border-[#0F6E56]/40 bg-[#0F6E56]/5')}
                />
              </div>
              {!connected ? (
                <Button
                  className="bg-[#003580] hover:bg-[#002a6a] shrink-0"
                  onClick={handleTest}
                  disabled={testing || !url.trim()}
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {testing ? t('integrations.testing') : t('integrations.connect')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleSync}
                  disabled={syncing}
                  className="shrink-0"
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {t('integrations.sync')}
                </Button>
              )}
            </div>
            {testError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {testError}
              </div>
            )}
          </div>

          {/* Status */}
          {connected && lastSync && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0F6E56]" />
              {t('integrations.lastSync')}: {timeAgo(lastSync)}
            </p>
          )}

          {/* Info box */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium">{t('integrations.whatItDoes')}</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>✅ {t('integrations.feature1')}</li>
              <li>✅ {t('integrations.feature2')}</li>
              <li>✅ {t('integrations.feature3')}</li>
              <li>⚠️ {t('integrations.warning1')}</li>
              <li>⚠️ {t('integrations.warning2')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#003580]" />
              {t('integrations.syncPreview')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* New bookings */}
            {newEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#0F6E56]">
                  {t('integrations.newBookingsToImport').replace('{n}', String(newEvents.length))}
                </p>
                {newEvents.map((e) => (
                  <div key={e.uid} className="flex items-center justify-between p-3 rounded-lg border bg-[#0F6E56]/5 border-[#0F6E56]/20">
                    <div>
                      <p className="text-sm font-medium">{e.guest_name ?? t('integrations.unknownName')}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.check_in_date)} → {formatDate(e.check_out_date)}
                        {e.external_booking_id && ` · ${t('integrations.ref')}: ${e.external_booking_id}`}
                      </p>
                    </div>
                    <Badge className="bg-[#0F6E56]/10 text-[#0F6E56] border-0 text-xs">{t('integrations.newBadge')}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Already imported */}
            {alreadyImported.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {t('integrations.alreadyImported').replace('{n}', String(alreadyImported.length))}
                </p>
                {alreadyImported.map((e) => (
                  <div key={e.uid} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div>
                      <p className="text-sm text-muted-foreground">{e.guest_name ?? t('integrations.unknownName')}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(e.check_in_date)} → {formatDate(e.check_out_date)}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{t('integrations.alreadyImportedBadge')}</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Blocked */}
            {blocked.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('integrations.blockedPeriods').replace('{n}', String(blocked.length))}</p>
              </div>
            )}

            {previewEvents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">{t('integrations.noBookingsFound')}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setPreviewOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1 bg-[#0F6E56] hover:bg-[#0c5a46]"
              onClick={handleImport}
              disabled={importing || newEvents.length === 0}
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t('integrations.importing')}</>
                : newEvents.length === 0
                ? t('integrations.nothingToImport')
                : t('integrations.importN').replace('{n}', String(newEvents.length))
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
