// RehabCounselor AI - Core State & Persistence Module

import { MOCK_CASES, MOCK_ACHIEVEMENTS, TRANSLATIONS } from "../data/mockData.js";
import { RehabCounselorDB } from "../utils/db.js";

/**
 * 清理並校正個案頭像 (確保為單個 Emoji，移除任何 URL 網址溢出)
 */
export function sanitizeCaseAvatar(c) {
  if (!c) return c;
  if (!c.avatar || typeof c.avatar !== "string" || c.avatar.startsWith("http://") || c.avatar.startsWith("https://") || c.avatar.startsWith("/") || c.avatar.includes(".com") || c.avatar.includes(".png") || c.avatar.includes(".jpg") || c.avatar.includes("avatar/") || c.avatar.length > 8) {
    const isFemale = c.gender === "女" || c.gender === "Female" || (c.gender && c.gender.includes("女"));
    const isSenior = c.age && c.age >= 50;
    c.avatar = isFemale ? (isSenior ? "👵" : "👩") : (isSenior ? "👴" : "👨");
  }
  return c;
}

export const state = {
  activeView: "dashboard",
  theme: "dark",
  apiKey: localStorage.getItem("rehab_gemini_api_key") || "",
  selectedModel: localStorage.getItem("rehab_selected_model") || "gemini-2.5-flash",
  userName: localStorage.getItem("rehab_user_name") || "",
  cases: (() => {
    const localCustom = localStorage.getItem("rehab_custom_cases");
    if (localCustom) {
      try {
        const parsed = JSON.parse(localCustom);
        const sanitized = Array.isArray(parsed) ? parsed.map(sanitizeCaseAvatar) : [];
        // Write back sanitized list to prevent future url overflows
        try { localStorage.setItem("rehab_custom_cases", JSON.stringify(sanitized)); } catch (e) {}
        return [...sanitized, ...MOCK_CASES.map(sanitizeCaseAvatar)];
      } catch (e) {
        return [...MOCK_CASES.map(sanitizeCaseAvatar)];
      }
    }
    return [...MOCK_CASES.map(sanitizeCaseAvatar)];
  })(),
  activeCase: null,
  activeSession: null,
  miGameScore: 0,
  miGameIndex: 0,
  activeTheoryTab: "act",
  activeTheorySubTab: "info",
  activeHexaNode: "acceptance",
  voices: [],
  selectedVoiceName: localStorage.getItem("rehab_selected_voice") || "",
  ttsEngine: localStorage.getItem("rehab_tts_engine") || "system", // "system", "minimax-global", "minimax-cn"
  minimaxApiKey: localStorage.getItem("rehab_minimax_api_key") || "",
  minimaxGroupId: localStorage.getItem("rehab_minimax_group_id") || "",
  minimaxMaleTimbre: localStorage.getItem("rehab_minimax_male_timbre") || "cantonese_male",
  minimaxFemaleTimbre: localStorage.getItem("rehab_minimax_female_timbre") || "cantonese_female",
  activeAudioElement: null,
  quoteIntervalId: null,
  mysteryTimeoutId: null,
  activeUtterance: null,
  
  unlockedAchievements: JSON.parse(localStorage.getItem("rehab_unlocked_achievements")) || [],
  completedCasesCount: parseInt(localStorage.getItem("rehab_completed_cases_count")) || 0,
  completedCaseIds: JSON.parse(localStorage.getItem("rehab_completed_case_ids")) || [],
  isRecording: false,
  recognition: null,
  recognitionLang: localStorage.getItem("rehab_recognition_lang") || (() => {
    const ua = navigator.userAgent.toLowerCase();
    const isSafari = ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium") && !ua.includes("android");
    return isSafari ? "zh-Hant-HK" : "yue-Hant-HK";
  })(),
  locale: localStorage.getItem("rehab_locale") || "zh-HK",
  isSpeechMuted: localStorage.getItem("rehab_speech_muted") === "true",
  soundEnabled: localStorage.getItem("rehab_sound_enabled") !== "false",
  speechUtteranceRefs: new Set(),
  theoryProgress: (() => {
    const local = localStorage.getItem("rehab_theory_progress");
    if (local) {
      try { return JSON.parse(local); } catch (e) {}
    }
    return {
      act: { info: false, flashcards: false, test: false },
      mi: { info: false, flashcards: false, test: false },
      icf: { info: false, flashcards: false, test: false }
    };
  })()
};

/**
 * 初始化本地 IndexedDB 持久化資料庫與資料搬遷
 */
export async function initPersistenceDB() {
  try {
    await RehabCounselorDB.migrateFromLocalStorage();
    const customCases = await RehabCounselorDB.getAllCustomCases();
    if (customCases.length > 0) {
      const sanitizedCustom = customCases.map(sanitizeCaseAvatar);
      state.cases = [...sanitizedCustom, ...MOCK_CASES.filter(mc => !sanitizedCustom.some(cc => cc.id === mc.id)).map(sanitizeCaseAvatar)];
    }
  } catch (err) {
    console.warn("initPersistenceDB warning:", err);
  }
}

/**
 * 國際化語系字串翻譯輔助函式
 */
export function t(key) {
  const currentLangDict = TRANSLATIONS[state.locale] || TRANSLATIONS["zh-HK"];
  const fallbackDict = TRANSLATIONS["zh-HK"];
  return currentLangDict[key] || fallbackDict[key] || key;
}

/**
 * 持久化理論學習進度
 */
export function saveTheoryProgress() {
  try {
    localStorage.setItem("rehab_theory_progress", JSON.stringify(state.theoryProgress));
  } catch (e) {
    console.warn("Failed to save theory progress:", e);
  }
}

/**
 * 檢查與解鎖成就
 */
export function checkAndUnlockAchievements(achId, showToastFn = null, triggerConfettiFn = null) {
  if (!state.unlockedAchievements.includes(achId)) {
    state.unlockedAchievements.push(achId);
    try {
      localStorage.setItem("rehab_unlocked_achievements", JSON.stringify(state.unlockedAchievements));
    } catch (e) {
      console.warn("Failed to save achievements:", e);
    }
    const ach = MOCK_ACHIEVEMENTS.find(a => a.id === achId);
    if (ach) {
      if (typeof showToastFn === "function") {
        showToastFn(ach);
      }
      if (typeof triggerConfettiFn === "function") {
        triggerConfettiFn();
      }
    }
  }
}
