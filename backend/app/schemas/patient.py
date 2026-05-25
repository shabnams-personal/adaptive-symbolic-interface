from pydantic import BaseModel, Field
from datetime import datetime


TONE_TO_VALENCE = {
    "direct_informative": 0.2,
    "balanced": 0.5,
    "supportive_sustaining": 0.8,
}


class PatientProfileCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=18, le=120)
    gender: str = Field(..., min_length=1, max_length=50)
    pain_type: str = Field(..., min_length=1, max_length=200)
    pain_level_baseline: int = Field(..., ge=1, le=10)
    treatment_context: str = Field("", max_length=500)
    tone_preference: str  # direct_informative | balanced | supportive_sustaining
    voice_preference: str = "nova"  # alloy | echo | fable | onyx | nova | shimmer
    communication_style: str = Field("", max_length=300)


class PatientProfileResponse(BaseModel):
    id: str
    user_id: str
    first_name: str
    age: int
    gender: str
    pain_type: str
    pain_level_baseline: int
    treatment_context: str
    tone_preference: str
    voice_preference: str
    communication_style: str
    current_valence_dial: float
    current_intervention_type: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
