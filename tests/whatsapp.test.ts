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

describe('payment_reminder', () => {
  it('formats the amount and adds invoice number + RIB when known', async () => {
    const { WHATSAPP_TEMPLATES } = await import('@/lib/whatsapp/templates')
    const plain = WHATSAPP_TEMPLATES.payment_reminder.fr({ first_name: 'Hans' }, 1250.5)
    expect(plain).toContain('*1 250,50 MAD*')
    expect(plain).not.toContain('Facture')
    const full = WHATSAPP_TEMPLATES.payment_reminder.fr({ first_name: 'Hans' }, 300, {
      propertyName: 'Auberge Atlas', invoiceNumber: 'F-2026-0007', bankDetails: 'CIH · RIB 230 010 1234',
    })
    expect(full).toContain('à *Auberge Atlas*')
    expect(full).toContain('Facture N° *F-2026-0007*')
    expect(full).toContain('CIH · RIB 230 010 1234')
  })
})
