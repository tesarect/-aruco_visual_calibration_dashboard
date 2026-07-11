#!/usr/bin/env bash
# Prints the rosject's webpage_address URL, then runs whatever command was
# passed in. webpage_address is a shell alias (~/.bash_aliases), not
# resolvable from a non-interactive npm script context, so this
# reconstructs the same URL from its real input: $SLOT_PREFIX (see
# webpage_ws/README.md for the full nginx-proxy explanation).
#
# Usage: bash scripts/print_webpage_address.sh <command...>
set -uo pipefail

YELLOW='\033[1;33m'
NC='\033[0m'

if [ -n "${SLOT_PREFIX:-}" ]; then
  INSTANCE_ID="$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null)"
  if [ -n "$INSTANCE_ID" ]; then
    echo ""
    echo -e "  ${YELLOW}webpage_address: https://${INSTANCE_ID}.robotigniteacademy.com/${SLOT_PREFIX}/webpage/${NC}"
    echo ""
  else
    echo "(could not reach instance-id metadata endpoint — not in a rosject?)" >&2
  fi
else
  echo "(\$SLOT_PREFIX not set — not in a rosject?)" >&2
fi

exec "$@"