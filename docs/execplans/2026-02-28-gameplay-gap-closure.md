# ExecPlan: Gameplay Gap Closure (Requested Missing Features)

## Goal

Implement all missing first-request gameplay features:

1. Full scoring + winner logic (including fewer replies preference).
2. Full indicator/lifeline rule system (red/yellow/green + per-round lifelines).
3. Conversationalist private question bank with reveal-on-ask.
4. Trusted-source lists per conversationalist and shared display.
5. Referee moderation-note broadcast shortcuts.
6. Detailed Time Keeper timeline tools (section length + highlight/select).
7. Audio capture to standardized playback voice pipeline with referee approval.

## Scope

- Backend domain/state model updates for gameplay rules and outcomes.
- API routes and validation for new gameplay actions.
- Frontend controls and panels for each role.
- Private-question visibility sanitization by requestor.
- Tests (integration + smoke-impact checks) and verification gates.

## Steps

1. Add failing tests for privacy, lifeline limits, and scoring/winner behavior.
2. Implement backend domain logic and API endpoints.
3. Implement frontend API client changes and requestor propagation.
4. Implement UI for role-specific feature surfaces.
5. Verify, document run/deploy changes, and close remaining gaps.

## Status

- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed

## Verification Gates

- `npm run test:run`
- `npm run typecheck`
- `npm run build`
