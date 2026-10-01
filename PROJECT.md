# RehabCounselor AI — 項目交接紀錄

核實日期：2026-10-01（香港時間）。這是一份當時快照；最新部署指針由 [中央 Registry](https://github.com/wongsir1011/andrew-project-registry) 維護。

## 來源、版本與部署

| 項目 | 核實結果 |
|---|---|
| Canonical repo | https://github.com/wongsir1011/rehab-counselor-ai |
| 公開程度 | GitHub connector 顯示 public；舊私人 repo 描述已修正 |
| 正式分支／盤點來源 | `main` / `08dc73ab7d3d7e91be124d9eed58527545fb5f0a` |
| 程式快取版本 | `v20260902_v28_m9fix`，來自 HTML 的 app.js 入口與 CHANGELOG；不是已驗收的語意版本 |
| 最新歷史文件條目 | `docs-m9-adr`（2026-09-03） |
| 穩定版本／Release | 未宣告；GitHub Releases 為空，未有此次裝置驗收 |
| 正式網址 | https://rehab-counselor-ai.vercel.app/ |
| 平台 | Vercel；文件記錄 production branch `main` |
| 最新 GitHub Production deployment | [6286337139](https://api.github.com/repos/wongsir1011/rehab-counselor-ai/deployments/6286337139)，SHA 與上述 main 相同，status success |
| 該部署網址 | https://rehab-counselor-jbt51bf3j-wongsir1011s-projects.vercel.app |
| Vercel commit 狀態 | success：[部署詳情](https://vercel.com/wongsir1011s-projects/rehab-counselor-ai/4CY1q8o8GfdYJbF9pC7SaDFXRfVP) |
| 正式域名內容 | index.html、app.js、geminiService.js、mockData.js、index.css、src/utils/db.js 已下載，與上述來源逐 byte 相同 |
| 當前 Production commit | 未直接核實 Current／Active／正式 alias 的平台指向；以上為 GitHub 部署紀錄與正式域名檔案證據，不能證明文件 commit 或 alias 沒有被另行更新 |
| 次要環境 | 未發現／未核實，不能假設不存在 |

## 功能與真實依賴

- 儀表板、ACT／MI 理論練習、個案面談、ICF 沙盒、小組研討、學習分析、報告匯出及保險箱備份／還原。
- 正式入口：`index.html → app.js → mockData.js / geminiService.js / src/utils/db.js`，樣式為 `index.css`。
- 無套件安裝或 build；Web Speech API、Gemini、MiniMax、Google Fonts 及 Font Awesome CDN 依賴瀏覽器及網絡。
- `src/` 除 db.js 外的舊模組未被目前入口載入。本次保留，不能把修改它們當作已修改正式產品。
- IndexedDB 保存面談和自訂個案；小設定及密鑰在 localStorage。備份排除密鑰；AI／TTS 請求直接由瀏覽器傳至供應商。

## 本輪整理與檢查

| 步驟 | 狀態與證據 | 下一步／負責者 |
|---|---|---|
| 來源盤點 | 完成；上述 main、部署及檔案比對 | 合併後維護者重查正式環境 |
| 交接文件 | README、PROJECT、驗收表及本輪 CHANGELOG 已整理，隨 PR 審核 | 擁有人審閱 |
| 本地語法 | 原有 check_syntax.py 與 Node parser／靜態資源依賴檢查通過 | CI 重跑 |
| CI | 新增 GitHub Actions `Project checks`；main 原先沒有 Actions runs | PR 上核對實際結果 |
| 瀏覽器自動驗證 | 本環境缺 Chromium；下載失敗，未執行瀏覽器 smoke test | 實機或可用瀏覽器重驗 |
| 實機／真 key | 待驗收；[驗收表](docs/ACCEPTANCE.md) | Andrew 桌面及手機實測 |
| 授權 | 無 LICENSE；本輪未改授權，亦未因其他 repo 的決定推定本 repo 授權 | 擁有人決定是否需要授權標示 |
| main 治理 | GitHub branches 顯示 protected=false；rulesets=[]。新增 CI 不等於強制分支保護 | 維護者設定 PR／必需檢查／禁強推及刪除後核實 |
| 舊分支 | chore/docs-links、docs/ssot-governance-audit、feature/adr-0005-vault 已為 main 祖先且無開放 PR；rollback 不是已合併分支 | 保留，未確定仍否有本地工作前不刪 |
| Release／下載 | 不適用：目前為網頁服務，沒有原生安裝包 | 不為整理製造空 Release |
| 中央登記 | Registry 已定位；以 Testing、未驗收版本及明確部署限制登記 | 合併後更新 source commit 與正式證據 |

## 尚未交付的產品範圍

原有 PRD／路線圖及 ARCHITECTURE §7 仍為產品權威。本次整理不表示以下既有差距已解決：鍵盤及可及性（D24；plan/10 已存在）、危機風險個案／轉介步驟（D25）、逐題練習紀錄（D26）、逐回合督導提示匯出（D27）、非決定性案主演繹（D28）、可編輯教學內容（D29），以及真金鑰端對端驗收。新功能必須跟從既有里程碑計劃與擁有人批准流程。

## 發佈、回復與下次接手

1. 工作分支提交 PR；通過 `Project checks`，審閱文件及影響。
2. 合併 `main` 會觸發既有 Vercel 整合；合併前核准正式更新。
3. 到 Vercel 確認 Ready、Production、Current、正式 domain、完整來源 SHA；對照最新 `main`。正式 alias 的資源另作 smoke check。
4. 按驗收表做實機及真金鑰驗收，再同步 Registry。未完成驗收之前保持 Testing，不新造穩定版本。
5. 如須回復，對 main 用 revert PR 回復問題變更，或在 Vercel 對已核實來源做 rollback；不能以舊 `rollback` 分支名稱推斷它是可用正式版。保險箱資料先備份。
