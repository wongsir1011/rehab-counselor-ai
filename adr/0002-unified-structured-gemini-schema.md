# ADR-0002: Single-Roundtrip Structured Schema for Client Reply & Supervisor Hint

* **Status**: Accepted — **not implemented in the shipped code** (see Implementation Note)
* **Date**: 2026-08-15
* **Deciders**: Antigravity & Lead Counsel

> **Implementation Note (2026-08-27 23:14 HKT audit)**: This decision is *not* reflected in `origin/main`. `geminiService.js:222-223` still issues two sequential plain-text calls (`callGeminiAPI()` then `generateCoachHint()`), and the file contains no `responseSchema` at all. The consequence the ADR set out to remove — doubled latency and token cost — is still present, and the PRD's "<1.5s" success criterion is unreachable in this shape. A conforming implementation exists on the abandoned `rollback` branch as commit `e06789d` but was never merged. Convergence is scheduled as **Milestone 5** in `Product_Roadmap.md`. The decision text below is left exactly as it was made.

## Context
During live counseling simulations, counselors need immediate feedback from the simulated client and a simultaneous supervisory hint. Executing two sequential API calls created a 3.5–5.5s delay, breaking natural conversational immersion.

## Decision
Consolidate both generation tasks into a single Google Gemini API call with a strict `responseSchema` returning `{ reply, coachHint }`.

```json
{
  "type": "OBJECT",
  "properties": {
    "reply": { "type": "STRING" },
    "coachHint": { "type": "STRING" }
  },
  "required": ["reply", "coachHint"]
}
```

## Options Rejected
1. *Sequential Two-Call Chain*: Rejected due to unacceptable latency (3.5s+).
2. *Parallel Independent Calls*: Rejected due to race conditions where the supervisor hint might arrive before the client reply or consume double token quota.

## Consequences
- **Positive**: Reduces conversational turn latency by ~60% (<1.5s), guarantees synchronized UI delivery, lowers API quota usage.
- **Negative**: Requires careful prompt engineering so the model balances both the emotional client persona and the analytical supervisor persona.
