# ExecPlan: Client Feedback Closure Polish

## Goal

Close the remaining gaps from the March 13, 2026 client PDF review and exceed the ask on the highest-impact UX and moderation controls.

## DoD

- [x] User-facing branding is updated from "Altering" to "Analyzing" in the app shell and metadata.
- [x] Referees can mute or unmute a conversationalist in realtime from the controls surface.
- [x] Referee mute actions are recorded as reversible referee actions and can be overturned by audience review.
- [x] A referee-muted conversationalist cannot immediately re-enable their mic from the live call controls.
- [x] Conversationalist camera feeds are only visibly rendered to the Referee and Time Keeper; conversationalists keep local preview/status without seeing opponent video.
- [x] Participant indicators better match the requested filled/unfilled token semantics.
- [x] Lobby role selection remains clear on smaller layouts and explicitly supports clearing a role.
- [x] Tests cover the new moderation/media behavior without requiring live providers.
- [x] `npm run typecheck` passes.
- [x] `npm run test:run` passes.
- [x] `npm run test:smoke` passes.
- [x] `npm run build` passes.

## In Scope

- Branding and small UX polish directly mentioned in the PDF.
- Backend mute action state, API surface, and audience reversal handling.
- Frontend mute enforcement and moderator-only face visibility in the LiveKit panel.
- Indicator display refinement and lobby role-selection polish.
- Targeted tests and doc updates needed to support the above.

## Out of Scope

- Full transcript "chop and repeat" workflow redesign beyond the current editable live transcript surface.
- Additional AI generation systems beyond the existing icebreaker flow.
- Viewer participation in live calls.
- Larger visual redesigns not tied to explicit feedback items.

## Work Plan

1. Add the plan and map the PDF gaps to concrete code changes.
2. Implement backend referee mute actions and audience-reversal behavior.
3. Update frontend live call and control flows for mute enforcement and moderator-only video visibility.
4. Apply branding, indicator, and lobby-selection polish from the client notes.
5. Add tests, verify, and summarize completed versus deferred PDF asks.

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
