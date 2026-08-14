// RehabCounselor AI - Analytics & Competence Radar View Component

import { state, t } from "../core/state.js";
import { generateLongitudinalChartHTML } from "../components/charts.js";
import { showSessionDetailPopup } from "../components/modals.js";
import { renderAchievementsWall } from "./settingsView.js";
import { AudioSynth } from "../core/audioSynth.js";

export function renderAnalytics(container, switchViewCallback) {
  let historySessions = [];
  try {
    historySessions = JSON.parse(localStorage.getItem("rehab_sessions_history")) || [];
  } catch (e) {
    historySessions = [];
  }

  let empathySum = 0;
  let changeTalkSum = 0;
  let defusionSum = 0;
  let icfSum = 0;
  let actionSum = 0;
  const totalSessions = historySessions.length;

  if (totalSessions > 0) {
    historySessions.forEach(s => {
      empathySum += s.report.scores.empathy || 0;
      changeTalkSum += s.report.scores.changeTalk || 0;
      defusionSum += s.report.scores.actFlexibility || 0;
      icfSum += s.report.scores.icfAccuracy || 0;
      actionSum += s.report.scores.actionPlanning || 0;
    });
    state.radarScores = {
      empathy: Math.round(empathySum / totalSessions),
      changeTalk: Math.round(changeTalkSum / totalSessions),
      defusion: Math.round(defusionSum / totalSessions),
      icf: Math.round(icfSum / totalSessions),
      action: Math.round(actionSum / totalSessions)
    };
  } else {
    state.radarScores = {
      empathy: 75,
      changeTalk: 60,
      defusion: 80,
      icf: 45,
      action: 65
    };
  }

  const scores = state.radarScores;
  const p1 = { x: 100, y: 100 - (0.8 * scores.empathy) };
  const p2 = { x: 100 + (0.8 * scores.changeTalk * 0.951), y: 100 - (0.8 * scores.changeTalk * 0.309) };
  const p3 = { x: 100 + (0.8 * scores.defusion * 0.588), y: 100 + (0.8 * scores.defusion * 0.809) };
  const p4 = { x: 100 - (0.8 * scores.icf * 0.588), y: 100 + (0.8 * scores.icf * 0.809) };
  const p5 = { x: 100 - (0.8 * scores.action * 0.951), y: 100 - (0.8 * scores.action * 0.309) };
  
  const pointsStr = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y}`;

  const totalAvg = Math.round((scores.empathy + scores.changeTalk + scores.defusion + scores.icf + scores.action) / 5);
  let gradeText = "";
  if (totalAvg >= 85) gradeText = state.locale === "en" ? "Expert (A)" : "卓越 (A)";
  else if (totalAvg >= 70) gradeText = state.locale === "en" ? "Good (B+)" : "優良 (B+)";
  else if (totalAvg >= 55) gradeText = state.locale === "en" ? "Competent (C)" : "合格 (C)";
  else gradeText = state.locale === "en" ? "Developing (D)" : "需提升 (D)";

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
          const avgScore = Math.round((session.report.scores.empathy + session.report.scores.changeTalk + session.report.scores.actFlexibility + session.report.scores.icfAccuracy + session.report.scores.actionPlanning) / 5);
          return `
            <div class="history-card" data-session-id="${session.id}">
              <div class="history-card-header">
                <span class="history-card-avatar">${session.caseAvatar}</span>
                <span class="history-card-date">${session.date}</span>
              </div>
              <div class="history-card-name">${session.caseName}</div>
              <div class="history-card-diag">${session.caseDiagnostic}</div>
              <div class="history-card-scores">
                <span class="history-score-tag high">${state.locale === "en" ? "Avg" : "平均"} ${avgScore}分</span>
                <span class="history-score-tag">${state.locale === "en" ? "Empathy" : "同理"} ${session.report.scores.empathy}</span>
                <span class="history-score-tag">${state.locale === "en" ? "ACT" : "彈性"} ${session.report.scores.actFlexibility}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="grid-2col" style="margin-bottom: 24px; align-items:stretch;">
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright);">
          ${state.locale === "en" ? "Self-Study Progression" : state.locale === "zh-CN" ? "理论学习时数分布 (自学时数)" : "理論學習時數分布 (自學時數)"}
        </h3>
        
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
          ${state.locale === "en" 
            ? "💡 <strong>Training Recommendation</strong>: Your self-study progress on ACT is solid. We suggest focusing on MI OARS quizzes next to increase sensitivity to capturing Change Talk." 
            : state.locale === "zh-CN"
            ? "💡 <strong>专家培训建议</strong>：你目前在 ACT 的心理弹性概念上自学非常充足。建议接下来增加 MI OARS 匹配关关卡的通關练习，以强化对案主改变谈话（Change Talk）的捕捉敏感度。"
            : "💡 <strong>專家培訓建議</strong>：你目前在 ACT 的心理彈性概念上自學非常充足。建議接下來增加 MI OARS 匹配關卡的通關練習，以強化對案主改變談話（Change Talk）的捕捉敏感度。"}
        </p>
      </div>

      <div class="glass-card" style="display:flex; flex-direction:column; gap:12px; align-items:center; position:relative; overflow:hidden;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright); align-self:flex-start; margin-bottom:4px;">
          ${state.locale === "en" ? "Overall Competence Radar" : state.locale === "zh-CN" ? "综合复康辅导实践力 (Competence Radar)" : "綜合復康輔導實踐力 (Competence Radar)"}
        </h3>
        
        <svg width="220" height="220" viewBox="0 0 200 200" style="margin:4px 0; z-index:2;">
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="60" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="40" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="20" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          
          <line x1="100" y1="100" x2="100" y2="20" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="176" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="147" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="53" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="24" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
          
          <polygon id="radar-poly" points="${pointsStr}" fill="rgba(6, 182, 212, 0.25)" stroke="var(--accent-cyan)" stroke-width="2" style="transition: points 0.5s ease-out; filter: drop-shadow(0 0 6px rgba(6,182,212,0.15));"/>
          
          <circle class="radar-dot" data-dim="0" cx="100" cy="20" r="4.5" fill="var(--accent-purple)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-purple));"></circle>
          <circle class="radar-dot" data-dim="1" cx="176" cy="76" r="4.5" fill="var(--accent-rose)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-rose));"></circle>
          <circle class="radar-dot" data-dim="2" cx="147" cy="165" r="4.5" fill="var(--accent-purple)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-purple));"></circle>
          <circle class="radar-dot" data-dim="3" cx="53" cy="165" r="4.5" fill="var(--accent-amber)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-amber));"></circle>
          <circle class="radar-dot" data-dim="4" cx="24" cy="76" r="4.5" fill="var(--accent-cyan)" style="cursor:pointer; transition: r 0.2s, fill 0.2s; filter:drop-shadow(0 0 4px var(--accent-cyan));"></circle>

          <text class="radar-label" data-dim="0" x="100" y="15" fill="var(--text-muted)" font-size="8" text-anchor="middle" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "Empathy (MI)" : "傾聽共情 (MI)"}</text>
          <text class="radar-label" data-dim="1" x="182" y="76" fill="var(--text-muted)" font-size="8" text-anchor="start" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "Change Talk" : "改變談話 (MI)"}</text>
          <text class="radar-label" data-dim="2" x="152" y="175" fill="var(--text-muted)" font-size="8" text-anchor="start" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "Defusion (ACT)" : "心理解離 (ACT)"}</text>
          <text class="radar-label" data-dim="3" x="48" y="175" fill="var(--text-muted)" font-size="8" text-anchor="end" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "ICF Diagnostic" : "環境與個人診斷"}</text>
          <text class="radar-label" data-dim="4" x="18" y="76" fill="var(--text-muted)" font-size="8" text-anchor="end" style="cursor:pointer; font-weight:700; transition: fill 0.2s, font-size 0.2s;">${state.locale === "en" ? "Action Plan" : "漸進式行動計劃"}</text>
        </svg>

        <p style="font-size:0.8rem; color:var(--text-muted); text-align:center; margin: 0 0 10px 0;">
          累計戰力綜合評核：<strong>${gradeText}</strong>。${totalSessions > 0 ? `已完成 ${totalSessions} 次個案模擬，綜合均分為 ${totalAvg} 分。` : "點擊上方各維度標籤，即可查看專家臨床改善建議。"}
        </p>

        <div id="radar-recommendation-panel" style="width:100%; background:var(--nested-bg-medium); border:1px solid var(--card-border); border-radius:10px; padding:12px; animation:fadeIn 0.4s ease; text-align:left;">
          <div id="radar-rec-content"></div>
        </div>
      </div>
    </div>

    ${generateLongitudinalChartHTML(historySessions)}

    <div class="history-section-title" style="margin-top: 32px;">
      <i class="fa-solid fa-folder-open" style="color:var(--accent-purple);"></i>
      ${state.locale === "en" ? "Therapy Portfolios History Log" : state.locale === "zh-CN" ? "面谈历程会话档案库" : "面談歷程會話檔案庫"}
    </div>
    ${historyMarkup}

    ${renderAchievementsWall()}
  `;

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
    const currentScore = state.radarScores[details.scoreKey] || 0;
    
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
        <span class="lcd-digital-badge" style="font-size:0.75rem; padding:2px 8px;">${state.locale === "en" ? "Score" : "平均"} ${currentScore} 分</span>
      </div>
      <p style="font-size:0.78rem; color:var(--text-main); line-height:1.5; margin:0 0 10px 0;">${details.desc}</p>
      <div style="background:rgba(6,182,212,0.04); border:1px solid rgba(6,182,212,0.12); padding:8px 12px; border-radius:8px; margin-bottom:10px; font-size:0.75rem; line-height:1.5; color:var(--text-bright);">
        <strong>💡 ${state.locale === "en" ? "Clinical Advice" : "臨床改善建議"}</strong>：${details.advice}
      </div>
      <button class="btn btn-primary" id="radar-rec-action-btn" style="width:100%; padding:6px 0; justify-content:center; font-size:0.75rem;">
        <i class="fa-solid fa-bolt"></i> ${details.actionBtnText}
      </button>
    `;
    
    document.getElementById("radar-rec-action-btn").addEventListener("click", () => {
      AudioSynth.playClick();
      if (details.actionView && typeof switchViewCallback === "function") {
        switchViewCallback(details.actionView);
        if (details.actionTab) {
          setTimeout(() => {
            const tab = document.getElementById(`tab-btn-${details.actionTab}`);
            if (tab) tab.click();
          }, 150);
        }
      }
    });
  }

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
  
  renderRadarRecommendation(0);
}
