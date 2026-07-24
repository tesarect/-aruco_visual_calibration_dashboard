#!/usr/bin/env bash
# One-shot setup for the visual_calibration web dashboard, run inside the
# (fresh, ephemeral) rosject. Idempotent — safe to re-run.
#
# Usage:
#   cd webpage_ws
#   ./setup_rosject.sh --env sim|real
#
# What it does:
#   1. Loads nvm (already present on the rosject, just unsourced) and
#      installs/activates Node 20 LTS, without touching the existing
#      system Node v8 install used by other tooling.
#   2. Extracts the live URDF (+ meshes) from the running sim/real robot
#      via scripts/extract_urdf.py --env <env>, into app/public/robot/<env>/
#      — ONLY if that env's robot.urdf doesn't exist yet (e.g. right after
#      a fresh clone, before it's ever been extracted). The committed file
#      is treated as the permanent source of truth once it exists: no
#      live-robot staleness re-check, no re-extraction, regardless of
#      whether ROS/the robot is up. Sim (RG2 gripper) and real (Robotiq 85
#      gripper) have structurally different kinematic chains, so each env
#      is extracted and tracked separately — running --env sim does NOT
#      also cover real, and vice versa. The dashboard auto-detects which
#      one to load at runtime from /joint_states (see
#      app/src/useRobotEnv.ts), so both trees can coexist.
#      To deliberately refresh an already-extracted env (e.g. after a real
#      structural robot_description change), run
#      `npm run extract-urdf:sim` / `:real` manually from app/, then
#      git-commit the updated files yourself — this script will not do
#      either of those for you once the file exists.
#   3. npm installs the React/Vite app under app/.
# Before any of the above, kills stale proxy/vite-preview processes that
# might be left over from a prior session/attempt and still holding ports
# 7000/4173 (see scripts/stop_stale.sh) — makes this safe to re-run after
# a rosject restart, not just on a pristine one.
#
# Jenkins is NOT installed/started here — it has its own standalone
# lifecycle now (see the `startjenkins` alias / install_jenkins.sh),
# because Jenkins triggers ROS nodes/sim/trajectory/Zenoh itself via
# pipeline stages and must be startable independent of whether the web
# dashboard is touched this session at all.
set -euo pipefail

ROBOT_ENV=""
while [ $# -gt 0 ]; do
  case "$1" in
    --env)
      shift
      ROBOT_ENV="$1"
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [ "$ROBOT_ENV" != "sim" ] && [ "$ROBOT_ENV" != "real" ]; then
  echo "Usage: ./setup_rosject.sh --env sim|real" >&2
  exit 1
fi

WEBPAGE_WS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$WEBPAGE_WS_DIR/app"

bash "$WEBPAGE_WS_DIR/scripts/stop_stale.sh"

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
echo "== 2/3: URDF + mesh extraction (env=$ROBOT_ENV) =="
CACHED_URDF="$APP_DIR/public/robot/$ROBOT_ENV/robot.urdf"

if [ -f "$CACHED_URDF" ]; then
  echo "Found committed $CACHED_URDF — skipping extraction (treated as the"
  echo "permanent source of truth; re-extract manually via"
  echo "'npm run extract-urdf:$ROBOT_ENV' if you deliberately want to refresh it)."
else
  echo "$CACHED_URDF not found — attempting a one-time extraction..."
  if ! command -v ros2 >/dev/null 2>&1; then
    # rosject shells often need this sourced explicitly (see CLAUDE.md)
    source /opt/ros/humble/setup.bash 2>/dev/null || true
  fi
  ROS_UP=false
  # Wrapped in the `timeout` coreutil (not a ros2 flag) — some ros2cli builds
  # don't accept `--timeout` on `topic echo` at all (confirmed via `ros2
  # topic echo --help`: no such option on this distro), which made this
  # check always report ROS as down even when /robot_description was
  # genuinely live and `ros2 topic echo /robot_description --once` worked
  # fine run by hand.
  if command -v ros2 >/dev/null 2>&1 && timeout 3 ros2 topic echo /robot_description --once >/dev/null 2>&1; then
    ROS_UP=true
  fi

  if [ "$ROS_UP" = true ]; then
    python3 "$WEBPAGE_WS_DIR/scripts/extract_urdf.py" --env "$ROBOT_ENV"
  else
    echo "WARNING: /robot_description isn't being published (sim/real robot not up?)."
    echo "Skipping URDF extraction — run 'npm run extract-urdf:$ROBOT_ENV' manually later"
    echo "once the simulation or real robot connection is up, then git-commit the result."
  fi
fi

echo
echo "== 3/3: 🕸️ npm install =="
cd "$APP_DIR"
npm install

echo
echo "Setup complete. Next, to view through webpage_address (port 7000, confirmed):"
echo "  cd app && npm run start"
echo "(npm run dev works for local/direct access only — not through the proxy,"
echo "see README.md for why.) Every new session, re-source scripts/session_init.sh first."
echo
echo "Jenkins is separate — run 'startjenkins' whenever you want it up (works"
echo "standalone; /jenkins/ only becomes browser-reachable once the proxy above"
echo "is also running)."
