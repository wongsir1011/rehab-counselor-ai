// RehabCounselor AI - Settings View & Achievement Wall Component

import { state } from "../core/state.js";
import { MOCK_CASES, MOCK_ACHIEVEMENTS } from "../data/mockData.js";
import { AudioSynth } from "../core/audioSynth.js";
import { updateStaticUIStrings, updateApiBadge } from "../core/router.js";
import { RehabCounselorDB } from "../utils/db.js";
import { downloadFile, readTextFile } from "../utils/exportUtils.js";
import { generateMiniMaxAudio } from "../core/speechEngine.js";

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

        <!-- MiniMax TTS & Voice Settings -->
        <div class="form-group" style="background:var(--nested-bg-medium); padding:12px 14px; border-radius:8px; border:1px solid var(--card-border);">
          <label style="color:var(--accent-cyan); font-weight:800; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-volume-high"></i> 廣東話 TTS 語音引擎 (Cantonese Text-to-Speech Engine)
          </label>
          <select id="set-tts-engine" style="margin-top:6px;">
            <option value="system" ${state.ttsEngine === 'system' ? 'selected' : ''}>系統原生 Web Speech API (預設：免費離線，自動性別音高校正)</option>
            <option value="minimax-global" ${state.ttsEngine === 'minimax-global' ? 'selected' : ''}>MiniMax 廣東話超擬真 API (國際版 - api.minimaxi.chat ⭐)</option>
            <option value="minimax-cn" ${state.ttsEngine === 'minimax-cn' ? 'selected' : ''}>MiniMax 廣東話超擬真 API (國內版 - api.minimax.chat ⭐)</option>
          </select>
          
          <div id="minimax-config-panel" style="margin-top:10px; display:${state.ttsEngine !== 'system' ? 'flex' : 'none'}; flex-direction:column; gap:10px; border-top:1px dashed var(--card-border); padding-top:10px;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-bright);">MiniMax API Key (金鑰)</label>
              <input type="password" id="set-minimax-key" value="${state.minimaxApiKey || ''}" placeholder="輸入 MiniMax API Key (eyJ...)" style="margin-top:2px; font-size:0.8rem;" />
            </div>

            <div>
              <label style="font-size:0.75rem; color:var(--text-bright);">MiniMax Group ID (用戶組 ID，如無可留空)</label>
              <input type="text" id="set-minimax-group" value="${state.minimaxGroupId || ''}" placeholder="例如: 18123456789 (可選)" style="margin-top:2px; font-size:0.8rem;" />
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div>
                <label style="font-size:0.72rem; color:var(--text-bright);">男案主廣東話音色 (Male Timbre)</label>
                <select id="set-minimax-male" style="font-size:0.75rem; margin-top:2px;">
                  <option value="cantonese_male" ${state.minimaxMaleTimbre === 'cantonese_male' ? 'selected' : ''}>cantonese_male (標準廣東話男聲)</option>
                  <option value="male-qn-qingse" ${state.minimaxMaleTimbre === 'male-qn-qingse' ? 'selected' : ''}>male-qn-qingse (青澀青年男聲)</option>
                  <option value="male-qn-jingying" ${state.minimaxMaleTimbre === 'male-qn-jingying' ? 'selected' : ''}>male-qn-jingying (精英沉穩男聲)</option>
                  <option value="presenter_male" ${state.minimaxMaleTimbre === 'presenter_male' ? 'selected' : ''}>presenter_male (播音員男聲)</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.72rem; color:var(--text-bright);">女案主廣東話音色 (Female Timbre)</label>
                <select id="set-minimax-female" style="font-size:0.75rem; margin-top:2px;">
                  <option value="cantonese_female" ${state.minimaxFemaleTimbre === 'cantonese_female' ? 'selected' : ''}>cantonese_female (標準廣東話女聲)</option>
                  <option value="female-shaonv" ${state.minimaxFemaleTimbre === 'female-shaonv' ? 'selected' : ''}>female-shaonv (溫柔少女女聲)</option>
                  <option value="female-yujie" ${state.minimaxFemaleTimbre === 'female-yujie' ? 'selected' : ''}>female-yujie (御姐成熟女聲)</option>
                  <option value="presenter_female" ${state.minimaxFemaleTimbre === 'presenter_female' ? 'selected' : ''}>presenter_female (播音員女聲)</option>
                </select>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
              <p style="font-size:0.7rem; color:var(--text-muted); margin:0;">
                💡 系統會依案主性別自動切換 MiniMax 男/女聲。
              </p>
              <button id="test-minimax-btn" type="button" class="btn btn-cyan" style="font-size:0.75rem; padding:4px 10px; white-space:nowrap;">
                <i class="fa-solid fa-play"></i> 測試 MiniMax 廣東話發音
              </button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>系統原生廣東話 TTS 聲音選擇 (System Native Voice)</label>
          <select id="set-voice">
            <option value="">預設系統廣東話聲音 (Auto HK Voice)</option>
            ${state.voices.filter(v => v.lang === "zh-HK" || v.lang === "zh-Hant-HK" || v.name.toLowerCase().includes("hong kong")).map(v => `
              <option value="${v.name}" ${state.selectedVoiceName === v.name ? 'selected' : ''}>${v.name} (${v.lang})</option>
            `).join("")}
          </select>
          <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            📢 使用系統原生語音時，系統已啟用男個案音高校正鎖（將女性音色自動降調為男音）。
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
            🎙️ 語音識別已升級為「持續聆聽」模式，同工在說話停頓思考時麥克風不會自動中斷。
          </p>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;">
          <button type="submit" class="btn btn-primary">儲存變更 Save</button>
        </div>
      </form>

      <!-- Backup & Restore Data Management Section -->
      <div style="border-top: 1px solid var(--card-border); margin-top: 20px; padding-top: 20px;">
        <h4 style="font-size:0.88rem; font-weight:800; color:var(--accent-cyan); display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <i class="fa-solid fa-database"></i> 全站資料備份與還原 (Data Backup & Restore)
        </h4>
        <p style="font-size:0.75rem; color:var(--text-muted); line-height:1.4; margin-bottom:12px;">
          💾 同工換電腦或裝置時，可將全站的所有模擬對話歷程、評估報告、自訂個案與成就解鎖進度匯出為備份檔，並於新裝置一鍵還原。
        </p>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <button id="backup-export-btn" type="button" class="btn btn-cyan" style="justify-content:center; padding:10px; font-size:0.8rem;">
            <i class="fa-solid fa-download"></i> 匯出備份 (.json)
          </button>
          
          <label for="backup-import-file" class="btn btn-purple" style="justify-content:center; padding:10px; font-size:0.8rem; cursor:pointer; margin:0;">
            <i class="fa-solid fa-upload"></i> 匯入備份檔
          </label>
          <input type="file" id="backup-import-file" accept=".json" style="display:none;" />
        </div>
      </div>

      <!-- Danger Zone Section -->
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

  const ttsEngineSelect = document.getElementById("set-tts-engine");
  const minimaxPanel = document.getElementById("minimax-config-panel");
  if (ttsEngineSelect && minimaxPanel) {
    ttsEngineSelect.addEventListener("change", (e) => {
      minimaxPanel.style.display = e.target.value !== "system" ? "flex" : "none";
    });
  }

  // MiniMax 語音測試按鈕
  const testMinimaxBtn = document.getElementById("test-minimax-btn");
  if (testMinimaxBtn) {
    testMinimaxBtn.addEventListener("click", async () => {
      const key = document.getElementById("set-minimax-key").value.trim();
      const group = document.getElementById("set-minimax-group").value.trim();
      const engine = document.getElementById("set-tts-engine").value;
      const maleTimbre = document.getElementById("set-minimax-male").value;

      if (!key) {
        alert("請先輸入 MiniMax API Key 才能進行語音測試！");
        return;
      }

      state.ttsEngine = engine;
      state.minimaxApiKey = key;
      state.minimaxGroupId = group;
      state.minimaxMaleTimbre = maleTimbre;

      testMinimaxBtn.disabled = true;
      testMinimaxBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 正在生成語音...`;

      try {
        const audioUrl = await generateMiniMaxAudio("社工你好，我係案主，呢個係 MiniMax 廣東話發音測試。", maleTimbre);
        const audio = new Audio(audioUrl);
        await audio.play();
        AudioSynth.playSuccess();
        alert("🎉 MiniMax 廣東話發音成功！API 金鑰及設定正常。");
      } catch (err) {
        AudioSynth.playError();
        alert(`❌ MiniMax 語音生成失敗：${err.message}\n請檢查 API Key、Group ID 或是否選擇了正確的國際/國內版。`);
      } finally {
        testMinimaxBtn.disabled = false;
        testMinimaxBtn.innerHTML = `<i class="fa-solid fa-play"></i> 測試 MiniMax 廣東話發音`;
      }
    });
  }

  const form = document.getElementById("settings-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const userName = document.getElementById("set-user-name").value.trim();
    const key = document.getElementById("set-api-key").value.trim();
    const model = document.getElementById("set-model").value;
    const voice = document.getElementById("set-voice").value;
    const recLang = document.getElementById("set-rec-lang").value;

    const ttsEngine = document.getElementById("set-tts-engine").value;
    const minimaxKey = document.getElementById("set-minimax-key").value.trim();
    const minimaxGroup = document.getElementById("set-minimax-group").value.trim();
    const minimaxMale = document.getElementById("set-minimax-male").value;
    const minimaxFemale = document.getElementById("set-minimax-female").value;

    state.userName = userName;
    state.apiKey = key;
    state.selectedModel = model;
    state.selectedVoiceName = voice;
    state.recognitionLang = recLang;

    state.ttsEngine = ttsEngine;
    state.minimaxApiKey = minimaxKey;
    state.minimaxGroupId = minimaxGroup;
    state.minimaxMaleTimbre = minimaxMale;
    state.minimaxFemaleTimbre = minimaxFemale;

    localStorage.setItem("rehab_user_name", userName);
    localStorage.setItem("rehab_gemini_api_key", key);
    localStorage.setItem("rehab_selected_model", model);
    localStorage.setItem("rehab_selected_voice", voice);
    localStorage.setItem("rehab_recognition_lang", recLang);

    localStorage.setItem("rehab_tts_engine", ttsEngine);
    localStorage.setItem("rehab_minimax_api_key", minimaxKey);
    localStorage.setItem("rehab_minimax_group_id", minimaxGroup);
    localStorage.setItem("rehab_minimax_male_timbre", minimaxMale);
    localStorage.setItem("rehab_minimax_female_timbre", minimaxFemale);

    updateStaticUIStrings();
    updateApiBadge();
    AudioSynth.playSuccess();
    alert("設定儲存成功！已更新廣東話 TTS 語音引擎與性別音色配置。");
    
    if (typeof switchViewCallback === "function") switchViewCallback("dashboard");
  });

  // Attach Export Backup Listener
  const exportBtn = document.getElementById("backup-export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      AudioSynth.playClick();
      try {
        const jsonStr = await RehabCounselorDB.exportFullBackupJSON();
        const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const filename = `RehabCounselor_Backup_${dateTag}.json`;
        downloadFile(filename, jsonStr, "application/json");
        AudioSynth.playSuccess();
      } catch (err) {
        AudioSynth.playError();
        alert(`匯出備份失敗：${err.message}`);
      }
    });
  }

  // Attach Import Backup Listener
  const importFileInput = document.getElementById("backup-import-file");
  if (importFileInput) {
    importFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!confirm("⚠️ 匯入備份檔將會覆寫目前的進度與紀錄，確定要繼續嗎？")) {
        importFileInput.value = "";
        return;
      }

      AudioSynth.playClick();
      try {
        const jsonStr = await readTextFile(file);
        await RehabCounselorDB.importFullBackupJSON(jsonStr);
        
        AudioSynth.playUnlock();
        alert("🎉 全站備份資料還原成功！系統即將刷新視圖。");

        const customCases = await RehabCounselorDB.getAllCustomCases();
        if (customCases.length > 0) {
          state.cases = [...customCases, ...MOCK_CASES.filter(mc => !customCases.some(cc => cc.id === mc.id))];
        }

        updateStaticUIStrings();
        if (typeof switchViewCallback === "function") switchViewCallback("dashboard");
      } catch (err) {
        AudioSynth.playError();
        alert(`匯入備份失敗：${err.message}`);
      } finally {
        importFileInput.value = "";
      }
    });
  }

  const resetBtn = document.getElementById("rp-reset-progress-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (!confirm("⚠️ 同工，你確定要清除所有的學習進度嗎？\n此操作將會清除所有歷史對話報告、自定義個案與成就徽章，且不可還原！")) {
        return;
      }
      if (!confirm("🔒 最後安全鎖確認：確定要執行重設並將所有進度歸零嗎？")) {
        return;
      }

      AudioSynth.playWarning();

      await RehabCounselorDB.clearAll();

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
