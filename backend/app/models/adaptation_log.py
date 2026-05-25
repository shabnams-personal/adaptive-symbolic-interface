import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, Enum, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AdaptationLog(Base):
    __tablename__ = "adaptation_log"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(String, ForeignKey("patient_profiles.id"), nullable=False)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("ritual_sessions.id"), nullable=False)
    old_valence: Mapped[float] = mapped_column(Float, nullable=False)
    new_valence: Mapped[float] = mapped_column(Float, nullable=False)
    old_intervention_type: Mapped[str] = mapped_column(
        Enum("cognitive_reframing", "interoceptive_attention", name="intervention_type_adapt_enum"),
        nullable=False,
    )
    new_intervention_type: Mapped[str] = mapped_column(
        Enum("cognitive_reframing", "interoceptive_attention", name="intervention_type_adapt_new_enum"),
        nullable=False,
    )
    trigger_reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    patient: Mapped["PatientProfile"] = relationship(  # noqa: F821
        "PatientProfile", back_populates="adaptation_logs"
    )
    session: Mapped["RitualSession"] = relationship(  # noqa: F821
        "RitualSession", back_populates="adaptation_logs"
    )
