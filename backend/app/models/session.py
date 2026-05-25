import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, Enum, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class RitualSession(Base):
    __tablename__ = "ritual_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(String, ForeignKey("patient_profiles.id"), nullable=False)
    session_number: Mapped[int] = mapped_column(Integer, nullable=False)
    session_date: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO date: YYYY-MM-DD
    status: Mapped[str] = mapped_column(
        Enum(
            "scheduled", "generating", "ready", "in_progress",
            "completed", "skipped", "failed",
            name="session_status_enum",
        ),
        nullable=False,
        default="scheduled",
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_phase: Mapped[str | None] = mapped_column(
        Enum("before", "during", "after", name="session_phase_enum"), nullable=True
    )
    script_before: Mapped[str | None] = mapped_column(Text, nullable=True)
    script_during: Mapped[str | None] = mapped_column(Text, nullable=True)
    script_after: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_before_path: Mapped[str | None] = mapped_column(String, nullable=True)
    audio_during_path: Mapped[str | None] = mapped_column(String, nullable=True)
    audio_after_path: Mapped[str | None] = mapped_column(String, nullable=True)
    intervention_type: Mapped[str] = mapped_column(
        Enum("cognitive_reframing", "interoceptive_attention", name="intervention_type_session_enum"),
        nullable=False,
    )
    valence_dial: Mapped[float] = mapped_column(Float, nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    patient: Mapped["PatientProfile"] = relationship(  # noqa: F821
        "PatientProfile", back_populates="sessions"
    )
    feedback: Mapped[list["SessionFeedback"]] = relationship(  # noqa: F821
        "SessionFeedback", back_populates="session"
    )
    adaptation_logs: Mapped[list["AdaptationLog"]] = relationship(  # noqa: F821
        "AdaptationLog", back_populates="session"
    )
