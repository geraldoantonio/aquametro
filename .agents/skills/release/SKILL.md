---
name: release
description: >-
  Ship a new Aquametro version following the project's release flow: bump the
  semver in src/js/version.js, validate in the browser, commit, create the git
  tag vX.Y.Z, push, and open the GitHub release with pt-BR notes. Trigger when
  the user asks to release, cut, or publish a version, or to bump patch/minor/
  major — in English ("release the next version", "cut v0.2.0", "bump minor")
  or Portuguese ("faz o release", "lança a versão", "publica a v0.2.0").
  NOT read-only: edits a file, commits, tags, pushes, and publishes a release.
---

# Release a new version

Goal: move Aquametro from one version to the next consistently — one source of
truth (`APP_VERSION`), a git tag, and a GitHub release — without missing a step
or desyncing the Service Worker cache and the footer.

This skill **writes state** (edits a file, commits, tags, pushes, publishes a
release) and is **user-invoked** — the user triggers it explicitly. Every
publishing step (push, GitHub release) happens only after confirmation.

## Language

Default working language is **English**: ask questions and report in English.
If invoked with the **`pt-br`** flag (e.g. `/release pt-br`), interact and report
in **pt-BR** instead. Either way, the **GitHub release notes are always written in
pt-BR** — they are product-facing and follow the `README.md` convention.

## Fixed project context

- GitHub repo: **`geraldoantonio/aquametro`**. Commits in English (AGENTS.md rule).
- **Single source of version truth**: `src/js/version.js` → `const APP_VERSION = "X.Y.Z"`.
  It is the **only** file to edit for the bump. `src/sw.js` derives the cache from it
  (`CACHE = "controle-agua-v" + APP_VERSION`) and the footer renders it via the i18n
  key `footer.version` — do **not** edit `sw.js` or the footer just for the version.
- **Semver** `MAJOR.MINOR.PATCH`, still in `0.x` (pre-1.0):
  - **PATCH** (`0.1.1`) → bugfix, text/style tweak.
  - **MINOR** (`0.2.0`) → new backward-compatible feature.
  - **MAJOR** (`1.0.0`) → first stable, or a change that breaks `localStorage` data.
- Release notes in **pt-BR** (the `README.md` is the only pt-file; keep notes in pt).
- Validation is **in the browser** — there is no test suite (AGENTS.md rule).

## Requirements

Not bundled with the skill; must exist in the session:

- **`gh` (GitHub CLI)** installed and authenticated (`gh auth status` ok). If not on
  the PATH, use `/opt/homebrew/bin/gh`.
- **`git`** with a clean working tree (aside from the release changes).
- **Chrome MCP** (`mcp__claude-in-chrome__*`) for validation — if unavailable, say so
  and fall back to a weaker check (curl), never skip the step silently.

## Asking questions

Every question to the user is multiple-choice (`AskUserQuestion`):
- Offer ready options; the 1st is recommended and carries `(Recommended)`.
- Never add an "Other" option — the custom field shows up on its own.

## Preflight

First:

```bash
git -C /Users/geraldo-jr/Developer/aquametro status --short   # should be clean
grep APP_VERSION /Users/geraldo-jr/Developer/aquametro/src/js/version.js
git -C /Users/geraldo-jr/Developer/aquametro describe --tags --abbrev=0   # last tag
gh auth status 2>&1 | head -3
```

If the working tree has changes unrelated to the release, **stop** and ask whether
to include them, commit them separately, or abort. Do not commit blindly.

## 1. Decide the new version

From the current version (`version.js`) and the last tag, propose the next one.
If the user didn't state the bump type, ask via `AskUserQuestion`, offering
PATCH / MINOR / MAJOR with the numbers precomputed (e.g. current `0.1.0` → options
`0.1.1`, `0.2.0`, `1.0.0`). Align the recommendation with what the commits since the
last tag suggest (only fixes → patch; new feature → minor).

## 2. Bump the version

Edit **only** `src/js/version.js`, changing the value of `APP_VERSION`. Nothing else.

## 3. Validate in the browser

Serve and confirm the footer and Service Worker reflect the new version:

```bash
cd /Users/geraldo-jr/Developer/aquametro && make dev PORT=8123 >/tmp/aqua-dev.log 2>&1 &
sleep 1.5
```

With Chrome MCP, navigate to `http://localhost:8123/` and check:
- `document.getElementById("version").textContent` → `vX.Y.Z` (the new one)
- `navigator.serviceWorker.controller.scriptURL` present (SW registered) and no console errors

Then **stop the server** (`pkill -f 8123`). If anything is off, **stop** and show the
problem before committing.

## 4. Commit + tag

Commit message in **English**. Use the template below (tailor the first line):

```bash
cd /Users/geraldo-jr/Developer/aquametro
git add -A
git commit -m "$(cat <<'EOF'
Release vX.Y.Z

<one English line summarizing what ships in this version>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git tag vX.Y.Z
```

## 5. Push

Confirm with the user first (publishing is effectively irreversible). Then:

```bash
git push && git push --tags
```

## 6. GitHub release

Generate the notes in **pt-BR** from the commits since the previous tag:

```bash
git log --oneline <previous-tag>..vX.Y.Z
```

Translate/summarize into user-facing bullets (do not paste the raw log). Suggested
structure:

```
<frase de contexto do que esta versão traz>

## Novidades
- <feature / correção em linguagem de usuário>
- ...

<nota final se for pré-1.0 ou tiver algo a avisar>
```

Publish (add `--prerelease` while on `0.x` if the user wants to signal instability —
ask if unclear):

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes "$(cat <<'EOF'
<pt-BR notes>
EOF
)"
```

## Final report

Report, concisely (in the working language — pt-BR if the `pt-br` flag was passed):
new version, commit hash, tag, and the **release link**. If a step was skipped
(e.g. validation without Chrome MCP), say which and why — never report as done what
did not run.
