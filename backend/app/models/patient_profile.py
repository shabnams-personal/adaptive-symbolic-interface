import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, Enum, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    gender: Mapped[str] = mapped_column(String(50), nullable=False)
    pain_type: Mapped[str] = mapped_column(String(200), nullable=False)
    pain_level_baseline: Mapped[int] = mapped_column(Integer, nullable=False)
    treatment_context: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tone_preference: Mapped[str] = mapped_column(
        Enum("direct_informative", "balanced", "supportive_sustaining", name="tone_preference_enum"),
        nullable=False,
    )
    voice_preference: Mapped[str] = mapped_column(
        Enum("alloy", "echo", "fable", "onyx", "nova", "shimmer", name="voice_preference_enum"),
        nullable=False,
        default="nova",
    )
    communication_style: Mapped[str] = mapped_column(Text, nullable=False, default="")
    current_valence_dial: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    current_intervention_type: Mapped[str] = mapped_column(
        Enum("cognitive_reframing", "interoceptive_attention", name="intervention_type_enum"),
        nullable=False,
        default="cognitive_reframing",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", back_populates="patient_profile")  # noqa: F821
    sessions: Mapped[list["RitualSession"]] = relationship(  # noqa: F821
        "RitualSession", back_populates="patient"
    )
    adaptation_logs: Mapped[list["AdaptationLog"]] = relationship(  # noqa: F821
        "AdaptationLog", back_populates="patient"
    )
