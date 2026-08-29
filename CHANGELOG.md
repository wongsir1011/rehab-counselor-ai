# 📝 RehabCounselor AI - 專案變更日誌 (Changelog)

本變更日誌為本平台版本控制與功能交付的權威紀錄。

---

## [v20260830_v25_m8] - 2026-08-30 (香港時間 UTC+8)

## 🛡️ Milestone 8「不會憑空消失的面談」

兩件事，同一個原則：**不要在同工不知情的狀況下弄丟他的東西。**

計劃：[`plan/08-interview-never-vanishes.md`](plan/08-interview-never-vanishes.md)（已批准 2026-08-30）
對應 PRD v4：`USER JOURNEY 4`、`SUCCESS`、`Data Ownership & Durability`、`Degradation Honesty`

### 🚪 未完成的面談不再靜默消失
*   **關分頁／重新整理**：新增 `beforeunload` 攔截（此前全專案出現 **0 次**，這同時使 PRD SUCCESS 條款走不完）。
*   **應用內離開**：守衛置於 `switchView()` 內部單一位置，十一個呼叫點自動受保護。側欄高亮改為**等 `switchView()` 回報成功才移動** —— 舊版先換 class 再切換，取消離開後高亮會停在一個同工根本沒去成的頁面。
*   **三處顯式豁免**：語系切換（那是重繪不是離開）、「放棄返回」（已有自己的確認）、離線無劇本面板（該路徑未建立 session）。
*   **判斷條件**：`hasUnsavedInterview()` —— 有 session、未入庫（`vaultedAt`）、且**有東西可失去**。零內容時攔截只會訓練同工無視警告。

### 🩹 評估失敗不再由程式丟掉整場面談
舊版有金鑰卻評估失敗時，`alert()` 後直接 `switchView("arena")`，**逐字對話與筆記連同面談一起消失**。根因是「正在評估你的輔導技巧...」直接 `mount.innerHTML = ...` 覆寫面談房間 —— 失敗後無路可退，而重建房間會重置 `state.activeSession`、抹掉整場面談。

改為**非破壞性覆蓋層**。失敗時移除覆蓋層、留在房間、內容原封不動。實測：三個氣泡、SOAP 筆記、督導提示逐字不變，再按一次「結束會話」即可正常完成報告。

### 🟠 移除不實的「已安全備份」
綠點與整套「同步中... → 已安全備份」動畫刪除（連同已無使用者的 `@keyframes pulse-amber-dot`），改為恆常為真的一行：**「草稿只存在於此分頁 · 面談結束後才寫入保險箱」**。

刻意**不**加自動存草稿：PRD OUT OF SCOPE 排除「續接未完成的面談」（「the counselor is warned but not rescued」）。職責是把話講真並攔下離開，不是補上被排除的能力。

### ⏱️ 程式一定打得開
`db.js` 的每一個 Promise 此前都**沒有逾時、沒有 `onblocked`、沒有 `onabort`、沒有 `onversionchange`**。實測重現兩條永久掛死路徑：

1.  **`open()` 遇 blocked**：持有舊版連線再開新版 → `onblocked` 觸發，`onsuccess`／`onerror` 5 秒內完全不 settle 且永不恢復。修正後 **2ms 內以 `VAULT_BLOCKED` 返回**。
2.  **交易被中止**：`onabort` 觸發而 `oncomplete`／`onerror` 都不觸發 —— 危險區重設與備份還原走的 `clearAll()` 會永遠掛住。

新增 `settleWithin()` 統一包裝（`open()` 8 秒、單筆操作 5 秒），並補上 `onblocked`、`onabort`、`onversionchange`（本分頁主動讓路，**這是將來任何一次改 schema 不會弄壞使用者的前提**）、`onclose`（清掉死連線快取）。

逾時／阻擋／中止一律**往上拋**而非吞成 `[]`／`false`／`null` ——「沒有回應」被靜默當成「沒有資料」，同工會看到空白歷史而以為紀錄遺失。

### 🗣️ 降級說人話，而且永遠有出路
*   開機**立即**渲染載入狀態（此前內容區是完全空白），2.5 秒追加「回應較慢」說明，8 秒落入具名降級。
*   `state.vaultDegradedReason` 分四種（`unavailable`／`blocked`／`timeout`／`error`）。**這個區分不是措辭潤飾**：後三者的紀錄其實還在 IndexedDB 裡，橫幅因此明說**「你的面談紀錄沒有遺失」**；只有 `unavailable`（無痕模式）才是真的存不進去。
*   降級橫幅由 `switchView()` 在每一頁渲染，附「重試連線」鈕。設定頁的引擎狀態同步顯示具體原因，取代此前在 blocked／timeout 情境下**錯誤**的單一句「可能為無痕瀏覽視窗」。
*   **M7 徽章對帳在 `blocked`／`timeout`／`error` 時跳過**，旗標不寫入。對著讀不到的保險箱做對帳，會收回同工合法取得的徽章 —— 那是一次因讀取失敗造成的真實資料損失。

### 🐛 建置期間抓到的 bug（由本里程碑自己的測試發現）
第一版守衛在同工確認離開後**沒有清掉 `state.activeSession`**，於是 `hasUnsavedInterview()` 永遠為真 —— **之後每一次導覽、每一次關分頁都會對一場他早已放棄的面談再問一次**。新增 `discardActiveInterview()`，只清未入庫者（報告頁與匯出仍需讀已入庫的 `activeSession`）。

### 📐 路線圖原文的更正
路線圖稱「開兩個分頁就可能觸發」卡死。**實測今日重現不到** —— `DB_VERSION` 始終為 1，不需升級就不會 blocked，兩個分頁都正常開機。該缺陷是**已上膛但未擊發**：任何一次 schema 變更都會讓所有雙分頁同工永久卡死。另兩條路徑今日即可觸發。PRD 的「unresponsive」條款不論觸發方式都要求修復，故照修，並據實記錄精確狀態。

### ✅ 驗證
*   `check_syntax.py` 全綠。
*   **`beforeunload`（以真實事件 dispatch 驗證）**：有 SOAP 內容 → 攔截；只有 ICF 內容 → 攔截；房間空白 → 不攔截；筆記只有空白字元 → 不攔截；入庫後 → 不攔截；放棄後 → 不攔截。
*   **應用內離開**：取消 → 仍在房間、筆記完整、**高亮沒有跑掉**；確認 → 離開且高亮正確移動、且**不再重複發問**。
*   **語系切換**：面談中切換 EN／繁中，**零次**確認，房間與筆記完好。
*   **評估失敗**：延遲失敗下覆蓋層確實顯示且房間在其後完好；失敗後留在房間、資料逐字不變；再試一次成功產出報告頁。
*   **`db.js`**：以真實原始碼僅改 `DB_VERSION` 常數模擬未來升級 → `VAULT_BLOCKED`，2ms。
*   **開機必定結束（真實逾時下驗證）**：工具環境開始節流 IndexedDB 時，快取中的舊 M7 版本停在「加載中...」、內容區空白、**主控台一行都沒有**；同一狀態下 M8 版本正常渲染儀表板、顯示具名橫幅與重試鈕、主控台兩條刻意的說明性警告。
*   **載入時間線**：0ms 出現 spinner ／ 2.85s 出現「回應較慢」／ 8.9s 完成並移除。
*   **重試連線**：失敗分支 8.2 秒回到可操作狀態，全程畫面可用，不進入無限等待。
*   **M7 對帳跳過**：降級下植入三個徽章（其中兩個依紀錄不該有）→ 重載後三個原封不動、旗標未寫入。
*   **回歸**：M5 單次結構化往返與缺欄位拋錯；M6 離線劇本標示；M7 儀表板數字與無字母等第。
*   **主題**：M8 新增元件於深淺主題皆可讀（已量測 computed style）。

### ⚠️ 未驗證
`clearAll()` 的 `onabort` 分支（程式碼已加，因工具環境 IndexedDB 被節流無法實跑）；「重試連線」的**成功**分支；真實 Gemini 金鑰端對端；MiniMax TTS 與連續 STT。

### 🚧 已知未處理
面談室在淺色主題下大面積不可讀 —— `ARCHITECTURE.md` §8 記錄的既有問題（面談室大量寫死深色背景）。M8 只觸及筆記區一個小元件，重建整個 view 的淺色主題不在「順帶處理當期觸及畫面」的範圍內。

### 📦 變更檔案
*   [src/utils/db.js](src/utils/db.js)：`VAULT_ERROR`、`settleWithin()`、`vaultError()`；`open()` 補 `onblocked`／逾時／`onversionchange`／`onclose`；七個方法全部有界並補 `onabort`；`probe()` 改回傳 `{ available, reason, message }`。
*   [app.js](app.js)：`hasUnsavedInterview()`／`discardActiveInterview()`／`initUnsavedInterviewGuard()`／`showEvaluatingOverlay()`／`hideEvaluatingOverlay()`／`renderVaultLoadingState()`／`renderVaultDegradedBanner()`／`vaultDegradedNotice()`／`vaultReasonFromError()`；`switchView()` 加守衛與布林回傳；`initNavigation()` 依回傳值移動高亮；`endRoleplaySession()` 改用覆蓋層並寫入 `vaultedAt`；筆記假儲存狀態機刪除。
*   [index.css](index.css)：草稿狀態列、載入卡、降級橫幅、評估覆蓋層（含淺色覆寫）；刪除 `@keyframes pulse-amber-dot`。
*   [index.html](index.html)：快取戳記 `v20260830_v25_m8`。
*   [ARCHITECTURE.md](ARCHITECTURE.md)、[Product_Roadmap.md](Product_Roadmap.md)、[plan/08-interview-never-vanishes.md](plan/08-interview-never-vanishes.md)。

**未更動**：`PRD.md`（本里程碑實作既有條款）、`CLAUDE.md`、`mockData.js`、`geminiService.js`、`DECISIONS.md`、`adr/`。

---

## [v20260829_v24_m7] - 2026-08-29 (香港時間 UTC+8)

## 🎯 Milestone 7「每個數字都來自你的紀錄」

平台只說它有證據的話。**沒有紀錄就顯示「尚無紀錄」，沒有評估就顯示「未評估」，沒有達標就不發徽章。**

計劃：[`plan/07-every-number-from-your-record.md`](plan/07-every-number-from-your-record.md)（已批准 2026-08-29）
對應 PRD v4：`HARD CONSTRAINTS → No Claim Without Evidence`、`No Fabricated Clinical Content`、`SSOT`

### 🧭 單一推導點（本次的核心）
新增 `computeCounselorRecord(historySessions)`，回傳 `{ totalSessions, evaluatedSessions, evaluatedCount, distinctCaseIds, userTurns, radar, radarAverage }`。儀表板、分析頁、縱向趨勢圖、徽章判定全部改讀它，各自的加總迴圈刪除。

`radar` 與 `radarAverage` 在零筆已評估面談時是 **`null`，不是 0**。這是結構性防呆而非風格選擇：D20 的成因正是「沒有評估」被寫成 0 之後靜默流進座標公式，畫出一個收縮到圓心的五邊形 —— 讀起來是「這位同工五項都拿 0 分」。`null` 進入同一條公式會立刻壞掉而不是說謊，呼叫端因此被迫顯式處理「尚無紀錄」。

### ❌ 移除的無據宣稱
*   **儀表板「個人能力值縮影」**：寫死的多邊形座標 `100,50 160,82 …` 與「聽力共情：極佳 (A)」「承諾行動引導：優良 (B+)」—— 零場面談也照樣顯示。改由同工自己的已評估面談推導，無紀錄時只畫格線並說明。
*   **四個字母等第**（卓越 A／優良 B+／合格 C／需提升 D）：全部刪除，改為「AI 即時回饋（練習參考）：你 N 場已評估面談的五維平均為 X 分」。
*   **MI 闖關結束語**：原本無論 20 分還是 100 分都說「這代表你已基本掌握」。改為據實顯示 `得分 / 滿分`（滿分由題庫計算，非寫死 100），並依實際得分率給不同措辭；低分時直說哪一類回應出了問題。
*   **「知識探險家」徽章**：原本走到最後一題就發，描述卻寫「完美通過」。條件改為三個理論模組全完成 **且** 闖關每題選中最高分回應。
*   **「初試啼聲」徽章**：原本離線無評估面談也發，描述卻寫「並生成評估報告」。條件改為需有已評估面談。
*   **縮影雷達說明**：「平台整合自學表現與 SOAP 評核的雷達圖」—— 程式從未整合這兩者。改為指出真實來源。
*   **分析頁「專家培訓建議」**：寫死「你目前在 ACT 的心理彈性概念上自學非常充足」，0/9 進度時亦然。改為指向紀錄中確實未完成的模組或確實最低的維度。
*   **小組研討結語**：無論答題結果都說小組「深化了實戰心得」。改為陳述完成題數並指向下一步。

### 🔢 「未評估」不再畫成「0 分」（D20 —— 是四處，不是三處）
1.  **儀表板平均分卡**：原以 `historySessions.length > 0` 開關，保險箱裡只有離線示範面談時顯示「0分」與空圓環。改看已評估場次 → 顯示「—」與「尚未評估 (N/A)」。
2.  **歷史詳情彈窗**：原把五維解構為 0 並照樣畫雷達與「同理反映 0」。零填充的解構整個刪除，改為說明卡。
3.  **分析頁雷達**：原在零筆已評估時仍以全 0 畫多邊形。改為不輸出 `<polygon>`，圖中央標示「尚無紀錄」。
4.  **縱向趨勢圖（本次新發現）**：原以 `historySessions.length < 2` 決定是否標示「模擬成長對照引導線」。兩場離線示範面談會讓它判定為「有真實資料」而抽掉徽章，但資料點經 `filter(hasEvaluation)` 後是空陣列 —— 畫出一張無徽章、無資料點卻聲稱屬於同工的趨勢圖。改看已評估場次。

### 🗣️ 練習輔助聲明（PRD v4「No Claim Without Evidence」最後一句）
凡出現分數或督導建議的位置都加上「以上為 AI 練習回饋，非督導評核；臨床判斷屬於真人督導。」共五處：面談室督導提示面板、面談後評估報告頁、歷史詳情彈窗評分卡、分析頁雷達卡、Markdown 匯出的評估段落。由單一常數與函式輸出，避免五份措辭各自漂移。

### 🗄️ SSOT：刪除完成場次的兩份副本（D7）
`rehab_completed_cases_count`（**零讀取點**）與 `rehab_completed_case_ids`（唯一讀取點為「實戰特工」徽章）自 `localStorage` 移除；`sessions` object store 成為唯一權威來源。

備份檔的 `completedCount` / `completedIds` 欄位名與格式**不變**（舊備份仍可還原），但值改由 `sessions` 推導，還原時刻意忽略 —— 寫回去只會重建一份可能與 `sessions` 矛盾的副本，那正是 D7 的成因。

### 🏅 徽章條件與一次性對帳
新增 `evaluateAchievement(id, record)`，回傳 `true` / `false` / **`null`**。`null` 代表**沒有可查證的持久紀錄**（ICF 沙盒結果不落地、自定義個案可被刪除、MI 闖關分數只存在於記憶體），此類徽章沿用既有值，不撤銷也不代發。

開機時執行一次 `reconcileAchievementsOnce()`（旗標寫入既有 `app_meta`，不需 DB 版本變更），只收回**條件可查證且不符**者，並在徽章牆顯示一次說明。

### 🐛 建置期間抓到的兩個 bug
**其一，由同儕審查讀碼發現**：`reconcileAchievementsOnce()` 的旗標檢查寫成 `done.value.done`，但 `RehabCounselorDB.getMeta()` 回傳的是 value 本身而非 `{key, value}` 記錄 —— 旗標形同不存在，對帳每次開機都重跑。因為效果上冪等，第一輪測試「通過」了但原因不對。已修正並以兩次開機（中間人為塞回徽章）重新驗證。

**其二，由自身測試抓到**
：`evaluateAchievement("theory_explorer")` 第一版在闖關未於本次執行時回 `false`，導致**每次重新整理都會收回**一個合法取得的徽章 —— `miGameScore` 開機歸零。改為此情況回 `null`（無從查證），只有當持久的理論進度證明未達標時才回 `false`。這正是「不可查證 ≠ 未達標」的分野，與 `radar` 用 `null` 而非 0 是同一個原則。

### 🎨 順帶處理（依路線圖，設計系統工作隨觸及畫面處理）
`#radar-recommendation-panel` 以 `rgba(10,15,30,0.85) !important` 寫死深色底，淺色主題下深字疊深底不可讀。補上 `[data-theme="light"]` 覆寫。屬 `ARCHITECTURE.md` §8 記錄的既有問題，本次只補這一塊。

### ✅ 驗證
*   `check_syntax.py` 全數通過。
*   **純函式隔離測試**（以真實模組原始碼於瀏覽器中執行，非複本）：零筆／全未評估 → `radar === null`；一評估一未評估 → 分母為 1；60 與 90 兩場加兩場未評估 → 平均 75；`distinctCaseIds` 去重正確；`radarPolygonPoints(null)` 回 `null`。
*   **徽章判定隔離測試**：`first_session` 僅未評估時不解鎖；`empathy_master` 89 不給、90 給；`combat_specialist` 需 3 個不同個案；`theory_explorer` 在「三模組完成但闖關 80%」「闖關滿分但 ICF 模組未完成」皆不解鎖，兩者俱足才解鎖。
*   **真實瀏覽器**：空保險箱、三筆未評估、一評估＋三未評估三種情境逐一檢視儀表板、分析頁、詳情彈窗、趨勢圖；全程未出現「0分」或字母等第。
*   **MI 闖關實走**：全選說教型回應 → 13/100，結束語為據實陳述，徽章**未**解鎖；全選最佳回應 → 100/100，徽章解鎖。
*   **對帳旗標實測**：開機一收回並寫入旗標；開機二把徽章人為塞回 → 對帳**未**再執行，徽章保留（「只跑一次」確實成立）。
*   **危險區「重設進度」**：保險箱清空、徽章清空、三個已停用的舊鍵一併移除、零 JS 錯誤。
*   **對帳實測**：植入六個徽章對上只支持四個的紀錄 → 收回 `empathy_master`（60<90 可查證），保留 `icf_expert`／`case_creator`（無從查證）與 `theory_explorer`；理論模組改為未完成後重測 → `theory_explorer` 被收回。重新整理後不重覆收回、說明不重覆顯示。
*   **備份還原**：匯出 → 清空 → 還原 → 重新開機，四個指標卡、縮影雷達、徽章清單與還原前**逐字相同**；備份檔不含任何 API 金鑰。
*   **回歸**：M5 單次結構化往返（`callCount === 1`、`responseSchema.required`／`propertyOrdering` 正確、缺欄位大聲拋錯）；M6 離線示範標示（氣泡徽章、`history[].scripted`、Markdown 逐行「［示範劇本］」與標頭警語）全部重跑通過。
*   **主控台**：全新分頁載入零錯誤。深色與淺色主題皆實際截圖檢視。

### ⚠️ 未驗證
真實 Gemini 金鑰的端對端流程（線上路徑以 stub 驗證）；MiniMax TTS 與連續 STT；降級模式（`localstorage-fallback`）下的對帳路徑（程式碼有分支，未實跑）；`prefers-reduced-motion` 與鍵盤操作（屬 D24，未列入本里程碑）。

### 📦 變更檔案
*   [app.js](app.js)：`computeCounselorRecord`／`radarPolygonPoints`／`evaluateAchievement`／`reconcileAchievementsOnce`／`miDrillMaxScore`／`renderSessionScoreCard`／`renderSessionNotEvaluatedCard`／練習聲明；儀表板、分析頁、詳情彈窗、趨勢圖、MI 闖關、小組研討、成就牆改寫；`completedCasesCount`／`completedCaseIds` 移除。
*   [mockData.js](mockData.js)：兩個徽章描述、`mini_radar_desc` 三語修正。
*   [src/utils/db.js](src/utils/db.js)：`buildBackupJSON` 改為推導、`importFullBackupJSON` 忽略衍生欄位。
*   [index.css](index.css)：`.practice-support-notice`、`.achievement-reconcile-notice`、`#radar-recommendation-panel` 淺色覆寫。
*   [index.html](index.html)、[app.js](app.js) 匯入：快取戳記更新為 `v20260829_v24_m7`（`geminiService.js` 未改，戳記保持）。
*   [ARCHITECTURE.md](ARCHITECTURE.md)、[Product_Roadmap.md](Product_Roadmap.md)、[plan/07-every-number-from-your-record.md](plan/07-every-number-from-your-record.md)。

**未更動**：`PRD.md`（本里程碑實作既有條款，未改產品意圖）、`CLAUDE.md`、`DECISIONS.md`、`adr/`、`geminiService.js`。

---

## [v20260829_v29_handoff] - 2026-08-29 06:02 (香港時間 UTC+8)

本次為交接前的文檔補完提交，**不涉及任何執行碼變更**。目的是把只存在於工作對話中、未落入任何文件的事實寫進 repo，使後續工作階段不必重新發現。

### 📐 ARCHITECTURE 新增第 8 節：表現層的量測現況
視覺一致性難以維持的原因，無法從任何單一檔案看出，故以量測記錄：

*   **樣式主要不住在樣式表裡**：`app.js` 有 **806** 個行內 `style` 屬性、**672** 個 `class` 屬性，而 `index.css` 有 **366** 條類別選擇器；行內樣式中有 **187** 個超過 100 字元（最長 524）。
*   **因此任何尺度都撐不住**：418 個 `font-size` 宣告用了 **45 種**字級，其中 **219 個（過半）擠在 0.70–0.85rem**，六個級距落在 2.4px 之內，無法表達層級；間距 **20** 種、圓角 **11** 種、斷點 **6** 個。
*   **因此淺色主題無法完整套用**：行內樣式特異度高於任何選擇器，而其中有 **155** 個寫死的顏色字面值（最常見 `rgba(255,255,255,0.02)` 與 `0.05` 各 11 次 —— 深色底上的表面層次，淺色底下會消失）；`index.css` 僅 **34** 條 `[data-theme="light"]` 覆寫。惟行內樣式亦有 **566** 處使用 `var(--…)`，故逸出是例外而非常態。
*   動效 **26** 組 `@keyframes` 對 **0** 個 `prefers-reduced-motion`；9 條 `:focus` 但無 `:focus-visible`。
*   權杖層本身健全：**32** 個 CSS 變數。問題不是沒有權杖，而是有一半介面不經過它們。

### 📜 CLAUDE.md 新增「工作如何排序」一節
把本專案實際遵循、但此前未寫入憲章的六步節奏記載下來：自路線圖取里程碑 → 寫程式碼前先產出 `plan/NN-slug.md`（含逐項風險審查與已決定的邊界處理）→ 擁有者整份批准 → 建置並驗證（誠實列出未驗證項）→ 同儕審查（重跑上一輪流程、檢查接縫、實跑錯誤路徑、依北極星與 SUCCESS 排序）→ 更新四支柱後交付推送。

### 📦 變更檔案
*   [ARCHITECTURE.md](ARCHITECTURE.md)：新增第 8 節。
*   [CLAUDE.md](CLAUDE.md)：新增「How work is sequenced」。

**未更動**：`PRD.md`、`Product_Roadmap.md`、`DECISIONS.md`、`adr/`、`plan/`。

---

## [v20260829_v28_prd_v4] - 2026-08-29 05:53 (香港時間 UTC+8)

本次為產品意圖升版提交，**不涉及任何執行碼變更**。

### 📜 PRD 升版 v3 → v4（經擁有者批准，寫入前已完整顯示差異，依規則移除「我作出的決定」段落）
四份專家審查（輔導員、督導與教師、自學系統開發、介面設計）指出的能力缺口，此前因 PRD v3 未描述而無法排入路線圖。v4 將其全部納入產品意圖：

*   **使用者角色擴充**：明列「**本身是障礙人士、以鍵盤或螢幕閱讀器工作的同工**」為服務對象；新增第三個角色 **Training Lead**（教材維護者），但**不給予應用內身分** —— 教材維護在檔案層完成，以免與無帳號架構衝突。
*   **新增四條硬性限制**：
    *   `Everyone Can Operate It` —— 每個練習（含 ICF 分類）須可**純鍵盤完成**、螢幕閱讀器可讀、不得依賴拖放；動效須尊重系統的減少動態偏好。「一個教 ICF 的平台，不能把它所描述的從業者排除在外。」
    *   `Risk Is Practised, Never Improvised` —— 風險披露個案（自殺意念、虐待、急性精神症狀）進入前標示，**出現時必與轉介與升級步驟同框**。只給風險不給處置，比不給風險更危險。
    *   `Honest Simulation` —— 模擬案主**不得是確定性獎勵函數**。正確技巧提高敞開的機率，但絕不保證。同工必須可能做對了仍換來沉默，平台不得教出真實案主不會兌現的預期。
    *   `No Claim Without Evidence` —— 平台對同工能力所作的每一個數字、等第、徽章與圖表，都必須自其本人紀錄計算；無紀錄即明說。**取消字母等第**，分數呈現為練習回饋而非評核，並在督導提示與分數旁明示臨床判斷屬於真人督導。
    *   另新增 `Teaching Material Is Data`（教材為可編輯資料檔）。
*   **既有條款收緊**：`Degradation Honesty` 由「儲存不可用時說明」擴充為「**不得停在無說明、無出路的無限載入狀態**」；`Security & Secrets` 加入「**模型輸出以文字渲染，絕不作為標記**」；`Data Ownership` 納入逐題練習紀錄；`SSOT` 的保險箱涵蓋練習紀錄。
*   **使用者流程擴充**：第 1 步加入錯題重現；第 2 步加入風險披露個案；第 3 步寫入 **Phase 13 督導干預**（措辭收緊為「為刻意練習某個臨床時刻」，以免被當成操控案主的玩法）；第 5 步要求匯出報告**逐回合帶上 AI 給過的指導**，讓督導能審閱。
*   **SUCCESS 收緊**：加入「**只用鍵盤完成 ICF 分類**」與「匯出檔顯示每一回合旁的督導指導」，令可及性與可審閱性在單次示範中可被驗證。
*   **新增 OUT OF SCOPE**：**本地化臨床內容**。介面與全部教材僅提供繁體中文（香港），不提供英文或簡體版本 —— 目前 EN／简中 只翻譯了導覽列，保留選項等於承諾一個不存在的版本。**這代表 170 處語系分支需要收斂，是可見的功能收窄。**

### 📐 v4 引入的已知距離（`ARCHITECTURE.md` §7 新增 D24–D31）
收緊 PRD 的代價是程式碼與它的距離變遠。全部以量測記錄，非推測：
*   **D24 可及性**：全庫 `aria-label` 0、`role=` 0、`tabindex` 0、`alt=` 0、`prefers-reduced-motion` 0（對 26 組 `@keyframes`）；ICF 沙盒純拖放，全 `app.js` 僅 1 個鍵盤事件處理。
*   **D25 風險情境**：個案庫中自殺／自殘／虐待／急性精神症狀全數零命中，唯一「危機」命中是「斷糧危機」這個財務用詞。
*   **D26 逐題練習紀錄**：MI 闖關只存 `miGameScore` 與 `miGameIndex`，無任何逐題記錄。
*   **D27 督導指導納入匯出**：`coachHint` 從不寫入 `history`，`exportSessionReport()` 內命中 0。
*   **D28 誠實模擬**：`geminiService.js` 明文指示案主「只有當輔導員使用正確技巧時才軟化」。
*   **D29 教材為資料**：全部教材寫死於 961 行的 `mockData.js`。
*   **D30 無證據不宣稱**：雷達彙總已於 F1 修正，但寫死儀表板雷達、無條件掌握宣稱、徽章條件、字母等第仍在（已排 Milestone 7）。
*   **D31 模型輸出以文字渲染**：`app.js:3884` 仍以 `innerHTML` 賦值（已排 Milestone 9）。

### ✅ v4 同時解決兩項舊漂移
*   **D17 已解決** —— Phase 13 督導干預寫入使用者流程第 3 步。
*   **D22 部分解決** —— 語系切換由 v4 反向裁定：本地化列為不做，故英文與简中選項應**移除**；激勵金句輪播 v4 仍刻意不納入，故應移除而非記載。兩項移除均尚未建置。

### 📐 文檔同步
*   [PRD.md](PRD.md)：v3 → v4。
*   [CLAUDE.md](CLAUDE.md)：更新 PRD 版本與涵蓋範圍敘述。
*   [ARCHITECTURE.md](ARCHITECTURE.md) §7：新增「Gaps introduced by PRD v4」小節（D24–D31）；D17 標記 RESOLVED；D22 更新為部分解決。
*   [Product_Roadmap.md](Product_Roadmap.md)：原「等待 PRD v4」段落改為「PRD v4 已批准，以下能力已可排入，待路線圖重排」，並新增「移除英文與简中語系選項」一項。**尚未建立新里程碑** —— 需要一次路線圖重排並經擁有者批准。

**未更動**：`DECISIONS.md` 與 `adr/`（PRD 升版屬產品意圖決定，非架構決策，不虛構 ADR）、`plan/`（目前無進行中的里程碑）。

---

## [v20260829_v27_prd_calibration] - 2026-08-29 03:27 (香港時間 UTC+8)

本次為 PRD ↔ 程式碼校準記錄提交，**不涉及任何執行碼變更**。

### 🔍 以 `PRD.md` v3 逐條校準線上程式碼
校準基準：磁碟上的 `PRD.md` 為 **v3**（同日提出的 v4 草案**未獲批准、未寫入**，故 v3 仍是產品意圖的權威來源）。受測程式碼為 `origin/main` = `9988551`，並抓取 Vercel 部署的五個執行檔比對，**逐位元組相同**。

#### ❗ SUCCESS 條款目前無法完整走通
SUCCESS 明文包含「輔導員**中途嘗試離開頁面時被警告攔截**」，而 `beforeunload` 在 `app.js` 與 `index.html` 的命中皆為 **0**。這改變了 D6 的性質 —— 它不只是耐久性缺口，更直接擋住 PRD 自己的示範腳本。

#### 新記錄的偏差
*   **D21 — 成就徽章未自保險箱計算。** SSOT 條款把「progress milestones」列為必須自 vault 計算的衍生值，但 `rehab_unlocked_achievements` 讀寫於 `localStorage`（`app.js:40`、`472`、`6540`）。此項延伸自 D7 —— D7 只涵蓋完成場次計數與已完成個案清單。雷達彙總已於 F1 修正（三處 `filter(hasEvaluation)`），成就則未處理。
*   **D22 — 另外兩個已上線功能不在 PRD v3 內**，與 D17 同族：三語系切換（`app.js` 內 **170 處** `state.locale` 分支）與激勵金句輪播（4 處引用）。以 `locale`／`language`／`quote`／`intervention`／`inject` 搜尋 PRD 全文，命中 **0**。依 SSOT 規則以更新 PRD 解決，不得反向刪除已上線功能。
*   **D23 — 語意落差（非違反）**：PRD 的「staged MI practice drills」僅在「十題循序關卡」的意義上成立，題目資料內無改變階段欄位（`oars_game` 中 `stage` 與「階段」皆不存在）；ACT 自我測驗以關鍵字比對通過，惟 PRD 只要求「self-tests」未規定深度。

#### 以實際檢查確認無恙
*   **OUT OF SCOPE 五項全部未違反。** 初次 grep 的 `LMS`／`credential` 有 6 個命中，逐一檢視後確認**全為誤判** —— `miniMax`**`xApi`**`Key` 觸發了 `xapi` 樣式；兩個 `password` 命中皆為金鑰輸入框，非登入。
*   **存取模型恰如 PRD**：無登入、無 token、無伺服器端點（除官方 AI 供應商）、無多租戶資料，既未多做也未少做。
*   **USER JOURNEY 第 1、2、3、5 步達成**；HARD CONSTRAINTS 的 Roles & Access、Capabilities & Voice、AI Gateway & Validation 三條完全符合。
*   **資料庫**：`DB_VERSION` 維持 1，三個 object store 全部使用中、無孤立 store 或欄位。`src/utils/db.js` 最後改動為 `97c4f6d`（保險箱建置），此後未再變更。M6 的 `history[].scripted` 與 F1 的 `report: null` 均為記錄內部選填變化，既有記錄未被改寫，**未發生刪表重建，不需 migration**。

#### 阻塞級偏差全部已在路線圖內
四項會破壞北極星或 SUCCESS 的偏差 —— 離開攔截未建置、開機可能無聲卡死、儀表板寫死雷達與無條件掌握宣稱、「已安全備份」不實聲明 —— **全部落在既有的 Milestone 7／8 範圍內。本次校準未推翻既定排序，反而確認了它。**

不阻塞者：每日呼叫上限未建置（M9）、完成場次與成就未自 vault 計算（M9）、診斷日誌保存金鑰特徵（M9）、`innerHTML` 注入面（M9）、三項 PRD 未描述功能（待 PRD v4）。

### 📄 PRD v4 草案已提出，待批准
同日產出 v4 草案，納入九項待決能力（風險與危機情境、可及性基線、學習者模型與逐題作答記錄、督導提示保存並匯出、教材作者流程、AI 督導定位聲明、案主反應加入不確定性、介面語言選項處置、Phase 13 干預功能）。**未獲批准，未寫入 `PRD.md`**，故本次校準與後續工作仍以 v3 為準。

### 📐 文檔同步
*   [ARCHITECTURE.md](ARCHITECTURE.md) §7：新增「PRD v3 ↔ code calibration」小節，記錄 SUCCESS 不可達成、**D21／D22／D23**，以及本次確認無恙的項目；D6 補註其同時阻擋 SUCCESS。
*   [Product_Roadmap.md](Product_Roadmap.md)：未變更 —— 校準確認現有排序正確，無須調整。

**未更動**：`PRD.md`（v4 未獲批准，不得反向修改 v3）、`DECISIONS.md` 與 `adr/`（本輪為校準，未作出新架構決策，不虛構 ADR）、`plan/`（目前無進行中的里程碑）。

---

## [v20260829_v26_roadmap_reorder] - 2026-08-29 03:14 (香港時間 UTC+8)

本次為路線圖重排提交，**不涉及任何執行碼變更**。

### 🗺️ 依四份專家審查重排路線圖，新增 Milestone 7
以輔導員、督導與教師、自學系統開發、介面設計四個視角完整檢視程式後，發現三份審查獨立指向同一個模式：**平台在多處說出它證明不了的話**。

*   **新增 Milestone 7「每個數字都來自你的紀錄」**，把該模式的四種表現合為一個里程碑處理：
    *   儀表板「個人能力值縮影」雷達**完全寫死**（座標為字面值、「聽力共情：極佳 (A)」為寫死字串、無任何條件判斷），卻在說明中宣稱「整合自學表現與 SOAP 評核」。**任何人零場面談就被告知同理心極佳。**
    *   未評估的面談在三處被畫成 0 分（原 D20）。
    *   MI 闖關結束語「你已基本掌握」**無任何依分數分支**，10 分與 100 分收到同一句。
    *   「知識探險家」徽章描述稱「完美通過」，實際走到最後一題即解鎖，且不檢查 ACT／ICF 分頁。
    *   一併把五維分數的字母等第（卓越 A／優良 B+／合格 C／需提升 D）改為「AI 即時回饋（練習參考）」—— 那是語言模型的即時印象，不具信效度，不應具備評核外觀。
    *   *追溯 PRD v3*：`No Fabricated Clinical Content`；`SSOT`（「radar aggregates, progress milestones … computed in one place from the vault」）。
*   **原 Milestone 7／8 順延為 8／9。** Milestone 7 不依賴任何前置且修的是產品可信度根本，應排最前。
*   **Milestone 8「不會憑空消失的面談」擴充範圍**：併入開機可靠性 —— 程式有時會永遠停在「加載中... 請稍候...」而完全打不開（`db.js` 的 `open()` 未處理 `onblocked`、`hydrateVault()` 無逾時、首次渲染被其阻塞），開兩個分頁即可能觸發。原屬 Milestone 9 保險箱範疇，因「打不開」的嚴重度高於一切而移前，經擁有者批准。
*   **Milestone 9「可信賴的本地紀錄」擴充範圍**：併入督導提示面板的 `innerHTML` 注入面（`ARCHITECTURE.md` §7 D16）。個案「基因碼」導入接受他人任意字串，構成可達路徑，而本機儲存著 API 金鑰。
*   **Milestone 6 標記完成**，其範圍（離線示範誠實化）已達成；D20 移交 Milestone 7。

### 🚧 明列「等待 PRD v4」的九項待決能力
四份審查中價值最高的多項建議，`PRD.md` v3 **完全沒有描述**，依路線圖規則不得寫成里程碑。新增專節列出，等待擁有者在 PRD 層裁決：風險與危機情境、可及性基線、學習者模型與逐題作答記錄、督導提示保存並匯出、教材作者流程、AI 督導定位聲明、案主反應加入不確定性、介面語言選項處置、Phase 13 干預功能補寫入 PRD。

**設計系統重整**（45 種字級、806 處行內樣式、淺色主題、載入與空狀態、命名回到臨床語域）不改變產品承諾，明列為不設里程碑，隨各里程碑順帶處理。

### 📐 文檔同步
*   [Product_Roadmap.md](Product_Roadmap.md)：Milestone 1–5 內容一字未動；M6 標記完成並註明範圍調整；插入新 M7；原 M7／8 順延並擴充；新增「等待 PRD v4」專節與重排說明。
*   [plan/06-honest-offline-demo.md](plan/06-honest-offline-demo.md)：狀態改為 Completed，註明 D20 移交 Milestone 7 及理由。
*   [ARCHITECTURE.md](ARCHITECTURE.md) §7：D20 註明已排入 Milestone 7，並說明它與另外三種表現同屬一個模式。

**未更動**：`PRD.md`（產品意圖 SSOT，四份審查的新能力建議須經 PRD v4 才能進場，不得反向修改）、`DECISIONS.md` 與 `adr/`（本輪為排序決定，非架構決策，不虛構 ADR）。

---

## [v20260829_v25_f1_review] - 2026-08-29 02:04 (香港時間 UTC+8)

本次為同儕審查記錄提交，**不涉及任何執行碼變更**。審查對象為 `f4f747d`（F1 修正）。

### 🔴 D20：F1 的修正只做了一半 —— 「未評估」被呈現為「0 分」
移除了偽造的高分，卻讓未評估的面談在三處被畫成零分。**那是同一個謊的鏡像：原本諂媚，現在貶低，兩者同樣不實**，而且違反的是同一條 PRD 條款 —— 讓同工讀到一個並不存在的臨床結論。

*   **儀表板**（`app.js:800-802`）：顯示條件是 `historySessions.length > 0` 而非已評估數。以 `historySessions = [{report:null}]` 實際求值該運算式，結果為 **「0分」**，正確應為「—」。這代表只做過離線示範的同工，儀表板會說他的平均分是 0。
*   **歷史詳情彈窗**（`app.js:5947` 之後）：**三者中最嚴重**。標題「本次面談技巧評分」下的整個雷達區塊仍無條件渲染，未評估者畫出塌陷在圓心的五邊形 —— 讀起來是「這場拿了 0 分」而非「這場沒有評估」。F1 修正當時只改了旁邊的督導總結文字，漏了分數區塊本身。
*   **分析頁雷達**（`app.js:5581`、`5732`）：多邊形仍以全 0 的 `state.radarScores` 繪製。等第那行已正確顯示「尚無已評估的面談紀錄」，故旁邊尚有文字線索。

三處是同一個缺陷，須在同一次修正中一併處理 —— 分開修就是產生此缺陷的那種狹隘修復。

### ✅ 以實際執行確認無恙
*   **重跑上一輪流程**：`check_syntax.py` 全綠；離線評估拋 `OFFLINE_NO_EVALUATION` 且零網路請求；有金鑰時評估正常且 prompt 確實帶入對話；**M6 四條與 M5 五條回歸全部通過**。
*   **接縫**：`hasEvaluation()` 5 個使用點；`renderSessionReport` 僅一個呼叫者，故 `renderSessionCompletedWithoutEvaluation()` 讀 `state.activeSession` 必為當前面談，不會誤讀歷史紀錄；`exportSessionReport` 三個呼叫點（`null`／`report`／`session.report`）皆在守衛內；彙總處以 `.filter(hasEvaluation)` 呼叫，`filter` 多傳的 index/array 被忽略，行為正確。
*   **資料表**：`src/utils/db.js` 未被改動，`DB_VERSION` 維持 1，無 schema 變更、無 migration、無刪表。`report: null` 是既有欄位的合法值。
*   **存取模型**：本輪新增行中零個 `auth`／`token`／`login`／`server` 命中，仍為單人本地優先，恰如 PRD v3。
*   **重複狀態**：無。`hasEvaluation()` 為純述詞，未新增任何 state 或儲存欄位。

### ⚠️ 驗證限制（誠實聲明）
審查期間瀏覽器面板持續為 `visibilityState: "hidden"`，所有 IndexedDB 非同步呼叫 30 秒逾時，應用開機甚至停在「加載中... 請稍候...」（`hydrateVault()` 未完成）。改用 localStorage 植入資料讓開機自行遷移，同樣卡住。

**因此 D20 的證據來自程式碼與運算式模擬，未經畫面確認。** 證據本身充分（顯示條件與繪圖輸入都是可直接讀出的表達式），但必須說明它沒有視覺佐證。

`f4f747d` 提交前那一輪確實跑過瀏覽器，但涵蓋的是「面談後的無評估完成畫面」與「混合分母」，**並未涵蓋「只有未評估紀錄時的儀表板」與「未評估紀錄的詳情彈窗」** —— 這正是 D20 漏網的原因。

### ⚠️ 本輪未重新測試
儀表板／分析頁／詳情彈窗的實際畫面、保險箱遷移與備份還原、MiniMax TTS、連續廣東話 STT、ICF 沙盒、理論學習 Hub、MI 五關卡、小組研習、成就徽章，以及真實 Gemini 金鑰端對端。

### 📐 文檔同步
*   [ARCHITECTURE.md](ARCHITECTURE.md) §7：新增「Open finding from the F1-fix peer review」小節，記錄 **D20（未解決）** 及其驗證限制。既有的 **D6／D6′、D13、D16、D17** 維持未解決。
*   [Product_Roadmap.md](Product_Roadmap.md)：Milestone 6 重新標記為「對話與評估已誠實化；D20 待修 ⚠️」。
*   [plan/06-honest-offline-demo.md](plan/06-honest-offline-demo.md)：新增 §10 記錄本次審查、三個位置的細節與驗證限制。

**未更動**：`PRD.md`（產品意圖 SSOT，偏差記於本檔而非反向修改 PRD）、`DECISIONS.md` 與 `adr/`（本輪為審查，未作出新的架構決策，不虛構 ADR）。

---

## [v20260829_v24_m6b] - 2026-08-29 01:00 (香港時間 UTC+8)

### 🚫 Milestone 6 補完：移除偽造的臨床評估
同儕審查發現 M6 只標示了示範**對話**，漏掉臨床**評估**。依 [plan/06-honest-offline-demo.md](plan/06-honest-offline-demo.md) §9 補完。

*   **離線模式不再產生假評估**：`generateSessionReport()` 的 `!apiKey` 分支原本回傳寫死的 `scores`（80/75/85/70/90）與 `summary`。實測證實：兩個不同個案、兩段完全不同的對話，回傳內容**逐字元相同**，而且總結一律點名「阿強」—— 對一場與美玲的面談，那句「你精準捕捉到了阿強對家人的責任感」所描述的事從未發生。該報告會進入雷達圖、寫入保險箱、匯出給督導，且無任何標示。現改為拋出 `code: "OFFLINE_NO_EVALUATION"`。
*   **離線面談仍完整保存**：逐字紀錄與 SOAP／ICF 日誌是同工的真實工作產物，不因缺少評分而丟棄。`endRoleplaySession()` 區分「離線無評估」與「有金鑰但呼叫失敗」，前者照常建立 `completedSession`（`report: null`）並寫入保險箱，後者維持大聲報錯且不寫入半套記錄。
*   **新增無評估完成畫面**：`renderSessionCompletedWithoutEvaluation()` 只呈現真實存在的內容 —— 逐字回顧（含示範標記）與同工自己撰寫的日誌，明說沒有臨床評估及原因，不畫雷達、不給等第、不編總結。
*   **十四個消費點統一守衛**：新增單一述詞 `hasEvaluation(session)`。**彙總類將未評估面談排除於分母之外，不以 0 計入** —— 以 0 計入會靜默拉低同工的真實統計，那是另一種形式的失真。歷史卡片改顯示「離線示範 · 未評估」；詳情彈窗以說明取代督導總結；Markdown 匯出略去評分段落改列說明行；成就 `empathy >= 90` 在無評估時略過。
*   **一併移除分析頁的偽造雷達預設值**：`app.js` 原本在零筆歷史時塞入 `{75, 60, 80, 45, 65}` 並據此算出等第，令**從未做過任何面談**的同工看到「優良 (B+)」。改為雷達留白、等第顯示「尚無已評估的面談紀錄」。只修離線報告而留下它就是狹隘修復。**縱向趨勢圖的模擬資料不動** —— 它已有 `simulatedBadge` 與虛線樣式，本來就誠實。
*   **快取破除**：`index.html` 的 `app.js?v=`、`app.js` 的 `geminiService.js?v=` 更新至 `v20260828_v23_m6b`。

### ✅ 驗證 (Verification)
*   `python3 check_syntax.py` 全數通過。
*   **stub 隔離測試**：離線評估拋 `OFFLINE_NO_EVALUATION` 且零網路請求；有金鑰時評估正常且 prompt 確實帶入對話；**M6 四條與 M5 五條回歸全部重跑通過**。
*   **真實瀏覽器**：離線結束面談出現「本次沒有臨床評估」畫面、無雷達無等第、不再點名阿強；逐字（含示範標記）與 SOAP 日誌完整保留；保險箱記錄 `report === null`；Markdown 匯出無評分數字、有說明行、仍含逐字；分析頁零評估時「優良 (B+)」已消失、改顯示「尚無已評估的面談紀錄」；歷史卡片顯示「離線示範 · 未評估」；詳情彈窗以說明取代總結。
*   **混合分母測試**：保險箱放入 1 筆已評估（五項各 60 分）＋ 1 筆未評估 → 等第為「合格 (C)」、儀表板顯示 60。**分母為 1 而非 2** —— 若誤把未評估者以 0 計入會得 30 分（需提升 D）。
*   全新分頁載入主控台零輸出。
*   ⚠️ **未執行**：真實 Gemini 金鑰端對端。

### 📐 文檔同步
*   [ARCHITECTURE.md](ARCHITECTURE.md) §7：新增「Findings from the Milestone 6 peer review」小節，**D18（偽造臨床評估）與 D19（偽造雷達預設值）皆標記為 RESOLVED**。**D6／D6′、D13、D16、D17 仍未解決**，分屬 M7／M8 與待決事項。
*   [Product_Roadmap.md](Product_Roadmap.md)：Milestone 6 於補完後重新標記 Completed。
*   [plan/06-honest-offline-demo.md](plan/06-honest-offline-demo.md)：新增 §9 補完計劃與 §9.7 驗證結果。

### 📦 變更檔案 (Files Changed)
*   [geminiService.js](geminiService.js)：`generateSessionReport()` 移除罐頭報告，改拋帶 `code` 的錯誤。
*   [app.js](app.js)：新增 `hasEvaluation()` 與 `renderSessionCompletedWithoutEvaluation()`；`endRoleplaySession()` 區分離線與失敗；儀表板、分析頁彙總、趨勢圖、歷史卡片、詳情彈窗、Markdown 匯出、成就門檻共 14 處加上守衛；移除偽造雷達預設值與其等第；更新快取戳記。
*   [index.html](index.html)：更新 `app.js` 快取戳記。

---

## [v20260828_v23_m6] - 2026-08-28 10:53 (香港時間 UTC+8)

### 🎭 Milestone 6 交付：誠實的離線示範
依 [plan/06-honest-offline-demo.md](plan/06-honest-offline-demo.md) 建置。

*   **刪除通用假對白**：`geminiService.js` 離線分支原本在個案沒有 `roleplay_flow` 或劇本用盡時，回傳一段寫死的「（案主低下頭，輕聲說）社工，我真係好累……」＋寫死督導提示。該段徹底移除，改為拋出兩種語意明確的狀況：個案從無劇本（`OFFLINE_NO_SCRIPT`）、劇本已播放完畢並附回合數（`OFFLINE_SCRIPT_EXHAUSTED`）。
*   **無劇本個案於進入面談前攔截**：新增匯出的純函式 `getScriptedFlow()`，由 `geminiService` 與 `app.js` 共用同一個「有沒有劇本」的定義。`startRoleplaySession()` 開頭集中判斷，四個面談入口自動受同一規則保護；無金鑰且無劇本時不建立 session，改掛載說明面板（附「前往設定頁」與「返回個案大廳」），**不使用 alert** —— 這是常態狀況而非錯誤。
*   **示範回合三層標示**：對話氣泡加「示範劇本」徽章與琥珀左緣（`.bubble-scripted`）；`state.activeSession.history[].scripted` 寫入會話記錄並存進保險箱；歷史詳情彈窗與 Markdown 匯出同步標示，匯出另加總體警語。**理由**：一場全程示範的面談交到督導手上時，此前與真實練習完全無法分辨。
*   **線上模式開場白不標示**：`initial_dialogue` 是個案檔案本身的內容（PRD 使用者流程第 2 步），非偽裝成即時生成的回應；僅離線模式標示。
*   **建置期額外修正**：劇本邊界原本沿用「對話生成失敗：…」的措辭，把正常的示範結束說成系統故障。改為由錯誤物件的 `code` 區分常態邊界與真正失敗，alert 與督導面板措辭分開處理。
*   **刪除死碼** `refreshChatHistoryFeed()`（零呼叫者）。留著是地雷 —— 它渲染不帶示範標示的氣泡，日後被接線會靜默抹掉本里程碑的標示。
*   **快取破除**：`index.html` 的 `app.js?v=` 與 `index.css?v=`、`app.js` 的 `geminiService.js?v=` 一併更新至 `v20260828_v22_m6`（`index.css` 自 `v20260724_v13_1` 起未曾更新，本次因新增樣式必須同步）。

### 🔧 一併修正 Milestone 5 遺留回歸 D15
督導干預指令在失敗回合後靜默遺失。`app.js` 在 API 呼叫前就清空 `promptModifiers`，而 M5 的失敗回滾又把承載該指令的孤立 history 項目 pop 掉。現於清空前保留副本，失敗回滾時放回佇列。

**為何在本里程碑處理**：M6 令離線分支開始拋錯，該錯誤直接落入 D15 所在的失敗路徑，可達性大幅提高 —— 不能在明知有靜默資料遺失的路徑上疊加新流量。

### ✅ 驗證 (Verification)
*   `python3 check_syntax.py` 全數通過。
*   **stub 隔離測試**：無劇本拋錯且零網路請求；劇本未盡正常回傳且帶 `scripted: true`；劇本用盡拋錯並正確報出回合數；`roleplay_flow` 為空陣列視同無劇本；**M5 五條回歸測試全部重跑通過**（單次呼叫、schema 注入、歷史帶入、Markdown 解析、缺欄位與空白欄位拋錯、其他四個 Gemini 函式 `responseSchema === undefined`）。
*   **真實瀏覽器**：離線進入阿強，開場白與三回合劇本回應皆帶徽章與琥珀左緣（實測 `border-left: 3px solid rgb(245,158,11)`）；劇本用盡明確告知且未產生任何假對白氣泡，舊的「案主低下頭」確認未出現；離線點擊無劇本個案顯示說明面板且**未建立面談室**；設定金鑰後同一個案可正常進入、線上開場白不標示、離線徽章消失；**D15 回歸測試通過** —— 注入干預後觸發失敗，重試請求仍含「臨床督導即時注入指令」；匯出 Markdown 含總體警語與逐行標記；歷史詳情彈窗 3 則示範氣泡皆帶徽章；全新分頁載入主控台零輸出。
*   ⚠️ **未執行**：真實 Gemini 金鑰端對端（線上路徑以 stub 驗證）。

### 📐 文檔同步
*   [ARCHITECTURE.md](ARCHITECTURE.md)：§3 新增離線示範路徑（2b）的實況描述；§7 標記 **D5、D14、D15 為 RESOLVED**。**D6／D6′（草稿無持久層與「已安全備份」不實聲明）、D13（每日用量上限）、D16（`innerHTML` 注入面）、D17（干預功能不在 PRD）仍未解決**。
*   [Product_Roadmap.md](Product_Roadmap.md)：Milestone 5 因 D15 修正而標記 Completed；Milestone 6 標記 Completed。

### 📦 變更檔案 (Files Changed)
*   [geminiService.js](geminiService.js)：新增匯出的 `getScriptedFlow()`；離線分支移除通用假對白，改拋帶 `code` 的錯誤並於劇本回合回傳 `scripted: true`。
*   [app.js](app.js)：新增 `renderOfflineScriptUnavailable()`；`startRoleplaySession()` 加入離線守衛；`renderChatBubble()` 新增 `opts.scripted`；開場白與劇本回合標示；`history[].scripted` 寫入；詳情彈窗與 Markdown 匯出標示；D15 修正；刪除 `refreshChatHistoryFeed()`；更新快取戳記。
*   [index.css](index.css)：新增 `.bubble-scripted` 與 `.bubble-scripted-tag` 樣式（含淺色主題覆寫）。
*   [index.html](index.html)：更新 `app.js` 與 `index.css` 快取戳記。
*   [plan/06-honest-offline-demo.md](plan/06-honest-offline-demo.md)：新增，含完整驗證結果表。

---

## [v20260828_v22_m5_review] - 2026-08-28 02:26 (香港時間 UTC+8)

本次為同儕審查記錄提交，**不涉及任何執行碼變更**。審查對象為 `24e8a85`（Milestone 5），全程以實際執行為準，未修改程式碼。

### 🔴 發現 Milestone 5 自身引入的回歸（D15）
*   **督導干預指令在失敗回合後靜默遺失**。M5 的失敗回滾（`plan/05` §3.6）造成：`app.js:3762` 在 API 呼叫**之前**清空 `state.activeSession.promptModifiers`，而回滾又把承載該指令文字的孤立 history 項目 pop 掉，指令因而徹底消失。同工按下「⚠️ 突發抗拒」→ 該回合失敗 → 重試 → 干預不再生效，**畫面上無任何提示**。
*   **A/B 實測證據**：把 `063acdc`（M5 之前）取出於另一埠（8766）啟動，以完全相同的 fetch 攔截手法比對整個請求主體 —— 舊版第 2 次請求**仍含** `臨床督導即時注入指令`（靠孤立 history 殘留），M5 版**已遺失**。
*   第一次量測抓錯位置（只看最後一段 prompt，而該指令在舊版是留在 `contents` 的歷史項目內），修正方法後重測才得到上述結果。
*   違反專案編碼原則「發生錯誤時向使用者呈現真實錯誤，不得假裝成功」。**修正前 Milestone 5 不算交付**，`Product_Roadmap.md` 狀態已改為「同儕審查發現回歸待修 ⚠️」。

### 🟡 已記錄、不阻塞的發現
*   **D16 — 督導面板以 `innerHTML` 渲染模型輸出**（`app.js:3810`）。實測 `<img src=x onerror=…>` **確實執行**（`window.__XSS` 被設定）。案主對白是安全的（`renderChatBubble` 使用 `textContent`），僅此一處。**屬既存問題，M5 未加劇** —— 舊版同樣賦值 `innerHTML`，且 `display:none` 不阻止 `onerror` 觸發。惟存在一條具體可達鏈：個案「基因碼」導入（`synthesis-import-btn`）接受來自他人的任意 base64 字串，可挾帶提示注入，而 `localStorage` 內存著 API 金鑰。
*   **D17 — Phase 13 督導即時干預功能不在 PRD v3 內**。`promptModifiers`、四顆指令按鈕與 `rp-intervention-send-btn` 是完整功能，但 PRD 全文 grep `intervention|inject|干預|directive` 零命中。此為 2026-08-27 23:14 審計的漏列。**依 SSOT 規則不修改 PRD 迎合實作**，僅記錄偏差，待擁有者決定。
*   **D5 補充實測數據**：七個內建個案的 `roleplay_flow` 僅 1–3 回合，`case_02`／`case_mental_cheng`／`case_asd_kahou`／`case_sensory_meiling` **第 2 回合起**即落入通用假對白。M5 加入的面板層「示範劇本」標記涵蓋整個離線模式，但對話氣泡本身仍無標示（屬 Milestone 6）。

### ✅ 以實際執行確認無恙的項目
*   **上一輪流程在目前版本仍可用**：`check_syntax.py` 全綠；stub 主路徑 `callCount === 1`；瀏覽器首回合提示無需點擊即可讀；切換與標籤同步；失敗回合回填與孤立氣泡移除。
*   **新增回歸測試**：以 stub 逐一呼叫 `generateCustomCase`／`generateSessionReport`／`generateCustomQuiz`／`generateSoapSuggestions`，四者的 `generationConfig.responseSchema` 皆為 `undefined`，證明 `callGeminiAPI` 第 7 個參數未波及既有呼叫點。
*   **邊界情況實跑**：連續兩次失敗無氣泡累積（7 → 7 → 7）；等待期間打字後失敗不覆蓋新輸入；手動收合後新回合被強制展開（符合 PRD「visible by default on arrival」，屬預期行為）。
*   **接縫**：`setCoachPanelVisible()` 為 top-level 宣告，三個呼叫點均在其後；`clientShortName` 全檔零殘留；失敗回滾的氣泡守衛 `classList.contains("bubble-user")` 與 `renderChatBubble` 的 `bubble-${sender}` 命名相符。
*   **資料表**：本輪與 M5 皆未動 `src/utils/db.js`，`DB_VERSION` 維持 1，無 schema 變更、無 migration、無刪表重建。
*   **存取模型**：無變動，仍為單人本地優先、無帳號、無伺服器權限關卡，恰如 PRD v3。

### ⚠️ 本輪未重新測試（誠實列出）
MiniMax TTS 雙引擎與性別音色綁定、連續廣東話 STT（需麥克風）、保險箱遷移／備份／還原、面談結束→雷達報告→Markdown 匯出、ICF 沙盒、理論學習 Hub、MI 五關卡、小組研習、學習分析、成就徽章，以及**真實 Gemini 金鑰端對端**（`propertyOrdering` 是否被模型接受仍未知）。

### 📐 設計上的已知極限（非缺陷，供日後查閱）
角色 A 對 `reply` 的「禁止旁白、動作描述、括號註解」是 **prompt 層約束，無程式層強制**。`responseSchema` 只保證欄位存在與型別，管不到內容；模型若不遵守，含旁白的文字會直接送入 TTS 朗讀。

### 📦 變更檔案 (Files Changed)
*   [ARCHITECTURE.md](ARCHITECTURE.md)：§7 新增「Findings from the Milestone 5 peer review」小節（D15／D16／D17），D5 補上實測的劇本長度數據。
*   [Product_Roadmap.md](Product_Roadmap.md)：Milestone 5 狀態改為「已建置，同儕審查發現回歸待修 ⚠️」，並註明修正前不算交付。
*   [plan/05-synchronous-dual-track-response.md](plan/05-synchronous-dual-track-response.md)：新增第 8 節同儕審查結果，含 A/B 對照表與未測清單。
*   [Product_Roadmap.md](Product_Roadmap.md)：另修正一處文件矛盾 —— Milestone 2 原標記「Half Delivered ⚠️／同步性未兌現」，但該半邊已由 M5 建置完成，改標記為「Completed ✅」並註明同步性由 M5 補齊。
*   [CHANGELOG.md](CHANGELOG.md)：本條目。

**未更動**：`PRD.md`（產品意圖 SSOT，偏差記於本檔而非反向修改 PRD）、`DECISIONS.md` 與 `adr/`（本輪為審查，未作出新的架構決策，不虛構 ADR）。

---

## [v20260828_v21_m5] - 2026-08-27 23:43 (香港時間 UTC+8)

### ⚡ Milestone 5 交付：同一口氣的雙軌回應，兌現 ADR-0002
依 [plan/05-synchronous-dual-track-response.md](plan/05-synchronous-dual-track-response.md) 建置。

*   **單次結構化往返 (Single Structured Round-Trip)**：
    *   `callGeminiAPI()` 新增第 7 個參數 `responseSchema`；提供時於 `generationConfig` 同時注入 `responseMimeType: "application/json"` 與 schema。既有 `responseJson` 參數與其四個呼叫點完全不動，無回歸風險。
    *   `generateClientReply()` 由**兩次循序純文字呼叫**改為**單次呼叫**，schema 為 `{ reply, coachHint }` 兩個 STRING 欄位，`required` 兩者、`propertyOrdering` 先 `reply` 後 `coachHint`，保留督導須分析案主回應的邏輯依賴。同一順序要求另以文字寫入 `systemInstruction`，不單靠該欄位。
    *   `systemInstruction` 以分隔區塊定義雙重角色：角色 A 案主（`reply` 僅限廣東話對白，明文禁止旁白、動作描述、括號註解、角色標籤與臨床分析 —— 該欄位直接送入 TTS 朗讀）；角色 B 臨床督導（`coachHint` 明文禁止使用案主口吻或重複案主對白）。
    *   解析後嚴格驗證兩欄位皆存在、為字串、trim 後非空；任一不符即拋出真實錯誤並附原始回應內容。
*   **刪除罐頭督導提示 (Fail Loudly, No Fake Data)**：`generateCoachHint()` 整支函式連同其 catch 回傳的寫死臨床建議字串（「【AI 督導提示暫時無法加載】…」）移除。該降級路徑會把預先寫死的通用臨床建議偽裝成 AI 督導分析，且在畫面上與真實分析完全無法分辨。
*   **督導提示預設可見 (PRD v3: visible by default on arrival)**：
    *   移除面板的 `display:none` 初始樣式，並將每回合結束時的 `display = "none"` 改為可見。**此前每一回合都主動把提示重新藏起，同工每說一句話都要再點一次按鈕** —— 產品核心價值長期被藏在一顆重複按鈕之後。
    *   新增 `setCoachPanelVisible()` 作為面板顯示狀態的單一控制點，令面板與切換按鈕的圖示／文字永遠一致。切換按鈕保留 —— PRD 允許 dismissible，只禁止預設隱藏。
*   **移除寫死的開場督導提示**：原文對**所有**個案一律宣稱「案主剛進來，擺出強烈的抗拒姿態」，不論該個案的 MI 抗拒參數為何，屬未經任何 AI 分析的偽臨床判斷。改為不含任何臨床斷言的中性空狀態。此項為 M5 必要之舉：面板改為常駐可見後，該段文字會成為同工開啟面談後看到的第一段、且持續可見的內容。連帶移除因此失去用途的 `clientShortName` 變數。
*   **失敗回合乾淨回滾**：原本失敗時只彈出 alert，但使用者訊息已寫入 `state.activeSession.history` 且氣泡已渲染，形成**無配對的孤立 user 回合**，會污染下一回合送出的對話歷史，並使離線模式的 `step = history.length / 2` 計算錯位。現改為移除該筆記錄與其氣泡（僅在最後節點確實為 `.bubble-user` 時才移除）、**把原文放回輸入框**供直接重試，面板顯示中性訊息且不含任何臨床內容，並保留 alert 呈現真實錯誤。
*   **離線示範的面板標示**：無金鑰時督導面板顯示常駐「示範劇本」標記，防止 M5 的常駐可見把示範內容提升為持續可見的偽督導分析。逐句標示與「無劇本個案不得試玩」仍屬 Milestone 6。
*   **快取破除**：`index.html` 的 `app.js?v=` 與 `app.js` 的 `geminiService.js?v=` 一併更新至 `v20260828_v21_m5`（後者自 `v20260724_v13_1` 起未曾更新）。

### ✅ 驗證 (Verification)
*   `python3 check_syntax.py` 全數通過。
*   **stub `fetch` 隔離測試 5 條全過**：`callCount === 1`；`responseMimeType` 與 `required` / `propertyOrdering` 正確注入；對話歷史 2 筆正常帶入；Markdown 包裹的 JSON 可解析；缺 `coachHint` 與空白 `reply` 皆拋出真實錯誤；無金鑰時零網路請求。
*   **真實瀏覽器實測全過**：開場面板可見且為中性空狀態、無寫死臨床斷言；首回合督導提示**無需點擊即可閱讀**；切換按鈕收合／展開與標籤同步；失敗回合呈現真實錯誤（`API key not valid`）、原文回填輸入框、孤立使用者氣泡已移除、面板中性且不含臨床內容；無金鑰時顯示「示範劇本」標記，有金鑰時隱藏。
*   ⚠️ **未執行**：真實 Gemini 金鑰端對端實跑。需擁有者在設定頁配置金鑰後跑一輪面談，確認雙角色分離效果與 `propertyOrdering` 不被該模型拒絕（若回傳 400，移除該欄位即可，順序要求已同時寫入 `systemInstruction`）。

### 📐 文檔同步
*   [ARCHITECTURE.md](ARCHITECTURE.md)：§3.2 改寫為現行的單次結構化往返；§7 漂移表 **D1、D2、D3、D4、D1′ 標記為 RESOLVED**，D14 標記為部分處理。**D5（離線通用假對白）、D6／D6′（草稿無持久層與「已安全備份」不實聲明）、D13（每日用量上限）仍未解決**，分屬 M6／M7／M8。
*   [adr/0002-unified-structured-gemini-schema.md](adr/0002-unified-structured-gemini-schema.md)：狀態更新為已實作，並記錄本次是在現行 `main` 上重新實作而非 cherry-pick `e06789d`（該提交與其後落地的保險箱與文檔工作衝突）。決策原文一字未改。
*   [Product_Roadmap.md](Product_Roadmap.md)：M5 標記為「已建置，待真實金鑰驗證」，並連結 plan/05。
*   [plan/05-synchronous-dual-track-response.md](plan/05-synchronous-dual-track-response.md)：新增，含完整驗證結果表。

### 📦 變更檔案 (Files Changed)
*   [geminiService.js](geminiService.js)：`callGeminiAPI()` 新增 `responseSchema` 參數；`generateClientReply()` 重寫為單次雙角色結構化呼叫並加入嚴格驗證；刪除 `generateCoachHint()`；區塊註解重新編號。
*   [app.js](app.js)：督導面板預設可見與中性空狀態；新增 `setCoachPanelVisible()`；失敗回合回滾；離線示範標記；移除 `clientShortName`；更新 `geminiService.js` 快取戳記。
*   [index.html](index.html)：更新 `app.js` 快取戳記。

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
