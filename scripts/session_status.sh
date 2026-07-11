#!/usr/bin/env bash
# Dirty status check for the web dashboard toolchain — run at the start of
# any new rosject session to see what this session lost to the non-
# persistent disk (nvm/node, app deps, extracted URDF, rosbridge). Green =
# OK, red = missing/needs session_init.sh or a rebuild step. Read-only,
# makes no changes.
set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
bad()  { echo -e "${RED}[MISSING]${NC} $1"; }

APP_DIR="$HOME/webpage_ws/app"

echo "== Node / nvm =="
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  ok "nvm installed at \$HOME/.nvm"
else
  bad "nvm not found at \$HOME/.nvm — run session_init.sh"
fi

NODE_VERSION="$(node --version 2>/dev/null)"
if [[ "$NODE_VERSION" == v20.* ]]; then
  ok "node $NODE_VERSION active"
elif [ -n "$NODE_VERSION" ]; then
  bad "node $NODE_VERSION active (need v20.x) — run session_init.sh"
else
  bad "node not found on PATH — run session_init.sh"
fi

NPM_VERSION="$(npm --version 2>/dev/null)"
if [[ "$NPM_VERSION" == 10.* ]]; then
  ok "npm $NPM_VERSION active"
else
  bad "npm version is '$NPM_VERSION' (expected 10.x, bundled with Node 20)"
fi

echo
echo "== rosbridge (needed for the app to connect) =="
if ss -ltn 2>/dev/null | grep -q ':9090 '; then
  ok "port 9090 listening (rosbridge_websocket up)"
else
  bad "port 9090 not listening — run: ros2 launch rosbridge_server rosbridge_websocket_launch.xml"
fi

echo
echo "== webpage_ws/app =="
if [ -d "$APP_DIR/node_modules" ]; then
  ok "node_modules present"
else
  bad "node_modules missing — run: cd $APP_DIR && npm install"
fi

if [ -f "$APP_DIR/public/robot/robot.urdf" ]; then
  ok "extracted URDF present ($APP_DIR/public/robot/robot.urdf)"
else
  bad "URDF not extracted — run: npm run extract-urdf (sim must be running)"
fi

echo
echo "== SLOT_PREFIX (rosject identity) =="
if [ -n "${SLOT_PREFIX:-}" ]; then
  ok "SLOT_PREFIX=$SLOT_PREFIX"
else
  bad "\$SLOT_PREFIX not set — are you in a rosject?"
fi

echo
echo "== Preview server port 7000 (confirmed: webpage_address proxies here) =="
if ss -ltnp 2>/dev/null | grep -q ':7000 '; then
  bad "port 7000 already in use — check for a leftover vite preview process"
else
  ok "port 7000 free — run: npm run build && PORT=7000 npm run preview"
fi

echo
echo "== Done. =="