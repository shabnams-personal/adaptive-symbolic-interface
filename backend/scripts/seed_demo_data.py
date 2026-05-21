"""
Seed the database with demo data for presentations.

Creates:
  - 1 clinician account
  - 3 patient accounts with profiles
  - 5-7 completed sessions per patient with feedback and adaptation logs

Usage:
    cd backend
    venv\\Scripts\\activate
    python scripts/seed_demo_data.py

Credentials after seeding:
  Clinician: clinician@demo.com / demo1234
  Patient 1: alice@demo.com / demo1234
  Patient 2: bob@demo.com / demo1234
  Patient 3: carol@demo.com / demo1234
"""

import os
import sys
import uuid
from datetime import datetime, timezone, date, timedelta
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.session import RitualSession
from app.models.feedback import SessionFeedback
from app.models.adaptation_log import AdaptationLog
from app.services.auth_service import hash_password
from app.database import Base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/asi_prototype")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

DEMO_PASSWORD = "demo1234"

PATIENTS = [
    {
        "email": "alice@demo.com",
        "first_name": "Alice",
        "age": 45,
        "gender": "Female",
        "pain_type": "Chronic lower back pain",
        "pain_level_baseline": 7,
        "treatment_context": "Currently taking naproxen, awaiting physiotherapy referral",
        "tone_preference": "supportive_sustaining",
        "voice_preference": "nova",
        "communication_style": "Prefer warm, encouraging language",
        "sessions": 7,
    },
    {
        "email": "bob@demo.com",
        "first_name": "Bob",
        "age": 58,
        "gender": "Male",
        "pain_type": "Neuropathic pain — right leg",
        "pain_level_baseline": 6,
        "treatment_context": "Gabapentin 300mg twice daily",
        "tone_preference": "direct_informative",
        "voice_preference": "onyx",
        "communication_style": "Keep it brief and clinical",
        "sessions": 5,
    },
    {
        "email": "carol@demo.com",
        "first_name": "Carol",
        "age": 38,
        "gender": "Female",
        "pain_type": "Fibromyalgia",
        "pain_level_baseline": 8,
        "treatment_context": "Duloxetine 60mg, mindfulness practice",
        "tone_preference": "balanced",
        "voice_preference": "shimmer",
        "communication_style": "I appreciate both facts and emotional support",
        "sessions": 6,
    },
]

VALENCE_MAP = {
    "direct_informative": 0.2,
    "balanced": 0.5,
    "supportive_sustaining": 0.8,
}

RATINGS = ["helping", "helping", "neutral", "not_helping"]
BENEFITS = [3, 4, 4, 5, 3, 4]


def create_user(email: str, role: str) -> User:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"  User {email} already exists — skipping")
        return existing
    user = User(id=str(uuid.uuid4()), email=email, password_hash=hash_password(DEMO_PASSWORD), role=role)
    db.add(user)
    db.flush()
    return user


print("Seeding demo data...")

# Clinician
clinician_user = create_user("clinician@demo.com", "clinician")
print(f"  Clinician: {clinician_user.email}")

# Patients
for p_data in PATIENTS:
    patient_user = create_user(p_data["email"], "patient")

    existing_profile = db.query(PatientProfile).filter(PatientProfile.user_id == patient_user.id).first()
    if existing_profile:
        print(f"  Patient {p_data['first_name']} already has a profile — skipping")
        continue

    valence = VALENCE_MAP[p_data["tone_preference"]]
    profile = PatientProfile(
        id=str(uuid.uuid4()),
        user_id=patient_user.id,
        first_name=p_data["first_name"],
        age=p_data["age"],
        gender=p_data["gender"],
        pain_type=p_data["pain_type"],
        pain_level_baseline=p_data["pain_level_baseline"],
        treatment_context=p_data["treatment_context"],
        tone_preference=p_data["tone_preference"],
        voice_preference=p_data["voice_preference"],
        communication_style=p_data["communication_style"],
        current_valence_dial=valence,
        current_intervention_type="cognitive_reframing",
    )
    db.add(profile)
    db.flush()
    print(f"  Patient: {p_data['first_name']} ({p_data['email']})")

    # Sessions
    current_valence = valence
    current_intervention = "cognitive_reframing"
    n_sessions = p_data["sessions"]

    for i in range(n_sessions):
        session_date = date.today() - timedelta(days=(n_sessions - i))
        session = RitualSession(
            id=str(uuid.uuid4()),
            patient_id=profile.id,
            session_number=i + 1,
            session_date=str(session_date),
            status="completed",
            intervention_type=current_intervention,
            valence_dial=current_valence,
            started_at=datetime.now(timezone.utc) - timedelta(days=(n_sessions - i), hours=2),
            completed_at=datetime.now(timezone.utc) - timedelta(days=(n_sessions - i), hours=1),
        )
        db.add(session)
        db.flush()

        # Phase feedback
        phase_ratings = []
        for phase in ["before", "during", "after"]:
            rating = random.choice(RATINGS)
            phase_ratings.append(rating)
            fb = SessionFeedback(
                id=str(uuid.uuid4()),
                session_id=session.id,
                phase=phase,
                in_session_rating=rating,
            )
            db.add(fb)

        # Overall feedback
        benefit = random.choice(BENEFITS)
        post_pain = max(1, p_data["pain_level_baseline"] - random.randint(0, 3))
        overall_fb = SessionFeedback(
            id=str(uuid.uuid4()),
            session_id=session.id,
            phase="overall",
            post_pain_level=post_pain,
            perceived_benefit=benefit,
        )
        db.add(overall_fb)
        db.flush()

        # Adaptation log
        old_valence = current_valence
        old_intervention = current_intervention
        not_helping_count = phase_ratings.count("not_helping")
        helping_count = phase_ratings.count("helping")

        if not_helping_count > helping_count:
            if current_valence > 0.3:
                current_valence = max(0.0, current_valence - 0.15)
                reason = f"majority feedback not_helping; decreased valence by 0.15"
            else:
                current_valence = min(1.0, current_valence + 0.15)
                reason = f"majority feedback not_helping but valence <= 0.3; trying other direction"
        else:
            reason = "majority feedback helping or neutral; no valence change"

        if (i + 1) % 2 == 0:
            new_intervention = "interoceptive_attention" if current_intervention == "cognitive_reframing" else "cognitive_reframing"
            reason += f"; alternating to {new_intervention}"
            current_intervention = new_intervention

        log = AdaptationLog(
            id=str(uuid.uuid4()),
            patient_id=profile.id,
            session_id=session.id,
            old_valence=old_valence,
            new_valence=current_valence,
            old_intervention_type=old_intervention,
            new_intervention_type=current_intervention,
            trigger_reason=reason,
        )
        db.add(log)

    # Update profile with final adaptation state
    profile.current_valence_dial = current_valence
    profile.current_intervention_type = current_intervention

db.commit()
print("\nDone! Demo credentials:")
print("  Clinician: clinician@demo.com / demo1234")
print("  Patient 1: alice@demo.com / demo1234")
print("  Patient 2: bob@demo.com / demo1234")
print("  Patient 3: carol@demo.com / demo1234")
