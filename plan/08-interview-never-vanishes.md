# Milestone 8 Plan: 不會憑空消失的面談

* **Status**: Completed ✅ —— 建置 2026-08-30，審查 2026-08-31 13:28 HKT，補完 2026-08-31 15:23 HKT
* **Approved**: 2026-08-30 HKT (UTC+8)
* **Roadmap Ref**: [Product Roadmap Milestone 8](../Product_Roadmap.md)
* **Traces to PRD v4**: `USER JOURNEY 4`（drafts safe from accidental loss）；`SUCCESS`（「attempts to leave the page mid-interview and is stopped by a warning」）；`HARD CONSTRAINTS → Data Ownership & Durability`（「the interface must never claim a draft is saved or backed up when it is not」）；`HARD CONSTRAINTS → Degradation Honesty`
* **Closes drift**: `ARCHITECTURE.md` §7 **D6**、**D6′**

> 本檔是本里程碑的建置 SSOT。日後修這一塊的 bug，先重新讀本檔。

---

## 1. 里程碑承諾

兩件事，同一個原則 —— **不要在同工不知情的狀況下弄丟他的東西**：

1. 未完成的面談不會憑空消失。誤關分頁、重新整理、或在側欄點去別的頁面，系統都會先攔截並說明會失去什麼。筆記區那個綠色「已安全備份」是不實陳述，必須移除。
2. 程式一定打得開。本機儲存無法使用或**沒有回應**時，平台明白說出狀況並讓同工繼續使用，不會無聲卡在「加載中...」。

PRD v4 原文（三條）：

> **USER JOURNEY 4**: Draft SOAP notes and ICF biopsychosocial classifications during the interview, **with drafts safe from accidental loss**.

> **Data Ownership & Durability**: In-progress SOAP and ICF drafts must be protected against accidental loss for as long as they exist only in the interview view, and **the interface must never claim a draft is saved or backed up when it is not**.

> **Degradation Honesty**: If durable storage is unavailable **or unresponsive**, the application says so plainly and **stays usable**; it must never sit on an **indefinite loading state with no explanation and no way forward**.

## 2. 現況（2026-08-30 讀碼與實測所得，基準 `3322b12`）

### 2.1 未完成的面談會靜默消失

| # | 位置 | 現況 |
| :--- | :--- | :--- |
| A | `app.js`、`index.html` | `beforeunload` 出現 **0 次**（實測 `grep -c`）。關分頁或重新整理，逐字對話與 SOAP／ICF 草稿全部消失，無任何提示。這同時使 PRD **SUCCESS 條款走不完** —— 該條文明訂同工「attempts to leave the page mid-interview and is stopped by a warning」 |
| B | `app.js:730-741` `initNavigation()` | 側欄任何一項都直接 `switchView(target)`，面談中點「儀表板」即刻銷毀整場面談，不問一句。且 `active` class 在 `switchView` **之前**就換掉，任何攔截都必須連帶處理高亮 |
| C | `app.js:3636`、`3807` | 筆記區恆亮綠點寫「**已安全備份**」；輸入時走「同步中... → 已安全備份」動畫。草稿實際只在 `state.activeSession.notes`，**從未寫入任何持久層**。這是 PRD 明文禁止的不實陳述（D6′） |
| D | `app.js:4620-4626` | 有金鑰但評估報告生成失敗時，`alert()` 之後直接 `switchView("arena")` —— **整場面談連同筆記被程式自己丟掉**，同工沒有機會重試或匯出。此路徑先前把 mount 換成「正在評估你的輔導技巧...」，房間 DOM 已被覆蓋，無法退回 |
| E | `app.js:3502`、`6727` | `state.activeSession` 只在危險區重設時才回 `null`。做完一場面談後它一直留著，因此**不能**用「activeSession 是否存在」當作「面談進行中」的判斷 |

### 2.2 程式可能永遠打不開

`src/utils/db.js` 的每一個 Promise 都**沒有逾時、沒有 `onblocked`、沒有 `onabort`、沒有 `onversionchange`**（`grep` 全檔：`onblocked` 0 次、`versionchange` 0 次、`onabort` 0 次）。

**實測重現（於瀏覽器中執行，非推論）**：

| # | 路徑 | 實測結果 |
| :--- | :--- | :--- |
| F | `open()` 遇到 `blocked` | 持有一個 v1 連線不放，再以 `db.js` **完全相同的寫法**開 v2：`onblocked` 事件**有觸發**，`onsuccess` 與 `onerror` **5 秒內完全沒有 settle**。`await this.open()` 永遠不返回 → `hydrateVault()` 永遠不返回 → `switchView("dashboard")` 永遠不執行。且持有端沒有 `onversionchange`，永遠不會自己讓路 —— 這是**永久**卡死，不是暫時等待 |
| G | `clearAll()` 的交易被中止 | 只掛 `tx.oncomplete` / `tx.onerror`。實測 `tx.abort()`：`onabort` 觸發，另外兩者**都沒有**，3 秒內未 settle。危險區重設與備份還原都走這條 |
| H | 使用者實際看到的畫面 | `#content-view-mount` 是**空的**，只有頂欄兩行靜態文字「加載中... / 請稍候...」。實測：**沒有** spinner、**沒有**錯誤訊息、**沒有**任何按鈕。與 PRD「indefinite loading state with no explanation and no way forward」逐字吻合 |

**關於路線圖「開兩個分頁就可能觸發」的更正**：實測今日開兩個分頁**不會**卡死 —— `DB_VERSION` 始終為 1，不需升級就不會 `blocked`。此缺陷目前是**已上膛但未擊發**：任何一次 schema 變更把 `DB_VERSION` 調到 2，所有開著兩個分頁的同工就會永久卡死在「加載中...」。另兩條路徑（G 的中止、以及背景分頁被瀏覽器凍結導致 IndexedDB 不回應）今日即可觸發。PRD 的「unresponsive」條款不論觸發方式為何都要求修復，故本里程碑照修，並在此據實記錄路線圖那句話的精確狀態。

### 2.3 已經正確、本次不動

- 降級模式的偵測與設定頁紅字提示（`hydrateFromLocalStorageFallback()`、`app.js:6454`）。
- ADR-0005 遷移「先驗證後刪除」的順序。
- 「放棄返回」按鈕已有 `confirm()`。
- M6 的離線劇本攔截：`renderOfflineScriptUnavailable()` 在建立 session **之前**就 return，不會留下半個面談。

## 3. 建置內容

### 3.1 「面談進行中且尚未入庫」的單一述詞

```
function hasUnsavedInterview() {
  const s = state.activeSession;
  return !!(s && !s.vaultedAt && (
    (s.history && s.history.length > 0) ||
    (s.notes && (s.notes.soap.trim() || s.notes.icf.trim()))
  ));
}
```

`vaultedAt` 於 `endRoleplaySession()` 中 `await persistCompletedSession(completedSession)` **成功之後**寫入 `state.activeSession.vaultedAt`（單一位置，離線無評估與有評估兩條路徑共用同一個 persist 呼叫）。

三個判斷條件各自有其必要：`activeSession` 存在（§2.1 E 說明它不會自己歸零）；尚未入庫（入庫後報告頁仍需讀 `activeSession`，故不能改成設 `null`）；**有東西可失去**（剛進房、一句話都沒講、一個字都沒寫時攔截，只會訓練同工無視警告）。

### 3.2 關閉分頁／重新整理的攔截（`beforeunload`）

於 `initApp()` 註冊一次：

```
window.addEventListener("beforeunload", (e) => {
  if (!hasUnsavedInterview()) return;
  e.preventDefault();
  e.returnValue = "";
});
```

瀏覽器一律顯示自己的標準措辭，不接受自訂文字 —— 因此**不**嘗試傳字串。條件不成立時完全不介入，不對一般瀏覽造成任何摩擦。

### 3.3 應用內離開的攔截（側欄與其他 `switchView` 呼叫點）

`switchView(viewName, opts = {})` 新增第二參數並**回傳布林值**（`false` = 被取消）。守衛置於函式最前端 —— 十一個呼叫點集中受同一條規則保護：

```
if (!opts.skipUnsavedGuard && hasUnsavedInterview() && viewName !== state.activeView) {
  if (!confirm("本次面談尚未完成，離開會失去逐字對話與 SOAP／ICF 草稿，且無法復原。\n\n確定離開嗎？")) return false;
}
```

`initNavigation()` 改為**先**呼叫 `switchView(target)`，只有回傳 `true` 才移動 `active` 高亮 —— 修正 §2.1 B 的高亮先行問題。

三處必須傳 `skipUnsavedGuard: true`，理由逐一列明：

| 呼叫點 | 理由 |
| :--- | :--- |
| `app.js:302` 語系切換的 `switchView(state.activeView)` | 這是**重繪**不是離開，同一個 view。（另註：`switchView` 沒有 `case "roleplay"` 也沒有 `default`，面談中切語系本來就不重繪房間 —— 屬既有小瑕疵，不在本里程碑範圍，但守衛不得因此誤攔） |
| `rp-abort-btn`「放棄返回」 | 已有自己的 `confirm()`，不得連問兩次 |
| `renderOfflineScriptUnavailable()` 的返回鈕（`app.js:4585`） | 該路徑未建立 session，述詞本就為 `false`；顯式標註以免日後誤改 |

`viewName !== state.activeView` 這一條防止「已在房間中又點一次同一項」被誤攔。

### 3.4 評估失敗不再丟掉整場面談（§2.1 D）

「正在評估你的輔導技巧...」不再以 `mount.innerHTML = ...` **覆蓋**面談房間，改為在 mount 之上疊一層 `#rp-evaluating-overlay`（`position:absolute` 覆蓋層，帶 spinner 與說明文字）。

- 成功 → 移除覆蓋層，照常 `renderSessionReport()`。
- 失敗（有金鑰但呼叫出錯）→ 移除覆蓋層，`alert()` 真實錯誤，**留在房間裡**。逐字對話、SOAP、ICF、干預佇列全部原封不動，同工可以重試「結束會話」或按「放棄返回」（該鈕會確認）。不再 `switchView("arena")`。

這是本節唯一可行的正確作法：房間 DOM 一旦被覆寫就無法還原，而重新呼叫 `startRoleplaySession()` 會**重建** `state.activeSession`、抹掉全部內容。用覆蓋層取代覆寫，是把「不可退回」變成「可退回」的根本修法，不是繞路。

### 3.5 移除不實的「已安全備份」（§2.1 C）

刪除綠點與「同步中... → 已安全備份」整個狀態機（`app.js:3634-3637`、`3790-3809`）。改為一條**恆常為真**的狀態列：

> 🟠 草稿只存在於此分頁 · 面談結束並生成報告後才寫入保險箱

輸入事件仍照舊把內容寫進 `state.activeSession.notes`（那是真的），但**不再**播放任何暗示「已儲存」的動畫或字樣。

刻意**不**改為自動存草稿：PRD OUT OF SCOPE 明訂「Resuming an interrupted interview… before that, the counselor is warned but not rescued」。本里程碑的職責是把話講真、把離開攔下，不是加上 PRD 排除的續接能力。

配套刪除 `index.css` 的 `@keyframes pulse-amber-dot`（全檔唯一使用者就是這個狀態機）。

### 3.6 `db.js`：每一個等待都有界

新增內部工具 `settleWithin(executor, ms, code)`，所有對外方法一律經它包裝。逾時 reject 一個帶 `code` 的 Error，不再無聲等待。

**`open()` 補齊四個缺口**：

1. `request.onblocked` → 立即 reject `VAULT_BLOCKED`（不必等逾時，事件已明確告知原因）。
2. 8 秒硬逾時 → reject `VAULT_TIMEOUT`。
3. 連線成功後掛 `db.onversionchange = () => { db.close(); this.db = null; }` —— 本分頁永遠不阻擋其他分頁升級。**這一行是讓未來任何 `DB_VERSION` 升級變安全的關鍵**。
4. `db.onclose` → 清掉 `this.db` 快取，下次呼叫重新開啟，不會拿著死連線一直失敗。

**`clearAll()`（以及所有以交易為單位的方法）補上 `tx.onabort`** → reject `VAULT_ABORTED`（§2.2 G 實測證實這條今日就會掛死）。

所有 `req.onerror` 保留不動 —— 實測確認進行中的請求在中止時**確實**會經 `req.onerror` 浮現，那條路徑本來就是好的。

### 3.7 開機一定會結束

`hydrateVault()` 整段納入界限：任何一步逾時或被阻擋，都落入降級並繼續開機，`switchView("dashboard")` 一定會執行。

新增 `state.vaultDegradedReason`（`null` | `"unavailable"` | `"blocked"` | `"timeout"` | `"error"`），因為**「不能用」和「沒回應」對同工的意義完全不同**：

- `unavailable`（無痕模式等）：IndexedDB 真的用不了，localStorage 降級是對的答案。
- `blocked` / `timeout`：紀錄**很可能好端端在 IndexedDB 裡**，只是現在讀不到。此時若只說「降級模式」而讓歷史顯示為空，同工會合理地以為資料沒了 —— 那是本平台最不該給的錯誤印象。

### 3.8 開機畫面說人話，且永遠有出路

1. **立即**把載入狀態渲染進 `#content-view-mount`（spinner ＋「正在開啟本機保險箱…」），消滅 §2.2 H 的空白區。
2. 2.5 秒仍未完成 → 同一區塊追加「本機儲存回應較慢，仍在等待…」。
3. 落入降級 → 照常渲染儀表板，並在內容區頂端顯示一條常駐橫幅，措辭依 `vaultDegradedReason` 分開：
   - `blocked`：「另一個分頁正開啟本平台並佔用本機儲存。請關閉其他分頁後按重試。**你的面談紀錄沒有遺失。**」
   - `timeout`：「本機儲存沒有回應。**你的面談紀錄沒有遺失**，只是暫時讀不到。可以先繼續使用其他功能，或按重試。」
   - `unavailable`：「本機儲存不可用（可能為無痕瀏覽視窗）。本次的新紀錄只能暫存於小容量儲存，且無法還原備份。」
   - 三者皆附「重試連線」鈕 → 重跑 `hydrateVault()` 並重繪目前 view。
4. 設定頁「資料保險箱」區塊的引擎狀態同步標明具體原因，取代現行單一句「IndexedDB 不可用，可能為無痕瀏覽視窗」（該句在 `blocked`／`timeout` 情境下是錯的診斷）。

### 3.9 快取戳記

`index.html` → `app.js?v=20260830_v25_m8`、`index.css?v=20260830_v25_m8`；`app.js` 頂部 → `src/utils/db.js?v=20260830_v25_m8`。`mockData.js` 與 `geminiService.js` 本次不改，戳記維持不變。

## 4. 風險審查結論

### 4.1 是否符合 PRD？（逐條對照）

| PRD 條款 | 本計劃如何滿足 | 檢查結果 |
| :--- | :--- | :--- |
| USER JOURNEY 4「drafts safe from accidental loss」 | §3.2 關分頁攔截、§3.3 應用內離開攔截、§3.4 評估失敗不再丟棄 —— 三條意外失去草稿的路徑全部堵上 | ✅ |
| SUCCESS「attempts to leave the page mid-interview and is stopped by a warning」 | §3.2 恰為此條的實作；驗證步驟明列走一次 SUCCESS 腳本 | ✅ 本條由此**首次可完整走通** |
| Data Ownership「must never claim a draft is saved when it is not」 | §3.5 刪除綠點與整個假狀態機，改為恆真陳述 | ✅ |
| Data Ownership「Finalized sessions … live in the IndexedDB vault」 | 不變。草稿仍不入庫，入庫時機仍是 finalize | ✅ 未改變既有分層 |
| Degradation Honesty「unavailable **or unresponsive** … says so plainly and stays usable」 | §3.6 全部等待有界、§3.7 開機必定結束、§3.8 依原因分別說明 | ✅ 「unresponsive」正是今日缺口 |
| Degradation Honesty「never … indefinite loading state with no explanation and no way forward」 | §3.8 立即 spinner ＋ 2.5 秒進度說明 ＋ 8 秒具名降級 ＋ 重試鈕 | ✅ 三者逐項對應 |
| OUT OF SCOPE「Resuming an interrupted interview … warned but not rescued」 | §3.5 明文不加草稿自動保存；本計劃只警告，不救援 | ✅ 刻意不越界 |
| SSOT「One authoritative home per fact」 | 見 §4.2 | ✅ |
| No Fabricated Clinical Content | 本里程碑不觸及任何 AI 內容路徑；§3.4 改的是**版面**不是內容，失敗仍大聲報真實錯誤 | ✅ 未觸及 |
| No Claim Without Evidence（M7 交付） | 未觸及計分、徽章、雷達任何路徑 | ✅ 未觸及 |
| AI Gateway & Validation | 未觸及 `geminiService.js`；§3.4 只改呼叫端的失敗後處置，不改呼叫本身 | ✅ 未觸及 |
| Capabilities & Voice | 未觸及 STT／TTS | ✅ 未觸及 |
| Everyone Can Operate It | 新增元件（橫幅、重試鈕、狀態列）以真實 `<button>` 與文字實作，鍵盤可達；本里程碑**不**宣稱解決 D24 的整體可及性 | ✅ 不倒退 |
| Security & Secrets | 未觸及金鑰、日誌、匯出 | ✅ 未觸及 |

### 4.2 是否引入重複狀態、平行資料，或第二個歸屬？

**沒有。** 逐項說明：

- `hasUnsavedInterview()` 是**純述詞**，不儲存任何東西。
- `activeSession.vaultedAt` 記錄的是「這份記憶體草稿已有持久副本」這個事實 —— 該事實此前**在記憶體中無任何歸屬**（§2.1 E 證實 `activeSession` 不會歸零）。它不是面談資料的第二份拷貝，也不寫入保險箱；`completedSession` 物件另行建構，不含此欄位。
- `state.vaultDegradedReason` 是**目前模式的成因**，此前不存在。它與 `state.vaultMode` 一起變更、由 `hydrateVault()` 單處寫入，非同一事實的兩份表述。
- §3.5 **刪除**狀態，未新增。
- 保險箱的權威來源不變：`sessions` object store。草稿的權威來源不變：`state.activeSession`。

### 4.3 是否會破壞既有功能或可用流程？

逐一檢查有風險的接縫：

| 接縫 | 風險 | 已決定的處理 |
| :--- | :--- | :--- |
| 語系切換 `switchView(state.activeView)` | 面談中切語系會被守衛誤攔成「離開」 | §3.3 傳 `skipUnsavedGuard: true`，並以 `viewName !== state.activeView` 雙重保險 |
| 側欄高亮先於 `switchView` | 取消離開後高亮已移走，畫面與實際不符 | §3.3 改為依 `switchView` 回傳值才移動高亮 |
| `switchView` 十一個呼叫點 | 逐一改動易漏 | 守衛置於 `switchView` **內部**單一位置，預設全部受保護；只有三處顯式豁免並在表中列明理由 |
| `switchView` 新增回傳值 | 既有呼叫點若依賴回傳值會受影響 | 實測：目前全部忽略回傳值（原本回傳 `undefined`），新增布林為純增量 |
| 做完一場面談後仍留在報告頁 | 若守衛判斷錯誤，之後每次導覽都會被攔 | `vaultedAt` 於入庫成功後寫入 → 述詞轉 `false`；驗證步驟明列此情境 |
| 「放棄返回」 | 連問兩次 | §3.3 豁免 |
| 危險區重設 / 備份還原（走 `clearAll()`） | §3.6 加 `onabort` 後行為改變 | 由「永遠掛住」改為「拋出可見錯誤」，嚴格改善；既有成功路徑一字不動 |
| `db.onversionchange` 主動 `close()` | 連線被關掉後續呼叫失敗 | 同時清 `this.db` 快取並加 `db.onclose`，下次呼叫自動重開 |
| 8 秒逾時誤傷慢速機器 | 資料多時正常開啟被判逾時 | 逾時**不丟資料**：只落入降級並顯示「紀錄沒有遺失」＋重試鈕。且逾時只作用於**開機路徑**，寫入路徑另計 |
| 降級時歷史顯示為空 | 同工誤以為資料遺失 | §3.7／§3.8 以 `vaultDegradedReason` 區分並明說「紀錄沒有遺失」 |
| M7 的 `reconcileAchievementsOnce()` 在 `hydrateVault()` 之後 | 降級時對帳讀到空的 `historySessions` → 誤收徽章 | **必須處理**：降級原因為 `blocked`／`timeout` 時**跳過對帳**（紀錄讀不到就無從查證，正是 M7 定義的 `null` 情境）。旗標不寫入，下次正常開機再跑 |
| `beforeunload` 影響一般瀏覽 | 對非面談情境造成摩擦 | 述詞為 `false` 時完全不註冊 handler 行為（提早 return，不呼叫 `preventDefault`） |

### 4.4 是否修改已存有資料的資料表？

**沒有。** `DB_VERSION` 維持 **1**，三個 object store（`sessions`、`custom_cases`、`app_meta`）的名稱、keyPath 與內容格式完全不變，`onupgradeneeded` 一字不改。**不需要 migration，不刪表重建，既有資料零風險。**

`activeSession.vaultedAt` 只存在於記憶體，**不**進入 `completedSession`，因此不寫入任何 object store，備份檔格式亦不變。

需要明確標示的一點：§3.6 的 `onversionchange` ＋ `onblocked` 正是**為了讓將來真的需要改 schema 時不會弄壞使用者**而加。今日不改表，但今日補上這兩個處理，是未來任何一次改表的前提條件。

### 4.5 邊界情況

| 情況 | 處理 |
| :--- | :--- |
| 剛進房間，零對話零筆記，點側欄離開 | 不攔截 —— 沒有東西可失去 |
| 只寫了 SOAP、一句對話都沒有 | 攔截（`notes.soap.trim()` 非空） |
| 只寫了空白字元 | 不攔截（`.trim()`） |
| 面談完成並入庫後，於報告頁點側欄 | 不攔截（`vaultedAt` 已寫入） |
| 離線示範完成（`report: null`）後導覽 | 不攔截 —— 該路徑同樣走 `persistCompletedSession()`，`vaultedAt` 同樣寫入 |
| 入庫**失敗**（`saveSession` 回 false）後導覽 | **攔截** —— `vaultedAt` 只在成功後寫入。現行程式已 `alert` 警告，攔截讓同工有機會匯出 |
| 無劇本個案離線點進 | 不攔截 —— `renderOfflineScriptUnavailable()` 在建立 session 前 return |
| 評估中（覆蓋層顯示時）關分頁 | `beforeunload` 攔截 —— 此時尚未入庫，述詞為 `true`，正確 |
| 兩個分頁同時開著，其一觸發 versionchange | 本分頁 `close()` 讓路並清快取；下次呼叫自動重開 |
| 降級模式下按「重試連線」而 IndexedDB 仍不通 | 再次落入降級，橫幅更新原因，不進入無限等待 |
| 降級模式下完成面談 | 沿用既有 localStorage 降級寫入路徑（`persistCompletedSession`），`vaultedAt` 照樣在成功後寫入 |
| `clearAll()` 交易被中止 | 拋 `VAULT_ABORTED`，還原／重設流程顯示真實錯誤而非卡死 |
| 使用者停在載入畫面超過 8 秒後 IndexedDB 才回應 | 已降級的 state 不被遲到的結果覆寫（以一次性 flag 忽略逾時後的 resolve），避免兩份互相矛盾的 `historySessions` |

## 5. 驗證步驟

1. `python3 check_syntax.py` 全綠。
2. **PRD SUCCESS 腳本實走**：進入阿強 → 送出一句 → 寫 SOAP → 嘗試關閉分頁 → **被瀏覽器警告攔下**。
3. **應用內離開**：面談中（有內容）點側欄「儀表板」→ 出現確認；取消 → 仍在房間**且側欄高亮沒有跑掉**；確認 → 才離開。
4. **不誤攔**：剛進房間零內容點側欄 → 直接離開；面談完成入庫後點側欄 → 直接離開；面談中切換語系 → 不出現確認。
5. **評估失敗不丟資料**：注入一個會失敗的 fetch → 按「結束會話」→ 錯誤 alert 出現後**仍在房間**，逐字對話與 SOAP 內容原封不動；再次按「結束會話」可正常完成。
6. **筆記狀態列**：全程不出現「已安全備份」字樣（以 `innerText` 斷言）；恆常顯示草稿只存在於此分頁。
7. **`db.js` 掛死路徑（以 §2.2 的同一組實測手法逐一回測）**：
   - 持有 v1 連線再開 v2 → `open()` 於 `onblocked` 立即 reject `VAULT_BLOCKED`（不再 5 秒不 settle）。
   - `tx.abort()` → `clearAll()` reject `VAULT_ABORTED`（不再掛住）。
   - 攔截 `indexedDB.open` 使其永不觸發事件 → 8 秒內 reject `VAULT_TIMEOUT`。
8. **開機必定結束**：在上述三種情境下重新載入 → **儀表板一定渲染出來**，頂端橫幅措辭與原因相符且含「重試連線」鈕；主控台無未捕捉錯誤。
9. **載入畫面**：正常開機時 mount **不為空**（spinner 立即出現）；人為延遲 3 秒 → 出現「回應較慢」追加說明。
10. **重試**：`blocked` 情境下關掉佔用連線再按「重試連線」→ 成功回到 `indexeddb` 模式，歷史正確出現，橫幅消失。
11. **M7 對帳互動**：降級（`timeout`）開機 → 徽章**未**被收回、旗標**未**寫入；恢復正常後開機 → 對帳照常執行。
12. **回歸**：M5 單次結構化往返；M6 離線劇本標示與匯出標記；M7 的空／全未評估／混合三情境數字與「無字母等第」；備份匯出→清空→還原往返一致。
13. **深淺主題**：新增的橫幅、狀態列、載入畫面兩種主題實際截圖檢視。

## 6. 本次**不**處理（明確界線）

| 項目 | 理由 |
| :--- | :--- |
| 面談草稿自動保存與續接 | PRD **OUT OF SCOPE** 明文排除。本里程碑只警告不救援 |
| `switchView` 缺 `case "roleplay"` / `default` | 既有小瑕疵（面談中切語系不重繪房間），非資料遺失路徑；守衛已確保不因此誤攔。不趁機擴大改動 |
| 每日用量上限（D13） | 屬 Milestone 9 |
| `coachHint` 的 `innerHTML`（D16／D31） | 屬 Milestone 9 |
| 診斷日誌殘留金鑰特徵（D8） | 屬 Milestone 9 |
| 可及性基線 ARIA／鍵盤／reduced-motion（D24） | 獨立能力，尚未排入里程碑序列。新增元件本身鍵盤可用，但不宣稱解決 D24 |
| 徽章完全由保險箱推導（D21 餘下） | 依賴逐題練習紀錄 D26，屬另一個里程碑 |
| 移除 EN／简中 語系（D22） | 獨立變更；本次新增字串照現行模式撰寫 |

## 7. 建置前已知的非顯然決定

零內容的面談不攔截 —— 沒有東西可失去時彈警告，只會訓練同工無視警告；`vaultedAt` 標記在記憶體而非把 `activeSession` 設為 `null`，因為報告頁與匯出仍需讀它，設 `null` 會弄壞既有流程；「評估中」由覆蓋 mount 改為疊加覆蓋層，是因為房間 DOM 一旦被覆寫就只能靠 `startRoleplaySession()` 重建，而那會抹掉整場面談 —— 覆蓋層是讓失敗可退回的唯一正確作法；降級原因分成 `unavailable` 與 `blocked`／`timeout` 兩類措辭，因為後者的紀錄其實還在，說成「不可用」會讓同工以為資料沒了；逾時定為 8 秒並在 2.5 秒先給進度說明，是為了同時滿足「不無限等待」與「不誤傷慢速機器」；降級原因為 `blocked`／`timeout` 時跳過 M7 的徽章對帳，因為讀不到紀錄等同無從查證，收回徽章會是一次真實的資料損失。


---

## 9. 驗證結果（2026-08-30）

| 步驟 | 結果 |
| :--- | :--- |
| `check_syntax.py` | ✅ 全數通過 |
| **PRD SUCCESS 腳本**：面談中嘗試離開被警告攔下 | ✅ 以真實 `beforeunload` 事件 dispatch 驗證 `defaultPrevented === true` |
| `beforeunload`：只有 ICF 內容（SOAP 清空） | ✅ 攔截 |
| `beforeunload`：房間空白 | ✅ 不攔截 |
| `beforeunload`：筆記只有空白字元 | ✅ 不攔截 |
| `beforeunload`：入庫後／放棄後 | ✅ 皆不攔截 |
| 應用內離開：取消 | ✅ 仍在房間、筆記逐字完整、**側欄高亮未跑掉**（dash 未 active、arena 仍 active） |
| 應用內離開：確認 | ✅ 離開且高亮正確移動 |
| 應用內離開：確認後再導覽 | ✅ **不再重複發問**（修 bug 後） |
| 語系切換（面談中，有未存內容） | ✅ 確認次數 **0**，房間與筆記完好 |
| 「放棄返回」 | ✅ 只問一次，離開後不再攔截 |
| 零內容進房後點側欄 | ✅ 直接離開，不問 |
| 筆記狀態列 | ✅ 全畫面無「已安全備份」字樣；恆顯示「草稿只存在於此分頁 · 面談結束後才寫入保險箱」 |
| 舊指示器 `#rp-notes-save-indicator` | ✅ 已不存在 |
| **評估失敗**：覆蓋層 | ✅ 延遲失敗下確實顯示，房間在其後完好（3 個氣泡仍在） |
| **評估失敗**：失敗後 | ✅ **留在房間**；氣泡數、SOAP 內容、督導提示**逐字不變**；alert 明說「未有任何內容遺失」 |
| **評估失敗**：再試一次 | ✅ 正常產出報告頁 |
| 入庫後述詞（`vaultedAt`） | ✅ 完成面談後導覽與關分頁皆不攔截；紀錄確實入庫 |
| `db.js` blocked | ✅ 以真實原始碼僅改 `DB_VERSION` 為 2 模擬未來升級 → `VAULT_BLOCKED`，**2ms**（此前 5 秒不 settle 且永不恢復） |
| `db.js` timeout | ✅ 真實環境節流下 8 秒具名逾時 → 降級 |
| **開機必定結束** | ✅ 真實逾時下儀表板正常渲染、橫幅具名、重試鈕可用；**同一狀態下快取中的舊 M7 版本停在「加載中...」、內容區空白、主控台零輸出** |
| 載入時間線 | ✅ 0ms spinner ／ 2.85s「回應較慢」／ 8.9s 完成並移除 |
| 重試連線（失敗分支） | ✅ 按鈕禁用顯示「重試中…」，8.2 秒回到可操作，全程畫面可用，不無限等待 |
| M7 對帳跳過 | ✅ 降級下植入三個徽章（兩個依紀錄不該有）→ 重載後三個原封不動、旗標未寫入 |
| 回歸 M5 | ✅ `callCount === 1`、`required`／`propertyOrdering` 正確、缺欄位拋錯 |
| 回歸 M6 | ✅ 離線劇本氣泡標示完好 |
| 回歸 M7 | ✅ 儀表板「66分／平均 66 分」、無字母等第、練習聲明在 |
| 主控台 | ✅ 全新載入僅兩條**刻意的**說明性 warn，無未捕捉錯誤 |
| 主題 | ✅ M8 新增元件深淺皆可讀（量測 computed style：琥珀字於琥珀底） |

### 建置期間由測試抓到的 bug
第一版守衛在同工**確認離開後沒有清掉 `state.activeSession`**。`hasUnsavedInterview()` 因此永遠為真 —— 之後每一次導覽、每一次關分頁都會對一場他早已放棄的面談再問一次。測試中表現為：確認離開後點 arena，卻被原生 `confirm` 攔住而停在儀表板。新增 `discardActiveInterview()`，且只清未入庫者（報告頁與匯出仍需讀已入庫的 `activeSession`）。

### 計劃預期之外的觀察
1.  **路線圖「兩個分頁」的說法今日重現不到**（計劃 §2.2 已預先記錄並更正）。實測兩個分頁都正常開機；缺陷是已上膛未擊發。
2.  **最強的證據來自一次意外**。驗證途中工具環境開始節流 IndexedDB（`indexedDB.databases()` 正常回應而 `indexedDB.open()` 無限逾時）。在那個狀態下，快取中的舊 M7 版本正是缺陷本身：空白內容區、「加載中...」、主控台一行都沒有。M8 版本在同一狀態下正常開啟並說明。這比任何人為模擬都有說服力。
3.  **降級橫幅不出現在面談室**。面談室由 `startRoleplaySession()` 直接寫 mount，不經 `switchView()`。判定可接受：面談入口在個案大廳（經 `switchView` 渲染，有橫幅），同工必然先看過。記錄之。

### 未執行
`clearAll()` 的 `onabort` 分支 —— 程式碼已加（該路徑此前實測會永久掛住），但工具環境的 IndexedDB 節流使其無法實跑；「重試連線」的**成功**分支（失敗分支已驗證不會無限等待）；真實 Gemini 金鑰端對端；MiniMax TTS 與連續 STT；`localstorage-fallback` 下完成面談的完整流程（已驗證 `vaultedAt` 於該路徑正確寫入）。

### 已知未處理
面談室在淺色主題下大面積不可讀。量測確認：CSS 權杖確實有切換（`--text-muted` → `rgb(100,116,139)`），問題在面板容器寫死的深色背景 —— `ARCHITECTURE.md` §8 記錄的既有議題。M8 新增的元件本身兩種主題皆可讀。M8 只觸及筆記區一個小元件，重建整個 view 的淺色主題不在「設計系統工作隨觸及畫面順帶處理」的範圍內。


---

## 10. 同儕審查結果（2026-08-31 13:28 HKT）

**審查條件與上輪不同，這是本次發現的來源。** Milestone 8 自身的驗證全程在**降級模式**下進行（當時工具環境節流 IndexedDB），正常模式的路徑一次都沒測過。本次 IndexedDB 已恢復（裸 `open` 4ms），因此先在正常模式重跑 M5／M6／M7 的完整流程，再逐項檢查 M8。

### 10.1 未回歸（正常 IndexedDB 模式下實跑）

空保險箱儀表板顯示 `— / 尚未評估 (N/A)`；完整面談 → AI 評估 → **寫入 IndexedDB**（非 localStorage）→ 報告頁；empathy 92 正確觸發同理心大師徽章；分析頁「AI 即時回饋（練習參考）…平均為 70 分」且無字母等第；備份匯出無任何 API 金鑰、`completedCount` 由 sessions 推導；備份還原往返一致；M6 離線示範徽章與劇本標示完好；M5 單次結構化往返與缺欄位拋錯正常。

### 10.2 本次補驗的項目（§9 列為未驗證者）

| 上輪未驗證 | 本次結果 |
| :--- | :--- |
| `clearAll()` 的 `onabort` 分支 | ✅ 不再掛住（1ms 返回）。但回的是原生 `DOMException`（code 20）而非 `VAULT_ABORTED` —— 見 D35 |
| 「重試連線」的**成功**分支 | ✅ 以「第一次 open 永不 settle」的測試頁製造降級 → 按重試 → **404ms 恢復**，且實測保險箱恢復後真的可讀可寫（寫入一筆再讀回），非只是橫幅消失 |
| `onversionchange` 的實際效果 | ✅ 直接觀察到：全部分頁跑新版時 v2 升級順利完成（主控台「本分頁主動關閉連線讓路」）；對照有分頁跑舊版時，同一升級造成**所有 open 靜默排隊**，連 `onblocked` 都不觸發 —— 只有逾時能救。這反過來證明 8 秒硬逾時比 `onblocked` 更根本 |

### 10.3 必須修正（依序）

| ID | 問題 | 判定 |
| :--- | :--- | :--- |
| **D32** | `if (err && err.code) throw err` 誤判：所有 `DOMException` 都有 truthy 數字 `.code`（AbortError 20／QuotaExceeded 22／NotFound 8），因此所有原生儲存錯誤都被重拋。實測完整鏈路：AI 評估**成功**但寫入失敗 → alert 說「評估報告生成失敗」（錯的）→ 守衛問一個同工沒發起的離開 → 答是則三個氣泡與 SOAP 全失，連已付費產生的評分一併丟掉。M8 之前會 alert 警告後**照常顯示完整報告**供匯出 | **本輪引入的回歸**，違反本里程碑核心承諾 |
| **D33** | `initApp().catch()` 只 console.error。以還原一份 `theoryProgress` 為 `{}` 的備份自然觸發 → 儀表板空白、無說明、無出路；分析頁更糟：`innerHTML` 未被賦值，**保留上一頁內容**（標題「學習分析」配設定頁畫面）。經兩版逐字比對確認**非本輪引入**，但 M8 建了 `renderVaultLoadingState()` 這個能把訊息畫進 mount 的能力卻沒接到 catch 上 | 既有缺陷，擊穿本里程碑承諾 |
| **D34** | `probe()` 只分類 `VAULT_BLOCKED`／`VAULT_TIMEOUT`，其餘一律 `unavailable` —— 最具體也最可能錯的措辭。`VersionError` 時顯示「可能是無痕瀏覽視窗…改用一般瀏覽視窗即可恢復」（診斷錯誤、建議無效），且**未說「你的紀錄沒有遺失」**，而畫面同時顯示「互動 0 輪」 | M8 未完成的部分 |

### 10.4 不阻塞（D35–D39，詳見 `ARCHITECTURE.md` §7）

`onabort` 在有進行中請求時永遠不會贏（`VAULT_ERROR.ABORTED` 在常見情形是死碼，CHANGELOG 措辭過度）；`showEvaluatingOverlay()` 留下的 `position: relative` 未還原；降級橫幅無去重且 `switchView` 對 `roleplay`／`icf_board` 不重繪 → 降級模式下切語系會累積橫幅；`.notes-save-indicator` 兩條 CSS 成為死碼；降級橫幅不出現在面談室與報告頁（已判定可接受）。

### 10.5 接縫檢查結果

`switchView()` 新增的布林回傳：11 個呼叫點中僅 `initNavigation` 消費，其餘 10 處忽略（原本即回 `undefined`），無破壞。ICF 沙盒（`activeView='icf_board'`，不建 session）進出皆不受守衛干擾。`vaultedAt` 在有評估與離線無評估兩條路徑都正確設定，且**未進入備份檔**（實測 `hasVaultedAt: false`），確認未觸及任何 object store。M7 的徽章對帳在降級時正確跳過。

### 10.6 本次仍未測試

真實 Gemini 金鑰端對端；MiniMax TTS 與連續 STT；ICF 沙盒的拖放評分與「全人評估官」徽章；理論 Hub 閃卡與 ACT／ICF 自測；小組研討 Studio；AI 個案合成；SOAP 助手抽屜；Phase 13 督導干預注入；`localstorage-fallback` 下完成面談的完整流程；D37 的橫幅累積（讀碼＋部分實測推論，未在降級模式實跑）。


---

# 補完計劃：修正同儕審查發現的三項問題

* **Status**: Completed ✅ —— 建置與驗證完成 2026-08-31 15:23 HKT
* **Approved**: 2026-08-31 (HKT, UTC+8)
* **Roadmap Ref**: [Product Roadmap Milestone 8](../Product_Roadmap.md) —— 路線圖明訂三項待修**排在 Milestone 9 之前**
* **Traces to PRD v4**: `USER JOURNEY 4`（drafts safe from accidental loss）；`HARD CONSTRAINTS → Data Ownership & Durability`（「must never claim a draft is saved or backed up when it is not」）；`HARD CONSTRAINTS → Degradation Honesty`
* **Closes drift**: `ARCHITECTURE.md` §7 **D32**、**D33**、**D34**，順帶 **D36**、**D37**、**D38**

> 本節是這三項修正的建置 SSOT。§1–§10 記錄的是 Milestone 8 主體，不因本節而失效。

## 11. 要修的是什麼

### 11.1 D32：寫入保險箱失敗時，整場面談連同 AI 評分一起丟失

**根因（讀碼與實測確認）**：`db.js` 的七個 `catch` 都用 `if (err && err.code) throw err;` 分辨「自己的錯誤」與「原生錯誤」。實測 `DOMException` 全部帶 truthy 的**數字** `.code`：

```
AbortError 20 · QuotaExceededError 22 · NotFoundError 8 · SecurityError 18 · InvalidStateError 11
（VersionError 與 UnknownError 的 code 是 0，因此反而不受影響）
```

於是原生儲存錯誤被重拋，穿過**沒有 `try` 的** `persistCompletedSession()`（`app.js:480-496`），落到 `endRoleplaySession()` 的外層 `catch`（`app.js:4890-4897`）。

**實測到的完整後果**（AI 評估**成功**、寫入保險箱失敗）：

| 現象 | 問題 |
| :--- | :--- |
| alert 顯示「評估報告生成失敗：The transaction was aborted…」 | **訊息錯誤** —— 評估成功了，失敗的是儲存 |
| 守衛詢問「本次面談尚未完成，離開會失去…」 | 同工**沒有發起離開**，是程式要踢他走 |
| 答「是」→ 3 個氣泡與 SOAP 全失 | 連已消耗金鑰額度產生的評分一併丟棄 |

**第二個受害路徑**：`app.js:6970` 危險區重設的 `await RehabCounselorDB.clearAll()` 位於 `resetBtn.addEventListener("click", async () => {…})` 內，**沒有 `try`**。拋錯即成為未處理的 rejection —— 重設半途中止且畫面毫無提示。

**第三個問題（本節新發現，同一根因家族）**：離線完成畫面 `app.js:4917` 寫死「**面談已完成並存入保險箱**」。寫入失敗時這是不實陳述，直接違反 PRD「the interface must never claim a draft is saved or backed up when it is not」。有評估的報告頁同樣沒有任何「未存入」的表示。

### 11.2 D33：首次渲染拋例外 → 空白畫面，且標題與內容不符

**根因**：`state.theoryProgress` 的形狀在兩處各自建立預設值，而兩處都只在**鍵不存在**時套用預設，不會補齊殘缺形狀：

- `app.js` state 初始化：`if (local) { try { return JSON.parse(local); } catch {} }` → `"{}"` 原樣回傳
- `app.js` `refreshStateFromLocalStorage()`：`readJSON("rehab_theory_progress", {完整預設})` → `"{}"` 解析成功即回 `{}`

**污染源**：`db.js` `buildBackupJSON()` 用 `readJSON("rehab_theory_progress", {})` —— 預設是 `{}` 而非完整形狀。該鍵缺失時備份寫入 `{}`，還原後 `state.theoryProgress.act` 成為 `undefined`，`renderDashboard`（`app.js:1267` 起 12 處）與 `renderAnalytics`（`app.js:6055` 起）存取 `.act.info` 即拋 TypeError。

**實測到的後果**：

| 位置 | 現象 |
| :--- | :--- |
| 儀表板 | 標題與副標正常，內容區 `""` **完全空白**，無錯誤、無按鈕 |
| 分析頁 | 更糟 —— `innerHTML` 從未被賦值，**保留上一頁內容**：標題「學習分析與歷程」配設定頁畫面（實測 `isStaleSettingsContent: true`） |
| 主控台 | `initApp().catch()` 只 `console.error`，畫面上零說明 |

側欄仍可點（其他頁可正常渲染），因此不是「完全打不開」，而是「著陸頁永久空白」。經兩版逐字比對確認**非 Milestone 8 引入**，但 M8 建了 `renderVaultLoadingState()` 這個能把訊息畫進內容區的能力，卻沒接到 catch 上。

### 11.3 D34：`VersionError` 時給出錯誤診斷

`probe()`（`src/utils/db.js:306-321`）只分類兩種代碼，其餘一律 `unavailable`：

```js
err.code === VAULT_ERROR.BLOCKED ? "blocked" :
err.code === VAULT_ERROR.TIMEOUT ? "timeout" : "unavailable"
```

而 `unavailable` 的措辭是最具體、也最可能錯的一句：「本機儲存不可用 / **可能是無痕瀏覽視窗**…改用一般瀏覽視窗開啟即可恢復」。

實測（資料庫 v2、程式 v1 —— 任何一次 `DB_VERSION` 升級加上快取舊版 `app.js` 就會發生，審查中親眼看到）：診斷錯誤、建議無效，且**未說「你的紀錄沒有遺失」**，而畫面同時顯示「互動 0 輪」。同工看到歸零的數字配上這句話，會合理地認為資料沒了。

`vaultReasonFromError()`（`app.js`）有同樣的分類缺口。

## 12. 建置內容

### 12.1 以白名單述詞取代 `.code` 真值判斷（D32 根因）

`db.js` 新增並匯出：

```js
export function isVaultSignal(err) {
  return !!(err && typeof err.code === "string" && VAULT_ERROR_CODES.has(err.code));
}
```

`VAULT_ERROR` 的值全是字串，`DOMException.code` 全是數字，故 `typeof === "string"` 已足以區分；再加集合白名單，避免日後有人給原生錯誤補上字串 code。

**已實測驗證此述詞**：`VAULT_TIMEOUT` → `true`；`AbortError`／`QuotaExceededError`／`VersionError`／純 `Error`／`null` → 全部 `false`。

七個 `catch` 一律改用它。行為回到「逾時／阻擋／中止往上拋，其餘回 fallback 值」—— 也就是 ADR-0007 規則 4 原本的意圖。

### 12.2 寫入結果必須誠實傳達到畫面（D32 後果）

單靠 12.1 只能讓行為退回 Milestone 8 之前：alert 警告後照常顯示報告 —— 而報告頁與離線完成畫面都聲稱「已存入保險箱」。那仍是 PRD 禁止的不實陳述。因此一併修正整條回報鏈：

1. **`persistCompletedSession()` 回傳布林**（目前回 `undefined`，唯一呼叫端在 `app.js:4871`，改動安全）。降級模式的 localStorage 寫入同樣回報成敗。
2. **`vaultedAt` 只在寫入成功時設**。失敗時不設 —— 那場面談確實還沒有持久副本，守衛應該繼續保護它。
3. **兩個完成畫面依實際結果說話**：
   - 成功：措辭不變。
   - 失敗：標題改為「面談已完成，但**未能存入保險箱**」，加一段說明真實原因，並把「匯出報告」提升為主要動作 —— 匯出是同工此刻唯一能保住這場面談的方法。同時說明可回到面談重試。
4. **`endRoleplaySession()` 的外層 `catch` 不再是寫入失敗的落點**（寫入失敗現在走正常回傳路徑）。該 `catch` 保留給真正的例外（如 `renderSessionReport` 自身出錯），並維持 M8 的守衛行為。
5. **危險區重設的 `clearAll()` 補 `try`**，失敗時據實告知重設未完成，而不是靜默中止。

### 12.3 `theoryProgress` 形狀正規化（D33 根因）

`app.js` 新增單一正規化函式：

```js
const THEORY_MODULES = ["act", "mi", "icf"];
function normalizeTheoryProgress(raw) { /* 保證回傳三模組 × 三布林的完整形狀 */ }
```

三個讀入點共用：state 初始化、`refreshStateFromLocalStorage()`、以及 hydrate 之後的一次校正。**這是補齊不是刪除** —— 既有的 `true` 值一律保留，只補上缺失的鍵。

`db.js` 堵住污染源：`buildBackupJSON()` 的 `theoryProgress` 改為「鍵不存在就不輸出該欄位」（`undefined`），`importFullBackupJSON()` 既有的 `if (data.theoryProgress !== undefined)` 條件因此正確跳過，不再寫入 `{}`。`db.js` 不需要知道 theoryProgress 的形狀 —— 那是 app 的領域。

### 12.4 開機失敗與渲染失敗都必須有畫面（D33 防護）

1. **`initApp().catch()` 接上 UI**：新增 `renderBootFailure(err)`，渲染進 `#content-view-mount` —— 說明平台未能完成啟動、顯示**真實**錯誤訊息、提供「重新載入」與「前往系統設定」（同工可從那裡匯出備份）。沿用 M8 既有的載入卡樣式基礎。
2. **`switchView()` 的 render 呼叫加保護**：以 `try/catch` 包住 `switch` 區塊，任一 render 函式拋錯時改渲染該頁的錯誤卡，並記錄真實錯誤。這修掉「標題說 A、內容是上一頁 B」的誤導 —— 那比空白更容易讓同工誤判。

### 12.5 降級原因精確分類（D34）

`probe()` 改為依 `err.name` 分類，並新增 `version` 類別：

| 判定 | 分類 | 理由 |
| :--- | :--- | :--- |
| `VAULT_BLOCKED` | `blocked` | 不變 |
| `VAULT_TIMEOUT` | `timeout` | 不變 |
| `err.name === "VersionError"` | **`version`（新增）** | 資料庫格式比程式新 —— 幾乎必然是快取到舊版程式，紀錄完好 |
| `indexedDB` 不存在／`SecurityError`／`InvalidStateError` | `unavailable` | 這才是「真的不能用」 |
| 其餘 | `error` | 不亂猜 |

新增 `version` 措辭：「**你開啟的是舊版程式** / 保險箱的格式比目前程式新。**你的面談紀錄沒有遺失。** 請強制重新整理（Cmd/Ctrl+Shift+R 或 Ctrl+F5）載入最新版本。」

`vaultReasonFromError()` 同步採用同一套判定，兩處共用一支 `classifyVaultError(err)`，避免分類邏輯出現兩份。

### 12.6 順帶處理的三項（D36／D37／D38）

三者都落在本次要改的同一段程式碼裡，分開處理等於二次進入同一處：

- **D36**：`hideEvaluatingOverlay()` 還原 `mount.style.position`（記住進入前的值，離開時還原）。
- **D37**：`renderVaultDegradedBanner()` 加去重（先移除既有橫幅再插入）。12.4 的 `switchView` 保護一併涵蓋未匹配 view 的情形。
- **D38**：刪除死 CSS `.notes-save-indicator`（`index.css:3027`）與其響應式規則（`:3831`）。

**不碰 D35**（`onabort` 在有進行中請求時不獲勝）—— 那是 IndexedDB 事件順序的固有行為，中止已能正確 settle；文檔措辭已於 2026-08-31 更正。**不碰 D39**（降級橫幅不出現在面談室）—— 已判定可接受。

### 12.7 快取戳記

`index.html` → `app.js?v=20260831_v26_m8fix`、`index.css?v=20260831_v26_m8fix`；`app.js` 頂部 → `src/utils/db.js?v=20260831_v26_m8fix`。`mockData.js` 與 `geminiService.js` 不改，戳記維持不變。

## 13. 風險審查結論

### 13.1 是否符合 PRD？（逐條對照）

| PRD 條款 | 本節如何滿足 | 檢查結果 |
| :--- | :--- | :--- |
| Data Ownership「must never claim a draft is saved or backed up when it is not」 | 12.2 讓兩個完成畫面依**實際寫入結果**說話；發現並修掉寫死的「面談已完成並存入保險箱」 | ✅ 這是本節最直接對應的條款 |
| USER JOURNEY 4「drafts safe from accidental loss」 | 12.1 停止把儲存錯誤變成流程中斷；12.2 失敗時不設 `vaultedAt`，守衛繼續保護該場面談；匯出提升為主要動作 | ✅ |
| Degradation Honesty「says so plainly and stays usable」 | 12.4 開機失敗有畫面、有真實錯誤、有出路；12.5 降級原因不再誤診 | ✅ |
| Degradation Honesty「never … indefinite loading state with no explanation and no way forward」 | 12.4 補上 M8 漏掉的另一種成因（渲染例外，而非保險箱掛住） | ✅ |
| OUT OF SCOPE「Resuming an interrupted interview … warned but not rescued」 | 本節**不**新增任何草稿續接能力。寫入失敗時提供的是匯出，不是自動保存 | ✅ 刻意不越界 |
| SSOT「One authoritative home per fact」 | 見 13.2 | ✅ |
| No Fabricated Clinical Content | 未觸及任何 AI 內容路徑；新增文案皆為系統狀態訊息 | ✅ 未觸及 |
| No Claim Without Evidence | 未觸及計分、徽章、雷達 | ✅ 未觸及 |
| AI Gateway & Validation | 未觸及 `geminiService.js`；12.2 只改呼叫端對**儲存**結果的處置，不改 AI 呼叫或其驗證 | ✅ 未觸及 |
| Security & Secrets | 12.4 的錯誤畫面顯示 `err.message`。已確認 `db.js` 與 `app.js` 的錯誤訊息不含金鑰（金鑰只在 `geminiService.js` 的 URL 中，而該層錯誤不落入開機路徑）；錯誤畫面不寫入任何持久層 | ✅ |
| Everyone Can Operate It | 新增的錯誤畫面與按鈕以真實 `<button>` 與文字實作，鍵盤可達 | ✅ 不倒退 |
| Teaching Material Is Data | 未觸及 `mockData.js` | ✅ 未觸及 |

### 13.2 是否引入重複狀態、平行資料，或第二個歸屬？

**沒有。** 逐項說明：

- `isVaultSignal()` 與 `classifyVaultError()` 是**純述詞**，不儲存任何東西；後者的存在正是為了讓分類邏輯**只有一份**（現行 `probe()` 與 `vaultReasonFromError()` 各有一套，本節將其合併）。
- `normalizeTheoryProgress()` 是純函式。`theoryProgress` 的權威歸屬仍是 `localStorage` 的 `rehab_theory_progress` 單一鍵，正規化只保證讀出來的形狀完整，不建立第二份副本。
- `persistCompletedSession()` 的布林回傳是**函式回傳值**，不是狀態。
- `vaultedAt` 的語意不變（記憶體內、不入庫、不進備份），只是設定時機加上「寫入成功」這個既有事實的條件。
- 12.6 的三項皆為刪除或還原，不新增狀態。

### 13.3 是否會破壞現有功能或可用流程？

| 接縫 | 風險 | 已決定的處理 |
| :--- | :--- | :--- |
| 七個 `catch` 改述詞 | 逾時／阻擋／中止若不再上拋，`hydrateVault()` 會把「讀不到」當成「沒有資料」 | 白名單**明確包含**三個 VAULT_ERROR，該行為完全保留；已實測述詞對三者皆回 `true` |
| `persistCompletedSession` 改回傳值 | 既有呼叫端若忽略回傳值 | grep 確認**唯一呼叫端**在 `app.js:4871`，本節一併改寫 |
| `vaultedAt` 改為條件設定 | 寫入失敗後同工導覽會被守衛攔 | **這是正確行為** —— 該場面談確實無持久副本。完成畫面會說明並提供匯出 |
| `switchView` 包 try/catch | 吞掉錯誤導致問題更難發現 | `catch` 內 `console.error` 真實錯誤**並**在畫面顯示，比現行「靜默留下上一頁」更容易發現 |
| `initApp().catch()` 渲染 UI | 若 `renderBootFailure` 自身出錯則無畫面 | 該函式只做字串拼接與 `innerHTML` 賦值，不讀 `state`，不依賴任何已載入資料 |
| `theoryProgress` 正規化 | 覆寫同工既有進度 | **只補齊缺失鍵，既有 `true` 一律保留**；驗證步驟含「殘缺物件補齊後原有進度不變」 |
| `buildBackupJSON` 不再輸出空 `theoryProgress` | 舊備份含 `{}` 者還原後仍會壞 | 12.3 的 app 端正規化是第二道防線，舊備份還原後同樣被補齊 |
| `probe()` 新增 `version` 分類 | 唯一呼叫端 `hydrateVault()` 的 `switch` 未涵蓋新值 | `vaultDegradedNotice()` 為 `version` 新增分支；`default` 仍指向 `unavailable` 措辭 |
| D37 橫幅去重 | 移除既有橫幅時誤刪其他元素 | 以 `id` 精確定位 `#vault-degraded-banner` |
| D36 還原 `position` | 面談室依賴 mount 的定位 | 記住進入前的值再還原，而非硬設為 `""` |

### 13.4 是否修改已存有資料的資料表？

**沒有修改 object store。** `DB_VERSION` 維持 **1**，三個 store（`sessions`、`custom_cases`、`app_meta`）的名稱、keyPath、內容格式完全不變，`onupgradeneeded` 一字不改，**不需要 migration**。

**必須明確標示的一項資料形狀變更**：`localStorage` 的 `rehab_theory_progress`。12.3 的正規化會在讀取時補齊缺失的模組／欄位，並在下次 `saveTheoryProgress()` 時寫回完整形狀。這是**補齊，不是刪除或重建** —— 既有的 `true` 值全部保留，殘缺者補 `false`。不存在「刪表重建」，也不會讓任何已完成的模組退回未完成。驗證步驟以 `{}`、缺一個模組、缺一個欄位三種殘缺輸入逐一確認。

### 13.5 邊界情況

| 情況 | 處理 |
| :--- | :--- |
| 寫入失敗，同工按「匯出報告」 | 匯出走記憶體中的 `report` 與 `activeSession`，不依賴保險箱，可正常產出 |
| 寫入失敗，同工按「返回個案實戰」 | `vaultedAt` 未設 → 守衛攔截並說明會失去 —— 正確 |
| 寫入失敗後重試「結束會話」 | `state.activeSession` 完整保留，重跑評估與寫入。**會產生新的 `session_` id**，成功後保險箱只有一筆（前次從未寫入） |
| 降級模式（localStorage）寫入失敗（配額滿） | 同樣回報 `false`，走同一條誠實措辭路徑 |
| `theoryProgress` 為 `{}` | 補齊為九個 `false`，儀表板正常渲染 |
| `theoryProgress` 缺 `icf` 模組 | 只補 `icf`，`act`／`mi` 既有值不動 |
| `theoryProgress` 的值是字串等非布林 | 以 `!!` 轉布林，不拋錯 |
| `rehab_theory_progress` 存的是非物件（如 `"null"`、陣列） | 正規化回傳完整預設，不拋錯 |
| 開機時 `renderDashboard` 拋錯 | 12.4 顯示錯誤卡並保留側欄可用 |
| `switchView` 的 render 拋錯 | 顯示該頁錯誤卡，不再留下上一頁內容 |
| 資料庫 v2、程式 v1 | 分類為 `version`，措辭指向強制重新整理，並明說紀錄沒有遺失 |
| 無痕模式 | `SecurityError`／`InvalidStateError` → `unavailable`，維持現行（正確的）措辭 |
| 降級模式在面談室連按語系鍵 | D37 去重後只有一個橫幅 |

## 14. 驗證步驟

1. `python3 check_syntax.py` 全綠。
2. **述詞隔離測試**：`isVaultSignal()` 對三個 `VAULT_ERROR` 回 `true`；對 `AbortError`／`QuotaExceededError`／`VersionError`／`SecurityError`／純 `Error`／`null` 回 `false`。
3. **D32 主場景（實跑）**：完整面談 → AI 評估成功 → 攔截 `db.transaction` 令寫入中止 → 確認 **(a)** 不再被踢回個案大廳、**(b)** alert 措辭指向儲存而非評估、**(c)** 逐字對話與 SOAP 逐字保留、**(d)** 完成畫面顯示「未能存入保險箱」而非「已存入」、**(e)** 匯出報告可正常產出、**(f)** 導覽時守衛仍攔截、**(g)** 再按一次「結束會話」可成功寫入。
4. **D32 第二路徑**：危險區重設時令 `clearAll()` 失敗 → 據實告知未完成，非靜默中止。
5. **D32 回歸**：正常寫入成功時，措辭、`vaultedAt`、報告頁、守衛行為與現行一致。
6. **D33 根因**：`rehab_theory_progress` 分別設為 `"{}"`、缺 `icf`、缺 `act.test`、`"null"`、`"[]"` → 五種情況儀表板與分析頁皆正常渲染；且**既有 `true` 值全部保留**（設三個模組全完成再注入殘缺 `icf`，確認 `act`／`mi` 仍為完成）。
7. **D33 污染源**：清空 `rehab_theory_progress` → 匯出備份 → 確認備份檔**不含** `theoryProgress` 欄位 → 還原 → 儀表板正常。
8. **D33 防護**：人為令 `renderDashboard` 拋錯 → 開機顯示錯誤畫面（含真實訊息與兩個按鈕），側欄仍可用；人為令 `renderAnalytics` 拋錯 → 顯示該頁錯誤卡，**不再**出現「標題說學習分析、內容是設定頁」。
9. **D34**：資料庫升至 v2、程式 v1 → 橫幅標題為「你開啟的是舊版程式」且含「你的面談紀錄沒有遺失」；模擬 `SecurityError` → 維持「本機儲存不可用／可能是無痕瀏覽視窗」。
10. **D36／D37／D38**：評估覆蓋層關閉後 `mount` 的 inline `position` 還原為進入前的值；降級模式下面談室連按語系鍵三次，橫幅維持 1 個；`grep` 確認死 CSS 已移除且無殘留引用。
11. **回歸**：M5 單次結構化往返與缺欄位拋錯；M6 離線劇本標示與離線完成畫面；M7 空／混合兩情境的儀表板與分析頁數字、無字母等第；M8 的 `beforeunload` 六種狀態、應用內離開與高亮、覆蓋層失敗可退回；備份匯出→清空→還原往返一致且無金鑰。
12. **開機三態**：正常模式（無橫幅）、逾時降級（橫幅＋重試成功）、`version` 降級（新措辭），三者主控台皆無未捕捉錯誤。
13. **深淺主題**：新增的開機失敗畫面與頁面錯誤卡兩種主題實測截圖。

## 15. 本節**不**處理（明確界線）

| 項目 | 理由 |
| :--- | :--- |
| D35（`onabort` 不獲勝） | IndexedDB 事件順序的固有行為，中止已能正確 settle；文檔措辭已更正 |
| D39（橫幅不在面談室／報告頁） | 已判定可接受，同工必經個案大廳 |
| 面談室淺色主題 | `ARCHITECTURE.md` §8 既有議題，整個 view 的設計系統工作 |
| 草稿自動保存與續接 | PRD OUT OF SCOPE 明文排除 |
| 每日用量上限、`coachHint` 的 `innerHTML`、診斷日誌殘留 | 屬 Milestone 9 |
| 可及性基線（D24）、逐題練習紀錄（D26）、移除 EN／简中（D22） | 各屬獨立能力，尚未排入里程碑序列 |

## 16. 建置前已知的非顯然決定

寫入失敗時**不設** `vaultedAt`，因此守衛會繼續攔截該場面談的離開 —— 這看似多一道摩擦，但那場面談確實還沒有持久副本，讓它安靜地被放行才是真正的資料遺失；分類邏輯從 `probe()` 與 `vaultReasonFromError()` 兩處合併為單一 `classifyVaultError()`，因為兩份分類遲早會分岔，而分岔的後果是對同工說錯「你的資料還在不在」；`switchView` 的 `try/catch` 選擇顯示錯誤卡而非靜默略過，因為現行的靜默行為會產生「標題與內容不符」，比明說出錯更容易誤導；`theoryProgress` 正規化採補齊而非重置，既有進度一律保留；D36／D37／D38 順帶處理是因為它們落在本次必須改動的同一段程式碼裡，分開做等於二次進入同一處。


## 17. 補完驗證結果（2026-08-31 15:23 HKT）

| 步驟 | 結果 |
| :--- | :--- |
| `check_syntax.py` | ✅ 全數通過 |
| **§14.2 述詞隔離** | ✅ `isVaultSignal`：三個 VAULT_ERROR 回 `true`；`AbortError`／`QuotaExceededError`／`VersionError`／`SecurityError`／`InvalidStateError`／`NotFoundError`／`UnknownError`／純 `Error`／`null`／假字串 code 全回 `false` |
| **§14.2 分類** | ✅ `classifyVaultError`：blocked→blocked、timeout／aborted→timeout、`VersionError`→**version**、`SecurityError`／`InvalidStateError`→unavailable、其餘→error |
| **§14.3 (a) 不再被踢回大廳** | ✅ 停在報告頁，標題「輔導能力評審報告**（未存入保險箱）**」 |
| **§14.3 (b) 措辭指向儲存** | ✅ 警示卡寫「原因：保險箱拒絕了這次寫入」，不再誤稱評估失敗；且**不再出現**那個同工沒發起的「確定離開嗎」 |
| **§14.3 (c) 內容保留** | ✅ 3 個氣泡、SOAP 筆記、督導提示逐字不變 |
| **§14.3 (d) 不聲稱已存入** | ✅ 顯示紅色警示卡，明說「還沒有持久副本 —— 關閉分頁就會失去」 |
| **§14.3 (e) 匯出可用** | ✅ Markdown 含完整五維分數與逐字紀錄 |
| **§14.3 (f) 守衛仍保護** | ✅ `vaultedAt` 未設 → `beforeunload` 攔截 `true`；保險箱實測 0 筆 |
| **§14.3 (g) 可重試** | ✅ 見下方「建置期間的追加修正」 |
| **§14.4 危險區重設** | ✅ `clearAll()` 已包 `try`，失敗時據實告知未完成 |
| **§14.5 正常寫入回歸** | ✅ 標題無「未存入」、無警示卡、報告完整、守衛放行、保險箱 1 筆、練習聲明在 |
| **§14.6 正規化五種殘缺輸入** | ✅ `{}`／缺 `icf`／缺 `act.test`／`null`／`[]` 皆補齊為完整形狀；字串值以 `!!` 轉布林；**既有全 `true` 完整保留**（`PRESERVES_EXISTING_TRUE: true`） |
| **§14.6 端到端** | ✅ `rehab_theory_progress = "{}"` 下儀表板 4 張卡正常、分析頁正常 —— 此輸入在修正前必定 crash |
| **§14.7 污染源** | ✅ 鍵不存在時備份**不含** `theoryProgress` 欄位；有值時照常輸出；備份無金鑰 |
| **§14.8 頁面渲染保護** | ✅ 以真實原始碼注入 `renderAnalytics` 故障：顯示「這一頁未能顯示」＋真實錯誤＋重載鈕，**不再留下上一頁內容**（`isStalePreviousPage: false`），側欄仍可用 |
| **§14.8 開機失敗畫面** | ✅ 注入 `initNavigation` 故障：顯示「平台未能完成啟動」＋真實錯誤＋兩顆按鈕，標題與副標同步更新 |
| **§14.9 `version` 措辭** | ✅ 資料庫 v2、程式 v1 → 「你開啟的是舊版程式」＋「**你的面談紀錄沒有遺失**」＋強制重新整理指引；**不再**誤稱無痕視窗 |
| **§14.10 D36** | ✅ 覆蓋層關閉後 `position` computed 回 `static`（細節：進入前無 `style` 屬性，還原後留下空的 `style=""`，視覺無差異） |
| **§14.10 D37** | ✅ 連呼叫三次 `renderVaultDegradedBanner()` 仍只有 1 個橫幅；切回正常模式後 0 個 |
| **§14.10 D38** | ✅ `.notes-save-indicator` 兩條規則已移除，`app.js` 零引用 |
| **§14.11 回歸** | ✅ M5 單次往返（`callCount: 1`）與缺欄位拋錯；M6 離線徽章／劇本標示／草稿狀態列；M7 空保險箱 `—／尚未評估`、無 `0分`；M8 守衛六態；備份往返一致且無金鑰 |
| **§14.12 開機三態** | ✅ 正常（無橫幅）、`version` 降級（新措辭）、乾淨載入主控台**零輸出** |
| **§14.13 主題** | ✅ 兩種主題下量測 computed style：深色標題 `rgb(255,255,255)`／淺色 `rgb(15,23,42)`，警示卡底色隨主題調整，皆可讀 |

### 建置期間抓到並修正的問題

**TDZ 錯誤令整個模組載入失敗。** 第一版把 `THEORY_MODULES`／`THEORY_STEPS` 宣告為模組層 `const`，但 `state` 物件的初始化在檔案中位置更早且會呼叫 `normalizeTheoryProgress()` —— 函式宣告會 hoist，`const` 不會，於是 `ReferenceError: Cannot access 'THEORY_MODULES' before initialization`，**整個 app 完全打不開**。`check_syntax.py` 只檢查括號平衡，抓不到這類錯誤；是實跑時的主控台抓到的。兩個清單已改為函式內部區域常數。

**警示卡承諾了一條走不到的路。** 第一版的警示卡寫「之後可以回到面談再按一次『結束會話』重試寫入」，但報告頁只有「匯出面談日誌」與「返回個案實戰」兩顆按鈕，沒有回到面談的路徑。實測發現後改為**直接在警示卡上提供「重試寫入保險箱」** —— 而且重試不重跑 AI 評估（那會再消耗一次金鑰額度，而評估本來就成功了）。為此把 `persistCompletedSession()` 拆出純寫入的 `writeSessionToVault()`，避免重試時把同一場面談再 `unshift` 進 `state.historySessions`（實測確認：重試後畫面與保險箱都是 1 筆，無重複）。重試成功後就地更新：設 `vaultedAt`（守衛隨即放行，實測 `true → false`）、警示卡轉為綠色「已成功存入保險箱」、標題移除「（未存入保險箱）」。

### 未執行
真實 Gemini 金鑰端對端；MiniMax TTS 與連續 STT；ICF 沙盒拖放評分與「全人評估官」徽章；理論 Hub 閃卡與 ACT／ICF 自測；小組研討 Studio；AI 個案合成；SOAP 助手抽屜；Phase 13 督導干預注入；`localstorage-fallback` 下寫入失敗的完整流程（該分支程式碼已改，但未在真實降級環境實跑）。
