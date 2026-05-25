ASI Prototype Build Plan

Context (for the executing agent)

The Adaptive Symbolic Interface (ASI) is a patient-facing digital system that enhances therapeutic outcomes in pain management by delivering personalized symbolic interventions ("placebo boosters") alongside standard medical treatment. It operates under clinician supervision and is designed for a clinical trial environment.

This is a prototype/demo targeting pain clinic doctors and researchers. It must feel trustworthy and clinical. It is NOT production-ready -- it's a proof of concept to demonstrate the system's potential.

The full PRD is attached separately. Key product components:





Patient Portal -- onboarding, intake questionnaire, personalization (voice/tone preferences, pain profile)



Daily Ritual Interface -- audio-guided sessions (5-10 min) with structured phases (before/during/after treatment)



Feedback & Adaptation Engine -- in-session and post-session feedback that adapts future sessions



Clinician Dashboard -- lightweight view of patient participation and feedback logs



Tech Stack





Frontend: React 18+ with TypeScript, Vite, Tailwind CSS. Built as a PWA (installable on phones)



Backend: Python 3.11+ with FastAPI



Database: PostgreSQL (use psycopg2 or asyncpg)



AI Content Generation: OpenAI API (GPT-4o or similar) for generating personalized ritual session scripts



Audio/TTS: OpenAI TTS API (tts-1 or tts-1-hd model) for converting session scripts to audio



Auth: Simple JWT-based auth (patient vs clinician roles)



Dev Environment: Windows native (no WSL)



Deployment: GCP Compute Engine e2-small (Ubuntu 24.04, 2GB RAM, ~$13/mo covered by $300 free credit) with Nginx reverse proxy. PostgreSQL runs on the same instance.



Project Structure

asi-prototype/
├── frontend/                  # React PWA
│   ├── public/
│   │   ├── manifest.json     # PWA manifest
│   │   └── voice-samples/    # Pre-generated TTS preview MP3s (6 files)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Layout.tsx
│   │   │   ├── AudioPlayer.tsx
│   │   │   └── FeedbackWidget.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Onboarding.tsx       # Patient intake
│   │   │   ├── Dashboard.tsx        # Patient home
│   │   │   ├── RitualSession.tsx    # Daily guided session
│   │   │   ├── SessionHistory.tsx   # Past sessions
│   │   │   └── ClinicianDashboard.tsx
│   │   ├── hooks/
│   │   ├── services/          # API client
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app entry
│   │   ├── config.py          # Settings / env vars
│   │   ├── database.py        # DB connection + session
│   │   ├── models/            # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── patient_profile.py
│   │   │   ├── session.py
│   │   │   ├── feedback.py
│   │   │   └── adaptation_log.py
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── routers/           # API route handlers
│   │   │   ├── auth.py
│   │   │   ├── patients.py
│   │   │   ├── sessions.py
│   │   │   ├── feedback.py
│   │   │   └── clinician.py
│   │   ├── services/          # Business logic
│   │   │   ├── session_generator.py   # LLM script generation
│   │   │   ├── tts_service.py         # OpenAI TTS integration
│   │   │   ├── adaptation_engine.py   # Rule-based adaptation
│   │   │   └── auth_service.py
│   │   └── utils/
│   ├── alembic/               # DB migrations
│   ├── scripts/
│   │   ├── generate_voice_samples.py  # One-time: generates 6 voice preview MP3s
│   │   └── seed_demo_data.py          # Creates demo patients, sessions, feedback
│   ├── media/
│   │   └── sessions/          # Generated audio files (gitignored)
│   ├── requirements.txt
│   ├── alembic.ini
│   └── .env                   # API keys (OPENAI_API_KEY, DB URL, JWT secret)
├── README.md
└── .gitignore



Database Schema (PostgreSQL)

users





id (UUID, PK)



email (unique)



password_hash



role (enum: patient | clinician)



created_at

patient_profiles





id (UUID, PK)



user_id (FK -> users)



first_name, age



gender (text -- frontend presents dropdown: Male, Female, Non-binary, Prefer not to say, Other)



pain_type (text -- e.g., chronic back, neuropathic)



pain_level_baseline (int 1-10)



treatment_context (text -- current medications/treatment; max 500 chars, sanitized before use in LLM prompts)



tone_preference (enum: direct_informative | supportive_sustaining | balanced)



voice_preference (text -- maps to OpenAI TTS voice: alloy, echo, fable, onyx, nova, shimmer)



communication_style (text)



current_valence_dial (float 0-1 -- canonical current adaptation state; initialized from tone_preference, updated by adaptation engine after each session)



current_intervention_type (enum: cognitive_reframing | interoceptive_attention -- canonical current state; initialized to cognitive_reframing)



created_at, updated_at

ritual_sessions





id (UUID, PK)



patient_id (FK -> patient_profiles)



session_number (int -- set by the backend on creation by counting existing sessions for this patient + 1; never derived at query time)



session_date (date -- the patient's local date, sent from the frontend; not derived server-side to avoid timezone ambiguity)



status (enum: scheduled | generating | ready | in_progress | completed | skipped | failed)



error_message (text, nullable -- populated when status is "failed"; stores the error for debugging/retry)



current_phase (enum: before | during | after | null) -- tracks where the patient is in the session; null when not in progress



script_before (text -- generated script for the Before phase)



script_during (text -- generated script for the During phase)



script_after (text -- generated script for the After phase)



audio_before_path (text -- local file path to Before phase audio file)



audio_during_path (text -- local file path to During phase audio file)



audio_after_path (text -- local file path to After phase audio file)



intervention_type (enum: cognitive_reframing | interoceptive_attention)



valence_dial (float 0-1, where 0=direct/informative, 1=supportive/sustaining)



duration_seconds (int)



started_at (timestamp, nullable -- when patient started the session)



completed_at (timestamp, nullable -- when patient finished the session)



created_at

session_feedback





id (UUID, PK)



session_id (FK -> ritual_sessions)



phase (enum: before | during | after | overall) -- which phase this feedback is for; "overall" for post-session



in_session_rating (enum: helping | neutral | not_helping, nullable) -- for per-phase in-session feedback



post_pain_level (int 1-10, nullable) -- only for "overall" phase



post_session_notes (text, optional) -- only for "overall" phase



perceived_benefit (int 1-5, nullable) -- only for "overall" phase



created_at

NOTE: Multiple feedback rows per session are expected (one per phase + one overall post-session).

adaptation_log





id (UUID, PK)



patient_id (FK -> patient_profiles)



session_id (FK -> ritual_sessions -- the session whose feedback triggered this adaptation)



old_valence (float)



new_valence (float)



old_intervention_type (enum: cognitive_reframing | interoceptive_attention)



new_intervention_type (enum: cognitive_reframing | interoceptive_attention)



trigger_reason (text -- human-readable explanation, e.g., "majority feedback was not_helping; decreased valence by 0.15")



created_at

NOTE: One row per adaptation decision. Written by the adaptation engine after processing session feedback. Essential for clinical trial research auditability.



API Endpoints

Auth





POST /api/auth/register -- create account (email, password, role). If role is clinician, requires a valid invite_code matching the CLINICIAN_INVITE_CODE env var.



POST /api/auth/login -- returns JWT token



GET /api/users/me -- returns current user info {id, email, role} (used by frontend for role-based routing)

Patient Onboarding





POST /api/patients/profile -- create/update patient profile (intake questionnaire)



GET /api/patients/profile -- get current patient's profile

Sessions





POST /api/sessions/generate -- kick off session generation (returns immediately with status: generating; runs LLM + TTS in background via FastAPI BackgroundTasks)



GET /api/sessions/current -- get today's session (poll this until status changes from "generating" to "ready")



GET /api/sessions/history -- list past sessions



GET /api/sessions/{id} -- get specific session details



PATCH /api/sessions/{id} -- update session status (e.g., in_progress, completed) and current_phase



GET /api/sessions/{id}/audio/{phase} -- serve audio file for a specific phase (before, during, or after). Use FastAPI FileResponse (NOT StreamingResponse) to get native HTTP Range request support for mobile audio seeking.

NOTE on generate: This endpoint must check if a session already exists for today before creating a new one (re-generation guard). Exception: if today's session has status: failed, allow re-generation (retry).

Feedback





POST /api/sessions/{id}/feedback -- submit feedback for a session phase (include phase in body; multiple submissions per session allowed). When phase is "overall", this triggers the adaptation engine to compute next-session parameters and update patient_profiles.current_valence_dial and current_intervention_type. The adaptation log entry is also written at this point.



GET /api/sessions/{id}/feedback -- get all feedback entries for a session

Clinician





GET /api/clinician/patients -- list all patients



GET /api/clinician/patients/{id}/summary -- patient engagement summary



GET /api/clinician/patients/{id}/sessions -- patient session history with feedback



AI Integration Details

Session Script Generation (OpenAI GPT-4o)

The session_generator.py service builds a prompt that includes:





Patient's pain profile, tone preference, and communication style from their profile



The intervention type for this session (cognitive reframing OR interoceptive attention)



The current valence dial position



Session number (to vary content over time)



Feedback from previous sessions (to adapt)

Example system prompt:

You are a therapeutic session script writer for a pain management support system.
Generate a guided session script with three phases:
1. BEFORE (2-3 min): Expectation shaping, framing the upcoming treatment action
2. DURING (3-5 min): Attention modulation during treatment (pill intake / cream application)
3. AFTER (2-3 min): Memory reinforcement, positive anchoring

Patient context: {patient_profile}
Intervention type: {intervention_type}
Tone: {valence_description}
Session number: {session_number}
Previous feedback summary: {feedback_summary}

Write in second person ("you"). Be warm but clinical.

IMPORTANT CONSTRAINTS:
- Each phase script MUST be under 400 words / 3500 characters (hard limit for audio generation)
- Keep language natural and flowing for spoken delivery

Output as JSON with keys:
before_script, during_script, after_script

Input sanitization: Patient-provided text fields (pain_type, treatment_context, post_session_notes) are included in the prompt. Before insertion: strip to max 500 characters and remove any prompt-like patterns (e.g., lines starting with "System:", "You are", etc.).

Text-to-Speech (OpenAI TTS API)





Model: tts-1-hd for quality (or tts-1 for speed during dev)



Voice: selected from patient's voice_preference (alloy, echo, fable, onyx, nova, shimmer)



Generate 3 separate audio files per session (one per phase: before, during, after) -- this makes it easy to pause between phases for treatment action cues



Store audio files locally in backend/media/sessions/{session_id}_before.mp3, {session_id}_during.mp3, {session_id}_after.mp3



Serve via FastAPI FileResponse (supports HTTP Range requests for mobile seeking)

TTS character limit handling: OpenAI TTS has a 4,096-character input limit per call. Strategy:





Primary: The LLM prompt constrains each phase script to ~400 words / 3,500 characters. This should keep scripts under the limit in almost all cases.



Fallback: tts_service.py checks script length before calling TTS. If a script exceeds 4,000 characters, chunk it at sentence boundaries, make multiple TTS calls, and concatenate the audio using pydub. Add pydub to requirements.txt for this.



Hard fail: If a single sentence exceeds 4,096 characters (shouldn't happen with natural language), truncate and log a warning.

Estimated storage: ~3-5 MB per phase x 3 phases x sessions. For 30 patients x 30 sessions = ~8-13 GB. Acceptable for a prototype; document in README that audio files accumulate and should be periodically cleaned in production.

Voice Previews for Onboarding





Pre-generate 6 short MP3 clips (one per OpenAI TTS voice: alloy, echo, fable, onyx, nova, shimmer) with a standard sample sentence



Store as static assets in frontend/public/voice-samples/



No API call needed during onboarding -- just play the local file



Frontend Pages (Key Screens)

1. Login / Register





Simple email + password form



Role selection (patient / clinician) during registration



Clean, clinical design -- white/blue color scheme, no playful elements

2. Patient Onboarding (multi-step form)





Step 1: Basic info (name, age, gender)



Step 2: Pain profile (pain type, baseline level 1-10, treatment context)



Step 3: Preferences (tone preference slider or choice, voice selection with audio previews, communication style)



Step 4: Review and confirm



Progress bar across the top

3. Patient Dashboard





Today's session card (status: ready / completed / not yet generated / generating / failed)



Quick stats: sessions completed, streak, average pain trend



"Start Today's Session" button (prominent). UX flow: If no session exists for today, tapping this calls POST /api/sessions/generate, then polls GET /api/sessions/current showing a "Generating your session..." state. If session is failed, show error + "Retry" button. If session is ready, navigate to the ritual player.



Recent session history list

4. Ritual Session Player (core experience)





Full-screen audio player interface



Phase indicator (Before / During / After) with progress



Visual cues for treatment actions ("Take your medication now", "Apply the cream now")



In-session feedback button (Helping / Neutral / Not Helping)



Post-session feedback form (pain level slider, perceived benefit, optional notes)



Calming, focused design -- minimal distractions

5. Session History





List of past sessions with date, completion status, feedback given



Click to see session details and feedback

6. Clinician Dashboard





Patient list with engagement metrics (sessions completed, adherence rate, avg pain trend)



Click patient to see their session history and feedback logs



No real-time intervention controls (MVP)

UI Design Direction





Color palette: Clinical blues and whites, soft grays, subtle teal accents



Typography: Clean sans-serif (Inter or similar)



Tone: Professional, trustworthy, calming -- appropriate for a medical context



Mobile-first responsive design (PWA target)



Build Order (Step by Step)

Phase 1: Project Scaffolding





Initialize React app with Vite + TypeScript + Tailwind



Initialize FastAPI project with folder structure



Set up PostgreSQL database and Alembic migrations



Set up PWA manifest and service worker basics



Add CORS middleware to FastAPI (CORSMiddleware with origins from ALLOWED_ORIGINS env var; defaults to http://localhost:5173)



Configure Vite proxy in vite.config.ts to forward /api requests to http://localhost:8000



Create .env files, .gitignore, README.md



Initialize git repo

Phase 2: Auth + Database





Implement SQLAlchemy models for all tables (using the updated schema with per-phase fields, adaptation_log, canonical adaptation state on patient_profiles)



Run Alembic migrations to create tables



Build auth endpoints (register, login, JWT) with clinician invite code protection



Build GET /api/users/me endpoint for role-based frontend routing



Build login/register pages in React (clinician registration requires invite code field)



Set up API client with auth headers in frontend

Phase 3: Patient Onboarding





Build patient profile API endpoints (initializes current_valence_dial from tone_preference and current_intervention_type to cognitive_reframing)



Build multi-step onboarding form in React



Store patient profiles in DB



Generate voice preview samples: Create a one-time script (backend/scripts/generate_voice_samples.py) that calls OpenAI TTS for each of the 6 voices with a standard sample sentence, outputs MP3 files to frontend/public/voice-samples/. Run once, commit the MP3s. Include voice preview player in onboarding step 3.

Phase 4a: Session Generation Backend (AI Integration)

Build and test entirely via Swagger/Postman before starting the frontend.





Implement session_generator.py with OpenAI GPT-4o integration (outputs 3 scripts: before, during, after; enforces ~400 word/3500 char limit per phase)



Implement tts_service.py with OpenAI TTS integration (generates 3 audio files per session; includes character limit chunking fallback with pydub)



Build async session generation endpoint (returns immediately with status: generating, runs LLM + TTS in background via BackgroundTasks). Wrap the background task in try/except -- on failure, set status: failed and populate error_message.



Add re-generation guard (don't generate if today's session already exists; allow retry if status: failed)



Build session status update endpoint (PATCH /api/sessions/{id})



Build per-phase audio endpoint (GET /api/sessions/{id}/audio/{phase}) using FileResponse



Implement adaptation engine with concrete rules (see Adaptation Rules below). Reads canonical state from patient_profiles.current_valence_dial / current_intervention_type. Writes updated state back + creates adaptation_log entry. Triggered by POST /api/sessions/{id}/feedback when phase is "overall".

Phase 4b: Ritual Player Frontend

Depends on Phase 4a being testable.





Build the ritual session player page with 3-phase audio playback



Phase indicator (Before / During / After) with progress bar



Pause between phases for treatment action cues ("Take your medication now", "Apply the cream now")



Per-phase feedback buttons (Helping / Neutral / Not Helping) shown at end of each phase



Post-session feedback form (pain level slider, perceived benefit, optional notes)



Polling mechanism to wait for session generation to complete (poll GET /api/sessions/current until status changes from generating to ready)



Error state handling: If session status is failed, show error message and "Retry" button (re-calls generate)



Calming, focused design -- minimal distractions

Phase 5: History + Clinician View + Adaptation Log





Build session history page for patients



Build clinician dashboard (patient list, engagement summary, session logs)



Adaptation log view in clinician dashboard: Show adaptation history per patient (old/new valence, old/new intervention type, trigger reason). Important for clinical trial research auditability -- clinicians/researchers need to see why the system changed parameters.

Phase 6: Polish + PWA





Add explicit loading, error, and empty states across all pages (not just "polish" -- treat as a real task)



Add PWA install prompt



Test mobile responsiveness



Polish UI for clinical demo readiness



Seed data script (backend/scripts/seed_demo_data.py): creates 1 clinician, 3 patients with 5-7 completed sessions each and feedback. Essential for demo readiness.



Ethical disclaimer in onboarding and README: "This is a research prototype supporting your medical treatment. It does not replace clinical care."

Phase 7: Deploy to GCP Compute Engine





Create a GCP account and activate $300 free trial credit



Provision an e2-small VM (2 vCPU, 2GB RAM, 20GB boot disk + 40GB data disk, Ubuntu 24.04)



Reserve a static external IP and attach to the VM



Create firewall rules for HTTP (80) and HTTPS (443)



Install PostgreSQL, Python, Node.js, Nginx, ffmpeg



Clone repo, set up backend venv, build frontend, run migrations



Configure Nginx as reverse proxy (static files + API)



Set up systemd service for uvicorn



Configure production .env (DB credentials, OpenAI key, ALLOWED_ORIGINS)



Optional: point a domain + SSL via Let's Encrypt



Verify end-to-end: registration, onboarding, session generation, audio playback, clinician dashboard



See "Deployment (GCP Compute Engine)" section below for detailed steps



Adaptation Engine Rules

The adaptation engine (adaptation_engine.py) uses these concrete rules for the prototype.

Trigger: Runs when POST /api/sessions/{id}/feedback receives the "overall" phase feedback. Reads canonical state from patient_profiles.current_valence_dial and current_intervention_type. Writes updated state back to the profile and creates an adaptation_log entry with the old/new values and trigger reason.

Missing feedback handling: If a patient completes a session but submits no phase feedback (only overall, or nothing), treat as "neutral" -- no valence change.

Initial Values (set during onboarding on patient_profiles)





tone_preference = direct_informative -> current_valence_dial = 0.2



tone_preference = balanced -> current_valence_dial = 0.5



tone_preference = supportive_sustaining -> current_valence_dial = 0.8



current_intervention_type always starts as cognitive_reframing

Valence Dial Adjustment (after each session)





If majority of phase feedback was "not_helping" AND valence > 0.3: decrease valence by 0.15



If majority of phase feedback was "not_helping" AND valence <= 0.3: increase valence by 0.15 (try the other direction)



If majority of phase feedback was "helping": no change (current approach is working; don't fix what isn't broken)



If majority was "neutral" or no phase feedback was submitted: no change

Intervention Type Switching





Default: alternate between cognitive_reframing and interoceptive_attention every 2 sessions



Override (higher priority): if perceived_benefit >= 4 for current type, keep it for one more session before alternating



Override (lower priority): if same intervention type for 3+ consecutive sessions AND average perceived_benefit < 3, force switch to the other type



Rule precedence: the "high benefit keep" rule is checked first; if it doesn't apply, the "low benefit force switch" rule is checked; if neither applies, the default alternation runs

Valence Bounds





Clamp valence_dial to range [0.0, 1.0]



Never adjust by more than 0.2 in a single session



Environment Setup (for personal Cursor on Windows)

Prerequisites to install on Windows:





Node.js 20+: Download from nodejs.org



Python 3.11+: Download from python.org (check "Add to PATH")



PostgreSQL 16: Download from postgresql.org Windows installer



Git: Download from git-scm.com

First-time setup commands:

# Create project folder
mkdir C:\Users\SHARIAS\Projects\asi-prototype
cd C:\Users\SHARIAS\Projects\asi-prototype

# Initialize git
git init

# Frontend setup
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install tailwindcss @tailwindcss/vite react-router-dom axios
cd ..

# Backend setup
mkdir backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install fastapi uvicorn sqlalchemy alembic psycopg2-binary pydantic python-jose[cryptography] passlib[bcrypt] python-dotenv openai python-multipart pydub
pip freeze > requirements.txt
cd ..

Required API Keys (in backend/.env):

DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/asi_prototype
OPENAI_API_KEY=sk-...
JWT_SECRET=generate-a-random-string-here
CLINICIAN_INVITE_CODE=a-shared-secret-for-clinician-registration
ALLOWED_ORIGINS=http://localhost:5173



Deployment (GCP Compute Engine)

Why GCP





$300 free credit for new accounts -- covers ~20+ months of hosting at $0 out of pocket



Persistent disk solves the audio file storage problem -- no Cloud Storage / S3 needed



Stable static IP from day one



PostgreSQL runs on the same VM -- simple, no managed DB cost



If the trial gets greenlit, the deployment is already in place -- and you can scale up the VM size or migrate to Cloud SQL later if needed



Estimated cost: ~$13/mo (fully covered by free credit)

VM Specs





Image: Ubuntu 24.04 LTS



Machine type: e2-small (2 vCPU shared, 2GB RAM) -- ~$13/mo



Boot disk: 20GB balanced persistent disk (included)



Region: Closest to your user base (e.g., us-west1 for US West)



Firewall: Allow HTTP + HTTPS traffic (checkboxes during creation)

Provisioning via GCP Console

1. Create your GCP account + free trial:





Go to https://cloud.google.com and click "Get started for free"



Sign in with a Google account, add a payment method (won't be charged during free trial)



You'll see $300 credit with 90-day expiry in the billing dashboard

2. Create the VM:





Go to Compute Engine -> VM instances -> "Create Instance"



Name: asi-prototype



Region: us-west1 (or closest to you), Zone: us-west1-a



Machine type: e2-small (2 vCPU, 2GB memory)



Boot disk: Click "Change" -> Ubuntu 24.04 LTS, 60GB balanced persistent disk



Firewall: Check both "Allow HTTP traffic" and "Allow HTTPS traffic"



Click "Create"

3. Reserve a static IP:





Go to VPC Network -> IP addresses -> "Reserve External Static Address"



Name: asi-static-ip, Region: same as your VM



Attach to: your asi-prototype VM



Note down the IP address

4. SSH into the VM:





Easiest: Click the "SSH" button next to your VM in the console (opens browser terminal -- no key management needed)



Or use gcloud: gcloud compute ssh asi-prototype --zone=us-west1-a

Server Setup Steps

1. Initial server configuration:

sudo apt update && sudo apt upgrade -y
sudo adduser asi
sudo usermod -aG sudo asi
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

2. Install dependencies:

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Python 3.11+
sudo apt install -y python3 python3-venv python3-pip

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Nginx
sudo apt install -y nginx

# ffmpeg (required by pydub for audio concatenation)
sudo apt install -y ffmpeg

3. Set up PostgreSQL:

sudo -u postgres createuser asi_user
sudo -u postgres createdb asi_prototype -O asi_user
sudo -u postgres psql -c "ALTER USER asi_user WITH PASSWORD 'your-db-password';"

4. Deploy the app (as asi user):

sudo su - asi
git clone <your-repo-url> ~/asi-prototype
cd ~/asi-prototype

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Edit with production values
alembic upgrade head   # Run migrations
mkdir -p media/sessions
deactivate
cd ..

# Frontend
cd frontend
npm install
npm run build   # Produces dist/ folder
cd ..

5. Nginx config (/etc/nginx/sites-available/asi):

server {
    listen 80;
    server_name your-domain.com;   # Or the static IP

    # Frontend (built static files)
    location / {
        root /home/asi/asi-prototype/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;  # Long timeout for session generation polling
    }
}

sudo ln -s /etc/nginx/sites-available/asi /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

6. systemd service (/etc/systemd/system/asi-backend.service):

[Unit]
Description=ASI FastAPI Backend
After=network.target postgresql.service

[Service]
User=asi
WorkingDirectory=/home/asi/asi-prototype/backend
Environment="PATH=/home/asi/asi-prototype/backend/venv/bin"
EnvironmentFile=/home/asi/asi-prototype/backend/.env
ExecStart=/home/asi/asi-prototype/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target

sudo systemctl enable asi-backend
sudo systemctl start asi-backend

7. SSL with Let's Encrypt (if using a domain):

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

If using just the static IP (no domain), skip this -- the app will run on HTTP. For the demo period this is fine.

Production .env differences

DATABASE_URL=postgresql://asi_user:your-db-password@localhost:5432/asi_prototype
OPENAI_API_KEY=sk-...
JWT_SECRET=<generate with: python3 -c "import secrets; print(secrets.token_hex(32))">
CLINICIAN_INVITE_CODE=<your-shared-code>
ALLOWED_ORIGINS=https://your-domain.com

Deploying updates

gcloud compute ssh asi-prototype --zone=us-west1-a   # Or use browser SSH
sudo su - asi
cd ~/asi-prototype
git pull
cd frontend && npm run build && cd ..
cd backend && source venv/bin/activate && pip install -r requirements.txt && alembic upgrade head && deactivate
sudo systemctl restart asi-backend

Cost monitoring





Go to Billing -> Budgets & alerts -> Create a budget alert at $15/mo so you're notified if costs exceed expectations



The free trial $300 credit has a 90-day expiry. After that, remaining credit expires but the account converts to a regular paid account. The VM continues running and you'll be charged ~$13/mo.



To avoid surprise charges after the trial: set a billing alert, and if you're not actively using the prototype, stop (don't delete) the VM -- stopped VMs only incur disk storage cost (~$3/mo)

Domain (optional but recommended)





Buy a cheap domain (~$10/year) from Namecheap, Cloudflare, or Google Domains



Add an A record pointing to your GCP static IP



Run certbot for HTTPS



Alternatively, GCP has Cloud DNS ($0.20/mo per zone) if you want to keep everything in GCP



Without a domain, users access via http://<static-ip> -- functional but looks less professional for a clinical demo



Key Design Decisions Summary





PWA over native app -- installable web app for prototype, native later



OpenAI TTS for audio generation (dynamic, good quality, simple API)



OpenAI GPT-4o for session script generation (fully personalized content)



Rule-based adaptation engine for MVP (not ML-based) -- adjusts valence dial and intervention type based on patient feedback patterns



SQLite is NOT used -- PostgreSQL for closer-to-production data handling



No voice cloning in prototype -- uses OpenAI's predefined voices



No real-time clinician intervention -- clinicians view data only



Known Risks + Mitigations





FastAPI BackgroundTasks fragility: Session generation runs in-process. If the server restarts mid-generation, the job vanishes and the session is stuck in generating. Mitigation: the failed status + error capture + retry guard handle the most common failure modes. For production, move to a proper task queue (Celery, arq). This is a known and accepted prototype limitation.



Clinician-patient assignment: All clinicians see all patients in the prototype. This is an ethical risk for real patient data -- before enrolling real patients, add assigned_clinician_id to patient_profiles. Add a prominent warning in the README.



Audio file accumulation: Audio files accumulate in backend/media/sessions/ with no cleanup. Estimated ~8-13 GB for a 30-patient, 30-session trial. Document in README; add cleanup scripts for production.

Future Considerations (Not for Prototype)

These items were identified during review but are intentionally deferred past the prototype stage:





Token refresh / logout endpoints -- set JWT expiry to 30 days for prototype



Offline PWA caching -- service worker caching of audio files for unreliable connectivity



Experiment signal telemetry -- timing patterns, drop-off points, response latency tracking



Notification/reminder system -- push notifications for daily sessions



"Symbolic plan" entity -- explicit plan object after onboarding (implicit in profile + adaptation engine for now)



Data export for researchers -- CSV/JSON export of trial data



How to Start the Server Locally

Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 18.3 (must be running)
- Git

First-Time Setup

Backend:

cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — fill in DATABASE_URL, OPENAI_API_KEY, JWT_SECRET, ALLOWED_ORIGINS

Required values in backend/.env:

DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/asi_prototype
OPENAI_API_KEY=sk-...
JWT_SECRET=generate-a-random-string-here
CLINICIAN_INVITE_CODE=a-shared-secret-for-clinician-registration
ALLOWED_ORIGINS=http://localhost:5173

Database (run once, or after schema changes):

createdb -U postgres asi_prototype
alembic upgrade head

Frontend:

cd frontend
npm install

Running the Dev Servers

Open two terminals from the project root:

# Terminal 1 — Backend (http://localhost:8000)
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev

Open http://localhost:5173 in your browser.
API docs (Swagger UI) are available at http://localhost:8000/docs.



Demo Users and Passwords

These accounts are created by the demo seed script (backend/scripts/seed_demo_data.py). They are not added automatically by migrations — run the seed script after setting up the database:

cd backend
venv\Scripts\activate
python scripts/seed_demo_data.py

All demo accounts share the same password: demo1234

| Role      | Email               | Password | Notes |
|-----------|---------------------|----------|-------|
| Clinician | clinician@demo.com | demo1234 | Access to clinician dashboard |
| Patient   | alice@demo.com      | demo1234 | Alice — chronic lower back pain (7 completed sessions) |
| Patient   | bob@demo.com        | demo1234 | Bob — neuropathic pain, right leg (5 completed sessions) |
| Patient   | carol@demo.com      | demo1234 | Carol — fibromyalgia (6 completed sessions) |

The seed script is idempotent — re-running it skips users that already exist.

