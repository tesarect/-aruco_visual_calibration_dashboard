#!/usr/bin/env bash
# Reverses setup_rosject.sh: removes the user-writable nvm + Node 20 it
# installed under $HOME, and the app's node_modules/build output. Does NOT
# touch the pre-existing system Node v8 (/usr/local/share/shell/.nvm) or any
# ROS/rosbridge packages — those were never modified by setup.
#
# Usage:
#   cd webpage_ws
#   ./uninstall_rosject.sh
set -uo pipefail

WEBPAGE_WS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$WEBPAGE_WS_DIR/app"

echo "This will remove:"
echo "  - \$HOME/.nvm (user-writable nvm + Node 20, installed by setup_rosject.sh)"
echo "  - $APP_DIR/node_modules"
echo "  - $APP_DIR/dist (build output, if present)"
echo "  - $WEBPAGE_WS_DIR/app/public/robot (extracted URDF + meshes, if present)"
echo
echo "It will NOT touch:"
echo "  - /usr/local/share/shell/.nvm (pre-existing system Node v8)"
echo "  - ROS 2 / rosbridge_suite packages"
echo "  - Source files (App.tsx, package.json, scripts, etc.)"
echo
read -r -p "Proceed? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

if [ -d "$HOME/.nvm" ]; then
  echo "Removing $HOME/.nvm ..."
  rm -rf "$HOME/.nvm"
else
  echo "$HOME/.nvm not present, skipping."
fi

if [ -d "$APP_DIR/node_modules" ]; then
  echo "Removing $APP_DIR/node_modules ..."
  rm -rf "$APP_DIR/node_modules"
fi

if [ -d "$APP_DIR/dist" ]; then
  echo "Removing $APP_DIR/dist ..."
  rm -rf "$APP_DIR/dist"
fi

if [ -d "$APP_DIR/public/robot" ]; then
  echo "Removing $APP_DIR/public/robot (extracted URDF + meshes) ..."
  rm -rf "$APP_DIR/public/robot"
fi

echo
echo "Also check your shell rc files (~/.bashrc, ~/.profile, ~/.zshrc) for an"
echo "nvm-sourcing block the installer may have appended, e.g.:"
echo '  export NVM_DIR="$HOME/.nvm"'
echo '  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
echo "Remove it manually if present, then open a new shell so node/npm fall"
echo "back to whatever was active before (system Node v8, if nothing else)."
echo
echo "Done. Re-run ./setup_rosject.sh any time to reinstall."