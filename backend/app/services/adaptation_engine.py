"""
Adaptation engine — adjusts valence dial and intervention type after each session.

Rules (in priority order):
1. Valence adjustment based on phase feedback majority
2. Intervention type switching:
   a. High benefit keep (perceived_benefit >= 4 for current type) — keep for one more session
   b. Low benefit force switch (same type for 3+ consecutive sessions AND avg benefit < 3)
   c. Default: alternate every 2 sessions
"""

import uuid
import logging
from collections import Counter
from sqlalchemy.orm import Session
from app.models.patient_profile import PatientProfile
from app.models.session import RitualSession
from app.models.feedback import SessionFeedback
from app.models.adaptation_log import AdaptationLog

logger = logging.getLogger(__name__)

VALENCE_STEP = 0.15
VALENCE_MIN = 0.0
VALENCE_MAX = 1.0
MAX_SINGLE_STEP = 0.2


def _clamp(value: float, lo: float = VALENCE_MIN, hi: float = VALENCE_MAX) -> float:
    return max(lo, min(hi, value))


def run_adaptation(
    db: Session,
    patient: PatientProfile,
    current_session: RitualSession,
    all_session_feedback: list[SessionFeedback],
) -> AdaptationLog:
    """
    Compute and apply adaptation. Returns the adaptation_log row.
    """
    old_valence = patient.current_valence_dial
    old_intervention = patient.current_intervention_type

    # --- Valence adjustment ---
    phase_ratings = [
        f.in_session_rating
        for f in all_session_feedback
        if f.in_session_rating and f.phase in ("before", "during", "after")
    ]
    new_valence = old_valence
    valence_reason = "no change"

    if phase_ratings:
        counts = Counter(phase_ratings)
        majority = counts.most_common(1)[0][0]
        if majority == "not_helping":
            if old_valence > 0.3:
                delta = min(VALENCE_STEP, MAX_SINGLE_STEP)
                new_valence = _clamp(old_valence - delta)
                valence_reason = f"majority feedback was not_helping; decreased valence by {delta}"
            else:
                delta = min(VALENCE_STEP, MAX_SINGLE_STEP)
                new_valence = _clamp(old_valence + delta)
                valence_reason = f"majority feedback was not_helping but valence <= 0.3; trying other direction (+{delta})"
        elif majority == "helping":
            valence_reason = "majority feedback was helping; valence unchanged"
        else:
            valence_reason = "majority feedback was neutral; valence unchanged"
    else:
        valence_reason = "no phase feedback submitted; valence unchanged"

    # --- Intervention type switching ---
    overall_feedback = next(
        (f for f in all_session_feedback if f.phase == "overall"), None
    )
    perceived_benefit = overall_feedback.perceived_benefit if overall_feedback else None

    past_sessions = (
        db.query(RitualSession)
        .filter(
            RitualSession.patient_id == patient.id,
            RitualSession.status == "completed",
            RitualSession.id != current_session.id,
        )
        .order_by(RitualSession.session_number.desc())
        .all()
    )

    new_intervention = old_intervention
    intervention_reason = ""

    # Rule a: high benefit keep
    if perceived_benefit is not None and perceived_benefit >= 4:
        new_intervention = old_intervention
        intervention_reason = f"perceived benefit {perceived_benefit}/5 >= 4; keeping {old_intervention} for one more session"
    else:
        # Rule b: low benefit force switch
        consecutive_same = 0
        benefit_scores = []
        for s in past_sessions:
            if s.intervention_type == old_intervention:
                consecutive_same += 1
                fb = db.query(SessionFeedback).filter(
                    SessionFeedback.session_id == s.id,
                    SessionFeedback.phase == "overall",
                ).first()
                if fb and fb.perceived_benefit is not None:
                    benefit_scores.append(fb.perceived_benefit)
            else:
                break

        if consecutive_same >= 2 and benefit_scores and (sum(benefit_scores) / len(benefit_scores)) < 3:
            new_intervention = (
                "interoceptive_attention"
                if old_intervention == "cognitive_reframing"
                else "cognitive_reframing"
            )
            avg_b = sum(benefit_scores) / len(benefit_scores)
            intervention_reason = (
                f"same intervention type for {consecutive_same + 1} consecutive sessions "
                f"with avg benefit {avg_b:.1f}/5 < 3; force switching to {new_intervention}"
            )
        else:
            # Rule c: default alternate every 2 sessions
            total_completed = len(past_sessions) + 1  # include current
            if total_completed % 2 == 0:
                new_intervention = (
                    "interoceptive_attention"
                    if old_intervention == "cognitive_reframing"
                    else "cognitive_reframing"
                )
                intervention_reason = f"default alternation at session {total_completed}; switching to {new_intervention}"
            else:
                intervention_reason = f"default alternation: keeping {old_intervention} (session {total_completed})"

    # Build trigger reason
    trigger_reason = f"Valence: {valence_reason}. Intervention: {intervention_reason}."

    # Apply changes
    patient.current_valence_dial = new_valence
    patient.current_intervention_type = new_intervention
    db.add(patient)

    # Create adaptation log
    log = AdaptationLog(
        id=str(uuid.uuid4()),
        patient_id=patient.id,
        session_id=current_session.id,
        old_valence=old_valence,
        new_valence=new_valence,
        old_intervention_type=old_intervention,
        new_intervention_type=new_intervention,
        trigger_reason=trigger_reason,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    logger.info(
        f"Adaptation for patient {patient.id}: "
        f"valence {old_valence:.2f} -> {new_valence:.2f}, "
        f"intervention {old_intervention} -> {new_intervention}"
    )
    return log
