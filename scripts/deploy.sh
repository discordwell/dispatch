#!/usr/bin/env bash
#
# Deploy Dispatch (static Vite build) to dispatch.discordwell.com on ovh2.
# Relies on the `ovh2` host alias in ~/.ssh/config (port 41022, user ubuntu, key ovh2_vps).
#
#   ./scripts/deploy.sh            # build + deploy to ovh2
#   REMOTE=ovh2 ./scripts/deploy.sh
#
set -euo pipefail

REMOTE="${REMOTE:-ovh2}"
SITE_DIR="/opt/dispatch/site"
CADDY_SRC="deploy/Caddyfile.dispatch.discordwell.com"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

echo "▸ building (tsc + vite)…"
npm run build

echo "▸ ensuring $SITE_DIR on $REMOTE…"
ssh "$REMOTE" "sudo mkdir -p '$SITE_DIR' && sudo chown -R \$(whoami) /opt/dispatch"

echo "▸ syncing dist/ → $REMOTE:$SITE_DIR…"
rsync -az --delete dist/ "$REMOTE:$SITE_DIR/"

echo "▸ installing Caddy site block…"
rsync -az "$CADDY_SRC" "$REMOTE:/tmp/dispatch.caddy"
ssh "$REMOTE" "sudo mkdir -p /etc/caddy/sites \
  && sudo mv /tmp/dispatch.caddy /etc/caddy/sites/dispatch.discordwell.com \
  && sudo systemctl reload caddy"

echo "▸ verifying…"
sleep 2
code="$(curl -sS -o /dev/null -w '%{http_code}' https://dispatch.discordwell.com/ || true)"
echo "  https://dispatch.discordwell.com/ → HTTP $code"
echo "▸ done."
