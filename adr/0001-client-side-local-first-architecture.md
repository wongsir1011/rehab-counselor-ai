# ADR-0001: Client-Side Local-First SPA Architecture

* **Status**: Accepted
* **Date**: 2026-08-15
* **Deciders**: Antigravity & Lead Counsel

## Context
RehabCounselor AI is designed for medical/rehabilitation social workers and therapists in Hong Kong. Client counseling simulation records, personal reflection notes, and API keys must maintain strict confidentiality without risking data exposure on untrusted shared servers.

## Decision
Build the application as a 100% client-side Single Page Application (SPA) using standard ES Modules and vanilla web standards. All API calls to LLM providers are made directly from the user's browser, and data is persisted locally in the browser storage engine.

## Options Rejected
1. *Centralized Node.js/Python Backend*: Rejected due to hosting cost overhead, network proxy latency, and increased risk of storing confidential counseling data on a central database.
2. *Third-Party Cloud BaaS (Firebase / Supabase)*: Rejected to avoid user login barriers and multi-tenant data leakage risks in offline/internal training contexts.

## Consequences
- **Positive**: Zero backend deployment maintenance, zero ongoing hosting costs, instant cold-boot loading, absolute counselor privacy.
- **Negative**: Browser client must handle API rate limits and network CORS headers directly.
