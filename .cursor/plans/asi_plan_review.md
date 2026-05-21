# ASI Prototype Plan — Critical Review
_Reviewed: May 4, 2026_

## Overall Verdict

The plan is solid for a prototype — the tech stack is appropriate, the structure is clean, and the build order makes sense directionally. But there are **several real risks that could break the demo or the clinical trial context**, plus a handful of schema/API gaps worth addressing before coding starts.

---

## 1. Architecture — Issues

**A. No "failed" status in the session state machine**

The status enum is `scheduled | generating | ready | in_progress | completed | skipped`. If the OpenAI LLM or TTS call fails mid-generation, the session is permanently stuck in `generating`. Add `failed` as a status. The frontend needs to handle this too (show an error state and allow retry).

**B. `FastAPI BackgroundTasks` is fragile for this workload**

Generating 3 LLM scripts + 3 TTS audio files will take 30–90 seconds per session. `BackgroundTasks` runs in the same process — if the server restarts, the job silently vanishes. For a prototype this is tolerable, but you need at minimum: (1) a `failed` status fallback with error capture, and (2) a retry endpoint (`POST /api/sessions/{id}/regenerate` or re-calling generate). Consider noting this as a known risk.

**C. OpenAI TTS has a 4,096-character input limit per call**

A 5–10 minute guided session script will likely exceed this. The plan doesn't mention chunking text or concatenating audio segments. This is a **hard technical blocker** — you'll need either `pydub`-based audio concatenation or a chunking strategy in `tts_service.py`. This should be explicitly addressed in the plan before Phase 4.

**D. Local audio file storage is risky**

Storing files in `backend/media/sessions/` works locally but will break if the server moves, restarts with ephemeral storage, or is containerized. The `audio_*_url` column name is misleading — it's a local path, not a URL. At minimum, rename it `audio_*_path` and document the storage strategy and estimated volume.

**E. CORS is hardcoded to `localhost:5173`**

For a demo where clinicians or patients access from other devices on the same network, this will fail. Make it an env var (`ALLOWED_ORIGINS`) from the start.

---

## 2. Database Schema — Issues

**A. No `failed` status in ritual_sessions (ties to point 1A)**

Add `failed` to the status enum and an optional `error_message` text column.

**B. `valence_dial` and `intervention_type` state lives only in sessions, not on the patient profile**

The adaptation engine needs the "current" state before generating the next session. Add `current_valence_dial (float)` and `current_intervention_type (enum)` to `patient_profiles` as canonical current state. The adaptation engine updates these after each session; the generator reads from them.

**C. `session_number` is ambiguous**

Who sets it? If stored and not derived, it can go out of sync. Either derive it at query time (`ROW_NUMBER() OVER (ORDER BY session_date)`) or explicitly document that the backend sets it on creation by counting existing sessions.

**D. No `adaptation_log` table — this is more important than deferred**

In a clinical trial context, being unable to explain *why* the system changed a patient's valence dial is a research validity problem. Even a minimal table — `patient_id, session_id, old_valence, new_valence, old_intervention_type, new_intervention_type, trigger_reason (text), created_at` — covers the research auditability requirement. This should be MVP, not deferred.

**E. `gender` has no defined values**

It's just `text`. Define expected values or use an enum to avoid inconsistent data.

**F. `assigned_clinician_id` deferred is a real ethical risk**

If a patient's PHI is visible to all registered clinicians, that's a problem even in a prototype clinical trial. Note this as a known ethical gap requiring resolution before real patients are enrolled.

---

## 3. API Design — Issues

**A. Open clinician self-registration is a security gap**

`POST /api/auth/register` allows anyone to create a clinician account. At minimum, require an invite code or env-var-configured admin password to register as a clinician. Patient self-registration is fine.

**B. Session generation trigger is undefined in the UX flow**

The API has `POST /api/sessions/generate`, but the plan doesn't specify *when* this is called. For a clinical trial, sessions should ideally be pre-generated before the patient's treatment appointment — not triggered on demand. This UX decision needs to be explicit in the plan.

**C. Adaptation engine trigger is not wired to an API endpoint**

When does `adaptation_engine.py` run? After `POST /api/sessions/{id}/feedback` for the "overall" phase? After `PATCH` sets status to `completed`? Document and implement a clear trigger.

**D. Missing `GET /api/users/me`**

The frontend needs to know the current user's role (patient vs. clinician) for routing. Add `GET /api/users/me` returning `{id, email, role}`.

**E. Audio streaming needs range request support**

Mobile audio players send HTTP Range requests for seeking and buffering. Use FastAPI's `FileResponse` (which handles range requests natively), not `StreamingResponse`. Otherwise the audio player will have seeking issues on mobile.

---

## 4. Adaptation Engine — Issues

**A. "Helping" reinforce rule is logically a no-op**

> If majority feedback was "helping": nudge valence by 0.05 toward current position (reinforce)

Nudging toward the current position changes nothing mathematically. This rule either means "increase valence by 0.05 toward 1.0" or "no change." Clarify the intent.

**B. No handling for missing feedback**

If a patient completes a session but doesn't submit feedback, the adaptation engine has nothing to work with. Define the behavior: no change, or treat as "neutral."

**C. Alternation override rules can conflict**

The "keep for one more session if benefit >= 4" and "force switch if 3+ consecutive low benefit" rules can interact ambiguously (e.g., 3 consecutive sessions, benefit = 4 on session 3). Document rule precedence.

---

## 5. Missing from the Plan

**A. TTS character limit handling strategy** _(critical — blocks Phase 4)_

Decide before coding: chunk scripts + concatenate audio (needs `pydub`), or constrain script length in the LLM prompt. Add this to the plan.

**B. Audio storage volume estimate**

3 files × ~3–5 MB × 30 patients × 30 sessions = ~8–13 GB on the server. Note this and define a cleanup policy.

**C. Voice sample pre-generation is unspecified**

The plan mentions 6 pre-generated MP3 clips in `frontend/public/voice-samples/` but doesn't say who generates them or when. Add as an explicit task in Phase 3: call the TTS API once per voice with a sample sentence, store the files.

**D. LLM prompt input sanitization**

Patient-provided text (`pain_type`, `treatment_context`, `post_session_notes`) goes directly into the GPT prompt. Add at minimum a character limit and basic input cleaning before prompt injection.

**E. Time zone handling for `session_date`**

If the server runs UTC and patients are in US timezones, "today" can be ambiguous late at night. Document how `session_date` is assigned and handle it consistently.

**F. Demo seed data should be in Phase 6, not deferred entirely**

A seed script (1 clinician, 3 patients with 5–7 completed sessions and feedback) is essential for demo readiness. Promote to Phase 6.

**G. Data handling / ethical positioning**

Add a note in the README or onboarding screen: "This is a research prototype supporting your medical treatment. It does not replace clinical care." Aligns with the PRD's clinical trial framing.

---

## 6. Build Order — Minor Adjustments

- **Phase 4 is too large.** Split into 4a (backend: session generation + audio endpoints, testable via Postman) and 4b (frontend: ritual player).
- **Add "error states + loading states" as an explicit Phase 6 task**, not implied under "polish."
- **Promote `adaptation_log` to Phase 4**, not deferred.
- **Add voice sample pre-generation to Phase 3.**

---

## Summary Table

| Area | Status | Key Risk |
|---|---|---|
| Architecture | Mostly good | TTS character limit (hard blocker), no `failed` state |
| Database schema | Good foundation | Missing `adaptation_log`, no canonical adaptation state on profile |
| API design | Clean | Clinician self-registration, undefined generation trigger, no `/users/me` |
| Adaptation engine | Good for MVP | "Helping" reinforce rule is broken, missing feedback edge case |
| Build order | Sensible | Phase 4 too large, seed data deferred too aggressively |

**Highest priority before Phase 4 coding starts:** resolve the TTS character limit strategy — it affects the fundamental architecture of the audio generation pipeline.
