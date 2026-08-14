# Milestone 1 Plan: The Spoken Cantonese Clinical Encounter

* **Status**: Ready for Implementation
* **Roadmap Ref**: [Product Roadmap Milestone 1](file:///Users/wongsir1011/.gemini/antigravity/scratch/rehab-counselor-ai/Product_Roadmap.md)
* **Target Outcome**: Continuous Cantonese STT with pause buffering + MiniMax Cantonese neural TTS with gender timbre binding + Web Speech fallback.

---

## 1. Scope & Interfaces
1. **`speechEngine.js`**:
   - `initVoiceRecognition()`: continuous listening with auto-reconnect on speech pause, interim transcript accumulation.
   - `speakCantonese()`: dual-engine router (MiniMax v2 REST endpoint vs Web Speech fallback) binding `selectedCase.gender` to male/female Cantonese voices.
2. **`settingsView.js` / Settings Modal**:
   - MiniMax API Key & Group ID configuration fields.
   - TTS Engine selector (`system`, `minimax-global`, `minimax-cn`).
   - "🔊 測試發音" (Test Audio) button for instant audio check and diagnostics.

---

## 2. Verification Plan
- **Automated**: Syntax validation (`node -c`, `python3 check_syntax.py`).
- **Live Demo**: Open case "Ah Keung", speak a 15-second Cantonese prompt with a 2-second pause; verify microphone remains active; verify Ah Keung replies aloud with a natural male Cantonese voice.
