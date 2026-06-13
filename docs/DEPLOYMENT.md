# Deployment

This is a step-by-step runbook for deploying Kanji Flash to **Vercel** and putting it on
a custom domain **bought through Vercel**. Follow it in order.

## Why Vercel's Vite defaults just work

Kanji Flash is a plain Vite SPA, so Vercel's built-in **Vite** preset is all you need:

| Setting | Value |
|---------|-------|
| Framework Preset | **Vite** |
| Build Command | **`npm run build`** |
| Output Directory | **`dist`** |

You don't need a `vercel.json` **for routing**: this app has **no client-side router**
(it switches screens from in-memory state, not URL paths), so there are **no SPA
rewrite rules to add** — every request just serves the static build.

This repo **does** ship a `vercel.json` anyway, for a different reason: to set a
**Content-Security-Policy and security headers** on every response (defense-in-depth,
clickjacking protection, MIME-sniffing protection). See
[Security headers & CSP](#security-headers--csp) below. Vercel applies the `headers`
block automatically — no extra setup in the dashboard.

## What deploys

Running `npm run build` does three things, in order:

1. **`tsc --noEmit`** — type-checks the whole project (the build fails if types don't
   pass).
2. **`vite build`** — bundles the app into `dist/`.
3. **vite-plugin-pwa** — generates the service worker (`sw.js`) and the web app manifest
   (`manifest.webmanifest`) into `dist/`, precaching the app shell and `cards.json` so the
   app works offline.

Vercel runs this exact command, so the deployed build is the same one you'd get locally.

## Security headers & CSP

`vercel.json` attaches these headers to **every route** (`source: "/(.*)"`):

- **`Content-Security-Policy`** — the core lock-down. `default-src 'self'` denies
  everything by default, then we re-allow exactly what the app needs:
  - `script-src 'self'` — both bundled scripts are external same-origin, so **no
    `'unsafe-inline'`** is needed for scripts.
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` — React's inline
    `style={{...}}` attributes require `'unsafe-inline'`; the Google Fonts stylesheet
    loads from `fonts.googleapis.com`.
  - `font-src 'self' https://fonts.gstatic.com` — the actual font files.
  - `img-src 'self' data:` — same-origin icons/favicon plus `data:` URIs.
  - `connect-src 'self'` — the app makes no external fetch/XHR calls.
  - `worker-src 'self'` / `manifest-src 'self'` — the Workbox service worker and PWA
    manifest are same-origin.
  - `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`,
    `frame-ancestors 'none'`, `upgrade-insecure-requests` — standard hardening.
- **`X-Frame-Options: DENY`** + `frame-ancestors 'none'` — block clickjacking (no
  embedding in iframes).
- **`X-Content-Type-Options: nosniff`** — stop MIME-type sniffing.
- **`Referrer-Policy: strict-origin-when-cross-origin`** — trim referrer leakage.
- **`Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`**
  — the app needs none of these capabilities, so deny them.

### Post-deploy verification

After the **first** deploy, open the production site and confirm the CSP didn't break
anything:

1. **Service worker still registers** — DevTools → **Application → Service Workers**;
   it should show an activated worker for the origin.
2. **Google Fonts still load** — the **Console** has **no CSP violation** warnings, and
   text renders in the intended font.
3. **Headers are present** — run `curl -I https://<domain>` and confirm the response
   includes both `Content-Security-Policy` and `X-Frame-Options`.

If the service worker or fonts break, the **Console** names the **blocked directive**
(e.g. `Refused to load … because it violates … "font-src"`). Add the reported origin to
that directive in `vercel.json` and redeploy.

## Runbook: deploy + Vercel-registered domain

### 1. Import the project

1. Go to **https://vercel.com/new** and import your GitHub fork of this repo.
2. Verify the three settings Vercel auto-detects:
   - Framework Preset → **Vite**
   - Build Command → **`npm run build`**
   - Output Directory → **`dist`**
3. Deploy. Confirm the first production deploy from the **`main`** branch finishes
   **green** (Vercel marks the deployment "Ready").

### 1a. Continuous deployment (merge to `main` → live)

This is automatic with Vercel's GitHub integration — no repo config or `vercel.json`
change is needed:

- **Every push/merge to `main` → a production deployment** to your live URL (and the
  custom domain once attached).
- **Pushes to other branches and pull requests → preview deployments** at their own
  throwaway URLs, so you can check a change before it reaches production.

To confirm the wiring after the first deploy: **Project → Settings → Git** and verify
**Production Branch = `main`** and that the GitHub connection is connected. That single
setting is what makes "merge to `main`" publish the site. (If you ever want to pause
auto-deploys, toggle it there or use a `vercel.json` `git.deploymentEnabled` rule.)

### 2. Buy the domain through Vercel

1. In the project, open **Settings → Domains** (or the **Domains** tab) and choose
   **"Buy a domain"**.
2. Search for and purchase the domain you want.

Because the domain is registered **with Vercel**, Vercel manages its nameservers and DNS
for you **automatically**. There are **no external A or CNAME records to add**, and **no
third-party registrar step**. State this to yourself plainly so you don't go hunting for
DNS values that simply don't apply to a Vercel-registered domain.

### 3. What Vercel does automatically once the domain is attached

- **Provisions both hosts** — the apex (`example.com`) and `www` (`www.example.com`).
- **Offers the recommended redirect** in the Domains UI so you can pick **one canonical
  host** (apex-or-`www`). Choose whichever you prefer and let Vercel redirect the other.
- **Issues HTTPS certificates automatically**, usually within a minute or two.

**How to confirm it's working:** in the Domains panel the domain shows **"Valid
Configuration"**, and the **padlock resolves on both hosts** (apex and `www`) in a
browser.

### 4. Cost / footgun note

A Vercel-registered domain is a **paid yearly registration** — separate from the free
Hobby hosting tier — and it **auto-renews**. Treat buying it as a deliberate purchase,
and check the renewal terms so you're not surprised next year.

## Optional: the CLI path

You can also deploy from your terminal:

```bash
npm i -g vercel
vercel link      # link the local folder to the Vercel project
vercel --prod    # build and deploy to production
```

Note: **buying a domain is dashboard-only.** The CLI deploys the app but cannot purchase
domains — do step 2 above in the Vercel web UI.

## After the domain is live: re-test the PWA

The PWA **install / add-to-home-screen** prompt only appears on the **production HTTPS
URL** (a secure origin). So once the custom domain resolves and the certificate has
issued, open the site on the real domain and **re-test add-to-home-screen** on a phone to
confirm the installable PWA works end to end.
