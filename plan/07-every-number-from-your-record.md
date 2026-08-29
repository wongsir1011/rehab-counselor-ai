# Milestone 7 Plan: 每個數字都來自你的紀錄

* **Status**: Completed ✅ —— 建置與驗證完成 2026-08-29
* **Approved**: 2026-08-29 HKT (UTC+8) —— §7 依建議採「執行對帳」
* **Roadmap Ref**: [Product Roadmap Milestone 7](../Product_Roadmap.md)
* **Traces to PRD v4**: `HARD CONSTRAINTS → No Claim Without Evidence`；`HARD CONSTRAINTS → No Fabricated Clinical Content`；`HARD CONSTRAINTS → SSOT`
* **Closes drift**: `ARCHITECTURE.md` §7 **D20**（三處「未評估畫成 0 分」）、**D7**（完成場次三份副本）、**D30**（等第與無根據宣稱）
* **Partly closes**: **D21**（成就未由保險箱推導）—— 見 §6

> 本檔是本里程碑的建置 SSOT。日後修這一塊的 bug，先重新讀本檔。

---

## 1. 里程碑承諾

平台只說它有證據的話。**沒有紀錄就顯示「尚無紀錄」，沒有評估就顯示「未評估」，沒有達標就不發徽章。**

PRD v4 原文：

> Every number, grade, badge, chart, and statement the platform makes about the counselor's ability is computed from that counselor's own record. Where there is no record it says so. Scores from the model are presented as practice feedback, never as assessment: no letter grades, and, wherever supervisor guidance or scores appear, the platform states that this is practice support and that clinical judgement rests with a human supervisor.

三個可檢驗的承諾：
1. 每個關於同工能力的數字都能指向產生它的紀錄。
2. 沒有那筆紀錄時，畫面說「沒有」，而不是說「0」。
3. 分數以「練習回饋」呈現，不出現字母等第，且出現分數或督導建議之處都聲明臨床判斷屬於真人督導。

## 2. 現況（2026-08-29 讀碼所得，基準 `a94a21a`）

### 2.1 無中生有的宣稱

| # | 位置 | 現況 |
| :--- | :--- | :--- |
| A | `app.js:904` | 儀表板「個人能力值縮影」雷達圖的 `<polygon points="100,50 160,82 …">` 是**寫死的座標**，與任何紀錄無關 |
| B | `app.js:909-910` | 同一張卡下方寫死「聽力共情：**極佳 (A)**」「承諾行動引導：**優良 (B+)**」，零場面談亦然 |
| C | `mockData.js:849` | 該卡說明文字「平台整合自學表現與 SOAP 評核的雷達圖」—— 程式沒有任何一處整合自學表現或 SOAP |
| D | `app.js:1732` | MI 闖關結束一律說「這代表你**已基本掌握**…」。單題最低 2 分、最高 10 分，全選說教型答案得 20 分，同樣顯示這句 |
| E | `mockData.js:806-812` | 「知識探險家」徽章寫「深入研讀 ACT、MI、ICF 理論子分頁並**完美通過** OARS 闖關遊戲」，實際解鎖條件（`app.js:1721`）只是**走到最後一題**，不看分數、不看另外兩個理論分頁 |
| F | `mockData.js:782` | 「初試啼聲」徽章寫「完成第一次…**並生成評估報告**」，但 `app.js:4488` 在離線無評估的面談後**照樣發出** |
| G | `app.js:5706` | 分析頁寫死「你目前在 ACT 的心理彈性概念上**自學非常充足**」，與 `theoryProgress` 無關，零進度亦然 |
| H | `app.js:5090-5092` | 小組研討結束一律說「同工小組…**深化了**對於 MI…的實戰心得」，與答題結果無關 |

### 2.2 「未評估」被畫成「0 分」（D20，一個缺陷三處，加上新發現的第四處）

| # | 位置 | 現況 |
| :--- | :--- | :--- |
| I | `app.js:743`、`800`、`802` | 平均分卡以 `historySessions.length > 0` 開關。保險箱裡只有離線示範面談時，`avgScore` 為 0 而條件為真 → 顯示 **「0分」** 與空圓環。正確答案是「—」 |
| J | `app.js:5947-5949`、`5993-6036` | 歷史詳情彈窗對未評估面談把五維解構為 0，然後照樣畫出雷達與「同理反映 0 / 改變談話 0 …」，標題仍是「本次面談技巧評分」。收縮到圓心的五邊形讀起來是「這場拿了 0 分」 |
| K | `app.js:5569`、`5732` | 分析頁雷達在零筆已評估時把 `state.radarScores` 設為全 0 並照樣畫多邊形。旁邊的等第句已正確顯示「尚無已評估的面談紀錄」，圖形卻沒有 |
| L | `app.js:5304` **（本次新發現）** | 縱向趨勢圖以 `historySessions.length < 2` 決定是否顯示「模擬成長對照引導線」徽章。**兩場離線示範面談**會讓 `isSimulated` 為 `false`，`dataPoints` 經 `filter(hasEvaluation)` 後為空陣列 → 畫出一張**沒有徽章、沒有資料點**的「你的」趨勢圖。同一個缺陷家族，與 I／J／K 一併修 |

### 2.3 字母等第（D30）

`app.js:5587-5590` 由五維平均產生 `卓越 (A) / 優良 (B+) / 合格 (C) / 需提升 (D)`，於 `app.js:5750` 以「累計戰力綜合評核」呈現。PRD v4 明令 `no letter grades`。

`app.js:5849` 的維度建議面板顯示「平均 `${state.radarScores[key] || 0}` 分」，零紀錄時同樣顯示 0。

### 2.4 SSOT 破口（D7）

完成場次有三份副本：`sessions` object store（權威）、`rehab_completed_cases_count`、`rehab_completed_case_ids`（`app.js:4460-4465` 三行相鄰賦值）。

讀碼結果：**`state.completedCasesCount` 從未被任何畫面讀取**，只被累加、重設與寫入備份檔。`state.completedCaseIds` 只有一個讀取點 —— `app.js:4492` 的「實戰特工」徽章門檻。兩者都可由 `state.historySessions` 直接推導。

### 2.5 已經誠實、本次不動

- 已評估面談的五維彙總（M6 F1 修正的三處 `filter(hasEvaluation)`）。
- 歷史卡片的「離線示範 · 未評估」標籤（`app.js:5622`）。
- 離線完成畫面 `renderSessionCompletedWithoutEvaluation()`。
- Markdown 匯出的無評估說明段落（`app.js:6867-6869`）。
- ICF 沙盒「100% 精確」訊息 —— 只在確實 100% 時出現。
- 縱向趨勢圖的模擬資料本身（有虛線與 `simulatedBadge`）—— 只修 §2.2 L 的開關條件。

## 3. 建置內容

### 3.1 單一推導點 `computeCounselorRecord()`

新增一支純函式，是本里程碑的核心。所有關於同工的衍生數字**只從這裡出**：

```
computeCounselorRecord(historySessions) → {
  totalSessions,          // 保險箱場次
  evaluatedSessions,      // 帶 AI 評估的場次陣列
  evaluatedCount,
  distinctCaseIds,        // Set，取代 rehab_completed_case_ids
  userTurns,              // 對話輪次
  radar,                  // { empathy, changeTalk, defusion, icf, action } 或 null
  radarAverage            // 數字或 null
}
```

`radar` 與 `radarAverage` 在 `evaluatedCount === 0` 時為 **`null`，不是 0**。這是整個里程碑的關鍵設計 —— `null` 無法被誤畫成一個圓心點。

現有的 `hasEvaluation()` 保留為此函式內部使用的述詞。`renderDashboard`、`renderAnalytics`、`generateLongitudinalChartHTML`、成就判定全部改讀此函式的輸出，刪除各自的加總迴圈（`app.js:729-739`、`5540-5570`）。

`state.radarScores` 由 `null` 取代全 0 預設；其唯一消費者 `renderRadarRecommendation()`（`app.js:5849`）改為 `null` 時顯示「未評估」而非「0 分」。

### 3.2 儀表板：修 §2.1 A/B/C 與 §2.2 I

- 平均分卡（`app.js:743`、`800`、`802`）改以 `record.radarAverage === null` 判斷 → 顯示 `—`、空圓環、`t("dashboard_accuracy_val_empty")`（「尚未評估 (N/A)」，字串已存在）。
- 「個人能力值縮影」卡改由 `record.radar` 繪製多邊形，座標公式與分析頁共用。`record.radar === null` 時**只畫格線與軸線，不畫多邊形**，卡片下方以一行「尚無已評估的面談紀錄」取代兩個寫死等第。
- 有紀錄時，下方兩行改為該卡實際繪製的維度數值（如「傾聽共情：78 分」「承諾行動：65 分」），並註明來自 N 場已評估面談。**不使用字母等第。**
- `mini_radar_desc` 譯文改寫為描述真實來源（「來自你已評估面談的五維平均」），移除不存在的「整合自學表現與 SOAP 評核」。

### 3.3 分析頁：修 §2.2 K、§2.3、§2.1 G

- 雷達多邊形在 `record.radar === null` 時**不輸出 `<polygon>`**，只保留格線、軸線、標籤與可點擊圓點（圓點是導覽用途，非分數表示，保留）。
- 刪除 `gradeText` 的四個字母等第分支。`app.js:5750` 改為：
  - 有紀錄：`AI 即時回饋（練習參考）：N 場已評估面談的五維平均為 X 分。`
  - 無紀錄：`尚無已評估的面談紀錄。完成一次有金鑰的面談後，這裡會顯示來自你自己紀錄的平均分。`
- 維度建議面板的「平均 X 分」在 `null` 時顯示「未評估」。
- 「專家培訓建議」段落改由 `state.theoryProgress` 與 `record.radar` 推導：指向**實際未完成**的理論模組，或**實際最低**的維度；兩者都沒有紀錄時，改為不作宣稱的一句引導語。

### 3.4 歷史詳情彈窗：修 §2.2 J

`showSessionDetailPopup()` 在 `hasEvaluation(session) === false` 時，**整塊「本次面談技巧評分」（雷達 SVG ＋ 五行數值）以說明卡取代**：說明這場在離線示範模式下進行、沒有 AI 評估、逐字紀錄與日誌為真實內容，並指出取得評估需要金鑰。右側總結欄的既有無評估文案保留。

刪除 `app.js:5948-5949` 的零填充解構 —— 這個表達式是缺陷本身，留著就會再被誤用。

### 3.5 縱向趨勢圖：修 §2.2 L

`isSimulated` 的判斷改為 `record.evaluatedCount < 2`（現為 `historySessions.length < 2`）。離線示範面談不再被當成「有資料」而抽掉引導線徽章。

### 3.6 MI 闖關與徽章：修 §2.1 D/E/F

- **MI 闖關結束畫面**改為據實陳述：顯示 `得分 / 滿分`（滿分＝各題最高選項之和，由 `oars_game` 計算而得，不寫死 100），並依實際得分率分三段給不同措辭；只有在**全部選中最高分選項**時才使用「掌握」一類的字眼。低分時明確指出哪幾題選了說教型回應。
- **「知識探險家」** 解鎖條件改為與其描述一致：ACT、MI、ICF 三個理論分頁的 `info`／`flashcards`／`test` 皆完成，**且** MI 闖關得分率達 100%。判定移到一支 `evaluateAchievement(id)` 內。
- **「初試啼聲」** 解鎖條件改為 `record.evaluatedCount >= 1`（原本離線無評估面談亦發），與描述「並生成評估報告」一致。
- **「實戰特工」** 改讀 `record.distinctCaseIds.size >= 3`（原讀 `state.completedCaseIds`）。
- **「同理心大師」** 條件不變（已正確門檻 90 分），但改為由 `record.evaluatedSessions` 判定，因此還原備份後也會正確重算。
- **「生命合成家」**「全人評估官」條件不變。

徽章牆的六段描述文字（`mockData.js`）逐條校對為與實際判定一致；改動的只有 `theory_explorer` 與 `first_session` 兩條。

### 3.7 一次性徽章對帳（**需擁有者決定，見 §7**）

開機時對**條件可查證**的徽章重新判定：不符者從 `state.unlockedAchievements` 移除。可查證者為 `first_session`、`empathy_master`、`combat_specialist`（保險箱）與 `theory_explorer`（`theoryProgress` ＋ 闖關分數）。

`icf_expert` 與 `case_creator` 沒有可查證的持久紀錄（ICF 沙盒結果不落地；自訂個案可被刪除），維持既有鎖存值，不撤銷、不重發。

對帳只跑一次（`app_meta` 記旗標），且不改變徽章的儲存位置 —— 完整由保險箱推導需要逐題練習紀錄（D26），屬另一個里程碑。

### 3.8 移除完成場次的兩份副本（D7）

- 刪除 `state.completedCasesCount` 與 `rehab_completed_cases_count`（零讀取點）。
- 刪除 `state.completedCaseIds` 與 `rehab_completed_case_ids`，唯一讀取點改用 `record.distinctCaseIds`。
- `app.js:4460-4465`、`470-471`、`6556-6557` 相應清理。
- `src/utils/db.js` `buildBackupJSON()`：`completedCount` 改由傳入的 `sessions` 推導，`completedIds` 一併改為推導後輸出，**備份檔欄位名與格式不變**，舊備份仍可還原（`importFullBackupJSON` 對這兩個欄位改為忽略，因為它們現在是衍生值）。

### 3.9 練習輔助聲明（PRD v4 最後一句）

在**出現分數或督導建議的每一處**加入一行固定聲明：「以上為 AI 練習回饋，非督導評核；臨床判斷屬於真人督導。」

五處：面談室督導提示面板（`app.js:3477` 標題列下方）、面談後評估報告頁（`app.js:4658-4667`）、歷史詳情彈窗評分區、分析頁雷達卡、Markdown 匯出的評估段落（`app.js:6866`）。

用一個常數與一支小函式輸出，避免五份措辭各自漂移。

### 3.10 小組研討結語：修 §2.1 H

`renderCoQuestion()` 完成畫面改為據實陳述：說明已完成 N 題研討，把「深化了實戰心得」這個對小組的宣稱改為不作宣稱的收尾與引導。

### 3.11 快取戳記

`index.html` → `app.js?v=20260829_v24_m7`、`index.css?v=20260829_v24_m7`（本里程碑會動 CSS：無評估說明卡與聲明行的樣式）。
`app.js` 頂部 → `mockData.js?v=20260829_v24_m7`（徽章描述與譯文有改）。
`geminiService.js` 與 `src/utils/db.js`：`db.js` 有改（§3.8）→ 一併更新為 `v20260829_v24_m7`；`geminiService.js` 不動，戳記保持不變。

## 4. 風險審查結論

**符合 PRD v4**：逐條對照 `No Claim Without Evidence` 的四項要求 —— 每個數字可溯源（§3.1 單一推導點）、無紀錄時說「沒有」（§3.2/3.3/3.4/3.5）、不使用字母等第（§3.3）、出現分數與督導建議處聲明練習性質（§3.9）。`SSOT` 的「derived values … computed in one place from the vault」由 §3.1 ＋ §3.8 對「session counts、completion tallies、radar aggregates」達成；「progress milestones」只達成一半（§3.7 說明理由與剩餘距離）。

**無重複狀態**：`computeCounselorRecord()` 為純函式，不儲存；`state.radarScores` 由「另一份彙總副本」降格為「該次 render 的推導快取」，且改用 `null` 表示無資料；§3.8 反而**刪除**兩份既有副本。

**不破壞既有功能**：所有新分支的條件是「無已評估面談」或「未達徽章條件」—— 手上已有已評估面談的同工，畫面數字與今日完全相同，只是等第句改為分數句、多一行聲明。有金鑰的面談流程、TTS／STT、保險箱備份還原、匯出格式主體皆不觸及。

**不動資料表**：`DB_VERSION` 維持 1，三個 object store 不變，不需 migration。§3.7 的對帳旗標寫入既有的 `app_meta`，`setMeta`／`getMeta` 已存在。備份檔 `BACKUP_VERSION` 與欄位名不變。

**已知會被使用者看見的行為改變**：§3.7 的徽章對帳可能讓部分同工失去先前顯示的徽章。這是里程碑的目的，但它移除了使用者已看見的東西，故列為擁有者決定事項（§7）。

### 邊界情況

| 情況 | 處理 |
| :--- | :--- |
| 保險箱零筆 | 全部顯示「尚無紀錄」；雷達只有格線；平均分卡顯示 `—` |
| 保險箱只有離線示範面談（D20 主場景） | 同上。場次數與對話輪次照實顯示（那是真實紀錄），但**分數相關一律「未評估」** |
| 一場已評估 ＋ 三場未評估 | 分母為 1；趨勢圖 `evaluatedCount < 2` → 顯示引導線徽章；雷達正常畫 |
| 恰好兩場已評估 | 趨勢圖切換為真實資料，徽章消失 —— 與現行行為一致 |
| 已評估面談的 `report.scores` 缺某一維 | 沿用現行 `|| 0` 於**單場**加總；此為 M6 既有行為，本次不擴大處理，記入 §8 |
| 還原他人備份後徽章對帳 | 對帳讀還原後的保險箱，結果隨新資料重算；`icf_expert`／`case_creator` 沿用備份檔內的鎖存值 |
| 降級模式（IndexedDB 不可用） | `computeCounselorRecord()` 讀 `state.historySessions`，降級模式下該陣列由 localStorage 回填，行為一致 |
| MI 闖關中途離開再回來 | `miGameScore`／`miGameIndex` 仍為記憶體狀態，行為不變；徽章判定只在走完最後一題時執行 |
| `oars_game` 題目被 Training Lead 增減 | 滿分由資料計算，不寫死 100，故自動跟隨 |

## 5. 驗證步驟

1. `python3 check_syntax.py` 全綠。
2. **純函式隔離測試** `computeCounselorRecord()`：零筆 → `radar === null`；只有 `report: null` 的三筆 → `radar === null` 且 `totalSessions === 3`；一評估一未評估 → 分母為 1；三筆不同 `caseId` → `distinctCaseIds.size === 3`；同一 `caseId` 三筆 → `size === 1`。
3. **徽章判定隔離測試**：`theory_explorer` 在「三分頁全完成但闖關 80%」下不解鎖、在「100% 但 ICF 分頁未完成」下不解鎖、兩者皆滿足時解鎖；`first_session` 在只有未評估面談時不解鎖。
4. **真實瀏覽器（此為本里程碑的關鍵驗證，D20 正是因為只讀碼而漏掉）**：
   - 清空保險箱 → 儀表板：平均分卡顯示 `—`、縮影雷達無多邊形、無「極佳 (A)」。
   - 注入**三筆 `report: null`** 的面談 → 儀表板不出現「0分」；分析頁雷達無多邊形；趨勢圖顯示引導線徽章；點開任一場的詳情彈窗，**不出現雷達與五行 0 分**，而是說明卡。
   - 注入**一筆已評估（全 60）＋ 兩筆未評估** → 平均顯示 60；等第句改為「AI 即時回饋（練習參考）」且**不含 A／B+／C／D**；五處聲明行皆在。
   - 走完 MI 闖關並**全選說教型答案** → 結束畫面不出現「已基本掌握」，且「知識探險家」未解鎖。
   - 全選最佳答案 ＋ 三個理論分頁全完成 → 徽章解鎖。
5. **回歸**：M5 的單次結構化往返、M6 的離線示範標示與 Markdown 匯出標記，全部重跑。
6. **備份還原**：匯出 → 清空 → 還原，確認場次數、雷達、徽章三者一致且與還原前相同。

## 6. 本次**不**處理（明確界線）

| 項目 | 理由 |
| :--- | :--- |
| 逐題練習紀錄（D26） | 獨立能力，PRD v4 新增，尚未排入里程碑序列。徽章完整由保險箱推導（D21 餘下部分）依賴它 |
| `coachHint` 寫入紀錄與匯出（D27） | 同上，屬督導審閱能力，非本里程碑的「數字有無根據」 |
| 督導面板 `innerHTML`（D31／D16） | 已排入 Milestone 9 |
| `beforeunload` 與「已安全備份」假指示（D6／D6′） | 已排入 Milestone 8 |
| 移除 EN／简中 語系（D22） | 需 170 處收斂，獨立變更；本次新增字串照現行三語模式撰寫 |
| 移除激勵金句輪播（D22 後半） | 同上，與本里程碑無因果關係 |
| `report.scores` 缺欄位的嚴格驗證 | M6 既有行為，擴大處理會混入 AI 閘道議題 |
| 表現層設計系統重整 | 依路線圖，只順帶處理本次觸及畫面的樣式 |

## 7. 需擁有者拍板的一項

**§3.7 的一次性徽章對帳是否執行？**

- **執行（建議）**：條件可查證而不符者撤銷。符合本里程碑「沒有達標就不發徽章」的承諾。代價是部分同工開機後會少掉一兩個徽章，且沒有畫面解釋（除非另加通知，那會擴張範圍）。
- **不執行**：舊鎖存值一律保留，只有新解鎖走新條件。畫面不會退步，但「知識探險家」在既有使用者身上仍是一個沒有根據的宣稱 —— 里程碑承諾只對新使用者成立。

我的建議是**執行**，並在對帳撤銷時於分析頁徽章牆頂部顯示一行說明（「部分徽章的達成條件已更正，未符合者已收回」），只顯示一次。這一行是本項的唯一介面新增。

## 8. 建置前已知的非顯然決定

`record.radar` 以 `null` 而非 0 表示無資料 —— 這是防止 D20 再次發生的結構性選擇，`null` 進入座標公式會立刻壞掉而非靜默畫出圓心點；分析頁雷達的五個可點擊圓點在無資料時**保留**，因為它們是維度導覽控制項而非分數表示；`state.radarScores` 保留變數名以免波及既有事件處理，但語意改為「本次 render 的推導快取」；備份檔的 `completedCount`／`completedIds` 欄位名保留但改為推導輸出，以維持與舊備份的雙向相容；小組研討結語（§3.10）與「專家培訓建議」（§3.3）雖非分數，仍納入，因為它們與 A–H 是同一模式 —— 對同工作出無紀錄支持的宣稱。


---

## 9. 驗證結果（2026-08-29）

| 步驟 | 結果 |
| :--- | :--- |
| `check_syntax.py` | ✅ 全數通過 |
| 純函式：零筆 / 全未評估 | ✅ `radar === null`、`radarAverage === null`（**不是 0**） |
| 純函式：一評估 ＋ 一未評估 | ✅ 分母為 1，平均 60 |
| 純函式：60 與 90 兩場 ＋ 兩場未評估 | ✅ 平均 75（未評估未進分母） |
| 純函式：`distinctCaseIds` | ✅ 三個不同個案 → 3；同一個案三筆 → 1 |
| 純函式：`radarPolygonPoints(null, 80)` | ✅ 回 `null`，呼叫端不輸出 polygon |
| 徽章：`first_session` | ✅ 僅未評估面談 → 不解鎖；有已評估 → 解鎖 |
| 徽章：`empathy_master` | ✅ 89 不給、90 給 |
| 徽章：`combat_specialist` | ✅ 2 個個案不給、3 個給、同一個案三次不給 |
| 徽章：`theory_explorer` | ✅ 三模組完成但闖關 80% → 不給；闖關滿分但 ICF 模組未完成 → 不給；兩者俱足 → 給 |
| 徽章：`icf_expert` / `case_creator` | ✅ 回 `null`（無可查證紀錄），沿用鎖存值 |
| 瀏覽器：空保險箱 | ✅ 平均分卡「—／尚未評估 (N/A)」；縮影與分析頁雷達皆無多邊形；圖中央「尚無紀錄」；無字母等第 |
| 瀏覽器：**三筆未評估**（D20 主場景） | ✅ **未出現「0分」**；縮影雷達無多邊形；分析頁雷達無多邊形；詳情彈窗顯示說明卡而非全 0 雷達；趨勢圖**保留**「模擬引導線」徽章 |
| 瀏覽器：一評估（全 60）＋ 三未評估 | ✅ 平均 60（非 15）；「AI 即時回饋（練習參考）」；五處聲明皆在；縮影雷達顯示真實數值並註明來源場次 |
| 瀏覽器：已評估面談詳情彈窗 | ✅ 真實五維、多邊形座標正確（60 → 半徑 48）、聲明在、督導總結在 |
| MI 闖關：全選說教型回應 | ✅ 13/100，結束語為據實陳述（無「已基本掌握」），📋 而非 🏆，`theory_explorer` **未**解鎖 |
| MI 闖關：全選最佳回應 ＋ 三模組完成 | ✅ 100/100，「你在每一題都選中了最貼近 OARS 精神的回應」，徽章解鎖 |
| 對帳：六個徽章 vs 只支持四個的紀錄 | ✅ 收回 `empathy_master`；保留 `theory_explorer`（無從查證）、`icf_expert`、`case_creator`；說明顯示「有 1 個徽章…」 |
| 對帳：理論模組改為未完成 | ✅ `theory_explorer` 被收回（可查證的不達標） |
| 對帳：重新整理 | ✅ 冪等 —— 不重覆收回，說明不重覆顯示 |
| 對帳：旗標真的生效（修 bug 後重測） | ✅ 開機一收回並寫旗標；開機二把徽章人為塞回，對帳**未**再跑，徽章保留 |
| 危險區「重設進度」 | ✅ 保險箱清空、徽章清空、三個已停用的舊鍵一併移除、零 JS 錯誤 |
| 備份還原往返 | ✅ 匯出 → 清空 → 還原 → 重開，四個指標卡、縮影雷達文字、徽章清單**逐字相同**；`completedCount` 由 `sessions` 推導（4），備份檔無任何 API 金鑰 |
| Markdown 匯出（已評估） | ✅ 分數段落後帶「> 以上為 AI 練習回饋，非督導評核；臨床判斷屬於真人督導。」 |
| Markdown 匯出（未評估） | ✅ M6 的離線說明與「［示範劇本］」逐行標記完好；無假分數；**無**練習聲明（沒有分數就不需要） |
| 回歸：M5 單次結構化往返 | ✅ `callCount === 1`、`responseSchema.required = ["reply","coachHint"]`、`propertyOrdering` 正確、缺欄位大聲拋錯 |
| 回歸：M6 離線示範標示 | ✅ 面談室示範徽章、`bubble-scripted` 氣泡、匯出標記全部完好 |
| 主控台 | ✅ 全新分頁載入零輸出 |
| 深色／淺色主題 | ✅ 兩者實際截圖檢視；淺色補上 `#radar-recommendation-panel` 覆寫後全部可讀 |

### 建置期間由測試抓到的 bug（非讀碼發現）
`evaluateAchievement("theory_explorer")` 第一版在闖關未於本次執行時回 `false`。`miGameScore` 開機歸零，因此**每次重新整理都會收回一個合法取得的徽章**。改為此情況回 `null`（無從查證），只有當持久的理論進度證明未達標時才回 `false`。這與 `radar` 用 `null` 而非 0 是同一個原則：**不可查證 ≠ 未達標**。若當初只跑讀碼審查，這個 bug 會原封不動出貨 —— 正是 D20 當初被漏掉的方式。

### 同儕審查抓到的第二個 bug（讀碼發現，非測試）
`reconcileAchievementsOnce()` 的旗標檢查寫成 `done.value.done`，但 `RehabCounselorDB.getMeta()` 回傳的是 **value 本身**（`req.result.value`），不是 `{key, value}` 記錄。因此 `done.value` 永遠是 `undefined`，旗標形同不存在，**對帳每次開機都重跑**。效果上冪等（已收回的再收一次是無操作），所以第一輪測試看不出來 —— 這正是「測試通過但原因不對」。改為 `done.done` 後重測：開機一 → 收回 `empathy_master` 並寫入 `{done:true, revoked:['empathy_master']}`；開機二 → 人為把該徽章塞回去，對帳**未**再執行，徽章保留。「只跑一次」的承諾至此才真的兌現。

### 建置期間的範圍調整
1.  **D20 是四處而非三處**。`generateLongitudinalChartHTML()` 的 `historySessions.length < 2` 與其他三處同源，一併修正（計劃 §2.2 L 已預先記錄）。
2.  **詳情彈窗右側「督導意見總結」在未評估時整塊略去**。左側新的說明卡已完整交代，兩處重覆反而模糊訊息。計劃原本保留右側既有文案。
3.  **`#radar-recommendation-panel` 的淺色主題覆寫**。計劃 §3.11 只預期動 CSS 新增樣式；實測發現該面板以 `!important` 寫死深色底，令本里程碑新增的「未評估」徽章在淺色主題不可讀。依路線圖「隨每個里程碑順帶處理當期觸及的畫面」補上。

### 未執行
真實 Gemini 金鑰端對端（線上路徑以 stub 驗證）；MiniMax TTS 與連續 STT；降級模式（`localstorage-fallback`）下的對帳路徑（程式碼有分支，未實跑）；ICF 沙盒與「全人評估官」徽章的實際達成路徑；`prefers-reduced-motion` 與鍵盤操作（屬 D24，明確不在本里程碑範圍）。

### 剩餘距離（誠實記錄）
`ARCHITECTURE.md` §7 **D21 只關閉一半**。徽章仍存放於 `localStorage`，「全人評估官」與「生命合成家」沒有任何持久紀錄可查證，MI 闖關分數跨重新整理亦無從查證。PRD v4 SSOT 條款要求「progress milestones … computed in one place from the vault」，要真正達成需要逐題練習紀錄（**D26**），屬另一個里程碑。本里程碑做到的是：**條件與描述一致，且可查證者真的被查證**。
