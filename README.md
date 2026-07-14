# Visual Calibration — Web Dashboard

React/Vite dashboard for the visual_calibration project: rosbridge connection,
live URDF robot model, calibration/trajectory controls, log relay (Grafana as
a side track). Not a colcon package — plain npm-managed app, intended to move
under `ros2_ws/src/visual_calibration/` later.

**Must be run in the rosject** — this repo's local machine has no Node.js
installed and isn't a dev environment.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 20 LTS | Rosject ships Node v8 (too old for this stack) — installed separately via nvm under `$HOME`, see Setup below. |
| Package manager | npm | Bundled with Node 20. |
| Build tool / dev server | Vite 5 | `npm run build` + `npm run preview` for anything viewed through `webpage_address` — see note below on why not `npm run dev`. |
| UI framework | React 18 | Chosen over React 19 for ecosystem/shadcn maturity. |
| Component library | shadcn/ui | Not yet wired in — added when styling/control buttons need it. |
| ROS bridge client | roslib (npm package `roslib`, GitHub repo `roslibjs`) | Talks to `rosbridge_server` (already installed on the rosject) over the rosbridge v2 WebSocket protocol. |
| 3D rendering | three.js | Underlying WebGL engine for the robot model view. |
| URDF loader | urdf-loader | Replaces `ros3djs`/`ros3d` — that project is unmaintained, targets three.js APIs removed in r125+, and breaks under modern bundlers. |
| React/three.js glue | @react-three/fiber v8 | Matches React 18; lets the robot model be a normal React component tree. |
| Ops/monitoring (side track) | Grafana | Not yet started — planned to show the same controls/logs from a second surface, not a replacement for the in-page UI. |


## Setup (run in the rosject)

```bash
cd webpage_ws
./setup_rosject.sh
```

This installs Node 20 (via nvm, alongside the existing system Node), extracts
the live URDF + meshes from the running simulation (skipped if the sim isn't
up yet — rerun `npm run extract-urdf` from `app/` later), and `npm install`s
the app.

> [ Important ] For urdf to be generated wither simulation should be up and running or should be connected to Real robot environment. 

> [ Note ] setup_rosject.sh calls it once, only during that setup script, and only if public/robot/robot.urdf doesn't already exist (or pass --force-extract-urdf in as argument).

## Viewing through webpage_address (build + preview, not dev)

Every new rosject session loses Node/nvm state (non-persistent disk) — source
`scripts/session_init.sh` first, every time:

```bash
source ~/webpage_ws/scripts/session_init.sh
cd ~/webpage_ws/app
PORT=7000 npm run build
PORT=7000 npm run preview
```

Port `7000` is confirmed (by course instructor) as the port the rosject's
`webpage_address` nginx proxy forwards to — don't change it without
re-confirming.

Open `webpage_address`'s URL in a browser, and enter the rosbridge WebSocket
URL from `rosbridge_address` on the landing page (rosbridge itself must be
separately launched — see `sim_tmux_webstack.sh` — it does not start
automatically).

**Why build+preview, not `npm run dev`:** `webpage_address`'s public URL has
a `/<SLOT_PREFIX>/webpage/` path prefix, but nginx strips that prefix before
forwarding to the backend (confirmed by testing: a plain Node
`http.createServer` on port 7000 receives requests with path `/`, not the
prefixed path) — while the *browser* still needs that prefix preserved in
every asset URL it requests, since nginx only proxies paths under that
prefix. `base: "./"` in `vite.config.ts` (relative asset URLs, resolved by
the browser against the current page's full path) fixes this correctly for
built output. It does **not** fix it for `vite dev` — Vite's dev server
special-cases its own injected HMR scripts (`/@vite/client`,
`/@react-refresh`) as root-absolute regardless of `base`, a known Vite
limitation, so those 404 through this proxy in dev mode no matter what.
`npm run dev` still works for local/direct access (e.g.
`curl localhost:7000`), just not through `webpage_address`. Re-run
`npm run build` after each code change (no hot-reload); `npm run preview`
keeps serving the last build until you restart it.

Build order and scope rules for each step live in
`.claude/agents/roswebdev.md` at the project root. Progress is tracked in
the project's `progress.md`/`milestone.md`, not here.