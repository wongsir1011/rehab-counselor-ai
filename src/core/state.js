// RehabCounselor AI - Core State & Persistence Module

import { MOCK_CASES, MOCK_ACHIEVEMENTS, TRANSLATIONS } from "../../mockData.js";

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
        return [...parsed, ...MOCK_CASES];
      } catch (e) {
        return [...MOCK_CASES];
      }
    }
    return [...MOCK_CASES];
  })(),
  activeCase: null,
  activeSession: null, // { history: [], notes: { soap: "", icf: "" }, report: null }
  miGameScore: 0,
  miGameIndex: 0,
  activeTheoryTab: "act",
  activeTheorySubTab: "info", // "info", "flashcards", "test"
  activeHexaNode: "acceptance",
  voices: [],
  selectedVoiceName: localStorage.getItem("rehab_selected_voice") || "",
  quoteIntervalId: null,   // 追蹤激勵金句定時器
  mysteryTimeoutId: null,   // 追蹤盲盒轉場定時器
  activeUtterance: null,   // 追蹤當前活動朗讀實體
  
  // Phase 4: Local Storage and STT State
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
