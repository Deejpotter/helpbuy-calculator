# Deployment and build notes

## Docker (recommended path)

A production Dockerfile ships with the repo: a multi-stage build that installs locked
dependencies, runs the type check and build in a `node:22-alpine` stage, then serves the
result from `nginx:1.27-alpine` with gzip, immutable caching for hashed assets and SPA-safe
routing (`nginx.conf` is copied in). A `.dockerignore` keeps the context to source only.

```bash
docker build -t helpbuy-calculator .
docker run --rm -p 8080:80 helpbuy-calculator   # http://localhost:8080
```

### Coolify

1. New resource, Build from Dockerfile, point it at the repository on main.
2. The exposed port is 80; attach your domain and TLS comes from the proxy.
3. Health: the nginx default config returns 200 on `/`, so the standard healthcheck works.

## Build

```bash
npm run build     # tsc --noEmit type check + vite build into dist/
npm run preview   # serve dist/ at http://localhost:4173
```

The production build is a single-page static app: no server code, no environment variables,
no runtime APIs beyond the browser (plus the optional reader relays for listing imports, which
the browser calls directly).

## Bundle (measured, current)

| File | Size on disk | Gzip |
| --- | --- | --- |
| dist/index.html | 1.0 kB | 0.6 kB |
| dist/assets/*.css | 18.8 kB | 5.0 kB |
| dist/assets/vendor-*.js (all dependencies, cached long-term) | 216.5 kB | 69.0 kB |
| dist/assets/index-*.js (app code) | 77.5 kB | 25.8 kB |
| dist/assets/AreaChecker-*.js (lazy: bundled official cap lookup) | 84.4 kB | 35.2 kB |
| Up-front JS (vendor + app) | 294.0 kB | 94.8 kB |

Vite splits `react` and `react-dom` into their own chunk (`manualChunks`), so app changes do
not bust the framework cache. Minification is esbuild, hashing blows away stale caches, and
index.html has an inline favicon (no extra request). Update this table after dependency
upgrades.

## Serving

Any static host works:

```nginx
# nginx sketch: gzip + immutable assets
gzip_types text/css application/javascript image/svg+xml;
location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
```

Enable gzip or brotli at the host. With brotli the main app chunk is around 27 kB and the
vendor chunk around 53 kB.

### Coolify

1. New resource, Build from Dockerfile or Public repository.
2. Point it at the repository, then either:
   - use a static-site build command `npm ci && npm run build` with the publish directory
     `dist`; or
   - a tiny nginx image that copies `dist/`.
3. Attach the domain, TLS comes from the proxy.
4. SPA note: routing is hash-free but single page; there are no client redirects to support,
   so a plain static server is enough.

### GitHub Pages (alternative)

The app mounts on a domain root, so for username.github.io/pages it needs a base path:
set `base: '/helpbuy-calculator/'` in `vite.config.ts`, rebuild, and publish `dist/` with the
Actions pages workflow or `npx gh-pages -d dist`. A custom domain keeps the default `/` base.

## Performance habits in the code

- No UI framework beyond React; charts are hand-rolled SVG; there are no chart or UI-kit
  dependencies to purge.
- Listing imports and localStorage writes are debounced-free but cheap; nothing blocks the
  main thread beyond one bundle parse on load.
- Fonts are the system stack: zero font requests.
- Animations are CSS-only and gated behind `prefers-reduced-motion`.
