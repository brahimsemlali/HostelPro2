// Excel-FR friendly CSV: ";" separator, decimal comma, CRLF, UTF-8 BOM so
// accents survive a double-click open in Excel.

import { round2 } from '@/lib/money'

export function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 1234.5 → "1234,50" (no thousands separator: Excel parses it as a number). */
export function csvNumber(n: number): string {
  return round2(n).toFixed(2).replace('.', ',')
}

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n')
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCsv(csv: string, filename: string): void {
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
}
