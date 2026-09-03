# ADR-0010: Two-Layer Defence for Untrusted Content

* **Status**: Accepted
* **Date**: 2026-09-02 (HKT, UTC+8)
* **Deciders**: Lead Counsel & Claude Code
* **Recorded**: 2026-09-03 09:53 (HKT, UTC+8) — 決策於 2026-09-02 Milestone 9 建置時做出，此 ADR 為事後補寫留檔；`Date` 欄記錄的是決策日期，非撰寫日期。

## Context

`ARCHITECTURE.md` §7 recorded this as a single-location defect (D31): the supervisor panel assigned `coachHint` through `innerHTML`, and the note said 「this is the only such surface」. A systematic scan during Milestone 9 found **48** insertion points carrying untrusted data into `innerHTML`: case fields 25, ICF factors 10, session snapshots 5, AI quiz 4, AI summary 2, transcript 1, coach hint 1.

**The most dangerous path never touches the model.** Gene-code import (`app.js:3572`) validated only that `id`, `name` and `health_condition` *existed*, then wrote the decoded object straight into `state.cases` and `persistCustomCases()` — permanent vault storage. An attacker hands a counselor a base64 string; importing it executes arbitrary JS in the browser whose `localStorage` holds the Gemini key.

PRD v4 names both halves of this in one sentence:

> **Security & Secrets**: … **Model output is rendered as text, never as markup**, so **imported case content cannot reach the browser through it**.

One insertion sits in an **attribute value** (`data-text="${f.text}"`), which escaping `<` alone does not protect. Milestone 8's existing `escapeHtmlText()` is DOM-based (`div.textContent` → `innerHTML`) and does not escape quotes, so it is unsafe in that position.

## Decision

**Two independent layers, both required.**

1. **Escape at render.** `escHtml()` covers `&`, `<`, `>`, `"` and `'`, applied at every insertion point carrying case fields, AI output, session snapshots, or the counselor's own notes into `innerHTML`.
2. **Allow-list at import.** `sanitizeImportedCase()` rebuilds the case object from a known field list with per-field type checks; unknown keys — `__proto__` included — never reach `state.cases` or the vault.

Neither layer is sufficient alone, and the reason is asymmetric:

- **The allow-list cannot protect what is already stored.** A malicious case imported before this fix sits in the vault today. Only render-time escaping reaches it. This was verified by planting such a case directly in IndexedDB and walking eight rendering positions.
- **Escaping alone leaves unknown fields in durable storage**, waiting for the day someone adds a rendering point for a field nobody validated.

`escapeHtmlText()` and `escHtml()` keep separate, documented roles: the former for error messages (element content only), the latter for untrusted data (safe in both element and attribute positions).

Markdown **export** paths are deliberately left unescaped — that output is a file for the supervisor, not DOM. Teaching material from `mockData.js` (`opt.text`, `ach.name`, `node.name`) is also left alone: it is trusted, maintained by the Training Lead, and may intentionally carry formatting.

Escaping is applied **without** trying to distinguish trusted from untrusted cases, because built-in and imported cases share one rendering path through `state.cases`. Attempting to tell them apart only creates gaps.

## Options Rejected

1. **Tagged template literals (`html\`…\``) instead of per-site escaping.** Rejected — of the 94 `innerHTML` assignments, many intentionally interpolate HTML (`${vaulted ? "<b>…</b>" : ""}`, nested render calls). A tagged template escapes those too, breaking layout across the app. Per-site wrapping is tedious but verifiable and cannot misfire.
2. **Escape at the data boundary — on import and on AI response — instead of at render.** Rejected — it corrupts the stored data. An escaped case name would export as `&lt;b&gt;` in the supervisor's Markdown file, and a second import would double-escape it. Escaping is a *presentation* concern.
3. **Allow-list only.** Rejected — cannot reach malicious cases already in the vault, which is the realistic state for anyone who imported a gene code before this milestone.
4. **Render-time escaping only.** Rejected — leaves arbitrary unknown fields permanently in the vault; the next rendering point added for a new field re-opens the hole.
5. **Reuse `escapeHtmlText()` everywhere rather than adding a second helper.** Rejected on measurement: it does not escape quotes, so it cannot protect the `data-text` attribute position. Silently using it there would look correct and be wrong.
6. **Sanitise HTML (strip dangerous tags) rather than escape it.** Rejected — a sanitiser is a large dependency with its own bypass history, and the product never needs counselor or model content to *render* as markup. Escaping is the smaller, total answer.

## Consequences

- **Positive**: a malicious case planted in the vault walked the mystery box, case lobby, ICF sandbox (including a real drag-and-drop), interview room, scripted turn, completion screen, history cards and detail popup with `window.__XSS` at **0** throughout. Import drops unknown fields and does not pollute the prototype.
- **Negative**: 55 call sites now carry `escHtml()`, and a new rendering point for untrusted data must remember it. The rule is at least uniform: anything from a case, the model, or the counselor's own typing gets escaped on its way into `innerHTML`.
- **Lesson recorded, because it cost two rounds**: the initial sweep grepped by *field name* and missed intermediate variables. `historyText` is the name of two different variables — one feeds a `<pre>` via `innerHTML`, the other builds the Markdown export — and seeing the export-shaped `.map(h => …)` led to classifying it as export **twice**, once while building and once while reviewing. The reliable method is the opposite order: **enumerate `innerHTML` templates first, then look for un-escaped data inside them.** That scan found seven further gaps, including one where the write side of `data-text` was escaped while the read-back side (`getAttribute` → `innerHTML`) was not — **half an escape is no escape**, and the attack still fired on drag-and-drop.
