# ADR-0005: IndexedDB Local Vault for Large-Capacity Training Session Persistence

* **Status**: Accepted — **implemented 2026-08-27**
* **Date**: 2026-08-15
* **Deciders**: Antigravity & Lead Counsel

> **Implementation Note (2026-08-27)**: Delivered. `app.js` now imports `RehabCounselorDB` from `src/utils/db.js` directly (the rest of the orphaned `src/` tree remains unimported and is still an open question). Session history and custom cases live in IndexedDB; small settings deliberately stay in `localStorage`. Boot-time migration verifies every record was persisted before deleting the `localStorage` copies, and 1-click JSON backup/restore is available under Settings → 資料保險箱. See `ARCHITECTURE.md` §6.
>
> **Deviations from the decision as originally written**:
> 1. The wrapper is imported as a single module, not as part of a full `src/` modularization.
> 2. Migration is **not** a one-time boot action — it re-checks `localStorage` on every boot, so records written by the degraded fallback path are absorbed once IndexedDB recovers.
> 3. Backup exports deliberately **exclude API keys**, which the original decision did not specify.

## Context
`localStorage` is strictly limited to 5MB, which caps simulation history to ~20 sessions and is vulnerable to browser cache eviction.

## Decision
Implement a lightweight zero-dependency wrapper around browser `IndexedDB` (`RehabCounselorDB`), featuring dedicated object stores for `sessions` and `custom_cases`, automated one-way migration from `localStorage` on boot, and 1-click JSON backup export/import.

## Options Rejected
1. *Staying with localStorage only*: Rejected due to 5MB quota constraints and JSON stringification latency on large session arrays.
2. *Local File System Access API*: Rejected due to inconsistent cross-browser support on mobile devices.

## Consequences
- **Positive**: Hundreds of MBs of storage, zero external database setup, persistent training records across sessions.
- **Negative**: Requires asynchronous transaction handling compared to synchronous `localStorage` operations.
