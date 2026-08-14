# ADR-0003: Dual-Engine Cantonese TTS Routing with Strict Gender Timbre Binding

* **Status**: Accepted
* **Date**: 2026-08-15
* **Deciders**: Antigravity & Lead Counsel

## Context
Native browser speech synthesis frequently lacks authentic Hong Kong Cantonese prosody and often assigns female voices to male client personas on devices lacking complete Cantonese system voice packs.

## Decision
Implement a dual-engine speech router (`speechEngine.js`):
1. **Primary**: MiniMax Neural Cantonese TTS REST API (supporting Global and Mainland endpoints), binding male cases to `cantonese_male` and female cases to `cantonese_female`.
2. **Fallback**: Native Web Speech API with automatic gender keyword matching (`sin-ji`, `tracy`, `danny`, `wanlung`) when offline or unconfigured.

## Options Rejected
1. *Native Web Speech Only*: Rejected due to inconsistent OS-dependent voice quality and robotic prosody.
2. *Cloud Provider WebSockets Only*: Rejected due to firewall restrictions on hospital and agency intranet connections.

## Consequences
- **Positive**: Exceptional Cantonese audio realism, reliable gender consistency across all devices, zero failure risk due to automated Web Speech fallback.
- **Negative**: Users must provide a MiniMax API key in Settings to unlock neural voices.
