// RehabCounselor AI - Theory Hub View Component (ACT / MI / ICF with Interactive Hexaflex, 3D Flashcards & Gamified Matcher Sandbox)

import { state, saveTheoryProgress, checkAndUnlockAchievements } from "../core/state.js";
import { MOCK_THEORY_DATA } from "../../mockData.js";
import { AudioSynth } from "../core/audioSynth.js";
import { triggerConfetti } from "../components/modals.js";

export function renderTheoryHub(container) {
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

  // Attach main tabs events
  document.getElementById("tab-btn-act").addEventListener("click", () => {
    AudioSynth.playClick();
    state.activeTheoryTab = "act";
    state.activeTheorySubTab = "info";
    renderTheoryHub(container);
  });
  document.getElementById("tab-btn-mi").addEventListener("click", () => {
    AudioSynth.playClick();
    state.activeTheoryTab = "mi";
    state.activeTheorySubTab = "info";
    renderTheoryHub(container);
  });
  document.getElementById("tab-btn-icf").addEventListener("click", () => {
    AudioSynth.playClick();
    state.activeTheoryTab = "icf";
    state.activeTheorySubTab = "info";
    renderTheoryHub(container);
  });

  // Attach sub tabs events
  document.getElementById("sub-tab-info").addEventListener("click", () => {
    AudioSynth.playClick();
    state.activeTheorySubTab = "info";
    renderTheoryHub(container);
  });
  document.getElementById("sub-tab-flashcards").addEventListener("click", () => {
    AudioSynth.playClick();
    state.activeTheorySubTab = "flashcards";
    renderTheoryHub(container);
  });
  document.getElementById("sub-tab-test").addEventListener("click", () => {
    AudioSynth.playClick();
    state.activeTheorySubTab = "test";
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
export function renderACTTab(container) {
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
            <!-- Defusion (Top-Right) -->
            <g class="hexa-node ${state.activeHexaNode === 'defusion' ? 'active' : ''}" data-node="defusion" style="--glow-color: #4dadf7">
              <circle cx="290" cy="100" r="22" fill="var(--illustration-bg)" stroke="#4dadf7" stroke-width="2"/>
              <text x="290" y="104" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf127;</text>
            </g>
            <!-- Present Moment (Bottom-Right) -->
            <g class="hexa-node ${state.activeHexaNode === 'present_moment' ? 'active' : ''}" data-node="present_moment" style="--glow-color: #51cf66">
              <circle cx="290" cy="240" r="22" fill="var(--illustration-bg)" stroke="#51cf66" stroke-width="2"/>
              <text x="290" y="244" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf14e;</text>
            </g>
            <!-- Self as Context (Bottom) -->
            <g class="hexa-node ${state.activeHexaNode === 'self_as_context' ? 'active' : ''}" data-node="self_as_context" style="--glow-color: #fcc419">
              <circle cx="170" cy="310" r="22" fill="var(--illustration-bg)" stroke="#fcc419" stroke-width="2"/>
              <text x="170" y="314" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf2bd;</text>
            </g>
            <!-- Values (Bottom-Left) -->
            <g class="hexa-node ${state.activeHexaNode === 'values' ? 'active' : ''}" data-node="values" style="--glow-color: #ae3ec9">
              <circle cx="50" cy="240" r="22" fill="var(--illustration-bg)" stroke="#ae3ec9" stroke-width="2"/>
              <text x="50" y="244" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf005;</text>
            </g>
            <!-- Committed Action (Top-Left) -->
            <g class="hexa-node ${state.activeHexaNode === 'committed_action' ? 'active' : ''}" data-node="committed_action" style="--glow-color: #20c997">
              <circle cx="50" cy="100" r="22" fill="var(--illustration-bg)" stroke="#20c997" stroke-width="2"/>
              <text x="50" y="104" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf70c;</text>
            </g>
          </svg>
        </div>

        <!-- Right: Interactive Dynamic Detail View -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-bright); margin-bottom:4px;">${data.title}</h3>
            <p style="font-size:0.85rem; color:var(--accent-purple); font-weight:600; margin-bottom:8px;">${data.subtitle}</p>
            <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.5;">${data.description}</p>
          </div>

          <div id="hexa-detail-mount"></div>
        </div>
      </div>
    `;

    renderACTNodeDetail();

    container.querySelectorAll(".hexa-node").forEach(node => {
      node.addEventListener("click", () => {
        AudioSynth.playClick();
        const nodeId = node.getAttribute("data-node");
        state.activeHexaNode = nodeId;
        container.querySelectorAll(".hexa-node").forEach(n => n.classList.remove("active"));
        node.classList.add("active");
        renderACTNodeDetail();
      });
    });

  } else if (state.activeTheorySubTab === "flashcards") {
    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-clone" style="color:var(--accent-purple);"></i> ACT 六角模型 3D 知識閃卡 deck</h3>
        <p style="font-size:0.9rem; color:var(--text-muted);">點擊以下卡牌翻轉，掌握各個核心維度在職業復康中的廣東話引導語與實踐練習。</p>
        
        <div class="flashcard-deck">
          ${data.hexaflex.map(node => `
            <div class="card-3d-wrapper" onclick="this.classList.toggle('flipped')">
              <div class="card-3d">
                <div class="card-front" style="border-left:4px solid ${node.color};">
                  <div class="card-front-title" style="color:${node.color};">
                    <i class="fa-solid ${node.icon}"></i> ${node.name}
                  </div>
                  <p style="font-size:0.82rem; color:var(--text-bright); font-weight:700; margin-top:8px; line-height:1.4;">${node.desc}</p>
                  <div class="card-prompt-question">
                    <strong>香港就業引導示範：</strong><br>${node.hk_example.substring(0, 60)}...
                  </div>
                  <div class="card-tap-hint">
                    <i class="fa-solid fa-arrows-rotate"></i> 點擊翻看詳細溝通範例與練習
                  </div>
                </div>
                <div class="card-back" style="border-top: 3px solid ${node.color};">
                  <div class="card-back-title" style="color:${node.color};">
                    <i class="fa-solid ${node.icon}"></i> ${node.name}
                  </div>
                  <div style="font-size:0.82rem; margin-bottom:8px; line-height:1.4; overflow-y:auto; flex-grow:1;">
                    <strong style="color:var(--accent-cyan);"><i class="fa-solid fa-comments"></i> 地道廣東話輔導對白：</strong>
                    <p style="color:var(--text-bright); font-weight:600; margin:4px 0 8px 0;">${node.hk_example}</p>
                    
                    <strong style="color:var(--accent-green);"><i class="fa-solid fa-compass"></i> 臨床引導小練習：</strong>
                    <p style="color:var(--text-main); margin-top:4px;">${node.exercise}</p>
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
    container.innerHTML = `
      <div class="glass-card" style="max-width:700px; margin:0 auto; display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-vial" style="color:var(--accent-purple);"></i> ACT 實務情境模擬測驗</h3>
        <p style="font-size:0.88rem; color:var(--text-muted);">案主阿強（中風小巴司機）說：「社工，我隻右手已經廢左，連揸小巴都唔得，我重可以做啲咩？我根本就係一個廢人！」請問同工應如何回應最符合 ACT 的「認知解離」與「價值澄清」？</p>
        
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
          <button class="btn" style="text-align:left; justify-content:flex-start; padding:12px; font-size:0.85rem;" onclick="alert('❌【不太合適】：這屬於強行糾正與無效安慰（糾正反射），會讓案主感到不被同理。');">
            A. 「阿強你唔好咁悲觀啦，依家好多科技，一定有野做得返嘅，唔好話自己係廢人！」
          </button>
          <button class="btn btn-primary" style="text-align:left; justify-content:flex-start; padding:12px; font-size:0.85rem;" onclick="alert('✅【極佳選答！】：此回答完美的運用了認知解離（將「我是廢人」這個念頭標籤化）以及價值澄清（照顧家庭的價值不受開車限制）。');">
            B. 「阿強，我留意到你腦海中浮現了『我是一個廢人』這個想法。我們試著看看這個想法，同時想想：拋開開小巴，你最希望為家人做些什麼？」
          </button>
          <button class="btn" style="text-align:left; justify-content:flex-start; padding:12px; font-size:0.85rem;" onclick="alert('❌【不推薦】：過快進入解決問題模式，未先進行同理與解離。');">
            C. 「既然開唔到小巴，我哋即刻報讀 ERB 辦公室助理課程啦！」
          </button>
        </div>
      </div>
    `;
  }
}

export function renderACTNodeDetail() {
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

// 2B. MI Tab View (OARS & Change Talk)
export function renderMITab(container) {
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
          <p style="font-size:0.82rem; color:var(--text-main); line-height:1.5;">當我們看見案主有不良行為或消極心態時（例如不想去復康、不想找工作），專業人員的本能往往是**說教、給建議、甚至指責**。MI 理論證實：這只會激發案主為「不改變」進行辯護，產生強烈「阻抗」，令諮商陷入僵局。OARS 的目的，就是透過**傾聽、反映、共情**來鬆動這份阻抗。</p>
        </div>

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
                <li><b>Commitment (承諾)</b>: ${state.locale === "en" ? "'I will attend the ERB course next Monday.'" : "「好，我承諾下星期一去報名上 ERB 再培訓課程。」"}</li>
                <li><b>Activation (激活)</b>: ${state.locale === "en" ? "'I am ready to try text-to-speech software.'" : "「我已經下載左語音輔助軟件，隨時可以試用。」"}</li>
                <li><b>Taking Steps (採取步驟)</b>: ${state.locale === "en" ? "'I updated my resume yesterday.'" : "「我尋晚已經請朋友幫我將履歷表整理好。」"}</li>
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
      checkAndUnlockAchievements("theory_explorer");

      if (state.theoryProgress) {
        state.theoryProgress.mi.test = true;
        saveTheoryProgress();
      }

      const completedTitle = state.locale === "en" ? "Congratulations on completing the MI OARS Matcher Challenge!" : state.locale === "zh-CN" ? "恭喜完成 MI OARS 实战配对挑战！" : "恭喜完成 MI OARS 實戰配對挑戰！";
      const completedDesc = state.locale === "en" 
        ? `You successfully answered all 10 classic client resistance statements, accumulating <strong style="color:var(--accent-green); font-size:1.2rem;">${state.miGameScore}</strong> points! This shows you have mastered the spirit of MI and overcome the righting reflex.`
        : `你成功解答了所有 10 大經典案主的矛盾衝突陳述，累積獲得了 <strong style="color:var(--accent-green); font-size:1.2rem;">${state.miGameScore}</strong> 分！這代表你已基本掌握了如何在就業輔導中克服「警報糾正反射」，並促成改變性談話。`;
      const btnRetry = state.locale === "en" ? "Retry Challenge" : "重新挑戰";
      const btnBack = state.locale === "en" ? "Back to Study" : "回到自學理論";

      container.innerHTML = `
        <div class="glass-card text-center" style="padding:48px 24px; text-align:center;">
          <div style="font-size:4rem; margin-bottom:16px;">🏆</div>
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
        AudioSynth.playClick();
        state.miGameScore = 0;
        state.miGameIndex = 0;
        renderMITab(container);
      });
      document.getElementById("mi-back-to-info-btn").addEventListener("click", () => {
        AudioSynth.playClick();
        state.activeTheorySubTab = "info";
        renderTheoryHub(container.parentNode.parentNode);
      });
      return;
    }

    container.innerHTML = `
      <div class="glass-card mi-game-container">
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

        <div class="case-quote-bubble">
          <div class="quote-label"><i class="fa-solid fa-user-injured"></i> 復康就業案主真實聲音：</div>
          <div class="quote-text">"${gameData.statement}"</div>
        </div>

        <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.4;">
          <strong>小組共同研習挑戰：</strong>請選擇最符合 <b>動機式訪談 (MI) 的專業共情技巧</b>，並能最大化激發案主自主改變動機的回應（避開強加指責與說教反射）：
        </p>

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

    const cards = container.querySelectorAll(".oars-option-card");
    const nextBtn = document.getElementById("mi-next-btn");

    cards.forEach(card => {
      card.addEventListener("click", (e) => {
        if (nextBtn.style.display === "inline-flex") return;

        const idx = parseInt(card.getAttribute("data-idx"));
        const option = gameData.options[idx];
        
        state.miGameScore += option.score;

        if (option.score >= 8) {
          AudioSynth.playSuccess();
          triggerConfetti(e.clientX, e.clientY + window.scrollY);
        } else {
          AudioSynth.playError();
        }
        
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

        nextBtn.style.display = "inline-flex";
      });
    });

    nextBtn.addEventListener("click", () => {
      AudioSynth.playClick();
      state.miGameIndex++;
      renderMITab(container);
    });
  }
}

// 2C. ICF Tab View (Biopsychosocial & Diagnostic Sandbox)
export function renderICFTab(container) {
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

      <div class="glass-card" style="margin-top: 20px; padding: 20px;">
        <h4 style="color: var(--accent-cyan); font-weight: 800; font-size: 1.05rem; margin-bottom: 8px;">
          <i class="fa-solid fa-graduation-cap"></i> ${state.locale === "en" ? "ICF Biopsychosocial Framework in Vocational Rehabilitation" : "ICF 全人評估模型與職業復康臨床整合"}
        </h4>
        <p style="font-size: 0.85rem; color: var(--text-main); line-height: 1.6; margin-bottom: 12px;">
          ${state.locale === "en"
            ? "The WHO ICF shifts focus from 'disability as a disease' to 'functioning as a biopsychosocial dynamic'. In vocational counseling, it acts as a diagnostic bridge:"
            : "世界衛生組織的 ICF 徹底改變了傳統醫學模式，不再將殘疾僅視為「個人的疾病」，而是視為「生理-心理-社會」之間的動態平衡。在職業輔導中，它是評估的核心骨架："}
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 8px;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px;">
            <h5 style="color: var(--accent-cyan); font-weight: 700; font-size: 0.88rem; margin-bottom: 4px;">
              ${state.locale === "en" ? "1. Bridging Capacity and Performance" : "1. 銜接「個人活動能力」與「社會參與表現」"}
            </h5>
            <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
              ${state.locale === "en"
                ? "ICF distinguishes between Capacity and Performance. If capacity is high but performance is low, environmental barriers are likely the cause."
                : "ICF 區分了個人活動能力 (Capacity) 與社會參與表現 (Performance)。若能力高而表現低，說明環境存在阻礙，這正是復康同工需要攻堅的焦點。"}
            </p>
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px;">
            <h5 style="color: var(--accent-amber); font-weight: 700; font-size: 0.88rem; margin-bottom: 4px;">
              ${state.locale === "en" ? "2. Balancing Barriers and Facilitators" : "2. 評估「阻礙因子」與「促進因子」"}
            </h5>
            <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
              ${state.locale === "en"
                ? "Environmental and personal factors can act as barriers or facilitators. E.g., HK government subsidy of up to $40,000 for job accommodation is a major facilitator."
                : "環境與個人因素兼具雙重屬性。例如香港在職改裝資助最高4萬港元、復康巴士等即為強大的「環境促進因子」。"}
            </p>
          </div>
        </div>
      </div>
    `;
    
  } else if (state.activeTheorySubTab === "flashcards") {
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
                <div class="card-back" style="border-top: 3px solid var(--accent-cyan);">
                  <div class="card-back-title" style="color:var(--accent-cyan);">
                    <i class="fa-solid fa-circle-info"></i> ${card.title}
                  </div>
                  <div style="font-size:0.82rem; margin-bottom:8px; line-height:1.4; overflow-y:auto; flex-grow:1;">
                    <strong style="color:var(--accent-green);"><i class="fa-solid fa-stethoscope"></i> 香港就業復康實務範例：</strong>
                    <p style="color:var(--text-bright); font-weight:600; margin:4px 0 8px 0;">${card.hk_examples}</p>
                    
                    <strong style="color:var(--accent-purple);"><i class="fa-solid fa-clipboard-list"></i> 撰寫 SOAP 輔導日誌要點：</strong>
                    <p style="color:var(--text-main); margin-top:4px;">${card.soap_usage}</p>
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
    // Gamified Interactive ICF Diagnostic Sandbox
    const selectedCaseId = state.icfSandboxCaseId || state.cases[0].id;
    const selectedCase = state.cases.find(c => c.id === selectedCaseId) || state.cases[0];

    if (!state.icfSandboxFactors) {
      state.icfSandboxFactors = selectedCase.icf_factors.map((f, idx) => ({
        id: `factor-${idx}`,
        text: f.text,
        type: f.type,
        mappedZone: null
      }));
      state.icfSandboxScore = 0;
      state.icfSandboxStatus = state.locale === "en" 
        ? `Please drag or click the features on the left into the correct ICF biopsychosocial assessment dimension.`
        : `請將左側案主【${selectedCase.name}】的背景特徵，分類拖放或吸附至右側對應的 ICF 生物心理社會維度中。`;
      state.icfSandboxStatusType = "info";
    }

    const unmapped = state.icfSandboxFactors.filter(f => f.mappedZone === null);
    const isCompleted = unmapped.length === 0;

    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <!-- Top Toolbar: Case Selector & Live Score -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--card-border); padding-bottom:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="tag tag-cyan" style="font-size:0.75rem; font-weight:800;">
                <i class="fa-solid fa-vial"></i> ICF 實務互動診斷沙盒 (Interactive Sandbox)
              </span>
              <select id="icf-case-selector" style="background:var(--nested-bg-darkest); color:var(--text-bright); border:1px solid var(--card-border); border-radius:6px; padding:4px 8px; font-size:0.8rem; outline:none;">
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
          <div style="text-align:center; padding:40px; background:linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(124,58,237,0.06) 100%); border-radius:12px; border:1px solid rgba(6,182,212,0.2);">
            <div style="font-size:3.5rem; margin-bottom:16px;">🏆</div>
            <h4 style="font-size:1.4rem; font-weight:800; color:var(--text-bright); margin-bottom:8px;">完美達成全人 biopsychosocial 職業診斷！</h4>
            <p style="font-size:0.88rem; color:var(--text-muted); max-width:560px; margin:0 auto 20px; line-height:1.5;">
              你已將案主 ${selectedCase.name} 的所有背景特徵因子 100% 精確地分類到 ICF 六大評估維度中。這對你編寫 SOAP 日誌的 Assessment 部分以及在模擬諮商中調配資源至關重要！
            </p>
            <button class="btn btn-primary" id="btn-restart-sandbox"><i class="fa-solid fa-arrows-rotate"></i> 重新模擬評估</button>
          </div>
        ` : `
          <div class="icf-interactive-board">
            
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

            <div style="display:flex; flex-direction:column; gap:16px;">
              <div class="icf-matrix-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                
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

                <div class="glass-card icf-drop-zone" data-zone="environmental_factors" style="min-height:150px; padding:12px;">
                  <h4 style="font-size:0.85rem; font-weight:800; color:var(--accent-amber); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:8px;">
                    <i class="fa-solid fa-building-columns"></i> 環境因素
                  </h4>
                  <div class="zone-mount-point" style="display:flex; flex-direction:column; gap:6px;">
                    ${state.icfSandboxFactors.filter(f => f.mappedZone === 'environmental_factors').map(f => `
                      <span class="spring-snapped" style="font-size:0.75rem; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:4px; padding:4px 8px; color:var(--text-bright);">
                        <i class="fa-solid fa-circle-check" style="color:var(--accent-green);"></i> ${f.text}
                      </span>
                    `).join("")}
                  </div>
                </div>

                <div class="glass-card icf-drop-zone" data-zone="personal_factors" style="min-height:150px; padding:12px;">
                  <h4 style="font-size:0.85rem; font-weight:800; color:var(--text-muted); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:8px;">
                    <i class="fa-solid fa-user"></i> 個人因素
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

    const caseSelector = document.getElementById("icf-case-selector");
    if (caseSelector) {
      caseSelector.addEventListener("change", (e) => {
        AudioSynth.playClick();
        state.icfSandboxCaseId = e.target.value;
        state.icfSandboxFactors = null;
        renderICFTab(container);
      });
    }

    document.getElementById("reset-icf-sandbox-btn").addEventListener("click", () => {
      AudioSynth.playClick();
      state.icfSandboxFactors = null;
      renderICFTab(container);
    });

    if (isCompleted) {
      document.getElementById("btn-restart-sandbox").addEventListener("click", () => {
        AudioSynth.playClick();
        state.icfSandboxFactors = null;
        renderICFTab(container);
      });
      return;
    }

    const factorCards = container.querySelectorAll(".icf-source-factor");
    const zones = container.querySelectorAll(".icf-drop-zone");

    factorCards.forEach(card => {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", card.id);
        state.icfSandboxSelectedTouchId = null;
      });

      card.addEventListener("click", () => {
        AudioSynth.playClick();
        if (state.icfSandboxSelectedTouchId === card.id) {
          state.icfSandboxSelectedTouchId = null;
        } else {
          state.icfSandboxSelectedTouchId = card.id;
        }
        renderICFTab(container);
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

      zone.addEventListener("click", (e) => {
        if (state.icfSandboxSelectedTouchId) {
          const factorId = state.icfSandboxSelectedTouchId;
          const zoneType = zone.getAttribute("data-zone");
          state.icfSandboxSelectedTouchId = null;
          evaluateICFSandboxMatch(factorId, zoneType, zone, container, e.clientX, e.clientY);
        }
      });
    });
  }
}

export function evaluateICFSandboxMatch(factorId, zoneType, zoneEl, container, clientX, clientY) {
  const factor = state.icfSandboxFactors.find(f => f.id === factorId);
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

    AudioSynth.playSuccess();
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
      checkAndUnlockAchievements("icf_expert");
      AudioSynth.playUnlock();
    }

    renderICFTab(container);
  } else {
    zoneEl.classList.add("shake-warning");
    AudioSynth.playError();
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

    renderICFTab(container);
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
