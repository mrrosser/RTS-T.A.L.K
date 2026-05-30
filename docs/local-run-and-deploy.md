# Local Run and Deploy

## Quick Start

The default local experience needs no extra configuration:

```bash
npm install
npm run dev:api
npm run dev
```

Open `http://localhost:3000`.

This quick-start mode uses:

- guest sign-in only
- in-memory lobby/profile/session storage
- SSE lobby updates with polling fallback
- local gameplay/domain logic without external providers

The following features stay disabled until configured:

- Google, Apple, and phone sign-in
- Gemini-generated icebreakers, fact-check responses, and transcript cleanup assist
- LiveKit-backed player audio/video calls
- backdrop upload signed URLs
- Firestore-backed persistence across restarts

## Configuration Surface

### Backend environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Express listen port. Cloud Run injects this automatically. Defaults to `8080`. |
| `CORS_ALLOWLIST` | No | Comma-separated allowed browser origins. Defaults to `http://localhost:3000`. |
| `TALK_STORAGE_BACKEND` | No | Storage adapter. Use `memory` for local quick start or `firestore` for durable storage. Defaults to `memory`. |
| `GEMINI_API_KEY` | No | Enables generated icebreakers, `/api/fact-check`, and `/api/transcript-assist`. |
| `FIREBASE_AUTH_STRICT` | No | When `true`, reject bearer tokens if Firebase Admin verification is unavailable. |
| `FIREBASE_PROJECT_ID` | No | Firebase Admin / Firestore project id. Required for Firestore storage and token verification when using ADC. |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Absolute path to a service-account JSON file for local ADC-based Firestore/Auth/GCS access. |
| `FIREBASE_CLIENT_EMAIL` | No | Alternate explicit Firebase Admin credential field for local runs. |
| `FIREBASE_PRIVATE_KEY` | No | Alternate explicit Firebase Admin private key for local runs. Keep in secret storage, never in git. |
| `LIVEKIT_API_KEY` | No | Enables LiveKit token minting. |
| `LIVEKIT_API_SECRET` | No | Enables LiveKit token minting. Keep in secret storage. |
| `LIVEKIT_WS_URL` | No | LiveKit websocket URL returned to clients. |
| `GCS_UPLOAD_BUCKET` | No | Enables signed backdrop upload URLs and public asset paths. Uploaded objects must be readable from `https://storage.googleapis.com/<bucket>/<object>`. |

### Frontend environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_BACKEND_PROXY_TARGET` | No | Vite dev proxy target for `/api`. Defaults to `http://localhost:8080`. |
| `VITE_API_BASE_URL` | No | Absolute API base URL when the frontend is hosted separately. Leave unset for the bundled container and normal local dev. |
| `VITE_FIREBASE_API_KEY` | No | Enables Firebase client auth flows. |
| `VITE_FIREBASE_AUTH_DOMAIN` | No | Firebase client auth config. |
| `VITE_FIREBASE_PROJECT_ID` | No | Firebase client auth config. |
| `VITE_FIREBASE_APP_ID` | No | Firebase client auth config. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | No | Firebase client auth config. |

Notes:

- Google, Apple, and phone sign-in buttons remain disabled until the Firebase client variables above are present.
- Guest mode remains available even when Firebase is not configured.
- When `TALK_STORAGE_BACKEND=firestore`, prefer ADC (`GOOGLE_APPLICATION_CREDENTIALS` locally, attached service account on Cloud Run) instead of committing credential files.

## Full Local Setup

Use this when you need durable storage or provider-backed features during development.

1. Set backend env vars for the integrations you need.
   For durable state: `TALK_STORAGE_BACKEND=firestore` and `FIREBASE_PROJECT_ID`.
   For local ADC: set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON path.
   For strict token verification: set `FIREBASE_AUTH_STRICT=true` only after Firebase Admin auth is working.
2. Set the frontend Firebase `VITE_*` variables if you want Google, Apple, or phone sign-in in the browser.
3. Start the backend with `npm run dev:api`.
4. Start the frontend with `npm run dev`.

## Verification

Run these before shipping:

```bash
npm run typecheck
npm run test:run
npm run test:smoke
npm run build
```

## Cloud Run Deploy

This repo ships as one container: Vite builds the frontend into `dist/`, and the Node runtime serves both the SPA and `/api/*`.

### Current live client

- Live URL: `https://talk-app-gdyt2qma6a-uc.a.run.app/`
- Cloud Run project: `leadflow-review`
- Cloud Run service: `talk-app`
- Region: `us-central1`
- Associated Google AI Studio / Gemini project context: `gen-lang-client-0379372331` (`TALK`)

The live client URL is served by the `leadflow-review` Cloud Run service. The `gen-lang-client-0379372331` project is retained as related project context, but deploying to that project would not update the current client URL unless the hosting target is intentionally moved.

Future migration note: T.A.L.K should move into a dedicated RTS T.A.L.K GCP project when there is time to migrate IAM, Artifact Registry, Firestore data, secrets, and the client URL intentionally. Do not mix that migration into routine client updates.

### Recommended runtime shape

- Cloud Run service account with Firestore access when `TALK_STORAGE_BACKEND=firestore`
- Cloud Run service account with GCS write access when `GCS_UPLOAD_BUCKET` is enabled
- Secret Manager for `GEMINI_API_KEY`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`
- Same-origin frontend/API deployment, so `VITE_API_BASE_URL` should stay unset in the built app

### Example deploy

```bash
gcloud builds submit \
  --project leadflow-review \
  --tag us-central1-docker.pkg.dev/leadflow-review/cloud-run-source-deploy/talk-app:sync-20260530

gcloud run deploy talk-app \
  --project leadflow-review \
  --image us-central1-docker.pkg.dev/leadflow-review/cloud-run-source-deploy/talk-app:sync-20260530 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars=TALK_STORAGE_BACKEND=firestore,FIREBASE_PROJECT_ID=leadflow-review \
  --set-secrets=GEMINI_API_KEY=mission-control-pvzaGn5TxDaf84d0st4N52nCc3T2-geminiKey:latest
```

PowerShell note: keep the `--set-env-vars=...` argument quoted or in equals form so the comma-separated values remain one gcloud argument.

### Post-deploy checks

1. Open `/api/health` and confirm `ok: true`.
2. Confirm `storageBackend` is the expected adapter.
3. Test guest login, lobby create/join, and a basic gameplay flow.
4. If Firebase browser auth is enabled, confirm Google/Apple/phone flows in the deployed origin.
