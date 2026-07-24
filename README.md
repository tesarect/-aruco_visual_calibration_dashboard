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
./setup_rosject.sh --env sim   # or --env real
```

This installs Node 20 (via nvm, alongside the existing system Node) and
`npm install`s the app.

**URDF extraction is now one-time and committed, not re-derived every
session.** `setup_rosject.sh` only runs `extract_urdf.py` if
`app/public/robot/<env>/robot.urdf` doesn't exist yet — e.g. right after a
fresh clone. Once it exists, it's treated as the permanent, git-tracked
source of truth: no live-robot staleness check, no auto re-extraction, and
setup succeeds even with no robot connection at all.

> [ Important ] The very first extraction for a given env still needs
> either the simulation up and running or a connection to the real robot —
> if neither is available, setup skips extraction with a warning and the
> dashboard's 3D view stays blank for that env until you extract manually.

> [ Note ] To deliberately refresh an env's committed URDF later (e.g.
> after a real structural robot_description change), run
> `npm run extract-urdf:sim` or `:real` from `app/` yourself, confirm the
> output under `public/robot/<env>/`, then `git add`/`git commit` it —
> setup_rosject.sh will not overwrite or commit an existing file for you.

## Viewing through webpage_address (build + preview, not dev)

Every new rosject session loses Node/nvm state (non-persistent disk) — source
`scripts/session_init.sh` first, every time (see full command sequence
below).

Port `7000` is confirmed (by course instructor) as the only port the
rosject's `webpage_address` nginx proxy forwards to — don't change it
without re-confirming. **`npm run preview` no longer binds 7000 directly**
— it now binds Vite's own internal default (4173), and a small reverse
proxy (`npm run proxy`, see `scripts/proxy_server.mjs`) binds 7000 itself
and forwards:
- anything under `/jenkins` → Jenkins (internal port 8080)
- everything else → the Vite preview server on 4173

Jenkins has its own **independent** lifecycle now — it's not started by
this app at all, and it doesn't need this app's proxy to run pipelines
(only to be *viewable in a browser*, since the proxy is what exposes port
7000). Start it with the `startjenkins` alias
(`ros2_ws/src/visual_calibration/resources/jenkins/install_jenkins.sh`)
whenever you want it up — before, after, or without ever starting the web
app this session.

A fresh-session sequence for the dashboard side is:

```bash
source ~/webpage_ws/scripts/session_init.sh
cd ~/webpage_ws/app
npm run start        # build, then background preview (4173) + proxy (7000)
```

And, independently, whenever you want Jenkins up:

```bash
startjenkins          # binds internal port 8080, detached (survives tmux teardown)
```

Order between the two doesn't matter functionally. If you start the
dashboard's proxy before Jenkins, `/jenkins/` briefly 502s until Jenkins
comes up, then recovers on retry — same the other way around (the
dashboard just isn't reachable yet if only Jenkins is running).

Open `webpage_address`'s URL in a browser for the dashboard (once
`npm run start`'s proxy is up), and `webpage_address`'s URL + `/jenkins/`
for Jenkins (admin/admin — see install_jenkins.sh, once both Jenkins and
the proxy are up). Enter the rosbridge WebSocket URL from
`rosbridge_address` on the dashboard's landing page (rosbridge itself must
be separately launched — see `sim_tmux_webstack.sh` — it does not start
automatically).

If you need to override the default ports (e.g. to run the proxy locally
without Jenkins), the proxy script and `vite.config.ts` both honor env
vars: `PROXY_PORT` (default 7000), `VITE_INTERNAL_PORT` (default 4173,
read by both `vite.config.ts`'s preview block and the proxy), and
`JENKINS_INTERNAL_PORT` (default 8080, read by the proxy — set
`JENKINS_PORT` to the same value when invoking `install_jenkins.sh` if you
change it, so Jenkins actually binds where the proxy expects it).

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