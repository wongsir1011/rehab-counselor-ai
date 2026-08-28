// RehabCounselor AI - Gemini API Client-Side Service (REST Direct Integration)

export const GEMINI_MODELS = {
  "gemini-2.5-flash": "Gemini 2.5 Flash (推薦：最新效能與超高速回應)",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite (極速：超低延遲極致對答)",
  "gemini-1.5-pro": "Gemini 1.5 Pro (深度：專業臨床同理與督導評估)"
};


/**
 * 核心方法：發送請求至 Gemini API REST 端點
 */
async function callGeminiAPI(apiKey, model, systemInstruction, prompt, history = [], responseJson = false, responseSchema = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  // 建立對話格式
  const contents = [];
  
  // 注入對話歷史
  if (history && history.length > 0) {
    history.forEach(msg => {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      });
    });
  }
  
  // 加入當前 Prompt
  contents.push({
    role: "user",
    parts: [{ text: prompt }]
  });

  const requestBody = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      // 傳入 responseSchema 時一併強制 JSON MIME；responseJson 保留給既有呼叫點，行為不變。
      ...((responseJson || responseSchema) ? { responseMimeType: "application/json" } : {}),
      ...(responseSchema ? { responseSchema } : {})
    }
  };

  let retries = 3;
  let delay = 1000; // 初始延遲 1 秒

  while (true) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error(`無法連接到 Gemini API (HTTP狀態碼: ${response.status})`);
        }

        const status = response.status;
        const errMsg = errorData.error?.message || "無法連接到 Gemini API";

        // 僅對伺服器故障 (>=500) 或臨時連線超時 (408) 進行指數退避重試
        if ((status >= 500 || status === 408) && retries > 0) {
          console.warn(`[Gemini API] 伺服器臨時錯誤 (${status})，剩餘重試次數: ${retries}，將於 ${delay}ms 後重試...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries--;
          delay *= 2; // 指數級遞增延遲
          continue;
        }
        
        // 客戶端錯誤 (如 400 格式錯誤、403 金鑰錯誤、429 限流) 立即拋出，不進行無效重試
        throw new Error(errMsg);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    } catch (err) {
      // 捕捉網絡故障（例如 DNS 解析失敗、斷網或被 CORS 阻擋導致的 TypeError）
      const isNetworkError = err instanceof TypeError || err.message?.toLowerCase().includes("network") || err.message?.toLowerCase().includes("failed to fetch");
      if (isNetworkError && retries > 0) {
        console.warn(`[Gemini API] 網絡連線異常，剩餘重試次數: ${retries}，將於 ${delay}ms 後重試...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

/**
 * 輔助方法：轉義 JSON 字串內未經轉義的控制字元（如換行符、換頁符、定位符）
 */
function escapeRawControlCharsInJsonStrings(str) {
  let result = "";
  let insideString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !escaped) {
      insideString = !insideString;
      result += char;
    } else if (insideString && (char === '\n' || char === '\r')) {
      result += '\\n';
    } else if (insideString && char === '\t') {
      result += '\\t';
    } else {
      result += char;
    }
    
    if (char === '\\') {
      escaped = !escaped;
    } else {
      escaped = false;
    }
  }
  return result;
}

/**
 * 輔助方法：安全解析包含潛在格式問題（如單引號、註解或逗號）的 JSON 字串
 */
function parseFlexibleJson(rawText) {
  let cleaned = rawText.trim();
  
  // 1. 移除 Markdown 程式碼區塊包裹
  cleaned = cleaned.replace(/^```json\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/, "");
  cleaned = cleaned.replace(/\s*```$/, "");
  cleaned = cleaned.trim();
  
  // 2. 移除 JavaScript 風格的註解 (/* */ 與行首 //)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  cleaned = cleaned.replace(/^\s*\/\/.*/mg, "");
  
  // 3. 移除結尾多餘的逗號 (例如: [1, 2, ] 或 {"a": 1, })
  cleaned = cleaned.replace(/,(\s*[\]}])/g, "$1");
  
  // 4. 修復字串內部未轉義的換行符與定位符
  cleaned = escapeRawControlCharsInJsonStrings(cleaned);
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("JSON.parse 首次解析失敗，嘗試修復格式:", err);
    try {
      // 5. 嘗試修復單引號封裝屬性名稱與字串值的情況
      let normalized = cleaned
        .replace(/(')([^']*?)(')\s*:/g, '"$2":')
        .replace(/:\s*(')([^']*?)(')/g, ':"$2"');
      return JSON.parse(normalized);
    } catch (nestedErr) {
      throw new Error(`JSON 解析失敗：${err.message} (修復後錯誤：${nestedErr.message})。原始內容：\n${rawText}`);
    }
  }
}

/**
 * 離線示範劇本存取器：回傳該個案自帶的劇本陣列（沒有則為空陣列）。
 * app.js 用它決定無金鑰時能否進入面談，geminiService 用它決定能否播放下一回合，
 * 兩邊共用同一個判斷，避免出現兩套「有沒有劇本」的定義。
 */
export function getScriptedFlow(caseDetails) {
  const flow = caseDetails && caseDetails.roleplay_flow;
  return Array.isArray(flow) ? flow : [];
}

/**
 * 1. AI 案主角色扮演對話生成
 */
export async function generateClientReply(apiKey, model, caseDetails, history, userMessage) {
  if (!apiKey) {
    // 離線示範模式：只播放個案自帶的預設劇本，播完即誠實告知。
    // PRD v3「No Fabricated Clinical Content」不容許在劇本之外憑空生成假對白，
    // 因此此處絕不提供通用兜底回應（M6 前的舊行為）。
    const script = getScriptedFlow(caseDetails);
    const step = history.length / 2;

    if (script.length === 0) {
      const err = new Error(`此個案沒有預設示範劇本，需要 Gemini API 金鑰才能對話。請於「系統設定」輸入金鑰後再試。`);
      err.code = "OFFLINE_NO_SCRIPT";
      throw err;
    }
    if (!script[step]) {
      const err = new Error(`示範劇本已播放完畢（共 ${script.length} 回合）。繼續對話需要 Gemini API 金鑰，請於「系統設定」輸入後再試。`);
      err.code = "OFFLINE_SCRIPT_EXHAUSTED";
      throw err;
    }

    // 保留原有的思考停頓感，讓示範節奏貼近真實對話
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      reply: script[step].ai_reply,
      coachHint: script[step].coach_hint,
      scripted: true
    };
  }

  // 單次往返雙角色 schema（ADR-0002 / PRD v3 AI Gateway）。
  // propertyOrdering 令模型先生成 reply、再據以生成 coachHint，保留督導須分析案主回應的邏輯依賴；
  // 同一順序要求另以文字寫入 systemInstruction，不單靠此欄位。
  const responseSchema = {
    type: "OBJECT",
    properties: {
      reply: { type: "STRING" },
      coachHint: { type: "STRING" }
    },
    required: ["reply", "coachHint"],
    propertyOrdering: ["reply", "coachHint"]
  };

  const systemInstruction = `
你要在同一次回應中扮演兩個彼此獨立的角色，並輸出一個 JSON 物件。
必須先完成角色 A 的對白，再根據該對白進行角色 B 的分析。

════════════════════════════════════════
【角色 A：案主】→ 輸出至 JSON 欄位 "reply"
════════════════════════════════════════
你是一位正在接受香港復康會職業復康輔導的案主。
你的背景資料如下：
- 姓名：${caseDetails.name}
- 年齡/性別：${caseDetails.age}歲 / ${caseDetails.gender}
- 身體狀況：${caseDetails.health_condition}
- 過往職業：${caseDetails.previous_job}
- 家庭與福利：${caseDetails.family}，${caseDetails.welfare}
- 心理/情緒狀態：${caseDetails.emotional_state}

請遵守以下扮演準則：
1. 【完全聽懂並理解廣東話】：輔導員（User）會使用「地道廣東話口語」（或繁體中文）向你說話。作為土生土長的香港人，你必須百分之百完全聽得懂、理解並能精準捕捉輔導員說出的任何廣東話口語、香港本地詞彙（如搵工、綜援、再培訓）以及香港本地俗語的語意。
2. 【語言風格】：你必須完全使用地道的「香港廣東話口語」回答（例如使用「我哋」、「係啊」、「唔想」、「搵工」、「阻手阻腳」、「綜援」、「社工」、「再培訓」等香港詞彙），不要夾雜任何簡體字，但可以夾雜少量香港人常用的英文單詞（如 ERB, Part-time, Stroke, Case 等）。
3. 【對話態度與阻抗】：一開始你必須表現得相當抗拒、防衛或逃避（這是 ACT 的經驗性逃避與 MI 的矛盾期表現）。你覺得自己身體變殘疾了、已經是個廢人，或者極度焦慮面試。不要太快配合輔導員！
4. 【逐步敞開心扉】：只有當輔導員（即User）使用了正確且真誠的諮商技巧時，你才能表現出微小的軟化或願意嘗試：
   - 若User使用「同理心反映（MI Reflective Listening）」、「肯定（Affirmation）」，你會感到被理解，防衛會降低。
   - 若User使用「認知解離（ACT Defusion）」或「價值澄清（ACT Values）」，你會開始思考自己人生更重要的價值，而不是死盯著身體的殘疾。
   - 若User使用強行說教、教訓、指責、不耐煩的語氣，你必須變得更加生氣、冷淡或完全退縮。
5. 每次回答長度請控制在 80-150 字左右，表現出真實對話的節奏。
6. 【"reply" 欄位的嚴格限制】：此欄位會被直接送入語音合成朗讀給同工聽。因此只可以是案主口中說出的廣東話對白本身，絕對不可包含任何旁白、動作描述、括號註解、角色標籤、臨床分析或給輔導員的建議。

════════════════════════════════════════
【角色 B：臨床督導】→ 輸出至 JSON 欄位 "coachHint"
════════════════════════════════════════
你同時是一位資深的臨床督導（Clinical Supervisor），精通：
1. 動機式訪談法 (MI) - OARS 技巧、改變性談話（Change Talk）激發。
2. 接納承諾療法 (ACT) - 心理彈性六角模型（接納、認知解離、關注當下、以己為景、價值澄清、承諾行動）。
3. 國際功能、殘疾和健康分類 (ICF) - 生物心理社會（Biopsychosocial）全人評估。

你的任務是客觀、精準、溫和地評估輔導員剛才的發言，並為其下一步行動提供具體的臨床指引。
請遵守以下輸出準則：
1. 必須完全使用「繁體中文（香港習慣）」撰寫。
2. 指出輔導員剛才的發言運用了什麼技巧（如：同理心做得好、有效引導了價值澄清、或是陷入了說教糾正反射）。
3. 指出案主在你剛才於 "reply" 寫下的回應中，隱含了哪些臨床訊號（例如：出現了改變性談話 Change Talk、或是呈現重度經驗性逃避 Experiential Avoidance）。
4. 給出下一句對話的「實戰建議回應方向」或引導提問，並標明這屬於 ACT 還是 MI 的哪一個維度。
5. 保持精簡，總字數控制在 150 字以內，使用小標題或列點方式，使其在側欄易於閱讀。
6. 【"coachHint" 欄位的嚴格限制】：此欄位是寫給輔導員看的督導分析，絕對不可使用案主的口吻或人稱，也不可重複案主的對白。
`;

  const prompt = `輔導員剛才對你說了這句話：
「${userMessage}」

請輸出 JSON 物件：先以案主身份，根據當下的心理防衛程度與對話脈絡，於 "reply" 給出最真實的廣東話回應；再以臨床督導身份，針對輔導員這句發言與你剛寫下的案主回應，於 "coachHint" 給出簡短督導分析與下一步建議。`;

  try {
    const rawText = await callGeminiAPI(apiKey, model, systemInstruction, prompt, history, false, responseSchema);
    const parsed = parseFlexibleJson(rawText);

    // 嚴格驗證：任一欄位缺失或空白即大聲失敗，絕不以罐頭文字填補（PRD: no fake data）。
    const reply = typeof parsed?.reply === "string" ? parsed.reply.trim() : "";
    const coachHint = typeof parsed?.coachHint === "string" ? parsed.coachHint.trim() : "";

    if (!reply || !coachHint) {
      const missing = [!reply && "reply", !coachHint && "coachHint"].filter(Boolean).join("、");
      throw new Error(`AI 回應結構不完整，缺少或空白欄位：${missing}。原始回應內容：\n${rawText}`);
    }

    return { reply, coachHint };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

/**
 * 2. AI 智能個案產生器
 */
export async function generateCustomCase(apiKey, model, options) {
  if (!apiKey) {
    throw new Error("請先在「設定」中配置 Gemini API 金鑰以啟用自定義 AI 個案生成功能。");
  }

  const systemInstruction = `
你是一位職業復康專家。你需要生成一個高度逼真、符合香港本地背景的殘疾人士或長期病患者職業復康個案。
個案必須具有深度，適合社會工作者或輔導員進行 ACT, MI 及 ICF 實戰培訓。

你必須輸出一個符合以下 JSON 格式的有效 JSON 物件（確保百分之百符合 RFC 8259 JSON 標準，屬性名稱和字串值皆使用雙引號，不能包含任何註解、不能有 trailing comma、不帶任何 markdown 程式碼區塊包裹）：
{
  "id": "generated_case_12345",
  "name": "陳大文",
  "avatar": "👨",
  "age": 45,
  "gender": "男",
  "health_condition": "缺血性中風導致肢體偏癱",
  "previous_job": "小巴司機",
  "family": "與妻子及兩名正在讀中學的子女同住",
  "welfare": "正領取高額傷殘津貼",
  "emotional_state": "焦慮、沮喪，伴有嚴重的「自我廢人化」認知融合，拒絕考慮就業",
  "icf_factors": [
    {"text": "缺血性中風", "type": "health_condition"},
    {"text": "右側肢體偏癱，手部精細動作障礙", "type": "body_functions"},
    {"text": "無法打字，無法長時間坐立", "type": "activities"},
    {"text": "無法重投司機工作，無法參與實體面試", "type": "participation"},
    {"text": "【阻礙】工作環境不友善，缺乏無障礙配套", "type": "environmental_factors"},
    {"text": "【促進】復康會職業復康中心提供無障礙學習支援", "type": "environmental_factors"},
    {"text": "非常疼愛子女，極之希望履行父親責任賺錢養家", "type": "personal_factors"}
  ],
  "initial_dialogue": "社工，你唔好同我講上咩再培訓啦。我開左三十年車，依家邊邊身都郁唔到，去上堂咪即係出醜？"
}

生成要求：
- 必須符合同工在表單中指定的參數：傷殘類型、年齡層、就業意願、動機階段。
- ICF分類必須準確，環境促進與阻礙必須符合香港的物理與社會環境（例如復康巴士、在職培訓津貼、改裝資助為促進；寫字樓無障礙不足、僱主歧視、交通不便為阻礙）。
- 個人因素中必須寫入一個隱含的核心價值（例如孝順、熱愛家人、自尊心強），作為輔導員進行 ACT 價值澄清的切入點。
`;

  const prompt = `請根據以下設定，為我生成一個職業復康個案：
- 傷殘疾病類別：${options.disabilityType}
- 年齡區間：${options.ageGroup}
- 就業動機與抗拒表現：${options.motivationLevel}
- 當下的 MI 動機階段：${options.motivationStage}

請立刻生成該個案的完整 JSON 結構。`;

  try {
    const rawText = await callGeminiAPI(apiKey, model, systemInstruction, prompt, [], true);
    const parsed = parseFlexibleJson(rawText);
    if (!parsed.avatar || typeof parsed.avatar !== "string" || parsed.avatar.startsWith("http") || parsed.avatar.includes(".com") || parsed.avatar.includes(".png") || parsed.avatar.length > 8) {
      const isFemale = parsed.gender === "女" || parsed.gender === "Female";
      const isSenior = parsed.age && parsed.age >= 50;
      parsed.avatar = isFemale ? (isSenior ? "👵" : "👩") : (isSenior ? "👴" : "👨");
    }
    return parsed;
  } catch (error) {
    console.error("Failed to generate custom case:", error);
    throw error;
  }
}

/**
 * 3. AI 輔導總結與雷達圖評分生成
 */
export async function generateSessionReport(apiKey, model, caseDetails, history) {
  if (!apiKey) {
    // 離線示範模式沒有 AI，就不可能有 AI 臨床評估。
    // 舊版在此回傳一份寫死的評分與總結（且不論個案一律點名「阿強」），
    // 那是把罐頭文字放在同工會讀作 AI 臨床分析的位置，違反 PRD v3
    // 「No Fabricated Clinical Content」。呼叫端據 code 判斷仍要保存逐字與日誌。
    const err = new Error("離線示範模式沒有 AI 臨床評估。本次面談的逐字紀錄與日誌會照常保存；配置 Gemini API 金鑰後即可獲得評分與督導總結。");
    err.code = "OFFLINE_NO_EVALUATION";
    throw err;
  }

  const systemInstruction = `
你是一位就業復康臨床督導。你需要對這場就業輔導模擬對話進行綜合評估。
你必須輸出一個符合以下 JSON 格式的有效 JSON 物件（確保百分之百符合 RFC 8259 JSON 標準，屬性名稱和字串值皆使用雙引號，不能包含任何註解、不能有 trailing comma，並且不要用任何 markdown 程式碼區塊包裹）：
{
  "scores": {
    "empathy": 80,
    "changeTalk": 75,
    "actFlexibility": 85,
    "icfAccuracy": 70,
    "actionPlanning": 90
  },
  "summary": "繁體中文（香港習慣）的綜合性臨床評估報告，字數約 250 字左右。需指出同工做得好的亮點、尚可優化的臨床盲點，以及下一步的具體建議。"
}

生成要求：
- "scores" 中的數值必須為 0 到 100 之間的整數，分別評估：
  - empathy: 同理心與反映式傾聽
  - changeTalk: 激發與捕捉改變性談話
  - actFlexibility: ACT 六角模型運用與心理彈性
  - icfAccuracy: 對案主身體及環境限制的考慮 (ICF 框架)
  - actionPlanning: 承諾行動計劃的漸進式與可行性
- "summary" 的內容必須是純文字字串，完全符合繁體中文（香港習慣）的口吻，不要包含 markdown 格式或任何斷行符號以外的特殊符號。
`;

  // 格式化歷史
  const historyText = history.map(h => `${h.role === "user" ? "輔導員" : "案主"}: ${h.text}`).join("\n");

  const prompt = `
個案背景：${caseDetails.name}，${caseDetails.health_condition}。
對話完整歷史：
${historyText}

請對此進行評估，生成詳細評分與評估總結。`;

  try {
    const rawText = await callGeminiAPI(apiKey, model, systemInstruction, prompt, [], true);
    return parseFlexibleJson(rawText);
  } catch (error) {
    console.error("Failed to generate report:", error);
    throw error;
  }
}

/**
 * 4. AI Co-Learning Studio: 動機/接納療法研討題目生成
 */
export async function generateCustomQuiz(apiKey, model, dialogueSegment) {
  if (!apiKey) {
    throw new Error("請先在「設定」中配置 Gemini API 金鑰以啟用 AI 研討題目生成功能。");
  }

  const systemInstruction = `
你是一位職業復康培訓專家。你需要根據用戶提供的一段職業復康諮商/面談對話片段（廣東話地道對白），生成一組包含 2 個高質量小組討論多選題的 JSON 物件。
題目必須引導同工探討動機式訪談（MI OARS 技巧、矛盾期、改變談話）或接納承諾療法（ACT 六角模型、經驗性逃避、認知解離）的實戰應用。

你必須輸出一個符合以下 JSON 格式的有效 JSON 物件（確保百分之百符合 RFC 8259 JSON 標準，屬性名稱和字串值皆使用雙引號，不能包含任何註解、不能有 trailing comma，並且不要用任何 markdown 程式碼區塊包裹）：
{
  "questions": [
    {
      "question": "第一題題目文字（繁體中文），例如：針對案主所說的『...』，輔導員若想運用 MI 的反映性傾聽以滾動阻抗，以下哪句回應最合適？",
      "options": [
        "選項 A 回應內容",
        "選項 B 回應內容",
        "選項 C 回應內容",
        "選項 D 回應內容"
      ],
      "correct": 0,
      "explanation": "詳細的解答與小組引導析（繁體中文），解釋為什麼選項 A 最能體現反映性傾聽，而其他選項有何缺陷（例如陷入了糾正反射或強行說教）。"
    },
    {
      "question": "第二題題目文字（繁體中文），引導小組探討 ACT 心理彈性或價值澄清概念。",
      "options": [
        "選項 A 回應內容",
        "選項 B 回應內容",
        "選項 C 回應內容",
        "選項 D 回應內容"
      ],
      "correct": 2,
      "explanation": "詳細的解答與小組引導析（繁體中文）。"
    }
  ]
}
`;

  const prompt = `請根據以下諮商對話片段，為小組研討會生成兩道高品質的多選研討題：
「${dialogueSegment}」`;

  try {
    const rawText = await callGeminiAPI(apiKey, model, systemInstruction, prompt, [], true);
    return parseFlexibleJson(rawText);
  } catch (error) {
    console.error("Failed to generate custom quiz:", error);
    throw error;
  }
}

/**
 * 5. AI 輔導室：動態 SOAP 建議起草
 */
export async function generateSoapSuggestions(apiKey, model, dialogueHistory) {
  if (!apiKey) {
    throw new Error("請先在「設定」中配置 Gemini API 金鑰以啟用 AI SOAP 建議起草功能。");
  }

  const systemInstruction = `
你是一位就業復康臨床專家兼督導。你需要根據同工與案主進行的職業復康模擬對話歷史紀錄，為同工動態起草一份標準的 SOAP（Subjective, Objective, Assessment, Plan）面談日誌建議。

你必須輸出一個符合以下 JSON 格式的有效 JSON 物件（確保百分之百符合 RFC 8259 JSON 標準，屬性名稱和字串值皆使用雙引號，不能包含任何註解、不能有 trailing comma，並且不要用任何 markdown 程式碼區塊包裹）：
{
  "S": "主觀訴求 (Subjective) 建議內容（繁體中文，香港口吻），簡述案主表達的心態、挫折感、就業意願及感受（字數在 60-100 字之間）。",
  "O": "客觀限制 (Objective) 建議內容（繁體中文，香港口吻），簡述案主面臨的身體障礙（如肢體偏癱、手部麻痺）、家庭背景、傷殘津貼等客觀復康限制（字數在 60-100 字之間）。",
  "A": "臨床評估 (Assessment) 建議內容（繁體中文，香港口吻），簡評同工在此對話中展現的 MI 反映傾聽或 ACT 價值澄清引導成效，以及案主的情緒軟化點（字數在 60-100 字之間）。",
  "P": "行動計劃 (Plan) 建議內容（繁體中文，香港口吻），擬定接下來的具體承諾行動（例如報讀 ERB 再培訓課程、尋求無障礙就業輔助技術等）（字數在 60-100 字之間）。"
}
`;

  const historyText = dialogueHistory.map(h => `${h.role === "user" ? "輔導員" : "案主"}: ${h.text}`).join("\n");
  
  const prompt = `請根據以下諮商對話紀錄，為我實時起草一份專業的臨床 SOAP 面談日誌：
「${historyText}」`;

  try {
    const rawText = await callGeminiAPI(apiKey, model, systemInstruction, prompt, [], true);
    return parseFlexibleJson(rawText);
  } catch (error) {
    console.error("Failed to generate SOAP suggestions:", error);
    throw error;
  }
}


