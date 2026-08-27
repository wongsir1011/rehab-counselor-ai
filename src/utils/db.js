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

export class RehabCounselorDB {
  static db = null;

  static async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains("sessions")) {
          db.createObjectStore("sessions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("custom_cases")) {
          db.createObjectStore("custom_cases", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("app_meta")) {
          db.createObjectStore("app_meta", { keyPath: "key" });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error("IndexedDB Open Error:", e.target.error);
        reject(e.target.error);
      };
    });
  }

  static async saveSession(session) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("sessions", "readwrite");
        const store = tx.objectStore("sessions");
        const req = store.put(session);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn("IndexedDB Save Session fallback:", err);
      return false;
    }
  }

  static async getAllSessions() {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("sessions", "readonly");
        const store = tx.objectStore("sessions");
        const req = store.getAll();
        req.onsuccess = () => {
          const sessions = req.result || [];
          sessions.sort((a, b) => b.id.localeCompare(a.id));
          resolve(sessions);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn("IndexedDB Get Sessions fallback:", err);
      return [];
    }
  }

  static async saveCustomCase(customCase) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("custom_cases", "readwrite");
        const store = tx.objectStore("custom_cases");
        const req = store.put(customCase);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn("IndexedDB Save Custom Case fallback:", err);
      return false;
    }
  }

  static async getAllCustomCases() {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("custom_cases", "readonly");
        const store = tx.objectStore("custom_cases");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn("IndexedDB Get Custom Cases fallback:", err);
      return [];
    }
  }

  static async clearAll() {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(["sessions", "custom_cases", "app_meta"], "readwrite");
        tx.objectStore("sessions").clear();
        tx.objectStore("custom_cases").clear();
        tx.objectStore("app_meta").clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
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
      return new Promise((resolve, reject) => {
        const tx = db.transaction("app_meta", "readwrite");
        const req = tx.objectStore("app_meta").put({ key, value });
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn("IndexedDB setMeta failed:", err);
      return false;
    }
  }

  static async getMeta(key) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("app_meta", "readonly");
        const req = tx.objectStore("app_meta").get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn("IndexedDB getMeta failed:", err);
      return null;
    }
  }

  /** 探測 IndexedDB 是否真的可用（Safari 無痕模式會整個拋錯）。 */
  static async probe() {
    try {
      await this.open();
      return true;
    } catch (err) {
      return false;
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
        completedCount: parseInt(localStorage.getItem("rehab_completed_cases_count") || "0", 10) || 0,
        completedIds: readJSON("rehab_completed_case_ids", []),
        achievements: readJSON("rehab_unlocked_achievements", []),
        theoryProgress: readJSON("rehab_theory_progress", {}),
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
    if (data.completedCount !== undefined) localStorage.setItem("rehab_completed_cases_count", data.completedCount);
    if (data.completedIds !== undefined) localStorage.setItem("rehab_completed_case_ids", JSON.stringify(data.completedIds));
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
