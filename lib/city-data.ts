export type CityData = {
  slug: string
  name: string
  nameAr: string
  region: string
  heroTitle: string
  heroSub: string
  metaTitle: string
  metaDescription: string
  keywords: string[]
  intro: string
  challenges: { title: string; body: string }[]
  stats: { value: string; label: string }[]
  testimonial: { quote: string; author: string; property: string }
  faq: { q: string; a: string }[]
  nearbyAreas: string[]
  canonicalPath: string
}

export const CITIES: Record<string, CityData> = {
  marrakech: {
    slug: 'marrakech',
    name: 'Marrakech',
    nameAr: 'مراكش',
    region: 'Tensift-Al Haouz',
    canonicalPath: '/logiciel-hostel-marrakech',
    heroTitle: 'Logiciel de gestion hostel à Marrakech',
    heroSub: 'Gérez votre auberge ou riad en pleine médina. Check-in 60s, fiches de police automatiques, WhatsApp intégré.',
    metaTitle: 'Logiciel Gestion Hostel Marrakech — Sweet Reservation',
    metaDescription: 'Logiciel PMS pour hostels et auberges à Marrakech. Gérez vos réservations, check-ins, fiches de police et paiements depuis votre téléphone. Essai gratuit 14 jours.',
    keywords: [
      'logiciel hostel marrakech',
      'gestion auberge marrakech',
      'logiciel pms marrakech',
      'gestion réservation riad marrakech',
      'check-in hostel marrakech',
      'fiche de police hostel marrakech',
      'logiciel hôtellerie marrakech',
    ],
    intro: 'Marrakech accueille plus de 4 millions de visiteurs par an. Avec des centaines de riad-hostels et d\'auberges dans la médina, la gestion manuelle — fiches papier, WhatsApp, Excel — devient vite un frein. Sweet Reservation a été conçu pour la réalité des hébergements marocains : fiches de police en un clic, encaissement en MAD, messages WhatsApp dans 3 langues.',
    challenges: [
      {
        title: 'Fiches de police pour touristes étrangers',
        body: 'Marrakech reçoit des visiteurs de 80+ nationalités. Sweet Reservation génère automatiquement la fiche de police conforme dès le check-in, sans ressaisie.',
      },
      {
        title: 'Réservations multi-canaux',
        body: 'Booking.com, Hostelworld, walk-in direct... Sweet Reservation centralise toutes les sources et calcule le revenu net après commissions.',
      },
      {
        title: 'Communication multilingue',
        body: 'Vos clients parlent français, anglais, espagnol, allemand. Nos templates WhatsApp couvrent les 3 langues principales pour que chaque guest reçoive l\'info dans sa langue.',
      },
      {
        title: 'Gestion de la haute saison',
        body: 'Pendant les pics (printemps, automne, Ramadan), chaque lit compte. Le plan des lits en temps réel vous évite les doubles-réservations et les oublis.',
      },
    ],
    stats: [
      { value: '60s', label: 'Temps de check-in moyen' },
      { value: '80+', label: 'Nationalités gérées' },
      { value: '0 MAD', label: 'Frais de mise en place' },
      { value: '14j', label: 'Essai gratuit' },
    ],
    testimonial: {
      quote: 'Avant Sweet Reservation, je passais 30 minutes par check-in entre le cahier, les fiches de police et WhatsApp. Maintenant c\'est 60 secondes. Je me consacre enfin à mes guests.',
      author: 'Rachid B.',
      property: 'Hostel Jemaa · Marrakech Médina',
    },
    faq: [
      {
        q: 'Sweet Reservation fonctionne-t-il pour les riads reconvertis en hostel ?',
        a: 'Oui. La configuration des chambres et lits est totalement flexible. Que vous ayez 3 suites ou 40 lits en dortoir, le plan des lits s\'adapte à votre configuration exacte.',
      },
      {
        q: 'La fiche de police est-elle conforme à la préfecture de Marrakech ?',
        a: 'Oui. Le PDF généré suit le format standard marocain requis par toutes les préfectures. Il inclut tous les champs obligatoires : nom, passeport, nationalité, adresse au Maroc, destination suivante.',
      },
      {
        q: 'Puis-je gérer plusieurs propriétés à Marrakech ?',
        a: 'Le plan Pro supporte la gestion multi-établissements. Idéal si vous gérez plusieurs riad-hostels dans la médina.',
      },
    ],
    nearbyAreas: ['Médina de Marrakech', 'Guéliz', 'Hivernage', 'Palmeraie', 'Targa'],
  },

  agadir: {
    slug: 'agadir',
    name: 'Agadir',
    nameAr: 'أكادير',
    region: 'Souss-Massa',
    canonicalPath: '/logiciel-hostel-agadir',
    heroTitle: 'Logiciel de gestion hostel à Agadir',
    heroSub: 'La solution PMS pensée pour les auberges et hostels du Souss. Gestion simplifiée, paiements en MAD, fiches de police automatiques.',
    metaTitle: 'Logiciel Gestion Hostel Agadir — Sweet Reservation',
    metaDescription: 'Logiciel PMS pour hostels et auberges à Agadir. Check-in digital, fiches de police PDF, gestion des paiements en MAD. Conçu pour la réalité marocaine. Essai gratuit.',
    keywords: [
      'logiciel hostel agadir',
      'gestion auberge agadir',
      'logiciel gestion hébergement agadir',
      'pms hostel agadir',
      'check-in hostel agadir',
      'fiche de police auberge agadir',
      'logiciel hôtellerie agadir souss',
    ],
    intro: 'Agadir est la capitale touristique du Souss avec une clientèle mixte : Marocains en villégiature, Européens en hivernage, et backpackers de passage vers le Sahara. Sweet Reservation est né à Agadir — nous connaissons votre marché, vos contraintes légales, et le rythme de votre saison.',
    challenges: [
      {
        title: 'Clientèle mixte marocaine et internationale',
        body: 'CIN pour les clients marocains, passeport pour les étrangers. Sweet Reservation gère les deux types de documents et génère la fiche de police uniquement pour les ressortissants étrangers.',
      },
      {
        title: 'Haute saison estivale et hivernage européen',
        body: 'Deux pics distincts à Agadir : été pour les Marocains, hiver pour les Européens. Consultez vos taux d\'occupation par période pour mieux anticiper.',
      },
      {
        title: 'Paiements en espèces dominants',
        body: 'La grande majorité des clients paient en cash. Sweet Reservation enregistre chaque paiement, calcule le rendu-monnaie, et facilite l\'audit de caisse du soir.',
      },
      {
        title: 'Staff saisonnier',
        body: 'Intégrez un réceptionniste de saison en 2 minutes avec le système d\'invitation par lien. Chaque membre du staff voit uniquement ce qui le concerne.',
      },
    ],
    stats: [
      { value: '2×', label: 'Saisons touristiques par an' },
      { value: '100%', label: 'Conforme préfecture Agadir' },
      { value: 'MAD', label: 'Devise native' },
      { value: '14j', label: 'Essai gratuit' },
    ],
    testimonial: {
      quote: 'On est basé à Agadir depuis 2019. Sweet Reservation comprend vraiment nos besoins — la fiche de police, les paiements en cash, le WhatsApp. C\'est fait pour nous.',
      author: 'Nadia M.',
      property: 'Auberge Souss · Agadir Nouveau',
    },
    faq: [
      {
        q: 'Sweet Reservation est-il adapté aux petites auberges de 10 à 20 lits à Agadir ?',
        a: 'Absolument. Le plan Starter à 19$/mois est conçu pour les établissements jusqu\'à 20 lits. Toutes les fonctionnalités essentielles sont incluses : fiches de police, WhatsApp, paiements, rapports.',
      },
      {
        q: 'Puis-je payer en MAD via virement ?',
        a: 'Oui. Pour les propriétaires marocains, nous proposons un paiement par virement bancaire en MAD vers Attijariwafa Bank, sans frais de change.',
      },
      {
        q: 'Le logiciel fonctionne-t-il sans connexion internet rapide ?',
        a: 'Sweet Reservation est une application web progressive (PWA). Les actions récentes restent disponibles même en cas de coupure courte. La connexion 4G est suffisante pour l\'utilisation quotidienne.',
      },
    ],
    nearbyAreas: ['Agadir Nouveau', 'Hay Mohammadi', 'Tikiouine', 'Inezgane', 'Aït Melloul', 'Taghazout'],
  },

  casablanca: {
    slug: 'casablanca',
    name: 'Casablanca',
    nameAr: 'الدار البيضاء',
    region: 'Grand Casablanca',
    canonicalPath: '/logiciel-hostel-casablanca',
    heroTitle: 'Logiciel de gestion hostel à Casablanca',
    heroSub: 'Gérez votre hostel ou auberge dans la capitale économique du Maroc. Réservations, check-ins express et rapports en temps réel.',
    metaTitle: 'Logiciel Gestion Hostel Casablanca — Sweet Reservation',
    metaDescription: 'Logiciel PMS pour hostels et auberges à Casablanca. Check-in rapide, gestion des réservations multi-canaux, fiches de police PDF, paiements MAD. Essai gratuit 14 jours.',
    keywords: [
      'logiciel hostel casablanca',
      'gestion auberge casablanca',
      'logiciel gestion hébergement casablanca',
      'pms hostel casa',
      'check-in hostel casablanca',
      'fiche de police casablanca',
      'logiciel hôtellerie casablanca',
    ],
    intro: 'Casablanca est le hub d\'affaires et de transit du Maroc. Les hostels de Casa accueillent une clientèle variée : voyageurs en transit, jeunes professionnels, backpackers en route vers le sud. Des séjours courts, des rotations rapides, et une exigence de réactivité. Sweet Reservation est fait pour ça.',
    challenges: [
      {
        title: 'Rotations rapides et courts séjours',
        body: 'À Casablanca, beaucoup de clients restent 1 à 2 nuits. Le check-in express en 60 secondes de Sweet Reservation garde la réception fluide même en heure de pointe.',
      },
      {
        title: 'Réservations de dernière minute',
        body: 'Les voyageurs d\'affaires réservent souvent le soir pour le lendemain. Avec le plan des lits en temps réel, vous voyez instantanément ce qui est disponible.',
      },
      {
        title: 'Transit aéroport Mohammed V',
        body: 'Beaucoup de clients arrivent de l\'aéroport. Paramétrez vos tarifs peak et vos messages WhatsApp d\'accueil avec les infos de transport utiles.',
      },
      {
        title: 'Compliance légale en zone urbaine',
        body: 'La préfecture de Casablanca est stricte sur les fiches de police. Notre PDF généré automatiquement respecte le format officiel requis.',
      },
    ],
    stats: [
      { value: '1.5h', label: 'De Casa à Marrakech en train' },
      { value: '<60s', label: 'Check-in avec Sweet Reservation' },
      { value: '24/7', label: 'Accès depuis mobile' },
      { value: '14j', label: 'Essai gratuit' },
    ],
    testimonial: {
      quote: 'Nos clients de Casa sont pressés — transit, réunion, aéroport. Avec Sweet Reservation, le check-in est fini avant qu\'ils posent leur sac. Parfait pour notre rythme.',
      author: 'Hamza K.',
      property: 'Casa Backpackers · Maarif',
    },
    faq: [
      {
        q: 'Sweet Reservation gère-t-il les réservations Booking.com à Casablanca ?',
        a: 'Oui. Vous pouvez enregistrer les réservations venant de Booking.com, Hostelworld ou d\'autres OTA avec leur référence externe et calculer automatiquement le revenu net après commission.',
      },
      {
        q: 'Comment le logiciel gère-t-il les guests en transit de l\'aéroport ?',
        a: 'Le formulaire de check-in inclut un champ "prochaine destination" utilisé dans la fiche de police. Vous pouvez aussi paramétrer un message WhatsApp de bienvenue avec les infos de transport locales.',
      },
    ],
    nearbyAreas: ['Maarif', 'Bourgogne', 'Gauthier', 'Ain Diab', 'Hay Hassani', 'Sidi Bernoussi'],
  },

  fes: {
    slug: 'fes',
    name: 'Fès',
    nameAr: 'فاس',
    region: 'Fès-Meknès',
    canonicalPath: '/logiciel-hostel-fes',
    heroTitle: 'Logiciel de gestion hostel à Fès',
    heroSub: 'Gérez votre auberge dans la médina de Fès. Check-in digital, fiches de police pour visiteurs étrangers, WhatsApp multilingue.',
    metaTitle: 'Logiciel Gestion Hostel Fès — Sweet Reservation',
    metaDescription: 'Logiciel PMS pour hostels et auberges à Fès. Idéal pour la médina de Fès el-Bali. Fiches de police automatiques, gestion des dortoirs, paiements en MAD. Essai gratuit.',
    keywords: [
      'logiciel hostel fes',
      'gestion auberge fes',
      'logiciel pms fes',
      'gestion hostel medina fes',
      'fiche de police hostel fes',
      'logiciel auberge fes el bali',
      'gestion réservation fes meknès',
    ],
    intro: 'Fès el-Bali, inscrite au patrimoine mondial de l\'UNESCO, attire des milliers de backpackers et voyageurs culturels chaque année. Les auberges de la médina fonctionnent dans des bâtisses centenaires avec des connexions parfois instables — Sweet Reservation est optimisé pour fonctionner même sur 3G et s\'adapte à toutes les tailles d\'établissement.',
    challenges: [
      {
        title: 'Adresses complexes en médina',
        body: 'Les adresses dans la médina de Fès sont difficiles à transmettre aux guests. Configurez votre adresse complète et envoyez automatiquement un message WhatsApp avec le lien Google Maps à chaque check-in.',
      },
      {
        title: 'Tourisme culturel et étudiants',
        body: 'Fès attire des profils variés : groupes scolaires, chercheurs, backpackers européens. Le système de dortoirs séparés (mixte, femmes, hommes) s\'adapte à votre politique.',
      },
      {
        title: 'Saisonnalité marquée',
        body: 'Pics au printemps et en automne, creux estival. Les rapports d\'occupation par période vous aident à ajuster vos tarifs et vos effectifs.',
      },
      {
        title: 'Fiches de police pour ressortissants étrangers',
        body: 'La médina de Fès reçoit des touristes de dizaines de pays. Sweet Reservation génère les fiches de police conformes pour chaque étranger en un clic.',
      },
    ],
    stats: [
      { value: '156', label: 'Pays représentés à Fès' },
      { value: 'UNESCO', label: 'Patrimoine mondial' },
      { value: '3G+', label: 'Connexion suffisante' },
      { value: '14j', label: 'Essai gratuit' },
    ],
    testimonial: {
      quote: 'On a des clients de 30 nationalités différentes chaque semaine. Les fiches de police prenaient une heure chaque soir. Maintenant c\'est fait automatiquement pendant le check-in.',
      author: 'Imane R.',
      property: 'Riad Youth Hostel · Fès el-Bali',
    },
    faq: [
      {
        q: 'Sweet Reservation fonctionne-t-il dans la médina de Fès avec une connexion lente ?',
        a: 'Oui. L\'application est optimisée pour les connexions 3G/4G. Les fiches de police sont générées en local (côté client) sans nécessiter une connexion rapide.',
      },
      {
        q: 'Peut-on gérer des dortoirs séparés femmes/hommes ?',
        a: 'Oui. Chaque salle de dortoir peut avoir une politique de genre : mixte, femmes uniquement, hommes uniquement. Le système attribue les lits en respectant ces règles.',
      },
    ],
    nearbyAreas: ['Fès el-Bali', 'Fès el-Jdid', 'Ville Nouvelle', 'Meknès', 'Ifrane'],
  },

  tanger: {
    slug: 'tanger',
    name: 'Tanger',
    nameAr: 'طنجة',
    region: 'Tanger-Tétouan-Al Hoceïma',
    canonicalPath: '/logiciel-hostel-tanger',
    heroTitle: 'Logiciel de gestion hostel à Tanger',
    heroSub: 'La porte entre l\'Europe et le Maroc. Gérez vos walk-ins de ferry, check-ins express et fiches de police automatiques.',
    metaTitle: 'Logiciel Gestion Hostel Tanger — Sweet Reservation',
    metaDescription: 'Logiciel PMS pour hostels et auberges à Tanger. Parfait pour les arrivées de ferry, walk-ins et clients en transit. Check-in 60s, fiches de police PDF. Essai gratuit.',
    keywords: [
      'logiciel hostel tanger',
      'gestion auberge tanger',
      'logiciel pms tanger',
      'hostel port tanger',
      'fiche de police hostel tanger',
      'gestion hébergement tanger',
      'logiciel auberge tanger tetouan',
    ],
    intro: 'Tanger Med traite plus de 3 millions de passagers par an. Les hostels de Tanger sont en première ligne : walk-ins depuis le ferry, backpackers européens qui débarquent sans réservation, voyageurs en transit. Sweet Reservation est optimisé pour les check-ins rapides et les situations de last-minute.',
    challenges: [
      {
        title: 'Walk-ins massifs depuis le port et le ferry',
        body: 'Quand un ferry arrive, 10 voyageurs peuvent se présenter en même temps. Le check-in express de Sweet Reservation traite un guest toutes les 60 secondes.',
      },
      {
        title: 'Clients européens sans réservation préalable',
        body: 'Beaucoup de backpackers arrivent sans avoir réservé. Le module de check-in direct gère les walk-ins comme les réservations, avec création du profil guest en temps réel.',
      },
      {
        title: 'Rotation élevée — courts séjours',
        body: 'Tanger est souvent une étape d\'une nuit. Le plan des lits en temps réel et les check-outs rapides libèrent les lits pour les prochains arrivants.',
      },
      {
        title: 'Fiches de police pour ressortissants EU',
        body: 'La majorité des walk-ins venant d\'Espagne et d\'Europe. Sweet Reservation génère instantanément les fiches de police conformes dès la saisie du passeport.',
      },
    ],
    stats: [
      { value: '3M+', label: 'Passagers/an via Tanger Med' },
      { value: '14km', label: 'De l\'Espagne' },
      { value: '60s', label: 'Check-in walk-in' },
      { value: '14j', label: 'Essai gratuit' },
    ],
    testimonial: {
      quote: 'Les vendredis soir quand le ferry arrive, on peut avoir 15 personnes qui se présentent d\'un coup. Avant c\'était le chaos. Maintenant on gère ça sans stress.',
      author: 'Karim A.',
      property: 'Hostel Détroit · Tanger Ville',
    },
    faq: [
      {
        q: 'Sweet Reservation gère-t-il bien les walk-ins de dernière minute ?',
        a: 'Oui, c\'est un des cas d\'usage principaux. Le check-in sans réservation préalable crée directement le profil du guest, enregistre le lit, et génère la fiche de police — tout en moins de 60 secondes.',
      },
      {
        q: 'Peut-on voir en un coup d\'oeil combien de lits sont disponibles ce soir ?',
        a: 'Oui. Le tableau de bord affiche l\'occupation en temps réel. Le plan des lits montre chaque lit avec sa couleur de statut. Parfait pour répondre instantanément à un walk-in.',
      },
    ],
    nearbyAreas: ['Tanger Ville', 'Tanger Med (port)', 'Tétouan', 'Chefchaouen', 'Fnideq', 'Ksar es-Seghir'],
  },

  chefchaouen: {
    slug: 'chefchaouen',
    name: 'Chefchaouen',
    nameAr: 'شفشاون',
    region: 'Tanger-Tétouan-Al Hoceïma',
    canonicalPath: '/logiciel-hostel-chefchaouen',
    heroTitle: 'Logiciel de gestion hostel à Chefchaouen',
    heroSub: 'La ville bleue du Rif. Gérez votre auberge familiale avec simplicité — sans Excel, sans papier, sans stress.',
    metaTitle: 'Logiciel Gestion Hostel Chefchaouen — Sweet Reservation',
    metaDescription: 'Logiciel PMS simple pour les auberges et hostels de Chefchaouen. Fiche de police automatique, paiements en MAD, WhatsApp intégré. Conçu pour les petites structures. Essai gratuit.',
    keywords: [
      'logiciel hostel chefchaouen',
      'gestion auberge chefchaouen',
      'logiciel auberge ville bleue',
      'pms hostel chefchaouen',
      'fiche de police chefchaouen',
      'gestion hébergement rif maroc',
      'logiciel auberge chaouen',
    ],
    intro: 'Chefchaouen est devenue l\'une des destinations les plus photographiées du monde. Les petites auberges familiales qui font le charme de la ville bleue n\'ont pas besoin d\'un logiciel complexe — elles ont besoin d\'un outil simple, rapide, et qui respecte leur façon de travailler. C\'est exactement ce qu\'est Sweet Reservation.',
    challenges: [
      {
        title: 'Petites structures familiales',
        body: 'La plupart des auberges de Chefchaouen ont moins de 20 lits et sont gérées en famille. Le plan Starter à 19$/mois est fait pour vous — toutes les fonctionnalités sans la complexité.',
      },
      {
        title: 'Forte saisonnalité',
        body: 'Printemps et automne sont les pics. En été il fait trop chaud, en hiver c\'est calme. Les rapports d\'occupation vous aident à planifier vos disponibilités et vos prix selon la saison.',
      },
      {
        title: 'Clients Instagram et longs séjours',
        body: 'Chefchaouen attire des voyageurs qui s\'y attardent. Le suivi des séjours longs, les rappels de checkout, et le WhatsApp de demande d\'avis fidélisent vos guests.',
      },
      {
        title: 'Conformité légale dans une petite ville',
        body: 'Même dans une petite auberge familiale, les fiches de police pour étrangers sont obligatoires. Sweet Reservation les génère automatiquement à chaque check-in.',
      },
    ],
    stats: [
      { value: '20', label: 'Lits max sur le plan Starter' },
      { value: '100%', label: 'Conforme format marocain' },
      { value: 'Simple', label: 'Pas de formation requise' },
      { value: '14j', label: 'Essai gratuit' },
    ],
    testimonial: {
      quote: 'J\'ai une petite auberge de 12 lits à Chaouen. Sweet Reservation m\'a pris 10 minutes à configurer. Maintenant mes fiches de police sont prêtes en un clic, et mes clients reçoivent le WiFi par WhatsApp automatiquement.',
      author: 'Fatima-Zahra O.',
      property: 'Dar Bleu · Médina de Chefchaouen',
    },
    faq: [
      {
        q: 'Sweet Reservation est-il trop complexe pour une petite auberge de Chefchaouen ?',
        a: 'Non. Le plan Starter est conçu pour les petites structures. La configuration prend moins de 10 minutes, et toutes les fonctions clés (check-in, fiche de police, WhatsApp) fonctionnent immédiatement sans formation.',
      },
      {
        q: 'Comment ça fonctionne pour les paiements en espèces ?',
        a: 'La majorité des petites auberges travaillent en cash. Sweet Reservation enregistre chaque paiement, calcule la monnaie à rendre, et vous affiche le total de caisse du jour en un clic.',
      },
      {
        q: 'Y a-t-il un engagement minimum ?',
        a: 'Non. L\'abonnement est mensuel, sans engagement. Vous pouvez commencer avec l\'essai gratuit de 14 jours et annuler à tout moment.',
      },
    ],
    nearbyAreas: ['Médina de Chefchaouen', 'Ain Tissimane', 'Ras el-Maa', 'Tanger', 'Tétouan', 'Ouazzane'],
  },
}

export function getCityData(slug: string): CityData | null {
  return CITIES[slug] ?? null
}

export const ALL_CITY_SLUGS = Object.keys(CITIES)
