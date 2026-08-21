// Pure, side-effect-free — no top-level execSync/exit, so this can be
// imported directly by a test without touching git or the real filesystem.
// check-story-status.mjs imports this rather than inlining the regex, since
// this exact logic has been the source of three separate false positives
// in one session (a bare filename shared across modules, a cross-reference
// to a different story, a mid-prose "verification not run" aside).

/**
 * Files a story doc actually owns, e.g. `lib/foo/bar.ts` — matched only at
 * the start of a markdown list item (`- \`path\`` or `- [\`path\`](...)`),
 * the format every story doc in this repo already uses to declare its own
 * files. A backtick path embedded mid-sentence in free-form prose (a "Dev
 * notes" aside explaining what *wasn't* run, a cross-reference to another
 * story, a bare filename used as shorthand) isn't an ownership claim.
 * Requires a path separator too, since a bare `db.ts` is too ambiguous to
 * attribute to one file and would false-positive via endsWith()-style
 * matching against every other module with the same filename.
 */
export function extractReferencedFiles(text) {
  return [...text.matchAll(/^-\s+\[?`([\w./-]+\.(?:ts|tsx))`/gm)]
    .map((m) => m[1])
    .filter((ref) => ref.includes("/"));
}
