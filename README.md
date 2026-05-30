<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# RTS T.A.L.K

T.A.L.K (Tactically Analyzing Language for Knowledge) is a browser-based multiplayer debate game with role-based moderation, viewer fact-check voting, and backend-synced lobby state.

## Architecture

- Frontend: React + Vite + compiled Tailwind CSS
- Backend: Express API (`/api/*`) for auth bootstrap, lobby state, LiveKit/GCS provider integrations, and Gemini-backed helpers
- Storage: environment-driven `memory` or Firestore repository adapter
- Auth: guest mode plus Firebase-backed Google, Apple, and phone sign-in when configured
- Sync model: SSE lobby stream with polling fallback (no browser `localStorage` state authority)
- Logging: structured JSON logs with correlation IDs on frontend and backend

## Gameplay Systems Implemented

- Scoring and winner computation with reply-efficiency weighting (fewer replies improves score).
- Per-round indicator and lifeline rules for conversationalists (`red/yellow/green` + lifeline usage limits).
- Private conversationalist question banks with reveal-on-ask flow and server-side privacy filtering.
- Trusted sources per conversationalist, visible in participant views and usable in trusted-sourcing lifelines.
- Referee moderation note shortcuts broadcast to the main game screen.
- Time Keeper detailed timeline sections (duration + summary) and highlight-on-main-screen controls.
- Audio draft workflow: conversationalist mic capture, live transcript preview, chop-and-repeat redo locks, Gemini cleanup assist, referee approval, and standardized voice playback via browser speech synthesis.
- Audience challenge flow for reversible referee actions.
- Session/profile memory for trusted sources, approved phrases, backdrops, and completed game history.
- LiveKit-backed player call surface with mic/camera toggles, participant tiles, and presence sync when media is configured.
- Provider-gated backdrop upload integration for production environments.

## Local Development

Full local run, env, and Cloud Run deployment guidance lives in [docs/local-run-and-deploy.md](docs/local-run-and-deploy.md).

Quick start:

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
npm run test:smoke
npm run build
```

## Deploy (Cloud Run)

Use the single-container Cloud Run flow documented in [docs/local-run-and-deploy.md](docs/local-run-and-deploy.md). The recommended production shape uses Firestore-backed storage, Secret Manager for provider credentials, and same-origin frontend/API serving from the Node container.

## Mobile/Tablet Efficiency

- Visibility-aware polling reduces background battery/network use.
- Reduced-motion and small-screen animation optimizations are enabled.
- Timer pause/resume preserves remaining duration across clients.
- Timeline size is capped server-side to avoid unbounded rendering cost.
- Pending/private payloads are filtered server-side by requestor (`x-player-id`) to avoid unnecessary sensitive data transfer.
