import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminUsersService } from './admin-users.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { ROLES } from '../../../core/models/role.model';

/**
 * Story: the location list stays raw, and every id in a path stays encoded.
 *
 * The raw text matters because the split rule ("what separates two ids") lives
 * server-side in one place. A client that split first would be a second
 * implementation, and the first person to paste a newline-separated list finds
 * out which one wins.
 *
 * The encoding matters because these ids become URL path segments. Firebase
 * uids are alphanumeric today; building a URL by concatenation is the habit
 * that eventually meets one that is not.
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
    service: TestBed.inject(AdminUsersService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('AdminUsersService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the directory, the groups and the CS lines in one round trip', async () => {
    const { service, httpMock } = setup();

    const pending = service.load();
    const request = httpMock.expectOne('/api/admin/users');

    expect(request.request.method).toBe('GET');

    request.flush({ users: [], groups: [], csmRecords: [] });
    const result = await pending;

    expect(result.error).toBeNull();
    expect(result.data?.users).toEqual([]);
    httpMock.verify();
  });

  it('sends the location list as raw text, leaving the split rule server-side', async () => {
    const { service, httpMock } = setup();

    const pending = service.createGroup({
      name: 'Sales team',
      role: ROLES.TAG_SALES,
      locationsRaw: 'loc_a, loc_b\nloc_c',
    });
    const request = httpMock.expectOne('/api/admin/users/groups');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Sales team',
      role: 'tag_sales',
      locationsRaw: 'loc_a, loc_b\nloc_c',
    });
    // No client-side split: a `locations` array would be a second opinion.
    expect(Object.keys(request.request.body as object)).not.toContain('locations');

    request.flush({ group: {} }, { status: 201, statusText: 'Created' });
    await pending;
    httpMock.verify();
  });

  it('encodes a group id into the path rather than concatenating it', async () => {
    const { service, httpMock } = setup();

    const pending = service.deleteGroup('grp/one');
    const request = httpMock.expectOne('/api/admin/users/groups/grp%2Fone');

    expect(request.request.method).toBe('DELETE');

    request.flush({ ok: true });
    await pending;
    httpMock.verify();
  });

  it('encodes both ids when removing a member', async () => {
    const { service, httpMock } = setup();

    const pending = service.removeMember('grp 1', 'uid#2');
    const request = httpMock.expectOne('/api/admin/users/groups/grp%201/members/uid%232');

    expect(request.request.method).toBe('DELETE');

    request.flush({ ok: true });
    await pending;
    httpMock.verify();
  });

  it('sends the email from the directory record, never a typed one', async () => {
    const { service, httpMock } = setup();

    const pending = service.assignRole('uid-1', {
      role: ROLES.TAG_CSM,
      locationsRaw: '',
      email: 'csm@taxadvisorygrowth.net',
      managerEmail: 'csd@taxadvisorygrowth.net',
    });
    const request = httpMock.expectOne('/api/admin/users/uid-1/role');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      role: 'tag_csm',
      locationsRaw: '',
      email: 'csm@taxadvisorygrowth.net',
      managerEmail: 'csd@taxadvisorygrowth.net',
    });

    request.flush({ ok: true });
    await pending;
    httpMock.verify();
  });

  it('carries a rejected location id back with the id named in it', async () => {
    const { service, httpMock } = setup();

    const pending = service.updateGroup('grp-1', {
      role: ROLES.TAG_CSM,
      locationsRaw: 'loc/bad',
    });
    httpMock.expectOne('/api/admin/users/groups/grp-1').flush(
      {
        message: 'Invalid location id: loc/bad',
        context: 'PATCH /api/admin/users/groups/grp-1',
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const result = await pending;

    // A 400 whose message is suppressed leaves the admin retyping a list they
    // cannot see is wrong.
    expect(result.error?.message).toBe('Invalid location id: loc/bad');
    httpMock.verify();
  });

  it('reports a failed directory read as a failure, not as a project with no users', async () => {
    const { service, httpMock } = setup();

    const pending = service.load();
    httpMock.expectOne('/api/admin/users').flush(null, { status: 500, statusText: 'Server Error' });

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(500);
    httpMock.verify();
  });
});
