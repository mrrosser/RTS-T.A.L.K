# ExecPlan: Gemini Transcript Assist And Chop Redo

## Goal

Close the final transcript-related client feedback gap by adding a real chop-and-repeat workflow for voice drafts, with Gemini-assisted transcript cleanup as an explicit helper.

## DoD

- [x] Conversationalists can chop a live transcript at the cursor and keep only the approved prefix.
- [x] Chopping a transcript blocks submission until the player re-records from the chop point.
- [x] Re-recording after a chop appends new speech after the kept prefix instead of replacing the entire transcript.
- [x] Gemini-backed transcript assist can suggest a cleaned transcript without silently changing submitted content.
- [x] Users can explicitly accept or dismiss Gemini suggestions.
- [x] Tests cover the backend transcript-assist route and the frontend chop/redo or Gemini-assist workflow.
- [x] `npm run typecheck` passes.
- [x] `npm run test:run` passes.
- [x] `npm run test:smoke` passes.
- [x] `npm run build` passes.

## In Scope

- Backend Gemini transcript-assist route and client helper.
- Conversationalist voice-response UI changes for chop, redo enforcement, and suggestion acceptance.
- Targeted tests and doc updates for the new behavior.

## Out of Scope

- New provider setup beyond the existing Gemini configuration surface.
- Fully automated transcript moderation or referee-side transcript rewriting.
- Rebuilding the broader audio-draft approval flow.

## Work Plan

1. Add the exec plan and map the transcript requirement to concrete UI and API changes.
2. Implement a backend transcript-assist route and a frontend Gemini helper.
3. Add chop-and-redo state handling to the conversationalist voice workflow.
4. Add targeted tests and update docs for the Gemini transcript path.
5. Run verification gates and mark the plan complete.

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
