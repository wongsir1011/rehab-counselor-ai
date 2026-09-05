# Milestone 10 Plan: 不用滑鼠也能走完全程

* **Status**: 待批准
* **Proposed**: 2026-09-03 13:16 (HKT, UTC+8)
* **Roadmap Ref**: [Product Roadmap](../Product_Roadmap.md) —— 本里程碑同時是「PRD v4 已批准、待排序」清單的第一次排序動作
* **Traces to PRD v4**: `USER`（「including practitioners who are themselves disabled and work by keyboard or screen reader」）；`SUCCESS`（「completes the ICF classification using only the keyboard」）；`HARD CONSTRAINTS → Everyone Can Operate It`
* **Closes drift**: `ARCHITECTURE.md` §7 **D24**（全部四項）

> 本檔是本里程碑的建置 SSOT。日後修這一塊的 bug，先重新讀本檔。

---

## 1. 里程碑承諾

**一位用鍵盤或讀屏軟件工作的職業復康同工，能夠獨自走完平台的每一項練習** —— 包括 PRD SUCCESS 條款點名的那一項：完成 ICF 分類。

PRD 三處把這件事寫成產品意圖，不是加分項：

> **USER**: Hong Kong vocational rehabilitation practitioners … **including practitioners who are themselves disabled and work by keyboard or screen reader**.

> **SUCCESS**: … The counselor writes SOAP notes, attempts to leave the page mid-interview and is stopped by a warning, **completes the ICF classification using only the keyboard**, finalizes the report…

> **HARD CONSTRAINTS → Everyone Can Operate It**: Every exercise, including ICF classification, is completable **by keyboard alone** and legible to a screen reader; nothing depends on dragging. Motion respects the operating system's reduced-motion preference. **A platform that teaches the ICF cannot exclude the practitioners it describes.**

### 1.1 為何是這一項先排（排序判斷）

M1–M9 全部完成，剩下七項 PRD v4 能力未排序。選這一項的理由，逐條可查：

1. **它是 SUCCESS 條款目前唯二走不通的一項。** 路線圖 Milestone 8 寫著「**PRD SUCCESS 條款至此可完整走通**」—— 這句話不成立。SUCCESS 還要求「completes the ICF classification **using only the keyboard**」與「shows the supervisor guidance alongside each turn」（D27），兩者今日都做不到。本計劃修第一項，並在文檔更新時更正 M8 那句過度宣稱。
2. **另一項 SUCCESS 缺口（D27）影響的是督導看到多少；這一項影響的是一整類 PRD 明文列出的使用者能不能用。** 前者是資訊不足，後者是完全排除。
3. **它必須先做，否則要做兩次。** 之後三項（風險情境個案、逐題練習紀錄、教材資料化）都會新增畫面與練習。在本里程碑之後建置，它們天生沿用已建立的模式；在之前建置，等於為每一項新畫面再做一次可及性補丁與重新稽核。

其餘六項維持未排序，由擁有者在下一次重排決定。

## 2. 現況（2026-09-03 13:16 HKT 實測，基準 `65c4a99`）

以下數字全部來自實跑瀏覽器與 `grep`，非估算。

### 2.1 鍵盤：整個側欄導覽不可達

`index.html` 的六個導覽項是 `<a class="nav-item" data-target="…">`，**沒有 `href`**。沒有 `href` 的 `<a>` 不進 tab 序列。

實測（每個畫面可 Tab 到的元素數 / 有 click 處理器但不可聚焦的元素數）：

| 畫面 | 可聚焦 | 綁了 click 但不可聚焦 |
| :--- | ---: | ---: |
| 儀表板 | **6** | 7 |
| 理論學習 Hub | **5** | 18 |
| 個案實戰 Arena | 33 | 13 |
| 小組研討 | 10 | 6 |
| 學習分析 | **6** | 16 |
| 系統設定 | 16 | 6 |

儀表板的 6 個可聚焦元素是：三個語系鈕、音效鈕、主題鈕、一個「立即進入實戰艙」。**同工用鍵盤打開平台，去不到理論學習、小組研討、學習分析與系統設定。**

### 2.2 ICF 分類：SUCCESS 條款點名的那一項，鍵盤完全做不到

平台有**兩個** ICF 分類練習，兩個都不可用：

| 位置 | 因子 | 分類盒 | 其中可聚焦 |
| :--- | ---: | ---: | ---: |
| 理論學習 → ICF → 自我測驗（沙盒，`renderICFTab`） | 10 | 6 | **0** |
| 個案實戰 → ICF 個案全人分析（`startICFAssessment`） | 10 | 6 | **0** |

沙盒可 Tab 到的只有個案選單與重設鈕；個案分析板可 Tab 到的只有「提交 AI 診斷評估」與「取消返回」。用鍵盤按下提交，唯一結果是 `alert("請先將案主特徵因子分類放入右側的 ICF 框格中。")` —— 因為他放不進去。

個案分析板的「流動端備援」是 `prompt("請輸入你要分類到的區域（1:健康, 2:身體功能, …）")`（`app.js:5604`）—— 它由 `click` 觸發，鍵盤同樣到不了，而且它本身就是一個沒有標籤、沒有取消語意的原生對話框。

### 2.3 其餘不可聚焦的互動控件（實測清單）

| 元件 | 數量 | 標籤 | 所在練習 |
| :--- | ---: | :--- | :--- |
| `.nav-item` | 6 | `<a>` 無 href | 全域導覽 |
| `#mystery-box-trigger-area` | 1 | `div` | 儀表板神秘個案盒 |
| `.notes-tab`（理論模組頁籤） | 3 | `div` | 理論學習 |
| `.theory-sub-tab` | 3 | `div` | 理論學習 |
| `.hexa-node` | 6 | SVG `<g>` | ACT 六角模型探索 |
| `.card-3d-wrapper` | 6 / 8 / 6 | `div` + 行內 `onclick` | ACT／MI／ICF 閃卡 |
| `.oars-option-card` | 5 | `div` | MI OARS 闖關（**練習**） |
| `.icf-source-factor` | 10 + 10 | `div` | ICF 沙盒與個案分析板 |
| `.icf-drop-zone` | 6 + 6 | `div` | 同上 |
| `.factor-tag .remove-btn` | 每張已放入的標籤 1 | `span` | ICF 個案分析板 |
| `.dossier-filter-badge` | 7 | `div` | 個案庫篩選 |
| `.gene-slot-card` | 6 | `div` | 個案合成艙的傷殘類型（PRD 旅程第 2 步的 disability chip） |
| `#note-tab-soap` / `#note-tab-icf` | 2 | `div` | **面談室筆記頁籤** |
| `#rp-drawer-tab-soap` / `#rp-drawer-tab-interact` | 2 | `div` | 面談室抽屜（督導干預面板在此） |
| `.history-card` | 每筆紀錄 1 | `div` | 學習分析歷史 |
| `.radar-dot` / `.radar-label` | 5 + 5 | SVG `<circle>` / `<text>` | 學習分析雷達 |
| `#tab-popup-report` 等 | 3 | `div` | 面談歷程彈窗 |

其中兩項直接打斷 PRD 使用者旅程：面談室的 **ICF 筆記頁籤**不可達（旅程第 4 步「Draft SOAP notes **and ICF biopsychosocial classifications** during the interview」—— 鍵盤同工只寫得到 SOAP），以及**督導干預面板**藏在不可達的抽屜頁籤後（旅程第 3 步 Phase 13 功能）。

### 2.4 讀屏：整個應用幾乎沒有可讀語意

倉庫全域計數：`aria-label` **0**、`role=` **1**（`role="presentation"`）、`tabindex` **0**、`alt=` **0**。唯一的 `aria-describedby` 是 M9 的每日額度欄位。

具體後果：

- **257 個 FontAwesome 圖示**（`app.js` 248、`index.html` 9）沒有一個標 `aria-hidden`。它們以私有區碼點渲染，讀屏會念出雜訊。
- **圖示按鈕沒有可讀名稱**：主題切換、音效切換、麥克風、語音重播、彈窗關閉、沙盒重設等，讀屏只會念「按鈕」。全檔只有 7 個 `title=`。
- **非同步到達的內容不會被播報**：對話回饋 `#rp-chat-history`、督導提示 `#rp-coach-feedback`、ICF 督導助教狀態列、徽章 toast、保險箱降級橫幅 —— 全部沒有 live region。案主的廣東話回應與督導提示同時到達（M5 的成果），但讀屏同工不會知道它們到了。
- **雷達圖與趨勢圖沒有文字等價物**：五個維度的數字只存在於 SVG 座標裡。

### 2.5 焦點看不見，而且關掉的彈窗會吃掉焦點

`index.css` 有 9 條 `:focus` 規則，全部是輸入框邊框，**沒有一條 `:focus-visible`**，也沒有全域焦點環。即使把元素變成可聚焦，同工也看不見焦點在哪。

`.popup-overlay` 收起的方式是 `opacity: 0; pointer-events: none`（`index.css:2335`），沒有 `visibility` 也沒有 `display`。實測：在收起的 overlay 內建一個按鈕並 `focus()`，`document.activeElement === button` 為 **true**，`getClientRects().length` 為 **1**。也就是說，同工只要開過一次面談歷程彈窗再關掉，之後在學習分析頁按 Tab，就會掉進一個看不見的對話框裡。彈窗另外沒有 `role="dialog"`、沒有 Escape、沒有焦點陷阱、關閉後不歸還焦點。

### 2.6 動態偏好：完全未讀取

`prefers-reduced-motion` 在 CSS 與 JS 中出現 **0** 次，`matchMedia` 出現 **0** 次。對照：`index.css` 有 **26** 個 `@keyframes`、58 條 `transition`；`app.js` 另有 4 處行內 `animation`、33 處行內 `transition`。其中兩項由 JS 計時器驅動，CSS 媒體查詢管不到：`triggerConfetti()` 每次答對噴 30 顆粒子（`app.js:1648`），`runDecryptionAnimation()` 逐字亂碼打字（`app.js:3401`）。背景兩顆 `.bg-glowing-blob` 與六角模型的 `spin-portal`／`rotate-dna` 是**持續**播放的。

### 2.7 已經正確、本次不動

- `index.html` 有 `lang="zh-Hant-HK"`、`<nav>`／`<main>`／`<aside>` 地標、`<h1>`／`<h2 id="view-title">` 標題結構。
- 面談室主要控件（文字輸入、送出、麥克風、結束會話、匯出）已是原生 `<button>`／`<input>`，共 16 個可聚焦元素；進入房間時焦點自動落在輸入框。
- 小組研討與 AI 自訂測驗的選項已是 `<button>`，鍵盤可用。
- ACT 解離話術練習是 `<textarea>` + `<button>`，鍵盤可用。

---

## 3. 建置內容

### 3.1 一個啟用原語，一個焦點環（全域基礎）

新增 `makeActivatable(el, opts)` 與**單一委派 `keydown` 處理器**掛在 `document` 上：任何帶 `data-activate` 的元素，Enter 與 Space 轉成 `el.click()`（Space 同時 `preventDefault()` 以免捲頁）。

**為何是單一委派而非逐處綁定**：與 ADR-0008 §4（導覽守衛）和 ADR-0011（用量計數）同一個理由 —— 逐處綁定，被忘記的那一處就是出事的那一處。全部渲染都是 `innerHTML` 模板，模板裡多寫 `tabindex="0" role="…" data-activate` 三個屬性是字串層面的改動，改動點看得見、數得出；行為則只有一份。

`index.css` 新增一條全域 `:focus-visible` 規則（2px outline + offset，用既有 `var(--accent-cyan)` token，深淺兩主題都量測），並確認全檔沒有 `outline: none`。

**不改標籤、不改 class、不動既有 CSS。** 所有不可聚焦元件維持原本的 `div`／`span`／SVG 節點，只加屬性。這是回歸風險最低的路徑：4361 行 CSS 一行不必動。

### 3.2 導覽改為真正的連結

`index.html` 六個 `.nav-item` 加上 `href="#dashboard"` 等。已核對 `index.css:217` 的 `.nav-item` 是 class 選擇器，且已寫死 `color` 與 `text-decoration: none` —— 加 `href` **視覺零變化**，但元素立即進入 tab 序列並原生支援 Enter。既有處理器第一行就是 `e.preventDefault()`，hash 不會被寫入。當前項加 `aria-current="page"`（在 `initNavigation()` 既有的高亮同一段更新，不新增第二個真相來源）。

`index.html` 開頭加一條跳至主內容的連結（平時視覺隱藏，聚焦時顯示）。

### 3.3 ICF 分類：選取 → 放入，三種輸入方式同一條路

這是本里程碑的主體。**兩個 ICF 實作各自保留**（合併它們是重新設計，不在範圍內），但**互動模型統一**：

**因子池**：容器 `role="listbox" aria-label="待分類特徵因子"`；每個因子 `role="option" tabindex`（roving，只有目前項為 `0`，其餘 `-1`）、`aria-selected`。上下方向鍵在池內移動焦點，Home／End 跳首尾，Enter／Space 選取。

**分類盒**：**盒的標題**（`<h4>`）成為鍵盤放入控件 —— `tabindex` roving、`role="button"`、`aria-label="放入「健康狀況」，目前 2 項：中風後遺、右側肢體乏力"`。左右方向鍵在六個標題間移動，Enter／Space 放入。

*為何是標題而不是整個盒*：個案分析板放入後的標籤自帶一個「移回特徵池」的移除鈕。若整個盒是 `role="button"`，就會出現按鈕中嵌按鈕（無效語意，讀屏無法操作移除）。以標題為控件，盒身維持可閱讀內容，兩個問題一次解決。

**焦點流**：選取因子後焦點自動移到第一個分類盒標題；放入後焦點回到池中下一個未分類因子；Escape 取消選取並把焦點留在原處。實際按鍵數是「Enter → 方向鍵 → Enter」，不是 Tab 十次。

**不新增快捷鍵**（例如按 1–6 直接分類）—— PRD 要求的是「completable by keyboard alone」，方向鍵組合鍵盤模式已是標準且足夠；發明快捷鍵屬於 PRD 以外的範圍。

**滑鼠與觸控完全不變**：拖放事件原封不動保留（PRD 說的是「nothing **depends on** dragging」，不是禁止拖放）；沙盒既有的「點因子亮起 → 點盒」觸控路徑就是同一個模型，`state.icfSandboxSelectedTouchId` 沿用，不新增狀態欄位。

**刪除 `app.js:5604` 的 `prompt()` 備援**，改為與沙盒相同的選取狀態（存在 `initICFDragAndDrop()` 的閉包變數，非 `state`，理由見 §4.2）。兩個練習的說明文字同步補上鍵盤操作一行。

`aria-label` 的重算集中在一個 `updateZoneAccessibleName(zoneEl)`，由兩個實作各自唯一的變更點呼叫（沙盒：重繪模板；分析板：`moveFactorToZone()` 與移除鈕）。

### 3.4 其餘控件逐類補上語意（§2.3 全表）

- 選項卡（`.oars-option-card`、`.gene-slot-card`、`.dossier-filter-badge`）：`role="radio"`／`role="option"` + `aria-checked`／`aria-selected`，同組內方向鍵移動。
- 閃卡 `.card-3d-wrapper`：行內 `onclick` 改為 `data-activate` + `role="button"` + `aria-expanded`（翻到背面為 `true`），並讓正反兩面的文字都可被讀出。
- 五組頁籤（理論模組、理論子頁、面談室筆記、面談室抽屜、歷程彈窗）共用一個 `initTabGroup(tabs, panels, onSelect)`：`role="tablist"`／`role="tab"`／`aria-selected`／`aria-controls`，方向鍵切換。一份實作，五個呼叫點。
- `.hexa-node`（SVG `<g>`）、`.radar-dot`／`.radar-label`（SVG）：加 `tabindex="0" role="button" aria-label`。
- `.history-card`、`#mystery-box-trigger-area`、`.remove-btn`：`role="button"` + `aria-label`。

### 3.5 讀屏可讀

- **圖示靜音**：在 `#content-view-mount` 與 `document.body` 上掛**一個** `MutationObserver`，對任何新出現、缺少 `aria-hidden` 的 `i[class*="fa-"]` 補上 `aria-hidden="true"`。257 處手改必然漏，觀察器是唯一忘不掉的位置。
- **圖示按鈕的名稱**：既有 7 個 `title=` 保留，並補 `aria-label`（`title` 對讀屏不可靠）。
- **Live regions**：`#rp-chat-history` 與 `#rp-coach-feedback` 加 `aria-live="polite"`；ICF 督導助教狀態列、徽章 toast、保險箱降級橫幅、開機載入／降級狀態加 `role="status"`。錯誤卡（M8 的渲染失敗卡、寫入失敗卡）加 `role="alert"`。
- **圖表文字等價物**：雷達 SVG 加 `role="img"` + 由 `computeCounselorRecord()` 同一組數字產生的 `aria-label`；`radar` 為 `null` 時 label 為「尚無已評估的面談紀錄」（沿用 M7 的既有語句，不新增第二套說法）。縱向趨勢圖同樣處理。
- **表單**：`aria-label` 或關聯 `<label>` 補齊沒有可見標籤的輸入框。

### 3.6 尊重系統的減少動態偏好

- `index.css` 末尾新增一個 `@media (prefers-reduced-motion: reduce)` 區塊：全域 `animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important;`，並顯式停掉持續播放的裝飾（`.bg-glowing-blob`、`spin-portal`／`spin-portal-reverse`、`rotate-dna`、`core-pulsate`、麥克風脈動）。
- `app.js` 新增 `prefersReducedMotion()`（`matchMedia` 即時查詢，**不快取、不落地成設定**，理由見 §4.2），並在兩個 JS 計時器驅動的動畫入口分岔：`triggerConfetti()` 直接 return（不建立 30 個節點）、`runDecryptionAnimation()` 直接寫入最終字串並 resolve。
- ICF 答錯時的 `shake-warning` 在減少動態下等同無效果 —— 已核對答錯同時會寫入督導助教狀態列的文字說明，訊息不會只靠動畫傳達。

### 3.7 彈窗成為真正的對話框

`.popup-overlay` 加 `visibility: hidden`，`.show` 加 `visibility: visible`，transition 補上 `visibility`。這一行 CSS 直接消除 §2.5 量測到的隱形焦點陷阱。另加 `role="dialog" aria-modal="true" aria-labelledby="…"`、開啟時把焦點移入、Escape 關閉、Tab 在對話框內循環、關閉後焦點歸還觸發它的歷史卡。

### 3.8 快取戳記

`index.html` → `app.js?v=20260903_v29_m10a11y`、`index.css?v=20260903_v29_m10a11y`。`mockData.js`／`geminiService.js`／`db.js` 本輪不改，戳記不動。

---

## 4. 風險審查結論

### 4.1 是否符合 PRD？（逐條對照）

| PRD 條款 | 本計劃 | 判定 |
| :--- | :--- | :--- |
| `USER` —— 使用者包含以鍵盤或讀屏工作的實務工作者 | §3.1–§3.5 讓每一項練習可鍵盤完成、可讀屏 | ✅ 直接實現 |
| `SUCCESS` —— 「completes the ICF classification using only the keyboard」 | §3.3，兩個 ICF 練習都做 | ✅ 直接實現 |
| `Everyone Can Operate It` —— 鍵盤／讀屏／不依賴拖曳／尊重減少動態 | §3.1–§3.6 四項全做，拖放保留但不再是唯一路徑 | ✅ 直接實現 |
| `USER JOURNEY` 第 3 步（督導干預） | §3.4 抽屜頁籤可達後，`.btn-intervention` 原生按鈕即可用 | ✅ 修復現有斷點 |
| `USER JOURNEY` 第 4 步（面談中同時寫 SOAP 與 ICF） | §3.4 面談室筆記頁籤可達 | ✅ 修復現有斷點 |
| `No Claim Without Evidence` | 雷達 `aria-label` 由 `computeCounselorRecord()` 同一組數字產生；`null` 時說「尚無已評估的面談紀錄」，不補 0 | ✅ 不違反，沿用 M7 的單一推導點 |
| `SSOT` —— 一個事實一個歸屬 | 不新增任何持久化資料；減少動態偏好即時查詢作業系統，不落地成第二份設定 | ✅ 見 §4.2 |
| `Data Ownership & Durability` | 不觸碰保險箱、不改 `db.js`、不改 `EXPORTABLE_SETTINGS` | ✅ 無影響 |
| `Security & Secrets` | 新增的 `aria-label` 全部經 `escHtml()`（屬性位置，ADR-0010 已定調引號必須 escape） | ✅ 見 §4.5 邊界 4 |
| `No Fabricated Clinical Content` | 不新增任何臨床文字；`aria-label` 只複述畫面已有的內容 | ✅ 無影響 |
| `Honest Simulation` / `Risk Is Practised` / `Teaching Material Is Data` | 本里程碑不觸及 | — 仍為 D28／D25／D29，維持未排序 |
| `OUT OF SCOPE` —— 不做本地化臨床內容 | 新增的可讀名稱**只寫 zh-HK**，不新增 EN／简中分支 | ✅ 見 §8 決定 3 |

### 4.2 是否引入重複狀態、平行資料，或第二個歸屬？

**沒有。** 三處值得說明：

1. **減少動態偏好不儲存。** PRD 寫的是「Motion respects **the operating system's** reduced-motion preference」。做成應用內設定會立刻產生第二個歸屬（作業系統一份、`localStorage` 一份），而且兩者相衝時無人知道誰對。`prefersReducedMotion()` 每次即時查 `matchMedia`。
2. **ICF 個案分析板的放入資料維持 DOM 權威。** 今日 `evaluateICFMapping()` 完全從 DOM 讀取（`.factor-tag[data-correct][data-placed]`）。鍵盤支援只加一個**選取中**的閉包變數（暫態 UI 焦點，不是資料），不新增 `state.*` 欄位 —— 加了就等於替放入資料建立第二個歸屬。沙盒那邊沿用既有的 `state.icfSandboxSelectedTouchId`，同樣不新增。
3. **`aria-current` 與側欄高亮同一段更新。** 在 `initNavigation()` 既有的 `classList` 那三行內一併處理，不另設狀態。

### 4.3 是否會破壞現有功能或可用流程？

逐項評估，附已決定的處理：

| 風險 | 為何會發生 | 已決定的處理 |
| :--- | :--- | :--- |
| 導覽加 `href` 造成 hash 跳轉或視覺變化 | `<a href>` 有 UA 預設樣式；未 preventDefault 會寫 hash | 已核對 `.nav-item` 已設 `color` 與 `text-decoration: none`（`index.css:217`），且處理器第一行即 `preventDefault()`。驗證步驟 V2 明列「按下六個導覽項後 `location.hash` 仍為空」 |
| Space 鍵在可捲動區域被吃掉 | 委派處理器把 Space 轉成 click | 只對帶 `data-activate` 的元素處理，且該元素是原生輸入框時直接放行；驗證步驟 V6 實測 textarea 內打空白 |
| 減少動態的 `!important` 全域規則壓掉功能性樣式 | `transition-duration` 被全域覆寫 | 只覆寫 `animation-*` 與 `transition-duration`，不碰 `transform`／`opacity` 的終值；筆記頁籤的 `translateX` highlighter 仍會到位，只是瞬間到位。驗證步驟 V7 逐一走過 |
| 彈窗加 `visibility: hidden` 導致開啟時不出現 | transition 未含 `visibility` 會延遲顯示 | `transition: opacity .35s ease, visibility .35s;`，關閉時 visibility 在動畫末才切換。驗證步驟 V8 |
| MutationObserver 在每次全頁重繪造成延遲 | `app.js` 大量 `innerHTML` 全量重寫 | 只監聽 childList + subtree，處理器只做屬性設定不觸發重繪；驗證步驟 V9 量測理論頁切換前後的重繪耗時 |
| roving tabindex 在重繪後失效 | 沙盒每次放入都整段重繪 | roving 的初始值寫在模板裡（第一項 `0`，其餘 `-1`），重繪即重建；焦點還原由放入後的 `focus()` 明確指定，不依賴瀏覽器 |
| M8 的離開守衛被鍵盤路徑繞過 | 新增的啟用路徑若不經 `switchView()` | 委派處理器只做 `el.click()`，走的是既有處理器，守衛不變。驗證步驟 V4 用鍵盤在未完成面談中離開 |
| M9 的 escape 防線被新屬性繞過 | `aria-label` 帶入個案文字是屬性位置 | 一律 `escHtml()`（已 escape 引號）。驗證步驟 V10 以惡意個案實測 |

### 4.4 是否修改已存有資料的資料表？

**沒有。** 本里程碑不改 `src/utils/db.js`、不動 `DB_VERSION`（維持 1）、不改三個 object store（`sessions`／`custom_cases`／`app_meta`）的任何欄位、不新增或移除任何 `localStorage` 鍵、不改 `EXPORTABLE_SETTINGS`。**無 migration 需求，亦無資料遺失風險。** 驗證步驟 V11 會在建置前後各匯出一次保險箱備份並逐位元組比對。

### 4.5 邊界情況與已決定的處理

1. **同工在系統層打開減少動態，但正在看粒子動畫。** `matchMedia` 的變更事件不處理 —— 下一次觸發時即生效，不做動畫中途中斷（中斷會留下半完成的 DOM 節點）。
2. **讀屏在 `aria-live="polite"` 區域被連續更新洗版。** 對話回饋每回合只新增一則氣泡，督導提示每回合覆寫一次；不使用 `assertive`，讓讀屏自行排隊。
3. **ICF 因子池空了（全部已分類）之後按方向鍵。** 池為空時焦點移到「完成」面板的第一個按鈕；沙盒本來就會切成勝利面板，模板中該按鈕即為第一個可聚焦元素。
4. **個案名稱含引號被寫進 `aria-label`。** 一律 `escHtml()`。ADR-0010 記過「只做一半的 escape 等於沒做」—— 屬性位置必須 escape 引號，這正是 `escHtml()` 相對 `escapeHtmlText()` 存在的理由。
5. **鍵盤選取一個因子後直接切換畫面。** 選取狀態是暫態，切換即丟棄；沙盒的 `state.icfSandboxSelectedTouchId` 在重繪時已被既有邏輯消費，不新增清理路徑。
6. **`prompt()` 移除後，仍在用觸控且習慣舊路徑的同工。** 舊路徑今日的行為是彈出一個要輸入數字的原生框，實測不可用亦無取消語意；新路徑（點因子 → 點盒標題）與沙盒一致，且說明文字同步更新。
7. **同工把焦點停在一個因子上，然後用滑鼠拖另一個因子。** `dragstart` 清除鍵盤選取（沙盒既有行為，`app.js:2899` 已有此清除），分析板補上同一行。
8. **彈窗開啟時按 Tab 到最後一個元素。** 焦點循環回第一個；Shift+Tab 反向同理。焦點陷阱只在 `.show` 時生效。

---

## 5. 驗證步驟

**除 V1 外全部以鍵盤操作，滑鼠不參與。**

| # | 內容 |
| :--- | :--- |
| V1 | `python3 check_syntax.py` 通過 |
| V2 | 從網址列按 Tab 進入頁面，只用鍵盤到達全部六個畫面；按下後 `location.hash` 仍為空；`aria-current` 跟著移動 |
| V3 | **SUCCESS 條款正題**：只用鍵盤在**個案分析板**把阿強 10 個因子全部分類並提交，記錄實際按鍵數；在**理論沙盒**同樣完成 10 個因子直到勝利面板 |
| V4 | 只用鍵盤：進面談室 → 打字送出 → 切到 ICF 筆記頁籤並輸入 → 打開抽屜的「督導對弈」頁籤並送出一次干預 → 嘗試離開，確認 M8 守衛照常攔截 |
| V5 | 只用鍵盤：MI OARS 闖關答完一題、翻開一張閃卡、切換 ACT 六角模型節點、切換個案庫篩選、切換合成艙傷殘晶片、開關面談歷程彈窗（含 Escape 與焦點歸還） |
| V6 | 焦點環在深色與淺色主題下皆可見（逐一量測對比）；在 textarea 內打空白不觸發啟用；捲動區域內按 Space 不被吃掉 |
| V7 | 系統開啟「減少動態」後重載：確認粒子不生成（DOM 節點數不變）、解密打字直接顯示最終字串、背景光暈與六角旋轉靜止、筆記頁籤 highlighter 仍到位、ICF 答錯時狀態列文字仍出現 |
| V8 | 開啟再關閉面談歷程彈窗，之後在學習分析頁按 Tab 走完一圈，確認**不會**落入隱形對話框（即 §2.5 量測到的缺陷已消失） |
| V9 | 以 macOS VoiceOver 走一次儀表板 → 理論 ICF 沙盒 → 面談室：確認圖示不被念出、按鈕有名稱、對話回應到達時被播報、雷達圖念出五維數字或「尚無已評估的面談紀錄」 |
| V10 | 把 M9 的惡意個案重新植入 IndexedDB，走過帶 `aria-label` 的新插入點，確認 `window.__XSS` 全程為 0 |
| V11 | 建置前後各匯出一次保險箱備份，逐位元組比對；確認 `DB_VERSION` 仍為 1、三個 store 欄位不變 |
| V12 | M5／M6／M7／M8／M9 的核心流程各跑一次（雙軌同步、離線劇本標示、零紀錄時的「尚無紀錄」、開機一定結束、寫入失敗的重試卡與額度面板） |

**已知無法在本機驗證、會誠實記錄**：真實 Gemini 金鑰的端對端；VoiceOver 以外的讀屏（NVDA／JAWS 在 Windows）；實體輔助科技裝置。

---

## 6. 本節**不**處理（明確界線）

- **D25 風險情境個案、D26 逐題練習紀錄、D27 督導提示寫入匯出、D28 案主反應不確定性、D29 教材資料化、D22 移除 EN／简中** —— 六項維持未排序，等擁有者下一次重排。
- **設計系統重整**（`ARCHITECTURE.md` §8：字級收斂、行內樣式抽取、淺色主題補齊）—— 不改變產品承諾，按既有慣例只順帶處理當期觸及的畫面。本輪只加一條全域焦點環與一個減少動態區塊，不做收斂。
- **面談室在淺色主題下大面積不可讀** —— 屬 §8 既有問題，與可及性相關但不是本里程碑承諾的四項之一；不在本輪擴大範圍。
- **兩個 ICF 實作的合併** —— 那是重新設計，不是可及性。本輪只統一互動模型。
- **建置期間發現、但不屬本里程碑的問題**（例如小組研討與 AI 測驗寫死的「小組投票 68%」百分比，讀起來像真實投票結果）—— 只記錄到 `ARCHITECTURE.md` §7 供排序，不在本輪修。

---

## 7. 建置前已知的非顯然決定

1. **不把 `div` 改成 `<button>`，只加屬性。** 改標籤會引入 UA 預設樣式，牽動 4361 行 CSS；加屬性的視覺回歸風險為零。
2. **鍵盤放入 ICF 的控件是分類盒的「標題」，不是整個盒。** 整個盒設 `role="button"` 會讓已放入標籤的移除鈕變成按鈕中的按鈕，讀屏無法操作。
3. **新增的可讀名稱只寫繁體中文（香港），不寫 EN／简中分支。** PRD v4 已把本地化臨床內容列為 OUT OF SCOPE，另有一項待排序工作要收斂既有的 170 處語系分支；新增分支等於替那項工作加債。
4. **減少動態偏好即時查詢作業系統，不做成應用內設定、不寫入任何儲存。** PRD 的字面要求就是尊重作業系統的偏好；做成設定會產生第二個歸屬。
5. **257 個圖示以一個 MutationObserver 統一標 `aria-hidden`，而非逐處手改。** 手改 257 處必然有遺漏，而遺漏一處讀屏就念一次雜訊；觀察器是唯一忘不掉的位置。
6. **拖放全部保留。** PRD 說的是「nothing **depends on** dragging」。移除拖放會讓既有滑鼠同工的體驗變差，而 PRD 並未要求。
7. **不新增數字快捷鍵（按 1–6 直接分類）。** 方向鍵組合鍵盤模式已達成「completable by keyboard alone」；快捷鍵屬 PRD 以外的範圍。
8. **本計劃順帶更正路線圖 Milestone 8「PRD SUCCESS 條款至此可完整走通」一句** —— 該句不成立，SUCCESS 尚有本里程碑與 D27 兩個缺口。更正寫進文檔更新那一步，不改 ADR（ADR 是不可變歷史）。
