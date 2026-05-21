import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.patient_profile import PatientProfile
from app.models.user import User
from app.schemas.patient import PatientProfileCreate, PatientProfileResponse, TONE_TO_VALENCE
from app.services.auth_service import require_patient

router = APIRouter(prefix="/api/patients", tags=["Patients"])

VALID_TONES = {"direct_informative", "balanced", "supportive_sustaining"}
VALID_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}


@router.post("/profile", response_model=PatientProfileResponse, status_code=201)
def create_or_update_profile(
    payload: PatientProfileCreate,
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    if payload.tone_preference not in VALID_TONES:
        raise HTTPException(400, f"tone_preference must be one of {VALID_TONES}")
    if payload.voice_preference not in VALID_VOICES:
        raise HTTPException(400, f"voice_preference must be one of {VALID_VOICES}")

    existing = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()

    valence = TONE_TO_VALENCE[payload.tone_preference]

    if existing:
        existing.first_name = payload.first_name
        existing.age = payload.age
        existing.gender = payload.gender
        existing.pain_type = payload.pain_type
        existing.pain_level_baseline = payload.pain_level_baseline
        existing.treatment_context = payload.treatment_context
        existing.tone_preference = payload.tone_preference
        existing.voice_preference = payload.voice_preference
        existing.communication_style = payload.communication_style
        existing.current_valence_dial = valence
        db.commit()
        db.refresh(existing)
        return existing

    profile = PatientProfile(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        first_name=payload.first_name,
        age=payload.age,
        gender=payload.gender,
        pain_type=payload.pain_type,
        pain_level_baseline=payload.pain_level_baseline,
        treatment_context=payload.treatment_context,
        tone_preference=payload.tone_preference,
        voice_preference=payload.voice_preference,
        communication_style=payload.communication_style,
        current_valence_dial=valence,
        current_intervention_type="cognitive_reframing",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profile", response_model=PatientProfileResponse)
def get_profile(
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db),
):
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(404, "Profile not found. Please complete onboarding.")
    return profile
