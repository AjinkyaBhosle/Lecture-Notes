from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import tempfile
import math
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from pydub import AudioSegment
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Upload directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ─── Models ────────────────────────────────────────────
class LectureCreate(BaseModel):
    title: str = "Untitled Lecture"

class LectureUpdate(BaseModel):
    title: Optional[str] = None

class LectureResponse(BaseModel):
    id: str
    title: str
    status: str
    duration_seconds: float = 0
    transcript: Optional[str] = None
    structured_notes: Optional[dict] = None
    created_at: str
    updated_at: str

class ProcessingStatus(BaseModel):
    lecture_id: str
    status: str
    step: str
    progress: float
    message: str

# ─── Helpers ───────────────────────────────────────────

def lecture_to_response(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "title": doc.get("title", "Untitled Lecture"),
        "status": doc.get("status", "recorded"),
        "duration_seconds": doc.get("duration_seconds", 0),
        "transcript": doc.get("transcript"),
        "structured_notes": doc.get("structured_notes"),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }

# ─── Emergent LLM Integration (ACTIVE) ────────────────
from emergentintegrations.llm.openai import OpenAISpeechToText
from emergentintegrations.llm.chat import LlmChat, UserMessage

async def transcribe_audio_emergent(file_path: str) -> str:
    """Transcribe audio using Emergent LLM key + Whisper"""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise ValueError("EMERGENT_LLM_KEY not set")

    stt = OpenAISpeechToText(api_key=api_key)

    # Check file size - Whisper limit is 25MB
    file_size = os.path.getsize(file_path)
    max_size = 24 * 1024 * 1024  # 24MB to be safe

    if file_size <= max_size:
        # Direct transcription
        with open(file_path, "rb") as audio_file:
            response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                response_format="json",
                prompt="This is a college lecture. May contain English, Hindi, Marathi, or mixed Hinglish.",
                temperature=0.0
            )
        return response.text
    else:
        # Chunk large files
        logger.info(f"Large file ({file_size / 1024 / 1024:.1f}MB), splitting into chunks...")
        return await transcribe_large_audio(file_path, stt)

async def transcribe_large_audio(file_path: str, stt: OpenAISpeechToText) -> str:
    """Split large audio and transcribe in chunks"""
    audio = AudioSegment.from_file(file_path)
    chunk_duration_ms = 10 * 60 * 1000  # 10 minutes per chunk
    total_chunks = math.ceil(len(audio) / chunk_duration_ms)
    transcripts = []

    for i in range(total_chunks):
        start = i * chunk_duration_ms
        end = min((i + 1) * chunk_duration_ms, len(audio))
        chunk = audio[start:end]

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            chunk.export(tmp.name, format="mp3", bitrate="64k")
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as f:
                response = await stt.transcribe(
                    file=f,
                    model="whisper-1",
                    response_format="json",
                    prompt="College lecture. English, Hindi, Marathi, Hinglish.",
                    temperature=0.0
                )
            transcripts.append(response.text)
            logger.info(f"Chunk {i+1}/{total_chunks} transcribed")
        finally:
            os.unlink(tmp_path)

    return " ".join(transcripts)

async def generate_notes_emergent(transcript: str) -> dict:
    """Generate structured notes using Emergent LLM key + GPT"""
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise ValueError("EMERGENT_LLM_KEY not set")

    chat = LlmChat(
        api_key=api_key,
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

    # For very long transcripts, chunk and summarize
    max_chars = 12000
    if len(transcript) > max_chars:
        # Process in chunks and combine
        chunks = [transcript[i:i+max_chars] for i in range(0, len(transcript), max_chars)]
        all_notes = []
        for idx, chunk in enumerate(chunks):
            msg = UserMessage(text=f"Convert this lecture transcript part {idx+1}/{len(chunks)} into structured notes:\n\n{chunk}")
            response = await chat.send_message(msg)
            all_notes.append(response)

        # Final consolidation
        combine_chat = LlmChat(
            api_key=api_key,
            session_id=f"combine-{uuid.uuid4()}",
            system_message="""Combine these partial lecture notes into one cohesive set of structured notes.
Output MUST be valid JSON with this exact structure:
{
  "title": "Lecture topic title",
  "summary": "2-3 sentence overview",
  "sections": [
    {
      "heading": "Section heading",
      "points": ["Key point 1", "Key point 2"],
      "key_concepts": ["Concept 1"]
    }
  ],
  "key_takeaways": ["Takeaway 1", "Takeaway 2"]
}
Output ONLY the JSON, no markdown formatting or code blocks."""
        ).with_model("openai", "gpt-5.2")

        combined = "\n\n---\n\n".join(all_notes)
        msg = UserMessage(text=f"Combine these partial notes into one set:\n\n{combined}")
        response = await combine_chat.send_message(msg)
    else:
        msg = UserMessage(text=f"Convert this lecture transcript into structured notes:\n\n{transcript}")
        response = await chat.send_message(msg)

    # Parse JSON from response
    import json
    try:
        # Clean the response - remove markdown code blocks if present
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
        logger.error(f"Failed to parse notes JSON: {response[:200]}")
        return {
            "title": "Lecture Notes",
            "summary": "Notes generated from lecture transcript.",
            "sections": [{"heading": "Transcript", "points": [response], "key_concepts": []}],
            "key_takeaways": ["Review the full transcript for details."]
        }

# ─── Direct OpenAI Integration (COMMENTED OUT - For future scaling) ────
# Uncomment below and replace EMERGENT_LLM_KEY with your OPENAI_API_KEY when scaling
#
# import openai
#
# async def transcribe_audio_openai(file_path: str) -> str:
#     """Transcribe audio using direct OpenAI API key"""
#     client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
#     file_size = os.path.getsize(file_path)
#     max_size = 24 * 1024 * 1024
#
#     if file_size <= max_size:
#         with open(file_path, "rb") as audio_file:
#             response = await client.audio.transcriptions.create(
#                 model="whisper-1",
#                 file=audio_file,
#                 response_format="json",
#                 prompt="College lecture. English, Hindi, Marathi, Hinglish."
#             )
#         return response.text
#     else:
#         # Split and transcribe chunks
#         audio = AudioSegment.from_file(file_path)
#         chunk_ms = 10 * 60 * 1000
#         transcripts = []
#         for i in range(math.ceil(len(audio) / chunk_ms)):
#             chunk = audio[i*chunk_ms : (i+1)*chunk_ms]
#             with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
#                 chunk.export(tmp.name, format="mp3", bitrate="64k")
#                 with open(tmp.name, "rb") as f:
#                     resp = await client.audio.transcriptions.create(
#                         model="whisper-1", file=f, response_format="json"
#                     )
#                 transcripts.append(resp.text)
#                 os.unlink(tmp.name)
#         return " ".join(transcripts)
#
# async def generate_notes_openai(transcript: str) -> dict:
#     """Generate structured notes using direct OpenAI API"""
#     client = openai.AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
#     response = await client.chat.completions.create(
#         model="gpt-4o",
#         messages=[
#             {"role": "system", "content": "Convert transcripts to structured JSON notes..."},
#             {"role": "user", "content": f"Convert this transcript:\n\n{transcript}"}
#         ],
#         response_format={"type": "json_object"}
#     )
#     return json.loads(response.choices[0].message.content)
# ─── End Direct OpenAI (Commented Out) ─────────────────

# ─── API Routes ────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "AI Lecture Companion API"}

@api_router.post("/lectures", response_model=LectureResponse)
async def create_lecture(data: LectureCreate):
    now = datetime.now(timezone.utc).isoformat()
    lecture = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "status": "recorded",
        "duration_seconds": 0,
        "transcript": None,
        "structured_notes": None,
        "audio_path": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.lectures.insert_one(lecture)
    return lecture_to_response(lecture)

@api_router.get("/lectures", response_model=List[LectureResponse])
async def list_lectures():
    lectures = await db.lectures.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [lecture_to_response(lec) for lec in lectures]

@api_router.get("/lectures/{lecture_id}", response_model=LectureResponse)
async def get_lecture(lecture_id: str):
    lecture = await db.lectures.find_one({"id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return lecture_to_response(lecture)

@api_router.delete("/lectures/{lecture_id}")
async def delete_lecture(lecture_id: str):
    lecture = await db.lectures.find_one({"id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    # Delete audio file if exists
    if lecture.get("audio_path") and os.path.exists(lecture["audio_path"]):
        os.unlink(lecture["audio_path"])
    await db.lectures.delete_one({"id": lecture_id})
    return {"message": "Lecture deleted"}

@api_router.put("/lectures/{lecture_id}", response_model=LectureResponse)
async def update_lecture(lecture_id: str, data: LectureUpdate):
    lecture = await db.lectures.find_one({"id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.title is not None:
        updates["title"] = data.title
    await db.lectures.update_one({"id": lecture_id}, {"$set": updates})
    lecture.update(updates)
    return lecture_to_response(lecture)

@api_router.post("/lectures/{lecture_id}/upload-audio")
async def upload_audio(lecture_id: str, file: UploadFile = File(...), duration: float = 0):
    lecture = await db.lectures.find_one({"id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Save audio file
    file_ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "m4a"
    file_path = str(UPLOAD_DIR / f"{lecture_id}.{file_ext}")

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    logger.info(f"Audio uploaded: {file_path} ({file_size_mb:.1f}MB, {duration}s)")

    await db.lectures.update_one(
        {"id": lecture_id},
        {"$set": {
            "audio_path": file_path,
            "duration_seconds": duration,
            "status": "uploaded",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Audio uploaded", "file_size_mb": round(file_size_mb, 2)}

@api_router.post("/lectures/{lecture_id}/process", response_model=LectureResponse)
async def process_lecture(lecture_id: str):
    """Full pipeline: transcribe audio → generate structured notes"""
    lecture = await db.lectures.find_one({"id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if not lecture.get("audio_path") or not os.path.exists(lecture.get("audio_path", "")):
        raise HTTPException(status_code=400, detail="No audio file found. Upload audio first.")

    # Update status to processing
    await db.lectures.update_one(
        {"id": lecture_id},
        {"$set": {"status": "transcribing", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    try:
        # Step 1: Transcribe
        logger.info(f"Transcribing lecture {lecture_id}...")
        transcript = await transcribe_audio_emergent(lecture["audio_path"])
        logger.info(f"Transcription complete: {len(transcript)} chars")

        await db.lectures.update_one(
            {"id": lecture_id},
            {"$set": {
                "transcript": transcript,
                "status": "generating_notes",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

        # Step 2: Generate notes
        logger.info(f"Generating notes for lecture {lecture_id}...")
        notes = await generate_notes_emergent(transcript)
        logger.info("Notes generated successfully")

        now = datetime.now(timezone.utc).isoformat()
        await db.lectures.update_one(
            {"id": lecture_id},
            {"$set": {
                "structured_notes": notes,
                "status": "completed",
                "title": notes.get("title", lecture.get("title", "Untitled Lecture")),
                "updated_at": now
            }}
        )

        updated = await db.lectures.find_one({"id": lecture_id}, {"_id": 0})
        return lecture_to_response(updated)

    except Exception as e:
        logger.error(f"Processing failed for lecture {lecture_id}: {str(e)}")
        await db.lectures.update_one(
            {"id": lecture_id},
            {"$set": {"status": "error", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@api_router.get("/lectures/{lecture_id}/status")
async def get_processing_status(lecture_id: str):
    lecture = await db.lectures.find_one({"id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    status = lecture.get("status", "recorded")
    step_map = {
        "recorded": {"step": "idle", "progress": 0, "message": "Ready to process"},
        "uploaded": {"step": "uploaded", "progress": 10, "message": "Audio uploaded"},
        "transcribing": {"step": "transcribing", "progress": 30, "message": "Transcribing audio..."},
        "generating_notes": {"step": "generating", "progress": 70, "message": "Generating structured notes..."},
        "completed": {"step": "done", "progress": 100, "message": "Notes ready!"},
        "error": {"step": "error", "progress": 0, "message": "Processing failed"},
    }
    info = step_map.get(status, {"step": "unknown", "progress": 0, "message": status})
    return {
        "lecture_id": lecture_id,
        "status": status,
        **info
    }

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
