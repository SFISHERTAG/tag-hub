import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FlowFramework } from './flow-framework';
import { FlowService } from '../services/flow.service';
import { RBAC_SERVICE } from '../../../core/services/rbac.service';
import { ok } from '../../../core/models/api-result.model';
import { ROLES, type Role } from '../../../core/models/role.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { Session } from '../../../core/models/session.model';
import type {
  FlowScriptSuggestion,
  FullFramework,
  NewSuggestion,
  SuggestionAction,
} from '../services/flow.model';

/**
 * Story: who may suggest, who may review, and what happens when the org cannot
 * be resolved.
 *
 * The org resolution is a known gap, stated in the component and tested here
 * rather than hidden: the endpoints take the org from the caller, and the
 * legacy page resolved it server-side from an environment variable no browser
 * can read. When nothing resolves, this screen must say so plainly instead of
 * calling an endpoint with an empty id and rendering the 400 as a broken page.
 *
 * The review queue's failure is kept separate from the framework's on purpose:
 * the scripts loaded fine and are still worth reading, but an empty queue would
 * tell a manager there is nothing to review when there may be plenty.
 */

const FRAMEWORK: FullFramework = {
  id: 'fw1',
  version: '1.0',
  tabs: [
    {
      id: 'tab1',
      label: 'Discovery',
      icon: null,
      color: null,
      sections: [
        {
          id: 'sec1',
          label: 'Opening',
          description: 'First ninety seconds',
          cards: [
            {
              id: 'card1',
              key: 'opener',
              label: 'The opener',
              sub_label: null,
              script: {
                id: 'scr1',
                card_id: 'card1',
                content: 'Thanks for taking the call.',
                why: 'Sets the frame.',
                notes: null,
                version_tag: null,
                tags: [],
                created_by: 'a@b.io',
                created_at: '2026-08-01T00:00:00.000Z',
                updated_by: 'a@b.io',
                updated_at: '2026-08-01T00:00:00.000Z',
              },
            },
          ],
        },
      ],
    },
  ],
};

const SUGGESTION: FlowScriptSuggestion = {
  id: 's1',
  org_id: 'loc1',
  card_id: 'card1',
  suggested_content: 'Try a shorter opener.',
  suggested_why: null,
  suggested_notes: null,
  suggestion_note: 'Prospect went quiet.',
  status: 'pending',
  suggested_by: 'closer@tag.io',
  created_at: '2026-08-20T00:00:00.000Z',
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  resulting_script_id: null,
};

const framework = vi.fn<(orgId: string) => Promise<ApiResult<FullFramework>>>();
const pendingSuggestions =
  vi.fn<(orgId: string) => Promise<ApiResult<readonly FlowScriptSuggestion[]>>>();
const suggest = vi.fn<(input: NewSuggestion) => Promise<ApiResult<FlowScriptSuggestion>>>();
const resolve =
  vi.fn<
    (suggestionId: string, action: SuggestionAction) => Promise<ApiResult<FlowScriptSuggestion>>
  >();

function session(role: Role, locations: string[], impersonating: string | null = null): Session {
  return {
    uid: 'uid-1',
    email: 'user@taxadvisorygrowth.net',
    currentRole: role,
    availableRoles: [role],
    locations,
    impersonation: impersonating ? { locationId: impersonating } : null,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(
  current: Session | null,
  frameworkResult: ApiResult<FullFramework> = ok(FRAMEWORK),
) {
  framework.mockReset();
  pendingSuggestions.mockReset();
  suggest.mockReset();
  resolve.mockReset();

  framework.mockResolvedValue(frameworkResult);
  pendingSuggestions.mockResolvedValue(ok([SUGGESTION]));
  suggest.mockResolvedValue(ok(SUGGESTION));
  resolve.mockResolvedValue(ok({ ...SUGGESTION, status: 'approved' }));

  const sessionSignal = signal<Session | null>(current);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [FlowFramework],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: FlowService,
        useValue: { framework, pendingSuggestions, suggest, resolve },
      },
      {
        provide: RBAC_SERVICE,
        useValue: {
          session: sessionSignal.asReadonly(),
          load: () => Promise.resolve(),
          switchRole: () => Promise.resolve(ok(current)),
          applySession: () => undefined,
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(FlowFramework);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

describe('FlowFramework', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers the entered client over the session’s first location', async () => {
    const { component } = await setup(
      session(ROLES.TAG_CSM, ['loc-a', 'loc-b'], 'loc-entered'),
    );

    expect(component['orgId']()).toBe('loc-entered');
    expect(framework).toHaveBeenCalledWith('loc-entered');
  });

  it('falls back to the session’s first location', async () => {
    const { component } = await setup(session(ROLES.CLIENT_CLOSER, ['loc-a']));

    expect(component['orgId']()).toBe('loc-a');
  });

  it('does not call the endpoint at all when no org resolves', async () => {
    const { component } = await setup(session(ROLES.TAG_SALES, []));

    // Calling with an empty id would render a 400 as a broken page. Better to
    // say plainly that no client account is linked.
    expect(framework).not.toHaveBeenCalled();
    expect(component['orgId']()).toBeNull();
    expect(component['error']()).toBeNull();
    expect(component['framework']()).toBeNull();
  });

  it('lets a closer suggest but not review', async () => {
    const { component } = await setup(session(ROLES.CLIENT_CLOSER, ['loc-a']));

    expect(component['canSuggest']()).toBe(true);
    expect(component['canReview']()).toBe(false);
    expect(pendingSuggestions).not.toHaveBeenCalled();
  });

  it('lets a sales manager review but not suggest', async () => {
    const { component } = await setup(session(ROLES.TAG_SALES_MANAGER, ['loc-a']));

    expect(component['canReview']()).toBe(true);
    expect(component['canSuggest']()).toBe(false);
    expect(pendingSuggestions).toHaveBeenCalledWith('loc-a');
    expect(component['suggestions']()).toHaveLength(1);
  });

  it('opens the suggestion form seeded with the script as it stands', async () => {
    const { component } = await setup(session(ROLES.CLIENT_CLOSER, ['loc-a']));
    const card = FRAMEWORK.tabs[0].sections[0].cards[0];

    component['openSuggestion'](card);

    expect(component['suggestingCardId']()).toBe('card1');
    expect(component['suggestForm'].getRawValue().content).toBe('Thanks for taking the call.');
  });

  it('refuses to send an empty suggestion', async () => {
    const { component } = await setup(session(ROLES.CLIENT_CLOSER, ['loc-a']));
    const card = FRAMEWORK.tabs[0].sections[0].cards[0];

    component['openSuggestion'](card);
    component['suggestForm'].patchValue({ content: '   ' });
    await component['submitSuggestion']();

    expect(suggest).not.toHaveBeenCalled();
    expect(component['suggestError']()).toContain('cannot be empty');
  });

  it('sends the suggestion against the resolved org and the card it was opened on', async () => {
    const { component } = await setup(session(ROLES.CLIENT_CLOSER, ['loc-a']));
    const card = FRAMEWORK.tabs[0].sections[0].cards[0];

    component['openSuggestion'](card);
    component['suggestForm'].setValue({ content: ' Shorter opener. ', note: ' Went quiet. ' });
    await component['submitSuggestion']();

    expect(suggest).toHaveBeenCalledWith({
      orgId: 'loc-a',
      cardId: 'card1',
      content: 'Shorter opener.',
      note: 'Went quiet.',
    });
    expect(component['suggestSentFor']()).toBe('card1');
    expect(component['suggestingCardId']()).toBeNull();
  });

  it('re-reads the framework after an approval, because the script changed', async () => {
    const { component } = await setup(session(ROLES.TAG_SALES_MANAGER, ['loc-a']));
    framework.mockClear();

    await component['resolve'](SUGGESTION, 'approve');

    expect(resolve).toHaveBeenCalledWith('s1', 'approve');
    expect(framework).toHaveBeenCalledTimes(1);
  });

  it('only re-reads the queue after a rejection, since nothing else moved', async () => {
    const { component } = await setup(session(ROLES.TAG_SALES_MANAGER, ['loc-a']));
    framework.mockClear();
    pendingSuggestions.mockClear();

    await component['resolve'](SUGGESTION, 'reject');

    expect(framework).not.toHaveBeenCalled();
    expect(pendingSuggestions).toHaveBeenCalledTimes(1);
  });

  it('names a failed queue read instead of showing "no pending suggestions"', async () => {
    const { component } = await setup(session(ROLES.TAG_SALES_MANAGER, ['loc-a']));
    pendingSuggestions.mockResolvedValue({
      data: null,
      error: { message: 'Postgres unreachable.', context: 'GET /api/flow/org/loc-a/suggestions' },
    });

    await component['loadSuggestions']();

    expect(component['suggestionsError']()).toBe('Postgres unreachable.');
    // The scripts are untouched: they loaded fine and are still worth reading.
    expect(component['tabs']()).toHaveLength(1);
  });

  it('labels a suggestion by the card it targets', async () => {
    const { component } = await setup(session(ROLES.TAG_SALES_MANAGER, ['loc-a']));

    expect(component['cardLabel']('card1')).toBe('The opener');
    expect(component['cardLabel']('missing')).toBe('Unknown card');
  });

  it('shows a failed framework read as a failure, not as a framework with no tabs', async () => {
    const { component } = await setup(session(ROLES.CLIENT_CLOSER, ['loc-a']), {
      data: null,
      error: { message: 'Framework unavailable.', context: 'GET /api/flow/org/loc-a/framework' },
    });

    expect(component['error']()).toBe('Framework unavailable.');
    expect(component['framework']()).toBeNull();
  });
});
