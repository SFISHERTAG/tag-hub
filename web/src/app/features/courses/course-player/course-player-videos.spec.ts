import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CoursePlayer } from './course-player';
import { CoursesService } from '../services/courses.service';
import { ok } from '../../../core/models/api-result.model';
import { videoEmbedUrl, videoTitle } from '../services/video-embed';
import type { Course, CourseSubsection } from '../services/course.model';

/**
 * Story 12.3: a lesson can carry many videos.
 *
 * Two failure modes are worth holding still. The first is the one that made
 * this story necessary: "Call Recording Links" has 35 recordings, and a page
 * that mounts 35 iframes on open is unusable on the phone most CSMs read this
 * on. So the test asserts that nothing is open until asked.
 *
 * The second is quieter and would be worse. Every course seeded before this
 * story stores its video in `loomId` with no rows in the new table. If the
 * fallback stops working, every existing lesson loses its video and the page
 * still renders perfectly well, just empty where the training used to be.
 */

function subsection(overrides: Partial<CourseSubsection>): CourseSubsection {
  return {
    id: 'sub1',
    title: 'Lesson',
    content: '',
    videos: [],
    docs: [],
    checkboxes: [],
    ...overrides,
  };
}

function courseWith(sub: CourseSubsection): Course {
  return {
    id: 'course-1',
    title: 'CSM Training',
    description: '',
    sections: [{ id: 'sec1', title: 'Section', subsections: [sub] }],
  };
}

const get = vi.fn<(courseId: string) => Promise<ApiResultLike>>();
type ApiResultLike = Awaited<ReturnType<CoursesService['get']>>;

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(sub: CourseSubsection) {
  get.mockReset();
  get.mockResolvedValue(
    ok({ course: courseWith(sub), progress: {} }) as unknown as ApiResultLike,
  );

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CoursePlayer],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: CoursesService, useValue: { get, setProgress: vi.fn() } },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ courseId: 'course-1' })),
          snapshot: { paramMap: convertToParamMap({ courseId: 'course-1' }) },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(CoursePlayer);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

describe('CoursePlayer videos', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the legacy loomId when a lesson has no video rows', async () => {
    const sub = subsection({ loomId: 'fdba6345' });
    const { component } = await setup(sub);

    const videos = component['videosFor'](sub);

    expect(videos).toEqual([{ id: 'loom:fdba6345', provider: 'loom', externalId: 'fdba6345' }]);
    expect(component['videoUrl'](videos[0])).toBeTruthy();
  });

  it('prefers video rows over the legacy column when a lesson has both', async () => {
    const sub = subsection({
      loomId: 'stale-loom',
      videos: [{ id: 'v1', provider: 'fathom', externalId: 'abc' }],
    });
    const { component } = await setup(sub);

    expect(component['videosFor'](sub).map((video) => video.externalId)).toEqual(['abc']);
  });

  it('opens a single video without a click, because there is nothing to defer', async () => {
    const video = { id: 'v1', provider: 'loom', externalId: 'abc' } as const;
    const sub = subsection({ videos: [video] });
    const { component } = await setup(sub);

    expect(component['isVideoOpen'](video, 1)).toBe(true);
  });

  it('keeps every one of 35 recordings closed until it is asked for', async () => {
    const videos = Array.from({ length: 35 }, (_unused, index) => ({
      id: `v${index}`,
      provider: 'drive' as const,
      externalId: `id${index}`,
    }));
    const sub = subsection({ videos });
    const { component } = await setup(sub);

    expect(videos.filter((video) => component['isVideoOpen'](video, videos.length))).toEqual([]);

    component['openVideo'](videos[7]);

    expect(component['isVideoOpen'](videos[7], videos.length)).toBe(true);
    expect(component['isVideoOpen'](videos[8], videos.length)).toBe(false);
  });

  it('links out rather than framing a Fathom recording, and never claims it is open', async () => {
    // Fathom's embed URL answers 200 and allows framing but paints nothing —
    // checked live on 2026-08-21. A blank player on 31 imported recordings
    // would read as a broken Hub; a link reads as a link.
    const video = { id: 'v1', provider: 'fathom', externalId: 'abc-123' } as const;
    const sub = subsection({ videos: [video] });
    const { component } = await setup(sub);

    expect(component['canPlayInline'](video)).toBe(false);
    expect(component['isVideoOpen'](video, 1)).toBe(false);
    expect(component['videoShareLink'](video)).toBe('https://fathom.video/share/abc-123');

    // Even after an explicit open, it must not be framed.
    component['openVideo'](video);
    expect(component['isVideoOpen'](video, 1)).toBe(false);
  });

  it('titles an unlabelled recording by provider and position', () => {
    const video = { id: 'v1', provider: 'fathom', externalId: 'abc' } as const;

    expect(videoTitle(video, 0, 1)).toBe('Call recording');
    expect(videoTitle(video, 3, 35)).toBe('Call recording 4');
    expect(videoTitle({ ...video, label: 'Strategy Session' }, 3, 35)).toBe('Strategy Session');
  });

  it('builds each provider its own embed form', () => {
    expect(videoEmbedUrl('loom', 'abc')).toBe('https://www.loom.com/embed/abc');
    expect(videoEmbedUrl('fathom', 'abc')).toBe('https://fathom.video/embed/abc');
    expect(videoEmbedUrl('drive', 'abc')).toBe('https://drive.google.com/file/d/abc/preview');
  });
});
