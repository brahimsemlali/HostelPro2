#!/bin/zsh
# Runs the SQL test files against the LOCAL stack (scripts/local-test/setup.sh first).
set -euo pipefail
HERE=${0:A:h}
for f in "$HERE"/*.test.sql; do
  echo "── ${f:t}"
  docker exec -i supabase_db_hostelpro-test psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 < "$f"
done
if [[ -x "$HERE/race.sh" ]]; then "$HERE/race.sh"; fi
