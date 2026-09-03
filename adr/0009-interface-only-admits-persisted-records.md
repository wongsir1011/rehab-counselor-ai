# ADR-0009: The Interface Only Admits Persisted Records

* **Status**: Accepted
* **Date**: 2026-09-02 (HKT, UTC+8)
* **Deciders**: Lead Counsel & Claude Code
* **Recorded**: 2026-09-03 09:53 (HKT, UTC+8) — 決策於 2026-09-02 Milestone 9 建置時做出，此 ADR 為事後補寫留檔；`Date` 欄記錄的是決策日期，非撰寫日期。

## Context

`persistCompletedSession()` began with `state.historySessions.unshift(session)` — **before** the write to the vault, and with no rollback if the write failed. The ordering had been that way since Milestone 7 and was never questioned, because the write rarely fails.

Milestone 8 made write failure a *designed, visible* path (a failure card, a retry button), which turned a theoretical inconsistency into a reachable one. The 2026-08-31 peer review then measured it:

```
Vault: 0 records          Screen: 2 history cards
Dashboard: 「72分 | 分析平均得分 | 平均 72 分」
Analytics: 「AI 即時回饋（練習參考）：你 2 場已評估面談的五維平均為 72 分。」
```

Every figure was computed from `state.historySessions`, and none of them corresponded to anything in the vault.

**The badge consequence was worse, because badges are durable.** `checkAndUnlockAchievements()` reads the same array through `computeCounselorRecord()`, so a failed write still granted `first_session` and `empathy_master`. After a reload the vault held 0 sessions and the history list was empty — and both badges were still 「已解鎖」, permanently, because the M7 reconciliation flag had already been written and only runs once.

Two PRD clauses are directly implicated:

> **SSOT**: the vault is the single durable home for sessions… Derived values — session counts, completion tallies, radar aggregates, **progress milestones** — are computed in one place **from the vault**.

> **No Claim Without Evidence**: Every number, grade, **badge**… is computed from that counselor's own record. Where there is no record it says so.

## Decision

**Write first; add to the in-memory array only when the write succeeded.**

```
persistCompletedSession(session):
  result = await writeSessionToVault(session)
  if (result.ok) state.historySessions.unshift(session)
  return result
```

`writeSessionToVault()` is split out as the pure-write half, so the retry button can re-send the same record without a second `unshift`. Because the first attempt never added it, a successful retry is the record's only insertion.

The degraded (`localStorage`) branch cannot serialise the live array any more — the record is not in it yet — so it builds a candidate `[session, ...state.historySessions]` and writes that, leaving the caller to update memory on success.

This is the same principle ADR-0005's migration already applied to reads — *"verify records landed before removing the old copy"* — extended to writes: **the interface does not treat a record as real until it is durable.**

One ordering change fixes every downstream figure at once, because the dashboard, analytics aggregates, radar and badge predicates all read that one array through `computeCounselorRecord()`.

## Options Rejected

1. **Keep the eager `unshift` and roll back on failure.** Rejected — a rollback has to find and remove the right entry, and any path that forgets to roll back fails *open*, leaving a phantom record. Not inserting until success has no such failure mode.
2. **Leave the ordering alone and filter phantom records out at each display site.** Rejected — that is four or more places (dashboard, analytics, radar, badges) each needing the same guard, which is exactly the "per-site guard fails open" mistake ADR-0008 §4 rejected for the navigation guard.
3. **Keep the record in memory and mark it `pendingWrite`, hiding it from aggregates only.** Rejected — it creates a second class of session with its own visibility rules, and the SSOT clause asks for one authoritative home, not one home with an asterisk.
4. **Accept the inconsistency because a reload corrects the figures.** Rejected — the figures do self-correct, but **badges do not**. A durable badge earned against a record that never existed is precisely what Milestone 7 was built to eliminate.
5. **Roll back the badge grant instead of fixing the ordering.** Rejected as treating the symptom: the same phantom record also drives the dashboard average, the radar and the session count.

## Consequences

- **Positive**: dashboard figures, analytics aggregates, radar and badges now reflect the vault by construction rather than by convention. A failed write leaves the interface saying 「尚無已評估的面談紀錄」 — which is true — while the interview itself stays on screen with its failure card and retry button (ADR-0008 §5).
- **Negative**: `writeSessionToVault()` and `persistCompletedSession()` are two functions where there was one, and a future caller could use the wrong half. Mitigated by naming and by the comment on the pure-write function.
- **Verified**: a forced write failure now leaves `badges: []` where it previously granted two; retry produces exactly one record in both the vault and the screen; the degraded branch writes the candidate array in the correct order.
