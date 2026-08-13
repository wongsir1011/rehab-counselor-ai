// RehabCounselor AI - Navigation Router & App State Initialization

import { state, t } from "./state.js";
import { AudioSynth } from "./audioSynth.js";
import { initSpeechEngine, stopRecording } from "./speechEngine.js";
import { renderDashboard } from "../views/dashboardView.js";
import { renderTheoryHub } from "../views/theoryView.js";
import { renderCaseArena, startRoleplaySession } from "../views/arenaView.js";
import { renderCoLearning } from "../views/coLearningView.js";
import { renderAnalytics } from "../views/analyticsView.js";
import { renderSettings } from "../views/settingsView.js";

export function initApp() {
  if (state.selectedModel === "gemini-2.0-flash" || state.selectedModel === "gemini-1.5-flash") {
    state.selectedModel = "gemini-2.5-flash";
    localStorage.setItem("rehab_selected_model", "gemini-2.5-flash");
  }

  {
    const ua = navigator.userAgent.toLowerCase();
    const isChrome = ua.includes("chrome") && !ua.includes("edg");
    if (isChrome && state.recognitionLang === "zh-HK") {
      state.recognitionLang = "yue-Hant-HK";
      localStorage.setItem("rehab_recognition_lang", "yue-Hant-HK");
      console.info("[RehabCounselor] Chrome STT 語言自動遷移: zh-HK → yue-Hant-HK (粵語專用聲學模型)");
    }
  }

  initLocaleAndSound();
  updateStaticUIStrings();
  updateApiBadge();
  initNavigation();
  initThemeToggle();
  initSpeechEngine();

  switchView("dashboard");
}

export function updateApiBadge() {
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

export function updateStaticUIStrings() {
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

export function initLocaleAndSound() {
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
      switchView(state.activeView);
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

export function initThemeToggle() {
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

export function initNavigation() {
  const items = document.querySelectorAll(".nav-item[data-target]");
  items.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const target = item.getAttribute("data-target");
      
      items.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");
      
      switchView(target);
    });
  });
}

export function switchView(viewName) {
  state.activeView = viewName;
  const mount = document.getElementById("content-view-mount");
  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");
  
  if (!mount || !title || !subtitle) return;
  
  stopRecording();

  if (state.mysteryTimeoutId) {
    clearTimeout(state.mysteryTimeoutId);
    state.mysteryTimeoutId = null;
  }

  AudioSynth.playClick();

  const handleStartRoleplay = (selectedCase) => {
    startRoleplaySession(selectedCase, switchView);
  };

  switch(viewName) {
    case "dashboard":
      title.textContent = t("dashboard_welcome");
      subtitle.textContent = t("dashboard_subtitle");
      renderDashboard(mount, handleStartRoleplay, switchView);
      break;
    case "theory":
      title.textContent = state.locale === "en" ? "Theory Hub" : state.locale === "zh-CN" ? "理论自学中心 (Theory Hub)" : "理論自學中心 (Theory Hub)";
      subtitle.textContent = state.locale === "en" ? "Master ACT, MI, and ICF frameworks with local Hong Kong vocational rehabilitation cases." : state.locale === "zh-CN" ? "深入掌握 ACT、MI 及 ICF 核心框架，结合香港职业复康实务范例。" : "深入掌握 ACT、MI 及 ICF 核心框架，結合香港職業復康實務範例。";
      renderTheoryHub(mount);
      break;
    case "arena":
      title.textContent = state.locale === "en" ? "Local Simulation Case Arena" : state.locale === "zh-CN" ? "本地化模拟个案实战 Arena" : "本地化模擬個案實戰 Arena";
      subtitle.textContent = state.locale === "en" ? "Select standard cases or synthesize a custom local vocational rehab case using AI." : state.locale === "zh-CN" ? "选择经典个案，或以 AI 生成专属的香港职业复康模拟情境。" : "選擇經典個案，或以 AI 生成專屬的香港職業復康模擬情境。";
      renderCaseArena(mount, switchView);
      break;
    case "co-learning":
      title.textContent = state.locale === "en" ? "Co-Learning Studio" : state.locale === "zh-CN" ? "小组协同研讨室 (Co-Learning Studio)" : "小組協同研討室 (Co-Learning Studio)";
      subtitle.textContent = state.locale === "en" ? "Analyze cases together with colleagues and debate critical dialogue transition choices." : state.locale === "zh-CN" ? "与同工一同剖析个案，就关键对话转折进行讨论与抉择。" : "與同工一同剖析個案，就關鍵對話轉折進行討論與抉擇。";
      renderCoLearning(mount, switchView);
      break;
    case "analytics":
      title.textContent = state.locale === "en" ? "Learning Analytics & Portfolios" : state.locale === "zh-CN" ? "学习分析与历程 (Analytics)" : "學習分析與歷程 (Analytics)";
      subtitle.textContent = state.locale === "en" ? "Track your progress, achievements, and completed session portfolios." : state.locale === "zh-CN" ? "追踪你的自学进度，以及在模拟辅导中所展现的能力雷达图。" : "追蹤你的自學進度，以及在模擬輔導中所展現的能力雷達圖。";
      renderAnalytics(mount, switchView);
      break;
    case "settings":
      title.textContent = state.locale === "en" ? "Global System Settings" : state.locale === "zh-CN" ? "系统与语音设定 (Settings)" : "系統與語音設定 (Settings)";
      subtitle.textContent = state.locale === "en" ? "Configure Gemini API keys and tune Cantonese Speech parameters for optimal setup." : state.locale === "zh-CN" ? "配置 Gemini API 金钥、微调广东话语音输出，实现最佳体验。" : "配置 Gemini API 金鑰、微調廣東話語音輸出，實現最佳體驗。";
      renderSettings(mount, switchView);
      break;
  }
}
