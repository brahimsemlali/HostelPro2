# HostelPro — Bug & Logic Audit Report
Generated: 2026-04-21  
**Fixed: 2026-04-21** — All items resolved except L-5 (onboarding refresh guard)

---

## CRITICAL

### C-1 — Refunds counted as positive revenue in multiple places (FIXED)

**Affected files:**
- `app/(dashboard)/payments/PaymentsClient.tsx` — `totalToday`, `cashToday`, and every per-method sum
- `app/(dashboard)/night-audit/page.tsx` — `cashToday`, `totalRevenue` aggregations
- `app/(dashboard)/dashboard/page.tsx` — 7-day chart `revenue` and per-method aggregations

**Problem:**  
All these `reduce()` calls sum `p.amount` for every payment without filtering out `type === 'refund'`. Refunds are stored as positive amounts with `type = 'refund'`. So a 100 MAD refund adds +100 MAD to the reported total instead of -100 MAD.

Result: cash reconciliation is wrong, night audit revenue is inflated, and the 7-day chart is wrong whenever a refund exists.

**Pattern that IS correct** (already done in `reports/ReportsClient.tsx`):
```ts
payments.filter(p => p.type !== 'refund').reduce((s, p) => s + p.amount, 0)
```

**Fix:** Add `.filter(p => p.type !== 'refund')` before every `.reduce()` that sums amounts for display/reconciliation totals.

---

### C-2 — `total_stays` and `total_spent` on guests are never updated

**Affected file:** `components/guests/CheckInWizard.tsx`, `app/(dashboard)/bookings/[id]/BookingDetailClient.tsx`

**Problem:**  
`guests.total_stays` and `guests.total_spent` are declared in the schema and displayed in the guest detail page as loyalty metrics. They are set to default values (`1` and `0`) on guest creation but are **never incremented afterward** — not on check-in, not on checkout, not anywhere.

Result: every guest always shows 1 stay / 0 MAD spent regardless of how many times they've returned.

**Fix:** After a booking status changes to `checked_out`, recalculate and update:
```ts
const { count } = await supabase
  .from('bookings')
  .select('id', { count: 'exact' })
  .eq('guest_id', guestId)
  .not('status', 'in', '(cancelled,no_show)')
  
const { data: allBookings } = await supabase
  .from('bookings')
  .select('total_price')
  .eq('guest_id', guestId)
  .not('status', 'in', '(cancelled,no_show)')

const totalSpent = allBookings?.reduce((s, b) => s + b.total_price, 0) ?? 0

await supabase.from('guests').update({
  total_stays: count ?? 1,
  total_spent: totalSpent,
}).eq('id', guestId)
```

Best place to add this: inside `handleStatusChange('checked_out')` in `BookingDetailClient.tsx`.

---

## HIGH

### H-1 — Payment insert in CheckInWizard has no error handling

**Affected file:** `components/guests/CheckInWizard.tsx` — payment insert step (Step 4)

**Problem:**  
The payment record is inserted with `await supabase.from('payments').insert({...})` but the result is never checked for errors. If the insert fails (network issue, constraint violation, etc.), the check-in still completes "successfully" with no payment recorded. The ledger silently loses the transaction.

**Fix:**
```ts
const { error: payErr } = await supabase.from('payments').insert({ ... })
if (payErr) throw new Error(`Payment not recorded: ${payErr.message}`)
```

---

### H-2 — Bed status not updated on booking cancellation in BedMapClient

**Affected file:** `app/(dashboard)/beds/BedMapClient.tsx`

**Problem:**  
When a booking status is changed to `cancelled` or `no_show` via the bed map sheet, the booking row is updated but the bed's `status` column is **not** reset to `available`. The bed stays visually "occupied" with no guest.

`BookingDetailClient.tsx` does handle this correctly (line ~116–119). The BedMapClient does not mirror this logic.

**Fix:** After updating booking to `cancelled`/`no_show`, also run:
```ts
await supabase.from('beds').update({ status: 'available' }).eq('id', booking.bed_id)
```

---

### H-3 — Night audit can be run multiple times for the same date

**Affected file:** `app/(dashboard)/night-audit/page.tsx` and audit completion handler

**Problem:**  
The night audit wizard saves a record to `night_audits` but there is no uniqueness constraint on `(property_id, audit_date)` and no check in the UI or server action to see if an audit already exists for today before starting. Running the wizard twice creates two audit records for the same date, corrupting the audit history.

**Fix:**
1. Add a `UNIQUE` constraint to the DB: `ALTER TABLE night_audits ADD CONSTRAINT unique_audit_date UNIQUE (property_id, audit_date);`
2. In the page server component, query for an existing audit for today and show a "already completed" state if found.

---

## MEDIUM

### M-1 — Timezone off-by-one on all "today" date comparisons

**Affected files:** Almost every server page (`dashboard/page.tsx`, `night-audit/page.tsx`, `payments/page.tsx`, etc.)

**Problem:**  
`const today = new Date().toISOString().split('T')[0]` returns the UTC date, not the local Moroccan date (UTC+1 in winter, UTC+0 in summer — Morocco is unusual). After midnight local time but before 1 AM, `today` resolves to yesterday's date. All queries that compare against `today` (arrivals, departures, audit date) will return wrong data.

**Fix:** Use:
```ts
const today = new Date().toLocaleDateString('en-CA') // Returns YYYY-MM-DD in local time
```
Or use `date-fns` with the Moroccan locale:
```ts
import { format } from 'date-fns'
const today = format(new Date(), 'yyyy-MM-dd')
```

---

### M-2 — `logActivityServer` accepts `any` for the Supabase client

**Affected file:** `lib/activity.ts`

**Problem:**  
```ts
export async function logActivityServer(supabase: any, params: LogActivityParams)
```
The `any` type on the Supabase client parameter bypasses TypeScript safety. An invalid client object could be passed and the error would only surface at runtime.

**Fix:**
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
export async function logActivityServer(supabase: SupabaseClient, params: LogActivityParams)
```

---

### M-3 — Bed swap does not account for price difference

**Affected file:** `app/(dashboard)/beds/BedMapClient.tsx` — bed swap / reassign logic

**Problem:**  
When a guest is moved from one bed to another (e.g. bed A at 120 MAD/night to bed B at 200 MAD/night), the booking's `total_price` is not recalculated and no payment adjustment is prompted. The guest can end up in a more expensive bed with no record of the price difference.

**Fix:** When bed swap is confirmed, calculate `priceDiff = (newBed.base_price - oldBed.base_price) * booking.nights`. If positive, show a dialog prompting to collect the difference or update `total_price`. If negative, offer a refund.

---

### M-4 — Extra catalog `staff_access` RLS policy may conflict with owner policy

**Affected file:** `supabase/migrations/013_extra_catalog.sql`

**Problem:**  
Two RLS policies are defined on `extra_catalog`: `property_access` (for owners) and `staff_access` (for staff). Both are `FOR ALL`. If a staff member's `property_id` differs from the owner's, they get independent access. More importantly, there's no owner-only guard on `DELETE` — a receptionist can delete catalog items, which should probably be owner/manager only.

**Fix:** Replace the broad `FOR ALL` staff policy with read-only for staff:
```sql
CREATE POLICY "staff_read" ON extra_catalog FOR SELECT USING (
  property_id IN (SELECT property_id FROM staff WHERE user_id = auth.uid() AND is_active = TRUE)
);
```
And leave the full `property_access` policy for owners only.

---

## LOW

### L-1 — CSV export in Reports uses raw `.toFixed(2)` instead of locale formatting

**Affected file:** `app/(dashboard)/reports/ReportsClient.tsx` — CSV download handler

**Problem:**  
The CSV export formats amounts with `.toFixed(2)` which produces `1000.50` (English decimal). French Moroccan users expect `1 000,50`. Opening the CSV in Excel (French locale) will misinterpret the decimal separator.

**Fix:**
```ts
amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
```

---

### L-2 — Pre-arrival check-in API route missing server-side validation for required fields

**Affected file:** `app/api/checkin/[token]/route.ts` (or similar pre-checkin route)

**Problem:**  
The API validates `first_name` and `last_name` presence but does not validate `nationality`, `document_number`, or `date_of_birth` even though these are required for the fiche de police. A guest submitting the pre-arrival form could bypass client-side validation and submit incomplete data.

**Fix:** Add server-side checks:
```ts
if (!nationality || !document_number || !date_of_birth) {
  return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
}
```

---

### L-3 — WhatsApp payment reminder message uses wrong balance when extras exist

**Affected file:** `app/(dashboard)/bookings/[id]/BookingDetailClient.tsx` line ~232

**Problem:**  
```ts
msg = WHATSAPP_TEMPLATES.payment_reminder.fr(guest, dynamicBalance)
```
After the recent extras fix, `dynamicBalance` is now correct (includes extras). However, the `payment_reminder` template just shows a raw number. If a guest owes 200 MAD — 150 for room and 50 for a breakfast — the WhatsApp says "200 MAD due" with no breakdown. The guest may dispute the amount not knowing why.

**Fix:** Either update the template to include a breakdown, or pass a description string:
```ts
WHATSAPP_TEMPLATES.payment_reminder.fr(guest, dynamicBalance, extrasTotal > 0 ? `(dont ${formatCurrency(extrasTotal)} de suppléments)` : '')
```

---

### L-4 — Housekeeping tasks are not auto-created on checkout

**Affected file:** `app/(dashboard)/bookings/[id]/BookingDetailClient.tsx` — `handleStatusChange('checked_out')`

**Problem:**  
When a guest checks out, the bed is marked `dirty` but no `housekeeping_tasks` record is created. The housekeeping page shows tasks only if they exist in the DB — housekeeping staff won't automatically see that a bed needs cleaning after checkout unless a manager manually creates a task.

**Fix:** After marking bed as `dirty`, insert a housekeeping task:
```ts
await supabase.from('housekeeping_tasks').insert({
  property_id: booking.property_id,
  bed_id: booking.bed_id,
  room_id: booking.bed?.room_id,
  title: `Nettoyage après départ — ${bed?.name}`,
  status: 'pending',
  priority: 'normal',
})
```

---

### L-5 — `onboarding` page does not guard against refresh mid-wizard

**Affected file:** `app/onboarding/page.tsx`

**Problem:**  
The onboarding wizard uses local component state for all steps. If the user refreshes the browser on step 3, they lose all progress and restart from step 1. Additionally, if a property was partially created (step 1 saved to DB but step 2 rooms were not), the user ends up with a property record with no rooms/beds, and the wizard starts from step 1 again instead of continuing from where they left off.

**Fix:** After step 1 (property created), redirect to `/onboarding?step=2&propertyId=xxx` so a refresh can resume. On page load, check if a partially-completed property already exists and skip already-completed steps.

---

## Summary

| Severity | Count | Fix order |
|----------|-------|-----------|
| CRITICAL | 2     | Fix this week |
| HIGH     | 3     | Fix this week |
| MEDIUM   | 4     | Fix next sprint |
| LOW      | 5     | Fix when convenient |

**Most impactful fixes in order:**
1. **C-1** — Refund filtering (affects every payment report, night audit, and dashboard revenue)
2. **C-2** — Guest loyalty counters (broken permanently until fixed)
3. **H-1** — CheckInWizard silent payment failure (money can disappear)
4. **H-3** — Duplicate night audits (data integrity)
5. **H-2** — Bed status after cancellation (beds stuck occupied)
