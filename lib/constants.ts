export const NATIONALITIES = [
  'Marocaine', 'Française', 'Espagnole', 'Allemande', 'Italienne',
  'Portugaise', 'Britannique', 'Américaine', 'Canadienne', 'Belge',
  'Suisse', 'Néerlandaise', 'Suédoise', 'Norvégienne', 'Danoise',
  'Finlandaise', 'Polonaise', 'Russe', 'Algérienne', 'Tunisienne',
  'Égyptienne', 'Sénégalaise', 'Ivoirienne', 'Nigériane', 'Sud-africaine',
  'Brésilienne', 'Argentine', 'Mexicaine', 'Japonaise', 'Chinoise',
  'Coréenne', 'Indienne', 'Australienne', 'Néo-zélandaise',
]

export const COUNTRIES = [
  'Maroc', 'France', 'Espagne', 'Allemagne', 'Italie',
  'Portugal', 'Royaume-Uni', 'États-Unis', 'Canada', 'Belgique',
  'Suisse', 'Pays-Bas', 'Suède', 'Norvège', 'Danemark',
  'Finlande', 'Pologne', 'Russie', 'Algérie', 'Tunisie',
  'Égypte', 'Sénégal', "Côte d'Ivoire", 'Nigeria', 'Afrique du Sud',
  'Brésil', 'Argentine', 'Mexique', 'Japon', 'Chine',
  'Corée du Sud', 'Inde', 'Australie', 'Nouvelle-Zélande',
]

export const BOOKING_SOURCES: Record<string, string> = {
  direct: 'Direct',
  booking_com: 'Booking.com',
  hostelworld: 'Hostelworld',
  airbnb: 'Airbnb',
  phone: 'Téléphone',
  walkin: 'Walk-in',
}

export const PAYMENT_METHODS: Record<string, string> = {
  cash: 'Espèces',
  virement: 'Virement',
  cmi: 'CMI',
  wave: 'Wave',
  other: 'Autre',
}

export const BED_STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  occupied: 'Occupé',
  dirty: 'À nettoyer',
  maintenance: 'Maintenance',
  blocked: 'Bloqué',
}

export const MAINTENANCE_PRIORITIES: Record<string, string> = {
  low: 'Faible',
  normal: 'Normal',
  high: 'Élevé',
  urgent: 'Urgent',
}

export const BILLING_PLANS = [
  {
    id: 'starter_monthly',
    name: 'Starter (Mensuel)',
    price: 19, // USD
    currency: 'USD',
    features: ['Jusqu\'à 20 lits', 'Fiches de police PDF', 'Lien WhatsApp', 'Support email'],
    ls_variant_id: '123456', // Placeholder
  },
  {
    id: 'pro_monthly',
    name: 'Pro (Mensuel)',
    price: 49, // USD
    currency: 'USD',
    features: ['Lits illimités', 'Rapports avancés', 'Gestion du staff', 'Support WhatsApp'],
    ls_variant_id: '234567', // Placeholder
  }
]

export const BANK_WIRE_DETAILS = {
  bank_name: 'Attijariwafa Bank',
  account_holder: 'Stayy Sarl (HostelPro)',
  rib: '007 780 0000000000000000 00',
  city: 'Casablanca',
}
