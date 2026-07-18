#!/usr/bin/env bash
# One-shot setup for the visual_calibration web dashboard, run inside the
# (fresh, ephemeral) rosject. Idempotent — safe to re-run.
#
# Usage:
#   cd webpage_ws
#   ./setup_rosject.sh --env sim|real [--force-extract-urdf]
#
# What it does:
#   1. Loads nvm (already present on the rosject, just unsourced) and
#      installs/activates Node 20 LTS, without touching the existing
#      system Node v8 install used by other tooling.
#   2. Extracts the live URDF (+ meshes) from the running sim/real robot
#      via scripts/extract_urdf.py --env <env>, into app/public/robot/<env>/
#      — SKIPPED if that env's robot.urdf already exists AND its cached
#      /robot_description hash still matches the live one (auto-detected
#      via extract_urdf.py --check-stale, so a structural robot_description
#      change — e.g. an SRDF chain edit like 2026-07-18's real tip_link
#      change — triggers a fresh extraction automatically, without needing
#      to remember --force-extract-urdf by hand). Sim (RG2 gripper) and
#      real (Robotiq 85 gripper) have structurally different kinematic
#      chains, so each env is extracted and cached separately — running
#      --env sim does NOT also cover real, and vice versa. The dashboard
#      auto-detects which one to load at runtime from /joint_states (see
#      app/src/useRobotEnv.ts), so both trees can coexist; you only need
#      ROS up for the one you're about to test.
#      Pass --force-extract-urdf to re-extract unconditionally (skips the
#      staleness check entirely). Skipped with a warning if ROS/the sim
#      isn't up yet and no cached file exists either.
#   3. npm installs the React/Vite app under app/.
set -euo pipefail

FORCE_EXTRACT_URDF=false
ROBOT_ENV=""
while [ $# -gt 0 ]; do
  case "$1" in
    --force-extract-urdf)
      FORCE_EXTRACT_URDF=true
      ;;
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
  echo "Usage: ./setup_rosject.sh --env sim|real [--force-extract-urdf]" >&2
  exit 1
fi

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
echo "== 2/3: URDF + mesh extraction (env=$ROBOT_ENV) =="
CACHED_URDF="$APP_DIR/public/robot/$ROBOT_ENV/robot.urdf"

if ! command -v ros2 >/dev/null 2>&1; then
  # rosject shells often need this sourced explicitly (see CLAUDE.md)
  source /opt/ros/humble/setup.bash 2>/dev/null || true
fi
ROS_UP=false
# Wrapped in the `timeout` coreutil (not a ros2 flag) — some ros2cli builds
# don't accept `--timeout` on `topic echo` at all (confirmed via `ros2 topic
# echo --help`: no such option on this distro), which made this check always
# report ROS as down even when /robot_description was genuinely live and
# `ros2 topic echo /robot_description --once` worked fine run by hand.
if command -v ros2 >/dev/null 2>&1 && timeout 3 ros2 topic echo /robot_description --once >/dev/null 2>&1; then
  ROS_UP=true
fi

NEED_EXTRACT=true
if [ -f "$CACHED_URDF" ] && [ "$FORCE_EXTRACT_URDF" = false ]; then
  if [ "$ROS_UP" = true ]; then
    if python3 "$WEBPAGE_WS_DIR/scripts/extract_urdf.py" --env "$ROBOT_ENV" --check-stale; then
      echo "Found existing $CACHED_URDF, matches the live robot_description — skipping extraction."
      NEED_EXTRACT=false
    else
      echo "Found existing $CACHED_URDF, but robot_description has changed — re-extracting."
    fi
  else
    # Can't check staleness without ROS up — trust the cache rather than
    # blocking setup on a robot connection that isn't there right now.
    echo "Found existing $CACHED_URDF — skipping extraction (ROS not up to check staleness)."
    NEED_EXTRACT=false
  fi
fi

if [ "$NEED_EXTRACT" = true ]; then
  if [ "$ROS_UP" = true ]; then
    python3 "$WEBPAGE_WS_DIR/scripts/extract_urdf.py" --env "$ROBOT_ENV"
  else
    echo "WARNING: /robot_description isn't being published (sim/real robot not up?)."
    echo "Skipping URDF extraction — run 'npm run extract-urdf:$ROBOT_ENV' manually later"
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