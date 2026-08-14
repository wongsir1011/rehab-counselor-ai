// RehabCounselor AI - Web Speech API Engine (Continuous STT, Emotional TTS & MiniMax API Integration)

import { state } from "./state.js";
import { AudioSynth } from "./audioSynth.js";

function hexToArrayBuffer(hex) {
  const len = hex.length;
  const bytes = new Uint8Array(Math.floor(len / 2));
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

function base64ToArrayBuffer(base64) {
  const clean = base64.replace(/^data:audio\/\w+;base64,/, "").trim();
  const binaryString = window.atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function initSpeechEngine(onVoicesChangedCallback = null) {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    state.voices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      state.voices = window.speechSynthesis.getVoices();
      if (typeof onVoicesChangedCallback === "function") {
        onVoicesChangedCallback();
      }
    };
  }
}

export function stopRecording() {
  state.isRecording = false;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  clearAllSpeakingStates();
  if (state.recognition) {
    try {
      state.recognition.stop();
      state.recognition.abort();
    } catch(e) {}
  }
  const micBtn = document.getElementById("rp-voice-mic-btn");
  if (micBtn) micBtn.classList.remove("recording");
  const waveHud = document.getElementById("rp-voice-wave-hud");
  if (waveHud) waveHud.classList.remove("active");
  const statusText = document.getElementById("rp-voice-status-text");
  if (statusText) statusText.textContent = `點擊麥克風即可直接講話 (${state.recognitionLang})`;
  stopVoiceFFT();
}

export function clearAllSpeakingStates() {
  document.querySelectorAll(".chat-bubble.bubble-ai.is-speaking").forEach(b => {
    b.classList.remove("is-speaking");
  });
  const avatar = document.getElementById("rp-active-avatar");
  if (avatar) {
    avatar.classList.remove("speaking-pulse");
  }
  if (state.activeAudioElement) {
    try {
      state.activeAudioElement.pause();
      state.activeAudioElement = null;
    } catch (e) {}
  }
  state.activeUtterance = null;
}

export function speakCantonese(text, bubbleEl = null, forcePlay = false) {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  clearAllSpeakingStates();
  
  if (state.isSpeechMuted && !forcePlay) {
    return;
  }
  
  const cleanText = text.replace(/【.*】/g, "").trim();

  // 若使用者選擇 MiniMax 廣東話語音引擎且填寫了 API Key
  if (state.ttsEngine === "minimax-global" || state.ttsEngine === "minimax-cn") {
    if (state.minimaxApiKey && state.minimaxApiKey.trim() !== "") {
      speakMiniMaxCantonese(cleanText, bubbleEl);
    } else {
      showTTSToast("MiniMax API Key 未設定，已切換為系統原生語音。");
      speakSystemCantonese(cleanText, bubbleEl, forcePlay);
    }
  } else {
    speakSystemCantonese(cleanText, bubbleEl, forcePlay);
  }
}

function showTTSToast(msg, isError = false) {
  const toast = document.createElement("div");
  toast.className = "achievement-toast show";
  toast.innerHTML = `
    <div class="toast-badge-icon" style="color: ${isError ? 'var(--accent-red)' : 'var(--accent-cyan)'}; border-color: ${isError ? 'var(--accent-red)' : 'var(--accent-cyan)'};">
      <i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-volume-high'}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title" style="color: ${isError ? 'var(--accent-red)' : 'var(--accent-cyan)'};">語音提示</div>
      <div class="toast-name">MiniMax TTS 引擎</div>
      <div class="toast-desc">${msg}</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 600);
  }, 4000);
}

/**
 * 調用 MiniMax T2A REST API 生成廣東話音訊
 */
export async function generateMiniMaxAudio(cleanText, customTimbre = null) {
  const isGlobal = state.ttsEngine === "minimax-global";
  const baseUrl = isGlobal 
    ? "https://api.minimaxi.chat/v1/t2a_v2" 
    : "https://api.minimax.chat/v1/t2a_v2";
  
  const groupIdParam = state.minimaxGroupId && state.minimaxGroupId.trim() !== ""
    ? `?GroupId=${encodeURIComponent(state.minimaxGroupId.trim())}`
    : "";
  const url = `${baseUrl}${groupIdParam}`;
  
  const isFemaleCase = state.activeCase && state.activeCase.gender === "女";
  const defaultTimbre = isFemaleCase 
    ? (state.minimaxFemaleTimbre || "cantonese_female") 
    : (state.minimaxMaleTimbre || "cantonese_male");
  const timbre = customTimbre || defaultTimbre;

  const apiKey = (state.minimaxApiKey || "").trim();
  if (!apiKey) {
    throw new Error("請先在系統設定中填寫 MiniMax API Key");
  }

  const body = {
    model: "speech-01-hd",
    text: cleanText,
    stream: false,
    voice_setting: {
      voice_id: timbre,
      speed: 1.0,
      vol: 1.0,
      pitch: 0
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: "mp3",
      channel: 1
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.base_resp) {
        errorDetail = `${errJson.base_resp.status_msg} (${errJson.base_resp.status_code})`;
      }
    } catch(e) {}
    throw new Error(`MiniMax 連線失敗: ${errorDetail}`);
  }

  const data = await res.json();
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax 錯誤: ${data.base_resp.status_msg} (狀態碼: ${data.base_resp.status_code})`);
  }

  let audioData = null;
  if (data.data && data.data.audio) {
    audioData = data.data.audio;
  } else if (data.audio_file) {
    audioData = data.audio_file;
  }

  if (!audioData) {
    throw new Error("MiniMax API 回傳成功但未包含音訊數據");
  }

  if (typeof audioData === "string" && (audioData.startsWith("http://") || audioData.startsWith("https://"))) {
    return audioData; // Direct URL
  }

  let arrayBuffer = null;
  if (typeof audioData === "string") {
    if (/^[0-9a-fA-F]+$/.test(audioData.substring(0, 100))) {
      arrayBuffer = hexToArrayBuffer(audioData);
    } else {
      arrayBuffer = base64ToArrayBuffer(audioData);
    }
  }

  const blob = new Blob([arrayBuffer], { type: "audio/mp3" });
  return URL.createObjectURL(blob);
}

async function speakMiniMaxCantonese(cleanText, bubbleEl = null) {
  try {
    const audioUrl = await generateMiniMaxAudio(cleanText);
    const audio = new Audio(audioUrl);
    state.activeAudioElement = audio;

    if (bubbleEl) bubbleEl.classList.add("is-speaking");
    const avatar = document.getElementById("rp-active-avatar");
    if (avatar) avatar.classList.add("speaking-pulse");

    audio.onended = () => {
      if (bubbleEl) bubbleEl.classList.remove("is-speaking");
      if (avatar) avatar.classList.remove("speaking-pulse");
      if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
      state.activeAudioElement = null;
    };

    audio.onerror = (e) => {
      console.warn("MiniMax 音訊播放失敗，降級至系統語音:", e);
      if (bubbleEl) bubbleEl.classList.remove("is-speaking");
      if (avatar) avatar.classList.remove("speaking-pulse");
      if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
      state.activeAudioElement = null;
      speakSystemCantonese(cleanText, bubbleEl, true);
    };

    await audio.play();

  } catch (err) {
    console.warn("MiniMax TTS 調用失敗，自動無縫降級至系統 Web Speech API:", err);
    showTTSToast(`MiniMax 連線異常（${err.message}），已自動使用系統語音播放。`, true);
    speakSystemCantonese(cleanText, bubbleEl, true);
  }
}

export function speakSystemCantonese(cleanText, bubbleEl = null, forcePlay = false) {
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "zh-HK";

  if (state.speechUtteranceRefs) {
    state.speechUtteranceRefs.add(utterance);
    if (state.speechUtteranceRefs.size > 5) {
      const oldestUtterance = state.speechUtteranceRefs.values().next().value;
      state.speechUtteranceRefs.delete(oldestUtterance);
    }
  }

  const isFemaleCase = state.activeCase && state.activeCase.gender === "女";
  const isMaleCase = state.activeCase && state.activeCase.gender === "男";

  let selectedVoice = null;
  const hkVoices = state.voices.filter(v => 
    v.lang === "zh-HK" || 
    v.lang === "zh-Hant-HK" || 
    v.lang.toLowerCase().replace(/_/g, "-").startsWith("zh-hk") ||
    v.name.toLowerCase().includes("hong kong") ||
    v.name.toLowerCase().includes("cantonese") ||
    v.name.toLowerCase().includes("sin-ji")
  );

  if (isMaleCase) {
    const maleKeywords = ["danny", "wanlung", "limu", "male", "kangkang", "man", "boy", "yunlin", "kwan"];
    selectedVoice = hkVoices.find(v => maleKeywords.some(kw => v.name.toLowerCase().includes(kw)));
  } else if (isFemaleCase) {
    const femaleKeywords = ["sin-ji", "tracy", "hiumaan", "ting-ting", "yu-ting", "female", "szemin", "sinji", "hiuga"];
    selectedVoice = hkVoices.find(v => femaleKeywords.some(kw => v.name.toLowerCase().includes(kw)));
  }

  if (!selectedVoice && state.selectedVoiceName) {
    selectedVoice = state.voices.find(v => v.name === state.selectedVoiceName);
  }
  if (!selectedVoice && hkVoices.length > 0) {
    selectedVoice = hkVoices[0];
  }
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  let rate = 1.05;
  let pitch = 1.0;
  
  if (state.activeCase) {
    const emotion = (state.activeCase.emotional_state || "").toLowerCase();
    const isAnxious = emotion.includes("抗拒") || emotion.includes("焦慮") || emotion.includes("憤怒");
    const isDepressed = emotion.includes("沮喪") || emotion.includes("低落") || emotion.includes("無力") || emotion.includes("悲觀");
    
    if (isAnxious) {
      rate = 1.15;
      pitch = 1.06;
    } else if (isDepressed) {
      rate = 0.90;
      pitch = 0.92;
    }
  }

  // ⚠️ 男個案音高校正：若無系統原生男聲 (如 macOS 預設 Sin-Ji)，強行降調至 0.76，營造沉穩男聲效果
  if (isMaleCase) {
    const voiceName = (utterance.voice ? utterance.voice.name : "").toLowerCase();
    const isExplicitMale = ["danny", "wanlung", "limu", "male", "kangkang", "man", "boy", "yunlin", "kwan"].some(kw => voiceName.includes(kw));
    if (!isExplicitMale) {
      pitch *= 0.76;
    }
  } else if (isFemaleCase) {
    pitch *= 1.05;
  }
  
  utterance.rate = rate;
  utterance.pitch = Math.max(0.5, Math.min(2.0, pitch));
  state.activeUtterance = utterance;

  utterance.onstart = () => {
    if (state.activeUtterance !== utterance) return;
    if (bubbleEl) {
      bubbleEl.classList.add("is-speaking");
    }
    const avatar = document.getElementById("rp-active-avatar");
    if (avatar) {
      avatar.classList.add("speaking-pulse");
    }
  };

  const cleanup = () => {
    if (state.speechUtteranceRefs) {
      state.speechUtteranceRefs.delete(utterance);
    }
    if (state.activeUtterance === utterance) {
      if (bubbleEl) {
        bubbleEl.classList.remove("is-speaking");
      }
      const avatar = document.getElementById("rp-active-avatar");
      if (avatar) {
        avatar.classList.remove("speaking-pulse");
      }
      state.activeUtterance = null;
    }
  };

  utterance.onend = cleanup;
  utterance.onerror = cleanup;

  if (cleanText.includes("…") || cleanText.includes("...") || Math.random() < 0.25) {
    AudioSynth.playSigh();
    setTimeout(() => {
      if (state.activeUtterance === utterance) {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.speak(utterance);
        }
      }
    }, 280);
    return;
  }

  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.speak(utterance);
  }
}

/**
 * 語音辨識持續聆聽引擎 (Continuous Voice Recognition)
 */
export function initVoiceRecognition(inputEl) {
  const micBtn = document.getElementById("rp-voice-mic-btn");
  const waveHud = document.getElementById("rp-voice-wave-hud");
  const statusText = document.getElementById("rp-voice-status-text");

  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = "none";
    statusText.textContent = "您的瀏覽器不支援廣東話語音識別，請使用文字輸入。";
    return;
  }

  const recognition = new SpeechRecognition();
  state.recognition = recognition;
  
  // 設置持續聆聽，允許同工在說話間停頓思考數秒而不自動中斷
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = state.recognitionLang;

  let confirmedText = "";

  recognition.onstart = () => {
    state.isRecording = true;
    micBtn.classList.add("recording");
    if (waveHud) waveHud.classList.add("active");
    startVoiceFFT();
    statusText.textContent = `正持續聆聽廣東話 (${state.recognitionLang})... 請自然說話`;
    AudioSynth.playClick();
  };

  recognition.onresult = (event) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = 0; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    confirmedText = finalTranscript;
    if (inputEl) {
      inputEl.value = `${confirmedText}${interimTranscript}`.trim();
    }
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    if (event.error === "no-speech") {
      // 停頓時產生的 no-speech 事件，若仍處於錄音狀態則保持監聽，不自動強制退出
      return;
    }
    if (event.error === "aborted") {
      return;
    }
    stopRecording();
    AudioSynth.playError();
    statusText.textContent = `語音識別提示: ${event.error}`;
  };

  recognition.onend = () => {
    // 若使用者未點擊停止或發送，瀏覽器因超時自然結束時，自動平滑重啟，確保持續聆聽
    if (state.isRecording) {
      try {
        recognition.lang = state.recognitionLang;
        recognition.start();
      } catch (err) {
        // 重啟失敗才正式關閉
        state.isRecording = false;
        micBtn.classList.remove("recording");
        if (waveHud) waveHud.classList.remove("active");
        stopVoiceFFT();
        statusText.textContent = `點擊麥克風即可直接講話 (${state.recognitionLang})`;
      }
    } else {
      micBtn.classList.remove("recording");
      if (waveHud) waveHud.classList.remove("active");
      stopVoiceFFT();
      statusText.textContent = `點擊麥克風即可直接講話 (${state.recognitionLang})`;
    }
  };

  micBtn.addEventListener("click", () => {
    if (state.isRecording) {
      stopRecording();
    } else {
      confirmedText = inputEl ? inputEl.value.trim() : "";
      recognition.lang = state.recognitionLang;
      try {
        recognition.start();
      } catch (err) {
        console.warn("Recognition start error:", err);
      }
    }
  });
}

let audioContext = null;
let analyser = null;
let microphone = null;
let animationFrameId = null;

export function startVoiceFFT() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 64;
    microphone.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const bars = document.querySelectorAll(".wave-bar");

    function drawFFT() {
      if (!state.isRecording) return;
      animationFrameId = requestAnimationFrame(drawFFT);
      analyser.getByteFrequencyData(dataArray);

      bars.forEach((bar, index) => {
        const val = dataArray[index % bufferLength] || 0;
        const scale = Math.max(0.15, val / 255);
        bar.style.transform = `scaleY(${scale * 2.5})`;
      });
    }

    drawFFT();
  }).catch(err => {
    console.warn("Microphone FFT Access Denied or Unavailable:", err);
  });
}

export function stopVoiceFFT() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (microphone && microphone.mediaStream) {
    microphone.mediaStream.getTracks().forEach(track => track.stop());
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  document.querySelectorAll(".wave-bar").forEach(bar => {
    bar.style.transform = "scaleY(0.2)";
  });
}
