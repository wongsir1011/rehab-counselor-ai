# PRD: RehabCounselor AI (v3)

### NORTHSTAR
Empower every Hong Kong vocational rehabilitation counselor to master evidence-based counseling (ACT, MI, ICF) through authentic, highly responsive Cantonese AI roleplay and real-time clinical supervision.

### USER
Hong Kong vocational rehabilitation practitioners — Medical & Rehabilitation Social Workers, Occupational Therapists, Employment Specialists, and Vocational Case Managers. A second role, the **Clinical Supervisor**, receives exported portfolios and reviews them outside the application; they never operate it and hold no account in it.

### PROBLEM
Vocational counselors lack safe, authentic Cantonese roleplay environments with immediate clinical feedback to practice handling severe client resistance, career transition ambivalence, and biopsychosocial assessment — and the practice records they accumulate are neither durable nor safely shareable with a supervisor.

### USER JOURNEY
1. **Build the theory base [Counselor]**: Study ACT / MI / ICF material through flashcards, self-tests, and staged MI practice drills — alone, or by projecting a standard teaching case onto a large screen for a group of colleagues to discuss together in the same room.
2. **Select or synthesize a case [Counselor]**: Browse the dossier library of local disability cases, or configure bio-psychosocial parameters (disability chip, life stage, ACT avoidance intensity, MI resistance level) to generate a new profile with Cantonese dialogue characteristics.
3. **Conduct the Cantonese interview [Counselor]**: Speak through continuous speech-to-text without pause cutoff; hear the client reply in Cantonese audio bound to the client's profile gender; and read the clinical supervisor hint that appears **in the same turn, already visible**, naming detected Change Talk, cognitive fusion, and the recommended next OARS/ACT move.
4. **Document and classify [Counselor]**: Draft SOAP notes and ICF biopsychosocial classifications during the interview, with drafts safe from accidental loss.
5. **Review, vault, and hand off [Counselor → Supervisor]**: Finalize the interview to generate a 5-dimension radar assessment and unlock progress milestones; keep every session in the local vault; export a single session report or the entire vault as one file, which the **Supervisor** opens outside the application to review.

### SUCCESS
In a live demo: a counselor opens case "Ah Keung" (post-stroke minibus driver), speaks a Cantonese reflection through continuous microphone input without cutoff, and — from that one submission — the client's male Cantonese voice reply and the supervisor hint appear **together and already readable, with no extra click to reveal the hint**, arriving as one event rather than two staggered ones. The counselor writes SOAP notes, attempts to leave the page mid-interview and is stopped by a warning, completes the ICF matrix, finalizes the report, and exports the full vault; opening the exported file on screen shows every past session present and **contains no API key anywhere in it**.

### OUT OF SCOPE
- Hospital Authority CMS / NGO intranet EMR live database integration.
- Real patient telehealth video calling, or any networked multi-counselor session. Group study is a **local projector view of a preset teaching case on one machine** — there is no connection layer, no shared room, and no second participant device.
- Third-party LMS grading / credentialing accreditation servers.
- Any server-side account, login, or cloud sync — including supervisor accounts inside the application.
- Resuming an interrupted interview. A session enters the vault only when finalized; before that, the counselor is warned but not rescued.

### HARD CONSTRAINTS
- **Roles & Access**: Single-user, local-first, no login and no account. Everything is available immediately on opening the page. The counselor is the sole operator and sole owner of their data; the Supervisor has no in-application access and sees only files the counselor deliberately exports. There is no server, therefore no server-side permission gate to enforce or bypass.
- **Data Ownership & Durability**: Finalized sessions, custom cases, and reports live in the browser's IndexedDB vault, sized for hundreds of sessions rather than a small quota. Settings and learning progress remain in simple local settings storage. **In-progress SOAP and ICF drafts must be protected against accidental loss for as long as they exist only in the interview view, and the interface must never claim a draft is saved or backed up when it is not.** Data never leaves the browser except as direct calls to the AI providers using the counselor's own keys, or as a file the counselor exports. Any storage migration must verify records landed before removing the old copy; destructive resets must offer a backup first.
- **Degradation Honesty**: If durable storage is unavailable (e.g. private browsing), the application states this plainly on screen and disables restore, rather than presenting an empty or partial vault as if it were complete.
- **Capabilities & Voice**: Speech recognition uses continuous Cantonese acoustic models with pause buffers; voice synthesis strictly binds timbre to the client profile's gender, with a neural Cantonese voice service and a native browser fallback.
- **AI Gateway & Validation**: Each counselor turn is **one** model round-trip against a lean structured schema returning `{ reply, coachHint }`, validated on arrival. `reply` is client speech only and is what gets spoken aloud; `coachHint` is supervisor analysis and is never spoken. The hint is **visible by default on arrival** — supervision may be dismissible, but never hidden by default. On schema mismatch or missing field, the application fails loudly with the real error.
- **No Fabricated Clinical Content**: No canned text may ever occupy a position where the counselor would reasonably read it as AI-generated clinical analysis — not as a failure fallback, not as an opening hint, not as a generic client line. Scripted demo dialogue is permitted **only** in the explicit no-API-key demo mode, only for cases that ship with an authored script, and only when each scripted turn is visibly marked as scripted. A case with no authored script cannot be roleplayed without a key, and the application says so.
- **Usage Guardrail**: A per-counselor daily cap on model calls, shown in settings alongside the counselor's own key and remaining budget.
- **Security & Secrets**: Provider API keys live only in the counselor's local settings, are sent only to the official provider endpoints, are **never written to any persisted log**, and are **excluded from every exported file** so a portfolio can be handed to a supervisor safely.
- **SSOT**: One authoritative home per fact. The reactive store is the single source read by the interface; the vault is the single durable home for sessions and cases. Derived values — session counts, completion tallies, radar aggregates, progress milestones — are computed in one place from the vault and passed outward, never stored as a second copy.
