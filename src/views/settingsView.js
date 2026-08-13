// RehabCounselor AI - Settings View & Achievement Wall Component

import { state } from "../core/state.js";
import { MOCK_CASES, MOCK_ACHIEVEMENTS } from "../data/mockData.js";
import { AudioSynth } from "../core/audioSynth.js";
import { updateStaticUIStrings, updateApiBadge } from "../core/router.js";

export function renderSettings(container, switchViewCallback) {
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

        <div class="form-group">
          <label>廣東話 TTS 語音朗讀聲音選擇 (Cantonese Voice)</label>
          <select id="set-voice">
            <option value="">預設系統廣東話聲音 (Auto HK Voice)</option>
            ${state.voices.filter(v => v.lang === "zh-HK" || v.lang === "zh-Hant-HK" || v.name.toLowerCase().includes("hong kong")).map(v => `
              <option value="${v.name}" ${state.selectedVoiceName === v.name ? 'selected' : ''}>${v.name} (${v.lang})</option>
            `).join("")}
          </select>
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            📢 語音播放完全使用設備原生提供的 TTS 合成。如果下拉列表中沒有出現更多廣東話聲音，可於設備操作系統的「輔助功能 / 語音朗讀」中下載額外的廣東話高品質包（如 macOS 的 Sin-Ji 語音）。
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
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;">
          <button type="submit" class="btn btn-primary">儲存變更 Save</button>
        </div>
      </form>

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

  const form = document.getElementById("settings-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const userName = document.getElementById("set-user-name").value.trim();
    const key = document.getElementById("set-api-key").value.trim();
    const model = document.getElementById("set-model").value;
    const voice = document.getElementById("set-voice").value;
    const recLang = document.getElementById("set-rec-lang").value;

    state.userName = userName;
    state.apiKey = key;
    state.selectedModel = model;
    state.selectedVoiceName = voice;
    state.recognitionLang = recLang;

    localStorage.setItem("rehab_user_name", userName);
    localStorage.setItem("rehab_gemini_api_key", key);
    localStorage.setItem("rehab_selected_model", model);
    localStorage.setItem("rehab_selected_voice", voice);
    localStorage.setItem("rehab_recognition_lang", recLang);

    updateStaticUIStrings();
    updateApiBadge();
    alert("設定儲存成功！");
    
    if (typeof switchViewCallback === "function") switchViewCallback("dashboard");
  });

  const resetBtn = document.getElementById("rp-reset-progress-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!confirm("⚠️ 同工，你確定要清除所有的學習進度嗎？\n此操作將會清除所有歷史對話報告、自定義個案與成就徽章，且不可還原！")) {
        return;
      }
      if (!confirm("🔒 最後安全鎖確認：確定要執行重設並將所有進度歸零嗎？")) {
        return;
      }

      AudioSynth.playWarning();

      localStorage.removeItem("rehab_sessions_history");
      localStorage.removeItem("rehab_custom_cases");
      localStorage.removeItem("rehab_unlocked_achievements");
      localStorage.removeItem("rehab_completed_cases_count");
      localStorage.removeItem("rehab_completed_case_ids");
      localStorage.removeItem("rehab_selected_voice");
      localStorage.removeItem("rehab_speech_muted");
      localStorage.removeItem("rehab_theory_progress");
      localStorage.removeItem("rehab_user_name");

      state.cases = [...MOCK_CASES];
      state.unlockedAchievements = [];
      state.completedCasesCount = 0;
      state.completedCaseIds = [];
      state.activeCase = null;
      state.activeSession = null;
      state.miGameScore = 0;
      state.miGameIndex = 0;
      state.isSpeechMuted = false;
      state.selectedVoiceName = "";
      state.userName = "";
      state.theoryProgress = {
        act: { info: false, flashcards: false, test: false },
        mi: { info: false, flashcards: false, test: false },
        icf: { info: false, flashcards: false, test: false }
      };

      updateStaticUIStrings();

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

      updateApiBadge();
      if (typeof switchViewCallback === "function") switchViewCallback("dashboard");
    });
  }
}

export function renderAchievementsWall() {
  const unlocked = state.unlockedAchievements;
  return `
    <div class="achievement-section-title">
      <i class="fa-solid fa-trophy" style="color:var(--accent-amber);"></i> 職業復康同工成就徽章牆
    </div>
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
