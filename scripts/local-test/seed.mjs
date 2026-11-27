// Seeds the LOCAL test Supabase (127.0.0.1:55421) only — run via setup.sh.
// Owner + manager + receptionist + housekeeping accounts (password Test1234!),
// 3 rooms / 9 beds, 8 guests (incl. a Cyrillic name and an incomplete fiche),
// past / current / future bookings, payments (incl. a refund and a pending
// one), extras and expenses. Dates for current stays are relative to today.
import { createRequire } from 'module'
const require = createRequire(new URL('../../package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')

const API_URL = 'http://127.0.0.1:55421'
if (!API_URL.includes('127.0.0.1')) throw new Error('local only')
const ANON = process.env.ANON, SERVICE = process.env.SERVICE
const admin = createClient(API_URL, SERVICE, { auth: { persistSession: false } })
const PW = 'Test1234!'
const die = (m, e) => { if (e) { console.error(m, e); process.exit(1) } }

async function user(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true })
  if (error && !/already/.test(error.message)) die('createUser ' + email, error)
  if (data?.user) return data.user.id
  const { data: list } = await admin.auth.admin.listUsers()
  return list.users.find((u) => u.email === email).id
}

const ownerId = await user('owner@test.local')
const ownerClient = createClient(API_URL, ANON, { auth: { persistSession: false } })
die('signin', (await ownerClient.auth.signInWithPassword({ email: 'owner@test.local', password: PW })).error)

let { data: prop } = await admin.from('properties').select('id').eq('owner_id', ownerId).maybeSingle()
let P = prop?.id
if (!P) {
  const bed = (n, price = 120) => ({ name: n, base_price: price })
  const { data, error } = await ownerClient.rpc('create_property_with_setup', {
    p_name: 'Auberge Atlas', p_city: 'Agadir', p_phone: '+212612345678', p_wifi: 'atlas2026', p_lang: 'fr', p_owner_name: 'Gérant Test',
    p_trial_end: new Date().toISOString(),
    p_rooms: [
      { name: 'Dortoir A', type: 'dorm', beds: ['A1', 'A2', 'A3', 'A4'].map((n) => bed(n)) },
      { name: 'Dortoir B', type: 'dorm', beds: ['B1', 'B2', 'B3', 'B4'].map((n) => bed(n, 110)) },
      { name: 'Chambre Privée 1', type: 'private', beds: [bed('CP1', 300)] },
    ],
  })
  die('create_property', error)
  P = data
}
await admin.from('properties').update({ address: '12 Rue de la Plage', email: 'contact@atlas.test', police_prefecture: 'Agadir Ida-Outanane' }).eq('id', P)
await admin.from('subscriptions').update({ status: 'active', provider: 'manual_wire', current_period_end: '2027-12-31T00:00:00Z' }).eq('property_id', P)

for (const [email, role, name] of [['manager@test.local', 'manager', 'Karim'], ['recep@test.local', 'receptionist', 'Salma'], ['menage@test.local', 'housekeeping', 'Aicha']]) {
  const id = await user(email)
  const { data: s } = await admin.from('staff').select('id').eq('user_id', id).maybeSingle()
  if (!s) die('staff ' + email, (await admin.from('staff').insert({ property_id: P, user_id: id, name, role, is_active: true })).error)
}

const { count } = await admin.from('bookings').select('id', { count: 'exact', head: true }).eq('property_id', P)
if (count > 0) { console.log('already seeded', P); process.exit(0) }

const { data: beds } = await admin.from('beds').select('id, name, base_price').eq('property_id', P).order('name')
const B = Object.fromEntries(beds.map((b) => [b.name, b]))
const guests = [
  ['Hans', 'Müller', 'Allemande', 'Allemagne', 'passport', 'C01X5566', '1990-04-12', 'M', 'Ingénieur'],
  ['Marie', 'Dupont', 'Française', 'France', 'passport', '19FR12345', '1995-07-01', 'F', 'Professeure'],
  ['Youssef', 'Alaoui', 'Marocaine', 'Maroc', 'cin', 'BE123456', '1988-02-20', 'M', 'Commerçant'],
  ['Lucía', 'García', 'Espagnole', 'Espagne', 'passport', 'PAA112233', '1999-11-05', 'F', 'Étudiante'],
  ['Tom', 'Smith', 'Britannique', 'Royaume-Uni', 'passport', '533123456', '1985-03-30', 'M', 'Développeur'],
  ['Fatima', 'Benali', 'Française', 'Maroc', 'passport', '20FR99887', '1992-09-14', 'F', 'Infirmière'],
  ['Иван', 'Петров', 'Russe', 'Russie', 'passport', '751234567', '1980-01-01', 'M', 'Photographe'],
  ['Ana', 'Silva', null, null, 'passport', null, null, 'F', null],
]
const G = []
for (const [first_name, last_name, nationality, country_of_residence, document_type, document_number, date_of_birth, gender, profession] of guests) {
  const { data, error } = await admin.from('guests').insert({ property_id: P, first_name, last_name, nationality, country_of_residence, document_type, document_number, date_of_birth, gender, profession, phone: '+33612345678', whatsapp: '+33612345678', next_destination: 'Marrakech', address_in_morocco: 'Auberge Atlas, Agadir' }).select('id').single()
  die('guest', error); G.push(data.id)
}
const today = new Date().toISOString().slice(0, 10)
const add = (d) => { const x = new Date(today + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10) }
// [guestIdx, bed, checkIn, checkOut, status, adults, source]
const bookings = [
  [0, 'A1', '2026-10-28', '2026-11-02', 'checked_out', 1, 'booking_com'],   // spans Oct/Nov
  [1, 'A2', '2026-10-10', '2026-10-14', 'checked_out', 1, 'direct'],
  [2, 'CP1', '2026-10-20', '2026-10-23', 'checked_out', 2, 'phone'],
  [3, 'A3', '2026-11-05', '2026-11-09', 'checked_out', 1, 'hostelworld'],
  [4, 'B1', add(-3), add(2), 'checked_in', 1, 'walkin'],                     // current, has balance
  [5, 'B2', add(-1), add(1), 'checked_in', 1, 'direct'],                     // current, departing tomorrow
  [6, 'B3', '2026-11-12', '2026-11-15', 'checked_out', 1, 'booking_com'],
  [7, 'A4', add(-2), add(0), 'checked_in', 1, 'walkin'],                     // departs today, unpaid, incomplete fiche
  [1, 'A2', add(3), add(6), 'confirmed', 1, 'direct'],                       // future
]
const Bk = []
for (const [gi, bed, ci, co, status, adults, source] of bookings) {
  const nights = (new Date(co) - new Date(ci)) / 864e5
  const { data, error } = await admin.from('bookings').insert({ property_id: P, guest_id: G[gi], bed_id: B[bed].id, check_in_date: ci, check_out_date: co, status, adults, source, total_price: nights * B[bed].base_price, commission_rate: source === 'booking_com' ? 15 : 0 }).select('id, total_price').single()
  die('booking ' + bed, error); Bk.push(data)
  if (status === 'checked_in') await admin.from('beds').update({ status: 'occupied' }).eq('id', B[bed].id)
}
const pay = (bi, amount, method, date, type = 'payment', status = 'completed') =>
  ({ property_id: P, booking_id: Bk[bi].id, guest_id: G[bookings[bi][0]], amount, method, type, status, payment_date: date + 'T10:00:00Z', reference: method === 'virement' ? 'VIR-' + bi : null })
die('payments', (await admin.from('payments').insert([
  pay(0, Bk[0].total_price, 'cash', '2026-10-28'),
  pay(1, Bk[1].total_price, 'virement', '2026-10-10'),
  pay(2, Bk[2].total_price, 'cmi', '2026-10-20'),
  pay(3, Bk[3].total_price + 20, 'cash', '2026-11-05'), pay(3, 20, 'cash', '2026-11-09', 'refund'),
  pay(4, 100, 'cash', add(-3)),
  pay(5, Bk[5].total_price, 'cash', add(-1)),
  pay(6, Bk[6].total_price, 'cmi', '2026-11-12'),
  pay(4, 999, 'cash', add(-2), 'payment', 'pending'),
])).error)
die('extras', (await admin.from('booking_extras').insert([
  { property_id: P, booking_id: Bk[4].id, name: 'Petit-déjeuner', quantity: 3, unit_price: 35 },
  { property_id: P, booking_id: Bk[4].id, name: 'Cours de surf', quantity: 1, unit_price: 350 },
])).error)
die('expenses', (await admin.from('expenses').insert([
  { property_id: P, category: 'menage', description: 'Produits ménagers', amount: 240, payment_method: 'cash', expense_date: '2026-11-03' },
  { property_id: P, category: 'alimentation', description: 'Pain; lait; œufs', amount: 180.5, payment_method: 'cash', expense_date: '2026-11-08' },
  { property_id: P, category: 'utilities', description: 'Électricité', amount: 900, payment_method: 'virement', expense_date: '2026-10-30' },
])).error)
console.log('seeded property', P, 'bookings', Bk.map((b) => b.id).join(','))
