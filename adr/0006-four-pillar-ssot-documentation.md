# ADR-0006: Four-Pillar SSOT Documentation Governance

* **Status**: Accepted
* **Date**: 2026-08-27 (HKT, UTC+8)
* **Deciders**: Lead Counsel & Claude Code

## Context
Project documentation had drifted badly and repeatedly. `CHANGELOG.md` and `Product_Roadmap.md` stopped being updated after the Milestone 1 delivery while Milestones 2–4 shipped; `ARCHITECTURE.md` §3 described a single structured AI round-trip that the code never implemented; 36 markdown links pointed at an absolute path inside a stale clone on one machine. Each document had been treated as a general-purpose place to write things down, so no document was authoritative for anything, and contradictions between them went unnoticed for weeks.

## Decision
Each document owns exactly **one** kind of authority, and the four together form the project's SSOT:

| Pillar | Document | Authoritative for |
| :--- | :--- | :--- |
| Charter | `CLAUDE.md` | AI agent behaviour and project conventions |
| Product intent | `PRD.md` | What we promised to build |
| Actual behaviour | The code, **described by** `ARCHITECTURE.md` | What was really built |
| History | `CHANGELOG.md` | What changed, when, and why |

Supporting indexes: `Product_Roadmap.md` sequences milestones and is the sole index for picking up the next piece of work; `DECISIONS.md` is a thin one-line-per-decision index; each decision lives in its own `adr/NNNN-slug.md`; each milestone gets its own `plan/NN-slug.md`.

Binding rules:
1. **ARCHITECTURE.md describes the code as it is, not as intended.** Where the two differ, the difference is recorded as explicit drift rather than papered over.
2. **ADRs are immutable.** A decision that reality has overtaken gets an appended Implementation Note or a superseding ADR; the original text and its `Deciders` field are never rewritten.
3. **PRD.md changes only with owner approval**, and never by silent overwrite — the diff is shown first.
4. **No document may contradict another.** Derived material (a future `README.md` included) follows these sources.
5. **Timestamps come from a real clock**, recorded in HKT (UTC+8), never estimated.
6. `CHANGELOG.md` newest-first; past ~100 entries the older half moves to an append-only `changelog-archive.md`.

## Options Rejected
1. *One combined project document*: rejected — it was effectively the prior state, and it is what allowed intent, description, and history to blur until none could be trusted.
2. *Generating documentation from code*: rejected — it can only ever restate what the code does, so it cannot express intent, cannot record a rejected alternative, and structurally cannot surface drift.
3. *Letting ARCHITECTURE.md describe the target design*: rejected — this is the exact mechanism that produced the false "single round-trip with a strict `responseSchema`" claim in §3, which survived unchallenged until the 2026-08-27 audit.

## Consequences
- **Positive**: drift becomes visible instead of accumulating; each fact has one home; an agent resuming work can trust each document within its own remit.
- **Negative**: every code change now carries an unavoidable documentation obligation, and a change is not complete until the matching document is updated.
