// Stub for the "server-only" package under vitest.
//
// The real package throws unconditionally when evaluated, relying on
// Next.js's bundler to strip that import out of client bundles rather than
// ever running it. Vitest has no such distinction, so every file importing
// "server-only" would throw immediately on import. Since everything under
// lib/ actually runs in Node under both Next's server runtime and vitest,
// aliasing to this no-op (see vitest.config.ts) is correct, not a workaround
// that hides a real client/server boundary bug.
export {};
