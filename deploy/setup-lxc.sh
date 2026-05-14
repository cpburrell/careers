#!/usr/bin/env bash
# Provision a fresh Debian 12 LXC container for the careers app.
# Run as root inside the container after first boot.
#
# Usage:
#   bash setup-lxc.sh
set -euo pipefail

APP_USER=careers
APP_DIR=/opt/careers
NODE_MAJOR=22

echo "==> Installing system packages"
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg sudo rsync

echo "==> Installing Node.js ${NODE_MAJOR}.x"
curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
apt-get install -y -qq nodejs

echo "==> Creating app user and directory"
useradd --system --shell /bin/bash --home-dir "$APP_DIR" "$APP_USER" || true
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Installing systemd service"
cp "$(dirname "$0")/careers.service" /etc/systemd/system/careers.service
systemctl daemon-reload
systemctl enable careers

echo "==> Granting careers user passwordless restart of its own service"
cat > /etc/sudoers.d/careers <<'EOF'
Defaults:careers !use_pty
careers ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart careers, /usr/bin/systemctl status careers
EOF
chmod 440 /etc/sudoers.d/careers

echo ""
echo "==> Done. Next steps:"
echo "    1. Copy your .env to ${APP_DIR}/.env (as root, then chown ${APP_USER}:${APP_USER})"
echo "    2. Run bin/deploy.sh from your dev machine to push the app code"
echo "    3. systemctl start careers  (or the deploy script does this automatically)"
