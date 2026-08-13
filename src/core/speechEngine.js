// RehabCounselor AI - Web Speech API Engine (STT, Emotional TTS & MiniMax API Integration)

import { state } from "./state.js";
import { AudioSynth } from "./audioSynth.js";

function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
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
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  clearAllSpeakingStates();
  if (state.recognition && state.isRecording) {
    try {
      state.recognition.abort();
    } catch(e) {}
    state.isRecording = false;
  }
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
  if ((state.ttsEngine === "minimax-global" || state.ttsEngine === "minimax-cn") && state.minimaxApiKey) {
    speakMiniMaxCantonese(cleanText, bubbleEl);
  } else {
    speakSystemCantonese(cleanText, bubbleEl, forcePlay);
  }
}

async function speakMiniMaxCantonese(cleanText, bubbleEl = null) {
  const isGlobal = state.ttsEngine === "minimax-global";
  const baseUrl = isGlobal 
    ? "https://api.minimaxi.chat/v1/t2a_v2" 
    : "https://api.minimax.chat/v1/t2a_v2";
  
  const url = `${baseUrl}?GroupId=${encodeURIComponent(state.minimaxGroupId || "")}`;
  
  const isFemaleCase = state.activeCase && state.activeCase.gender === "女";
  const timbre = isFemaleCase 
    ? (state.minimaxFemaleTimbre || "cantonese_female") 
    : (state.minimaxMaleTimbre || "cantonese_male");

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

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${state.minimaxApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`MiniMax API HTTP Error ${res.status}`);
    }

    const data = await res.json();
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax Error: ${data.base_resp.status_msg}`);
    }

    let audioData = null;
    if (data.data && data.data.audio) {
      audioData = data.data.audio;
    } else if (data.audio_file) {
      audioData = data.audio_file;
    }

    if (!audioData) {
      throw new Error("MiniMax API 未回傳音訊數據");
    }

    let arrayBuffer = null;
    if (typeof audioData === "string") {
      if (/^[0-9a-fA-F]+$/.test(audioData.substring(0, 100))) {
        arrayBuffer = hexToArrayBuffer(audioData);
      } else {
        arrayBuffer = base64ToArrayBuffer(audioData.replace(/^data:audio\/\w+;base64,/, ""));
      }
    }

    const blob = new Blob([arrayBuffer], { type: "audio/mp3" });
    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);
    state.activeAudioElement = audio;

    if (bubbleEl) bubbleEl.classList.add("is-speaking");
    const avatar = document.getElementById("rp-active-avatar");
    if (avatar) avatar.classList.add("speaking-pulse");

    audio.onended = () => {
      if (bubbleEl) bubbleEl.classList.remove("is-speaking");
      if (avatar) avatar.classList.remove("speaking-pulse");
      URL.revokeObjectURL(blobUrl);
      state.activeAudioElement = null;
    };

    audio.onerror = (e) => {
      console.warn("MiniMax 語音播放失敗，降級至系統 Web Speech API:", e);
      if (bubbleEl) bubbleEl.classList.remove("is-speaking");
      if (avatar) avatar.classList.remove("speaking-pulse");
      URL.revokeObjectURL(blobUrl);
      state.activeAudioElement = null;
      speakSystemCantonese(cleanText, bubbleEl, true);
    };

    await audio.play();

  } catch (err) {
    console.warn("MiniMax API 請求失敗，自動無縫降級至系統 Web Speech API:", err);
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
  
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = state.recognitionLang;

  let finalTranscript = "";

  recognition.onstart = () => {
    state.isRecording = true;
    micBtn.classList.add("recording");
    if (waveHud) waveHud.classList.add("active");
    startVoiceFFT();
    statusText.textContent = `正聆聽廣東話 (${state.recognitionLang})... 請講話`;
    AudioSynth.playClick();
  };

  recognition.onresult = (event) => {
    let interimTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    if (inputEl) {
      inputEl.value = finalTranscript || interimTranscript;
    }
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    stopRecording();
    AudioSynth.playError();
    statusText.textContent = `語音識別提示: ${event.error}`;
  };

  recognition.onend = () => {
    state.isRecording = false;
    micBtn.classList.remove("recording");
    if (waveHud) waveHud.classList.remove("active");
    stopVoiceFFT();
    statusText.textContent = `點擊麥克風即可直接講話 (${state.recognitionLang})`;
  };

  micBtn.addEventListener("click", () => {
    if (state.isRecording) {
      recognition.stop();
    } else {
      finalTranscript = "";
      recognition.lang = state.recognitionLang;
      try {
        recognition.start();
      } catch (err) {
        console.warn("Recognition start failed:", err);
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
