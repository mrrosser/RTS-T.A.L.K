# Agents

## Quick links
- Local playbook: `skills_playbook.md`
- Exec plans: `docs/execplans/`
- Planning docs: `docs/plans/`

## Global sources
- Shared skills: `C:\CTO Projects\CodexSkills`
- RT loop (global skill): `C:\CTO Projects\rt-infinite-loop`

## Skill trigger surface
- If the user names a skill (for example `$skill-name`) or the request clearly matches a local/shared skill, use that skill in this turn.
- Resolve local playbook references first, then shared skills.
- If a named skill is missing, state the block briefly and continue with the closest fallback.

## Rule
- Repo-local `docs/` is the source of truth for this project.
