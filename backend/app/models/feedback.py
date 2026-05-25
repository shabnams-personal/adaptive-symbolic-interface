import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Enum, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SessionFeedback(Base):
    __tablename__ = "session_feedback"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String, ForeignKey("ritual_sessions.id"), nullable=False)
    phase: Mapped[str] = mapped_column(
        Enum("before", "during", "after", "overall", name="feedback_phase_enum"), nullable=False
    )
    in_session_rating: Mapped[str | None] = mapped_column(
        Enum("helping", "neutral", "not_helping", name="in_session_rating_enum"), nullable=True
    )
    post_pain_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    post_session_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    perceived_benefit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    session: Mapped["RitualSession"] = relationship(  # noqa: F821
        "RitualSession", back_populates="feedback"
    )
