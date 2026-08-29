# Architecture: RehabCounselor AI

> **Status**: Living Architecture Document (SSOT for Code Structure & Technical Design)  
> **Last Reconciled**: 2026-08-29 HKT (UTC+8) — Milestone 7 built; see §7 for drift found and closed

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

**Derived values (Milestone 7)** — every number the interface states about the counselor is computed in one place, `computeCounselorRecord(historySessions)` in `app.js`, which returns `{ totalSessions, evaluatedSessions, evaluatedCount, distinctCaseIds, userTurns, radar, radarAverage }`. The dashboard, the analytics page, the longitudinal trend chart and the achievement predicates all read it; none of them aggregates on its own.

`radar` and `radarAverage` are **`null`, not `0`, when no session carries an AI evaluation**. This is deliberate and structural: D20 happened because "not evaluated" was written as `0`, then flowed silently into a coordinate formula and drew a pentagon collapsed at the centre — which reads as "this counselor scored zero". `null` breaks that formula instead of lying, so each consumer is forced to render an explicit "no record yet" state. `radarPolygonPoints(radar, maxRadius)` returns `null` for a `null` radar and the caller emits no `<polygon>`.

The `completedCasesCount` / `completedCaseIds` `localStorage` copies were **deleted** in the same pass (D7). The `sessions` object store is the only home; `buildBackupJSON()` still emits the `completedCount` / `completedIds` backup fields under their original names, but computes them from `sessions`, and `importFullBackupJSON()` ignores them on restore because they are derived. Backup format version and field names are unchanged, so older backups still restore.

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
| D6 | SOAP/ICF drafts live only in `state.activeSession.notes`; no `beforeunload` guard anywhere (**re-verified 2026-08-29: zero occurrences in `app.js` and `index.html`, which also blocks the SUCCESS clause**); the UI nevertheless displays a green **"已安全備份"** indicator | `app.js:3427`, `app.js:3596`, `app.js:3576-3578` | HARD CONSTRAINTS "SOAP drafts reside … in IndexedDB" |

### Logged, non-blocking

| ID | Drift | Note |
| :--- | :--- | :--- |
| ~~D7~~ | ~~Completed-session count has three parallel homes~~ | **RESOLVED (M7, 2026-08-29)**: both `localStorage` copies deleted. `rehab_completed_cases_count` had **zero** readers; `rehab_completed_case_ids` had one (the 實戰特工 badge), now `computeCounselorRecord().distinctCaseIds`. The `sessions` store is the only home. Backup round-trip verified identical before/after restore. |
| D8 | MiniMax diagnostics persist a masked key (first 5 + last 4 chars) and a plaintext Group ID to `localStorage` with no expiry | `app.js:3940`, `3970`, `3973`. Excluded from vault backups. |
| ~~D9~~ | ~~Five shipped feature areas absent from `PRD.md`~~ | **RESOLVED by PRD v3 (2026-08-27 23:28 HKT)**: Theory Hub, group projector study, MI staged drills and achievements are now written into USER JOURNEY steps 1 and 5. Motivational quotes were deliberately left out as interface garnish, not product intent. |
| ~~D10~~ | ~~Generator exposes four parameters where the PRD named three; "verified" dialogue characteristics had no verification step~~ | **RESOLVED by PRD v3**: journey step 2 now names all four parameters, and the unbacked word "verified" was dropped. |
| D11 | `sessions` has no index; ordering relies on `b.id.localeCompare(a.id)` being correct only because `"session_" + Date.now()` is fixed-width | Correct today, fragile by construction |
| D12 | ICF sandbox lives in the case catalog, not in the interview view; it does not assist SOAP drafting | USER JOURNEY 4 "assisted by" unfulfilled |

### New gaps introduced by PRD v3 (2026-08-27 23:28 HKT)

PRD v3 tightened several clauses and added one wholly new obligation. Measured against the same `origin/main`:

| ID | PRD v3 clause | Code status |
| :--- | :--- | :--- |
| D13 | **Usage Guardrail** — a per-counselor daily cap on model calls, shown in settings with the remaining budget | **Not built at all.** No call counter, no cap, no settings surface. Scheduled by owner decision on 2026-08-27 into the milestone that is **Milestone 9** after the 2026-08-29 renumbering. |
| ~~D14~~ | ~~Scripted demo turns must be visibly marked; scriptless cases must not be roleplayable without a key~~ | **RESOLVED (M6)**: every scripted bubble carries a "示範劇本" badge and an amber left border; `history[].scripted` persists into the vault so the session-detail popup and the Markdown export both mark demo turns for the supervisor; scriptless cases are blocked at entry. |
| ~~D1′~~ | ~~Supervisor hint visible by default on arrival~~ | **RESOLVED (M5)**, verified in-browser: hint readable with no click on the first turn. |
| D6′ | Interface **must never claim a draft is saved when it is not** (v1 implied only the storage location) | The "已安全備份" indicator still makes the false claim. **Milestone 8** must remove or truth-up the indicator, not only add the leave-guard. (Renumbered 2026-08-29 when M7「每個數字都來自你的紀錄」was inserted; the drift is unchanged.) |

### Findings from the Milestone 5 peer review (2026-08-28 02:26 HKT)

Every item below was reproduced by running the app, not inferred from reading the diff.

| ID | Finding | Evidence |
| :--- | :--- | :--- |
| ~~**D15**~~ | **RESOLVED (M6, 2026-08-28)** — the failure rollback now restores the queued directives, verified in-browser: after a forced failure the retry request still carries `臨床督導即時注入指令`. *Original finding:* a supervisor intervention directive queued via the Phase 13 buttons was **silently lost** if that turn's API call failed. `app.js:3762` clears `state.activeSession.promptModifiers` *before* the request; the failure rollback added in M5 then pops the orphan history entry that used to carry the directive text. The counselor retries believing the intervention applies — it does not, and nothing on screen says so. | A/B tested with identical fetch interception against `063acdc` (pre-M5) served on a second port: old build's second request still contained `臨床督導即時注入指令`, the M5 build's did not. Violates the project principle that errors must surface rather than appear to succeed. |
| D16 | The supervisor panel renders model output through `innerHTML` (`app.js:3810`), so markup emitted by the model executes. An `<img src=x onerror=…>` payload **actually fired** in testing. The client's own dialogue is safe (`renderChatBubble` uses `textContent`); this is the only such surface. **Pre-existing — M5 did not worsen it**, since the old code also assigned `innerHTML` and `display:none` does not suppress `onerror`. A reachable chain exists: the case "gene code" import (`synthesis-import-btn`) accepts arbitrary base64 from another person, which can carry a prompt injection, and the payload would execute in a browser whose `localStorage` holds the API keys. | Executed in-browser; `window.__XSS` was set. |
| ~~D17~~ | ~~Phase 13 supervisor intervention absent from the PRD~~ | **RESOLVED by PRD v4 (2026-08-29)**: written into USER JOURNEY step 3, with the wording narrowed to rehearsing a specific clinical turn so it does not read as a way to puppet the client. | `grep -niE "intervention\|inject\|干預\|directive" PRD.md` returns nothing. |

Verified sound during the same review, by execution rather than assertion: the other four Gemini functions are unaffected by the `callGeminiAPI` signature change (`responseSchema === undefined` for all four under stub); two consecutive failures leave no bubble accumulation (7 → 7 → 7); a failure does not overwrite text the counselor typed while waiting; `setCoachPanelVisible()` is a top-level declaration with all three call sites after it; `clientShortName` has zero remaining references.

### Findings from the Milestone 6 peer review (2026-08-29 00:52 HKT) — both resolved in the same round

| ID | Finding | Evidence & resolution |
| :--- | :--- | :--- |
| ~~D18~~ | **Fabricated clinical evaluation in offline mode.** `generateSessionReport()` returned a hard-coded report — fixed scores (80/75/85/70/90) and a summary that named 阿強 regardless of which case was interviewed, praising the counselor for things that never happened. It fed the radar chart, was written to the vault, and was exported to supervisors with no marking. | Proven by direct module calls: two different cases and two different transcripts produced byte-identical scores and summary, and the summary still said 阿強 when the case was 美玲. **RESOLVED**: the offline branch now throws `OFFLINE_NO_EVALUATION`; the session is still finalized and vaulted with `report: null`, preserving the transcript and notes, and every consumer is guarded by a single `hasEvaluation()` predicate. |
| ~~D19~~ | **Fabricated radar defaults.** With zero sessions the Analytics radar was seeded with `{75, 60, 80, 45, 65}` and derived a grade from it, so a counselor who had never held an interview was shown "優良 (B+)" as their own standing. | **RESOLVED**: with no evaluated sessions the radar renders empty and the grade line reads 「尚無已評估的面談紀錄」. The longitudinal trend chart's simulated data was **left alone** — it already carries a `simulatedBadge` and dashed strokes, so it was honest to begin with. |

Aggregates now exclude unevaluated sessions from the **denominator** rather than counting them as zero — verified with a mixed vault (one session scored 60 across all five dimensions plus one unevaluated): the grade came out 合格 (C) with an average of 60, not 需提升 (D) at 30.

### Open finding from the F1-fix peer review (2026-08-29 02:04 HKT)

| ID | Finding | Evidence |
| :--- | :--- | :--- |
| ~~**D20**~~ | **RESOLVED (M7, 2026-08-29)** — and it was **four** places, not three: the longitudinal trend chart gated `isSimulated` on `historySessions.length < 2`, so two offline demo sessions removed the「模擬成長對照引導線」badge while `filter(hasEvaluation)` left the series empty — a chart with no badge, no data points, presented as the counselor's own. All four now branch on the evaluated count. Verified in a real browser with a vault holding only unevaluated sessions: dashboard shows `—`, the analytics radar draws no polygon, the detail popup shows an explanation card instead of a zero pentagon, and the trend chart keeps its simulated badge. *Original finding:* **"Not evaluated" is rendered as "scored zero" in three places.** The F1 fix removed the flattering fabrication but left its mirror image: a session that was never evaluated is drawn as a zero score, which is equally untrue. (a) **Dashboard** `app.js:800-802` gates the average on `historySessions.length > 0` rather than on the evaluated count, so a counselor whose vault holds only offline demo sessions sees **「0分」** and an empty ring. (b) **Session-detail popup** `app.js:5947` onward still renders the whole radar block under the heading 「本次面談技巧評分」 using the zero-filled destructuring — a pentagon collapsed at the centre reads as "this session scored zero", not "this session was not evaluated"; only the adjacent summary text was fixed. (c) **Analytics radar** `app.js:5581`/`5732` still plots the polygon from the all-zero `state.radarScores`, though the grade line beside it does correctly read 「尚無已評估的面談紀錄」. | (a) proven by evaluating the expression with `historySessions = [{report:null}]` → renders `0分` where `—` is correct. (b) and (c) proven by reading the templates: the score block and the polygon are unconditional. **Not visually confirmed** — see the note below. |

These are one defect in three locations and must be fixed in a single pass; fixing them separately would repeat the narrow-fix mistake that produced this finding. **Scheduled into Milestone 7「每個數字都來自你的紀錄」on 2026-08-29**, together with the hardcoded dashboard "Competence Radar", the unconditional mastery claim at the end of the MI drill, and the mismatched「知識探險家」badge — all four are the same pattern: a claim about the counselor that is not computed from their record. Traces to the same PRD clause as D18: presenting the counselor with a clinical conclusion that does not exist.

> **Verification note**: the browser pane stayed at `visibilityState: "hidden"` throughout that review, so every asynchronous IndexedDB call timed out and the app did not finish `hydrateVault()` on boot. D20 rests on code and expression-level evidence, not on screenshots. The pre-commit round did exercise the browser, but it covered the *post-interview completion screen* and the *mixed-denominator* case — not "dashboard with only unevaluated sessions" or "detail popup of an unevaluated session", which is exactly why these slipped through.

### PRD v3 ↔ code calibration (2026-08-29 03:27 HKT)

Audited against `PRD.md` **v3** on disk — the v4 draft raised the same day was **not approved and not written**, so v3 remains the source of product truth. Code audited was `origin/main` = `9988551`, verified byte-for-byte against the five files served from the Vercel deployment.

**The SUCCESS clause cannot currently be walked end to end.** It states that the counselor *"attempts to leave the page mid-interview and is stopped by a warning"*; `beforeunload` appears **zero** times in `app.js` and `index.html`. This reframes D6 — it is not only a durability gap, it blocks the PRD's own demo script.

| ID | Finding | Evidence |
| :--- | :--- | :--- |
| **D21** | **Achievements are not computed from the vault** — *partly closed (M7, 2026-08-29)*. Criteria now live in one predicate, `evaluateAchievement(id, record)`, which returns `true` / `false` / **`null`**. Four of six badges are decided from the vault (`first_session`, `empathy_master`, `combat_specialist`) or from persisted theory progress (`theory_explorer`, module half). `icf_expert` and `case_creator` return `null` — **no durable record exists** for an ICF sandbox run or a case-creation event — and the MI drill score half of `theory_explorer` is also `null` outside the session that ran it, because `miGameScore` lives only in memory. `null` means "cannot verify", and such badges are never revoked. Storage is still `rehab_unlocked_achievements` in `localStorage`. | **Residual distance**: full derivation needs the item-level practice record (**D26**), which is a separate milestone. Until then the latch is the only home for two badges. |
| D22 | **Partly resolved by PRD v4 (2026-08-29).** The three-locale switcher (**170** `state.locale` branches in `app.js`) is now settled the other way: v4 places localized clinical content **out of scope** — Traditional Chinese (HK) only — so the English and Simplified options must be **removed**, a deliberate and visible narrowing. The motivational-quote carousel (4 references) remains outside the PRD; v4 continues to omit it deliberately, so the carousel should be removed rather than documented. | Neither removal is built yet. |
| D23 | Semantic gaps rather than violations, logged for completeness: the PRD's *"staged MI practice drills"* is satisfied only in the sense of ten sequential items — the drill data carries no change-stage field (`stage`/「階段」 absent from `oars_game`); and the ACT self-test passes on keyword matching, though the PRD specifies only *"self-tests"* without depth. | Not counted as drift. |

**Verified sound in the same pass**, by execution rather than assertion: no OUT OF SCOPE clause is violated — the initial `LMS`/`credential` grep returned six hits that all proved to be `miniMax**xApi**Key` matching the `xapi` pattern, and both `password` hits are the API-key input fields, not a login. The access model matches the PRD exactly. Journey steps 1, 2, 3 and 5 are met; Capabilities & Voice, AI Gateway & Validation, and Roles & Access are met in full.

### Gaps introduced by PRD v4 (approved 2026-08-29 05:53 HKT)

Tightening the PRD moves the code further from it. These are deliberately recorded known distances, not oversights. Measured against the same `origin/main` = `9988551`.

| ID | PRD v4 clause | Code status |
| :--- | :--- | :--- |
| **D24** | **Everyone Can Operate It** — every exercise keyboard-operable, screen-reader legible, nothing dependent on dragging, motion respects the reduced-motion preference | **Not built at all.** Repository-wide counts: `aria-label` 0, `role=` 0, `tabindex` 0, `alt=` 0, `prefers-reduced-motion` 0 against 26 `@keyframes`. The ICF sandbox is drag-only; the whole of `app.js` carries one keyboard handler (Enter-to-send). |
| **D25** | **Risk Is Practised, Never Improvised** — labelled risk-disclosure cases, always shown with escalation and referral steps | **Not built.** Searching the case library for suicidal ideation, self-harm, abuse or acute psychiatric content returns nothing; the only hit for「危機」is「斷糧危機」, a financial phrase. |
| **D26** | Item-level practice record in the vault; wrongly answered drill items come back | **Not built.** The MI drill keeps only `miGameScore` and `miGameIndex`; there is no per-item record anywhere, so nothing can be reviewed, re-tested, or adapted. |
| **D27** | The exported session report carries, turn by turn, the guidance the AI gave | **Not built.** `coachHint` is never written to `state.activeSession.history`, and `exportSessionReport()` references it zero times. A supervisor cannot audit what the AI told the counselor. |
| **D28** | **Honest Simulation** — the simulated client must not be a deterministic reward function | **Not built.** `geminiService.js` instructs the client to soften *only* when correct technique is used, and to harden when lectured — a fixed technique→compliance contingency. |
| **D29** | **Teaching Material Is Data** — extendable by a Training Lead without code changes | **Not built.** All content is hardcoded in the 961-line `mockData.js` ES module; adding one drill item or case requires editing code and redeploying. |
| ~~D30~~ | ~~**No Claim Without Evidence** — no letter grades; every claim computed from the counselor's own record~~ | **RESOLVED (M7, 2026-08-29)**: the four letter grades are gone; the hardcoded dashboard radar polygon and its "極佳 (A) / 優良 (B+)" footer are computed from the record or say 「尚無已評估的面談紀錄」; the MI drill states `score / max` with a verdict matched to the actual ratio; badge criteria match their descriptions; and the practice-support statement appears at all five score/guidance surfaces including the exported report. Four further same-pattern claims found during the build were fixed with it — see the M7 row below. |
| **D31** | **Security & Secrets** — model output rendered as text, never as markup | **Not built.** `app.js:3884` still assigns `coachHint` through `innerHTML`. Already scheduled as part of Milestone 9. |

### Findings from the Milestone 7 build (2026-08-29)

Four additional claims of the same family were found by reading the code during the build and fixed in the same pass. They were never separately numbered because they are the same defect as D30, in different locations.

| Location | Claim it made | Now |
| :--- | :--- | :--- |
| `mockData.js` `mini_radar_desc` | 「平台整合自學表現與 **SOAP 評核**的雷達圖」 | No code path ever integrated self-study progress or SOAP notes into that chart. Reworded to name its real source: the counselor's evaluated sessions. |
| Analytics 「專家培訓建議」 | 「你目前在 ACT 的心理彈性概念上**自學非常充足**」, hardcoded — shown at 0/9 modules | Derived: names the theory modules actually incomplete, or the lowest-scoring dimension in the record; makes no claim when there is neither. |
| Co-Learning Studio closing panel | 「同工小組…**深化了**對於 MI…的實戰心得」, regardless of answers | States the item count completed and points at the next activity. |
| 「初試啼聲」 badge | Description says *"and generated an evaluation report"*, but it was granted after offline sessions that have no evaluation | Criterion now requires an evaluated session, matching the description. |

**A second bug was caught by the peer-review read, not by the tests**: `reconcileAchievementsOnce()` checked its once-only flag as `done.value.done`, but `RehabCounselorDB.getMeta()` returns the **value itself** (`req.result.value`), not the `{key, value}` record — so the flag never matched and reconciliation re-ran on every boot. It is idempotent in effect, which is exactly why the first round of tests passed for the wrong reason. Fixed to `done.done` and re-verified across two boots with the badge deliberately re-seeded in between.

**One bug was caught by the milestone's own test, not by reading the code**: the first version of `evaluateAchievement("theory_explorer")` returned `false` when the MI drill had not been run in the current session — so a legitimately earned badge was revoked on **every page reload**, because `miGameScore` resets to 0 on boot. The predicate now returns `null` (cannot verify) in that case and `false` only when the *persisted* theory progress proves non-compliance. Re-verified: badge retained across reloads when theory modules are complete, revoked when they are not.

**The one-time reconciliation** (`reconcileAchievementsOnce()`, flagged in `app_meta`) revokes only badges whose criteria are verifiably unmet, shows a one-time explanation on the badge wall, and is idempotent — verified by seeding all six badges against a record that justifies four.

### Confirmed sound

- **Access model matches the PRD exactly** — single-user, local-first, no accounts, no server-side gate to bypass, no multi-tenant data. Nothing added beyond the PRD, nothing missing from it.
- **Nothing in OUT OF SCOPE is violated.** The Co-Learning Studio reads `MOCK_CO_LEARNING_CASES[0]` entirely locally — no WebSocket, WebRTC, or backend — so it is not a "multi-counselor synchronous conference room".
- **Storage schema is clean**: three object stores (`sessions`, `custom_cases`, `app_meta`), all in use, no orphan stores. `DB_VERSION` is still 1 and `onupgradeneeded` only creates absent stores, so no destructive migration has ever run. The ADR-0005 migration verifies every source id landed in IndexedDB *before* deleting the `localStorage` copies — verified by live browser test.
- `custom_cases` carries a latent orphan risk: `persistCustomCases()` only `put`s, never `delete`s. No delete UI exists today, so there are no orphans — but adding one without a matching delete path would strand records.

---

## 8. Presentation Layer: measured state (2026-08-29)

Recorded because these numbers explain why visual consistency is expensive to maintain, and because they are not visible from any single file.

**Styles live mostly outside the stylesheet.** `app.js` carries **806** inline `style="…"` attributes against **672** `class` attributes, while `index.css` defines **366** class selectors. **187** of those inline styles exceed 100 characters (longest 524). Most visual decisions are therefore made inside template literals rather than in a stylesheet.

Two consequences follow directly:

1. **No scale can hold.** Across `app.js` and `index.css` there are **418** `font-size` declarations using **45 distinct sizes**; **219 of them — over half — sit between 0.70rem and 0.85rem**, six steps inside a 2.4px range, which cannot express hierarchy. Spacing uses **20** distinct px values (including 1, 2, 3, 5, 7px), border-radius **11**, and there are **6** ad-hoc breakpoints (420/500/650/768/900/950px).
2. **The light theme cannot fully apply.** Inline styles outrank any selector, and **155** colour literals are hardcoded inside them (most frequently `rgba(255,255,255,0.02)` and `rgba(255,255,255,0.05)`, 11 times each — white surface tints that create depth on a dark ground and vanish on a light one). `index.css` carries only **36** `[data-theme="light"]` override rules against 366 class selectors (34 before Milestone 7 added two for `#radar-recommendation-panel`, whose hardcoded `rgba(10,15,30,0.85) !important` put dark text on a dark panel in the light theme — fixed because M7 touched that panel, per the roadmap's rule that presentation work rides along with whichever milestone touches a screen). Inline styles do also use design tokens — **566** `var(--…)` references — so the escape hatch is the exception, not the rule.

**Motion and focus**: **26** `@keyframes` with **0** `prefers-reduced-motion` handling; 9 `:focus` rules but no `:focus-visible`.

The token layer itself is sound: **32** CSS variables (14 accent, 10 nested surface, 6 text, 6 illustration, 5 card, 4 shadow, 4 background, 1 transition). The problem is not the absence of tokens, it is that half the interface does not go through them.

> Treated as internal engineering, not a milestone: `Product_Roadmap.md` records that this is absorbed into whichever milestone touches a given screen.
