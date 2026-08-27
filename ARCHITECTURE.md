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
2. **AI Inference Gateway** ⚠️ *does not yet match [ADR-0002](adr/0002-unified-structured-gemini-schema.md)*:
   - The user message, active case context, and conversational history are submitted to `generateClientReply()` in `geminiService.js`.
   - **As actually built**: two *sequential* plain-text calls — `callGeminiAPI()` for `reply`, then `generateCoachHint()` for `coachHint`. There is no `responseSchema` anywhere in `geminiService.js`. Per-turn latency and token cost are therefore roughly double the intended design, and the PRD's "<1.5s" success criterion is not reachable in this shape.
   - `generateCoachHint()` returns a hard-coded Chinese clinical sentence from its `catch`, which is displayed identically to a genuine AI hint. This violates the PRD's "no fake data" constraint.
   - Converging on the single structured round-trip is **Milestone 5** in `Product_Roadmap.md`.
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

## 7. Known Drift: Code vs. PRD (audited 2026-08-27 23:14 HKT)

A full clause-by-clause audit of `PRD.md` v1 against `origin/main` (`1d531a5`, byte-identical to the live deployment) found the following. This section records **what the code actually does**; it is not a to-do list — sequencing lives in `Product_Roadmap.md`.

### Blocking the Northstar or the SUCCESS criterion

| ID | Drift | Location | PRD clause breached |
| :--- | :--- | :--- | :--- |
| D1 | Supervisor hint is `display:none` by default and is **re-hidden on every turn** | `app.js:3411`, `app.js:3816` | USER JOURNEY 3 "delivered alongside client dialogue"; Northstar "real-time clinical supervision" |
| D2 | Two sequential calls, zero `responseSchema` | `geminiService.js:222-223` | HARD CONSTRAINTS (AI Gateway); SUCCESS "<1.5s" |
| D3 | Canned supervisor hint on failure | `geminiService.js` `generateCoachHint()` catch | HARD CONSTRAINTS "no fake data" |
| D4 | Hard-coded opening hint asserts "強烈的抗拒姿態" for **every** case regardless of its MI resistance parameter | `app.js:3412` | Northstar "authentic" |
| D5 | Offline demo returns a generic scripted line when a case has no `roleplay_flow` — which is true of **every** AI-generated custom case — with no on-screen marking | `geminiService.js:183-186` | HARD CONSTRAINTS "no fake data" |
| D6 | SOAP/ICF drafts live only in `state.activeSession.notes`; no `beforeunload` guard anywhere; the UI nevertheless displays a green **"已安全備份"** indicator | `app.js:3427`, `app.js:3596`, `app.js:3576-3578` | HARD CONSTRAINTS "SOAP drafts reside … in IndexedDB" |

### Logged, non-blocking

| ID | Drift | Note |
| :--- | :--- | :--- |
| D7 | Completed-session count has three parallel homes: `sessions` store (authoritative), `rehab_completed_cases_count`, `rehab_completed_case_ids` | SSOT breach; kept in sync by three adjacent assignments in `app.js:4323-4328` |
| D8 | MiniMax diagnostics persist a masked key (first 5 + last 4 chars) and a plaintext Group ID to `localStorage` with no expiry | `app.js:3940`, `3970`, `3973`. Excluded from vault backups. |
| D9 | Five shipped feature areas are absent from `PRD.md`: Theory Hub, Co-Learning Studio, MI 5-stage game, achievements, motivational quotes | Resolve by updating the PRD, not by removing features. PRD change requires owner approval. |
| D10 | Case generator exposes four parameters (disability chip, age stage, ACT motivation, MI stage); the PRD names three. "Verified Cantonese dialogue characteristics" has no verification step. | Superset, harmless |
| D11 | `sessions` has no index; ordering relies on `b.id.localeCompare(a.id)` being correct only because `"session_" + Date.now()` is fixed-width | Correct today, fragile by construction |
| D12 | ICF sandbox lives in the case catalog, not in the interview view; it does not assist SOAP drafting | USER JOURNEY 4 "assisted by" unfulfilled |

### Confirmed sound

- **Access model matches the PRD exactly** — single-user, local-first, no accounts, no server-side gate to bypass, no multi-tenant data. Nothing added beyond the PRD, nothing missing from it.
- **Nothing in OUT OF SCOPE is violated.** The Co-Learning Studio reads `MOCK_CO_LEARNING_CASES[0]` entirely locally — no WebSocket, WebRTC, or backend — so it is not a "multi-counselor synchronous conference room".
- **Storage schema is clean**: three object stores (`sessions`, `custom_cases`, `app_meta`), all in use, no orphan stores. `DB_VERSION` is still 1 and `onupgradeneeded` only creates absent stores, so no destructive migration has ever run. The ADR-0005 migration verifies every source id landed in IndexedDB *before* deleting the `localStorage` copies — verified by live browser test.
- `custom_cases` carries a latent orphan risk: `persistCustomCases()` only `put`s, never `delete`s. No delete UI exists today, so there are no orphans — but adding one without a matching delete path would strand records.
