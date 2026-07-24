#!/usr/bin/env bash
# Convenience wrapper: brings up Jenkins AND the web dashboard together,
# in the correct order, in one command — for when you want both, right
# now, without remembering the individual steps.
#
# Does NOT replace their independent lifecycles: `startjenkins` alone and
# `npm run start` alone (from webpage_ws/app) still work on their own,
# any order, same as before. This script exists purely because getting
# both running correctly requires them to agree on the same resolved
# SLOT_PREFIX-derived path prefix (see install_jenkins.sh and
# app/scripts/proxy_server.mjs's own comments for why that matters) — as
# long as SLOT_PREFIX doesn't change mid-session (it doesn't), running
# them separately in any order also works fine; this is convenience, not
# a correctness requirement.
#
# Usage:
#   cd webpage_ws
#   ./start_all.sh --env sim|real
set -euo pipefail

WEBPAGE_WS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JENKINS_INSTALL_SCRIPT="$WEBPAGE_WS_DIR/../ros2_ws/src/visual_calibration/resources/jenkins/install_jenkins.sh"

echo "== 1/2: Jenkins install/start =="
if [ -f "$JENKINS_INSTALL_SCRIPT" ]; then
  bash "$JENKINS_INSTALL_SCRIPT"
else
  echo "WARNING: install_jenkins.sh not found at $JENKINS_INSTALL_SCRIPT — skipping Jenkins."
fi

echo
echo "== 2/2: Web dashboard (setup + build + preview + proxy) =="
bash "$WEBPAGE_WS_DIR/setup_rosject.sh" "$@"
cd "$WEBPAGE_WS_DIR/app"
npm run start

echo
echo "Done. Dashboard + Jenkins both live behind webpage_address (port 7000)."
