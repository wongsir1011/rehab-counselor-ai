# Milestone 5 Plan: 同一口氣的雙軌回應

* **Status**: Built (`24e8a85`); **one regression found in peer review — not yet delivered** ⚠️
* **Approved**: 2026-08-27 23:36 HKT (UTC+8)
* **Roadmap Ref**: [Product Roadmap Milestone 5](../Product_Roadmap.md)
* **Traces to PRD v3**: `SUCCESS`; `HARD CONSTRAINTS → AI Gateway & Validation`; `HARD CONSTRAINTS → No Fabricated Clinical Content`
* **Related decision**: [ADR-0002](../adr/0002-unified-structured-gemini-schema.md)

> 本檔是本里程碑的建置 SSOT。日後修這一塊的 bug，先重新讀本檔。

---

## 1. 里程碑承諾

同工說完一句話後，案主的廣東話回應與督導提示**一起出現且已可閱讀**；拿不到真正的 AI 分析時，系統直接說明失敗原因。

## 2. 現況（2026-08-27 讀碼所得，基準 `origin/main` = `1d531a5`）

- `geminiService.js:220-223`：每回合兩次循序純文字請求 —— `callGeminiAPI()` 取 `reply`，再 `generateCoachHint()` 取 `coachHint`。全檔無 `responseSchema`。
- `geminiService.js` `generateCoachHint()` 的 `catch` 回傳寫死的臨床建議字串。
- `app.js:3411`：`rp-coach-feedback` 初始樣式含 `display:none`。
- `app.js:3816`：每回合結束時再次設為 `none`。
- `app.js:3412`：開場提示為寫死文字，對所有個案一律宣稱「擺出強烈的抗拒姿態」。

## 3. 建置內容

### 3.1 `callGeminiAPI()` 新增結構化輸出能力
新增第 7 個參數 `responseSchema`。提供時於 `generationConfig` 同時注入 `responseMimeType: "application/json"` 與 `responseSchema`。既有 `responseJson` 參數與四個現有呼叫點（`geminiService.js` L316、387、440、474）**完全不動**。

### 3.2 `generateClientReply()` 改為單次雙角色結構化呼叫
Schema：

```
{ type: "OBJECT",
  properties: { reply: {type:"STRING"}, coachHint: {type:"STRING"} },
  required: ["reply", "coachHint"],
  propertyOrdering: ["reply", "coachHint"] }
```

`systemInstruction` 以分隔區塊定義雙重角色：
- **角色 A（案主）→ `reply`**：僅限廣東話對白，不得混入旁白、分析或標記（此欄位直接送入 TTS 朗讀）。現有扮演準則（廣東話理解、語言風格、阻抗、逐步敞開、80–150 字）逐條保留於此區塊。
- **角色 B（臨床督導）→ `coachHint`**：不得使用案主口吻。

`propertyOrdering` 令模型先生成 `reply` 再據以生成 `coachHint`，保留督導須分析案主回應的邏輯依賴；**同一順序要求另以文字寫入 `systemInstruction`**，不單靠該欄位。

回應以 `parseFlexibleJson()` 解析（模型即使指定 JSON MIME 仍偶會包 Markdown）。解析後嚴格驗證 `reply` 與 `coachHint` 皆存在、為字串、trim 後非空；任一不符即拋錯並附原始回應內容。

### 3.3 刪除 `generateCoachHint()`
整支函式連同其罐頭降級字串移除。

### 3.4 督導提示預設可見
`app.js:3411` 移除 `display:none`；`app.js:3816` 由 `"none"` 改為 `"block"`，切換按鈕初始狀態設為「隱藏督導建議回應」＋ eye-slash 圖示；面板模板的初始按鈕文字同步改為隱藏態。切換按鈕保留 —— PRD 允許 dismissible，只禁止預設隱藏。

### 3.5 開場提示改為中性空狀態
`app.js:3412` 的寫死臨床斷言，替換為不含任何臨床判斷的空狀態文字。

**理由**：M5 令面板預設可見，若保留原文，同工開啟面談後看到的第一段且持續可見的內容，就是一段未經任何 AI 分析、對所有個案一律宣稱「強烈抗拒」的偽臨床判斷。PRD `No Fabricated Clinical Content` 明文點名 "not as an opening hint"。

### 3.6 失敗回合的乾淨回滾
現行 `catch` 只 `alert()`，但使用者訊息已寫入 `state.activeSession.history` 且氣泡已渲染，形成**無配對的孤立 user 回合**，會污染下一回合送出的對話歷史，並使離線模式的 `step = history.length / 2` 計算錯位。

改為：移除該筆未配對的 user 記錄與其 DOM 氣泡，**把原文放回輸入框**供同工直接重試；督導面板顯示中性的「本回合未取得督導分析」（非臨床內容）；保留 `alert` 呈現真實錯誤訊息；切換按鈕一併設為可見態，避免面板內容與按鈕標籤不一致。

### 3.7 離線示範的劇本標示
無金鑰時，督導面板顯示常駐「示範劇本」標記。**M5 只做這一項**；逐句標示與「無劇本個案不得試玩」屬 M6。

**理由**：離線模式的 `coachHint` 是預設劇本或寫死字串。M5 令面板預設可見，若不標示，等於把示範內容提升為持續可見的偽督導分析。

### 3.8 快取戳記（強制）
`index.html` 的 `app.js?v=` 與 `app.js` 的 `geminiService.js?v=` 一併更新為 `v20260828_v21_m5`。無打包工具，不更新則同工看不到任何改動。

## 4. 風險審查結論

- **符合 PRD**：逐條對照見批准紀錄；未觸及的條款（Usage Guardrail、草稿保護、SSOT 收斂）屬 M7／M8，不提前建置。
- **無重複狀態**：不新增 `state` 欄位、localStorage 鍵或 IndexedDB store。`coachHint` 維持只存在於 DOM 面板。3.6 是移除錯誤資料，方向為收斂。
- **不破壞既有功能**：四個其他 Gemini 函式、Phase 13 干預指令（`promptModifiers`）、TTS 雙引擎與性別綁定、連續 STT、保險箱與匯出，全部不受影響。
- **不動資料表**：`DB_VERSION` 維持 1，三個 object store 與 session 記錄結構不變。**不需 migration，不刪表重建。**

### 邊界情況
| 情況 | 處理 |
| :--- | :--- |
| 模型仍以 Markdown 包裹 JSON | `parseFlexibleJson()` 已處理，stub 測試覆蓋 |
| 模型回傳空 `coachHint` 或空 `reply` | trim 後非空檢查攔截，拋真實錯誤 |
| `propertyOrdering` 不被該模型接受 | 回傳 400，首次真實金鑰測試即暴露；移除該欄位即可，順序要求已同時寫入 `systemInstruction`，行為不變 |
| 等待回應期間按「放棄返回」 | 現行行為不變，本計劃不改動 |

## 5. 驗證步驟

1. `python3 check_syntax.py` 全綠。
2. **stub `fetch` 隔離測試**：`callCount === 1`；`responseSchema` 正確注入 `generationConfig`；對話歷史正常帶入；Markdown 包裹 JSON 可解析；缺 `coachHint` 拋錯；空 `reply` 拋錯；無金鑰不觸發任何網路請求。
3. **真實瀏覽器**：首回合督導提示無需點擊即可閱讀；切換按鈕仍可收合並復原；失敗回合輸入框回填原文且孤立氣泡已移除；離線模式顯示「示範劇本」標記。
4. **真實 Gemini 金鑰端對端**：實跑一輪面談，確認雙角色分離（`reply` 無旁白、`coachHint` 無案主口吻）、回應與提示同時到達、無 400 錯誤。需由擁有者在設定頁輸入金鑰後執行。

## 7. 驗證結果（2026-08-27）

| 步驟 | 結果 |
| :--- | :--- |
| 1. `check_syntax.py` | ✅ 全數通過 |
| 2. stub `fetch` 隔離測試 | ✅ 5 條全過：`callCount === 1`；`responseMimeType: application/json` 與 `required` / `propertyOrdering` 正確注入；歷史 2 筆帶入；Markdown 包裹可解析；缺 `coachHint` 與空白 `reply` 皆拋真實錯誤；無金鑰零網路請求 |
| 3. 真實瀏覽器 | ✅ 開場面板可見且為中性空狀態、無寫死臨床斷言；首回合督導提示無需點擊即可閱讀；切換按鈕收合／展開與標籤同步；失敗回合呈現真實錯誤（`API key not valid`）、原文回填輸入框、孤立使用者氣泡已移除、面板顯示中性訊息且不含任何臨床內容；無金鑰時顯示「示範劇本」標記，有金鑰時隱藏 |
| 4. 真實金鑰端對端 | ⏳ **未執行** —— 需擁有者提供金鑰 |

## 6. 批准時記錄的非顯然決定

開場寫死督導提示（3.5）與失敗回合孤立記錄回滾（3.6）納入本里程碑，因兩者都位於 M5 必須改動的同一條回合管線上，而 M5 令督導面板預設可見會直接放大這兩個既有缺陷；離線示範的面板層標示（3.7）僅為防止 M5 令現況變差，逐句標示與無劇本個案封鎖仍留給 M6。

---

## 8. 同儕審查結果（2026-08-28 02:26 HKT）

審查以實際執行為準，未修改任何程式碼。

### 重跑上一輪確認可用的流程
`check_syntax.py`、stub `fetch` 主路徑（`callCount === 1`）、瀏覽器首回合提示無需點擊即可讀、切換與標籤同步、失敗回合回填與孤立氣泡移除 —— **在目前版本全部仍然可用**。

### 新增的回歸測試
以 stub 逐一呼叫 `generateCustomCase` / `generateSessionReport` / `generateCustomQuiz` / `generateSoapSuggestions`，四者的 `generationConfig.responseSchema` 皆為 `undefined`，證明 `callGeminiAPI` 加入第 7 個參數未波及既有呼叫點。

### 🔴 必須修正：D15 — 督導干預指令在失敗回合後靜默遺失

本里程碑 §3.6 的失敗回滾引入。`app.js:3762` 在 API 呼叫**之前**清空 `promptModifiers`；回滾又把承載該指令文字的孤立 history 項目 pop 掉，指令因而徹底消失。同工按下「⚠️ 突發抗拒」→ 該回合失敗 → 重試 → 干預不再生效，**畫面上無任何提示**。

A/B 實測（相同攔截手法，`063acdc` 另起 8766 埠對照）：

| 版本 | 第 2 次請求是否仍含 `臨床督導即時注入指令` |
| :--- | :--- |
| `063acdc`（M5 之前） | ✅ 仍在（靠孤立 history 殘留） |
| `24e8a85`（M5） | ❌ 已遺失 |

違反專案原則「發生錯誤時呈現真實錯誤，不得假裝成功」。修正方向為失敗時把 modifiers 放回佇列 —— 屬下一輪 CRITIQUE 範疇，審查階段不修。

### 已記錄，不阻塞
- **D16**：督導面板以 `innerHTML` 渲染模型輸出，實測 `<img onerror>` 會執行。**既存問題，M5 未加劇**（舊版同樣賦值 `innerHTML`，且 `display:none` 不阻止 `onerror`）。
- **D17**：Phase 13 督導干預功能不在 PRD v3 內，屬 2026-08-27 審計漏列。
- **D5 補充**：內建個案劇本僅 1–3 回合，四個個案第 2 回合起即落入通用假對白。

### 本輪未重新測試
MiniMax TTS 雙引擎與性別音色綁定、連續 STT（需麥克風）、保險箱遷移／備份／還原、面談結束→雷達報告→匯出、ICF 沙盒、理論學習 Hub、MI 五關卡、小組研習、學習分析、成就徽章，以及**真實 Gemini 金鑰端對端**（`propertyOrdering` 是否被模型接受仍未知）。

### 設計上的已知極限
角色 A 對 `reply` 的「禁止旁白／括號註解」是 **prompt 層約束，無程式層強制**。schema 只保證欄位存在與型別，管不到內容；模型若不遵守，含旁白的文字會直接送入 TTS 朗讀。
