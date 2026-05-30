# Dedicated Project Migration (2026-05-30)

## Purpose

Create a dedicated GCP home for T.A.L.K so future Cloud Run, Firestore, Artifact Registry, and Secret Manager operations are isolated from the broader `leadflow-review` project.

## Target Project

- Project id: `gen-lang-client-0379372331`
- Project number: `36381735293`
- Project name: `TALK`
- Region used for runtime resources: `us-central1`

## Resources Created Or Confirmed

- Enabled APIs: Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Firestore, and Cloud Storage.
- Artifact Registry repository: `us-central1-docker.pkg.dev/gen-lang-client-0379372331/talk-app`
- Cloud Build staging bucket: `gs://gen-lang-client-0379372331_cloudbuild`
- Firestore database: `projects/gen-lang-client-0379372331/databases/(default)`, native mode, `us-central1`
- Secret Manager secret: `talk-gemini-api-key`
- Cloud Run service: `talk-app`

The Gemini key was copied into the new project through Secret Manager without printing or committing the secret value.

No app upload bucket was created. The current service does not set `GCS_UPLOAD_BUCKET`, so creating a public object bucket would be unused until backdrop uploads or another object-upload feature is intentionally enabled.

## IAM Changes

The default compute service account `36381735293-compute@developer.gserviceaccount.com` is the Cloud Build and Cloud Run runtime identity for this migration. It was granted:

- `roles/storage.objectViewer` on `gs://gen-lang-client-0379372331_cloudbuild`
- `roles/artifactregistry.writer` on `gen-lang-client-0379372331`
- `roles/datastore.user` on `gen-lang-client-0379372331`
- `roles/logging.logWriter` on `gen-lang-client-0379372331`
- `roles/secretmanager.secretAccessor` on `talk-gemini-api-key`

## Build And Deploy

- Build id: `1e16e453-b08f-47ec-abee-d4b7d82beabf`
- Image tag: `us-central1-docker.pkg.dev/gen-lang-client-0379372331/talk-app/talk-app:sync-20260530`
- Image digest: `sha256:2e6d1eadc6c6f245889c79d5e1da36a462ee86b3817b08a48350bb4f992f2281`
- Fully qualified digest: `us-central1-docker.pkg.dev/gen-lang-client-0379372331/talk-app/talk-app@sha256:2e6d1eadc6c6f245889c79d5e1da36a462ee86b3817b08a48350bb4f992f2281`
- Active revision: `talk-app-00001-6m7`
- Traffic: 100%

## URLs

- Current client URL, still served by `leadflow-review`: `https://talk-app-gdyt2qma6a-uc.a.run.app/`
- Dedicated-project canonical URL: `https://talk-app-z7oaignqja-uc.a.run.app/`
- Dedicated-project alternate URL shown during deploy: `https://talk-app-36381735293.us-central1.run.app/`

The existing client URL was not cut over. Cloud Run default URLs are project/service specific, so the old `gdyt2qma6a` URL remains tied to `leadflow-review/talk-app`.

## Verification

- Dedicated root page returned 200 with title `T.A.L.K - Tactically Analyzing Language for Knowledge`.
- Dedicated `/api/health` returned:
  - `ok: true`
  - `storageBackend: firestore`
  - `geminiConfigured: true`
  - `firebaseConfigured: true`
- Cloud Run service status was Ready with `talk-app-00001-6m7` receiving 100% traffic.
- Firestore database describe returned native mode in `us-central1`.
- Live API smoke created private lobby `BLG7LT`, joined a second guest player, assigned `Conversationalist` and `Referee` roles, started the game, and confirmed phase `CONVERSATION`.

## Follow-Up

- Decide whether Byron should keep using the existing `leadflow-review` URL or receive the new dedicated-project URL.
- Prefer adding a stable custom domain before any long-term client cutover, so future project moves do not change the client-facing link.
- If existing Firestore lobby/profile history must follow the new project, run an explicit Firestore export/import or targeted copy before cutover.
