import type { Guest, Property, Booking } from '@/types'

type TemplateProp = Pick<Property, 'name' | 'wifi_password' | 'check_out_time'>

export const WHATSAPP_TEMPLATES = {
  welcome: {
    fr: (g: Guest, p: TemplateProp, b: Booking) =>
      `Bienvenue ${g.first_name}! 🏠 Vous êtes bien enregistré(e) à *${p.name}*.\n\n📶 WiFi: *${p.wifi_password ?? 'Voir réception'}*\n🕐 Checkout: *${new Date(b.check_out_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}* avant *${p.check_out_time}*\n\nBonne séjour! 😊`,
    ar: (g: Guest, p: TemplateProp, b: Booking) =>
      `مرحبا ${g.first_name}! 🏠 تم تسجيلك في *${p.name}*.\n\n📶 الواي فاي: *${p.wifi_password ?? 'انظر الاستقبال'}*\n🕐 المغادرة: *${new Date(b.check_out_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}* قبل *${p.check_out_time}*\n\nأتمنى لك إقامة طيبة! 😊`,
    en: (g: Guest, p: TemplateProp, b: Booking) =>
      `Welcome ${g.first_name}! 🏠 You're checked in at *${p.name}*.\n\n📶 WiFi: *${p.wifi_password ?? 'Ask at reception'}*\n🕑 Checkout: *${new Date(b.check_out_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}* before *${p.check_out_time}*\n\nEnjoy your stay! 😊`,
  },
  payment_reminder: {
    fr: (g: Guest, amount: number) =>
      `Bonjour ${g.first_name} 👋\n\nNous vous rappelons qu'un solde de *${amount} MAD* est dû pour votre séjour.\n\nMerci de nous contacter pour régler ce montant. 🙏`,
  },
  checkout_reminder: {
    fr: (g: Guest, p: Pick<Property, 'check_out_time'>) =>
      `Bonjour ${g.first_name}! ☀️\n\nRappel: votre checkout est aujourd'hui avant *${p.check_out_time}*.\n\nNous espérons que votre séjour était agréable!`,
  },
  review_request: {
    fr: (g: Guest, p: Pick<Property, 'name'>) =>
      `Merci ${g.first_name} d'avoir séjourné chez *${p.name}*! 🙏\n\nVotre avis nous aide énormément. Auriez-vous 2 minutes pour laisser un commentaire sur Booking.com ou Google?\n\nÀ bientôt! 🌟`,
  },
  pre_checkin: {
    fr: (g: Guest, p: Pick<Property, 'name'>, checkInDate: string, formUrl: string) =>
      `Bonjour ${g.first_name} ! 👋\n\nVotre réservation à *${p.name}* est confirmée pour le *${checkInDate}*.\n\nPour accélérer votre arrivée, remplissez ce formulaire :\n${formUrl}\n\nÀ bientôt ! 🏠`,
    en: (g: Guest, p: Pick<Property, 'name'>, checkInDate: string, formUrl: string) =>
      `Hi ${g.first_name}! 👋\n\nYour reservation at *${p.name}* is confirmed for *${checkInDate}*.\n\nTo speed up your check-in, fill out this form:\n${formUrl}\n\nSee you soon! 🏠`,
  },
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '')
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${cleaned}?text=${encoded}`
}
