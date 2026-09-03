# Milestone 9 Plan: 可信賴的本地紀錄

* **Status**: Completed ✅ —— 建置 2026-09-02 10:24 HKT，同儕審查修正 11:38 HKT
* **Approved**: 2026-08-31 (HKT, UTC+8)
* **Roadmap Ref**: [Product Roadmap Milestone 9](../Product_Roadmap.md)
* **Traces to PRD v4**: `HARD CONSTRAINTS → SSOT`；`HARD CONSTRAINTS → Security & Secrets`；`HARD CONSTRAINTS → Usage Guardrail`
* **Closes drift**: `ARCHITECTURE.md` §7 **D8**、**D13**、**D16**、**D31**，以及同儕審查（2026-08-31）的 **C1**

> 本檔是本里程碑的建置 SSOT。日後修這一塊的 bug，先重新讀本檔。

---

## 1. 里程碑承諾

留下來的紀錄**彼此對得上**、**不多留不該留的東西**、**不會被別人塞東西進來**，而且同工**看得見自己的用量**。

路線圖原文：

> 儀表板顯示的完成場次，與保險箱裡實際存著的面談永遠一致，還原備份之後也不會出現互相矛盾的數字。設定頁的診斷日誌不再永久留下金鑰特徵與帳號識別 —— 把螢幕轉給督導看時，設定頁不會殘留這些痕跡。同時，設定頁會顯示同工今日還剩多少次 AI 呼叫額度…
> 另外堵上一個目前存在的破口：督導提示面板會執行 AI 回應中夾帶的網頁標記。同工若匯入了別人給的個案「基因碼」，那段內容有可能操縱模型輸出，進而在他的瀏覽器中執行 —— 而他的 API 金鑰就存在同一個瀏覽器裡。

PRD v4 對應三條：

> **SSOT**: One authoritative home per fact… the vault is the single durable home for sessions… Derived values — session counts, completion tallies, radar aggregates, progress milestones — are computed in one place **from the vault**.

> **Security & Secrets**: Provider API keys … are **never written to any persisted log** … **Model output is rendered as text, never as markup**, so **imported case content cannot reach the browser through it**.

> **Usage Guardrail**: A per-counselor daily cap on model calls, **shown in settings alongside the counselor's own key and remaining budget**.

## 2. 現況（2026-08-31 讀碼與實測所得，基準 `4410603`）

### 2.1 記憶體與保險箱不一致（C1）

`app.js:516` `persistCompletedSession()` 第一行就 `state.historySessions.unshift(session)` —— **在寫入之前**，且失敗不回滾。

實測（AI 評估成功、寫入保險箱失敗、不重試直接離開）：

```
保險箱：0 筆        畫面歷史卡：2 張
儀表板：「72分 | 分析平均得分 | 平均 72 分」
分析頁：「AI 即時回饋（練習參考）：你 2 場已評估面談的五維平均為 72 分。」
```

**更嚴重的是徽章**，因為它是持久的：同一情境下 `checkAndUnlockAchievements()` 依 `computeCounselorRecord(state.historySessions)` 判定，於是發出 `first_session` 與 `empathy_master`。重載之後保險箱 0 筆、歷史卡 0 張，**兩個徽章仍然「已解鎖」**，而且對帳不會收回 —— `m7_achievement_reconcile` 旗標已在首次開機寫入，只跑一次。

同工的徽章牆寫著「初試啼聲 已解鎖」，而他的紀錄裡一場面談都沒有。這正是 Milestone 7 要消滅的模式，由寫入失敗這條路徑重新製造。

**一項必須處理的相依**：`writeSessionToVault()` 的降級分支寫的是 `state.historySessions` **整個陣列**，因此它目前依賴 unshift 已經發生。把 unshift 移到寫入之後，這條路徑會沒有東西可寫。

### 2.2 診斷日誌永久留下金鑰特徵與帳號識別（D8）

`appendMiniMaxLog()`（`app.js:4563`）把日誌寫進 `localStorage["rehab_minimax_debug_log"]`（保留最後 50 行），設定頁的 `<pre>`（`app.js:6935`）在沒有記憶體日誌時直接讀該鍵顯示。

日誌內容包含：

| 行 | 內容 |
| :--- | :--- |
| `app.js:4600` | `🔑 金鑰特徵：${maskedKey}` —— 前 5 字元 ＋ 後 4 字元 ＋ 完整長度 |
| `app.js:4603` | `🔍 從 JWT 金鑰 Payload 中自動解析出 Group ID: ${autoGid}` —— **明文帳號識別** |

PRD：金鑰「are **never written to any persisted log**」。遮蔽後的特徵仍是金鑰衍生資訊，而 Group ID 是明文帳號識別。兩者都跨會話存活，把螢幕轉給督導時就在畫面上。

已確認**不在** `EXPORTABLE_SETTINGS`，因此不會進備份檔。

### 2.3 每日用量上限完全不存在（D13）

`geminiService.js` 的五個匯出函式全部經過唯一的網路出口 `callGeminiAPI()`（`geminiService.js:13`）。全檔案沒有任何計數器、上限或設定介面。同工在面談中途才發現額度用完，而那是他自費的金鑰。

`callGeminiAPI()` 內含 `retries = 3` 的重試迴圈，因此一次邏輯呼叫最多發出 4 次 HTTP 請求。

### 2.4 不受信任的內容會被當成標記執行（D16／D31，**範圍遠大於既有記錄**）

`ARCHITECTURE.md` §7 的 D31 只記了一處（`coachHint` 的 `innerHTML`）。系統性掃描後，實際範圍是 **48 處**：

| 來源 | 處數 | 代表位置 |
| :--- | :--- | :--- |
| 個案欄位（`name`／`health_condition`／`previous_job`／`avatar`／`age`／`gender`／`emotional_state`／`family` 等） | 25 | `app.js:2595`、`3154`、`2634` |
| ICF 因子 `f.text`（含**屬性值** `data-text="${f.text}"`） | 10 | `app.js:2677`、`5379` |
| 面談紀錄快照 `session.caseName`／`caseDiagnostic`／`caseAvatar` | 5 | `app.js:6287-6291` |
| AI 測驗題目與解析 `quiz.question`／`quiz.explanation` | 4 | `app.js:5772`、`5846` |
| AI 總結 `report.summary` | 2（渲染） | `app.js:5323`、`6751` |
| 逐字對話 `msg.text`（詳情彈窗） | 1 | `app.js:6765` |
| AI 督導提示 `coachHint` | 1 | `app.js:4391` |

**完整攻擊鏈已讀碼確認**：基因碼匯入（`app.js:3572-3598`）只檢查 `id`／`name`／`health_condition` 三個欄位**存在**，無白名單、無消毒，`JSON.parse(atob(code))` 的結果直接 `state.cases.unshift(decodedData)` 並 `persistCustomCases()` **永久寫入保險箱**。此後個案卡、下拉選單、面談室標題等處以模板字串插入 `innerHTML`。攻擊者交給同工一段基因碼，同工匯入即在其瀏覽器執行任意程式碼 —— 而 `rehab_gemini_api_key` 就在同一個 `localStorage`。

**這條路徑不需要經過模型**，比 D31 記錄的 `coachHint` 更直接。PRD 的措辭「so **imported case content** cannot reach the browser through it」正是針對它。

`renderChatBubble()` 使用 `textContent`（`app.js` 面談室氣泡）—— 那條路徑本來就是安全的，**歷史詳情彈窗**的 `${msg.text}` 才是破口。

### 2.5 已經正確、本次不動

- `completedCount`／`completedIds` 已於 Milestone 7 改為由 `sessions` 推導，還原時刻意忽略（`db.js:498-499`、`554`）。
- 備份檔排除三個金鑰（`EXPORTABLE_SETTINGS`），實測確認。
- 診斷日誌不在備份白名單。
- `renderChatBubble()` 的 `textContent`。
- Milestone 8 的 `escapeHtmlText()` —— 但它是 DOM-based 且**不 escape 引號**，對屬性值不安全（見 §3.4）。

## 3. 建置內容

### 3.1 記憶體只收下已經持久化的紀錄（C1）

`persistCompletedSession()` 反轉順序：**先寫入，成功才更新記憶體副本**。

```
persistCompletedSession(session):
  result = await writeSessionToVault(session)
  if (result.ok) state.historySessions.unshift(session)
  return result
```

`writeSessionToVault()` 的降級分支不能再依賴 unshift 已發生，改為先組出候選陣列再寫：

```
const candidate = [session, ...state.historySessions];
localStorage.setItem("rehab_sessions_history", JSON.stringify(candidate));
```

重試按鈕（`bindVaultRetryWrite()`）走同一條規則：`writeSessionToVault()` 成功後才 unshift。因為第一次失敗時沒有進記憶體，重試成功時的 unshift 是該筆的**唯一一次**加入 —— 不會重複。

連帶效果，全部是本里程碑要的：儀表板場次、分析頁統計、雷達彙總、徽章判定**全部只看已持久化的紀錄**，因為它們都讀 `state.historySessions`（經 `computeCounselorRecord()`）。寫入失敗的那場面談仍完整留在 `state.activeSession` 與畫面上，警示卡與重試按鈕不變。

### 3.2 診斷日誌不再留下任何金鑰或帳號痕跡（D8）

三件事一起做，缺一不可：

1. **不再持久化**：`appendMiniMaxLog()` 移除 `localStorage.setItem("rehab_minimax_debug_log", …)`；設定頁的 `<pre>` 只讀 `state.minimaxLogs`。日誌隨分頁關閉消失，符合「never written to any persisted log」。
2. **日誌內容本身不再含金鑰特徵與明文帳號**：
   - `🔑 金鑰特徵：${maskedKey}` → 改為只記錄**格式與長度**，不含任何字元片段（診斷需要的是「金鑰長度對不對、格式是 sk- 還是 JWT」，不是字元）。
   - `Group ID: ${autoGid}` → 改為只記錄「是否成功解析」，不輸出值。
   - 理由：即使不持久化，路線圖明訂「把螢幕轉給督導看時，設定頁不會殘留這些痕跡」—— 記憶體日誌一樣顯示在畫面上。
3. **一次性清除既有痕跡**：開機時 `localStorage.removeItem("rehab_minimax_debug_log")`。舊安裝的殘留若不主動清，會永遠留著。

### 3.3 每日用量上限（D13）

**單一計數點**：`callGeminiAPI()` 是唯一網路出口，五個匯出函式全部經過它。上限檢查與遞增都放在這裡，不散落到呼叫端。

- **計數單位**：一次**邏輯呼叫**（進入 `callGeminiAPI()` 一次）。內部的 3 次重試不另計 —— 同工感知的單位是「我送出了一句話」，而重試是實作細節。
- **遞增時機**：確定要發出請求時（呼叫前）。失敗的呼叫同樣可能計入 Google 的帳單，低估會讓「剩餘額度」這個數字失去意義。
- **超出上限**：不發出請求，拋出帶 `code: "DAILY_CAP_REACHED"` 的錯誤，訊息說明今日已用完、明天重置、可在設定頁調整上限。`app.js` 既有的錯誤處理會顯示它；面談室走 M8 的失敗路徑（留在房間、不丟資料）。
- **儲存**：`localStorage` 的 `rehab_daily_usage`，形狀 `{ date: "YYYY-MM-DD", count: N }`。日期不符即重置為當日。這是「今天用了幾次」這個事實的**唯一權威歸屬**，無法從別處推導，因此不違反 SSOT。
- **上限值**：`rehab_daily_call_cap`，預設 **200**。PRD 稱其為「**per-counselor** daily cap」，而在無帳號的單機架構下，per-counselor 唯一的意思就是「這位同工自己的上限」—— 用他自己的金鑰、付他自己的錢，因此在設定頁可調整（範圍 10–2000）。寫死一個數字會讓它變成開發者的上限而非同工的。
- **設定頁呈現**：依 PRD「shown in settings **alongside the counselor's own key and remaining budget**」，放在 Gemini 金鑰欄位**旁邊**，顯示「今日已用 N / 上限 M（尚餘 K 次）」與上限輸入欄，並說明明日自動重置。

由 `geminiService.js` 匯出 `getDailyUsage()` 與 `setDailyCap()` 供設定頁讀寫，計數邏輯不外洩到 `app.js`。

### 3.4 不受信任的內容一律以文字渲染（D16／D31）

新增純字串 escape：

```
function escHtml(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
```

**必須 escape 引號**，因為 `app.js:5379` 的 `data-text="${f.text}"` 是屬性值位置 —— 只 escape `<` 無法防住屬性逃脫。Milestone 8 的 `escapeHtmlText()` 是 DOM-based 且不處理引號，保留給錯誤訊息用，**不**用於本節。

**逐處包覆 §2.4 盤點出的 48 個插入點**，依來源分四批處理，每批完成後即時驗證：個案欄位 25 處、ICF 因子 10 處（含屬性值）、面談紀錄快照 5 處、AI 產物 8 處（測驗 4、總結 2、逐字 1、督導提示 1）。

`coachHint` 的 `innerHTML = coachHint.replace(/\n/g, "<br>")` 改為 `escHtml(coachHint).replace(/\n/g, "<br>")` —— 先 escape 再換行，換行仍然生效而標記失效。`report.summary` 兩處同法。

**刻意不 escape 的三處**：`app.js:5164`、`7686`、`7709` 是 Markdown **匯出**的純文字組裝，escape 會讓督導看到 `&lt;`。已逐一確認它們的輸出是檔案而非 DOM。

**不採用標記化模板（tagged template）**：既有 94 處 `innerHTML` 中有大量刻意插入的 HTML 片段（如 `${vaulted ? "<b>…</b>" : ""}`、巢狀 render 函式呼叫），標記化模板會一併 escape 它們，造成大範圍破壞。逐處包覆雖然瑣碎，但可逐一驗證且不誤傷。

**一律 escape，不區分受信任與否**：內建個案與匯入個案走同一條渲染路徑（都在 `state.cases`），試圖區分只會製造遺漏。對內建資料 escape 無副作用 —— 它們本來就不含標記。

### 3.5 匯入基因碼加上欄位白名單

§3.4 修的是渲染端。匯入端同樣要收緊，否則任意欄位（含未來新增的渲染點）都會被寫入保險箱永久保存：

`synthesis-import-btn` 的處理改為以**已知欄位白名單**重建物件（`id`、`name`、`gender`、`age`、`avatar`、`health_condition`、`previous_job`、`previous_job_zh`、`emotional_state`、`family`、`welfare`、`category`、`icf_factors`、`initial_dialogue`、`roleplay_flow`），並驗證型別（字串欄位必須是字串、`icf_factors`／`roleplay_flow` 必須是陣列）。未列入的欄位一律丟棄。

這不是 §3.4 的替代品而是縱深防禦：白名單擋住未知欄位，escape 擋住已知欄位裡的惡意內容。

### 3.6 快取戳記

`index.html` → `app.js?v=20260831_v27_m9`、`index.css?v=20260831_v27_m9`；`app.js` 頂部 → `geminiService.js?v=20260831_v27_m9`。`mockData.js` 與 `src/utils/db.js` 本次不改，戳記維持不變。

## 4. 風險審查結論

### 4.1 是否符合 PRD？（逐條對照）

| PRD 條款 | 本計劃如何滿足 | 檢查結果 |
| :--- | :--- | :--- |
| SSOT「the vault is the single durable home for sessions」 | §3.1 記憶體只收下已持久化的紀錄 | ✅ |
| SSOT「Derived values … computed in one place **from the vault**」 | §3.1 連帶讓場次、統計、雷達、徽章全部只反映保險箱內容 | ✅ 這是本節最直接對應的條款 |
| Security「never written to any **persisted** log」 | §3.2 移除 localStorage 持久化 ＋ 日誌內容不再含金鑰片段 | ✅ |
| Security「excluded from every exported file」 | 已成立（不在 `EXPORTABLE_SETTINGS`），本次不倒退 | ✅ 維持 |
| Security「**Model output is rendered as text, never as markup**」 | §3.4 全部 48 處插入點 | ✅ |
| Security「so **imported case content** cannot reach the browser through it」 | §3.4 ＋ §3.5 白名單 | ✅ PRD 明文點名的路徑 |
| Usage Guardrail「per-counselor daily cap on model calls」 | §3.3 單一計數點於 `callGeminiAPI()` | ✅ |
| Usage Guardrail「shown in settings **alongside the counselor's own key and remaining budget**」 | §3.3 置於金鑰欄位旁，顯示已用／上限／尚餘 | ✅ 逐字滿足 |
| Data Ownership「Any storage migration must verify records landed before removing the old copy」 | §3.1 正是這條原則套用到寫入路徑：先確認落地，才更新記憶體 | ✅ |
| No Claim Without Evidence「badge … computed from that counselor's own record」 | §3.1 修好徽章依記憶體發放的破口 | ✅ |
| Degradation Honesty | §3.1 不改 M8 的降級與警示卡；寫入失敗的措辭與重試不變 | ✅ 未倒退 |
| No Fabricated Clinical Content | 未觸及 AI 內容產生路徑；§3.4 只改渲染方式不改內容 | ✅ 未觸及 |
| AI Gateway & Validation「one round-trip … validated on arrival」 | §3.3 在 `callGeminiAPI()` 加計數，不改 schema、不改往返次數、不改驗證 | ✅ 未觸及 |
| Roles & Access「no login and no account」 | 用量計數是本機數字，不引入身分 | ✅ |
| Everyone Can Operate It | 新增的上限輸入欄為原生 `<input type="number">`，鍵盤可達、有 `<label>` | ✅ 不倒退 |
| Teaching Material Is Data | 未觸及 `mockData.js` | ✅ 未觸及 |

### 4.2 是否引入重複狀態、平行資料，或第二個歸屬？

**沒有。** 逐項說明：

- `escHtml()` 是純函式，不儲存。
- `rehab_daily_usage` 記錄「今天發了幾次呼叫」—— 這個事實**無法從任何既有資料推導**（面談紀錄不含失敗的呼叫、不含個案合成與測驗生成），因此 `localStorage` 是它的唯一權威歸屬，非副本。
- `rehab_daily_call_cap` 是設定值，屬 PRD 明訂的「Settings remain in simple local settings storage」。
- §3.1 **減少**了狀態不一致：`state.historySessions` 由「保險箱內容 ＋ 可能寫入失敗的紀錄」收斂為「保險箱內容」。
- §3.2 **刪除**一個持久化鍵。
- §3.5 白名單只是收窄既有物件，不新增歸屬。

### 4.3 是否會破壞現有功能或可用流程？

| 接縫 | 風險 | 已決定的處理 |
| :--- | :--- | :--- |
| `writeSessionToVault()` 降級分支依賴 unshift 已發生 | 反轉順序後 localStorage 分支寫不到新紀錄 | §3.1 改為先組候選陣列 `[session, ...state.historySessions]` 再寫；驗證步驟含降級模式實跑 |
| 重試按鈕的 unshift 時機 | 可能重複加入 | 第一次失敗未進記憶體，重試成功時是唯一一次加入；驗證步驟明列「重試後畫面與保險箱皆為 1 筆」 |
| 徽章判定時機 | 現行在 `persistCompletedSession()` 之後、依 `state.historySessions` | 順序不變，但此時記憶體只含已持久化紀錄，判定自然正確 |
| 五個 AI 函式加上限 | 任一函式的既有錯誤處理未涵蓋新錯誤碼 | `DAILY_CAP_REACHED` 帶 `code`，沿用既有 `error.message` 顯示路徑；面談室走 M8 的失敗路徑（留在房間、資料不失） |
| 上限阻擋離線模式 | 離線示範不呼叫 API 卻被擋 | 計數點在 `callGeminiAPI()` 內，離線分支根本不進入該函式 |
| 48 處 escape 可能誤傷刻意的 HTML | 版面破壞 | 只包覆 §2.4 盤點出的**資料欄位**，不動同一模板中的標記；分四批建置，每批後截圖驗證 |
| Markdown 匯出被誤 escape | 督導看到 `&lt;` | §3.4 明列三處匯出點不 escape，並在驗證步驟檢查匯出檔內容 |
| `escapeHtmlText()` 與 `escHtml()` 並存 | 兩個 escape 函式易誤用 | 用途分開並註明：前者供錯誤訊息（DOM-based，元素內容位置），後者供資料渲染（含引號，兩種位置皆安全） |
| 白名單丟棄舊個案的未知欄位 | 既有匯入個案的欄位遺失 | 白名單只作用於**匯入當下**，不改動保險箱既有紀錄；欄位清單涵蓋 `mockData.js` 個案物件的全部 14 個欄位 ＋ `previous_job_zh`／`diagnostic` |
| 日誌不再持久化 | 同工重開分頁後拿不到日誌給支援 | 日誌本來就是即時診斷用（按「測試發音」即重新產生）；且 PRD 明令金鑰不得寫入持久日誌 |
| 一次性清除舊日誌鍵 | 誤刪其他資料 | 只 `removeItem` 單一鍵 `rehab_minimax_debug_log` |

### 4.4 是否修改已存有資料的資料表？

**沒有修改 object store。** `DB_VERSION` 維持 **1**，三個 store（`sessions`、`custom_cases`、`app_meta`）的名稱、keyPath 與內容格式完全不變，`onupgradeneeded` 一字不改，**不需要 migration，不刪表重建**。

`localStorage` 層面有兩項變更，均明確標示：

1. **`rehab_minimax_debug_log` 會被刪除**（§3.2 第 3 點）。這是**刻意的資料移除**，因為該鍵的內容正是 PRD 禁止持久化的金鑰特徵與帳號識別。它不含任何同工的工作產物 —— 不是面談紀錄、不是個案、不是進度。刪除即是本里程碑的目的本身。
2. **新增兩個鍵** `rehab_daily_usage` 與 `rehab_daily_call_cap`。純新增，不觸及既有鍵。

§3.5 的白名單**不改寫保險箱內既有的自定義個案** —— 它只作用於匯入當下的新物件。既有個案即使含未知欄位也原樣保留。

### 4.5 邊界情況

| 情況 | 處理 |
| :--- | :--- |
| 寫入保險箱失敗 | 記憶體不收下 → 儀表板／分析頁／徽章都不反映它；面談仍在畫面上，警示卡與重試按鈕不變 |
| 重試成功 | 此時才 unshift，畫面與保險箱同時變為含該筆 |
| 寫入失敗後直接離開 | 記憶體與保險箱一致（都沒有）；同工已被守衛警告過會失去 |
| 降級模式寫入成功 | 候選陣列寫入 localStorage 後才更新 `state.historySessions` |
| 降級模式寫入失敗（配額滿） | 記憶體不收下，與 IndexedDB 路徑行為一致 |
| 用量跨日 | `date` 不符即重置為當日並歸零 |
| 系統時間被調整 | 以 `toLocaleDateString` 的當地日期字串比對；調早會提前重置，屬同工自己的機器，不設防 |
| 上限設為 0 或負數 | 輸入欄限制 10–2000，超出範圍還原為前一個有效值並提示 |
| 上限已滿時進入面談室 | 面談室可進入，送出時才擋 —— 與離線示範一致，不在入口處預先封鎖 |
| 上限已滿時按「結束會話」 | 走 M8 的評估失敗路徑：留在房間、逐字紀錄與筆記完好、可匯出 |
| 個案 `name` 含 `<script>` | 渲染為文字，畫面顯示原字串；保險箱內容不變（escape 只在渲染層） |
| 個案 `icf_factors[].text` 含引號 | `data-text` 屬性以 `&quot;` escape，拖放判定讀 `dataset.text` 得到原字串 |
| 匯入的基因碼含未知欄位 | 白名單丟棄，並在 alert 中如實說明已匯入哪些欄位 |
| 匯入的基因碼欄位型別錯誤 | 驗證失敗即拒絕匯入，顯示真實原因 |
| 既有保險箱內含惡意個案（本次修正前匯入） | §3.4 的渲染層 escape 對它同樣生效 —— 這是為什麼渲染層修正不可省略 |

## 5. 驗證步驟

1. `python3 check_syntax.py` 全綠。
2. **C1 主場景**：完整面談 → 評估成功 → 令寫入失敗 → 確認 **(a)** 保險箱 0 筆且畫面歷史卡 0 張、**(b)** 儀表板顯示 `—／尚未評估` 而非虛構分數、**(c)** 分析頁不聲稱有已評估面談、**(d)** **徽章未發出**、**(e)** 面談仍在畫面上且警示卡與重試按鈕俱在、**(f)** 匯出可用。
3. **C1 重試**：按「重試寫入保險箱」→ 保險箱 1 筆、畫面 1 張卡、徽章此時才發出、守衛放行。
4. **C1 重載後一致**：寫入失敗後重載 → 保險箱、畫面、徽章三者一致（皆為零）。
5. **C1 降級模式**：切至 `localstorage-fallback`，重跑 2 與 3。
6. **C1 正常路徑回歸**：寫入成功時場次、統計、徽章與現行完全一致。
7. **D8**：按「測試發音」產生日誌 → 檢查 **(a)** `localStorage` 無 `rehab_minimax_debug_log`、**(b)** 畫面日誌不含金鑰任何字元片段、**(c)** 不含明文 Group ID；預先植入舊日誌鍵後重載 → 已被清除。
8. **D13 計數**：連續發出 3 次 AI 呼叫 → 設定頁顯示「今日已用 3」；改上限為 3 → 第 4 次被擋且錯誤訊息正確；面談室觸發上限 → 留在房間、資料不失；離線模式下計數**不**增加；跨日重置以偽造 `date` 驗證。
9. **D16／D31 逐批驗證**：以 `name` 為 `<img src=x onerror="window.__XSS=1">` 的個案，逐一檢查個案大廳卡片、下拉選單、面談室標題、ICF 沙盒（含 `data-text` 屬性逃脫）、歷史卡片、詳情彈窗、完成畫面 —— 每處確認 `window.__XSS` **未定義**且畫面顯示原字串。
10. **AI 產物**：以含標記的 `coachHint`、`report.summary`、`quiz.question` 走一次流程，確認不執行且換行仍正確。
11. **匯出不受影響**：Markdown 匯出檔內容不含 `&lt;`／`&amp;`，逐字紀錄與總結保持原樣。
12. **§3.5 白名單**：匯入含額外欄位（如 `__proto__`、`onclick`）的基因碼 → 被丟棄；型別錯誤 → 拒絕並說明。
13. **回歸**：M5 單次結構化往返與缺欄位拋錯；M6 離線劇本標示與離線完成畫面；M7 空／混合情境的數字與無字母等第；M8 守衛六態、覆蓋層失敗可退回、開機三態、寫入失敗警示卡；備份匯出→清空→還原往返一致且無金鑰。
14. **主控台**：乾淨載入零輸出。
15. **深淺主題**：設定頁新增的用量區塊兩種主題實測截圖。

## 6. 本節**不**處理（明確界線）

| 項目 | 理由 |
| :--- | :--- |
| D35（`onabort` 不獲勝） | IndexedDB 事件順序的固有行為，中止已能正確 settle |
| D39（降級橫幅不在面談室） | 已判定可接受 |
| N1（`persisted.reason` 未 escape） | §3.4 一併處理 —— 它是同一類問題，且落在同一批程式碼裡 |
| N2（`normalizeTheoryProgress` 丟棄額外鍵） | 今日無額外鍵；屬 M8 補完的已記錄事項，不在本里程碑承諾內 |
| N3（`renderVaultDegradedBanner` 在 try 外） | 同上，M8 範疇 |
| 面談室淺色主題 | `ARCHITECTURE.md` §8 既有議題 |
| 可及性基線（D24）、逐題練習紀錄（D26）、`coachHint` 寫入匯出（D27）、教材資料化（D29）、移除 EN／简中（D22） | 各屬獨立能力，尚未排入里程碑序列 |
| 面談草稿續接 | PRD OUT OF SCOPE |

## 7. 建置前已知的非顯然決定

上限預設 200 並讓同工可調（10–2000），因為 PRD 稱其為「per-counselor」，而在無帳號的單機架構下那只能指「這位同工自己的上限」—— 用他自己的金鑰、付他自己的錢，寫死一個數字會讓它變成開發者的上限；用量以**邏輯呼叫**計數而非 HTTP 請求，因為同工感知的單位是「我送出了一句話」，內部重試是實作細節；遞增在呼叫**前**而非成功後，因為失敗的請求同樣可能計入 Google 帳單，低估會讓「尚餘額度」失去意義；診斷日誌同時做「不持久化」與「內容不含金鑰片段」兩件事，因為路線圖要求的是「把螢幕轉給督導看時不殘留痕跡」，而記憶體日誌一樣會顯示在畫面上；48 處逐一包覆 escape 而不採標記化模板，因為既有模板中有大量刻意插入的 HTML，標記化會一併 escape 造成大範圍破壞；一律 escape 而不區分受信任與否，因為內建個案與匯入個案走同一條渲染路徑，試圖區分只會製造遺漏；匯入白名單與渲染 escape 兩者都做，因為前者擋未知欄位、後者擋已知欄位裡的惡意內容，而保險箱裡可能已經存著本次修正前匯入的惡意個案 —— 只做白名單救不了它們。


---

## 8. 驗證結果（2026-09-02 10:24 HKT）

| 步驟 | 結果 |
| :--- | :--- |
| `check_syntax.py` | ✅ 全數通過 |
| **§5.2 C1 主場景** | ✅ 寫入失敗時：保險箱 0 筆、歷史卡 0 張、儀表板 `—／尚未評估`、分析頁「尚無已評估的面談紀錄」、雷達無多邊形、**徽章 `[]` 未發放**、面談仍在畫面上且警示卡與重試鈕俱在、匯出可用。`CONSISTENT: true` |
| **§5.3 C1 重試** | ✅ 重試後保險箱 1 筆、畫面 1 張卡、`NO_DUPLICATE: true`、卡片轉綠、守衛放行 |
| **§5.5 C1 降級模式** | ✅ 候選陣列寫法正確：連續兩筆後記憶體 2 筆、localStorage 2 筆、順序一致（`session_deg_2` 在前） |
| **§5.6 C1 正常路徑** | ✅ 寫入成功時場次、統計、徽章與現行一致 |
| **§5.7 D8** | ✅ 植入舊日誌鍵後重載 → **已清除**；實際驅動 `fetchMiniMaxTTSAudio` 產生日誌 → `persistedLog: null`、無金鑰字元片段、無 `****` 遮蔽樣式、無明文 Group ID；日誌行為 `🔑 金鑰已提供（JWT 格式，長度 76）` |
| **§5.8 D13 計數** | ✅ 3 次呼叫後 `used: 3`；用量推至上限後 `DAILY_CAP_REACHED` 且**四個函式全部被擋**（`generateClientReply`／`generateSessionReport`／`generateCustomQuiz`／`generateSoapSuggestions`）；被擋時不遞增；上限夾制（1→10、99999→2000）；跨日重置歸零；**離線示範不計數**（送出一輪後 `used` 仍為 0） |
| **§5.9 XSS 逐處** | ✅ 以含 `<img onerror>` 的惡意個案（植入保險箱，模擬修正前已匯入）走遍**七個渲染位置**：個案大廳、小組研討下拉、ICF 理論頁、ICF 沙盒、面談室、完成畫面、歷史卡片、詳情彈窗逐字對話 —— **`window.__XSS` 全程為 0**，payload 一律以文字顯示 |
| **§5.9 屬性值** | ✅ `data-text` 未逃脫，且 `dataset.text` 讀回**原字串** —— 拖放判定不受影響 |
| **§5.10 AI 產物** | ✅ `coachHint` 含 payload → 零觸發且 `<br>` 換行仍生效；`report.summary` 同樣零觸發、換行正常、報告完整渲染 |
| **§5.11 匯出未被誤 escape** | ✅ Markdown 含原樣 `<b>粗體</b>`，無 `&lt;`／`&amp;` |
| **§5.12 白名單** | ✅ 未知欄位（`unknownField`／`onclick`／`scriptTag`）全部丟棄；`__proto__` 未污染原型；`icf_factors` 清理為只含 `text`／`type` 且過濾無效項；`roleplay_flow` 同時接受字串與 `{text}` 物件並過濾其餘 |
| **§5.13 回歸** | ✅ M5 單次往返（`callCount: 1`）與缺欄位拋錯；M6 離線劇本；M7 空保險箱數字；M8 守衛與警示卡 |
| **§5.14 主控台** | ✅ 乾淨載入零輸出 |
| **§5.15 主題** | ✅ 面板標題／說明文字兩主題皆跟隨（深 `rgb(255,255,255)`／淺 `rgb(15,23,42)`）；截圖確認面板緊鄰金鑰欄位 |

### 建置期間抓到並修正的問題

**模組層 `const` 再次踩到 TDZ 的教訓已生效。** `escHtml()` 與 `normalizeTheoryProgress()` 都寫成函式宣告（會 hoist），清單放在函式**內部**，因此 `state` 初始化呼叫它們不會出錯。

**一條寫了但永遠不會生效的 CSS。** 原本加了 `[data-theme="light"] .daily-usage-cap-input`，但量測發現設定頁既有的 `.form-group input` 特異度更高，且**在兩個主題下都是深底白字** —— 對照組（Gemini 金鑰輸入框）行為完全相同。若強行讓我的輸入框變淺色，它會與旁邊的金鑰欄位長得不一樣，比一致地沿用既有樣式更糟。該規則已移除並在 CSS 中註明理由；整個設定頁的淺色主題屬 `ARCHITECTURE.md` §8 的設計系統工作。

**測試設計錯誤一次。** 初次測上限阻擋時用 `setDailyCap(3)`，但 3 被正確夾制到下限 10，因此第 4 次呼叫本就不該被擋 —— 是測試錯不是程式錯。改以「把用量推到上限」重測後通過。

### 未執行
真實 Gemini 金鑰端對端；MiniMax TTS 的成功路徑（僅驗證 2049 失敗分支的日誌內容）；連續 STT；ICF 沙盒的完整拖放評分流程（只驗證屬性值與 `dataset` 讀回）；理論 Hub 閃卡與 ACT／ICF 自測；AI 個案合成的完整流程（`generateCustomCase` 只驗證計數）；SOAP 助手抽屜；Phase 13 督導干預注入；用量面板在**真實跨日**的重置（以偽造 `date` 驗證）。


---

## 9. 同儕審查修正（2026-09-02 11:38 HKT）

審查發現一項 CRITICAL 並在追查時牽出四項同源遺漏。全部已修並實測。

### 9.1 匯入白名單吃掉個案的離線劇本（審查的 C1）

`sanitizeImportedCase()` 處理 `roleplay_flow` 時只找 `x.text`，但真實形狀是 `{ user, ai_reply, coach_hint }` —— **沒有 `text` 欄位**。撰寫計劃時我盤點了個案的頂層欄位，卻沒有讀這個陣列的內部結構。

後果（實測完整使用者路徑）：分享阿強的基因碼 → 匯入顯示「🎉 成功導入」→ 保險箱內 `roleplay_flow: []` → 離線點進去顯示「此個案未附示範劇本，無法對話」。**3 回合劇本被匯入流程吃掉，而訊息說成功。**

修法：依真實形狀逐欄位清理。`ai_reply` 與 `coach_hint` 皆須為非空字串該回合才算有效 —— 缺督導提示會讓面板空白而不說明原因，違反 PRD「hint visible by default on arrival」。`user` 欄位程式碼目前未讀取，但屬教材內容，原樣保留而非悄悄丟棄。

匯入提示同時改為據實告知：原本 `droppedCount` 只數頂層鍵，劇本被丟時 `roleplay_flow` 仍以空陣列存在，同工看不到任何線索。

**驗證**：七個內建個案的劇本逐一比對，`_ALL_PRESERVED: true`，形狀與內容逐字相符；走完整 UI 路徑匯入阿強 → 劇本 3 回合完整 → 離線可對話，劇本標示與督導提示正確；故意弄壞兩個回合（一缺 `coach_hint`、一缺 `ai_reply`）→ 提示明說「2 個回合格式不完整…保留 1 個回合」。

### 9.2 追查時牽出的四項 escape 遺漏

修 C1 後重跑安全掃蕩，`completion: 1` —— **離線完成畫面觸發了 XSS**。根因是我在建置與審查時**兩次**把同一處判成「匯出純文字」：

`historyText` 這個變數名在檔案中出現兩次，用途完全不同 —— `app.js:5300` 組出的進 `<pre>` 的 `innerHTML`，`app.js:7893` 組出的進 Markdown 匯出。我 grep 時看到 `.map(h => ...)` 就認定是匯出，沒有追它的去向。

改用「先找 innerHTML 模板、再看模板內未 escape 的資料插入」的掃法（而非依欄位名 grep），找出四處：

| 位置 | 內容 | 為何漏掉 |
| :--- | :--- | :--- |
| `app.js:5326` | 離線完成畫面的逐字回顧 | 中介變數 `historyText`，與匯出同名 |
| `app.js:5331` | 同畫面的面談日誌 | 同工自己的輸入，先前未列為「不受信任」 |
| `app.js:5466` | 報告頁的日誌備份 | 同上 |
| `app.js:6915` | 詳情彈窗的 SOAP 分頁 | 同上 |

再以「掃 innerHTML 模板內所有含資料欄位的插入」複查，又找出三處：

| 位置 | 內容 | 判定 |
| :--- | :--- | :--- |
| `app.js:1608` | 隨機盲盒的 `randomCase.name` | 來自 `state.cases`，**包含匯入的個案** —— 必須修 |
| `app.js:5649` | ICF 拖放因子讀回的 `data-text` | **寫入側已 escape、讀回側漏了** —— 拖放時攻擊仍成立 |
| `app.js:7137` | 瀏覽器語音名稱 `v.name` | 系統提供而非同工輸入，低風險，一致處理 |

`app.js:5649` 最值得記：Milestone 9 escape 了寫進 `data-text` 屬性的那一側，卻沒有處理 `getAttribute("data-text")` 讀回來又插進 `innerHTML` 的那一側。**只做一半的 escape 等於沒做。**

同一輪掃描確認 18 處 `state.theoryProgress.*` 是布林轉 CSS 變數名（非資料插入）、`opt.text`／`ach.name`／`node.name` 等來自 `mockData.js`（教材，受信任且可能刻意含格式），皆不需處理。

**驗證**：以含 `<img onerror>` 的惡意個案（植入保險箱）走遍儀表板盲盒、個案大廳、ICF 沙盒（含**實際拖放**）、面談室、劇本回合、完成畫面、歷史卡片、詳情彈窗 SOAP 分頁 —— `window.__XSS` 全程 **0**。另測同工在筆記中貼入標記，同樣以文字顯示。

### 9.3 回歸與未受影響

正常路徑完整重跑：面談 3 氣泡、督導提示、報告頁雷達、筆記正常顯示、AI 總結的 `<br>` 換行仍生效、保險箱 1 筆、用量正確計 2 次。Markdown 匯出實測**無** `&lt;`／`&amp;`／`&quot;`，筆記原樣保留。乾淨載入主控台零輸出。

`index.css` 本輪未改動，戳記維持 `v20260831_v27_m9`；`app.js` 改為 `v20260902_v28_m9fix`。

### 9.4 本次仍未測試
真實 Gemini 金鑰端對端；MiniMax TTS 成功路徑；連續 STT；ICF 沙盒的完整評分結算；理論 Hub 閃卡與自測；MI 闖關；小組研討完整答題；AI 個案合成完整流程；SOAP 助手抽屜；Phase 13 干預注入；真實跨日的用量重置。
