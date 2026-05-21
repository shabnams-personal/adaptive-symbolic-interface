import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models.patient_profile import PatientProfile
from app.models.session import RitualSession
from app.models.feedback import SessionFeedback
from app.models.user import User
from app.schemas.session import FeedbackCreate, FeedbackResponse
from app.services.auth_service import require_patient
from app.services.adaptation_engine import run_adaptation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["Feedback"])

VALID_PHASES = {"before", "during", "after", "overall"}
VALID_RATINGS = {"helping", "neutral", "not_helping"}


@router.post("/{session_id}/feedback", response_model=FeedbackResponse, status_code=201)
def submit_feedback(
    session_id: str,
    payload: FeedbackCreate,
    current_user: User = Depends(require_patient),
    db: DBSession = Depends(get_db),
):
    if payload.phase not in VALID_PHASES:
        raise HTTPException(400, f"phase must be one of: {VALID_PHASES}")
    if payload.in_session_rating and payload.in_session_rating not in VALID_RATINGS:
        raise HTTPException(400, f"in_session_rating must be one of: {VALID_RATINGS}")

    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(404, "Patient profile not found")

    session = db.query(RitualSession).filter(
        RitualSession.id == session_id,
        RitualSession.patient_id == profile.id,
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    feedback = SessionFeedback(
        id=str(uuid.uuid4()),
        session_id=session_id,
        phase=payload.phase,
        in_session_rating=payload.in_session_rating,
        post_pain_level=payload.post_pain_level,
        post_session_notes=payload.post_session_notes,
        perceived_benefit=payload.perceived_benefit,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    # Trigger adaptation engine when overall post-session feedback is submitted
    if payload.phase == "overall":
        try:
            all_feedback = (
                db.query(SessionFeedback)
                .filter(SessionFeedback.session_id == session_id)
                .all()
            )
            run_adaptation(db, profile, session, all_feedback)
        except Exception as e:
            logger.exception(f"Adaptation engine failed for session {session_id}: {e}")
            # Don't fail the feedback submission if adaptation fails

    return feedback


@router.get("/{session_id}/feedback", response_model=list[FeedbackResponse])
def get_session_feedback(
    session_id: str,
    current_user: User = Depends(require_patient),
    db: DBSession = Depends(get_db),
):
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(404, "Patient profile not found")

    session = db.query(RitualSession).filter(
        RitualSession.id == session_id,
        RitualSession.patient_id == profile.id,
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    return (
        db.query(SessionFeedback)
        .filter(SessionFeedback.session_id == session_id)
        .order_by(SessionFeedback.created_at)
        .all()
    )
