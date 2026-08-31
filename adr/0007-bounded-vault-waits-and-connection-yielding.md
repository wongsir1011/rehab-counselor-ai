# ADR-0007: Bounded Vault Waits and Connection Yielding

* **Status**: Accepted
* **Date**: 2026-08-30 (HKT, UTC+8)
* **Deciders**: Lead Counsel & Claude Code
* **Recorded**: 2026-08-31 13:28 (HKT, UTC+8) — 決策於 2026-08-30 Milestone 8 建置時做出，此 ADR 為事後補寫留檔；`Date` 欄記錄的是決策日期，非撰寫日期。

## Context

Every promise in `src/utils/db.js` was constructed with only `onsuccess`/`onerror` (or `oncomplete`/`onerror`). The file contained **zero** occurrences of `onblocked`, `onabort`, `onversionchange`, and had no timeouts anywhere. Because `hydrateVault()` is awaited inside `initApp()` *before* the first `switchView()`, any promise that never settles means the first view is never rendered — the page sits on the static shell reading 「加載中... / 請稍候...」 with an **empty content area, no error, and no way forward**.

Two non-settling paths were reproduced in a browser before the fix, not inferred from reading:

1. **`open()` meeting `blocked`** — holding a v1 connection and opening v2 with the file's exact code: `onblocked` fired, `onsuccess`/`onerror` did not settle within 5 seconds and would not recover on their own, because the holding connection had no `onversionchange` to make it let go.
2. **A transaction being aborted** — `onabort` fired while `oncomplete` and `onerror` did not. `clearAll()`, used by both the Danger Zone reset and backup restore, hung forever on that path.

A third path was observed accidentally during Milestone 8 verification and is the most important of the three: with a stale-cached build (no `onversionchange`) holding a connection, **every** `open()` against that database queued silently — `onblocked` did not fire at all. Only a timeout can break that state.

`DB_VERSION` has been 1 since the schema was created, so no upgrade has ever been requested. The blocked path is therefore **loaded but unfired**: the first `DB_VERSION` bump would hang every counselor with two tabs open, permanently.

PRD v4 `Degradation Honesty` states: *"If durable storage is unavailable **or unresponsive**, the application says so plainly and stays usable; it must never sit on an indefinite loading state with no explanation and no way forward."*

## Decision

**Every wait against the vault is bounded, and every connection yields on request.**

1. A single internal helper, `settleWithin(executor, ms, message)`, wraps every method in `db.js`. It guarantees settlement: 8s for `open()`, 5s for individual operations. Results arriving after the deadline are discarded via a `settled` flag, so a late resolve can never install data that contradicts the degraded state already shown.
2. `open()` gains `onblocked` (rejects immediately with `VAULT_BLOCKED` — no need to wait out the timeout when the event names the cause) and every transaction gains `onabort` (`VAULT_ABORTED`).
3. The established connection sets `onversionchange` — close and drop the cached handle so this tab never blocks another tab's upgrade — and `onclose`, so a dead handle is not reused.
4. Timeouts, blocks and aborts are **re-thrown** rather than swallowed into the existing fallback return values (`false` / `[]` / `null`). "Not responding" must never be silently rendered as "no data", because an empty history reads to the counselor as lost records.
5. `probe()` returns `{ available, reason, message }` so the interface can distinguish causes; `state.vaultDegradedReason` carries it, and the degraded banner says **「你的面談紀錄沒有遺失」** for `blocked`/`timeout` — where the sessions really are still in IndexedDB — but not for `unavailable`.

`onversionchange` is the precondition that makes any future schema change safe. Its effect was demonstrated directly during peer review: with every tab on the new build a v2 upgrade completed cleanly (console: 「其他分頁要求升級保險箱，本分頁主動關閉連線讓路」), while the same upgrade against a tab running the old build produced the permanent queue described above.

## Options Rejected

1. **Add `onblocked` only, without timeouts.** Rejected on measured evidence: in the observed queueing state `onblocked` never fires, so a handler alone cannot break it. A timeout is the more fundamental guarantee; `onblocked` is an optimisation that names the cause faster.
2. **Keep unbounded waits and improve the loading screen with a spinner.** Rejected — a spinner that spins forever is still an indefinite loading state with no way forward, which is what the PRD clause forbids in as many words.
3. **Mirror the vault into `localStorage` so a hung IndexedDB has a fallback source of truth.** Rejected — it creates a second authoritative home for sessions, violating the SSOT constraint, and reintroduces the 5MB quota problem ADR-0005 was written to escape.
4. **Swallow timeouts into the existing fallback returns (`[]` / `false`) for uniformity.** Rejected — this is precisely how "not responding" becomes "you have no records" on screen. The asymmetry is deliberate: transient unresponsiveness must be loud, ordinary data errors stay tolerant.
5. **Bump `DB_VERSION` as part of this work to prove the upgrade path.** Rejected — Milestone 8 changes no schema, and shipping a version bump purely to exercise a code path would put every existing counselor through a migration for no product reason.

## Consequences

- **Positive**: the application always finishes booting. A future schema change becomes survivable rather than a guaranteed outage for multi-tab users. The counselor is told which of "cannot store" and "cannot read right now" they are in, which are opposite messages about whether their data still exists.
- **Negative**: an 8-second ceiling could in principle cut off a genuinely slow but healthy open on a very large vault; the cost is bounded because the timeout degrades rather than destroys — records are untouched, the banner says so, and a retry button is offered.
- **Follow-up recorded as drift**: the `if (err && err.code) throw err` predicate chosen to implement rule 4 is wrong — all `DOMException`s carry a truthy numeric `.code`, so ordinary storage errors are now re-thrown too. See `ARCHITECTURE.md` §7 **D32**. The decision above stands; its implementation needs correcting.
