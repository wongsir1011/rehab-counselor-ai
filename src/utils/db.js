// RehabCounselor AI - IndexedDB Storage Engine (Large-capacity Local Persistence)

const DB_NAME = "RehabCounselorDB";
const DB_VERSION = 1;

// localStorage 來源鍵（遷移後會被刪除以釋放 5MB 配額）
const LS_SESSIONS = "rehab_sessions_history";
const LS_CUSTOM = "rehab_custom_cases";

// app_meta 內的遷移旗標鍵，確保 localStorage → IndexedDB 遷移只跑一次
const MIGRATION_FLAG = "migrated_v1";

// 備份檔識別與版本。v2.1.0 起加入 settings 區塊；匯入時向下相容 2.0.0。
const BACKUP_APP_ID = "RehabCounselor AI";
const BACKUP_VERSION = "2.1.0";

// 可匯出的設定白名單。
// ⚠️ 蓄意排除 rehab_gemini_api_key / rehab_minimax_api_key / rehab_minimax_group_id：
//    備份檔會被下載、轉寄、上傳雲端，絕不可挾帶 API 金鑰（PRD 資料私隱約束）。
const EXPORTABLE_SETTINGS = [
  "rehab_locale",
  "rehab_selected_model",
  "rehab_tts_engine",
  "rehab_selected_voice",
  "rehab_recognition_lang",
  "rehab_speech_muted",
  "rehab_sound_enabled",
  "rehab_minimax_male_timbre",
  "rehab_minimax_female_timbre"
];

// Milestone 8：保險箱錯誤代碼。呼叫端據此分辨「不能用」與「沒有回應」——
// 兩者對同工的意義完全相反：前者資料真的存不進去，後者資料好端端在裡面只是讀不到。
export const VAULT_ERROR = {
  BLOCKED: "VAULT_BLOCKED",     // 其他分頁佔用連線，升級被擋
  TIMEOUT: "VAULT_TIMEOUT",     // 逾時未回應（背景分頁被凍結、資料庫損毀等）
  ABORTED: "VAULT_ABORTED"      // 交易被中止
};

// 開啟連線的硬逾時。設 8 秒是為了同時滿足「不無限等待」與「不誤傷慢速機器」；
// blocked 有專屬事件會立刻回報，不必等滿這段時間。
const OPEN_TIMEOUT_MS = 8000;
// 單筆讀寫的逾時。連線已建立後的操作遠快於開啟，故給較短的界限。
const OP_TIMEOUT_MS = 5000;

const VAULT_ERROR_CODES = new Set(Object.values(VAULT_ERROR));

/** 帶 code 的保險箱錯誤，供呼叫端分流措辭。 */
function vaultError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * 這個錯誤是不是**本模組發出的訊號**（逾時／阻擋／中止）？
 *
 * ⚠️ 不可用 `if (err.code)` 判斷。同儕審查實測：所有 `DOMException` 都帶
 * truthy 的**數字** `.code`（AbortError 20、QuotaExceededError 22、
 * NotFoundError 8、SecurityError 18、InvalidStateError 11），因此真值判斷
 * 會把原生儲存錯誤一併當成本模組訊號往上拋 —— 那條路徑會讓一場已完成、
 * 已評估的面談連同分數整個丟掉（ARCHITECTURE §7 D32）。
 *
 * VAULT_ERROR 的值全是字串、DOMException 的 code 全是數字，故型別已足以
 * 區分；再加白名單，避免日後有人給原生錯誤補上字串 code。
 */
export function isVaultSignal(err) {
  return !!(err && typeof err.code === "string" && VAULT_ERROR_CODES.has(err.code));
}

/**
 * 把任一失敗歸類成同工看得懂的降級原因。
 *
 * 這是**唯一**的分類點。此前 probe() 與 app.js 的 vaultReasonFromError()
 * 各有一套，兩份遲早分岔 —— 而分岔的後果是對同工說錯「你的資料還在不在」。
 *
 * 分類原則：只有在確定「儲存真的不能用」時才說無痕視窗；其餘一律說明
 * 紀錄仍在、只是此刻讀不到。
 */
export function classifyVaultError(err) {
  if (!err) return "error";
  if (err.code === VAULT_ERROR.BLOCKED) return "blocked";
  if (err.code === VAULT_ERROR.TIMEOUT) return "timeout";
  if (err.code === VAULT_ERROR.ABORTED) return "timeout";
  // 資料庫格式比程式新 —— 幾乎必然是快取到舊版程式，紀錄完好無損。
  if (err.name === "VersionError") return "version";
  // 這兩個才是「真的不能用」：無痕視窗、儲存被政策封鎖。
  if (err.name === "SecurityError" || err.name === "InvalidStateError") return "unavailable";
  return "error";
}

/**
 * Milestone 8：把一個 IndexedDB executor 包成**一定會 settle** 的 Promise。
 *
 * 原本 db.js 的每一個 Promise 都只掛 onsuccess/onerror（或 oncomplete/onerror），
 * 沒有逾時、沒有 onblocked、沒有 onabort。實測證實兩條路徑會永遠掛住：
 *   1. 持有舊版連線時開新版 → onblocked 觸發，另外兩者永遠不觸發。
 *   2. 交易被 abort 且無進行中請求 → onabort 觸發，另外兩者永遠不觸發。
 * 掛住的 Promise 會讓 await hydrateVault() 永不返回，首次 switchView() 永不執行，
 * 畫面就停在「加載中...」—— PRD「Degradation Honesty」明文禁止的狀態。
 *
 * 逾時後遲到的結果一律丟棄（settled 旗標），避免兩份互相矛盾的資料同時生效。
 */
function settleWithin(executor, ms, timeoutMessage) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(vaultError(VAULT_ERROR.TIMEOUT, timeoutMessage));
    }, ms);

    const done = (fn) => (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    try {
      executor(done(resolve), done(reject));
    } catch (err) {
      done(reject)(err);
    }
  });
}

export class RehabCounselorDB {
  static db = null;

  static async open() {
    if (this.db) return this.db;

    const db = await settleWithin((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const upgradeDb = e.target.result;

        if (!upgradeDb.objectStoreNames.contains("sessions")) {
          upgradeDb.createObjectStore("sessions", { keyPath: "id" });
        }
        if (!upgradeDb.objectStoreNames.contains("custom_cases")) {
          upgradeDb.createObjectStore("custom_cases", { keyPath: "id" });
        }
        if (!upgradeDb.objectStoreNames.contains("app_meta")) {
          upgradeDb.createObjectStore("app_meta", { keyPath: "key" });
        }
      };

      // ⚠️ 本行是 Milestone 8 的核心修復之一。缺了它，另一個分頁持有舊版連線時
      //    這個 Promise 永遠不會 settle（實測 5 秒無反應且不會自行恢復）。
      request.onblocked = () => {
        reject(vaultError(
          VAULT_ERROR.BLOCKED,
          "另一個分頁正開啟本平台並佔用本機儲存，保險箱無法升級。"
        ));
      };

      request.onsuccess = (e) => resolve(e.target.result);

      request.onerror = (e) => {
        console.error("IndexedDB Open Error:", e.target.error);
        reject(e.target.error);
      };
    }, OPEN_TIMEOUT_MS, "本機儲存在 8 秒內沒有回應。");

    // ⚠️ 同樣是核心修復：本分頁收到版本變更請求時主動讓路並關閉連線。
    //    缺了它，本分頁會永久阻擋其他分頁升級 —— 也就是 onblocked 永遠不解除。
    //    今日 DB_VERSION 固定為 1 不會觸發，但這一行是將來任何一次改 schema
    //    不會弄壞使用者的前提條件。
    db.onversionchange = () => {
      console.warn("[Vault] 其他分頁要求升級保險箱，本分頁主動關閉連線讓路。");
      db.close();
      if (this.db === db) this.db = null;
    };

    // 連線被瀏覽器強制關閉（資料庫刪除、儲存被回收）時清掉快取，
    // 下次呼叫重新開啟，而不是抱著一個已死的 handle 一直失敗。
    db.onclose = () => {
      console.warn("[Vault] 保險箱連線已關閉，下次存取將重新開啟。");
      if (this.db === db) this.db = null;
    };

    this.db = db;
    return this.db;
  }

  static async saveSession(session) {
    try {
      const db = await this.open();
      return await settleWithin((resolve, reject) => {
        const tx = db.transaction("sessions", "readwrite");
        const store = tx.objectStore("sessions");
        const req = store.put(session);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
        tx.onabort = () => reject(vaultError(VAULT_ERROR.ABORTED, "寫入面談紀錄的交易被中止。"));
      }, OP_TIMEOUT_MS, "寫入面談紀錄逾時。");
    } catch (err) {
      // 「沒有回應」絕不可被靜默當成「沒有資料」—— 那會讓同工看到空白歷史
      // 而以為紀錄遺失。逾時／阻擋／中止一律往上拋，由呼叫端決定措辭；
      // 其餘錯誤（配額滿、找不到、中止等原生 DOMException）維持既有的寬容
      // fallback，讓呼叫端以回傳值判斷成敗而不是被例外中斷流程。
      if (isVaultSignal(err)) throw err;
      console.warn("IndexedDB Save Session fallback:", err);
      return false;
    }
  }

  static async getAllSessions() {
    try {
      const db = await this.open();
      return await settleWithin((resolve, reject) => {
        const tx = db.transaction("sessions", "readonly");
        const store = tx.objectStore("sessions");
        const req = store.getAll();
        req.onsuccess = () => {
          const sessions = req.result || [];
          sessions.sort((a, b) => b.id.localeCompare(a.id));
          resolve(sessions);
        };
        req.onerror = (e) => reject(e.target.error);
        tx.onabort = () => reject(vaultError(VAULT_ERROR.ABORTED, "讀取面談紀錄的交易被中止。"));
      }, OP_TIMEOUT_MS, "讀取面談紀錄逾時。");
    } catch (err) {
      // 「沒有回應」絕不可被靜默當成「沒有資料」—— 那會讓同工看到空白歷史
      // 而以為紀錄遺失。逾時／阻擋／中止一律往上拋，由呼叫端決定措辭；
      // 其餘錯誤（配額滿、找不到、中止等原生 DOMException）維持既有的寬容
      // fallback，讓呼叫端以回傳值判斷成敗而不是被例外中斷流程。
      if (isVaultSignal(err)) throw err;
      console.warn("IndexedDB Get Sessions fallback:", err);
      return [];
    }
  }

  static async saveCustomCase(customCase) {
    try {
      const db = await this.open();
      return await settleWithin((resolve, reject) => {
        const tx = db.transaction("custom_cases", "readwrite");
        const store = tx.objectStore("custom_cases");
        const req = store.put(customCase);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
        tx.onabort = () => reject(vaultError(VAULT_ERROR.ABORTED, "寫入自定義個案的交易被中止。"));
      }, OP_TIMEOUT_MS, "寫入自定義個案逾時。");
    } catch (err) {
      // 「沒有回應」絕不可被靜默當成「沒有資料」—— 那會讓同工看到空白歷史
      // 而以為紀錄遺失。逾時／阻擋／中止一律往上拋，由呼叫端決定措辭；
      // 其餘錯誤（配額滿、找不到、中止等原生 DOMException）維持既有的寬容
      // fallback，讓呼叫端以回傳值判斷成敗而不是被例外中斷流程。
      if (isVaultSignal(err)) throw err;
      console.warn("IndexedDB Save Custom Case fallback:", err);
      return false;
    }
  }

  static async getAllCustomCases() {
    try {
      const db = await this.open();
      return await settleWithin((resolve, reject) => {
        const tx = db.transaction("custom_cases", "readonly");
        const store = tx.objectStore("custom_cases");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
        tx.onabort = () => reject(vaultError(VAULT_ERROR.ABORTED, "讀取自定義個案的交易被中止。"));
      }, OP_TIMEOUT_MS, "讀取自定義個案逾時。");
    } catch (err) {
      // 「沒有回應」絕不可被靜默當成「沒有資料」—— 那會讓同工看到空白歷史
      // 而以為紀錄遺失。逾時／阻擋／中止一律往上拋，由呼叫端決定措辭；
      // 其餘錯誤（配額滿、找不到、中止等原生 DOMException）維持既有的寬容
      // fallback，讓呼叫端以回傳值判斷成敗而不是被例外中斷流程。
      if (isVaultSignal(err)) throw err;
      console.warn("IndexedDB Get Custom Cases fallback:", err);
      return [];
    }
  }

  static async clearAll() {
    try {
      const db = await this.open();
      return await settleWithin((resolve, reject) => {
        const tx = db.transaction(["sessions", "custom_cases", "app_meta"], "readwrite");
        tx.objectStore("sessions").clear();
        tx.objectStore("custom_cases").clear();
        tx.objectStore("app_meta").clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
        // ⚠️ 實測證實這一行是必要的：交易被中止時 onabort 觸發，
        //    oncomplete 與 onerror 都不會 —— 危險區重設與備份還原會永遠掛住。
        tx.onabort = () => reject(vaultError(VAULT_ERROR.ABORTED, "清空保險箱的交易被中止。"));
      }, OP_TIMEOUT_MS, "清空保險箱逾時。");
    } catch (err) {
      // 「沒有回應」絕不可被靜默當成「沒有資料」—— 那會讓同工看到空白歷史
      // 而以為紀錄遺失。逾時／阻擋／中止一律往上拋，由呼叫端決定措辭；
      // 其餘錯誤（配額滿、找不到、中止等原生 DOMException）維持既有的寬容
      // fallback，讓呼叫端以回傳值判斷成敗而不是被例外中斷流程。
      if (isVaultSignal(err)) throw err;
      console.warn("IndexedDB Clear All failed:", err);
      return false;
    }
  }

  // ==========================================================================
  // app_meta：內部中繼資料（遷移旗標等）
  // ==========================================================================
  static async setMeta(key, value) {
    try {
      const db = await this.open();
      return await settleWithin((resolve, reject) => {
        const tx = db.transaction("app_meta", "readwrite");
        const req = tx.objectStore("app_meta").put({ key, value });
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
        tx.onabort = () => reject(vaultError(VAULT_ERROR.ABORTED, "寫入中繼資料的交易被中止。"));
      }, OP_TIMEOUT_MS, "寫入中繼資料逾時。");
    } catch (err) {
      // 「沒有回應」絕不可被靜默當成「沒有資料」—— 那會讓同工看到空白歷史
      // 而以為紀錄遺失。逾時／阻擋／中止一律往上拋，由呼叫端決定措辭；
      // 其餘錯誤（配額滿、找不到、中止等原生 DOMException）維持既有的寬容
      // fallback，讓呼叫端以回傳值判斷成敗而不是被例外中斷流程。
      if (isVaultSignal(err)) throw err;
      console.warn("IndexedDB setMeta failed:", err);
      return false;
    }
  }

  static async getMeta(key) {
    try {
      const db = await this.open();
      return await settleWithin((resolve, reject) => {
        const tx = db.transaction("app_meta", "readonly");
        const req = tx.objectStore("app_meta").get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = (e) => reject(e.target.error);
        tx.onabort = () => reject(vaultError(VAULT_ERROR.ABORTED, "讀取中繼資料的交易被中止。"));
      }, OP_TIMEOUT_MS, "讀取中繼資料逾時。");
    } catch (err) {
      // 「沒有回應」絕不可被靜默當成「沒有資料」—— 那會讓同工看到空白歷史
      // 而以為紀錄遺失。逾時／阻擋／中止一律往上拋，由呼叫端決定措辭；
      // 其餘錯誤（配額滿、找不到、中止等原生 DOMException）維持既有的寬容
      // fallback，讓呼叫端以回傳值判斷成敗而不是被例外中斷流程。
      if (isVaultSignal(err)) throw err;
      console.warn("IndexedDB getMeta failed:", err);
      return null;
    }
  }

  /** 探測 IndexedDB 是否真的可用（Safari 無痕模式會整個拋錯）。 */
  static async probe() {
    try {
      await this.open();
      return { available: true, reason: null, message: null };
    } catch (err) {
      // 回報**為什麼**打不開，不只是「打不開」。分類集中在 classifyVaultError()，
      // 與 app.js 共用同一份判定。
      return {
        available: false,
        reason: classifyVaultError(err),
        message: (err && err.message) || String(err)
      };
    }
  }

  /** 保險箱用量統計，供設定頁顯示。 */
  static async getStats() {
    const [sessions, customCases] = await Promise.all([
      this.getAllSessions(),
      this.getAllCustomCases()
    ]);
    return { sessionCount: sessions.length, customCaseCount: customCases.length };
  }

  // ==========================================================================
  // localStorage → IndexedDB 單向遷移（冪等、先驗證後刪除）
  // ==========================================================================
  static async migrateFromLocalStorage() {
    // 每次開機都檢查 localStorage 是否有待吸收的資料，而非「遷移過就永不再看」。
    // 原因：IndexedDB 暫時不可用時，app 會降級把新紀錄寫進 localStorage；
    // 若這裡只認旗標，那些紀錄會在 IndexedDB 恢復後被永久遺留。
    // 吸收動作本身是冪等的（以 id 為 keyPath 覆寫），重複執行安全。
    const readArray = (lsKey) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(lsKey) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn(`遷移：${lsKey} JSON 解析失敗，視為空陣列。`, e);
        return [];
      }
    };

    // 缺 id 的舊紀錄補發一個，否則 keyPath 寫入會失敗而靜默丟資料。
    const withId = (item, prefix, index) => {
      if (item && typeof item === "object" && !item.id) {
        item.id = `${prefix}_migrated_${Date.now()}_${index}`;
      }
      return item;
    };

    const lsSessions = readArray(LS_SESSIONS).map((s, i) => withId(s, "session", i)).filter(Boolean);
    const lsCustom = readArray(LS_CUSTOM).map((c, i) => withId(c, "case", i)).filter(Boolean);

    if (lsSessions.length === 0 && lsCustom.length === 0) {
      const flag = await this.getMeta(MIGRATION_FLAG);
      if (!flag || !flag.done) {
        await this.setMeta(MIGRATION_FLAG, { done: true, at: new Date().toISOString(), sessions: 0, customCases: 0 });
      }
      return { migrated: false, reason: "empty" };
    }

    // 1. 寫入 IndexedDB。saveSession/saveCustomCase 失敗時回傳 false，必須攔截，
    //    否則會在資料尚未落地的情況下往下走到刪除 localStorage 那一步。
    for (const s of lsSessions) {
      const ok = await this.saveSession(s);
      if (!ok) throw new Error(`遷移中斷：面談紀錄 ${s.id} 寫入 IndexedDB 失敗，已保留 localStorage 原始資料。`);
    }
    for (const c of lsCustom) {
      const ok = await this.saveCustomCase(c);
      if (!ok) throw new Error(`遷移中斷：自定義個案 ${c.id} 寫入 IndexedDB 失敗，已保留 localStorage 原始資料。`);
    }

    // 2. 讀回驗證：來源每一筆 id 都必須在 IndexedDB 找得到，才允許刪除來源。
    const [afterSessions, afterCases] = await Promise.all([
      this.getAllSessions(),
      this.getAllCustomCases()
    ]);
    const sessionIds = new Set(afterSessions.map((s) => s.id));
    const caseIds = new Set(afterCases.map((c) => c.id));
    const missingSessions = lsSessions.filter((s) => !sessionIds.has(s.id));
    const missingCases = lsCustom.filter((c) => !caseIds.has(c.id));

    if (missingSessions.length > 0 || missingCases.length > 0) {
      throw new Error(
        `遷移驗證失敗：${missingSessions.length} 筆面談紀錄、${missingCases.length} 個自定義個案未能寫入 IndexedDB。` +
        `localStorage 原始資料已保留，未執行刪除。`
      );
    }

    // 3. 驗證通過才刪除 localStorage 副本 —— 這一步才真正釋放 5MB 配額，
    //    ADR-0005 要解決的容量問題若少了它就等於沒做。
    localStorage.removeItem(LS_SESSIONS);
    localStorage.removeItem(LS_CUSTOM);

    await this.setMeta(MIGRATION_FLAG, {
      done: true,
      at: new Date().toISOString(),
      sessions: lsSessions.length,
      customCases: lsCustom.length
    });

    return { migrated: true, sessions: lsSessions.length, customCases: lsCustom.length };
  }

  // ==========================================================================
  // 全量 JSON 備份 / 還原
  // ==========================================================================
  static async exportFullBackupJSON() {
    const [sessions, customCases] = await Promise.all([
      this.getAllSessions(),
      this.getAllCustomCases()
    ]);
    return this.buildBackupJSON(sessions, customCases);
  }

  /**
   * 由給定的資料組裝備份 JSON。
   * 獨立成一支，讓 IndexedDB 不可用的降級模式能改由記憶體副本組裝，
   * 而不會靜默匯出一份空白備份。
   */
  static buildBackupJSON(sessions, customCases) {
    const readJSON = (key, fallback) => {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    };

    const rawTheoryProgress = localStorage.getItem("rehab_theory_progress");

    const settings = {};
    for (const key of EXPORTABLE_SETTINGS) {
      const val = localStorage.getItem(key);
      if (val !== null) settings[key] = val;
    }

    const backupPayload = {
      version: BACKUP_VERSION,
      app: BACKUP_APP_ID,
      exportedAt: new Date().toISOString(),
      data: {
        userName: localStorage.getItem("rehab_user_name") || "",
        // Milestone 7 / D7：完成場次不再有 localStorage 副本。欄位名與格式維持不變
        // （舊備份仍可還原），但值改由 sessions 推導 —— 備份檔內部因此永遠自洽。
        completedCount: sessions.length,
        completedIds: [...new Set(sessions.map(s => s && s.caseId).filter(Boolean))],
        achievements: readJSON("rehab_unlocked_achievements", []),
        // ⚠️ 鍵不存在時**不輸出此欄位**（undefined），而不是寫入 {}。
        //    舊版以 {} 為預設，還原後 state.theoryProgress.act 成為 undefined，
        //    儀表板與分析頁存取 .act.info 即拋錯、畫面空白（ARCHITECTURE §7 D33）。
        //    importFullBackupJSON() 既有的 `!== undefined` 條件因此會正確跳過。
        theoryProgress: rawTheoryProgress === null ? undefined : readJSON("rehab_theory_progress", undefined),
        settings,
        customCases,
        sessions
      }
    };

    return JSON.stringify(backupPayload, null, 2);
  }

  static async importFullBackupJSON(jsonString) {
    let payload = null;
    try {
      payload = JSON.parse(jsonString);
    } catch (e) {
      throw new Error("備份檔案 JSON 語法無效，無法解析。");
    }

    if (!payload || payload.app !== BACKUP_APP_ID || !payload.data) {
      throw new Error("無效的 RehabCounselor AI 備份檔案格式。");
    }

    const { data } = payload;
    const sessions = Array.isArray(data.sessions) ? data.sessions.filter((s) => s && s.id) : [];
    const customCases = Array.isArray(data.customCases) ? data.customCases.filter((c) => c && c.id) : [];

    // 先完整驗證再動手清空，避免格式有問題時已把現有資料清掉。
    if (data.sessions !== undefined && !Array.isArray(data.sessions)) {
      throw new Error("備份檔案損毀：sessions 欄位不是陣列。");
    }
    if (data.customCases !== undefined && !Array.isArray(data.customCases)) {
      throw new Error("備份檔案損毀：customCases 欄位不是陣列。");
    }

    // 覆蓋式還原：先清空保險箱，確保還原後的狀態與備份檔完全一致。
    await this.clearAll();

    for (const s of sessions) {
      const ok = await this.saveSession(s);
      if (!ok) throw new Error(`還原中斷：面談紀錄 ${s.id} 寫入失敗。`);
    }
    for (const c of customCases) {
      const ok = await this.saveCustomCase(c);
      if (!ok) throw new Error(`還原中斷：自定義個案 ${c.id} 寫入失敗。`);
    }

    // 小型進度/設定仍留在 localStorage（見 ARCHITECTURE §5 資料分層）。
    // 注意：大宗資料絕不寫回 localStorage，否則配額問題會原封不動搬回來。
    if (data.userName !== undefined) localStorage.setItem("rehab_user_name", data.userName);
    // Milestone 7 / D7：completedCount 與 completedIds 現為衍生值，還原時刻意忽略。
    // 寫回去只會重建一份與 sessions 可能矛盾的副本 —— 那正是 D7 的成因。
    if (data.achievements !== undefined) localStorage.setItem("rehab_unlocked_achievements", JSON.stringify(data.achievements));
    if (data.theoryProgress !== undefined) localStorage.setItem("rehab_theory_progress", JSON.stringify(data.theoryProgress));

    if (data.settings && typeof data.settings === "object") {
      for (const key of EXPORTABLE_SETTINGS) {
        if (typeof data.settings[key] === "string") localStorage.setItem(key, data.settings[key]);
      }
    }

    // 還原完成後保險箱即為權威，標記遷移已完成，避免下次開機又去撈舊的 localStorage。
    await this.setMeta(MIGRATION_FLAG, {
      done: true,
      at: new Date().toISOString(),
      restoredFrom: payload.exportedAt || "unknown"
    });

    return { sessions: sessions.length, customCases: customCases.length };
  }
}
