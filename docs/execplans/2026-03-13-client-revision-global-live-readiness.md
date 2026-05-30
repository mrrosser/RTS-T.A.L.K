# ExecPlan: Client Revision + Global Live Readiness

## Goal

Implement the current T.A.L.K client revision set with durable live backend state, auth expansion, account/session memory, gameplay/UI gap closure, media scaffolding, and regression protection.

## Scope

- Persistent lobby/session/profile storage with an environment-driven backend adapter.
- Auth expansion for guest, Google, Apple, and phone sign-in with backend token verification support.
- SSE lobby streaming, profile bootstrap, upload/media token, challenge, and session history APIs.
- Gameplay model updates for prompt cards, indicator semantics, targeted chat, audience challenges, end-turn reasons, and closing quote.
- Frontend login, lobby/game, and viewer surfaces for the revised product behavior.
- Tests, local run docs, and deploy docs for the new provider/config surface.

## Work Plan

1. Add the execution plan and baseline the current repo.
2. Introduce backend service abstractions and persistent repository support.
3. Expand auth/profile/session APIs and frontend auth bootstrap flows.
4. Implement gameplay/domain and UI revisions from the client notes.
5. Add provider-gated media/upload integration surfaces and audience challenge flow.
6. Add regression tests, verify, and update local/deploy documentation.

## Status

- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed
- [x] Step 6 completed

## Verification Gates

- `npm run test:run`
- `npm run test:smoke`
- `npm run typecheck`
- `npm run build`

## Verification Results

- 2026-03-13: `npm run typecheck` passed
- 2026-03-13: `npm run test:run` passed
- 2026-03-13: `npm run test:smoke` passed
- 2026-03-13: `npm run build` passed
