#!/usr/bin/env bash
# KMTY 星商 — 本地演示 (macOS / Linux)。唯一依赖: Node.js ≥ 22.5
cd "$(dirname "$0")"
[ -d saas ] || cd ..
if ! node -e "require('node:sqlite')" 2>/dev/null; then
  echo "[!] 需要 Node.js 22.5+ — https://npmmirror.com/mirrors/node/v22.12.0/"
  exit 1
fi
node --no-warnings saas/seed.js --demo
export ADMIN_PASS=admin888
echo
echo " ============ KMTY 星商 · 本地演示 ============"
echo "  买家店铺   http://localhost:8787/s/lanyuan"
echo "  卖家中心   http://localhost:8787/seller    (lanyuan / demo888)"
echo "  平台控制台 http://localhost:8787/admin     (密码 admin888)"
echo "  星空定制页 http://localhost:8787/r/lanyuan"
echo " ============================================="
echo "  全部在本机运行，不联网、不涉及域名；Ctrl+C 停止。"
echo
( sleep 1.5; open http://localhost:8787/s/lanyuan 2>/dev/null || xdg-open http://localhost:8787/s/lanyuan 2>/dev/null ) &
exec node --no-warnings saas/server.js
