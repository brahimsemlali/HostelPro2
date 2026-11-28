#!/bin/zsh
# Builds (or resets) a LOCAL Supabase test stack from supabase/migrations and seeds it.
# Never touches production: everything runs against 127.0.0.1:554xx in Docker.
#
#   scripts/local-test/setup.sh          # create / reset + seed
#   scripts/local-test/dev.sh            # next dev on :3100 against it
#   scripts/local-test/check-roles.sh    # RLS / RPC checks per role
#
# Requires Docker Desktop running and the Supabase CLI on PATH.
set -euo pipefail

HERE=${0:A:h}
REPO=${HERE:h:h}
STACK="$HERE/.stack"            # gitignored
CONTAINER=supabase_db_hostelpro-test

docker info >/dev/null 2>&1 || { echo "Docker is not running (open -a Docker)"; exit 1; }

mkdir -p "$STACK"
cd "$STACK"
if [[ ! -f supabase/config.toml ]]; then
  supabase init --force >/dev/null
  sed -i '' 's/^project_id = .*/project_id = "hostelpro-test"/' supabase/config.toml
  # Default ports (543xx) are often taken by another local project: use 554xx.
  sed -i '' -E 's/= 543([0-9]{2})/= 554\1/' supabase/config.toml
  sed -i '' 's#site_url = "http://127.0.0.1:3000"#site_url = "http://127.0.0.1:3100"#' supabase/config.toml
fi

# The CLI needs unique numeric versions; the repo has two "003_" files. Keep the
# repo order, renumber, and skip 011 (not applied in production on purpose).
rm -rf supabase/migrations && mkdir -p supabase/migrations
i=0
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  b=${f:t}
  [[ $b == 011_owner_whatsapp_api.sql ]] && continue
  i=$((i + 1))
  cp "$f" "supabase/migrations/$(printf '20260101%06d' $i)_${b#*_}"
done

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  supabase db reset --local >/dev/null
else
  supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit >/dev/null
fi

# Newer Supabase stacks don't auto-grant table privileges on `public`; the
# production project (older) does. Mirror production, then re-apply the
# deliberate REVOKEs from migrations 032/033/034.
docker exec -i "$CONTAINER" psql -U postgres -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
REVOKE ALL ON platform_payments, admin_audit_log, tenant_admin FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_tenant_usage() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION recompute_guest_totals(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION invoice_caller_rank(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION next_invoice_seq(UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION issue_invoice(UUID, JSONB, JSONB, JSONB) FROM anon;
REVOKE ALL ON FUNCTION issue_credit_note(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION subscription_gate(UUID) FROM anon;
-- 036 / 037: trigger functions and the channel queue are server-only.
REVOKE ALL ON FUNCTION trg_rooms_default_room_type(), trg_room_types_default_plan(), trg_bookings_room_type(),
  trg_rooms_retype(), trg_bookings_capacity_guard(), trg_rate_calendar_property(), trg_rate_plans_property(),
  trg_beds_room_type_occupancy()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON channel_ari_queue, channel_booking_revisions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON channel_connections, channel_sync_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE channel_ari_queue_id_seq, channel_booking_revisions_id_seq, channel_sync_log_id_seq FROM anon, authenticated;
REVOKE ALL ON FUNCTION channel_enqueue(UUID, UUID, TEXT, DATE, DATE, TEXT), trg_bookings_channel_enqueue(),
  trg_beds_channel_enqueue(), trg_rooms_channel_enqueue(), trg_rate_calendar_channel_enqueue(),
  trg_room_types_channel_enqueue() FROM PUBLIC, anon, authenticated;
-- 038: the import RPC is service-role only.
REVOKE ALL ON FUNCTION apply_channel_revision(TEXT), channel_units_for_room(TEXT, JSONB), channel_source(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_channel_revision(TEXT) TO service_role;
REVOKE INSERT, DELETE ON channel_alerts FROM anon, authenticated;
REVOKE ALL ON channel_alerts FROM anon;
REVOKE ALL ON SEQUENCE channel_alerts_id_seq FROM anon, authenticated;
SQL

eval "$(supabase status -o env 2>/dev/null | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=')"
ANON=$ANON_KEY SERVICE=$SERVICE_ROLE_KEY node "$HERE/seed.mjs"

echo
echo "Local stack ready on http://127.0.0.1:55421 — accounts (password Test1234!):"
echo "  owner@test.local · manager@test.local · recep@test.local · menage@test.local"
echo "Next: scripts/local-test/dev.sh  →  http://127.0.0.1:3100"
