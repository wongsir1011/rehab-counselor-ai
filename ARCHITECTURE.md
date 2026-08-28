# Architecture: RehabCounselor AI

> **Status**: Living Architecture Document (SSOT for Code Structure & Technical Design)  
> **Last Reconciled**: 2026-08-27 23:14 HKT (UTC+8) — full PRD↔code audit; see §7 for drift found

---

## 1. System Overview
RehabCounselor AI is an offline-capable, local-first Single Page Application (SPA) engineered with vanilla ECMAScript modules (ESM) and CSS3 Glassmorphism. It requires zero backend infrastructure, ensuring total client data confidentiality and instant portability.

```mermaid
graph TD
    UI[User Interface / Views] --> State[Central Reactive State (state.js / app.js)]
    State --> Storage[(IndexedDB / LocalStorage Vault)]
    
    UI --> SpeechEngine[Speech Engine (STT / TTS Router)]
    SpeechEngine --> WebSpeech[Web Speech API (Native)]
    SpeechEngine --> MiniMax[MiniMax Neural TTS API]
    
    UI --> GeminiService[AI Gateway (geminiService.js)]
    GeminiService --> GeminiAPI[Google Gemini 2.5 / 1.5 API]
    
    GeminiService --> ResponseSchema[Structured JSON ResponseSchema]
    ResponseSchema --> State
```

---

## 2. Core Modules & Responsibilities

| Module / File | Responsibility |
| :--- | :--- |
| `index.html` | Application shell, font/icon CDNs, DOM mount points, modal containers. |
| `index.css` | Cyberpunk Glassmorphism design system, CSS variables, 3D card tilt transformations, responsive viewports. |
| `app.js` | Main SPA controller, view routing, lifecycle management, event bus, and reactive DOM rendering. |
| `geminiService.js` | AI Gateway communicating with Google Gemini API; handles structured output parsing (`responseSchema`) and prompt engineering. |
| `mockData.js` | Static clinical ontology dictionaries (ACT hexaflex, MI OARS, ICF factors), preset case dossiers, and localization dictionaries (`zh-HK`). |

---

## 3. Data Flow & Conversational Pipeline

1. **Voice Input (STT)**:
   - Counselor taps microphone or holds `Space`.
   - `webkitSpeechRecognition` starts with `continuous: true` and `interimResults: true` using acoustic models (`yue-Hant-HK` / `zh-Hant-HK`).
   - Transcripts stream into the input buffer; silence buffers prevent premature cancellation.
2. **AI Inference & Structured Gateway** (conforms to [ADR-0002](adr/0002-unified-structured-gemini-schema.md) since Milestone 5):
   - The user message, active case context, and conversational history are submitted to `generateClientReply()` in `geminiService.js`.
   - **One** round-trip carries a dual-persona `systemInstruction` — Role A is the Cantonese client producing `reply`, Role B is the clinical supervisor producing `coachHint` — plus `responseMimeType: "application/json"` and a lean `responseSchema` with `required: ["reply","coachHint"]` and `propertyOrdering: ["reply","coachHint"]`, so the model writes the client reply first and then analyses it within the same pass. The same ordering requirement is also stated in prose inside the instruction, so behaviour does not depend on `propertyOrdering` alone.
   - Role A is explicitly forbidden from putting narration, stage directions, or analysis into `reply` (that field is fed straight to TTS); Role B is forbidden from using the client's voice in `coachHint`.
   - The response is parsed by `parseFlexibleJson()` (models occasionally still wrap JSON in Markdown), then **strictly validated**: if either field is absent, non-string, or blank after trimming, `generateClientReply()` throws with the raw response attached rather than substituting text. `generateCoachHint()` and its canned fallback sentence were deleted.
2b. **Offline demo path (no API key)** — since Milestone 6:
   - `generateClientReply()` plays only the case's own `roleplay_flow`. There is **no generic fallback line**: a case with no authored script, or one whose script is exhausted, throws an error carrying `code: "OFFLINE_NO_SCRIPT"` or `"OFFLINE_SCRIPT_EXHAUSTED"`, which `app.js` presents as a normal boundary rather than a failure.
   - `startRoleplaySession()` refuses to open the interview room for a scriptless case while offline, showing an explanatory panel instead — enforced once, so all four entry points are covered.
   - Scripted turns are marked at three levels: the chat bubble (badge + amber left border), the persisted `history[].scripted` flag, and the Markdown export (per-line `［示範劇本］` plus a header warning).
3. **Audio Synthesis (TTS Router)**:
   - The returned `reply` is routed to `speakCantonese()`.
   - Client gender (`selectedCase.gender`) dictates voice model selection:
     - **MiniMax Mode**: Calls MiniMax v2 TTS REST endpoint with male/female timbres (`cantonese_male` / `cantonese_female`).
     - **System Fallback Mode**: Filters native browser voices for Hong Kong Cantonese (`zh-HK`) with gender keyword matching.
4. **State & DOM Update**:
   - Verbatim dialogue, supervisor hint, and timestamp append to `state.activeSession.history`.
   - DOM bubbles render with audio reactive equalizer indicators (`startVoiceFFT()`).

---

## 4. Clinical Theory Framework Integration

```
       [ACT 心理彈性六角]
  接納 ── 認知解離 ── 關注當下
  以己為景 ── 價值澄清 ── 承諾行動
              │
    [MI 動機式訪談法]
  OARS (開放提問/肯定/反映/總結)
  改變性談話 (Change Talk) 激發
              │
    [ICF 生物心理社會模型]
  健康狀況 ── 身體功能 ── 活動與參與
  環境促進/阻礙 ── 個人因素
```

---

## 5. Security & Access Model
- **Confidentiality**: Zero patient data or simulation records leave the user's browser.
- **Key Management**: API keys (`rehab_gemini_api_key`, `rehab_minimax_api_key`) are stored strictly in client-side secure local storage (`localStorage`). Keys are only included in direct HTTPS requests to official AI gateway endpoints (`generativelanguage.googleapis.com`, `api.minimax.chat`) and are never sent to third parties or logged. **API keys are deliberately excluded from vault backup exports** (see `EXPORTABLE_SETTINGS` in `src/utils/db.js`) so a backup file can be forwarded to a supervisor without leaking credentials.

---

## 6. Persistence Layer: The Local Vault ([ADR-0005](adr/0005-indexeddb-local-vault-persistence.md))

Storage is **tiered by growth profile**, not moved wholesale:

| Data | Store | Rationale |
| :--- | :--- | :--- |
| Session history, custom cases | **IndexedDB** (`RehabCounselorDB`, `src/utils/db.js`) | The only data that grows without bound (verbatim transcripts). Hundreds of MB available. |
| Keys, locale, voice/TTS settings, achievements, theory progress | `localStorage` | A few KB total; migrating them would force `await` on every read site for zero benefit. |

**Synchronicity strategy** — `localStorage` is synchronous, IndexedDB is not, and `app.js` contains 6000+ lines of synchronous render code. Rather than convert render functions to `async`, the vault is read **once** into memory during boot:

```
initApp()  →  await hydrateVault()  →  switchView("dashboard")   // first render happens only after hydration
```

`state.historySessions` and `state.cases` are the in-memory authoritative copies that every render function reads synchronously; writes go through `persistCompletedSession()` / `persistCustomCases()`, which update memory and `await` the IndexedDB write.

**Migration** — `migrateFromLocalStorage()` runs on every boot but is a fast no-op when `localStorage` holds no bulk data. It writes to IndexedDB, **verifies every source id was persisted**, and only then deletes the `localStorage` copies — deleting them is what actually reclaims the 5MB quota. It runs on every boot (not once behind a flag) so that records written by the degraded path below are absorbed once IndexedDB recovers.

**Degraded mode** — if IndexedDB is unavailable (e.g. Safari private browsing), `hydrateVault()` falls back to reading `localStorage` and sets `state.vaultMode = "localstorage-fallback"`. The Settings page states this explicitly in red, and restore is blocked with an explanatory message rather than silently showing an empty vault — per the PRD's "fail loudly, no fake data" constraint.

**Backup / restore** — Settings → 資料保險箱 exports the full vault (sessions, custom cases, achievements, theory progress, non-secret settings) as `RehabCounselor_Vault_YYYY-MM-DD.json`, and restores it as an overwrite (validate → `clearAll()` → write). The Danger Zone reset offers a backup export before its two destructive confirmations, and calls `clearAll()` so reset data does not resurrect on the next boot.

---

## 7. Known Drift: Code vs. PRD (audited 2026-08-27 23:14 HKT against PRD v1; re-based on PRD v3 at 23:28 HKT)

A full clause-by-clause audit of `PRD.md` against `origin/main` (`1d531a5`, byte-identical to the live deployment) found the following. This section records **what the code actually does**; it is not a to-do list — sequencing lives in `Product_Roadmap.md`.

### Blocking the Northstar or the SUCCESS criterion

| ID | Drift | Location | PRD clause breached |
| :--- | :--- | :--- | :--- |
| ~~D1~~ | ~~Supervisor hint hidden by default and re-hidden every turn~~ | **RESOLVED (M5, 2026-08-27)**: panel renders open, every turn sets it visible, and a single `setCoachPanelVisible()` keeps panel and toggle label in sync. The toggle remains — the PRD permits dismissible, not hidden-by-default. |
| ~~D2~~ | ~~Two sequential calls, zero `responseSchema`~~ | **RESOLVED (M5)**: one `responseSchema`-constrained round-trip returning `{ reply, coachHint }`, verified by stub test asserting `callCount === 1`. |
| ~~D3~~ | ~~Canned supervisor hint on failure~~ | **RESOLVED (M5)**: `generateCoachHint()` deleted. Failures surface the real error and leave the panel in a neutral, non-clinical state. |
| ~~D4~~ | ~~Hard-coded opening hint asserting "強烈的抗拒姿態" for every case~~ | **RESOLVED (M5)**: replaced with a neutral empty state making no clinical claim. Necessary because M5 makes the panel permanently visible. |
| ~~D5~~ | ~~Offline demo returns a generic canned line when a case has no script or its script runs out, unmarked~~ | **RESOLVED (M6, 2026-08-28)**: the generic fallback is deleted. A scriptless case cannot be entered offline at all — `startRoleplaySession()` shows an explanatory panel instead — and an exhausted script says so, naming the turn count, rather than inventing dialogue. |
| D6 | SOAP/ICF drafts live only in `state.activeSession.notes`; no `beforeunload` guard anywhere; the UI nevertheless displays a green **"已安全備份"** indicator | `app.js:3427`, `app.js:3596`, `app.js:3576-3578` | HARD CONSTRAINTS "SOAP drafts reside … in IndexedDB" |

### Logged, non-blocking

| ID | Drift | Note |
| :--- | :--- | :--- |
| D7 | Completed-session count has three parallel homes: `sessions` store (authoritative), `rehab_completed_cases_count`, `rehab_completed_case_ids` | SSOT breach; kept in sync by three adjacent assignments in `app.js:4323-4328` |
| D8 | MiniMax diagnostics persist a masked key (first 5 + last 4 chars) and a plaintext Group ID to `localStorage` with no expiry | `app.js:3940`, `3970`, `3973`. Excluded from vault backups. |
| ~~D9~~ | ~~Five shipped feature areas absent from `PRD.md`~~ | **RESOLVED by PRD v3 (2026-08-27 23:28 HKT)**: Theory Hub, group projector study, MI staged drills and achievements are now written into USER JOURNEY steps 1 and 5. Motivational quotes were deliberately left out as interface garnish, not product intent. |
| ~~D10~~ | ~~Generator exposes four parameters where the PRD named three; "verified" dialogue characteristics had no verification step~~ | **RESOLVED by PRD v3**: journey step 2 now names all four parameters, and the unbacked word "verified" was dropped. |
| D11 | `sessions` has no index; ordering relies on `b.id.localeCompare(a.id)` being correct only because `"session_" + Date.now()` is fixed-width | Correct today, fragile by construction |
| D12 | ICF sandbox lives in the case catalog, not in the interview view; it does not assist SOAP drafting | USER JOURNEY 4 "assisted by" unfulfilled |

### New gaps introduced by PRD v3 (2026-08-27 23:28 HKT)

PRD v3 tightened several clauses and added one wholly new obligation. Measured against the same `origin/main`:

| ID | PRD v3 clause | Code status |
| :--- | :--- | :--- |
| D13 | **Usage Guardrail** — a per-counselor daily cap on model calls, shown in settings with the remaining budget | **Not built at all.** No call counter, no cap, no settings surface. Scheduled into **Milestone 8** by owner decision on 2026-08-27. |
| ~~D14~~ | ~~Scripted demo turns must be visibly marked; scriptless cases must not be roleplayable without a key~~ | **RESOLVED (M6)**: every scripted bubble carries a "示範劇本" badge and an amber left border; `history[].scripted` persists into the vault so the session-detail popup and the Markdown export both mark demo turns for the supervisor; scriptless cases are blocked at entry. |
| ~~D1′~~ | ~~Supervisor hint visible by default on arrival~~ | **RESOLVED (M5)**, verified in-browser: hint readable with no click on the first turn. |
| D6′ | Interface **must never claim a draft is saved when it is not** (v1 implied only the storage location) | The "已安全備份" indicator still makes the false claim. Milestone 7 must remove or truth-up the indicator, not only add the leave-guard. |

### Findings from the Milestone 5 peer review (2026-08-28 02:26 HKT)

Every item below was reproduced by running the app, not inferred from reading the diff.

| ID | Finding | Evidence |
| :--- | :--- | :--- |
| ~~**D15**~~ | **RESOLVED (M6, 2026-08-28)** — the failure rollback now restores the queued directives, verified in-browser: after a forced failure the retry request still carries `臨床督導即時注入指令`. *Original finding:* a supervisor intervention directive queued via the Phase 13 buttons was **silently lost** if that turn's API call failed. `app.js:3762` clears `state.activeSession.promptModifiers` *before* the request; the failure rollback added in M5 then pops the orphan history entry that used to carry the directive text. The counselor retries believing the intervention applies — it does not, and nothing on screen says so. | A/B tested with identical fetch interception against `063acdc` (pre-M5) served on a second port: old build's second request still contained `臨床督導即時注入指令`, the M5 build's did not. Violates the project principle that errors must surface rather than appear to succeed. |
| D16 | The supervisor panel renders model output through `innerHTML` (`app.js:3810`), so markup emitted by the model executes. An `<img src=x onerror=…>` payload **actually fired** in testing. The client's own dialogue is safe (`renderChatBubble` uses `textContent`); this is the only such surface. **Pre-existing — M5 did not worsen it**, since the old code also assigned `innerHTML` and `display:none` does not suppress `onerror`. A reachable chain exists: the case "gene code" import (`synthesis-import-btn`) accepts arbitrary base64 from another person, which can carry a prompt injection, and the payload would execute in a browser whose `localStorage` holds the API keys. | Executed in-browser; `window.__XSS` was set. |
| D17 | The Phase 13 supervisor intervention feature (`promptModifiers`, the four directive buttons, `rp-intervention-send-btn`) is **absent from `PRD.md` v3**. Missed by the 2026-08-27 23:14 audit. Per the SSOT rules the PRD is not edited to match the code — this is recorded as a deviation pending an owner decision. | `grep -niE "intervention\|inject\|干預\|directive" PRD.md` returns nothing. |

Verified sound during the same review, by execution rather than assertion: the other four Gemini functions are unaffected by the `callGeminiAPI` signature change (`responseSchema === undefined` for all four under stub); two consecutive failures leave no bubble accumulation (7 → 7 → 7); a failure does not overwrite text the counselor typed while waiting; `setCoachPanelVisible()` is a top-level declaration with all three call sites after it; `clientShortName` has zero remaining references.

### Confirmed sound

- **Access model matches the PRD exactly** — single-user, local-first, no accounts, no server-side gate to bypass, no multi-tenant data. Nothing added beyond the PRD, nothing missing from it.
- **Nothing in OUT OF SCOPE is violated.** The Co-Learning Studio reads `MOCK_CO_LEARNING_CASES[0]` entirely locally — no WebSocket, WebRTC, or backend — so it is not a "multi-counselor synchronous conference room".
- **Storage schema is clean**: three object stores (`sessions`, `custom_cases`, `app_meta`), all in use, no orphan stores. `DB_VERSION` is still 1 and `onupgradeneeded` only creates absent stores, so no destructive migration has ever run. The ADR-0005 migration verifies every source id landed in IndexedDB *before* deleting the `localStorage` copies — verified by live browser test.
- `custom_cases` carries a latent orphan risk: `persistCustomCases()` only `put`s, never `delete`s. No delete UI exists today, so there are no orphans — but adding one without a matching delete path would strand records.
