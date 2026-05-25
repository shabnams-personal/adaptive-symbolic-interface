from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func
from app.database import get_db
from app.models.patient_profile import PatientProfile
from app.models.session import RitualSession
from app.models.feedback import SessionFeedback
from app.models.adaptation_log import AdaptationLog
from app.models.user import User
from app.services.auth_service import require_clinician
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/clinician", tags=["Clinician"])


class PatientListItem(BaseModel):
    patient_id: str
    user_id: str
    first_name: str
    email: str
    sessions_completed: int
    total_sessions: int
    adherence_rate: float
    avg_pain_post: Optional[float]
    last_session_date: Optional[str]
    current_valence_dial: float
    current_intervention_type: str

    model_config = {"from_attributes": True}


class AdaptationLogItem(BaseModel):
    id: str
    session_id: str
    old_valence: float
    new_valence: float
    old_intervention_type: str
    new_intervention_type: str
    trigger_reason: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionSummaryItem(BaseModel):
    id: str
    session_number: int
    session_date: str
    status: str
    valence_dial: float
    intervention_type: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    phase_ratings: list[str]
    post_pain_level: Optional[int]
    perceived_benefit: Optional[int]

    model_config = {"from_attributes": True}


@router.get("/patients", response_model=list[PatientListItem])
def list_patients(
    _: User = Depends(require_clinician),
    db: DBSession = Depends(get_db),
):
    profiles = db.query(PatientProfile).join(User, PatientProfile.user_id == User.id).all()
    result = []
    for profile in profiles:
        user = db.query(User).filter(User.id == profile.user_id).first()
        sessions = db.query(RitualSession).filter(RitualSession.patient_id == profile.id).all()
        completed = [s for s in sessions if s.status == "completed"]

        # Avg post-session pain
        pain_levels = []
        last_date = None
        for s in completed:
            fb = db.query(SessionFeedback).filter(
                SessionFeedback.session_id == s.id,
                SessionFeedback.phase == "overall",
            ).first()
            if fb and fb.post_pain_level:
                pain_levels.append(fb.post_pain_level)
            if last_date is None or (s.session_date and s.session_date > last_date):
                last_date = s.session_date

        avg_pain = sum(pain_levels) / len(pain_levels) if pain_levels else None
        adherence = len(completed) / len(sessions) if sessions else 0.0

        result.append(PatientListItem(
            patient_id=profile.id,
            user_id=profile.user_id,
            first_name=profile.first_name,
            email=user.email if user else "",
            sessions_completed=len(completed),
            total_sessions=len(sessions),
            adherence_rate=round(adherence, 2),
            avg_pain_post=round(avg_pain, 1) if avg_pain else None,
            last_session_date=last_date,
            current_valence_dial=profile.current_valence_dial,
            current_intervention_type=profile.current_intervention_type,
        ))
    return result


@router.get("/patients/{patient_id}/summary")
def get_patient_summary(
    patient_id: str,
    _: User = Depends(require_clinician),
    db: DBSession = Depends(get_db),
):
    profile = db.query(PatientProfile).filter(PatientProfile.id == patient_id).first()
    if not profile:
        raise HTTPException(404, "Patient not found")

    user = db.query(User).filter(User.id == profile.user_id).first()
    adaptation_logs = (
        db.query(AdaptationLog)
        .filter(AdaptationLog.patient_id == patient_id)
        .order_by(AdaptationLog.created_at.desc())
        .all()
    )

    return {
        "patient_id": profile.id,
        "first_name": profile.first_name,
        "email": user.email if user else "",
        "age": profile.age,
        "gender": profile.gender,
        "pain_type": profile.pain_type,
        "pain_level_baseline": profile.pain_level_baseline,
        "current_valence_dial": profile.current_valence_dial,
        "current_intervention_type": profile.current_intervention_type,
        "adaptation_logs": [
            {
                "id": log.id,
                "session_id": log.session_id,
                "old_valence": log.old_valence,
                "new_valence": log.new_valence,
                "old_intervention_type": log.old_intervention_type,
                "new_intervention_type": log.new_intervention_type,
                "trigger_reason": log.trigger_reason,
                "created_at": log.created_at.isoformat(),
            }
            for log in adaptation_logs
        ],
    }


@router.get("/patients/{patient_id}/sessions", response_model=list[SessionSummaryItem])
def get_patient_sessions(
    patient_id: str,
    _: User = Depends(require_clinician),
    db: DBSession = Depends(get_db),
):
    profile = db.query(PatientProfile).filter(PatientProfile.id == patient_id).first()
    if not profile:
        raise HTTPException(404, "Patient not found")

    sessions = (
        db.query(RitualSession)
        .filter(RitualSession.patient_id == patient_id)
        .order_by(RitualSession.session_number.desc())
        .all()
    )

    result = []
    for s in sessions:
        feedback_rows = (
            db.query(SessionFeedback)
            .filter(SessionFeedback.session_id == s.id)
            .all()
        )
        phase_ratings = [
            f.in_session_rating
            for f in feedback_rows
            if f.in_session_rating and f.phase in ("before", "during", "after")
        ]
        overall = next((f for f in feedback_rows if f.phase == "overall"), None)
        result.append(SessionSummaryItem(
            id=s.id,
            session_number=s.session_number,
            session_date=s.session_date,
            status=s.status,
            valence_dial=s.valence_dial,
            intervention_type=s.intervention_type,
            started_at=s.started_at,
            completed_at=s.completed_at,
            phase_ratings=[r for r in phase_ratings if r],
            post_pain_level=overall.post_pain_level if overall else None,
            perceived_benefit=overall.perceived_benefit if overall else None,
        ))
    return result
