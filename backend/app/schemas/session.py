from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SessionResponse(BaseModel):
    id: str
    patient_id: str
    session_number: int
    session_date: str
    status: str
    error_message: Optional[str]
    current_phase: Optional[str]
    script_before: Optional[str]
    script_during: Optional[str]
    script_after: Optional[str]
    audio_before_path: Optional[str]
    audio_during_path: Optional[str]
    audio_after_path: Optional[str]
    intervention_type: str
    valence_dial: float
    duration_seconds: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionUpdate(BaseModel):
    status: Optional[str] = None
    current_phase: Optional[str] = None


class FeedbackCreate(BaseModel):
    phase: str  # before | during | after | overall
    in_session_rating: Optional[str] = None  # helping | neutral | not_helping
    post_pain_level: Optional[int] = None
    post_session_notes: Optional[str] = None
    perceived_benefit: Optional[int] = None


class FeedbackResponse(BaseModel):
    id: str
    session_id: str
    phase: str
    in_session_rating: Optional[str]
    post_pain_level: Optional[int]
    post_session_notes: Optional[str]
    perceived_benefit: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}
