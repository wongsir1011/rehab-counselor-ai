# Architecture: RehabCounselor AI

> **Status**: Living Architecture Document (SSOT for Code Structure & Technical Design)  
> **Last Reconciled**: 2026-08-15 00:44:54 HKT

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
2. **AI Inference & Structured Gateway**:
   - The user message, active case context, and conversational history are submitted to `generateClientReply()`.
   - A single round-trip Gemini call with a strict `responseSchema` generates both `{ reply, coachHint }` in <1.5s.
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
