# Sync Audit Report (2026-05-30)

## Purpose

Reconcile the T.A.L.K GitHub repository, local working tree, and live client deployment before the next client-facing update.

## Hosting Facts

- Live client URL: `https://talk-app-gdyt2qma6a-uc.a.run.app/`
- Serving Cloud Run project: `leadflow-review`
- Serving Cloud Run service: `talk-app`
- Region: `us-central1`
- Associated Google AI Studio / Gemini project context: `gen-lang-client-0379372331` (`TALK`)

The current client URL is served from `leadflow-review`. The `gen-lang-client-0379372331` project is related context from the earlier AI Studio / Gemini workflow, but it is not the current serving project for the live Cloud Run URL.

## Source Sync Findings

- `origin/main` was behind the live/local source used for the March and May readiness work.
- The deployed Cloud Run source zip matched most of the local working tree, confirming the local uncommitted files were not throwaway work.
- May-only local deltas were concentrated in auth hardening, LiveKit/control stability, package hardening, tests, and readiness documentation.
- This sync keeps the current client URL stable by redeploying `leadflow-review/talk-app`; a dedicated RTS T.A.L.K GCP project should be handled as a follow-up migration.

## Dependency Hardening

- Kept the existing `teeny-request` override for the Google/Firebase dependency chain.
- Added overrides for current 2026 advisories:
  - `qs@6.15.2`
  - `uuid@11.1.1`
  - `ws@8.21.0`
- Avoided `npm audit fix --force` because npm recommends a breaking Google Cloud package downgrade for part of the transitive advisory set.

## Verification Checklist

- [x] `npm ci`
- [x] `npm run typecheck`
- [x] `npm run test:run`
- [x] `npm run test:smoke`
- [x] `npm run build`
- [x] `npm audit --audit-level=low`
- [x] Local production smoke: `/` loads the T.A.L.K title
- [x] Local production smoke: `/api/health` returns OK
- [x] Local production smoke: create lobby, join second player, assign conversationalist roles
- [ ] Post-deploy live smoke: `/` returns 200
- [ ] Post-deploy live smoke: `/api/health` confirms Firestore, Gemini, and Firebase configuration

## Follow-Up: Dedicated GCP Project

T.A.L.K currently runs under `leadflow-review` alongside other applications. Create a dedicated RTS T.A.L.K project in a separate migration so IAM, billing, secrets, Firestore, Artifact Registry, and Cloud Run ownership can be isolated without disrupting the current client URL.
