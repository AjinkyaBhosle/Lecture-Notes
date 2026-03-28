# AI Lecture Companion - PRD

## Product Overview
A mobile-first application that helps students convert lecture audio into structured notes using AI (OpenAI Whisper for transcription + GPT for note generation).

## Architecture
- **Frontend**: Expo SDK 54, React Native, expo-router
- **Backend**: FastAPI + MongoDB (motor async driver)
- **AI**: OpenAI Whisper (transcription) + GPT-5.2 (note generation) via Emergent LLM Key
- **Audio**: expo-audio for recording

## Core Features
1. **Audio Recording** - Record lectures up to 90 mins with timer, pause/resume/stop controls
2. **AI Transcription** - Whisper API with chunking for files >25MB. Supports English/Hindi/Marathi/Hinglish
3. **Smart Note Generation** - GPT converts transcript into structured JSON (title, summary, sections with headings/points/concepts, key takeaways)
4. **Processing Screen** - Real-time progress (uploading → transcribing → generating → done)
5. **Notes View** - Beautiful rendered notes with sections, bullet points, concept chips, takeaways
6. **Export & Share** - PDF export via expo-print, text sharing via Share API (WhatsApp compatible)
7. **Offline-First** - Record offline, process when online, view notes offline

## Screens
- `/` - Home (lecture list with pull-to-refresh)
- `/record` - Recording with timer and controls
- `/processing/[id]` - Processing progress with steps
- `/notes/[id]` - Structured notes view with export/share

## API Endpoints
- `GET /api/lectures` - List all lectures
- `POST /api/lectures` - Create lecture
- `GET /api/lectures/:id` - Get lecture details
- `PUT /api/lectures/:id` - Update lecture title
- `DELETE /api/lectures/:id` - Delete lecture
- `POST /api/lectures/:id/upload-audio` - Upload audio file
- `POST /api/lectures/:id/process` - Transcribe + generate notes
- `GET /api/lectures/:id/status` - Get processing status

## Design
- Theme: Indigo (#4F46E5) primary, light zinc backgrounds
- Professional, student-friendly interface
- Minimum 44px touch targets
- 8pt grid spacing system

## Future Scaling
- Direct OpenAI API code commented out in server.py for production scaling
- Switch from Emergent LLM key to direct OpenAI API key (1-line change)
- Estimated cost per lecture: ~$0.20-0.60 for 60-min lecture
