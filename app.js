// RehabCounselor AI - 主應用控制器 (Vanilla SPA Engine)

import { MOCK_THEORY_DATA, MOCK_CASES, MOCK_CO_LEARNING_CASES, MOCK_MOTIVATIONAL_QUOTES, MOCK_ACHIEVEMENTS, TRANSLATIONS } from "./mockData.js?v=20260829_v24_m7";
import { generateClientReply, generateCustomCase, generateSessionReport, generateCustomQuiz, generateSoapSuggestions, getScriptedFlow } from "./geminiService.js?v=20260828_v23_m6b";
import { RehabCounselorDB, classifyVaultError } from "./src/utils/db.js?v=20260831_v26_m8fix";

// Global App State
const state = {
  activeView: "dashboard",
  theme: "dark",
  apiKey: localStorage.getItem("rehab_gemini_api_key") || "",
  selectedModel: localStorage.getItem("rehab_selected_model") || "gemini-2.5-flash",
  userName: localStorage.getItem("rehab_user_name") || "",
  // ADR-0005：自定義個案改由 IndexedDB 保險箱提供，於 hydrateVault() 於開機時非同步注入。
  // 此處僅同步載入內建個案，讓 module 頂層初始化維持同步。
  cases: [...MOCK_CASES],
  // 面談歷史的記憶體權威副本。IndexedDB 是持久層，此陣列供所有同步渲染函式讀取，
  // 讓 6000+ 行既有渲染碼不必改成 async。
  historySessions: [],
  vaultMode: "indexeddb", // "indexeddb" | "localstorage-fallback"
  // Milestone 8：目前模式的**成因**。null 代表正常。
  // "unavailable" = 真的用不了（無痕模式等）；"blocked" = 其他分頁佔用；
  // "timeout" = 沒有回應；"error" = 讀取出錯。
  // 分開記錄的理由：後三者的紀錄其實還在保險箱裡，若與 "unavailable" 共用一句
  // 「不可用」，同工會合理地以為資料沒了 —— 那是本平台最不該給的錯誤印象。
  vaultDegradedReason: null,
  vaultReady: false,
  activeCase: null,
  activeSession: null, // { history: [], notes: { soap: "", icf: "" }, report: null }
  miGameScore: 0,
  miGameIndex: 0,
  activeTheoryTab: "act",
  activeTheorySubTab: "info", // "info", "flashcards", "test"
  activeHexaNode: "acceptance",
  voices: [],
  selectedVoiceName: localStorage.getItem("rehab_selected_voice") || "",
  ttsEngine: localStorage.getItem("rehab_tts_engine") || "system", // "system", "minimax-global", "minimax-cn"
  minimaxApiKey: localStorage.getItem("rehab_minimax_api_key") || "",
  minimaxGroupId: localStorage.getItem("rehab_minimax_group_id") || "",
  minimaxMaleTimbre: localStorage.getItem("rehab_minimax_male_timbre") || "cantonese_male",
  minimaxFemaleTimbre: localStorage.getItem("rehab_minimax_female_timbre") || "cantonese_female",
  activeAudioElement: null,
  quoteIntervalId: null,   // 追蹤激勵金句定時器
  mysteryTimeoutId: null,   // 追蹤盲盒轉場定時器
  // Phase 4: Local Storage and STT State
  unlockedAchievements: JSON.parse(localStorage.getItem("rehab_unlocked_achievements")) || [],
  // Milestone 7 §3.7：對帳收回的徽章數；>0 時徽章牆顯示一次說明。非持久狀態。
  achievementsReconciledCount: 0,
  // Milestone 7 / D7：completedCasesCount 與 completedCaseIds 已移除。
  // 兩者是 sessions object store 的平行副本，違反 SSOT；前者零讀取點，後者
  // 唯一讀取點（實戰特工徽章）改用 computeCounselorRecord().distinctCaseIds。
  isRecording: false,
  recognition: null,
  recognitionLang: localStorage.getItem("rehab_recognition_lang") || (() => {
    const ua = navigator.userAgent.toLowerCase();
    const isSafari = ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium") && !ua.includes("android");
    // Safari 使用 Apple 本地語音引擎，zh-Hant-HK 即可完美識別廣東話。
    // Chrome 使用 Google 雲端語音引擎，zh-HK 容易被 Google 賬號偏好覆寫為普通話；
    // 改用 yue-Hant-HK 明確指定粵語聲學模型，大幅改善 Chrome 廣東話識別準確度。
    return isSafari ? "zh-Hant-HK" : "yue-Hant-HK";
  })(),
  locale: localStorage.getItem("rehab_locale") || "zh-HK",
  isSpeechMuted: localStorage.getItem("rehab_speech_muted") === "true",
  soundEnabled: localStorage.getItem("rehab_sound_enabled") !== "false",
  speechUtteranceRefs: new Set(),
  theoryProgress: (() => {
    const local = localStorage.getItem("rehab_theory_progress");
    let parsed = null;
    if (local) {
      try { parsed = JSON.parse(local); } catch (e) { parsed = null; }
    }
    // 一律經過正規化 —— 舊版在此直接回傳解析結果，"{}" 就這樣進了 state。
    return normalizeTheoryProgress(parsed);
  })()
};

/**
 * theoryProgress 的形狀正規化。
 *
 * 此前 state 初始化與 refreshStateFromLocalStorage() 各自帶一份完整預設，
 * 但兩者都只在**鍵不存在**時才套用 —— 存著 "{}" 或殘缺物件時原樣回傳，
 * 於是 state.theoryProgress.act 成為 undefined，儀表板與分析頁存取
 * .act.info 立刻拋錯、整頁空白（ARCHITECTURE §7 D33）。
 *
 * ⚠️ 這是**補齊，不是重置**：既有的 true 一律保留，只補上缺失的鍵。
 */
function normalizeTheoryProgress(raw) {
  // ⚠️ 模組與步驟清單刻意放在函式**內部**：state 物件的初始化會呼叫本函式，
  //    而 state 在檔案中的位置早於此處。函式宣告會 hoist，`const` 不會 ——
  //    放在外層會踩到 TDZ，整個模組載入即失敗（建置時實際發生過）。
  const modules = ["act", "mi", "icf"];
  const steps = ["info", "flashcards", "test"];
  const src = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
  const out = {};
  for (const m of modules) {
    const mod = (src[m] && typeof src[m] === "object") ? src[m] : {};
    out[m] = {};
    for (const step of steps) out[m][step] = !!mod[step];
  }
  return out;
}

// Web Audio API Synth Sound System
const AudioSynth = {
  ctx: null,
  initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  },
  playClick() {
    if (!state.soundEnabled) return;
    try {
      this.initContext();
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.warn("Web Audio click sound failed:", e);
    }
  },
  playSuccess() {
    if (!state.soundEnabled) return;
    try {
      this.initContext();
      const ctx = this.ctx;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, index) => {
        const timeOffset = index * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + timeOffset);
        gain.gain.setValueAtTime(0.06, ctx.currentTime + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + timeOffset);
        osc.stop(ctx.currentTime + timeOffset + 0.25);
      });
    } catch (e) {
      console.warn("Web Audio success sound failed:", e);
    }
  },
  playError() {
    if (!state.soundEnabled) return;
    try {
      this.initContext();
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Web Audio error sound failed:", e);
    }
  },
  playUnlock() {
    if (!state.soundEnabled) return;
    try {
      this.initContext();
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch (e) {
      console.warn("Web Audio unlock sound failed:", e);
    }
  },
  playWarning() {
    if (!state.soundEnabled) return;
    try {
      this.initContext();
      const ctx = this.ctx;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = "sawtooth";
      osc2.type = "sawtooth";
      osc1.frequency.setValueAtTime(150, ctx.currentTime);
      osc2.frequency.setValueAtTime(153, ctx.currentTime); // detune effect
      osc1.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.65);
      osc2.frequency.linearRampToValueAtTime(82, ctx.currentTime + 0.65);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.65);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.65);
      osc2.stop(ctx.currentTime + 0.65);
    } catch (e) {
      console.warn("Web Audio warning sound failed:", e);
    }
  },
  playSigh() {
    if (!state.soundEnabled) return;
    try {
      this.initContext();
      const ctx = this.ctx;
      const bufferSize = ctx.sampleRate * 0.35; // 0.35s sigh
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(350, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.35);
      filter.Q.setValueAtTime(1.0, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.08); // fade in
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35); // fade out
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Web Audio playSigh failed:", e);
    }
  }
};

// Zero-Latency Translation engine helper
function t(key) {
  if (TRANSLATIONS && TRANSLATIONS[state.locale] && TRANSLATIONS[state.locale][key]) {
    return TRANSLATIONS[state.locale][key];
  }
  if (TRANSLATIONS && TRANSLATIONS["zh-HK"] && TRANSLATIONS["zh-HK"][key]) {
    return TRANSLATIONS["zh-HK"][key];
  }
  return key;
}

function saveTheoryProgress() {
  // 寫出前正規化：讓 localStorage 內的殘缺值逐次自我修復，
  // 而不是把殘缺形狀一直傳下去。
  state.theoryProgress = normalizeTheoryProgress(state.theoryProgress);
  localStorage.setItem("rehab_theory_progress", JSON.stringify(state.theoryProgress));
}

function updateStaticUIStrings() {
  const sidebarItems = document.querySelectorAll(".nav-links .nav-item[data-target]");
  sidebarItems.forEach(item => {
    const target = item.getAttribute("data-target");
    let iconClass = "";
    if (target === "dashboard") iconClass = "fa-gauge-high";
    else if (target === "theory") iconClass = "fa-book-open";
    else if (target === "arena") iconClass = "fa-user-ninja";
    else if (target === "co-learning") iconClass = "fa-people-group";
    else if (target === "analytics") iconClass = "fa-chart-line";
    item.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${t(target)}`;
  });
  
  const settingsItem = document.querySelector(".nav-footer .nav-item[data-target='settings']");
  if (settingsItem) {
    settingsItem.innerHTML = `<i class="fa-solid fa-sliders"></i> ${t("settings")}`;
  }

  const logoTextPara = document.querySelector(".logo-text p");
  if (logoTextPara) {
    logoTextPara.textContent = state.locale === "en" ? "Vocational Rehab Platform" : state.locale === "zh-CN" ? "复康培训平台" : "復康培訓平台";
  }

  const namePara = document.querySelector(".user-info .name");
  const rolePara = document.querySelector(".user-info .role");
  if (namePara) {
    const baseName = state.locale === "en" ? "Vocational Rehab Staff" : "職業復康同工";
    if (state.userName) {
      namePara.textContent = `${baseName} (${state.userName})`;
    } else {
      namePara.textContent = baseName;
    }
  }
  if (rolePara) rolePara.textContent = state.locale === "en" ? "HKSR Centre" : "香港復康會中心";

  updateApiBadge();
}

function initLocaleAndSound() {
  const localeButtons = document.querySelectorAll(".locale-btn");
  localeButtons.forEach(btn => {
    const btnLocale = btn.getAttribute("data-locale");
    if (btnLocale === state.locale) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
    
    btn.addEventListener("click", () => {
      state.locale = btnLocale;
      localStorage.setItem("rehab_locale", btnLocale);
      localeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      AudioSynth.playClick();
      updateStaticUIStrings();
      // Milestone 8：這是**重繪**不是離開（同一個 view），不得被未完成面談守衛攔下。
      switchView(state.activeView, { skipUnsavedGuard: true });
    });
  });

  const soundToggleBtn = document.getElementById("sound-toggle-btn");
  if (soundToggleBtn) {
    if (state.soundEnabled) {
      soundToggleBtn.classList.add("active");
    } else {
      soundToggleBtn.classList.remove("active");
    }
    
    soundToggleBtn.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem("rehab_sound_enabled", state.soundEnabled);
      if (state.soundEnabled) {
        soundToggleBtn.classList.add("active");
        AudioSynth.playClick();
      } else {
        soundToggleBtn.classList.remove("active");
      }
    });
  }
}

// Application Entry Point
/* ==========================================================================
   ADR-0005: 本地保險箱 (IndexedDB Vault)
   ==========================================================================
   分層策略：
     - 會持續長大的資料（面談歷史、自定義個案）→ IndexedDB，不受 5MB 配額限制。
     - 小型設定/進度（金鑰、語音設定、成就、理論進度）→ 留在 localStorage，
       合計僅數 KB，搬遷只會令每個讀取點被迫 await，毫無收益。
   同步性策略：
     開機時一次性把保險箱讀入 state.historySessions / state.cases，
     之後所有渲染函式維持同步讀取記憶體，寫入時才 await 落盤。
   ========================================================================== */

// 內建個案 id。自定義個案 = state.cases 扣除這些。
// 註：舊版此處硬編碼為 ["case_01".."case_04"]，遺漏了後來新增的三個內建個案，
// 導致它們被誤當自定義個案存入保險箱，開機後與 MOCK_CASES 重複出現兩次。
const BUILTIN_CASE_IDS = new Set(MOCK_CASES.map(c => c.id));

/**
 * 這場面談是否帶有 AI 臨床評估。
 * 離線示範模式沒有 AI，因此沒有評估（`report === null`）；PRD v3 不容許以罐頭
 * 評分充數。所有讀取評分的地方共用此述詞，避免出現多套判斷。
 */
function hasEvaluation(session) {
  return !!(session && session.report && session.report.scores);
}

/**
 * Milestone 7：關於同工能力的每一個衍生數字的**單一推導點**。
 *
 * PRD v4「No Claim Without Evidence」要求每個數字都算自同工自己的紀錄，
 * 「SSOT」要求衍生值（場次、完成統計、雷達彙總、進度徽章）在**一處**計算。
 * 儀表板、分析頁、趨勢圖、徽章判定全部讀這支的輸出，不各自加總。
 *
 * ⚠️ `radar` 與 `radarAverage` 在零筆已評估面談時是 **null，不是 0**。
 * 這是結構性防呆：D20 的成因正是「沒有評估」被寫成 0 之後，靜默流進座標
 * 公式畫出一個收縮到圓心的五邊形 —— 讀起來是「這場拿了 0 分」。null 進入
 * 同一條公式會立刻壞掉而不是說謊，所以呼叫端被迫顯式處理「尚無紀錄」。
 */
function computeCounselorRecord(historySessions) {
  const sessions = Array.isArray(historySessions) ? historySessions : [];
  const evaluatedSessions = sessions.filter(hasEvaluation);

  const distinctCaseIds = new Set();
  let userTurns = 0;
  sessions.forEach(s => {
    if (s && s.caseId) distinctCaseIds.add(s.caseId);
    if (s && Array.isArray(s.history)) {
      userTurns += s.history.filter(h => h && h.role === "user").length;
    }
  });

  let radar = null;
  let radarAverage = null;
  if (evaluatedSessions.length > 0) {
    const sum = { empathy: 0, changeTalk: 0, defusion: 0, icf: 0, action: 0 };
    evaluatedSessions.forEach(s => {
      const sc = s.report.scores;
      sum.empathy += sc.empathy || 0;
      sum.changeTalk += sc.changeTalk || 0;
      sum.defusion += sc.actFlexibility || 0;
      sum.icf += sc.icfAccuracy || 0;
      sum.action += sc.actionPlanning || 0;
    });
    const n = evaluatedSessions.length;
    radar = {
      empathy: Math.round(sum.empathy / n),
      changeTalk: Math.round(sum.changeTalk / n),
      defusion: Math.round(sum.defusion / n),
      icf: Math.round(sum.icf / n),
      action: Math.round(sum.action / n)
    };
    radarAverage = Math.round(
      (radar.empathy + radar.changeTalk + radar.defusion + radar.icf + radar.action) / 5
    );
  }

  return {
    totalSessions: sessions.length,
    evaluatedSessions,
    evaluatedCount: evaluatedSessions.length,
    distinctCaseIds,
    userTurns,
    radar,
    radarAverage
  };
}

/**
 * Milestone 7：五維雷達多邊形的座標公式，儀表板縮影與分析頁共用一份。
 * `radar` 為 null 時回傳 null —— 呼叫端據此**不輸出 polygon**，只留格線。
 */
function radarPolygonPoints(radar, maxRadius) {
  if (!radar) return null;
  const r = maxRadius / 100;
  const p1 = { x: 100, y: 100 - r * radar.empathy };
  const p2 = { x: 100 + r * radar.changeTalk * 0.951, y: 100 - r * radar.changeTalk * 0.309 };
  const p3 = { x: 100 + r * radar.defusion * 0.588, y: 100 + r * radar.defusion * 0.809 };
  const p4 = { x: 100 - r * radar.icf * 0.588, y: 100 + r * radar.icf * 0.809 };
  const p5 = { x: 100 - r * radar.action * 0.951, y: 100 - r * radar.action * 0.309 };
  return [p1, p2, p3, p4, p5].map(p => `${p.x},${p.y}`).join(" ");
}

/**
 * Milestone 7 / PRD v4「No Claim Without Evidence」最後一句：
 * 凡出現分數或督導建議之處，都要聲明這是練習輔助，臨床判斷屬於真人督導。
 * 集中一處輸出，避免五個位置的措辭各自漂移。
 */
const PRACTICE_SUPPORT_NOTICE = "以上為 AI 練習回饋，非督導評核；臨床判斷屬於真人督導。";
const PRACTICE_SUPPORT_NOTICE_EN = "AI practice feedback, not a supervisory assessment. Clinical judgement rests with a human supervisor.";

function practiceSupportNoticeText() {
  return state.locale === "en" ? PRACTICE_SUPPORT_NOTICE_EN : PRACTICE_SUPPORT_NOTICE;
}

function practiceSupportNoticeHTML(extraStyle) {
  return `<p class="practice-support-notice"${extraStyle ? ` style="${extraStyle}"` : ""}>
    <i class="fa-solid fa-circle-info"></i> ${practiceSupportNoticeText()}
  </p>`;
}

function getCustomCases() {
  return state.cases.filter(c => c && !BUILTIN_CASE_IDS.has(c.id));
}

/** 把目前的自定義個案寫入保險箱。降級模式下退回 localStorage。 */
async function persistCustomCases() {
  const customCases = getCustomCases();
  if (state.vaultMode === "localstorage-fallback") {
    try {
      localStorage.setItem("rehab_custom_cases", JSON.stringify(customCases));
    } catch (e) {
      console.error("[Vault] localStorage 降級寫入自定義個案失敗：", e);
    }
    return;
  }
  try {
    for (const c of customCases) {
      if (c && c.id) await RehabCounselorDB.saveCustomCase(c);
    }
  } catch (e) {
    console.error("[Vault] 自定義個案寫入 IndexedDB 失敗：", e);
  }
}

/** 把一場完成的面談寫入保險箱，並同步更新記憶體副本。 */
/**
 * 把一場完成的面談寫入保險箱。
 *
 * @returns {Promise<{ ok: boolean, reason: string|null }>}
 *   ok=false 時呼叫端**必須**據實告知同工，且不得聲稱已存入 ——
 *   PRD：「the interface must never claim a draft is saved or backed up when it is not」。
 *   此前本函式回傳 undefined，成敗只以 alert 表達，畫面照樣寫「已存入保險箱」。
 */
async function persistCompletedSession(session) {
  state.historySessions.unshift(session);
  return writeSessionToVault(session);
}

/**
 * 純寫入 —— 不動記憶體副本。
 * 與 persistCompletedSession 分開，是為了讓「重試寫入」不會把同一場面談
 * 再 unshift 進 state.historySessions 一次（那會在儀表板上變成兩場）。
 * 保險箱仍是唯一權威歸屬；這裡只是把同一筆再送一次。
 */
async function writeSessionToVault(session) {
  if (state.vaultMode === "localstorage-fallback") {
    try {
      localStorage.setItem("rehab_sessions_history", JSON.stringify(state.historySessions));
      return { ok: true, reason: null };
    } catch (e) {
      console.error("[Vault] localStorage 降級寫入面談紀錄失敗（可能已超出配額）：", e);
      return { ok: false, reason: "本機儲存空間已滿（降級模式受 5MB 配額限制）。" };
    }
  }


  try {
    const ok = await RehabCounselorDB.saveSession(session);
    if (ok) return { ok: true, reason: null };
    console.error("[Vault] 面談紀錄寫入 IndexedDB 失敗：", session.id);
    return { ok: false, reason: "保險箱拒絕了這次寫入（可能是儲存空間不足或資料庫異常）。" };
  } catch (err) {
    // 逾時／阻擋／中止會走到這裡（isVaultSignal 為真時 db.js 會上拋）。
    console.error("[Vault] 面談紀錄寫入保險箱時發生錯誤：", err);
    return { ok: false, reason: (err && err.message) || String(err) };
  }
}

/** localStorage 唯讀降級：IndexedDB 完全不可用時（如 Safari 無痕模式）沿用舊資料。 */
function hydrateFromLocalStorageFallback(reason) {
  state.vaultMode = "localstorage-fallback";
  state.vaultDegradedReason = reason || "unavailable";
  try {
    const s = JSON.parse(localStorage.getItem("rehab_sessions_history") || "[]");
    state.historySessions = Array.isArray(s) ? s : [];
  } catch (e) {
    state.historySessions = [];
  }
  try {
    const c = JSON.parse(localStorage.getItem("rehab_custom_cases") || "[]");
    if (Array.isArray(c) && c.length > 0) {
      state.cases = [...c.filter(x => x && !BUILTIN_CASE_IDS.has(x.id)), ...MOCK_CASES];
    }
  } catch (e) {
    /* 保持 state.cases 為內建個案 */
  }
}

/**
 * 開機時把保險箱內容讀入記憶體。必須在首次 switchView() 之前 await 完成。
 * IndexedDB 不可用時大聲降級並在 UI 明示，絕不靜默顯示空白歷史令同工誤以為資料遺失。
 */
async function hydrateVault() {
  // Milestone 8：本函式的每一條路徑都必須結束。db.js 已把所有等待包上界限，
  // 這裡負責把失敗翻譯成「同工看得懂的降級原因」並讓開機繼續。
  // 開機一旦卡在這裡不返回，switchView("dashboard") 就永遠不會執行 ——
  // 那正是 PRD「Degradation Honesty」禁止的「indefinite loading state」。
  const probe = await RehabCounselorDB.probe();
  if (!probe.available) {
    console.warn(`[Vault] 無法開啟 IndexedDB（${probe.reason}）：${probe.message}`);
    hydrateFromLocalStorageFallback(probe.reason);
    state.vaultReady = true;
    return;
  }

  try {
    const result = await RehabCounselorDB.migrateFromLocalStorage();
    if (result && result.migrated) {
      console.info(`[Vault] 已遷移 ${result.sessions} 場面談、${result.customCases} 個自定義個案至 IndexedDB，並釋放 localStorage 配額。`);
    }
  } catch (e) {
    // 遷移失敗時 localStorage 原始資料仍完整保留（db.js 先驗證後刪除），
    // 因此直接降級唯讀，資料不會遺失。
    console.error("[Vault] localStorage → IndexedDB 遷移失敗，降級至 localStorage 唯讀模式：", e);
    hydrateFromLocalStorageFallback(vaultReasonFromError(e));
    state.vaultReady = true;
    return;
  }

  try {
    const [sessions, customCases] = await Promise.all([
      RehabCounselorDB.getAllSessions(),
      RehabCounselorDB.getAllCustomCases()
    ]);
    state.historySessions = sessions;
    state.cases = [...customCases.filter(c => c && !BUILTIN_CASE_IDS.has(c.id)), ...MOCK_CASES];
    state.vaultMode = "indexeddb";
    state.vaultDegradedReason = null;
  } catch (e) {
    console.error("[Vault] 讀取 IndexedDB 失敗，降級至 localStorage 唯讀模式：", e);
    hydrateFromLocalStorageFallback(vaultReasonFromError(e));
  }
  state.vaultReady = true;
}

/**
 * 把 db.js 拋出的錯誤翻成 state.vaultDegradedReason 的取值。
 * 委派給 db.js 的 classifyVaultError() —— 分類邏輯只有一份，
 * 避免 probe() 與這裡各自演化後對同工說出矛盾的話。
 */
function vaultReasonFromError(err) {
  return classifyVaultError(err);
}

/**
 * Milestone 8：降級狀態下要對同工說的話。
 * 關鍵區別 —— blocked／timeout 時**紀錄沒有遺失**，只是暫時讀不到；
 * unavailable 才是真的存不進去。說錯一句，同工就會以為自己的面談紀錄沒了。
 */
function vaultDegradedNotice() {
  switch (state.vaultDegradedReason) {
    case "blocked":
      return {
        title: "另一個分頁正佔用本機儲存",
        body: "請關閉本平台的其他分頁，然後按「重試連線」。<strong>你的面談紀錄沒有遺失</strong>，只是目前讀不到。"
      };
    case "timeout":
      return {
        title: "本機儲存沒有回應",
        body: "<strong>你的面談紀錄沒有遺失</strong>，只是暫時讀不到。你可以先繼續使用其他功能，或按「重試連線」。"
      };
    case "error":
      return {
        title: "讀取本機儲存時發生錯誤",
        body: "<strong>你的面談紀錄應該仍在保險箱內</strong>，但這次讀取失敗。可以按「重試連線」，或到「系統設定 → 資料保險箱」匯出備份。"
      };
    case "version":
      return {
        title: "你開啟的是舊版程式",
        body: "保險箱的格式比目前程式新，通常是瀏覽器快取了舊版本。<strong>你的面談紀錄沒有遺失。</strong>請強制重新整理（Mac 按 Cmd+Shift+R，Windows 按 Ctrl+F5）載入最新版本。"
      };
    case "unavailable":
    default:
      return {
        title: "本機儲存不可用",
        body: "可能是無痕瀏覽視窗。新紀錄只能暫存於小容量儲存（5MB 上限），而且無法執行備份還原。改用一般瀏覽視窗開啟即可恢復。"
      };
  }
}

/**
 * 還原備份後，把已寫回 localStorage 的小型進度/設定重新讀入 state。
 * state 各欄位是在 module 載入時一次性初始化的，不重讀就會停留在還原前的舊值。
 */
function refreshStateFromLocalStorage() {
  const readJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };

  state.userName = localStorage.getItem("rehab_user_name") || "";
  state.unlockedAchievements = readJSON("rehab_unlocked_achievements", []);
  // 還原備份後可能寫回殘缺形狀（舊備份含 theoryProgress: {}），故同樣正規化。
  state.theoryProgress = normalizeTheoryProgress(readJSON("rehab_theory_progress", null));

  state.locale = localStorage.getItem("rehab_locale") || "zh-HK";
  state.selectedModel = localStorage.getItem("rehab_selected_model") || "gemini-2.5-flash";
  state.ttsEngine = localStorage.getItem("rehab_tts_engine") || "system";
  state.selectedVoiceName = localStorage.getItem("rehab_selected_voice") || "";
  state.recognitionLang = localStorage.getItem("rehab_recognition_lang") || state.recognitionLang;
  state.isSpeechMuted = localStorage.getItem("rehab_speech_muted") === "true";
  state.soundEnabled = localStorage.getItem("rehab_sound_enabled") !== "false";
  state.minimaxMaleTimbre = localStorage.getItem("rehab_minimax_male_timbre") || "cantonese_male";
  state.minimaxFemaleTimbre = localStorage.getItem("rehab_minimax_female_timbre") || "cantonese_female";
  // 註：API 金鑰蓄意不在備份範圍內，因此不重讀，維持目前工作階段設定。
}

/** 匯出全量保險箱備份為 JSON 檔。備份**不含** API 金鑰（見 db.js EXPORTABLE_SETTINGS）。 */
async function downloadVaultBackup() {
  try {
    const json = state.vaultMode === "indexeddb"
      ? await RehabCounselorDB.exportFullBackupJSON()
      : RehabCounselorDB.buildBackupJSON(state.historySessions, getCustomCases());

    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    a.download = `RehabCounselor_Vault_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error("[Vault] 匯出備份失敗：", e);
    alert(`匯出備份失敗：${e.message}`);
    return false;
  }
}

/** 由使用者選定的 JSON 檔覆蓋式還原保險箱。 */
async function restoreVaultBackup(file) {
  if (state.vaultMode !== "indexeddb") {
    alert("⚠️ 目前 IndexedDB 不可用（可能為無痕瀏覽模式），無法執行還原。\n請改用一般瀏覽視窗開啟本平台後再試。");
    return false;
  }

  let text = "";
  try {
    text = await file.text();
  } catch (e) {
    alert(`無法讀取備份檔案：${e.message}`);
    return false;
  }

  if (!confirm("⚠️ 覆蓋式還原\n\n此操作會先清空目前保險箱內的所有面談紀錄與自定義個案，再寫入備份檔內容。\n\n目前尚未備份的資料將會遺失。確定繼續嗎？")) {
    return false;
  }

  try {
    const result = await RehabCounselorDB.importFullBackupJSON(text);
    // 還原後重新載入記憶體副本，並把小型設定重新讀入 state。
    await hydrateVault();
    refreshStateFromLocalStorage();
    updateStaticUIStrings();
    updateApiBadge();
    AudioSynth.playSuccess();
    alert(`✅ 還原成功：${result.sessions} 場面談紀錄、${result.customCases} 個自定義個案已寫回保險箱。`);
    return true;
  } catch (e) {
    console.error("[Vault] 還原失敗：", e);
    AudioSynth.playError();
    alert(`還原失敗：${e.message}`);
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initApp().catch((e) => {
    console.error("[RehabCounselor] 啟動失敗：", e);
    // Milestone 8 補完：此前只有 console.error，畫面留在空白的內容區上
    // ——「加載中...」的標題配一片空白，沒有錯誤、沒有出路。
    // 那正是 PRD Degradation Honesty 禁止的狀態，只是成因是渲染例外而非
    // 保險箱掛住（ARCHITECTURE §7 D33）。
    renderBootFailure(e);
  });
});

/**
 * 單一頁面渲染失敗時的錯誤卡。取代「悄悄留下上一頁內容」的舊行為。
 * 側欄仍可用，同工可以走去其他頁面或設定頁匯出備份。
 */
function renderViewFailure(mount, viewName, err) {
  if (!mount) return;
  const message = (err && err.message) ? err.message : String(err);
  mount.innerHTML = `
    <div class="glass-card boot-failure-card">
      <i class="fa-solid fa-circle-exclamation boot-failure-icon"></i>
      <h3 class="boot-failure-title">這一頁未能顯示</h3>
      <p class="boot-failure-body">
        渲染「${escapeHtmlText(viewName)}」時發生錯誤。其他頁面仍可正常使用 ——
        左側導覽沒有受影響，<strong>你的面談紀錄也不受此錯誤影響</strong>。
      </p>
      <pre class="boot-failure-detail">${escapeHtmlText(message)}</pre>
      <div class="boot-failure-actions">
        <button class="btn btn-primary" id="view-failure-reload-btn">
          <i class="fa-solid fa-rotate"></i> 重新載入平台
        </button>
      </div>
    </div>
  `;
  const btn = document.getElementById("view-failure-reload-btn");
  if (btn) btn.addEventListener("click", () => window.location.reload());
}

/**
 * 開機失敗畫面。刻意不讀 state、不依賴任何已載入資料，
 * 只做字串拼接與 innerHTML 賦值 —— 它必須在「什麼都壞了」時仍能顯示。
 */
function renderBootFailure(err) {
  const mount = document.getElementById("content-view-mount");
  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");
  if (title) title.textContent = "平台未能完成啟動";
  if (subtitle) subtitle.textContent = "以下是實際發生的錯誤，你的紀錄應該仍在本機保險箱內。";
  if (!mount) return;

  const message = (err && err.message) ? err.message : String(err);
  mount.innerHTML = `
    <div class="glass-card boot-failure-card">
      <i class="fa-solid fa-circle-exclamation boot-failure-icon"></i>
      <h3 class="boot-failure-title">平台未能完成啟動</h3>
      <p class="boot-failure-body">
        載入過程中發生錯誤，因此主畫面沒有顯示出來。
        <strong>這通常不代表你的面談紀錄有問題</strong> —— 它們存在本機保險箱，不受此錯誤影響。
      </p>
      <pre class="boot-failure-detail">${escapeHtmlText(message)}</pre>
      <div class="boot-failure-actions">
        <button class="btn btn-primary" id="boot-failure-reload-btn">
          <i class="fa-solid fa-rotate"></i> 重新載入
        </button>
        <button class="btn" id="boot-failure-settings-btn">
          <i class="fa-solid fa-sliders"></i> 前往系統設定（可匯出備份）
        </button>
      </div>
    </div>
  `;

  const reloadBtn = document.getElementById("boot-failure-reload-btn");
  if (reloadBtn) reloadBtn.addEventListener("click", () => window.location.reload());
  const settingsBtn = document.getElementById("boot-failure-settings-btn");
  if (settingsBtn) settingsBtn.addEventListener("click", () => {
    try {
      switchView("settings", { skipUnsavedGuard: true });
    } catch (e) {
      console.error("[RehabCounselor] 設定頁亦無法渲染：", e);
    }
  });
}

/** 把文字安全放進 HTML —— 錯誤訊息可能含 < >，不得當成標記解析。 */
function escapeHtmlText(text) {
  const div = document.createElement("div");
  div.textContent = String(text == null ? "" : text);
  return div.innerHTML;
}

async function initApp() {
  // 自動將廢棄/已移除的模型 (gemini-2.0-flash, gemini-1.5-flash) 升級至預設的 gemini-2.5-flash
  if (state.selectedModel === "gemini-2.0-flash" || state.selectedModel === "gemini-1.5-flash") {
    state.selectedModel = "gemini-2.5-flash";
    localStorage.setItem("rehab_selected_model", "gemini-2.5-flash");
  }

  // Phase 9: Chrome Cantonese STT 語言代碼自動遷移
  // 將舊版預設的 zh-HK（容易被 Google 賬號覆寫為普通話）自動升級至 yue-Hant-HK（粵語專用代碼）
  // 僅影響 Chrome 用戶；Safari 用戶使用 zh-Hant-HK 已經完美運作。
  {
    const ua = navigator.userAgent.toLowerCase();
    const isChrome = ua.includes("chrome") && !ua.includes("edg");
    if (isChrome && state.recognitionLang === "zh-HK") {
      state.recognitionLang = "yue-Hant-HK";
      localStorage.setItem("rehab_recognition_lang", "yue-Hant-HK");
      console.info("[RehabCounselor] Chrome STT 語言自動遷移: zh-HK → yue-Hant-HK (粵語專用聲學模型)");
    }
  }

  // Phase 5: Initialize Locale & Sound Controls
  initLocaleAndSound();
  updateStaticUIStrings();

  // 1. Initialize API Status Badge
  updateApiBadge();

  // 2. Initialize Event Listeners
  initNavigation();
  initThemeToggle();
  initSpeechEngine();

  // 3. ADR-0005：載入本地保險箱。必須在首次渲染之前完成，
  //    否則儀表板與分析頁會先讀到空的 state.historySessions。
  //    Milestone 8：先把載入狀態畫出來，內容區不再是一片空白。
  renderVaultLoadingState();
  await hydrateVault();
  clearVaultLoadingState();

  // 3b. Milestone 7 §3.7：一次性徽章對帳。必須在保險箱載入之後、首次渲染之前，
  //     否則徽章牆會先畫出尚未對帳的狀態。失敗不阻擋開機。
  //
  //     ⚠️ Milestone 8：保險箱「沒有回應」時**必須跳過對帳**。此時
  //     state.historySessions 是空的（或只有 localStorage 的舊副本），
  //     對帳會據此收回同工合法取得的徽章 —— 那是一次因讀取失敗造成的真實
  //     資料損失。讀不到紀錄等同無從查證，正是 M7 定義的 null 情境。
  //     旗標不寫入，下次正常開機再跑。
  if (state.vaultDegradedReason === "blocked" || state.vaultDegradedReason === "timeout" || state.vaultDegradedReason === "error") {
    console.warn("[Vault] 保險箱未能完整讀取，本次跳過徽章對帳以免誤收回。");
  } else {
    await reconcileAchievementsOnce();
  }

  // 3c. Milestone 8：未完成的面談不得無聲消失。
  initUnsavedInterviewGuard();

  // 4. Load default view (Dashboard)
  switchView("dashboard");
}

/* ==========================================================================
   Milestone 8: 開機載入狀態與保險箱降級橫幅
   ========================================================================== */

let vaultLoadingSlowTimer = null;

/**
 * 開機時立刻把載入狀態畫進內容區。
 * 舊版此處是**完全空白**的 #content-view-mount 加頂欄兩行靜態字
 * （「加載中... / 請稍候...」），沒有 spinner、沒有錯誤、沒有出路 ——
 * 與 PRD「never sit on an indefinite loading state with no explanation
 * and no way forward」逐字相反。
 */
function renderVaultLoadingState() {
  const mount = document.getElementById("content-view-mount");
  if (!mount) return;

  mount.innerHTML = `
    <div class="glass-card vault-loading-card" id="vault-loading-card">
      <i class="fa-solid fa-spinner fa-spin vault-loading-spinner"></i>
      <h3 class="vault-loading-title">正在開啟本機保險箱…</h3>
      <p class="vault-loading-body">載入你的面談紀錄與自定義個案。</p>
      <p class="vault-loading-slow" id="vault-loading-slow" hidden>
        本機儲存回應較慢，仍在等待…（最多再等數秒，之後平台會照常開啟並說明狀況）
      </p>
    </div>
  `;

  // 2.5 秒仍未完成就先給進度說明，不讓同工對著一個不動的 spinner 猜。
  if (vaultLoadingSlowTimer) clearTimeout(vaultLoadingSlowTimer);
  vaultLoadingSlowTimer = setTimeout(() => {
    const slow = document.getElementById("vault-loading-slow");
    if (slow) slow.hidden = false;
  }, 2500);
}

function clearVaultLoadingState() {
  if (vaultLoadingSlowTimer) {
    clearTimeout(vaultLoadingSlowTimer);
    vaultLoadingSlowTimer = null;
  }
  const card = document.getElementById("vault-loading-card");
  if (card) card.remove();
}

/**
 * 降級狀態的常駐橫幅。由 switchView() 在每次渲染後插到內容區最上方，
 * 讓同工在任何一頁都看得到狀況，而不是只在設定頁才知道。
 */
function renderVaultDegradedBanner() {
  const mount = document.getElementById("content-view-mount");
  // D37：先移除既有橫幅再插入。switchView() 對 roleplay／icf_board 沒有
  // 對應 case，那些 view 不會重繪 mount，於是每次語系切換都會再疊一個。
  const existing = document.getElementById("vault-degraded-banner");
  if (existing) existing.remove();
  if (!mount || state.vaultMode === "indexeddb") return;

  const notice = vaultDegradedNotice();
  const banner = document.createElement("div");
  banner.className = "vault-degraded-banner";
  banner.id = "vault-degraded-banner";
  banner.innerHTML = `
    <i class="fa-solid fa-triangle-exclamation vault-degraded-icon"></i>
    <div class="vault-degraded-text">
      <p class="vault-degraded-title">${notice.title}</p>
      <p class="vault-degraded-body">${notice.body}</p>
    </div>
    <button type="button" class="btn vault-degraded-retry" id="vault-retry-btn">
      <i class="fa-solid fa-rotate"></i> 重試連線
    </button>
  `;
  mount.insertBefore(banner, mount.firstChild);

  const retryBtn = document.getElementById("vault-retry-btn");
  if (retryBtn) {
    retryBtn.addEventListener("click", async () => {
      AudioSynth.playClick();
      retryBtn.disabled = true;
      retryBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 重試中…`;
      // 丟掉可能已死的連線快取，強制重新開啟。
      RehabCounselorDB.db = null;
      await hydrateVault();
      switchView(state.activeView, { skipUnsavedGuard: true });
    });
  }
}

/* ==========================================================================
   Utility: API & Theme Management
   ========================================================================== */
function updateApiBadge() {
  const badge = document.getElementById("api-status-badge");
  if (!badge) return;
  if (state.apiKey) {
    badge.textContent = "AI 在線模式";
    badge.className = "tag tag-green";
  } else {
    badge.textContent = "離線體驗模式 (免金鑰)";
    badge.className = "tag tag-purple";
  }
}

function initThemeToggle() {
  const btn = document.getElementById("theme-toggle-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    btn.innerHTML = state.theme === "dark" 
      ? '<i class="fa-solid fa-moon"></i>' 
      : '<i class="fa-solid fa-sun"></i>';
  });
}

function initNavigation() {
  const items = document.querySelectorAll(".nav-item[data-target]");
  items.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const target = item.getAttribute("data-target");

      // Milestone 8：高亮**必須**等 switchView 回報成功才移動。
      // 舊版先換 class 再切換，未完成面談的守衛一旦攔下，
      // 高亮就會停在一個同工根本沒去成的頁面上。
      if (switchView(target) === false) return;

      items.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

/* ==========================================================================
   Milestone 8: 未完成面談的保護
   ========================================================================== */

/**
 * 這場面談是否**進行中且尚未入庫**（也就是離開就會永久失去）。
 *
 * 三個條件各自有其必要：
 *  1. activeSession 存在 —— 但它**不會**自己歸零（只在危險區重設時才回 null），
 *     所以單靠它會在做完一場面談後永遠為真，之後每次導覽都被誤攔。
 *  2. 尚未入庫 —— 入庫成功後寫入 vaultedAt。不改成把 activeSession 設為 null，
 *     因為報告頁與匯出仍要讀它，設 null 會弄壞既有流程。
 *  3. 有東西可失去 —— 剛進房間、一句話沒講、一個字沒寫時攔截，
 *     只會訓練同工無視警告。
 *
 * PRD OUT OF SCOPE 明訂「the counselor is warned but not rescued」：
 * 本函式的職責是**警告**，不是把草稿存起來。
 */
function hasUnsavedInterview() {
  const s = state.activeSession;
  if (!s || s.vaultedAt) return false;
  const hasTurns = Array.isArray(s.history) && s.history.length > 0;
  const notes = s.notes || {};
  const hasNotes = !!((notes.soap || "").trim() || (notes.icf || "").trim());
  return hasTurns || hasNotes;
}

const UNSAVED_INTERVIEW_WARNING =
  "本次面談尚未完成，離開會失去逐字對話與 SOAP／ICF 草稿，且無法復原。\n\n確定離開嗎？";

/**
 * 關閉分頁／重新整理／離開網站時的攔截。
 * 瀏覽器一律顯示自己的標準措辭，不接受自訂文字，因此不嘗試傳字串。
 * 述詞不成立時完全不介入，一般瀏覽不受任何影響。
 */
/**
 * 放棄一場未入庫的面談。同工已經確認過，內容確實失去 ——
 * 清掉記憶體副本，讓述詞回到 false，不再對一場已結束的面談重複發問。
 * 只清未入庫的：已入庫者報告頁與匯出仍要讀 activeSession。
 */
function discardActiveInterview() {
  if (state.activeSession && !state.activeSession.vaultedAt) {
    state.activeSession = null;
  }
}

function initUnsavedInterviewGuard() {
  window.addEventListener("beforeunload", (e) => {
    if (!hasUnsavedInterview()) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

/**
 * @param {string} viewName
 * @param {{ skipUnsavedGuard?: boolean }} [opts]
 * @returns {boolean} false = 被未完成面談的守衛攔下，畫面未變更
 */
function switchView(viewName, opts = {}) {
  // Milestone 8：應用內離開的攔截。放在 switchView 內部這一個位置，
  // 十一個呼叫點自動全部受保護；只有三處顯式豁免（語系重繪、放棄返回、
  // 離線無劇本面板），理由見 plan/08 §3.3。
  // viewName !== state.activeView：已在房間中又點同一項不算離開。
  if (!opts.skipUnsavedGuard && viewName !== state.activeView && hasUnsavedInterview()) {
    if (!confirm(UNSAVED_INTERVIEW_WARNING)) return false;
    // 同工已確認放棄 —— 這場面談就此結束，內容確實失去。
    // 必須在此清掉，否則 activeSession 會帶著已放棄的草稿留在記憶體裡，
    // 讓之後**每一次**導覽與關分頁都再問一次同一個問題。
    discardActiveInterview();
  }

  state.activeView = viewName;
  const mount = document.getElementById("content-view-mount");
  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");
  
  if (!mount || !title || !subtitle) return false;
  
  // Stop ongoing voice playback if switching views
  stopRecording();

  // 核心安全修復：切換視圖時清除盲盒背景轉場，防止視圖被背景異步任務劫持
  if (state.mysteryTimeoutId) {
    clearTimeout(state.mysteryTimeoutId);
    state.mysteryTimeoutId = null;
  }

  // Play audio synth click
  AudioSynth.playClick();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  // Milestone 8 補完：任一 render 函式拋錯時，此前 innerHTML 從未被賦值，
  // 於是**標題換了、內容還是上一頁** —— 實測出現過「標題：學習分析與歷程」
  // 配設定頁畫面，比空白更容易讓同工誤判（ARCHITECTURE §7 D33）。
  try {
  switch(viewName) {
    case "dashboard":
      title.textContent = t("dashboard_welcome");
      subtitle.textContent = t("dashboard_subtitle");
      renderDashboard(mount);
      break;
    case "theory":
      title.textContent = state.locale === "en" ? "Theory Hub" : state.locale === "zh-CN" ? "理论自学中心 (Theory Hub)" : "理論自學中心 (Theory Hub)";
      subtitle.textContent = state.locale === "en" ? "Master ACT, MI, and ICF frameworks with local Hong Kong vocational rehabilitation cases." : state.locale === "zh-CN" ? "深入掌握 ACT、MI 及 ICF 核心框架，结合香港职业复康实务范例。" : "深入掌握 ACT、MI 及 ICF 核心框架，結合香港職業復康實務範例。";
      renderTheoryHub(mount);
      break;
    case "arena":
      title.textContent = state.locale === "en" ? "Local Simulation Case Arena" : state.locale === "zh-CN" ? "本地化模拟个案实战 Arena" : "本地化模擬個案實戰 Arena";
      subtitle.textContent = state.locale === "en" ? "Select standard cases or synthesize a custom local vocational rehab case using AI." : state.locale === "zh-CN" ? "选择经典个案，或以 AI 生成专属的香港职业复康模拟情境。" : "選擇經典個案，或以 AI 生成專屬的香港職業復康模擬情境。";
      renderCaseArena(mount);
      break;
    case "co-learning":
      title.textContent = state.locale === "en" ? "Co-Learning Studio" : state.locale === "zh-CN" ? "小组协同研讨室 (Co-Learning Studio)" : "小組協同研討室 (Co-Learning Studio)";
      subtitle.textContent = state.locale === "en" ? "Analyze cases together with colleagues and debate critical dialogue transition choices." : state.locale === "zh-CN" ? "与同工一同剖析个案，就关键对话转折进行讨论与抉择。" : "與同工一同剖析個案，就關鍵對話轉折進行討論與抉擇。";
      renderCoLearning(mount);
      break;
    case "analytics":
      title.textContent = state.locale === "en" ? "Learning Analytics & Portfolios" : state.locale === "zh-CN" ? "学习分析与历程 (Analytics)" : "學習分析與歷程 (Analytics)";
      subtitle.textContent = state.locale === "en" ? "Track your progress, achievements, and completed session portfolios." : state.locale === "zh-CN" ? "追踪你的自学进度，以及在模拟辅导中所展现的能力雷达图。" : "追蹤你的自學進度，以及在模擬輔導中所展現的能力雷達圖。";
      renderAnalytics(mount);
      break;
    case "settings":
      title.textContent = state.locale === "en" ? "Global System Settings" : state.locale === "zh-CN" ? "系统与语音设定 (Settings)" : "系統與語音設定 (Settings)";
      subtitle.textContent = state.locale === "en" ? "Configure Gemini API keys and tune Cantonese Speech parameters for optimal setup." : state.locale === "zh-CN" ? "配置 Gemini API 金钥、微调广东话语音输出，实现最佳体验。" : "配置 Gemini API 金鑰、微調廣東話語音輸出，實現最佳體驗。";
      renderSettings(mount);
      break;
  }
  } catch (err) {
    console.error(`[RehabCounselor] 「${viewName}」渲染失敗：`, err);
    renderViewFailure(mount, viewName, err);
  }

  // Milestone 8：降級狀態的常駐橫幅置於內容區最上方。
  // 放在這裡（而非各個 render 函式內）確保任何一頁都看得到，
  // 而不是只有走到設定頁的同工才知道保險箱出了什麼事。
  renderVaultDegradedBanner();

  return true;
}

/* ==========================================================================
   View 1: Dashboard
   ========================================================================== */
function renderDashboard(container) {
  // 核心安全修復：加載儀表板時主動清理舊的金句定時器，防止定時器多重疊加及記憶體洩漏
  if (state.quoteIntervalId) {
    clearInterval(state.quoteIntervalId);
    state.quoteIntervalId = null;
  }

  // Calculate dynamic stats
  // ADR-0005：改讀記憶體副本（開機時由 hydrateVault() 從 IndexedDB 載入）
  const historySessions = state.historySessions;

  let completedModules = 0;
  if (state.theoryProgress) {
    ['act', 'mi', 'icf'].forEach(tKey => {
      if (state.theoryProgress[tKey]) {
        if (state.theoryProgress[tKey].info) completedModules++;
        if (state.theoryProgress[tKey].flashcards) completedModules++;
        if (state.theoryProgress[tKey].test) completedModules++;
      }
    });
  }
  const progressPercent = Math.round((completedModules / 9) * 100);

  // Milestone 7：所有關於同工的衍生數字統一由 computeCounselorRecord() 推導。
  const record = computeCounselorRecord(historySessions);
  const turnsCount = record.userTurns;
  const turnsPercent = Math.min(100, Math.round(turnsCount / 50 * 100)); // Target 50 turns

  // D20(a)：舊版以 historySessions.length > 0 開關平均分卡，保險箱裡只有離線示範
  // 面談時 avgScore 為 0 而條件為真 → 顯示「0分」。正確答案是「尚未評估」。
  const hasRadarData = record.radarAverage !== null;
  const avgScore = record.radarAverage;
  // 縮影雷達的格線半徑為 80（viewBox 200×200），與分析頁共用同一條座標公式。
  const miniRadarPoints = radarPolygonPoints(record.radar, 80);

  const localizedProgressVal = t("dashboard_progress_val").replace("{completed}", completedModules);
  const localizedHoursVal = t("dashboard_hours_val").replace("{turns}", turnsCount);
  const localizedAccuracyVal = hasRadarData
    ? t("dashboard_accuracy_val").replace("{score}", avgScore)
    : t("dashboard_accuracy_val_empty");

  const categoryNameMap = {
    act: "接納承諾療法 (ACT)",
    mi: "動機式訪談法 (MI)",
    icf: "全人復康矩陣 (ICF)"
  };

  container.innerHTML = `
    <!-- Option A: 同工金句激勵牆 -->
    <div class="glass-card quote-carousel-container" style="margin-bottom: 24px; padding: 12px 20px; overflow: hidden; display: flex; align-items: center; gap: 12px;">
      <div style="background: rgba(124, 58, 237, 0.12); border: 1px solid rgba(124,58,237,0.3); color: #a78bfa; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 0.8rem; text-transform: uppercase; white-space: nowrap; display:flex; align-items:center; gap:6px;">
        <i class="fa-solid fa-lightbulb"></i> ${state.locale === "en" ? "Mantra" : "同工金句"}
      </div>
      <div class="quote-carousel-track" style="flex-grow: 1; overflow: hidden; position: relative; height: 24px; display:flex; align-items:center;">
        <div id="quote-carousel-text" style="color: var(--text-main); font-size: 0.88rem; font-weight: 500; font-style: italic; transition: opacity 0.5s ease-in-out; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; opacity: 1; width:100%;">
          ${MOCK_MOTIVATIONAL_QUOTES[0]}
        </div>
      </div>
    </div>

    <!-- Base: 培訓駕駛艙數據面板 -->
    <div class="metrics-grid" style="margin-bottom: 24px;">
      <div class="glass-card metric-card" style="display:flex; align-items:center; padding:16px;">
        <div style="position: relative; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="50" height="50" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--illustration-line-faint)" stroke-width="3"/>
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent-purple)" stroke-width="3" stroke-dasharray="${progressPercent}, 100" stroke-linecap="round"/>
          </svg>
          <span style="position: absolute; font-size: 0.72rem; font-weight: 800; color: var(--text-bright);">${progressPercent}%</span>
        </div>
        <div class="metric-info" style="margin-left: 14px;">
          <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${t("dashboard_progress_title")}</h4>
          <p class="val" style="font-size: 1.05rem; color: var(--text-bright); font-weight:700;">${localizedProgressVal}</p>
        </div>
      </div>

      <div class="glass-card metric-card" style="display:flex; align-items:center; padding:16px;">
        <div style="position: relative; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="50" height="50" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--illustration-line-faint)" stroke-width="3"/>
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent-cyan)" stroke-width="3" stroke-dasharray="${turnsPercent}, 100" stroke-linecap="round"/>
          </svg>
          <span style="position: absolute; font-size: 0.68rem; font-weight: 800; color: var(--text-bright);">${turnsCount}t</span>
        </div>
        <div class="metric-info" style="margin-left: 14px;">
          <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${t("dashboard_hours_title")}</h4>
          <p class="val" style="font-size: 1.05rem; color: var(--text-bright); font-weight:700;">${localizedHoursVal}</p>
        </div>
      </div>

      <div class="glass-card metric-card" style="display:flex; align-items:center; padding:16px;">
        <div style="position: relative; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="50" height="50" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--illustration-line-faint)" stroke-width="3"/>
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent-green)" stroke-width="3" stroke-dasharray="${hasRadarData ? avgScore : 0}, 100" stroke-linecap="round"/>
          </svg>
          <span style="position: absolute; font-size: 0.72rem; font-weight: 800; color: var(--text-bright);">${hasRadarData ? avgScore + '分' : '—'}</span>
        </div>
        <div class="metric-info" style="margin-left: 14px;">
          <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${t("dashboard_accuracy_title")}</h4>
          <p class="val" style="font-size: 1.05rem; color: var(--text-bright); font-weight:700;">${localizedAccuracyVal}</p>
        </div>
      </div>

      <div class="glass-card metric-card" style="display:flex; align-items:center; padding:16px;">
        <div style="position: relative; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="50" height="50" viewBox="0 0 36 36" style="transform: rotate(-90deg);">
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--illustration-line-faint)" stroke-width="3"/>
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent-amber)" stroke-width="3" stroke-dasharray="100, 100" stroke-linecap="round"/>
          </svg>
          <span style="position: absolute; font-size: 0.75rem; font-weight: 800; color: var(--text-bright);">${state.cases.length}</span>
        </div>
        <div class="metric-info" style="margin-left: 14px; flex-grow:1; min-width:0;">
          <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${t("dashboard_cases_title")}</h4>
          <p class="val" style="font-size: 0.72rem; color: var(--text-main); display:flex; align-items:center; gap:5px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">
            API：<span class="pulse-indicator-dot" style="width: 7px; height: 7px; border-radius: 50%; background-color: ${state.apiKey ? 'var(--accent-green)' : 'var(--accent-purple)'}; box-shadow: 0 0 8px ${state.apiKey ? 'var(--accent-green)' : 'var(--accent-purple)'}; display: inline-block;"></span>
            ${state.apiKey ? t("dashboard_cases_online") : t("dashboard_cases_offline")}
          </p>
        </div>
      </div>
    </div>

    <!-- Main Two-Column Layout Grid -->
    <div class="grid-2col">
      <!-- Left Column (Star Case Dossier & Option C Mystery Box) -->
      <div style="display: flex; flex-direction: column; gap: 24px; min-height:0;">
        <!-- 本日星級推薦個案 -->
        <div class="glass-card" style="display: flex; flex-direction: column; gap: 16px;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-bright); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-star" style="color: var(--accent-amber);"></i> ${t("star_case_title")}
          </h3>
          <p style="color: var(--text-muted); font-size: 0.85rem;">${t("star_case_desc")}</p>
          
          <div style="background: var(--nested-bg-medium); border-radius: 12px; padding: 20px; border: 1px solid var(--card-border); position:relative; overflow:hidden;">
            <!-- Subtle sci-fi grid overlay for Star Case -->
            <div style="position:absolute; top:0; left:0; right:0; bottom:0; background:radial-gradient(circle at top right, rgba(124,58,237,0.06), transparent); pointer-events:none;"></div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <span class="tag tag-purple">${state.locale === "en" ? "Conflict & Anxiety Handling" : "情緒矛盾與焦慮處理"}</span>
              <span style="font-size: 0.78rem; color: var(--accent-amber); font-weight:700; display:flex; align-items:center; gap:3px;">
                <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i> ${state.locale === "en" ? "Medium" : "中等難度"}
              </span>
            </div>
            <h4 style="color: var(--text-bright); font-size:1.1rem; font-weight:800; margin-bottom: 8px; display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">👨‍✈️</span> ${state.locale === "en" ? "Ah Keung (Stroke Survivor)" : "阿強 (Ah Keung)"}
            </h4>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 18px; line-height:1.5;">
              ${state.locale === "en" 
                ? "Post-stroke minibus driver facing career transition, experiencing severe self-disability fusion. Practice MI OARS and ACT values clarification."
                : "中風小巴司機面對轉行，情緒焦慮並伴隨嚴重的自我殘廢化認知。適合演練 MI 矛盾處理與 ACT 價值澄清。"}
            </p>
            <button class="btn btn-primary shimmer-btn" id="dash-start-case-btn" data-case="case_01" style="width:100%; justify-content:center;">
              <i class="fa-solid fa-user-ninja"></i> ${state.locale === "en" ? "Enter Simulator Room" : "立即進入實戰艙"}
            </button>
          </div>
        </div>

        <!-- Option C: 隨機挑戰盲盒 -->
        <div class="glass-card" style="display: flex; flex-direction: column; gap: 12px; position:relative; overflow:hidden;">
          <div style="position:absolute; top:-30%; right:-20%; width:120px; height:120px; border-radius:50%; background:var(--accent-purple); filter:blur(40px); opacity:0.18; pointer-events:none;"></div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-bright); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-gift" style="color: var(--accent-purple);"></i> ${t("mystery_box_title")}
          </h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; line-height:1.5;">
            ${t("mystery_box_desc")}
          </p>
          
          <div id="mystery-box-trigger-area" style="cursor: pointer; background: linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%); border: 2px dashed rgba(124, 58, 237, 0.28); border-radius: 12px; padding: 20px; text-align: center; transition: var(--transition-smooth); margin-top:4px;">
            <div id="mystery-card-visual" style="font-size: 2.3rem; margin-bottom: 8px; filter: drop-shadow(0 0 10px rgba(124, 58, 237, 0.35)); transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); display:inline-block;">
              🔮
            </div>
            <h4 id="mystery-card-title" style="color: var(--text-bright); font-size:0.9rem; font-weight:800;">${t("mystery_box_click")}</h4>
            <p id="mystery-card-subtitle" style="font-size: 0.72rem; color: var(--text-muted); margin-top:3px;">${t("mystery_box_sub")}</p>
          </div>
        </div>
      </div>

      <!-- Right Column (Option B Radar & Checklist) -->
      <div style="display: flex; flex-direction: column; gap: 24px; min-height:0;">
        <!-- Option B: 個人能力值雷達圖縮影 -->
        <div class="glass-card mini-radar-card" style="display: flex; flex-direction: column; gap: 14px; align-items: center; justify-content: center; min-height:0;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-bright); align-self: flex-start; display: flex; align-items: center; gap: 8px; width:100%;">
            <i class="fa-solid fa-compass" style="color: var(--accent-cyan);"></i> ${t("mini_radar_title")}
          </h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; align-self: flex-start;">
            ${t("mini_radar_desc")}
          </p>
          
          <svg width="150" height="150" viewBox="0 0 200 200" style="margin: 6px 0;">
            <circle cx="100" cy="100" r="80" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1.5"/>
            <circle cx="100" cy="100" r="50" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1.5"/>
            <circle cx="100" cy="100" r="20" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1.5"/>
            
            <line x1="100" y1="100" x2="100" y2="20" stroke="var(--illustration-line)" stroke-width="1"/>
            <line x1="100" y1="100" x2="176" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
            <line x1="100" y1="100" x2="147" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
            <line x1="100" y1="100" x2="53" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
            <line x1="100" y1="100" x2="24" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>

            <!-- Milestone 7：多邊形由同工自己的已評估面談推導。舊版此處是一組寫死的
                 座標 "100,50 160,82 …"，零場面談也照畫，是對同工能力的無據宣稱。 -->
            ${miniRadarPoints
              ? `<polygon points="${miniRadarPoints}" fill="rgba(6, 182, 212, 0.2)" stroke="var(--accent-cyan)" stroke-width="2.5"/>`
              : ""}
          </svg>

          <div style="width:100%; font-size:0.75rem; color:var(--text-muted); border-top: 1px solid var(--card-border); padding-top:10px;">
            ${record.radar
              ? `<div style="display:flex; justify-content:space-between; gap:8px;">
                   <span>💡 ${state.locale === "en" ? "Empathy" : "傾聽共情"}：<strong style="color:var(--text-bright);">${record.radar.empathy} ${state.locale === "en" ? "" : "分"}</strong></span>
                   <span>⚡ ${state.locale === "en" ? "Commitment Action" : "承諾行動"}：<strong style="color:var(--text-bright);">${record.radar.action} ${state.locale === "en" ? "" : "分"}</strong></span>
                 </div>
                 <div style="margin-top:6px; font-size:0.7rem;">
                   ${state.locale === "en" ? `Averaged from ${record.evaluatedCount} evaluated session(s).` : `來自你 ${record.evaluatedCount} 場已評估面談的平均。`}
                 </div>`
              : `<div style="text-align:center; padding:2px 0;">
                   ${state.locale === "en" ? "No evaluated sessions yet." : "尚無已評估的面談紀錄。"}
                 </div>`}
          </div>
          ${record.radar ? practiceSupportNoticeHTML() : ""}
        </div>

        <!-- 真實自學與實戰進度清單 (Checklist) -->
        <div class="glass-card" style="display: flex; flex-direction: column; gap: 16px;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-bright); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-list-check" style="color: var(--accent-cyan);"></i> ${t("self_study_checklist_title")}
          </h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; line-height: 1.4;">
            ${t("self_study_checklist_desc")}
          </p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <!-- ACT -->
            <div style="background: var(--nested-bg-light); border: 1px solid var(--card-border); border-radius: 8px; padding: 10px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700; font-size:0.85rem; color:var(--accent-purple);">${state.locale === "en" ? "Acceptance Commitment (ACT)" : "接納承諾療法 (ACT)"}</span>
                <span class="tag tag-purple" style="font-size:0.68rem; padding:2px 6px;">
                  ${state.theoryProgress.act.info && state.theoryProgress.act.flashcards && state.theoryProgress.act.test ? t("self_study_status_done") : t("self_study_status_todo")}
                </span>
              </div>
              <div style="display:flex; gap:10px; font-size:0.75rem; color:var(--text-muted);">
                <span><i class="fa-solid ${state.theoryProgress.act.info ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.act.info ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_info")}</span>
                <span><i class="fa-solid ${state.theoryProgress.act.flashcards ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.act.flashcards ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_cards")}</span>
                <span><i class="fa-solid ${state.theoryProgress.act.test ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.act.test ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_test")}</span>
              </div>
            </div>
            <!-- MI -->
            <div style="background: var(--nested-bg-light); border: 1px solid var(--card-border); border-radius: 8px; padding: 10px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700; font-size:0.85rem; color:var(--accent-amber);">${state.locale === "en" ? "Motivational Interviewing (MI)" : "動機式訪談法 (MI)"}</span>
                <span class="tag tag-amber" style="font-size:0.68rem; padding:2px 6px;">
                  ${state.theoryProgress.mi.info && state.theoryProgress.mi.flashcards && state.theoryProgress.mi.test ? t("self_study_status_done") : t("self_study_status_todo")}
                </span>
              </div>
              <div style="display:flex; gap:10px; font-size:0.75rem; color:var(--text-muted);">
                <span><i class="fa-solid ${state.theoryProgress.mi.info ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.mi.info ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_info")}</span>
                <span><i class="fa-solid ${state.theoryProgress.mi.flashcards ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.mi.flashcards ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_cards")}</span>
                <span><i class="fa-solid ${state.theoryProgress.mi.test ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.mi.test ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_test")}</span>
              </div>
            </div>
            <!-- ICF -->
            <div style="background: var(--nested-bg-light); border: 1px solid var(--card-border); border-radius: 8px; padding: 10px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-weight:700; font-size:0.85rem; color:var(--accent-cyan);">${state.locale === "en" ? "Functioning & Disability (ICF)" : "全人復康矩陣 (ICF)"}</span>
                <span class="tag tag-cyan" style="font-size:0.68rem; padding:2px 6px;">
                  ${state.theoryProgress.icf.info && state.theoryProgress.icf.flashcards && state.theoryProgress.icf.test ? t("self_study_status_done") : t("self_study_status_todo")}
                </span>
              </div>
              <div style="display:flex; gap:10px; font-size:0.75rem; color:var(--text-muted);">
                <span><i class="fa-solid ${state.theoryProgress.icf.info ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.icf.info ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_info")}</span>
                <span><i class="fa-solid ${state.theoryProgress.icf.flashcards ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.icf.flashcards ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_cards")}</span>
                <span><i class="fa-solid ${state.theoryProgress.icf.test ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.icf.test ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_test")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Achievement Wall (Phase 4) -->
    ${renderAchievementsWall()}
  `;

  // Quote Carousel Interval
  let quoteIdx = 0;
  const quoteTextEl = document.getElementById("quote-carousel-text");
  state.quoteIntervalId = setInterval(() => {
    const activeTextEl = document.getElementById("quote-carousel-text");
    if (!activeTextEl) {
      clearInterval(state.quoteIntervalId);
      state.quoteIntervalId = null;
      return;
    }
    activeTextEl.style.opacity = 0;
    setTimeout(() => {
      quoteIdx = (quoteIdx + 1) % MOCK_MOTIVATIONAL_QUOTES.length;
      activeTextEl.textContent = MOCK_MOTIVATIONAL_QUOTES[quoteIdx];
      activeTextEl.style.opacity = 1;
    }, 500);
  }, 5000);

  // Mystery Box Logic
  const mysteryTrigger = document.getElementById("mystery-box-trigger-area");
  if (mysteryTrigger) {
    mysteryTrigger.addEventListener("click", () => {
      const mysteryVisual = document.getElementById("mystery-card-visual");
      const mysteryTitle = document.getElementById("mystery-card-title");
      const mysterySubtitle = document.getElementById("mystery-card-subtitle");
      
      mysteryVisual.style.transform = "rotateY(360deg)";
      
      const randomCase = state.cases[Math.floor(Math.random() * state.cases.length)];
      const modifiers = [
        { name: "焦慮爆發狀態", suffix: " (極度焦慮)" },
        { name: "強烈自我防衛", suffix: " (高度抗拒)" },
        { name: "無力感殘留", suffix: " (極度消極)" },
        { name: "認知融合鎖定", suffix: " (偏執抗拒)" }
      ];
      const randomMod = modifiers[Math.floor(Math.random() * modifiers.length)];
      
      setTimeout(() => {
        mysteryVisual.innerHTML = randomCase.avatar;
        mysteryTitle.innerHTML = `${randomCase.name} <span class="tag tag-rose" style="font-size:0.65rem; padding:1px 5px; margin-left:4px; font-weight:700;">${randomMod.name}</span>`;
        mysterySubtitle.innerHTML = `<span style="color:var(--accent-cyan); font-weight:700; font-size:0.72rem; animation: pulse-glow 1s infinite alternate;">正在合成情境，1.2秒後開啟輔導...</span>`;
        
        // 核心安全修復：將轉場定時器 ID 保存，允許 switchView 主動清除以阻止導航劫持
        state.mysteryTimeoutId = setTimeout(() => {
          const customSessionCase = { ...randomCase };
          customSessionCase.name = `${randomCase.name}${randomMod.suffix}`;
          customSessionCase.initial_dialogue = `${randomCase.initial_dialogue} 【系統提示：此時案主正處於 ${randomMod.name}，情緒很不穩定。】`;
          
          startRoleplaySession(customSessionCase);
          state.mysteryTimeoutId = null; // 轉場完成，清空狀態
        }, 1200);
      }, 400);
    });
  }

  // Attach button triggers
  const caseBtn = document.getElementById("dash-start-case-btn");
  if (caseBtn) {
    caseBtn.addEventListener("click", () => {
      const caseId = caseBtn.getAttribute("data-case");
      const matched = state.cases.find(c => c.id === caseId);
      if (matched) {
        startRoleplaySession(matched);
      }
    });
  }

  const learnBtn = document.getElementById("dash-learn-btn");
  if (learnBtn) {
    learnBtn.addEventListener("click", () => {
      const theoryLink = document.querySelector('.nav-item[data-target="theory"]');
      if (theoryLink) theoryLink.click();
    });
  }
}

/* ==========================================================================
   Helper: Particle Confetti Burst Generator for Gamified Triggers
   ========================================================================== */
function triggerConfetti(x, y) {
  const colors = ["#ff6b6b", "#4dadf7", "#51cf66", "#fcc419", "#ae3ec9", "#20c997", "#06b6d4"];
  const parent = document.body;
  
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.className = "particle-dot";
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    
    // Spread in standard circular burst with slight gravity bias
    const angle = Math.random() * Math.PI * 2;
    const velocity = 40 + Math.random() * 70;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity - 25; // upwards bias
    
    p.style.setProperty("--dx", `${dx}px`);
    p.style.setProperty("--dy", `${dy}px`);
    
    parent.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

/* ==========================================================================
   View 2: Theory Hub (ACT, MI, ICF) with Premium Sub-Tab Architecture
   ========================================================================== */
function renderTheoryHub(container) {
  // Track self-study progress
  if (state.theoryProgress && state.theoryProgress[state.activeTheoryTab]) {
    if (state.activeTheorySubTab === "info" || state.activeTheorySubTab === "flashcards") {
      state.theoryProgress[state.activeTheoryTab][state.activeTheorySubTab] = true;
      saveTheoryProgress();
    }
  }

  const actLabel = state.locale === "en" ? "Acceptance & Commitment (ACT)" : state.locale === "zh-CN" ? "接纳承诺療法 (ACT)" : "接納承諾療法 (ACT)";
  const miLabel = state.locale === "en" ? "Motivational Interviewing (MI)" : state.locale === "zh-CN" ? "动机式访谈法 (MI)" : "動機式訪談法 (MI)";
  const icfLabel = state.locale === "en" ? "Functioning & Disability (ICF)" : state.locale === "zh-CN" ? "国际功能残疾分类 (ICF)" : "國際功能殘疾分類 (ICF)";

  container.innerHTML = `
    <!-- Main Theory Navigation Tabs -->
    <div class="glass-card" style="margin-bottom: 20px; padding: 12px;">
      <div class="notes-tab-group" style="border-radius: 10px;">
        <div class="notes-tab ${state.activeTheoryTab === 'act' ? 'active' : ''}" id="tab-btn-act" style="font-size: 0.9rem; padding: 10px;">${actLabel}</div>
        <div class="notes-tab ${state.activeTheoryTab === 'mi' ? 'active' : ''}" id="tab-btn-mi" style="font-size: 0.9rem; padding: 10px;">${miLabel}</div>
        <div class="notes-tab ${state.activeTheoryTab === 'icf' ? 'active' : ''}" id="tab-btn-icf" style="font-size: 0.9rem; padding: 10px;">${icfLabel}</div>
      </div>
    </div>

    <!-- Nested Premium Sub-Tabs -->
    <div class="theory-sub-tab-group">
      <div class="theory-sub-tab ${state.activeTheorySubTab === 'info' ? 'active' : ''}" id="sub-tab-info">
        <i class="fa-solid fa-book-open"></i> ${state.locale === "en" ? "Deep Theory Study" : state.locale === "zh-CN" ? "深度自学理论" : "深度自學理論"}
      </div>
      <div class="theory-sub-tab ${state.activeTheorySubTab === 'flashcards' ? 'active' : ''}" id="sub-tab-flashcards">
        <i class="fa-solid fa-clone"></i> ${state.locale === "en" ? "3D Flashcards" : state.locale === "zh-CN" ? "3D 知识闪卡" : "3D 知識閃卡"}
      </div>
      <div class="theory-sub-tab ${state.activeTheorySubTab === 'test' ? 'active' : ''}" id="sub-tab-test">
        <i class="fa-solid fa-vial"></i> ${state.locale === "en" ? "Practice Test" : state.locale === "zh-CN" ? "实务巩固测验" : "實務鞏固測驗"}
      </div>
    </div>

    <div id="theory-content-viewport"></div>
  `;

  // Attach main tabs events (resets activeTheorySubTab to "info" to prevent bleeding layout)
  document.getElementById("tab-btn-act").addEventListener("click", () => {
    state.activeTheoryTab = "act";
    state.activeTheorySubTab = "info";
    renderTheoryHub(container);
  });
  document.getElementById("tab-btn-mi").addEventListener("click", () => {
    state.activeTheoryTab = "mi";
    state.activeTheorySubTab = "info";
    renderTheoryHub(container);
  });
  document.getElementById("tab-btn-icf").addEventListener("click", () => {
    state.activeTheoryTab = "icf";
    state.activeTheorySubTab = "info";
    renderTheoryHub(container);
  });

  // Attach sub tabs events
  document.getElementById("sub-tab-info").addEventListener("click", () => {
    state.activeTheorySubTab = "info";
    renderTheoryHub(container);
  });
  document.getElementById("sub-tab-flashcards").addEventListener("click", () => {
    state.activeTheorySubTab = "flashcards";
    renderTheoryHub(container);
  });
  document.getElementById("sub-tab-test").addEventListener("click", () => {
    state.activeTheorySubTab = "test";
    // Reset sandbox states when navigating to sandbox test
    if (state.activeTheoryTab === "icf") {
      state.icfSandboxFactors = null;
    }
    renderTheoryHub(container);
  });

  const theoryViewport = document.getElementById("theory-content-viewport");
  if (state.activeTheoryTab === "act") {
    renderACTTab(theoryViewport);
  } else if (state.activeTheoryTab === "mi") {
    renderMITab(theoryViewport);
  } else if (state.activeTheoryTab === "icf") {
    renderICFTab(theoryViewport);
  }
}

// 2A. ACT Hexaflex View
function renderACTTab(container) {
  const data = MOCK_THEORY_DATA.act;
  
  if (state.activeTheorySubTab === "info") {
    container.innerHTML = `
      <div class="glass-card theory-layout">
        <!-- Left: Animated SVG Hexaflex -->
        <div class="hexaflex-svg-container">
          <div class="hexaflex-center-text">心理彈性<br><span style="font-size:0.7rem; color:var(--accent-cyan); font-weight:600;">ACT Core</span></div>
          <svg width="340" height="340" viewBox="0 0 340 340">
            <!-- Background lines connecting the nodes -->
            <polygon points="170,30 290,100 290,240 170,310 50,240 50,100" fill="none" stroke="var(--illustration-line)" stroke-width="2"/>
            <line x1="170" y1="30" x2="170" y2="310" stroke="var(--illustration-line)" stroke-width="1.5" />
            <line x1="50" y1="100" x2="290" y2="240" stroke="var(--illustration-line)" stroke-width="1.5" />
            <line x1="50" y1="240" x2="290" y2="100" stroke="var(--illustration-line)" stroke-width="1.5" />
            
            <!-- Acceptance (Top) -->
            <g class="hexa-node ${state.activeHexaNode === 'acceptance' ? 'active' : ''}" data-node="acceptance" style="--glow-color: #ff6b6b">
              <circle cx="170" cy="30" r="22" fill="var(--illustration-bg)" stroke="#ff6b6b" stroke-width="2"/>
              <text x="170" y="34" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf004;</text>
            </g>
            
            <!-- Present Moment (Top Right) -->
            <g class="hexa-node ${state.activeHexaNode === 'present_moment' ? 'active' : ''}" data-node="present_moment" style="--glow-color: #51cf66">
              <circle cx="290" cy="100" r="22" fill="var(--illustration-bg)" stroke="#51cf66" stroke-width="2"/>
              <text x="290" y="104" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf14e;</text>
            </g>
            
            <!-- Values (Bottom Right) -->
            <g class="hexa-node ${state.activeHexaNode === 'values' ? 'active' : ''}" data-node="values" style="--glow-color: #ae3ec9">
              <circle cx="290" cy="240" r="22" fill="var(--illustration-bg)" stroke="#ae3ec9" stroke-width="2"/>
              <text x="290" y="244" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf005;</text>
            </g>
            
            <!-- Committed Action (Bottom) -->
            <g class="hexa-node ${state.activeHexaNode === 'committed_action' ? 'active' : ''}" data-node="committed_action" style="--glow-color: #20c997">
              <circle cx="170" cy="310" r="22" fill="var(--illustration-bg)" stroke="#20c997" stroke-width="2"/>
              <text x="170" y="314" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf70c;</text>
            </g>
            
            <!-- Self as Context (Bottom Left) -->
            <g class="hexa-node ${state.activeHexaNode === 'self_as_context' ? 'active' : ''}" data-node="self_as_context" style="--glow-color: #fcc419">
              <circle cx="50" cy="240" r="22" fill="var(--illustration-bg)" stroke="#fcc419" stroke-width="2"/>
              <text x="50" y="244" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf2bd;</text>
            </g>
            
            <!-- Defusion (Top Left) -->
            <g class="hexa-node ${state.activeHexaNode === 'defusion' ? 'active' : ''}" data-node="defusion" style="--glow-color: #4dadf7">
              <circle cx="50" cy="100" r="22" fill="var(--illustration-bg)" stroke="#4dadf7" stroke-width="2"/>
              <text x="50" y="104" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf127;</text>
            </g>
          </svg>
        </div>

        <!-- Right: Detailed Node Info Panel with Sliding Popover Style -->
        <div id="hexa-detail-mount"></div>
      </div>

      <!-- Detailed clinical framework explanation section -->
      <div class="glass-card" style="margin-top: 20px; padding: 20px;">
        <h4 style="color: var(--accent-purple); font-weight: 800; font-size: 1.05rem; margin-bottom: 8px;">
          <i class="fa-solid fa-graduation-cap"></i> ${state.locale === "en" ? "ACT Clinical Application Framework: Three Pillars (Open, Aware, Active)" : "ACT 臨床應用深度解析：三大核心支柱 (Open, Aware, Active)"}
        </h4>
        <p style="font-size: 0.85rem; color: var(--text-main); line-height: 1.6; margin-bottom: 12px;">
          ${state.locale === "en" 
            ? "Acceptance & Commitment Therapy (ACT) works through the Hexaflex. These six processes are integrated into three key pillars to help clients build 'Psychological Flexibility':" 
            : "接納承諾療法 (ACT) 透過六角形架構 (Hexaflex) 運作，這六大歷程並非獨立運作，而是互相交織，統合成三大核心支柱，協助面臨嚴重身體功能受損或創傷的案主重塑「心理彈性」："}
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 8px;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px;">
            <h5 style="color: #ff6b6b; font-weight: 700; font-size: 0.88rem; margin-bottom: 4px;">
              ${state.locale === "en" ? "1. Open - Acceptance & Defusion" : "1. 開放 (Open) - 接納與解離"}
            </h5>
            <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
              ${state.locale === "en"
                ? "<b>Acceptance</b> and <b>Cognitive Defusion</b> form the 'Open' pillar. In vocational rehab, clients often fuse with self-defeating thoughts (e.g. 'I am useless after stroke'). Defusion helps them distance from these thoughts, creating space for choice."
                : "<b>接納 (Acceptance)</b> 與 <b>認知解離 (Defusion)</b> 構成「開放」支柱。在職業復康中，案主常經歷「我跛左就係廢人」的認知融合，或試圖以不外出工作來逃避尷尬（經驗性逃避）。同工須引導案主容許痛楚或障礙想法存在，並與這些挫敗想法拉開距離，為下一步創造彈性空間。"}
            </p>
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px;">
            <h5 style="color: #fcc419; font-weight: 700; font-size: 0.88rem; margin-bottom: 4px;">
              ${state.locale === "en" ? "2. Aware - Present Moment & Self-as-Context" : "2. 覺察 (Aware) - 關注當下與觀察自我"}
            </h5>
            <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
              ${state.locale === "en"
                ? "<b>Present Moment Awareness</b> and <b>Self-as-Context</b> form the 'Aware' pillar. Clients often fixate on their past glory or dread the future. Bringing them back to the sensory here-and-now helps establish a wider perspective of the self beyond physical disability."
                : "<b>關注當下 (Present Moment)</b> 與 <b>觀察自我 (Self as Context)</b> 構成「覺察」支柱。創傷案主常反覆回想「中風前的輝煌」，或災難化「未來的面試被笑」。同工須將案主拉回此時此刻的感官覺察，並建立一個更寬廣的觀察者平台，理解「我的身體有缺損，但我仍然是那個能容納所有經驗的完整生命」。"}
            </p>
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px;">
            <h5 style="color: #20c997; font-weight: 700; font-size: 0.88rem; margin-bottom: 4px;">
              ${state.locale === "en" ? "3. Active - Values & Committed Action" : "3. 主動 (Active) - 價值觀與承諾行動"}
            </h5>
            <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
              ${state.locale === "en"
                ? "<b>Values</b> and <b>Committed Action</b> form the 'Active' pillar. This is the ultimate goal of rehab. We clarify the client's values (e.g. responsibility for family) and translate them into tiny, gradual, committed steps, carrying their pain forward."
                : "<b>價值觀 (Values)</b> 與 <b>承諾行動 (Committed Action)</b> 構成「主動」支柱。這是復康的終點。同工須協助案主澄清其深層的核心價值（如「對家庭的責任」），並將這些價值轉化為微小、漸進、可量化的行動計劃（如「下週去登記 ERB 體驗課程」），帶著殘疾或痛楚繼續前行。"}
            </p>
          </div>
        </div>
      </div>
    `;

    // Attach SVG node click events
    const nodes = container.querySelectorAll(".hexa-node");
    nodes.forEach(node => {
      node.addEventListener("click", () => {
        state.activeHexaNode = node.getAttribute("data-node");
        nodes.forEach(n => n.classList.remove("active"));
        node.classList.add("active");
        renderACTNodeDetail();
      });
    });

    renderACTNodeDetail();
    
  } else if (state.activeTheorySubTab === "flashcards") {
    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-clone" style="color:var(--accent-purple);"></i> ACT 心理彈性核心 3D 閃卡 deck</h3>
        <p style="font-size:0.9rem; color:var(--text-muted);">點擊以下磨砂卡牌可 3D 立體翻轉，查看香港職業復康現場的引導話術及臨床實踐小練習。</p>
        
        <div class="flashcard-deck">
          ${data.hexaflex.map(node => {
            let quest = "";
            if (node.id === "acceptance") quest = "「阿強，我哋試下唔好同呢份痛苦格鬥，而係容許佢暫時存在，好嗎？」";
            else if (node.id === "defusion") quest = "「『我係一個廢人』只是一個大腦產生的諗法，定是絕對的事實？」";
            else if (node.id === "present_moment") quest = "「此時此刻，除了對未來的擔心，你雙腳感覺到地面的支撐嗎？」";
            else if (node.id === "self_as_context") quest = "「想像你的人生成為一個舞台，中風是演員，而你是容納他們的舞台...」";
            else if (node.id === "values") quest = "「拋開所有的限制，你最希望自己成為一個怎樣的爸爸和丈夫？」";
            else if (node.id === "committed_action") quest = "「我們能承諾下週跨出一小步，去登記報讀適合的培訓班嗎？」";

            return `
              <div class="card-3d-wrapper" onclick="this.classList.toggle('flipped')">
                <div class="card-3d">
                  <!-- Front Side -->
                  <div class="card-front">
                    <div class="card-front-title">
                      <span style="background:${node.color}; color:white; width:28px; height:28px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:0.85rem;">
                        <i class="fa-solid ${node.icon}"></i>
                      </span>
                      ${node.name}
                    </div>
                    <p style="font-size:0.82rem; color:var(--text-muted); line-height:1.4; margin-top:8px;">${node.desc}</p>
                    <div class="card-prompt-question">
                      <strong>覺察提問：</strong><br>${quest}
                    </div>
                    <div class="card-tap-hint">
                      <i class="fa-solid fa-arrows-rotate"></i> 點擊翻看實務策略
                    </div>
                  </div>
                  <!-- Back Side -->
                  <div class="card-back" style="border-top: 3px solid ${node.color};">
                    <div class="card-back-title" style="color:${node.color};">
                      <i class="fa-solid fa-graduation-cap"></i> ${node.name} · 實務引導
                    </div>
                    <div style="font-size:0.82rem; margin-bottom:8px; line-height:1.4; overflow-y:auto; flex-grow:1;">
                      <strong style="color:var(--accent-cyan);"><i class="fa-solid fa-comment-dots"></i> 港式引導口訣：</strong>
                      <p style="color:var(--text-bright); font-style:italic; margin:4px 0 8px 0;">${node.hk_example}</p>
                      
                      <strong style="color:var(--accent-amber);"><i class="fa-solid fa-compass"></i> 臨床小練習：</strong>
                      <p style="color:var(--text-main); margin-top:4px;">${node.exercise}</p>
                    </div>
                    <div class="card-tap-hint">
                      <i class="fa-solid fa-arrows-rotate"></i> 點擊返回正面
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
    
  } else if (state.activeTheorySubTab === "test") {
    // Cognitive Defusion Sandbox
    const challenges = [
      {
        id: 0,
        fused: "「我跛左，報名讀 ERB 都係浪費政府錢，去到實俾人笑我慢！」",
        case: "阿強 (52歲，中風偏癱前司機)",
        hint: "認知解離的精髓在於『拉開自我與想法的距離』。請引導案主在想法前加入『我留意到我有一個諗法，話我...』之類的防禦解離句式，將極端想法客觀化。"
      },
      {
        id: 1,
        fused: "「我成世人淨係識揸小巴，依家手腳唔靈活，我就係一個廢人，返唔到轉頭。」",
        case: "阿強 (52歲，中風偏癱前司機)",
        hint: "引導案主與『廢人』這個自我挫敗的標籤解離。可以引導他改寫為：『我留意到我腦海浮現一個標籤話我自己係廢人...』，而不是將自我的全部定義為這具殘疾身體。"
      },
      {
        id: 2,
        fused: "「痛到咁，我連企都企唔穩，根本無公司會請我，去面試都係獻醜。」",
        case: "雅婷 (38歲，慢性痛症媽媽)",
        hint: "案主將『痛楚』與『沒有公司會請我』這項主觀擔憂進行了融合。請引導她使用『我留意到大腦正浮現一個想法，話我...』，停止與痛楚爭辯，騰出心理空間。"
      },
      {
        id: 3,
        fused: "「我戴住助聽器去面試，人地一見到我個眼神就變左，我肯定佢地心裡笑緊我殘廢，我點講都無用。」",
        case: "偉杰 (29歲，聽力損失青年)",
        hint: "案主將『別人的眼神』與『笑我殘廢/點講都無用』的想法百分之百融合。請引導他改寫為：『我注意到我腦海裡浮現一個想法，話其他人笑緊我殘廢...』，拉開大腦想法與事實的差距。"
      },
      {
        id: 4,
        fused: "「我以前做開文職經理，依家叫我去庇護工場或者做包裝，真係好無面子，我不如匿喺屋企算。」",
        case: "阿樂 (45歲，中度腦傷前經理)",
        hint: "案主與『無面子』的標籤及『匿喺屋企算』的避開策略高度融合。引導他改寫為：『我留意到我腦頁正浮現一個想法，話去做包裝好無面子...』，接納尷尬並容許這想法存在，從而關關注重投社會的價值。"
      },
      {
        id: 5,
        fused: "「我個仔有自閉症，出去返工肯定會同同事吵架，佢遲早都會俾人開除，我地做乜要受呢份氣？」",
        case: "家長 (自閉症青年偉明之母)",
        hint: "家長將未發生的災難化想法（吵架、被開除）等同於現實。請引導家長改寫為：『我留意到我腦海中浮現一個對未來的擔心，話阿仔去返工會俾人開除...』，將恐懼客觀化，創造嘗試的彈性空間。"
      }
    ];

    state.actDefusionChallengeIdx = state.actDefusionChallengeIdx || 0;
    const challenge = challenges[state.actDefusionChallengeIdx];

    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-vial" style="color:var(--accent-purple);"></i> ACT 認知解離實踐沙盒 (Cognitive Defusion)</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-circle" id="prev-defusion-btn" style="width:32px; height:32px;"><i class="fa-solid fa-arrow-left"></i></button>
            <span style="font-size:0.85rem; display:inline-flex; align-items:center; font-weight:700;">情境 ${state.actDefusionChallengeIdx + 1} / ${challenges.length}</span>
            <button class="btn btn-circle" id="next-defusion-btn" style="width:32px; height:32px;"><i class="fa-solid fa-arrow-right"></i></button>
          </div>
        </div>

        <p style="font-size:0.9rem; color:var(--text-muted);">案主此時常深陷「認知融合」中，把腦袋裡的恐懼完全等同於事實。同工請在右側將其重塑為帶著心理空間的<b>「解離話術」</b>。</p>

        <div class="defusion-container">
          <!-- Left: Challenge Bubble -->
          <div class="defusion-challenge-box">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="tag tag-rose" style="font-size:0.72rem;">融合想法 (Cognitive Fusion)</span>
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;"><i class="fa-solid fa-user"></i> 案主：${challenge.case}</span>
            </div>
            <p style="font-size:1.05rem; font-style:italic; font-weight:700; color:var(--text-bright); margin:12px 0;">"${challenge.fused}"</p>
            <div style="background:var(--nested-bg-medium); border-radius:8px; padding:10px; border:1px dashed rgba(244,63,94,0.3);">
              <h5 style="color:var(--accent-cyan); font-size:0.8rem; font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-lightbulb"></i> 督導戰術提示：</h5>
              <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.4;">${challenge.hint}</p>
            </div>
          </div>

          <!-- Right: Interactive Reframe Area -->
          <div class="defusion-reframe-box">
            <h4 style="font-size:0.92rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-pen-nib" style="color:var(--accent-cyan);"></i> 請輸入你的臨床解離引導話術：
            </h4>
            <textarea class="defusion-textarea" id="defusion-input" placeholder="例如：『阿強，我留意到你腦袋入面有一個諗法，話我哋...』，試下引導他建立觀察者的空間。"></textarea>
            
            <div id="defusion-feedback-mount"></div>

            <div style="display:flex; justify-content:flex-end;">
              <button class="btn btn-primary" id="defusion-submit-btn"><i class="fa-solid fa-sparkles"></i> 驗證解離語句</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach challenge switch events
    document.getElementById("prev-defusion-btn").addEventListener("click", () => {
      state.actDefusionChallengeIdx = (state.actDefusionChallengeIdx - 1 + challenges.length) % challenges.length;
      renderACTTab(container);
    });
    document.getElementById("next-defusion-btn").addEventListener("click", () => {
      state.actDefusionChallengeIdx = (state.actDefusionChallengeIdx + 1) % challenges.length;
      renderACTTab(container);
    });

    // Verification Logic
    document.getElementById("defusion-submit-btn").addEventListener("click", (e) => {
      const input = document.getElementById("defusion-input").value.trim();
      const fb = document.getElementById("defusion-feedback-mount");

      if (input.length < 10) {
        fb.innerHTML = `
          <div class="defusion-feedback-badge" style="background:rgba(244,63,94,0.08); border-color:rgba(244,63,94,0.2); color:var(--accent-rose);">
            <strong>⚠️ 語句過短</strong>
            <span>請輸入一個完整的港式廣東話臨床引導話術，至少包含 10 個字。</span>
          </div>
        `;
        return;
      }

      // Check for Cognitive Defusion grammar keywords
      const passKeywords = ["我留意到", "我注意到", "我醒覺到", "我觀察到", "我發現我", "諗法", "想法", "個諗法", "個想法", "有一個諗法", "有一個想法"];
      const containsKeyword = passKeywords.some(kw => input.includes(kw));

      if (containsKeyword) {
        // Confetti trigger
        const rect = e.target.getBoundingClientRect();
        triggerConfetti(rect.left + 50, rect.top + window.scrollY);

        // Record progress
        if (state.theoryProgress) {
          state.theoryProgress.act.test = true;
          saveTheoryProgress();
        }

        fb.innerHTML = `
          <div class="defusion-feedback-badge">
            <strong style="font-size:0.9rem;"><i class="fa-solid fa-circle-check"></i> 🏆 答對了！認知解離引導非常成功！</strong>
            <p style="font-size:0.8rem; color:var(--text-bright); margin:4px 0;">你的話術：『${input}』</p>
            <span style="font-size:0.78rem; color:var(--text-muted); line-height:1.4;">
              <b>AI Supervisor 評語：</b>精準使用了「我留意到我有一個想法...」的語式結構！這句話極具同理共情深度，且成功拉開了案主與其大腦極端標籤（如「廢人」、「浪費政府錢」）的心理距離。這能阻斷大腦的想法自動等於客觀事實，進而建立觀察者的自我，有效降低案主的心理負衛！
            </span>
          </div>
        `;
      } else {
        fb.innerHTML = `
          <div class="defusion-feedback-badge" style="background:rgba(245,158,11,0.08); border-color:rgba(245,158,11,0.25); color:var(--accent-amber);">
            <strong>⚠️ 語式校正提示</strong>
            <span style="font-size:0.78rem; line-height:1.4;">
              目前的話術缺乏拉開距離的「解離暗示」。在認知融合中，若直接否定案主（如「你唔好咁悲觀」、「你唔係廢人」），只會增加他的抗拒。
              <b>建議重構：</b>請嘗試在語句中加入<b>「我留意到你腦海浮現一個諗法，話...」</b>或<b>「我哋試下將『我係廢人』，改為：我留意到我有一個諗法，話自己係廢人」</b>。請再試一次！
            </span>
          </div>
        `;
      }
    });
  }
}

function renderACTNodeDetail() {
  const mount = document.getElementById("hexa-detail-mount");
  if (!mount) return;
  
  const data = MOCK_THEORY_DATA.act;
  const nodeInfo = data.hexaflex.find(n => n.id === state.activeHexaNode);
  if (!nodeInfo) return;

  mount.style.setProperty("--accent-color", nodeInfo.color);
  mount.innerHTML = `
    <div class="theory-detail-panel" style="animation: fadeIn 0.4s ease;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
        <span class="metric-icon" style="background:${nodeInfo.color}; width:36px; height:36px; font-size:1rem; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:white;">
          <i class="fa-solid ${nodeInfo.icon}"></i>
        </span>
        <h3 style="font-size:1.3rem; font-weight:800; color:var(--text-bright);">${nodeInfo.name}</h3>
      </div>
      <p style="font-size:0.92rem; color:var(--text-main); line-height:1.5;">${nodeInfo.desc}</p>
      
      <div style="background:rgba(255,255,255,0.03); border-radius:8px; padding:12px; border-left:3px solid ${nodeInfo.color}; margin-bottom:10px;">
        <h5 style="color:${nodeInfo.color}; font-size:0.8rem; font-weight:700; text-transform:uppercase; margin-bottom:4px;"><i class="fa-solid fa-comment"></i> 香港職業復康對話範例：</h5>
        <p style="font-size:0.85rem; font-style:italic; color:var(--text-bright); line-height:1.4;">${nodeInfo.hk_example}</p>
      </div>

      <div style="background:rgba(124,58,237,0.06); border-radius:8px; padding:12px; border:1px dashed rgba(124,58,237,0.3);">
        <h5 style="color:var(--accent-cyan); font-size:0.8rem; font-weight:700; text-transform:uppercase; margin-bottom:4px;"><i class="fa-solid fa-compass"></i> 推薦臨床小練習：</h5>
        <p style="font-size:0.85rem; color:var(--text-main); line-height:1.4;">${nodeInfo.exercise}</p>
      </div>
    </div>
  `;
}

// 2B. MI OARS Card Game View
function renderMITab(container) {
  const data = MOCK_THEORY_DATA.mi;
  
  if (state.activeTheorySubTab === "info") {
    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:20px;">
        <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-comments" style="color:var(--accent-amber);"></i> 動機式訪談法 (MI) 四大核心歷程與漏斗模型</h3>
        <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.5;">動機式訪談法的核心在於引發案主內在的改變動機。同工需克服急著糾正的「警報糾正反射 (Righting Reflex)」，透過 OARS 技巧（開放式提問、肯定、反映式傾聽、總結）促使案主自己說出想要改變的理由。</p>
        
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-top:8px;">
          <div class="study-item">
            <h4 style="color:var(--accent-cyan); font-weight:800; font-size:1rem; margin-bottom:6px;"><i class="fa-solid fa-handshake"></i> 1. 建立關係 (Engaging)</h4>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">這是所有諮商的起點。與案主建立真誠、信任的專業合作關係，不帶任何評判地去聆聽他的困境與恐懼。</p>
          </div>
          <div class="study-item">
            <h4 style="color:var(--accent-purple); font-weight:800; font-size:1rem; margin-bottom:6px;"><i class="fa-solid fa-crosshairs"></i> 2. 確定方向 (Focusing)</h4>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">與案主一同澄清輔導的焦點（例如：這週我們要解決的是「尋找適合的工作方向」，而不是強迫他立刻面試）。</p>
          </div>
          <div class="study-item">
            <h4 style="color:var(--accent-amber); font-weight:800; font-size:1rem; margin-bottom:6px;"><i class="fa-solid fa-fire"></i> 3. 引發動機 (Evoking)</h4>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">最關鍵的階段！透過 OARS 引發案主的「改變性談話 (Change Talk)」（例如：案主主動說出『其實我都想自己賺錢養家』）。</p>
          </div>
          <div class="study-item">
            <h4 style="color:var(--accent-green); font-weight:800; font-size:1rem; margin-bottom:6px;"><i class="fa-solid fa-map"></i> 4. 制定計劃 (Planning)</h4>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">當案主表現出足夠的準備度時，協商具體可行、可拆解的復康或求職行動，並為可能出現的阻礙做準備。</p>
          </div>
        </div>

        <div style="background:rgba(245,158,11,0.05); border-left:4px solid var(--accent-amber); padding:16px; border-radius:8px; margin-top:8px;">
          <h4 style="color:var(--accent-amber); font-weight:800; font-size:0.95rem; margin-bottom:6px;"><i class="fa-solid fa-triangle-exclamation"></i> 避開「警報糾正反射 (Righting Reflex)」</h4>
          <p style="font-size:0.82rem; color:var(--text-main); line-height:1.5;">當我們看見案主有不良行為或消極心態時（例如不想去復康、不想找工作），專業人員的本能往往是**說教、給建議、甚至指責**（如：*『你唔去上堂，以後點搵工？』*）。MI 理論證實：這只會激發案主為「不改變」進行辯護，產生強烈「阻抗」，令諮商陷入僵局。OARS 的目的，就是透過**傾聽、反映、共情**來鬆動這份阻抗。</p>
        </div>

        <!-- Additional Deep Clinical Theory for MI -->
        <div class="glass-card" style="margin-top: 20px; padding: 20px;">
          <h4 style="color: var(--accent-amber); font-weight: 800; font-size: 1.05rem; margin-bottom: 8px;">
            <i class="fa-solid fa-graduation-cap"></i> ${state.locale === "en" ? "MI Clinical Framework: Eliciting Change Talk & DARN-CAT Model" : "MI 臨床應用深度解析：引發改變談話與 DARN-CAT 模型"}
          </h4>
          <p style="font-size: 0.85rem; color: var(--text-main); line-height: 1.6; margin-bottom: 12px;">
            ${state.locale === "en"
              ? "Motivational Interviewing focuses on moving the client from resistance to change. The core technique is to notice, elicit, and reinforce 'Change Talk'. We use the DARN-CAT classification to evaluate the client's readiness:"
              : "動機式訪談法 (MI) 的精髓在於引導案主從阻抗走向承諾。同工的核心任務是識別並引發案主的「改變談話 (Change Talk)」。臨床上可以使用 DARN-CAT 結構來評估案主改變的準備狀態："}
          </p>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 8px;">
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px;">
              <h5 style="color: var(--accent-amber); font-weight: 700; font-size: 0.88rem; margin-bottom: 6px;">
                ${state.locale === "en" ? "DARN (Preparatory Change Talk)" : "DARN (準備性改變談話 - 蓄勢待發)"}
              </h5>
              <ul style="font-size: 0.78rem; color: var(--text-muted); padding-left: 14px; line-height: 1.5; margin: 0; list-style-type: disc;">
                <li><b>Desire (願望)</b>: ${state.locale === "en" ? "'I want to find a stable job...'" : "「我想搵到一份穩定嘅工作...」"}</li>
                <li><b>Ability (能力)</b>: ${state.locale === "en" ? "'I can use voice typing...'" : "「如果可以用廣東話語音輸入，我諗我都做到...」"}</li>
                <li><b>Reasons (理由)</b>: ${state.locale === "en" ? "'I want to support my kids...'" : "「我想供仔女讀書，盡番老豆責任...」"}</li>
                <li><b>Need (需要)</b>: ${state.locale === "en" ? "'I must leave the house...'" : "「我唔可以再匿喺房，我需要重投社會...」"}</li>
              </ul>
            </div>
            
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px;">
              <h5 style="color: var(--accent-green); font-weight: 700; font-size: 0.88rem; margin-bottom: 6px;">
                ${state.locale === "en" ? "CAT (Mobilizing Change Talk)" : "CAT (行動性改變談話 - 跨步邁出)"}
              </h5>
              <ul style="font-size: 0.78rem; color: var(--text-muted); padding-left: 14px; line-height: 1.5; margin: 0; list-style-type: disc;">
                <li><b>Commitment (承諾)</b>: ${state.locale === "en" ? "'I will register for the ERB course...'" : "「我下星期會去登記報讀 ERB 體驗課程...」"}</li>
                <li><b>Activation (啟動)</b>: ${state.locale === "en" ? "'I am ready to fill out the form today...'" : "「我今日已經準備好填妥呢張就業評估表...」"}</li>
                <li><b>Taking Steps (採取行動)</b>: ${state.locale === "en" ? "'I practiced speech input at home...'" : "「我尋日喺屋企試過用手機用語音打字，真係得...」"}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
    
  } else if (state.activeTheorySubTab === "flashcards") {
    // 8 Consulting Flashcards
    const oarsCards = [
      {
        title: "開放式提問 - 釐清阻礙",
        concept: "引導案主描述具體困難，避免用『是/否』句型堵死對話。",
        front_hint: "挑戰情境：「我根本做唔到文職，電腦我都唔識用。」",
        back_title: "開放式提問範本",
        back_voice: "「阿強，對你黎講，學電腦文職最令你感到擔心或者抗拒嘅，係邊一部分？」",
        back_desc: "這將案主的抗拒點具體化，從『完全做不到』的泛化觀念縮小到『對未知技能的擔憂』，便於隨後拆解輔導。"
      },
      {
        title: "肯定 - 強化抗逆力",
        concept: "真誠肯定案主的努力、決心與天賦，建立內在力量。",
        front_hint: "挑戰情境：「日日痛到咁，我仲堅持黎中心，我都唔知為乜。」",
        back_title: "肯定技術範本",
        back_voice: "「雅婷，面對全身劇烈嘅痛楚，你今日依然克服萬難堅持黎到中心，呢份求變嘅決心同韌性，真係好令人敬佩。」",
        back_desc: "這將案主的無奈重塑為『堅韌的意志力』，讓他感受到自己的價值和主控權。"
      },
      {
        title: "反映式傾聽 - 簡單反映",
        concept: "重複或用近義詞重申案主的字眼，表示正在專心聆聽。",
        front_hint: "挑戰情境：「我已經待業兩年，成個廢人咁，父母都對我好失望。」",
        back_title: "簡單反映範本",
        back_voice: "「你覺得呢兩年無返工，令你感覺自己好似一個廢人，亦好介意父母對你嘅看法。」",
        back_desc: "最基本的同理共情，安全且能確認案主話語的真實情感核心。"
      },
      {
        title: "反映式傾聽 - 雙重反映",
        concept: "同時反映出案主矛盾的兩面（想改變 vs 害怕改變），促使其看清糾結。",
        front_hint: "挑戰情境：「我想出去返工幫補家計，但我一見到面試官異樣嘅眼神就想縮沙。」",
        back_title: "雙重反映範本",
        back_voice: "「一方面，你心中好有責任感，好想出去搵工幫手供仔女讀書；但另一方面，面試時人哋嘅眼神同溝通障礙又帶比你極大嘅壓力同挫折感。」",
        back_desc: "經典的 MI 反映方式，將『想改變的拉力』與『退縮的推力』平鋪擺在案主面前，讓他自己去尋求平衡點。"
      },
      {
        title: "反映式傾聽 - 放大反映",
        concept: "稍微放大案主的絕對話語，引導他主動反駁或修正其極端觀點。",
        front_hint: "挑戰情境：「我呢隻手廢左，我呢世都做唔到任何工作，去邊度人都嫌棄我。」",
        back_title: "放大反映範本",
        back_voice: "「對你黎講，中風對你身體嘅打擊係百分百嘅，你覺得完全沒有任何一種崗位或者形式，可以容許你發揮任何價值。」",
        back_desc: "用溫和但放大的語氣反映極端想法，案主往往會本能反駁：『又唔係百分百，其實單手吸印送文件我都仲得嘅...』，從而誘發 Change Talk！"
      },
      {
        title: "總結 - 銜接過渡",
        concept: "將談話進行階段性整理，整理矛盾並過渡到下一步行動。",
        front_hint: "談話二十分鐘後，案主表達了對家人的愛、對電腦的抗拒以及對未來的迷茫。",
        back_title: "總結技術範本",
        back_voice: "「阿強，等我整理一下我哋頭先講過嘅野：你中風之後面對好大嘅無力感，亦擔心去學電腦會出醜。但你最珍視嘅價值依然係為家人承擔。你願意在有適當輔助嘅情況下嘗試下報名，但依然會覺得好緊張... 唔知我有無聽錯或者漏左？」",
        back_desc: "結構化的總結能給談話帶來秩序感，並以『我有無聽錯』謙遜結尾，賦權案主確認或修正。"
      },
      {
        title: "引發改變性談話 - 願望與能力",
        concept: "主動發問，誘發案主說出改變的理由（Change Talk），而非我們替他說。",
        front_hint: "引導案主自主表達想要改變的動機。",
        back_title: "引發 Change Talk 範本",
        back_voice: "「阿強，如果你下星期願意鼓起勇氣去踏出第一步上堂，你覺得這對你的仔女、或者對你和太太的關係，會帶來甚麼樣的改變？」",
        back_desc: "引導案主自己去描繪改變帶來的美好未來，自己說服自己，比社工說教一萬句更有效。"
      },
      {
        title: "避免說教 - 諮商克制",
        concept: "克制住給建議的衝動，轉為共情，讓案主成為解決自己問題的專家。",
        front_hint: "挑戰情境：「我真係唔想報名，報左名又讀唔成，咪仲出醜。」",
        back_title: "諮商克制反映範本",
        back_voice: "「你真係好驚如果報咗名但最後學唔識，會帶來更深嘅失敗感。你想百分百確認自己準備好，先行出第一步。」",
        back_desc: "不說『你唔試點知學唔識？』，而是接納他的膽怯。當恐懼被充分同理後，防衛降低，主動嘗試的機會反而大增。"
      }
    ];

    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-clone" style="color:var(--accent-purple);"></i> MI OARS 進階技術 3D 閃卡 deck (8張)</h3>
        <p style="font-size:0.9rem; color:var(--text-muted);">本卡組收錄了動機式訪談法在就業復康的黃金回應話術。點擊卡片翻轉查看話術範本與臨床機制解析。</p>
        
        <div class="flashcard-deck">
          ${oarsCards.map((card, idx) => `
            <div class="card-3d-wrapper" onclick="this.classList.toggle('flipped')">
              <div class="card-3d">
                <!-- Front Side -->
                <div class="card-front" style="border-left:4px solid var(--accent-amber);">
                  <div class="card-front-title" style="color:var(--accent-amber); font-size:1.05rem;">
                    <span style="background:var(--accent-amber); color:#111; width:26px; height:26px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:800;">
                      ${idx + 1}
                    </span>
                    ${card.title}
                  </div>
                  <p style="font-size:0.82rem; color:var(--text-bright); font-weight:700; margin-top:8px;">${card.concept}</p>
                  <div class="card-prompt-question" style="background:rgba(245,158,11,0.06); border-color:var(--accent-amber);">
                    <strong>情境對話挑戰：</strong><br>"${card.front_hint}"
                  </div>
                  <div class="card-tap-hint">
                    <i class="fa-solid fa-arrows-rotate"></i> 點擊翻看話術範本
                  </div>
                </div>
                <!-- Back Side -->
                <div class="card-back" style="border-top: 3px solid var(--accent-amber);">
                  <div class="card-back-title" style="color:var(--accent-amber);">
                    <i class="fa-solid fa-comments"></i> ${card.back_title}
                  </div>
                  <div style="font-size:0.82rem; margin-bottom:8px; line-height:1.4; overflow-y:auto; flex-grow:1;">
                    <strong style="color:var(--accent-cyan);">🗣️ 廣東話專業示範：</strong>
                    <p style="color:var(--text-bright); font-style:italic; font-weight:600; margin:4px 0 8px 0;">${card.back_voice}</p>
                    
                    <strong style="color:var(--accent-green);">🧠 臨床機制解析：</strong>
                    <p style="color:var(--text-main); margin-top:4px;">${card.back_desc}</p>
                  </div>
                  <div class="card-tap-hint">
                    <i class="fa-solid fa-arrows-rotate"></i> 點擊返回正面
                  </div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
    
  } else if (state.activeTheorySubTab === "test") {
    // Gamified OARS Matcher 2.5
    const gameData = data.oars_game[state.miGameIndex];

    if (!gameData) {
      // Record progress
      if (state.theoryProgress) {
        state.theoryProgress.mi.test = true;
        saveTheoryProgress();
      }

      // Milestone 7：徽章判定移入 evaluateAchievement()，只有真的達標才發。
      // 舊版一律 checkAndUnlockAchievements("theory_explorer") —— 走到最後一題就給，
      // 不看分數、不看另外兩個理論分頁，與徽章描述「完美通過」相矛盾。
      checkAndUnlockAchievements("theory_explorer");

      // 滿分由題庫計算，不寫死 100 —— Training Lead 增減題目時自動跟隨。
      const maxScore = miDrillMaxScore(data.oars_game);
      const ratio = maxScore > 0 ? state.miGameScore / maxScore : 0;
      const questionCount = data.oars_game.length;

      const completedTitle = state.locale === "en"
        ? "MI OARS Matcher Challenge complete"
        : state.locale === "zh-CN" ? "MI OARS 实战配对挑战完成" : "MI OARS 實戰配對挑戰完成";

      // 據實陳述得分，不作未達標的掌握宣稱。全選說教型答案在舊版同樣顯示
      // 「你已基本掌握」—— PRD v4「No Claim Without Evidence」禁止之列。
      let verdict;
      if (state.locale === "en") {
        verdict = ratio >= 1
          ? "You chose the strongest OARS response on every item."
          : ratio >= 0.8
          ? "Most items drew an OARS response; a few fell back on advice-giving."
          : "Several items drew advice-giving rather than an OARS response — that is where the righting reflex shows up.";
      } else {
        verdict = ratio >= 1
          ? "你在每一題都選中了最貼近 OARS 精神的回應。"
          : ratio >= 0.8
          ? "大部分題目你都選中了 OARS 回應，仍有幾題落回給建議。"
          : "有幾題你選了說教／過早給建議的回應 —— 那正是「糾正反射」出現的位置。回顧那幾題的解說，比再走一次更有用。";
      }

      const completedDesc = state.locale === "en"
        ? `You answered all ${questionCount} items and scored <strong style="color:var(--accent-green); font-size:1.2rem;">${state.miGameScore}</strong> / ${maxScore}. ${verdict}`
        : `你完成了全部 ${questionCount} 題，得分 <strong style="color:var(--accent-green); font-size:1.2rem;">${state.miGameScore}</strong> / ${maxScore} 分。${verdict}`;
      const btnRetry = state.locale === "en" ? "Retry Challenge" : "重新挑戰";
      const btnBack = state.locale === "en" ? "Back to Study" : "回到自學理論";

      // Game completed, render reset
      container.innerHTML = `
        <div class="glass-card text-center" style="padding:48px 24px; text-align:center;">
          <div style="font-size:4rem; margin-bottom:16px;">${ratio >= 1 ? "🏆" : "📋"}</div>
          <h3 style="font-size:1.6rem; font-weight:800; color:var(--text-bright); margin-bottom:8px;">${completedTitle}</h3>
          <p style="color:var(--text-muted); max-width:520px; margin:0 auto 24px; line-height:1.5;">
            ${completedDesc}
          </p>
          <div style="display:flex; justify-content:center; gap:16px;">
            <button class="btn btn-primary" id="reset-mi-game-btn"><i class="fa-solid fa-arrows-rotate"></i> ${btnRetry}</button>
            <button class="btn" id="mi-back-to-info-btn">${btnBack}</button>
          </div>
        </div>
      `;
      document.getElementById("reset-mi-game-btn").addEventListener("click", () => {
        state.miGameScore = 0;
        state.miGameIndex = 0;
        renderMITab(container);
      });
      document.getElementById("mi-back-to-info-btn").addEventListener("click", () => {
        state.activeTheorySubTab = "info";
        renderTheoryHub(container.parentNode.parentNode); // parent render
      });
      return;
    }

    container.innerHTML = `
      <div class="glass-card mi-game-container">
        <!-- Progress and Score Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="tag tag-amber" style="font-size:0.8rem; font-weight:800;">
            <i class="fa-solid fa-gamepad"></i> 挑戰關卡 ${state.miGameIndex + 1} / ${data.oars_game.length}
          </span>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:120px; background:rgba(255,255,255,0.06); height:8px; border-radius:4px; overflow:hidden;">
              <div style="width:${(state.miGameIndex / data.oars_game.length) * 100}%; background:var(--accent-green); height:100%; transition:width 0.4s ease;"></div>
            </div>
            <span style="font-size:0.9rem; font-weight:800; color:var(--accent-green);">累積積分：${state.miGameScore} 分</span>
          </div>
        </div>

        <!-- Case Statement Area -->
        <div class="case-quote-bubble">
          <div class="quote-label"><i class="fa-solid fa-user-injured"></i> 復康就業案主真實聲音：</div>
          <div class="quote-text">"${gameData.statement}"</div>
        </div>

        <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.4;">
          <strong>小組共同研習挑戰：</strong>請選擇最符合 <b>動機式訪談 (MI) 的專業共情技巧</b>，並能最大化激發案主自主改變動機的回應（避開強加指責與說教反射）：
        </p>

        <!-- Options Grid -->
        <div class="oars-grid">
          ${gameData.options.map((opt, idx) => `
            <div class="oars-option-card" data-idx="${idx}" style="perspective:1000px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span class="oars-badge ${
                  opt.type === 'open_question' ? 'badge-open' :
                  opt.type === 'affirmation' ? 'badge-affirm' :
                  opt.type === 'reflective_listening' ? 'badge-reflect' :
                  opt.type === 'summary' ? 'badge-summary' : 'badge-advice'
                }">${
                  opt.type === 'open_question' ? '開放式提問' :
                  opt.type === 'affirmation' ? '肯定' :
                  opt.type === 'reflective_listening' ? '反映式傾聽' :
                  opt.type === 'summary' ? '總結' : '直接說教'
                }</span>
              </div>
              <p style="font-size:0.88rem; color:var(--text-bright); font-weight:600; line-height:1.4; margin-top:8px;">"${opt.text}"</p>
              <div class="feedback-mount" style="display:none; font-size:0.8rem; border-top:1px dashed var(--card-border); padding-top:8px; margin-top:8px;"></div>
            </div>
          `).join("")}
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:16px;">
          <button class="btn btn-primary" id="mi-next-btn" style="display:none;">進入下一關 <i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </div>
    `;

    // Attach card click handlers
    const cards = container.querySelectorAll(".oars-option-card");
    const nextBtn = document.getElementById("mi-next-btn");

    cards.forEach(card => {
      card.addEventListener("click", (e) => {
        // If already answered, ignore further clicks
        if (nextBtn.style.display === "inline-flex") return;

        const idx = parseInt(card.getAttribute("data-idx"));
        const option = gameData.options[idx];
        
        // Calculate and add score
        state.miGameScore += option.score;

        // If high score (>=8), trigger premium particle confetti burst from click point!
        if (option.score >= 8) {
          AudioSynth.playSuccess();
          triggerConfetti(e.clientX, e.clientY + window.scrollY);
        } else {
          AudioSynth.playError();
        }
        
        // Highlight selections and reveal feedback in HSL glows
        cards.forEach((c, i) => {
          const opt = gameData.options[i];
          const fb = c.querySelector(".feedback-mount");
          fb.style.display = "block";
          fb.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="color:${opt.score >= 8 ? 'var(--accent-green)' : 'var(--accent-rose)'}; font-weight:800;">+${opt.score} 分</span>
              <span style="font-size:0.7rem; color:var(--text-muted);">${opt.score >= 8 ? '✅ 推薦話術' : '❌ 說教警報'}</span>
            </div>
            <p style="color:var(--text-main); font-size:0.78rem; line-height:1.4;">${opt.feedback}</p>
          `;
          
          if (i === idx) {
            c.classList.add("selected");
            c.style.borderColor = opt.score >= 8 ? "var(--accent-green)" : "var(--accent-rose)";
            c.style.boxShadow = opt.score >= 8 ? "0 0 15px rgba(16, 185, 129, 0.25)" : "0 0 15px rgba(244, 63, 94, 0.25)";
          }
        });

        // Show next button
        nextBtn.style.display = "inline-flex";
      });
    });

    nextBtn.addEventListener("click", () => {
      state.miGameIndex++;
      renderMITab(container);
    });
  }
}

// 2C. ICF Biopsychosocial Matrix View
function renderICFTab(container) {
  const data = MOCK_THEORY_DATA.icf;
  
  if (state.activeTheorySubTab === "info") {
    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:20px;">
        <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-network-wired" style="color:var(--accent-cyan);"></i> ICF 生物心理社會模型互動圖</h3>
        <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.5;">${data.description}</p>
        
        <div style="background:var(--nested-bg-medium); border-radius:12px; padding:20px; border:1px solid var(--card-border);">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
            ${data.matrix.map(m => `
              <div style="background:var(--nested-bg-light); border:1px solid var(--card-border); border-radius:8px; padding:16px;">
                <h4 style="font-size:0.95rem; font-weight:800; color:var(--accent-cyan); display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                  <i class="fa-solid ${
                    m.category === 'health_condition' ? 'fa-notes-medical' :
                    m.category === 'body_functions' ? 'fa-stethoscope' :
                    m.category === 'activities' ? 'fa-wheelchair' :
                    m.category === 'participation' ? 'fa-briefcase' :
                    m.category === 'environmental_factors' ? 'fa-building-columns' : 'fa-user'
                  }"></i> ${m.title}
                </h4>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px; line-height:1.4;">${m.desc}</p>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  ${m.hk_examples.map(ex => `
                    <span style="font-size:0.78rem; background:rgba(6,182,212,0.06); border:1px solid rgba(6,182,212,0.15); border-radius:4px; padding:4px 8px; color:var(--text-bright);">${ex}</span>
                  `).join("")}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <!-- Detailed clinical framework explanation section -->
      <div class="glass-card" style="margin-top: 20px; padding: 20px;">
        <h4 style="color: var(--accent-cyan); font-weight: 800; font-size: 1.05rem; margin-bottom: 8px;">
          <i class="fa-solid fa-graduation-cap"></i> ${state.locale === "en" ? "ICF Biopsychosocial Framework in Vocational Rehabilitation" : "ICF 全人評估模型與職業復康臨床整合"}
        </h4>
        <p style="font-size: 0.85rem; color: var(--text-main); line-height: 1.6; margin-bottom: 12px;">
          ${state.locale === "en"
            ? "The WHO ICF (International Classification of Functioning, Disability and Health) shifts focus from 'disability as a disease' to 'functioning as a biopsychosocial dynamic'. In vocational counseling, it acts as a diagnostic bridge:"
            : "世界衛生組織的 ICF (國際功能、殘疾和健康分類) 徹底改變了傳統醫學模式，不再將殘疾僅視為「個人的疾病」，而是視為「生理-心理-社會」之間的動態平衡。在職業輔導中，它是評估的核心骨架："}
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 8px;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px;">
            <h5 style="color: var(--accent-cyan); font-weight: 700; font-size: 0.88rem; margin-bottom: 4px;">
              ${state.locale === "en" ? "1. Bridging Capacity and Performance" : "1. 銜接「個人活動能力」與「社會參與表現」"}
            </h5>
            <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
              ${state.locale === "en"
                ? "ICF distinguishes between <b>Capacity</b> (what a client can do in a standardized test room) and <b>Performance</b> (what they actually do in real life). If capacity is high but performance is low, environmental barriers (e.g. lack of ramp, employer bias) are likely the cause. Our job is to target and remove those barriers."
                : "ICF 區分了<b>個人活動能力 (Capacity)</b>（如案主在標準治療室中單手可以打字）與<b>社會參與表現 (Performance)</b>（如案主在真實辦公室的表現）。若能力高而表現低，說明環境存在阻礙（如無障礙設施不足或僱主偏見），這正是復康同工需要攻堅的焦點。"}
            </p>
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px;">
            <h5 style="color: var(--accent-amber); font-weight: 700; font-size: 0.88rem; margin-bottom: 4px;">
              ${state.locale === "en" ? "2. Balancing Barriers and Facilitators" : "2. 評估「阻礙因子」與「促進因子」"}
            </h5>
            <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
              ${state.locale === "en"
                ? "Environmental and personal factors can act as barriers or facilitators. E.g., a HK government subsidy of up to $40,000 for job accommodation is a major facilitator. Leveraging facilitators (e.g. assistive technology, ERB courses) helps bridge the deficit in body structures."
                : "環境與個人因素兼具雙重屬性。例如，香港在職改裝資助最高4萬港元、復康巴士等即為強大的「環境促進因子」。同工在撰寫 SOAP 計劃時，應積極調配促進因子來代償案主身體功能（如中風偏癱、聽力受損）帶來的局限。"}
            </p>
          </div>
        </div>
      </div>
    `;
    
  } else if (state.activeTheorySubTab === "flashcards") {
    // 6 ICF core cards
    const icfCards = [
      {
        code: "s / b",
        title: "身體功能與結構",
        title_en: "Body Functions & Structures",
        desc: "生理系統功能（包括心理功能）或身體結構的異常與缺損。",
        hk_examples: "右側肢體偏癱、手部精細動作障礙、耐力下降、容易疲勞、下背劇痛。",
        soap_usage: "寫入 SOAP 日誌的 Objective 部分，記錄醫療診斷之外的具體生理受損表現。"
      },
      {
        code: "d (Cap)",
        title: "個人活動能力",
        title_en: "Activities (Capacity)",
        desc: "個體在標準環境（如無壓力評估室）下執行各項基本或複雜任務的最大潛在能力。",
        hk_examples: "無法獨立書寫、無法打字、無法長時間行走、無法面對陌生人流暢回答問題。",
        soap_usage: "作為職業就業評估的基線，反映案主在不受外部外界支持時的真實個人能力上限。"
      },
      {
        code: "d (Perf)",
        title: "社會參與表現",
        title_en: "Participation (Performance)",
        desc: "個體在當前真實生活或工作情境中的投入程度與表現（受環境阻礙或促進影響）。",
        hk_examples: "無法重投小巴司機崗位、因缺乏無障礙環境而待業、因社交恐懼而過度退縮、無法順利面試。",
        soap_usage: "寫入 SOAP 的 Assessment 部分，對比『能力』與『表現』，分析為何案主有能力但真實工作表現受阻。"
      },
      {
        code: "e (Barriers)",
        title: "環境阻礙因素",
        title_en: "Environmental Barriers",
        desc: "物理、社會和態度環境中，阻礙案主融入社會與就業的消極因子。",
        hk_examples: "辦公室無斜道及洗手間、僱主對殘疾有刻板印象、小巴完全無法容納單手駕駛者。",
        soap_usage: "就業配對的攻堅焦點，同工需透過調解或合理便利（Reasonable Accommodation）來予以消除。"
      },
      {
        code: "e (Facilitators)",
        title: "環境促進因素",
        title_en: "Environmental Facilitators",
        desc: "物理、社會和態度環境中，能提升案主活動與社會參與的積極支持因子。",
        hk_examples: "復康巴士服務、政府在職改裝資助最高4萬、再培訓局 (ERB) 適合課程與津貼。",
        soap_usage: "寫入 SOAP 的 Plan 部分，積極調配這些外部政府與機構資源，為案主充權。"
      },
      {
        code: "personal",
        title: "個人背景因素",
        title_en: "Personal Factors",
        desc: "案主的個人背景特性，非健康狀況的一部份（如年齡、學歷、信念、興趣）。",
        hk_examples: "52歲、開車30年無文職經驗、非常疼愛子女極渴望賺錢養家、對電腦有焦慮感。",
        soap_usage: "輔導的出發點，可用以澄清其內在「價值觀」，並作為 MI 談話激發改變動機的抓手。"
      }
    ];

    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-clone" style="color:var(--accent-cyan);"></i> WHO ICF 六大診斷核心 3D 閃卡 deck</h3>
        <p style="font-size:0.9rem; color:var(--text-muted);">點擊以下卡牌翻轉，掌握如何將 ICF 生物心理社會模型應用於職業輔導，以及如何寫入面談紀錄的 SOAP 日誌。</p>
        
        <div class="flashcard-deck">
          ${icfCards.map((card, idx) => `
            <div class="card-3d-wrapper" onclick="this.classList.toggle('flipped')">
              <div class="card-3d">
                <!-- Front Side -->
                <div class="card-front" style="border-left:4px solid var(--accent-cyan);">
                  <div class="card-front-title" style="color:var(--accent-cyan);">
                    <span style="font-size:0.65rem; background:rgba(6,182,212,0.15); border:1px solid rgba(6,182,212,0.3); padding:2px 6px; border-radius:4px; font-weight:800; font-family:monospace; margin-right:6px;">
                      ${card.code}
                    </span>
                    ${card.title}
                  </div>
                  <p style="font-size:0.82rem; color:var(--text-bright); font-weight:700; margin-top:8px; line-height:1.4;">${card.desc}</p>
                  <div class="card-prompt-question" style="background:rgba(6,182,212,0.05); border-color:var(--accent-cyan);">
                    <strong>典型香港就業實例：</strong><br>${card.hk_examples.substring(0, 60)}...
                  </div>
                  <div class="card-tap-hint">
                    <i class="fa-solid fa-arrows-rotate"></i> 點擊翻看 SOAP 日誌技巧
                  </div>
                </div>
                <!-- Back Side -->
                <div class="card-back" style="border-top: 3px solid var(--accent-cyan);">
                  <div class="card-back-title" style="color:var(--accent-cyan);">
                    <i class="fa-solid fa-network-wired"></i> ${card.title} · SOAP 寫作
                  </div>
                  <div style="font-size:0.82rem; margin-bottom:8px; line-height:1.4; overflow-y:auto; flex-grow:1;">
                    <strong style="color:var(--accent-purple);"><i class="fa-solid fa-file-pen"></i> SOAP 寫作應用指引：</strong>
                    <p style="color:var(--text-bright); font-weight:600; margin:4px 0 8px 0;">${card.soap_usage}</p>
                    
                    <strong style="color:var(--accent-amber);"><i class="fa-solid fa-clipboard-list"></i> 歸類示例對照：</strong>
                    <p style="color:var(--text-main); margin-top:4px;">${card.hk_examples}</p>
                  </div>
                  <div class="card-tap-hint">
                    <i class="fa-solid fa-arrows-rotate"></i> 點擊返回正面
                  </div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
    
  } else if (state.activeTheorySubTab === "test") {
    // Dynamic Drag-and-Drop Diagnostic Sandbox (SSOT Compliant)
    if (!state.icfSandboxCaseId) {
      state.icfSandboxCaseId = (state.activeCase && state.activeCase.id) || state.cases[0].id;
    }
    const selectedCase = state.cases.find(c => c.id === state.icfSandboxCaseId) || state.cases[0];
    
    // Initialize stateful factors from single-source activeCase.icf_factors if not already populated
    if (!state.icfSandboxFactors || state.icfSandboxFactorsCaseId !== selectedCase.id) {
      state.icfSandboxFactors = selectedCase.icf_factors.map((f, idx) => ({
        id: `icf-factor-${idx}`,
        text: f.text,
        type: f.type,
        mappedZone: null
      })).sort(() => Math.random() - 0.5); // shuffle
      state.icfSandboxScore = 0;
      state.icfSandboxStatus = "就業研討實驗室就緒。請將左側案主因子標籤，分類拖放到右側正確的 ICF 六大格子中。";
      state.icfSandboxStatusType = "info";
      state.icfSandboxFactorsCaseId = selectedCase.id;
      state.icfSandboxSelectedTouchId = null;
    }

    const unmapped = state.icfSandboxFactors.filter(f => f.mappedZone === null);
    const isCompleted = state.icfSandboxFactors.every(f => f.mappedZone !== null);

    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:20px;">
        <!-- Header & Case selection -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom: 1px solid var(--card-border); padding-bottom: 12px;">
          <div>
            <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-network-wired" style="color:var(--accent-cyan);"></i> ICF 職業復康診斷實戰沙盒 (Diagnostic Sandbox)
            </h3>
            <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
              <span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">選擇模擬案主：</span>
              <select id="icf-case-selector" class="glass-select" style="background: var(--nested-bg-darkest); border:1px solid var(--card-border); border-radius:6px; color:var(--text-bright); padding:4px 8px; font-size:0.82rem; cursor:pointer;">
                ${state.cases.map(c => `
                  <option value="${c.id}" ${c.id === selectedCase.id ? 'selected' : ''}>${c.name} (${c.gender}性，${c.age}歲，${state.locale === 'en' ? c.previous_job : (c.previous_job_zh || c.previous_job)})</option>
                `).join("")}
              </select>
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:6px;">當前案主特徵：${selectedCase.gender}性，${selectedCase.age}歲，${state.locale === 'en' ? selectedCase.previous_job : (selectedCase.previous_job_zh || selectedCase.previous_job)}</p>
          </div>
          
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="text-align:right;">
              <span style="font-size:0.9rem; font-weight:800; color:var(--accent-cyan);">診斷評估得分：${state.icfSandboxScore} 分</span>
              <div style="font-size:0.72rem; color:var(--text-muted);">答對一項 +10分</div>
            </div>
            <button class="btn btn-circle" id="reset-icf-sandbox-btn" style="width:34px; height:34px; background:rgba(255,255,255,0.04);" title="重設沙盒">
              <i class="fa-solid fa-arrows-rotate"></i>
            </button>
          </div>
        </div>

        <!-- Supervisor AI Status Banner -->
        <div style="background:${
          state.icfSandboxStatusType === 'success' ? 'rgba(16, 185, 129, 0.06)' :
          state.icfSandboxStatusType === 'error' ? 'rgba(244, 63, 94, 0.06)' : 'rgba(255,255,255,0.02)'
        }; border-left: 4px solid ${
          state.icfSandboxStatusType === 'success' ? 'var(--accent-green)' :
          state.icfSandboxStatusType === 'error' ? 'var(--accent-rose)' : 'var(--accent-cyan)'
        }; border-radius: 8px; padding: 12px 16px; font-size: 0.85rem; line-height: 1.4; transition: all 0.3s ease;">
          <strong style="color:${
            state.icfSandboxStatusType === 'success' ? 'var(--accent-green)' :
            state.icfSandboxStatusType === 'error' ? 'var(--accent-rose)' : 'var(--accent-cyan)'
          };"><i class="fa-solid fa-user-tie"></i> AI 臨床督導助教：</strong>
          <span style="color:var(--text-main); font-weight:500;">${state.icfSandboxStatus}</span>
        </div>

        ${isCompleted ? `
          <!-- Victory panel -->
          <div style="text-align:center; padding:40px; background:linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(124,58,237,0.06) 100%); border-radius:12px; border:1px solid rgba(6,182,212,0.2);">
            <div style="font-size:3.5rem; margin-bottom:16px;">🏆</div>
            <h4 style="font-size:1.4rem; font-weight:800; color:var(--text-bright); margin-bottom:8px;">完美達成全人 biopsychosocial 職業診斷！</h4>
            <p style="font-size:0.88rem; color:var(--text-muted); max-width:560px; margin:0 auto 20px; line-height:1.5;">
              你已將案主 ${selectedCase.name} 的所有背景特徵因子 100% 精確地分類到 ICF 六大評估維度中。這對你編寫 SOAP 日誌的 Assessment 部分以及在模擬諮商中調配資源至關重要！
            </p>
            <button class="btn btn-primary" id="btn-restart-sandbox"><i class="fa-solid fa-arrows-rotate"></i> 重新模擬評估</button>
          </div>
        ` : `
          <!-- Interactive Drag Matrix Playground -->
          <div class="icf-interactive-board">
            
            <!-- Left: Factors Pool -->
            <div class="glass-card" style="display:flex; flex-direction:column; gap:10px; max-height: 520px; overflow-y: auto;">
              <h4 style="font-size:0.92rem; font-weight:800; color:var(--text-bright); border-bottom:1px solid var(--card-border); padding-bottom:6px; margin-bottom:4px;">
                待分類特徵因子 (${unmapped.length} 個)
              </h4>
              <p style="font-size:0.75rem; color:var(--text-muted); line-height:1.4;">
                <span style="color:var(--accent-cyan); font-weight:700;"><i class="fa-solid fa-computer-mouse"></i> 電腦端：</span> 拖曳左側標籤至右側對應盒子。<br>
                <span style="color:var(--accent-purple); font-weight:700;"><i class="fa-solid fa-fingerprint"></i> 流動端/平板：</span> 點擊左側標籤（亮起紫色），再點擊右側目標盒子即可完成吸附。
              </p>
              
              <div id="icf-sandbox-pool" style="display:flex; flex-direction:column; gap:8px;">
                ${unmapped.map(f => `
                  <div class="icf-source-factor ${state.icfSandboxSelectedTouchId === f.id ? 'selected-touch' : ''}" 
                       draggable="true" 
                       id="${f.id}" 
                       data-type="${f.type}" 
                       style="font-size:0.82rem; cursor: grab; padding:10px 12px;">
                    <i class="fa-solid fa-grip-vertical" style="color:var(--text-muted); margin-right:6px;"></i> ${f.text}
                  </div>
                `).join("")}
              </div>
            </div>

            <!-- Right: ICF Matrix zones -->
            <div style="display:flex; flex-direction:column; gap:16px;">
              <div class="icf-matrix-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                
                <!-- Zone 1: Health Condition -->
                <div class="glass-card icf-drop-zone" data-zone="health_condition" style="min-height:150px; padding:12px;">
                  <h4 style="font-size:0.85rem; font-weight:800; color:var(--accent-rose); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:8px;">
                    <i class="fa-solid fa-notes-medical"></i> 健康狀況
                  </h4>
                  <div class="zone-mount-point" style="display:flex; flex-direction:column; gap:6px;">
                    ${state.icfSandboxFactors.filter(f => f.mappedZone === 'health_condition').map(f => `
                      <span class="spring-snapped" style="font-size:0.75rem; background:rgba(244,63,94,0.08); border:1px solid rgba(244,63,94,0.25); border-radius:4px; padding:4px 8px; color:var(--text-bright);">
                        <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i> ${f.text}
                      </span>
                    `).join("")}
                  </div>
                </div>

                <!-- Zone 2: Body Functions -->
                <div class="glass-card icf-drop-zone" data-zone="body_functions" style="min-height:150px; padding:12px;">
                  <h4 style="font-size:0.85rem; font-weight:800; color:var(--accent-purple); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:8px;">
                    <i class="fa-solid fa-stethoscope"></i> 身體功能與結構
                  </h4>
                  <div class="zone-mount-point" style="display:flex; flex-direction:column; gap:6px;">
                    ${state.icfSandboxFactors.filter(f => f.mappedZone === 'body_functions').map(f => `
                      <span class="spring-snapped" style="font-size:0.75rem; background:rgba(124,58,237,0.08); border:1px solid rgba(124,58,237,0.25); border-radius:4px; padding:4px 8px; color:var(--text-bright);">
                        <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i> ${f.text}
                      </span>
                    `).join("")}
                  </div>
                </div>

                <!-- Zone 3: Activities -->
                <div class="glass-card icf-drop-zone" data-zone="activities" style="min-height:150px; padding:12px;">
                  <h4 style="font-size:0.85rem; font-weight:800; color:var(--accent-cyan); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:8px;">
                    <i class="fa-solid fa-wheelchair"></i> 個人活動 (Capacity)
                  </h4>
                  <div class="zone-mount-point" style="display:flex; flex-direction:column; gap:6px;">
                    ${state.icfSandboxFactors.filter(f => f.mappedZone === 'activities').map(f => `
                      <span class="spring-snapped" style="font-size:0.75rem; background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.25); border-radius:4px; padding:4px 8px; color:var(--text-bright);">
                        <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i> ${f.text}
                      </span>
                    `).join("")}
                  </div>
                </div>

                <!-- Zone 4: Participation -->
                <div class="glass-card icf-drop-zone" data-zone="participation" style="min-height:150px; padding:12px;">
                  <h4 style="font-size:0.85rem; font-weight:800; color:var(--accent-green); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:8px;">
                    <i class="fa-solid fa-briefcase"></i> 社會參與 (Performance)
                  </h4>
                  <div class="zone-mount-point" style="display:flex; flex-direction:column; gap:6px;">
                    ${state.icfSandboxFactors.filter(f => f.mappedZone === 'participation').map(f => `
                      <span class="spring-snapped" style="font-size:0.75rem; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:4px; padding:4px 8px; color:var(--text-bright);">
                        <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i> ${f.text}
                      </span>
                    `).join("")}
                  </div>
                </div>

                <!-- Zone 5: Environmental Factors -->
                <div class="glass-card icf-drop-zone" data-zone="environmental_factors" style="min-height:150px; padding:12px;">
                  <h4 style="font-size:0.85rem; font-weight:800; color:var(--accent-amber); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:8px;">
                    <i class="fa-solid fa-building-columns"></i> 環境因素 (促進/阻礙)
                  </h4>
                  <div class="zone-mount-point" style="display:flex; flex-direction:column; gap:6px;">
                    ${state.icfSandboxFactors.filter(f => f.mappedZone === 'environmental_factors').map(f => `
                      <span class="spring-snapped" style="font-size:0.75rem; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:4px; padding:4px 8px; color:var(--text-bright);">
                        <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i> ${f.text}
                      </span>
                    `).join("")}
                  </div>
                </div>

                <!-- Zone 6: Personal Factors -->
                <div class="glass-card icf-drop-zone" data-zone="personal_factors" style="min-height:150px; padding:12px;">
                  <h4 style="font-size:0.85rem; font-weight:800; color:var(--text-muted); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:8px;">
                    <i class="fa-solid fa-user"></i> 個人背景因素
                  </h4>
                  <div class="zone-mount-point" style="display:flex; flex-direction:column; gap:6px;">
                    ${state.icfSandboxFactors.filter(f => f.mappedZone === 'personal_factors').map(f => `
                      <span class="spring-snapped" style="font-size:0.75rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:4px 8px; color:var(--text-bright);">
                        <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i> ${f.text}
                      </span>
                    `).join("")}
                  </div>
                </div>

              </div>
            </div>

          </div>
        `}
      </div>
    `;

    // Attach Case Selector Event
    const caseSelector = document.getElementById("icf-case-selector");
    if (caseSelector) {
      caseSelector.addEventListener("change", (e) => {
        state.icfSandboxCaseId = e.target.value;
        state.icfSandboxFactors = null; // force reload factors
        renderICFTab(container);
      });
    }

    // Attach Reset Event
    document.getElementById("reset-icf-sandbox-btn").addEventListener("click", () => {
      state.icfSandboxFactors = null;
      renderICFTab(container);
    });

    if (isCompleted) {
      document.getElementById("btn-restart-sandbox").addEventListener("click", () => {
        state.icfSandboxFactors = null;
        renderICFTab(container);
      });
      return;
    }

    // Attach Drag and Drop Events
    const factorCards = container.querySelectorAll(".icf-source-factor");
    const zones = container.querySelectorAll(".icf-drop-zone");

    factorCards.forEach(card => {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", card.id);
        // Clear touch selections if dragging
        state.icfSandboxSelectedTouchId = null;
      });

      // Mobile Touch click select
      card.addEventListener("click", () => {
        if (state.icfSandboxSelectedTouchId === card.id) {
          state.icfSandboxSelectedTouchId = null;
        } else {
          state.icfSandboxSelectedTouchId = card.id;
        }
        renderICFTab(container); // visual state re-render
      });
    });

    zones.forEach(zone => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
      });

      zone.addEventListener("dragleave", () => {
        zone.classList.remove("dragover");
      });

      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        const factorId = e.dataTransfer.getData("text/plain");
        const zoneType = zone.getAttribute("data-zone");
        evaluateICFSandboxMatch(factorId, zoneType, zone, container, e.clientX, e.clientY);
      });

      // Click zone fallback for touch/hybrid controls
      zone.addEventListener("click", (e) => {
        if (state.icfSandboxSelectedTouchId) {
          const factorId = state.icfSandboxSelectedTouchId;
          const zoneType = zone.getAttribute("data-zone");
          state.icfSandboxSelectedTouchId = null; // consume
          evaluateICFSandboxMatch(factorId, zoneType, zone, container, e.clientX, e.clientY);
        }
      });
    });
  }
}

// Unified ICF Drop Match Checker & Evaluator
function evaluateICFSandboxMatch(factorId, zoneType, zoneEl, container, clientX, clientY) {
  const factor = state.icfSandboxFactors.find(f => f.id === factorId);
  if (!factor) return;

  if (factor.type === zoneType) {
    // CORRECT MATCH
    factor.mappedZone = zoneType;
    state.icfSandboxScore += 10;
    
    // AI supervisor detailed encouraging logic review
    let feedback = "";
    if (factor.type === "health_condition") feedback = "這是醫療上的臨床病理診斷，它是整個 biopsychosocial 復康矩陣的起點。";
    else if (factor.type === "body_functions") feedback = "這是具體的生理結構與功能的受損（包括疼痛）。它會直接對個人的任務執行（活動）帶來阻力。";
    else if (factor.type === "activities") feedback = "這關乎個人在不受外界幫助下『能不能做到某件事（如打字、控車）』，即個體活動能力限制 (Capacity)。";
    else if (factor.type === "participation") feedback = "這是有關案主在『社會生活或工作崗位情境』中的真實投入程度 (Performance)。當它受阻時，我們必須介入。";
    else if (factor.type === "environmental_factors") feedback = "環境因素包含物理環境、改裝補貼、以及僱主對殘疾人士的態度。這是我們進行合理便利（Reasonable Accommodation）的最佳抓手。";
    else if (factor.type === "personal_factors") feedback = "案主的個人背景特性（如年齡、學歷、價值觀）並非健康問題，但卻是我們激發其改變動機的最佳切入點。";

    state.icfSandboxStatus = `【精準分類！】『${factor.text}』百分之百屬於『${getICFCategoryChineseName(zoneType)}』。${feedback}`;
    state.icfSandboxStatusType = "success";

    // Play spectacular particle burst!
    const targetX = clientX || window.innerWidth / 2;
    const targetY = clientY || window.innerHeight / 2;
    triggerConfetti(targetX, targetY + window.scrollY);

    // If sandbox completed, send high level AI supervision report
    if (state.icfSandboxFactors.every(f => f.mappedZone !== null)) {
      const selectedCase = state.activeCase || state.cases[0];
      if (state.theoryProgress) {
        state.theoryProgress.icf.test = true;
        saveTheoryProgress();
      }
      state.icfSandboxStatus = state.locale === "en"
        ? `【Mission Accomplished!】 Congratulations on completing the biopsychosocial diagnosis for ${selectedCase.name}!`
        : state.locale === "zh-CN"
        ? `【大功告成！】恭喜同工完成${selectedCase.name}的全人 biopsychosocial 职业复康诊断！`
        : `【大功告成！】恭喜同工完成${selectedCase.name}的全人 biopsychosocial 職業復康診斷！`;
    }

    renderICFTab(container);
  } else {
    // INCORRECT MATCH
    // Shaking neon red alert warning
    zoneEl.classList.add("shake-warning");
    setTimeout(() => zoneEl.classList.remove("shake-warning"), 550);

    let hint = "";
    if (factor.type === "health_condition") hint = "這項特徵屬於醫療上的疾病診斷本身。";
    else if (factor.type === "body_functions") hint = "這項特徵描述的是案主身體系統的生理損傷表現或慢性疼痛。";
    else if (factor.type === "activities") hint = "這屬於個人任務的『執行能力』，描述個體能否做到打字、控車、搬運重物等任務。";
    else if (factor.type === "participation") hint = "這涉及社會生活與工作崗位的『實際參與』受阻（如重投司機崗位、參與常規面試）。";
    else if (factor.type === "environmental_factors") hint = "這關乎外界環境的影響，如無障礙通道、僱主的態度、或是培訓局的課程和津貼支持。";
    else if (factor.type === "personal_factors") hint = "這屬於案主個人的背景特性、過往工作年資、或其對特定事物的內在信念與焦慮。";

    state.icfSandboxStatus = `【診斷校正提示】同工，『${factor.text}』不能歸入『${getICFCategoryChineseName(zoneType)}』中。提示：${hint}請重新審視並再次嘗試！`;
    state.icfSandboxStatusType = "error";

    renderICFTab(container); // refresh status banner
  }
}

// Helpers for ICF names
function getICFCategoryChineseName(category) {
  if (category === "health_condition") return "健康狀況";
  if (category === "body_functions") return "身體功能與結構";
  if (category === "activities") return "個人活動 (Capacity)";
  if (category === "participation") return "社會參與 (Performance)";
  if (category === "environmental_factors") return "環境因素";
  if (category === "personal_factors") return "個人因素";
  return category;
}

/* ==========================================================================
   View 3: Case Arena (Catalog & Generator)
   ========================================================================== */
function renderCaseArena(container) {
  container.innerHTML = `
    <!-- Top Selector Tabs -->
    <div class="arena-mode-switcher" style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:24px;">
      <button class="btn btn-primary" id="view-cases-catalog-btn" style="justify-content:center; padding:14px;"><i class="fa-solid fa-folder-open"></i> ${state.locale === "en" ? "Browse Case Catalog (Dossier Lobby)" : "瀏覽經典復康個案庫 (Dossier Lobby)"}</button>
      <button class="btn" id="view-case-generator-btn" style="justify-content:center; padding:14px;"><i class="fa-solid fa-wand-magic-sparkles"></i> ${state.locale === "en" ? "AI Case Synthesizer (Bio-Gen Pod)" : "AI 智能個案產生器 (Bio-Gen Pod)"}</button>
    </div>

    <!-- Arena Mount Point -->
    <div id="arena-stage-mount"></div>
  `;

  // Attach button triggers
  const catalogBtn = document.getElementById("view-cases-catalog-btn");
  const generatorBtn = document.getElementById("view-case-generator-btn");
  const stageMount = document.getElementById("arena-stage-mount");

  catalogBtn.addEventListener("click", () => {
    catalogBtn.className = "btn btn-primary";
    generatorBtn.className = "btn";
    renderCaseCatalog(stageMount);
  });

  generatorBtn.addEventListener("click", () => {
    catalogBtn.className = "btn";
    generatorBtn.className = "btn btn-primary";
    renderCaseGenerator(stageMount);
  });

  // Default to catalog
  renderCaseCatalog(stageMount);
}

function renderCaseCatalog(container) {
  let selectedFilter = "all";
  let searchText = "";
  
  // Advanced filter parameters
  let filterAge = "all";
  let filterMotivation = "all";
  let filterOrigin = "all";

  container.innerHTML = `
    <!-- High-Tech Dossier Lobby Controls -->
    <div class="dossier-search-wrapper" style="display:flex; flex-direction:column; gap:12px;">
      <div class="dossier-search-row" style="display:flex; gap:16px; align-items:center; width:100%; flex-wrap:wrap;">
        <div class="dossier-search-inner" style="flex-grow:1; min-width:280px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" class="dossier-search-input" id="dossier-search-box" placeholder="${state.locale === 'en' ? 'Search case name, job, or condition...' : '搜尋個案姓名、前職或疾病診斷特徵...'}" />
        </div>
        
        <button class="cyber-filters-toggle" id="cyber-filters-toggle-btn">
          <i class="fa-solid fa-sliders"></i> ${state.locale === 'en' ? 'Advanced Filter Console' : '高級基因篩選控制台'} <i class="fa-solid fa-chevron-down" id="filters-chevron-icon" style="transition:transform 0.3s ease;"></i>
        </button>
      </div>

      <!-- Collapsible Advanced Filters Drawer -->
      <div class="cyber-filters-panel" id="cyber-filters-drawer">
        <div class="cyber-filter-row">
          <!-- 1. Age life stage -->
          <div class="cyber-filter-item">
            <label><i class="fa-solid fa-calendar-day" style="color:var(--accent-cyan);"></i> ${state.locale === 'en' ? 'Life Stage' : '生命階段'}</label>
            <select class="cyber-filter-select" id="filter-age-select">
              <option value="all">${state.locale === 'en' ? 'All Ages' : '全部年齡'}</option>
              <option value="youth">${state.locale === 'en' ? 'Youth (20-29 years old)' : '青年待業期 (20-29 歲)'}</option>
              <option value="middle">${state.locale === 'en' ? 'Middle-aged Transition (30-49 years old)' : '中年轉型期 (30-49 歲)'}</option>
              <option value="elderly">${state.locale === 'en' ? 'Senior (50+ years old)' : '高齡致殘期 (50 歲以上)'}</option>
            </select>
          </div>

          <!-- 2. Motivation Level -->
          <div class="cyber-filter-item">
            <label><i class="fa-solid fa-gauge-simple-high" style="color:var(--accent-purple);"></i> ${state.locale === 'en' ? 'Work Motivation' : '就業與內在動機'}</label>
            <select class="cyber-filter-select" id="filter-motivation-select">
              <option value="all">${state.locale === 'en' ? 'All Motivations' : '全部動機'}</option>
              <option value="low">${state.locale === 'en' ? 'Low Motivation (Resistance)' : '極低動機 (抗拒與逃避期)'}</option>
              <option value="medium">${state.locale === 'en' ? 'Medium Motivation (Ambivalence)' : '中等動機 (糾結與矛盾期)'}</option>
              <option value="good">${state.locale === 'en' ? 'Good Motivation (Action)' : '良好動機 (準備與行動期)'}</option>
            </select>
          </div>

          <!-- 3. Case Origin -->
          <div class="cyber-filter-item">
            <label><i class="fa-solid fa-circle-nodes" style="color:var(--accent-amber);"></i> ${state.locale === 'en' ? 'Case Source' : '檔案來源'}</label>
            <select class="cyber-filter-select" id="filter-origin-select">
              <option value="all">${state.locale === 'en' ? 'All Sources' : '全部來源'}</option>
              <option value="prebuilt">${state.locale === 'en' ? 'Official Cases' : '官方經典案例'}</option>
              <option value="custom">${state.locale === 'en' ? 'AI Generated Cases' : 'AI 智能合成案主'}</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- Primary Category Pills -->
      <div class="dossier-filter-tabs" style="margin-top:8px;">
        <div class="dossier-filter-badge active" data-filter="all" style="--accent-color: var(--accent-purple); --accent-rgb: 124, 58, 237">
          <i class="fa-solid fa-box-archive"></i> ${state.locale === 'en' ? 'All Cases' : '全部個案'}
        </div>
        <div class="dossier-filter-badge" data-filter="physical" style="--accent-color: var(--accent-green); --accent-rgb: 16, 185, 129">
          <i class="fa-solid fa-wheelchair"></i> ${state.locale === 'en' ? 'Hemiplegia' : '肢體偏癱'}
        </div>
        <div class="dossier-filter-badge" data-filter="brain" style="--accent-color: var(--accent-rose); --accent-rgb: 244, 63, 94">
          <i class="fa-solid fa-brain"></i> ${state.locale === 'en' ? 'Stroke' : '腦部中風'}
        </div>
        <div class="dossier-filter-badge" data-filter="mental" style="--accent-color: var(--accent-purple); --accent-rgb: 124, 58, 237">
          <i class="fa-solid fa-hand-holding-heart"></i> ${state.locale === 'en' ? 'Mental Health' : '精神康復'}
        </div>
        <div class="dossier-filter-badge" data-filter="asd" style="--accent-color: var(--accent-purple); --accent-rgb: 124, 58, 237">
          <i class="fa-solid fa-child-reaching"></i> ${state.locale === 'en' ? 'Autism & Dev' : '自閉與發展'}
        </div>
        <div class="dossier-filter-badge" data-filter="chronic" style="--accent-color: var(--accent-amber); --accent-rgb: 245, 158, 11">
          <i class="fa-solid fa-kit-medical"></i> ${state.locale === 'en' ? 'Chronic Pain' : '慢性痛症'}
        </div>
        <div class="dossier-filter-badge" data-filter="sensory" style="--accent-color: var(--accent-cyan); --accent-rgb: 6, 182, 212">
          <i class="fa-solid fa-ear-deaf"></i> ${state.locale === 'en' ? 'Sensory Hearing' : '感官聽障'}
        </div>
      </div>
    </div>
    
    <!-- Holographic Cards Grid -->
    <div class="dossier-grid" id="dossier-cards-grid" style="margin-top: 24px;"></div>
  `;

  const cardsGrid = document.getElementById("dossier-cards-grid");
  const searchBox = document.getElementById("dossier-search-box");
  const filterBadges = container.querySelectorAll(".dossier-filter-badge");
  const toggleFiltersBtn = document.getElementById("cyber-filters-toggle-btn");
  const filtersDrawer = document.getElementById("cyber-filters-drawer");
  const chevronIcon = document.getElementById("filters-chevron-icon");

  // Advanced filter selectors
  const ageSelect = document.getElementById("filter-age-select");
  const motivationSelect = document.getElementById("filter-motivation-select");
  const originSelect = document.getElementById("filter-origin-select");

  // Toggle advanced filter drawer
  toggleFiltersBtn.addEventListener("click", () => {
    const isOpen = filtersDrawer.classList.toggle("open");
    chevronIcon.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
  });

  function getFilteredCases() {
    return state.cases.filter(c => {
      // 1. Filter by category badge
      if (selectedFilter !== "all") {
        const cat = (c.category || "").toLowerCase();
        const condition = (c.health_condition || "").toLowerCase();
        
        if (selectedFilter === "physical" && !cat.includes("肢體") && !condition.includes("偏癱") && !condition.includes("肢體")) return false;
        if (selectedFilter === "brain" && !cat.includes("腦部") && !condition.includes("中風") && !condition.includes("腦")) return false;
        if (selectedFilter === "mental" && !cat.includes("精神") && !condition.includes("抑鬱") && !condition.includes("精神")) return false;
        if (selectedFilter === "asd" && !cat.includes("發展") && !cat.includes("自閉") && !condition.includes("自閉") && !condition.includes("asd")) return false;
        if (selectedFilter === "chronic" && !cat.includes("慢性") && !condition.includes("痛") && !condition.includes("慢性")) return false;
        if (selectedFilter === "sensory" && !cat.includes("感官") && !condition.includes("聽力") && !condition.includes("聽障") && !condition.includes("視障") && !condition.includes("視力")) return false;
      }
      
      // 2. Filter by search text
      if (searchText) {
        const q = searchText.toLowerCase();
        const name = (c.name || "").toLowerCase();
        const prevJob = (c.previous_job || "").toLowerCase();
        const health = (c.health_condition || "").toLowerCase();
        
        if (!name.includes(q) && !prevJob.includes(q) && !health.includes(q)) return false;
      }

      // 3. Filter by Age range
      if (filterAge !== "all") {
        const age = c.age;
        if (filterAge === "youth" && age >= 30) return false;
        if (filterAge === "middle" && (age < 30 || age > 49)) return false;
        if (filterAge === "elderly" && age < 50) return false;
      }

      // 4. Filter by Motivation Stage / Level
      if (filterMotivation !== "all") {
        const mState = (c.emotional_state || "").toLowerCase();
        const flow = JSON.stringify(c.roleplay_flow || []).toLowerCase();
        
        if (filterMotivation === "low") {
          // pre-contemplation / low motivation indicators
          if (!mState.includes("極低") && !mState.includes("抗拒") && !mState.includes("融合") && !flow.includes("極低")) return false;
        } else if (filterMotivation === "medium") {
          // contemplation / mixed anxiety
          if (!mState.includes("中等") && !mState.includes("矛盾") && !mState.includes("糾結") && !flow.includes("矛盾")) return false;
        } else if (filterMotivation === "good") {
          // preparation or high motivation
          if (!mState.includes("良好") && !mState.includes("行動") && !flow.includes("行動")) return false;
        }
      }

      // 5. Filter by Origin
      if (filterOrigin !== "all") {
        const isPrebuilt = BUILTIN_CASE_IDS.has(c.id);
        if (filterOrigin === "prebuilt" && !isPrebuilt) return false;
        if (filterOrigin === "custom" && isPrebuilt) return false;
      }
      
      return true;
    });
  }

  function getCaseThemeClass(c) {
    const cat = (c.category || "").toLowerCase();
    const condition = (c.health_condition || "").toLowerCase();
    if (cat.includes("腦部") || condition.includes("中風") || condition.includes("腦")) return "dossier-neon-rose";
    if (cat.includes("發展") || cat.includes("自閉") || condition.includes("自閉") || condition.includes("asd")) return "dossier-neon-purple";
    if (cat.includes("慢性") || condition.includes("痛") || condition.includes("慢性")) return "dossier-neon-amber";
    if (cat.includes("感官") || condition.includes("聽力") || condition.includes("聽障") || condition.includes("視力") || condition.includes("視障")) return "dossier-neon-cyan";
    if (cat.includes("肢體") || condition.includes("肢體") || condition.includes("偏癱")) return "dossier-neon-green";
    return "dossier-neon-green";
  }

  function renderFilteredCards() {
    const filtered = getFilteredCases();
    if (filtered.length === 0) {
      cardsGrid.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 48px; border: 1px dashed var(--card-border);">
          <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 12px; opacity: 0.5;"></i>
          <h4 style="color: var(--text-bright); font-weight: 700; margin-bottom: 6px;">未尋找到匹配個案檔案</h4>
          <p style="color: var(--text-muted); font-size: 0.85rem;">建議縮短關鍵字，或使用頂部「AI 智能個案產生器」即時合成新個案！</p>
        </div>
      `;
      return;
    }

    cardsGrid.innerHTML = filtered.map(c => {
      const themeClass = getCaseThemeClass(c);
      const isCustom = !BUILTIN_CASE_IDS.has(c.id);
      
      return `
        <div class="dossier-card ${themeClass}" style="transform-style: preserve-3d;">
          ${isCustom ? `<div class="dossier-tag-custom"><i class="fa-solid fa-sparkles"></i> AI 基因合成</div>` : ""}
          <div style="transform-style: preserve-3d;">
            <div class="dossier-header" style="transform-style: preserve-3d;">
              <div class="dossier-avatar-container">${c.avatar || "👤"}</div>
              <span class="dossier-badge-glow">${c.age}歲 / ${c.gender}</span>
            </div>
            
            <h3 class="dossier-title">${c.name}</h3>
            <p class="dossier-diag"><i class="fa-solid fa-dna"></i> 診斷：${c.health_condition}</p>
            
            <table class="dossier-tech-table" style="transform-style: preserve-3d;">
              <tr style="transform-style: preserve-3d;">
                <td class="label-cell">過往前職</td>
                <td class="val-cell">${c.previous_job || "無資料"}</td>
              </tr>
              <tr style="transform-style: preserve-3d;">
                <td class="label-cell">家庭福利</td>
                <td class="val-cell">${c.family || "無資料"}</td>
              </tr>
              <tr style="transform-style: preserve-3d;">
                <td class="label-cell">心理特徵</td>
                <td class="val-cell" style="text-overflow: ellipsis; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; max-height: 40px; line-height: 1.3;">
                  ${c.emotional_state || "無資料"}
                </td>
              </tr>
            </table>
          </div>

          <div class="dossier-card-actions" style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:10px; margin-top:8px; transform-style: preserve-3d;">
            <button class="btn btn-primary start-roleplay-trigger" data-case="${c.id}" style="padding: 10px 4px; justify-content: center; font-size: 0.8rem;">
              <i class="fa-solid fa-comments"></i> 語音對話模擬
            </button>
            <button class="btn start-icf-trigger" data-case="${c.id}" style="padding: 10px 4px; justify-content: center; font-size: 0.8rem;">
              <i class="fa-solid fa-chart-simple"></i> ICF 全人分析
            </button>
          </div>
          <button class="btn btn-share-case" data-case="${c.id}" style="width:100%; justify-content:center; font-size:0.75rem; padding:6px 0; margin-top:8px; border:1px dashed rgba(255,255,255,0.06); background:transparent; color:var(--text-muted);">
            <i class="fa-solid fa-share-nodes"></i> 複製分享基因碼
          </button>
        </div>
      `;
    }).join("");

    // Initialize 3D Mouse Card Tilt animation
    const isDesktop = window.innerWidth > 768;
    const cards = cardsGrid.querySelectorAll(".dossier-card");
    
    cards.forEach(card => {
      if (isDesktop) {
        card.addEventListener("mousemove", (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const xc = rect.width / 2;
          const yc = rect.height / 2;
          const dx = x - xc;
          const dy = y - yc;
          
          // Calculate rotation degrees relative to dimensions
          const rotateX = -(dy / yc) * 7; // max 7 deg rotation
          const rotateY = (dx / xc) * 7; // max 7 deg rotation
          
          card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.025, 1.025, 1.025)`;
        });
        
        card.addEventListener("mouseleave", () => {
          card.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
        });
      } else {
        // Mobile fallback touch response
        card.addEventListener("touchstart", () => {
          card.classList.add("mobile-touch-hover");
        }, { passive: true });
        
        card.addEventListener("touchend", () => {
          setTimeout(() => card.classList.remove("mobile-touch-hover"), 250);
        }, { passive: true });
      }
    });

    // Attach dynamic card triggers
    cardsGrid.querySelectorAll(".start-roleplay-trigger").forEach(btn => {
      btn.addEventListener("click", () => {
        const caseId = btn.getAttribute("data-case");
        const matched = state.cases.find(c => c.id === caseId);
        if (matched) startRoleplaySession(matched);
      });
    });

    cardsGrid.querySelectorAll(".start-icf-trigger").forEach(btn => {
      btn.addEventListener("click", () => {
        const caseId = btn.getAttribute("data-case");
        const matched = state.cases.find(c => c.id === caseId);
        if (matched) startICFAssessment(matched);
      });
    });

    cardsGrid.querySelectorAll(".btn-share-case").forEach(btn => {
      btn.addEventListener("click", () => {
        const caseId = btn.getAttribute("data-case");
        const matched = state.cases.find(c => c.id === caseId);
        if (matched) {
          const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(matched))));
          navigator.clipboard.writeText(encoded)
            .then(() => alert("✅ 複製個案基因碼成功！可以分享此代碼供其他同工導入。"))
            .catch(() => alert("📋 複製失敗，請手動複製控制台輸出：" + encoded));
        }
      });
    });
  }

  // Bind Search events
  searchBox.addEventListener("input", (e) => {
    searchText = e.target.value;
    renderFilteredCards();
  });

  // Bind advanced filter events
  ageSelect.addEventListener("change", (e) => {
    filterAge = e.target.value;
    renderFilteredCards();
  });

  motivationSelect.addEventListener("change", (e) => {
    filterMotivation = e.target.value;
    renderFilteredCards();
  });

  originSelect.addEventListener("change", (e) => {
    filterOrigin = e.target.value;
    renderFilteredCards();
  });

  // Bind Filter tabs events
  filterBadges.forEach(badge => {
    badge.addEventListener("click", () => {
      filterBadges.forEach(b => b.classList.remove("active"));
      badge.classList.add("active");
      selectedFilter = badge.getAttribute("data-filter");
      renderFilteredCards();
    });
  });

  // Initial Render
  renderFilteredCards();
}

// Futuristic character scrambling decrypter typewriter animation
function runDecryptionAnimation(elementId, finalStr, delayMs = 12) {
  const el = document.getElementById(elementId);
  if (!el) return Promise.resolve();
  
  const chars = "XYZ019864275$%&#@§*+=?[]{}<>";
  const len = finalStr.length;
  el.innerHTML = "";
  
  const spans = [];
  for (let i = 0; i < len; i++) {
    const s = document.createElement("span");
    s.className = "decrypted-char decrypting-active";
    s.textContent = chars[Math.floor(Math.random() * chars.length)];
    el.appendChild(s);
    spans.push(s);
  }
  
  const cursor = document.createElement("span");
  cursor.className = "decryption-cursor";
  el.appendChild(cursor);

  return new Promise((resolve) => {
    let index = 0;
    
    function decryptNextChar() {
      if (index >= len) {
        if (cursor.parentNode) cursor.remove();
        resolve();
        return;
      }
      
      spans[index].textContent = finalStr[index];
      spans[index].classList.remove("decrypting-active");
      
      for (let j = index + 1; j < len; j++) {
        if (Math.random() > 0.45) {
          spans[j].textContent = chars[Math.floor(Math.random() * chars.length)];
        }
      }
      
      index++;
      setTimeout(decryptNextChar, delayMs);
    }
    
    decryptNextChar();
  });
}

function renderCaseGenerator(container) {
  container.innerHTML = `
    <div class="synthesis-pod-layout">
      
      <!-- Left Column: Gene Configuration Dials -->
      <div class="synthesis-column">
        <div class="glass-card" style="padding: 24px; position:relative; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--card-border); padding-bottom:10px; margin-bottom:16px;">
            <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright); margin:0;">
              <i class="fa-solid fa-microchip" style="color:var(--accent-purple); margin-right:6px;"></i> 自定義個案合成基因艙 (Bio-Gen Pod)
            </h3>
            <span class="lcd-digital-badge" style="font-size:0.7rem;">POD.v2.5</span>
          </div>
          
          <p style="font-size:0.82rem; color:var(--text-muted); line-height:1.4; margin-bottom:20px;">
            配置底層核心參數，結合 Google Gemini 智慧引擎，在數秒內模擬注入地道香港社會變量，合成包含全套 ICF 分類及港式抗拒對白之就業個案。
          </p>

          <!-- Import external gene code -->
          <div style="background:var(--nested-bg-faint); border:1px dashed var(--card-border); border-radius:10px; padding:12px; margin-bottom:20px;">
            <label style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:6px;"><i class="fa-solid fa-file-import"></i> 導入同工分享的基因碼</label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="synthesis-import-code" placeholder="貼上複製的基因防偽碼..." style="flex-grow:1; background:var(--nested-bg-dark); border:1px solid var(--card-border); border-radius:6px; padding:6px 10px; font-size:0.78rem; color:var(--text-bright); outline:none;" />
              <button class="btn btn-cyan" id="synthesis-import-btn" style="padding:6px 12px; font-size:0.75rem; white-space:nowrap;"><i class="fa-solid fa-arrow-down-left-from-top"></i> 導入寫入</button>
            </div>
          </div>

          <form id="case-gen-form" class="synthesis-form" style="gap:18px;">
            
            <!-- 1. Disability Category Gene Slots -->
            <div class="synthesis-group">
              <label><i class="fa-solid fa-dna"></i> 1. 疾病與障礙基因插槽 (Disability Chip)</label>
              
              <div class="gene-slots-grid">
                <div class="gene-slot-card active" data-value="肢體傷殘 (如肢體偏癱或脊髓損傷)">
                  <i class="fa-solid fa-wheelchair"></i>
                  <div>
                    <div class="gene-slot-title">肢體傷殘</div>
                    <div class="gene-slot-subtitle">肢體偏癱或結構受損</div>
                  </div>
                </div>

                <div class="gene-slot-card" data-value="腦部損傷康復 (如中風、創傷性腦受損)">
                  <i class="fa-solid fa-brain"></i>
                  <div>
                    <div class="gene-slot-title">中風腦損</div>
                    <div class="gene-slot-subtitle">缺血性中風/認知受損</div>
                  </div>
                </div>

                <div class="gene-slot-card" data-value="精神康復 (如重度抑鬱、精神分裂康復者)">
                  <i class="fa-solid fa-hand-holding-heart"></i>
                  <div>
                    <div class="gene-slot-title">精神康復</div>
                    <div class="gene-slot-subtitle">情緒障礙/精神症適應</div>
                  </div>
                </div>

                <div class="gene-slot-card" data-value="神經發展障礙 (如自閉症 ASD、過動症 ADHD)">
                  <i class="fa-solid fa-child-reaching"></i>
                  <div>
                    <div class="gene-slot-title">自閉譜系</div>
                    <div class="gene-slot-subtitle">ASD社交障礙青年</div>
                  </div>
                </div>

                <div class="gene-slot-card" data-value="慢性疾病 (如慢性疼痛、糖尿病或心臟病)">
                  <i class="fa-solid fa-kit-medical"></i>
                  <div>
                    <div class="gene-slot-title">慢性疾病</div>
                    <div class="gene-slot-subtitle">纖維肌痛症/慢性痛症</div>
                  </div>
                </div>

                <div class="gene-slot-card" data-value="感官障礙 (如聽力損失、視力受損)">
                  <i class="fa-solid fa-ear-deaf"></i>
                  <div>
                    <div class="gene-slot-title">感官障礙</div>
                    <div class="gene-slot-subtitle">聽覺障礙/助聽器適應</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Age group custom Neon Slider -->
            <div class="synthesis-group">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label><i class="fa-solid fa-calendar-days"></i> 2. 案主生命階段參數 (Age Stage)</label>
                <span class="lcd-digital-badge" id="lcd-age-text">青年待業期 (20-29 歲)</span>
              </div>
              <input type="range" class="cyber-slider" id="gen-age-slider" min="1" max="3" value="1" />
            </div>

            <!-- 3. Motivation custom Neon Slider -->
            <div class="synthesis-group">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label><i class="fa-solid fa-shield-halved"></i> 3. 心理逃避與動機強度 (ACT Motivation)</label>
                <span class="lcd-digital-badge" id="lcd-motivation-text">極低動機 (抗拒與嚴重逃避期)</span>
              </div>
              <input type="range" class="cyber-slider" id="gen-motivation-slider" min="1" max="3" value="1" />
            </div>

            <!-- 4. Motivation Stage custom Neon Slider -->
            <div class="synthesis-group">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label><i class="fa-solid fa-gauge-simple-high"></i> 4. 改變動機階段分期 (MI Stage)</label>
                <span class="lcd-digital-badge" id="lcd-stage-text">意圖準備前階段 (拒絕就業)</span>
              </div>
              <input type="range" class="cyber-slider" id="gen-stage-slider" min="1" max="3" value="1" />
            </div>

            <div id="gen-error" style="display:none; color:var(--accent-rose); font-size:0.82rem; font-weight:600; background:rgba(244,63,94,0.06); padding:10px; border-radius:8px; border-left:3px solid var(--accent-rose); margin-top:8px;"></div>

            <button type="submit" class="synthesis-btn-run" style="width:100%;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> 啟動生命特徵合成艙 (Begin Synthesis)
            </button>
          </form>
        </div>
      </div>

      <!-- Right Column: Holographic Preview Screen & Output Terminal -->
      <div class="synthesis-column">
        <div class="hologram-preview-screen" id="synthesis-preview-bay">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(6, 182, 212, 0.15); padding-bottom:8px;">
            <span style="font-size:0.75rem; font-weight:800; color:var(--accent-cyan); letter-spacing:0.5px;">
              <i class="fa-solid fa-circle-dot fa-fade" style="color:var(--accent-cyan)"></i> 數據合成全息艙
            </span>
            <span class="lcd-digital-badge" id="preview-status-lcd">SYS.STANDBY</span>
          </div>

          <!-- Rotating DNA helix vector graphic -->
          <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; padding:12px; min-height:180px;">
            <svg class="dna-helix-svg" width="90" height="180" viewBox="0 0 100 200">
              <g fill="none" stroke-width="2.5">
                <!-- Strand A (Cyan) -->
                <path class="dna-strand" d="M25,10 C50,40 50,60 25,90 C0,120 0,140 25,170 C50,200 50,220 25,250" stroke="var(--accent-cyan)" />
                <!-- Strand B (Purple) -->
                <path class="dna-strand" d="M75,10 C50,40 50,60 75,90 C100,120 100,140 75,170 C50,200 50,220 75,250" stroke="var(--accent-purple)" style="animation-delay: -1s;" />
                <!-- Connectors -->
                <line x1="25" y1="20" x2="75" y2="20" stroke="var(--illustration-line)" stroke-dasharray="2 2" />
                <line x1="37" y1="50" x2="63" y2="50" stroke="var(--illustration-line)" stroke-dasharray="2 2" />
                <line x1="75" y1="90" x2="25" y2="90" stroke="var(--illustration-line)" stroke-dasharray="2 2" />
                <line x1="63" y1="130" x2="37" y2="130" stroke="var(--illustration-line)" stroke-dasharray="2 2" />
                <line x1="25" y1="170" x2="75" y2="170" stroke="var(--illustration-line)" stroke-dasharray="2 2" />
              </g>
              <circle cx="25" cy="10" r="3.5" fill="var(--accent-cyan)" />
              <circle cx="75" cy="10" r="3.5" fill="var(--accent-purple)" />
              <circle cx="37" cy="50" r="3.5" fill="var(--accent-cyan)" />
              <circle cx="63" cy="50" r="3.5" fill="var(--accent-purple)" />
              <circle cx="75" cy="90" r="3.5" fill="var(--accent-cyan)" />
              <circle cx="25" cy="90" r="3.5" fill="var(--accent-purple)" />
            </svg>
          </div>

          <!-- Futuristic Log console stream -->
          <div class="hud-log-stream" id="hud-log-stream" style="overflow-y:auto;">
            <p><i class="fa-solid fa-terminal" style="color:var(--accent-cyan);"></i> 生命特徵合成艙載入完畢。系統就緒。</p>
            <p style="color:var(--text-muted);"><i class="fa-solid fa-angle-right"></i> 請點擊左側「啟動生命特徵合成艙」以注入神經參數。</p>
          </div>
        </div>
      </div>

    </div>
  `;

  const form = document.getElementById("case-gen-form");
  const previewBay = document.getElementById("synthesis-preview-bay");
  const logStream = document.getElementById("hud-log-stream");
  const statusLcd = document.getElementById("preview-status-lcd");

  // Neon range slider inputs and LCD labels
  const ageSlider = document.getElementById("gen-age-slider");
  const ageLcd = document.getElementById("lcd-age-text");
  const ageLabels = {
    1: "青年待業期 (20-29 歲)",
    2: "中年轉型期 (30-49 歲)",
    3: "高齡致殘期 (50-62 歲)"
  };
  ageSlider.addEventListener("input", (e) => {
    ageLcd.textContent = ageLabels[e.target.value];
  });

  const motSlider = document.getElementById("gen-motivation-slider");
  const motLcd = document.getElementById("lcd-motivation-text");
  const motLabels = {
    1: "極低動機 (抗拒與嚴重逃避期)",
    2: "中等動機 (糾結與矛盾想求變)",
    3: "良好動機 (準備求職與接受訓練)"
  };
  motSlider.addEventListener("input", (e) => {
    motLcd.textContent = motLabels[e.target.value];
  });

  const stageSlider = document.getElementById("gen-stage-slider");
  const stageLcd = document.getElementById("lcd-stage-text");
  const stageLabels = {
    1: "意圖準備前階段 (拒絕考慮就業)",
    2: "意圖階段 (想改變但重度焦慮)",
    3: "準備與行動階段 (已面試或培訓)"
  };
  stageSlider.addEventListener("input", (e) => {
    stageLcd.textContent = stageLabels[e.target.value];
  });

  // Disability hex gene slots click toggling
  const geneChips = container.querySelectorAll(".gene-slot-card");
  let selectedDisability = "肢體傷殘 (如肢體偏癱或脊髓損傷)";
  
  geneChips.forEach(chip => {
    chip.addEventListener("click", () => {
      geneChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      selectedDisability = chip.getAttribute("data-value");
      
      const briefName = chip.querySelector(".gene-slot-title").textContent;
      addLog(`🧬 切換主板診斷晶片：<b>${briefName}</b>`);
    });
  });

  function addLog(text) {
    const p = document.createElement("p");
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    p.innerHTML = `<span style="color:var(--text-muted)">[${timeStr}]</span> ${text}`;
    logStream.appendChild(p);
    logStream.scrollTop = logStream.scrollHeight;
  }

  // Bind case import logic
  document.getElementById("synthesis-import-btn").addEventListener("click", async () => {
    const code = document.getElementById("synthesis-import-code").value.trim();
    if (!code) {
      alert("請先貼上有效的個案基因碼！");
      return;
    }
    try {
      const decodedData = JSON.parse(decodeURIComponent(escape(atob(code))));
      if (!decodedData.id || !decodedData.name || !decodedData.health_condition) {
        throw new Error("個案數據格式不完整！");
      }
      
      decodedData.id = `imported_${Date.now()}`;
      state.cases.unshift(decodedData);
      
      // ADR-0005：寫入 IndexedDB 保險箱（自定義個案判定改用 BUILTIN_CASE_IDS，
      // 舊版硬編碼 case_01~04 會把三個較新的內建個案誤存為自定義個案並造成重複顯示）。
      await persistCustomCases();
      
      checkAndUnlockAchievements("case_creator");
      alert(`🎉 成功導入個案：${decodedData.name} (${decodedData.health_condition})！已存入大廳。`);
      
      const catalogBtn = document.getElementById("view-cases-catalog-btn");
      if (catalogBtn) catalogBtn.click();
    } catch (err) {
      alert(`導入個案失敗！請檢查金鑰碼是否完整。錯誤訊息：${err.message}`);
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Read from custom sliders and gene slots
    const disabilityType = selectedDisability;
    const ageGroup = ageLabels[ageSlider.value];
    const motivationLevel = motLabels[motSlider.value];
    const motivationStage = stageLabels[stageSlider.value];

    const errorDiv = document.getElementById("gen-error");

    if (!state.apiKey) {
      errorDiv.style.display = "block";
      errorDiv.textContent = "請先在「系統設定」中輸入您的 Gemini API 金鑰 (API Key)，才能開啟自定義 AI 個案生成功能。離線版僅支持內建的經典個案庫。";
      return;
    }

    // High tech Loading scanline dashboard replace
    statusLcd.textContent = "GEN.SYNTHESIZING";
    previewBay.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(6, 182, 212, 0.15); padding-bottom:8px;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--accent-cyan); letter-spacing:0.5px;">
          <i class="fa-solid fa-circle-dot fa-fade" style="color:var(--accent-cyan)"></i> 數據合成全息艙
        </span>
        <span class="lcd-digital-badge" style="color:var(--accent-rose); border-color:rgba(244,63,94,0.3); background:rgba(244,63,94,0.05);">GEN.SCANNING</span>
      </div>

      <div class="synthesis-loading-hud" style="padding: 20px 0; gap: 20px;">
        <div class="loader-scanning-portal" style="width:100px; height:100px;">
          <div class="portal-outer-ring"></div>
          <div class="portal-inner-ring"></div>
          <div class="portal-scanner-dot"></div>
          <i class="fa-solid fa-dna portal-core-icon" style="font-size:1.6rem;"></i>
        </div>
        
        <div class="hud-progress-container">
          <div class="hud-progress-title" id="hud-progress-title" style="font-size:0.95rem;">正在初始化神經電路拓撲...</div>
          <div class="hud-progress-percentage" id="hud-percentage" style="font-size:1.4rem;">0%</div>
          <div class="hud-bar-wrapper" style="width:90%;">
            <div class="hud-bar-fill" id="hud-bar-fill" style="width: 0%; height:100%; background:linear-gradient(90deg, var(--accent-purple), var(--accent-cyan));"></div>
          </div>
        </div>
        
        <div class="hud-log-stream" id="hud-log-stream" style="flex-grow:1; width:100%;">
          <p><i class="fa-solid fa-terminal" style="color:var(--accent-cyan);"></i> Handshaking with Google Gemini API core...</p>
        </div>
      </div>
    `;

    const barFill = document.getElementById("hud-bar-fill");
    const percentageText = document.getElementById("hud-percentage");
    const progressTitle = document.getElementById("hud-progress-title");
    const newLogStream = document.getElementById("hud-log-stream");

    function addInnerLog(text) {
      const p = document.createElement("p");
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      p.innerHTML = `<span style="color:var(--text-muted)">[${timeStr}]</span> ${text}`;
      newLogStream.appendChild(p);
      newLogStream.scrollTop = newLogStream.scrollHeight;
    }

    const options = { disabilityType, ageGroup, motivationLevel, motivationStage };
    let geminiPromise = generateCustomCase(state.apiKey, state.selectedModel, options);
    let geminiResult = null;
    let geminiError = null;

    geminiPromise.then(res => {
      geminiResult = res;
    }).catch(err => {
      geminiError = err;
    });

    let progress = 0;
    const steps = [
      { p: 12, log: `🧬 解構參數晶片：<b>${disabilityType.split(' ')[0]}</b>`, title: "初始化個案基本參數..." },
      { p: 28, log: `🧠 注入年齡參數與心理防禦係數...`, title: "載入心理防衛指標..." },
      { p: 48, log: `🌐 合成地道香港社會關係網與環境福利...`, title: "編排香港本土環境因素..." },
      { p: 68, log: `📊 計算全套 ICF 全人評估六維矩陣...`, title: "生成 ICF 生物心理社會矩陣..." },
      { p: 85, log: `💬 轉譯地道廣東話抗拒心理對話串流...`, title: "編寫港式對白與口訣..." },
      { p: 95, log: `⚙️ API 對話通道與 UI 渲染線程對接...`, title: "建立就業對話系統通道..." },
      { p: 99, log: `⏳ 等待 Gemini 智慧核准基因確認訊號...`, title: "等待 API 最終響應..." }
    ];

    let currentStepIdx = 0;
    
    const timer = setInterval(() => {
      if (geminiError) {
        clearInterval(timer);
        renderError(geminiError.message);
        return;
      }

      if (progress < 99) {
        progress += 1;
        barFill.style.width = `${progress}%`;
        percentageText.textContent = `${progress}%`;
        
        if (currentStepIdx < steps.length && progress >= steps[currentStepIdx].p) {
          const step = steps[currentStepIdx];
          progressTitle.textContent = step.title;
          addInnerLog(step.log);
          currentStepIdx++;
        }
      } else {
        if (geminiResult) {
          clearInterval(timer);
          progress = 100;
          barFill.style.width = `100%`;
          percentageText.textContent = `100%`;
          progressTitle.textContent = "個案基因特徵合成成功！";
          addInnerLog(`⚡ 合成成功！基因序列已完全就緒。`);
          
          setTimeout(async () => {
            geminiResult.category = disabilityType;
            
            // Preview container with Matrix scrambling decryption effects
            previewBay.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(6, 182, 212, 0.15); padding-bottom:8px; margin-bottom:12px;">
                <span style="font-size:0.75rem; font-weight:800; color:var(--accent-green); letter-spacing:0.5px;">
                  <i class="fa-solid fa-circle-check" style="color:var(--accent-green)"></i> 合成核准防偽預覽 (Gen Preview)
                </span>
                <span class="lcd-digital-badge" style="color:var(--accent-green); border-color:rgba(16,185,129,0.3); background:rgba(16,185,129,0.05);">GEN.APPROVED</span>
              </div>

              <!-- Premium custom card visual layout preview -->
              <div class="gen-preview-badge" style="flex-grow:1; display:flex; flex-direction:column; justify-content:space-between; padding:12px 16px; margin:0; background:var(--nested-bg-darkest);">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:1.8rem; background:rgba(6,182,212,0.1); border:1px solid rgba(6,182,212,0.2); width:40px; height:40px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center;">
                      ${geminiResult.avatar || "👤"}
                    </span>
                    <span class="lcd-digital-badge" id="decrypted-age" style="font-size:0.72rem; padding:1px 6px;">[解碼中]</span>
                  </div>

                  <h4 style="font-size:1.15rem; font-weight:900; color:var(--text-bright); margin:0 0 6px 0;" id="decrypted-name">[解碼中]</h4>
                  <p style="font-size:0.78rem; color:var(--accent-cyan); margin:0 0 10px 0; line-height:1.3;" id="decrypted-diag">[解碼中]</p>
                  
                  <div style="border-top:1px dashed rgba(255,255,255,0.08); padding-top:8px; font-size:0.75rem; line-height:1.4; color:var(--text-main); font-style:italic;" id="decrypted-quote">
                    [解碼中]
                  </div>
                </div>

                <div style="display:grid; grid-template-columns: 1.15fr 0.85fr; gap:10px; margin-top:14px;">
                  <button class="btn btn-primary" id="btn-write-to-lobby" style="font-size:0.78rem; padding:8px 0; justify-content:center; display:none;"><i class="fa-solid fa-clipboard-check"></i> 寫入大廳</button>
                  <button class="btn btn-share-case" id="btn-gen-preview-enter" style="font-size:0.78rem; padding:8px 0; justify-content:center; display:none; background:transparent; border-color:rgba(255,255,255,0.15);"><i class="fa-solid fa-comments"></i> 進入輔導</button>
                </div>
              </div>
            `;

            // Run decrypting typewriter scrambling effects on newly created data
            await runDecryptionAnimation("decrypted-name", geminiResult.name);
            await runDecryptionAnimation("decrypted-age", `${geminiResult.age}歲 / ${geminiResult.gender}`);
            await runDecryptionAnimation("decrypted-diag", `🧬 診斷：${geminiResult.health_condition}`);
            await runDecryptionAnimation("decrypted-quote", `🗣️ 地道抗拒對白：\n"${geminiResult.initial_dialogue}"`);

            // Reveal action buttons
            const writeBtn = document.getElementById("btn-write-to-lobby");
            const enterBtn = document.getElementById("btn-gen-preview-enter");
            
            writeBtn.style.display = "inline-flex";
            enterBtn.style.display = "inline-flex";

            // Trigger click particles burst
            writeBtn.addEventListener("click", async (e) => {
              const rect = e.target.getBoundingClientRect();
              triggerConfetti(rect.left + 40, rect.top + window.scrollY);

              if (!state.cases.some(c => c.id === geminiResult.id)) {
                state.cases.unshift(geminiResult);
              }
              await persistCustomCases(); // ADR-0005
              checkAndUnlockAchievements("case_creator");

              alert(`🎉 個案「${geminiResult.name}」已順利寫入大廳首位！`);
              
              // Redirect
              const catalogBtn = document.getElementById("view-cases-catalog-btn");
              if (catalogBtn) catalogBtn.click();
            });

            enterBtn.addEventListener("click", async (e) => {
              const rect = e.target.getBoundingClientRect();
              triggerConfetti(rect.left + 40, rect.top + window.scrollY);

              if (!state.cases.some(c => c.id === geminiResult.id)) {
                state.cases.unshift(geminiResult);
              }
              await persistCustomCases(); // ADR-0005
              checkAndUnlockAchievements("case_creator");
              
              // Direct roleplay enter
              startRoleplaySession(geminiResult);
            });

          }, 800);
        }
      }
    }, 75);

    function renderError(errMsg) {
      statusLcd.textContent = "GEN.ERROR";
      previewBay.innerHTML = `
        <h3 style="color:var(--accent-rose); font-size:1.15rem; font-weight:800; border-bottom:1px solid rgba(244,63,94,0.15); padding-bottom:8px;"><i class="fa-solid fa-triangle-exclamation"></i> 個案合成失敗</h3>
        <p style="color:var(--text-muted); font-size:0.8rem; margin:10px 0;">生命艙出現系統性拒絕或 API 連線中斷：</p>
        <div style="background:rgba(244,63,94,0.06); padding:12px; border-radius:10px; border-left:4px solid var(--accent-rose); color:var(--text-bright); font-family:monospace; font-size:0.78rem; margin-bottom:20px; white-space:pre-wrap; max-height:160px; overflow-y:auto; line-height:1.4;">${errMsg}</div>
        <button class="btn btn-primary" id="btn-synthesis-retry" style="width:100%; justify-content:center;"><i class="fa-solid fa-rotate-left"></i> 重新進入生命艙</button>
      `;
      
      document.getElementById("btn-synthesis-retry").addEventListener("click", () => {
        renderCaseGenerator(container);
      });
    }
  });
}

/* ==========================================================================
   View 4: LIVE 廣東話模擬輔導室 (Roleplay Simulator)
   ========================================================================== */
/**
 * M6：無金鑰且個案沒有預設劇本時，取代面談室的說明狀態。
 * 這是常態情況而非錯誤，因此以正式的介面狀態呈現，不用 alert。
 */
function renderOfflineScriptUnavailable(selectedCase) {
  state.activeView = "roleplay";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");
  if (title) title.textContent = `離線示範模式：${selectedCase.name}`;
  if (subtitle) subtitle.textContent = `此個案未附示範劇本，需要配置 AI 金鑰才能進行對話。`;

  const mount = document.getElementById("content-view-mount");
  mount.innerHTML = `
    <div class="glass-card" style="max-width:620px; margin:40px auto; padding:32px; display:flex; flex-direction:column; gap:18px; text-align:center; align-items:center;">
      <div style="font-size:2.6rem; line-height:1;">${selectedCase.avatar || "👤"}</div>
      <div>
        <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-bright); margin-bottom:6px;">${selectedCase.name} 未附示範劇本</h3>
        <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.7;">
          你目前處於<b style="color:var(--accent-amber);">離線示範模式（未配置 API 金鑰）</b>。<br>
          離線模式只能播放個案自帶的預設劇本，而此個案沒有。<br>
          本平台不會以預先寫好的通用對白冒充案主回應，因此無法在此模式下與他對話。
        </p>
      </div>
      <div style="background:rgba(245,158,11,0.06); border:1px dashed rgba(245,158,11,0.3); border-radius:8px; padding:12px 16px; font-size:0.78rem; color:var(--text-main); line-height:1.6; text-align:left;">
        <i class="fa-solid fa-key" style="color:var(--accent-amber);"></i>
        於「系統設定」輸入 Google Gemini API 金鑰後，即可與<b>任何個案</b>（包括你自行合成的個案）進行真實 AI 廣東話對話。
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
        <button class="btn btn-primary" id="offline-goto-settings-btn"><i class="fa-solid fa-gear"></i> 前往設定頁配置金鑰</button>
        <button class="btn" id="offline-back-to-arena-btn" style="background:var(--nested-bg-medium); border:1px solid var(--card-border); color:var(--text-bright);"><i class="fa-solid fa-arrow-left"></i> 返回個案大廳</button>
      </div>
    </div>
  `;

  const gotoSettings = document.getElementById("offline-goto-settings-btn");
  if (gotoSettings) {
    gotoSettings.addEventListener("click", () => {
      AudioSynth.playClick();
      const link = document.querySelector('.nav-item[data-target="settings"]');
      if (link) link.click();
    });
  }
  const backToArena = document.getElementById("offline-back-to-arena-btn");
  if (backToArena) {
    backToArena.addEventListener("click", () => {
      AudioSynth.playClick();
      // Milestone 8：此路徑未建立 activeSession，述詞本就為 false；
      // 顯式標註以免日後改動時誤加攔截。
      switchView("arena", { skipUnsavedGuard: true });
    });
  }
}

function startRoleplaySession(selectedCase) {
  // M6：無金鑰的離線示範模式只能播放個案自帶的劇本。沒有劇本就不能對話，
  // 也不得以假對白充數（PRD v3: No Fabricated Clinical Content）。
  // 集中在此判斷，四個進入面談的入口自動受同一條規則保護。
  if (!state.apiKey && getScriptedFlow(selectedCase).length === 0) {
    renderOfflineScriptUnavailable(selectedCase);
    return;
  }

  state.activeCase = selectedCase;
  state.activeSession = {
    history: [],
    notes: { soap: "", icf: "" },
    report: null,
    promptModifiers: []
  };
  
  state.activeView = "roleplay";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  
  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");
  title.textContent = `模擬輔導室：對話 ${selectedCase.name}`;
  subtitle.textContent = `請扮演職業復康就業導師，使用 MI & ACT 技巧進行就業輔導與諮商。`;

  const mount = document.getElementById("content-view-mount");
  
  
  mount.innerHTML = `
    <div class="roleplay-room">
      <!-- Left: Dialogue panel -->
      <div class="dialogue-panel">
        
        <!-- Case Info Header & System Speech Helper Notice -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; background:rgba(255,255,255,0.03); padding:8px 16px; border-radius:10px; border:1px solid var(--card-border);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.5rem;" id="rp-active-avatar" class="active-rp-avatar">${selectedCase.avatar}</span>
            <div>
              <h4 style="font-weight:800; color:var(--text-bright); font-size:0.95rem;">${selectedCase.name}</h4>
              <p style="font-size:0.75rem; color:var(--text-muted);">${selectedCase.health_condition} | ${selectedCase.age}歲</p>
            </div>
          </div>
          <button id="rp-speech-toggle-btn" class="speech-control-toggle ${state.isSpeechMuted ? 'muted' : ''}" title="${state.isSpeechMuted ? '點擊開啟案主自動語音朗讀' : '點擊靜音案主自動語音朗讀'}">
            <i class="fa-solid ${state.isSpeechMuted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>
            <span>${state.isSpeechMuted ? '語音輸出已靜音' : '語音輸出已開啟'}</span>
          </button>
        </div>

        <!-- Chrome Cantonese STT Diagnostic Banner -->
        ${(() => {
          const ua = navigator.userAgent.toLowerCase();
          const isChrome = ua.includes("chrome") && !ua.includes("edg");
          if (!isChrome) return '';
          const isOptimal = state.recognitionLang === 'yue-Hant-HK';
          if (isOptimal) return `
            <div id="rp-chrome-stt-banner" style="display:flex; align-items:center; gap:8px; padding:8px 14px; margin-bottom:10px; border-radius:8px; background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.25); font-size:0.78rem; color:var(--accent-cyan); transition:all 0.3s ease;">
              <i class="fa-solid fa-circle-check" style="flex-shrink:0;"></i>
              <span>Chrome 廣東話模式已啟用 (<code style="background:var(--nested-bg-medium); padding:1px 4px; border-radius:3px; font-size:0.72rem;">yue-Hant-HK</code>)。如仍被誤判為普通話，請嘗試<b>無痕視窗</b>訪問。</span>
            </div>
          `;
          return `
            <div id="rp-chrome-stt-banner" style="display:flex; align-items:center; gap:8px; padding:8px 14px; margin-bottom:10px; border-radius:8px; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.3); font-size:0.78rem; color:var(--accent-amber); transition:all 0.3s ease;">
              <i class="fa-solid fa-triangle-exclamation" style="flex-shrink:0;"></i>
              <span>Chrome 目前使用 <code style="background:var(--nested-bg-medium); padding:1px 4px; border-radius:3px; font-size:0.72rem;">${state.recognitionLang}</code>，廣東話可能被誤判為普通話。</span>
              <button id="rp-chrome-fix-btn" class="btn" style="margin-left:auto; padding:3px 10px; font-size:0.72rem; font-weight:700; background:rgba(251,191,36,0.15); border:1px solid rgba(251,191,36,0.4); color:var(--accent-amber); border-radius:6px; cursor:pointer; white-space:nowrap; transition:all 0.2s ease;">一鍵切換 yue-Hant-HK</button>
            </div>
          `;
        })()}

        <!-- Chat Container -->
        <div id="rp-interaction-viewport" style="flex:1 1 0%; min-height:0; display:flex; flex-direction:column; overflow:hidden;">
          <!-- Active chat feed -->
          <div class="dialogue-history" id="rp-chat-history"></div>
        </div>

        <!-- Input Console (Phase 4 upgrade with STT) -->
        <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
          <div class="voice-input-container">
            <button class="btn-voice-mic" id="rp-voice-mic-btn" title="🎙️ 點擊用語音對話 (廣東話)">
              <i class="fa-solid fa-microphone"></i>
            </button>
            <div class="voice-wave-hud" id="rp-voice-wave-hud">
              <canvas id="voice-fft-canvas" width="180" height="30" style="display:none; width:180px; height:30px; border-radius:6px;"></canvas>
              <div class="static-wave-bars" id="rp-static-wave-bars" style="display:flex; gap:3px;">
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
                <div class="wave-bar"></div>
              </div>
            </div>
            <span style="font-size:0.75rem; color:var(--text-muted);" id="rp-voice-status-text">點擊麥克風即可直接講話 (Cantonese STT)</span>
          </div>

          <!-- Phase 13: Empathy Sentiment Heuristics HUD -->
          <div id="rp-empathy-hud" style="display:flex; align-items:center; justify-content:space-between; padding:6px 12px; background:var(--nested-bg-dark); border:1px solid var(--card-border); border-radius:6px; font-size:0.75rem; color:var(--text-muted); transition:all 0.3s ease;">
            <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
              <span id="empathy-hud-indicator-dot" style="width:6px; height:6px; border-radius:50%; background:var(--text-muted); display:inline-block; flex-shrink:0; transition:all 0.3s ease;"></span>
              <span id="empathy-hud-status-text" style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">等待輸入共情反映詞（MI OARS / ACT）...</span>
            </div>
            <span style="font-size:0.62rem; color:rgba(255,255,255,0.25); text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; margin-left:10px;">臨床即時偵測 (Heuristics) - 最終以督導分析為準</span>
          </div>

          <div class="input-console" id="rp-input-console-bar">
            <input type="text" id="rp-text-input" placeholder="輸入你想對案主說的話... 或點擊上方🎙️說話" />
            <button class="btn btn-primary" id="rp-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
          </div>
        </div>

      </div>

      <!-- Right: AI Coach Supervisor & Case Notes -->
      <div class="coach-sidebar">
        
        <!-- Live AI Coach Feedback Box -->
        <div class="glass-card" style="flex:1 1 0%; min-height:0; display:flex; flex-direction:column; gap:10px; overflow-y:auto; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <div class="supervisor-badge">
                <i class="fa-solid fa-user-tie"></i> AI 臨床督導助教 (Coach)
              </div>
              ${!state.apiKey ? `<span id="rp-coach-demo-badge" style="font-size:0.66rem; font-weight:800; letter-spacing:0.3px; color:var(--accent-amber, #f59e0b); background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); padding:2px 7px; border-radius:5px; white-space:nowrap;"><i class="fa-solid fa-clapperboard"></i> 示範劇本</span>` : ""}
            </div>
            <button class="btn btn-primary" id="rp-show-coach-hint-btn" style="padding:4px 8px; font-size:0.7rem; display:flex; align-items:center; gap:4px; height:auto; background:var(--accent-purple);">
              <i class="fa-solid fa-eye-slash"></i> <span id="rp-show-coach-hint-btn-text">${state.locale === "en" ? "Hide Supervisor Suggestion" : "隱藏督導建議回應"}</span>
            </button>
          </div>
          <div id="rp-coach-feedback" style="font-size:0.82rem; color:var(--text-muted); line-height:1.5; background:var(--nested-bg-medium); padding:10px; border-radius:8px; border:1px dashed var(--card-border);">
            ${state.locale === "en" ? "No supervisor analysis yet. It will appear here, already open, as soon as you speak to the client." : "尚未有督導分析。開始與案主對話後，督導提示會即時出現在此處，無需點擊。"}
          </div>
          ${practiceSupportNoticeHTML("margin:0;")}
        </div>

        <!-- Case Notes Workspace -->
        <div class="glass-card" style="flex:1 1 0%; min-height:0; display:flex; flex-direction:column; gap:10px; overflow:hidden; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="notes-tab-group" style="padding:2px; border-radius:6px; position:relative; display:flex; flex-grow:1; max-width:220px;">
              <div class="notes-tab-highlighter" id="rp-notes-tab-highlighter"></div>
              <div class="notes-tab active" id="note-tab-soap" style="font-size:0.72rem; padding:4px 6px; flex:1; text-align:center; position:relative; z-index:2;">SOAP 輔導日誌</div>
              <div class="notes-tab" id="note-tab-icf" style="font-size:0.72rem; padding:4px 6px; flex:1; text-align:center; position:relative; z-index:2;">ICF 臨床評估表</div>
            </div>
            <!-- Milestone 8：草稿的真實狀態。
                 舊版此處是恆亮綠點寫「已安全備份」，並在輸入時播放
                 「同步中... → 已安全備份」的動畫 —— 而草稿只在
                 state.activeSession.notes，從未寫入任何持久層。
                 PRD 明文禁止：「the interface must never claim a draft is
                 saved or backed up when it is not」。
                 刻意**不**改為自動存草稿：PRD OUT OF SCOPE 排除「續接未完成的
                 面談」，本里程碑的職責是把話講真並攔下離開，不是加上該能力。 -->
            <div class="notes-draft-status" id="rp-notes-draft-status" title="面談結束並生成報告後，日誌才會連同逐字紀錄一併寫入本機保險箱。">
              <span class="notes-draft-dot"></span>
              <span class="notes-draft-text">草稿只存在於此分頁 · 面談結束後才寫入保險箱</span>
            </div>
          </div>
          <textarea class="notes-textarea" id="rp-notes-box" placeholder="SOAP 記錄格式：&#10;S (主觀感受)：案主主要申訴與情緒&#10;O (客觀觀察)：面談時的言語與身體反應&#10;A (臨床評估)：使用哪些MI/ACT工具，效果如何&#10;P (未來計劃)：承諾行動細節"></textarea>
        </div>

        <!-- Control Action bar -->
        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:10px;">
          <button class="btn btn-cyan" id="rp-end-session-btn"><i class="fa-solid fa-flag-checkered"></i> 結束會話 & 報告</button>
          <button class="btn btn-danger" id="rp-abort-btn">放棄返回</button>
        </div>

      </div>

      <!-- Phase 6 & 13: Clinical SOAP Assistant & Prompt Intervention Drawer -->
      <div class="soap-assistant-drawer" id="rp-soap-drawer">
        <button class="soap-drawer-toggle" id="rp-soap-drawer-toggle" title="打開/收合 AI 臨床助理">
          <i class="fa-solid fa-brain"></i>
          <span>AI 督導</span>
        </button>
        <div class="soap-drawer-content" style="display:flex; flex-direction:column; overflow:hidden; height:100%;">
          
          <!-- Tab headers inside drawer -->
          <div class="notes-tab-group" style="padding:2px; border-radius:6px; display:flex; margin-bottom:14px; flex-shrink:0;">
            <div class="notes-tab active" id="rp-drawer-tab-soap" style="font-size:0.72rem; padding:6px; flex:1; text-align:center; cursor:pointer;">SOAP 助寫</div>
            <div class="notes-tab" id="rp-drawer-tab-interact" style="font-size:0.72rem; padding:6px; flex:1; text-align:center; cursor:pointer;">督導對弈</div>
          </div>

          <!-- Content Scroll Area -->
            <!-- Tab 1: SOAP Suggestions -->
            <div id="rp-drawer-content-soap" style="display:flex; flex-direction:column; gap:10px;">
              <h4 class="soap-drawer-title"><i class="fa-solid fa-robot"></i> AI SOAP 建議助手</h4>
              <p class="soap-drawer-desc">依據當前模擬會話的上下文，為您實時起草 S-O-A-P 四大範疇的臨床督導記錄建議。</p>
              
              <div class="soap-drawer-results">
                <div class="soap-result-box">
                  <h5>S (主觀感受)</h5>
                  <div class="soap-text-suggestion" id="soap-suggest-s">等待起草...</div>
                </div>
                <div class="soap-result-box">
                  <h5>O (客觀觀察)</h5>
                  <div class="soap-text-suggestion" id="soap-suggest-o">等待起草...</div>
                </div>
                <div class="soap-result-box">
                  <h5>A (臨床評估)</h5>
                  <div class="soap-text-suggestion" id="soap-suggest-a">等待起草...</div>
                </div>
                <div class="soap-result-box">
                  <h5>P (未來計劃)</h5>
                  <div class="soap-text-suggestion" id="soap-suggest-p">等待起草...</div>
                </div>
              </div>
              
              <div style="margin-top:14px; display:flex; flex-direction:column; gap:10px;">
                <button class="btn btn-purple" id="rp-soap-generate-btn" style="width:100%;">
                  <i class="fa-solid fa-wand-magic-sparkles"></i> AI 輔助分析面談
                </button>
                <button class="btn btn-cyan" id="rp-soap-adopt-btn" style="width:100%; display:none;">
                  <i class="fa-solid fa-file-import"></i> 一鍵採納至日誌
                </button>
              </div>
            </div>

            <!-- Tab 2: Prompt Intervention Panel -->
            <div id="rp-drawer-content-interact" style="display:none; flex-direction:column; gap:12px;">
              <h4 class="soap-drawer-title"><i class="fa-solid fa-gamepad"></i> 臨床督導對弈艙</h4>
              <p class="soap-drawer-desc">向模擬艙中注入「即時心理干預指令」，案主在下一句廣東話對白中將產生無縫且極具張力的臨床情緒轉折。</p>
              
              <div style="display:flex; flex-direction:column; gap:6px;">
                <label style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">快捷干預情境 (Quick Presets)</label>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                  <button class="btn btn-intervention" data-intervention="突發極度抗拒及焦慮，對輔導感到憤怒與強烈質疑" style="font-size:0.7rem; padding:6px 4px; justify-content:center; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); color:#ef4444; border-radius:6px; cursor:pointer; font-weight:700;">⚠️ 突發抗拒</button>
                  <button class="btn btn-intervention" data-intervention="痛心流淚，流露出對家人的深切愧疚與照顧家庭的價值熱望" style="font-size:0.7rem; padding:6px 4px; justify-content:center; background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.25); color:var(--accent-cyan); border-radius:6px; cursor:pointer; font-weight:700;">🎯 價值澄清</button>
                  <button class="btn btn-intervention" data-intervention="陷入嚴重的『自我廢人化』與認知融合中，抗拒且極度消極" style="font-size:0.7rem; padding:6px 4px; justify-content:center; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); color:var(--accent-amber); border-radius:6px; cursor:pointer; font-weight:700;">🔥 認知融合</button>
                  <button class="btn btn-intervention" data-intervention="被輔導員打動，防線稍微放鬆，流露出一絲妥協與微弱的改變希望" style="font-size:0.7rem; padding:6px 4px; justify-content:center; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); color:var(--accent-green); border-radius:6px; cursor:pointer; font-weight:700;">🤝 敞開心扉</button>
                </div>
              </div>
              
              <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
                <label style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">自定義干預指令 (Custom Directing)</label>
                <textarea id="rp-intervention-input" style="background:var(--nested-bg-darkest); border:1px solid var(--card-border); color:var(--text-bright); border-radius:6px; padding:8px; font-size:0.75rem; height:65px; resize:none; font-family:inherit; outline:none; transition:border-color 0.2s;" placeholder="輸入你想命令案主表現出的具體情緒狀態或心理防衛反應..."></textarea>
                <button class="btn btn-primary" id="rp-intervention-send-btn" style="margin-top:4px; font-size:0.75rem; padding:6px 12px; justify-content:center; background:linear-gradient(135deg, var(--accent-purple) 0%, #5b21b6 100%); width:100%;">
                  <i class="fa-solid fa-bolt"></i> 注入臨床干預指令
                </button>
              </div>
              
              <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.7rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">已注入干預記錄 (Active Logs)</label>
                <div id="rp-intervention-logs" style="background:var(--nested-bg-dark); border:1px solid var(--card-border); border-radius:6px; padding:8px; min-height:75px; max-height:100px; overflow-y:auto; font-size:0.7rem; font-family:'Courier New', monospace; color:var(--accent-cyan); display:flex; flex-direction:column; gap:4px;">
                  <span style="color:var(--text-muted);">[系統] 目前為預設模擬環境。</span>
                </div>
              </div>
            </div>

          </div>
          
        </div>
      </div>

    </div>
  `;

  // Mount Initial Chat Bubbles
  // 離線模式下開場白同屬預設劇本內容，須一併標示；線上模式它是個案檔案本身
  // 的開場設定，其後回合才是即時生成，故不標示。
  const initBubble = renderChatBubble("ai", selectedCase.initial_dialogue, { scripted: !state.apiKey });
  speakCantonese(selectedCase.initial_dialogue, initBubble);

  // Auto focus input console for rapid dictation or typing
  const textInput = document.getElementById("rp-text-input");
  if (textInput) {
    setTimeout(() => textInput.focus(), 100);
  }

  // Attach SOAP/ICF notes toggling
  const noteSoap = document.getElementById("note-tab-soap");
  const noteIcf = document.getElementById("note-tab-icf");
  const notesBox = document.getElementById("rp-notes-box");

  noteSoap.addEventListener("click", () => {
    if (noteSoap.classList.contains("active")) return; // Prevent silent data corruption
    state.activeSession.notes.icf = notesBox.value; // save current
    noteSoap.classList.add("active");
    noteIcf.classList.remove("active");
    notesBox.value = state.activeSession.notes.soap;
    notesBox.placeholder = `SOAP 記錄格式：\nS (主觀感受)：案主主要申訴與情緒\nO (客觀觀察)：面談時的言語與身體反應\nA (臨床評估)：使用哪些MI/ACT工具，效果如何\nP (未來計劃)：承諾行動細節`;
    
    const highlighter = document.getElementById("rp-notes-tab-highlighter");
    if (highlighter) highlighter.style.transform = "translateX(0%)";
  });

  noteIcf.addEventListener("click", () => {
    if (noteIcf.classList.contains("active")) return; // Prevent silent data corruption
    state.activeSession.notes.soap = notesBox.value; // save current
    noteSoap.classList.remove("active");
    noteIcf.classList.add("active");
    notesBox.value = state.activeSession.notes.icf;
    notesBox.placeholder = `ICF 復康記錄：\n1. 身體功能受損：\n2. 活動局限限制：\n3. 社會參與障礙：\n4. 環境促進或阻礙：\n5. 個人因素引導：`;
    
    const highlighter = document.getElementById("rp-notes-tab-highlighter");
    if (highlighter) highlighter.style.transform = "translateX(100%)";
  });

  // Milestone 8：輸入仍然同步進 state.activeSession.notes（那是真的），
  // 但不再播放任何暗示「已儲存」的動畫或字樣 —— 整個假的儲存狀態機已刪除。
  // 狀態列是一句恆常為真的陳述，不隨輸入變化，因此這裡不需要任何 UI 更新。
  notesBox.addEventListener("input", () => {
    if (noteSoap.classList.contains("active")) {
      state.activeSession.notes.soap = notesBox.value;
    } else {
      state.activeSession.notes.icf = notesBox.value;
    }
  });

  // Send Actions (Text Mode)
  const sendBtn = document.getElementById("rp-send-btn");

  if (sendBtn && textInput) {
    sendBtn.addEventListener("click", () => handleTextSubmit(textInput));
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleTextSubmit(textInput);
    });
  }

  // Attach Show Coach Hint Event
  const hintBtn = document.getElementById("rp-show-coach-hint-btn");
  if (hintBtn) {
    hintBtn.addEventListener("click", () => {
      AudioSynth.playClick();
      const fb = document.getElementById("rp-coach-feedback");
      if (!fb) return;
      setCoachPanelVisible(fb.style.display === "none");
    });
  }

  // Speech Output Toggle (Phase 7)
  const speechToggleBtn = document.getElementById("rp-speech-toggle-btn");
  if (speechToggleBtn) {
    speechToggleBtn.addEventListener("click", () => {
      state.isSpeechMuted = !state.isSpeechMuted;
      localStorage.setItem("rehab_speech_muted", state.isSpeechMuted);
      
      if (state.isSpeechMuted) {
        speechToggleBtn.classList.add("muted");
        speechToggleBtn.title = "點擊開啟案主自動語音朗讀";
        speechToggleBtn.innerHTML = `<i class="fa-solid fa-volume-xmark"></i> <span>語音輸出已靜音</span>`;
        window.speechSynthesis.cancel();
      } else {
        speechToggleBtn.classList.remove("muted");
        speechToggleBtn.title = "點擊靜音案主自動語音朗讀";
        speechToggleBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> <span>語音輸出已開啟</span>`;
      }
    });
  }

  // Initialize Speech Recognition STT (Phase 4)
  initVoiceRecognition(textInput);

  // Chrome Cantonese STT one-click fix banner handler
  const chromeFixBtn = document.getElementById("rp-chrome-fix-btn");
  if (chromeFixBtn) {
    chromeFixBtn.addEventListener("click", () => {
      state.recognitionLang = "yue-Hant-HK";
      localStorage.setItem("rehab_recognition_lang", "yue-Hant-HK");
      // Refresh the recognition lang on the live instance
      if (state.recognition) {
        state.recognition.lang = "yue-Hant-HK";
      }
      // Update banner to success state
      const banner = document.getElementById("rp-chrome-stt-banner");
      if (banner) {
        banner.style.background = "rgba(6,182,212,0.08)";
        banner.style.borderColor = "rgba(6,182,212,0.25)";
        banner.style.color = "var(--accent-cyan)";
        banner.innerHTML = `
          <i class="fa-solid fa-circle-check" style="flex-shrink:0;"></i>
          <span>已切換至 <code style="background:var(--nested-bg-medium); padding:1px 4px; border-radius:3px; font-size:0.72rem;">yue-Hant-HK</code> 廣東話專用模式！下次錄音即生效。</span>
        `;
      }
      AudioSynth.playSuccess();
    });
  }

  // Initialize SOAP Drawer (Phase 6)
  initSoapAssistantDrawer();

  // End Session Action
  document.getElementById("rp-end-session-btn").addEventListener("click", () => endRoleplaySession());
  document.getElementById("rp-abort-btn").addEventListener("click", () => {
    if (confirm("確定放棄本次模擬對話嗎？逐字對話與 SOAP／ICF 草稿將不會保存，且無法復原。")) {
      // Milestone 8：已在此確認過，不得再被守衛問第二次；
      // 同時清掉記憶體副本，否則之後每次導覽都會再問一次同一場已放棄的面談。
      discardActiveInterview();
      switchView("arena", { skipUnsavedGuard: true });
    }
  });
}



function renderChatBubble(sender, text, opts = {}) {
  const chatFeed = document.getElementById("rp-chat-history");
  if (!chatFeed) return null;

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble bubble-${sender}${opts.scripted ? " bubble-scripted" : ""}`;
  
  const meta = document.createElement("div");
  meta.className = "bubble-meta";
  meta.textContent = sender === "user" ? "輔導員 (You)" : `案主 ${state.activeCase.name}`;

  // M6：離線示範的每一則對白都必須看得出是劇本，不可與真實 AI 回應混淆。
  if (opts.scripted) {
    const tag = document.createElement("span");
    tag.className = "bubble-scripted-tag";
    tag.innerHTML = `<i class="fa-solid fa-clapperboard"></i> 示範劇本`;
    meta.appendChild(tag);
  }

  if (sender === "ai") {
    const replayBtn = document.createElement("button");
    replayBtn.className = "bubble-replay-btn";
    replayBtn.title = "重播廣東話語音";
    replayBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i>`;
    replayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      speakCantonese(text, bubble, true);
    });
    meta.appendChild(replayBtn);
  }

  const txt = document.createElement("div");
  txt.textContent = text;

  bubble.appendChild(meta);
  bubble.appendChild(txt);
  chatFeed.appendChild(bubble);

  // Scroll to bottom
  chatFeed.scrollTop = chatFeed.scrollHeight;
  return bubble;
}

async function handleTextSubmit(inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  
  inputEl.value = "";
  await submitMessageToAI(text);
}

async function submitMessageToAI(text) {
  // 1. Render user speech bubble
  renderChatBubble("user", text);

  // Add to session history
  state.activeSession.history.push({ role: "user", text: text });

  // 注入已產生的即時干預指令 (Phase 13 督導對弈)
  // D15：先保留副本。清空發生在 API 呼叫之前，若該回合失敗而不還原，
  // 同工的干預指令會在重試時靜默消失（M5 引入的回歸）。
  const queuedModifiers = (state.activeSession.promptModifiers || []).slice();
  let apiUserText = text;
  if (state.activeSession.promptModifiers && state.activeSession.promptModifiers.length > 0) {
    const modifiersText = state.activeSession.promptModifiers.join("\n");
    apiUserText = `${text}\n\n${modifiersText}`;
    
    // 將干預指令安全寫入會話歷史，讓導出的報告能保留完整的督導干預審計軌跡，但 UI 仍只呈現乾淨的對話
    const lastHistoryItem = state.activeSession.history[state.activeSession.history.length - 1];
    if (lastHistoryItem) {
      lastHistoryItem.text = apiUserText;
    }
    
    state.activeSession.promptModifiers = [];
  }

  // 2. Render typing indicator
  let typingEl = null;
  const chatFeed = document.getElementById("rp-chat-history");
  const activeAvatar = document.getElementById("rp-active-avatar");
  if (activeAvatar) {
    activeAvatar.classList.add("avatar-pulsing-glow");
  }
  if (chatFeed) {
    typingEl = document.createElement("div");
    typingEl.className = "chat-bubble bubble-ai";
    typingEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> 案主正低頭思考回應...`;
    chatFeed.appendChild(typingEl);
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  try {
    // 3. Call Gemini / Mock reply
    // Prepare conversation history context for API (excluding the latest user turn)
    const historyContext = state.activeSession.history.slice(0, -1);
    const { reply, coachHint, scripted } = await generateClientReply(
      state.apiKey,
      state.selectedModel,
      state.activeCase,
      historyContext,
      apiUserText
    );

    // Remove typing
    if (typingEl) typingEl.remove();
    if (activeAvatar) {
      activeAvatar.classList.remove("avatar-pulsing-glow");
    }

    // 4. Add reply to history & render bubble
    //    scripted 一併寫入會話記錄，令匯出給督導的報告能分辨示範與真實練習。
    const modelEntry = { role: "model", text: reply };
    if (scripted) modelEntry.scripted = true;
    state.activeSession.history.push(modelEntry);
    const bubbleEl = renderChatBubble("ai", reply, { scripted: !!scripted });

    // 5. Trigger Cantonese TTS Synthesis
    speakCantonese(reply, bubbleEl);

    // 6. Update AI Coach Feedback Sidebar
    //    PRD v3 (AI Gateway)：督導提示必須「visible by default on arrival」。
    //    仍可由同工手動收合，但絕不預設隱藏。
    const coachFeedback = document.getElementById("rp-coach-feedback");
    if (coachFeedback) {
      coachFeedback.innerHTML = coachHint.replace(/\n/g, "<br>");
      coachFeedback.style.color = "var(--text-main)";
      setCoachPanelVisible(true);
    }

  } catch (error) {
    if (typingEl) typingEl.remove();
    if (activeAvatar) {
      activeAvatar.classList.remove("avatar-pulsing-glow");
    }

    // 失敗回合乾淨回滾：移除這一筆未配對的 user 記錄與其氣泡，
    // 否則它會污染下一回合送出的對話歷史，並使離線模式的 step 計算錯位。
    // 原文回填輸入框讓同工可直接重試，不必重打。
    const lastEntry = state.activeSession.history[state.activeSession.history.length - 1];
    if (lastEntry && lastEntry.role === "user") {
      state.activeSession.history.pop();
    }
    const lastBubble = chatFeed ? chatFeed.lastElementChild : null;
    if (lastBubble && lastBubble.classList.contains("bubble-user")) {
      lastBubble.remove();
    }
    const inputEl = document.getElementById("rp-text-input");
    if (inputEl && !inputEl.value.trim()) {
      inputEl.value = text;
    }

    // D15：把干預指令放回佇列，讓重試仍然帶著同工原本注入的臨床指令。
    if (queuedModifiers.length > 0) {
      state.activeSession.promptModifiers = queuedModifiers.concat(state.activeSession.promptModifiers || []);
    }

    // 離線示範的劇本邊界是常態狀況，不是失敗；措辭必須誠實區分，
    // 否則把正常的「示範播完了」講成系統故障，同樣是誤導。
    const isDemoBoundary = error.code === "OFFLINE_NO_SCRIPT" || error.code === "OFFLINE_SCRIPT_EXHAUSTED";

    // 面板改為中性狀態，不留上一回合的分析假裝成本回合的結果，也不填任何臨床內容。
    const coachFeedback = document.getElementById("rp-coach-feedback");
    if (coachFeedback) {
      if (isDemoBoundary) {
        coachFeedback.textContent = state.locale === "en"
          ? "Demo script finished — no supervisor analysis for this turn. Add an API key in Settings to continue with real AI dialogue."
          : "示範劇本到此為止，本回合沒有督導分析。於「系統設定」配置 API 金鑰後即可繼續真實 AI 對話。";
      } else {
        coachFeedback.textContent = state.locale === "en"
          ? "No supervisor analysis for this turn — the request failed. Your message has been returned to the input box; please try again."
          : "本回合未取得督導分析（請求失敗）。你的發言已放回輸入框，可直接重試。";
      }
      coachFeedback.style.color = "var(--text-muted)";
      setCoachPanelVisible(true);
    }

    alert(isDemoBoundary ? error.message : `對話生成失敗：${error.message}`);
  }
}

/**
 * 督導提示面板顯示狀態的單一控制點：面板與切換按鈕的圖示／文字永遠一致。
 */
function setCoachPanelVisible(visible) {
  const fb = document.getElementById("rp-coach-feedback");
  const btn = document.getElementById("rp-show-coach-hint-btn");
  if (fb) fb.style.display = visible ? "block" : "none";
  if (!btn) return;
  const icon = btn.querySelector("i");
  const text = document.getElementById("rp-show-coach-hint-btn-text");
  if (icon) icon.className = visible ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  if (text) {
    text.textContent = visible
      ? (state.locale === "en" ? "Hide Supervisor Suggestion" : "隱藏督導建議回應")
      : (state.locale === "en" ? "Show Supervisor Suggestion" : "顯示督導建議回應");
  }
}

/* ==========================================================================
   Voice Engine (SpeechSynthesis in Cantonese)
   ========================================================================== */
function initSpeechEngine() {
  // 獨立初始化語音合成播放 (SpeechSynthesis) 的聲音清單，不依賴麥克風辨識支援度
  if (typeof window !== "undefined" && window.speechSynthesis) {
    state.voices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      state.voices = window.speechSynthesis.getVoices();
      // 如果當前處於設定頁面，自動刷新語音下拉選單
      if (state.activeView === "settings") {
        const mount = document.getElementById("content-view-mount");
        if (mount) renderSettings(mount);
      }
    };
  }
}

function stopRecording() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  clearAllSpeakingStates();
  if (state.recognition && state.isRecording) {
    try {
      state.recognition.abort();
    } catch(e) {}
    state.isRecording = false;
  }
  // Defensive Phase 6 cleanup to avoid browser recording indicator leaks
  stopVoiceFFT();
}

function clearAllSpeakingStates() {
  document.querySelectorAll(".chat-bubble.bubble-ai.is-speaking").forEach(b => {
    b.classList.remove("is-speaking");
  });
  const avatar = document.getElementById("rp-active-avatar");
  if (avatar) {
    avatar.classList.remove("speaking-pulse");
  }
  state.activeUtterance = null;
  if (state.activeAudioElement) {
    try {
      state.activeAudioElement.pause();
      state.activeAudioElement.currentTime = 0;
    } catch (e) {}
    state.activeAudioElement = null;
  }
}

/**
 * 輔助函數：將 Hex 編碼或 Base64 字串轉換為 Uint8Array 位元組陣列
 */
function hexToUint8Array(hexString) {
  if (!hexString || typeof hexString !== "string") return null;
  if (!/^[0-9a-fA-F]+$/.test(hexString) || hexString.length % 2 !== 0) {
    try {
      const binaryString = atob(hexString);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      return null;
    }
  }
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * 輔助函數：從 MiniMax JWT API Key (eyJ...) 中自動解析出 Group ID
 */
function extractGroupIdFromJwt(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.trim().split(".");
    if (parts.length >= 2) {
      const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const jsonStr = atob(b64);
      const payload = JSON.parse(jsonStr);
      const gid = payload.group_id || payload.groupId || payload.gid || (payload.sub && /^\d{10,25}$/.test(payload.sub) ? payload.sub : null);
      if (gid) return String(gid);
    }
  } catch (e) {
    // Non-JWT token
  }
  return null;
}

/**
 * 診斷日誌記錄器：向 UI 與內存追加 MiniMax API 追蹤日誌
 */
function appendMiniMaxLog(line) {
  const timeStr = new Date().toLocaleTimeString();
  const formatted = `[${timeStr}] ${line}`;
  if (!state.minimaxLogs) state.minimaxLogs = [];
  state.minimaxLogs.push(formatted);
  
  try {
    localStorage.setItem("rehab_minimax_debug_log", state.minimaxLogs.slice(-50).join("\n"));
  } catch (e) {}

  const logBox = document.getElementById("minimax-debug-log");
  if (logBox) {
    logBox.textContent = state.minimaxLogs.join("\n");
    logBox.scrollTop = logBox.scrollHeight;
  }
}

/**
 * MiniMax 廣東話神經語音合成 API (REST API v2) 帶全程診斷記錄
 */
async function fetchMiniMaxTTSAudio(text, voiceId, apiKey, groupId, isCn = false) {
  const cleanKey = (apiKey || "").replace(/^Bearer\s+/i, "").trim();
  let userGid = (groupId || "").trim();
  const autoGid = extractGroupIdFromJwt(cleanKey);

  appendMiniMaxLog("══════════════════════════════════════════");
  appendMiniMaxLog("🚀 開始 MiniMax 廣東話語音連線診斷流程...");

  if (!cleanKey) {
    appendMiniMaxLog("❌ 錯誤：未輸入任何 API Key！");
    throw new Error("未提供 MiniMax API Key");
  }

  // 遮蔽金鑰輸出以保護同工隱私 (如 sk-ab****1234)
  const maskedKey = cleanKey.length > 10 
    ? `${cleanKey.slice(0, 5)}****${cleanKey.slice(-4)} (長度: ${cleanKey.length})` 
    : `**** (長度: ${cleanKey.length})`;
  appendMiniMaxLog(`🔑 金鑰特徵：${maskedKey}`);

  if (autoGid) {
    appendMiniMaxLog(`🔍 從 JWT 金鑰 Payload 中自動解析出 Group ID: ${autoGid}`);
  } else if (cleanKey.startsWith("sk-")) {
    appendMiniMaxLog(`ℹ️ 金鑰為 sk- 標準格式 (國內版 / 國際版開放平台 API Key)`);
  }

  // 整理候選 Group ID 優先級
  const candidateGids = [];
  if (userGid) candidateGids.push(userGid);
  if (autoGid && !candidateGids.includes(autoGid)) candidateGids.push(autoGid);
  if (!candidateGids.includes("")) candidateGids.push("");

  // 整理候選官方端點 (優先順序)
  const candidateBases = isCn 
    ? [
        "https://api.minimaxi.chat/v1/t2a_v2",
        "https://api.minimax.io/v1/t2a_v2",
        "https://api.minimax.chat/v1/t2a_v2"
      ]
    : [
        "https://api.minimax.io/v1/t2a_v2",
        "https://api.minimax.chat/v1/t2a_v2",
        "https://api.minimaxi.chat/v1/t2a_v2"
      ];

  // 整理候選語音聲線 (Voice ID) 優先級
  let primaryVoice = voiceId || "male-qn-qingse";
  if (primaryVoice === "cantonese_male") primaryVoice = "male-qn-qingse";
  if (primaryVoice === "cantonese_female") primaryVoice = "female-yujie";

  const isFemaleCandidate = primaryVoice.includes("female") || primaryVoice.includes("yujie") || primaryVoice.includes("shaonv") || primaryVoice.includes("tianmei");
  const candidateVoices = isFemaleCandidate 
    ? [primaryVoice, "female-yujie", "female-shaonv", "female-tianmei", "presenter_female"]
    : [primaryVoice, "male-qn-qingse", "male-qn-jingying", "male-qn-daxuesheng", "presenter_male"];

  // 去重
  const uniqueCandidateVoices = [...new Set(candidateVoices)];

  const candidateModels = ["speech-01-turbo", "speech-02-turbo", "speech-2.8-turbo"];
  let lastError = null;
  let attemptCount = 0;

  for (const baseUrl of candidateBases) {
    for (const gid of candidateGids) {
      for (const curVoice of uniqueCandidateVoices) {
        for (const modelName of candidateModels) {
          attemptCount++;
          const targetUrl = gid ? `${baseUrl}?GroupId=${encodeURIComponent(gid)}` : baseUrl;
          appendMiniMaxLog(`\n[嘗試 #${attemptCount}] 發送請求至: ${targetUrl}`);
          appendMiniMaxLog(`參數: model=${modelName}, voice_id=${curVoice}, text="${text.slice(0, 15)}..."`);

          try {
            const payload = {
              model: modelName,
              text: text,
              stream: false,
              language_boost: "Chinese,Yue",
              voice_setting: {
                voice_id: curVoice,
                speed: 1.0,
                vol: 1.0,
                pitch: 0
              },
              audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format: "mp3",
                channel: 1
              }
            };

            const response = await fetch(targetUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${cleanKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(payload)
            });

            appendMiniMaxLog(`HTTP 回應狀態: ${response.status} ${response.statusText}`);

            const rawText = await response.text();
            let result = null;
            try {
              result = JSON.parse(rawText);
            } catch (e) {
              appendMiniMaxLog(`⚠️ 非 JSON 回應內容: ${rawText.slice(0, 200)}`);
            }

            if (result) {
              if (result.base_resp) {
                appendMiniMaxLog(`伺服器返回 base_resp: status_code=${result.base_resp.status_code}, status_msg="${result.base_resp.status_msg || ''}"`);
              }
              if (result.base_resp && result.base_resp.status_code !== 0) {
                const err = new Error(`MiniMax API Error (${result.base_resp.status_code}): ${result.base_resp.status_msg}`);
                err.code = result.base_resp.status_code;
                throw err;
              }
              if (result.data && result.data.audio) {
                appendMiniMaxLog(`🎉 成功獲取音訊二進制數據 (Hex 長度: ${result.data.audio.length})！`);
                const audioBytes = hexToUint8Array(result.data.audio);
                if (!audioBytes) throw new Error("音訊解碼失敗");
                appendMiniMaxLog(`✅ 成功解碼 MP3 音訊流 (聲線: ${curVoice})，準備播放！`);
                const blob = new Blob([audioBytes], { type: "audio/mp3" });
                return URL.createObjectURL(blob);
              }
            }

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${rawText}`);
            }
          } catch (err) {
            lastError = err;
            appendMiniMaxLog(`❌ 該輪嘗試失敗: ${err.message}`);
            if (err.code === 2056) {
              throw new Error("MiniMax (2056 額度不足)：您的帳戶餘額已耗盡，請至控制台充值。");
            }
            // 若錯誤是 2042 (voice_id 權限不足) 或 2049 (金鑰/端點)，繼續嘗試下一個候選組合
            if (err.code && err.code !== 2049 && err.code !== 2042 && err.code !== 1004 && err.code !== 2013) {
              throw err;
            }
          }
        }
      }
    }
  }

  appendMiniMaxLog("══════════════════════════════════════════");
  appendMiniMaxLog("❌ 所有候選端點與 Group ID 組合皆返回 2049。");
  const keyTypeHint = cleanKey.startsWith("sk-") ? `（金鑰格式為 sk- 標準格式）` : `（金鑰為 JWT 格式）`;
  throw new Error(`MiniMax 認證失敗 (Error 2049: invalid api key) ${keyTypeHint}。\n\n請複製下方「🔍 診斷日誌」直接發送給我們，我們將根據伺服器的真實響應為您精確找出原因！`);
}

/**
 * 廣東話雙引擎語音朗讀路由器 (MiniMax Neural TTS + Native Web Speech Fallback)
 */
async function speakCantonese(text, bubbleEl = null, forcePlay = false) {
  // 停止正在播放的所有語音
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (state.activeAudioElement) {
    try {
      state.activeAudioElement.pause();
      state.activeAudioElement.currentTime = 0;
    } catch (e) {}
    state.activeAudioElement = null;
  }
  clearAllSpeakingStates();
  
  if (state.isSpeechMuted && !forcePlay) {
    return;
  }
  
  const cleanText = text.replace(/【.*】/g, "").replace(/\（.*?\）/g, "").replace(/\(.*?\)/g, "").trim();
  if (!cleanText) return;

  const isFemaleCase = state.activeCase && (state.activeCase.gender === "女" || state.activeCase.gender === "Female");

  // 1. 如果啟用了 MiniMax 且已配置 API Key，優先使用 MiniMax 高品質廣東話
  if (state.ttsEngine && state.ttsEngine.startsWith("minimax") && state.minimaxApiKey) {
    const isCn = state.ttsEngine === "minimax-cn";
    const voiceId = isFemaleCase 
      ? (state.minimaxFemaleTimbre || "cantonese_female") 
      : (state.minimaxMaleTimbre || "cantonese_male");

    try {
      if (bubbleEl) bubbleEl.classList.add("is-speaking");
      const avatar = document.getElementById("rp-active-avatar");
      if (avatar) avatar.classList.add("speaking-pulse");

      const audioUrl = await fetchMiniMaxTTSAudio(
        cleanText,
        voiceId,
        state.minimaxApiKey,
        state.minimaxGroupId,
        isCn
      );

      const audio = new Audio(audioUrl);
      state.activeAudioElement = audio;

      audio.onended = () => {
        if (state.activeAudioElement === audio) {
          state.activeAudioElement = null;
          if (bubbleEl) bubbleEl.classList.remove("is-speaking");
          if (avatar) avatar.classList.remove("speaking-pulse");
        }
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = (e) => {
        console.warn("MiniMax Audio playback error, falling back to Web Speech:", e);
        if (state.activeAudioElement === audio) {
          state.activeAudioElement = null;
        }
        URL.revokeObjectURL(audioUrl);
        speakWebSpeech(cleanText, bubbleEl, forcePlay);
      };

      await audio.play();
      return;
    } catch (err) {
      console.warn("MiniMax TTS Request failed, falling back to Web Speech:", err);
      // 降級使用原生 Web Speech 播放
    }
  }

  // 2. 原生 Web Speech 引擎回退
  speakWebSpeech(cleanText, bubbleEl, forcePlay);
}

/**
 * 系統原生 Web Speech 廣東話朗讀引擎
 */
function speakWebSpeech(cleanText, bubbleEl = null, forcePlay = false) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "zh-HK";

  if (state.speechUtteranceRefs) {
    state.speechUtteranceRefs.add(utterance);
    if (state.speechUtteranceRefs.size > 5) {
      const oldestUtterance = state.speechUtteranceRefs.values().next().value;
      state.speechUtteranceRefs.delete(oldestUtterance);
    }
  }
  
  if (state.selectedVoiceName && state.selectedVoiceName !== "") {
    const matched = state.voices.find(v => v.name === state.selectedVoiceName);
    if (matched) utterance.voice = matched;
  } else {
    const hkVoices = state.voices.filter(v => 
      v.lang === "zh-HK" || 
      v.lang === "zh-Hant-HK" || 
      v.lang.toLowerCase().replace(/_/g, "-").startsWith("zh-hk") ||
      v.name.toLowerCase().includes("hong kong") ||
      v.name.toLowerCase().includes("cantonese") ||
      v.name.toLowerCase().includes("sin-ji")
    );
    
    if (hkVoices.length > 0) {
      const isFemaleCase = state.activeCase && (state.activeCase.gender === "女" || state.activeCase.gender === "Female");
      let selectedVoice = null;
      
      if (isFemaleCase) {
        const femaleKeywords = ["sin-ji", "tracy", "hiumaan", "ting-ting", "yu-ting", "female", "szemin"];
        selectedVoice = hkVoices.find(v => femaleKeywords.some(kw => v.name.toLowerCase().includes(kw)));
      } else {
        const maleKeywords = ["danny", "wanlung", "limu", "male", "kangkang"];
        selectedVoice = hkVoices.find(v => maleKeywords.some(kw => v.name.toLowerCase().includes(kw)));
      }
      
      if (!selectedVoice) selectedVoice = hkVoices[0];
      utterance.voice = selectedVoice;
    }
  }

  let rate = 1.05;
  let pitch = 1.0;
  
  if (state.activeCase) {
    const emotion = (state.activeCase.emotional_state || "").toLowerCase();
    const isAnxious = emotion.includes("抗拒") || emotion.includes("焦慮") || emotion.includes("憤怒");
    const isDepressed = emotion.includes("沮喪") || emotion.includes("低落") || emotion.includes("無力") || emotion.includes("悲觀");
    
    if (isAnxious) {
      rate = 1.15;
      pitch = 1.06;
    } else if (isDepressed) {
      rate = 0.90;
      pitch = 0.92;
    }
  }
  
  utterance.rate = rate;
  utterance.pitch = pitch;
  state.activeUtterance = utterance;

  utterance.onstart = () => {
    if (state.activeUtterance !== utterance) return;
    if (bubbleEl) bubbleEl.classList.add("is-speaking");
    const avatar = document.getElementById("rp-active-avatar");
    if (avatar) avatar.classList.add("speaking-pulse");
  };

  const cleanup = () => {
    if (state.speechUtteranceRefs) {
      state.speechUtteranceRefs.delete(utterance);
    }
    if (state.activeUtterance === utterance) {
      if (bubbleEl) bubbleEl.classList.remove("is-speaking");
      const avatar = document.getElementById("rp-active-avatar");
      if (avatar) avatar.classList.remove("speaking-pulse");
      state.activeUtterance = null;
    }
  };

  utterance.onend = cleanup;
  utterance.onerror = (e) => {
    console.warn("Web Speech Utterance error:", e);
    cleanup();
  };

  // 語音前置聲學呼吸 (Breathing Acoustic Cue)
  if (cleanText.includes("…") || cleanText.includes("...") || Math.random() < 0.3) {
    AudioSynth.playSigh();
    setTimeout(() => {
      if (state.activeUtterance === utterance) {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.speak(utterance);
        }
      }
    }, 280);
    return;
  }

  window.speechSynthesis.speak(utterance);
}

/* ==========================================================================
   Session Report & Evaluation
   ========================================================================== */
/**
 * Milestone 8：「正在評估」的**非破壞性**覆蓋層。
 * 疊在面談房間之上而不取代它，失敗時移除即可完整退回。
 */
let evaluatingOverlayPrevPosition = null;

function showEvaluatingOverlay(mount) {
  hideEvaluatingOverlay();
  if (!mount) return;
  // 覆蓋層以 absolute 定位在 mount 之內，故 mount 需為定位參考點。
  // D36：記住進入前的 inline 值，離開時原樣還原（此前永久留下 position:relative）。
  if (getComputedStyle(mount).position === "static") {
    evaluatingOverlayPrevPosition = mount.style.position;
    mount.style.position = "relative";
  }
  const overlay = document.createElement("div");
  overlay.id = "rp-evaluating-overlay";
  overlay.className = "evaluating-overlay";
  overlay.innerHTML = `
    <div class="evaluating-overlay-card">
      <i class="fa-solid fa-spinner fa-spin evaluating-overlay-spinner"></i>
      <h3 class="evaluating-overlay-title">正在評估你的輔導技巧…</h3>
      <p class="evaluating-overlay-body">
        AI 臨床督導正在分析你的會話歷史紀錄，評估同理心反映、OARS 技巧、ACT 價值澄清引導，
        並為你生成一份能力評估雷達圖，這大概需要 5-8 秒…
      </p>
      <p class="evaluating-overlay-note">
        <i class="fa-solid fa-shield-halved"></i>
        面談內容仍在畫面上。即使評估失敗，逐字紀錄與日誌都不會遺失。
      </p>
    </div>
  `;
  mount.appendChild(overlay);
}

function hideEvaluatingOverlay() {
  const overlay = document.getElementById("rp-evaluating-overlay");
  if (!overlay) return;
  const mount = overlay.parentElement;
  overlay.remove();
  if (mount && evaluatingOverlayPrevPosition !== null) {
    mount.style.position = evaluatingOverlayPrevPosition;
    evaluatingOverlayPrevPosition = null;
  }
}

async function endRoleplaySession() {
  if (state.activeSession.history.length === 0) {
    alert("尚未開始對話，無法結束會話。");
    return;
  }

  if (!confirm("確定要結束本次模擬輔導，並生成督導評估報告嗎？")) {
    return;
  }

  stopRecording();

  const mount = document.getElementById("content-view-mount");

  // ⚠️ Milestone 8：這裡**不可以**覆寫 mount。舊版以 mount.innerHTML 換掉整個
  //    面談房間，於是評估一旦失敗就無路可退 —— 房間 DOM 沒了，而重新呼叫
  //    startRoleplaySession() 會重建 state.activeSession，把整場面談抹掉。
  //    當時的程式因此只能 switchView("arena")，等於由程式自己丟棄同工的面談。
  //    改為疊一層覆蓋層：失敗時移除覆蓋層，房間與逐字紀錄原封不動。
  showEvaluatingOverlay(mount);

  // 離線示範模式沒有 AI，因此沒有臨床評估 —— 但逐字紀錄與 SOAP／ICF 日誌是同工
  // 的真實工作產物，不能因為缺少評分就整場丟棄。故此處只在「有金鑰卻失敗」時中止。
  let report = null;
  try {
    report = await generateSessionReport(state.apiKey, state.selectedModel, state.activeCase, state.activeSession.history);
  } catch (error) {
    if (error.code !== "OFFLINE_NO_EVALUATION") {
      hideEvaluatingOverlay();
      AudioSynth.playError();
      // 留在房間裡。同工可以再按一次「結束會話」重試，或按「放棄返回」
      // （該鈕會確認）。逐字對話、SOAP、ICF、干預佇列全部保持原狀。
      alert(`評估報告生成失敗：${error.message}\n\n本次面談仍保留在畫面上，未有任何內容遺失。你可以再試一次「結束會話」，或先匯出逐字紀錄。`);
      return;
    }
    // 離線：report 維持 null，往下照常保存面談本身。
  }

  try {
    state.activeSession.report = report;
    
    // D7：完成場次與已完成個案 id 不再另存一份 —— sessions object store 是唯一
    // 權威來源，統計一律由 computeCounselorRecord() 從它推導。

    // Save completed session to local history portfolio (Phase 5)
    const completedSession = {
      id: "session_" + Date.now(),
      date: new Date().toLocaleString(state.locale === "en" ? "en-US" : state.locale === "zh-CN" ? "zh-CN" : "zh-HK"),
      caseId: state.activeCase.id,
      caseName: state.activeCase.name,
      caseAvatar: state.activeCase.avatar || "👤",
      caseDiagnostic: state.activeCase.diagnostic || "",
      history: JSON.parse(JSON.stringify(state.activeSession.history)),
      notes: JSON.parse(JSON.stringify(state.activeSession.notes)),
      report: report
    };
    
    // ADR-0005：寫入 IndexedDB 保險箱並同步更新記憶體副本。
    const persisted = await persistCompletedSession(completedSession);
    // 寫入失敗時記住這一筆，好讓警示卡的「重試寫入」不必重跑 AI 評估
    // （那會再消耗一次金鑰額度，而評估其實已經成功了）。
    pendingVaultWrite = persisted.ok ? null : completedSession;

    // 入庫**成功之後**才標記。這是 hasUnsavedInterview() 的關鍵條件 ——
    // 在此之前離開就是真的失去，之後離開則已有持久副本。
    // 只存在於記憶體，不進入 completedSession，因此不寫入任何 object store。
    //
    // ⚠️ 寫入失敗時刻意**不設** vaultedAt：那場面談確實還沒有持久副本，
    //    守衛必須繼續保護它，讓同工有機會匯出或重試。
    if (persisted.ok) {
      state.activeSession.vaultedAt = new Date().toISOString();
    }
    hideEvaluatingOverlay();

    if (persisted.ok) {
      AudioSynth.playSuccess();
    } else {
      AudioSynth.playError();
    }

    // Trigger Achievements Check（條件由 evaluateAchievement() 依保險箱紀錄判定）
    const recordAfterSession = computeCounselorRecord(state.historySessions);
    checkAndUnlockAchievements("first_session");
    checkAndUnlockAchievements("empathy_master");
    if (recordAfterSession.distinctCaseIds.size >= 3) {
      checkAndUnlockAchievements("combat_specialist");
    }

    renderSessionReport(mount, report, persisted);
  } catch (error) {
    hideEvaluatingOverlay();
    AudioSynth.playError();
    alert(`評估報告生成失敗：${error.message}`);
    // Milestone 8：不豁免守衛 —— 若面談尚未入庫，離開前必須先問過同工。
    switchView("arena");
  }
}

/**
 * 寫入保險箱失敗時的警示卡。
 *
 * PRD：「the interface must never claim a draft is saved or backed up when it is not」。
 * 此前兩個完成畫面都寫死「已存入保險箱」，寫入失敗時那是不實陳述。
 * 匯出在此刻是同工唯一能保住這場面談的方法，故把它講明。
 */
let pendingVaultWrite = null;

function renderVaultWriteFailureCard(persisted) {
  if (!persisted || persisted.ok) return "";
  return `
    <div class="vault-write-failure-card">
      <h4 class="vault-write-failure-title">
        <i class="fa-solid fa-triangle-exclamation"></i> 這場面談<strong>未能存入保險箱</strong>
      </h4>
      <p class="vault-write-failure-body">
        原因：${persisted.reason || "未知錯誤"}<br>
        評估已經完成，下方內容都是真實的，但它<strong>還沒有持久副本</strong> ——
        關閉分頁就會失去。
      </p>
      <p class="vault-write-failure-body">
        <strong>請先按下方的「匯出」把這場面談存成檔案</strong>，那是此刻最穩妥的作法。
        評估不必重跑 —— 按「重試寫入保險箱」會直接把同一份紀錄再送一次。
      </p>
      <div class="vault-write-failure-actions">
        <button class="btn btn-primary" id="vault-retry-write-btn">
          <i class="fa-solid fa-rotate"></i> 重試寫入保險箱
        </button>
      </div>
      <p class="vault-write-failure-status" id="vault-retry-write-status" hidden></p>
    </div>
  `;
}

/**
 * 把「重試寫入保險箱」接上事件。渲染完警示卡的畫面都要呼叫一次。
 * 成功後就地更新畫面：設 vaultedAt（守衛因此放行）、換掉警示卡、修正標題。
 */
function bindVaultRetryWrite() {
  const btn = document.getElementById("vault-retry-write-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (!pendingVaultWrite) return;
    AudioSynth.playClick();
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 寫入中…`;
    const status = document.getElementById("vault-retry-write-status");

    const result = await writeSessionToVault(pendingVaultWrite);

    if (result.ok) {
      pendingVaultWrite = null;
      if (state.activeSession) state.activeSession.vaultedAt = new Date().toISOString();
      AudioSynth.playSuccess();
      const card = document.querySelector(".vault-write-failure-card");
      if (card) {
        card.classList.add("vault-write-recovered");
        card.innerHTML = `
          <h4 class="vault-write-failure-title vault-write-recovered-title">
            <i class="fa-solid fa-circle-check"></i> 已成功存入保險箱
          </h4>
          <p class="vault-write-failure-body">
            這場面談現在有持久副本了，可在「學習分析」查閱。
          </p>
        `;
      }
      const title = document.getElementById("view-title");
      if (title) title.textContent = title.textContent.replace("（未存入保險箱）", "");
    } else {
      AudioSynth.playError();
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      if (status) {
        status.hidden = false;
        status.textContent = `仍然無法寫入：${result.reason || "未知錯誤"}　請先匯出保存。`;
      }
    }
  });
}

/**
 * 離線示範模式完成面談後的畫面。
 * 只呈現真實存在的內容：逐字回顧與同工自己撰寫的日誌。
 * 不畫雷達、不給等第、不編臨床總結 —— 沒有 AI 就沒有 AI 評估。
 */
function renderSessionCompletedWithoutEvaluation(container, persisted) {
  const vaulted = !persisted || persisted.ok;
  const title = document.getElementById("view-title");
  if (title) title.textContent = `面談已完成：${state.activeCase.name}`;

  const historyText = state.activeSession.history
    .map(h => `${h.role === "user" ? "輔導員" : "案主"}${h.scripted ? "［示範劇本］" : ""}：${h.text}`)
    .join("\n");
  const notes = state.activeSession.notes || {};

  container.innerHTML = `
    <div class="glass-card" style="max-width:820px; margin:0 auto; padding:28px; display:flex; flex-direction:column; gap:20px;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright);">${vaulted ? "面談已完成並存入保險箱" : "面談已完成，但未能存入保險箱"}</h3>
        <span style="font-size:0.66rem; font-weight:800; letter-spacing:0.3px; color:var(--accent-amber); background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); padding:2px 7px; border-radius:5px; white-space:nowrap;"><i class="fa-solid fa-clapperboard"></i> 離線示範</span>
      </div>

      <div style="background:rgba(245,158,11,0.06); border:1px dashed rgba(245,158,11,0.3); border-radius:8px; padding:14px 16px; font-size:0.82rem; color:var(--text-main); line-height:1.7;">
        <b style="color:var(--accent-amber);">本次沒有臨床評估。</b>
        離線示範模式沒有 AI 參與，因此沒有雷達評分，也沒有督導總結 ——
        本平台不會用預先寫好的分數與評語冒充 AI 評估。<br>
        ${vaulted
          ? `你剛才的逐字對話與面談日誌<b>已完整保存</b>，可在「學習分析」查閱或匯出。`
          : `你剛才的逐字對話與面談日誌就在下方，但<b>尚未寫入保險箱</b> —— 詳見下方警示。`}
        於「系統設定」配置 Gemini API 金鑰後，往後的面談即可獲得真實的五維評分與督導總結。
      </div>

      ${renderVaultWriteFailureCard(persisted)}

      <div style="display:flex; flex-direction:column; gap:8px;">
        <h4 style="font-size:0.88rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-comments"></i> 逐字對話回顧</h4>
        <pre style="font-family:inherit; font-size:0.8rem; color:var(--text-main); white-space:pre-wrap; line-height:1.7; background:var(--nested-bg-medium); padding:14px; border-radius:8px; max-height:280px; overflow-y:auto;">${historyText}</pre>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        <h4 style="font-size:0.88rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-pen-nib"></i> 面談日誌記錄</h4>
        <pre style="font-family:inherit; font-size:0.8rem; color:var(--text-main); white-space:pre-wrap; line-height:1.7; background:var(--nested-bg-medium); padding:14px; border-radius:8px; max-height:220px; overflow-y:auto;">${notes.soap || notes.icf || "（本次面談未撰寫日誌記錄）"}</pre>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn-cyan" id="rp-noeval-export-btn"><i class="fa-solid fa-download"></i> 匯出面談日誌</button>
        <button class="btn" id="rp-noeval-settings-btn" style="background:var(--nested-bg-medium); border:1px solid var(--card-border); color:var(--text-bright);"><i class="fa-solid fa-gear"></i> 前往設定頁配置金鑰</button>
        <button class="btn" id="rp-noeval-back-btn" style="background:var(--nested-bg-medium); border:1px solid var(--card-border); color:var(--text-bright);">返回個案實戰</button>
      </div>
    </div>
  `;

  bindVaultRetryWrite();

  const exportBtn = document.getElementById("rp-noeval-export-btn");
  if (exportBtn) exportBtn.addEventListener("click", () => { AudioSynth.playClick(); exportSessionReport(null); });
  const settingsBtn = document.getElementById("rp-noeval-settings-btn");
  if (settingsBtn) settingsBtn.addEventListener("click", () => {
    AudioSynth.playClick();
    const link = document.querySelector('.nav-item[data-target="settings"]');
    if (link) link.click();
  });
  const backBtn = document.getElementById("rp-noeval-back-btn");
  if (backBtn) backBtn.addEventListener("click", () => { AudioSynth.playClick(); switchView("arena"); });
}

function renderSessionReport(container, report, persisted) {
  const title = document.getElementById("view-title");

  // 離線示範模式沒有 AI，因此沒有臨床評估。此處不畫雷達、不給等第、不編總結，
  // 只呈現真實存在的東西：逐字紀錄與同工自己寫的日誌。
  if (!hasEvaluation({ report })) {
    renderSessionCompletedWithoutEvaluation(container, persisted);
    return;
  }

  const vaulted = !persisted || persisted.ok;
  title.textContent = vaulted
    ? `輔導能力評審報告：${state.activeCase.name}`
    : `輔導能力評審報告（未存入保險箱）：${state.activeCase.name}`;

  const { empathy, changeTalk, actFlexibility, icfAccuracy, actionPlanning } = report.scores;

  container.innerHTML = `
    ${renderVaultWriteFailureCard(persisted)}
    <div class="grid-2col" style="margin-bottom: 24px;">
      
      <!-- Left: Skills radar simulation & numerical scores -->
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px; align-items:center;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright); align-self:flex-start;">輔導技巧雷達評分 (Skills Radar)</h3>
        
        <!-- Native SVG Radar Chart -->
        <svg width="240" height="240" viewBox="0 0 200 200" style="margin:12px 0;">
          <!-- Grid circles -->
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="60" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="40" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="20" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          
          <!-- Axis lines -->
          <!-- 1. Empathy (0 deg - Top) -->
          <line x1="100" y1="100" x2="100" y2="20" stroke="var(--illustration-line)" stroke-width="1"/>
          <!-- 2. ChangeTalk (72 deg) -->
          <line x1="100" y1="100" x2="176" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
          <!-- 3. ACT (144 deg) -->
          <line x1="100" y1="100" x2="147" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
          <!-- 4. ICF (216 deg) -->
          <line x1="100" y1="100" x2="53" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
          <!-- 5. Action (288 deg) -->
          <line x1="100" y1="100" x2="24" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
          
          <!-- Axis Labels -->
          <text x="100" y="15" fill="var(--text-muted)" font-size="8" text-anchor="middle">同理心 (MI)</text>
          <text x="182" y="76" fill="var(--text-muted)" font-size="8" text-anchor="start">改變談話 (MI)</text>
          <text x="152" y="175" fill="var(--text-muted)" font-size="8" text-anchor="start">心理彈性 (ACT)</text>
          <text x="48" y="175" fill="var(--text-muted)" font-size="8" text-anchor="end">全人評估 (ICF)</text>
          <text x="18" y="76" fill="var(--text-muted)" font-size="8" text-anchor="end">承諾行動</text>

          <!-- Computed Radar Polygon -->
          <!-- Coordinates: 
               Cx + r * cos(a), Cy + r * sin(a)
               (a: -90, -18, 54, 126, 198 in degrees) -->
          ${(() => {
            const r_emp = empathy * 0.8;
            const r_chg = changeTalk * 0.8;
            const r_act = actFlexibility * 0.8;
            const r_icf = icfAccuracy * 0.8;
            const r_actPln = actionPlanning * 0.8;
            
            const p1 = `100,${100 - r_emp}`;
            const p2 = `${100 + r_chg * Math.cos(-18 * Math.PI / 180)},${100 + r_chg * Math.sin(-18 * Math.PI / 180)}`;
            const p3 = `${100 + r_act * Math.cos(54 * Math.PI / 180)},${100 + r_act * Math.sin(54 * Math.PI / 180)}`;
            const p4 = `${100 + r_icf * Math.cos(126 * Math.PI / 180)},${100 + r_icf * Math.sin(126 * Math.PI / 180)}`;
            const p5 = `${100 + r_actPln * Math.cos(198 * Math.PI / 180)},${100 + r_actPln * Math.sin(198 * Math.PI / 180)}`;
            
            return `<polygon points="${p1} ${p2} ${p3} ${p4} ${p5}" fill="rgba(124, 58, 237, 0.25)" stroke="var(--accent-purple)" stroke-width="2"/>`;
          })()}
        </svg>

        <!-- Numeric Scores -->
        <div style="width:100%; display:flex; flex-direction:column; gap:8px; font-size:0.85rem;">
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border); padding-bottom:4px;">
            <span style="color:var(--text-muted);"><i class="fa-solid fa-heart" style="color:var(--accent-rose);"></i> 同理心與反映性傾聽 (MI OARS)</span>
            <span style="font-weight:700; color:var(--text-bright);">${empathy} 分</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border); padding-bottom:4px;">
            <span style="color:var(--text-muted);"><i class="fa-solid fa-fire" style="color:var(--accent-amber);"></i> 激發改變性談話 (MI Change Talk)</span>
            <span style="font-weight:700; color:var(--text-bright);">${changeTalk} 分</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border); padding-bottom:4px;">
            <span style="color:var(--text-muted);"><i class="fa-solid fa-leaf" style="color:var(--accent-green);"></i> 心理彈性引導 (ACT Hexaflex)</span>
            <span style="font-weight:700; color:var(--text-bright);">${actFlexibility} 分</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border); padding-bottom:4px;">
            <span style="color:var(--text-muted);"><i class="fa-solid fa-stethoscope" style="color:var(--accent-cyan);"></i> 全人障礙與環境評估 (ICF Matrix)</span>
            <span style="font-weight:700; color:var(--text-bright);">${icfAccuracy} 分</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border); padding-bottom:4px;">
            <span style="color:var(--text-muted);"><i class="fa-solid fa-running" style="color:#6366f1;"></i> 承諾行動計劃可行性</span>
            <span style="font-weight:700; color:var(--text-bright);">${actionPlanning} 分</span>
          </div>
        </div>

      </div>

      <!-- Right: Detailed Supervisor Feedback Summary -->
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-user-tie" style="color:var(--accent-cyan);"></i> 臨床總結督導報告 (Clinical Summary)</h3>
        ${practiceSupportNoticeHTML("margin:0;")}
        <p style="font-size:0.95rem; color:var(--text-main); line-height:1.6; background:rgba(255,255,255,0.02); padding:16px; border-radius:10px; border-left:4px solid var(--accent-cyan);">
          ${report.summary.replace(/\n/g, "<br>")}
        </p>

        <!-- Dynamic Notes Displayed -->
        <div style="background:rgba(255,255,255,0.01); border:1px solid var(--card-border); border-radius:8px; padding:12px;">
          <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-bright); margin-bottom:6px;"><i class="fa-solid fa-pen-nib"></i> 面談日誌記錄備份：</h4>
          <pre style="font-family:inherit; font-size:0.75rem; color:var(--text-muted); white-space:pre-wrap; max-height:100px; overflow-y:auto;">${state.activeSession.notes.soap || state.activeSession.notes.icf || "（同工本次面談未有撰寫日誌記錄）"}</pre>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:auto;">
          <button class="btn btn-cyan" id="rp-report-export-btn"><i class="fa-solid fa-download"></i> 匯出面談日誌</button>
          <button class="btn" id="rp-report-back-btn">返回個案實戰</button>
        </div>
      </div>

    </div>
  `;

  bindVaultRetryWrite();

  document.getElementById("rp-report-export-btn").addEventListener("click", () => exportSessionReport(report));

  document.getElementById("rp-report-back-btn").addEventListener("click", () => {
    switchView("arena");
  });
}

/* ==========================================================================
   View 5: ICF Case Analysis Board (Drag & Drop Matrix)
   ========================================================================== */
function startICFAssessment(selectedCase) {
  state.activeCase = selectedCase;
  state.activeView = "icf_board";

  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");
  title.textContent = `ICF 個案全人分析：${selectedCase.name}`;
  subtitle.textContent = `請小組或同工個人，將左側案主背景特徵，分類拖放到右側正確的 ICF 五大評估維度中。`;

  const mount = document.getElementById("content-view-mount");
  
  // Prepare dynamic list of factor tags in random order
  const factors = [...selectedCase.icf_factors].sort(() => Math.random() - 0.5);

  mount.innerHTML = `
    <div class="icf-interactive-board">
      
      <!-- Left: Factors Pool -->
      <div class="glass-card" style="display:flex; flex-direction:column; gap:12px;">
        <h4 style="font-size:0.95rem; font-weight:800; color:var(--text-bright); border-bottom:1px solid var(--card-border); padding-bottom:8px;">
          案主特徵因子池 (${factors.length} 個)
        </h4>
        <p style="font-size:0.75rem; color:var(--text-muted);">請點擊或拖放特徵到右側對應的 ICF 維度。小組共同研討效果更佳！</p>
        
        <div id="icf-factor-pool" style="display:flex; flex-direction:column; gap:8px; overflow-y:auto; max-height:450px;">
          ${factors.map((f, idx) => `
            <div class="icf-source-factor" draggable="true" id="icf-factor-${idx}" data-type="${f.type}" data-text="${f.text}">
              <i class="fa-solid fa-grip-vertical" style="color:var(--text-muted); margin-right:6px;"></i> ${f.text}
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Right: ICF 5-category Board -->
      <div style="display:flex; flex-direction:column; gap:16px;">
        
        <!-- ICF Matrix Layout Grid -->
        <div class="icf-matrix-grid">
          <!-- 1. Health Condition (Occupies top-left or separate box) -->
          <div class="glass-card icf-drop-zone" id="icf-zone-health_condition" data-zone="health_condition">
            <h4><i class="fa-solid fa-notes-medical" style="color:var(--accent-rose);"></i> 健康狀況</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <!-- 2. Body Functions & Structures -->
          <div class="glass-card icf-drop-zone" id="icf-zone-body_functions" data-zone="body_functions">
            <h4><i class="fa-solid fa-stethoscope" style="color:var(--accent-purple);"></i> 身體功能結構</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <!-- 3. Activities -->
          <div class="glass-card icf-drop-zone" id="icf-zone-activities" data-zone="activities">
            <h4><i class="fa-solid fa-wheelchair" style="color:var(--accent-cyan);"></i> 個人活動 (Capacity)</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <!-- 4. Participation -->
          <div class="glass-card icf-drop-zone" id="icf-zone-participation" data-zone="participation">
            <h4><i class="fa-solid fa-briefcase" style="color:var(--accent-green);"></i> 社會參與 (Performance)</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <!-- 5. Environmental Factors -->
          <div class="glass-card icf-drop-zone" id="icf-zone-environmental_factors" data-zone="environmental_factors">
            <h4><i class="fa-solid fa-building-columns" style="color:var(--accent-amber);"></i> 環境因素</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <!-- 6. Personal Factors -->
          <div class="glass-card icf-drop-zone" id="icf-zone-personal_factors" data-zone="personal_factors">
            <h4><i class="fa-solid fa-user" style="color:var(--text-muted);"></i> 個人因素</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>
        </div>

        <!-- Submit Evaluation bar -->
        <div style="display:flex; justify-content:flex-end; gap:12px;">
          <button class="btn btn-primary" id="icf-submit-analysis-btn">提交 AI 診斷評估</button>
          <button class="btn" id="icf-cancel-btn">取消返回</button>
        </div>

      </div>

    </div>
  `;

  // Initialize Drag & Drop Events
  initICFDragAndDrop();

  // Cancel trigger
  document.getElementById("icf-cancel-btn").addEventListener("click", () => {
    switchView("arena");
  });

  // Submit trigger
  document.getElementById("icf-submit-analysis-btn").addEventListener("click", () => evaluateICFMapping());
}

function initICFDragAndDrop() {
  const pool = document.getElementById("icf-factor-pool");
  const factors = pool.querySelectorAll(".icf-source-factor");
  const zones = document.querySelectorAll(".icf-drop-zone");

  factors.forEach(factor => {
    factor.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", factor.id);
    });

    // Mobile fallback click-to-select
    factor.addEventListener("click", () => {
      const activeZone = document.querySelector(".icf-drop-zone.dragover");
      if (activeZone) {
        moveFactorToZone(factor, activeZone);
      } else {
        // Find first empty zone or ask user
        const targetZone = prompt("請輸入你要分類到的區域（1:健康, 2:身體功能, 3:活動, 4:參與, 5:環境, 6:個人）");
        const zonesList = ["health_condition", "body_functions", "activities", "participation", "environmental_factors", "personal_factors"];
        const matchedType = zonesList[parseInt(targetZone) - 1];
        if (matchedType) {
          const matchingZone = document.getElementById(`icf-zone-${matchedType}`);
          moveFactorToZone(factor, matchingZone);
        }
      }
    });
  });

  zones.forEach(zone => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("dragover");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      const factorId = e.dataTransfer.getData("text/plain");
      const factor = document.getElementById(factorId);
      if (factor) {
        moveFactorToZone(factor, zone);
      }
    });
  });
}

function moveFactorToZone(factorEl, zoneEl) {
  const mountPoint = zoneEl.querySelector(".zone-mount-point");
  const text = factorEl.getAttribute("data-text");
  const targetType = zoneEl.getAttribute("data-zone");
  const correctType = factorEl.getAttribute("data-type");

  const tag = document.createElement("div");
  tag.className = "factor-tag";
  tag.setAttribute("data-correct", correctType);
  tag.setAttribute("data-placed", targetType);
  tag.innerHTML = `
    <span>${text}</span>
    <span class="remove-btn" title="移回特徵池"><i class="fa-solid fa-xmark"></i></span>
  `;

  // Remove tag handler
  tag.querySelector(".remove-btn").addEventListener("click", () => {
    tag.remove();
    factorEl.style.display = "block"; // Restore to pool
  });

  mountPoint.appendChild(tag);
  factorEl.style.display = "none"; // Hide in pool
}

function evaluateICFMapping() {
  const zones = document.querySelectorAll(".icf-drop-zone");
  let totalPlaced = 0;
  let correctCount = 0;
  let incorrectList = [];

  zones.forEach(zone => {
    const tags = zone.querySelectorAll(".factor-tag");
    tags.forEach(tag => {
      totalPlaced++;
      const correct = tag.getAttribute("data-correct");
      const placed = tag.getAttribute("data-placed");
      
      if (correct === placed) {
        correctCount++;
      } else {
        incorrectList.push({
          text: tag.querySelector("span").textContent,
          correct: correct,
          placed: placed
        });
      }
    });
  });

  const pool = document.getElementById("icf-factor-pool");
  const unplaced = Array.from(pool.querySelectorAll(".icf-source-factor")).filter(f => f.style.display !== "none");

  if (totalPlaced === 0) {
    alert("請先將案主特徵因子分類放入右側的 ICF 框格中。");
    return;
  }

  // Render evaluation report
  const scorePercent = Math.round((correctCount / totalPlaced) * 100);
  
  let evaluationHtml = `
    <div class="glass-card" style="max-width: 650px; margin: 20px auto; display:flex; flex-direction:column; gap:20px;">
      <div style="text-align:center;">
        <span style="font-size:4rem;">📊</span>
        <h3 style="font-size:1.4rem; font-weight:800; color:var(--text-bright); margin-top:8px;">小組/個人 ICF 分類診斷完成！</h3>
        <p style="font-size:1.8rem; font-weight:900; color:${scorePercent >= 80 ? 'var(--accent-green)' : scorePercent >= 60 ? 'var(--accent-amber)' : 'var(--accent-rose)'}; margin-top:6px;">
          準確率：${scorePercent}% (${correctCount}/${totalPlaced})
        </p>
      </div>

      <div style="border-top:1px solid var(--card-border); padding-top:16px;">
        <h4 style="color:var(--text-bright); margin-bottom:8px;"><i class="fa-solid fa-circle-info" style="color:var(--accent-cyan);"></i> ICF 專家臨床剖析反饋：</h4>
  `;

  if (incorrectList.length === 0 && unplaced.length === 0) {
    // Unlock ICF assessment expert achievement
    checkAndUnlockAchievements("icf_expert");

    evaluationHtml += `
      <p style="color:var(--accent-green); font-size:0.9rem; font-weight:600; line-height:1.6;">
        【堪稱完美！】小組非常精準地辨識了阿強所有的 ICF 維度！這反映了同工極佳的全人評估眼界，能清晰將阿強中風疾病本身（身體功能損傷）與他想養家但面臨小巴環境抗拒（活動與社會參與障礙）完美區分開來。這為後續制定精準的職業復康計劃打下了無比堅實的基礎！
      </p>
    `;
  } else {
    evaluationHtml += `
      <p style="font-size:0.88rem; color:var(--text-main); margin-bottom:12px;">分類反思指引：</p>
      <ul style="list-style:none; display:flex; flex-direction:column; gap:10px; font-size:0.82rem;">
        ${incorrectList.map(item => `
          <li style="background:rgba(244,63,94,0.06); padding:8px 12px; border-radius:6px; border-left:3px solid var(--accent-rose);">
            <strong>「${item.text}」</strong><br>
            <span style="color:var(--text-muted);">你放入了：</span><span style="color:var(--accent-rose); font-weight:700;">${getICFName(item.placed)}</span> | 
            <span style="color:var(--text-muted);">專家建議放入：</span><span style="color:var(--accent-green); font-weight:700;">${getICFName(item.correct)}</span>
          </li>
        `).join("")}
        ${unplaced.map(item => `
          <li style="background:rgba(245,158,11,0.06); padding:8px 12px; border-radius:6px; border-left:3px solid var(--accent-amber);">
            <strong>「${item.getAttribute("data-text")}」</strong> 未被分類放入，建議小組深入探討該因子對職業復康的實務影響。
          </li>
        `).join("")}
      </ul>
    `;
  }

  evaluationHtml += `
      </div>
      <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid var(--card-border); padding-top:16px;">
        <button class="btn btn-primary" id="icf-eval-close-btn">重新挑戰 / 返回</button>
      </div>
    </div>
  `;

  const mount = document.getElementById("content-view-mount");
  mount.innerHTML = evaluationHtml;

  document.getElementById("icf-eval-close-btn").addEventListener("click", () => {
    switchView("arena");
  });
}

function getICFName(type) {
  const map = {
    health_condition: "健康狀況",
    body_functions: "身體功能與結構",
    activities: "個人活動 (Capacity)",
    participation: "社會參與 (Performance)",
    environmental_factors: "環境因素 (促進/阻礙)",
    personal_factors: "個人因素"
  };
  return map[type] || type;
}

/* ==========================================================================
   View 6: Co-Learning Studio (Group learning branch sandboxes)
   ========================================================================== */
function renderCoLearning(container) {
  const caseData = MOCK_CO_LEARNING_CASES[0]; // load default
  
  container.innerHTML = `
    <div class="grid-2col" style="margin-bottom:24px; align-items:stretch;">
      <!-- Left pane: Standard Case study (Projector Mode Optimized) -->
      <div class="glass-card co-projector-panel" style="display:flex; flex-direction:column; gap:20px; border: 1px solid var(--card-border); background: var(--nested-bg-dark);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="tag tag-purple" style="font-size:0.75rem; padding:4px 8px; font-weight:700;"><i class="fa-solid fa-desktop"></i> ${state.locale === "en" ? "Projector Classroom Mode" : "大螢幕投影研討艙"}</span>
          <h4 style="font-weight:800; color:var(--accent-cyan); font-size:0.8rem; letter-spacing:0.5px;">
            ${state.locale === "en" ? "Recommendation: Group collectively discuss" : "推薦：投影至大螢幕進行組員集體研討"}
          </h4>
        </div>
        
        <h3 style="font-size:1.45rem; font-weight:900; color:var(--text-bright); line-height:1.4; text-shadow:0 0 10px rgba(255,255,255,0.05);">${caseData.title}</h3>
        <p style="font-size:0.95rem; color:var(--text-main); line-height:1.6; font-weight:600;">${caseData.description}</p>
        
        <div class="co-dialogue-segment-box" style="background:var(--nested-bg-darkest); border-radius:12px; padding:22px; border:1px solid rgba(6,182,212,0.2); box-shadow:inset 0 0 12px rgba(6,182,212,0.04);">
          <h4 style="font-size:0.92rem; font-weight:900; color:var(--accent-cyan); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-quote-left"></i>
            ${state.locale === "en" ? "Client Resistance Dialogue Segment:" : "輔導面談情境片段："}
          </h4>
          <pre style="font-family:inherit; font-size:1.05rem; font-weight:800; color:var(--text-bright); white-space:pre-wrap; line-height:1.7; letter-spacing:0.5px; margin:0;">${caseData.dialogue_segment}</pre>
        </div>

        <!-- Co-learning Question mounting point -->
        <div id="co-quiz-stage" style="display:flex; flex-direction:column; gap:16px;"></div>
      </div>

      <!-- Right pane: AI Custom Quiz Builder (題目生成艙) -->
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.20rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-dna" style="color:var(--accent-green);"></i>
          ${state.locale === "en" ? "AI Custom Quiz Generator Cabin" : "AI 研討題目生成艙"}
        </h3>
        <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.5;">
          ${state.locale === "en"
            ? "Enter a real client resistance dialogue (in Cantonese/Chinese). Gemini will analyze it in 6 seconds and synthesize a custom multiple-choice quiz with OARS/ACT evaluation guidelines for team discussion."
            : "輸入一段地道真實的案主抗拒/阻抗對話對白。利用 Google Gemini 智慧核心在 6 秒內進行剖析，動態生成一組包含標準答案、OARS 與 ACT 引導解析的多選研討題，供小組同步研討。"}
        </p>

        <div class="form-group" style="flex-grow:1; display:flex; flex-direction:column;">
          <label style="font-size:0.8rem; font-weight:700; color:var(--text-bright); margin-bottom:6px;">
            ${state.locale === "en" ? "Dialogue Segment Input" : "案主阻抗對白片段輸入"}
          </label>
          <textarea id="ai-quiz-input" placeholder="${state.locale === "en" ? "Enter client dialogue segment here..." : "例如：我開左三十年小巴，依家半身中風，你叫我點樣報ERB課程，班後生仔實笑我慢啦，去黎都係嘥氣！"}" style="width:100%; flex-grow:1; min-height:140px; background:var(--nested-bg-dark); border:1px solid var(--card-border); border-radius:10px; padding:12px; color:var(--text-bright); font-family:inherit; font-size:0.85rem; resize:none; outline:none; transition:var(--transition-smooth);"></textarea>
        </div>

        <button class="btn btn-primary shimmer-btn" id="ai-quiz-generate-btn" style="width:100%; justify-content:center;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> ${state.locale === "en" ? "Synthesize Custom Study Quiz" : "注入特徵並生成研討題"}
        </button>

        <div id="ai-custom-quiz-stage" style="display:none; background:var(--nested-bg-medium); border:1px solid var(--card-border); border-radius:12px; padding:16px; margin-top:12px; animation:fadeIn 0.5s ease;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--card-border); padding-bottom:8px;">
            <span class="tag tag-green">${state.locale === "en" ? "AI Generated Quiz" : "AI 合成題目艙已就緒"}</span>
            <button class="btn btn-circle" id="ai-custom-quiz-close" style="width:24px; height:24px; font-size:0.75rem; border:none; background:transparent;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div id="ai-custom-quiz-content"></div>
        </div>
      </div>
    </div>
  `;

  renderCoQuestion(0);

  // Setup Quiz Generator listener
  const generateBtn = container.querySelector("#ai-quiz-generate-btn");
  const inputArea = container.querySelector("#ai-quiz-input");
  const customQuizStage = container.querySelector("#ai-custom-quiz-stage");
  const customQuizContent = container.querySelector("#ai-custom-quiz-content");
  const closeCustomQuizBtn = container.querySelector("#ai-custom-quiz-close");

  closeCustomQuizBtn.addEventListener("click", () => {
    AudioSynth.playClick();
    customQuizStage.style.display = "none";
  });

  generateBtn.addEventListener("click", async () => {
    AudioSynth.playClick();
    const dialogueVal = inputArea.value.trim();
    if (!dialogueVal) {
      alert(state.locale === "en" ? "Please enter a dialogue segment first!" : "請輸入一段案主對白片段！");
      return;
    }

    generateBtn.disabled = true;
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${state.locale === "en" ? "Analyzing & Generating..." : "正在剖析並生成..."}`;

    try {
      const quizData = await generateCustomQuiz(state.apiKey, state.selectedModel, dialogueVal);
      AudioSynth.playSuccess();
      customQuizStage.style.display = "block";
      
      // Render the AI custom quiz questions!
      renderCustomQuizQuestions(quizData, 0, customQuizContent);
    } catch (e) {
      AudioSynth.playError();
      alert(`${state.locale === "en" ? "Generation failed" : "生成題目失敗"}：${e.message}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = originalText;
    }
  });
}

function renderCoQuestion(qIdx) {
  const stage = document.getElementById("co-quiz-stage");
  if (!stage) return;

  const caseData = MOCK_CO_LEARNING_CASES[0];
  const quiz = caseData.questions[qIdx];

  if (!quiz) {
    stage.innerHTML = `
      <div style="text-align:center; padding:24px 12px; background:rgba(16,185,129,0.06); border:1px dashed var(--accent-green); border-radius:10px;">
        <h4 style="color:var(--accent-green); font-size:1.1rem; font-weight:800; margin-bottom:6px;">🎉 ${state.locale === "en" ? "Study Session Completed!" : "小組研討圓滿完成！"}</h4>
        <p style="font-size:0.85rem; color:var(--text-main);">
          ${state.locale === "en"
            ? `Your group worked through all ${caseData.questions.length} discussion items on this teaching case. The next step is to try the same techniques aloud in the roleplay cabin.`
            : `小組已完成本教學個案的全部 ${caseData.questions.length} 道研討題。下一步是把同樣的技巧在【模擬輔導室】用廣東話講出來 —— 說出口與選出答案是兩回事。`}
        </p>
        <button class="btn btn-primary" id="co-go-arena-btn" style="margin-top:12px;">${state.locale === "en" ? "Go to Case Arena" : "前往實戰 Arena"}</button>
      </div>
    `;
    document.getElementById("co-go-arena-btn").addEventListener("click", () => {
      AudioSynth.playClick();
      switchView("arena");
    });
    return;
  }

  stage.innerHTML = `
    <div style="background:rgba(255,255,255,0.02); border-radius:10px; padding:20px; border:1px solid var(--card-border);">
      <h4 style="font-size:1.05rem; font-weight:800; color:var(--text-bright); margin-bottom:16px; line-height:1.5;">
        <i class="fa-solid fa-question-circle" style="color:var(--accent-purple);"></i>
        ${state.locale === "en" ? "Discussion Question" : "討論題"} ${qIdx + 1}：${quiz.question}
      </h4>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${quiz.options.map((opt, idx) => `
          <button class="btn co-option-btn projector-option" data-idx="${idx}" style="position:relative; text-align:left; justify-content:space-between; display:flex; align-items:center; width:100%; font-size:0.92rem; font-weight:700; padding:14px 20px; overflow:hidden; border-color:rgba(255,255,255,0.08); transition:var(--transition-smooth);">
            <span class="poll-bg-bar" style="position:absolute; left:0; top:0; bottom:0; width:0%; background:var(--accent-purple); opacity:0.12; transition:width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1); z-index:1;"></span>
            <span style="position:relative; z-index:2;">${String.fromCharCode(65 + idx)}. ${opt}</span>
            <span class="poll-percent-text" style="position:relative; z-index:2; font-family:monospace; font-size:0.85rem; opacity:0; transition:opacity 0.4s ease; color:var(--text-muted); font-weight:800;">0%</span>
          </button>
        `).join("")}
      </div>
      <div id="co-quiz-feedback" style="display:none; margin-top:20px; font-size:0.9rem; background:rgba(124,58,237,0.06); border-radius:8px; padding:16px; border-left:4px solid var(--accent-purple); line-height:1.6;"></div>
    </div>
  `;

  // Attach option clicks
  const btns = stage.querySelectorAll(".co-option-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const selectedIdx = parseInt(btn.getAttribute("data-idx"));
      const fb = document.getElementById("co-quiz-feedback");
      
      const isCorrect = selectedIdx === quiz.correct;
      if (isCorrect) {
        AudioSynth.playSuccess();
      } else {
        AudioSynth.playError();
      }

      // Generate realistic group voting percentages dynamically: correct answer gets highest vote
      const correctIdx = quiz.correct;
      const percentages = [];
      percentages[correctIdx] = 68;
      percentages[(correctIdx + 1) % 4] = 16;
      percentages[(correctIdx + 2) % 4] = 11;
      percentages[(correctIdx + 3) % 4] = 5;

      // Highlight correct vs wrong & trigger bar animations
      btns.forEach((b, i) => {
        const bar = b.querySelector(".poll-bg-bar");
        const percentText = b.querySelector(".poll-percent-text");

        if (i === quiz.correct) {
          b.style.borderColor = "var(--accent-green)";
          b.style.background = "rgba(16,185,129,0.03)";
          if (bar) {
            bar.style.background = "var(--accent-green)";
            bar.style.width = `${percentages[i]}%`;
          }
        } else {
          if (i === selectedIdx) {
            b.style.borderColor = "var(--accent-rose)";
            b.style.background = "rgba(244,63,94,0.03)";
            if (bar) bar.style.background = "var(--accent-rose)";
          } else {
            b.style.borderColor = "rgba(255,255,255,0.05)";
            if (bar) bar.style.background = "rgba(255,255,255,0.08)";
          }
          if (bar) {
            bar.style.width = `${percentages[i]}%`;
          }
        }

        if (percentText) {
          percentText.textContent = `(小組投票: ${percentages[i]}%)`;
          percentText.style.opacity = "1";
        }

        b.disabled = true;
        b.style.cursor = "default";
      });

      fb.style.display = "block";
      fb.innerHTML = `
        <strong>【${state.locale === "en" ? "Analysis" : "小組引導解析"}】</strong>：${quiz.explanation}<br><br>
        <button class="btn btn-primary" id="co-quiz-next-btn">${state.locale === "en" ? "Next Question" : "進入下一討論"} <i class="fa-solid fa-arrow-right"></i></button>
      `;

      document.getElementById("co-quiz-next-btn").addEventListener("click", () => {
        AudioSynth.playClick();
        renderCoQuestion(qIdx + 1);
      });
    });
  });
}

function renderCustomQuizQuestions(quizData, qIdx, container) {
  const quiz = quizData.questions[qIdx];
  if (!quiz) {
    container.innerHTML = `
      <div style="text-align:center; padding:16px; background:rgba(16,185,129,0.06); border:1px dashed var(--accent-green); border-radius:10px;">
        <h4 style="color:var(--accent-green); font-size:1rem; font-weight:800; margin-bottom:4px;">🎉 ${state.locale === "en" ? "Custom Quiz Completed!" : "自訂研討題通關！"}</h4>
        <p style="font-size:0.78rem; color:var(--text-main);">${state.locale === "en" ? "Great job analyzing custom client resistance." : "太棒了！小組通過對自定義抗拒對白的多維度研討，加深了對輔導技巧的領悟。"}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <h4 style="font-size:0.95rem; font-weight:800; color:var(--text-bright); line-height:1.4;">
        <i class="fa-solid fa-sparkles" style="color:var(--accent-green);"></i>
        ${state.locale === "en" ? "Question" : "研討題"} ${qIdx + 1}：${quiz.question}
      </h4>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${quiz.options.map((opt, idx) => `
          <button class="btn ai-custom-opt-btn projector-option" data-idx="${idx}" style="position:relative; text-align:left; justify-content:space-between; display:flex; align-items:center; width:100%; font-size:0.88rem; font-weight:700; padding:10px 14px; overflow:hidden; border-radius:8px; border-color:rgba(255,255,255,0.06); transition:var(--transition-smooth);">
            <span class="poll-bg-bar" style="position:absolute; left:0; top:0; bottom:0; width:0%; background:var(--accent-purple); opacity:0.12; transition:width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1); z-index:1;"></span>
            <span style="position:relative; z-index:2;">${String.fromCharCode(65 + idx)}. ${opt}</span>
            <span class="poll-percent-text" style="position:relative; z-index:2; font-family:monospace; font-size:0.78rem; opacity:0; transition:opacity 0.4s ease; color:var(--text-muted); font-weight:800;">0%</span>
          </button>
        `).join("")}
      </div>
      <div id="ai-custom-quiz-feedback" style="display:none; font-size:0.82rem; background:rgba(124,58,237,0.06); border-radius:8px; padding:12px; border-left:4px solid var(--accent-purple); line-height:1.5;"></div>
    </div>
  `;

  const btns = container.querySelectorAll(".ai-custom-opt-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const selectedIdx = parseInt(btn.getAttribute("data-idx"));
      const fb = container.querySelector("#ai-custom-quiz-feedback");
      
      const isCorrect = selectedIdx === quiz.correct;
      if (isCorrect) {
        AudioSynth.playSuccess();
      } else {
        AudioSynth.playError();
      }

      // Generate realistic group voting percentages dynamically: correct answer gets highest vote
      const correctIdx = quiz.correct;
      const percentages = [];
      percentages[correctIdx] = 68;
      percentages[(correctIdx + 1) % 4] = 16;
      percentages[(correctIdx + 2) % 4] = 11;
      percentages[(correctIdx + 3) % 4] = 5;

      btns.forEach((b, i) => {
        const bar = b.querySelector(".poll-bg-bar");
        const percentText = b.querySelector(".poll-percent-text");

        if (i === quiz.correct) {
          b.style.borderColor = "var(--accent-green)";
          b.style.background = "rgba(16,185,129,0.03)";
          if (bar) {
            bar.style.background = "var(--accent-green)";
            bar.style.width = `${percentages[i]}%`;
          }
        } else {
          if (i === selectedIdx) {
            b.style.borderColor = "var(--accent-rose)";
            b.style.background = "rgba(244,63,94,0.03)";
            if (bar) bar.style.background = "var(--accent-rose)";
          } else {
            b.style.borderColor = "rgba(255,255,255,0.05)";
            if (bar) bar.style.background = "rgba(255,255,255,0.08)";
          }
          if (bar) {
            bar.style.width = `${percentages[i]}%`;
          }
        }

        if (percentText) {
          percentText.textContent = `(投票: ${percentages[i]}%)`;
          percentText.style.opacity = "1";
        }

        b.disabled = true;
        b.style.cursor = "default";
      });

      fb.style.display = "block";
      fb.innerHTML = `
        <strong>【${state.locale === "en" ? "Analysis" : "小組引導解析"}】</strong>：${quiz.explanation}<br><br>
        <button class="btn btn-primary" id="ai-custom-next-btn" style="padding:6px 12px; font-size:0.75rem;">
          ${state.locale === "en" ? "Next Question" : "進入下一討論"} <i class="fa-solid fa-arrow-right"></i>
        </button>
      `;

      container.querySelector("#ai-custom-next-btn").addEventListener("click", () => {
        AudioSynth.playClick();
        renderCustomQuizQuestions(quizData, qIdx + 1, container);
      });
    });
  });
}

/* ==========================================================================
   Phase 6: Longitudinal SVG Competence Trend Chart Generator
   ========================================================================== */
function generateLongitudinalChartHTML(historySessions) {
  let dataPoints = [];
  let isSimulated = false;

  // Milestone 7：門檻改看**已評估**場次。舊版看 historySessions.length，兩場離線
  // 示範面談就會被當成「有真實資料」→ 抽掉「模擬引導線」徽章，而 dataPoints 經
  // filter(hasEvaluation) 後是空陣列，畫出一張無徽章、無資料點卻聲稱屬於同工的圖。
  const evaluatedForTrend = historySessions.filter(hasEvaluation);
  if (evaluatedForTrend.length < 2) {
    isSimulated = true;
    if (state.locale === "en") {
      dataPoints = [
        { label: "Baseline", avg: 65, empathy: 60, act: 58 },
        { label: "Sim-1", avg: 72, empathy: 70, act: 68 },
        { label: "Sim-2", avg: 85, empathy: 82, act: 80 }
      ];
    } else if (state.locale === "zh-CN") {
      dataPoints = [
        { label: "起步水平", avg: 65, empathy: 60, act: 58 },
        { label: "模拟会话一", avg: 72, empathy: 70, act: 68 },
        { label: "模拟会话二", avg: 85, empathy: 82, act: 80 }
      ];
    } else {
      dataPoints = [
        { label: "起步水平", avg: 65, empathy: 60, act: 58 },
        { label: "模擬會話一", avg: 72, empathy: 70, act: 68 },
        { label: "模擬會話二", avg: 85, empathy: 82, act: 80 }
      ];
    }
  } else {
    dataPoints = evaluatedForTrend.map((session, index) => {
      const s = session.report.scores;
      const avg = Math.round((s.empathy + s.changeTalk + s.actFlexibility + s.icfAccuracy + s.actionPlanning) / 5);
      return {
        label: session.caseName.split(" ")[0] || (state.locale === "en" ? `Session ${index + 1}` : `會話 ${index + 1}`),
        avg: avg,
        empathy: s.empathy,
        act: s.actFlexibility
      };
    });
  }

  // Dimensions of SVG
  const width = 800;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  // X coordinates
  const pointsCount = dataPoints.length;
  const getX = (index) => paddingLeft + (index / (pointsCount - 1)) * chartWidth;
  
  // Y coordinate mapping (scores range from 0 to 100)
  const getY = (score) => paddingTop + chartHeight - (score / 100) * chartHeight;
  
  // Generate Line Paths
  let avgPoints = [];
  let empathyPoints = [];
  let actPoints = [];
  
  for (let i = 0; i < pointsCount; i++) {
    const x = getX(i);
    avgPoints.push(`${x},${getY(dataPoints[i].avg)}`);
    empathyPoints.push(`${x},${getY(dataPoints[i].empathy)}`);
    actPoints.push(`${x},${getY(dataPoints[i].act)}`);
  }
  
  const avgPath = `M ${avgPoints.join(" L ")}`;
  const empathyPath = `M ${empathyPoints.join(" L ")}`;
  const actPath = `M ${actPoints.join(" L ")}`;
  
  // Area path for Average Score
  const avgAreaPath = `${avgPath} L ${getX(pointsCount - 1)},${getY(0)} L ${getX(0)},${getY(0)} Z`;

  // Draw vertical grid lines and labels
  let gridLines = "";
  let xLabels = "";
  for (let i = 0; i < pointsCount; i++) {
    const x = getX(i);
    gridLines += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3,3" />`;
    xLabels += `<text x="${x}" y="${height - 15}" fill="var(--text-muted)" font-size="10" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="600">${dataPoints[i].label}</text>`;
  }

  // Horizontal grids (0, 20, 40, 60, 80, 100)
  let horizontalGrids = "";
  let yLabels = "";
  for (let s = 0; s <= 100; s += 20) {
    const y = getY(s);
    horizontalGrids += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(255,255,255,0.05)" />`;
    yLabels += `<text x="${paddingLeft - 10}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end" font-family="'Outfit', sans-serif" font-weight="600">${s}</text>`;
  }

  // Draw points
  let pointsElements = "";
  for (let i = 0; i < pointsCount; i++) {
    const x = getX(i);
    const yAvg = getY(dataPoints[i].avg);
    const yEmp = getY(dataPoints[i].empathy);
    const yAct = getY(dataPoints[i].act);
    
    // Average
    pointsElements += `
      <g class="chart-point-group">
        <circle cx="${x}" cy="${yAvg}" r="6" fill="#100c12" stroke="var(--accent-cyan)" stroke-width="2" />
        <circle cx="${x}" cy="${yAvg}" r="3" fill="var(--accent-cyan)" />
        <title>${state.locale === "en" ? "Average Score" : "平均得分"}: ${dataPoints[i].avg}分</title>
      </g>
    `;
    
    // Empathy
    pointsElements += `
      <g class="chart-point-group">
        <circle cx="${x}" cy="${yEmp}" r="4" fill="#100c12" stroke="var(--accent-amber)" stroke-width="1.5" />
        <circle cx="${x}" cy="${yEmp}" r="2" fill="var(--accent-amber)" />
      </g>
    `;

    // ACT
    pointsElements += `
      <g class="chart-point-group">
        <circle cx="${x}" cy="${yAct}" r="4" fill="#100c12" stroke="var(--accent-purple)" stroke-width="1.5" />
        <circle cx="${x}" cy="${yAct}" r="2" fill="var(--accent-purple)" />
      </g>
    `;
  }

  const titleText = state.locale === "en" 
    ? "Longitudinal Competence Growth Trends" 
    : state.locale === "zh-CN" 
    ? "职业复康能力纵向发展趋势图" 
    : "職業復康能力縱向發展趨勢圖";

  const simulatedText = state.locale === "en"
    ? "Simulated Baseline Guide"
    : state.locale === "zh-CN"
    ? "模拟成长对照引导线"
    : "模擬成長對照引導線";

  const avgLegend = state.locale === "en" ? "Average Score" : "綜合平均";
  const empathyLegend = state.locale === "en" ? "Empathy (MI)" : "同理傾聽 (MI)";
  const actLegend = state.locale === "en" ? "Defusion (ACT)" : "心理解離 (ACT)";

  const simulatedBadge = isSimulated ? `
    <div style="position: absolute; top: 16px; right: 16px; background: rgba(124, 58, 237, 0.15); border: 1px solid rgba(124, 58, 237, 0.3); color: var(--accent-purple); padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; display:flex; align-items:center; gap:6px;">
      <i class="fa-solid fa-graduation-cap"></i>
      <span>${simulatedText}</span>
    </div>
  ` : "";

  return `
    <div class="glass-card" style="margin-bottom: 24px; position: relative; padding: 20px; display:flex; flex-direction:column; gap:12px; overflow: hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-chart-line" style="color:var(--accent-cyan);"></i>
          ${titleText}
        </h3>
        
        <!-- Legend -->
        <div style="display:flex; gap:12px; font-size:0.75rem; font-weight:600;">
          <div style="display:flex; align-items:center; gap:5px; color:var(--accent-cyan);">
            <span style="display:inline-block; width:10px; height:3px; background:var(--accent-cyan); border-radius:2px;"></span>
            <span>${avgLegend}</span>
          </div>
          <div style="display:flex; align-items:center; gap:5px; color:var(--accent-amber);">
            <span style="display:inline-block; width:10px; height:3px; background:var(--accent-amber); border-radius:2px;"></span>
            <span>${empathyLegend}</span>
          </div>
          <div style="display:flex; align-items:center; gap:5px; color:var(--accent-purple);">
            <span style="display:inline-block; width:10px; height:3px; background:var(--accent-purple); border-radius:2px;"></span>
            <span>${actLegend}</span>
          </div>
        </div>
      </div>
      
      ${simulatedBadge}

      <!-- Chart Wrapper for responsiveness -->
      <div style="width:100%; overflow-x:auto;">
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; min-width:600px; display:block;">
          <defs>
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.35" />
              <stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0.0" />
            </linearGradient>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          <!-- Grid Lines -->
          ${horizontalGrids}
          ${gridLines}
          
          <!-- Axis Labels -->
          ${yLabels}
          ${xLabels}
          
          <!-- Area Gradient under average score path -->
          <path d="${avgAreaPath}" fill="url(#area-grad)" stroke="none" />
          
          <!-- Lines -->
          <path d="${avgPath}" fill="none" stroke="var(--accent-cyan)" stroke-width="3" filter="url(#glow-cyan)" stroke-linecap="round" stroke-linejoin="round" ${isSimulated ? 'stroke-dasharray="6,4"' : ''} />
          <path d="${empathyPath}" fill="none" stroke="var(--accent-amber)" stroke-width="2" filter="url(#glow-amber)" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" ${isSimulated ? 'stroke-dasharray="6,4"' : ''} />
          <path d="${actPath}" fill="none" stroke="var(--accent-purple)" stroke-width="2" filter="url(#glow-purple)" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" ${isSimulated ? 'stroke-dasharray="6,4"' : ''} />
          
          <!-- Points -->
          ${pointsElements}
        </svg>
      </div>
    </div>
  `;
}

/* ==========================================================================
   View 7: Analytics
   ========================================================================== */
function renderAnalytics(container) {
  // Get history sessions
  // ADR-0005：改讀記憶體副本（開機時由 hydrateVault() 從 IndexedDB 載入）
  const historySessions = state.historySessions;

  // Milestone 7：雷達彙總改由 computeCounselorRecord() 單處推導，本頁不再自行加總。
  const record = computeCounselorRecord(historySessions);
  const totalSessions = record.evaluatedCount;
  const hasRadarData = record.radar !== null;

  // state.radarScores 由「另一份彙總副本」降格為本次 render 的推導快取；
  // 語意改為 null = 尚無已評估紀錄，讓消費端無法把它誤當成 0 分。
  state.radarScores = record.radar;

  // D20(c)：舊版在零筆已評估時把五維填成 0 再照樣畫多邊形 —— 收縮到圓心的
  // 五邊形讀起來是「這位同工五項都拿 0 分」。null 時不輸出 polygon。
  const pointsStr = radarPolygonPoints(record.radar, 80);
  const totalAvg = record.radarAverage;

  // PRD v4「No Claim Without Evidence」：no letter grades。
  // 舊版由平均分算出 卓越(A)/優良(B+)/合格(C)/需提升(D) 四個等第，
  // 把語言模型的即時印象呈現為評核結果。改為據實陳述分數與其來源。
  // 舊版此處寫死「你目前在 ACT 的心理彈性概念上自學非常充足」—— 與 theoryProgress
  // 無關，零進度亦然。改為只指向紀錄裡確實未完成的模組／確實最低的維度；
  // 兩者都沒有紀錄時，不作任何關於同工的宣稱。
  const nextStepSuggestion = (() => {
    const label = state.locale === "en" ? "💡 <strong>Next step</strong>" : "💡 <strong>下一步建議</strong>";
    const moduleNames = { act: "接納承諾療法 (ACT)", mi: "動機式訪談法 (MI)", icf: "全人復康矩陣 (ICF)" };
    const incomplete = ["act", "mi", "icf"].filter(k => {
      const p = state.theoryProgress && state.theoryProgress[k];
      return !(p && p.info && p.flashcards && p.test);
    });

    if (incomplete.length > 0) {
      const names = incomplete.map(k => moduleNames[k]).join("、");
      return state.locale === "en"
        ? `${label}: ${incomplete.length} theory module(s) are still incomplete. Finishing them is the shortest next step.`
        : `${label}：你尚有 ${incomplete.length} 個理論模組未完成（${names}）。把它們讀完是最短的下一步。`;
    }

    if (record.radar) {
      const dims = [
        { key: "empathy", zh: "傾聽共情 (MI)", en: "Empathy (MI)" },
        { key: "changeTalk", zh: "改變談話 (MI)", en: "Change Talk" },
        { key: "defusion", zh: "心理解離 (ACT)", en: "Defusion (ACT)" },
        { key: "icf", zh: "環境與個人診斷 (ICF)", en: "ICF Diagnostic" },
        { key: "action", zh: "漸進式行動計劃", en: "Action Plan" }
      ];
      const weakest = dims.reduce((a, b) => (record.radar[b.key] < record.radar[a.key] ? b : a));
      return state.locale === "en"
        ? `${label}: across your ${record.evaluatedCount} evaluated session(s), <strong>${weakest.en}</strong> scored lowest (${record.radar[weakest.key]}). That is where more practice would show up first.`
        : `${label}：在你 ${record.evaluatedCount} 場已評估面談中，<strong>${weakest.zh}</strong> 的平均最低（${record.radar[weakest.key]} 分）。那裡是練習最快看得見變化的地方。`;
    }

    return state.locale === "en"
      ? `${label}: theory modules are all complete. Hold an interview with an API key to see figures computed from your own record here.`
      : `${label}：理論模組已全部完成。以金鑰進行一次面談後，這裡會顯示來自你自己紀錄的數字。`;
  })();

  const feedbackLine = hasRadarData
    ? (state.locale === "en"
        ? `<strong>AI practice feedback</strong>: your ${totalSessions} evaluated session(s) average <strong>${totalAvg}</strong> across the five dimensions.`
        : `<strong>AI 即時回饋（練習參考）</strong>：你 ${totalSessions} 場已評估面談的五維平均為 <strong>${totalAvg}</strong> 分。`)
    : (state.locale === "en"
        ? "No evaluated sessions yet. Once you finish an interview with an API key, the figures here will be computed from your own record."
        : "尚無已評估的面談紀錄。完成一次有金鑰的面談後，這裡會顯示來自你自己紀錄的平均分。");

  // Create markup for history list
  let historyMarkup = "";
  if (historySessions.length === 0) {
    historyMarkup = `
      <div class="glass-card" style="text-align: center; padding: 48px 24px; color: var(--text-muted); font-size: 0.9rem; border: 1px dashed var(--card-border);">
        <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--accent-purple); opacity: 0.5; margin-bottom: 12px; display: block;"></i>
        ${state.locale === "en" ? "No session history recorded yet. Complete a roleplay session to unlock." : state.locale === "zh-CN" ? "尚无已记录的面谈历程。完成一次个案模拟对话后即可在此查看。" : "尚無已記錄的面談歷程。完成一次個案模擬對話後即可在此查看。"}
      </div>
    `;
  } else {
    historyMarkup = `
      <div class="history-grid">
        ${historySessions.map(session => {
          const evaluated = hasEvaluation(session);
          const avgScore = evaluated ? Math.round((session.report.scores.empathy + session.report.scores.changeTalk + session.report.scores.actFlexibility + session.report.scores.icfAccuracy + session.report.scores.actionPlanning) / 5) : null;
          return `
            <div class="history-card" data-session-id="${session.id}">
              <div class="history-card-header">
                <span class="history-card-avatar">${session.caseAvatar}</span>
                <span class="history-card-date">${session.date}</span>
              </div>
              <div class="history-card-name">${session.caseName}</div>
              <div class="history-card-diag">${session.caseDiagnostic}</div>
              <div class="history-card-scores">
                ${evaluated ? `
                  <span class="history-score-tag high">${state.locale === "en" ? "Avg" : "平均"} ${avgScore}分</span>
                  <span class="history-score-tag">${state.locale === "en" ? "Empathy" : "同理"} ${session.report.scores.empathy}</span>
                  <span class="history-score-tag">${state.locale === "en" ? "ACT" : "彈性"} ${session.report.scores.actFlexibility}</span>
                ` : `
                  <span class="history-score-tag" style="border-color:rgba(245,158,11,0.4); color:var(--accent-amber); background:rgba(245,158,11,0.1);">
                    <i class="fa-solid fa-clapperboard"></i> ${state.locale === "en" ? "Demo — not evaluated" : "離線示範 · 未評估"}
                  </span>
                `}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="grid-2col" style="margin-bottom: 24px; align-items:stretch;">
      
      <!-- Left: Study hours progression -->
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright);">
          ${state.locale === "en" ? "Self-Study Progression" : state.locale === "zh-CN" ? "理论学习时数分布 (自学时数)" : "理論學習時數分布 (自學時數)"}
        </h3>
        
        <!-- Progress representation -->
        ${(() => {
          const actCompleted = (state.theoryProgress.act.info ? 1 : 0) + (state.theoryProgress.act.flashcards ? 1 : 0) + (state.theoryProgress.act.test ? 1 : 0);
          const actPercent = Math.round((actCompleted / 3) * 100);
          const miCompleted = (state.theoryProgress.mi.info ? 1 : 0) + (state.theoryProgress.mi.flashcards ? 1 : 0) + (state.theoryProgress.mi.test ? 1 : 0);
          const miPercent = Math.round((miCompleted / 3) * 100);
          const icfCompleted = (state.theoryProgress.icf.info ? 1 : 0) + (state.theoryProgress.icf.flashcards ? 1 : 0) + (state.theoryProgress.icf.test ? 1 : 0);
          const icfPercent = Math.round((icfCompleted / 3) * 100);

          return `
            <div style="display:flex; flex-direction:column; gap:16px; margin:16px 0;">
              <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                  <span style="color:var(--text-muted); font-weight:600;">ACT ${state.locale === "en" ? "Acceptance & Commitment" : "接納承諾療法"}</span>
                  <span style="color:var(--text-bright); font-weight:700;">${actPercent}% (${actCompleted}/3)</span>
                </div>
                <div style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px; overflow:hidden; margin-bottom:6px;">
                  <div style="background:var(--accent-purple); width:${actPercent}%; height:100%; border-radius:10px;"></div>
                </div>
                <div style="display:flex; gap:10px; font-size:0.7rem; color:var(--text-muted);">
                  <span><i class="fa-solid ${state.theoryProgress.act.info ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.act.info ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_info")}</span>
                  <span><i class="fa-solid ${state.theoryProgress.act.flashcards ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.act.flashcards ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_cards")}</span>
                  <span><i class="fa-solid ${state.theoryProgress.act.test ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.act.test ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_test")}</span>
                </div>
              </div>

              <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                  <span style="color:var(--text-muted); font-weight:600;">MI ${state.locale === "en" ? "Motivational Interviewing" : "動機式訪談"}</span>
                  <span style="color:var(--text-bright); font-weight:700;">${miPercent}% (${miCompleted}/3)</span>
                </div>
                <div style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px; overflow:hidden; margin-bottom:6px;">
                  <div style="background:var(--accent-amber); width:${miPercent}%; height:100%; border-radius:10px;"></div>
                </div>
                <div style="display:flex; gap:10px; font-size:0.7rem; color:var(--text-muted);">
                  <span><i class="fa-solid ${state.theoryProgress.mi.info ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.mi.info ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_info")}</span>
                  <span><i class="fa-solid ${state.theoryProgress.mi.flashcards ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.mi.flashcards ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_cards")}</span>
                  <span><i class="fa-solid ${state.theoryProgress.mi.test ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.mi.test ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_test")}</span>
                </div>
              </div>

              <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px;">
                  <span style="color:var(--text-muted); font-weight:600;">ICF ${state.locale === "en" ? "Full Matrix" : "全人復康矩陣"}</span>
                  <span style="color:var(--text-bright); font-weight:700;">${icfPercent}% (${icfCompleted}/3)</span>
                </div>
                <div style="background:rgba(255,255,255,0.05); height:8px; border-radius:10px; overflow:hidden; margin-bottom:6px;">
                  <div style="background:var(--accent-cyan); width:${icfPercent}%; height:100%; border-radius:10px;"></div>
                </div>
                <div style="display:flex; gap:10px; font-size:0.7rem; color:var(--text-muted);">
                  <span><i class="fa-solid ${state.theoryProgress.icf.info ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.icf.info ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_info")}</span>
                  <span><i class="fa-solid ${state.theoryProgress.icf.flashcards ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.icf.flashcards ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_cards")}</span>
                  <span><i class="fa-solid ${state.theoryProgress.icf.test ? 'fa-circle-check' : 'fa-circle'}" style="color:${state.theoryProgress.icf.test ? 'var(--accent-green)' : 'var(--text-muted)'};"></i> ${t("self_study_item_test")}</span>
                </div>
              </div>
            </div>
          `;
        })()}
        
        <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.5; margin:0;">
          ${nextStepSuggestion}
        </p>
      </div>

      <!-- Right: Interactive Dynamic Skills Radar Chart 2.0 -->
      <div class="glass-card" style="display:flex; flex-direction:column; gap:12px; align-items:center; position:relative; overflow:hidden;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright); align-self:flex-start; margin-bottom:4px;">
          ${state.locale === "en" ? "Overall Competence Radar" : state.locale === "zh-CN" ? "综合复康辅导实践力 (Competence Radar)" : "綜合復康輔導實踐力 (Competence Radar)"}
        </h3>
        
        <!-- Dynamic Interactive SVG radar representation -->
        <svg width="220" height="220" viewBox="0 0 200 200" style="margin:4px 0; z-index:2;">
          <!-- Radar grid rings -->
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="60" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="40" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="20" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          
          <!-- Radar axes -->
          <line x1="100" y1="100" x2="100" y2="20" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="176" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="147" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="53" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="24" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
          
          <!-- Dynamic Score Polygon（Milestone 7：無已評估紀錄時不輸出，只留格線） -->
          ${pointsStr
            ? `<polygon id="radar-poly" points="${pointsStr}" fill="rgba(6, 182, 212, 0.25)" stroke="var(--accent-cyan)" stroke-width="2" style="transition: points 0.5s ease-out; filter: drop-shadow(0 0 6px rgba(6,182,212,0.15));"/>`
            : `<text x="100" y="103" fill="var(--text-muted)" font-size="9" text-anchor="middle" style="font-weight:700;">${state.locale === "en" ? "No record yet" : "尚無紀錄"}</text>`}

          <!-- Interactive Dot Markers at maximum radius -->
          <circle class="radar-dot" data-dim="0" cx="100" cy="20" r="4.5" fill="var(--accent-purple)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-purple));"></circle>
          <circle class="radar-dot" data-dim="1" cx="176" cy="76" r="4.5" fill="var(--accent-rose)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-rose));"></circle>
          <circle class="radar-dot" data-dim="2" cx="147" cy="165" r="4.5" fill="var(--accent-purple)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-purple));"></circle>
          <circle class="radar-dot" data-dim="3" cx="53" cy="165" r="4.5" fill="var(--accent-amber)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-amber));"></circle>
          <circle class="radar-dot" data-dim="4" cx="24" cy="76" r="4.5" fill="var(--accent-cyan)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-cyan));"></circle>

          <!-- Clickable Axis Labels -->
          <text class="radar-label" data-dim="0" x="100" y="15" fill="var(--text-muted)" font-size="8" text-anchor="middle" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "Empathy (MI)" : "傾聽共情 (MI)"}</text>
          <text class="radar-label" data-dim="1" x="182" y="76" fill="var(--text-muted)" font-size="8" text-anchor="start" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "Change Talk" : "改變談話 (MI)"}</text>
          <text class="radar-label" data-dim="2" x="152" y="175" fill="var(--text-muted)" font-size="8" text-anchor="start" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "Defusion (ACT)" : "心理解離 (ACT)"}</text>
          <text class="radar-label" data-dim="3" x="48" y="175" fill="var(--text-muted)" font-size="8" text-anchor="end" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "ICF Diagnostic" : "環境與個人診斷"}</text>
          <text class="radar-label" data-dim="4" x="18" y="76" fill="var(--text-muted)" font-size="8" text-anchor="end" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "Action Plan" : "漸進式行動計劃"}</text>
        </svg>

        <p style="font-size:0.8rem; color:var(--text-muted); text-align:center; margin: 0 0 6px 0;">
          ${feedbackLine}
        </p>
        ${practiceSupportNoticeHTML("text-align:center; margin:0 0 10px 0;")}

        <!-- Dynamic Recommendation Console mounting point -->
        <div id="radar-recommendation-panel" style="width:100%; background:var(--nested-bg-medium); border:1px solid var(--card-border); border-radius:10px; padding:12px; animation:fadeIn 0.4s ease; text-align:left;">
          <div id="radar-rec-content"></div>
        </div>
      </div>

    </div>

    <!-- Phase 6 SVG Longitudinal Trend Chart -->
    ${generateLongitudinalChartHTML(historySessions)}

    <!-- Phase 5 Visual Therapy Portfolios History section -->
    <div class="history-section-title" style="margin-top: 32px;">
      <i class="fa-solid fa-folder-open" style="color:var(--accent-purple);"></i>
      ${state.locale === "en" ? "Therapy Portfolios History Log" : state.locale === "zh-CN" ? "面谈历程会话档案库" : "面談歷程會話檔案庫"}
    </div>
    ${historyMarkup}

    <!-- Achievement Wall (Phase 4) -->
    ${renderAchievementsWall()}
  `;

  // Define static recommendation details database inside renderAnalytics
  const radarDimensionDetails = [
    {
      title: state.locale === "en" ? "Empathy (MI)" : "傾聽共情 (MI)",
      scoreKey: "empathy",
      desc: state.locale === "en" 
        ? "Motivational Interviewing core empathy. Focuses on reflective listening, open-ended questions, and affirmation while suppressing the Righting Reflex."
        : "動機式訪談法 (MI) 的核心心法。同工需使用開放式提問、肯定與深刻的『反映式傾聽 (Reflective Listening)』，接納案主的防衛情緒，避免進行批判或說教型糾正反射。",
      advice: state.locale === "en"
        ? "We suggest conducting more roleplay sessions. Try to start with reflective sentence patterns like 'It sounds like you feel...' in the first two rounds."
        : "建議增加模擬會話練習，在對話前幾輪多使用『聽起來你覺得...』或『你擔心...』的反映句型，避免過早給予就業強行建議。",
      actionBtnText: state.locale === "en" ? "Practice [OARS] Techniques" : "立即前往 [動機式訪談] OARS 訓練",
      actionView: "theory",
      actionTab: "mi"
    },
    {
      title: state.locale === "en" ? "Change Talk (MI)" : "改變談話 (MI)",
      scoreKey: "changeTalk",
      desc: state.locale === "en"
        ? "Eliciting internal motivation. Detect and amplify client's self-expressed language regarding desire, ability, reason, and need to make vocational changes."
        : "引發案主內在就業動機的關鍵技巧。同工需敏銳捕捉案主的準備度與改變性語言，並透過 OARS 提問引導案主口述改變的必要性與個人價值。",
      advice: state.locale === "en"
        ? "Go to the Co-Learning Studio and generate custom AI resistance quizzes to analyze change-talk indicators in depth."
        : "可在小組研討中仔細觀察案主對話片段，學習如何識別 OARS 經典關卡的 Change Talk 特徵，並利用 AI 研討題目生成艙動態生成更多對比題。",
      actionBtnText: state.locale === "en" ? "Go to [Co-Learning Studio]" : "進入 [小組研討] 生成阻抗題",
      actionView: "co-learning",
      actionTab: null
    },
    {
      title: state.locale === "en" ? "Defusion (ACT)" : "心理解離 (ACT)",
      scoreKey: "defusion",
      desc: state.locale === "en"
        ? "Acceptance & Commitment Therapy core. Guide client to separate from cognitive fusions (e.g. self-deprecating labels or paralysis concepts)."
        : "接納承諾療法 (ACT) 的靈魂維度。同工需引導案主與其大腦產生的『廢人標籤』或『殘疾融合想法』進行認知解離，澄清核心價值，重塑觀察自我。",
      advice: state.locale === "en"
        ? "If this score is low, try the Cognitive Defusion Sandbox to practice writing HK Cantonese defusion templates."
        : "若此項得分較低，強烈建議進入 ACT 實務鞏固測驗的『認知解離沙盒』進行寫作，練習港式解離口訣『我注意到，我腦海中浮現一個諗法話我...』。",
      actionBtnText: state.locale === "en" ? "Go to [Cognitive Defusion Sandbox]" : "進入 [認知解離沙盒] 練習解離",
      actionView: "theory",
      actionTab: "act"
    },
    {
      title: state.locale === "en" ? "ICF Diagnostic" : "環境與個人診斷 (ICF)",
      scoreKey: "icf",
      desc: state.locale === "en"
        ? "WHO Biopsychosocial full matrix. Objectively categorize client factors into health, structures, limitations, environment, and personal criteria."
        : "世界衛生組織 (WHO) 全人復康評估矩陣。要求同工徹底摒棄醫學殘疾偏見，將案主特徵客觀分類至健康、身體功能、活動局限、環境與個人因素等 6 大維度中。",
      advice: state.locale === "en"
        ? "Go to the ICF Sandbox to practice drag-and-drop categorizations to improve diagnostic precision."
        : "建議至 ICF 實務測驗分頁的『ICF 診斷沙盒』進行拖曳磁吸分門別類訓練，深入理解如何將環境阻礙因子與個人優勢因子寫入 SOAP 記錄中。",
      actionBtnText: state.locale === "en" ? "Practice [ICF Sandbox]" : "進入 [ICF 全人診斷沙盒] 強化分類",
      actionView: "theory",
      actionTab: "icf"
    },
    {
      title: state.locale === "en" ? "Action Plan" : "漸進式行動計劃",
      scoreKey: "action",
      desc: state.locale === "en"
        ? "Vocational counseling wrap-up. Negotiate committed action plans cut exactly to the client's values and verified readiness indicators."
        : "復康輔導的實戰收尾。同工需與案主共同協商出具備具體性、漸進性且切合 ACT 價值澄清的實際承諾行動 (Committed Action)，防止流於空談。",
      advice: state.locale === "en"
        ? "In the roleplay cabin, leverage the sliding SOAP assistant panel to co-draft committed actions from AI supervisor summaries."
        : "在模擬輔導室最後階段，利用 S-O-A-P 輔助日誌，一鍵開啟側滑式 AI SOAP 建議助手，綜合面談全對白起草承諾協議，大幅提升計劃可行性分數。",
      actionBtnText: state.locale === "en" ? "Practice in [Roleplay Cabin]" : "進入 [個案實戰 Arena] 實踐計劃",
      actionView: "arena",
      actionTab: null
    }
  ];

  function renderRadarRecommendation(idx) {
    const panel = document.getElementById("radar-rec-content");
    if (!panel) return;
    
    const details = radarDimensionDetails[idx];
    // Milestone 7：state.radarScores 為 null 代表尚無已評估紀錄，不得顯示成 0 分。
    const currentScore = state.radarScores ? state.radarScores[details.scoreKey] : null;
    const scoreBadgeText = currentScore === null
      ? (state.locale === "en" ? "Not evaluated" : "未評估")
      : `${state.locale === "en" ? "Score" : "平均"} ${currentScore} ${state.locale === "en" ? "" : "分"}`;
    
    // Highlight active label and dot in SVG
    const labels = container.querySelectorAll(".radar-label");
    const dots = container.querySelectorAll(".radar-dot");
    
    labels.forEach((l, i) => {
      l.style.fill = (i === idx) ? "var(--accent-cyan)" : "var(--text-muted)";
      l.style.fontSize = (i === idx) ? "9.5px" : "8px";
    });
    
    dots.forEach((d, i) => {
      d.setAttribute("r", (i === idx) ? "6.5" : "4.5");
      d.style.fill = (i === idx) ? "var(--accent-cyan)" : "";
    });
    
    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:6px;">
        <h4 style="font-size:0.92rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:6px; margin:0;">
          <i class="fa-solid fa-compass" style="color:var(--accent-cyan);"></i>
          ${details.title}
        </h4>
        <span class="lcd-digital-badge" style="font-size:0.75rem; padding:2px 8px;">${scoreBadgeText}</span>
      </div>
      <p style="font-size:0.78rem; color:var(--text-main); line-height:1.5; margin:0 0 10px 0;">${details.desc}</p>
      <div style="background:rgba(6,182,212,0.04); border:1px solid rgba(6,182,212,0.12); padding:8px 12px; border-radius:8px; margin-bottom:10px; font-size:0.75rem; line-height:1.5; color:var(--text-bright);">
        <strong>💡 ${state.locale === "en" ? "Clinical Advice" : "臨床改善建議"}</strong>：${details.advice}
      </div>
      <button class="btn btn-primary" id="radar-rec-action-btn" style="width:100%; padding:6px 0; justify-content:center; font-size:0.75rem;">
        <i class="fa-solid fa-bolt"></i> ${details.actionBtnText}
      </button>
    `;
    
    // Attach click on recommendation shortcut button
    document.getElementById("radar-rec-action-btn").addEventListener("click", () => {
      AudioSynth.playClick();
      if (details.actionView) {
        switchView(details.actionView);
        if (details.actionTab) {
          // Wait slightly for DOM to mount and click sub-tab
          setTimeout(() => {
            const tab = document.getElementById(`tab-btn-${details.actionTab}`);
            if (tab) tab.click();
          }, 150);
        }
      }
    });
  }

  // Attach event listener on each history card to trigger visual popup
  const cards = container.querySelectorAll(".history-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const sessionId = card.getAttribute("data-session-id");
      const foundSession = historySessions.find(s => s.id === sessionId);
      if (foundSession) {
        showSessionDetailPopup(foundSession);
      }
    });
  });

  // Attach Radar clicks to labels and dots
  const radarLabels = container.querySelectorAll(".radar-label");
  const radarDots = container.querySelectorAll(".radar-dot");
  
  radarLabels.forEach(label => {
    label.addEventListener("click", () => {
      const idx = parseInt(label.getAttribute("data-dim"));
      AudioSynth.playClick();
      renderRadarRecommendation(idx);
    });
  });
  
  radarDots.forEach(dot => {
    dot.addEventListener("click", () => {
      const idx = parseInt(dot.getAttribute("data-dim"));
      AudioSynth.playClick();
      renderRadarRecommendation(idx);
    });
  });
  
  // Render default first view (Empathy) on load
  renderRadarRecommendation(0);
}

/**
 * Milestone 7：單場面談的五維分數卡（只在該場**確實有** AI 評估時呼叫）。
 * 座標公式與儀表板縮影、分析頁共用 radarPolygonPoints()。
 */
function renderSessionScoreCard(scores) {
  const radar = {
    empathy: scores.empathy || 0,
    changeTalk: scores.changeTalk || 0,
    defusion: scores.actFlexibility || 0,
    icf: scores.icfAccuracy || 0,
    action: scores.actionPlanning || 0
  };
  const rows = [
    [state.locale === "en" ? "Empathy (MI OARS)" : "同理反映", radar.empathy],
    [state.locale === "en" ? "Capture Change Talk" : "改變談話", radar.changeTalk],
    [state.locale === "en" ? "ACT Flexibility" : "心理彈性", radar.defusion],
    [state.locale === "en" ? "ICF Matrix Diagnostic" : "全人評估", radar.icf],
    [state.locale === "en" ? "Action Planning" : "承諾行動", radar.action]
  ];

  return `
    <div class="glass-card" style="display:flex; flex-direction:column; gap:12px; align-items:center; background:var(--nested-bg-medium); padding:16px;">
      <h4 style="font-size:0.85rem; font-weight:800; color:var(--text-bright); align-self:flex-start;">
        ${state.locale === "en" ? "Competence Scores" : state.locale === "zh-CN" ? "本次面谈技巧评分" : "本次面談技巧評分"}
      </h4>
      <svg width="180" height="180" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="80" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
        <circle cx="100" cy="100" r="60" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
        <circle cx="100" cy="100" r="40" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
        <circle cx="100" cy="100" r="20" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>

        <line x1="100" y1="100" x2="100" y2="20" stroke="var(--illustration-line)" stroke-width="1"/>
        <line x1="100" y1="100" x2="176" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
        <line x1="100" y1="100" x2="147" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
        <line x1="100" y1="100" x2="53" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
        <line x1="100" y1="100" x2="24" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>

        <text x="100" y="15" fill="var(--text-muted)" font-size="8" text-anchor="middle">${state.locale === "en" ? "Empathy (MI)" : "同理反映"}</text>
        <text x="182" y="76" fill="var(--text-muted)" font-size="8" text-anchor="start">${state.locale === "en" ? "Change Talk" : "改變談話"}</text>
        <text x="152" y="175" fill="var(--text-muted)" font-size="8" text-anchor="start">${state.locale === "en" ? "Flexibility (ACT)" : "心理彈性"}</text>
        <text x="48" y="175" fill="var(--text-muted)" font-size="8" text-anchor="end">${state.locale === "en" ? "Diagnostic (ICF)" : "全人評估"}</text>
        <text x="18" y="76" fill="var(--text-muted)" font-size="8" text-anchor="end">${state.locale === "en" ? "Action Plan" : "承諾行動"}</text>

        <polygon points="${radarPolygonPoints(radar, 80)}" fill="rgba(6, 182, 212, 0.25)" stroke="var(--accent-cyan)" stroke-width="2"/>
      </svg>

      <div style="width:100%; display:flex; flex-direction:column; gap:4px; font-size:0.75rem;">
        ${rows.map(([label, val]) => `
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border);">
            <span style="color:var(--text-muted);">${label}</span>
            <span style="font-weight:700; color:var(--text-bright);">${val}</span>
          </div>
        `).join("")}
      </div>
      ${practiceSupportNoticeHTML("margin-top:4px;")}
    </div>
  `;
}

/** Milestone 7：未評估面談的說明卡 —— 取代舊版那張全 0 的雷達。 */
function renderSessionNotEvaluatedCard() {
  return `
    <div class="glass-card" style="display:flex; flex-direction:column; gap:12px; background:var(--nested-bg-medium); padding:16px;">
      <h4 style="font-size:0.85rem; font-weight:800; color:var(--accent-amber); display:flex; align-items:center; gap:6px;">
        <i class="fa-solid fa-clapperboard"></i> ${state.locale === "en" ? "Not evaluated" : "本次面談未經評估"}
      </h4>
      <p style="font-size:0.8rem; color:var(--text-main); line-height:1.6; margin:0;">
        ${state.locale === "en"
          ? "This session ran in offline demo mode, so there is no AI clinical evaluation — no scores, no radar, no supervisor summary. The transcript and the notes you wrote are real and are shown in the other tabs."
          : "本次面談在<b>離線示範模式</b>下進行，沒有 AI 臨床評估 —— 沒有評分、沒有雷達圖、沒有督導總結。其他分頁的逐字紀錄與你自己撰寫的日誌是真實內容。"}
      </p>
      <p style="font-size:0.78rem; color:var(--text-muted); line-height:1.6; margin:0;">
        ${state.locale === "en"
          ? "To have future sessions evaluated, set a Gemini API key in Settings."
          : "若要讓日後的面談產生評估，請在「系統設定」中填入 Gemini API 金鑰。"}
      </p>
    </div>
  `;
}

function showSessionDetailPopup(session) {
  // Play click sound
  AudioSynth.playClick();

  // Create overlay if not exists
  let overlay = document.getElementById("session-detail-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "session-detail-overlay";
    overlay.className = "popup-overlay";
    document.body.appendChild(overlay);
  }

  const evaluated = hasEvaluation(session);

  // D20(b)：舊版在未評估時把五維解構為 0，然後照樣畫雷達與「同理反映 0 / 改變談話 0」，
  // 標題仍是「本次面談技巧評分」。收縮到圓心的五邊形讀起來是「這場拿了 0 分」，
  // 而事實是這場從未被評估。零填充的解構整個刪除 —— 它就是缺陷本身。
  const scoreBlockHTML = evaluated
    ? renderSessionScoreCard(session.report.scores)
    : renderSessionNotEvaluatedCard();

  // Render full detailed portfolio
  overlay.innerHTML = `
    <div class="popup-content">
      <div class="popup-header">
        <h3 class="popup-title">
          <i class="fa-solid fa-folder-open" style="color:var(--accent-purple); margin-right:8px;"></i>
          ${state.locale === "en" ? "Session Portfolio Review" : state.locale === "zh-CN" ? "面谈历程全息查看" : "面談歷程全息查看"}：${session.caseName}
        </h3>
        <button class="btn btn-circle" id="popup-close-btn" style="border:none; background:transparent;" title="Close">
          <i class="fa-solid fa-xmark" style="font-size: 1.25rem;"></i>
        </button>
      </div>
      <div class="popup-body">
        
        <!-- Tab controls inside popup -->
        <div class="notes-tab-group" style="margin-bottom:12px;">
          <div class="notes-tab active" id="tab-popup-report">${state.locale === "en" ? "Supervisor Report" : state.locale === "zh-CN" ? "督导评估报告" : "督導評估報告"}</div>
          <div class="notes-tab" id="tab-popup-transcript">${state.locale === "en" ? "Dialogue Transcript" : state.locale === "zh-CN" ? "对话记录还原" : "對話記錄還原"}</div>
          <div class="notes-tab" id="tab-popup-notes">${state.locale === "en" ? "My SOAP Notes" : state.locale === "zh-CN" ? "面谈日记 SOAP" : "面談日誌 SOAP"}</div>
        </div>

        <!-- Section 1: Supervisor Report Tab Content -->
        <div class="popup-tab-content" id="popup-content-report">
          <div class="grid-2col" style="gap: 16px;">
            <!-- Milestone 7：有評估畫分數卡，無評估畫說明卡，不再以 0 填充 -->
            ${scoreBlockHTML}

            <!-- Report summary feedback（Milestone 7：未評估時整塊略去，
                 說明已由左側說明卡承擔，重覆兩次反而模糊了訊息） -->
            ${evaluated ? `
            <div style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="font-size:0.9rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-user-tie" style="color:var(--accent-cyan);"></i> ${state.locale === "en" ? "Clinical Summary Feedback" : "督導意見總結"}
              </h4>
              <p style="font-size:0.8rem; color:var(--text-main); line-height:1.6; background:var(--nested-bg-faint); padding:12px; border-radius:8px; border-left:4px solid var(--accent-cyan); max-height:220px; overflow-y:auto;">
                ${session.report.summary.replace(/\n/g, "<br>")}
              </p>
            </div>` : ""}
          </div>
        </div>

        <!-- Section 2: Dialogue Transcript Tab Content -->
        <div class="popup-tab-content" id="popup-content-transcript" style="display:none;">
          <div class="chat-history-container" style="max-height: 380px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 12px; background: var(--nested-bg-medium); border-radius: 8px;">
            ${session.history.map(msg => {
              const isUser = msg.role === "user";
              return `
                <div class="chat-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}${msg.scripted ? ' bubble-scripted' : ''}" style="margin: 4px 0; max-width: 80%; ${isUser ? 'align-self: flex-end;' : 'align-self: flex-start;'}">
                  <div class="bubble-meta">${isUser ? (state.locale === "en" ? "Rehab Staff" : "諮商師(你)") : session.caseName}${msg.scripted ? `<span class="bubble-scripted-tag"><i class="fa-solid fa-clapperboard"></i> 示範劇本</span>` : ""}</div>
                  <div class="bubble-text" style="font-size:0.85rem; line-height:1.5;">${msg.text}</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Section 3: SOAP Notes Tab Content -->
        <div class="popup-tab-content" id="popup-content-notes" style="display:none;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 16px; min-height: 200px;">
            <h4 style="font-size:0.88rem; font-weight:700; color:var(--text-bright); margin-bottom:8px;">
              <i class="fa-solid fa-pen-to-square"></i> ${state.locale === "en" ? "Session Log Backups" : "面談日誌備份"}
            </h4>
            <pre style="font-family:inherit; font-size:0.85rem; color:var(--text-main); white-space:pre-wrap; line-height:1.6;">${session.notes.soap || session.notes.icf || (state.locale === "en" ? "No notes recorded for this session." : "本次面談未撰寫任何日誌記錄。")}</pre>
          </div>
        </div>

      </div>
      <div class="popup-footer">
        <button class="btn btn-cyan" id="popup-export-btn" style="margin-right:10px;"><i class="fa-solid fa-download"></i> ${state.locale === "en" ? "Export Report" : "匯出報告"}</button>
        <button class="btn" id="popup-close-confirm-btn">${state.locale === "en" ? "Close" : "關閉"}</button>
      </div>
    </div>
  `;

  // Add event listeners for popup tabs
  const tabReport = overlay.querySelector("#tab-popup-report");
  const tabTranscript = overlay.querySelector("#tab-popup-transcript");
  const tabNotes = overlay.querySelector("#tab-popup-notes");

  const contentReport = overlay.querySelector("#popup-content-report");
  const contentTranscript = overlay.querySelector("#popup-content-transcript");
  const contentNotes = overlay.querySelector("#popup-content-notes");

  function switchPopupTab(activeTab, activeContent) {
    AudioSynth.playClick();
    [tabReport, tabTranscript, tabNotes].forEach(t => t.classList.remove("active"));
    [contentReport, contentTranscript, contentNotes].forEach(c => c.style.display = "none");
    
    activeTab.classList.add("active");
    activeContent.style.display = "block";
  }

  tabReport.addEventListener("click", () => switchPopupTab(tabReport, contentReport));
  tabTranscript.addEventListener("click", () => switchPopupTab(tabTranscript, contentTranscript));
  tabNotes.addEventListener("click", () => switchPopupTab(tabNotes, contentNotes));

  // Export event listener
  overlay.querySelector("#popup-export-btn").addEventListener("click", () => {
    AudioSynth.playClick();
    exportSessionReport(session.report, session);
  });

  // Close event listeners
  const closePopup = () => {
    AudioSynth.playClick();
    overlay.classList.remove("show");
  };

  overlay.querySelector("#popup-close-btn").addEventListener("click", closePopup);
  overlay.querySelector("#popup-close-confirm-btn").addEventListener("click", closePopup);

  // Trigger animation show
  setTimeout(() => overlay.classList.add("show"), 50);
}

/* ==========================================================================
   View 8: Settings
   ========================================================================== */
function renderSettings(container) {
  container.innerHTML = `
    <div class="glass-card" style="max-width: 600px; margin: 0 auto; display:flex; flex-direction:column; gap:16px;">
      <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:8px;">
        <i class="fa-solid fa-sliders" style="color:var(--accent-purple);"></i> 平台全局設定
      </h3>
      
      <form id="settings-form" style="display:flex; flex-direction:column; gap:12px;">
        
        <div class="form-group">
          <label>同工姓名 / 用戶姓名 (User Name)</label>
          <input type="text" id="set-user-name" value="${state.userName || ''}" placeholder="例如：陳大文 (請輸入你的姓名)" />
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            👤 輸入你的姓名後，左下角的「職業復康同工」將會更新為「職業復康同工 (你的姓名)」。
          </p>
        </div>

        <div class="form-group">
          <label>Google Gemini API 金鑰 (API Key)</label>
          <input type="password" id="set-api-key" value="${state.apiKey}" placeholder="輸入 AI 在線模式的金鑰 (AI-ZASy...)" />
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            🔑 金鑰直接存放於你本地瀏覽器的安全 localStorage 中，純前端直連 Google Gemini REST 端點，保障機構數據安全。如無金鑰，系統將以預設的高質量 Mock 數據運行離線體驗模式。
          </p>
        </div>

        <div class="form-group">
          <label>大語言模型選擇 (Gemini Model)</label>
          <select id="set-model">
            <option value="gemini-2.5-flash" ${state.selectedModel === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash (推薦：最新高效能且極速回應)</option>
            <option value="gemini-3.1-flash-lite" ${state.selectedModel === 'gemini-3.1-flash-lite' ? 'selected' : ''}>Gemini 3.1 Flash-Lite (極速：超低延遲極致對答)</option>
            <option value="gemini-1.5-pro" ${state.selectedModel === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro (深度：專業臨床同理與督導評估)</option>
          </select>
        </div>

        <div class="form-group" style="background: rgba(var(--accent-rgb), 0.04); border: 1px solid rgba(var(--accent-rgb), 0.15); border-radius: 10px; padding: 14px; display:flex; flex-direction:column; gap:10px;">
          <label style="font-weight: 700; color: var(--accent-cyan); display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-microphone-lines"></i> 廣東話語音朗讀引擎 (Cantonese TTS Engine)
          </label>
          <select id="set-tts-engine">
            <option value="system" ${state.ttsEngine === 'system' ? 'selected' : ''}>系統原生語音 (免費 / 免 API 金鑰)</option>
            <option value="minimax-global" ${state.ttsEngine === 'minimax-global' ? 'selected' : ''}>MiniMax 國際版 (api.minimax.chat - 擬真粵語推薦 ⭐)</option>
            <option value="minimax-cn" ${state.ttsEngine === 'minimax-cn' ? 'selected' : ''}>MiniMax 國內版 (api.minimaxi.chat - 中國大陸節點)</option>
          </select>

          <div id="minimax-config-panel" style="${state.ttsEngine && state.ttsEngine.startsWith('minimax') ? 'display:flex;' : 'display:none;'} flex-direction:column; gap:10px; margin-top:4px;">
            <div>
              <label style="font-size:0.8rem; color:var(--text-muted);">MiniMax API 金鑰 (API Key)</label>
              <input type="password" id="set-minimax-api-key" value="${state.minimaxApiKey || ''}" placeholder="輸入 MiniMax API Key (eyJ...)" style="margin-top:2px;" />
            </div>

            <div>
              <label style="font-size:0.8rem; color:var(--text-muted);">MiniMax Group ID (用戶群組 ID)</label>
              <input type="text" id="set-minimax-group-id" value="${state.minimaxGroupId || ''}" placeholder="例如：181234567890..." style="margin-top:2px;" />
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <label style="font-size:0.8rem; color:var(--text-muted);">👨 男案主粵語聲線 (Male Timbre)</label>
                <select id="set-minimax-male-timbre" style="margin-top:2px;">
                  <option value="male-qn-qingse" ${state.minimaxMaleTimbre === 'male-qn-qingse' || state.minimaxMaleTimbre === 'cantonese_male' ? 'selected' : ''}>青年男聲 (male-qn-qingse - 推薦 ⭐)</option>
                  <option value="male-qn-jingying" ${state.minimaxMaleTimbre === 'male-qn-jingying' ? 'selected' : ''}>精英男聲 (male-qn-jingying)</option>
                  <option value="male-qn-daxuesheng" ${state.minimaxMaleTimbre === 'male-qn-daxuesheng' ? 'selected' : ''}>陽光男聲 (male-qn-daxuesheng)</option>
                  <option value="presenter_male" ${state.minimaxMaleTimbre === 'presenter_male' ? 'selected' : ''}>成熟播音男聲 (presenter_male)</option>
                  <option value="male-qn-badao" ${state.minimaxMaleTimbre === 'male-qn-badao' ? 'selected' : ''}>磁性男聲 (male-qn-badao)</option>
                </select>
              </div>

              <div>
                <label style="font-size:0.8rem; color:var(--text-muted);">👩 女案主粵語聲線 (Female Timbre)</label>
                <select id="set-minimax-female-timbre" style="margin-top:2px;">
                  <option value="female-yujie" ${state.minimaxFemaleTimbre === 'female-yujie' || state.minimaxFemaleTimbre === 'cantonese_female' ? 'selected' : ''}>溫柔成熟女聲 (female-yujie - 推薦 ⭐)</option>
                  <option value="female-shaonv" ${state.minimaxFemaleTimbre === 'female-shaonv' ? 'selected' : ''}>活力少女 (female-shaonv)</option>
                  <option value="female-tianmei" ${state.minimaxFemaleTimbre === 'female-tianmei' ? 'selected' : ''}>甜美女聲 (female-tianmei)</option>
                  <option value="female-chengshu" ${state.minimaxFemaleTimbre === 'female-chengshu' ? 'selected' : ''}>幹練成熟女聲 (female-chengshu)</option>
                  <option value="presenter_female" ${state.minimaxFemaleTimbre === 'presenter_female' ? 'selected' : ''}>清晰播音女聲 (presenter_female)</option>
                </select>
              </div>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:4px;">
              <button type="button" id="btn-test-minimax-tts" class="btn" style="background:rgba(6, 182, 212, 0.15); border:1px solid var(--accent-cyan); color:var(--accent-cyan); font-size:0.75rem; padding:6px 12px;">
                <i class="fa-solid fa-volume-high"></i> 🔊 測試 MiniMax 廣東話發音
              </button>
              <span id="minimax-test-status" style="font-size:0.72rem; color:var(--text-muted);"></span>
            </div>

            <!-- MiniMax API 執行診斷日誌視窗 -->
            <div id="minimax-debug-container" style="display:flex; flex-direction:column; gap:6px; margin-top:10px; border-top:1px dashed var(--card-border); padding-top:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.75rem; font-weight:700; color:var(--accent-cyan);">
                  <i class="fa-solid fa-terminal"></i> 🔍 MiniMax API 執行診斷日誌 (Diagnostic Log)
                </span>
                <div style="display:flex; gap:6px;">
                  <button type="button" id="btn-copy-minimax-log" class="btn" style="padding:3px 8px; font-size:0.7rem; background:rgba(255,255,255,0.06); border:1px solid var(--card-border); color:var(--text-bright); border-radius:4px; cursor:pointer;">
                    📋 複製完整日誌
                  </button>
                  <button type="button" id="btn-clear-minimax-log" class="btn" style="padding:3px 8px; font-size:0.7rem; background:rgba(255,255,255,0.06); border:1px solid var(--card-border); color:var(--text-muted); border-radius:4px; cursor:pointer;">
                    🧹 清空
                  </button>
                </div>
              </div>
              <pre id="minimax-debug-log" style="background:#090d16; border:1px solid rgba(6,182,212,0.25); color:#38bdf8; padding:10px; border-radius:6px; font-size:0.72rem; max-height:180px; overflow-y:auto; white-space:pre-wrap; word-break:break-all; font-family:monospace; line-height:1.4;">${(state.minimaxLogs && state.minimaxLogs.length > 0) ? state.minimaxLogs.join("\n") : (localStorage.getItem("rehab_minimax_debug_log") || "點擊上方「測試發音」按鈕後，此處將實時輸出連線握手、HTTP 狀態碼與 MiniMax 原始返回內容...")}</pre>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>系統原生 TTS 語音朗讀聲音 (Web Speech Voice Fallback)</label>
          <select id="set-voice">
            <option value="">預設系統廣東話聲音 (Auto HK Voice)</option>
            ${state.voices.filter(v => v.lang === "zh-HK" || v.lang === "zh-Hant-HK" || v.name.toLowerCase().includes("hong kong")).map(v => `
              <option value="${v.name}" ${state.selectedVoiceName === v.name ? 'selected' : ''}>${v.name} (${v.lang})</option>
            `).join("")}
          </select>
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            📢 系統原生語音使用瀏覽器內建 TTS。若選擇 MiniMax 引擎，當網絡離線或未配置時會自動平滑降級為本原生語音。
          </p>
        </div>

        <div class="form-group">
          <label>廣東話語音識別地區語言代碼 (Speech Recognition Locale)</label>
          <select id="set-rec-lang">
            <option value="yue-Hant-HK" ${state.recognitionLang === 'yue-Hant-HK' ? 'selected' : ''}>yue-Hant-HK (粵語專用代碼 - Chrome 強烈推薦 ⭐)</option>
            <option value="zh-HK" ${state.recognitionLang === 'zh-HK' ? 'selected' : ''}>zh-HK (通用香港中文 - 部分瀏覽器可能誤判為普通話)</option>
            <option value="zh-Hant-HK" ${state.recognitionLang === 'zh-Hant-HK' ? 'selected' : ''}>zh-Hant-HK (繁體中文香港 - Safari / Apple 裝置推薦 ⭐)</option>
            <option value="zh-CN" ${state.recognitionLang === 'zh-CN' ? 'selected' : ''}>zh-CN (普通話/簡體中文 - 僅供調試或特殊情況使用)</option>
          </select>
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            💡 <b style="color:var(--accent-amber);">Chrome 用戶必讀 — 廣東話被誤判為普通話的解決方案：</b><br><br>
            <b>問題根因</b>：Chrome 的語音識別使用 Google 雲端引擎。當你用 <code>zh-HK</code> 代碼時，Google 的引擎可能會根據你的 Google 賬號語言偏好（如設定為國語/普通話）強制覆寫語音模型，導致你講廣東話但辨識出普通話文字。Safari 不受此影響，因為它使用 Apple 本地設備引擎。<br><br>
            <b>解決方法（由高效到保底）</b>：<br>
            1. ⭐ <b>切換至 <code>yue-Hant-HK</code></b>：此代碼是 BCP-47 標準中「粵語（繁體字、香港）」的專用標記，能明確命令 Google 雲端引擎載入粵語聲學模型，不受賬號偏好干擾。<b>本平台已將 Chrome 的預設值自動設為此代碼。</b><br>
            2. 🔒 <b>使用無痕視窗 (Incognito Window)</b>：在無痕視窗中訪問本平台，可徹底隔離 Google 賬號偏好，還原準確的廣東話識別。<br>
            3. ⚙️ <b>修改 Google 賬號語言</b>：在 <code>myaccount.google.com</code> → 個人資料 → 語言偏好設定 中，將首選語言改為「中文（香港）」或「廣東話」。<br><br>
            <b>安全上下文限制 (HTTPS/Localhost)</b>：請確保你使用的是 <code>http://localhost:8000</code> 或 <code>http://127.0.0.1:8000</code> 進行調試；區域網路 IP（如 <code>http://192.168.x.x</code>）會被 Chrome 因「非安全上下文」停用語音識別。
          </p>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;">
          <button type="submit" class="btn btn-primary">儲存變更 Save</button>
        </div>
      </form>

      <div style="border-top: 1px solid var(--card-border); margin-top: 20px; padding-top: 20px;">
        <h4 style="font-size:0.88rem; font-weight:800; color:var(--accent-cyan); display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <i class="fa-solid fa-shield-halved"></i> 資料保險箱 (Local Vault)
        </h4>
        <div style="background:rgba(34,211,238,0.04); border:1px dashed rgba(34,211,238,0.25); border-radius:8px; padding:12px 16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:220px;">
              <p style="font-size:0.78rem; color:var(--text-bright); font-weight:700; margin-bottom:2px;">
                目前儲存：${state.historySessions.length} 場面談紀錄 · ${getCustomCases().length} 個自定義個案
              </p>
              <p style="font-size:0.72rem; color:var(--text-muted); line-height:1.4;">
                儲存引擎：${state.vaultMode === "indexeddb"
                  ? '<span style="color:var(--accent-green); font-weight:700;">IndexedDB 大容量保險箱</span>（數百 MB，不受 5MB 配額限制）'
                  : `<span style="color:var(--accent-red); font-weight:700;">⚠️ localStorage 唯讀降級模式</span>（${vaultDegradedNotice().title}；新紀錄仍受 5MB 配額限制，且無法執行還原）`}
                ${state.vaultMode === "indexeddb" ? "" : `<br><span style="color:var(--accent-amber);">${vaultDegradedNotice().body}</span>`}
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button id="rp-vault-export-btn" type="button" style="background:rgba(34,211,238,0.12); border:1px solid rgba(34,211,238,0.4); color:var(--accent-cyan); font-weight:700; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.75rem; white-space:nowrap; transition:all 0.25s ease;">
                <i class="fa-solid fa-download"></i> 匯出全量備份
              </button>
              <button id="rp-vault-import-btn" type="button" style="background:rgba(148,163,184,0.12); border:1px solid rgba(148,163,184,0.4); color:var(--text-bright); font-weight:700; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.75rem; white-space:nowrap; transition:all 0.25s ease;">
                <i class="fa-solid fa-upload"></i> 匯入備份還原
              </button>
              <input type="file" id="rp-vault-import-input" accept="application/json,.json" style="display:none;">
            </div>
          </div>
          <p style="font-size:0.7rem; color:var(--text-muted); line-height:1.5; margin-top:10px; padding-top:10px; border-top:1px dashed rgba(148,163,184,0.18);">
            <i class="fa-solid fa-lock" style="color:var(--accent-green);"></i>
            備份檔包含全部面談逐字紀錄、臨床評核報告、自定義個案、成就與理論進度，
            <b style="color:var(--text-bright);">但蓄意不含 Gemini / MiniMax API 金鑰</b>，可安全轉存或交予督導。
            還原為覆蓋式操作，會先清空現有保險箱。
          </p>
        </div>
      </div>

      <div style="border-top: 1px solid var(--card-border); margin-top: 20px; padding-top: 20px;">
        <h4 style="font-size:0.88rem; font-weight:800; color:var(--accent-red); display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <i class="fa-solid fa-triangle-exclamation"></i> 危險區域 (Danger Zone)
        </h4>
        <div style="background:rgba(239,68,68,0.04); border:1px dashed rgba(239,68,68,0.25); border-radius:8px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; gap:16px;">
          <div style="flex:1;">
            <p style="font-size:0.78rem; color:var(--text-bright); font-weight:700; margin-bottom:2px;">重設學習進度與數據</p>
            <p style="font-size:0.72rem; color:var(--text-muted); line-height:1.4;">此操作將會清空你本地所有的對話歷史、臨床評核報告、自定義個案以及已解鎖的成就徽章。該操作不可撤銷，請謹慎操作。</p>
          </div>
          <button id="rp-reset-progress-btn" type="button" class="btn btn-reset" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.4); color:#ef4444; font-weight:700; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.75rem; white-space:nowrap; transition:all 0.25s ease;">重設進度 Reset</button>
        </div>
      </div>
    </div>
  `;

  // Toggle MiniMax config panel on engine select change
  const engineSelect = document.getElementById("set-tts-engine");
  const minimaxPanel = document.getElementById("minimax-config-panel");
  if (engineSelect && minimaxPanel) {
    engineSelect.addEventListener("change", () => {
      const isMiniMax = engineSelect.value.startsWith("minimax");
      minimaxPanel.style.display = isMiniMax ? "flex" : "none";
    });
  }

  // Auto-detect & fill Group ID when API Key is pasted
  const apiKeyInput = document.getElementById("set-minimax-api-key");
  const groupIdInput = document.getElementById("set-minimax-group-id");
  if (apiKeyInput && groupIdInput) {
    apiKeyInput.addEventListener("input", () => {
      const token = apiKeyInput.value.trim();
      const extractedGid = extractGroupIdFromJwt(token);
      if (extractedGid && !groupIdInput.value.trim()) {
        groupIdInput.value = extractedGid;
      }
    });
  }

  // MiniMax Voice Test Button Listener
  const testTtsBtn = document.getElementById("btn-test-minimax-tts");
  const testStatus = document.getElementById("minimax-test-status");
  if (testTtsBtn) {
    testTtsBtn.addEventListener("click", async () => {
      const engine = engineSelect ? engineSelect.value : state.ttsEngine;
      const isCn = engine === "minimax-cn";
      const key = (document.getElementById("set-minimax-api-key")?.value || "").trim();
      const groupId = (document.getElementById("set-minimax-group-id")?.value || "").trim();
      const maleVoice = document.getElementById("set-minimax-male-timbre")?.value || "cantonese_male";
      
      if (!key) {
        alert("請先輸入 MiniMax API 金鑰再進行發音測試！");
        return;
      }

      testTtsBtn.disabled = true;
      testStatus.textContent = "⏳ 正在合成測試語音...";
      testStatus.style.color = "var(--accent-cyan)";

      try {
        const testText = "同工你好！我係 MiniMax 廣東話語音引擎，祝你輔導順利！";
        const audioUrl = await fetchMiniMaxTTSAudio(testText, maleVoice, key, groupId, isCn);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          testTtsBtn.disabled = false;
          testStatus.textContent = "✅ 語音播放完畢，連線正常！";
          testStatus.style.color = "var(--accent-green)";
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = (e) => {
          testTtsBtn.disabled = false;
          testStatus.textContent = "❌ 音訊解碼失敗";
          testStatus.style.color = "var(--accent-rose)";
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
      } catch (err) {
        testTtsBtn.disabled = false;
        testStatus.textContent = `❌ 連線失敗: ${err.message}`;
        testStatus.style.color = "var(--accent-rose)";
      }
    });
  }

  // Copy MiniMax Diagnostic Log
  const copyLogBtn = document.getElementById("btn-copy-minimax-log");
  if (copyLogBtn) {
    copyLogBtn.addEventListener("click", async () => {
      const logBox = document.getElementById("minimax-debug-log");
      const textToCopy = logBox ? logBox.textContent : (state.minimaxLogs || []).join("\n");
      try {
        await navigator.clipboard.writeText(textToCopy);
        const origText = copyLogBtn.innerHTML;
        copyLogBtn.innerHTML = "✅ 已複製！";
        setTimeout(() => copyLogBtn.innerHTML = origText, 2000);
      } catch (err) {
        alert("複製失敗，請手動全選下方日誌文字進行複製。");
      }
    });
  }

  // Clear MiniMax Diagnostic Log
  const clearLogBtn = document.getElementById("btn-clear-minimax-log");
  if (clearLogBtn) {
    clearLogBtn.addEventListener("click", () => {
      state.minimaxLogs = [];
      localStorage.removeItem("rehab_minimax_debug_log");
      const logBox = document.getElementById("minimax-debug-log");
      if (logBox) logBox.textContent = "日誌已清空。點擊上方「測試發音」即可生成全新診斷日誌。";
    });
  }

  // Attach Settings Submit
  const form = document.getElementById("settings-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const userName = document.getElementById("set-user-name").value.trim();
    const key = document.getElementById("set-api-key").value.trim();
    const model = document.getElementById("set-model").value;
    const ttsEngine = document.getElementById("set-tts-engine").value;
    const minimaxKey = document.getElementById("set-minimax-api-key")?.value.trim() || "";
    const minimaxGroup = document.getElementById("set-minimax-group-id")?.value.trim() || "";
    const maleTimbre = document.getElementById("set-minimax-male-timbre")?.value || "cantonese_male";
    const femaleTimbre = document.getElementById("set-minimax-female-timbre")?.value || "cantonese_female";
    const voice = document.getElementById("set-voice").value;
    const recLang = document.getElementById("set-rec-lang").value;

    state.userName = userName;
    state.apiKey = key;
    state.selectedModel = model;
    state.ttsEngine = ttsEngine;
    state.minimaxApiKey = minimaxKey;
    state.minimaxGroupId = minimaxGroup;
    state.minimaxMaleTimbre = maleTimbre;
    state.minimaxFemaleTimbre = femaleTimbre;
    state.selectedVoiceName = voice;
    state.recognitionLang = recLang;

    localStorage.setItem("rehab_user_name", userName);
    localStorage.setItem("rehab_gemini_api_key", key);
    localStorage.setItem("rehab_selected_model", model);
    localStorage.setItem("rehab_tts_engine", ttsEngine);
    localStorage.setItem("rehab_minimax_api_key", minimaxKey);
    localStorage.setItem("rehab_minimax_group_id", minimaxGroup);
    localStorage.setItem("rehab_minimax_male_timbre", maleTimbre);
    localStorage.setItem("rehab_minimax_female_timbre", femaleTimbre);
    localStorage.setItem("rehab_selected_voice", voice);
    localStorage.setItem("rehab_recognition_lang", recLang);

    updateStaticUIStrings();
    updateApiBadge();
    alert("設定儲存成功！");
    
    // Redirect to Dashboard
    const dashLink = document.querySelector('.nav-item[data-target="dashboard"]');
    if (dashLink) dashLink.click();
  });

  // ADR-0005：資料保險箱 匯出 / 還原
  const vaultExportBtn = document.getElementById("rp-vault-export-btn");
  if (vaultExportBtn) {
    vaultExportBtn.addEventListener("click", async () => {
      AudioSynth.playClick();
      const originalHTML = vaultExportBtn.innerHTML;
      vaultExportBtn.disabled = true;
      vaultExportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 匯出中...';
      const ok = await downloadVaultBackup();
      vaultExportBtn.innerHTML = ok
        ? '<i class="fa-solid fa-check"></i> 已匯出'
        : originalHTML;
      if (ok) AudioSynth.playSuccess();
      setTimeout(() => {
        vaultExportBtn.disabled = false;
        vaultExportBtn.innerHTML = originalHTML;
      }, 2000);
    });
  }

  const vaultImportBtn = document.getElementById("rp-vault-import-btn");
  const vaultImportInput = document.getElementById("rp-vault-import-input");
  if (vaultImportBtn && vaultImportInput) {
    vaultImportBtn.addEventListener("click", () => {
      AudioSynth.playClick();
      vaultImportInput.click();
    });
    vaultImportInput.addEventListener("change", async () => {
      const file = vaultImportInput.files && vaultImportInput.files[0];
      // 無論成敗都要清空 input.value，否則同工再選同一個檔案不會觸發 change。
      if (!file) { vaultImportInput.value = ""; return; }
      const ok = await restoreVaultBackup(file);
      vaultImportInput.value = "";
      if (ok) switchView("settings"); // 重新渲染設定頁以更新保險箱用量顯示
    });
  }

  // Attach Settings Reset Progress Submit
  const resetBtn = document.getElementById("rp-reset-progress-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      // ADR-0005：破壞性操作前先引導匯出備份，避免無備份的不可逆資料遺失。
      const sessionCount = state.historySessions.length;
      const customCount = getCustomCases().length;
      if (sessionCount > 0 || customCount > 0) {
        if (confirm(`💾 保險箱內現有 ${sessionCount} 場面談紀錄、${customCount} 個自定義個案。\n\n建議先匯出備份再重設。\n\n按「確定」立即匯出備份檔；按「取消」則跳過備份直接繼續。`)) {
          await downloadVaultBackup();
        }
      }

      if (!confirm("⚠️ 同工，你確定要清除所有的學習進度嗎？\n此操作將會清除所有歷史對話報告、自定義個案與成就徽章，且不可還原！")) {
        return;
      }
      if (!confirm("🔒 最後安全鎖確認：確定要執行重設並將所有進度歸零嗎？")) {
        return;
      }

      // 1. Play warning sound
      AudioSynth.playWarning();

      // 2a. ADR-0005：清空 IndexedDB 保險箱。
      //     若少了這一步，重設後看似清空，但下次開機 hydrateVault() 會把舊資料整批撈回來。
      try {
        // Milestone 8 補完：此處此前無 try —— clearAll() 拋錯即成為未處理的
        // rejection，重設半途中止而畫面毫無提示，同工不知道有沒有成功。
        await RehabCounselorDB.clearAll();
      } catch (err) {
        console.error("[Vault] 清空保險箱失敗：", err);
        AudioSynth.playError();
        alert(`⚠️ 重設未能完成：${(err && err.message) || err}\n\n保險箱內的資料可能仍在。請重新整理後再試一次，或先到「系統設定 → 資料保險箱」匯出備份。`);
        return;
      }
      state.historySessions = [];

      // 2b. Clear LocalStorage variables
      localStorage.removeItem("rehab_sessions_history");
      localStorage.removeItem("rehab_custom_cases");
      localStorage.removeItem("rehab_unlocked_achievements");
      // 兩鍵已於 Milestone 7 停用（D7），此處仍移除以清掉舊安裝的殘留值。
      localStorage.removeItem("rehab_completed_cases_count");
      localStorage.removeItem("rehab_completed_case_ids");
      localStorage.removeItem("rehab_m7_achievement_reconcile");
      localStorage.removeItem("rehab_selected_voice");
      localStorage.removeItem("rehab_speech_muted");
      localStorage.removeItem("rehab_theory_progress");
      localStorage.removeItem("rehab_user_name");
      localStorage.removeItem("rehab_tts_engine");
      localStorage.removeItem("rehab_minimax_api_key");
      localStorage.removeItem("rehab_minimax_group_id");
      localStorage.removeItem("rehab_minimax_male_timbre");
      localStorage.removeItem("rehab_minimax_female_timbre");

      // 3. Reset state properties to defaults
      state.cases = [...MOCK_CASES];
      state.unlockedAchievements = [];
      state.achievementsReconciledCount = 0;
      state.activeCase = null;
      state.activeSession = null;
      state.miGameScore = 0;
      state.miGameIndex = 0;
      state.isSpeechMuted = false;
      state.selectedVoiceName = "";
      state.userName = "";
      state.ttsEngine = "system";
      state.minimaxApiKey = "";
      state.minimaxGroupId = "";
      state.minimaxMaleTimbre = "cantonese_male";
      state.minimaxFemaleTimbre = "cantonese_female";
      state.theoryProgress = {
        act: { info: false, flashcards: false, test: false },
        mi: { info: false, flashcards: false, test: false },
        icf: { info: false, flashcards: false, test: false }
      };

      // 4. Update UI immediately
      updateStaticUIStrings();

      // 5. Show success toast (re-uses existing styled toast element)
      const toast = document.createElement("div");
      toast.className = "achievement-toast show";
      toast.innerHTML = `
        <div class="toast-badge-icon" style="color: var(--accent-green); border-color: var(--accent-green);"><i class="fa-solid fa-circle-check"></i></div>
        <div class="toast-content">
          <div class="toast-title" style="color: var(--accent-green);">系統自癒成功</div>
          <div class="toast-name">學習進度已重置</div>
          <div class="toast-desc">所有的培訓數據、自定義個案與解鎖徽章已安全歸零。</div>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 600);
      }, 4000);

      // 6. Update Badge UI
      updateApiBadge();

      // 7. Direct jump back to Dashboard
      const dashLink = document.querySelector('.nav-item[data-target="dashboard"]');
      if (dashLink) dashLink.click();
    });
  }
}

/* ==========================================================================
   Phase 4: Helper Methods (Voice Recognition, Achievements, Reports)
   ========================================================================== */

function renderAchievementsWall() {
  const unlocked = state.unlockedAchievements;

  // Milestone 7 §3.7：對帳曾收回徽章時，說明一次。不解釋就消失比留著假徽章更難理解。
  const reconcileNotice = state.achievementsReconciledCount > 0
    ? `<div class="achievement-reconcile-notice">
         <i class="fa-solid fa-circle-info"></i>
         ${state.locale === "en"
           ? `The unlock criteria for ${state.achievementsReconciledCount} badge(s) have been corrected to match what each badge claims. Badges whose criteria your record does not meet have been returned to locked, and can be earned again.`
           : `有 ${state.achievementsReconciledCount} 個徽章的達成條件已更正為與徽章描述一致。你的紀錄尚未符合的，已回到未解鎖狀態，可以重新達成。`}
       </div>`
    : "";

  return `
    <div class="achievement-section-title">
      <i class="fa-solid fa-trophy" style="color:var(--accent-amber);"></i> 職業復康同工成就徽章牆
    </div>
    ${reconcileNotice}
    <div class="achievement-grid">
      ${MOCK_ACHIEVEMENTS.map(ach => {
        const isUnlocked = unlocked.includes(ach.id);
        const rgb = ach.id === 'first_session' ? '124, 58, 237' :
                    ach.id === 'empathy_master' ? '244, 63, 94' :
                    ach.id === 'case_creator' ? '16, 185, 129' :
                    ach.id === 'icf_expert' ? '6, 182, 212' :
                    ach.id === 'theory_explorer' ? '245, 158, 11' : '99, 102, 241';
        return `
          <div class="badge-card ${isUnlocked ? 'unlocked' : ''}" style="--badge-color: ${ach.color}; --badge-color-rgb: ${rgb};">
            <div class="badge-status-tag">${isUnlocked ? '已解鎖' : '未解鎖'}</div>
            <div class="badge-card-icon"><i class="fa-solid ${ach.icon}"></i></div>
            <div class="badge-card-name">${ach.name}</div>
            <div class="badge-card-desc">${ach.description}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/** MI 闖關的滿分：各題最高分選項之和。由題庫算出，Training Lead 增減題目自動跟隨。 */
function miDrillMaxScore(oarsGame) {
  if (!Array.isArray(oarsGame)) return 0;
  return oarsGame.reduce((total, q) => {
    const best = (q.options || []).reduce((m, o) => Math.max(m, o.score || 0), 0);
    return total + best;
  }, 0);
}

/** 三個理論模組（info / flashcards / test）是否全部完成。 */
function allTheoryModulesComplete() {
  return ["act", "mi", "icf"].every(k => {
    const p = state.theoryProgress && state.theoryProgress[k];
    return !!(p && p.info && p.flashcards && p.test);
  });
}

/**
 * Milestone 7：徽章條件的**單一判定點**。
 *
 * 回傳 true / false / null：
 *  - true  = 紀錄顯示已達標
 *  - false = 紀錄顯示未達標
 *  - null  = **沒有可查證的持久紀錄**，無法判定（ICF 沙盒結果不落地；
 *            自定義個案可被刪除）。null 者一律沿用既有鎖存值，不撤銷也不代發。
 *
 * 完整由保險箱推導（ARCHITECTURE §7 D21 的餘下部分）需要逐題練習紀錄（D26），
 * 屬另一個里程碑。此處先讓**條件與描述一致**，並讓可查證者真的被查證。
 */
function evaluateAchievement(achId, record) {
  const rec = record || computeCounselorRecord(state.historySessions);

  switch (achId) {
    // 描述：「成功完成第一次案主模擬對話並生成評估報告」——「評估報告」是條件的一部分。
    case "first_session":
      return rec.evaluatedCount >= 1;

    // 描述：「同理心 (MI OARS) 評定達到 90 分或以上」
    case "empathy_master":
      return rec.evaluatedSessions.some(s => (s.report.scores.empathy || 0) >= 90);

    // 描述：「累積完成 3 次不同案主的全套輔導對話」
    case "combat_specialist":
      return rec.distinctCaseIds.size >= 3;

    // 描述：「ACT、MI、ICF 三個理論模組全部完成，且 OARS 闖關每一題都選中最高分回應」
    case "theory_explorer": {
      // 理論模組進度是持久的（rehab_theory_progress），任何時候都可查證。
      // 未完成 = 有紀錄證明未達標 → false，對帳時可據此收回。
      if (!allTheoryModulesComplete()) return false;

      const oarsGame = MOCK_THEORY_DATA.mi && MOCK_THEORY_DATA.mi.oars_game;
      const maxScore = miDrillMaxScore(oarsGame);
      if (maxScore <= 0) return null;

      // ⚠️ 闖關分數只存在於記憶體（miGameScore／miGameIndex 開機歸零），沒有持久紀錄。
      // 本次尚未走完闖關時，我們**不知道**同工過去有沒有滿分通過 —— 那是 null
      // （無從查證），不是 false。若在此回 false，每次重新整理都會把上一輪合法
      // 取得的徽章收掉。逐題練習紀錄（D26）落地後，這裡才能改成真正可查證。
      const finished = state.miGameIndex >= (oarsGame.length || 0);
      if (!finished) return null;

      return state.miGameScore >= maxScore;
    }

    // ICF 沙盒結果與自定義個案的建立事件都沒有持久紀錄可查。
    case "icf_expert":
    case "case_creator":
      return null;

    default:
      return null;
  }
}

/**
 * Milestone 7 §3.7：一次性徽章對帳。
 * 對**條件可查證**的徽章重新判定，不符者收回；null（無可查證紀錄）者原樣保留。
 * 只跑一次，旗標寫入既有的 app_meta store（不需 DB 版本變更）。
 */
const ACHIEVEMENT_RECONCILE_FLAG = "m7_achievement_reconcile";

async function reconcileAchievementsOnce() {
  try {
    if (state.vaultMode === "indexeddb") {
      // ⚠️ getMeta() 回傳的是 **value 本身**（`req.result.value`），不是 `{key, value}`
      //    記錄。寫成 done.value.done 會永遠是 undefined，旗標形同不存在，對帳
      //    每次開機都重跑 —— 效果上冪等所以看不出來，但「只跑一次」的承諾沒有兌現。
      const done = await RehabCounselorDB.getMeta(ACHIEVEMENT_RECONCILE_FLAG);
      if (done && done.done) return;
    } else if (localStorage.getItem("rehab_m7_achievement_reconcile") === "done") {
      return;
    }

    const record = computeCounselorRecord(state.historySessions);
    const revoked = state.unlockedAchievements.filter(id => evaluateAchievement(id, record) === false);

    if (revoked.length > 0) {
      state.unlockedAchievements = state.unlockedAchievements.filter(id => !revoked.includes(id));
      localStorage.setItem("rehab_unlocked_achievements", JSON.stringify(state.unlockedAchievements));
      state.achievementsReconciledCount = revoked.length;
    }

    if (state.vaultMode === "indexeddb") {
      await RehabCounselorDB.setMeta(ACHIEVEMENT_RECONCILE_FLAG, { done: true, at: new Date().toISOString(), revoked });
    } else {
      localStorage.setItem("rehab_m7_achievement_reconcile", "done");
    }
  } catch (err) {
    // 對帳失敗不得阻擋開機 —— 徽章維持原樣，下次開機再試。
    console.warn("徽章對帳未完成：", err);
  }
}

function checkAndUnlockAchievements(achId) {
  if (state.unlockedAchievements.includes(achId)) return;

  const ach = MOCK_ACHIEVEMENTS.find(a => a.id === achId);
  if (!ach) return;

  // Milestone 7：可查證的條件必須真的成立才發。null（無持久紀錄可查）者
  // 沿用呼叫端的判斷 —— 那是它當下觀察到的事實（如 ICF 沙盒 100% 正確）。
  if (evaluateAchievement(achId) === false) return;

  state.unlockedAchievements.push(achId);
  localStorage.setItem("rehab_unlocked_achievements", JSON.stringify(state.unlockedAchievements));

  // Play physical unlock glissando
  AudioSynth.playUnlock();

  // Show Toast
  showAchievementToast(ach);
}

function showAchievementToast(ach) {
  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.innerHTML = `
    <div class="toast-badge-icon" style="color: ${ach.color}; border-color: ${ach.color};"><i class="fa-solid ${ach.icon}"></i></div>
    <div class="toast-content">
      <div class="toast-title" style="color: ${ach.color};">恭喜解鎖成就徽章</div>
      <div class="toast-name">${ach.name}</div>
      <div class="toast-desc">${ach.description}</div>
    </div>
  `;
  document.body.appendChild(toast);

  // Animation show
  setTimeout(() => toast.classList.add("show"), 100);

  // Rainbow particles rain
  triggerConfettiAtCenter();

  // Hide toast after 4.5 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 600);
  }, 4500);
}

function triggerConfettiAtCenter() {
  const x = window.innerWidth / 2;
  const y = window.innerHeight / 2 + window.scrollY;
  
  for (let i = 0; i < 50; i++) {
    const p = document.createElement("div");
    p.className = "particle-dot";
    
    const colors = ["var(--accent-purple)", "var(--accent-cyan)", "var(--accent-green)", "var(--accent-amber)", "var(--accent-rose)", "#6366f1"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.backgroundColor = color;
    p.style.boxShadow = `0 0 8px ${color}`;
    
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 1.5;
    
    let px = x;
    let py = y;
    
    document.body.appendChild(p);
    
    let ticks = 0;
    const maxTicks = 40 + Math.random() * 25;
    
    function updateParticle() {
      px += vx;
      py += vy + 0.12; // gravity
      
      p.style.left = `${px}px`;
      p.style.top = `${py}px`;
      p.style.opacity = (maxTicks - ticks) / maxTicks;
      p.style.transform = `scale(${(maxTicks - ticks) / maxTicks})`;
      
      ticks++;
      if (ticks < maxTicks) {
        requestAnimationFrame(updateParticle);
      } else {
        p.remove();
      }
    }
    requestAnimationFrame(updateParticle);
  }
}

function initVoiceRecognition(inputEl) {
  const micBtn = document.getElementById("rp-voice-mic-btn");
  const waveHud = document.getElementById("rp-voice-wave-hud");
  const statusText = document.getElementById("rp-voice-status-text");

  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = "none";
    statusText.textContent = "您的瀏覽器不支援廣東話語音識別，請使用文字輸入。";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.lang = state.recognitionLang;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  state.recognition = recognition;
  let finalAccumulated = "";

  micBtn.addEventListener("click", () => {
    if (state.isRecording) {
      state.isRecording = false;
      recognition.stop();
    } else {
      try {
        finalAccumulated = inputEl.value ? inputEl.value.trim() + " " : "";
        recognition.lang = state.recognitionLang;
        state.isRecording = true;
        recognition.start();
      } catch (err) {
        console.error(err);
      }
    }
  });

  recognition.onstart = () => {
    state.isRecording = true;
    micBtn.classList.add("recording");
    waveHud.classList.add("active");
    statusText.textContent = `🎙️ 正在連續錄音中 (${state.recognitionLang})... 請說話，再次點擊麥克風以結束`;
    statusText.style.color = "var(--accent-green)";
    startVoiceFFT();
  };

  recognition.onend = () => {
    // 若用戶未主動結束錄音（如僅思考停頓），自動無縫重新啟動錄音
    if (state.isRecording) {
      try {
        recognition.lang = state.recognitionLang;
        recognition.start();
        return;
      } catch (e) {
        // Ignored if already started
      }
    }
    state.isRecording = false;
    micBtn.classList.remove("recording");
    waveHud.classList.remove("active");
    statusText.textContent = `點擊麥克風即可直接講話 (${state.recognitionLang})`;
    statusText.style.color = "var(--text-muted)";
    stopVoiceFFT();
  };

  recognition.onerror = (e) => {
    if (e.error === 'no-speech') {
      // 靜音超時不視為致命錯誤，若在錄音狀態則由 onend 自動重啟
      return;
    }
    console.error("Speech Recognition Error:", e);
    statusText.textContent = `語音出錯：${e.error === 'not-allowed' ? '未授權麥克風' : e.error}`;
    statusText.style.color = "var(--accent-rose)";
    state.isRecording = false;
    micBtn.classList.remove("recording");
    waveHud.classList.remove("active");
    stopVoiceFFT();
  };

  recognition.onresult = (event) => {
    let currentInterim = "";
    let currentFinal = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      if (result.isFinal) {
        currentFinal += result[0].transcript;
      } else {
        currentInterim += result[0].transcript;
      }
    }
    if (currentFinal) {
      finalAccumulated += currentFinal;
    }
    inputEl.value = (finalAccumulated + currentInterim).trim();

    statusText.textContent = `🎙️ 正在連續錄音中... (已捕捉語句)`;
    statusText.style.color = "var(--accent-green)";

    const speechToText = finalAccumulated + currentInterim;
    const simplifiedChars = /[这个么们来对说让还为没什从]/;
    if (simplifiedChars.test(speechToText) && state.recognitionLang !== 'zh-CN') {
      statusText.textContent = `⚠️ 辨識結果疑似為普通話，建議在設定中切換至 yue-Hant-HK 或使用無痕視窗`;
      statusText.style.color = "var(--accent-amber)";
    }
  };
}

function exportSessionReport(report, historicalSession = null) {
  const caseName = historicalSession ? historicalSession.caseName : (state.activeCase ? state.activeCase.name : "未知個案");
  const historyData = historicalSession ? historicalSession.history : (state.activeSession ? state.activeSession.history : []);
  // M6：示範劇本回合逐行標記，避免督導把離線示範誤讀為真實練習紀錄。
  const historyText = historyData.map(h => {
    const who = h.role === "user" ? "輔導員" : "案主";
    const tag = h.scripted ? "［示範劇本］" : "";
    return `${who}${tag}: ${h.text}`;
  }).join("\n");
  const hasScripted = historyData.some(h => h.scripted);
  
  const notesObj = historicalSession ? historicalSession.notes : (state.activeSession ? state.activeSession.notes : {});
  const soapNotes = (notesObj && notesObj.soap) || "（未填寫 SOAP 記錄）";
  const icfNotes = (notesObj && notesObj.icf) || "（未填寫 ICF 評估）";
  
  const diagnostic = historicalSession ? (historicalSession.caseDiagnostic || "未知診斷") : (state.activeCase ? state.activeCase.health_condition : "未知診斷");
  const dateStr = historicalSession ? historicalSession.date : new Date().toLocaleString();
  
  const content = `# RehabCounselor AI - 復康輔導與督導評核報告\n\n` +
    `案主姓名：${caseName}\n` +
    `就業診斷：${diagnostic}\n` +
    `評估日期：${dateStr}\n\n` +
    (hasEvaluation({ report })
      ? `## 📊 督導評估成績\n` +
        `- 同理心與反映式傾聽 (MI OARS)：${report.scores.empathy} 分\n` +
        `- 激發改變性談話 (MI Change Talk)：${report.scores.changeTalk} 分\n` +
        `- 心理彈性引導 (ACT Hexaflex)：${report.scores.actFlexibility} 分\n` +
        `- 全人障礙與環境評估 (ICF Matrix)：${report.scores.icfAccuracy} 分\n` +
        `- 承諾行動計劃可行性：${report.scores.actionPlanning} 分\n\n` +
        `## 💬 臨床督導總結 (Supervisor Feedback)\n` +
        `${report.summary}\n\n` +
        `> ${PRACTICE_SUPPORT_NOTICE}\n\n`
      : `## 📊 督導評估成績\n` +
        `本次面談在**離線示範模式**下進行，沒有 AI 臨床評估，因此沒有評分與督導總結。\n` +
        `以下的逐字紀錄與面談日誌為真實內容。\n\n`) +
    `## 📝 同工面談日誌記錄\n` +
    `### SOAP 日誌：\n${soapNotes}\n\n` +
    `### ICF 臨床評估表：\n${icfNotes}\n\n` +
    `## 🗣️ 面談歷史對話回顧\n` +
    (hasScripted ? `> ⚠️ 本次面談部分或全部回合來自「離線示範劇本」，並非真實 AI 生成的案主回應，標記為［示範劇本］。\n\n` : "") +
    `${historyText}\n`;

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  
  const cleanDate = dateStr.replace(/[\/\s:]/g, "-");
  a.download = `RehabCounselor_Report_${caseName}_${cleanDate}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================================================
// Phase 6: Dynamic Real-time Audio FFT Wave Visualizer
// ==========================================================================
function startVoiceFFT() {
  const canvas = document.getElementById("voice-fft-canvas");
  const staticBars = document.getElementById("rp-static-wave-bars");
  if (!canvas) return;

  // Setup Canvas dimensions
  canvas.width = 180;
  canvas.height = 30;

  // Toggle visibility
  canvas.style.display = "block";
  if (staticBars) staticBars.style.display = "none";

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
      state.audioStream = stream;
      
      // Initialize AudioContext if not active
      AudioSynth.initContext();
      const ctx = AudioSynth.ctx;
      
      state.audioSource = ctx.createMediaStreamSource(stream);
      state.audioAnalyser = ctx.createAnalyser();
      state.audioAnalyser.fftSize = 256;
      
      state.audioSource.connect(state.audioAnalyser);
      
      const bufferLength = state.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const canvasCtx = canvas.getContext("2d");
      
      function draw() {
        if (!state.isRecording) return;
        state.fftAnimationId = requestAnimationFrame(draw);
        
        state.audioAnalyser.getByteFrequencyData(dataArray);
        
        canvasCtx.fillStyle = "rgba(10, 12, 18, 0.45)";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 8; // scaled
          
          // Glowing cyan to purple spectrum based on frequency index
          const hue = (i / bufferLength) * 120 + 180;
          canvasCtx.fillStyle = `hsla(${hue}, 100%, 60%, 0.95)`;
          
          canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1.5, barHeight);
          
          // Micro top-glow tip
          canvasCtx.fillStyle = "#ffffff";
          canvasCtx.fillRect(x, canvas.height - barHeight - 1, barWidth - 1.5, 1);
          
          x += barWidth;
        }
      }
      
      draw();
    })
    .catch(err => {
      console.warn("Speech FFT capture rejected or unsupported:", err);
      canvas.style.display = "none";
      if (staticBars) staticBars.style.display = "flex";
    });
}

function stopVoiceFFT() {
  if (state.fftAnimationId) {
    cancelAnimationFrame(state.fftAnimationId);
    state.fftAnimationId = null;
  }
  
  if (state.audioStream) {
    state.audioStream.getTracks().forEach(track => track.stop());
    state.audioStream = null;
  }
  
  if (state.audioSource) {
    state.audioSource.disconnect();
    state.audioSource = null;
  }
  
  if (state.audioAnalyser) {
    state.audioAnalyser.disconnect();
    state.audioAnalyser = null;
  }

  const canvas = document.getElementById("voice-fft-canvas");
  const staticBars = document.getElementById("rp-static-wave-bars");
  if (canvas) {
    canvas.style.display = "none";
    const canvasCtx = canvas.getContext("2d");
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (staticBars) {
    staticBars.style.display = "flex";
  }
}

// ==========================================================================
// Phase 6: Clinical SOAP Suggestions Drawer Control
// ==========================================================================
function initSoapAssistantDrawer() {
  const drawer = document.getElementById("rp-soap-drawer");
  const toggleBtn = document.getElementById("rp-soap-drawer-toggle");
  const generateSoapBtn = document.getElementById("rp-soap-generate-btn");
  const adoptSoapBtn = document.getElementById("rp-soap-adopt-btn");
  const notesBox = document.getElementById("rp-notes-box");

  if (!drawer || !toggleBtn) return;

  // Slide toggle drawer open/close
  toggleBtn.addEventListener("click", () => {
    AudioSynth.playClick();
    drawer.classList.toggle("open");
  });

  // Phase 13: Tab Switching inside Drawer
  const tabSoap = document.getElementById("rp-drawer-tab-soap");
  const tabInteract = document.getElementById("rp-drawer-tab-interact");
  const contentSoap = document.getElementById("rp-drawer-content-soap");
  const contentInteract = document.getElementById("rp-drawer-content-interact");

  if (tabSoap && tabInteract && contentSoap && contentInteract) {
    tabSoap.addEventListener("click", () => {
      AudioSynth.playClick();
      tabSoap.classList.add("active");
      tabInteract.classList.remove("active");
      contentSoap.style.display = "flex";
      contentInteract.style.display = "none";
    });

    tabInteract.addEventListener("click", () => {
      AudioSynth.playClick();
      tabInteract.classList.add("active");
      tabSoap.classList.remove("active");
      contentSoap.style.display = "none";
      contentInteract.style.display = "flex";
    });
  }

  // Phase 13: Prompt Intervention Panel Controls
  const interventionPresets = document.querySelectorAll(".btn-intervention");
  const interventionInput = document.getElementById("rp-intervention-input");
  const interventionSendBtn = document.getElementById("rp-intervention-send-btn");
  const interventionLogs = document.getElementById("rp-intervention-logs");

  if (interventionSendBtn && interventionInput && interventionLogs) {
    const injectIntervention = (directive) => {
      if (!directive.trim()) return;

      // 1. Play clear physical unlock sound
      AudioSynth.playUnlock();

      // 2. Push to active session promptModifiers (SSOT Compliant, activeCase is safe and read-only)
      state.activeSession.promptModifiers.push(`【臨床督導即時注入指令：案主在此刻對答中，情緒狀態與心理表現轉變為：${directive}】`);

      // 3. Render log entry
      const timeStr = new Date().toLocaleTimeString();
      const logSpan = document.createElement("span");
      logSpan.style.color = "var(--accent-cyan)";
      logSpan.innerHTML = `<b style="color:var(--text-muted);">[${timeStr}]</b> 注入成功：${directive.substring(0, 16)}${directive.length > 16 ? '...' : ''}`;
      
      if (interventionLogs.textContent.includes("目前為預設模擬環境")) {
        interventionLogs.innerHTML = "";
      }
      interventionLogs.appendChild(logSpan);
      interventionLogs.scrollTop = interventionLogs.scrollHeight;

      // 4. Trigger alert toast
      const toast = document.createElement("div");
      toast.className = "achievement-toast show";
      toast.innerHTML = `
        <div class="toast-badge-icon" style="color: var(--accent-purple); border-color: var(--accent-purple);"><i class="fa-solid fa-bolt"></i></div>
        <div class="toast-content">
          <div class="toast-title" style="color: var(--accent-purple);">臨床干預已注入</div>
          <div class="toast-name">督導對弈已就緒</div>
          <div class="toast-desc">案主將在下一句回應中產生情感轉折！</div>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 600);
      }, 3500);

      // Clear input
      interventionInput.value = "";
    };

    interventionSendBtn.addEventListener("click", () => {
      injectIntervention(interventionInput.value);
    });

    interventionPresets.forEach(btn => {
      btn.addEventListener("click", () => {
        const presetText = btn.getAttribute("data-intervention");
        injectIntervention(presetText);
      });
    });
  }

  // Phase 13: Empathy Sentiment Heuristics HUD Input Listener
  const textInput = document.getElementById("rp-text-input");
  const empathyDot = document.getElementById("empathy-hud-indicator-dot");
  const empathyStatus = document.getElementById("empathy-hud-status-text");

  if (textInput && empathyDot && empathyStatus) {
    textInput.addEventListener("input", () => {
      const val = textInput.value.trim();
      if (!val) {
        empathyDot.style.backgroundColor = "var(--text-muted)";
        empathyDot.style.boxShadow = "none";
        empathyStatus.textContent = "等待輸入共情反映詞（MI OARS / ACT）...";
        empathyStatus.style.color = "var(--text-muted)";
        return;
      }

      // MI OARS & ACT Empathy/Acceptance Indicators
      const isEmpathy = val.includes("聽") || val.includes("覺得") || val.includes("明白") || 
                        val.includes("感受") || val.includes("留意") || val.includes("諗法") || 
                        val.includes("想法") || val.includes("重要") || val.includes("價值") || 
                        val.includes("體會") || val.includes("支持") || val.includes("陪你");
                        
      // MI Prescriptive / Correcting Reflex Warnings
      const isWarning = val.includes("應該") || val.includes("唔好") || val.includes("必須") || 
                        val.includes("一定要") || val.includes("不如聽我") || val.includes("教訓") ||
                        val.includes("錯") || val.includes("說教") || val.includes("強迫") || val.includes("唔可以");

      if (isWarning) {
        empathyDot.style.backgroundColor = "var(--accent-rose)";
        empathyDot.style.boxShadow = "0 0 8px var(--accent-rose)";
        empathyStatus.textContent = "⚠️ 偵測到「糾正反射」傾向，請多加反映情感，避免強行說教。";
        empathyStatus.style.color = "var(--accent-rose)";
      } else if (isEmpathy) {
        empathyDot.style.backgroundColor = "var(--accent-green)";
        empathyDot.style.boxShadow = "0 0 8px var(--accent-green)";
        empathyStatus.textContent = "✅ 已融入共情/反映性傾聽！這有助於降低案主抗拒。";
        empathyStatus.style.color = "var(--accent-green)";
      } else {
        empathyDot.style.backgroundColor = "var(--accent-amber)";
        empathyDot.style.boxShadow = "0 0 8px var(--accent-amber)";
        empathyStatus.textContent = "⚡ 正在打字中... 建議多使用動機式訪談（MI）的反映式傾聽。";
        empathyStatus.style.color = "var(--accent-amber)";
      }
    });
  }

  // SOAP Auto-generation control
  let activeSoapData = null;

  generateSoapBtn.addEventListener("click", async () => {
    AudioSynth.playClick();
    if (state.activeSession.history.length === 0) {
      alert(state.locale === "en" ? "Please have a conversation with the client first!" : "請先與案主進行對話！");
      return;
    }

    generateSoapBtn.disabled = true;
    const originalText = generateSoapBtn.innerHTML;
    generateSoapBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${state.locale === "en" ? "Drafting..." : "分析並起草中..."}`;

    try {
      const soapSuggestions = await generateSoapSuggestions(state.apiKey, state.selectedModel, state.activeSession.history);
      AudioSynth.playSuccess();
      activeSoapData = soapSuggestions;

      // Render Suggestions to drawer panels
      document.getElementById("soap-suggest-s").textContent = soapSuggestions.S;
      document.getElementById("soap-suggest-o").textContent = soapSuggestions.O;
      document.getElementById("soap-suggest-a").textContent = soapSuggestions.A;
      document.getElementById("soap-suggest-p").textContent = soapSuggestions.P;

      adoptSoapBtn.style.display = "inline-flex";
    } catch (e) {
      AudioSynth.playError();
      alert(`${state.locale === "en" ? "Analysis failed" : "分析起草失敗"}：${e.message}`);
    } finally {
      generateSoapBtn.disabled = false;
      generateSoapBtn.innerHTML = originalText;
    }
  });

  adoptSoapBtn.addEventListener("click", () => {
    AudioSynth.playClick();
    if (!activeSoapData) return;

    const noteSoap = document.getElementById("note-tab-soap");
    if (noteSoap && !noteSoap.classList.contains("active")) {
      noteSoap.click();
    }

    const formattedSoap = `S (主觀感受)：\n${activeSoapData.S}\n\nO (客觀觀察)：\n${activeSoapData.O}\n\nA (臨床評估)：\n${activeSoapData.A}\n\nP (未來計劃)：\n${activeSoapData.P}`;
    notesBox.value = formattedSoap;
    state.activeSession.notes.soap = formattedSoap;

    AudioSynth.playSuccess();

    const originalAdoptText = adoptSoapBtn.innerHTML;
    adoptSoapBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> ${state.locale === "en" ? "Adopted Successfully!" : "已成功採納！"}`;
    setTimeout(() => {
      adoptSoapBtn.innerHTML = originalAdoptText;
    }, 2000);
  });
}
