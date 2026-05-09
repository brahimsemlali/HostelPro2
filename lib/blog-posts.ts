export type BlogPost = {
  slug: string
  title: string
  description: string
  category: string
  readTime: number
  publishedAt: string
  keywords: string[]
  content: string
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'fiche-de-police-hostel-maroc',
    title: 'Fiche de police hostel au Maroc : guide complet 2026',
    description: 'Tout ce que vous devez savoir sur la fiche de police pour les hébergements touristiques au Maroc. Format officiel, champs obligatoires, délais, et comment l\'automatiser.',
    category: 'Légal & Conformité',
    readTime: 7,
    publishedAt: '2026-04-15',
    keywords: ['fiche de police hostel maroc', 'fiche de police auberge', 'enregistrement police maroc', 'fiche police hébergement touristique maroc'],
    content: `
## Qu'est-ce que la fiche de police ?

La **fiche de police** (ou fiche d'hébergement) est un document légalement obligatoire pour tout établissement hôtelier et touristique au Maroc. Elle doit être remplie pour chaque client étranger qui séjourne dans votre auberge, hostel, riad, ou tout autre hébergement touristique.

Cette obligation est régie par le **Dahir n°1-03-196** et les circulaires de la Direction Générale de la Sûreté Nationale (DGSN).

## Qui est concerné ?

Tous les hébergements touristiques sont concernés :
- Hôtels classés
- Auberges de jeunesse (hostels)
- Riads en hébergement touristique
- Gîtes et maisons d'hôtes
- Campings

La fiche doit être remplie pour **tout ressortissant étranger**. Les citoyens marocains ne sont pas soumis à cette obligation, mais leurs coordonnées (CIN, téléphone) doivent être enregistrées.

## Les champs obligatoires

Le format standard marocain requiert les informations suivantes :

**Identité du client :**
- Nom et prénom complets
- Date et lieu de naissance
- Nationalité
- Type de document (passeport, carte d'identité, titre de séjour)
- Numéro du document
- Pays de résidence habituelle
- Profession

**Informations de séjour :**
- Date d'arrivée
- Date de départ prévue
- Adresse dans l'établissement

**Informations de déplacement (Maroc) :**
- Adresse dans le pays (where the guest is staying — your hostel)
- Provenance (ville/pays d'où vient le client)
- Prochaine destination après votre établissement

**Signature :**
- Signature du client ou du responsable d'établissement

## Les délais légaux

Techniquement, la fiche de police doit être transmise à la préfecture ou au commissariat de votre quartier **dans les 24 heures suivant l'arrivée du client**. En pratique, la plupart des établissements les transmettent lors de l'audit de nuit ou le lendemain matin.

La non-conformité peut entraîner des sanctions lors des contrôles de police. Les inspections sont plus fréquentes en haute saison et dans les villes touristiques comme Marrakech, Agadir et Fès.

## Comment automatiser les fiches de police

Remplir manuellement une fiche de police pour chaque client étranger prend entre 5 et 15 minutes. Pour un hostel avec 10 check-ins par soir, c'est 1h à 2h30 de paperasse quotidienne.

**Sweet Reservation génère automatiquement la fiche de police en PDF** lors du check-in. Le PDF respecte le format officiel requis par les préfectures marocaines et inclut tous les champs obligatoires.

Le flux de travail devient :
1. Vous saisissez les informations du client lors du check-in (60 secondes)
2. Sweet Reservation génère la fiche de police en PDF instantanément
3. Vous imprimez ou envoyez le PDF à la préfecture

Lors de l'**audit de nuit**, vous pouvez générer un rapport consolidé de toutes les fiches du jour — un seul document pour tous vos clients étrangers.

## Conseils pratiques

**Vérifiez les documents :** Assurez-vous que le numéro de passeport correspond bien au document présenté. Les agents de contrôle vérifient la cohérence des informations.

**Conservez les copies :** Gardez une copie des fiches pendant au moins 3 mois. En cas de contrôle a posteriori, vous devez pouvoir présenter les fiches des séjours passés.

**Langue :** Le formulaire officiel est en arabe et français. Si votre client parle uniquement anglais, le remplissage reste votre responsabilité — pas la sienne.

**Adresse complète :** Pour les établissements en médina (Marrakech, Fès, Chefchaouen), l'adresse peut être complexe. Configurez-la une fois dans vos paramètres et elle s'affiche automatiquement sur toutes les fiches.

## Questions fréquentes

**Que faire si le client n'a pas son passeport ?**
Dans ce cas, demandez toute pièce d'identité disponible. Notez qu'en cas de contrôle, une fiche incomplète est préférable à une fiche absente.

**Les clients marocains ont-ils besoin d'une fiche de police ?**
Non, la fiche de police concerne uniquement les ressortissants étrangers. Pour les Marocains, enregistrez simplement le numéro de CIN.

**Dois-je transmettre les fiches physiquement à la police ?**
La procédure varie selon les villes. Dans certaines préfectures, un portail numérique existe. Dans d'autres, la remise physique reste la norme. Renseignez-vous auprès de votre commissariat local.
    `.trim(),
  },

  {
    slug: 'booking-com-vs-hostelworld-maroc',
    title: 'Booking.com vs Hostelworld pour les hostels marocains : lequel choisir ?',
    description: 'Comparaison complète entre Booking.com et Hostelworld pour les hostels au Maroc. Commissions, visibilité, type de clientèle, et comment maximiser votre revenu net.',
    category: 'Distribution & OTA',
    readTime: 9,
    publishedAt: '2026-03-28',
    keywords: ['booking.com hostelworld maroc', 'commission booking hostel', 'hostelworld maroc', 'ota hostel maroc', 'distribution hostel maroc'],
    content: `
## Le contexte marocain

Les hostels marocains opèrent dans un marché hybride : clientèle internationale via les OTA (Online Travel Agencies) et clientèle locale ou directe. Choisir les bons canaux de distribution est crucial pour maximiser votre taux d'occupation tout en préservant votre marge.

Voici une analyse honnête des deux principales plateformes pour le segment hostel au Maroc.

## Booking.com

### Points forts
**Volume** : Booking.com est la plateforme hôtelière la plus visitée au monde. Votre hostel est exposé à des millions de voyageurs, y compris ceux qui ne cherchent pas spécifiquement un hostel mais comparent toutes les options d'hébergement.

**Clientèle diversifiée** : Couples, voyageurs d'affaires, et backpackers utilisent tous Booking.com. Si vous avez des chambres privées en plus de dortoirs, Booking.com vous aidera à les remplir.

**Tarification dynamique** : L'algorithme de Booking.com favorise les établissements qui utilisent des prix dynamiques. Ajuster vos tarifs selon la demande améliore votre classement.

### Points faibles
**Commission élevée** : Entre 12% et 18% selon votre contrat et votre niveau de visibilité. Une réservation à 200 MAD vous coûte entre 24 et 36 MAD en commission.

**Contrôle limité** : Booking.com peut modifier l'affichage de vos prix, proposer des réductions à vos clients, et favoriser les établissements qui offrent l'annulation gratuite.

**Clientèle moins "hostel"** : Les backpackers purs cherchent souvent Hostelworld en premier. Sur Booking.com, votre hostel est en compétition directe avec des hôtels.

## Hostelworld

### Points forts
**Audience ciblée** : Hostelworld est LA plateforme des backpackers. Les visiteurs cherchent explicitement un hostel — dortoir, ambiance sociale, prix bas. Votre conversion sera meilleure.

**Commission plus faible** : En général entre 10% et 14%, légèrement moins que Booking.com.

**Système d'avis adapté** : Les avis Hostelworld évaluent l'ambiance, la propreté, le staff, et la sécurité — des critères adaptés aux hostels. Un bon score Hostelworld attire exactement le profil de client que vous voulez.

**Notoriété en Europe** : Dans les pays qui fournissent le plus de backpackers au Maroc (France, Espagne, Allemagne, UK), Hostelworld est une référence.

### Points faibles
**Volume inférieur** : Hostelworld génère moins de trafic que Booking.com, notamment pour les destinations moins "backpacker" comme Casablanca.

**Saisonnalité marquée** : Le trafic Hostelworld est très lié aux vacances scolaires européennes. Hors saison, les réservations peuvent chuter.

## Comparaison directe pour le Maroc

| Critère | Booking.com | Hostelworld |
|---------|-------------|-------------|
| Commission moyenne | 15% | 12% |
| Clientèle principale | Tous profils | Backpackers |
| Volume en haute saison | Très élevé | Élevé |
| Volume en basse saison | Moyen | Faible |
| Dortoirs vs chambres privées | Mixte | Dortoirs prioritaires |
| Meilleur pour Marrakech | ✓ | ✓ |
| Meilleur pour Chefchaouen | — | ✓ |
| Meilleur pour Casablanca | ✓ | — |

## La stratégie gagnante : les deux

La majorité des hostels marocains performants utilisent **les deux plateformes simultanément**, avec une gestion fine des tarifs et disponibilités. Voici comment :

**Règle de priorité :** Donnez la priorité aux réservations directes (zéro commission), puis à Hostelworld, puis à Booking.com.

**Tarification différenciée :** Légalement, vous devez respecter la parité tarifaire avec Booking.com. En pratique, proposez des avantages aux clients directs : check-in anticipé gratuit, local tips, WiFi premium.

**Gestion des disponibilités :** Gardez quelques lits en réserve pour les walk-ins et les réservations directes par WhatsApp ou téléphone, surtout en haute saison.

## Calcul du revenu net réel

Quand vous comparez les deux plateformes, regardez toujours le revenu net après commission :

**Exemple — 1 nuit en dortoir à 150 MAD :**
- Direct : 150 MAD (0% commission)
- Hostelworld : 132 MAD (12% commission)
- Booking.com : 127,50 MAD (15% commission)

Sur une année à 70% d'occupation avec 20 lits, la différence entre direct et Booking.com représente **plusieurs dizaines de milliers de MAD**.

Sweet Reservation calcule automatiquement le revenu net par canal dans ses rapports — vous voyez exactement ce que chaque plateforme vous rapporte réellement.

## Conseil final

Soyez présent sur les deux plateformes, mais **investissez dans votre réputation** : avis Google, présence Facebook, WhatsApp direct pour les guests. Chaque avis positif est un commercial qui travaille pour vous 24h/24 sans commission.
    `.trim(),
  },

  {
    slug: 'ouvrir-hostel-maroc-guide',
    title: 'Ouvrir un hostel au Maroc en 2026 : le guide complet',
    description: 'Guide étape par étape pour ouvrir un hostel ou une auberge de jeunesse au Maroc. Démarches administratives, classification, équipements, et rentabilité.',
    category: 'Guide & Conseils',
    readTime: 12,
    publishedAt: '2026-02-10',
    keywords: ['ouvrir hostel maroc', 'créer auberge jeunesse maroc', 'démarches hostel maroc', 'classification hébergement touristique maroc', 'rentabilité hostel maroc'],
    content: `
## Pourquoi ouvrir un hostel au Maroc en 2026 ?

Le tourisme marocain a dépassé les 17 millions d'arrivées en 2024 et continue sa croissance. Le segment backpacker et le tourisme de budget se développent, notamment dans les villes impériales (Fès, Marrakech), les destinations côtières (Agadir, Essaouira) et les perles du Rif (Chefchaouen, Tétouan).

Les hostels restent sous-représentés au Maroc par rapport aux pays européens ou asiatiques. C'est une opportunité réelle — à condition de bien préparer son projet.

## Les démarches administratives

### 1. Statut juridique

La première étape est de choisir votre structure juridique. Pour un hostel individuel ou familial, les options les plus courantes sont :

**Auto-entrepreneur** : Simple à créer, fiscalité avantageuse, mais limité en chiffre d'affaires (500 000 MAD/an pour les services). Convient pour une petite auberge en démarrage.

**SARL (Société à Responsabilité Limitée)** : Recommandé pour les structures plus importantes. Capital minimum : 1 000 MAD. Permet de s'associer et de lever des fonds.

**SARL AU (Associé Unique)** : La SARL avec un seul associé. Bon équilibre entre protection juridique et simplicité.

### 2. Classement et autorisation touristique

Au Maroc, les établissements touristiques sont régis par la **loi n°61-00** portant statut des établissements touristiques. Votre hostel doit être classé pour opérer légalement.

Les catégories qui s'appliquent aux hostels :
- **Auberges de jeunesse** : Classement spécifique, souvent lié à la Fédération Royale Marocaine des Auberges de Jeunesse
- **Maisons d'hôtes** : Pour les structures intégrées dans des maisons traditionnelles (riads)
- **Résidences touristiques** : Pour les établissements avec plus d'autonomie

La demande se fait auprès du **Ministère du Tourisme** via les délégations régionales. Prévoyez 3 à 6 mois pour l'obtention du classement.

### 3. Registre du commerce et patente

Obligatoires pour toute activité commerciale. Inscription au Registre du Commerce auprès du Tribunal de Commerce de votre ville. La patente est une taxe professionnelle annuelle calculée sur la valeur locative de votre établissement.

### 4. Conformité aux normes

Avant l'ouverture, votre établissement sera inspecté sur :
- **Sécurité incendie** : Extincteurs, issues de secours, détecteurs de fumée
- **Sanitaires** : Nombre de WC et douches par rapport au nombre de lits (normes spécifiques par classement)
- **Accessibilité** : Selon la taille de l'établissement
- **Alimentation en eau** : Eau chaude en permanence

## L'équipement essentiel

### Literie et mobilier
- Lits superposés (lits gigognes) avec matelas confortables — budget : 1 500 à 3 000 MAD par lit selon qualité
- Rangements individuels (casiers) avec cadenas — 300 à 600 MAD par casier
- Prises électriques individuelles par lit (USB + standard)
- Lumières de lecture individuelles

### Communs
- Cuisine équipée pour les guests
- Salon/espace social
- Salle de bain pour 8 à 10 personnes maximum (norme recommandée)
- Terrasse ou espace extérieur si possible

### Technologie
- WiFi rapide (100 Mbps minimum, plusieurs points d'accès)
- Logiciel de gestion (PMS) — obligatoire pour les fiches de police et la gestion quotidienne
- Système de paiement (lecteur CMI pour les cartes)
- Caméras de sécurité dans les zones communes

## Le plan financier type

### Investissement initial (20 lits)

| Poste | Budget estimé |
|-------|--------------|
| Aménagement et décoration | 80 000 – 150 000 MAD |
| Literie (20 lits) | 60 000 – 100 000 MAD |
| Cuisine équipée | 20 000 – 40 000 MAD |
| Sanitaires | 30 000 – 60 000 MAD |
| WiFi + technologie | 10 000 – 20 000 MAD |
| Logiciel PMS | 0 (essai gratuit) puis ~250 MAD/mois |
| Formalités et classement | 5 000 – 15 000 MAD |
| Fonds de roulement (3 mois) | 30 000 – 50 000 MAD |
| **Total** | **235 000 – 435 000 MAD** |

### Revenus estimés (20 lits, ville moyenne)

En haute saison (6 mois à 70% d'occupation) :
- 20 lits × 70% × 180 jours × 100 MAD/nuit = **252 000 MAD**

En basse saison (6 mois à 30% d'occupation) :
- 20 lits × 30% × 180 jours × 100 MAD/nuit = **108 000 MAD**

**Revenu brut annuel : ~360 000 MAD**

Après charges (loyer, staff, énergie, OTA, consommables) : rentabilité nette de **15% à 25%** selon votre localisation et gestion.

## Les clés du succès

**Emplacement** : Centre médina ou à 5 minutes à pied des sites principaux. Un hostel bien situé peut pratiquer des tarifs 20 à 40% supérieurs.

**Ambiance** : Les meilleurs hostels créent une communauté. Organisation d'activités, partenariats avec des guides locaux, conseil personnalisé. Le bouche-à-oreille et les avis positifs sont votre meilleur marketing.

**Staff** : Un staff souriant, multilingue (français, anglais, espagnol), et passionné fait toute la différence. Investissez dans la formation.

**Gestion rigoureuse** : Fiches de police à jour, caisse en ordre, OTA optimisées. Les inspections sont réelles. Un logiciel de gestion adapté comme Sweet Reservation vous évite les problèmes légaux et les pertes financières.

## Les erreurs à éviter

- Sous-estimer les coûts de rénovation (les bâtiments en médina cachent souvent des surprises)
- Négliger les fiches de police (un contrôle raté peut mener à une fermeture administrative)
- Dépendre d'une seule OTA (diversifiez vos canaux dès le premier mois)
- Ne pas prévoir de fonds de roulement (la première saison peut être difficile)
- Ignorer les avis en ligne (répondez à chaque commentaire, positif ou négatif)
    `.trim(),
  },

  {
    slug: 'excel-vs-logiciel-pms-hostel',
    title: 'Excel vs logiciel PMS hostel : pourquoi il est temps de changer',
    description: 'Comparaison honnête entre la gestion d\'un hostel avec Excel/WhatsApp et un logiciel PMS dédié. Coûts cachés, risques légaux, et gains de temps réels.',
    category: 'Gestion & Productivité',
    readTime: 6,
    publishedAt: '2026-01-22',
    keywords: ['logiciel hostel vs excel', 'pms hostel maroc', 'gestion hostel excel', 'pourquoi logiciel hostel', 'automatisation hostel maroc'],
    content: `
## La réalité de la gestion "Excel + WhatsApp"

La majorité des petits hostels et auberges au Maroc fonctionnent encore avec un système informel : un cahier ou Excel pour les réservations, des messages WhatsApp pour confirmer les guests, et des fiches de police remplies à la main le soir.

Ce système a un avantage : il ne coûte rien. Mais il a des coûts cachés que peu de propriétaires calculent vraiment.

## Le coût réel d'Excel

### Temps perdu par semaine (auberge de 20 lits)

| Tâche | Excel/manuel | Logiciel PMS | Économie |
|-------|-------------|--------------|----------|
| Check-in (10 guests/semaine) | 3h | 30 min | 2h30 |
| Fiches de police | 2h | 0 (auto) | 2h |
| Réconciliation caisse | 1h | 15 min | 45 min |
| Rapports de revenus | 2h | 0 (auto) | 2h |
| Messages WhatsApp | 1h30 | 20 min | 1h10 |
| **Total** | **9h30** | **1h05** | **8h25** |

**8 heures par semaine**, c'est une journée de travail entière passée à des tâches administratives qui pourraient être automatisées. Sur un an, c'est plus de 400 heures — soit 2,5 mois à temps plein.

### Les erreurs que génère Excel

**Double-réservation** : Sans système centralisé temps réel, il est facile d'attribuer le même lit à deux personnes différentes. Un incident qui oblige à reloger un client à vos frais — souvent 200 à 400 MAD pour un hôtel de dépannage.

**Fiches de police incomplètes** : Sous la pression du soir, un champ oublié, un nom mal orthographié. En cas de contrôle, une fiche incomplète peut conduire à une amende ou une mise en demeure.

**Trésorerie floue** : Quand le cash rentre et sort sans être tracé correctement, il est impossible de savoir exactement combien vous avez gagné ce mois-ci. Et impossible d'optimiser.

**Perte d'historique** : Un Excel supprimé accidentellement, un téléphone perdu avec les contacts WhatsApp — votre historique clients disparaît.

## Les risques légaux réels

### Fiches de police

La non-tenue des fiches de police est une infraction à la loi marocaine sur les établissements touristiques. Les contrôles de police sont plus fréquents qu'on ne le croit — notamment en haute saison, lors d'événements nationaux, et dans les villes touristiques.

Un établissement contrôlé sans fiches de police à jour risque :
- Une amende administrative
- Une fermeture temporaire
- Un problème lors du renouvellement de votre autorisation touristique

### Traçabilité financière

En cas de contrôle fiscal, vous devez pouvoir justifier vos revenus. Un cahier de caisse tenu à la main est difficilement opposable à un contrôleur. Un logiciel avec export comptable vous protège.

## Pourquoi "c'est trop compliqué" est un mythe

Le principal frein au changement que j'entends : "les logiciels c'est compliqué, j'ai pas le temps d'apprendre."

Sweet Reservation est configuré en moins de 10 minutes. Voici le flux réel :
1. Vous entrez le nom et les infos de votre hostel (2 min)
2. Vous ajoutez vos chambres et lits (5 min)
3. Vous faites votre premier check-in (60 secondes)

Il n'y a pas de formation requise. L'interface est en français, elle fonctionne sur téléphone, et si vous avez des questions, le support répond via WhatsApp.

## Le vrai calcul du ROI

**Coût du logiciel :** 19$/mois (plan Starter) ≈ 190 MAD/mois

**Ce que vous économisez par mois :**
- 8h/semaine × 4 semaines = 32 heures
- À 50 MAD/heure (coût de votre temps) = 1 600 MAD/mois économisés
- Évitement d'une double-réservation (200 MAD de dédommagement en moyenne) = 200 MAD
- Évitement d'une amende pour fiche incomplète (valeur risque) = difficile à chiffrer

**ROI : +700% dès le premier mois**

## La transition est plus simple que vous ne le pensez

Vous n'avez pas besoin de tout changer le même jour. Commencez avec l'essai gratuit de 14 jours :

**Semaine 1** : Configurez vos chambres et faites 3-4 check-ins. Prenez vos marques.
**Semaine 2** : Commencez à enregistrer vos paiements dans le logiciel.
**Semaine 3** : Générez vos fiches de police depuis le logiciel.
**Semaine 4** : Faites votre premier audit de nuit.

Au bout de 14 jours, vous ne voudrez plus jamais revenir à Excel.
    `.trim(),
  },
]

export function getBlogPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null
}
