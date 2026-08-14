# ADR-0005: IndexedDB Local Vault for Large-Capacity Training Session Persistence

* **Status**: Accepted
* **Date**: 2026-08-15
* **Deciders**: Antigravity & Lead Counsel

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
