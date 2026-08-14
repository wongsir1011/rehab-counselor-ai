// RehabCounselor AI - Dashboard View Component

import { state, t, saveTheoryProgress } from "../core/state.js";
import { MOCK_MOTIVATIONAL_QUOTES } from "../data/mockData.js";
import { renderAchievementsWall } from "./settingsView.js";

export function renderDashboard(container, startRoleplaySessionCallback, switchViewCallback) {
  if (state.quoteIntervalId) {
    clearInterval(state.quoteIntervalId);
    state.quoteIntervalId = null;
  }

  let historySessions = [];
  try {
    historySessions = JSON.parse(localStorage.getItem("rehab_sessions_history")) || [];
  } catch (e) {
    historySessions = [];
  }

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

  const turnsCount = historySessions.reduce((acc, s) => acc + (s.history ? s.history.filter(h => h.role === 'user').length : 0), 0);
  const turnsPercent = Math.min(100, Math.round(turnsCount / 50 * 100));

  let avgScore = 0;
  let beatsPercent = 0;
  if (historySessions.length > 0) {
    const sum = historySessions.reduce((acc, s) => {
      const avg = Math.round((s.report.scores.empathy + s.report.scores.changeTalk + s.report.scores.actFlexibility + s.report.scores.icfAccuracy + s.report.scores.actionPlanning) / 5);
      return acc + avg;
    }, 0);
    avgScore = Math.round(sum / historySessions.length);
    beatsPercent = Math.min(99, Math.round(avgScore * 1.1 - 5));
    if (beatsPercent < 0) beatsPercent = 0;
  }

  const localizedProgressVal = t("dashboard_progress_val").replace("{completed}", completedModules);
  const localizedHoursVal = t("dashboard_hours_val").replace("{turns}", turnsCount);
  const localizedAccuracyVal = historySessions.length > 0
    ? t("dashboard_accuracy_val").replace("{score}", avgScore)
    : t("dashboard_accuracy_val_empty");

  container.innerHTML = `
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
            <circle cx="18" cy="18" r="16" fill="none" stroke="var(--accent-green)" stroke-width="3" stroke-dasharray="${historySessions.length > 0 ? avgScore : 0}, 100" stroke-linecap="round"/>
          </svg>
          <span style="position: absolute; font-size: 0.72rem; font-weight: 800; color: var(--text-bright);">${historySessions.length > 0 ? avgScore + '分' : '—'}</span>
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

    <div class="grid-2col">
      <div style="display: flex; flex-direction: column; gap: 24px; min-height:0;">
        <div class="glass-card" style="display: flex; flex-direction: column; gap: 16px;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-bright); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-star" style="color: var(--accent-amber);"></i> ${t("star_case_title")}
          </h3>
          <p style="color: var(--text-muted); font-size: 0.85rem;">${t("star_case_desc")}</p>
          
          <div style="background: var(--nested-bg-medium); border-radius: 12px; padding: 20px; border: 1px solid var(--card-border); position:relative; overflow:hidden;">
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

      <div style="display: flex; flex-direction: column; gap: 24px; min-height:0;">
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
            <polygon points="100,50 160,82 135,140 70,140 45,82" fill="rgba(6, 182, 212, 0.2)" stroke="var(--accent-cyan)" stroke-width="2.5"/>
          </svg>
          
          <div style="display:flex; justify-content:space-between; width:100%; font-size:0.75rem; color:var(--text-muted); border-top: 1px solid var(--card-border); padding-top:10px;">
            <span>💡 ${state.locale === "en" ? "Empathy" : "聽力共情"}：<strong>${state.locale === "en" ? "Excellent (A)" : "極佳 (A)"}</strong></span>
            <span>⚡ ${state.locale === "en" ? "Commitment Action" : "承諾行動引導"}：<strong>${state.locale === "en" ? "Good (B+)" : "優良 (B+)"}</strong></span>
          </div>
        </div>

        <div class="glass-card" style="display: flex; flex-direction: column; gap: 16px;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-bright); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-list-check" style="color: var(--accent-cyan);"></i> ${t("self_study_checklist_title")}
          </h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; line-height: 1.4;">
            ${t("self_study_checklist_desc")}
          </p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
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

    ${renderAchievementsWall()}
  `;

  let quoteIdx = 0;
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
        
        state.mysteryTimeoutId = setTimeout(() => {
          const customSessionCase = { ...randomCase };
          customSessionCase.name = `${randomCase.name}${randomMod.suffix}`;
          customSessionCase.initial_dialogue = `${randomCase.initial_dialogue} 【系統提示：此時案主正處於 ${randomMod.name}，情緒很不穩定。】`;
          
          if (typeof startRoleplaySessionCallback === "function") {
            startRoleplaySessionCallback(customSessionCase);
          }
          state.mysteryTimeoutId = null;
        }, 1200);
      }, 400);
    });
  }

  const caseBtn = document.getElementById("dash-start-case-btn");
  if (caseBtn) {
    caseBtn.addEventListener("click", () => {
      const caseId = caseBtn.getAttribute("data-case");
      const matched = state.cases.find(c => c.id === caseId);
      if (matched && typeof startRoleplaySessionCallback === "function") {
        startRoleplaySessionCallback(matched);
      }
    });
  }
}
