# RehabCounselor AI — 項目交接紀錄

以下為 2026-11-24（香港時間）的核實快照。[中央 Registry](https://github.com/wongsir1011/andrew-project-registry) 記錄各正式環境的部署來源。

## 來源、版本與部署

| 項目 | 核實結果 |
|---|---|
| Canonical repo | [wongsir1011/rehab-counselor-ai](https://github.com/wongsir1011/rehab-counselor-ai)，公開 repo |
| 正式分支及來源 | [`main` / `a5801e3d85977a1215e6b672b58f1c1d52148627`](https://github.com/wongsir1011/rehab-counselor-ai/commit/a5801e3d85977a1215e6b672b58f1c1d52148627) |
| 程式快取標記 | `v20260902_v28_m9fix`（`index.html` 的 `app.js` 入口） |
| 穩定版本及 Release | 待完整驗收後定版。GitHub 暫無 Release |
| 正式網址 | [rehab-counselor-ai.vercel.app](https://rehab-counselor-ai.vercel.app/) |
| Vercel 正式部署 | 2026-11-24 直接核實 `Ready / Latest / Production / Current`。正式域名指向上述 `main` commit。[Vercel 部署詳情](https://vercel.com/wongsir1011s-projects/rehab-counselor-ai/DLHgudayakqY4pYpHL2tHEJzWKRC) |
| GitHub 部署紀錄 | `success`，來源與上述 `main` 相同。[Production deployment 6777580081](https://api.github.com/repos/wongsir1011/rehab-counselor-ai/deployments/6777580081/statuses) |
| 正式域名內容 | `index.html`、`index.css`、`app.js`、`geminiService.js`、`mockData.js`、`src/utils/db.js` 逐 byte 與上述來源相同 |
| 其他環境 | GitHub Pages 未啟用。Vercel 的 `git-main` 及部署專用網址屬同一部署。其他正式環境尚未識別 |

## 功能與真實依賴

- 儀表板、ACT／MI 理論練習、個案面談、ICF 沙盒、小組研討、學習分析、報告匯出及保險箱備份／還原。
- 正式入口：`index.html → app.js → mockData.js / geminiService.js / src/utils/db.js`，樣式為 `index.css`。
- 無套件安裝或 build；Web Speech API、Gemini、MiniMax、Google Fonts 及 Font Awesome CDN 依賴瀏覽器及網絡。
- `src/` 除 db.js 外的舊模組未被目前入口載入。本次保留，不能把修改它們當作已修改正式產品。
- IndexedDB 保存面談和自訂個案；小設定及密鑰在 localStorage。備份排除密鑰；AI／TTS 請求直接由瀏覽器傳至供應商。

## 整理與驗收

| 步驟 | 狀態與證據 | 下一步及負責者 |
|---|---|---|
| 基礎整理 | [PR #15](https://github.com/wongsir1011/rehab-counselor-ai/pull/15) 已合併，加入交接文件、驗收表和 CI | 維護者合併文件更新後重查正式部署 |
| 本地檢查 | 2026-11-24 兩項檢查通過。Node 成功解析 22 個 JavaScript 檔，5 個本地入口資源及依賴均存在 | 維護者在 PR 上核對 CI |
| GitHub Actions | [`main` 的 Project checks](https://github.com/wongsir1011/rehab-counselor-ai/actions/runs/36823975316) 通過，執行來源為上述 commit | 維護者維持必要檢查 |
| 正式站瀏覽器驗證 | 免金鑰「阿強」個案完成三回合，顯示示範回覆及督導提示，完成面談後可重新載入及查閱「離線示範・未評估」紀錄。全量備份按鈕成功產生下載。[驗收表](docs/ACCEPTANCE.md) | Andrew 在桌面／手機驗收真實 Gemini、粵語及還原，並完成其餘項目 |
| 授權 | 公開 repo 現無 `LICENSE` | 由擁有人決定發放授權 |
| `main` 治理 | GitHub 確認受保護，`Project checks` 適用於所有人。既有規則記錄要求 PR、分支須更新至最新 `main`，並禁止強制推送及刪除。[分支保護設定](https://github.com/wongsir1011/rehab-counselor-ai/settings/branch_protection_rules/84033630) | 維護者沿用現行規則 |
| 舊分支 | 已核對三條分支為 `main` 祖先，上一輪整理分支經 squash 合併且檔案樹與快照一致。刪除前須確定無人使用。另有 `rollback` 分支需要保留其未併入的歷史 | 維護者確認分支用途 |
| 下載 | 網頁服務。使用者可匯出面談日誌及備份 | 安裝包發佈流程不適用 |
| 中央登記 | [中央 Registry](https://github.com/wongsir1011/andrew-project-registry) 已登記為 Testing，快照的 repo 及正式部署來源與登記一致 | 維護者合併文件更新後同步來源及驗收證據 |

## 尚未交付的產品範圍

原有 PRD／路線圖及 ARCHITECTURE §7 仍為產品權威。本次整理不表示以下既有差距已解決：鍵盤及可及性（D24；plan/10 已存在）、危機風險個案／轉介步驟（D25）、逐題練習紀錄（D26）、逐回合督導提示匯出（D27）、非決定性案主演繹（D28）、可編輯教學內容（D29），以及真金鑰端對端驗收。新功能必須跟從既有里程碑計劃與擁有人批准流程。

## 發佈、回復與下次接手

1. 工作分支提交 PR；通過 `Project checks`，審閱文件及影響。
2. 合併 `main` 會觸發既有 Vercel 整合；合併前核准正式更新。
3. 到 Vercel 確認 Ready、Production、Current、正式 domain、完整來源 SHA；對照最新 `main`。正式 alias 的資源另作 smoke check。
4. 按驗收表做實機及真金鑰驗收，再同步 Registry。未完成驗收之前保持 Testing，不新造穩定版本。
5. 如須回復，對 main 用 revert PR 回復問題變更，或在 Vercel 對已核實來源做 rollback；不能以舊 `rollback` 分支名稱推斷它是可用正式版。保險箱資料先備份。
