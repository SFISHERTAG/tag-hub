<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project docs

Start at `docs/prd.md`, then `docs/architecture.md`, then `docs/epics.md`.
Story files live in `docs/stories/` as `{epic}.{story}-{slug}.md`. Epics 1
and 2 are sharded into individual story files; Epics 3 through 6 are
summarized in `docs/epics.md` only, until they're picked up. That's
deliberate: sharding them early would freeze decisions that earlier epics
still need to inform.

GoHighLevel is the system of record for contacts, opportunities,
appointments, and notes. Firestore holds only what GHL has no concept of:
OAuth tokens and appointment outcome timing. Read `architecture.md`'s data
boundary section before adding any new persistence.
