# Import all models so SQLAlchemy can resolve relationship() names at mapper configure time.
from app.models.user import User  # noqa: F401
from app.models.patient_profile import PatientProfile  # noqa: F401
from app.models.session import RitualSession  # noqa: F401
from app.models.feedback import SessionFeedback  # noqa: F401
from app.models.adaptation_log import AdaptationLog  # noqa: F401
