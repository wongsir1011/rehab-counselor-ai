// RehabCounselor AI - IndexedDB Storage Engine (Large-capacity Local Persistence)

const DB_NAME = "RehabCounselorDB";
const DB_VERSION = 1;

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

  static async migrateFromLocalStorage() {
    try {
      const lsSessions = JSON.parse(localStorage.getItem("rehab_sessions_history") || "[]");
      if (lsSessions.length > 0) {
        for (const s of lsSessions) {
          await this.saveSession(s);
        }
      }

      const lsCustom = JSON.parse(localStorage.getItem("rehab_custom_cases") || "[]");
      if (lsCustom.length > 0) {
        for (const c of lsCustom) {
          await this.saveCustomCase(c);
        }
      }
    } catch (err) {
      console.warn("LocalStorage to IndexedDB migration error:", err);
    }
  }

  static async exportFullBackupJSON() {
    const sessions = await this.getAllSessions();
    const customCases = await this.getAllCustomCases();
    
    const achievements = JSON.parse(localStorage.getItem("rehab_unlocked_achievements") || "[]");
    const theoryProgress = JSON.parse(localStorage.getItem("rehab_theory_progress") || "{}");
    const userName = localStorage.getItem("rehab_user_name") || "";
    const completedCount = localStorage.getItem("rehab_completed_cases_count") || "0";
    const completedIds = JSON.parse(localStorage.getItem("rehab_completed_case_ids") || "[]");

    const backupPayload = {
      version: "2.0.0",
      app: "RehabCounselor AI",
      exportedAt: new Date().toISOString(),
      data: {
        userName,
        completedCount: parseInt(completedCount, 10),
        completedIds,
        achievements,
        theoryProgress,
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

    if (!payload || payload.app !== "RehabCounselor AI" || !payload.data) {
      throw new Error("無效的 RehabCounselor AI 備份檔案格式。");
    }

    const { data } = payload;

    if (data.userName !== undefined) localStorage.setItem("rehab_user_name", data.userName);
    if (data.completedCount !== undefined) localStorage.setItem("rehab_completed_cases_count", data.completedCount);
    if (data.completedIds !== undefined) localStorage.setItem("rehab_completed_case_ids", JSON.stringify(data.completedIds));
    if (data.achievements !== undefined) localStorage.setItem("rehab_unlocked_achievements", JSON.stringify(data.achievements));
    if (data.theoryProgress !== undefined) localStorage.setItem("rehab_theory_progress", JSON.stringify(data.theoryProgress));

    if (Array.isArray(data.sessions)) {
      localStorage.setItem("rehab_sessions_history", JSON.stringify(data.sessions));
      for (const s of data.sessions) {
        await this.saveSession(s);
      }
    }

    if (Array.isArray(data.customCases)) {
      localStorage.setItem("rehab_custom_cases", JSON.stringify(data.customCases));
      for (const c of data.customCases) {
        await this.saveCustomCase(c);
      }
    }

    return true;
  }
}
