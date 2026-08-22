import type { CourseVideo, VideoProvider } from './course.model';

/**
 * Provider to embed URL, in one place.
 *
 * The backend stores a provider and a provider-native id and never a URL, so
 * this is the only file in the viewer that decides what a lesson's iframe
 * points at. Keeping it out of the component means the mapping can be tested
 * without rendering anything, which matters because two of the three forms
 * (Fathom, Drive) were documented conventions rather than in-production
 * behaviour when they were added.
 *
 * A copy of this mapping also exists in `lib/course/video-links.ts` for the
 * server. That duplication is the feature-isolation rule from CLAUDE.md, the
 * same reason the wire models are mirrored rather than imported.
 */
const EMBED: Readonly<Record<VideoProvider, (id: string) => string>> = {
  loom: (id) => `https://www.loom.com/embed/${id}`,
  fathom: (id) => `https://fathom.video/embed/${id}`,
  drive: (id) => `https://drive.google.com/file/d/${id}/preview`,
};

const SHARE: Readonly<Record<VideoProvider, (id: string) => string>> = {
  loom: (id) => `https://www.loom.com/share/${id}`,
  fathom: (id) => `https://fathom.video/share/${id}`,
  drive: (id) => `https://drive.google.com/file/d/${id}/view`,
};

/**
 * Whether a provider's video can be played inside the page.
 *
 * Loom and Drive were both confirmed rendering inside a real iframe on
 * 2026-08-21. Fathom was not: `https://fathom.video/embed/{shareId}` answers
 * 200 and deliberately omits `frame-ancestors`, so it is meant to be framed,
 * but it paints nothing — framed or top-level — for the share ids this
 * training actually uses. Its `/share/` page sets `frame-ancestors 'none'`,
 * so that is not a substitute.
 *
 * Rather than ship an embed URL that renders an empty box, Fathom recordings
 * link out. 31 of the videos in the legacy import are Fathom, and a blank
 * player on 31 lessons reads as a broken Hub, where a link that opens the
 * recording reads as a link. Flip this to true once someone confirms the real
 * Fathom embed form.
 */
const EMBEDDABLE: Readonly<Record<VideoProvider, boolean>> = {
  loom: true,
  drive: true,
  fathom: false,
};

export function canEmbed(provider: VideoProvider): boolean {
  return EMBEDDABLE[provider];
}

/** Where a non-embeddable video opens instead. */
export function videoShareUrl(provider: VideoProvider, externalId: string): string {
  return SHARE[provider](encodeURIComponent(externalId));
}

/**
 * Ids are encoded before interpolation. They are validated server-side, but a
 * value that lands in an iframe src is effectively part of an origin, and the
 * cost of encoding a known-good id is nothing.
 */
export function videoEmbedUrl(provider: VideoProvider, externalId: string): string {
  return EMBED[provider](encodeURIComponent(externalId));
}

const PROVIDER_LABEL: Readonly<Record<VideoProvider, string>> = {
  loom: 'Loom recording',
  fathom: 'Call recording',
  drive: 'Recording',
};

/** What the collapsed row says before anyone clicks it. */
export function videoTitle(video: CourseVideo, index: number, total: number): string {
  if (video.label) return video.label;
  if (total === 1) return PROVIDER_LABEL[video.provider];
  return `${PROVIDER_LABEL[video.provider]} ${index + 1}`;
}
