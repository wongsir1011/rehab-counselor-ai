# RehabCounselor AI｜復康輔導智能訓練平台

以香港職業復康情境練習 ACT、動機式訪談（MI）及 ICF 評估。純前端、原生 JavaScript ES Modules，無需建置；面談紀錄及自定義個案保存在使用者瀏覽器的 IndexedDB。

- 正式入口：https://rehab-counselor-ai.vercel.app/
- 唯一來源：https://github.com/wongsir1011/rehab-counselor-ai （`main`）
- [交接及部署現況](PROJECT.md) · [實機驗收表](docs/ACCEPTANCE.md)
- [產品要求](PRD.md) · [架構與已知差距](ARCHITECTURE.md) · [路線圖](Product_Roadmap.md) · [變更紀錄](CHANGELOG.md)
- [中央 Project Registry](https://github.com/wongsir1011/andrew-project-registry)

## 啟動

需要 Python 3；從 repo 根目錄執行：

```bash
python3 -m http.server 8000
```

開啟 http://localhost:8000/ 。使用 HTTP 伺服器，不要直接雙擊 `index.html`；ES Modules 不能可靠地從 `file://` 載入。

無 Gemini 金鑰時可使用**預設劇本示範**；這不代表離線生成 AI 回應或臨床評分。字型及圖示使用 CDN，完全無網絡時未保證完整顯示。需要真實 AI 對話時在設定頁填入自己的 Gemini 金鑰；MiniMax 粵語語音另需自己的帳戶設定。密鑰留在此瀏覽器的 localStorage，不是加密保管庫。

## 維護及檢查

Python 3 與 Node.js 22 或以上：

```bash
python3 check_syntax.py
python3 scripts/check_project.py
```

後者使用 Node 的真正 JavaScript parser 檢查全部 JS，並沿實際 HTML 入口檢查本地資源及靜態 imports。GitHub Actions 執行同樣檢查；它不代替瀏覽器、語音或裝置驗收。

實際執行入口是 `index.html → app.js`，載入根目錄 `mockData.js`、`geminiService.js` 及 `src/utils/db.js`。其餘 `src/` 大部分屬舊模組化嘗試，沒有從正式入口載入；先核對依賴再修改，整理期間保留原檔。

變更使用工作分支及 PR。產品里程碑仍依 [CLAUDE.md](CLAUDE.md) 與路線圖先提計劃；修改入口程式時必須更新對應 `?v=` 快取標記。正式部署來自 Vercel 的 `main`，合併前後都要核對來源及驗收。

## 資料及授權

訓練請使用虛構／去識別化個案。模型及語音呼叫會把所需內容傳至相應供應商；「本地保存」不等於 AI 請求不離開裝置。JSON 保險箱備份排除 API 密鑰。先備份再清理瀏覽器資料。

目前 repo 為公開且没有 `LICENSE`。本次沒有新增、移除或改變授權；公開可讀不等於已授予開源使用許可。正式授權選擇由擁有人另行決定。
