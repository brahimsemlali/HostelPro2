#!/bin/zsh
# Stops the dev server and the LOCAL test stack (data is kept for next start).
HERE=${0:A:h}
pkill -f "next dev --turbopack -p 3100" 2>/dev/null || true
cd "$HERE/.stack" 2>/dev/null && supabase stop
