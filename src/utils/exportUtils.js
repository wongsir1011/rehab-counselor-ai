// RehabCounselor AI - Export & Case Management System (CMS) Clipboard Utilities

import { AudioSynth } from "../core/audioSynth.js";

/**
 * 格式化香港機構社工/職業復康同工標準個案紀錄 (Copy for Case Management System)
 */
export function formatCMSReportText(session) {
  const caseName = session.caseName || "未知個案";
  const dateStr = session.date || new Date().toLocaleString();
  const diagnostic = session.caseDiagnostic || "職業復康評估";

  const scores = session.report ? session.report.scores : {};
  const summary = session.report ? session.report.summary : "（無總結紀錄）";
  
  const notesObj = session.notes || {};
  const soapNotes = notesObj.soap || "（未撰寫 SOAP）";
  const icfNotes = notesObj.icf || "（未撰寫 ICF）";

  return `==================================================
【香港職業復康輔導面談紀錄 - CMS 歸檔格式】
==================================================
案主姓名：${caseName}
面談日期：${dateStr}
健康與個案診斷：${diagnostic}

--------------------------------------------------
一、 SOAP 輔導日誌紀錄
--------------------------------------------------
${soapNotes}

--------------------------------------------------
二、 ICF 全人復康評估要點
--------------------------------------------------
${icfNotes}

--------------------------------------------------
三、 AI 臨床督導評估報告
--------------------------------------------------
[技能評分]
- MI 同理心反映: ${scores.empathy || 0} 分
- MI 改變談話: ${scores.changeTalk || 0} 分
- ACT 心理彈性: ${scores.actFlexibility || 0} 分
- ICF 全人評估: ${scores.icfAccuracy || 0} 分
- 承諾行動計劃: ${scores.actionPlanning || 0} 分

[督導意見總結]
${summary}

==================================================
[系統備註] 本紀錄由 RehabCounselor AI 自動格式化導出
==================================================`;
}

/**
 * 一鍵複製社工系統格式文字至系統剪貼簿
 */
export async function copyToCMSClipboard(session) {
  const text = formatCMSReportText(session);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    AudioSynth.playSuccess();

    const toast = document.createElement("div");
    toast.className = "achievement-toast show";
    toast.innerHTML = `
      <div class="toast-badge-icon" style="color: var(--accent-cyan); border-color: var(--accent-cyan);"><i class="fa-solid fa-copy"></i></div>
      <div class="toast-content">
        <div class="toast-title" style="color: var(--accent-cyan);">已複製至剪貼簿</div>
        <div class="toast-name">社工系統格式 (CMS)</div>
        <div class="toast-desc">直接貼上至機構 CMS / 社工紀錄系統即可歸檔！</div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 600);
    }, 3500);

  } catch (err) {
    AudioSynth.playError();
    alert(`複製至剪貼簿失敗：${err.message}`);
  }
}

/**
 * 下載文字/JSON 備份檔案
 */
export function downloadFile(filename, content, mimeType = "application/json") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 讀取用戶上傳的文字/JSON 備份檔案
 */
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e.target.error);
    reader.readAsText(file);
  });
}
