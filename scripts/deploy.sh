#!/usr/bin/env bash
# Build and deploy over SSH. Auth is your SSH key — this script takes no
# passwords, and DEPLOY_HOST/DEPLOY_PATH come from the environment:
#
#   DEPLOY_HOST=you@your-server DEPLOY_PATH=/srv/your-site ./scripts/deploy.sh
#
set -euo pipefail

: "${DEPLOY_HOST:?set DEPLOY_HOST, e.g. you@your-server}"
: "${DEPLOY_PATH:?set DEPLOY_PATH, e.g. /srv/your-site}"

echo "==> building"
npm run build

echo "==> packaging"
TAR=$(mktemp /tmp/site-XXXX.tar.gz)
tar -czf "$TAR" .next public package.json package-lock.json next.config.ts content posts data

echo "==> uploading to $DEPLOY_HOST:$DEPLOY_PATH"
scp "$TAR" "$DEPLOY_HOST:/tmp/site-deploy.tar.gz"
ssh "$DEPLOY_HOST" "
  set -e
  mkdir -p '$DEPLOY_PATH'
  tar -xzf /tmp/site-deploy.tar.gz -C '$DEPLOY_PATH'
  cd '$DEPLOY_PATH'
  npm ci --omit=dev
  # restart however your host runs node apps, e.g.:
  # systemctl restart your-site   |   pm2 restart your-site
"
rm -f "$TAR"
echo "==> done"
