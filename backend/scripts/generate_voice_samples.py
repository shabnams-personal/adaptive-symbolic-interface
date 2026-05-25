"""
Run once to generate 6 voice preview MP3 files for the onboarding screen.

Usage:
    cd backend
    venv\\Scripts\\activate
    python scripts/generate_voice_samples.py

Output: ../frontend/public/voice-samples/{voice}.mp3
Requires: OPENAI_API_KEY in .env
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

import openai

SAMPLE_TEXT = (
    "Hello. This is a preview of how your sessions will sound. "
    "I'm here to support you through your treatment today."
)

VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]

output_dir = os.path.join(
    os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'voice-samples'
)
os.makedirs(output_dir, exist_ok=True)

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

for voice in VOICES:
    out_path = os.path.join(output_dir, f"{voice}.mp3")
    if os.path.exists(out_path):
        print(f"  Skipping {voice}.mp3 (already exists)")
        continue
    print(f"  Generating {voice}.mp3...")
    response = client.audio.speech.create(
        model="tts-1",
        voice=voice,  # type: ignore[arg-type]
        input=SAMPLE_TEXT,
    )
    with open(out_path, "wb") as f:
        f.write(response.content)
    print(f"  Saved {voice}.mp3")

print("Done! Voice samples are in frontend/public/voice-samples/")
