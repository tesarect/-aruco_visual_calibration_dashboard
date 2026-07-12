#!/usr/bin/env bash
# One-shot setup for the visual_calibration web dashboard, run inside the
# (fresh, ephemeral) rosject. Idempotent — safe to re-run.
#
# Usage:
#   cd webpage_ws
#   ./setup_rosject.sh [--force-extract-urdf]
#
# What it does:
#   1. Loads nvm (already present on the rosject, just unsourced) and
#      installs/activates Node 20 LTS, without touching the existing
#      system Node v8 install used by other tooling.
#   2. Extracts the live URDF (+ meshes) from the running sim/real robot
#      via scripts/extract_urdf.py — SKIPPED if app/public/robot/robot.urdf
#      already exists (the robot's physical shape — UR3e + RG2 gripper —
#      is the same whether you're connected to sim or the real robot, so
#      one extraction covers both; only the live /joint_states values
#      differ, which the app reads continuously at runtime, not here).
#      Pass --force-extract-urdf to re-extract anyway (e.g. after a real
#      hardware change). Skipped with a warning if ROS/the sim isn't up
#      yet and no cached file exists either.
#   3. npm installs the React/Vite app under app/.
set -euo pipefail

FORCE_EXTRACT_URDF=false
for arg in "$@"; do
  if [ "$arg" = "--force-extract-urdf" ]; then
    FORCE_EXTRACT_URDF=true
  fi
done

WEBPAGE_WS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$WEBPAGE_WS_DIR/app"

echo "== 1/3: Node 20 via nvm =="
# The rosject's pre-baked nvm at /usr/local/share/shell/.nvm has a read-only
# cache dir (part of the base image), so `nvm install` fails under it no
# matter the version. Always use a fresh, writable nvm under $HOME instead —
# it can coexist with the system one; we just never source that one.
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "Installing a user-writable nvm under $NVM_DIR ..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20
echo "Using node $(node --version), npm $(npm --version)"

echo
echo "== 2/3: URDF + mesh extraction =="
CACHED_URDF="$APP_DIR/public/robot/robot.urdf"
if [ -f "$CACHED_URDF" ] && [ "$FORCE_EXTRACT_URDF" = false ]; then
  echo "Found existing $CACHED_URDF — skipping extraction."
  echo "(pass --force-extract-urdf to re-extract, e.g. after a real hardware change)"
else
  if ! command -v ros2 >/dev/null 2>&1; then
    # rosject shells often need this sourced explicitly (see CLAUDE.md)
    source /opt/ros/humble/setup.bash 2>/dev/null || true
  fi
  if command -v ros2 >/dev/null 2>&1 && ros2 topic echo /robot_description --once --timeout 3 >/dev/null 2>&1; then
    python3 "$WEBPAGE_WS_DIR/scripts/extract_urdf.py"
  else
    echo "WARNING: /robot_description isn't being published (sim/real robot not up?)."
    echo "Skipping URDF extraction — run scripts/extract_urdf.py manually later"
    echo "once the simulation or real robot connection is up."
  fi
fi

echo
echo "== 3/3: npm install =="
cd "$APP_DIR"
npm install

echo
echo "Setup complete. Next, to view through webpage_address (port 7000, confirmed):"
echo "  cd app && PORT=7000 npm run build && PORT=7000 npm run preview"
echo "(npm run dev works for local/direct access only — not through the proxy,"
echo "see README.md for why.) Every new session, re-source scripts/session_init.sh first."