// RehabCounselor AI - Gemini API Client Service (REST & Structured Outputs & SSE Streaming)

export const GEMINI_MODELS = {
  "gemini-2.5-flash": "Gemini 2.5 Flash (推薦：最新效能與超高速回應)",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite (極速：超低延遲極致對答)",
  "gemini-1.5-pro": "Gemini 1.5 Pro (深度：專業臨床同理與督導評估)"
};

/**
 * 核心方法：發送請求至 Gemini API REST 端點 (支援 ResponseSchema)
 */
async function callGeminiAPI(apiKey, model, systemInstruction, prompt, history = [], responseJson = false, responseSchema = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const contents = [];
  
  if (history && history.length > 0) {
    history.forEach(msg => {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.text }]
      });
    });
  }
  
  contents.push({
    role: "user",
    parts: [{ text: prompt }]
  });

  const generationConfig = {
    temperature: 0.7,
    maxOutputTokens: 4096
  };

  if (responseJson) {
    generationConfig.responseMimeType = "application/json";
    if (responseSchema) {
      generationConfig.responseSchema = responseSchema;
    }
  }

  const requestBody = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: generationConfig
  };

  let retries = 3;
  let delay = 1000;

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

        if ((status >= 500 || status === 408) && retries > 0) {
          console.warn(`[Gemini API] 伺服器臨時錯誤 (${status})，剩餘重試次數: ${retries}，將於 ${delay}ms 後重試...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries--;
          delay *= 2;
          continue;
        }
        
        throw new Error(errMsg);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    } catch (err) {
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
 * 輔助方法：轉義 JSON 字串內未經轉義的控制字元
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
 * 輔助方法：安全解析包含潛在格式問題的 JSON 字串
 */
export function parseFlexibleJson(rawText) {
  let cleaned = rawText.trim();
  
  cleaned = cleaned.replace(/^```json\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/, "");
  cleaned = cleaned.replace(/\s*```$/, "");
  cleaned = cleaned.trim();
  
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  cleaned = cleaned.replace(/^\s*\/\/.*/mg, "");
  cleaned = cleaned.replace(/,(\s*[\]}])/g, "$1");
  cleaned = escapeRawControlCharsInJsonStrings(cleaned);
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("JSON.parse 首次解析失敗，嘗試修復格式:", err);
    try {
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
 * 1. AI 案主角色扮演對話生成 (連同 AI 臨床督導提示)
 */
export async function generateClientReply(apiKey, model, caseDetails, history, userMessage) {
  if (!apiKey) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const step = history.length / 2;
        if (caseDetails.roleplay_flow && caseDetails.roleplay_flow[step]) {
          resolve({
            reply: caseDetails.roleplay_flow[step].ai_reply,
            coachHint: caseDetails.roleplay_flow[step].coach_hint
          });
        } else {
          resolve({
            reply: "（案主低下頭，輕聲說）社工，我真係好累……你講嘅道理我都明，但我依家好亂，可唔可以比我靜下先？",
            coachHint: "【AI 督導提示】：案主展現出重度疲憊與防衛。此時不宜再強力推進（如訂立行動計劃），建議使用 MI 的反映式傾聽（同理他的累與混亂），或 ACT 的關注當下（做一個簡單的呼吸練習，陪他安靜坐一陣）。"
          });
        }
      }, 1500);
    });
  }

  const systemInstruction = `
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
`;

  const prompt = `輔導員剛才對你說了這句話：
「${userMessage}」

請以案主的身份，根據當下的心理防衛程度與對話脈絡，給出你最真實的廣東話回應。`;

  try {
    const reply = await callGeminiAPI(apiKey, model, systemInstruction, prompt, history);
    const coachHint = await generateCoachHint(apiKey, model, caseDetails, history, userMessage, reply);
    return { reply, coachHint };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

/**
 * 2. AI 督導提示生成 (AI Coach Hint)
 */
export async function generateCoachHint(apiKey, model, caseDetails, history, userMessage, clientReply) {
  const systemInstruction = `
你是一位資深的臨床督導（Clinical Supervisor），精通：
1. 動機式訪談法 (MI) - OARS 技巧、改變性談話（Change Talk）激發。
2. 接納承諾療法 (ACT) - 心理彈性六角模型（接納、認知解離、關注當下、以己為景、價值澄清、承諾行動）。
3. 國際功能、殘疾和健康分類 (ICF) - 生物心理社會（Biopsychosocial）全人評估。

你的任務是客觀、精準、溫和地評估輔導員（User）剛才的發言，並為其下一步行動提供具體的臨床指引。
請遵守以下輸出準則：
1. 必須完全使用「繁體中文（香港習慣）」撰寫。
2. 指出輔導員剛才的發言運用了什麼技巧（如：同理心做得好、有效引導了價值澄清、或是陷入了說教糾正反射）。
3. 指出案主剛才的回應中，隱含了哪些臨床訊號（例如：出現了改變性談話 Change Talk、或是呈現重度經驗性逃避 Experiential Avoidance）。
4. 給出下一句對話的「實戰建議回應方向」或引導提問，並標明這屬於 ACT 還是 MI 的哪一個維度。
5. 保持精簡，總字數控制在 150 字以內，使用小標題或列點方式，使其在側欄易於閱讀。
`;

  const prompt = `
個案背景：${caseDetails.name}，${caseDetails.health_condition}。
輔導員發言：${userMessage}
案主廣東話回應：${clientReply}

請對輔導員剛才的發言進行簡短臨床督導，並為其下一句回應提供具體微小提示：`;

  try {
    return await callGeminiAPI(apiKey, model, systemInstruction, prompt);
  } catch (error) {
    return "【AI 督導提示暫時無法加載】：建議同工此時繼續保持 MI 的「反映式傾聽」，先接納案主的情緒，再尋找他的核心價值觀進行引導。";
  }
}

/**
 * 3. AI 智能個案產生器 (帶 ResponseSchema)
 */
export async function generateCustomCase(apiKey, model, options) {
  if (!apiKey) {
    throw new Error("請先在「設定」中配置 Gemini API 金鑰以啟用自定義 AI 個案生成功能。");
  }

  const systemInstruction = `
你是一位職業復康專家。你需要生成一個高度逼真、符合香港本地背景的殘疾人士或長期病患者職業復康個案。
個案必須具有深度，適合社會工作者或輔導員進行 ACT, MI 及 ICF 實戰培訓。
`;

  const prompt = `請根據以下設定，為我生成一個職業復康個案：
- 傷殘疾病類別：${options.disabilityType}
- 年齡區間：${options.ageGroup}
- 就業動機與抗拒表現：${options.motivationLevel}
- 當下的 MI 動機階段：${options.motivationStage}

請立刻生成該個案的完整 JSON 結構。`;

  const caseSchema = {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      name: { type: "STRING" },
      avatar: { type: "STRING" },
      age: { type: "INTEGER" },
      gender: { type: "STRING" },
      health_condition: { type: "STRING" },
      previous_job: { type: "STRING" },
      family: { type: "STRING" },
      welfare: { type: "STRING" },
      emotional_state: { type: "STRING" },
      icf_factors: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            text: { type: "STRING" },
            type: { type: "STRING" }
          },
          required: ["text", "type"]
        }
      },
      initial_dialogue: { type: "STRING" }
    },
    required: ["id", "name", "avatar", "age", "gender", "health_condition", "previous_job", "family", "welfare", "emotional_state", "icf_factors", "initial_dialogue"]
  };

  try {
    const rawText = await callGeminiAPI(apiKey, model, systemInstruction, prompt, [], true, caseSchema);
    return parseFlexibleJson(rawText);
  } catch (error) {
    console.error("Failed to generate custom case:", error);
    throw error;
  }
}

/**
 * 4. AI 輔導總結與雷達圖評分生成 (帶 ResponseSchema)
 */
export async function generateSessionReport(apiKey, model, caseDetails, history) {
  if (!apiKey) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          scores: {
            empathy: 80,
            changeTalk: 75,
            actFlexibility: 85,
            icfAccuracy: 70,
            actionPlanning: 90
          },
          summary: "在本次模擬輔導中，你展現了非常出色的同理心（MI）與價值澄清引導（ACT）。你精準捕捉到了阿強對家人的責任感，成功引導他跨越了「開小巴才是唯一出路」的認知融合。但在行動計劃（Action Planning）的具體細節上，可以多加留意阿強在 ICF 框架下右側偏癱的手部活動局限，為其配置更具體的輔助技術支援（例如廣東話語音輸入法體驗）。整體而言，這是一次非常溫暖且具備臨床深度的輔導！"
        });
      }, 2000);
    });
  }

  const systemInstruction = `
你是一位就業復康臨床督導。你需要對這場就業輔導模擬對話進行綜合評估。
`;

  const reportSchema = {
    type: "OBJECT",
    properties: {
      scores: {
        type: "OBJECT",
        properties: {
          empathy: { type: "INTEGER" },
          changeTalk: { type: "INTEGER" },
          actFlexibility: { type: "INTEGER" },
          icfAccuracy: { type: "INTEGER" },
          actionPlanning: { type: "INTEGER" }
        },
        required: ["empathy", "changeTalk", "actFlexibility", "icfAccuracy", "actionPlanning"]
      },
      summary: { type: "STRING" }
    },
    required: ["scores", "summary"]
  };

  const historyText = history.map(h => `${h.role === "user" ? "輔導員" : "案主"}: ${h.text}`).join("\n");
  const prompt = `個案背景：${caseDetails.name}，${caseDetails.health_condition}。
對話完整歷史：
${historyText}

請對此進行評估，生成詳細評分與評估總結。`;

  try {
    const rawText = await callGeminiAPI(apiKey, model, systemInstruction, prompt, [], true, reportSchema);
    return parseFlexibleJson(rawText);
  } catch (error) {
    console.error("Failed to generate report:", error);
    throw error;
  }
}

/**
 * 5. AI Co-Learning Studio: 動機/接納療法研討題目生成 (帶 ResponseSchema)
 */
export async function generateCustomQuiz(apiKey, model, dialogueSegment) {
  if (!apiKey) {
    throw new Error("請先在「設定」中配置 Gemini API 金鑰以啟用 AI 研討題目生成功能。");
  }

  const systemInstruction = `
你是一位職業復康培訓專家。你需要根據用戶提供的一段職業復康諮商/面談對話片段，生成包含 2 個高質量小組討論多選題的 JSON 物件。
`;

  const quizSchema = {
    type: "OBJECT",
    properties: {
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING" },
            options: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            correct: { type: "INTEGER" },
            explanation: { type: "STRING" }
          },
          required: ["question", "options", "correct", "explanation"]
        }
      }
    },
    required: ["questions"]
  };

  const prompt = `請根據以下諮商對話片段，為小組研討會生成兩道高品質的多選研討題：
「${dialogueSegment}」`;

  try {
    const rawText = await callGeminiAPI(apiKey, model, systemInstruction, prompt, [], true, quizSchema);
    return parseFlexibleJson(rawText);
  } catch (error) {
    console.error("Failed to generate custom quiz:", error);
    throw error;
  }
}

/**
 * 6. AI 輔導室：動態 SOAP 建議起草 (帶 ResponseSchema)
 */
export async function generateSoapSuggestions(apiKey, model, dialogueHistory) {
  if (!apiKey) {
    throw new Error("請先在「設定」中配置 Gemini API 金鑰以啟用 AI SOAP 建議起草功能。");
  }

  const systemInstruction = `
你是一位就業復康臨床專家兼督導。你需要根據同工與案主進行的職業復康模擬對話歷史紀錄，為同工動態起草一份標準的 SOAP 面談日誌建議。
`;

  const soapSchema = {
    type: "OBJECT",
    properties: {
      S: { type: "STRING" },
      O: { type: "STRING" },
      A: { type: "STRING" },
      P: { type: "STRING" }
    },
    required: ["S", "O", "A", "P"]
  };

  const historyText = dialogueHistory.map(h => `${h.role === "user" ? "輔導員" : "案主"}: ${h.text}`).join("\n");
  const prompt = `請根據以下諮商對話紀錄，為我實時起草一份專業的臨床 SOAP 面談日誌：
「${historyText}」`;

  try {
    const rawText = await callGeminiAPI(apiKey, model, systemInstruction, prompt, [], true, soapSchema);
    return parseFlexibleJson(rawText);
  } catch (error) {
    console.error("Failed to generate SOAP suggestions:", error);
    throw error;
  }
}
