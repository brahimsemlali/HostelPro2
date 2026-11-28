/**
 * Minimal Channex API client (server only). Docs: https://docs.channex.io
 *
 * Env: CHANNEX_API_KEY (platform key, sent as `user-api-key`),
 *      CHANNEX_BASE_URL (default: staging — production is set explicitly
 *      after certification).
 *
 * Every call returns a ChannexResult instead of throwing, so the worker can
 * decide between retry (429 / 5xx / network) and give-up (other 4xx).
 */

import type { AvailabilityValue, RestrictionValue } from './ari'

export const CHANNEX_STAGING_URL = 'https://staging.channex.io/api/v1'
export const CHANNEX_PRODUCTION_URL = 'https://app.channex.io/api/v1'

export type ChannexResult<T = unknown> = {
  ok: boolean
  status: number            // 0 = network error / timeout
  data: T | null
  warnings: unknown[]       // ARI: rejected values come back here with HTTP 200
  retryAfterSec: number | null
  error: string | null
}

export type ChannexRevision = {
  id: string
  property_id: string
  booking_id: string
  unique_id?: string
  ota_reservation_code?: string
  ota_name?: string
  status: 'new' | 'modified' | 'cancelled'
  rooms?: unknown[]
  customer?: Record<string, unknown>
  [key: string]: unknown
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export class ChannexClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike
  private readonly timeoutMs: number

  constructor(opts: { apiKey: string; baseUrl?: string; fetchImpl?: FetchLike; timeoutMs?: number }) {
    this.apiKey = opts.apiKey
    this.baseUrl = (opts.baseUrl ?? CHANNEX_STAGING_URL).replace(/\/+$/, '')
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.timeoutMs = opts.timeoutMs ?? 20_000
  }

  /** null when CHANNEX_API_KEY is not set (integration disabled). */
  static fromEnv(fetchImpl?: FetchLike): ChannexClient | null {
    const apiKey = process.env.CHANNEX_API_KEY
    if (!apiKey) return null
    return new ChannexClient({ apiKey, baseUrl: process.env.CHANNEX_BASE_URL || CHANNEX_STAGING_URL, fetchImpl })
  }

  private async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<ChannexResult<T>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'user-api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
      })
      const text = await res.text()
      let json: { data?: T; meta?: { warnings?: unknown[] }; errors?: unknown; details?: { retry_after?: number } } | null = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = null
      }
      const retryHeader = Number(res.headers.get('retry-after'))
      const retryAfterSec = Number.isFinite(retryHeader) && retryHeader > 0
        ? retryHeader
        : (json?.details?.retry_after ?? null)
      return {
        ok: res.ok,
        status: res.status,
        data: (json?.data ?? null) as T | null,
        warnings: json?.meta?.warnings ?? [],
        retryAfterSec: res.status === 429 ? (retryAfterSec ?? 60) : null,
        error: res.ok ? null : (json?.errors ? JSON.stringify(json.errors).slice(0, 500) : `HTTP ${res.status}`),
      }
    } catch (err) {
      return {
        ok: false,
        status: 0,
        data: null,
        warnings: [],
        retryAfterSec: null,
        error: err instanceof Error ? err.message : 'network error',
      }
    } finally {
      clearTimeout(timer)
    }
  }

  postAvailability(values: AvailabilityValue[]) {
    return this.request<unknown[]>('POST', '/availability', { values })
  }

  postRestrictions(values: RestrictionValue[]) {
    return this.request<unknown[]>('POST', '/restrictions', { values })
  }

  /** One revision; the JSON:API envelope is unwrapped to its attributes. */
  async getRevision(id: string): Promise<ChannexResult<ChannexRevision>> {
    const r = await this.request<{ id: string; attributes: ChannexRevision }>('GET', `/booking_revisions/${encodeURIComponent(id)}`)
    return { ...r, data: r.data ? { ...r.data.attributes, id: r.data.attributes?.id ?? r.data.id } : null }
  }

  /** Unacknowledged revisions, oldest first (all properties of this API key). */
  async getFeed(): Promise<ChannexResult<ChannexRevision[]>> {
    const r = await this.request<{ id: string; attributes: ChannexRevision }[]>('GET', '/booking_revisions/feed?order[inserted_at]=asc')
    return { ...r, data: r.data ? r.data.map((d) => ({ ...d.attributes, id: d.attributes?.id ?? d.id })) : null }
  }

  ack(id: string) {
    return this.request<unknown>('POST', `/booking_revisions/${encodeURIComponent(id)}/ack`)
  }

  // ── Setup (connection screen) ──────────────────────────────────────────
  // Create responses are JSON:API: the new id is data.id.

  createProperty(property: ChannexPropertyInput) {
    return this.request<{ id: string }>('POST', '/properties', { property })
  }

  createRoomType(room_type: ChannexRoomTypeInput) {
    return this.request<{ id: string }>('POST', '/room_types', { room_type })
  }

  updateRoomType(id: string, room_type: Partial<ChannexRoomTypeInput>) {
    return this.request<{ id: string }>('PUT', `/room_types/${encodeURIComponent(id)}`, { room_type })
  }

  createRatePlan(rate_plan: ChannexRatePlanInput) {
    return this.request<{ id: string }>('POST', '/rate_plans', { rate_plan })
  }

  /** Single-use token (15 min) for the embedded channel screen. */
  async oneTimeToken(propertyId: string, username: string): Promise<ChannexResult<{ token: string }>> {
    return this.request<{ token: string }>('POST', '/auth/one_time_token', {
      one_time_token: { property_id: propertyId, username },
    })
  }

  /** Embedded channel-mapping screen (Channex iframe), restricted to the
   *  channels we support. The host is the API host without /api/v1. */
  iframeUrl(token: string, propertyId: string, lng: 'en' | 'fr' = 'en'): string {
    const host = this.baseUrl.replace(/\/api\/v1$/, '')
    const q = new URLSearchParams({
      oauth_session_key: token,
      app_mode: 'headless',
      redirect_to: '/channels',
      property_id: propertyId,
      channels: 'BDC,HWL,ABB,EXP',
      // Channex has no French UI: English is the closest supported language.
      lng: lng === 'fr' ? 'en' : lng,
    })
    return `${host}/auth/exchange?${q.toString()}`
  }
}

export type ChannexPropertyInput = {
  title: string
  currency: string
  email?: string
  phone?: string
  country?: string
  city?: string
  address?: string
  timezone?: string
  property_type?: 'hostel' | 'riad' | 'guest_house' | 'hotel' | 'apartment'
  settings?: {
    allow_availability_autoupdate_on_modification?: boolean
    allow_availability_autoupdate_on_cancellation?: boolean
    min_stay_type?: 'both' | 'arrival' | 'through'
    state_length?: number
  }
}

export type ChannexRoomTypeInput = {
  property_id: string
  title: string
  count_of_rooms: number
  occ_adults: number
  occ_children: number
  occ_infants: number
  default_occupancy: number
  room_kind: 'room' | 'dorm'
  capacity?: number
}

export type ChannexRatePlanInput = {
  property_id: string
  room_type_id: string
  title: string
  currency: string
  sell_mode: 'per_room' | 'per_person'
  rate_mode: 'manual'
  options: { occupancy: number; is_primary: boolean; rate: number }[]
}

/** Retry later (true) or give up on this payload (false). */
export function isRetryable(r: Pick<ChannexResult, 'status'>): boolean {
  return r.status === 0 || r.status === 429 || r.status >= 500
}
