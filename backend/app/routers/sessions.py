import uuid
import logging
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.models.patient_profile import PatientProfile
from app.models.session import RitualSession
from app.models.user import User
from app.schemas.session import SessionResponse, SessionUpdate
from app.services.auth_service import require_patient
from app.services.session_generator import generate_session_scripts
from app.services.tts_service import generate_session_audio
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

VALID_PHASES = {"before", "during", "after"}
VALID_STATUSES = {"scheduled", "generating", "ready", "in_progress", "completed", "skipped", "failed"}


def _get_patient_profile(current_user: User, db: DBSession) -> PatientProfile:
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(404, "Patient profile not found. Please complete onboarding.")
    return profile


def _run_generation(session_id: str, database_url: str) -> None:
    """Background task: generate scripts and audio, update session status."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(database_url)
    LocalSession = sessionmaker(bind=engine)
    db = LocalSession()

    try:
        session = db.query(RitualSession).filter(RitualSession.id == session_id).first()
        if not session:
            return

        profile = db.query(PatientProfile).filter(PatientProfile.id == session.patient_id).first()
        if not profile:
            session.status = "failed"
            session.error_message = "Patient profile not found"
            db.commit()
            return

        from app.models.feedback import SessionFeedback
        from app.models.session import RitualSession as RS

        # Gather last session's feedback for context
        last_session = (
            db.query(RS)
            .filter(RS.patient_id == profile.id, RS.status == "completed", RS.id != session_id)
            .order_by(RS.session_number.desc())
            .first()
        )
        prev_feedback = []
        if last_session:
            prev_feedback = (
                db.query(SessionFeedback)
                .filter(SessionFeedback.session_id == last_session.id)
                .all()
            )

        scripts = generate_session_scripts(
            profile=profile,
            session_number=session.session_number,
            intervention_type=session.intervention_type,
            valence_dial=session.valence_dial,
            previous_feedback=prev_feedback,
        )

        audio_paths = generate_session_audio(
            session_id=session_id,
            scripts=scripts,
            voice=profile.voice_preference,
        )

        session.script_before = scripts.get("before_script")
        session.script_during = scripts.get("during_script")
        session.script_after = scripts.get("after_script")
        session.audio_before_path = audio_paths.get("before")
        session.audio_during_path = audio_paths.get("during")
        session.audio_after_path = audio_paths.get("after")
        session.status = "ready"
        db.commit()
        logger.info(f"Session {session_id} generation complete")

    except Exception as e:
        logger.exception(f"Session {session_id} generation failed: {e}")
        try:
            session = db.query(RitualSession).filter(RitualSession.id == session_id).first()
            if session:
                session.status = "failed"
                session.error_message = str(e)[:500]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/generate", response_model=SessionResponse, status_code=202)
def generate_session(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_patient),
    db: DBSession = Depends(get_db),
):
    profile = _get_patient_profile(current_user, db)
    today_str = str(date.today())

    existing = (
        db.query(RitualSession)
        .filter(
            RitualSession.patient_id == profile.id,
            RitualSession.session_date == today_str,
        )
        .first()
    )

    if existing:
        if existing.status != "failed":
            return existing
        # Allow retry on failed
        existing.status = "generating"
        existing.error_message = None
        db.commit()
        from app.config import get_settings
        background_tasks.add_task(_run_generation, existing.id, get_settings().database_url)
        return existing

    session_count = (
        db.query(RitualSession)
        .filter(RitualSession.patient_id == profile.id)
        .count()
    )

    session = RitualSession(
        id=str(uuid.uuid4()),
        patient_id=profile.id,
        session_number=session_count + 1,
        session_date=today_str,
        status="generating",
        intervention_type=profile.current_intervention_type,
        valence_dial=profile.current_valence_dial,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    from app.config import get_settings
    background_tasks.add_task(_run_generation, session.id, get_settings().database_url)
    return session


@router.get("/current", response_model=SessionResponse)
def get_current_session(
    current_user: User = Depends(require_patient),
    db: DBSession = Depends(get_db),
):
    profile = _get_patient_profile(current_user, db)
    today_str = str(date.today())
    session = (
        db.query(RitualSession)
        .filter(
            RitualSession.patient_id == profile.id,
            RitualSession.session_date == today_str,
        )
        .first()
    )
    if not session:
        raise HTTPException(404, "No session for today. Call POST /api/sessions/generate first.")
    return session


@router.get("/history", response_model=list[SessionResponse])
def get_session_history(
    current_user: User = Depends(require_patient),
    db: DBSession = Depends(get_db),
):
    profile = _get_patient_profile(current_user, db)
    sessions = (
        db.query(RitualSession)
        .filter(RitualSession.patient_id == profile.id)
        .order_by(RitualSession.session_number.desc())
        .all()
    )
    return sessions


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: str,
    current_user: User = Depends(require_patient),
    db: DBSession = Depends(get_db),
):
    profile = _get_patient_profile(current_user, db)
    session = db.query(RitualSession).filter(
        RitualSession.id == session_id,
        RitualSession.patient_id == profile.id,
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.patch("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: str,
    payload: SessionUpdate,
    current_user: User = Depends(require_patient),
    db: DBSession = Depends(get_db),
):
    profile = _get_patient_profile(current_user, db)
    session = db.query(RitualSession).filter(
        RitualSession.id == session_id,
        RitualSession.patient_id == profile.id,
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    if payload.status:
        if payload.status not in VALID_STATUSES:
            raise HTTPException(400, f"Invalid status: {payload.status}")
        session.status = payload.status
        if payload.status == "in_progress" and not session.started_at:
            session.started_at = datetime.now(timezone.utc)
        if payload.status == "completed" and not session.completed_at:
            session.completed_at = datetime.now(timezone.utc)

    if "current_phase" in payload.model_fields_set:
        session.current_phase = payload.current_phase

    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}/audio/{phase}")
def get_audio(
    session_id: str,
    phase: str,
    current_user: User = Depends(require_patient),
    db: DBSession = Depends(get_db),
):
    if phase not in VALID_PHASES:
        raise HTTPException(400, f"Phase must be one of: {VALID_PHASES}")

    profile = _get_patient_profile(current_user, db)
    session = db.query(RitualSession).filter(
        RitualSession.id == session_id,
        RitualSession.patient_id == profile.id,
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    path_map = {
        "before": session.audio_before_path,
        "during": session.audio_during_path,
        "after": session.audio_after_path,
    }
    audio_path = path_map.get(phase)
    if not audio_path or not os.path.exists(audio_path):
        raise HTTPException(404, f"Audio file for phase '{phase}' not found")

    return FileResponse(
        path=audio_path,
        media_type="audio/mpeg",
        filename=f"{session_id}_{phase}.mp3",
    )
