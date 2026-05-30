# ExecPlan: LiveKit Call Completion

## Goal

Close the remaining live call gap by wiring the existing media token backend into a real frontend LiveKit room for player roles.

## DoD

- [x] Players in the game screen can join a LiveKit room when media is configured.
- [x] Players can toggle microphone and camera from the UI and lobby presence reflects those states.
- [x] Remote participant audio/video renders in the game UI.
- [x] Graceful fallback is shown when LiveKit is not configured or room connect fails.
- [x] Tests cover the new frontend media flow without requiring a live provider.
- [x] `npm run typecheck` passes.
- [x] `npm run test:run` passes.
- [x] `npm run test:smoke` passes.
- [x] `npm run build` passes.

## In Scope

- Backend token grant adjustment for player-room participation.
- Frontend token fetch and LiveKit room lifecycle.
- Real audio/video tile rendering for player roles.
- Presence sync between live media toggles and lobby state.
- Test and doc updates needed for the call path.

## Out of Scope

- Viewer subscription to the LiveKit room.
- Recording, moderation tooling beyond the existing gameplay controls, or server-side media processing.
- Changing the auth model or adding new third-party providers.
- Anything not directly required to replace the current media scaffolding with a working player call surface.

## Work Plan

1. Add the plan and baseline the current room/token constraints.
2. Update token grants and create a frontend LiveKit room integration.
3. Add a live call panel to the game screen with mic/camera toggles and participant tiles.
4. Sync media state back into lobby presence and add graceful disabled/error states.
5. Add tests, update docs, and run verification.

## Status

- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [x] Step 4 completed
- [x] Step 5 completed

## Verification Gates

- `npm run typecheck`
- `npm run test:run`
- `npm run test:smoke`
- `npm run build`

## Verification Results

- 2026-03-13: `npm run typecheck` passed.
- 2026-03-13: `npm run test:run` passed.
- 2026-03-13: `npm run test:smoke` passed.
- 2026-03-13: `npm run build` passed.
