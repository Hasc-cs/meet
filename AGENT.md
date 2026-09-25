# open chat
- frontend: next.js in frontend /(port 3000)
- backend: fastapi in backend /(port 8000)
- ai: ollama at localhost:11434,modal llama 3.2:3b
- test : cd backend && pytest
# rules
- i am a bigggner : explain change simply
- never commit .env or api keys
- run the test after any change    
# Meet — AGENTS.md

Full-stack AI app. Read this before coding.

## Stack

* Frontend: Next.js 16, React 19, TypeScript 7, Tailwind 4, shadcn/ui
* Backend: FastAPI, Python 3.13, uv, Ruff, pytest
* Local AI: Ollama (`localhost:11434`) — `gemma3:1b`
* Cloud fallback: OpenAI, Anthropic, Grok, Gemini

## Commands

```bash
# Frontend
cd frontend && npm install && npm run dev   # :3000

# Backend
cd backend && uv sync && uv run fastapi dev # :8000

# Test
cd backend && pytest
```

## Rules

* Follow existing patterns; keep changes small.
* TypeScript frontend; typed Python backend.
* Run tests after every change.
* Add/update tests for changed behavior.
* Run Ruff on backend changes.
* Never commit `.env`, API keys, or secrets.
* Never expose AI/API keys to frontend.
* Local AI first; cloud AI only as fallback.
* Keep AI providers behind a common interface.
* Don't add dependencies without need.
* Don't modify unrelated files.
