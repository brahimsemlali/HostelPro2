// Per-role RLS / RPC checks for invoicing (034) and the staff subscription
// gate (035), against the LOCAL stack only. Run via check-roles.sh after
// setup.sh. Exits 1 on any failure.
import { createRequire } from 'module'
const require = createRequire(new URL('../../package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')

const URL_ = 'http://127.0.0.1:55421'
const { ANON, SERVICE } = process.env
const PW = 'Test1234!'
let failures = 0
const ok = (cond, msg) => { if (!cond) failures++; console.log(cond ? 'ok  ' : 'FAIL', msg) }
const client = () => createClient(URL_, ANON, { auth: { persistSession: false } })
async function as(email) {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email, password: PW })
  if (error) throw new Error(`${email}: ${error.message}`)
  return c
}
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })

// Mirrors lib/invoicing.ts computeInvoice for a booking without extras
// (VAT 10 %, taxe de séjour 5 MAD/night/adult included in the price).
const round2 = (n) => Math.round(n * 100) / 100
function payloadFor(b) {
  const tax = Math.min(round2(5 * b.nights * Math.max(1, b.adults)), b.total_price)
  const acc = round2(b.total_price - tax)
  const ht = round2(acc / 1.1), tva = round2(acc - ht)
  const lines = [
    { kind: 'accommodation', label: 'Hébergement', quantity: b.nights, unit_ttc: round2(acc / b.nights), vat_rate: 10, total_ht: ht, total_tva: tva, total_ttc: acc },
    { kind: 'tourist_tax', label: 'Taxe de séjour', quantity: b.nights, unit_ttc: round2(tax / b.nights), vat_rate: 0, total_ht: tax, total_tva: 0, total_ttc: tax },
  ]
  return { lines, totals: { total_ht: ht, total_tva: tva, tourist_tax: tax, total_ttc: b.total_price, vat_breakdown: [{ rate: 10, base_ht: ht, tva }] } }
}

const { data: prop } = await admin.from('properties').select('id').eq('name', 'Auberge Atlas').single()
const P = prop.id
const { data: stays } = await admin.from('bookings')
  .select('id, total_price, nights, adults, guest:guest_id(first_name), extras:booking_extras(id)')
  .eq('property_id', P).eq('status', 'checked_in')
const noExtras = stays.filter((b) => b.extras.length === 0)
if (noExtras.length < 2) throw new Error('seed: need two checked-in bookings without extras')
const [bA, bB] = noExtras

// ── Owner: legal info + first invoice ───────────────────────────────────────
const owner = await as('owner@test.local')
let r = await owner.from('property_legal').upsert({
  property_id: P, legal_name: 'ATLAS HOSPITALITY SARL', ice: '001234567000089', if_number: '45678912',
  vat_registered: true, vat_rate: 10, tourist_tax_mode: 'included', tourist_tax_per_night: 5,
})
ok(!r.error, `owner saves legal info ${r.error?.message ?? ''}`)
r = await owner.from('property_legal').update({ ice: '123' }).eq('property_id', P)
ok(!!r.error, 'ICE must be 15 digits (CHECK)')
const existing = await admin.from('invoices').select('id, booking_id').eq('kind', 'invoice').is('cancelled_at', null).in('booking_id', [bA.id, bB.id])
for (const inv of existing.data ?? []) await owner.rpc('issue_credit_note', { p_invoice_id: inv.id, p_reason: 'reset by check-roles' })
r = await owner.rpc('issue_invoice', { p_booking_id: bA.id, ...rpcArgs(bA), p_company: null })
ok(!r.error && /^F-\d{4}-\d{4}$/.test(r.data?.number), `owner issues invoice → ${r.data?.number ?? r.error?.message}`)
const invA = r.data
r = await owner.rpc('issue_invoice', { p_booking_id: bA.id, ...rpcArgs(bA), p_company: null })
ok(r.error?.message.includes('invoice_exists'), `one live invoice per booking → ${r.error?.message}`)

function rpcArgs(b) { const { lines, totals } = payloadFor(b); return { p_lines: lines, p_totals: totals } }

// ── Housekeeping ────────────────────────────────────────────────────────────
const hk = await as('menage@test.local')
r = await hk.from('invoices').select('id')
ok(!r.error && r.data.length === 0, `housekeeping sees no invoices (${r.data?.length})`)
r = await hk.from('property_legal').select('ice')
ok(!r.error && r.data.length === 0, 'housekeeping cannot read legal info')
r = await hk.rpc('issue_invoice', { p_booking_id: bB.id, ...rpcArgs(bB), p_company: null })
ok(r.error?.message.includes('forbidden'), `housekeeping cannot issue → ${r.error?.message}`)

// ── Receptionist ────────────────────────────────────────────────────────────
const rc = await as('recep@test.local')
r = await rc.from('invoices').select('number')
ok(!r.error && r.data.length > 0, `receptionist reads invoices (${r.data?.length})`)
r = await rc.from('invoices').update({ total_ttc: 1 }).eq('id', invA.id).select('id')
ok(!r.error && r.data.length === 0, 'receptionist cannot update invoices')
r = await rc.from('invoices').delete().eq('id', invA.id).select('id')
ok(!r.error && r.data.length === 0, 'receptionist cannot delete invoices')
r = await rc.from('invoices').insert({ property_id: P })
ok(!!r.error, `receptionist cannot insert directly → ${r.error?.code}`)
r = await rc.from('property_legal').update({ ice: '999999999999999' }).eq('property_id', P).select('ice')
ok(!r.error && r.data.length === 0, 'receptionist cannot edit legal info')
r = await rc.rpc('issue_credit_note', { p_invoice_id: invA.id, p_reason: 'test' })
ok(r.error?.message.includes('forbidden'), `receptionist cannot issue avoir → ${r.error?.message}`)
r = await rc.rpc('next_invoice_seq', { p_property: P, p_kind: 'invoice', p_year: 2026 })
ok(!!r.error, `receptionist cannot burn invoice numbers → ${r.error?.code}`)
const tampered = rpcArgs(bB); tampered.p_totals = { ...tampered.p_totals, total_ttc: 1 }
r = await rc.rpc('issue_invoice', { p_booking_id: bB.id, ...tampered, p_company: null })
ok(r.error?.message.includes('total_mismatch'), `tampered total rejected → ${r.error?.message}`)
r = await rc.rpc('issue_invoice', { p_booking_id: bB.id, ...rpcArgs(bB), p_company: { company_name: 'X', company_ice: '42' } })
ok(r.error?.message.includes('invalid_ice'), `bad company ICE rejected → ${r.error?.message}`)
r = await rc.rpc('issue_invoice', { p_booking_id: bB.id, ...rpcArgs(bB), p_company: null })
ok(!r.error && r.data?.number, `receptionist issues invoice → ${r.data?.number ?? r.error?.message}`)
const invB = r.data

// ── Manager: avoir, then re-issue gets the next number (no gaps) ───────────
const mg = await as('manager@test.local')
r = await mg.rpc('issue_credit_note', { p_invoice_id: invB.id, p_reason: '  ' })
ok(r.error?.message.includes('reason_required'), `avoir needs a reason → ${r.error?.message}`)
r = await mg.rpc('issue_credit_note', { p_invoice_id: invB.id, p_reason: 'Test manager' })
ok(!r.error && r.data?.credited_number === invB.number && Number(r.data?.total_ttc) === -Number(invB.total_ttc), `manager issues avoir → ${r.data?.number ?? r.error?.message}`)
r = await mg.rpc('issue_credit_note', { p_invoice_id: invB.id, p_reason: 'again' })
ok(r.error?.message.includes('already_cancelled'), 'cannot cancel twice')
r = await rc.rpc('issue_invoice', { p_booking_id: bB.id, ...rpcArgs(bB), p_company: null })
const seq = (n) => Number(n.split('-')[2])
ok(!r.error && seq(r.data.number) === seq(invB.number) + 1, `re-issue after avoir → ${r.data?.number ?? r.error?.message}`)

// ── Anonymous + another tenant ─────────────────────────────────────────────
const anon = client()
r = await anon.from('invoices').select('id')
ok(r.error || r.data.length === 0, 'anon reads nothing')
r = await anon.rpc('issue_invoice', { p_booking_id: bB.id, ...rpcArgs(bB), p_company: null })
ok(!!r.error, `anon cannot call issue_invoice → ${r.error?.code}`)
const { data: u } = await admin.auth.admin.createUser({ email: 'stranger@test.local', password: PW, email_confirm: true })
try {
  const other = await as('stranger@test.local')
  r = await other.from('invoices').select('id')
  ok(!r.error && r.data.length === 0, 'another account sees no invoices')
  r = await other.rpc('issue_invoice', { p_booking_id: bB.id, ...rpcArgs(bB), p_company: null })
  ok(r.error?.message.includes('forbidden'), `another account cannot invoice our booking → ${r.error?.message}`)
  r = await other.rpc('subscription_gate', { p_property_id: P })
  ok(!r.error && r.data.length === 0, 'subscription_gate returns nothing to a stranger')
} finally {
  await admin.auth.admin.deleteUser(u.user.id)
}

// ── Staff subscription gate (035) ───────────────────────────────────────────
for (const [email, c] of [['recep', rc], ['menage', hk], ['manager', mg]]) {
  const direct = await c.from('subscriptions').select('customer_portal_url').eq('property_id', P).maybeSingle()
  const gate = await c.rpc('subscription_gate', { p_property_id: P })
  ok(!direct.data && gate.data?.[0]?.status === 'active', `${email}: gate shows active, subscription row stays hidden`)
}

// ── Room types, rates, channel tables (036 / 037) ──────────────────────────
{
  const { data: types } = await admin.from('room_types').select('id, name').eq('property_id', P)
  const dorm = types.find((t) => t.name === 'Dortoir A')
  const { data: plan } = await admin.from('rate_plans').select('id').eq('room_type_id', dorm.id).eq('is_default', true).single()

  for (const [email, c] of [['recep', rc], ['menage', hk], ['manager', mg]]) {
    r = await c.from('room_types').select('id').eq('property_id', P)
    ok(!r.error && r.data.length === types.length, `${email} reads room types`)
    r = await c.from('room_types').update({ default_rate: 1 }).eq('id', dorm.id).select('id')
    ok(!r.error && r.data.length === 0, `${email} cannot edit a room type`)
    r = await c.rpc('room_type_availability', { p_room_type_id: dorm.id, p_from: '2027-01-01', p_to: '2027-01-03' })
    ok(!r.error && r.data.length === 2, `${email} reads availability`)
  }
  r = await rc.from('rate_calendar').insert({ rate_plan_id: plan.id, property_id: P, date: '2027-01-01', rate: 1 })
  ok(!!r.error, 'recep cannot write the rate calendar')
  r = await mg.from('rate_calendar').insert({ rate_plan_id: plan.id, property_id: P, date: '2027-01-01', rate: 140 }).select('rate')
  ok(!r.error && r.data.length === 1, 'manager writes the rate calendar')
  r = await owner.from('room_types').update({ default_rate: 125 }).eq('id', dorm.id).select('default_rate')
  ok(!r.error && Number(r.data[0]?.default_rate) === 125, 'owner edits a room type')
  await admin.from('rate_calendar').delete().eq('rate_plan_id', plan.id)

  for (const [email, c] of [['owner', owner], ['manager', mg], ['anon', anon]]) {
    r = await c.from('channel_ari_queue').select('id')
    ok(!!r.error || r.data.length === 0, `${email} cannot read the sync queue`)
    r = await c.from('channel_connections').insert({ property_id: P, status: 'active' })
    ok(!!r.error, `${email} cannot activate a channel connection`)
  }
  r = await anon.from('room_types').select('id')
  ok(!r.error && r.data.length === 0, 'anon reads no room types')
}

// ── SR409 reaches the browser client + signup gives every room a type ─────
{
  // A commit-time (deferred) guard error must surface through PostgREST with
  // its SQLSTATE, as the check-in wizard reads it (.select().single()).
  const night = '2027-09-01', out = '2027-09-02'
  const { data: priv } = await admin.from('room_types').select('id').eq('property_id', P).eq('sell_unit', 'room').limit(1).single()
  const { data: privBed } = await admin.from('beds').select('id, room:room_id!inner(room_type_id)').eq('room.room_type_id', priv.id).limit(1).single()
  const fill = await admin.from('bookings').insert({ property_id: P, room_type_id: priv.id, source: 'booking_com', status: 'confirmed', check_in_date: night, check_out_date: out, total_price: 0, external_booking_id: 'SR409-fill' }).select('id').single()
  ok(!fill.error, 'admin fills the private room with a bed-less OTA booking')
  r = await rc.from('bookings').insert({ property_id: P, bed_id: privBed.id, source: 'walkin', status: 'confirmed', check_in_date: night, check_out_date: out, total_price: 300 }).select().single()
  ok(r.error?.code === 'SR409', `recep walk-in on the sold room → ${r.error?.code} (expects SR409)`)
  await admin.from('bookings').delete().eq('external_booking_id', 'SR409-fill')

  const { data: nu } = await admin.auth.admin.createUser({ email: 'signup@test.local', password: PW, email_confirm: true })
  try {
    const su = await as('signup@test.local')
    r = await su.rpc('create_property_with_setup', {
      p_name: 'Riad Test', p_city: 'Fès', p_phone: '', p_wifi: '', p_lang: 'fr', p_owner_name: 'Test',
      p_trial_end: new Date(Date.now() + 14 * 864e5).toISOString(),
      p_rooms: [
        { name: 'Dortoir F', type: 'dorm', gender_policy: 'female', beds: [1, 2, 3].map((n) => ({ name: `F${n}`, bunk_position: null, base_price: 100, status: 'available' })) },
        { name: 'Chambre 1', type: 'private', gender_policy: 'mixed', beds: [1, 2].map((n) => ({ name: `C${n}`, bunk_position: null, base_price: 200, status: 'available' })) },
      ],
    })
    ok(!r.error, `signup RPC creates the property ${r.error?.message ?? ''}`)
    const newProp = r.data
    const { data: nTypes } = await admin.from('room_types').select('id, kind, sell_unit, gender_policy, max_occupancy').eq('property_id', newProp)
    const { data: nRooms } = await admin.from('rooms').select('room_type_id').eq('property_id', newProp)
    const { data: nPlans } = await admin.from('rate_plans').select('id').eq('property_id', newProp).eq('is_default', true)
    ok(nRooms.length === 2 && nRooms.every((x) => x.room_type_id), 'signup: every room has a type')
    ok(nPlans.length === 2, 'signup: every type has a default rate plan')
    const fem = nTypes.find((x) => x.kind === 'dorm'), pr = nTypes.find((x) => x.kind === 'private')
    ok(fem?.sell_unit === 'bed' && fem?.gender_policy === 'female', 'signup: women-only dorm sold per bed')
    ok(pr?.sell_unit === 'room' && pr?.max_occupancy === 2, `signup: private room sold whole, sleeps ${pr?.max_occupancy}`)
    await admin.from('properties').delete().eq('id', newProp)
  } finally {
    await admin.auth.admin.deleteUser(nu.user.id)
  }
}

console.log(failures ? `\n${failures} FAILED` : '\nall checks passed')
process.exit(failures ? 1 : 0)
