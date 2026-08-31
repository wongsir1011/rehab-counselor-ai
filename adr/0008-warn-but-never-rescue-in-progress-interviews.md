# ADR-0008: Warn, But Never Rescue, an In-Progress Interview

* **Status**: Accepted
* **Date**: 2026-08-30 (HKT, UTC+8)
* **Deciders**: Lead Counsel & Claude Code
* **Recorded**: 2026-08-31 13:28 (HKT, UTC+8) — 決策於 2026-08-30 Milestone 8 建置時做出，此 ADR 為事後補寫留檔；`Date` 欄記錄的是決策日期，非撰寫日期。

## Context

SOAP and ICF drafts live only in `state.activeSession.notes`, and the transcript only in `state.activeSession.history`. Neither is persisted anywhere until the interview is finalized. Against that, three exits destroyed the work silently:

1. **Closing the tab or reloading** — `beforeunload` appeared **zero** times in `app.js` and `index.html`. This also meant the PRD's own SUCCESS script could not be walked end to end, since it requires the counselor to attempt to leave mid-interview and *be stopped by a warning*.
2. **Sidebar navigation** — every nav item called `switchView(target)` directly, destroying the interview without a word. The `active` class was also moved *before* `switchView`, so any interception would leave the highlight on a page the counselor never reached.
3. **The application discarding the interview itself** — on a failed evaluation with a key present, the code alerted and then called `switchView("arena")`. The root cause was structural: the "正在評估你的輔導技巧..." state *replaced* `#content-view-mount`, so there was nothing to return to, and re-rendering the room via `startRoleplaySession()` would rebuild `state.activeSession` and wipe the transcript.

Meanwhile the notes panel displayed a green dot reading **「已安全備份」**, with a 「同步中... → 已安全備份」 animation on every keystroke — a durability claim with nothing behind it.

Two PRD clauses bear directly on this, and they pull in opposite directions:

> **Data Ownership & Durability**: In-progress SOAP and ICF drafts must be protected against accidental loss … and **the interface must never claim a draft is saved or backed up when it is not**.

> **OUT OF SCOPE**: Resuming an interrupted interview. A session enters the vault only when finalized; before that, **the counselor is warned but not rescued**.

## Decision

**Intercept every exit and tell the truth about the draft's durability. Do not persist the draft.**

1. One predicate, `hasUnsavedInterview()`, gates both exits: the session exists, has **not** been vaulted (`vaultedAt`), and has something to lose (a turn, or non-whitespace notes). The last clause is deliberate — warning over an empty room trains counselors to dismiss the warning.
2. `vaultedAt` is stamped on `state.activeSession` **after** `persistCompletedSession()` succeeds. It lives in memory only, is not part of the `completedSession` object, and therefore never reaches an object store or a backup file.
3. `beforeunload` guards tab close and reload. In-app departure is guarded inside `switchView()` at a single choke point, so all eleven call sites are covered by default; three sites are explicitly exempt (locale re-render, the abort button which confirms on its own, and the offline no-script panel which never creates a session). `switchView()` now returns a boolean and the sidebar only moves its highlight when it returns `true`.
4. Confirming departure calls `discardActiveInterview()`, clearing the in-memory copy for non-vaulted sessions only. Without this the predicate stays true forever and every later navigation re-asks about an interview the counselor already abandoned.
5. The evaluating state becomes a **non-destructive overlay** rather than a replacement, so a failed evaluation can leave the counselor in the room with the transcript, notes and coach hint intact, free to retry.
6. The green indicator and its entire state machine are deleted, replaced by a standing statement that makes no durability claim: 「草稿只存在於此分頁 · 面談結束後才寫入保險箱」.

The interview room is therefore *harder to leave by accident* and *honest about what leaving costs* — without acquiring the resume capability the PRD excludes.

## Options Rejected

1. **Autosave the draft to IndexedDB every few seconds.** Rejected — the PRD puts resuming an interrupted interview OUT OF SCOPE and states the counselor is "warned but not rescued". It would also put un-finalized sessions in the vault, contradicting "A session enters the vault only when finalized". This is the option that would have made the green dot *true*, and it is exactly the one the product intent forbids.
2. **Keep the indicator, relabel it 「已記錄」.** Rejected — softer wording for the same false implication. The counselor's question is "will this survive if I close the tab", and any green reassurance answers it wrongly.
3. **Add `beforeunload` only, leaving in-app navigation alone.** Rejected — clicking 儀表板 destroys the interview exactly as thoroughly as closing the tab. Guarding only the browser-level exit would satisfy the letter of the SUCCESS clause while leaving the more likely accident unguarded.
4. **Guard at each of the eleven `switchView` call sites.** Rejected in favour of guarding inside `switchView` itself: per-site guards fail open — the one that gets forgotten is the one that loses the data.
5. **Derive "in progress" from `state.activeSession` alone, without `vaultedAt`.** Rejected on measured behaviour: `activeSession` is never reset except by the Danger Zone, so it stays populated after an interview completes and the guard would fire on every navigation thereafter.
6. **Set `state.activeSession = null` on finalize instead of stamping `vaultedAt`.** Rejected — the report screen and `exportSessionReport()` both read `activeSession` after finalization; nulling it breaks the working flow to serve the guard.
7. **On evaluation failure, keep `switchView("arena")` and rely on the new guard to ask.** Rejected as insufficient: being asked "are you sure you want to leave?" when you never asked to leave is a confusing way to be told an API call failed. Staying in the room is the correct behaviour, and the overlay is what makes it possible.

## Consequences

- **Positive**: the PRD SUCCESS clause can be walked end to end for the first time. Three separate paths that silently destroyed a counselor's work now stop and ask, and the interface no longer makes a durability claim it cannot honour.
- **Negative**: a counselor who genuinely wants to abandon an interview now clicks through one confirmation. Accepted deliberately — the predicate's "something to lose" clause keeps this from firing on empty rooms.
- **Unchanged by design**: drafts still do not survive a crash or a forced tab close. That is the PRD's position, not an implementation shortfall, and the interface now says so plainly instead of implying otherwise.
- **Follow-up recorded as drift**: `initApp().catch()` still has no UI, so an exception during first render leaves the same blank screen this milestone set out to eliminate — a different cause than the vault hang, and unaddressed. See `ARCHITECTURE.md` §7 **D33**.
