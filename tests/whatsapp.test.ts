import { describe, it, expect } from 'vitest'
import { buildWhatsAppLink } from '@/lib/whatsapp/templates'

describe('buildWhatsAppLink — wa.me deep links', () => {
  it('keeps a full international number intact', () => {
    expect(buildWhatsAppLink('+212612345678', 'Salut')).toBe(
      'https://wa.me/212612345678?text=Salut',
    )
  })

  it('strips spaces, dashes and parentheses', () => {
    expect(buildWhatsAppLink('+212 6-12 (34) 56 78', 'ok')).toBe(
      'https://wa.me/212612345678?text=ok',
    )
  })

  it('strips the international "00" dial prefix (wa.me rejects leading zeros)', () => {
    expect(buildWhatsAppLink('00212612345678', 'ok')).toBe(
      'https://wa.me/212612345678?text=ok',
    )
  })

  it('URL-encodes the message', () => {
    const link = buildWhatsAppLink('+212612345678', 'Bienvenue à *Auberge Atlas* & bon séjour!')
    expect(link).toBe(
      `https://wa.me/212612345678?text=${encodeURIComponent('Bienvenue à *Auberge Atlas* & bon séjour!')}`,
    )
    expect(link).not.toContain(' ')
    expect(link).not.toContain('&text')
  })
})
