# TAG Hub docs

Read in this order:

1. `prd.md`: problem, goals, users, requirements, baselines, and the epic
   list. Supersedes the earlier `../../PRD.md` (kept one level up, outside
   this repo, for history only).
2. `architecture.md`: what's built, what's decided but not built, and the
   sequencing rationale.
3. `epics.md`: every epic and story with a current status. Epics 1 and 2
   are sharded into `stories/`; Epics 3 through 6 stay summarized here
   until they're picked up.
4. `stories/`: one file per story, named `{epic}.{story}-{slug}.md`.
   Status values: Done, Ready, Draft, Blocked.

Keep this set in sync as the source of truth. When a story ships, flip its
status in both the story file and the table in `epics.md`. When a decision
in `architecture.md` changes, update it there rather than letting a story
file quietly disagree with it.
