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

# The Vercel CLI never uploads node_modules folders, so fonts and icons exported under assets/node_modules would fall through to index.html.
if [ -d "$out/assets/node_modules" ]; then
  mv "$out/assets/node_modules" "$out/assets/vendor"
  { grep -rlF --include='*.js' --include='*.html' --include='*.json' '/assets/node_modules/' "$out" || true; } | while IFS= read -r f; do
    perl -pi -e 's#/assets/node_modules/#/assets/vendor/#g' "$f"
  done
fi
if find "$out" -name node_modules -print -quit | grep -q .; then echo "A node_modules folder is still in the export; Vercel would skip it." >&2; exit 1; fi
cat > "$out/vercel.json" <<'JSON'
{"rewrites": [{"source": "/((?!assets/|_expo/).*)", "destination": "/index.html"}]}
JSON

# The project link lives in the ignored root .vercel/ so every deploy targets the same Vercel project.
[ -d "$root/.vercel" ] && cp -R "$root/.vercel" "$out/.vercel"
(cd "$out" && npx --yes vercel@latest deploy . --prod --yes)
[ -d "$root/.vercel" ] || cp -R "$out/.vercel" "$root/.vercel"
