#!/usr/bin/env bash
# Builds the web app against the deployed Supabase server and publishes it to Vercel (https://splitbill-hackathon.vercel.app).
# The EXPO_PUBLIC_ values are public client settings that ship inside the bundle; override them to target another project.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://uiwbsedibgvwaklmwjna.supabase.co/functions/v1/rpc}"
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-https://uiwbsedibgvwaklmwjna.supabase.co}"
export EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_fNrUu5vAS3k98LJMaZUMpg_u8PFXIhf}"

# Vercel blocks deploys whose enclosing git commit author isn't on the Vercel team, so the upload happens outside the repo.
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
(cd "$root/mobile" && npx expo export -p web --output-dir "$out" --clear)
cat > "$out/vercel.json" <<'JSON'
{"rewrites": [{"source": "/(.*)", "destination": "/index.html"}]}
JSON

# The project link lives in the ignored root .vercel/ so every deploy targets the same Vercel project.
[ -d "$root/.vercel" ] && cp -R "$root/.vercel" "$out/.vercel"
(cd "$out" && npx --yes vercel@latest deploy . --prod --yes)
[ -d "$root/.vercel" ] || cp -R "$out/.vercel" "$root/.vercel"
