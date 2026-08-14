# ADR-0002: Single-Roundtrip Structured Schema for Client Reply & Supervisor Hint

* **Status**: Accepted
* **Date**: 2026-08-15
* **Deciders**: Antigravity & Lead Counsel

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
