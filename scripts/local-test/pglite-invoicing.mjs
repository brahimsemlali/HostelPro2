// Docker-free check of migration 034 (invoicing) in PGlite (Postgres in WASM):
// numbering without gaps, totals validation, avoirs, immutability, FK nulling.
// Uses a stub schema (no real Supabase roles — RLS is covered by check-roles.sh).
//
//   npm i --no-save @electric-sql/pglite@0.3.14
//   node scripts/local-test/pglite-invoicing.mjs [path/to/034_invoicing.sql]
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'

const db = new PGlite()
const q = (s, p) => db.query(s, p)
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1 } else console.log('ok  ', m) }
async function expectErr(fn, pat, m) {
  try { await fn(); ok(false, m + ' (no error)') } catch (e) { ok(String(e.message).includes(pat), `${m} → ${e.message}`) }
}

await db.exec(`
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid primary key);
CREATE TABLE app_ctx (uid uuid);
INSERT INTO app_ctx VALUES (NULL);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT uid FROM public.app_ctx $$;
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE TABLE properties (id uuid primary key default gen_random_uuid(), owner_id uuid, name text, address text, city text, phone text, email text);
CREATE TABLE rooms (id uuid primary key default gen_random_uuid(), property_id uuid, name text);
CREATE TABLE beds (id uuid primary key default gen_random_uuid(), property_id uuid, room_id uuid, name text);
CREATE TABLE guests (id uuid primary key default gen_random_uuid(), property_id uuid, first_name text, last_name text, document_type text, document_number text, nationality text);
CREATE TABLE bookings (id uuid primary key default gen_random_uuid(), property_id uuid, guest_id uuid, bed_id uuid, source text, external_booking_id text, status text,
  check_in_date date, check_out_date date, nights int GENERATED ALWAYS AS (check_out_date - check_in_date) STORED, adults int default 1, total_price numeric(10,2));
CREATE TABLE booking_extras (id uuid primary key default gen_random_uuid(), booking_id uuid, property_id uuid, name text, quantity int, unit_price numeric(10,2));
CREATE TABLE payments (id uuid primary key default gen_random_uuid(), booking_id uuid, property_id uuid, amount numeric(10,2), method text, type text, status text);
CREATE TABLE staff (id uuid primary key default gen_random_uuid(), property_id uuid, user_id uuid, name text, role text, is_active bool default true);
CREATE FUNCTION get_my_property_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT property_id FROM staff WHERE user_id = auth.uid() AND is_active LIMIT 1 $$;
CREATE FUNCTION get_my_role_rank() RETURNS int LANGUAGE sql STABLE AS $$ SELECT 2 $$;
`)
const MIGRATION = process.argv[2] ?? new URL('../../supabase/migrations/034_invoicing.sql', import.meta.url)
await db.exec(readFileSync(MIGRATION, 'utf8'))
await db.exec(readFileSync(MIGRATION, 'utf8')) // idempotent re-run
ok(true, 'migration applies twice')

const OWNER = '11111111-1111-1111-1111-111111111111', RECEP = '22222222-2222-2222-2222-222222222222', HK = '33333333-3333-3333-3333-333333333333'
await q(`INSERT INTO auth.users VALUES ($1),($2),($3)`, [OWNER, RECEP, HK])
const P = (await q(`INSERT INTO properties (owner_id, name, city) VALUES ($1, 'Auberge Atlas', 'Agadir') RETURNING id`, [OWNER])).rows[0].id
const room = (await q(`INSERT INTO rooms (property_id, name) VALUES ($1, 'Dortoir A') RETURNING id`, [P])).rows[0].id
const bed = (await q(`INSERT INTO beds (property_id, room_id, name) VALUES ($1, $2, 'A1') RETURNING id`, [P, room])).rows[0].id
const g = (await q(`INSERT INTO guests (property_id, first_name, last_name, document_type, document_number, nationality) VALUES ($1,'Hans','Müller','passport','C01X','Allemagne') RETURNING id`, [P])).rows[0].id
const B = (await q(`INSERT INTO bookings (property_id, guest_id, bed_id, source, status, check_in_date, check_out_date, adults, total_price) VALUES ($1,$2,$3,'direct','checked_in','2026-11-24','2026-11-27',2,360) RETURNING id`, [P, g, bed])).rows[0].id
await q(`INSERT INTO booking_extras (booking_id, property_id, name, quantity, unit_price) VALUES ($1,$2,'Petit-déj',3,33.33)`, [B, P])
await q(`INSERT INTO payments (booking_id, property_id, amount, method, type, status) VALUES ($1,$2,300,'cash','payment','completed'),($1,$2,50,'cmi','payment','completed'),($1,$2,999,'cash','payment','pending')`, [B, P])
await q(`INSERT INTO staff (property_id, user_id, name, role) VALUES ($1,$2,'Salma','receptionist'),($1,$3,'Aicha','housekeeping')`, [P, RECEP, HK])
const as = (u) => q(`UPDATE app_ctx SET uid = $1`, [u])

// Payload as lib/invoicing.ts computes it: VAT 10%, tourist tax 5/night/adult included → 30
const lines = [
  { kind: 'accommodation', label: 'Hébergement', quantity: 3, unit_ttc: 110, vat_rate: 10, total_ht: 300, total_tva: 30, total_ttc: 330 },
  { kind: 'extra', label: 'Petit-déj', quantity: 3, unit_ttc: 33.33, vat_rate: 10, total_ht: 90.9, total_tva: 9.09, total_ttc: 99.99 },
  { kind: 'tourist_tax', label: 'Taxe de séjour', quantity: 3, unit_ttc: 10, vat_rate: 0, total_ht: 30, total_tva: 0, total_ttc: 30 },
]
const totals = { total_ht: 390.9, total_tva: 39.09, tourist_tax: 30, total_ttc: 459.99, vat_breakdown: [{ rate: 10, base_ht: 390.9, tva: 39.09 }] }
const issue = (t = totals, c = null) => q(`SELECT * FROM issue_invoice($1, $2::jsonb, $3::jsonb, $4::jsonb)`, [B, JSON.stringify(lines), JSON.stringify(t), c && JSON.stringify(c)])

await as(RECEP)
await expectErr(() => issue(), 'legal_info_missing', 'blocks without legal info')
await as(OWNER)
await q(`INSERT INTO property_legal (property_id, legal_name, ice, if_number, vat_registered, vat_rate, tourist_tax_mode, tourist_tax_per_night) VALUES ($1,'Atlas SARL','001234567000089','12345678',true,10,'included',5)`, [P])
await expectErr(() => q(`UPDATE property_legal SET ice='123' WHERE property_id=$1`, [P]), 'check', 'ICE format CHECK')

await as(HK)
await expectErr(() => issue(), 'forbidden', 'housekeeping cannot issue')
await as(RECEP)
await expectErr(() => issue({ ...totals, total_ttc: 400 }), 'total_mismatch', 'rejects tampered total')
await expectErr(() => issue({ ...totals, tourist_tax: 0, total_ht: 420.9 }), 'total_mismatch', 'rejects wrong tourist tax')
await expectErr(() => issue(totals, { company_ice: '42' }), 'invalid_ice', 'rejects bad company ICE')
const inv = (await issue(totals, { company_name: 'Voyages SA', company_ice: '000111222333444' })).rows[0]
ok(inv.number === 'F-2026-0001' || /^F-\d{4}-0001$/.test(inv.number), `first number ${inv.number}`)
ok(Number(inv.amount_paid) === 350, `amount_paid ignores pending (${inv.amount_paid})`)
ok(inv.buyer.name === 'Hans MÜLLER' && inv.buyer.company_ice === '000111222333444', `buyer snapshot ${JSON.stringify(inv.buyer)}`)
ok(inv.stay.bed === 'Dortoir A - A1' && inv.stay.nights === 3, `stay snapshot ${JSON.stringify(inv.stay)}`)
ok(inv.issued_by_name === 'Salma', 'issuer name')
ok(JSON.stringify(inv.payment_methods.sort()) === '["cash","cmi"]', `methods ${inv.payment_methods}`)
await expectErr(() => issue(), 'invoice_exists', 'second invoice for same booking blocked')

await expectErr(() => q(`UPDATE invoices SET total_ttc = 1 WHERE id=$1`, [inv.id]), 'invoice_immutable', 'snapshot immutable')
await expectErr(() => q(`SELECT * FROM issue_credit_note($1, 'erreur')`, [inv.id]), 'forbidden', 'receptionist cannot issue avoir')
await as(OWNER)
await expectErr(() => q(`SELECT * FROM issue_credit_note($1, '  ')`, [inv.id]), 'reason_required', 'avoir needs a reason')
const av = (await q(`SELECT * FROM issue_credit_note($1, 'Erreur de nom')`, [inv.id])).rows[0]
ok(/^AV-\d{4}-0001$/.test(av.number) && Number(av.total_ttc) === -459.99 && av.lines[0].total_ttc === -330, `avoir ${av.number} ${av.total_ttc}`)
ok(av.vat_breakdown[0].tva === -39.09 && av.credited_number === inv.number, 'avoir negated + credited_number ' + av.credited_number)
await expectErr(() => q(`SELECT * FROM issue_credit_note($1, 'x')`, [inv.id]), 'already_cancelled', 'cannot cancel twice')
await expectErr(() => q(`UPDATE invoices SET cancel_reason='changed' WHERE id=$1`, [inv.id]), 'invoice_immutable', 'cancel stamp is one-way')

const inv2 = (await issue()).rows[0]
ok(/^F-\d{4}-0002$/.test(inv2.number), `re-issue after avoir gets next number ${inv2.number}`)

// Rollback must not burn a number
await db.exec('BEGIN')
await issue().catch(() => {})
await db.exec('ROLLBACK')
await q(`SELECT * FROM issue_credit_note($1, 'test')`, [inv2.id])
const inv3 = (await issue()).rows[0]
ok(/^F-\d{4}-0003$/.test(inv3.number), `no gap after failed attempt ${inv3.number}`)

// FK nulling on booking delete is allowed by the immutability trigger
await q(`DELETE FROM bookings WHERE id=$1`, [B]).catch((e) => ok(false, 'booking delete: ' + e.message))
const left = (await q(`SELECT count(*)::int n FROM invoices WHERE booking_id IS NULL`)).rows[0].n
ok(left === 5, `invoices survive booking deletion (${left})`)

// Deleting an auth user who issued invoices must not be blocked by the immutability trigger
await q(`DELETE FROM staff WHERE user_id=$1`, [RECEP])
await q(`DELETE FROM auth.users WHERE id=$1`, [RECEP]).then(() => ok(true, 'issuer auth user deletable'), (e) => ok(false, 'issuer delete: ' + e.message))
const nulled = (await q(`SELECT count(*)::int n FROM invoices WHERE issued_by IS NULL AND issued_by_name='Salma'`)).rows[0].n
ok(nulled >= 1, `issued_by nulled, name kept (${nulled})`)
await expectErr(() => q(`UPDATE invoices SET issued_by=$1 WHERE issued_by IS NULL`, [OWNER]), 'invoice_immutable', 'issued_by cannot be reassigned')
// Property deletion cascades
await q(`DELETE FROM properties WHERE id=$1`, [P]).then(() => ok(true, 'property delete cascades'), (e) => ok(false, 'property delete: ' + e.message))
