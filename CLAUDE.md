# RehabCounselor AI — Project Guide for Claude Code

## Project Overview
An offline-capable, local-first Single Page Application for clinical rehabilitation counseling simulation and training, integrating ACT, MI, and ICF clinical models in a Hong Kong Cantonese / Traditional Chinese context.

- **Architecture**: Vanilla ES Modules + CSS3 Glassmorphism. **Zero build step** — the files served are the files in the repo.
- **AI**: Google Gemini (structured `responseSchema` output via `geminiService.js`); speech via Web Speech API + MiniMax Neural Cantonese TTS.
- **Repository**: https://github.com/wongsir1011/rehab-counselor-ai (**private**)
- **Deployment**: Vercel, production branch `main` → https://rehab-counselor-ai.vercel.app/

## ⚠️ Read this before touching anything

**1. Cache-busting stamps are mandatory.** There is no bundler. Browsers cache ES modules aggressively, so a change to `app.js`, `geminiService.js`, `mockData.js`, `index.css`, or `src/utils/db.js` is invisible to users unless you bump the `?v=` query parameter that imports it:

- `index.html` → `app.js?v=…` and `index.css?v=…`
- `app.js` top of file → `mockData.js?v=…`, `geminiService.js?v=…`, `src/utils/db.js?v=…`

Format is `vYYYYMMDD_vNN_shortname` (e.g. `v20260827_v18_adr0005`). Forgetting this has bitten this project before — the stamp sat unchanged across a whole refactor.

**2. Most of `src/` is dead code.** Only `src/utils/db.js` is imported (by `app.js`, for the IndexedDB vault). The other 18 files (`src/main.js`, `src/views/*`, `src/core/*`, `src/components/*`, …) are an abandoned modularization attempt — nothing imports them, though Vercel still serves them. Do not assume a file under `src/` is live; grep for its import first. Their fate is an open backlog decision.

**3. The SSOT living docs must be updated with the code.** Authority is split four ways per [ADR-0006](adr/0006-four-pillar-ssot-documentation.md): this file governs agent behaviour, `PRD.md` governs product intent, the code — **described by** `ARCHITECTURE.md` — governs actual behaviour, and `CHANGELOG.md` governs history. A code change without the matching doc update is an incomplete change.

`ARCHITECTURE.md` describes the code **as it is, not as intended** — where they differ, record the drift in its §7 rather than describing the target design. That rule exists because §3 claimed a single structured AI round-trip that the code never had, and the claim survived unchallenged for weeks.

`PRD.md` is at **v3** (approved 2026-08-27), and now covers the Theory Hub, group projector study, MI staged drills, and achievements. It deliberately **omits motivational quotes** — interface garnish is not product intent. PRD changes need owner approval and the diff shown first; never overwrite it silently, and never delete features to make the code match it.

**4. ADRs are immutable history.** `adr/*.md` records the decision as made, including its `Deciders` field. Add an Implementation Note or a new ADR; never rewrite a past decision to match present reality.

## Key Files
| File | Role |
| :--- | :--- |
| `index.html` | App shell, CDN links, DOM mount points, modal containers |
| `index.css` | Design system, themes, animations (~90KB) |
| `app.js` | Main SPA controller — state, router, all view rendering, audio (~365KB, single file) |
| `geminiService.js` | AI gateway; prompt engineering, `responseSchema` parsing |
| `mockData.js` | Clinical ontologies (ACT/MI/ICF), 7 preset cases, `zh-HK` translations |
| `src/utils/db.js` | `RehabCounselorDB` — IndexedDB vault, migration, JSON backup/restore |
| `check_syntax.py` | Project's own syntax gate — run it before declaring anything done |

## Persistence (ADR-0005)
Storage is tiered: **session history and custom cases live in IndexedDB**; small settings (API keys, locale, voice, achievements, theory progress) stay in `localStorage`. The vault is read into `state.historySessions` / `state.cases` once during boot (`await hydrateVault()` inside `initApp()`, before the first `switchView`), so every render function can stay synchronous. Writes go through `persistCompletedSession()` / `persistCustomCases()`. See `ARCHITECTURE.md` §6.

## Commands
Local dev server (no build step needed):
```bash
python3 -m http.server 8000
```

Syntax gate — must pass:
```bash
python3 check_syntax.py
```

## Git & deployment workflow
- **Do not run `git push`.** The user handles all pushes via GitHub Desktop. Commit locally, then hand off.
- This machine has **no GitHub credentials** — `git fetch` and `git push` fail with `could not read Username`, and the repo is private so anonymous API reads 404. To compare local code against what is live, `curl` the files from the Vercel URL and diff them against `git show <branch>:<file>`. No auth required.
- **Multiple clones exist on this machine.** `~/Projects/rehab-counselor-ai` is the working one. `~/.gemini/antigravity/scratch/rehab-counselor-ai` and `~/Documents/rehab-counselor-ai` are older clones — GitHub Desktop has pointed at the wrong one before.
- Commit messages are Conventional Commits with a Traditional Chinese subject, e.g. `feat(vault): 面談歷史與自定義個案遷移至 IndexedDB…`.

## Conventions
1. **No build tools or frameworks.** Keep the vanilla ESM structure unless explicitly asked otherwise.
2. **Language.** UI is Traditional Chinese (`zh-HK`); speech models default to Cantonese (`yue-Hant-HK` on Chrome, `zh-Hant-HK` on Safari).
3. **Fail loudly, no fake data.** Per the PRD, never substitute canned text for a failed AI response. The only sanctioned mock path is the explicit no-API-key offline demo mode. A previous canned "supervisor hint" fallback was removed for violating this.
4. **Never put API keys in exported files.** Vault backups deliberately exclude `rehab_gemini_api_key`, `rehab_minimax_api_key`, and `rehab_minimax_group_id` (see `EXPORTABLE_SETTINGS` in `src/utils/db.js`) so a backup can be handed to a supervisor safely.
5. **Data privacy.** No session data leaves the browser except direct client-to-API calls to Gemini/MiniMax using the user's own keys.

---
*Development moved to Claude Code in August 2026; earlier work (through ADR-0005's authorship) was done with Antigravity. Historical attributions in `adr/` and `CHANGELOG.md` reflect that and are left as written.*
