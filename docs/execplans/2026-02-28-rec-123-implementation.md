# ExecPlan: Recommendation 1/2/3 Full Implementation

## Goal

Implement all remaining recommendations from the 2026-02-28 audit:

1. Move Gemini fact-checking to backend API (no client key exposure).
2. Replace Tailwind CDN runtime with compiled Tailwind build pipeline.
3. Replace localStorage mock sync with backend-synced state APIs for multiplayer consistency.

## Scope

- Add backend runtime for game state and fact-checking endpoints.
- Add input validation and structured logs with correlation IDs.
- Add idempotency support for create operations.
- Refactor frontend service layer to use backend APIs.
- Establish compiled Tailwind setup and remove runtime CDN dependency.
- Update tests, local run docs, and Cloud Run deploy docs.

## Steps

1. Backend service and domain state actions.
2. Frontend API client migration.
3. Tailwind compile pipeline migration.
4. Test updates and coverage for critical flows.
5. Verification and documentation updates.

## Status

- [x] Step 1 planned
- [x] Step 1 implemented
- [x] Step 2 implemented
- [x] Step 3 implemented
- [x] Step 4 implemented
- [x] Step 5 implemented

## Verification Gates

- `npm run typecheck`
- `npm run test:run`
- `npm run build`
