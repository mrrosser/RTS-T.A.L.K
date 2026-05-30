# ExecPlan: Client Readiness Audit And Hardening

## Goal

Complete the May 12, 2026 readiness pass for T.A.L.K by validating the client-requested revisions, closing small gaps found during audit, hardening dependencies without forced breaking changes, and preparing a client update email.

## DoD

- [x] Client notes from `C:\Users\marcu\Downloads\T.A.L.K app Notes\T.A.L.K app Notes\T.A.L.K app Notes.md` are mapped to current implementation status.
- [x] Referee quick-note shortcuts are restored in the active `ControlsPanelV2` surface.
- [x] Remaining internal package branding uses "Tactically Analyzing Language for Knowledge."
- [x] `ControlsPanelV2` is safe when local player state arrives after initial render.
- [x] `LiveCallPanel` does not reconnect or clear presence on unrelated parent rerenders.
- [x] Strict auth rejects unverified non-guest identity headers while preserving guest mode.
- [x] Non-forced dependency audit fixes are applied.
- [x] Remaining low-severity dependency findings are resolved without downgrading Google Cloud libraries.
- [x] `npm run typecheck` passes.
- [x] `npm run test:run` passes.
- [x] `npm run test:smoke` passes.
- [x] `npm run build` passes.
- [x] `npm audit --audit-level=moderate` passes.
- [x] `npm audit --audit-level=low` passes.
- [x] `npm ls` validates the hardened Google/Firebase dependency chain.

## Client Notes Traceability

| Request | Status |
| --- | --- |
| Erase or change selected player role | Implemented: lobby role selector includes clear-role flow. |
| Conversationalist voice response, transcript preview, chop/repeat, standardized playback | Implemented: mic capture, live transcript preview where browser speech recognition is available, chop/redo lock, referee review, and browser speech-synthesis playback. |
| Reply count/tally for score efficiency | Implemented: reply count affects score and winner computation. |
| Three yellow lifelines per conversationalist per round | Implemented: Audience Opinion, Trusted Sourcing, and Ref's Choice. |
| Trusted source setup and display | Implemented: at least three trusted sources per conversationalist, visible in participant surfaces, selected source displayed when used. |
| Automated trusted-source lookup | Deferred: selected source display exists; external source retrieval/search is not implemented as a separate browsing workflow. |
| Time Keeper detailed timeline, summaries, and highlights | Implemented: timeline sections, duration summaries, and event highlight-to-main-screen flow. |
| Referee notes such as veering/derogatory/misleading | Fixed in this pass: quick-note shortcuts restored in `ControlsPanelV2`. |
| Conversationalist private questions/statements | Implemented: prompt cards/question bank with fixed card count after first save and reveal-on-use privacy. |
| Exact turn-start opponent prompt preview rule | Deferred: current behavior is reveal-on-use plus referee visibility, not a full opponent-preview window at turn start. |
| Conversationalist tab fitting box | Implemented: role selection buttons wrap and fit smaller layouts. |
| Rename "Altering" to "Analyzing" | Fixed: user-facing and package metadata now use "Analyzing." |
| Referee direct-message recipient selection and public accountability chat | Implemented: messages can be addressed to a player while remaining visible. |
| Indicator dot semantics | Implemented: green mic state, refillable yellow lifelines per round, permanent red remaining, and purple audience-review tokens. |
| Audience review of referee action | Implemented: reversible referee actions can be challenged and voted on by viewers. |
| Referee realtime mic mute | Implemented: referee mute/restores conversationalist mic and prevents self-unmute while muted. |
| FaceTime-style video visible only to Referee and Time Keeper | Provider-gated implemented: LiveKit call surface supports camera feeds; remote conversationalist video is restricted to moderator roles. |
| Closing quote at game end | Implemented: closing quote displays with winner summary. |
| Conversationalist photo/backdrop | Implemented: backdrop upload flow with local fallback and GCS signed-upload support when configured. |
| End turn/end TALK buttons with reasons | Implemented: turn and game end actions accept selectable reason codes. |
| AI-generated icebreaker questions | Provider-gated implemented: Gemini generates when configured, static fallback otherwise. |

## Hardening Notes

- `npm audit fix` was run without `--force`.
- Critical/high/moderate advisories were remediated by patch/minor dependency updates.
- The original critical/high/moderate advisories were remediated by patch/minor dependency updates.
- The remaining low-severity Google/Firebase transitive chain was resolved with a narrow npm override that keeps Google Cloud packages on current major versions while forcing `teeny-request` to use `http-proxy-agent@7.0.2`.

## Client Email Draft

Subject: T.A.L.K app updates ready for continued testing

Hi [Client Name],

We completed the latest T.A.L.K revision pass and the most recent requested changes are ready for continued testing.

This update includes the corrected "Tactically Analyzing Language for Knowledge" branding, role clearing, conversationalist mic/transcript/chop workflow, referee targeted chat, referee quick notes and realtime mic controls, Time Keeper timeline highlights, lifelines and trusted sources, prompt cards, audience review of referee actions, reply-count scoring, the closing quote, and the LiveKit/backdrop/provider-enabled features for configured environments.

Please continue testing the updated build and send over any feedback or issues you find. We are now pending your feedback from continued testing.

Thank you,
[Your Name]

## Verification Results

- 2026-05-12: `npm run typecheck` passed.
- 2026-05-12: `npm run test:run` passed: 9 files, 22 tests.
- 2026-05-12: `npm run test:smoke` passed.
- 2026-05-12: `npm run build` passed with Vite 6.4.2.
- 2026-05-12: `npm audit --audit-level=moderate` passed.
- 2026-05-12: `npm audit --audit-level=low` passed with 0 vulnerabilities after the narrow proxy-agent override.
- 2026-05-12: `npm ls @tootallnate/once http-proxy-agent teeny-request retry-request @google-cloud/storage firebase-admin @google-cloud/firestore google-gax` passed.
- 2026-05-30: sync pass added targeted overrides for `qs`, `uuid`, and `ws` after new 2026 advisories appeared.
- 2026-05-30: `npm ci`, `npm run typecheck`, `npm run test:run`, `npm run test:smoke`, `npm run build`, and `npm audit --audit-level=low` passed.
- 2026-05-30: local production smoke passed for app load, `/api/health`, lobby create/join, and role assignment.
