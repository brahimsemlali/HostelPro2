import { clsx, type ClassValue } from "clsx"
import { addDaysISO, diffDaysISO, todayISO as moroccoTodayISO } from './dates'
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitise a user search term before interpolating it into a PostgREST `.or()`
 * filter string. `.or()` parses commas, parentheses, dots, and `*` as filter
 * syntax, so raw user input can inject extra clauses. We strip those
 * metacharacters (and `%`/`\` used in LIKE patterns) and cap the length,
 * leaving a plain substring safe to embed in an `ilike.%…%` expression.
 */
export function sanitizeSearchTerm(input: string): string {
  return input.replace(/[(),.*:\\%]/g, ' ').trim().slice(0, 100)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Calendar-date helpers live in lib/dates (Morocco time, offset-change safe);
// these keep the historical names used across the app.
export function daysBetween(from: string, to: string): number {
  return diffDaysISO(from.slice(0, 10), to.slice(0, 10))
}

export function todayISO(): string {
  return moroccoTodayISO()
}

export function tomorrowISO(): string {
  return addDaysISO(moroccoTodayISO(), 1)
}

/** True when a Postgres error is an exclusion-constraint violation (23P01) —
 *  in this schema that means the bookings_no_bed_overlap constraint rejected
 *  a booking because the bed is already taken on overlapping dates. */
export function isBedConflictError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23P01'
}
