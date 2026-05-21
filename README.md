# ASI — Adaptive Symbolic Interface

A patient-facing web app prototype for pain management through personalized symbolic interventions ("placebo boosters"). Designed for clinical trial use under clinician supervision.

> **Ethical Disclaimer:** This is a research prototype supporting medical treatment. It does not replace clinical care. All patient data is for research purposes only and should be handled in accordance with applicable data protection regulations.

---

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS (PWA)
- **Backend:** Python 3.12 + FastAPI
- **Database:** PostgreSQL 18
- **AI:** OpenAI GPT-4o (session scripts) + TTS API (audio)
- **Auth:** JWT (patient / clinician roles)

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 18.3
- Git

### 1. Clone and install

```bash
git clone <repo-url>
cd asi-prototype
```

### 2. Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env — fill in DATABASE_URL, OPENAI_API_KEY, JWT_SECRET
```

### 3. Database

```bash
# Create the database (PostgreSQL must be running)
createdb -U postgres asi_prototype

# Run migrations
alembic upgrade head
```

### 4. Frontend

```bash
cd frontend
npm install
```

### 5. Run

```bash
# Terminal 1 — Backend
cd backend && venv\Scripts\activate && uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open http://localhost:5173

API docs available at http://localhost:8000/docs

---

## Clinician Registration

Clinicians must use an invite code during registration. The code is set via the `CLINICIAN_INVITE_CODE` environment variable (default: `asi-clinician-2025`).

---

## Audio File Storage

Session audio files accumulate in `backend/media/sessions/`. Estimated ~3–5 MB per phase × 3 phases per session. For 30 patients × 30 sessions ≈ 8–13 GB. Add a periodic cleanup script for production use.

---

## Known Limitations (Prototype)

- All clinicians see all patients — add `assigned_clinician_id` before real patient data
- Session generation uses FastAPI BackgroundTasks (in-process) — use Celery/arq for production
- JWT tokens do not refresh — 30-day expiry, no logout endpoint
- No offline PWA caching of audio files

---

## Deployment

See `.cursor/plans/asi_prototype_plan.md` for GCP Compute Engine deployment instructions.
