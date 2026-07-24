#!/usr/bin/env bash
# One-time VPS provisioning for the Sumter Field Desk server.
# Self-contained: embeds the systemd unit and Caddyfile, so it can be piped
# over SSH from your machine with nothing copied to the server first:
#
#   ssh root@YOUR_VPS_IP 'bash -s -- api.yourdomain.com "'"$(cat deploy_key.pub)"'"' < deploy/setup-vps.sh
#
# Tested against a fresh Ubuntu 22.04/24.04 VPS. Safe to re-run.
#
# Arguments:
#   $1  domain name Caddy should serve over HTTPS (optional; skip Caddy by omitting)
#   $2  public SSH key for the GitHub Actions deploy user (optional; can be added later
#       to /home/deploy/.ssh/authorized_keys)
set -euo pipefail

DOMAIN="${1:-}"
DEPLOY_PUBKEY="${2:-}"

echo "==> Creating deploy user"
if ! id -u deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos 'GitHub Actions deploy' deploy
fi
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
if [[ -n "$DEPLOY_PUBKEY" ]] && ! grep -qF "$DEPLOY_PUBKEY" /home/deploy/.ssh/authorized_keys; then
  echo "$DEPLOY_PUBKEY" >> /home/deploy/.ssh/authorized_keys
fi

echo "==> Installing Node.js 22 and rsync"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y rsync

echo "==> Creating application directory"
install -d -o deploy -g deploy /opt/sumter-field-desk

echo "==> Installing systemd service"
cat > /etc/systemd/system/sumter-field-desk.service << 'UNIT'
[Unit]
Description=Sumter Field Desk server
After=network.target

[Service]
User=deploy
Group=deploy
WorkingDirectory=/opt/sumter-field-desk/website
ExecStart=/usr/bin/node server.mjs
Environment=PORT=4173
Restart=always
RestartSec=2

# Hardening: the app only reads its own files; StateDirectory is writable
# for future features that need persistence (message board, petitions).
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadOnlyPaths=/opt/sumter-field-desk
StateDirectory=sumter-field-desk

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable sumter-field-desk

echo "==> Allowing the deploy user to restart the service (and nothing else)"
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart sumter-field-desk' > /etc/sudoers.d/sumter-deploy
chmod 440 /etc/sudoers.d/sumter-deploy

if [[ -n "$DOMAIN" ]]; then
  echo "==> Installing Caddy for HTTPS on $DOMAIN"
  if ! command -v caddy >/dev/null 2>&1; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update && apt-get install -y caddy
  fi
  cat > /etc/caddy/Caddyfile << CADDY
$DOMAIN {
	encode gzip
	reverse_proxy localhost:4173
}
CADDY
  systemctl reload caddy || systemctl restart caddy
else
  echo "==> No domain given; skipping Caddy. The app will listen on port 4173 only."
fi

echo "==> Enabling firewall (SSH, HTTP, HTTPS)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
fi

echo
echo "Provisioning complete. Next steps:"
echo "  1. If you didn't pass a deploy key, append the GitHub Actions public key to /home/deploy/.ssh/authorized_keys"
echo "  2. In the GitHub repo, set secrets VPS_HOST and VPS_SSH_KEY, and repo variable DEPLOY_ENABLED=true"
echo "  3. Push to main; the workflow deploys and starts the service"
