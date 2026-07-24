#!/usr/bin/env bash
# Writes public/rosject-config.json — rosject-derived values the frontend
# fetches at runtime (not baked in at build time), since the rosject's
# instance id / SLOT_PREFIX change every session and shouldn't require a
# rebuild to pick up. Add new keys here as later steps need more values
# (e.g. webvideo_address for a camera feed panel).
#
# rosbridge_address/webpage_address are shell aliases (~/.bash_aliases),
# not resolvable from a non-interactive script context — reconstructed
# here from their real inputs (SLOT_PREFIX + the EC2 instance-id metadata
# endpoint) instead. Safe to re-run any time; run automatically before
# `npm run build`/`preview` (see package.json).
set -uo pipefail

YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_FILE="$SCRIPT_DIR/../public/rosject-config.json"

SLOT_PREFIX_VAL="${SLOT_PREFIX:-}"
INSTANCE_ID=""
if [ -n "$SLOT_PREFIX_VAL" ]; then
  INSTANCE_ID="$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null)"
fi

ROSBRIDGE_ADDRESS=""
WEBPAGE_ADDRESS=""
JENKINS_ADDRESS=""
if [ -n "$INSTANCE_ID" ]; then
  ROSBRIDGE_ADDRESS="wss://${INSTANCE_ID}.robotigniteacademy.com/${SLOT_PREFIX_VAL}/rosbridge/"
  WEBPAGE_ADDRESS="https://${INSTANCE_ID}.robotigniteacademy.com/${SLOT_PREFIX_VAL}/webpage/"
  # Matches install_jenkins.sh's own JENKINS_PREFIX/JENKINS_PUBLIC_URL
  # resolution exactly (same SLOT_PREFIX + instance-id inputs, same
  # "/webpage/jenkins" shape) — Jenkins is only reachable at this address
  # once BOTH it (startjenkins/startall) and this proxy are running.
  JENKINS_ADDRESS="https://${INSTANCE_ID}.robotigniteacademy.com/${SLOT_PREFIX_VAL}/webpage/jenkins/"
fi

mkdir -p "$(dirname "$OUT_FILE")"
cat > "$OUT_FILE" <<EOF
{
  "slotPrefix": "${SLOT_PREFIX_VAL}",
  "instanceId": "${INSTANCE_ID}",
  "rosbridgeAddress": "${ROSBRIDGE_ADDRESS}",
  "webpageAddress": "${WEBPAGE_ADDRESS}",
  "jenkinsAddress": "${JENKINS_ADDRESS}"
}
EOF

echo "Wrote $OUT_FILE"
if [ -n "$WEBPAGE_ADDRESS" ]; then
  echo ""
  echo -e "  ${YELLOW}webpage_address: ${WEBPAGE_ADDRESS}${NC}"
  echo -e "  ${YELLOW}jenkins address: ${JENKINS_ADDRESS}${NC}"
  echo ""
else
  echo "(empty values — \$SLOT_PREFIX not set or metadata endpoint unreachable; not in a rosject?)" >&2
fi