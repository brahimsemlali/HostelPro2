#!/bin/zsh
# Per-role RLS / RPC checks against the LOCAL stack (run setup.sh first).
set -euo pipefail
HERE=${0:A:h}
eval "$(cd "$HERE/.stack" && supabase status -o env 2>/dev/null | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=')"
[[ -n ${ANON_KEY:-} ]] || { echo "Local stack not running — run scripts/local-test/setup.sh"; exit 1; }
ANON=$ANON_KEY SERVICE=$SERVICE_ROLE_KEY node "$HERE/check-roles.mjs"
