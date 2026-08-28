# Milestone 6 Plan: 誠實的離線示範

* **Status**: Built & verified ✅（含 §9 補完；真實金鑰端對端仍待擁有者執行）
* **Approved**: 2026-08-28 10:43 HKT (UTC+8)
* **Roadmap Ref**: [Product Roadmap Milestone 6](../Product_Roadmap.md)
* **Traces to PRD v3**: `HARD CONSTRAINTS → No Fabricated Clinical Content`
* **Also fixes**: `ARCHITECTURE.md` §7 **D15**（Milestone 5 遺留回歸），理由見 §3.5

> 本檔是本里程碑的建置 SSOT。日後修這一塊的 bug，先重新讀本檔。

---

## 1. 里程碑承諾

示範模式**看得出是示範**；個案沒有預設劇本時直說「需要金鑰才能對話」，而不是給一段假對話。

PRD v3 原文：

> Scripted demo dialogue is permitted **only** in the explicit no-API-key demo mode, **only for cases that ship with an authored script**, and **only when each scripted turn is visibly marked as scripted**. A case with no authored script **cannot be roleplayed without a key, and the application says so**.

## 2. 現況（2026-08-28 讀碼所得，基準 `1d89896`）

- `geminiService.js:173-190` 離線分支：有 `roleplay_flow[step]` 就取劇本，否則 `resolve` 一段**寫死的通用假對白＋寫死督導提示**，全無標示。
- 實測：七個內建個案劇本僅 **1–3 回合**；`case_02`、`case_mental_cheng`、`case_asd_kahou`、`case_sensory_meiling` **第 2 回合起**即落入假對白。
- `generateCustomCase` 產生 `initial_dialogue` 但**不產生 `roleplay_flow`** → 每個 AI 合成個案離線第 1 回合就落入假對白。
- `app.js:3532` 開場氣泡渲染 `selectedCase.initial_dialogue`（內建與合成個案皆有）。
- `renderChatBubble(sender, text)` 無任何標示機制。
- `startRoleplaySession` 有四個入口（L1011、L1025、L2705、L3267），無前置檢查。
- `refreshChatHistoryFeed()`（L3686）**零呼叫者**，死碼。

## 3. 建置內容

### 3.1 刪除通用假對白，改為真實錯誤
移除離線分支的 `else` 整段，改拋兩種語意明確的錯誤：
- 個案**從無劇本** → 「此個案沒有預設示範劇本，需要 Gemini API 金鑰才能對話。」
- 個案**劇本已用盡** → 「示範劇本已播放完畢（共 N 回合）。繼續對話需要 Gemini API 金鑰。」

### 3.2 進入面談前攔截無劇本個案
新增純函式 `getOfflineScriptLength(caseObj)`（無劇本回傳 0）。於 `startRoleplaySession` 開頭集中判斷 —— 四個入口全部自動受保護。

無金鑰且劇本長度為 0 時不建立 session，改在面談視圖掛載說明面板：說明個案未附示範劇本、離線無法對話、需要金鑰，附「前往設定頁」與「返回個案大廳」。**不使用 `alert`** —— 這是常態狀況而非錯誤。

### 3.3 每個示範回合可見標示
`renderChatBubble(sender, text, opts = {})` 新增第三參數；`opts.scripted === true` 時於 `bubble-meta` 加「示範劇本」徽章，並於氣泡加 `bubble-scripted` class（左側虛線邊框＋琥珀色調）。

標示範圍**僅離線模式**：開場 `initial_dialogue` 氣泡、每一則來自 `roleplay_flow` 的案主回應。

線上模式不標示開場白 —— 它是個案檔案本身的內容（PRD 使用者流程第 2 步），非偽裝成 AI 即時生成的回應。

### 3.4 示範狀態寫入會話記錄
`state.activeSession.history` 的訊息物件加入 `scripted: true`（僅離線劇本回合）。連帶讓 `showSessionDetailPopup` 與 `exportSessionReport` 對該回合加註標記。

理由：一場全程示範的面談匯出給督導後，目前與真實練習**完全無法分辨**。

單一歸屬、非重複狀態。舊記錄無此欄位＝未標示，不追溯改寫歷史。

### 3.5 一併修正 D15（M5 遺留回歸）
M6 令離線分支**開始會拋錯**，該錯誤直接落入 `submitMessageToAI` 的 catch —— D15 所在路徑。目前 D15 只在 API 錯誤時觸發；M6 後離線模式也會觸發，**可達性顯著提高**。

修法：清空前保留 `promptModifiers` 副本，失敗回滾時放回佇列，令重試仍帶原干預指令。

### 3.6 刪除死碼 `refreshChatHistoryFeed()`
零呼叫者。留著是地雷 —— 它渲染**不帶示範標示**的氣泡，日後被接線會靜默抹掉本里程碑的標示。

### 3.7 快取戳記
`index.html` 的 `app.js?v=` 與 `app.js` 的 `geminiService.js?v=` 更新為 `v20260828_v22_m6`。

## 4. 風險審查結論

**符合 PRD**：六條逐項對照（demo-mode-only、authored-script-only、每回合標示、無劇本不得對話並說明、移除 generic client line、真實錯誤）皆有對應建置項。未觸及條款屬 M7／M8。

**無重複狀態**：`getOfflineScriptLength()` 為純函式；`opts.scripted` 為渲染參數；`history[].scripted` 單一歸屬於該訊息，詳情彈窗與匯出皆從它讀取。

**不破壞既有功能**：所有新分支以 `!apiKey` 為條件；有金鑰的線上面談完全不受影響；有劇本個案仍可離線試玩（多一個標示，用盡後改為明確告知）；保險箱與匯出向下相容；Phase 13 干預因 D15 修正而**改善**。

**不動資料表**：`DB_VERSION` 維持 1，三個 object store 不變，**不需 migration、不刪表重建**。`history[].scripted` 為記錄內部選填新欄位，IndexedDB 無 schema 約束，既有記錄不被改寫。

### 邊界情況
| 情況 | 處理 |
| :--- | :--- |
| 無金鑰、有劇本、劇本用盡 | 明確告知已播放完畢並附回合數；D15 修正確保干預不丟失 |
| 面談中途才輸入金鑰 | 先前氣泡已標示且 `history[].scripted` 已寫入，維持真實；其後走真實 AI 不標示 |
| 有金鑰但呼叫失敗 | 走既有 catch，與 M5 一致，加上 D15 修正 |
| `roleplay_flow` 存在但為空陣列 | `getOfflineScriptLength` 回 0，等同無劇本，於 3.2 攔截 |
| 匯出的舊記錄無 `scripted` | 不加註，不追溯改寫歷史 |

## 5. 驗證步驟

1. `python3 check_syntax.py` 全綠。
2. **stub 隔離測試**：無金鑰＋無劇本 → 拋「沒有預設示範劇本」；無金鑰＋劇本用盡 → 拋「已播放完畢（共 N 回合）」；無金鑰＋劇本未盡 → 正常回傳且零網路請求；**M5 的五條測試全部重跑**確認有金鑰路徑未受影響。
3. **真實瀏覽器**：離線進入 Ah Keung，開場白與每則劇本回應皆帶標示；劇本用盡出現明確訊息而非假對白；離線點擊 AI 合成個案 → 說明面板且未建立 session；設定金鑰後同一個案可正常進入且無標示；**D15 回歸測試** —— 離線注入干預後觸發失敗，確認重試仍帶該指令。
4. **匯出檢查**：離線示範面談的 Markdown 含示範標記；線上面談不含。

## 6. 批准時記錄的非顯然決定

D15 修正納入本里程碑，因 M6 令離線分支開始拋錯、該失敗路徑可達性大幅提高，不能在明知有靜默資料遺失的路徑上疊加新流量；示範狀態寫入會話記錄並延伸至詳情彈窗與 Markdown 匯出，因一場全程示範的面談交到督導手上時目前與真實練習無法分辨；刻意**不**在個案大廳為無劇本個案加鎖定徽章，把說明集中在嘗試進入的那一刻，以免擴張 PRD 未要求的介面範圍；線上模式開場白不標示，因它是個案檔案內容而非偽裝成即時生成的回應。

---

## 7. 驗證結果（2026-08-28）

| 步驟 | 結果 |
| :--- | :--- |
| `check_syntax.py` | ✅ 全數通過 |
| stub：無金鑰＋無劇本 | ✅ 拋「沒有預設示範劇本」，零網路請求 |
| stub：無金鑰＋劇本未盡 | ✅ 正常回傳且 `scripted: true`，零網路請求 |
| stub：無金鑰＋劇本用盡 | ✅ 拋「已播放完畢（共 2 回合）」 |
| stub：`roleplay_flow` 為空陣列 | ✅ 視同無劇本 |
| stub：**M5 五條回歸全部重跑** | ✅ 單次呼叫、schema 注入、歷史帶入、Markdown 解析、缺欄位／空白欄位拋錯、其他四函式 `responseSchema === undefined` |
| 瀏覽器：離線進入阿強 | ✅ 開場白與三回合劇本回應皆帶「示範劇本」徽章與琥珀左緣（實測 `border-left: 3px solid rgb(245,158,11)`） |
| 瀏覽器：劇本用盡 | ✅ 明確告知回合數，未產生任何假對白氣泡；舊的「案主低下頭」通用對白確認未出現 |
| 瀏覽器：離線點無劇本個案 | ✅ 顯示說明面板，**未建立面談室**，兩顆導引按鈕俱在 |
| 瀏覽器：設定金鑰後同一個案 | ✅ 可正常進入；線上開場白**不**標示；離線徽章消失 |
| 瀏覽器：**D15 回歸測試** | ✅ 注入干預 → 該回合失敗 → 重試請求**仍含**「臨床督導即時注入指令」 |
| 匯出 Markdown | ✅ 含總體警語與逐行「［示範劇本］」標記 |
| 歷史詳情彈窗 | ✅ 3 則示範氣泡皆帶徽章 |
| 全新分頁載入 | ✅ 主控台零輸出 |

### 建置期間的額外修正
劇本邊界原本沿用 `alert("對話生成失敗：…")` 的措辭，把正常的示範結束說成系統故障，與本里程碑的誠實目標相違。改為在錯誤物件加上 `code`（`OFFLINE_NO_SCRIPT` / `OFFLINE_SCRIPT_EXHAUSTED`），呼叫端據此區分「常態邊界」與「真正失敗」，兩者的 alert 與督導面板措辭分開處理。

### 未執行
真實 Gemini 金鑰端對端（線上路徑以 stub 驗證）；MiniMax TTS、連續 STT、保險箱備份還原、ICF 沙盒、理論 Hub、MI 五關卡、小組研習、成就徽章。

---

## 9. 補完計劃：移除偽造的臨床評估（批准 2026-08-29 00:52 HKT）

同儕審查發現 M6 只標示了示範**對話**，漏掉臨床**評估**。本節是 M6 的補完，不是新里程碑。

### 9.1 要修的是什麼

PRD v3：「No canned text may ever occupy a position where the counselor would reasonably read it as AI-generated clinical analysis」。

實測證據（直接呼叫模組，兩個不同個案、兩段不同對話）：

```
兩次分數相同 = true  {"empathy":80,"changeTalk":75,"actFlexibility":85,"icfAccuracy":70,"actionPlanning":90}
兩次總結相同 = true
用於「美玲」個案時，總結仍稱「阿強」 = true
```

總結寫著「你精準捕捉到了阿強對家人的責任感」—— 對一場與美玲的面談，這件事從未發生。它進入雷達圖、寫入保險箱、匯出給督導，且無任何標示。

### 9.2 現況
- `geminiService.js` `generateSessionReport` 的 `!apiKey` 分支回傳寫死 `scores` 與 `summary`。另外三個 Gemini 函式在同位置**都正確拋錯**，只有這一支例外。
- `report.scores` 共 **14 個消費點**：儀表板平均（L722）、成就門檻（L4464）、報告頁解構（L4483）、趨勢圖（L5235）、分析頁彙總（L5458-5462）、歷史卡片（L5513/5524/5525）、詳情彈窗（L5848/5945）、Markdown 匯出（L6755-6759）。全部假設 `report.scores` 必然存在。
- `app.js:5472` 在零筆歷史時塞入 `{empathy:75, changeTalk:60, defusion:80, icf:45, action:65}` 並據此算出等第 —— 從未做過面談的同工會看到「**優良 (B+)**」。

### 9.3 建置內容
1. **離線評估改為拋出真實狀況**：移除罐頭回傳，改拋 `code: "OFFLINE_NO_EVALUATION"`。
2. **離線仍可正常結束面談，但不產生評估**：逐字紀錄與 SOAP／ICF 日誌是同工的真實工作產物，照常建立 `completedSession`（`report: null`）並寫入保險箱；完成畫面保留逐字回顧與日誌，明說評估需要金鑰，不畫雷達、不給等第。有金鑰但呼叫失敗則維持現行大聲報錯、不寫入半套記錄。
3. **十四個消費點統一守衛**：新增單一述詞 `hasEvaluation(session)`。彙總類將未評估面談**排除於分母之外**（不得以 0 計入，那會靜默拉低真實統計）；歷史卡片改顯示「未評估（離線示範）」；詳情彈窗以說明取代雷達與總結；Markdown 匯出略去評分段落改列說明行；成就 `empathy >= 90` 在無評估時略過。
4. **一併移除分析頁的偽造雷達預設值**：無已評估面談時只畫格線、數值留白、不顯示等第，並明示「尚無已評估的面談紀錄」。只修離線報告而留下它就是被明令禁止的狹隘修復。縱向趨勢圖的模擬資料**不動** —— 它已有 `simulatedBadge` 與虛線樣式，本來就誠實。
5. **快取戳記**更新為 `v20260828_v23_m6b`。

### 9.4 風險審查結論
- **符合 PRD**：六條逐項對照（罐頭不得占據臨床分析位置、大聲報錯、面談仍入庫、有金鑰時雷達不變、降級誠實、SSOT 衍生值單處計算）皆有對應建置項。
- **無重複狀態**：`hasEvaluation()` 為純述詞不儲存；`report: null` 是既有欄位的合法值，非新欄位。
- **不破壞既有功能**：所有新分支只在 `report` 缺失時生效；有金鑰的完整流程完全不變；既有已評估紀錄 `hasEvaluation()` 回 `true`，行為同今日。
- **不動資料表**：`DB_VERSION` 維持 1，`report` 欄位早已存在，本次只允許其為 `null`。**既有記錄不被改寫，不需 migration，不刪表重建。**

### 9.5 邊界情況
| 情況 | 處理 |
| :--- | :--- |
| 保險箱混有已評估與未評估面談 | 彙總只計已評估者，分母同步縮減 |
| 全部面談皆未評估 | 雷達走空狀態，不顯示等第，不出現 `NaN` |
| 備份含 `report: null` | 正常序列化，還原後判定一致 |
| 離線做完後才配置金鑰 | 舊紀錄維持未評估，**不追溯補評估**（那等於為 AI 從未參與的對話生成評估） |
| 有金鑰但 API 失敗 | 維持大聲報錯，不寫入半套記錄 |
| 成就 | `empathy_master` 不觸發；`first_session` 仍觸發，因為那場面談確實完成了 |

### 9.6 批准時記錄的非顯然決定
離線結束面談仍寫入保險箱、只是沒有評估 —— 逐字與日誌是真實工作產物，因缺 AI 評分就整場丟棄，損失比缺評分本身更大；未評估面談從平均值的**分母**排除而非以 0 計入，因為以 0 計入會靜默拉低真實統計；分析頁零評估時的偽造雷達預設值（含「優良 (B+)」）一併移除；離線做完後才配置金鑰的舊紀錄不追溯補評估。

### 9.7 驗證結果（2026-08-29 00:52 HKT）

| 項目 | 結果 |
| :--- | :--- |
| `check_syntax.py` | ✅ 全數通過 |
| stub：離線評估拋 `OFFLINE_NO_EVALUATION` | ✅ 且**零網路請求** |
| stub：有金鑰評估正常，且 prompt 確實帶入對話 | ✅ |
| stub：**M6 四條 ＋ M5 五條回歸全部重跑** | ✅ 全過 |
| 瀏覽器：離線結束面談 | ✅ 出現「本次沒有臨床評估」畫面，無雷達、無等第、不再點名阿強 |
| 瀏覽器：逐字與日誌保留 | ✅ 逐字 2 筆（含示範標記）、SOAP 日誌原文保留 |
| 保險箱記錄 | ✅ `report === null`，逐字與日誌完整 |
| Markdown 匯出 | ✅ 無評分數字、有說明行、仍含逐字與示範標記 |
| 分析頁零評估時 | ✅ 顯示「尚無已評估的面談紀錄」，**偽造的「優良 (B+)」已消失** |
| 歷史卡片 | ✅ 未評估者顯示「離線示範 · 未評估」，不顯示分數 |
| 詳情彈窗 | ✅ 以說明取代總結，示範氣泡仍帶標記 |
| **混合分母測試** | ✅ 1 筆已評估（五項各 60）＋ 1 筆未評估 → 等第「合格 (C)」、儀表板 60。分母為 1 而非 2（若誤計為 2 會得 30 → 需提升 D） |
| 全新分頁載入 | ✅ 主控台零輸出 |

**未執行**：真實 Gemini 金鑰端對端；MiniMax TTS、連續 STT、保險箱備份還原、ICF 沙盒、理論 Hub、MI 五關卡、小組研習、成就徽章。
