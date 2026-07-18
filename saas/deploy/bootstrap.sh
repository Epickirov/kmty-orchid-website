#!/usr/bin/env bash
# KMTY 星商 — ECS bootstrap (Ubuntu 22.04+, run as root). Mainland-safe:
# Node from npmmirror, nginx from the distro archive (Aliyun ECS resolves
# Ubuntu archives to Aliyun's own mirror), acme.sh from the gitee mirror.
#
#   Part 1 (pre-DNS, run any time):  bash bootstrap.sh part1
#   Part 2 (after order.kmtyorchid.com points here):  bash bootstrap.sh part2
#
# Expects the app synced to /opt/kmty (repo layout: saas/ + constellation.html
# + stock.html + images/ …). Review before running — it edits system config.
set -euo pipefail

NODE_VER=v22.12.0
DOMAIN=order.kmtyorchid.com
APP=/opt/kmty
SVC=/etc/systemd/system/kmty.service

part1() {
  echo "== Node ${NODE_VER} from npmmirror =="
  if [ ! -x /opt/node22/bin/node ]; then
    curl -fL "https://npmmirror.com/mirrors/node/${NODE_VER}/node-${NODE_VER}-linux-x64.tar.xz" -o /tmp/node.tar.xz
    mkdir -p /opt/node22
    tar -xJf /tmp/node.tar.xz -C /opt/node22 --strip-components=1
  fi
  /opt/node22/bin/node --version

  echo "== app directory =="
  test -f "${APP}/saas/server.js" || { echo "!! sync the repo to ${APP} first (rsync/scp)"; exit 1; }

  echo "== ADMIN_PASS =="
  if [ ! -f "${APP}/saas/.env" ]; then
    read -r -p "Set platform admin password: " AP
    printf 'ADMIN_PASS=%s\n' "${AP}" > "${APP}/saas/.env"
    chmod 600 "${APP}/saas/.env"
  fi

  echo "== systemd unit =="
  # shellcheck disable=SC2154
  sed "s|__APP__|${APP}|g" "${APP}/saas/deploy/kmty.service" > "${SVC}"
  systemctl daemon-reload
  systemctl enable --now kmty
  sleep 1
  curl -fsS http://127.0.0.1:8787/api/health && echo " ← app OK"

  echo "== nginx (HTTP only until DNS + cert in part2) =="
  apt-get update -y && apt-get install -y nginx
  sed "s|__DOMAIN__|${DOMAIN}|g" "${APP}/saas/deploy/nginx-http.conf" > /etc/nginx/sites-available/kmty
  ln -sf /etc/nginx/sites-available/kmty /etc/nginx/sites-enabled/kmty
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx

  echo "== acme.sh (gitee mirror) =="
  if [ ! -d /root/.acme.sh ]; then
    git clone --depth 1 https://gitee.com/neilpang/acme.sh.git /tmp/acme.sh
    (cd /tmp/acme.sh && ./acme.sh --install --nocron-use-standalone || ./acme.sh --install)
  fi

  echo
  echo "PART 1 DONE. Test now via  http://<ECS-IP>/seller  (and /admin, /s/…)."
  echo "After the ICP passes and DNS points ${DOMAIN} here, run:  bash bootstrap.sh part2"
}

part2() {
  echo "== issue certificate for ${DOMAIN} (webroot HTTP-01) =="
  mkdir -p /var/www/acme
  /root/.acme.sh/acme.sh --issue -d "${DOMAIN}" -w /var/www/acme --server letsencrypt
  mkdir -p /etc/nginx/certs
  /root/.acme.sh/acme.sh --install-cert -d "${DOMAIN}" \
    --key-file /etc/nginx/certs/kmty.key \
    --fullchain-file /etc/nginx/certs/kmty.pem \
    --reloadcmd "systemctl reload nginx"
  sed "s|__DOMAIN__|${DOMAIN}|g" "${APP}/saas/deploy/nginx-https.conf" > /etc/nginx/sites-available/kmty
  nginx -t && systemctl reload nginx
  echo "PART 2 DONE →  https://${DOMAIN}/seller"
  echo "Remaining: KV import (see CUTOVER.md), set the ICP number:"
  echo "  sqlite3 ${APP}/saas/data/app.db \"INSERT INTO kv (key,value) VALUES ('icp','滇ICP备XXXXXXXX号') ON CONFLICT(key) DO UPDATE SET value=excluded.value;\""
}

case "${1:-}" in
  part1) part1 ;;
  part2) part2 ;;
  *) echo "usage: bash bootstrap.sh part1|part2"; exit 1 ;;
esac
