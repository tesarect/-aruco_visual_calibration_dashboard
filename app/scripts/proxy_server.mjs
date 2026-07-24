// Reverse proxy binding the ONE externally-reachable port (7000) and
// splitting traffic between the dashboard (Vite preview) and Jenkins,
// both of which move to internal-only ports so neither is directly
// reachable from outside this proxy.
//
// Why a Node script + `http-proxy` (not local nginx):
//   This app is already an npm-managed Node project (see package.json) —
//   adding one small, already-npm-installed dependency keeps setup to
//   "npm install" + one script, with no second package manager/service
//   (nginx isn't confirmed present on a fresh rosject image, and even if
//   installed, managing its config/reload lifecycle is more moving parts
//   than a ~50-line script that dies with the shell/tmux pane like every
//   other process in this project's session model). `http-proxy` (not
//   `http-proxy-middleware`) chosen specifically because it has zero
//   Express dependency — this doesn't need routing middleware, just a
//   path-prefix if/else and two proxy targets.
//
// Path-rewriting, and why it's needed (root-caused after several failed
// attempts — see install_jenkins.sh's own comments for the full story):
//   The platform's OWN nginx (in front of this proxy) strips
//   "/<SLOT_PREFIX>/webpage/" before a request ever reaches us — so what
//   WE receive for a Jenkins-bound request is just the short
//   "/jenkins/..." path. But Jenkins is now launched (see
//   install_jenkins.sh) with --prefix set to the FULL external path
//   ("/<SLOT_PREFIX>/webpage/jenkins") — because Jenkins builds its own
//   redirects/asset URLs from its OWN servlet context path, not from
//   X-Forwarded-Prefix or JenkinsLocationConfiguration (both tried first;
//   neither actually affects the redirect Jenkins itself issues, confirmed
//   live via curl and browser). That means Jenkins now only responds to
//   requests whose path starts with that FULL prefix — so this proxy must
//   RE-ADD the "/<SLOT_PREFIX>/webpage" segment the platform nginx already
//   stripped, when (and only when) forwarding to Jenkins. Vite preview
//   needs no such rewrite — it never sees a prefix at all (base:"./" makes
//   its asset URLs resolve relative to whatever page path the browser is
//   already on, so it doesn't care what prefix the browser used to get
//   there).
//
// Routing:
//   /jenkins, /jenkins/*  -> http://127.0.0.1:JENKINS_PORT, with the path
//                            rewritten to "/<SLOT_PREFIX>/webpage" + the
//                            original path before forwarding.
//   everything else       -> http://127.0.0.1:VITE_PORT (Vite preview),
//                            path unchanged.
//
// Both upstream ports are internal-only (bound to 127.0.0.1) — only this
// proxy's PUBLIC_PORT (7000) is meant to be reachable from the platform
// nginx in front of it.
import http from "node:http";
import httpProxy from "http-proxy";

const PUBLIC_PORT = Number(process.env.PROXY_PORT) || 7000;
const VITE_PORT = Number(process.env.VITE_INTERNAL_PORT) || 4173;
const JENKINS_PORT = Number(process.env.JENKINS_INTERNAL_PORT) || 8080;

const viteTarget = `http://127.0.0.1:${VITE_PORT}`;
const jenkinsTarget = `http://127.0.0.1:${JENKINS_PORT}`;

// Must match install_jenkins.sh's own JENKINS_PREFIX resolution exactly —
// same SLOT_PREFIX env var, same EC2 instance-metadata-derived shape
// ("/<SLOT_PREFIX>/webpage/jenkins"), same "/jenkins" fallback when
// SLOT_PREFIX isn't available (e.g. not actually in a rosject). Only
// SLOT_PREFIX is needed here (not the instance ID / full https:// URL
// install_jenkins.sh also resolves) since this only rewrites a REQUEST
// PATH, not a redirect Location — no host/scheme involved.
const SLOT_PREFIX = process.env.SLOT_PREFIX || "";
const JENKINS_PREFIX = SLOT_PREFIX ? `/${SLOT_PREFIX}/webpage/jenkins` : "/jenkins";
if (!SLOT_PREFIX) {
  console.warn(
    "[proxy] SLOT_PREFIX not set — Jenkins requests will be forwarded with " +
      "their path unchanged (plain /jenkins), which only works if Jenkins " +
      "was ALSO launched with --prefix=/jenkins (i.e. install_jenkins.sh " +
      "also couldn't resolve SLOT_PREFIX this run). If the two scripts " +
      "resolved different values, Jenkins requests will 404.",
  );
} else {
  console.log(`[proxy] SLOT_PREFIX=${SLOT_PREFIX}`);
}
console.log(`[proxy] Jenkins requests rewritten to path prefix: ${JENKINS_PREFIX}`);

const proxy = httpProxy.createProxyServer({
  // xfwd adds X-Forwarded-* headers (For/Proto/Host) — kept for general
  // reverse-proxy hygiene (e.g. Jenkins logging the real client IP), even
  // though the specific redirect bug this file used to work around turned
  // out to need the path-rewrite above instead, not a forwarded header.
  xfwd: true,
  ws: true,
});

proxy.on("error", (err, _req, res) => {
  console.error("[proxy] upstream error:", err.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { "Content-Type": "text/plain" });
  }
  if (res && res.writeable !== false) {
    res.end(`Bad gateway: ${err.message}`);
  }
});

function isJenkinsRequest(req) {
  return req.url === "/jenkins" || req.url.startsWith("/jenkins/");
}

function targetFor(req) {
  return isJenkinsRequest(req) ? jenkinsTarget : viteTarget;
}

// Rewrite the path for Jenkins-bound requests BEFORE proxying: strip the
// short "/jenkins" this proxy matched on and replace it with the FULL
// prefix Jenkins was actually launched with (see header comment). Vite
// preview requests pass through with their path untouched.
function rewritePathForTarget(req) {
  if (isJenkinsRequest(req) && JENKINS_PREFIX !== "/jenkins") {
    req.url = JENKINS_PREFIX + req.url.slice("/jenkins".length);
  }
}

const server = http.createServer((req, res) => {
  const target = targetFor(req);
  rewritePathForTarget(req);
  proxy.web(req, res, { target });
});

// Jenkins (Blue Ocean especially) relies on WebSocket upgrades for live
// log streaming — forward upgrade requests the same way as normal HTTP,
// including the same path rewrite.
server.on("upgrade", (req, socket, head) => {
  const target = targetFor(req);
  rewritePathForTarget(req);
  proxy.ws(req, socket, head, { target });
});

server.listen(PUBLIC_PORT, () => {
  console.log(`[proxy] listening on 0.0.0.0:${PUBLIC_PORT}`);
  console.log(`[proxy]   /jenkins*  -> ${jenkinsTarget}${JENKINS_PREFIX}*`);
  console.log(`[proxy]   everything else -> ${viteTarget}`);
});
