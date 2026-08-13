// RehabCounselor AI - Web Speech API Engine (STT & Emotional TTS)

import { state } from "./state.js";
import { AudioSynth } from "./audioSynth.js";

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
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "zh-HK";

  if (state.speechUtteranceRefs) {
    state.speechUtteranceRefs.add(utterance);
    if (state.speechUtteranceRefs.size > 5) {
      const oldestUtterance = state.speechUtteranceRefs.values().next().value;
      state.speechUtteranceRefs.delete(oldestUtterance);
    }
  }
  
  if (state.selectedVoiceName && state.selectedVoiceName !== "") {
    const matched = state.voices.find(v => v.name === state.selectedVoiceName);
    if (matched) utterance.voice = matched;
  } else {
    const hkVoices = state.voices.filter(v => 
      v.lang === "zh-HK" || 
      v.lang === "zh-Hant-HK" || 
      v.lang.toLowerCase().replace(/_/g, "-").startsWith("zh-hk") ||
      v.name.toLowerCase().includes("hong kong") ||
      v.name.toLowerCase().includes("cantonese") ||
      v.name.toLowerCase().includes("sin-ji")
    );
    
    if (hkVoices.length > 0) {
      const isFemaleCase = state.activeCase && state.activeCase.gender === "女";
      let selectedVoice = null;
      
      if (isFemaleCase) {
        const femaleKeywords = ["sin-ji", "tracy", "hiumaan", "ting-ting", "yu-ting", "female", "szemin"];
        selectedVoice = hkVoices.find(v => 
          femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
        );
      } else {
        const maleKeywords = ["danny", "wanlung", "limu", "male", "kangkang"];
        selectedVoice = hkVoices.find(v => 
          maleKeywords.some(kw => v.name.toLowerCase().includes(kw))
        );
      }
      
      if (!selectedVoice) {
        selectedVoice = hkVoices[0];
      }
      utterance.voice = selectedVoice;
    }
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
  
  utterance.rate = rate;
  utterance.pitch = pitch;
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

  if (text.includes("…") || text.includes("...") || Math.random() < 0.3) {
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
  recognition.continuous = true;
  recognition.lang = state.recognitionLang;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  state.recognition = recognition;

  micBtn.addEventListener("click", () => {
    if (state.isRecording) {
      recognition.stop();
    } else {
      try {
        recognition.lang = state.recognitionLang;
        recognition.start();
      } catch (err) {
        console.error(err);
      }
    }
  });

  recognition.onstart = () => {
    state.isRecording = true;
    micBtn.classList.add("recording");
    waveHud.classList.add("active");
    statusText.textContent = `🎙️ 正在連續錄音中 (${state.recognitionLang})... 請說話，再次點擊麥克風以結束`;
    statusText.style.color = "var(--accent-green)";
    startVoiceFFT();
  };

  recognition.onend = () => {
    state.isRecording = false;
    micBtn.classList.remove("recording");
    waveHud.classList.remove("active");
    statusText.textContent = `點擊麥克風即可直接講話 (${state.recognitionLang})`;
    statusText.style.color = "var(--text-muted)";
    stopVoiceFFT();
  };

  recognition.onerror = (e) => {
    console.error("Speech Recognition Error:", e);
    statusText.textContent = `語音出錯：${e.error === 'not-allowed' ? '未授權麥克風' : e.error}`;
    statusText.style.color = "var(--accent-rose)";
    state.isRecording = false;
    micBtn.classList.remove("recording");
    waveHud.classList.remove("active");
    stopVoiceFFT();
  };

  recognition.onresult = (event) => {
    let localFinal = "";
    let interimTranscript = "";
    for (let i = 0; i < event.results.length; ++i) {
      const result = event.results[i];
      if (result.isFinal) {
        localFinal += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }
    inputEl.value = localFinal + interimTranscript;

    statusText.textContent = `🎙️ 正在錄音中... 再次點擊麥克風以停止`;
    statusText.style.color = "var(--accent-green)";

    const speechToText = localFinal + interimTranscript;
    const simplifiedChars = /[这个么们来对说让还为没什从]/;
    if (simplifiedChars.test(speechToText) && state.recognitionLang !== 'zh-CN') {
      statusText.textContent = `⚠️ 辨識結果疑似為普通話，建議在設定中切換至 yue-Hant-HK 或使用無痕視窗`;
      statusText.style.color = "var(--accent-amber)";
    }
  };
}

export function startVoiceFFT() {
  const canvas = document.getElementById("voice-fft-canvas");
  const staticBars = document.getElementById("rp-static-wave-bars");
  if (!canvas) return;

  canvas.width = 180;
  canvas.height = 30;

  canvas.style.display = "block";
  if (staticBars) staticBars.style.display = "none";

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
      state.audioStream = stream;
      AudioSynth.initContext();
      const ctx = AudioSynth.ctx;
      
      state.audioSource = ctx.createMediaStreamSource(stream);
      state.audioAnalyser = ctx.createAnalyser();
      state.audioAnalyser.fftSize = 256;
      
      state.audioSource.connect(state.audioAnalyser);
      
      const bufferLength = state.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const canvasCtx = canvas.getContext("2d");
      
      function draw() {
        if (!state.isRecording) return;
        state.fftAnimationId = requestAnimationFrame(draw);
        state.audioAnalyser.getByteFrequencyData(dataArray);
        
        canvasCtx.fillStyle = "rgba(10, 12, 18, 0.45)";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 8;
          const hue = (i / bufferLength) * 120 + 180;
          canvasCtx.fillStyle = `hsla(${hue}, 100%, 60%, 0.95)`;
          canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1.5, barHeight);
          canvasCtx.fillStyle = "#ffffff";
          canvasCtx.fillRect(x, canvas.height - barHeight - 1, barWidth - 1.5, 1);
          x += barWidth;
        }
      }
      
      draw();
    })
    .catch(err => {
      console.warn("Speech FFT capture rejected or unsupported:", err);
      canvas.style.display = "none";
      if (staticBars) staticBars.style.display = "flex";
    });
}

export function stopVoiceFFT() {
  const canvas = document.getElementById("voice-fft-canvas");
  const staticBars = document.getElementById("rp-static-wave-bars");
  if (canvas) canvas.style.display = "none";
  if (staticBars) staticBars.style.display = "flex";

  if (state.fftAnimationId) {
    cancelAnimationFrame(state.fftAnimationId);
    state.fftAnimationId = null;
  }
  if (state.audioStream) {
    state.audioStream.getTracks().forEach(track => track.stop());
    state.audioStream = null;
  }
  if (state.audioSource) {
    state.audioSource.disconnect();
    state.audioSource = null;
  }
  if (state.audioAnalyser) {
    state.audioAnalyser.disconnect();
    state.audioAnalyser = null;
  }
}
