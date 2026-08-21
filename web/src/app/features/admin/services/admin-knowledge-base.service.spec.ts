import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminKnowledgeBaseService } from './admin-knowledge-base.service';
import { parseBlocks } from './admin-knowledge-base.model';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';

/**
 * Story: the author of a version is the session's, never the client's.
 *
 * Version history answers "who changed this away from what it was". A field the
 * client fills in is a field the client can lie about, so there is no actor
 * anywhere in these request bodies — the endpoint takes it from the session.
 *
 * `parseBlocks` gets its own tests because it is the only validation between a
 * typo in a textarea and a 400. Its job is to fail with a message that names
 * what is wrong, not to fail generically.
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
    service: TestBed.inject(AdminKnowledgeBaseService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('AdminKnowledgeBaseService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves a page with no actor field anywhere in the body', async () => {
    const { service, httpMock } = setup();

    const pending = service.save('page-1', {
      num: '1.2',
      title: 'Escalation',
      eyebrow: 'Client services',
      lede: 'When to escalate',
      status: 'Published',
      level: 'Core',
      blocks: [{ type: 'paragraph', content: 'Text' }],
    });
    const request = httpMock.expectOne('/api/admin/knowledge-base/page-1');
    const keys = Object.keys(request.request.body as object);

    expect(request.request.method).toBe('PUT');
    expect(keys).not.toContain('authorUid');
    expect(keys).not.toContain('authorEmail');
    expect(keys).not.toContain('actor');

    request.flush({ ok: true });
    await pending;
    httpMock.verify();
  });

  it('reverts through the version’s own path, with no body to forge', async () => {
    const { service, httpMock } = setup();

    const pending = service.revert('page-1', 'ver-3');
    const request = httpMock.expectOne(
      '/api/admin/knowledge-base/page-1/versions/ver-3/revert',
    );

    expect(request.request.method).toBe('POST');

    request.flush({ ok: true });
    await pending;
    httpMock.verify();
  });

  it('reports a failed history read as a failure, not as a page never edited', async () => {
    const { service, httpMock } = setup();

    const pending = service.history('page-1');
    httpMock
      .expectOne('/api/admin/knowledge-base/page-1/versions')
      .flush(null, { status: 500, statusText: 'Server Error' });

    const result = await pending;

    // An empty list here would be a claim — "nobody has ever edited this" —
    // that the failure gives no grounds for.
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(500);
    httpMock.verify();
  });
});

describe('parseBlocks', () => {
  it('accepts a well-formed array', () => {
    const result = parseBlocks('[{"type":"note","content":"Careful"}]');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].type).toBe('note');
    }
  });

  it('says it is not JSON when it is not JSON', () => {
    const result = parseBlocks('[{type:note}]');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Blocks is not valid JSON.');
  });

  it('says it must be an array when a lone object is pasted', () => {
    const result = parseBlocks('{"type":"note"}');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Blocks must be a JSON array.');
  });

  it('names the offending index when one entry is not an object', () => {
    const result = parseBlocks('[{"type":"note"}, "oops"]');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Block 1 must be an object.');
  });

  it('names the offending index when a block has no type', () => {
    const result = parseBlocks('[{"type":"note"}, {"content":"x"}]');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Block 1 needs a non-empty "type".');
  });

  it('rejects an empty type rather than letting an untyped block through', () => {
    const result = parseBlocks('[{"type":""}]');

    expect(result.ok).toBe(false);
  });
});
