Build an in-app course/LMS feature in the TAG Hub — "like Skool without the community": structured sections with embedded Loom videos, per-user completion tracking in Firestore, served to two different audiences (clients, and TAG's own team/CSMs).

# Context you need

This is the TAG Hub codebase (`hub/`) — Next.js 16, Firestore, Firebase Auth, deployed on Cloud Run. Read `hub/AGENTS.md`, `hub/docs/architecture.md` first. The data boundary convention already established: Firestore holds only what GHL has no concept of, keyed under `locations/{locationId}` for per-client data. This feature needs a *new* kind of Firestore data — per-*user* progress, not per-location — so it doesn't fit that existing shape directly; design accordingly rather than forcing it into `locations/{id}`.

# The actual source content — already written, do not invent placeholder content

`/Users/home/projects/TAG/TAG_Client_Onboarding_Canvas.md` (repo root, one level above `hub/`, NOT inside the Next.js project) is the real course content, 67KB, already written by the user. Structure, confirmed by reading it:

- 5 top-level (`#`) sections: Welcome, Onboarding & Expectations, Sales: Mindset, Sales 101, Objection Handling
- ~21 subsections (`###`) inside those, each following the same pattern:
  ```
  ### <Subsection title>
  - [ ] Watched
  [Watch](https://www.loom.com/share/<id>)

  <substantial written content — essay-style training material>
  ```
- The checkbox (`- [ ] Watched`) is the user's own sketch of the completion-tracking UX — one checkbox per subsection, per user.

`/Users/home/projects/TAG/CCE_Member_Onboarding_Canvas.md` (same directory) is a short structural template/reference — Welcome, "Watch First" video list, Action Items checklist, Team contact table, "What Happens Next." This is the pattern TAG's own canvas was modeled on; useful for understanding intent, not itself content to ship.

**Content audience split — confirmed by content inspection, not yet confirmed with the user:** "Onboarding & Expectations" reads as client-only (intake form, CRM access, domain purchase, Meta ad account setup, calendar setup, finding actors, recording instructions, payment processor, sending agreements — all operational onboarding steps specific to a new client). "Sales: Mindset," "Sales 101," and "Objection Handling" read as general sales training that could serve TAG's own team/CSMs equally. **Confirm this split with the user before building** — don't assume which sections map to which audience; ask directly, e.g. "does the whole document apply to both audiences, or only the sales sections for internal staff?"

# Requirements, as stated across the conversation that spawned this task

1. **Structured sections**, not a flat page — matches the document's own `#`/`###` hierarchy above.
2. **Embedded Loom videos** — Loom supports standard iframe embeds, `https://www.loom.com/embed/<id>` (the source doc has share links, `https://www.loom.com/share/<id>` — confirm whether the embed URL needs the id extracted and reformatted, or whether Loom's share URLs also embed directly; verify against Loom's current embed documentation rather than assuming).
3. **Firestore-backed per-user completion tracking** — which sections a given user has marked watched/complete. Needs a schema: something like `userProgress/{uid}/courseSections/{sectionId}: { completed: boolean, completedAt: timestamp }`, or a single document per user with a map of section IDs to completion state — design this, it doesn't exist yet.
4. **Two audiences, same underlying content (mostly)** — clients (onboarding + sales training) and TAG's own team/CSMs (sales training). Likely means: the same section-rendering UI, but which sections are visible/assigned depends on who's viewing — filtered by role/hat, following the existing pattern in `hub/lib/auth/roles.ts` and how `hub/app/nav.tsx`'s `ITEMS` array filters by hat.
5. **"Skool without the community"** — structured course, progress tracking, no discussion/comments/community feed. Explicitly out of scope.

# What already exists in the Hub to reuse, not rebuild

- `hub/lib/auth/session.ts` — `requireSession()`, role/hat resolution. Follow the same gating pattern as `hub/app/dashboard/page.tsx` or `hub/app/portfolio/page.tsx` for who can see what.
- `hub/app/ui.tsx` — `Panel`, `Fold` (native `<details>`-based collapsible section — likely exactly right for each course subsection, already built, already accessible, already Cmd-F-searchable unlike a JS-state accordion), `Stat`, `Badge`. Use these rather than inventing new primitives.
- `hub/app/dashboard/dark-scope.tsx` — if this course should render in the same dark chrome aesthetic as the dashboard, this is the pattern for pinning the palette regardless of the light/dark toggle. Read its own comments for why it works the way it does before reusing it verbatim.
- `hub/app/icons.tsx` — hand-rolled SVG icon set, 24px/2-stroke lucide-matched geometry (see the file's own header comment). Add new icons here if needed, matching the existing style, not a new icon library.
- No existing rich-text/markdown renderer in the codebase — check `package.json` before adding one. The source content is markdown; something needs to turn it into rendered HTML with the checkboxes wired to real interactive state (not static checkbox glyphs) and the Loom links turned into real embeds instead of link text. This likely means: parse the markdown once (a build step or a one-time import script), not re-parsing raw markdown client-side on every render.

# Open decisions for that thread to resolve with the user before building

- The client/staff content-split question above.
- Where this lives in the nav — a new top-level nav item? Under an existing one?
- Whether the 21 sections import as static content (parsed once from the `.md` file into a TypeScript/JSON structure checked into the repo) or need to be editable later without a code deploy (a Firestore-stored, admin-editable version) — the user said "we'll build from the source I gave you," which reads as "import this specific content," not "build a CMS," but confirm rather than assume scope.
- Whether "per-user" progress means per Firebase Auth uid (works for TAG staff, who all have accounts) or needs to handle clients who might not yet have Hub accounts at the time they start the course.
