# Code Audit Report (2026-02-28)

## Critical Findings

1. Build-breaker in `LoginScreen` SVG (`</p>` tag mismatch) prevented production builds.
2. `containsProfanity` used a global regex with `.test()`, causing stateful false negatives on repeated checks.
3. Render-time state updates in `App` (`setAppPhase` inside render path) risked React warnings and unstable behavior.

## High Findings

1. Polling loop was fixed at 2s with no visibility awareness, increasing battery/network use on mobile.
2. Turn pause/resume logic reset timing behavior and lost remaining time state.
3. App relied on blocking `alert()` calls across game/lobby flow, degrading UX on touch devices.

## Medium Findings

1. Deprecated `onKeyPress` handlers in React inputs.
2. Unbounded timeline growth risked long-session rendering degradation.
3. Sparse service observability (unstructured console logs, no correlation IDs).

## Improvements Applied

- Fixed build issue and input handlers.
- Replaced profanity matching with stable regex strategy.
- Refactored app phase transitions to avoid render-time state mutation.
- Added visibility-aware polling intervals for active/background tabs.
- Added turn remaining state model and pause/resume-preserving timer behavior.
- Added structured logging + correlation IDs in API/Gemini flows.
- Added mobile/touch UX tweaks (remove-button visibility on touch, reduced-motion handling).
- Added unit and smoke tests, plus timer behavior test.
- Added Cloud Run Docker deployment path and runbook documentation.

## Verification

- `npm run typecheck` passed.
- `npm run test:run` passed.
- `npm run build` passed.

## Recommendation Status Update

- Recommendation 1 (server-side Gemini fact-checking): Implemented via backend `/api/fact-check` with `GEMINI_API_KEY` server env.
- Recommendation 2 (compiled Tailwind): Implemented via PostCSS + Tailwind build pipeline and removed runtime CDN.
- Recommendation 3 (backend state sync): Implemented via backend lobby APIs replacing browser `localStorage` authority.
