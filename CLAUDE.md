# RehabCounselor AI - Project Guide for Claude Code

## Project Overview
RehabCounselor AI is an offline-capable, local-first Single Page Application (SPA) designed for clinical rehabilitation counseling simulation and training (specifically integrating ACT, MI, and ICF clinical models in Hong Kong Cantonese / Traditional Chinese context).

- **Architecture**: Vanilla ES Modules (ESM) + Cyberpunk Glassmorphism CSS3. Zero build step, local-first.
- **AI Integrations**: 
  - Google Gemini API (structured responses via `responseSchema` in `geminiService.js`)
  - Speech: Web Speech API (STT/TTS) + MiniMax Neural Cantonese TTS API
- **Repository**: https://github.com/wongsir1011/rehab-counselor-ai.git

## Key Files & Structure
- `index.html`: Application entry point, CDN links, modals, main DOM mount points.
- `index.css`: Glassmorphism design system, responsive layout, animations, theme variables.
- `app.js`: Main SPA controller, state management, router, view rendering, audio processing.
- `src/`: Modularized components and views:
  - `src/components/`: UI modals, badges, dialogs, audio equalizers.
  - `src/views/`: Simulation view, Theory view (ACT/MI/ICF), Analytics view, History view.
  - `src/core/`: Event bus, hotkeys, state management.
- `geminiService.js`: AI Gateway for Gemini 1.5/2.5 Pro/Flash, prompt engineering for patient simulation and supervisor hints.
- `mockData.js`: Clinical ontologies (ACT Hexaflex, MI OARS, ICF factors), preset cases, Hong Kong Cantonese dialogues.
- `ARCHITECTURE.md`: Detailed architecture design and data flow.
- `PRD.md`: Product Requirements Document.
- `CHANGELOG.md` / `DECISIONS.md`: Version history and architectural decision records.

## Development & Execution Commands
- **Local Dev Server**:
  ```bash
  # Python 3
  python3 -m http.server 8000
  # Or Node.js http-server / serve / live-server / vite
  npx serve .
  ```
- **Syntax & Lint Checking**:
  ```bash
  python3 check_syntax.py
  ```

## Conventions & Rules
1. **No unnecessary build tools or complex frameworks**: Keep vanilla ESM structure unless explicitly requested by the user.
2. **Language & Localization**: Primary UI is Traditional Chinese (`zh-HK`), with clinical terms in English/Traditional Chinese. Audio voice models default to Hong Kong Cantonese (`yue-Hant-HK` / `zh-HK`).
3. **Data Privacy**: No client confidential data is sent to external servers except direct client-to-API calls (Gemini/MiniMax) using user-provided API keys stored in `localStorage`.
