-- 034_invoicing.sql — Facturation légale (factures + avoirs)
--
-- What it adds:
--   * property_legal     — the seller's legal identity (raison sociale, ICE, IF,
--                          RC, patente, CNSS) and tax settings (TVA, taxe de séjour).
--                          A separate 1:1 table so existing `properties` selects
--                          keep working whether or not this migration is applied.
--   * invoice_counters   — one gap-free counter per (property, kind, year).
--                          Not a SEQUENCE: sequences skip numbers on rollback,
--                          and Moroccan invoices must be numbered without gaps.
--   * invoices           — immutable snapshots (seller, buyer, stay, lines, totals
--                          frozen at issue time). Factures and avoirs share it.
--   * issue_invoice()    — receptionist+: validates totals against the booking,
--                          numbers F-YYYY-NNNN in the same transaction as the insert.
--   * issue_credit_note()— manager+: cancels an invoice by issuing an avoir
--                          AV-YYYY-NNNN (an issued invoice is never edited or deleted).
--
-- Clients can only SELECT invoices; every write goes through the two
-- SECURITY DEFINER functions. A trigger makes issued rows immutable except
-- for the one-way cancellation stamp.
--
-- ORDERING: requires 026 (get_my_role_rank / staff roles). Safe to re-run.

-- ── property_legal ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_legal (
  property_id           UUID PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  legal_name            TEXT,
  legal_form            TEXT,                       -- SARL, SARLAU, personne physique…
  ice                   TEXT CHECK (ice IS NULL OR ice ~ '^[0-9]{15}$'),
  if_number             TEXT,
  rc                    TEXT,
  patente               TEXT,
  cnss                  TEXT,
  legal_address         TEXT,
  vat_registered        BOOLEAN NOT NULL DEFAULT FALSE,
  vat_rate              NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (vat_rate >= 0 AND vat_rate <= 30),
  tourist_tax_mode      TEXT NOT NULL DEFAULT 'none' CHECK (tourist_tax_mode IN ('none', 'included')),
  tourist_tax_per_night NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tourist_tax_per_night >= 0),
  bank_details          TEXT,
  invoice_footer        TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE property_legal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_owner_all" ON property_legal;
CREATE POLICY "legal_owner_all" ON property_legal FOR ALL
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())))
  WITH CHECK (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));

-- Receptionist+ read it to show "infos légales manquantes" before issuing.
DROP POLICY IF EXISTS "legal_staff_read" ON property_legal;
CREATE POLICY "legal_staff_read" ON property_legal FOR SELECT
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);

-- ── invoice_counters (no policies: only the definer functions touch it) ──────
CREATE TABLE IF NOT EXISTS invoice_counters (
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('invoice', 'credit_note')),
  year        INT  NOT NULL,
  last_seq    INT  NOT NULL,
  PRIMARY KEY (property_id, kind, year)
);
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;

-- ── invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  booking_id          UUID REFERENCES bookings(id) ON DELETE SET NULL,
  guest_id            UUID REFERENCES guests(id) ON DELETE SET NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('invoice', 'credit_note')),
  year                INT  NOT NULL,
  seq                 INT  NOT NULL,
  number              TEXT NOT NULL,
  issue_date          DATE NOT NULL,
  credited_invoice_id UUID REFERENCES invoices(id),
  credited_number     TEXT,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  notes               TEXT,
  seller              JSONB NOT NULL,
  buyer               JSONB NOT NULL,
  stay                JSONB NOT NULL,
  lines               JSONB NOT NULL,
  vat_breakdown       JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_ht            NUMERIC(12,2) NOT NULL,
  total_tva           NUMERIC(12,2) NOT NULL,
  tourist_tax         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc           NUMERIC(12,2) NOT NULL,
  amount_paid         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_methods     TEXT[] NOT NULL DEFAULT '{}',
  vat_registered      BOOLEAN NOT NULL,
  issued_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_by_name      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, kind, year, seq),
  CHECK ((kind = 'credit_note') = (credited_invoice_id IS NOT NULL))
);

-- At most one live (non-cancelled) facture per booking.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_active_per_booking
  ON invoices (booking_id) WHERE kind = 'invoice' AND cancelled_at IS NULL AND booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_property_date ON invoices (property_id, issue_date DESC, number DESC);
CREATE INDEX IF NOT EXISTS invoices_booking ON invoices (booking_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_owner_read" ON invoices;
CREATE POLICY "invoices_owner_read" ON invoices FOR SELECT
  USING (property_id IN (SELECT id FROM properties WHERE owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "invoices_staff_read" ON invoices;
CREATE POLICY "invoices_staff_read" ON invoices FOR SELECT
  USING (property_id = (SELECT get_my_property_id()) AND (SELECT get_my_role_rank()) >= 2);
-- No INSERT / UPDATE / DELETE policies: writes only via the functions below.

-- Immutability: only the cancellation stamp (once) and FK nulling (ON DELETE SET
-- NULL of booking / guest / issuing user) may change.
CREATE OR REPLACE FUNCTION invoices_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['cancelled_at', 'cancel_reason', 'booking_id', 'guest_id', 'issued_by'])
     IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['cancelled_at', 'cancel_reason', 'booking_id', 'guest_id', 'issued_by']) THEN
    RAISE EXCEPTION 'invoice_immutable';
  END IF;
  IF OLD.cancelled_at IS NOT NULL AND (NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
                                       OR NEW.cancel_reason IS DISTINCT FROM OLD.cancel_reason) THEN
    RAISE EXCEPTION 'invoice_immutable';
  END IF;
  IF (NEW.booking_id IS NOT NULL AND NEW.booking_id IS DISTINCT FROM OLD.booking_id)
     OR (NEW.guest_id IS NOT NULL AND NEW.guest_id IS DISTINCT FROM OLD.guest_id)
     OR (NEW.issued_by IS NOT NULL AND NEW.issued_by IS DISTINCT FROM OLD.issued_by) THEN
    RAISE EXCEPTION 'invoice_immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoices_immutable ON invoices;
CREATE TRIGGER trg_invoices_immutable BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION invoices_immutable();

-- ── helpers ──────────────────────────────────────────────────────────────────
-- Caller's rank on a given property: 4 = owner (properties.owner_id), else the
-- active staff rank for that property, else 0.
CREATE OR REPLACE FUNCTION invoice_caller_rank(p_property UUID)
RETURNS INT LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM properties WHERE id = p_property AND owner_id = auth.uid()) THEN 4
    ELSE COALESCE((
      SELECT CASE role WHEN 'owner' THEN 4 WHEN 'manager' THEN 3 WHEN 'receptionist' THEN 2 WHEN 'housekeeping' THEN 1 ELSE 0 END
      FROM staff WHERE user_id = auth.uid() AND is_active = TRUE AND property_id = p_property LIMIT 1
    ), 0)
  END;
$$;
REVOKE ALL ON FUNCTION invoice_caller_rank(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION next_invoice_seq(p_property UUID, p_kind TEXT, p_year INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq INT;
BEGIN
  -- The row lock taken by the upsert serialises concurrent issuers; the number
  -- is consumed only if the surrounding transaction commits → no gaps.
  INSERT INTO invoice_counters (property_id, kind, year, last_seq)
  VALUES (p_property, p_kind, p_year, 1)
  ON CONFLICT (property_id, kind, year) DO UPDATE SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;
  RETURN v_seq;
END $$;
REVOKE ALL ON FUNCTION next_invoice_seq(UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;

-- ── issue_invoice ────────────────────────────────────────────────────────────
-- p_lines / p_totals are computed client-side by lib/invoicing.ts (TTC split
-- into HT + TVA). The function re-checks them against the booking, so a
-- tampered payload cannot invoice an amount different from what is owed.
-- p_company: optional { company_name, company_ice, company_address } for B2B.
CREATE OR REPLACE FUNCTION issue_invoice(
  p_booking_id UUID,
  p_lines      JSONB,
  p_totals     JSONB,
  p_company    JSONB DEFAULT NULL
)
RETURNS invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b          bookings%ROWTYPE;
  p          properties%ROWTYPE;
  l          property_legal%ROWTYPE;
  g          guests%ROWTYPE;
  v_rank     INT;
  v_expected NUMERIC;
  v_tax      NUMERIC := 0;
  v_ttc      NUMERIC := (p_totals->>'total_ttc')::NUMERIC;
  v_ht       NUMERIC := (p_totals->>'total_ht')::NUMERIC;
  v_tva      NUMERIC := (p_totals->>'total_tva')::NUMERIC;
  v_ttax     NUMERIC := COALESCE((p_totals->>'tourist_tax')::NUMERIC, 0);
  v_lines_ttc NUMERIC;
  v_lines_tva NUMERIC;
  v_date     DATE := (NOW() AT TIME ZONE 'Africa/Casablanca')::DATE;
  v_year     INT;
  v_seq      INT;
  v_bed      TEXT;
  v_paid     NUMERIC;
  v_methods  TEXT[];
  v_issuer   TEXT;
  v_company_ice TEXT := NULLIF(btrim(COALESCE(p_company->>'company_ice', '')), '');
  result     invoices%ROWTYPE;
BEGIN
  -- Lock the booking: two clicks / two receptionists serialise here.
  SELECT * INTO b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;

  v_rank := invoice_caller_rank(b.property_id);
  IF v_rank < 2 THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO p FROM properties WHERE id = b.property_id;
  SELECT * INTO l FROM property_legal WHERE property_id = b.property_id;
  IF NOT FOUND OR COALESCE(btrim(l.legal_name), '') = '' OR l.ice IS NULL OR COALESCE(btrim(l.if_number), '') = '' THEN
    RAISE EXCEPTION 'legal_info_missing';
  END IF;

  IF EXISTS (SELECT 1 FROM invoices WHERE booking_id = b.id AND kind = 'invoice' AND cancelled_at IS NULL) THEN
    RAISE EXCEPTION 'invoice_exists';
  END IF;

  IF v_company_ice IS NOT NULL AND v_company_ice !~ '^[0-9]{15}$' THEN
    RAISE EXCEPTION 'invalid_ice';
  END IF;

  -- Totals must match what the booking says is owed (stay + extras), to the centime.
  SELECT b.total_price + COALESCE(SUM(quantity * unit_price), 0) INTO v_expected
  FROM booking_extras WHERE booking_id = b.id;

  IF l.tourist_tax_mode = 'included' AND l.tourist_tax_per_night > 0 THEN
    v_tax := LEAST(ROUND(l.tourist_tax_per_night * GREATEST(b.nights, 0) * GREATEST(COALESCE(b.adults, 1), 1), 2), b.total_price);
  END IF;

  SELECT COALESCE(SUM((x->>'total_ttc')::NUMERIC), 0), COALESCE(SUM((x->>'total_tva')::NUMERIC), 0)
    INTO v_lines_ttc, v_lines_tva
  FROM jsonb_array_elements(p_lines) x;

  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0
     OR v_ttc IS NULL OR v_ht IS NULL OR v_tva IS NULL
     OR ABS(v_ttc - v_expected) > 0.01
     OR ABS(v_lines_ttc - v_ttc) > 0.01
     OR ABS(v_lines_tva - v_tva) > 0.01
     OR ABS(v_ht + v_tva + v_ttax - v_ttc) > 0.01
     OR ABS(v_ttax - v_tax) > 0.01
     OR (NOT l.vat_registered AND v_tva <> 0) THEN
    RAISE EXCEPTION 'total_mismatch';
  END IF;

  SELECT * INTO g FROM guests WHERE id = b.guest_id;

  SELECT NULLIF(concat_ws(' - ', r.name, bd.name), '') INTO v_bed
  FROM beds bd LEFT JOIN rooms r ON r.id = bd.room_id WHERE bd.id = b.bed_id;

  SELECT COALESCE(SUM(CASE WHEN type = 'refund' THEN -amount ELSE amount END), 0),
         COALESCE(array_agg(DISTINCT method) FILTER (WHERE type <> 'refund'), '{}')
    INTO v_paid, v_methods
  FROM payments WHERE booking_id = b.id AND status = 'completed';

  SELECT COALESCE((SELECT name FROM staff WHERE user_id = auth.uid() AND property_id = b.property_id LIMIT 1), 'Propriétaire')
    INTO v_issuer;

  v_year := EXTRACT(YEAR FROM v_date)::INT;
  v_seq  := next_invoice_seq(b.property_id, 'invoice', v_year);

  INSERT INTO invoices (
    property_id, booking_id, guest_id, kind, year, seq, number, issue_date,
    seller, buyer, stay, lines, vat_breakdown,
    total_ht, total_tva, tourist_tax, total_ttc, amount_paid, payment_methods,
    vat_registered, issued_by, issued_by_name
  ) VALUES (
    b.property_id, b.id, b.guest_id, 'invoice', v_year, v_seq,
    'F-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0'), v_date,
    jsonb_build_object(
      'name', p.name, 'legal_name', l.legal_name, 'legal_form', l.legal_form,
      'address', COALESCE(NULLIF(btrim(l.legal_address), ''), p.address), 'city', p.city,
      'phone', p.phone, 'email', p.email, 'ice', l.ice, 'if_number', l.if_number, 'rc', l.rc,
      'patente', l.patente, 'cnss', l.cnss, 'bank_details', l.bank_details,
      'invoice_footer', l.invoice_footer, 'vat_registered', l.vat_registered
    ),
    jsonb_build_object(
      'name', COALESCE(NULLIF(btrim(concat_ws(' ', g.first_name, upper(g.last_name))), ''), 'Client'),
      'document', CASE WHEN g.document_number IS NOT NULL THEN
        CASE g.document_type WHEN 'passport' THEN 'Passeport' WHEN 'cin' THEN 'CIN' WHEN 'id_card' THEN 'Carte d''identité'
             ELSE COALESCE(g.document_type, 'Document') END || ' ' || g.document_number END,
      'nationality', g.nationality,
      'company_name', NULLIF(btrim(COALESCE(p_company->>'company_name', '')), ''),
      'company_ice', v_company_ice,
      'company_address', NULLIF(btrim(COALESCE(p_company->>'company_address', '')), '')
    ),
    jsonb_build_object(
      'check_in_date', b.check_in_date, 'check_out_date', b.check_out_date, 'nights', b.nights,
      'adults', COALESCE(b.adults, 1), 'bed', v_bed, 'source', b.source, 'external_ref', b.external_booking_id
    ),
    p_lines, COALESCE(p_totals->'vat_breakdown', '[]'::jsonb),
    v_ht, v_tva, v_ttax, v_ttc, v_paid, v_methods,
    l.vat_registered, auth.uid(), v_issuer
  ) RETURNING * INTO result;

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION issue_invoice(UUID, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_invoice(UUID, JSONB, JSONB, JSONB) TO authenticated;

-- ── issue_credit_note (avoir) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION issue_credit_note(p_invoice_id UUID, p_reason TEXT)
RETURNS invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o       invoices%ROWTYPE;
  v_date  DATE := (NOW() AT TIME ZONE 'Africa/Casablanca')::DATE;
  v_year  INT;
  v_seq   INT;
  v_issuer TEXT;
  result  invoices%ROWTYPE;
BEGIN
  SELECT * INTO o FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND OR o.kind <> 'invoice' THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF invoice_caller_rank(o.property_id) < 3 THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF o.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'already_cancelled'; END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT COALESCE((SELECT name FROM staff WHERE user_id = auth.uid() AND property_id = o.property_id LIMIT 1), 'Propriétaire')
    INTO v_issuer;

  v_year := EXTRACT(YEAR FROM v_date)::INT;
  v_seq  := next_invoice_seq(o.property_id, 'credit_note', v_year);

  INSERT INTO invoices (
    property_id, booking_id, guest_id, kind, year, seq, number, issue_date, credited_invoice_id, credited_number, notes,
    seller, buyer, stay, lines, vat_breakdown,
    total_ht, total_tva, tourist_tax, total_ttc, amount_paid, payment_methods,
    vat_registered, issued_by, issued_by_name
  ) VALUES (
    o.property_id, o.booking_id, o.guest_id, 'credit_note', v_year, v_seq,
    'AV-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0'), v_date, o.id, o.number, btrim(p_reason),
    o.seller, o.buyer, o.stay,
    (SELECT COALESCE(jsonb_agg(x || jsonb_build_object(
        'total_ht',  -((x->>'total_ht')::NUMERIC),
        'total_tva', -((x->>'total_tva')::NUMERIC),
        'total_ttc', -((x->>'total_ttc')::NUMERIC))), '[]'::jsonb)
     FROM jsonb_array_elements(o.lines) x),
    (SELECT COALESCE(jsonb_agg(x || jsonb_build_object(
        'base_ht', -((x->>'base_ht')::NUMERIC),
        'tva',     -((x->>'tva')::NUMERIC))), '[]'::jsonb)
     FROM jsonb_array_elements(o.vat_breakdown) x),
    -o.total_ht, -o.total_tva, -o.tourist_tax, -o.total_ttc, 0, '{}',
    o.vat_registered, auth.uid(), v_issuer
  ) RETURNING * INTO result;

  UPDATE invoices SET cancelled_at = NOW(), cancel_reason = btrim(p_reason) WHERE id = o.id;

  RETURN result;
END $$;

REVOKE ALL ON FUNCTION issue_credit_note(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_credit_note(UUID, TEXT) TO authenticated;
