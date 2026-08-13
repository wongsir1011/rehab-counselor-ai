// RehabCounselor AI - Global Keyboard Hotkeys Engine

import { state } from "./state.js";
import { switchView } from "./router.js";
import { AudioSynth } from "./audioSynth.js";

/**
 * 初始化全局鍵盤快捷鍵
 */
export function initGlobalHotkeys() {
  document.addEventListener("keydown", (e) => {
    // 判斷是否在輸入框或文字區域打字中
    const activeEl = document.activeElement;
    const isTyping = activeEl && (
      activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA" ||
      activeEl.isContentEditable
    );

    // 1. Ctrl + Enter / Cmd + Enter: 在對話輸入框中快速發送對白
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      const textInput = document.getElementById("rp-text-input");
      const sendBtn = document.getElementById("rp-send-btn");
      if (textInput && sendBtn && document.activeElement === textInput) {
        e.preventDefault();
        sendBtn.click();
        return;
      }

      const quizInput = document.getElementById("ai-quiz-input");
      const quizSubmitBtn = document.getElementById("ai-quiz-submit-btn");
      if (quizInput && quizSubmitBtn && document.activeElement === quizInput) {
        e.preventDefault();
        quizSubmitBtn.click();
        return;
      }
    }

    // 2. Esc 鍵: 一鍵關閉全息歷程彈窗或收合 SOAP 側滑助理
    if (e.key === "Escape") {
      const popupOverlay = document.getElementById("session-detail-overlay");
      if (popupOverlay && popupOverlay.classList.contains("show")) {
        e.preventDefault();
        AudioSynth.playClick();
        popupOverlay.classList.remove("show");
        return;
      }

      const soapDrawer = document.getElementById("rp-soap-drawer");
      if (soapDrawer && soapDrawer.classList.contains("open")) {
        e.preventDefault();
        AudioSynth.playClick();
        soapDrawer.classList.remove("open");
        return;
      }
    }

    // 3. Space 空格鍵: 控制語音錄音開關（僅在非打字狀態下觸發）
    if (e.code === "Space" && !isTyping) {
      const micBtn = document.getElementById("rp-voice-mic-btn");
      if (micBtn && micBtn.style.display !== "none") {
        e.preventDefault();
        micBtn.click();
        return;
      }
    }

    // 4. Alt + 1 ~ Alt + 6 (Mac: Option + 1 ~ Option + 6): 快速切換主頁面
    if (e.altKey && !isTyping) {
      const viewsMap = {
        "Digit1": "dashboard",
        "Digit2": "theory",
        "Digit3": "arena",
        "Digit4": "co-learning",
        "Digit5": "analytics",
        "Digit6": "settings"
      };

      if (viewsMap[e.code]) {
        e.preventDefault();
        AudioSynth.playClick();
        switchView(viewsMap[e.code]);
      }
    }
  });

  console.info("⌨️ [RehabCounselor] 全局鍵盤快捷鍵系統初始化完成 (Cmd+Enter, Esc, Space, Alt+1~6)");
}
