// RehabCounselor AI - ICF Biopsychosocial Sandbox & Interactive Matrix Component

import { state, saveTheoryProgress, checkAndUnlockAchievements } from "../core/state.js";
import { triggerConfetti } from "./modals.js";

export function evaluateICFSandboxMatch(factorId, zoneType, zoneEl, container, clientX, clientY, renderCallback) {
  const factor = state.icfSandboxFactors ? state.icfSandboxFactors.find(f => f.id === factorId) : null;
  if (!factor) return;

  if (factor.type === zoneType) {
    factor.mappedZone = zoneType;
    state.icfSandboxScore += 10;
    
    let feedback = "";
    if (factor.type === "health_condition") feedback = "這是醫療上的臨床病理診斷，它是整個 biopsychosocial 復康矩陣的起點。";
    else if (factor.type === "body_functions") feedback = "這是具體的生理結構與功能的受損（包括疼痛）。它會直接對個人的任務執行（活動）帶來阻力。";
    else if (factor.type === "activities") feedback = "這關乎個人在不受外界幫助下『能不能做到某件事（如打字、控車）』，即個體活動能力限制 (Capacity)。";
    else if (factor.type === "participation") feedback = "這是有關案主在『社會生活或工作崗位情境』中的真實投入程度 (Performance)。當它受阻時，我們必須介入。";
    else if (factor.type === "environmental_factors") feedback = "環境因素包含物理環境、改裝補貼、以及僱主對殘疾人士的態度。這是我們進行合理便利（Reasonable Accommodation）的最佳抓手。";
    else if (factor.type === "personal_factors") feedback = "案主的個人背景特性（如年齡、學歷、價值觀）並非健康問題，但卻是我們激發其改變動機的最佳切入點。";

    state.icfSandboxStatus = `【精準分類！】『${factor.text}』百分之百屬於『${getICFCategoryChineseName(zoneType)}』。${feedback}`;
    state.icfSandboxStatusType = "success";

    const targetX = clientX || window.innerWidth / 2;
    const targetY = clientY || window.innerHeight / 2;
    triggerConfetti(targetX, targetY + window.scrollY);

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

    if (typeof renderCallback === "function") {
      renderCallback(container);
    }
  } else {
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

    if (typeof renderCallback === "function") {
      renderCallback(container);
    }
  }
}

export function getICFCategoryChineseName(category) {
  if (category === "health_condition") return "健康狀況";
  if (category === "body_functions") return "身體功能與結構";
  if (category === "activities") return "個人活動 (Capacity)";
  if (category === "participation") return "社會參與 (Performance)";
  if (category === "environmental_factors") return "環境因素";
  if (category === "personal_factors") return "個人因素";
  return category;
}

export function getICFName(type) {
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

export function startICFAssessment(selectedCase, switchViewCallback) {
  state.activeCase = selectedCase;
  state.activeView = "icf_board";

  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");
  if (title) title.textContent = `ICF 個案全人分析：${selectedCase.name}`;
  if (subtitle) subtitle.textContent = `請小組或同工個人，將左側案主背景特徵，分類拖放到右側正確的 ICF 五大評估維度中。`;

  const mount = document.getElementById("content-view-mount");
  if (!mount) return;
  
  const factors = [...selectedCase.icf_factors].sort(() => Math.random() - 0.5);

  mount.innerHTML = `
    <div class="icf-interactive-board">
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

      <div style="display:flex; flex-direction:column; gap:16px;">
        <div class="icf-matrix-grid">
          <div class="glass-card icf-drop-zone" id="icf-zone-health_condition" data-zone="health_condition">
            <h4><i class="fa-solid fa-notes-medical" style="color:var(--accent-rose);"></i> 健康狀況</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>
          <div class="glass-card icf-drop-zone" id="icf-zone-body_functions" data-zone="body_functions">
            <h4><i class="fa-solid fa-stethoscope" style="color:var(--accent-purple);"></i> 身體功能結構</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>
          <div class="glass-card icf-drop-zone" id="icf-zone-activities" data-zone="activities">
            <h4><i class="fa-solid fa-wheelchair" style="color:var(--accent-cyan);"></i> 個人活動 (Capacity)</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>
          <div class="glass-card icf-drop-zone" id="icf-zone-participation" data-zone="participation">
            <h4><i class="fa-solid fa-briefcase" style="color:var(--accent-green);"></i> 社會參與 (Performance)</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>
          <div class="glass-card icf-drop-zone" id="icf-zone-environmental_factors" data-zone="environmental_factors">
            <h4><i class="fa-solid fa-building-columns" style="color:var(--accent-amber);"></i> 環境因素</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>
          <div class="glass-card icf-drop-zone" id="icf-zone-personal_factors" data-zone="personal_factors">
            <h4><i class="fa-solid fa-user" style="color:var(--text-muted);"></i> 個人因素</h4>
            <div class="zone-mount-point" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px;">
          <button class="btn btn-primary" id="icf-submit-analysis-btn">提交 AI 診斷評估</button>
          <button class="btn" id="icf-cancel-btn">取消返回</button>
        </div>
      </div>
    </div>
  `;

  initICFDragAndDrop();

  document.getElementById("icf-cancel-btn").addEventListener("click", () => {
    if (typeof switchViewCallback === "function") switchViewCallback("arena");
  });

  document.getElementById("icf-submit-analysis-btn").addEventListener("click", () => {
    evaluateICFMapping(switchViewCallback);
  });
}

export function initICFDragAndDrop() {
  const pool = document.getElementById("icf-factor-pool");
  if (!pool) return;
  const factors = pool.querySelectorAll(".icf-source-factor");
  const zones = document.querySelectorAll(".icf-drop-zone");

  factors.forEach(factor => {
    factor.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", factor.id);
    });

    factor.addEventListener("click", () => {
      const activeZone = document.querySelector(".icf-drop-zone.dragover");
      if (activeZone) {
        moveFactorToZone(factor, activeZone);
      } else {
        const targetZone = prompt("請輸入你要分類到的區域（1:健康, 2:身體功能, 3:活動, 4:參與, 5:環境, 6:個人）");
        const zonesList = ["health_condition", "body_functions", "activities", "participation", "environmental_factors", "personal_factors"];
        const matchedType = zonesList[parseInt(targetZone) - 1];
        if (matchedType) {
          const matchingZone = document.getElementById(`icf-zone-${matchedType}`);
          if (matchingZone) moveFactorToZone(factor, matchingZone);
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

export function moveFactorToZone(factorEl, zoneEl) {
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

  tag.querySelector(".remove-btn").addEventListener("click", () => {
    tag.remove();
    factorEl.style.display = "block";
  });

  mountPoint.appendChild(tag);
  factorEl.style.display = "none";
}

export function evaluateICFMapping(switchViewCallback) {
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
  const unplaced = pool ? Array.from(pool.querySelectorAll(".icf-source-factor")).filter(f => f.style.display !== "none") : [];

  if (totalPlaced === 0) {
    alert("請先將案主特徵因子分類放入右側的 ICF 框格中。");
    return;
  }

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
    checkAndUnlockAchievements("icf_expert", null, triggerConfetti);

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
  if (mount) mount.innerHTML = evaluationHtml;

  const closeBtn = document.getElementById("icf-eval-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (typeof switchViewCallback === "function") switchViewCallback("arena");
    });
  }
}
