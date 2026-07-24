#!/usr/bin/env bash
# Kills stale/orphaned processes that might already be holding the ports
# THIS WEB STACK needs (7000 proxy, 4173 vite preview) — left over from a
# previous session/attempt that wasn't cleanly killed, or from a rosject
# restart where tmux died but a background/nohup'd process it started did
# not. Safe to run any time, including on a pristine rosject with nothing
# running yet (every pkill below is allowed to match nothing).
#
# Does NOT touch Jenkins (port 8080) — Jenkins has its own independent
# lifecycle now (see install_jenkins.sh / the `startjenkins` alias) and is
# deliberately meant to keep running regardless of what happens to the web
# app, including across repeated `npm run start`/setup_rosject.sh calls.
# This script used to also pkill Jenkins here; that silently killed a
# supposedly-independent, `setsid`-detached Jenkins every time the web app
# restarted, which defeats the whole point of decoupling it — removed.
#
# Usage: bash stop_stale.sh
# Called automatically by setup_rosject.sh and package.json's `start`
# script — not normally something you need to run by hand.
set +e

echo "[stop_stale] Cleaning up any stale dashboard/proxy processes..."

# proxy_server.mjs's own script filename is unique and always appears
# verbatim in its process argv ("node .../scripts/proxy_server.mjs") — a
# specific, reliable pkill -f target.
pkill -f "proxy_server.mjs" 2>/dev/null

# `npm run preview` (see app/package.json) resolves to the `vite` binary
# invoked with the literal argument "preview" — ps/argv shows this as
# e.g. ".../node_modules/.bin/vite preview", so "vite preview" matches
# reliably without also catching `vite build` or plain `vite` (dev).
pkill -f "vite preview" 2>/dev/null

echo "[stop_stale] Done (any 'no process found' above is expected/harmless)."
exit 0
