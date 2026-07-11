#!/usr/bin/env bash
# Source this at the start of every new rosject session (add to
# sim_tmux_main3.sh / your aliases). Idempotent — safe to source repeatedly.
# Makes sure Node 20 (via nvm) is actually active in THIS shell — nvm
# installing Node once does NOT persist across new shells/sessions on
# non-persistent disk; `nvm alias default` only changes what NEW shells
# pick up automatically, and even that requires nvm.sh to be sourced by
# the shell's rc file, which may not have happened yet in a fresh tmux
# pane depending on how it was spawned.
#
# Usage:
#   source ~/webpage_ws/scripts/session_init.sh
# or, non-interactively (e.g. from another script):
#   bash -c 'source ~/webpage_ws/scripts/session_init.sh && exec npm run dev'

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "[session_init] This script must be SOURCED, not run — it sets env vars" >&2
  echo "[session_init] (PATH, NVM_DIR, ROS_DISTRO) that only persist in the shell" >&2
  echo "[session_init] that sources it. Run instead: source ${BASH_SOURCE[0]}" >&2
  exit 1
fi

export NVM_DIR="$HOME/.nvm"

if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "[session_init] nvm missing at $NVM_DIR — installing (disk was reset)" >&2
  curl -s -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash >/dev/null 2>&1
fi

# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"

if ! nvm ls 20 >/dev/null 2>&1; then
  echo "[session_init] Node 20 missing under nvm — installing (disk was reset)" >&2
  nvm install 20 >/dev/null 2>&1
fi

nvm use 20 >/dev/null 2>&1
nvm alias default 20 >/dev/null 2>&1

echo "[session_init] node $(node --version), npm $(npm --version)"

# ROS 2 env — harmless if already sourced. rosbridge itself is NOT started
# here (that's sim_tmux_main3.sh's job, alongside the rest of the sim).
if ! command -v ros2 >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source /opt/ros/humble/setup.bash 2>/dev/null
fi
echo "[session_init] ROS_DISTRO=${ROS_DISTRO:-not set}"

# app/ itself lives under ~/webpage_ws, which persists across sessions, so
# this is normally a fast no-op — only does real work if node_modules is
# actually missing (fresh disk) or package.json changed since last install.
APP_DIR="$HOME/webpage_ws/app"
if [ -d "$APP_DIR" ]; then
  if [ ! -d "$APP_DIR/node_modules" ]; then
    echo "[session_init] node_modules missing — running npm install (disk was reset?)" >&2
  fi
  (cd "$APP_DIR" && npm install --silent)
fi