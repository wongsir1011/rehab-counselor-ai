# ADR-0004: Continuous Cantonese STT with Pause Recovery Buffer

* **Status**: Accepted
* **Date**: 2026-08-15
* **Deciders**: Antigravity & Lead Counsel

## Context
Standard Web Speech recognition terminates prematurely when a counselor pauses for 1–2 seconds to formulate clinical reflection phrasing.

## Decision
Configure `recognition.continuous = true` and `recognition.interimResults = true`, utilizing an interim-final transcript accumulator and an auto-recovery listener on `onend` to maintain an active listening state until explicit counselor confirmation (clicking Send or pressing `Ctrl+Enter`). Explicitly assign `yue-Hant-HK` for Chromium browsers and `zh-Hant-HK` for Apple Safari.

## Options Rejected
1. *Single-Shot Speech Recognition*: Rejected because mid-thought silence caused frequent voice cutoffs.
2. *Server-Side Whisper Audio Upload*: Rejected to avoid binary audio bandwidth overhead and preserve strict client-side data privacy.

## Consequences
- **Positive**: Counselors can pause naturally while speaking Cantonese without losing their train of thought.
- **Negative**: Requires handling browser-specific permission popups on first use.
