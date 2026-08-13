// RehabCounselor AI - Co-Learning View Component (Group Learning Branch Sandboxes & AI Custom Quiz Builder)

import { state } from "../core/state.js";
import { MOCK_CO_LEARNING_CASES } from "../data/mockData.js";
import { generateCustomQuiz } from "../services/geminiService.js";
import { AudioSynth } from "../core/audioSynth.js";

export function renderCoLearning(container, switchViewCallback) {
  const caseData = MOCK_CO_LEARNING_CASES[0];
  
  container.innerHTML = `
    <div class="grid-2col" style="margin-bottom:24px; align-items:stretch;">
      <div class="glass-card co-projector-panel" style="display:flex; flex-direction:column; gap:20px; border: 1px solid var(--card-border); background: var(--nested-bg-dark);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="tag tag-purple" style="font-size:0.75rem; padding:4px 8px; font-weight:700;"><i class="fa-solid fa-desktop"></i> ${state.locale === "en" ? "Projector Classroom Mode" : "大螢幕投影研討艙"}</span>
          <h4 style="font-weight:800; color:var(--accent-cyan); font-size:0.8rem; letter-spacing:0.5px;">
            ${state.locale === "en" ? "Recommendation: Group collectively discuss" : "推薦：投影至大螢幕進行組員集體研討"}
          </h4>
        </div>
        
        <h3 style="font-size:1.45rem; font-weight:900; color:var(--text-bright); line-height:1.4; text-shadow:0 0 10px rgba(255,255,255,0.05);">${caseData.title}</h3>
        <p style="font-size:0.95rem; color:var(--text-main); line-height:1.6; font-weight:600;">${caseData.description}</p>
        
        <div class="co-dialogue-segment-box" style="background:var(--nested-bg-darkest); border-radius:12px; padding:22px; border:1px solid rgba(6,182,212,0.2); box-shadow:inset 0 0 12px rgba(6,182,212,0.04);">
          <h4 style="font-size:0.92rem; font-weight:900; color:var(--accent-cyan); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-quote-left"></i>
            ${state.locale === "en" ? "Client Resistance Dialogue Segment:" : "輔導面談情境片段："}
          </h4>
          <pre style="font-family:inherit; font-size:1.05rem; font-weight:800; color:var(--text-bright); white-space:pre-wrap; line-height:1.7; letter-spacing:0.5px; margin:0;">${caseData.dialogue_segment}</pre>
        </div>

        <div id="co-quiz-stage" style="display:flex; flex-direction:column; gap:16px;"></div>
      </div>

      <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
        <h3 style="font-size:1.20rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-dna" style="color:var(--accent-green);"></i>
          ${state.locale === "en" ? "AI Custom Quiz Generator Cabin" : "AI 研討題目生成艙"}
        </h3>
        <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.5;">
          ${state.locale === "en"
            ? "Enter a real client resistance dialogue (in Cantonese/Chinese). Gemini will analyze it in 6 seconds and synthesize a custom multiple-choice quiz with OARS/ACT evaluation guidelines for team discussion."
            : "輸入一段地道真實的案主抗拒/阻抗對話對白。利用 Google Gemini 智慧核心在 6 秒內進行剖析，動態生成一組包含標準答案、OARS 與 ACT 引導解析的多選研討題，供小組同步研討。"}
        </p>

        <div class="form-group" style="flex-grow:1; display:flex; flex-direction:column;">
          <label style="font-size:0.8rem; font-weight:700; color:var(--text-bright); margin-bottom:6px;">
            ${state.locale === "en" ? "Dialogue Segment Input" : "案主阻抗對白片段輸入"}
          </label>
          <textarea id="ai-quiz-input" placeholder="${state.locale === "en" ? "Enter client dialogue segment here..." : "例如：我開左三十年小巴，依家半身中風，你叫我點樣報ERB課程，班後生仔實笑我慢啦，去黎都係嘥氣！"}" style="width:100%; flex-grow:1; min-height:140px; background:var(--nested-bg-dark); border:1px solid var(--card-border); border-radius:10px; padding:12px; color:var(--text-bright); font-family:inherit; font-size:0.85rem; resize:none; outline:none; transition:var(--transition-smooth);"></textarea>
        </div>

        <button class="btn btn-primary shimmer-btn" id="ai-quiz-generate-btn" style="width:100%; justify-content:center;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> ${state.locale === "en" ? "Synthesize Custom Study Quiz" : "注入特徵並生成研討題"}
        </button>

        <div id="ai-custom-quiz-stage" style="display:none; background:var(--nested-bg-medium); border:1px solid var(--card-border); border-radius:12px; padding:16px; margin-top:12px; animation:fadeIn 0.5s ease;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--card-border); padding-bottom:8px;">
            <span class="tag tag-green">${state.locale === "en" ? "AI Generated Quiz" : "AI 合成題目艙已就緒"}</span>
            <button class="btn btn-circle" id="ai-custom-quiz-close" style="width:24px; height:24px; font-size:0.75rem; border:none; background:transparent;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div id="ai-custom-quiz-content"></div>
        </div>
      </div>
    </div>
  `;

  renderCoQuestion(0, switchViewCallback);

  const generateBtn = container.querySelector("#ai-quiz-generate-btn");
  const inputArea = container.querySelector("#ai-quiz-input");
  const customQuizStage = container.querySelector("#ai-custom-quiz-stage");
  const customQuizContent = container.querySelector("#ai-custom-quiz-content");
  const closeCustomQuizBtn = container.querySelector("#ai-custom-quiz-close");

  closeCustomQuizBtn.addEventListener("click", () => {
    AudioSynth.playClick();
    customQuizStage.style.display = "none";
  });

  generateBtn.addEventListener("click", async () => {
    AudioSynth.playClick();
    const dialogueVal = inputArea.value.trim();
    if (!dialogueVal) {
      alert(state.locale === "en" ? "Please enter a dialogue segment first!" : "請輸入一段案主對白片段！");
      return;
    }

    generateBtn.disabled = true;
    const originalText = generateBtn.innerHTML;
    generateBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${state.locale === "en" ? "Analyzing & Generating..." : "正在剖析並生成..."}`;

    try {
      const quizData = await generateCustomQuiz(state.apiKey, state.selectedModel, dialogueVal);
      AudioSynth.playSuccess();
      customQuizStage.style.display = "block";
      renderCustomQuizQuestions(quizData, 0, customQuizContent);
    } catch (e) {
      AudioSynth.playError();
      alert(`${state.locale === "en" ? "Generation failed" : "生成題目失敗"}：${e.message}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = originalText;
    }
  });
}

function renderCoQuestion(qIdx, switchViewCallback) {
  const stage = document.getElementById("co-quiz-stage");
  if (!stage) return;

  const caseData = MOCK_CO_LEARNING_CASES[0];
  const quiz = caseData.questions[qIdx];

  if (!quiz) {
    stage.innerHTML = `
      <div style="text-align:center; padding:24px 12px; background:rgba(16,185,129,0.06); border:1px dashed var(--accent-green); border-radius:10px;">
        <h4 style="color:var(--accent-green); font-size:1.1rem; font-weight:800; margin-bottom:6px;">🎉 ${state.locale === "en" ? "Study Session Completed!" : "小組研討圓滿完成！"}</h4>
        <p style="font-size:0.85rem; color:var(--text-main);">
          ${state.locale === "en"
            ? "Your group completed analyzing client resistance factors. We suggest immediately applying these insights in the simulator arena!"
            : "同工小組通過探討阿強面談中的阻抗點，深化了對於 MI『避免糾正反射』與『滾動阻抗反映』的實戰心得。建議小組立即將此心得運用到【模擬輔導室】的語音實戰演練中！"}
        </p>
        <button class="btn btn-primary" id="co-go-arena-btn" style="margin-top:12px;">${state.locale === "en" ? "Go to Case Arena" : "前往實戰 Arena"}</button>
      </div>
    `;
    document.getElementById("co-go-arena-btn").addEventListener("click", () => {
      AudioSynth.playClick();
      if (typeof switchViewCallback === "function") switchViewCallback("arena");
    });
    return;
  }

  stage.innerHTML = `
    <div style="background:rgba(255,255,255,0.02); border-radius:10px; padding:20px; border:1px solid var(--card-border);">
      <h4 style="font-size:1.05rem; font-weight:800; color:var(--text-bright); margin-bottom:16px; line-height:1.5;">
        <i class="fa-solid fa-question-circle" style="color:var(--accent-purple);"></i>
        ${state.locale === "en" ? "Discussion Question" : "討論題"} ${qIdx + 1}：${quiz.question}
      </h4>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${quiz.options.map((opt, idx) => `
          <button class="btn co-option-btn projector-option" data-idx="${idx}" style="position:relative; text-align:left; justify-content:space-between; display:flex; align-items:center; width:100%; font-size:0.92rem; font-weight:700; padding:14px 20px; overflow:hidden; border-color:rgba(255,255,255,0.08); transition:var(--transition-smooth);">
            <span class="poll-bg-bar" style="position:absolute; left:0; top:0; bottom:0; width:0%; background:var(--accent-purple); opacity:0.12; transition:width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1); z-index:1;"></span>
            <span style="position:relative; z-index:2;">${String.fromCharCode(65 + idx)}. ${opt}</span>
            <span class="poll-percent-text" style="position:relative; z-index:2; font-family:monospace; font-size:0.85rem; opacity:0; transition:opacity 0.4s ease; color:var(--text-muted); font-weight:800;">0%</span>
          </button>
        `).join("")}
      </div>
      <div id="co-quiz-feedback" style="display:none; margin-top:20px; font-size:0.9rem; background:rgba(124,58,237,0.06); border-radius:8px; padding:16px; border-left:4px solid var(--accent-purple); line-height:1.6;"></div>
    </div>
  `;

  const btns = stage.querySelectorAll(".co-option-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const selectedIdx = parseInt(btn.getAttribute("data-idx"));
      const fb = document.getElementById("co-quiz-feedback");
      
      const isCorrect = selectedIdx === quiz.correct;
      if (isCorrect) {
        AudioSynth.playSuccess();
      } else {
        AudioSynth.playError();
      }

      const correctIdx = quiz.correct;
      const percentages = [];
      percentages[correctIdx] = 68;
      percentages[(correctIdx + 1) % 4] = 16;
      percentages[(correctIdx + 2) % 4] = 11;
      percentages[(correctIdx + 3) % 4] = 5;

      btns.forEach((b, i) => {
        const bar = b.querySelector(".poll-bg-bar");
        const percentText = b.querySelector(".poll-percent-text");

        if (i === quiz.correct) {
          b.style.borderColor = "var(--accent-green)";
          b.style.background = "rgba(16,185,129,0.03)";
          if (bar) {
            bar.style.background = "var(--accent-green)";
            bar.style.width = `${percentages[i]}%`;
          }
        } else {
          if (i === selectedIdx) {
            b.style.borderColor = "var(--accent-rose)";
            b.style.background = "rgba(244,63,94,0.03)";
            if (bar) bar.style.background = "var(--accent-rose)";
          } else {
            b.style.borderColor = "rgba(255,255,255,0.05)";
            if (bar) bar.style.background = "rgba(255,255,255,0.08)";
          }
          if (bar) {
            bar.style.width = `${percentages[i]}%`;
          }
        }

        if (percentText) {
          percentText.textContent = `(小組投票: ${percentages[i]}%)`;
          percentText.style.opacity = "1";
        }

        b.disabled = true;
        b.style.cursor = "default";
      });

      fb.style.display = "block";
      fb.innerHTML = `
        <strong>【${state.locale === "en" ? "Analysis" : "小組引導解析"}】</strong>：${quiz.explanation}<br><br>
        <button class="btn btn-primary" id="co-quiz-next-btn">${state.locale === "en" ? "Next Question" : "進入下一討論"} <i class="fa-solid fa-arrow-right"></i></button>
      `;

      document.getElementById("co-quiz-next-btn").addEventListener("click", () => {
        AudioSynth.playClick();
        renderCoQuestion(qIdx + 1, switchViewCallback);
      });
    });
  });
}

function renderCustomQuizQuestions(quizData, qIdx, container) {
  const quiz = quizData.questions[qIdx];
  if (!quiz) {
    container.innerHTML = `
      <div style="text-align:center; padding:16px; background:rgba(16,185,129,0.06); border:1px dashed var(--accent-green); border-radius:10px;">
        <h4 style="color:var(--accent-green); font-size:1rem; font-weight:800; margin-bottom:4px;">🎉 ${state.locale === "en" ? "Custom Quiz Completed!" : "自訂研討題通關！"}</h4>
        <p style="font-size:0.78rem; color:var(--text-main);">${state.locale === "en" ? "Great job analyzing custom client resistance." : "太棒了！小組通過對自定義抗拒對白的多維度研討，加深了對輔導技巧的領悟。"}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <h4 style="font-size:0.95rem; font-weight:800; color:var(--text-bright); line-height:1.4;">
        <i class="fa-solid fa-sparkles" style="color:var(--accent-green);"></i>
        ${state.locale === "en" ? "Question" : "研討題"} ${qIdx + 1}：${quiz.question}
      </h4>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${quiz.options.map((opt, idx) => `
          <button class="btn ai-custom-opt-btn projector-option" data-idx="${idx}" style="position:relative; text-align:left; justify-content:space-between; display:flex; align-items:center; width:100%; font-size:0.88rem; font-weight:700; padding:10px 14px; overflow:hidden; border-radius:8px; border-color:rgba(255,255,255,0.06); transition:var(--transition-smooth);">
            <span class="poll-bg-bar" style="position:absolute; left:0; top:0; bottom:0; width:0%; background:var(--accent-purple); opacity:0.12; transition:width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1); z-index:1;"></span>
            <span style="position:relative; z-index:2;">${String.fromCharCode(65 + idx)}. ${opt}</span>
            <span class="poll-percent-text" style="position:relative; z-index:2; font-family:monospace; font-size:0.78rem; opacity:0; transition:opacity 0.4s ease; color:var(--text-muted); font-weight:800;">0%</span>
          </button>
        `).join("")}
      </div>
      <div id="ai-custom-quiz-feedback" style="display:none; font-size:0.82rem; background:rgba(124,58,237,0.06); border-radius:8px; padding:12px; border-left:4px solid var(--accent-purple); line-height:1.5;"></div>
    </div>
  `;

  const btns = container.querySelectorAll(".ai-custom-opt-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const selectedIdx = parseInt(btn.getAttribute("data-idx"));
      const fb = container.querySelector("#ai-custom-quiz-feedback");
      
      const isCorrect = selectedIdx === quiz.correct;
      if (isCorrect) {
        AudioSynth.playSuccess();
      } else {
        AudioSynth.playError();
      }

      const correctIdx = quiz.correct;
      const percentages = [];
      percentages[correctIdx] = 68;
      percentages[(correctIdx + 1) % 4] = 16;
      percentages[(correctIdx + 2) % 4] = 11;
      percentages[(correctIdx + 3) % 4] = 5;

      btns.forEach((b, i) => {
        const bar = b.querySelector(".poll-bg-bar");
        const percentText = b.querySelector(".poll-percent-text");

        if (i === quiz.correct) {
          b.style.borderColor = "var(--accent-green)";
          b.style.background = "rgba(16,185,129,0.03)";
          if (bar) {
            bar.style.background = "var(--accent-green)";
            bar.style.width = `${percentages[i]}%`;
          }
        } else {
          if (i === selectedIdx) {
            b.style.borderColor = "var(--accent-rose)";
            b.style.background = "rgba(244,63,94,0.03)";
            if (bar) bar.style.background = "var(--accent-rose)";
          } else {
            b.style.borderColor = "rgba(255,255,255,0.05)";
            if (bar) bar.style.background = "rgba(255,255,255,0.08)";
          }
          if (bar) {
            bar.style.width = `${percentages[i]}%`;
          }
        }

        if (percentText) {
          percentText.textContent = `(投票: ${percentages[i]}%)`;
          percentText.style.opacity = "1";
        }

        b.disabled = true;
        b.style.cursor = "default";
      });

      fb.style.display = "block";
      fb.innerHTML = `
        <strong>【${state.locale === "en" ? "Analysis" : "小組引導解析"}】</strong>：${quiz.explanation}<br><br>
        <button class="btn btn-primary" id="ai-custom-next-btn" style="padding:6px 12px; font-size:0.75rem;">
          ${state.locale === "en" ? "Next Question" : "進入下一討論"} <i class="fa-solid fa-arrow-right"></i>
        </button>
      `;

      container.querySelector("#ai-custom-next-btn").addEventListener("click", () => {
        AudioSynth.playClick();
        renderCustomQuizQuestions(quizData, qIdx + 1, container);
      });
    });
  });
}
