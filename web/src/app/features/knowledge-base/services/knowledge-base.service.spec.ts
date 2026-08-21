import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { KnowledgeBaseService } from './knowledge-base.service';
import {
  instrumentFields,
  noteSeverity,
  stringGrid,
  stringList,
  textField,
  type ManualBlock,
} from './manual.model';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';

/**
 * Story: reading the manual is read-only, and every field read out of a loose
 * block is checked before it is used.
 *
 * `blocks` is deliberately a loose union — the source manual gains new shapes
 * per page. The rule the renderer follows is that a field of the wrong type is
 * treated as absent, never coerced, because a manual that quietly renders
 * `[object Object]` in the middle of a procedure is worse than one that skips
 * a caveat.
 */

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      { provide: APP_CONFIG, useValue: { production: false, apiBaseUrl: '', googleClientId: '' } },
    ],
  });

  return {
    service: TestBed.inject(KnowledgeBaseService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('KnowledgeBaseService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the index from the viewer endpoint, not the admin one', async () => {
    const { service, httpMock } = setup();

    const pending = service.list();
    const request = httpMock.expectOne('/api/knowledge-base');

    expect(request.request.method).toBe('GET');

    request.flush({ pages: [] });
    await pending;
    httpMock.verify();
  });

  it('encodes a page id into the path', async () => {
    const { service, httpMock } = setup();

    const pending = service.get('1/2');
    httpMock.expectOne('/api/knowledge-base/1%2F2').flush({ page: {} });

    await pending;
    httpMock.verify();
  });

  it('carries a 403 through as the server worded it', async () => {
    const { service, httpMock } = setup();

    const pending = service.list();
    httpMock.expectOne('/api/knowledge-base').flush(
      {
        message: 'Only TAG staff can access the knowledge base.',
        context: 'GET /api/knowledge-base',
      },
      { status: 403, statusText: 'Forbidden' },
    );

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Only TAG staff can access the knowledge base.');
    httpMock.verify();
  });
});

describe('manual block readers', () => {
  const block = (fields: Record<string, unknown>): ManualBlock =>
    ({ type: 'paragraph', ...fields }) as ManualBlock;

  it('treats a non-string field as absent rather than coercing it', () => {
    expect(textField(block({ title: 'Escalation' }), 'title')).toBe('Escalation');
    expect(textField(block({ title: 42 }), 'title')).toBeNull();
    expect(textField(block({ title: '' }), 'title')).toBeNull();
    expect(textField(block({}), 'title')).toBeNull();
  });

  it('drops non-string entries from a list instead of rendering undefined', () => {
    expect(stringList(block({ steps: ['One', 2, 'Three'] }), 'steps')).toEqual(['One', 'Three']);
    expect(stringList(block({ steps: 'One' }), 'steps')).toEqual([]);
  });

  it('reads a table as rows of strings, tolerating a malformed row', () => {
    expect(stringGrid(block({ rows: [['a', 'b'], 'oops', ['c']] }), 'rows')).toEqual([
      ['a', 'b'],
      [],
      ['c'],
    ]);
  });

  it('keeps an instrument field only when it has a label', () => {
    expect(
      instrumentFields(
        block({ fields: [{ label: 'Close rate', default: '20%' }, { default: 'x' }, 'oops'] }),
        'fields',
      ),
    ).toEqual([{ label: 'Close rate', defaultValue: '20%' }]);
  });

  it('falls back to info for an unrecognised severity', () => {
    expect(noteSeverity(block({ severity: 'hard' }))).toBe('hard');
    expect(noteSeverity(block({ severity: 'good' }))).toBe('good');
    expect(noteSeverity(block({ severity: 'catastrophic' }))).toBe('info');
    expect(noteSeverity(block({}))).toBe('info');
  });
});
