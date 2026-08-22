import type { VideoProvider } from "./types";

/**
 * Share URL in, provider plus provider-native id out.
 *
 * One place, because the same mapping is needed by the admin endpoint (which
 * accepts whatever an admin pasted), by the 12.4 import (which reads share
 * URLs straight off Skool), and by the player (which builds the embed src).
 * Three hand-rolled regexes would drift, and the failure mode is an iframe
 * pointed at something that is not the video.
 *
 * The ids are captured with restrictive character classes on purpose. A value
 * that reaches an embed URL is effectively part of an origin, so anything with
 * a slash, a dot or a colon in it is rejected here rather than encoded later
 * and hoped about.
 */
const PATTERNS: ReadonlyArray<{ provider: VideoProvider; pattern: RegExp }> = [
  { provider: "loom", pattern: /^https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/([A-Za-z0-9]+)/ },
  { provider: "fathom", pattern: /^https?:\/\/fathom\.video\/(?:share|embed)\/([A-Za-z0-9_-]+)/ },
  {
    provider: "drive",
    pattern: /^https?:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/,
  },
];

const BARE_ID = /^[A-Za-z0-9_-]+$/;

export type ParsedVideoLink = { provider: VideoProvider; externalId: string };

/**
 * Parses a pasted share URL, or accepts an already-bare id for a stated
 * provider. Returns null rather than guessing — an unrecognised link is a
 * mistake worth surfacing, not something to store and render blank.
 */
export function parseVideoLink(input: string, provider?: VideoProvider): ParsedVideoLink | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  for (const candidate of PATTERNS) {
    const match = candidate.pattern.exec(trimmed);
    if (match) return { provider: candidate.provider, externalId: match[1] };
  }

  // No URL shape. Accept it as an id only when the caller has said which
  // provider it belongs to, since an id alone does not identify one.
  if (provider && BARE_ID.test(trimmed)) return { provider, externalId: trimmed };

  return null;
}

const EMBED_BASE: Readonly<Record<VideoProvider, (id: string) => string>> = {
  loom: (id) => `https://www.loom.com/embed/${id}`,
  fathom: (id) => `https://fathom.video/embed/${id}`,
  drive: (id) => `https://drive.google.com/file/d/${id}/preview`,
};

/** The embed URL for a stored video. Ids are encoded even though they are validated. */
export function embedUrl(provider: VideoProvider, externalId: string): string {
  return EMBED_BASE[provider](encodeURIComponent(externalId));
}

export function isVideoProvider(value: unknown): value is VideoProvider {
  return value === "loom" || value === "fathom" || value === "drive";
}
