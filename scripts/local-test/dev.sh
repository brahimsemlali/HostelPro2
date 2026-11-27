#!/bin/zsh
# next dev on http://127.0.0.1:3100 against the LOCAL test stack (setup.sh).
# Env vars set here win over .env.local (which points at PRODUCTION), and the
# CSP connect-src follows NEXT_PUBLIC_SUPABASE_URL, so the browser can't reach prod.
# External integrations get dummy keys. Logs: scripts/local-test/.stack/dev.log
set -euo pipefail

HERE=${0:A:h}
REPO=${HERE:h:h}
STACK="$HERE/.stack"

pkill -f "next dev --turbopack -p 3100" 2>/dev/null || true
eval "$(cd "$STACK" && supabase status -o env 2>/dev/null | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=')"
[[ -n ${ANON_KEY:-} ]] || { echo "Local stack not running — run scripts/local-test/setup.sh"; exit 1; }

cd "$REPO"
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
export SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
export NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100
export WHATSAPP_API_TOKEN=disabled-local LEMONSQUEEZY_API_KEY=disabled-local
export SUPERADMIN_EMAILS=nobody@local.invalid SUPERADMIN_USER_IDS=00000000-0000-0000-0000-000000000000
export NEXT_PUBLIC_SENTRY_DSN=
nohup npx next dev --turbopack -p 3100 -H 127.0.0.1 > "$STACK/dev.log" 2>&1 &
echo "Starting on http://127.0.0.1:3100 (log: $STACK/dev.log)"
