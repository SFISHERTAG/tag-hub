import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CoursePlayer } from './course-player';
import { CoursesService } from '../services/courses.service';
import { ok } from '../../../core/models/api-result.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  Course,
  CourseWithProgress,
  ProgressSaved,
  ProgressToggle,
} from '../services/course.model';

/**
 * Story: this screen carries one defect forward from the Next app, and the
 * whole file is about it.
 *
 * The old rollback DELETED the progress key when a save failed. That is not an
 * undo — "no record" renders as unchecked. So a failed save while *unchecking*
 * a box someone had genuinely completed erased that completion from the screen.
 * Their work was still recorded on the server and they had no way to know it,
 * which makes redoing it the rational response.
 *
 * The tests below therefore care about one thing above all: after a failed
 * toggle, the checkbox is exactly what it was before the click. Not "false",
 * not "absent" — what it was.
 *
 * The second theme is reconciliation. The endpoint reads the stored value back
 * after writing and returns it, so the screen must believe that rather than its
 * own optimistic guess.
 */

const COURSE: Course = {
  id: 'course-1',
  title: 'Onboarding',
  description: 'Start here',
  sections: [
    {
      id: 'sec1',
      title: 'Week one',
      subsections: [
        {
          id: 'sub1',
          title: 'Set up your tools',
          content: 'First paragraph\n\nSecond paragraph',
          checkboxes: [
            { id: 'cb1', label: 'Install the app' },
            { id: 'cb2', label: 'Sign in' },
          ],
        },
      ],
    },
  ],
};

const KEY_ONE = 'sec1/sub1/cb1';
const KEY_TWO = 'sec1/sub1/cb2';

const get = vi.fn<(courseId: string) => Promise<ApiResult<CourseWithProgress>>>();
const setProgress = vi.fn<(toggle: ProgressToggle) => Promise<ApiResult<ProgressSaved>>>();

/** A macrotask turn: flushes every microtask the component's load() queued. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(progress: CourseWithProgress['progress'] = {}) {
  get.mockReset();
  setProgress.mockReset();
  get.mockResolvedValue(ok({ course: COURSE, progress }));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CoursePlayer],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: CoursesService, useValue: { get, setProgress } },
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

/** Element access, which TypeScript permits for protected members, keeps these typed. */
function checked(component: CoursePlayer, checkboxId: string): boolean {
  return component['isChecked']('sec1', 'sub1', checkboxId);
}

function toggle(component: CoursePlayer, checkboxId: string, completed: boolean): Promise<void> {
  const section = COURSE.sections[0];
  const subsection = section.subsections[0];
  const checkbox = subsection.checkboxes.find((entry) => entry.id === checkboxId);
  if (!checkbox) throw new Error(`No checkbox ${checkboxId} in the fixture.`);
  return component['toggle'](section, subsection, checkbox, completed);
}

describe('CoursePlayer', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the progress the server recorded', async () => {
    const { component } = await setup({ [KEY_ONE]: { completed: true, completedAt: 1000 } });

    expect(checked(component, 'cb1')).toBe(true);
    expect(checked(component, 'cb2')).toBe(false);
    expect(component['stats']()).toEqual({ total: 2, completed: 1, percent: 50 });
  });

  it('RESTORES a completed box when unchecking it fails, rather than erasing it', async () => {
    // The defect, stated as a test. A completion the user genuinely earned must
    // survive a failed save — deleting the entry would render it as unchecked
    // and send them off to redo finished work.
    const { component } = await setup({ [KEY_ONE]: { completed: true, completedAt: 1000 } });

    setProgress.mockResolvedValue({
      data: null,
      error: { message: 'Network unreachable.', context: 'POST /api/courses/progress' },
    });

    await toggle(component, 'cb1', false);

    expect(checked(component, 'cb1')).toBe(true);
    expect(component['stats']().completed).toBe(1);
    expect(component['saveError']()).toContain('has been undone');
  });

  it('leaves a never-recorded box unchecked when checking it fails', async () => {
    const { component } = await setup();

    setProgress.mockResolvedValue({
      data: null,
      error: { message: 'Network unreachable.', context: 'POST /api/courses/progress' },
    });

    await toggle(component, 'cb1', true);

    expect(checked(component, 'cb1')).toBe(false);
    expect(component['stats']().completed).toBe(0);
  });

  it('sends the caller nothing that identifies them — progress is the session’s own', async () => {
    const { component } = await setup();

    setProgress.mockResolvedValue(
      ok({ ok: true, key: KEY_ONE, completed: true, completedAt: 2000 }),
    );

    await toggle(component, 'cb1', true);

    expect(setProgress).toHaveBeenCalledWith({
      courseId: 'course-1',
      sectionId: 'sec1',
      subsectionId: 'sub1',
      checkboxId: 'cb1',
      completed: true,
    });
    expect(Object.keys(setProgress.mock.calls[0][0])).not.toContain('uid');
  });

  it('believes the stored value the server returns, not its own optimistic guess', async () => {
    const { component } = await setup();

    // The request said "complete it"; the store says otherwise. The screen has
    // to follow the store, or it shows a tick over work that is not recorded.
    setProgress.mockResolvedValue(
      ok({ ok: true, key: KEY_ONE, completed: false, completedAt: null }),
    );

    await toggle(component, 'cb1', true);

    expect(checked(component, 'cb1')).toBe(false);
    expect(component['saveError']()).toBeNull();
  });

  it('clears one failure before attempting the next toggle', async () => {
    const { component } = await setup();

    setProgress.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network unreachable.', context: 'POST /api/courses/progress' },
    });
    await toggle(component, 'cb1', true);
    expect(component['saveError']()).not.toBeNull();

    setProgress.mockResolvedValueOnce(
      ok({ ok: true, key: KEY_TWO, completed: true, completedAt: 3000 }),
    );
    await toggle(component, 'cb2', true);

    expect(component['saveError']()).toBeNull();
    expect(checked(component, 'cb2')).toBe(true);
  });

  it('shows a failed load as a failure, never as a course with nothing completed', async () => {
    get.mockResolvedValue({
      data: null,
      error: { message: 'Course unavailable.', context: 'GET /api/courses/course-1' },
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CoursePlayer],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: CoursesService, useValue: { get, setProgress } },
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

    const component = fixture.componentInstance;
    expect(component['error']()).toBe('Course unavailable.');
    expect(component['sections']()).toEqual([]);
    expect(component['stats']()).toEqual({ total: 0, completed: 0, percent: 0 });
  });

  it('labels a fully ticked lesson complete, and a partial one by count', async () => {
    const { component } = await setup({
      [KEY_ONE]: { completed: true, completedAt: 1 },
    });
    const section = COURSE.sections[0];
    const subsection = section.subsections[0];

    expect(component['subsectionLabel'](section, subsection)).toBe('1/2');

    setProgress.mockResolvedValue(ok({ ok: true, key: KEY_TWO, completed: true, completedAt: 2 }));
    await toggle(component, 'cb2', true);

    expect(component['subsectionLabel'](section, subsection)).toBe('Complete');
  });

  it('splits body copy on blank lines and drops the empties', async () => {
    const { component } = await setup();

    expect(component['paragraphs'](COURSE.sections[0].subsections[0])).toEqual([
      'First paragraph',
      'Second paragraph',
    ]);
  });
});
