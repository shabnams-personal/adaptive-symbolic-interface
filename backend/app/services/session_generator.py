"""
Generates a 3-phase ritual session script using GPT-4o.
Each phase script is constrained to ~400 words / 3500 characters for TTS.
"""

import re
import json
import logging
from openai import OpenAI
from app.config import get_settings
from app.models.patient_profile import PatientProfile
from app.models.feedback import SessionFeedback

logger = logging.getLogger(__name__)

PROMPT_INJECTION_PATTERN = re.compile(
    r'^\s*(system\s*:|you\s+are\s+|ignore\s+previous|assistant\s*:)',
    re.IGNORECASE | re.MULTILINE,
)


def sanitize_text(text: str, max_len: int = 500) -> str:
    """Strip prompt-injection patterns and enforce length limit."""
    cleaned = PROMPT_INJECTION_PATTERN.sub('', text)
    return cleaned[:max_len].strip()


def build_feedback_summary(feedback_rows: list[SessionFeedback]) -> str:
    if not feedback_rows:
        return "No previous session feedback available."
    ratings = [f.in_session_rating for f in feedback_rows if f.in_session_rating]
    benefits = [f.perceived_benefit for f in feedback_rows if f.perceived_benefit is not None]
    pain_levels = [f.post_pain_level for f in feedback_rows if f.post_pain_level is not None]
    parts = []
    if ratings:
        from collections import Counter
        counts = Counter(ratings)
        parts.append(f"Phase ratings: {dict(counts)}")
    if benefits:
        avg_benefit = sum(benefits) / len(benefits)
        parts.append(f"Average perceived benefit: {avg_benefit:.1f}/5")
    if pain_levels:
        avg_pain = sum(pain_levels) / len(pain_levels)
        parts.append(f"Average post-session pain: {avg_pain:.1f}/10")
    return "; ".join(parts) if parts else "Patient has completed previous sessions."


def valence_to_description(valence: float) -> str:
    if valence <= 0.3:
        return "direct and informative — use clear, factual language; minimal emotional framing"
    elif valence <= 0.6:
        return "balanced — mix practical guidance with gentle emotional acknowledgment"
    else:
        return "warm and supportive — prioritise emotional validation, encouragement, and hope"


def generate_session_scripts(
    profile: PatientProfile,
    session_number: int,
    intervention_type: str,
    valence_dial: float,
    previous_feedback: list[SessionFeedback],
) -> dict[str, str]:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)

    pain_type = sanitize_text(profile.pain_type, 200)
    treatment_context = sanitize_text(profile.treatment_context, 500)
    communication_style = sanitize_text(profile.communication_style, 300)
    feedback_summary = build_feedback_summary(previous_feedback)

    intervention_desc = (
        "Cognitive Reframing: Help the patient reinterpret their pain experience through expectation-setting "
        "and meaning-making. Frame the treatment as actively changing their pain pathways."
        if intervention_type == "cognitive_reframing"
        else "Interoceptive Attention: Guide the patient to observe body sensations with curious, non-judgmental awareness. "
        "Focus on noticing sensations without trying to change them."
    )

    system_prompt = f"""You are a therapeutic session script writer for a pain management support system.
Generate a guided session script with three phases:
1. BEFORE (2-3 min): Expectation shaping, framing the upcoming treatment action
2. DURING (3-5 min): Attention modulation during treatment (pill intake / cream application)
3. AFTER (2-3 min): Memory reinforcement, positive anchoring

Patient context:
- Pain type: {pain_type}
- Baseline pain level: {profile.pain_level_baseline}/10
- Treatment context: {treatment_context or 'not specified'}
- Age: {profile.age}, Gender: {profile.gender}
- Communication style notes: {communication_style or 'standard'}

Intervention approach: {intervention_desc}
Tone: {valence_to_description(valence_dial)}
Session number: {session_number} (vary content to avoid repetition across sessions)
Previous feedback summary: {feedback_summary}

Write in second person ("you"). Be warm but clinical. Suitable for audio delivery.

IMPORTANT CONSTRAINTS:
- Each phase script MUST be under 400 words and under 3500 characters (hard limit for audio generation)
- Keep language natural and flowing for spoken delivery
- Do NOT include stage directions, headers, or phase labels in the text itself

Output ONLY valid JSON with exactly these keys:
{{"before_script": "...", "during_script": "...", "after_script": "..."}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": system_prompt}],
        temperature=0.7,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content or "{}"
    scripts = json.loads(content)

    for key in ("before_script", "during_script", "after_script"):
        if key not in scripts:
            raise ValueError(f"LLM response missing key: {key}")
        if len(scripts[key]) > 3500:
            logger.warning(f"{key} exceeds 3500 chars ({len(scripts[key])}); truncating at sentence boundary")
            scripts[key] = _truncate_at_sentence(scripts[key], 3500)

    return scripts


def _truncate_at_sentence(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    truncated = text[:max_len]
    last_period = max(truncated.rfind('.'), truncated.rfind('?'), truncated.rfind('!'))
    if last_period > max_len // 2:
        return truncated[:last_period + 1]
    return truncated
