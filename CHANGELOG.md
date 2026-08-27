# 📝 RehabCounselor AI - 專案變更日誌 (Changelog)

本變更日誌為本平台版本控制與功能交付的權威紀錄。

---

## [v20260827_v20_prd_v3] - 2026-08-27 23:30 (香港時間 UTC+8)

本次為產品意圖更新提交，**不涉及任何執行碼變更**。

### 📜 PRD 升版 v1 → v3（經擁有者批准後儲存，寫入前已完整顯示差異）
*   **納入四個已上線但從未記載的功能區**：理論學習 Hub、小組投影研討、MI 分階練習寫入 USER JOURNEY 第 1 步；成就徽章寫入第 5 步。此前它們完全不在 PRD 內 —— 屬 PRD 落後於產品，以記載解決而非移除功能。
*   **刻意排除激勵金句**：介面點綴不構成產品意圖，不應由 PRD 承擔。
*   **明確劃開小組研討與「多輔導員同步會議室」**：OUT OF SCOPE 現寫明小組研討是「單機本地投影預設教學個案」，無連線層、無共享房間、無第二台參與者裝置，避免日後被誤讀為可建連線功能。
*   **SUCCESS 收緊**：由 v1「1.5 秒內收到回應與提示」改為單次示範可親眼觀察的「回應與督導提示一同到達且**已可閱讀、無需額外點擊**」。原措辭無法在單次示範中證實，且僅要求「同時到達」不足以排除目前預設隱藏的實作。
*   **新增三條硬性限制**：
    *   `No Fabricated Clinical Content` —— 罐頭文字不得出現在同工會合理讀作 AI 臨床分析的位置；示範對白僅限明示的無金鑰模式、僅限有預設劇本的個案、且每一句須可見標示為劇本。
    *   `Degradation Honesty` —— 耐久儲存不可用時須明白告知並封鎖還原。
    *   `Usage Guardrail` —— 每位同工每日模型呼叫上限，設定頁顯示餘額。
*   **資料歸屬條款補上撰寫中草稿**：明訂草稿在僅存於面談畫面期間須有防遺失保護，且**介面不得謊稱草稿已儲存或已備份**。
*   **確立督導為應用程式外的收件人角色**：無帳號、無應用內存取權，只看同工主動匯出的檔案。因此無需帳號層或伺服器權限關卡，與無伺服器的存取模型一致。
*   **新增 OUT OF SCOPE**：伺服器帳號／登入／雲端同步；續接中斷的面談。

### 🗺️ 路線圖：每日用量上限併入 Milestone 8
PRD v3 新增的 `Usage Guardrail` 條款原本無任何里程碑涵蓋。經擁有者決定併入 **Milestone 8「可信賴的本地紀錄」**，不另開里程碑 —— 該里程碑已在處理設定頁的金鑰痕跡與紀錄一致性，用量餘額同屬「與金鑰相關的可信資訊」。

### 🔄 因 v3 而更新的其他支柱文件
*   [CLAUDE.md](CLAUDE.md)：移除已不成立的「PRD 為 v1 且落後於產品」敘述，改記錄 v3 涵蓋範圍與刻意排除項。
*   [ARCHITECTURE.md](ARCHITECTURE.md) §7：D9（五功能未記載）與 D10（生成器參數數量、「verified」無實作）標記為 **RESOLVED**；新增「New gaps introduced by PRD v3」小節，記錄 v3 製造的四項新漂移 —— **D13** 每日用量上限完全未建置、**D14** 示範對白逐句標示未建置、**D1′** 督導提示預設可見（M5 驗收標準收緊）、**D6′** 介面不得謊稱已儲存（M7 驗收標準收緊）。

> 收緊 PRD 的代價是程式碼與它的距離變遠。這些新漂移是刻意記錄的已知差距，不是遺漏。

### 📦 變更檔案 (Files Changed)
*   [PRD.md](PRD.md)：v1 → v3。
*   [Product_Roadmap.md](Product_Roadmap.md)：Milestone 8 納入每日用量上限。
*   [ARCHITECTURE.md](ARCHITECTURE.md)：§7 標記 D9/D10 已解決，新增 v3 引入的四項新漂移。
*   [CLAUDE.md](CLAUDE.md)：更新 PRD 現況敘述。
*   [CHANGELOG.md](CHANGELOG.md)：本條目。

---

## [v20260827_v19_docs_governance] - 2026-08-27 23:14 (香港時間 UTC+8)

本次為文檔治理與全面審計提交，**不涉及任何執行碼變更**。

### 📐 建立四支柱 SSOT 文檔治理 (ADR-0006)
*   確立每份文件只負責一種權威：憲章 `CLAUDE.md`＝AI 行為、`PRD.md`＝產品意圖、程式碼（由 `ARCHITECTURE.md` 描述）＝實際行為、`CHANGELOG.md`＝歷史。
*   新增 [adr/0006-four-pillar-ssot-documentation.md](adr/0006-four-pillar-ssot-documentation.md)，記錄採用方案、三個被否決方案與理由。
*   `DECISIONS.md` 補上 ADR-0006，並為 ADR-0005 標註實作日期。

### 🔍 PRD ↔ 程式碼全面審計（`origin/main` = `1d531a5`，與線上部署逐位元組相同）
逐條核對 `PRD.md` v1 的 32 行原文，發現 **6 項阻塞級漂移**與 **6 項已記錄不阻塞漂移**，全數寫入 [ARCHITECTURE.md](ARCHITECTURE.md) 新增的第 7 節。其中兩項為本輪新發現：
*   **D1（最嚴重）**：督導提示容器預設 `display:none`，且 `app.js:3816` 在**每一回合主動重設為隱藏**。同工每說一句都要再點一次才看得到提示。PRD USER JOURNEY 3 要求「delivered alongside client dialogue」，北極星承諾「real-time clinical supervision」—— 產品的核心價值目前藏在一顆每回合都要重按的按鈕後面。
*   **D6**：SOAP／ICF 草稿只存在於 `state.activeSession.notes` 記憶體，全檔無 `beforeunload`，但畫面上有綠點寫著**「已安全備份」**（`app.js:3427`、`3596`）。這是對耐久性的不實聲明，且違反 PRD「SOAP drafts reside in IndexedDB」。
*   另補記 D4（開場督導提示寫死，對所有個案一律宣稱「強烈的抗拒姿態」，不論其 MI 抗拒參數）與 D5（離線模式對所有 AI 生成個案回傳同一句假對白且無示範標示）—— 連同既知的 D3 罐頭提示，全系統共有**四處假資料**。

### ✏️ 更正 ARCHITECTURE.md 的不實描述
*   第 3.2 節原文宣稱「A single round-trip Gemini call with a strict `responseSchema` generates both `{ reply, coachHint }` in <1.5s」。**實況是兩次循序純文字呼叫，全檔 `responseSchema` 出現次數為 0。** 該段描述的是意圖而非實況，已改寫為實際行為並標註與 ADR-0002 的偏離。此正是 ADR-0006 否決「讓 ARCHITECTURE 描述目標設計」的具體案例。
*   `Last Reconciled` 由 `2026-08-15 00:44:54 HKT` 更新為 `2026-08-27 23:14 HKT`。
*   [adr/0002-unified-structured-gemini-schema.md](adr/0002-unified-structured-gemini-schema.md) 附加實作註記，指明該決策未反映於出貨程式碼，符合實作在 `rollback` 分支 `e06789d` 但從未合併。**決策原文與 Deciders 欄位一字未改**（ADR 不可追溯改寫）。

### 🗺️ 路線圖重排為 Milestone 1–8
*   [Product_Roadmap.md](Product_Roadmap.md)：Milestone 1–4 既有英文內容一字未改；更正 M2 為「Half Delivered ⚠️」（提示品質已交付、同步性未交付）、M3 與 M4 為「Completed ✅」（此前長期停留在 Next／Planned）。
*   新增 M5「同一口氣的雙軌回應」（下一個）、M6「誠實的離線示範」、M7「不會憑空消失的面談」、M8「可信賴的本地紀錄」，全部可追溯至 PRD 具體條文，未發明 PRD 以外範圍。

### 📎 補記：先前未寫入本檔的文檔提交 `9c87874`
*   修正 `CHANGELOG.md`(26)、`DECISIONS.md`(5)、`Product_Roadmap.md`(4)、`plan/01`(1) 共 **36 個** `file:///Users/wongsir1011/.gemini/antigravity/scratch/...` 絕對連結為 repo 相對路徑。這些連結在 GitHub 上無法點擊、換機即失效，且指向本機另一個過時的 clone。
*   移除 `Product_Roadmap.md` 內 `plan/02`、`plan/03`、`plan/04` 三個斷鏈（該三份 plan 從未撰寫）。
*   新增 `CLAUDE.md` 至 `main`（此前只存在於已擱置的 `rollback` 分支 `b23fd66`），並更正兩處會誤導後續開發的描述：舊版把 `src/` 描述為使用中的模組化元件（實際只有 `src/utils/db.js` 被引用，其餘 18 個檔案從未被 import 卻仍被部署），以及補上快取戳記規範（無打包工具，不更新 `?v=` 參數則使用者看不到修改）。

### ⚠️ 未處理事項（需擁有者決定）
*   **`PRD.md` 仍為 v1，本輪未改動。** 審計發現五個已上線功能區（理論學習 Hub、小組研習 Studio、MI 五關卡遊戲、成就徽章、激勵金句）完全不在 PRD 內。此為 PRD 落後於產品實況，應由更新 PRD 解決而非移除功能 —— 而 PRD 變更需擁有者批准且不得靜默覆寫，故本輪僅記錄。
*   本輪提出的 PRD v2 草案未獲批准，不作數。

### 📦 變更檔案 (Files Changed)
*   [ARCHITECTURE.md](ARCHITECTURE.md)：更正第 3.2 節為實際行為；新增第 7 節「Known Drift: Code vs. PRD」；更新對帳時間。
*   [Product_Roadmap.md](Product_Roadmap.md)：更正 M2/M3/M4 狀態，新增 M5–M8，加入檔頭用途說明。
*   [DECISIONS.md](DECISIONS.md)：新增 ADR-0006，ADR-0005 標註實作日期。
*   [adr/0006-four-pillar-ssot-documentation.md](adr/0006-four-pillar-ssot-documentation.md)：新增。
*   [adr/0002-unified-structured-gemini-schema.md](adr/0002-unified-structured-gemini-schema.md)：附加實作註記。
*   [CHANGELOG.md](CHANGELOG.md)：本條目。

---

## [v20260827_v18_adr0005] - 2026-08-27 (香港時間 UTC+8)

### 🔐 本地保險箱遷移至 IndexedDB，並實裝一鍵全量備份／還原，兌現 ADR-0005
*   **面談歷史與自定義個案遷出 localStorage (IndexedDB Vault)**：
    *   `app.js` 直接 import `src/utils/db.js` 的 `RehabCounselorDB`（該檔原本已寫好但從未被任何模組引用，屬孤兒程式碼；`src/` 其餘 18 個檔案仍未接線，去留待決）。
    *   儲存分層：**只有會無限長大的資料**（`rehab_sessions_history`、`rehab_custom_cases`）搬入 IndexedDB；其餘 18 個小型 key（金鑰、語音設定、成就、理論進度，合計僅數 KB）刻意留在 `localStorage`，避免每個讀取點被迫改為 `await` 而毫無收益。
    *   解除原本約 20 場面談即撐爆 5MB 配額的天花板。
*   **同步／非同步衝突的解法 (Hydrate-Once Pattern)**：
    *   `localStorage` 為同步，IndexedDB 為非同步，而 `app.js` 有 6000+ 行同步渲染碼。
    *   改為開機時一次性載入：`initApp()` 改為 `async`，於最後一行 `switchView("dashboard")` **之前** `await hydrateVault()`，把保險箱內容讀入 `state.historySessions` 與 `state.cases`。所有渲染函式維持同步讀取記憶體副本，簽章一律不變。
    *   `state.cases` 原本的 module 頂層同步 IIFE 簡化為 `[...MOCK_CASES]`，自定義個案改由 `hydrateVault()` 非同步注入。
*   **遷移先驗證後刪除 (Verified Migration)**：
    *   `migrateFromLocalStorage()` 寫入 IndexedDB 後**逐筆比對 id 確認全數落地**，才刪除 `localStorage` 副本 —— 刪除這一步才是真正釋放配額，少了它等於整個 ADR 沒做。任何一筆寫入失敗即拋錯並完整保留原始資料。
    *   改為**每次開機都檢查** `localStorage`（而非「遷移過就永不再看」）。原因：IndexedDB 暫時不可用時 app 會降級寫入 `localStorage`，若只認旗標，那些紀錄會在 IndexedDB 恢復後被永久遺留。吸收動作以 id 為 keyPath 覆寫，重複執行安全。
*   **一鍵全量備份／還原 (1-Click Backup & Restore)**：
    *   設定頁新增「資料保險箱 (Local Vault)」區塊，顯示目前用量與儲存引擎，提供匯出 `RehabCounselor_Vault_YYYY-MM-DD.json` 與覆蓋式還原。
    *   ⚠️ **備份檔蓄意不含 Gemini／MiniMax API 金鑰**（`db.js` 的 `EXPORTABLE_SETTINGS` 白名單），令備份可安全轉存或交予督導。
    *   還原流程為「先完整驗證 → `clearAll()` → 寫入」，避免格式有問題時已把現有資料清掉。
*   **重置流程補上保險 (Danger Zone Hardening)**：
    *   重置前先詢問是否匯出備份，才進入原本的兩道破壞性確認。
    *   重置時加入 `await RehabCounselorDB.clearAll()`。**先前只清 `localStorage`，改用 IndexedDB 後會造成重置看似成功、下次開機資料整批復活。**
*   **IndexedDB 不可用時大聲降級 (Loud Degradation)**：
    *   Safari 無痕模式等情境下 `probe()` 失敗時，退回 `localStorage` 唯讀並在設定頁以紅字明示「⚠️ localStorage 唯讀降級模式」，還原功能一併封鎖並說明原因，而非靜默顯示空白歷史令同工誤以為訓練紀錄遺失。

### 🐛 順帶修復：內建個案被誤判為自定義個案
*   `app.js` 三處持久化邏輯與兩處大廳 UI 邏輯硬編碼 `["case_01".."case_04"]` 作為內建個案清單，但 `mockData.js` 的 `MOCK_CASES` 實際有 **7** 個內建個案。
*   後果：`case_mental_cheng`、`case_asd_kahou`、`case_sensory_meiling` 會被當成自定義個案寫入儲存，開機後與 `MOCK_CASES` **重複顯示兩次**，且在大廳被錯誤標示為「AI 基因合成」。
*   統一改用自 `MOCK_CASES` 推導的 `BUILTIN_CASE_IDS`，並在 `hydrateVault()` 過濾掉歷史遺留的污染副本。

### ✅ 驗證 (Verification)
*   `python3 check_syntax.py` 全數通過。
*   於 `http://localhost:8765` 以真實瀏覽器實測，全數通過：
    *   **遷移**：預先在 `localStorage` 植入 3 場面談＋2 個個案 → 開機後 IndexedDB 收到 3＋2 筆、遷移旗標寫入、`localStorage` 副本已刪除。
    *   **個案去重**：大廳顯示 8 張卡、零重複，三個較新的內建個案正確標示為內建。
    *   **備份往返**：匯出 → `clearAll()`（歸零）→ 還原，3 場面談與逐字 SOAP 內容完全一致；`localStorage` 未被回寫。
    *   **金鑰隔離**：植入假金鑰後掃描備份檔，兩個金鑰皆未出現。
    *   **重置**：備份提示正確出現於兩道確認之前；重置後 IndexedDB 歸零，且**重載後資料未復活**。
    *   **降級模式**：以測試載具封鎖 `indexedDB` → 設定頁正確顯示紅字降級警告、匯出仍含真實資料（非空白備份）、還原被擋並顯示說明。
    *   **滯留吸收**：降級模式寫入的紀錄，在 IndexedDB 恢復後開機即被吸收並清除 `localStorage`。
    *   **存檔路徑**：全新使用者離線模式跑完一場 4 輪面談並結束 → 紀錄含評核報告寫入 IndexedDB，`localStorage` 全程未被用於大宗資料。
*   ⚠️ 未實測項目：真實 Gemini API 金鑰下的端對端流程；Safari 真實無痕視窗（降級路徑以測試載具模擬）。

### 📦 變更檔案 (Files Changed)
*   [src/utils/db.js](src/utils/db.js)：新增 `setMeta`/`getMeta`/`probe`/`getStats`/`buildBackupJSON`；重寫 `migrateFromLocalStorage()` 為先驗證後刪除且每次開機重檢；`importFullBackupJSON()` 移除會把大宗資料寫回 `localStorage` 的兩行（原本會令大備份還原直接 `QuotaExceededError`，且配額問題原封搬回）；`exportFullBackupJSON()` 加入設定白名單並排除金鑰。
*   [app.js](app.js)：新增保險箱區段（`BUILTIN_CASE_IDS`、`getCustomCases`、`persistCustomCases`、`persistCompletedSession`、`hydrateVault`、`hydrateFromLocalStorageFallback`、`refreshStateFromLocalStorage`、`downloadVaultBackup`、`restoreVaultBackup`）；`initApp()` 改 async；改寫 3 處面談讀寫點與 3 處自定義個案寫入點；設定頁新增保險箱 UI 與事件處理；重置流程加入備份提示與 `clearAll()`。
*   [index.html](index.html)：`app.js` 快取戳記更新至 `v20260827_v18_adr0005`。
*   [ARCHITECTURE.md](ARCHITECTURE.md)：新增第 6 節「Persistence Layer: The Local Vault」；第 5 節註記金鑰不納入備份。
*   [Product_Roadmap.md](Product_Roadmap.md)：Milestone 4 保險箱部分標記完成；加註本檔對 M2/M3 已知過時。
*   [adr/0005-indexeddb-local-vault-persistence.md](adr/0005-indexeddb-local-vault-persistence.md)：狀態更新為已實作，並記錄三項與原決策的偏離。

---

## [v20260815_v15_milestone1] - 2026-08-15T00:52:03+08:00 (香港時間 UTC+8)

### 🎙️ Milestone 1 交付：連續廣東話語音辨識與 MiniMax 雙引擎神經語音 (Milestone 1 Delivered)
*   **連續廣東話語音辨識升級 (Continuous STT with Pause Recovery)**：
    *   在 `app.js` 的 `initVoiceRecognition` 中實裝思考停頓自動重連機制與語句累積拼接器。同工在說話過程中即使停頓 2~3 秒組織臨床語句，麥克風亦不會意外關閉。
*   **MiniMax 廣東話神經語音雙引擎路由器 (Dual-Engine Cantonese TTS)**：
    *   在 `app.js` 中實裝 `fetchMiniMaxTTSAudio` 與 `speakCantonese` 雙引擎路由器，支援 MiniMax 國際版與國內版 REST API v2。
    *   實裝**案主性別聲線自動綁定**：男案主（如阿強）自動調用 `cantonese_male`，女案主（如雅婷）自動調用 `cantonese_female`，徹底解決性別音色不符問題。
    *   實裝**零丟失平滑降級**：在網絡異常、金鑰未配置或調用超時時，自動無縫回退至原生 Web Speech 廣東話語音。
*   **全局設定頁面與即時診斷功能 (Settings & Voice Test)**：
    *   新增 MiniMax API Key、Group ID、男/女聲線選擇面板。
    *   新增「🔊 測試 MiniMax 廣東話發音」按鈕，提供即時連線診斷與音訊試聽反饋。

---

## [v20260815_v14_ssot] - 2026-08-15T00:44:54+08:00 (香港時間 UTC+8)

### 🏛️ 核心架構與 SSOT 支柱文檔建立 (Architecture & Living Docs SSOT)
*   **PRD.md (Intent SSOT)**：建立正式產品需求規格書（v1），鎖定核心北極星指標、香港職業復康同工使用者旅程、嚴格約束條件（單用戶本地隱私架構、連續廣東話語音辨識、MiniMax 廣東話神經語音與單次結構化 API）。
*   **ARCHITECTURE.md (Code Behavior SSOT)**：建立系統架構文檔，詳解單體 SPA 控制器、Gemini 結構化 API 網關、雙引擎語音路由器、ACT/MI/ICF 臨床理論矩陣與數據流向。
*   **DECISIONS.md & adr/ (Decisions History SSOT)**：建立輕量決策索引與 5 份架構決策紀錄（ADR-0001 至 ADR-0005），涵蓋客戶端本地優先架構、單次結構化輸出、雙引擎 TTS 路由、連續 STT 與 IndexedDB 本地保險箱。
*   **Product_Roadmap.md & plan/ (Roadmap & Build Plans)**：建立產品路線圖與四大里程碑執行計劃（Milestone 1 至 4），精確對齊 PRD 每一條使用者旅程。

---

## [v20260601_v12] - 2026-06-01T23:49:20+08:00 (香港時間 UTC+8)

### 🔧 故障修復與安全防禦 (Fixed)
#### 1. 歷史報告導出引擎 SSOT 數據污染與崩潰修復 (Historical Report Exporter Crash & Cross-Contamination Fix)
*   **問題診斷**：在評審中發現，當同工點開「歷史面談卡片」喚起**全息全景詳細彈窗 (`showSessionDetailPopup`)** 並點擊「匯出報告」時，`exportSessionReport` 會強行讀取全域活動會話 `state.activeCase` 和 `state.activeSession` 的數據。
*   **崩潰與交叉污染隱患**：若當前沒有處於活動對話中，系統會直接拋出 `TypeError` 崩潰；若當前正在進行其他個案的面談（如正與阿強對話，但匯出偉杰的歷史報告），將會產生嚴重的臨床數據污染——將當前對話內容、當前 SOAP 日誌錯誤地與歷史分數拼接導出，嚴重違反臨床系統 SSOT 與隱私原則。
*   **安全重構**：重構了 `exportSessionReport(report, historicalSession = null)`。當傳入 `historicalSession` 歷史記錄實體時，所有的案主姓名、就業診斷、對白歷史與 SOAP/ICF 日誌皆優先從該實體中解析，安全解除了對全域活動狀態變數的強依賴，並同步更新了全息彈窗中的匯出按鈕事件。

#### 2. 語音朗讀異步競爭與視覺發光剝奪修復 (Asynchronous Speech Synthesis visual-stripping race condition fix)
*   **問題診斷**：在 Chrome 瀏覽器中，調用 `cancel()` 會延遲觸發舊語音的 `onerror`/`onend` 事件。當同工快速點擊重播或在對白切換時，舊語音的異步 `cleanup()` 回調會執行 `bubbleEl.classList.remove("is-speaking")`，從而將新啟動語音的氣泡發光外框無聲剥奪。
*   **安全防禦**：將 `cleanup` 內的所有 bubble 與 avatar 樣式還原邏輯全部包裹在 `state.activeUtterance === utterance` 安全鎖內。只有當結束的語音確實是當前正在播放的活動語音時才允許進行樣式清理，徹底防範異步競爭。

#### 3. 危險區域學習進度重設內存狀態復位 (Danger Zone Reset Progress State Alignment)
*   **問題診斷**：點擊重設進度時，系統會正確調用 `localStorage.removeItem("rehab_selected_voice")` 清除語音首選項，但記憶體中的 `state.selectedVoiceName` 並未被清空，造成單次 session 的狀態脫節。
*   **同步修復**：在重置事件監聽器中追加了 `state.selectedVoiceName = ""` 的記憶體狀態復位，使其與緩存層 100% 完美對齊。

### 📦 變更檔案 (Files Changed)
*   [app.js](app.js):
    *   重構 `exportSessionReport` 支持第二參數 `historicalSession` 與安全 Fallback 邏輯。
    *   在 `showSessionDetailPopup` 的匯出點擊事件中精確傳入 `(session.report, session)`。
    *   將 `speakCantonese` 的 `cleanup` 邏輯安全包裹在 `state.activeUtterance === utterance` 防護網內。
    *   在設定頁面重設進度事件中補全 `state.selectedVoiceName = ""` 狀態復位。

---

## [v20260601_v11] - 2026-06-01T23:38:39+08:00 (香港時間 UTC+8)

### 🚀 新增功能 (Added)
#### 1. 臨床報告導出、案主語音情感調製與學習進度重置升級 (Phase 11 Operations Upgrades)
*   **設定頁面「重設學習進度」自癒功能 (Danger Zone Reset Progress)**：
    *   在設定頁面底端追加磨砂紅色「⚠️ 危險區域 (Danger Zone)」警告控制面板與重設按鈕。
    *   實裝雙重防誤觸確認邏輯，防止用戶誤清除數據。
    *   重設時觸發 `AudioSynth.playWarning()`（雙 Oscillator detune 鋸齒波低音警報），清除本地所有緩存（歷史評核、自定義個案、解鎖徽章），重置記憶體 `state`，彈出綠色發光自癒 Toast 提示並跳轉回 Dashboard 儀表板，完成完美的自癒閉環。
*   **案用語音情感與抗拒程度調製 (Emotional Voice Synthesis)**：
    *   重構 `speakCantonese()`，依據當前案主的 `emotional_state` 情感特徵進行 TTS 語速與語調動態調製。對於「焦慮/抗拒/憤怒」型案主（如阿強），拉高語速與語調（`rate = 1.15`, `pitch = 1.06`）模擬激動與焦慮；對於「沮喪/低落/無力」型案主，降低語速與語調（`rate = 0.90`, `pitch = 0.92`）模擬悲觀無力。
*   **Web Audio 氣流嘆氣呼吸合成 (Breathing Acoustic Cues)**：
    *   在 `AudioSynth` 中實裝 `playSigh()` 調製器，利用白噪音濾波與帶通 `BiquadFilter` 掃頻合成逼真的人類重呼吸嘆氣聲。
    *   在語音朗讀前進行文本分析：若文案包含省略號 `……` 或 `...`（代表阻抗與猶豫），播放語音前自動觸發嘆氣音效，並延時 `280ms` 後自然銜接說話語音，帶來強大的臨床聽覺沉浸感。
*   **臨床報告 Markdown 導出系統驗收 (Markdown Exporter Verified)**：
    *   驗收了平台內置的 `exportSessionReport()` 導出引擎。支持在評估報告或歷史全息彈窗中一鍵導出為 Markdown (`.md`) 下載檔案，包含個案背景、SOAP 日誌、ICF 臨床評估及完整的諮商對白歷史紀錄。同工已成功下載並開啟驗證報告，功能運作完美。

### 📦 變更檔案 (Files Changed)
*   [app.js](app.js):
    *   在 `AudioSynth` 中實裝了 `playWarning()` 警告警報與 `playSigh()` 嘆氣合成器。
    *   重構 `renderSettings()` 追加危險區域進度重設警告區塊與雙重安全鎖點擊監聽器，配合 `localStorage` 清理與自癒 Toast。
    *   重構 `speakCantonese()` 引入基於案主情緒狀態的 rate/pitch 聲學調製，並增加省略號判斷觸發 `playSigh()` 嘆氣延時播放。
    *   升級頂部模組導入參數為 `v20260601_v11`。
*   [index.css](index.css): 追加 Phase 11 全套 CSS 樣式系統（`.btn-reset` 危險區按鈕及 Hover 霓虹流光）。
*   [index.html](index.html): 升級應用程式與樣式表的快取破除參數至 `v20260601_v11`。

---

## [v20260601_v10] - 2026-06-01T16:15:00+08:00 (香港時間 UTC+8)

### 🚀 模型升級與優化 (Model Upgrades)
#### 1. 新增高效能模型選項 (Added Gemini 3.1 Flash-Lite & Gemini 1.5 Pro)
*   **Gemini 3.1 Flash-Lite (`gemini-3.1-flash-lite`)**：新增極速輕量化模型選項，特別適合模擬面談中的流暢即時對答。首字輸出時間（TTFT）顯著縮短，具備極低延遲，提供貼近真人對談的極速節奏。
*   **Gemini 1.5 Pro (`gemini-1.5-pro`)**：新增深度推理模型選項，專為需要高級推理與同理心扮演的複雜場景設計。在扮演高阻抗案主、識別複雜諮商技巧（MI/ACT）以及產出高度專業的 AI 督導提示與 SOAP 臨床分析報告上表現更為細緻與優異。

#### 2. 移除廢棄與過時模型 (Removed Deprecated Models)
*   **安全清理**：移除了已經不推薦使用且效能與性價比落後的 `gemini-1.5-flash` 與 `gemini-2.0-flash` 模型，簡化使用者設定體驗。

#### 3. 舊用戶自動平滑遷移 (Auto-Migration)
*   **自動升級邏輯**：在 `initApp()` 中加入自動修復邏輯。若舊用戶在瀏覽器 `localStorage` 中儲存了已被移除的舊模型（`gemini-2.0-flash` 或 `gemini-1.5-flash`），系統將在初始化時自動將其平滑升級至最新推薦的 `gemini-2.5-flash`，防止 API 請求因無效模型代碼而報錯。
*   **同步更新設定頁面 UI**：同步更新 `app.js` 全局設定中的模型下拉選單 `<select id="set-model">` 以及 `geminiService.js` 中定義的 `GEMINI_MODELS` 映射表，確保模型名稱與效能定位說明清晰一致。

## [v20260531_v9] - 2026-05-31T02:15:00+08:00 (香港時間 UTC+8)

### 🔧 故障修復與安全優化 (Fixed)
#### 1. Chrome 廣東話語音識別誤判普通話修復 (Chrome Cantonese STT Misidentification Fix)
*   **根因分析**：Chrome 的 Web Speech API 使用 Google 雲端語音引擎。當語言代碼設為 `zh-HK`（通用香港中文）時，Google 引擎可能根據用戶 Google 賬號的語言偏好（如設定為國語/普通話）強制覆寫語音聲學模型，導致廣東話輸入被辨識為普通話文字。Safari 使用 Apple 本地設備引擎，不受此問題影響。
*   **Chrome 預設語言代碼切換**：將 Chrome 的語音識別預設語言代碼從 `zh-HK` 改為 `yue-Hant-HK`。`yue-Hant-HK` 是 BCP-47 標準中「粵語（繁體字、香港）」的專用標記，能明確命令 Google 雲端引擎載入粵語聲學模型，不受賬號偏好干擾。
*   **舊用戶自動遷移 (Auto-Migration)**：在 `initApp()` 中加入自動遷移邏輯。Chrome 用戶若 `localStorage` 中保存了舊版 `zh-HK` 設定，啟動時自動升級至 `yue-Hant-HK`，無需手動操作。
*   **模擬輔導室 Chrome 診斷橫幅 (Roleplay Session Chrome Diagnostic Banner)**：
    *   在輔導室面板頂部動態注入 Chrome 專屬診斷橫幅 `#rp-chrome-stt-banner`。
    *   當語言已設為 `yue-Hant-HK` 時，顯示青色成功狀態（✅ Chrome 廣東話模式已啟用），並建議如仍有問題可使用無痕視窗。
    *   當語言仍為 `zh-HK` 等非最優代碼時，顯示琥珀色警告（⚠️ 廣東話可能被誤判），並提供「一鍵切換 yue-Hant-HK」修復按鈕，點擊即時生效。
*   **語音辨識結果智能回饋 (Smart Recognition Feedback)**：
    *   在 `recognition.onresult` 中新增置信度百分比顯示（如 `✅ 語音識別成功 (yue-Hant-HK, 置信度: 87%)`），幫助用戶評估識別品質。
    *   加入簡體字啟發式檢測：若辨識結果包含大量簡體字（如「这、个、么、们」），自動在狀態列顯示琥珀色警告，提示可能被誤判為普通話並建議切換語言代碼。
    *   所有狀態文字同步顯示當前使用的語言代碼（如 `點擊麥克風即可直接講話 (yue-Hant-HK)`），取代舊版靜態標籤。
*   **設定頁面全面重構 (Settings Page Overhaul)**：
    *   將語音識別語言選項的排列順序與推薦標記全面重構：`yue-Hant-HK` 置頂為 Chrome 強烈推薦（⭐），`zh-Hant-HK` 標記為 Safari 推薦（⭐），`zh-HK` 降級為「部分瀏覽器可能誤判為普通話」。
    *   幫助文本完全重寫：以結構化格式（問題根因 → 解決方法 1/2/3）清晰呈現三級修復方案（切換語言代碼 → 無痕視窗 → 修改 Google 賬號語言），取代舊版零散說明。

### 📦 變更檔案 (Files Changed)
*   [app.js](app.js):
    *   修改 `state.recognitionLang` 預設值：Chrome 由 `zh-HK` 改為 `yue-Hant-HK`。
    *   在 `initApp()` 中實裝 Chrome 用戶 `zh-HK → yue-Hant-HK` 自動遷移邏輯。
    *   在 `startRoleplaySession()` 的 DOM 模板中注入 Chrome 診斷橫幅及一鍵修復按鈕事件監聽器。
    *   在 `recognition.onresult` 中實裝置信度顯示與簡體字啟發式誤判檢測。
    *   在 `recognition.onend` 中將靜態 `Cantonese STT` 標籤替換為動態語言代碼顯示。
    *   重構 `renderSettings()` 中的語音識別語言選項排列與幫助文本。

---

## [v20260530_v8] - 2026-05-30T22:20:06+08:00 (香港時間 UTC+8)

### 🚀 新增功能 (Added)
#### 1. 模擬案主廣東話語音合成（TTS）與沉浸式互動升級 (Phase 7 Immersive TTS Upgrades)
*   **全局語音膠囊控制開關 (Global Speech Control Toggle)**：
    *   在模擬輔導室面板頂部右側，將原本靜態的語音指示標籤改裝為精美的可點擊膠囊按鈕 `#rp-speech-toggle-btn`。
    *   引入全局 `state.isSpeechMuted` 與 `localStorage` 自動連動。啟用語音時亮起霓虹青色呼吸燈並提示 `語音輸出已開啟`；點擊靜音時切換為靜音狀態燈並提示 `語音輸出已靜音`，同時立刻中斷當前正在播的語音。
*   **一鍵語音重播發光按鈕 (Bubble Voice Replay Button)**：
    *   重構 `renderChatBubble()`。當渲染案主 (`ai`) 的對話氣泡時，在名字側邊動態植入發光的 `.bubble-replay-btn` 音量圖標按鈕。
    *   同工隨時點擊按鈕即可重播該句對白。重播按鈕支持手動強制播放（即使全局靜音，點擊亦能朗讀），具備極高的交互自由度。
*   **案主說話中氣泡流光與頭像脈波呼吸 (Speaking Visual Halos & Flow Borders)**：
    *   對接 `SpeechSynthesisUtterance` 的 `onstart` 事件。語音播放開始時，動態為該句對話氣泡添加 `.is-speaking` 類別，氣泡邊緣自動亮起發光線，並伴隨 HSL 藍紫色調的漸變呼吸流動；左側案主頭像加裝 `.speaking-pulse` 脈波發光，形成強烈的擬真空間感。
*   **語音播放異步競態防禦設計 (Speech synthesis Asynchronous Race-Condition Protection)**：
    *   在 `state` 中引入活動語音標記 `state.activeUtterance`，防範用戶快速點擊重播或多個對話氣泡切換時，舊語音的異步 `onend`/`onerror` 事件延遲觸發而錯誤清除新語音的頭像呼吸燈狀態，確保動畫播放與語音完美同步。
    *   語音播放完畢或中斷時，自動將發光邊框與頭像脈波同步還原。
*   **生命週期靜音清理 (Lifecycle Silence Protections)**：
    *   在 `stopRecording()`、會話結束、或切換視圖時調用 `window.speechSynthesis.cancel()` 與 `clearAllSpeakingStates()`，徹底清空背景語音與發光狀態。

### 📦 變更檔案 (Files Changed)
*   [app.js](app.js):
    *   在全域 `state` 中追加 `isSpeechMuted` 控制狀態與 `activeUtterance` 競態防護物件。
    *   重構 `startRoleplaySession()`。將靜態語音標籤升級為交互式 `#rp-speech-toggle-btn` 並綁定 click 監聽器。在初始氣泡渲染時同步觸發廣東話朗讀。
    *   重構 `renderChatBubble()`。對案主氣泡動態植入 `.bubble-replay-btn` 重播按鈕並返回 bubble DOM 實體。
    *   重構 `submitMessageToAI()`。捕獲新氣泡實體並傳入 `speakCantonese()` 觸發朗讀。
    *   重構 `stopRecording()` 與 `speakCantonese()`。實裝 `clearAllSpeakingStates()` 與 `activeUtterance` 標記防範異步事件競態。
    *   升級頂部模組導入參數為 `v20260530_v8`。
*   [index.css](index.css): 追加 Phase 7 全套 CSS 樣式系統（`.speech-control-toggle` 控制開關、`.bubble-replay-btn` 重播按鈕、`.chat-bubble.bubble-ai.is-speaking` 漸變呼吸流動邊框及 `@keyframes` 動效、`.active-rp-avatar.speaking-pulse` 脈波光學呼吸及 `@keyframes`）。
*   [index.html](index.html): 升級應用程式與樣式表的快取破除參數至 `v20260530_v8`。

---

## [v20260530_v7] - 2026-05-30T20:39:22+08:00 (香港時間 UTC+8)

### 🚀 新增功能 (Added)
#### 1. Co-Learning Studio 大螢幕投影與互動投票升級 (Phase 5 Projector & Voting Overhaul)
*   **大螢幕高清晰高對比排版 (Projector High-Contrast Typography)**：
    *   **投影大面板**：實裝 `.co-projector-panel`，將背景大幅加深為高清晰暗色背景，並加入發光紫框，在大螢幕強光環境下依然保持絕佳可讀性。
    *   **阻抗對白流光框**：對白片段 container `.co-dialogue-segment-box` 加裝高飽和霓虹青框，文字大小調整為高比例 `1.12rem`，並帶有強大文字背光投影，徹底消除後排投影的模糊盲區。
*   **小組模擬投票百分比動態條 (Option Voting Poll Bars)**：
    *   **彩色漸變橫向進度條**：在作答按鈕下方內置發光的 `.poll-bg-bar` 進度指示條，具備 `linear-gradient` 漸變與流暢展開，還原同工大會討論投票之課堂氛圍。
    *   **液晶背光文字淡入**：點擊按鈕或公佈數據時，高對比的 `.poll-percent-text` 會隨進度條展開在 `0.4s` 內優雅淡入，並帶有高對比霓虹青的發光陰影。
    *   **作答正確高亮**：標準答案會亮起翠綠高對比發光框 `.voted-correct`，干擾項亮起粉紅框 `.voted-incorrect`，提供實體感十足的評核回饋。

#### 2. 學習分析動態雷達圖 2.0 (Dynamic Competence Radar 2.0 Overhaul)
*   **歷史大數據即時映射 (Dynamic Radar Coordinates)**：
    *   **動態多邊形坐標解析**：徹底重構 SVG `polygon` 渲染，前端即時遍歷並計算 `localStorage` 中 `rehab_sessions_history` 歷史數據之各維度平均分，並精準繪製多邊形頂點坐標。當無數據時平滑降級為 guided 經典圖形，100% 遵循單一事實來源原則 (SSOT)。
*   **頂點與標籤 Hover 物理微調反應 (Glow & Scale Hover Effects)**：
    *   **雷達標籤 Hover**：滑鼠懸停於 `.radar-label` 時，字號放大並亮起發光霓虹白。
    *   **雷達頂點 Dot Hover**：懸停於頂點 `.radar-dot` 時，半徑彈性膨脹至 `8px`，並亮起極致發光 cyan 霓虹 halo，富有科技質感。
*   **液晶偏光專家評核抽屜與快捷 Jump 閉環 (Expert Advice Panel with Quick Jumps)**：
    *   **LCD 數字評析抽屜**：雷達圖點選任一維度會重繪下方 `#radar-recommendation-panel`，展示詳細定義、同工當前均分以液晶 `.lcd-digital-badge` 顯示，並加載針對性的臨床提升建議。
    *   **一鍵訓練快捷 Jump**：快捷按鈕 `#radar-rec-action-btn` 對接 view 轉場引擎，點選即一鍵切換視圖至理論學習 Hub，並在 `150ms` 延遲後自動定位並點擊 sub-tab（如 ACT 或 MI 分頁），完美打通學習閉環。

### 🔧 故障修復與安全優化 (Fixed)
*   **修復一鍵訓練快捷 Jump 選擇器不匹配故障 (Quick Jump Selector Mismatch Guard)**：
    *   *原因*：在 `radar-rec-action-btn` 點擊監聽器中，原先一鍵跳轉快捷鍵使用的是類別選擇器 `.theory-tab-btn[data-tab="..."]`。然而在 `renderTheoryHub()` 中，主要理論分頁按鈕並未採用該類別，而是使用 ID 結構 `#tab-btn-...`。這會導致選擇器無法查找到對應 DOM 元素，從而無法自動觸發點擊，產生無聲故障。
    *   *修正*：將選擇器重構為正確的 ID 綁定 `document.getElementById("tab-btn-" + details.actionTab)`。經修復後，快捷跳轉機制運作完全流暢，徹底解決了無聲失效隱患。

### 📦 變更檔案 (Files Changed)
*   [app.js](app.js): 在 `renderRadarRecommendation()` 的快捷跳轉與事件監聽器中，修復無聲失效的選擇器 bug。
*   [index.css](index.css): 追加 Phase 5 全套 Projector 投影、投票水平條、雷達圖 2.0 Hover 動效及 LCD 建議面板 CSS。

---

## [v20260530_v6] - 2026-05-30T12:12:44+08:00 (香港時間 UTC+8)

### 🚀 新增功能 (Added)
#### 1. 模擬輔導室 — 沉浸式就業諮商座艙升級 (Phase 4 Overhaul)
*   **對話氣泡物理彈性化 (Elastic Dialogue Bubbles)**：
    *   **物理彈性氣泡**：將原有的靜態滑入動畫重構為 `@keyframes springy-bubble`，利用 `scale3d` 及 `translate3d` 硬件加速，使對話氣泡在滑入時伴隨貝氏物理彈跳回彈視覺（`420ms` 內從 `scale(0.75)` 極速展開並回彈），交互反饋具備強烈生命力。
*   **語音與思考呼吸光圈 (Speech & Typing Halos)**：
    *   **麥克風錄音呼吸圈**：麥克風錄音 active 時，自動在 `.btn-voice-mic.recording` 外圍擴散玫瑰紅霓虹發光脈動動畫。
    *   **案主思考呼吸圈**：當 Gemini 異步調用 API 面談起草或思考時，案主頭像 `#rp-active-avatar` 觸發靛青色脈波呼吸發光，舒緩同工等待的資訊焦慮。
*   **磨砂卡簽物理滑動高亮 (Dynamic Tab Sliding Highlighter)**：
    *   **滑動滑塊遮罩**：在日記本標籤組中加入絕對定位的磨砂滑塊 `.notes-tab-highlighter`，利用純 CSS `transform` 動態在 `translateX(0%)` 與 `translateX(100%)` 間平滑位移，實現流暢的卡簽滑動切換。
*   **AI 自動存檔發光指示器 (Debounced Auto-Save HUD)**：
    *   **自動保存指示器**：在日記本上方加入 `#rp-notes-save-indicator`，當同工在 textarea 輸入時即時將狀態燈轉換為發光琥珀色脈衝並提示 `同步中...`。停止輸入 `600ms`（防抖動延時）後，背景持久化結束，指示燈轉換為靜態翠綠色並提示 `已安全備份`，實現明確的臨床安全感。

### 🔧 故障修復與安全優化 (Fixed)
*   **修復標籤重複點擊導致數據無聲覆蓋 Bug (Workspace Tab Switch Safety Guard)**：
    *   *原因*：在舊版標籤 click 監聽器中，未限制當前已是 active 的標籤的點擊行為。同工點擊已 active 的標籤時會執行 `state.activeSession.notes.icf = notesBox.value`，從而用 active 分頁內容強行覆蓋並抹除另一分頁的內容。
    *   *修正*：在兩個 click 監聽器最開頭實裝了 active 類別邊界防護 `if (noteSoap.classList.contains("active")) return;`。點擊已處於 active 的標籤時立即中斷，徹底消除了無聲數據損毀風險，符合單一事實來源原則 (SSOT)。
*   **全局快取破除機制 (Global Cache-Busting v5)**：
    *   更新 `index.html` 中的 CSS 與 JS 快取破除參數，並同步更新 `app.js` 的頂部 mockData 及 geminiService 模組導入網址至 `v20260530_v5`，確保客戶端即時渲染最新代碼。

### 📦 變更檔案 (Files Changed)
*   [index.html](index.html): 升級快取破除參數至 `v20260530_v5`。
*   [app.js](app.js):
    *   更新頂部 mockData 及 geminiService 導入參數至 `v20260530_v5`。
    *   在 `startRoleplaySession()` 中重構標籤與指示器 DOM 結構，追加 active 點擊防護及 `translateX` 滑塊控制。
    *   在 `notesBox` 增加 `input` 監聽器並對接 debounced AI 自動存檔發光指示器。
    *   在 `submitMessageToAI` 增加案主頭像 `#rp-active-avatar` 發光呼吸 class 狀態切換。
*   [index.css](index.css): 追加 Phase 4 全套 CSS 樣式及動畫定義（`.notes-tab-highlighter`, `.notes-save-indicator`, `@keyframes springy-bubble`, `@keyframes mic-pulsing-glow`, `@keyframes avatar-pulse-glow` 等）。

---

## [v20260530_v5] - 2026-05-30T11:56:20+08:00 (香港時間 UTC+8)

### 🔧 故障修復與安全優化 (Fixed)
*   **防範自定義個案重複寫入大廳 (Defensive Custom Case Write Patch)**：
    *   *原因*：當生成自定義個案成功後，同工可以點擊「寫入大廳」或「進入輔導」按鈕。若同工在生成新個案後，先點擊「寫入大廳」將個案寫入 `state.cases`，隨後在切換視圖的短暫延遲內又點擊「進入輔導」，按鈕事件會再次觸發 `state.cases.unshift(geminiResult)`，導致同一個個案在全局狀態數組中被重複寫入，破壞了單一事實來源原則 (SSOT) 與唯一性。
    *   *修正*：重構了寫入與進入輔導按鈕的事件監聽器，新增了 `!state.cases.some(c => c.id === geminiResult.id)` 唯一性檢查。只有在個案 ID 不存在於全局狀態時才執行 `unshift`，徹底消除了重複寫入與平行狀態隱患。

### 📦 變更檔案 (Files Changed)
*   [app.js](app.js): 在自定義個案生成成功後的 `writeBtn` 和 `enterBtn` 的點擊事件中，實裝唯一性防重複寫入安全補丁。

---

## [v20260525_v4] - 2026-05-25T02:16:21+08:00 (香港時間 UTC+8)

### 🚀 新增功能 (Added)
#### 1. 實時音頻 FFT 頻率波形儀 (Real-time Audio FFT Wave Visualizer)
*   **Web Audio 頻譜分析儀**：對話時語音輸入（STT）會動態喚醒 Web Audio API `AnalyserNode`，從麥克風採集實時頻率字節數據。
*   **霓虹動態 Canvas 渲染**：利用 HTML5 Canvas (`#voice-fft-canvas`) 以 `requestAnimationFrame` 繪製實時發光霓虹頻譜，波形隨輔導同工發音的真實振幅與頻率動態擺動。
*   **麥克風權限回退**：如權限受限或未提供，自動平滑隱藏 Canvas 並回退顯示原本優雅的 CSS 模擬呼吸條，完美維持界面一致性。

#### 2. 臨床 SOAP 輔助輸入與 AI 建議抽屜 (AI SOAP Assistant Drawer)
*   **磨砂玻璃滑動側抽屜**：在模擬輔導室右側加入精美的側滑抽屜組件 `.soap-assistant-drawer`，同工點擊 `SOAP AI` 的發光按鈕即可優雅滑出。
*   **Gemini 臨床 SOAP 助寫起草**：同工可點擊「AI 輔助分析面談」，異步調用 Gemini 服務，綜合當前面談的完整對話歷史，在 S-O-A-P 四大維度為同工自動起草臨床級日誌草案，並輔以打字機與載入效果。
*   **一鍵採納日誌同步**：提供一鍵「採納至日誌」功能，可將 AI 草案完美格式化填入同工的日記本輸入框中，同時更新 `state.activeSession.notes.soap`，防範狀態脫節或數據丟失。

#### 3. 面談技巧縱向發展趨勢圖 (Longitudinal SVG Competence Trends)
*   **歷程大數據整合**：在 **Analytics (學習分析)** 視圖中，透過遍歷 `localStorage` 的 `rehab_sessions_history` 歷史存檔，動態提取所有歷次會話的綜合平均分、MI同理傾聽、ACT心理解離等關鍵維度得分。
*   **SVG 趨勢折線圖生成**：利用原生 SVG 動態渲染出優美的發光霓虹趨勢折線，支持多點數據的自動比例縮放，帶給同工明確的成長軌跡。

### 📦 變更檔案 (Files Changed)
*   [app.js](app.js):
    *   更新頂部 `mockData` 和 `geminiService` 的導入 URL 至 `v20260525_v4`，並導入 `generateSoapSuggestions`。
    *   在 `startRoleplaySession()` 的 DOM 模板中注入 `#voice-fft-canvas` 與 `.soap-assistant-drawer` 的 HTML，並在挂載後執行 `initSoapAssistantDrawer()`。
    *   在 `renderAnalytics()` 中實裝基於 SVG 曲線的縱向能力趨勢分析圖繪製邏輯。
*   [index.css](index.css): 追加 Phase 6 全套 CSS 樣式系統（`.soap-assistant-drawer` 側邊滑動抽屜、`#voice-fft-canvas` 頻譜儀樣式、SVG 曲線發光陰影等）。

---

## [v20260524_v3] - 2026-05-24T23:17:23+08:00 (香港時間 UTC+8)

### 🚀 新增功能 (Added)
#### 1. 無刷新多語系支持 (Seamless i18n Engine)
*   **全域語系映射**：全平台文字重構，建立全域語系字典，全面支持繁中（港式）、簡中與英文三語系。
*   **無刷新切換**：在主應用底部控制台實裝極致發光的語言選擇器，切換時通過 DOM 重建流暢過渡，完全破除整頁刷新的生硬感。

#### 2. 原生 Web Audio API 物理音效合成器 (Zero-Latency Audio Synthesizer)
*   **聲學引擎構建**：底層繞過靜態 mp3，利用原生 Web Audio API 的 `OscillatorNode` 與 `GainNode` 實時合成臨床反饋音效，包括成功（雙頻和諧音 + 頻率滑動）、警告（低沉鋸齒波）、及卡牌翻轉（高頻清脆音），達成 0 延遲播放與超輕量化。

#### 3. 歷程會話檔案庫與全息彈窗 (Therapy Portfolios & Holographic Popup)
*   **持久化壓棧存檔 (Session Archives)**：完成模擬對話後，系統會將該次對話的完整對白紀錄、臨床五維度評分、詳細督導建議以及 SOAP 面談日誌打包成 JSON，以壓棧方式存入 `localStorage` 的 `rehab_sessions_history` 中。
*   **全息面談彈窗還原 (Holographic Detail Restorer)**：點擊卡片會平滑滑入一個極其華麗的磨砂玻璃全息彈窗，內置分頁標籤（評估報告、對話還原、SOAP日誌備份），能 100% 讀取 LocalStorage 數據並還原當初對白氣泡流、精美的 SVG 雷達能力圖以及詳細的督導建議。

#### 4. AI 研討題目生成艙 (AI Dynamic Quiz Builder)
*   **Gemini 動態研討生成**：在 Co-Learning Studio 引入動態題目合成，同工一鍵即可引導 Gemini 連接當前個案背景與情緒阻抗，動態生成極具針對性的單選討論題與解析，打通自研與聯教。

### 🔧 故障修復與安全優化 (Fixed)
*   **修復多音軌重複觸發導致音效堆疊 Bug**：
    *   在音效調用中加入鎖定與單例防護，避免快速雙擊卡牌時產生刺耳破音。

### 📦 變更檔案 (Files Changed)
*   [app.js](app.js): 重構為全語系動態模板渲染，新增 `AudioSynth` 發聲引擎，實裝會話存檔與全息彈窗，對接 GeminiQuiz 服務。

---

## [v20260524_v1] - 2026-05-24T03:38:38+08:00 (香港時間 UTC+8)

### 🚀 新增功能 (Added)
#### 1. 個案實戰 Arena — 檔案大廳與 AI 生成艙升級 (Phase 3 Overhaul)
*   **全息個案檔案大廳 (Holographic Case Dossiers)**：將個案列表重構為科幻戰術卡牌，使用 HSL 霓虹色彩亮起嚴重的紅色/黃色/青色健康狀態警告燈，滑動懸停觸發發光與 `translateY` 視差微動。
*   **AI 智能個案產生艙 (AI Custom Case synthesis pod)**：實裝科幻面板「自定義合成終端」，將複雜表單輸入包裝成機械參數按鈕。
*   **3D 粒子生命合成載入動畫 (Bio-Synthesis Chamber Loading HUD)**：同工點擊合成時，表單平滑滑出，切換為極度炫酷的生命體徵合成腔，展示異步加載狀態（神經網絡體徵、香港本土關係鏈等），圓形 Canvas 霓虹掃描進度條在 100% 時爆發 Confetti 噴泉並進入面談。

### 🔧 故障修復與安全優化 (Fixed)
*   **個案數據 Category 靜態化**：
    *   *原因*：以往個案庫的 `category` 屬性是在執行期透過迴圈在 `app.js` 中動態注入 `state.cases` 全局陣列，屬於不安全的副作用，破壞了 Mock 數據庫作為唯讀主數據源的 SSOT 設計。
    *   *修正*：將 `category` 屬性直接靜態化寫入 `mockData.js` 的 `MOCK_CASES` 成員中，移除了 `app.js` 的動態突變迴圈，維護數據不可變性。

### 📦 變更檔案 (Files Changed)
*   [geminiService.js](geminiService.js): 重構 `parseFlexibleJson`，新增 `escapeRawControlCharsInJsonStrings` 控制字元轉義機制，優化單行註解過濾。
*   [app.js](app.js): 重構 `renderCaseArena`、`renderCaseCatalog`、`renderCaseGenerator`。更新導入的路徑參數，提升快取破除機制至 `v20260524_v1`。
*   [index.css](index.css): 新增 Phase 3 全套科幻儀表板 CSS 樣式系統（`.dossier-search-wrapper`、`.dossier-card`、`.synthesis-terminal`、`.synthesis-loading-hud` 等），追加 `[data-theme="light"]` 覆寫相容樣式。
*   [mockData.js](mockData.js): 為 `MOCK_CASES` 補全靜態 `category` 屬性以維護 SSOT 規範。
*   [index.html](index.html): 升級應用程序與樣式表的快取破除參數為 `v20260524_v1`。

---

## [v20260523_v6] - 2026-05-23T22:57:28+08:00 (香港時間 UTC+8)

### 🚀 新增功能 (Added)
#### 1. 理論學習 Hub 深度互動化升級 (Phase 2 Upgrade)
*   **3 層巢狀式導覽子分頁**：將接納承諾療法 (ACT)、動機式訪談 (MI) 和國際功能殘疾分類 (ICF) 三大理論分頁重構為磨砂玻璃巢狀導覽結構（深度自學理論、3D 知識閃卡、實務鞏固測驗），實現分層自學。
*   **ACT 3D 心理彈性核心閃卡**：實裝 6 張對應 Hexaflex 維度的磨砂玻璃 3D 雙面閃卡，支持 `rotateY(180deg)` 空間立體翻轉。正面展示核心覺察提問，背面提供廣東話引導口訣與練習。
*   **ACT 認知解離實踐沙盒 (Cognitive Defusion Sandbox)**：
    *   新增寫作驗證沙盒，內置阿強（中風偏癱）與偉杰（聽障青年）3 大經典認知融合情境挑戰。
    *   實時語意偵測器，智能判斷廣東話解離關鍵詞（如「我留意到我有一個諗法，話我...」），並提供 AI Supervisor 的臨床剖析與綠色 glowing ✅ 反饋。
*   **MI 進階 OARS 諮商心法 3D 閃卡 deck**：實裝 8 張進階技術閃卡，覆蓋開放式提問、肯定、反映（簡單、雙重、放大）、總結、引發 Change Talk、避免說教等，支持 3D 立體翻轉。
*   **MI OARS 經典配對闖關升級 2.5 版**：
    *   將單輪配對擴展為 **5 個經典臨床個案關卡**。
    *   實裝 **Confetti 噴泉特效**，當同工點擊回應並獲得高分 (>=8) 時，在滑鼠/觸控位置爆發彩色拋物線 DOM 粒子雨。
    *   加配 AI 臨床督導助教的詳細戰術分析面板。
*   **ICF WHO 生物-心理-社會模型互動圖**：展示 ICF 理論體系，配備 6 大範疇的典型就業案例對照。
*   **ICF 核心診斷 3D 閃卡**：解構 s, b, d, e, pf 等 ICF 代碼，引導如何在 SOAP 日誌中運用。
*   **ICF 診斷實戰沙盒 (Diagnostic Sandbox)**：
    *   **SSOT 數據相容**：動態讀取 `state.cases` 中案主（預設為阿強）的 `icf_factors`，完美支持未來 AI 產生的新案主。
    *   **雙重操控系統**：支援滑鼠 Drag-and-Drop 及平板流動端「選 tag -> 點目標 zone」的 Hybrid 輕觸吸附。
    *   **彈簧果凍動畫 (Spring Snap)**：正確分類觸發 `@keyframes spring-snap` 卡牌縮放彈入動畫與煙花。
    *   **左右震動警告 (Shake Warning)**：錯誤分類觸發 HSL 霓虹紅光與 `@keyframes shake` 左右抖動，標籤彈回 pool，並顯示 AI 臨床診斷校正提示。

#### 2. 儀表板「培訓星空駕駛艙」升級 (Phase 1 Upgrade)
*   **SVG 動態進度圓環**：理論進度 (68%)、對話時數 (45%)、個案精準度 (82%) 全部升級為 SVG 動態圓環。
*   **API 脈搏呼吸燈**：加入 `pulse-indicator-dot` 呼吸點，連線時閃爍翠綠色光暈，免密鑰時閃爍紫色呼吸光暈。
*   **特工個案檔案 (Dossier Layout) 推薦個案**：加入實體發光金黃五角星與微光掃描開始按鈕。
*   **同工金句激勵牆 (Empowering Therapist Carousel)**：儀表板頂部新增磨砂玻璃金句條，5 秒自動 Opacity Fade 輪播。
*   **能力值雷達圖縮影 (Dashboard Competence Radar)**：右側雷達圖卡片，懸停時觸發 `scale(1.05) rotate(2deg)` 視差發光反饋。
*   **快速挑戰盲盒 (Daily Mock Mystery Box)**：點擊 3D 🔮 塔羅卡牌盲盒觸發 360 度 `rotateY` 旋轉，隨機抽取案主與情緒因子，1.2 秒無縫合成情境並跳轉進艙。

### 🔧 故障修復與安全優化 (Fixed)
*   **修復 app.js 致命語法編譯錯誤 (Critical Syntax Error)**：
    *   *原因*：在 Phase 2 代碼替換邊界，在 `renderCaseArena(container)` 開頭殘留了一個重複且未閉合的函數簽名，導致瀏覽器 ES Module 編譯失敗，畫面卡在「加載中...」。
    *   *修正*：徹底移除了 lines 1559-1563 的殘留塊，將函數結構安全收尾。經 Grep 全局檢索，目前所有底層函數宣告皆為單一 SSOT，網頁加載 hang 徹底解決。
*   **修復定時器洩漏與 DOM 搶奪 (Memory Leak Patch)**：
    *   在全局 `state.quoteIntervalId` 中追蹤金句定時器。在 `renderDashboard()` 加載第一步，主動銷毀舊定時器，徹底解決 SPA 中頻繁進出儀表板導致多個定時器在背景搶奪 DOM 修改權的 Bug。
*   **修復盲盒異步轉場劫持 (Navigation Hijack Patch)**：
    *   在全局 `state.mysteryTimeoutId` 中追蹤盲盒 1.2 秒 setTimeout。在 `switchView()` 全局路由導航開頭，主動 `clearTimeout` 清除背景任務，完全防止同工在盲盒轉場期間點選其他選單時，視窗在 1.2 秒後依然被強行撕裂並劫持拉回輔導室的 Bug。
*   **Confetti DOM 拋棄與銷毀**：
    *   每次 Confetti 噴發產生的粒子 div，綁定自動銷毀計時器 `setTimeout(() => p.remove(), 1200)`，與 CSS 漸顯動畫完全對齊，確保 DOM 樹節點被徹底回收。

### 📦 變更檔案 (Files Changed)
*   [app.js](app.js): 重構 `renderTheoryHub`、`renderACTTab`、`renderMITab`、`renderICFTab`，新增巢狀 sub-tabs 操控、3D 閃卡、解離沙盒、MI 5關卡遊戲、Confetti 噴射器與 ICF 實戰沙盒。修復 `renderCaseArena` 語法殘留，實裝安全定時器清除。
*   [index.css](index.css): 追加 Phase 2 全套 CSS 設計系統（`.theory-sub-tab-group`, `.card-3d-wrapper`, `.card-front`, `.card-back`, `.defusion-container`, `.particle-dot`, `@keyframes spring-snap`, `@keyframes shake`, `.shake-warning`）。
*   [index.html](index.html): 更新快取破除參數為 `v20260523_v6`。
*   [mockData.js](mockData.js): 保持 `MOCK_THEORY_DATA.mi.oars_game` 的 5 關卡案例完整性，維持 SSOT。
