'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, CheckCircle2, AlertCircle, Loader2, PauseCircle, PlayCircle, RefreshCw, Globe, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useT } from '@/app/context/LanguageContext'

export type ChannelsData = {
  connection: {
    status: 'pending' | 'active' | 'paused' | 'error'
    channex_property_id: string | null
    last_full_sync_at: string | null
    last_error: string | null
    updated_at: string
  } | null
  roomTypes: { id: string; name: string; sellUnit: 'bed' | 'room'; units: number; mapped: boolean }[]
  log: { id: number; direction: string; kind: string; ok: boolean; summary: string | null; created_at: string }[]
  openAlerts: number
}

interface Props {
  /** null until migrations 036–039 are applied */
  data: ChannelsData | null
  /** CHANNEX_API_KEY is set on the server */
  enabled: boolean
}

function when(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function ChannelsClient({ data, enabled }: Props) {
  const router = useRouter()
  const t = useT()

  // Worker log lines are technical ("availability: 7 value(s)"): say what happened.
  const activityLabel = (l: ChannelsData['log'][number]) => {
    const base = l.kind === 'availability' ? t('channels.log.availability')
      : l.kind === 'restrictions' ? t('channels.log.rates')
      : l.kind === 'booking_revision' ? t('channels.log.booking')
      : l.kind
    const detail = l.kind === 'booking_revision' ? (l.summary ?? '') : ''
    return `${base}${l.ok ? '' : ` — ${t('channels.log.failed')}`}${detail ? ` · ${detail}` : ''}`
  }
  const [busy, setBusy] = useState<string | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)

  const conn = data?.connection ?? null
  const connected = !!conn?.channex_property_id
  const status = conn?.status ?? null

  async function call(action: 'connect' | 'pause' | 'resume') {
    setBusy(action)
    try {
      const res = await fetch('/api/channel/connect', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }),
      })
      const json = await res.json() as { ok?: boolean; error?: string; skipped?: string[] }
      if (!res.ok || json.ok === false) throw new Error(json.error ?? t('common.error'))
      toast.success(action === 'connect' ? t('channels.connected') : action === 'pause' ? t('channels.paused') : t('channels.resumed'))
      if (json.skipped?.length) toast.message(`${t('channels.skipped')} ${json.skipped.join(', ')}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function openChannels() {
    setBusy('iframe')
    try {
      const res = await fetch('/api/channel/iframe', { method: 'POST' })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? t('common.error'))
      setIframeUrl(json.url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(null)
    }
  }

  const statusBadge = (() => {
    if (!connected) return <Badge variant="outline">{t('channels.status.none')}</Badge>
    if (status === 'active') return <Badge className="bg-[#0F6E56]/10 text-[#0F6E56] border-0">{t('channels.status.active')}</Badge>
    if (status === 'paused') return <Badge className="bg-amber-100 text-amber-800 border-0">{t('channels.status.paused')}</Badge>
    if (status === 'error') return <Badge className="bg-red-100 text-red-700 border-0">{t('channels.status.error')}</Badge>
    return <Badge variant="outline">{t('channels.status.pending')}</Badge>
  })()

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto">
      <Link href="/settings">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('common.settings')}
        </Button>
      </Link>

      <div>
        <h1 className="text-xl font-medium">{t('channels.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('channels.intro')}</p>
      </div>

      {!data && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">{t('channels.needsUpdate')}</p>
          </CardContent>
        </Card>
      )}

      {data && !enabled && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">{t('channels.notEnabled')}</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Step 1 — connection */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">{t('channels.step1')}</CardTitle>
                {statusBadge}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {status === 'error' && conn?.last_error && (
                <p className="text-sm text-red-700 bg-red-50 rounded-lg p-2">{conn.last_error}</p>
              )}
              <ul className="space-y-1.5">
                {data.roomTypes.map((rt) => (
                  <li key={rt.id} className="flex items-center justify-between text-sm">
                    <span>
                      {rt.name}{' '}
                      <span className="text-muted-foreground">
                        · {rt.units}{' '}
                        {rt.sellUnit === 'bed'
                          ? (rt.units === 1 ? t('channels.bed') : t('channels.beds'))
                          : (rt.units === 1 ? t('channels.room') : t('channels.rooms'))}
                      </span>
                    </span>
                    {rt.units === 0
                      ? <span className="text-xs text-muted-foreground">{t('channels.noUnits')}</span>
                      : rt.mapped
                        ? <span className="text-xs text-[#0F6E56] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{t('channels.linked')}</span>
                        : <span className="text-xs text-muted-foreground">{t('channels.notLinked')}</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {t('channels.typesHint')}{' '}
                <Link href="/settings/rooms" className="underline">{t('channels.typesLink')}</Link>
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  className="bg-[#0F6E56] hover:bg-[#0c5a46]"
                  disabled={!enabled || busy !== null}
                  onClick={() => call('connect')}
                >
                  {busy === 'connect' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  {connected ? t('channels.update') : t('channels.connect')}
                </Button>
                {connected && status === 'active' && (
                  <Button variant="outline" disabled={busy !== null} onClick={() => call('pause')}>
                    <PauseCircle className="w-4 h-4 mr-1" />{t('channels.pause')}
                  </Button>
                )}
                {connected && status === 'paused' && (
                  <Button variant="outline" disabled={!enabled || busy !== null} onClick={() => call('resume')}>
                    <PlayCircle className="w-4 h-4 mr-1" />{t('channels.resume')}
                  </Button>
                )}
              </div>
              {conn?.last_full_sync_at && (
                <p className="text-xs text-muted-foreground">{t('channels.lastFull')} {when(conn.last_full_sync_at)}</p>
              )}
            </CardContent>
          </Card>

          {/* Step 2 — OTAs inside the Channex screen */}
          <Card className={cn(!connected && 'opacity-60')}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('channels.step2')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('channels.step2Body')}</p>
              <Button variant="outline" disabled={!enabled || !connected || busy !== null} onClick={openChannels}>
                {busy === 'iframe' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Globe className="w-4 h-4 mr-1" />}
                {t('channels.openChannels')}
              </Button>
              {iframeUrl && (
                <div className="rounded-xl border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                    <span className="text-xs text-muted-foreground">{t('channels.iframeNote')}</span>
                    <button type="button" onClick={() => setIframeUrl(null)} aria-label={t('common.close')} className="p-1 -m-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <iframe src={iframeUrl} title={t('channels.step2')} className="w-full h-[720px] bg-white" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{t('channels.activity')}</CardTitle>
                {data.openAlerts > 0 && (
                  <Link href="/dashboard" className="text-xs text-red-700 underline">
                    {data.openAlerts} {t('channels.alerts')}
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {data.log.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('channels.noActivity')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.log.map((l) => (
                    <li key={l.id} className="flex items-start gap-2 text-sm">
                      {l.ok
                        ? <CheckCircle2 className="w-4 h-4 text-[#0F6E56] shrink-0 mt-0.5" />
                        : <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
                      <span className="flex-1">{activityLabel(l)}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{when(l.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
