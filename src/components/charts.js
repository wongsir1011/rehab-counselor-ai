// RehabCounselor AI - Canvas & SVG Chart Renderer Module

import { state } from "../core/state.js";

/**
 * 生成縱向能力成長趨勢圖 SVG HTML
 */
export function generateLongitudinalChartHTML(historySessions) {
  let dataPoints = [];
  let isSimulated = false;
  
  if (historySessions.length < 2) {
    isSimulated = true;
    if (state.locale === "en") {
      dataPoints = [
        { label: "Baseline", avg: 65, empathy: 60, act: 58 },
        { label: "Sim-1", avg: 72, empathy: 70, act: 68 },
        { label: "Sim-2", avg: 85, empathy: 82, act: 80 }
      ];
    } else if (state.locale === "zh-CN") {
      dataPoints = [
        { label: "起步水平", avg: 65, empathy: 60, act: 58 },
        { label: "模拟会话一", avg: 72, empathy: 70, act: 68 },
        { label: "模拟会话二", avg: 85, empathy: 82, act: 80 }
      ];
    } else {
      dataPoints = [
        { label: "起步水平", avg: 65, empathy: 60, act: 58 },
        { label: "模擬會話一", avg: 72, empathy: 70, act: 68 },
        { label: "模擬會話二", avg: 85, empathy: 82, act: 80 }
      ];
    }
  } else {
    dataPoints = historySessions.map((session, index) => {
      const s = session.report.scores;
      const avg = Math.round((s.empathy + s.changeTalk + s.actFlexibility + s.icfAccuracy + s.actionPlanning) / 5);
      return {
        label: session.caseName.split(" ")[0] || (state.locale === "en" ? `Session ${index + 1}` : `會話 ${index + 1}`),
        avg: avg,
        empathy: s.empathy,
        act: s.actFlexibility
      };
    });
  }

  const width = 800;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const pointsCount = dataPoints.length;
  const getX = (index) => paddingLeft + (index / (pointsCount - 1)) * chartWidth;
  const getY = (score) => paddingTop + chartHeight - (score / 100) * chartHeight;
  
  let avgPoints = [];
  let empathyPoints = [];
  let actPoints = [];
  
  for (let i = 0; i < pointsCount; i++) {
    const x = getX(i);
    avgPoints.push(`${x},${getY(dataPoints[i].avg)}`);
    empathyPoints.push(`${x},${getY(dataPoints[i].empathy)}`);
    actPoints.push(`${x},${getY(dataPoints[i].act)}`);
  }
  
  const avgPath = `M ${avgPoints.join(" L ")}`;
  const empathyPath = `M ${empathyPoints.join(" L ")}`;
  const actPath = `M ${actPoints.join(" L ")}`;
  const avgAreaPath = `${avgPath} L ${getX(pointsCount - 1)},${getY(0)} L ${getX(0)},${getY(0)} Z`;

  let gridLines = "";
  let xLabels = "";
  for (let i = 0; i < pointsCount; i++) {
    const x = getX(i);
    gridLines += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3,3" />`;
    xLabels += `<text x="${x}" y="${height - 15}" fill="var(--text-muted)" font-size="10" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="600">${dataPoints[i].label}</text>`;
  }

  let horizontalGrids = "";
  let yLabels = "";
  for (let s = 0; s <= 100; s += 20) {
    const y = getY(s);
    horizontalGrids += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(255,255,255,0.05)" />`;
    yLabels += `<text x="${paddingLeft - 10}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end" font-family="'Outfit', sans-serif" font-weight="600">${s}</text>`;
  }

  let pointsElements = "";
  for (let i = 0; i < pointsCount; i++) {
    const x = getX(i);
    const yAvg = getY(dataPoints[i].avg);
    const yEmp = getY(dataPoints[i].empathy);
    const yAct = getY(dataPoints[i].act);
    
    pointsElements += `
      <g class="chart-point-group">
        <circle cx="${x}" cy="${yAvg}" r="6" fill="#100c12" stroke="var(--accent-cyan)" stroke-width="2" />
        <circle cx="${x}" cy="${yAvg}" r="3" fill="var(--accent-cyan)" />
        <title>${state.locale === "en" ? "Average Score" : "平均得分"}: ${dataPoints[i].avg}分</title>
      </g>
      <g class="chart-point-group">
        <circle cx="${x}" cy="${yEmp}" r="4" fill="#100c12" stroke="var(--accent-amber)" stroke-width="1.5" />
        <circle cx="${x}" cy="${yEmp}" r="2" fill="var(--accent-amber)" />
      </g>
      <g class="chart-point-group">
        <circle cx="${x}" cy="${yAct}" r="4" fill="#100c12" stroke="var(--accent-purple)" stroke-width="1.5" />
        <circle cx="${x}" cy="${yAct}" r="2" fill="var(--accent-purple)" />
      </g>
    `;
  }

  const titleText = state.locale === "en" 
    ? "Longitudinal Competence Growth Trends" 
    : state.locale === "zh-CN" 
    ? "职业复康能力纵向发展趋势图" 
    : "職業復康能力縱向發展趨勢圖";

  const simulatedText = state.locale === "en"
    ? "Simulated Baseline Guide"
    : state.locale === "zh-CN"
    ? "模拟成长对照引导线"
    : "模擬成長對照引導線";

  const avgLegend = state.locale === "en" ? "Average Score" : "綜合平均";
  const empathyLegend = state.locale === "en" ? "Empathy (MI)" : "同理傾聽 (MI)";
  const actLegend = state.locale === "en" ? "Defusion (ACT)" : "心理解離 (ACT)";

  const simulatedBadge = isSimulated ? `
    <div style="position: absolute; top: 16px; right: 16px; background: rgba(124, 58, 237, 0.15); border: 1px solid rgba(124, 58, 237, 0.3); color: var(--accent-purple); padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; display:flex; align-items:center; gap:6px;">
      <i class="fa-solid fa-graduation-cap"></i>
      <span>${simulatedText}</span>
    </div>
  ` : "";

  return `
    <div class="glass-card" style="margin-bottom: 24px; position: relative; padding: 20px; display:flex; flex-direction:column; gap:12px; overflow: hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-bright); display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-chart-line" style="color:var(--accent-cyan);"></i>
          ${titleText}
        </h3>
        
        <div style="display:flex; gap:12px; font-size:0.75rem; font-weight:600;">
          <div style="display:flex; align-items:center; gap:5px; color:var(--accent-cyan);">
            <span style="display:inline-block; width:10px; height:3px; background:var(--accent-cyan); border-radius:2px;"></span>
            <span>${avgLegend}</span>
          </div>
          <div style="display:flex; align-items:center; gap:5px; color:var(--accent-amber);">
            <span style="display:inline-block; width:10px; height:3px; background:var(--accent-amber); border-radius:2px;"></span>
            <span>${empathyLegend}</span>
          </div>
          <div style="display:flex; align-items:center; gap:5px; color:var(--accent-purple);">
            <span style="display:inline-block; width:10px; height:3px; background:var(--accent-purple); border-radius:2px;"></span>
            <span>${actLegend}</span>
          </div>
        </div>
      </div>
      
      ${simulatedBadge}

      <div style="width:100%; overflow-x:auto;">
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; min-width:600px; display:block;">
          <defs>
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.35" />
              <stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0.0" />
            </linearGradient>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          ${horizontalGrids}
          ${gridLines}
          ${yLabels}
          ${xLabels}
          
          <path d="${avgAreaPath}" fill="url(#area-grad)" stroke="none" />
          <path d="${avgPath}" fill="none" stroke="var(--accent-cyan)" stroke-width="3" filter="url(#glow-cyan)" stroke-linecap="round" stroke-linejoin="round" ${isSimulated ? 'stroke-dasharray="6,4"' : ''} />
          <path d="${empathyPath}" fill="none" stroke="var(--accent-amber)" stroke-width="2" filter="url(#glow-amber)" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" ${isSimulated ? 'stroke-dasharray="6,4"' : ''} />
          <path d="${actPath}" fill="none" stroke="var(--accent-purple)" stroke-width="2" filter="url(#glow-purple)" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" ${isSimulated ? 'stroke-dasharray="6,4"' : ''} />
          ${pointsElements}
        </svg>
      </div>
    </div>
  `;
}
