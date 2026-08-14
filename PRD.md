# PRD: RehabCounselor AI (v1)

### NORTHSTAR
Empower every Hong Kong vocational rehabilitation counselor to master evidence-based counseling (ACT, MI, ICF) through authentic, highly responsive Cantonese AI roleplay and real-time clinical supervision.

### USER
Hong Kong vocational rehabilitation practitioners — including Medical & Rehabilitation Social Workers, Occupational Therapists, Employment Specialists, and Vocational Case Managers.

### PROBLEM
Vocational counselors lack safe, authentic Cantonese roleplay environments with immediate clinical feedback to practice handling severe client resistance, career transition ambivalence, and biopsychosocial assessment.

### USER JOURNEY
1. **Select or Synthesize [Counselor]**: Browse the dossier library of local disability cases or configure bio-psychosocial parameters (disability chip, life stage, MI resistance level) to generate a new profile with verified Cantonese dialogue characteristics.
2. **Interview [Counselor]**: Engage in a spoken Cantonese simulation session using continuous speech-to-text, receiving natural Cantonese voice audio responses strictly matched to the client's gender.
3. **Reflect [Counselor]**: Inspect real-time clinical supervisor hints delivered alongside client dialogue, highlighting detected Change Talk, cognitive fusion, and recommended OARS/ACT interventions.
4. **Classify & Document [Counselor]**: Draft session SOAP notes assisted by the interactive ICF biopsychosocial factor classification dock.
5. **Review & Export [Counselor]**: Finalize the interview to generate a 5-dimension radar skill assessment report and export a formatted clinical portfolio document.

### SUCCESS
A counselor opens case "Ah Keung" (post-stroke minibus driver), speaks a Cantonese reflection via continuous microphone input without cutoff pauses, receives a natural male Cantonese voice response and supervisor hint in under 1.5 seconds, completes the ICF matrix, and exports a finalized SOAP clinical report.

### OUT OF SCOPE
- Hospital Authority CMS / NGO internal intranet EMR live database integration.
- Real patient telehealth video calling or multi-counselor synchronous conference rooms.
- Third-party LMS grading / credentialing accreditation certification servers.

### HARD CONSTRAINTS
- **Roles & Privacy**: Single-user local-first architecture; all session transcripts, SOAP drafts, and custom cases reside exclusively in browser-managed local storage (IndexedDB), ensuring total counselor confidentiality.
- **Capabilities & Voice**: Speech recognition must use continuous Cantonese acoustic models (`yue-Hant-HK` / `zh-Hant-HK`) with pause buffers; voice synthesis must strictly bind audio timbre to the client's profile gender with MiniMax API and Web Speech fallback.
- **AI Gateway & Validation**: Model calls must enforce lean JSON structured schemas returning `{ reply, coachHint }` in a single round-trip, failing loudly on mismatch with no fake data.
- **Security & Secrets**: API keys (Gemini, MiniMax) reside only in client secure local settings and are never transmitted to unauthorized endpoints or logged in code.
- **SSOT**: Application state maintains a single reactive store flowing outwards to UI components and local database stores.
