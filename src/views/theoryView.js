// RehabCounselor AI - Theory Hub View Component (ACT / MI / ICF)

import { state, saveTheoryProgress } from "../core/state.js";
import { MOCK_THEORY_DATA } from "../../mockData.js";
import { evaluateICFSandboxMatch, getICFCategoryChineseName } from "../components/icfSandbox.js";

export function renderTheoryHub(container) {
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
    <div class="glass-card" style="margin-bottom: 20px; padding: 12px;">
      <div class="notes-tab-group" style="border-radius: 10px;">
        <div class="notes-tab ${state.activeTheoryTab === 'act' ? 'active' : ''}" id="tab-btn-act" style="font-size: 0.9rem; padding: 10px;">${actLabel}</div>
        <div class="notes-tab ${state.activeTheoryTab === 'mi' ? 'active' : ''}" id="tab-btn-mi" style="font-size: 0.9rem; padding: 10px;">${miLabel}</div>
        <div class="notes-tab ${state.activeTheoryTab === 'icf' ? 'active' : ''}" id="tab-btn-icf" style="font-size: 0.9rem; padding: 10px;">${icfLabel}</div>
      </div>
    </div>

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

export function renderACTTab(container) {
  const data = MOCK_THEORY_DATA.act;
  
  if (state.activeTheorySubTab === "info") {
    container.innerHTML = `
      <div class="glass-card theory-layout">
        <div class="hexaflex-svg-container">
          <div class="hexaflex-center-text">心理彈性<br><span style="font-size:0.7rem; color:var(--accent-cyan); font-weight:600;">ACT Core</span></div>
          <svg width="340" height="340" viewBox="0 0 340 340">
            <polygon points="170,30 290,100 290,240 170,310 50,240 50,100" fill="none" stroke="var(--illustration-line)" stroke-width="2"/>
            <line x1="170" y1="30" x2="170" y2="310" stroke="var(--illustration-line)" stroke-width="1.5" />
            <line x1="50" y1="100" x2="290" y2="240" stroke="var(--illustration-line)" stroke-width="1.5" />
            <line x1="50" y1="240" x2="290" y2="100" stroke="var(--illustration-line)" stroke-width="1.5" />
            
            <g class="hexa-node ${state.activeHexaNode === 'acceptance' ? 'active' : ''}" data-node="acceptance" style="--glow-color: #ff6b6b">
              <circle cx="170" cy="30" r="22" fill="var(--illustration-bg)" stroke="#ff6b6b" stroke-width="2"/>
              <text x="170" y="34" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf004;</text>
            </g>
            <g class="hexa-node ${state.activeHexaNode === 'defusion' ? 'active' : ''}" data-node="defusion" style="--glow-color: #4dadf7">
              <circle cx="290" cy="100" r="22" fill="var(--illustration-bg)" stroke="#4dadf7" stroke-width="2"/>
              <text x="290" y="104" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf127;</text>
            </g>
            <g class="hexa-node ${state.activeHexaNode === 'present_moment' ? 'active' : ''}" data-node="present_moment" style="--glow-color: #51cf66">
              <circle cx="290" cy="240" r="22" fill="var(--illustration-bg)" stroke="#51cf66" stroke-width="2"/>
              <text x="290" y="244" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf14e;</text>
            </g>
            <g class="hexa-node ${state.activeHexaNode === 'self_as_context' ? 'active' : ''}" data-node="self_as_context" style="--glow-color: #fcc419">
              <circle cx="170" cy="310" r="22" fill="var(--illustration-bg)" stroke="#fcc419" stroke-width="2"/>
              <text x="170" y="314" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf2bd;</text>
            </g>
            <g class="hexa-node ${state.activeHexaNode === 'values' ? 'active' : ''}" data-node="values" style="--glow-color: #ae3ec9">
              <circle cx="50" cy="240" r="22" fill="var(--illustration-bg)" stroke="#ae3ec9" stroke-width="2"/>
              <text x="50" y="244" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf005;</text>
            </g>
            <g class="hexa-node ${state.activeHexaNode === 'committed_action' ? 'active' : ''}" data-node="committed_action" style="--glow-color: #20c997">
              <circle cx="50" cy="100" r="22" fill="var(--illustration-bg)" stroke="#20c997" stroke-width="2"/>
              <text x="50" y="104" fill="var(--text-bright)" font-family="FontAwesome" font-size="14" text-anchor="middle">&#xf70c;</text>
            </g>
          </svg>
        </div>

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
    const oarsCards = [
      { letter: "O", name: "Open-ended Questions (開放式提問)", desc: "鼓勵案主精述並表達其想法與情感，而非簡單回答『是/否』。", example: "「阿強，你提到擔心跟唔上課程，如果我哋搵一個專門為復康人士開辦嘅班，你覺得會有咩唔同？」" },
      { letter: "A", name: "Affirmations (肯定)", desc: "真誠地認可案主的優點、勇氣、嘗試以及內在的堅韌能力。", example: "「阿強，雖然你覺得好難，但你今日願意黎到中心同我傾，已經證明你其實好有勇氣、好想為未來搵出路。」" },
      { letter: "R", name: "Reflective Listening (反映性傾聽)", desc: "精準反映案主說話背後的情緒與意義，讓案主感受深層次的被同理與接納。", example: "「你覺得自己身體唔如前，好擔心去到一個新環境會顯得自己慢，好怕會引黎其他人嘅目光同尷尬。」" },
      { letter: "S", name: "Summarizing (總結)", desc: "梳理對話中的精華與矛盾點，清晰呈現給案主，協助其看到改變的方向。", example: "「聽你講，你一方面覺得再培訓好似係一條出路，但另一方面你又好顧慮自己嘅身體狀況、怕被其他人笑。」" }
    ];

    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-clone" style="color:var(--accent-amber);"></i> MI OARS 四大對話技巧 3D 閃卡 deck</h3>
        <p style="font-size:0.9rem; color:var(--text-muted);">點擊以下卡牌翻轉，查看技巧定義與地道廣東話輔導回應範例。</p>
        
        <div class="flashcard-deck">
          ${oarsCards.map(c => `
            <div class="card-3d-wrapper" onclick="this.classList.toggle('flipped')">
              <div class="card-3d">
                <div class="card-front" style="border-left:4px solid var(--accent-amber);">
                  <div class="card-front-title" style="color:var(--accent-amber);">
                    <span style="font-size:1.4rem; font-weight:900; font-family:monospace; margin-right:6px;">${c.letter}</span>
                    ${c.name}
                  </div>
                  <p style="font-size:0.85rem; color:var(--text-bright); font-weight:700; margin-top:8px; line-height:1.4;">${c.desc}</p>
                  <div class="card-prompt-question">
                    <strong>對話實例示範：</strong><br>${c.example}
                  </div>
                  <div class="card-tap-hint">
                    <i class="fa-solid fa-arrows-rotate"></i> 點擊翻看詳細臨床應用心法
                  </div>
                </div>
                <div class="card-back" style="border-top: 3px solid var(--accent-amber);">
                  <div class="card-back-title" style="color:var(--accent-amber);">
                    ${c.name}
                  </div>
                  <div style="font-size:0.82rem; margin-bottom:8px; line-height:1.4; overflow-y:auto; flex-grow:1;">
                    <strong style="color:var(--accent-cyan);"><i class="fa-solid fa-comments"></i> 香港復康輔導對白：</strong>
                    <p style="color:var(--text-bright); font-weight:600; margin:4px 0 8px 0;">${c.example}</p>
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
        <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-vial" style="color:var(--accent-amber);"></i> MI OARS 技巧小測試</h3>
        <p style="font-size:0.88rem; color:var(--text-muted);">案主偉杰說：「我隻腳受左傷，根本做唔返地盤，我去搵其他工，僱主見到我拐吓拐吓，點會聘請我啊？」以下哪句回應屬於 MI 的「反映式傾聽 (Reflective Listening)」？</p>
        
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
          <button class="btn" style="text-align:left; justify-content:flex-start; padding:12px; font-size:0.85rem;" onclick="alert('❌【不精確】：這是說教與硬給建議，屬於警報糾正反射。');">
            A. 「偉杰，你唔好咁諗，香港好多文職或者保安都唔洗點行路，你去試下先啦！」
          </button>
          <button class="btn btn-primary" style="text-align:left; justify-content:flex-start; padding:12px; font-size:0.85rem;" onclick="alert('✅【答對了！】：這句對白精準反映了案主內心的恐懼（擔心自己步姿引來偏見），能讓案主感受被同理。');">
            B. 「偉杰，你覺得腳傷改變左你嘅外在情況，你好擔心去到面試時，僱主會因為你嘅步姿而忽視左你原本嘅工作能力，覺得好無力。」
          </button>
          <button class="btn" style="text-align:left; justify-content:flex-start; padding:12px; font-size:0.85rem;" onclick="alert('❌【不精確】：這是開放式提問，不是反映式傾聽。');">
            C. 「你覺得如果我們申請在職改裝資助，對你會有幫助嗎？」
          </button>
        </div>
      </div>
    `;
  }
}

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
      { code: "s / b", title: "身體功能與結構", desc: "生理系統功能或身體結構的異常與缺損。", hk_examples: "右側肢體偏癱、手部精細動作障礙、耐力下降、容易疲勞、下背劇痛。", soap_usage: "寫入 SOAP 日誌的 Objective 部分。" },
      { code: "d (Cap)", title: "個人活動能力", desc: "個體在標準環境下執行各項任務的最大潛在能力。", hk_examples: "無法獨立書寫、無法打字、無法長時間行走。", soap_usage: "作為職業就業評估的基線。" },
      { code: "d (Perf)", title: "社會參與表現", desc: "個體在當前真實生活或工作情境中的投入程度與表現。", hk_examples: "無法重投小巴司機崗位、因缺乏無障礙環境而待業。", soap_usage: "寫入 SOAP 的 Assessment 部分。" },
      { code: "e (Barriers)", title: "環境阻礙因素", desc: "物理、社會和態度環境中阻礙就業的消極因子。", hk_examples: "辦公室無斜道及洗手間、僱主對殘疾有刻板印象。", soap_usage: "就業配對攻堅焦點。" },
      { code: "e (Facilitators)", title: "環境促進因素", desc: "環境中能提升活動與社會參與的積極支持因子。", hk_examples: "復康巴士服務、政府在職改裝資助最高4萬、ERB 津貼。", soap_usage: "寫入 SOAP 的 Plan 部分。" },
      { code: "personal", title: "個人背景因素", desc: "案主的個人背景特性（如年齡、學歷、信念、興趣）。", hk_examples: "52歲、開車30年無文職經驗、極渴望賺錢養家。", soap_usage: "輔導的出發點與 MI 談話抓手。" }
    ];

    container.innerHTML = `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-clone" style="color:var(--accent-cyan);"></i> WHO ICF 六大診斷核心 3D 閃卡 deck</h3>
        <div class="flashcard-deck">
          ${icfCards.map((card) => `
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
                  <div class="card-prompt-question">
                    <strong>典型香港就業實例：</strong><br>${card.hk_examples.substring(0, 60)}...
                  </div>
                  <div class="card-tap-hint">
                    <i class="fa-solid fa-arrows-rotate"></i> 點擊翻看 SOAP 日誌技巧
                  </div>
                </div>
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
    if (!state.icfSandboxCaseId) {
      state.icfSandboxCaseId = (state.activeCase && state.activeCase.id) || state.cases[0].id;
    }
    const selectedCase = state.cases.find(c => c.id === state.icfSandboxCaseId) || state.cases[0];
    
    if (!state.icfSandboxFactors || state.icfSandboxFactorsCaseId !== selectedCase.id) {
      state.icfSandboxFactors = selectedCase.icf_factors.map((f, idx) => ({
        id: `icf-factor-${idx}`,
        text: f.text,
        type: f.type,
        mappedZone: null
      })).sort(() => Math.random() - 0.5);
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
              你已將案主 ${selectedCase.name} 的所有背景特徵因子 100% 精確地分類到 ICF 六大評估維度中。
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
                <span style="color:var(--accent-cyan); font-weight:700;"><i class="fa-solid fa-computer-mouse"></i> 電腦端：</span> 拖曳標籤至右側格子。<br>
                <span style="color:var(--accent-purple); font-weight:700;"><i class="fa-solid fa-fingerprint"></i> 流動端/平板：</span> 點擊標籤再點擊目標格子。
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

    const caseSelector = document.getElementById("icf-case-selector");
    if (caseSelector) {
      caseSelector.addEventListener("change", (e) => {
        state.icfSandboxCaseId = e.target.value;
        state.icfSandboxFactors = null;
        renderICFTab(container);
      });
    }

    const resetBtn = document.getElementById("reset-icf-sandbox-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.icfSandboxFactors = null;
        renderICFTab(container);
      });
    }

    if (isCompleted) {
      const restartBtn = document.getElementById("btn-restart-sandbox");
      if (restartBtn) {
        restartBtn.addEventListener("click", () => {
          state.icfSandboxFactors = null;
          renderICFTab(container);
        });
      }
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
        evaluateICFSandboxMatch(factorId, zoneType, zone, container, e.clientX, e.clientY, renderICFTab);
      });

      zone.addEventListener("click", (e) => {
        if (state.icfSandboxSelectedTouchId) {
          const factorId = state.icfSandboxSelectedTouchId;
          const zoneType = zone.getAttribute("data-zone");
          state.icfSandboxSelectedTouchId = null;
          evaluateICFSandboxMatch(factorId, zoneType, zone, container, e.clientX, e.clientY, renderICFTab);
        }
      });
    });
  }
}
