<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# RTS T.A.L.K

T.A.L.K (Tactically Altering Language for Knowledge) is a browser-based multiplayer debate game with role-based moderation, viewer fact-check voting, and backend-synced lobby state.

## Architecture

- Frontend: React + Vite + compiled Tailwind CSS
- Backend: Express API (`/api/*`) for lobby state and Gemini fact-checking
- Sync model: clients poll backend state (no browser `localStorage` state authority)
- Logging: structured JSON logs with correlation IDs on frontend and backend

## Gameplay Systems Implemented

- Scoring and winner computation with reply-efficiency weighting (fewer replies improves score).
- Per-round indicator and lifeline rules for conversationalists (`red/yellow/green` + lifeline usage limits).
- Private conversationalist question banks with reveal-on-ask flow and server-side privacy filtering.
- Trusted sources per conversationalist, visible in participant views and usable in trusted-sourcing lifelines.
- Referee moderation note shortcuts broadcast to the main game screen.
- Time Keeper detailed timeline sections (duration + summary) and highlight-on-main-screen controls.
- Audio draft workflow: conversationalist mic capture, referee approval, and standardized voice playback via browser speech synthesis.

## Local Development

### Prerequisites

- Node.js 22+
- npm 10+

### Environment Variables

Backend (`server`):

```bash
GEMINI_API_KEY=your_server_side_gemini_key
PORT=8080
CORS_ALLOWLIST=http://localhost:3000
```

Frontend (`vite`, optional):

```bash
VITE_BACKEND_PROXY_TARGET=http://localhost:8080
```

`VITE_API_BASE_URL` is optional and defaults to same-origin `/api` paths.
For local development, keep it unset and use the Vite proxy.
If `GEMINI_API_KEY` is unset, fact-checking returns a disabled/configuration message.

### Run

Terminal 1:

```bash
npm install
npm run dev:api
```

Terminal 2:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Quality Checks

```bash
npm run typecheck
npm run test:run
npm run build
```

## Deploy (Cloud Run)

This repo includes a Dockerfile that serves the frontend and backend from one container.

### Build and deploy

```bash
gcloud builds submit --tag gcr.io/<GCP_PROJECT_ID>/talk-app
gcloud run deploy talk-app \
  --image gcr.io/<GCP_PROJECT_ID>/talk-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

Recommended production hardening:

- Store `GEMINI_API_KEY` in Secret Manager and bind it to Cloud Run.
- Keep API key server-side only.
- Add a shared distributed store (Redis/Firestore/Postgres) if you scale to multiple backend instances.

## Mobile/Tablet Efficiency

- Visibility-aware polling reduces background battery/network use.
- Reduced-motion and small-screen animation optimizations are enabled.
- Timer pause/resume preserves remaining duration across clients.
- Timeline size is capped server-side to avoid unbounded rendering cost.
- Pending/private payloads are filtered server-side by requestor (`x-player-id`) to avoid unnecessary sensitive data transfer.
