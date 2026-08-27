# ADR-0002: Single-Roundtrip Structured Schema for Client Reply & Supervisor Hint

* **Status**: Accepted — **implemented 2026-08-27** (Milestone 5)
* **Date**: 2026-08-15
* **Deciders**: Antigravity & Lead Counsel

> **Implementation Note (2026-08-27 23:14 HKT audit)**: At the time of the audit this decision was *not* reflected in `origin/main` — `geminiService.js` issued two sequential plain-text calls and contained no `responseSchema`. A conforming implementation existed on the abandoned `rollback` branch as `e06789d` but was never merged.
>
> **Resolved (2026-08-27, Milestone 5)**: implemented fresh on top of the current `main` rather than cherry-picked, since `e06789d` conflicted with the vault and documentation work that landed after it. `generateClientReply()` now issues one `responseSchema`-constrained call returning `{ reply, coachHint }` with strict arrival validation, and `generateCoachHint()` — along with the canned fallback sentence that violated the PRD's no-fake-data constraint — was deleted. See [`plan/05-synchronous-dual-track-response.md`](../plan/05-synchronous-dual-track-response.md). The decision text below is left exactly as it was made.

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
