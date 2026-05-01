#!/usr/bin/env bash
# Push the app to the LXC container and restart the service.
#
# Usage:
#   bin/deploy.sh [user@host]
#
# Default target can be set in .env.deploy (DEPLOY_TARGET=careers@CONTAINER_IP)
# or overridden on the command line.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load deploy target from .env.deploy if present
if [[ -f "$REPO_ROOT/.env.deploy" ]]; then
    source "$REPO_ROOT/.env.deploy"
fi
REMOTE="${1:-${DEPLOY_TARGET:-careers@CONTAINER_IP}}"
APP_DIR=/opt/careers
SSH_OPTS="-o StrictHostKeyChecking=no"

if [[ "$REMOTE" == *"CONTAINER_IP"* ]]; then
    echo "error: set DEPLOY_TARGET in .env.deploy or pass user@host as argument" >&2
    exit 1
fi

echo "==> Syncing to $REMOTE:$APP_DIR"
rsync -az --delete --filter='protect .npm' -e "ssh $SSH_OPTS" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='.env.deploy' \
    --exclude='.pgdata' \
    --exclude='*.log' \
    --exclude='.ssh' \
    "$REPO_ROOT/" "$REMOTE:$APP_DIR/"

echo "==> Installing production dependencies"
ssh $SSH_OPTS "$REMOTE" "cd $APP_DIR && npm install --omit=dev"

echo "==> Restarting service"
ssh $SSH_OPTS "$REMOTE" "sudo systemctl restart careers"

echo "==> Deploy complete — $(ssh $SSH_OPTS "$REMOTE" "systemctl status careers --no-pager -l | head -3")"
