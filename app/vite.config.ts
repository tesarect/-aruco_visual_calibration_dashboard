import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The Construct's rosject exposes this app through its own nginx proxy, on
// a port confirmed by the course instructor to be 7000 (see webpage_ws
// README). webpage_address's public URL has a /<rosject-uuid>/webpage/
// path prefix, but nginx STRIPS that prefix before forwarding to the
// backend (confirmed by testing: a plain Node http server on port 7000
// receives requests with path "/", not the prefixed path) — so Vite's
// `base` must NOT be set to that prefix (doing so 302-loops the dev
// server against nginx, since Vite then expects incoming requests to
// already carry a prefix nginx has already stripped).
//
// But the BROWSER still loads the page at the full prefixed URL, so
// asset references need to resolve relative to that, not to the domain
// root. `base: "/"` (the default) emits root-absolute asset URLs
// (e.g. "/src/main.tsx"), which the browser resolves against the domain
// root — losing the prefix entirely and 404ing. `base: "./"` (relative)
// emits relative asset URLs instead, which the browser resolves relative
// to the current page's full path (prefix included) — independent of
// whatever nginx does server-side.
//
// IMPORTANT: this only works with `vite build` + `vite preview`, not
// `vite dev`. Vite's dev server special-cases its own injected HMR
// scripts (/@vite/client, /@react-refresh) as root-absolute regardless
// of `base` — a known limitation, not a misconfiguration — so dev mode
// still 404s behind this prefix-stripping proxy even with base:"./" set
// correctly. Use `npm run build && npm run preview` for anything viewed
// through webpage_address; `npm run dev` only works for local/direct
// access (e.g. curl localhost:7000), not through the rosject proxy.
const PORT = Number(process.env.PORT) || 5173;

// `npm run preview` (vite preview) no longer binds the externally-reachable
// port directly — see scripts/proxy_server.mjs, which now owns port 7000
// and forwards non-/jenkins traffic here. Vite's own preview default
// (4173) is used unless VITE_INTERNAL_PORT overrides it, so this stays an
// internal-only port bound to this same host (127.0.0.1/0.0.0.0 depending
// on `host: true` below — either way, only reachable from the proxy
// process running on the same machine, not from outside the rosject).
const PREVIEW_PORT = Number(process.env.VITE_INTERNAL_PORT) || 4173;

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    // Matches tsconfig.json's paths — required by shadcn/ui's generated
    // components (they import via "@/lib/utils" etc.).
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: PORT,
    strictPort: true,
    // The rosject's nginx proxy rewrites the Host header to its own public
    // *.robotigniteacademy.com domain before forwarding here. Vite 5
    // rejects/redirects requests whose Host doesn't match what it expects
    // unless explicitly allowed — this is a dev-only sandboxed rosject, so
    // allow any host rather than hardcoding the per-instance domain.
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: PREVIEW_PORT,
    strictPort: true,
    allowedHosts: true,
  },
});