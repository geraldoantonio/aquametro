# AGENTS.md — Instructions for AI agents

Guide for AIs working in this repository. Read before editing.

## What it is

Aquametro is a **single-page PWA** for tracking water consumption across a utility
billing cycle. It runs **100% in the browser**, with no back-end and no build step.
Data is persisted in `localStorage`. Product and deploy details are in `README.md`
(the README is written in Portuguese and stays that way).

## Stack and principles

- **Plain HTML, CSS and JavaScript (vanilla)**. Do not introduce frameworks,
  libraries, bundlers, npm, or external dependencies — the "no build" simplicity is
  intentional.
- All published source lives in `src/`. There is no build: what is in `src/` is
  exactly what ships to production.

## Language rules (important)

- **All code and code comments must be written in English** — identifiers, function
  names, comments, commit messages, and this file included.
- **All on-screen text must go through translation keys**, never hardcoded strings.
  Add the key to `src/js/i18n.js` and render it with `t("some.key", { vars })`. The
  product language is Portuguese (pt-BR), provided as translations under that key —
  so the strings live in the i18n dictionary, not in the code.
- The `README.md` is the one exception: it may remain in Portuguese.

## Structure

```
src/
├── index.html              # Page shell (#app, #modal, #install); loads i18n.js then app.js
├── css/styles.css          # All styles (theme variables under :root)
├── js/i18n.js              # Translation dictionary (MESSAGES) + t() helper
├── js/app.js               # All app logic
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service Worker (cache-first, offline)
└── assets/icons/           # App/PWA icons
```

## How `app.js` works

- **State**: a `state` object with `meters[]` (consumer units) and `activeMeterId`.
  Each meter is `{ id, name, config: { target, cycleDays }, readings[], history[] }`,
  where a reading is `{ id, date, value }`. Read the active meter via `active()`;
  never read `state.config`/`state.readings` directly.
- **Persistence**: `save()` writes to `localStorage` under `KEY`. `loadState()` reads
  and **migrates older shapes** via `normalizeMeter()` — including legacy Portuguese
  field names (`ciclo`, `ideal`, `medidor`, `consumo`, `dias`). When you change the
  persisted schema, keep this migration backward-compatible so existing users' data
  keeps working.
- **Rendering**: `render()` rebuilds `#app` from template strings. It is declarative
  UI without a framework — mutate the state, then call `render()`.
- **Events**: a single delegated `click` listener on `document` dispatches by
  `data-action`. To add an interaction, put `data-action="..."` in the HTML and add
  an `else if` branch to the dispatcher.
- **Escaping**: always pass user-provided content (e.g. meter names) through `esc()`
  before interpolating it into HTML — including when it is a `t()` variable.

## Other rules

- **When you change `app.js`, `i18n.js`, `styles.css`, `index.html`, or any cached
  asset, bump the cache version in `src/sw.js`** (`const CACHE = "controle-agua-vN"`)
  and make sure every cached file is listed in `ASSETS`. Otherwise installed users
  keep the old version.
- `start_url` and `scope` in `manifest.webmanifest` must stay `"."` (root), not
  `./index.html`.
- Keep the app working **offline**, with no external requests at runtime.

## Run and test locally

```bash
make dev            # serves src/ at http://localhost:8000 (or: make dev PORT=3000)
```

Always serve over HTTP (not `file://`), or the Service Worker and PWA mode will not
work. There is no automated test suite: validate changes **in the browser** by
exercising the affected flow (onboarding, add reading, switch/create/delete meter,
new cycle).

> Note: a Service Worker from another project served on the same port can intercept
> requests. If the page loads unexpected content, test on a different port.

## Git

- Write commit messages in **English**.
- Do not `push` unless the user asks.

## Versioning and releases

- The app is versioned with **semver** (`MAJOR.MINOR.PATCH`), still in `0.x` (pre-1.0):
  PATCH = bugfix/text/style, MINOR = new backward-compatible feature, MAJOR = first
  stable or a change that breaks `localStorage` data.
- **Single source of truth**: `src/js/version.js` → `const APP_VERSION`. It is the only
  place to edit on a bump. `src/sw.js` derives its cache name from it
  (`CACHE = "controle-agua-v" + APP_VERSION`) and the footer renders it via the i18n
  key `footer.version` — do **not** hardcode the version in `sw.js` or the footer.
- Each release gets a matching git tag `vX.Y.Z` and a GitHub release (repo
  `geraldoantonio/aquametro`) with **pt-BR** notes, matching the `README.md` convention.
- The full flow is automated by the **`release` skill** (`.agents/skills/release/`);
  run it with `/release` (or `/release pt-br` for a pt-BR interaction) instead of doing
  the steps by hand.
