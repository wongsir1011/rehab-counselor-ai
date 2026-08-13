// RehabCounselor AI - Popups, Modals, Toasts & Particle Effects Component

import { state } from "../core/state.js";
import { AudioSynth } from "../core/audioSynth.js";

export function showSessionDetailPopup(session, onExportCallback) {
  AudioSynth.playClick();

  let overlay = document.getElementById("session-detail-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "session-detail-overlay";
    overlay.className = "popup-overlay";
    document.body.appendChild(overlay);
  }

  const { empathy, changeTalk, actFlexibility, icfAccuracy, actionPlanning } = session.report.scores;
  
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
        
        <div class="notes-tab-group" style="margin-bottom:12px;">
          <div class="notes-tab active" id="tab-popup-report">${state.locale === "en" ? "Supervisor Report" : state.locale === "zh-CN" ? "督导评估报告" : "督導評估報告"}</div>
          <div class="notes-tab" id="tab-popup-transcript">${state.locale === "en" ? "Dialogue Transcript" : state.locale === "zh-CN" ? "对话记录还原" : "對話記錄還原"}</div>
          <div class="notes-tab" id="tab-popup-notes">${state.locale === "en" ? "My SOAP Notes" : state.locale === "zh-CN" ? "面谈日记 SOAP" : "面談日誌 SOAP"}</div>
        </div>

        <div class="popup-tab-content" id="popup-content-report">
          <div class="grid-2col" style="gap: 16px;">
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
                  
                  return `<polygon points="${p1} ${p2} ${p3} ${p4} ${p5}" fill="rgba(6, 182, 212, 0.25)" stroke="var(--accent-cyan)" stroke-width="2"/>`;
                })()}
              </svg>
              
              <div style="width:100%; display:flex; flex-direction:column; gap:4px; font-size:0.75rem;">
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border);">
                  <span style="color:var(--text-muted);">${state.locale === "en" ? "Empathy (MI OARS)" : "同理反映"}</span>
                  <span style="font-weight:700; color:var(--text-bright);">${empathy}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border);">
                  <span style="color:var(--text-muted);">${state.locale === "en" ? "Capture Change Talk" : "改變談話"}</span>
                  <span style="font-weight:700; color:var(--text-bright);">${changeTalk}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border);">
                  <span style="color:var(--text-muted);">${state.locale === "en" ? "ACT Flexibility" : "心理彈性"}</span>
                  <span style="font-weight:700; color:var(--text-bright);">${actFlexibility}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border);">
                  <span style="color:var(--text-muted);">${state.locale === "en" ? "ICF Matrix Diagnostic" : "全人評估"}</span>
                  <span style="font-weight:700; color:var(--text-bright);">${icfAccuracy}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--card-border);">
                  <span style="color:var(--text-muted);">${state.locale === "en" ? "Action Planning" : "承諾行動"}</span>
                  <span style="font-weight:700; color:var(--text-bright);">${actionPlanning}</span>
                </div>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:12px;">
              <h4 style="font-size:0.9rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-user-tie" style="color:var(--accent-cyan);"></i> ${state.locale === "en" ? "Clinical Summary Feedback" : "督導意見總結"}
              </h4>
              <p style="font-size:0.8rem; color:var(--text-main); line-height:1.6; background:var(--nested-bg-faint); padding:12px; border-radius:8px; border-left:4px solid var(--accent-cyan); max-height:220px; overflow-y:auto;">
                ${session.report.summary.replace(/\n/g, "<br>")}
              </p>
            </div>
          </div>
        </div>

        <div class="popup-tab-content" id="popup-content-transcript" style="display:none;">
          <div class="chat-history-container" style="max-height: 380px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 12px; background: var(--nested-bg-medium); border-radius: 8px;">
            ${session.history.map(msg => {
              const isUser = msg.role === "user";
              return `
                <div class="chat-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'}" style="margin: 4px 0; max-width: 80%; ${isUser ? 'align-self: flex-end;' : 'align-self: flex-start;'}">
                  <div class="bubble-meta">${isUser ? (state.locale === "en" ? "Rehab Staff" : "諮商師(你)") : session.caseName}</div>
                  <div class="bubble-text" style="font-size:0.85rem; line-height:1.5;">${msg.text}</div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

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

  overlay.querySelector("#popup-export-btn").addEventListener("click", () => {
    AudioSynth.playClick();
    if (typeof onExportCallback === "function") {
      onExportCallback(session.report, session);
    } else {
      exportSessionReport(session.report, session);
    }
  });

  const closePopup = () => {
    AudioSynth.playClick();
    overlay.classList.remove("show");
  };

  overlay.querySelector("#popup-close-btn").addEventListener("click", closePopup);
  overlay.querySelector("#popup-close-confirm-btn").addEventListener("click", closePopup);

  setTimeout(() => overlay.classList.add("show"), 50);
}

export function showAchievementToast(ach) {
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

  setTimeout(() => toast.classList.add("show"), 100);

  triggerConfettiAtCenter();

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 600);
  }, 4500);
}

export function triggerConfetti(x, y) {
  const colors = ["#ff6b6b", "#4dadf7", "#51cf66", "#fcc419", "#ae3ec9", "#20c997", "#06b6d4"];
  const parent = document.body;
  
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.className = "particle-dot";
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    
    const angle = Math.random() * Math.PI * 2;
    const velocity = 40 + Math.random() * 70;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity - 25;
    
    p.style.setProperty("--dx", `${dx}px`);
    p.style.setProperty("--dy", `${dy}px`);
    
    parent.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

export function triggerConfettiAtCenter() {
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
      py += vy + 0.12;
      
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
    
    updateParticle();
  }
}

export function runDecryptionAnimation(elementId, finalStr, delayMs = 12) {
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

export function exportSessionReport(report, historicalSession = null) {
  const caseName = historicalSession ? historicalSession.caseName : (state.activeCase ? state.activeCase.name : "未知個案");
  const historyData = historicalSession ? historicalSession.history : (state.activeSession ? state.activeSession.history : []);
  const historyText = historyData.map(h => `${h.role === "user" ? "輔導員" : "案主"}: ${h.text}`).join("\n");
  
  const notesObj = historicalSession ? historicalSession.notes : (state.activeSession ? state.activeSession.notes : {});
  const soapNotes = (notesObj && notesObj.soap) || "（未填寫 SOAP 記錄）";
  const icfNotes = (notesObj && notesObj.icf) || "（未填寫 ICF 評估）";
  
  const diagnostic = historicalSession ? (historicalSession.caseDiagnostic || "未知診斷") : (state.activeCase ? state.activeCase.health_condition : "未知診斷");
  const dateStr = historicalSession ? historicalSession.date : new Date().toLocaleString();
  
  const content = `# RehabCounselor AI - 復康輔導與督導評核報告\n\n` +
    `案主姓名：${caseName}\n` +
    `就業診斷：${diagnostic}\n` +
    `評估日期：${dateStr}\n\n` +
    `## 📊 督導評估成績\n` +
    `- 同理心與反映式傾聽 (MI OARS)：${report.scores.empathy} 分\n` +
    `- 激發改變性談話 (MI Change Talk)：${report.scores.changeTalk} 分\n` +
    `- 心理彈性引導 (ACT Hexaflex)：${report.scores.actFlexibility} 分\n` +
    `- 全人障礙與環境評估 (ICF Matrix)：${report.scores.icfAccuracy} 分\n` +
    `- 承諾行動計劃可行性：${report.scores.actionPlanning} 分\n\n` +
    `## 💬 臨床督導總結 (Supervisor Feedback)\n` +
    `${report.summary}\n\n` +
    `## 📝 同工面談日誌記錄\n` +
    `### SOAP 日誌：\n${soapNotes}\n\n` +
    `### ICF 臨床評估表：\n${icfNotes}\n\n` +
    `## 🗣️ 面談歷史對話回顧\n` +
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
