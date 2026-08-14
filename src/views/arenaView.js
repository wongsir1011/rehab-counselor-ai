import { state, checkAndUnlockAchievements } from "../core/state.js";
import { generateClientReply, generateCustomCase, generateSessionReport, generateSoapSuggestions } from "../services/geminiService.js";
import { speakCantonese, initVoiceRecognition, stopRecording } from "../core/speechEngine.js";
import { AudioSynth } from "../core/audioSynth.js";
import { exportSessionReport, triggerConfetti, runDecryptionAnimation } from "../components/modals.js";
import { RehabCounselorDB } from "../utils/db.js";

export function renderCaseArena(container, switchViewCallback) {
  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:24px;">
      <button class="btn btn-primary" id="view-cases-catalog-btn" style="justify-content:center; padding:14px;"><i class="fa-solid fa-folder-open"></i> ${state.locale === "en" ? "Browse Case Catalog (Dossier Lobby)" : "瀏覽經典復康個案庫 (Dossier Lobby)"}</button>
      <button class="btn" id="view-case-generator-btn" style="justify-content:center; padding:14px;"><i class="fa-solid fa-wand-magic-sparkles"></i> ${state.locale === "en" ? "AI Case Synthesizer (Bio-Gen Pod)" : "AI 智能個案產生器 (Bio-Gen Pod)"}</button>
    </div>

    <div id="arena-stage-mount"></div>
  `;

  const catalogBtn = document.getElementById("view-cases-catalog-btn");
  const generatorBtn = document.getElementById("view-case-generator-btn");
  const stageMount = document.getElementById("arena-stage-mount");

  catalogBtn.addEventListener("click", () => {
    catalogBtn.className = "btn btn-primary";
    generatorBtn.className = "btn";
    renderCaseCatalog(stageMount, switchViewCallback);
  });

  generatorBtn.addEventListener("click", () => {
    catalogBtn.className = "btn";
    generatorBtn.className = "btn btn-primary";
    renderCaseGenerator(stageMount, switchViewCallback);
  });

  renderCaseCatalog(stageMount, switchViewCallback);
}

export function renderCaseCatalog(container, switchViewCallback) {
  let selectedFilter = "all";
  let searchText = "";
  let filterAge = "all";
  let filterMotivation = "all";
  let filterOrigin = "all";

  container.innerHTML = `
    <div class="dossier-search-wrapper" style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; gap:16px; align-items:center; width:100%; flex-wrap:wrap;">
        <div class="dossier-search-inner" style="flex-grow:1; min-width:280px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" class="dossier-search-input" id="dossier-search-box" placeholder="${state.locale === 'en' ? 'Search case name, job, or condition...' : '搜尋個案姓名、前職或疾病診斷特徵...'}" />
        </div>
        
        <button class="cyber-filters-toggle" id="cyber-filters-toggle-btn">
          <i class="fa-solid fa-sliders"></i> ${state.locale === 'en' ? 'Advanced Filter Console' : '高級基因篩選控制台'} <i class="fa-solid fa-chevron-down" id="filters-chevron-icon" style="transition:transform 0.3s ease;"></i>
        </button>
      </div>

      <div class="cyber-filters-panel" id="cyber-filters-drawer">
        <div class="cyber-filter-row">
          <div class="cyber-filter-item">
            <label><i class="fa-solid fa-calendar-day" style="color:var(--accent-cyan);"></i> ${state.locale === 'en' ? 'Life Stage' : '生命階段'}</label>
            <select class="cyber-filter-select" id="filter-age-select">
              <option value="all">${state.locale === 'en' ? 'All Ages' : '全部年齡'}</option>
              <option value="youth">${state.locale === 'en' ? 'Youth (20-29 years old)' : '青年待業期 (20-29 歲)'}</option>
              <option value="middle">${state.locale === 'en' ? 'Middle-aged Transition (30-49 years old)' : '中年轉型期 (30-49 歲)'}</option>
              <option value="elderly">${state.locale === 'en' ? 'Senior (50+ years old)' : '高齡致殘期 (50 歲以上)'}</option>
            </select>
          </div>

          <div class="cyber-filter-item">
            <label><i class="fa-solid fa-gauge-simple-high" style="color:var(--accent-purple);"></i> ${state.locale === 'en' ? 'Work Motivation' : '就業與內在動機'}</label>
            <select class="cyber-filter-select" id="filter-motivation-select">
              <option value="all">${state.locale === 'en' ? 'All Motivations' : '全部動機'}</option>
              <option value="low">${state.locale === 'en' ? 'Low Motivation (Resistance)' : '極低動機 (抗拒與逃避期)'}</option>
              <option value="medium">${state.locale === 'en' ? 'Medium Motivation (Ambivalence)' : '中等動機 (糾結與矛盾期)'}</option>
              <option value="good">${state.locale === 'en' ? 'Good Motivation (Action)' : '良好動機 (準備與行動期)'}</option>
            </select>
          </div>

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
    
    <div class="dossier-grid" id="dossier-cards-grid" style="margin-top: 24px;"></div>
  `;

  const cardsGrid = document.getElementById("dossier-cards-grid");
  const searchBox = document.getElementById("dossier-search-box");
  const filterBadges = container.querySelectorAll(".dossier-filter-badge");
  const toggleFiltersBtn = document.getElementById("cyber-filters-toggle-btn");
  const filtersDrawer = document.getElementById("cyber-filters-drawer");
  const chevronIcon = document.getElementById("filters-chevron-icon");

  const ageSelect = document.getElementById("filter-age-select");
  const motivationSelect = document.getElementById("filter-motivation-select");
  const originSelect = document.getElementById("filter-origin-select");

  toggleFiltersBtn.addEventListener("click", () => {
    const isOpen = filtersDrawer.classList.toggle("open");
    chevronIcon.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
  });

  function renderFilteredCards() {
    cardsGrid.innerHTML = "";
    
    const filtered = state.cases.filter(c => {
      const isCustom = c.id.startsWith("generated_") || c.id.startsWith("custom_");
      if (filterOrigin === "prebuilt" && isCustom) return false;
      if (filterOrigin === "custom" && !isCustom) return false;

      if (filterAge === "youth" && (c.age < 20 || c.age > 29)) return false;
      if (filterAge === "middle" && (c.age < 30 || c.age > 49)) return false;
      if (filterAge === "elderly" && c.age < 50) return false;

      if (filterMotivation !== "all") {
        const emo = (c.emotional_state || "").toLowerCase();
        if (filterMotivation === "low" && !emo.includes("抗拒") && !emo.includes("逃避") && !emo.includes("恐慌") && !emo.includes("廢人")) return false;
        if (filterMotivation === "medium" && !emo.includes("焦慮") && !emo.includes("沮喪") && !emo.includes("猶豫") && !emo.includes("矛盾")) return false;
        if (filterMotivation === "good" && !emo.includes("期待") && !emo.includes("主動") && !emo.includes("嘗試") && !emo.includes("積極")) return false;
      }

      if (selectedFilter !== "all") {
        const cond = (c.health_condition || "").toLowerCase();
        
        if (selectedFilter === "physical" && !cond.includes("偏癱") && !cond.includes("殘疾") && !cond.includes("截肢") && !cond.includes("輪椅")) return false;
        if (selectedFilter === "brain" && !cond.includes("中風") && !cond.includes("腦傷") && !cond.includes("腦部")) return false;
        if (selectedFilter === "mental" && !cond.includes("抑鬱") && !cond.includes("焦慮") && !cond.includes("思覺失調") && !cond.includes("精神")) return false;
        if (selectedFilter === "asd" && !cond.includes("自閉") && !cond.includes("asd") && !cond.includes("發育")) return false;
        if (selectedFilter === "chronic" && !cond.includes("痛症") && !cond.includes("脊椎") && !cond.includes("關節") && !cond.includes("慢性")) return false;
        if (selectedFilter === "sensory" && !cond.includes("聽障") && !cond.includes("視障") && !cond.includes("感官")) return false;
      }

      if (searchText.trim() !== "") {
        const query = searchText.toLowerCase();
        const matchName = c.name.toLowerCase().includes(query);
        const matchJob = (c.previous_job || "").toLowerCase().includes(query);
        const matchCond = (c.health_condition || "").toLowerCase().includes(query);
        const matchFamily = (c.family || "").toLowerCase().includes(query);
        return matchName || matchJob || matchCond || matchFamily;
      }

      return true;
    });

    if (filtered.length === 0) {
      cardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 48px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed var(--card-border);">
          <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 12px;"></i>
          <h4 style="color: var(--text-bright); font-size: 1.1rem; font-weight: 700;">未有找到符合篩選條件的復康個案</h4>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 6px;">嘗試重設控制台篩選條件，或使用「AI 智能個案產生器」即時合成全新個案。</p>
        </div>
      `;
      return;
    }

    filtered.forEach(c => {
      const isCustom = c.id.startsWith("generated_") || c.id.startsWith("custom_");
      const card = document.createElement("div");
      card.className = "dossier-card";
      const isCompleted = state.completedCaseIds.includes(c.id);

      card.innerHTML = `
        <div class="dossier-card-header">
          <div class="dossier-avatar">${c.avatar}</div>
          <div class="dossier-title-group">
            <h3>${c.name}</h3>
            <p>${c.previous_job} · ${c.age}歲 (${c.gender})</p>
          </div>
          ${isCompleted ? `
            <span class="dossier-badge-status" style="background:rgba(16,185,129,0.15); color:var(--accent-green); border:1px solid rgba(16,185,129,0.3);">
              <i class="fa-solid fa-circle-check"></i> 已完成評核
            </span>
          ` : isCustom ? `
            <span class="dossier-badge-status" style="background:rgba(124,58,237,0.15); color:var(--accent-purple); border:1px solid rgba(124,58,237,0.3);">
              ✨ AI 智能合成
            </span>
          ` : ''}
        </div>

        <div style="font-size:0.82rem; color:var(--text-main); margin-bottom:12px; display:flex; flex-direction:column; gap:4px;">
          <div><strong style="color:var(--text-bright);">健康診斷：</strong>${c.health_condition}</div>
          <div><strong style="color:var(--text-bright);">家庭福利：</strong>${c.family}，${c.welfare}</div>
          <div><strong style="color:var(--text-bright);">心理狀態：</strong>${c.emotional_state}</div>
        </div>

        <div class="dossier-icf-preview">
          ${c.icf_factors.slice(0, 3).map(f => `
            <span class="icf-preview-tag" data-type="${f.type}">${f.text}</span>
          `).join("")}
          ${c.icf_factors.length > 3 ? `<span class="icf-preview-tag">+${c.icf_factors.length - 3}</span>` : ''}
        </div>

        <div class="dossier-action-bar">
          <button class="btn btn-primary start-sim-btn" style="flex:1; justify-content:center;">
            <i class="fa-solid fa-comments"></i> 進入模擬輔導
          </button>
        </div>
      `;

      card.querySelector(".start-sim-btn").addEventListener("click", () => {
        startRoleplaySession(c, switchViewCallback);
      });

      cardsGrid.appendChild(card);
    });
  }

  filterBadges.forEach(badge => {
    badge.addEventListener("click", () => {
      filterBadges.forEach(b => b.classList.remove("active"));
      badge.classList.add("active");
      selectedFilter = badge.getAttribute("data-filter");
      renderFilteredCards();
    });
  });

  searchBox.addEventListener("input", (e) => {
    searchText = e.target.value;
    renderFilteredCards();
  });

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

  renderFilteredCards();
}

export function renderCaseGenerator(container, switchViewCallback) {
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
      AudioSynth.playClick();
    });
  });

  // Import code handler
  const importBtn = document.getElementById("synthesis-import-btn");
  if (importBtn) {
    importBtn.addEventListener("click", () => {
      const codeInput = document.getElementById("synthesis-import-code");
      const code = codeInput ? codeInput.value.trim() : "";
      if (!code) {
        alert("請先貼上有效的基因分享碼！");
        return;
      }
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(code)));
        if (!decoded.id || !decoded.name) {
          throw new Error("無效的個案基因數據結構");
        }
        decoded.id = `imported_${Date.now()}`;
        state.cases.unshift(decoded);
        RehabCounselorDB.saveCustomCase(decoded);
        AudioSynth.playUnlock();
        alert(`🎉 成功導入個案「${decoded.name}」！已寫入實戰大廳。`);
        renderCaseCatalog(container, switchViewCallback);
      } catch (err) {
        AudioSynth.playError();
        alert(`基因碼導入失敗：${err.message}`);
      }
    });
  }

  // Handle Form Submission for AI Case Synthesis
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    AudioSynth.playClick();

    const disabilityType = selectedDisability;
    const ageGroup = ageLabels[ageSlider.value];
    const motivationLevel = motLabels[motSlider.value];
    const motivationStage = stageLabels[stageSlider.value];

    statusLcd.textContent = "SYS.SEQUENCING";
    statusLcd.style.color = "var(--accent-cyan)";

    // Replace preview screen with animated genetic sequencing HUD
    previewBay.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(6, 182, 212, 0.15); padding-bottom:8px;">
        <span style="font-size:0.75rem; font-weight:800; color:var(--accent-cyan); letter-spacing:0.5px;">
          <i class="fa-solid fa-dna fa-spin" style="color:var(--accent-cyan)"></i> 基因鏈重組中 (Sequencing)
        </span>
        <span class="lcd-digital-badge" id="hud-percentage">0%</span>
      </div>

      <div class="synthesis-loading-hud" style="padding: 20px 0; gap: 20px; flex-grow:1; display:flex; flex-direction:column; justify-content:center;">
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:6px; color:var(--text-bright);">
            <span id="synthesis-progress-title">初始化神經元連接...</span>
            <span id="synthesis-progress-pct" style="color:var(--accent-cyan); font-weight:800;">0%</span>
          </div>
          <div class="synthesis-progress-track" style="height:8px; background:var(--nested-bg-darkest); border-radius:4px; overflow:hidden; border:1px solid var(--card-border);">
            <div class="synthesis-progress-bar" id="synthesis-progress-bar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--accent-cyan), var(--accent-purple)); transition:width 0.1s ease;"></div>
          </div>
        </div>

        <div class="hud-log-stream" id="synthesis-inner-log" style="height:120px; font-size:0.72rem; overflow-y:auto;">
          <p><i class="fa-solid fa-play" style="color:var(--accent-cyan);"></i> 啟動生命特徵合成艙協議...</p>
        </div>
      </div>
    `;

    const barFill = document.getElementById("synthesis-progress-bar");
    const percentageText = document.getElementById("hud-percentage");
    const pctText = document.getElementById("synthesis-progress-pct");
    const progressTitle = document.getElementById("synthesis-progress-title");
    const innerLog = document.getElementById("synthesis-inner-log");

    const addInnerLog = (text) => {
      const p = document.createElement("p");
      p.innerHTML = text;
      innerLog.appendChild(p);
      innerLog.scrollTop = innerLog.scrollHeight;
      AudioSynth.playPulse();
    };

    let geminiResult = null;
    let geminiError = null;

    generateCustomCase(state.apiKey, state.selectedModel, {
      disabilityType,
      ageGroup,
      motivationLevel,
      motivationStage
    }).then(res => {
      geminiResult = res;
    }).catch(err => {
      geminiError = err;
    });

    let progress = 0;
    const steps = [
      { p: 15, log: `🧬 提取病理特徵與職業功能受損基因...`, title: "DNA 生物病理提取..." },
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
        if (pctText) pctText.textContent = `${progress}%`;
        
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
          if (pctText) pctText.textContent = `100%`;
          progressTitle.textContent = "個案基因特徵合成成功！";
          addInnerLog(`⚡ 合成成功！基因序列已完全就緒。`);
          AudioSynth.playUnlock();
          
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

            writeBtn.addEventListener("click", (e) => {
              const rect = e.target.getBoundingClientRect();
              triggerConfetti(rect.left + 40, rect.top + window.scrollY);

              if (!state.cases.some(c => c.id === geminiResult.id)) {
                state.cases.unshift(geminiResult);
              }
              try {
                const customOnly = state.cases.filter(c => !["case_01", "case_02", "case_03", "case_04"].includes(c.id));
                localStorage.setItem("rehab_custom_cases", JSON.stringify(customOnly));
                RehabCounselorDB.saveCustomCase(geminiResult);
              } catch(e) {}
              checkAndUnlockAchievements("case_creator");
              AudioSynth.playSuccess();
              alert(`🎉 個案「${geminiResult.name}」已順利寫入大廳首位！`);
              
              const catalogBtn = document.getElementById("view-cases-catalog-btn");
              if (catalogBtn) catalogBtn.click();
            });

            enterBtn.addEventListener("click", (e) => {
              const rect = e.target.getBoundingClientRect();
              triggerConfetti(rect.left + 40, rect.top + window.scrollY);

              if (!state.cases.some(c => c.id === geminiResult.id)) {
                state.cases.unshift(geminiResult);
              }
              try {
                const customOnly = state.cases.filter(c => !["case_01", "case_02", "case_03", "case_04"].includes(c.id));
                localStorage.setItem("rehab_custom_cases", JSON.stringify(customOnly));
                RehabCounselorDB.saveCustomCase(geminiResult);
              } catch(e) {}
              checkAndUnlockAchievements("case_creator");
              AudioSynth.playSuccess();
              startRoleplaySession(geminiResult, switchViewCallback);
            });

          }, 600);
        }
      }
    }, 60);

    function renderError(errMsg) {
      statusLcd.textContent = "GEN.ERROR";
      AudioSynth.playError();
      previewBay.innerHTML = `
        <h3 style="color:var(--accent-rose); font-size:1.15rem; font-weight:800; border-bottom:1px solid rgba(244,63,94,0.15); padding-bottom:8px;"><i class="fa-solid fa-triangle-exclamation"></i> 個案合成失敗</h3>
        <p style="color:var(--text-muted); font-size:0.8rem; margin:10px 0;">生命艙出現系統性拒絕或 API 連線中斷：</p>
        <div style="background:rgba(244,63,94,0.06); padding:12px; border-radius:10px; border-left:4px solid var(--accent-rose); color:var(--text-bright); font-family:monospace; font-size:0.78rem; margin-bottom:20px; white-space:pre-wrap; max-height:160px; overflow-y:auto; line-height:1.4;">${errMsg}</div>
        <button class="btn btn-primary" id="btn-synthesis-retry" style="width:100%; justify-content:center;"><i class="fa-solid fa-rotate-left"></i> 重新進入生命艙</button>
      `;
      
      document.getElementById("btn-synthesis-retry").addEventListener("click", () => {
        renderCaseGenerator(container, switchViewCallback);
      });
    }
  });
}

export function startRoleplaySession(selectedCase, switchViewCallback) {
  state.activeCase = selectedCase;
  state.activeSession = {
    history: [],
    notes: { soap: "", icf: "" },
    report: null,
    promptModifiers: []
  };
  
  state.activeView = "roleplay";
  
  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");
  if (title) title.textContent = `模擬輔導室：對話 ${selectedCase.name}`;
  if (subtitle) subtitle.textContent = `請扮演職業復康就業導師，使用 MI & ACT 技巧進行就業輔導與諮商。`;

  const mount = document.getElementById("content-view-mount");
  if (!mount) return;
  
  const clientShortName = selectedCase.name.split(" ")[0] || selectedCase.name;
  
  mount.innerHTML = `
    <div class="roleplay-room">
      <div class="dialogue-panel">
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

        <div id="rp-interaction-viewport" style="flex:1 1 0%; min-height:0; display:flex; flex-direction:column; overflow:hidden;">
          <div class="dialogue-history" id="rp-chat-history"></div>
        </div>

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
            <span style="font-size:0.75rem; color:var(--text-muted);" id="rp-voice-status-text">點擊麥克風即可直接講話 (${state.recognitionLang})</span>
          </div>

          <div id="rp-empathy-hud" style="display:flex; align-items:center; justify-content:space-between; padding:6px 12px; background:var(--nested-bg-dark); border:1px solid var(--card-border); border-radius:6px; font-size:0.75rem; color:var(--text-muted); transition:all 0.3s ease;">
            <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
              <span id="empathy-hud-indicator-dot" style="width:6px; height:6px; border-radius:50%; background:var(--text-muted); display:inline-block; flex-shrink:0; transition:all 0.3s ease;"></span>
              <span id="empathy-hud-status-text" style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">等待輸入共情反映詞（MI OARS / ACT）...</span>
            </div>
            <span style="font-size:0.62rem; color:rgba(255,255,255,0.25); text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; margin-left:10px;">臨床即時偵測 (Heuristics)</span>
          </div>

          <div class="input-console" id="rp-input-console-bar">
            <input type="text" id="rp-text-input" placeholder="輸入你想對案主說的話... 或點擊上方🎙️說話 (Cmd+Enter 快速發送)" />
            <button class="btn btn-primary" id="rp-send-btn" title="快速發送 (Cmd+Enter / Ctrl+Enter)"><i class="fa-solid fa-paper-plane"></i></button>
          </div>
        </div>
      </div>

      <div class="coach-sidebar">
        <div class="glass-card" style="flex:1 1 0%; min-height:0; display:flex; flex-direction:column; gap:10px; overflow-y:auto; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div class="supervisor-badge">
              <i class="fa-solid fa-user-tie"></i> AI 臨床督導助教 (Coach)
            </div>
            <button class="btn btn-primary" id="rp-show-coach-hint-btn" style="padding:4px 8px; font-size:0.7rem; display:flex; align-items:center; gap:4px; height:auto; background:var(--accent-purple);">
              <i class="fa-solid fa-eye"></i> <span id="rp-show-coach-hint-btn-text">${state.locale === "en" ? "Show Supervisor Suggestion" : "顯示督導建議回應"}</span>
            </button>
          </div>
          <div id="rp-coach-feedback" style="font-size:0.82rem; color:var(--text-main); line-height:1.5; display:none; background:var(--nested-bg-medium); padding:10px; border-radius:8px; border:1px dashed var(--card-border);">
            【會話初始提示】：案主${clientShortName}剛進來，擺出強烈的抗拒姿態。請不要立刻勸他去上堂，建議先使用 MI 的「同理反映」接納他的氣憤與無力感，與他建立工作同盟。
          </div>
        </div>

        <div class="glass-card" style="flex:1 1 0%; min-height:0; display:flex; flex-direction:column; gap:10px; overflow:hidden; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="notes-tab-group" style="padding:2px; border-radius:6px; position:relative; display:flex; flex-grow:1; max-width:220px;">
              <div class="notes-tab-highlighter" id="rp-notes-tab-highlighter"></div>
              <div class="notes-tab active" id="note-tab-soap" style="font-size:0.72rem; padding:4px 6px; flex:1; text-align:center; position:relative; z-index:2;">SOAP 輔導日誌</div>
              <div class="notes-tab" id="note-tab-icf" style="font-size:0.72rem; padding:4px 6px; flex:1; text-align:center; position:relative; z-index:2;">ICF 臨床評估表</div>
            </div>
            <div class="notes-save-indicator" id="rp-notes-save-indicator" style="display:flex; align-items:center; gap:5px; font-size:0.7rem; color:var(--accent-green); transition:color 0.3s ease;">
              <span class="save-status-dot" style="width:6px; height:6px; background:var(--accent-green); border-radius:50%; box-shadow:0 0 6px var(--accent-green); display:inline-block; transition:background 0.3s ease, box-shadow 0.3s ease;"></span>
              <span class="save-status-text">已安全備份</span>
            </div>
          </div>
          <textarea class="notes-textarea" id="rp-notes-box" placeholder="SOAP 記錄格式：&#10;S (主觀感受)：案主主要申訴與情緒&#10;O (客觀觀察)：面談時的言語與身體反應&#10;A (臨床評估)：使用哪些MI/ACT工具，效果如何&#10;P (未來計劃)：承諾行動細節"></textarea>
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:10px;">
          <button class="btn btn-cyan" id="rp-end-session-btn"><i class="fa-solid fa-flag-checkered"></i> 結束會話 & 報告</button>
          <button class="btn btn-danger" id="rp-abort-btn">放棄返回</button>
        </div>
      </div>

      <div class="soap-assistant-drawer" id="rp-soap-drawer">
        <button class="soap-drawer-toggle" id="rp-soap-drawer-toggle" title="打開/收合 AI 臨床助理">
          <i class="fa-solid fa-brain"></i>
          <span>AI 督導</span>
        </button>
        <div class="soap-drawer-content" style="display:flex; flex-direction:column; overflow:hidden; height:100%;">
          <div class="notes-tab-group" style="padding:2px; border-radius:6px; display:flex; margin-bottom:14px; flex-shrink:0;">
            <div class="notes-tab active" id="rp-drawer-tab-soap" style="font-size:0.72rem; padding:6px; flex:1; text-align:center; cursor:pointer;">SOAP 助寫</div>
            <div class="notes-tab" id="rp-drawer-tab-interact" style="font-size:0.72rem; padding:6px; flex:1; text-align:center; cursor:pointer;">督導對弈</div>
          </div>

          <div style="flex:1; overflow-y:auto; padding-right:4px; display:flex; flex-direction:column;">
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

            <div id="rp-drawer-content-interact" style="display:none; flex-direction:column; gap:12px;">
              <h4 class="soap-drawer-title"><i class="fa-solid fa-gamepad"></i> 臨床督導對弈艙</h4>
              <p class="soap-drawer-desc">向模擬艙中注入「即時心理干預指令」，案主在下一句廣東話對白中將產生無縫的情感轉折。</p>
              
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

  const initBubble = renderChatBubble("ai", selectedCase.initial_dialogue);
  speakCantonese(selectedCase.initial_dialogue, initBubble);

  const textInput = document.getElementById("rp-text-input");
  if (textInput) {
    setTimeout(() => textInput.focus(), 100);
  }

  const noteSoap = document.getElementById("note-tab-soap");
  const noteIcf = document.getElementById("note-tab-icf");
  const notesBox = document.getElementById("rp-notes-box");

  noteSoap.addEventListener("click", () => {
    if (noteSoap.classList.contains("active")) return;
    state.activeSession.notes.icf = notesBox.value;
    noteSoap.classList.add("active");
    noteIcf.classList.remove("active");
    notesBox.value = state.activeSession.notes.soap;
    notesBox.placeholder = `SOAP 記錄格式：\nS (主觀感受)：案主主要申訴與情緒\nO (客觀觀察)：面談時的言語與身體反應\nA (臨床評估)：使用哪些MI/ACT工具，效果如何\nP (未來計劃)：承諾行動細節`;
    
    const highlighter = document.getElementById("rp-notes-tab-highlighter");
    if (highlighter) highlighter.style.transform = "translateX(0%)";
  });

  noteIcf.addEventListener("click", () => {
    if (noteIcf.classList.contains("active")) return;
    state.activeSession.notes.soap = notesBox.value;
    noteSoap.classList.remove("active");
    noteIcf.classList.add("active");
    notesBox.value = state.activeSession.notes.icf;
    notesBox.placeholder = `ICF 復康記錄：\n1. 身體功能受損：\n2. 活動局限限制：\n3. 社會參與障礙：\n4. 環境促進或阻礙：\n5. 個人因素引導：`;
    
    const highlighter = document.getElementById("rp-notes-tab-highlighter");
    if (highlighter) highlighter.style.transform = "translateX(100%)";
  });

  notesBox.addEventListener("input", () => {
    if (noteSoap.classList.contains("active")) {
      state.activeSession.notes.soap = notesBox.value;
    } else {
      state.activeSession.notes.icf = notesBox.value;
    }
  });

  const sendBtn = document.getElementById("rp-send-btn");
  if (sendBtn && textInput) {
    sendBtn.addEventListener("click", () => handleTextSubmit(textInput));
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleTextSubmit(textInput);
    });
  }

  const hintBtn = document.getElementById("rp-show-coach-hint-btn");
  if (hintBtn) {
    hintBtn.addEventListener("click", () => {
      AudioSynth.playClick();
      const fb = document.getElementById("rp-coach-feedback");
      const icon = hintBtn.querySelector("i");
      const text = document.getElementById("rp-show-coach-hint-btn-text");
      if (fb.style.display === "none") {
        fb.style.display = "block";
        icon.className = "fa-solid fa-eye-slash";
        text.textContent = state.locale === "en" ? "Hide Supervisor Suggestion" : "隱藏督導建議回應";
      } else {
        fb.style.display = "none";
        icon.className = "fa-solid fa-eye";
        text.textContent = state.locale === "en" ? "Show Supervisor Suggestion" : "顯示督導建議回應";
      }
    });
  }

  initVoiceRecognition(textInput);
  initSoapAssistantDrawer();

  document.getElementById("rp-end-session-btn").addEventListener("click", () => endRoleplaySession(switchViewCallback));
  document.getElementById("rp-abort-btn").addEventListener("click", () => {
    if (confirm("確定放棄本次模擬對話嗎？這將不會保存你的輔導記錄。")) {
      if (typeof switchViewCallback === "function") switchViewCallback("arena");
    }
  });
}

function initSoapAssistantDrawer() {
  const drawer = document.getElementById("rp-soap-drawer");
  const toggleBtn = document.getElementById("rp-soap-drawer-toggle");
  const generateSoapBtn = document.getElementById("rp-soap-generate-btn");
  const adoptSoapBtn = document.getElementById("rp-soap-adopt-btn");
  const notesBox = document.getElementById("rp-notes-box");

  if (!drawer || !toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    AudioSynth.playClick();
    drawer.classList.toggle("open");
  });

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

  const interventionPresets = document.querySelectorAll(".btn-intervention");
  const interventionInput = document.getElementById("rp-intervention-input");
  const interventionSendBtn = document.getElementById("rp-intervention-send-btn");
  const interventionLogs = document.getElementById("rp-intervention-logs");

  if (interventionSendBtn && interventionInput && interventionLogs) {
    const injectIntervention = (directive) => {
      if (!directive.trim()) return;

      AudioSynth.playUnlock();

      state.activeSession.promptModifiers.push(`【臨床督導即時注入指令：案主在此刻對答中，情緒狀態與心理表現轉變為：${directive}】`);

      const timeStr = new Date().toLocaleTimeString();
      const logSpan = document.createElement("span");
      logSpan.style.color = "var(--accent-cyan)";
      logSpan.innerHTML = `<b style="color:var(--text-muted);">[${timeStr}]</b> 注入成功：${directive.substring(0, 16)}${directive.length > 16 ? '...' : ''}`;
      
      if (interventionLogs.textContent.includes("目前為預設模擬環境")) {
        interventionLogs.innerHTML = "";
      }
      interventionLogs.appendChild(logSpan);
      interventionLogs.scrollTop = interventionLogs.scrollHeight;

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

      const isEmpathy = val.includes("聽") || val.includes("覺得") || val.includes("明白") || 
                        val.includes("感受") || val.includes("留意") || val.includes("諗法") || 
                        val.includes("想法") || val.includes("重要") || val.includes("價值") || 
                        val.includes("體會") || val.includes("支持") || val.includes("陪你");
                        
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

  let activeSoapData = null;

  if (generateSoapBtn) {
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

        document.getElementById("soap-suggest-s").textContent = soapSuggestions.S;
        document.getElementById("soap-suggest-o").textContent = soapSuggestions.O;
        document.getElementById("soap-suggest-a").textContent = soapSuggestions.A;
        document.getElementById("soap-suggest-p").textContent = soapSuggestions.P;

        if (adoptSoapBtn) adoptSoapBtn.style.display = "inline-flex";
      } catch (e) {
        AudioSynth.playError();
        alert(`${state.locale === "en" ? "Analysis failed" : "分析起草失敗"}：${e.message}`);
      } finally {
        generateSoapBtn.disabled = false;
        generateSoapBtn.innerHTML = originalText;
      }
    });
  }

  if (adoptSoapBtn) {
    adoptSoapBtn.addEventListener("click", () => {
      AudioSynth.playClick();
      if (!activeSoapData) return;

      const noteSoap = document.getElementById("note-tab-soap");
      if (noteSoap && !noteSoap.classList.contains("active")) {
        noteSoap.click();
      }

      const formattedSoap = `S (主觀感受)：\n${activeSoapData.S}\n\nO (客觀觀察)：\n${activeSoapData.O}\n\nA (臨床評估)：\n${activeSoapData.A}\n\nP (未來計劃)：\n${activeSoapData.P}`;
      if (notesBox) notesBox.value = formattedSoap;
      state.activeSession.notes.soap = formattedSoap;

      AudioSynth.playSuccess();

      const originalAdoptText = adoptSoapBtn.innerHTML;
      adoptSoapBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> ${state.locale === "en" ? "Adopted Successfully!" : "已成功採納！"}`;
      setTimeout(() => {
        adoptSoapBtn.innerHTML = originalAdoptText;
      }, 2000);
    });
  }
}

export function refreshChatHistoryFeed() {
  const chatFeed = document.getElementById("rp-chat-history");
  if (!chatFeed) return;
  chatFeed.innerHTML = "";
  
  if (state.activeCase) {
    renderChatBubble("ai", state.activeCase.initial_dialogue);
  }
  
  if (state.activeSession && state.activeSession.history) {
    state.activeSession.history.forEach(msg => {
      renderChatBubble(msg.role === "user" ? "user" : "ai", msg.text);
    });
  }
}

export function renderChatBubble(sender, text) {
  const chatFeed = document.getElementById("rp-chat-history");
  if (!chatFeed) return null;

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble bubble-${sender}`;
  
  const meta = document.createElement("div");
  meta.className = "bubble-meta";
  meta.textContent = sender === "user" ? "輔導員 (You)" : `案主 ${state.activeCase ? state.activeCase.name : ''}`;

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
  renderChatBubble("user", text);
  state.activeSession.history.push({ role: "user", text: text });

  let apiUserText = text;
  if (state.activeSession.promptModifiers && state.activeSession.promptModifiers.length > 0) {
    const modifiersText = state.activeSession.promptModifiers.join("\n");
    apiUserText = `${text}\n\n${modifiersText}`;
    const lastHistoryItem = state.activeSession.history[state.activeSession.history.length - 1];
    if (lastHistoryItem) {
      lastHistoryItem.text = apiUserText;
    }
    state.activeSession.promptModifiers = [];
  }

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
    const historyContext = state.activeSession.history.slice(0, -1);
    const { reply, coachHint } = await generateClientReply(
      state.apiKey,
      state.selectedModel,
      state.activeCase,
      historyContext,
      apiUserText
    );

    if (typingEl) typingEl.remove();
    if (activeAvatar) {
      activeAvatar.classList.remove("avatar-pulsing-glow");
    }

    state.activeSession.history.push({ role: "model", text: reply });
    const bubbleEl = renderChatBubble("ai", reply);
    speakCantonese(reply, bubbleEl);

    const coachFeedback = document.getElementById("rp-coach-feedback");
    if (coachFeedback) {
      coachFeedback.innerHTML = coachHint.replace(/\n/g, "<br>");
      coachFeedback.style.display = "none";
      const hintBtn = document.getElementById("rp-show-coach-hint-btn");
      if (hintBtn) {
        const icon = hintBtn.querySelector("i");
        const text = document.getElementById("rp-show-coach-hint-btn-text");
        if (icon) icon.className = "fa-solid fa-eye";
        if (text) text.textContent = state.locale === "en" ? "Show Supervisor Suggestion" : "顯示督導建議回應";
      }
    }

  } catch (error) {
    if (typingEl) typingEl.remove();
    if (activeAvatar) {
      activeAvatar.classList.remove("avatar-pulsing-glow");
    }
    alert(`對話生成失敗：${error.message}`);
  }
}

export async function endRoleplaySession(switchViewCallback) {
  if (state.activeSession.history.length === 0) {
    alert("尚未開始對話，無法結束會話。");
    return;
  }

  if (!confirm("確定要結束本次模擬輔導，並生成督導評估報告嗎？")) {
    return;
  }

  stopRecording();

  const mount = document.getElementById("content-view-mount");
  mount.innerHTML = `
    <div class="glass-card" style="text-align:center; padding:48px 24px;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:3rem; color:var(--accent-purple); margin-bottom:16px;"></i>
      <h3 style="font-size:1.4rem; font-weight:800; color:var(--text-bright); margin-bottom:8px;">正在評估你的輔導技巧...</h3>
      <p style="color:var(--text-muted); max-width:520px; margin:0 auto;">AI 臨床督導正在分析你的會話歷史紀錄，評估同理心反映、OARS 技巧、ACT 價值澄清引導，這大概需要 5-8 秒...</p>
    </div>
  `;

  try {
    const report = await generateSessionReport(state.apiKey, state.selectedModel, state.activeCase, state.activeSession.history);
    state.activeSession.report = report;
    
    state.completedCasesCount += 1;
    localStorage.setItem("rehab_completed_cases_count", state.completedCasesCount);
    
    if (!state.completedCaseIds.includes(state.activeCase.id)) {
      state.completedCaseIds.push(state.activeCase.id);
      localStorage.setItem("rehab_completed_case_ids", JSON.stringify(state.completedCaseIds));
    }
    
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
    
    let historySessions = [];
    try {
      historySessions = JSON.parse(localStorage.getItem("rehab_sessions_history")) || [];
    } catch (e) {
      historySessions = [];
    }
    historySessions.unshift(completedSession);
    localStorage.setItem("rehab_sessions_history", JSON.stringify(historySessions));
    RehabCounselorDB.saveSession(completedSession);

    AudioSynth.playSuccess();
    
    checkAndUnlockAchievements("first_session");
    if (report.scores.empathy >= 90) {
      checkAndUnlockAchievements("empathy_master");
    }
    if (state.completedCaseIds.length >= 3) {
      checkAndUnlockAchievements("combat_specialist");
    }
    
    renderSessionReport(mount, report, switchViewCallback);
  } catch (error) {
    AudioSynth.playError();
    alert(`評估報告生成失敗：${error.message}`);
    if (typeof switchViewCallback === "function") switchViewCallback("arena");
  }
}

export function renderSessionReport(container, report, switchViewCallback) {
  const title = document.getElementById("view-title");
  if (title) title.textContent = `輔導能力評審報告：${state.activeCase.name}`;

  const { empathy, changeTalk, actFlexibility, icfAccuracy, actionPlanning } = report.scores;

  container.innerHTML = `
    <div class="grid-2col" style="margin-bottom: 24px;">
      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px; align-items:center;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright); align-self:flex-start;">輔導技巧雷達評分 (Skills Radar)</h3>
        
        <svg width="240" height="240" viewBox="0 0 200 200" style="margin:12px 0;">
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="60" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="40" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          <circle cx="100" cy="100" r="20" fill="none" stroke="var(--illustration-line-faint)" stroke-width="1"/>
          
          <line x1="100" y1="100" x2="100" y2="20" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="176" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="147" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="53" y2="165" stroke="var(--illustration-line)" stroke-width="1"/>
          <line x1="100" y1="100" x2="24" y2="76" stroke="var(--illustration-line)" stroke-width="1"/>
          
          <text x="100" y="15" fill="var(--text-muted)" font-size="8" text-anchor="middle">同理心 (MI)</text>
          <text x="182" y="76" fill="var(--text-muted)" font-size="8" text-anchor="start">改變談話 (MI)</text>
          <text x="152" y="175" fill="var(--text-muted)" font-size="8" text-anchor="start">心理彈性 (ACT)</text>
          <text x="48" y="175" fill="var(--text-muted)" font-size="8" text-anchor="end">全人評估 (ICF)</text>
          <text x="18" y="76" fill="var(--text-muted)" font-size="8" text-anchor="end">承諾行動</text>

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

      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-bright);"><i class="fa-solid fa-user-tie" style="color:var(--accent-cyan);"></i> 臨床總結督導報告 (Clinical Summary)</h3>
        <p style="font-size:0.95rem; color:var(--text-main); line-height:1.6; background:rgba(255,255,255,0.02); padding:16px; border-radius:10px; border-left:4px solid var(--accent-cyan);">
          ${report.summary.replace(/\n/g, "<br>")}
        </p>

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

  document.getElementById("rp-report-export-btn").addEventListener("click", () => exportSessionReport(report));
  document.getElementById("rp-report-back-btn").addEventListener("click", () => {
    if (typeof switchViewCallback === "function") switchViewCallback("arena");
  });
}
