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

### Milestone 2: The Synchronous AI Clinical Supervisor [Completed ✅]
**User-Facing Value**:  
During live roleplay, every counselor turn delivers a lightning-fast (<1.5s), simultaneous double-track response: the client's realistic Cantonese reaction on the main stage, and an instant clinical supervisor micro-hint in the sidebar. The hint pinpoints client motivational signals (Change Talk, Sustain Talk, experiential avoidance) and suggests precise next-step OARS or ACT interventions.  
*Traces to PRD: USER JOURNEY Step 3, SUCCESS, HARD CONSTRAINTS (AI Gateway & Validation)*  
*Plan*: 未撰寫（`plan/02` 從未建立）

**提示內容與臨床品質**：早已在 `app.js` 運作。  
**同步性**：由 **Milestone 5**（`24e8a85`）補齊 —— 改為單次結構化往返，回應與提示同時到達且預設可見。M5 尚有一項與同步性無關的回歸待修（見下方 Milestone 5），但本里程碑承諾的雙軌同步已達成。

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

### Milestone 5: 同一口氣的雙軌回應 [Completed ✅]
**帶來的價值**：  
同工說完一句話之後，案主的廣東話回應與督導提示**一起出現**，而不是先等案主講完、再等督導分析。等待時間減半，對話節奏終於接近真實面談 —— 這正是 Milestone 2 承諾卻尚未兌現的那一半。同時，督導提示不再可能是預先寫好的罐頭文字：拿不到真正的 AI 分析時，系統會直接說明失敗原因。

**為何排在這裡**：它完成 Milestone 2，而且是 PRD SUCCESS 條款唯一還沒達成的部分。前四個里程碑建立的體驗都要靠它才算完整。  
*Traces to PRD: SUCCESS, HARD CONSTRAINTS (AI Gateway & Validation)*  
*Plan*: [`plan/05-synchronous-dual-track-response.md`](plan/05-synchronous-dual-track-response.md) — 已批准 2026-08-27 23:36 HKT，建置於 `24e8a85`  

**D15 已修正**：同儕審查發現的回歸（督導干預指令在失敗回合後靜默遺失）已於 Milestone 6 一併修正並實測通過 —— 失敗回滾現在會把干預指令放回佇列。真實金鑰端對端驗證仍待擁有者執行。  
*相關決策*：[ADR-0002](adr/0002-unified-structured-gemini-schema.md)

---

### Milestone 6: 誠實的離線示範 [Completed ✅]
**帶來的價值**：  
還沒設定金鑰的同工，第一次打開平台就處於離線示範模式。目前示範對話與真實 AI 回應在畫面上長得一模一樣，而同工自己合成的個案在離線模式下每一輪都回同一句預設台詞。此里程碑讓示範模式**看得出是示範**，並在個案沒有預設劇本時直說「此個案需要金鑰才能對話」，而不是給一段假對話。

**為何排在這裡**：離線模式是新同工的第一印象。Milestone 5 讓真實回應變快之後，示範與真實的差別更需要能被一眼分辨。  
*Traces to PRD: HARD CONSTRAINTS (No Fabricated Clinical Content)*  
*Plan*: [`plan/06-honest-offline-demo.md`](plan/06-honest-offline-demo.md) — 已批准 2026-08-28 10:43 HKT

**範圍調整（2026-08-29）**：原標記待修的「未評估顯示為 0 分」已移至 **Milestone 7**。追查後確認它並非離線示範的問題，而是全產品範圍的同一模式（詳見 Milestone 7）。

---

### Milestone 7: 每個數字都來自你的紀錄 [Completed ✅]
**帶來的價值**：  
同工在這個平台上看到的每一個關於自己的分數、等第、徽章與雷達圖，都真的來自他自己做過的面談。

目前不是這樣。儀表板一打開，就有一個標題寫著「個人能力值縮影」、說明寫著「整合自學表現與 SOAP 評核」的雷達圖，告訴他「聽力共情：極佳 (A)」—— 而他一場面談都還沒做過。離線示範的面談沒有 AI 評估，卻在三個地方被畫成 0 分。MI 闖關無論拿 10 分還是 100 分，結束時都說「你已基本掌握」。「知識探險家」徽章寫著「完美通過」，實際上走到最後一題就給。

此里程碑讓平台只說它有證據的話：**沒有紀錄就顯示「尚無紀錄」，沒有評估就顯示「未評估」，沒有達標就不發徽章。** 同時把五維分數的呈現從字母等第改為「AI 即時回饋（練習參考）」—— 那是一個語言模型的即時印象，不是評核工具，同工把報告交給督導時，雙方都應該清楚這一點。

**為何排在這裡**：這是整個產品最有價值的資產。它是少數會明說「我拿不到 AI 分析」的臨床工具，卻在別處大量做無根據的宣稱，兩者互相抵銷。而且它不依賴任何前置工作，可以立即開始。  
*Traces to PRD: HARD CONSTRAINTS (No Claim Without Evidence; No Fabricated Clinical Content; SSOT —— 「radar aggregates, progress milestones … computed in one place from the vault」)*  
*Plan*: [`plan/07-every-number-from-your-record.md`](plan/07-every-number-from-your-record.md) — 已批准 2026-08-29

**已交付**：所有關於同工的數字改由單一推導點 `computeCounselorRecord()` 產生，零已評估紀錄時回 `null` 而非 0 —— 這是結構性防呆，`null` 進入座標公式會壞掉而不會靜默畫出「五項皆 0 分」的雷達。四個字母等第（A／B+／C／D）已移除，改為「AI 即時回饋（練習參考）」；出現分數或督導建議的五個位置（面談室提示面板、評估報告頁、歷史詳情彈窗、分析頁雷達、Markdown 匯出）都聲明臨床判斷屬於真人督導。徽章條件改為與描述一致並執行一次性對帳。完成場次的兩份 `localStorage` 副本（D7）已刪除。

**建置期間的額外發現**：D20 是**四**處而非三處 —— 縱向趨勢圖以總場次（而非已評估場次）決定是否標示「模擬引導線」，兩場離線示範就會畫出一張無徽章、無資料點卻聲稱屬於同工的趨勢圖。另有四項同型宣稱（縮影雷達說明宣稱整合 SOAP 評核、分析頁寫死「自學非常充足」、小組研討宣稱「深化了心得」、「初試啼聲」徽章描述與條件不符）一併修正。詳見 `ARCHITECTURE.md` §7。

**未達成的部分（誠實記錄）**：徽章仍存放於 `localStorage`，未完全由保險箱推導（D21 餘下部分）。「全人評估官」與「生命合成家」沒有任何持久紀錄可查證，判定回 `null` 並沿用既有值；MI 闖關分數只存在於記憶體，跨重新整理無從查證。要真正做到「進度徽章由保險箱推導」需要逐題練習紀錄（D26），屬另一個里程碑。

---

### Milestone 8: 不會憑空消失的面談 [Completed ✅]
**帶來的價值**：  
面談進行到一半時誤關分頁或重新整理，目前逐字對話與 SOAP／ICF 草稿會全部消失且無法救回。此里程碑讓系統在同工要離開未完成的面談時出聲攔截，並移除筆記區那個「已安全備份」的綠點 —— 在草稿其實只存在於記憶體時，那句話是不實的。

同時解決一個更根本的問題：**程式有時會永遠停在「加載中... 請稍候...」而完全打不開。** 同工只要開了兩個分頁就可能觸發，畫面沒有錯誤訊息、沒有逾時、沒有出路。這一步讓本機儲存無法使用或反應過慢時，平台明白說出狀況並讓同工繼續使用，而不是無聲卡死。

**為何排在這裡**：前面的里程碑讓面談本身更值得投入；投入愈多，中途失去的損失愈大。而「打不開」是所有價值的前提。  
*Traces to PRD: USER JOURNEY Step 4（drafts safe from accidental loss）; SUCCESS（「stopped by a warning」）; HARD CONSTRAINTS (Data Ownership & Durability —— 「the interface must never claim a draft is saved or backed up when it is not」; Degradation Honesty)*  
*Plan*: [`plan/08-interview-never-vanishes.md`](plan/08-interview-never-vanishes.md) — 已批准 2026-08-30

**已交付**：關分頁與重新整理由 `beforeunload` 攔截；應用內離開由 `switchView()` 單一位置守衛（側欄高亮改為等回報成功才移動）；筆記區的綠色「已安全備份」連同整套假的同步動畫刪除，改為恆真的「草稿只存在於此分頁 · 面談結束後才寫入保險箱」。`db.js` 每一個等待都有界，補上 `onblocked`、`onabort`、`onversionchange`、`onclose`。開機一定結束：立即顯示載入狀態，2.5 秒說明回應較慢，8 秒落入具名降級並附「重試連線」。**PRD SUCCESS 條款至此可完整走通。**

**建置期間的重要修正**：評估報告生成失敗時，舊版是**程式自己把整場面談丟掉**（alert 後 `switchView("arena")`）。根因是「正在評估」畫面直接覆寫面談房間的 DOM，失敗後無路可退。改為非破壞性覆蓋層 —— 實測失敗後逐字對話、SOAP、督導提示逐字不變，再按一次「結束會話」即可正常完成。

**路線圖原文的更正**：「開兩個分頁就可能觸發」實測**今日重現不到** —— `DB_VERSION` 始終為 1，不需升級就不會 blocked。該缺陷是已上膛但未擊發：任何一次 schema 變更都會讓所有雙分頁同工永久卡死。另兩條路徑（交易中止、分頁被節流時 IndexedDB 不回應）今日即可觸發，且驗證期間真的發生了一次 —— 舊版在該狀態下空白卡死且主控台無任何輸出，新版正常開啟並說明狀況。

**未驗證**：`clearAll()` 的 `onabort` 分支（程式碼已加，因工具環境 IndexedDB 被節流無法實跑）；「重試連線」的**成功**分支（失敗分支已驗證不會無限等待）；真實 Gemini 金鑰端對端。

**未處理**：面談室在淺色主題下大面積不可讀 —— 屬 `ARCHITECTURE.md` §8 記錄的既有問題（面談室大量寫死深色背景）。M8 新增的元件本身兩種主題皆可讀（已量測）。

**同儕審查結果（2026-08-31 13:28 HKT）**：本里程碑承諾的三件事（攔截離開、草稿說真話、開機一定結束）在正常模式下實測全部成立，M5／M6／M7 無回歸。但審查在**正常 IndexedDB 模式**下（M8 自身驗證全程處於降級模式，從未測過正常模式）發現三項必須修正的問題，因此狀態暫不標記為完成：

| ID | 問題 | 性質 |
| :--- | :--- | :--- |
| **D32** | `if (err && err.code) throw err` 誤判 —— 所有 `DOMException` 都有 truthy 的 `.code`，導致寫入保險箱失敗時**整場面談連同已產生的 AI 評分一起丟失**。M8 之前會顯示完整報告讓同工匯出 | **本輪引入的回歸** |
| **D33** | 首次渲染拋例外時仍是空白畫面、無說明、無出路（`initApp().catch()` 未接任何 UI）。以還原一份 `theoryProgress` 為 `{}` 的備份自然觸發 | 既有缺陷，但擊穿本里程碑承諾 |
| **D34** | `VersionError` 時降級措辭給出錯誤診斷（「可能是無痕瀏覽視窗」），且**未說明紀錄沒有遺失** | M8 未完成的部分 |

另有五項不阻塞事項（D35–D39）記於 `ARCHITECTURE.md` §7。

**補完完成（2026-08-31 15:23 HKT）**：三項全部修正並實測通過，D36／D37／D38 一併處理（它們落在同一段程式碼裡）。
*計劃*：[`plan/08-interview-never-vanishes.md`](plan/08-interview-never-vanishes.md) §11–§17 — 已批准 2026-08-31

- **D32**：述詞改為白名單 `isVaultSignal()`。修正範圍不止於述詞 —— 寫入結果現在會傳到畫面：`persistCompletedSession()` 回傳成敗、`vaultedAt` 只在成功時設（守衛因此繼續保護未寫入的面談）、兩個完成畫面不再寫死「已存入保險箱」，並提供**「重試寫入保險箱」**（不重跑 AI 評估，省金鑰額度）。
- **D33**：`normalizeTheoryProgress()` 補齊形狀（**補齊不重置**，既有進度完整保留），並堵住備份寫入 `{}` 的污染源；另加兩層防護 —— 開機失敗畫面與單頁渲染錯誤卡，後者消除了「標題說 A、內容是上一頁 B」。
- **D34**：分類合併為單一 `classifyVaultError()`，新增 `version` 類別，`unavailable` 收窄至真正不可用的情形。

**建置期間抓到兩個問題**：模組層 `const` 造成 TDZ 錯誤令整個 app 打不開（`check_syntax.py` 抓不到，是實跑主控台抓到的）；第一版警示卡承諾了一條使用者走不到的重試路徑，改為直接提供重試按鈕。

> **範圍調整（2026-08-29）**：開機可靠性原屬 Milestone 9（保險箱範疇），移至此處。理由：「程式打不開」的嚴重度高於一切，且與本里程碑同屬「不要失去使用者的東西」。經擁有者批准。

---

### Milestone 9: 可信賴的本地紀錄 [Completed ✅]
**帶來的價值**：  
儀表板顯示的完成場次，與保險箱裡實際存著的面談永遠一致，還原備份之後也不會出現互相矛盾的數字。設定頁的診斷日誌不再永久留下金鑰特徵與帳號識別 —— 把螢幕轉給督導看時，設定頁不會殘留這些痕跡。同時，設定頁會顯示同工今日還剩多少次 AI 呼叫額度，讓自費金鑰的用量心裡有數，不會在面談中途才發現額度用完。

另外堵上一個目前存在的破口：督導提示面板會執行 AI 回應中夾帶的網頁標記。同工若匯入了別人給的個案「基因碼」，那段內容有可能操縱模型輸出，進而在他的瀏覽器中執行 —— 而他的 API 金鑰就存在同一個瀏覽器裡。

**為何排在這裡**：這是整套紀錄體系的收尾。Milestone 4 解決了「留得住」，這一步解決「留下來的內容彼此對得上、不多留不該留的東西、而且不會被別人塞東西進來」。  
*Traces to PRD: HARD CONSTRAINTS (SSOT, Security & Secrets, Usage Guardrail)*  
*註*：每日用量上限為 PRD v3（2026-08-27）新增條款，經擁有者決定併入本里程碑，不另開里程碑。  
*Plan*: [`plan/09-trustworthy-local-record.md`](plan/09-trustworthy-local-record.md) — 已批准 2026-08-31，完成 2026-09-02 10:24 HKT

**已交付**：
- **紀錄一致**（同儕審查的 C1）：`persistCompletedSession()` 改為**先寫入、成功才收進記憶體**。因為儀表板、分析頁、雷達與**徽章判定**都讀同一個陣列，這一個順序改動同時修好全部 —— 實測寫入失敗後徽章為 `[]`，此前會誤發「初試啼聲」與「同理心大師」。
- **診斷日誌不留痕跡**（D8）：不再寫入 `localStorage`、日誌內容不再含金鑰任何字元片段與明文 Group ID、開機清除舊安裝的殘留。
- **每日用量上限**（D13）：計數放在 `callGeminiAPI()` 這個唯一網路出口，五個函式全部涵蓋；設定頁在金鑰欄位旁顯示「已用／上限／尚餘」，上限預設 200 可調（10–2000）；離線示範不計數。
- **不受信任內容不得成為標記**（D16／D31）：48 處插入點全部 escape，外加匯入基因碼的欄位白名單。

**建置期間的重要發現**：`ARCHITECTURE.md` 對 D31 的記錄稱督導提示面板是「唯一這樣的介面」—— **錯了 48 倍**。而最危險的一條路徑根本不經過模型：匯入基因碼只檢查三個欄位存在，就把任意物件寫進保險箱永久保存。渲染層 escape 與匯入白名單兩者都必要 —— 前者才救得了修正前已存進保險箱的惡意個案。

**未處理**：每日上限輸入框不跟隨淺色主題。量測確認旁邊的 Gemini 金鑰輸入框行為完全相同（`.form-group input` 特異度較高，兩主題皆深底白字），單獨改這一個反而不一致。屬 `ARCHITECTURE.md` §8 的設計系統工作。

---

### 編排說明
- **未新增 PRD 以外的範圍。** 「面談草稿續接」刻意未列入 —— PRD 未描述該能力；Milestone 8 只做到攔截誤離開與開機可靠為止。
- **語言不一致是刻意的。** Milestone 1–4 的既有英文內容一字未改（屬已確認事項），新里程碑以白話中文撰寫。
- **Milestone 2 與 3 的狀態於 2026-08-27 對照程式碼更正**，此前長期停留在「Next」／「Planned」。原先此處的過時警告已由本次更正取代。
- **2026-08-29 重新排序**：新增 Milestone 7「每個數字都來自你的紀錄」，原 Milestone 7／8 順延為 8／9。
- **2026-08-31 順序說明**：Milestone 8 的三項待修（D32／D33／D34）排在 Milestone 9 之前，理由是 D32 為資料遺失回歸，不應在會弄丟面談的路徑上疊加流量 —— 與 Milestone 6 處理 D15 時一致。**三項已於同日 15:23 HKT 完成**，Milestone 9 隨即成為下一項。

---

## ✅ PRD v4 已批准（2026-08-29 05:53 HKT）—— 以下能力已可排入，待路線圖重排

以下來自 2026-08-28／29 的四份專家審查（輔導員、督導與教師、自學系統、介面設計）。它們此前因 `PRD.md` v3 未描述而不得寫成里程碑；**PRD v4 已將其全部納入產品意圖**，閘門已開。`ARCHITECTURE.md` §7 的 D24–D31 記錄了它們與程式碼的實際距離。

**尚未排入里程碑序列** —— 需要一次路線圖重排並經擁有者批准，才能決定它們與現有 M8／M9 的先後（M7 已於 2026-08-29 完成）：

| 待決能力 | 提出者 |
| :--- | :--- |
| **風險與危機情境**（自殺意念、虐待披露、急性精神症狀）與轉介指引 —— 目前學員可完成全部模組、拿齊徽章，卻從未練習過一次風險評估 | 督導 |
| **可及性基線**（ARIA 標註、ICF 沙盒的鍵盤操作路徑、減少動態偏好）—— 目前 ICF 模組對鍵盤使用者不可用 | 督導、介面、自學系統 |
| **學習者模型與逐題作答記錄**（錯題重現、弱項標示）—— 目前系統對學習者的認知只有 9 個布林值，逐題作答記錄為 0。**Milestone 7 因此無法把徽章完全交由保險箱推導**（D21 餘下部分卡在這裡），優先度相應提高 | 自學系統、學習者 |
| **督導提示保存並納入匯出** —— 目前 `coachHint` 不寫入紀錄，真人督導無法審閱 AI 對學員說過什麼 | 督導 |
| **教材作者流程**（教材抽離為資料檔，培訓師可自行擴充） | 自學系統 |
| ~~**AI 督導的定位聲明**（練習輔助，非督導意見）~~ —— **已由 Milestone 7 交付**：五個出現分數或督導建議的位置（含匯出報告）都聲明這是練習回饋、臨床判斷屬於真人督導 | 督導 |
| **案主反應加入不確定性** —— 目前「技巧進 → 順從出」是確定性規則，會教出錯誤預期 | 督導 |
| **介面語言選項的處置** —— EN／简中 承諾了不存在的教材翻譯 | 自學系統 |
| ~~**Phase 13 督導干預功能補寫入 PRD**~~ —— **已由 v4 解決**，寫入使用者流程第 3 步 | 先前審計 |
| **移除英文與简中語系選項** —— v4 將本地化臨床內容列為不做，故 170 處語系分支需收斂（新增項，非審查提出） | PRD v4 |

**設計系統重整**（45 種字級收斂、806 處行內樣式抽取、淺色主題補齊、載入與空狀態設計、命名回到臨床語域）不改變任何產品承諾，屬內部工程，**不列為里程碑**，隨每個里程碑順帶處理當期觸及的畫面。
