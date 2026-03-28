from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import tempfile
import math
import json
import uuid
from pathlib import Path
from pydantic import BaseModel
from pydub import AudioSegment

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Emergent LLM Integration ─────────────────────────
from emergentintegrations.llm.openai import OpenAISpeechToText
from emergentintegrations.llm.chat import LlmChat, UserMessage

def get_api_key():
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise ValueError("EMERGENT_LLM_KEY not set")
    return key

async def transcribe_audio(file_path: str, language: str = "en") -> dict:
    """Transcribe audio using Whisper with timestamps"""
    stt = OpenAISpeechToText(api_key=get_api_key())
    file_size = os.path.getsize(file_path)
    max_size = 24 * 1024 * 1024

    if file_size <= max_size:
        with open(file_path, "rb") as audio_file:
            kwargs = {
                "file": audio_file,
                "model": "whisper-1",
                "response_format": "verbose_json",
                "timestamp_granularities": ["segment"],
                "prompt": "This is a college lecture. May contain English, Hindi, Marathi, or mixed Hinglish.",
                "temperature": 0.0,
            }
            if language != "auto":
                kwargs["language"] = language
            response = await stt.transcribe(**kwargs)
        segments = []
        if hasattr(response, 'segments') and response.segments:
            for seg in response.segments:
                segments.append({"start": seg.start, "end": seg.end, "text": seg.text.strip()})
        return {"text": response.text, "segments": segments}
    else:
        logger.info(f"Large file ({file_size / 1024 / 1024:.1f}MB), splitting...")
        audio = AudioSegment.from_file(file_path)
        chunk_ms = 10 * 60 * 1000
        total_chunks = math.ceil(len(audio) / chunk_ms)
        all_text = []
        all_segments = []
        for i in range(total_chunks):
            chunk = audio[i * chunk_ms : (i + 1) * chunk_ms]
            offset_seconds = (i * chunk_ms) / 1000.0
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                chunk.export(tmp.name, format="mp3", bitrate="64k")
                tmp_path = tmp.name
            try:
                with open(tmp_path, "rb") as f:
                    kwargs = {
                        "file": f,
                        "model": "whisper-1",
                        "response_format": "verbose_json",
                        "timestamp_granularities": ["segment"],
                        "prompt": "College lecture. English, Hindi, Marathi, Hinglish.",
                        "temperature": 0.0,
                    }
                    if language != "auto":
                        kwargs["language"] = language
                    response = await stt.transcribe(**kwargs)
                all_text.append(response.text)
                if hasattr(response, 'segments') and response.segments:
                    for seg in response.segments:
                        all_segments.append({
                            "start": seg.start + offset_seconds,
                            "end": seg.end + offset_seconds,
                            "text": seg.text.strip()
                        })
                logger.info(f"Chunk {i+1}/{total_chunks} done")
            finally:
                os.unlink(tmp_path)
        return {"text": " ".join(all_text), "segments": all_segments}

async def generate_notes_from_transcript(transcript: str) -> dict:
    """Generate structured notes from transcript using GPT"""
    chat = LlmChat(
        api_key=get_api_key(),
        session_id=f"notes-{uuid.uuid4()}",
        system_message="""You are an expert academic note-taker. Convert lecture transcripts into well-structured notes.
Output MUST be valid JSON with this exact structure:
{
  "title": "Lecture topic title",
  "summary": "2-3 sentence overview of the lecture",
  "sections": [
    {
      "heading": "Section heading",
      "points": ["Key point 1", "Key point 2"],
      "key_concepts": ["Concept 1", "Concept 2"]
    }
  ],
  "key_takeaways": ["Takeaway 1", "Takeaway 2"]
}
Remove all filler words, noise, and irrelevant conversation. Focus on academic content only.
Output ONLY the JSON, no markdown formatting or code blocks."""
    ).with_model("openai", "gpt-5.2")

    max_chars = 12000
    if len(transcript) > max_chars:
        chunks = [transcript[i:i+max_chars] for i in range(0, len(transcript), max_chars)]
        all_notes = []
        for idx, chunk in enumerate(chunks):
            msg = UserMessage(text=f"Convert this lecture transcript part {idx+1}/{len(chunks)} into structured notes:\n\n{chunk}")
            response = await chat.send_message(msg)
            all_notes.append(response)
        combine_chat = LlmChat(
            api_key=get_api_key(),
            session_id=f"combine-{uuid.uuid4()}",
            system_message="""Combine partial lecture notes into one cohesive set. Output MUST be valid JSON:
{"title":"...","summary":"...","sections":[{"heading":"...","points":["..."],"key_concepts":["..."]}],"key_takeaways":["..."]}
Output ONLY the JSON, no markdown or code blocks."""
        ).with_model("openai", "gpt-5.2")
        msg = UserMessage(text=f"Combine these partial notes:\n\n{'---'.join(all_notes)}")
        response = await combine_chat.send_message(msg)
    else:
        msg = UserMessage(text=f"Convert this lecture transcript into structured notes:\n\n{transcript}")
        response = await chat.send_message(msg)

    try:
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()
            if clean.startswith("json"):
                clean = clean[4:].strip()
        return json.loads(clean)
    except json.JSONDecodeError:
        return {
            "title": "Lecture Notes",
            "summary": "Notes generated from lecture transcript.",
            "sections": [{"heading": "Transcript", "points": [response[:2000]], "key_concepts": []}],
            "key_takeaways": ["Review the full transcript for details."]
        }

async def generate_flashcards_from_notes(notes: dict) -> list:
    """Generate flashcards from notes using GPT"""
    chat = LlmChat(
        api_key=get_api_key(),
        session_id=f"flashcards-{uuid.uuid4()}",
        system_message="""Generate flashcards from lecture notes for exam preparation.
Output MUST be valid JSON array:
[{"front": "Question or concept", "back": "Answer or explanation"}, ...]
Create 8-15 flashcards covering all key concepts. Questions should test understanding.
Output ONLY the JSON array, no markdown or code blocks."""
    ).with_model("openai", "gpt-5.2")

    msg = UserMessage(text=f"Generate flashcards from these notes:\n\n{json.dumps(notes, indent=2)}")
    response = await chat.send_message(msg)

    try:
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1] if "\n" in clean else clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()
            if clean.startswith("json"):
                clean = clean[4:].strip()
        return json.loads(clean)
    except json.JSONDecodeError:
        return [{"front": "Review your notes", "back": response[:500]}]

# ─── Direct OpenAI (Commented Out — For Future Scaling) ────
# import openai
# async def transcribe_audio_openai(file_path, language="en"):
#     client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
#     with open(file_path, "rb") as f:
#         resp = await client.audio.transcriptions.create(model="whisper-1", file=f, language=language)
#     return resp.text
#
# async def generate_notes_openai(transcript):
#     client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
#     resp = await client.chat.completions.create(
#         model="gpt-4o",
#         messages=[{"role":"system","content":"Convert to structured JSON notes..."},
#                   {"role":"user","content":transcript}],
#         response_format={"type":"json_object"}
#     )
#     return json.loads(resp.choices[0].message.content)
# ─── End Direct OpenAI ─────────────────────────────────

# ─── API Routes (Thin Proxy — No Storage) ──────────────

@api_router.get("/")
async def root():
    return {"message": "AI Lecture Companion API — Thin Proxy"}

class TranscriptRequest(BaseModel):
    transcript: str

class NotesRequest(BaseModel):
    notes: dict

@api_router.post("/transcribe")
async def api_transcribe(file: UploadFile = File(...), language: str = Query(default="en")):
    """Upload audio → get transcript back. Audio is deleted after processing."""
    with tempfile.NamedTemporaryFile(suffix=f".{file.filename.split('.')[-1] if file.filename and '.' in file.filename else 'm4a'}", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    file_size_mb = os.path.getsize(tmp_path) / (1024 * 1024)
    logger.info(f"Transcribing audio: {file_size_mb:.1f}MB, language={language}")

    try:
        result = await transcribe_audio(tmp_path, language)
        logger.info(f"Transcription complete: {len(result['text'])} chars, {len(result['segments'])} segments")
        return {"transcript": result["text"], "segments": result["segments"]}
    except Exception as e:
        logger.error(f"Transcription failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # Always delete audio file — no storage on server
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
            logger.info("Audio file deleted after processing")

@api_router.post("/generate-notes")
async def api_generate_notes(data: TranscriptRequest):
    """Send transcript → get structured notes back."""
    logger.info(f"Generating notes from {len(data.transcript)} chars")
    try:
        notes = await generate_notes_from_transcript(data.transcript)
        logger.info("Notes generated successfully")
        return {"notes": notes}
    except Exception as e:
        logger.error(f"Note generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Note generation failed: {str(e)}")

@api_router.post("/generate-flashcards")
async def api_generate_flashcards(data: NotesRequest):
    """Send notes → get flashcards back."""
    logger.info("Generating flashcards")
    try:
        flashcards = await generate_flashcards_from_notes(data.notes)
        logger.info(f"Generated {len(flashcards)} flashcards")
        return {"flashcards": flashcards, "count": len(flashcards)}
    except Exception as e:
        logger.error(f"Flashcard generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Flashcard generation failed: {str(e)}")

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
