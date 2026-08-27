# Product Roadmap: RehabCounselor AI

> Single index for picking up the next milestone. `PRD.md` is the source of product truth; every milestone below traces to it. This document defines **what** and **when** — the **how** belongs to each milestone's implementation plan.

---

### Milestone 1: The Spoken Cantonese Clinical Encounter [Completed ✅]
**User-Facing Value**:  
Counselors experience uninterrupted spoken Cantonese roleplay. Voice input listens continuously through natural thinking pauses without cutting off mid-sentence, while client responses are spoken aloud in authentic Hong Kong Cantonese neural audio strictly matching the persona’s gender (male voices for male cases, female voices for female cases).  
*Traces to PRD: USER JOURNEY Step 2, SUCCESS, HARD CONSTRAINTS (Voice & Timbre Binding)*  
*Plan*: [`plan/01-spoken-cantonese-encounter.md`](plan/01-spoken-cantonese-encounter.md)  
*Delivered in*: Commit `2b6ed23`

---

### Milestone 2: The Synchronous AI Clinical Supervisor [Half Delivered ⚠️]
**User-Facing Value**:  
During live roleplay, every counselor turn delivers a lightning-fast (<1.5s), simultaneous double-track response: the client's realistic Cantonese reaction on the main stage, and an instant clinical supervisor micro-hint in the sidebar. The hint pinpoints client motivational signals (Change Talk, Sustain Talk, experiential avoidance) and suggests precise next-step OARS or ACT interventions.  
*Traces to PRD: USER JOURNEY Step 3, SUCCESS, HARD CONSTRAINTS (AI Gateway & Validation)*  
*Plan*: 未撰寫（`plan/02` 從未建立）

**已兌現**：督導提示的內容與臨床品質，已在 `app.js` 運作。  
**未兌現**：同步性。目前是先取案主回應、再取督導提示的兩段式等待，未達 PRD SUCCESS 要求的「同時出現」。這一半由 **Milestone 5** 完成。

---

### Milestone 3: Localized Case Forge & ICF Diagnostic Sandbox [Completed ✅]
**User-Facing Value**:  
Counselors can instantly generate unlimited custom Hong Kong disability cases tailored by age, disability type, and resistance level with clean, authentic profile visuals. Alongside the case library, an interactive ICF Biopsychosocial Sandbox lets counselors drag, drop, and categorize complex environmental barriers and personal strengths directly into their clinical assessment workflow.  
*Traces to PRD: USER JOURNEY Steps 1 & 4, SUCCESS*  
*Plan*: 未撰寫（`plan/03` 從未建立）  
*Delivered in*: `app.js` — `renderCaseGenerator`、`renderCaseCatalog`、`renderICFTab`、`initICFDragAndDrop`、`evaluateICFMapping`（狀態於 2026-08-27 對照程式碼更正）

---

### Milestone 4: Clinical Portfolio Exporter & Safe Vault [Completed ✅]
**User-Facing Value**:  
After completing a counseling session, counselors receive a 5-dimension clinical radar evaluation and can export a formatted clinical case report (containing full verbatim transcripts, completed SOAP notes, and the ICF diagnostic matrix) for internal agency supervision. All session histories and custom cases are permanently preserved in a local browser vault with 1-click JSON backup and restore capabilities.  
*Traces to PRD: USER JOURNEY Step 5, SUCCESS, HARD CONSTRAINTS (Roles & Privacy, SSOT)*  
*Plan*: 未撰寫（`plan/04` 從未建立）—— 僅 Milestone 1 有對應的 plan 文件

**Safe Vault delivered 2026-08-27** per [ADR-0005](adr/0005-indexeddb-local-vault-persistence.md): session history and custom cases moved from `localStorage` to IndexedDB (`RehabCounselorDB`), with verified boot-time migration, 1-click full-vault JSON backup/restore under Settings → 資料保險箱, a backup prompt before the Danger Zone reset, and an explicit degraded mode when IndexedDB is unavailable. Backups deliberately exclude API keys. See `ARCHITECTURE.md` §6.

---

### Milestone 5: 同一口氣的雙軌回應 [已建置，待真實金鑰驗證 ⏳]
**帶來的價值**：  
同工說完一句話之後，案主的廣東話回應與督導提示**一起出現**，而不是先等案主講完、再等督導分析。等待時間減半，對話節奏終於接近真實面談 —— 這正是 Milestone 2 承諾卻尚未兌現的那一半。同時，督導提示不再可能是預先寫好的罐頭文字：拿不到真正的 AI 分析時，系統會直接說明失敗原因。

**為何排在這裡**：它完成 Milestone 2，而且是 PRD SUCCESS 條款唯一還沒達成的部分。前四個里程碑建立的體驗都要靠它才算完整。  
*Traces to PRD: SUCCESS, HARD CONSTRAINTS (AI Gateway & Validation)*  
*Plan*: [`plan/05-synchronous-dual-track-response.md`](plan/05-synchronous-dual-track-response.md) — 已批准 2026-08-27 23:36 HKT  
*相關決策*：[ADR-0002](adr/0002-unified-structured-gemini-schema.md)

---

### Milestone 6: 誠實的離線示範
**帶來的價值**：  
還沒設定金鑰的同工，第一次打開平台就處於離線示範模式。目前示範對話與真實 AI 回應在畫面上長得一模一樣，而同工自己合成的個案在離線模式下每一輪都回同一句預設台詞。此里程碑讓示範模式**看得出是示範**，並在個案沒有預設劇本時直說「此個案需要金鑰才能對話」，而不是給一段假對話。

**為何排在這裡**：離線模式是新同工的第一印象。Milestone 5 讓真實回應變快之後，示範與真實的差別更需要能被一眼分辨。  
*Traces to PRD: HARD CONSTRAINTS (AI Gateway & Validation — no fake data)*

---

### Milestone 7: 不會憑空消失的面談
**帶來的價值**：  
面談進行到一半時誤關分頁或重新整理，目前逐字對話與 SOAP／ICF 草稿會全部消失且無法救回。此里程碑讓系統在同工要離開未完成的面談時出聲攔截，確認是否真的要放棄。

**為何排在這裡**：前面的里程碑讓面談本身更值得投入；投入愈多，中途失去的損失愈大。  
*Traces to PRD: USER JOURNEY Step 4*

---

### Milestone 8: 可信賴的本地紀錄
**帶來的價值**：  
儀表板顯示的完成場次，與保險箱裡實際存著的面談永遠一致，還原備份之後也不會出現互相矛盾的數字。設定頁的診斷日誌不再永久留下金鑰特徵與帳號識別 —— 把螢幕轉給督導看時，設定頁不會殘留這些痕跡。同時，設定頁會顯示同工今日還剩多少次 AI 呼叫額度，讓自費金鑰的用量心裡有數，不會在面談中途才發現額度用完。

**為何排在這裡**：這是整套紀錄體系的收尾。Milestone 4 解決了「留得住」，這一步解決「留下來的內容彼此對得上、不多留不該留的東西，而且與金鑰有關的資訊都可信」。  
*Traces to PRD: HARD CONSTRAINTS (SSOT, Security & Secrets, Usage Guardrail)*  
*註*：每日用量上限為 PRD v3（2026-08-27）新增條款，經擁有者決定併入本里程碑，不另開里程碑。

---

### 編排說明
- **未新增 PRD 以外的範圍。** 「面談草稿續接」刻意未列入 —— PRD 未描述該能力；Milestone 7 只做到攔截誤離開為止。
- **語言不一致是刻意的。** Milestone 1–4 的既有英文內容一字未改（屬已確認事項），新里程碑以白話中文撰寫。
- **Milestone 2 與 3 的狀態於 2026-08-27 對照程式碼更正**，此前長期停留在「Next」／「Planned」。原先此處的過時警告已由本次更正取代。
