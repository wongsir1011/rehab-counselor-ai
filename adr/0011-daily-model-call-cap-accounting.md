# ADR-0011: Daily Model-Call Cap and Its Accounting

* **Status**: Accepted
* **Date**: 2026-09-02 (HKT, UTC+8)
* **Deciders**: Lead Counsel & Claude Code
* **Recorded**: 2026-09-03 09:53 (HKT, UTC+8) — 決策於 2026-09-02 Milestone 9 建置時做出，此 ADR 為事後補寫留檔；`Date` 欄記錄的是決策日期，非撰寫日期。

## Context

PRD v3 added a clause that had no implementation at all:

> **Usage Guardrail**: A per-counselor daily cap on model calls, **shown in settings alongside the counselor's own key and remaining budget**.

`geminiService.js` had no counter, no cap and no settings surface. The counselor pays for their own Gemini key, so the purpose is not to save cost — it is to stop them discovering mid-interview that the budget is gone.

Two facts shaped the accounting decisions. `callGeminiAPI()` is the **single** network exit: all five exported functions (`generateClientReply`, `generateCustomCase`, `generateSessionReport`, `generateCustomQuiz`, `generateSoapSuggestions`) pass through it. And it contains a `retries = 3` loop, so one logical call can emit up to four HTTP requests.

## Decision

**Count at the single network exit, in units the counselor recognises, before the request goes out.**

1. **Where**: inside `callGeminiAPI()`. No call path can miss it, and the five callers need no changes. The offline demo never enters this function, so it is not counted — verified.
2. **Unit**: one **logical call** = one unit. Internal retries are not counted separately, because the counselor's mental unit is 「我送出了一句話」; retries are an implementation detail they never see.
3. **When**: increment **before** the request, not after success. A failed request can still reach Google's bill, and a counter that undercounts makes 「尚餘額度」 meaningless — the one number the clause exists to provide.
4. **Storage**: `rehab_daily_usage` as `{date, count}`, reset when the local date string changes; `rehab_daily_call_cap` for the limit. Both in `localStorage`, per the PRD's *"Settings remain in simple local settings storage"*. Neither is a copy of anything — "how many calls went out today" cannot be derived from the vault, since it includes failed calls, case synthesis and quiz generation that leave no session record. This is their only authoritative home, so the SSOT clause is satisfied rather than bent.
5. **Cap value**: default 200, adjustable 10–2000, in settings next to the key field. The PRD says **per-counselor**, and in an account-less single-machine architecture that can only mean "this counselor's own limit" — their key, their bill. Hard-coding a number would make it the developer's limit wearing the counselor's name.
6. **On exceeding**: throw with `code: "DAILY_CAP_REACHED"` before any request. The interview room routes it through Milestone 8's failure path — the counselor stays in the room with the transcript and notes intact.

## Options Rejected

1. **Count HTTP requests rather than logical calls.** Rejected — after a transient failure the counselor would see the counter jump by 4 for one sentence they sent once, and would reasonably conclude the number is broken.
2. **Increment only after a successful response.** Rejected — undercounts against the counselor's actual bill. Given a choice between over- and under-reporting spend on someone else's credit card, over-reporting is the honest error.
3. **Add the counter at the five call sites instead of the shared exit.** Rejected for the reason ADR-0008 §4 gives about per-site guards: the one that gets forgotten is the one that matters. A single choke point cannot be bypassed by a new caller.
4. **Hard-code the cap with no settings control.** Rejected — see decision 5. It would also make the clause's own wording ("alongside … remaining budget") half-true: a number the counselor can see but not own.
5. **Block entry to the interview room when the cap is reached.** Rejected — it removes access to the transcript, notes and export of work already done. Blocking at submission (as the offline-demo path already does) keeps everything the counselor has reachable.
6. **Track usage in the IndexedDB vault alongside sessions.** Rejected — the vault is for the counselor's work product. A daily counter is a setting, it resets on its own, and putting it there would mean a backup restore could resurrect a stale day's count.
7. **Reset by UTC day rather than local date.** Rejected — the counselor's day is a Hong Kong day; a UTC reset would land mid-afternoon locally.

## Consequences

- **Positive**: the settings page shows 已用／上限／尚餘 next to the key, with the bar turning amber near the limit. Verified: the cap blocks all four AI functions, does not increment when blocked, clamps out-of-range input (`5→10`, `9999→2000`), resets across a date change, and leaves the offline demo uncounted. Five concurrent calls all recorded — the read-modify-write in `recordCall()` has no `await` inside it, so it is atomic on a single-threaded runtime.
- **Negative**: the count is per-browser-profile, not per-person. A counselor using two machines has two budgets. Accepted: the PRD's access model has no account to attach a shared count to, and inventing one would contradict *"no server-side account, login, or cloud sync"*.
- **Known gap**: a counselor who moves the system clock backwards gets an early reset. Not defended — it is their own machine and their own bill.
- **Not covered**: MiniMax TTS calls are not counted. The clause says "model calls", and the settings panel is explicitly labelled 「AI 呼叫額度」 next to the Gemini key. Should TTS ever need a budget, it needs its own counter and its own wording rather than being folded into this number.
