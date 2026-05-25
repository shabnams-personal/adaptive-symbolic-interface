"""
Text-to-speech service using OpenAI TTS API.
Generates 3 audio files per session (before, during, after).
Handles the 4096-character TTS limit by chunking at sentence boundaries.
"""

import os
import re
import logging
from openai import OpenAI
from app.config import get_settings

logger = logging.getLogger(__name__)

TTS_CHAR_LIMIT = 4000  # Stay below OpenAI's 4096 hard limit
MEDIA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'media', 'sessions')


def get_audio_path(session_id: str, phase: str) -> str:
    os.makedirs(MEDIA_DIR, exist_ok=True)
    return os.path.join(MEDIA_DIR, f"{session_id}_{phase}.mp3")


def _split_into_sentences(text: str) -> list[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if s.strip()]


def _chunk_text(text: str, max_len: int = TTS_CHAR_LIMIT) -> list[str]:
    """Split text into chunks at sentence boundaries, each under max_len chars."""
    if len(text) <= max_len:
        return [text]

    sentences = _split_into_sentences(text)
    chunks = []
    current = ""
    for sentence in sentences:
        if len(sentence) > max_len:
            logger.warning(f"Single sentence exceeds {max_len} chars; truncating")
            sentence = sentence[:max_len]
        if len(current) + len(sentence) + 1 <= max_len:
            current = (current + " " + sentence).strip()
        else:
            if current:
                chunks.append(current)
            current = sentence
    if current:
        chunks.append(current)
    return chunks


def generate_audio(session_id: str, phase: str, script: str, voice: str) -> str:
    """
    Generate an MP3 audio file for the given script.
    Returns the file path.
    """
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)
    out_path = get_audio_path(session_id, phase)

    chunks = _chunk_text(script)

    if len(chunks) == 1:
        response = client.audio.speech.create(
            model="tts-1-hd",
            voice=voice,  # type: ignore[arg-type]
            input=chunks[0],
        )
        with open(out_path, "wb") as f:
            f.write(response.content)
        logger.info(f"Generated audio: {out_path} ({len(script)} chars, 1 chunk)")
    else:
        # Multiple chunks — concatenate audio bytes directly (simple concat of MP3 frames)
        logger.info(f"Script exceeds {TTS_CHAR_LIMIT} chars; generating {len(chunks)} chunks")
        audio_parts = []
        for i, chunk in enumerate(chunks):
            response = client.audio.speech.create(
                model="tts-1-hd",
                voice=voice,  # type: ignore[arg-type]
                input=chunk,
            )
            audio_parts.append(response.content)
            logger.info(f"  Chunk {i+1}/{len(chunks)}: {len(chunk)} chars")

        try:
            # Prefer pydub for proper MP3 concatenation
            from pydub import AudioSegment
            import io
            combined = AudioSegment.empty()
            for part in audio_parts:
                segment = AudioSegment.from_mp3(io.BytesIO(part))
                combined += segment
            combined.export(out_path, format="mp3")
        except Exception:
            # Fallback: raw bytes concat (good enough for prototype)
            logger.warning("pydub not available or failed; using raw bytes concat")
            with open(out_path, "wb") as f:
                for part in audio_parts:
                    f.write(part)

    return out_path


def generate_session_audio(
    session_id: str,
    scripts: dict[str, str],
    voice: str,
) -> dict[str, str]:
    """Generate all 3 phase audio files. Returns dict of phase -> file path."""
    paths = {}
    for phase_key, script_key in [
        ("before", "before_script"),
        ("during", "during_script"),
        ("after", "after_script"),
    ]:
        script = scripts.get(script_key, "")
        if not script:
            continue
        paths[phase_key] = generate_audio(session_id, phase_key, script, voice)
    return paths
