import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserRow } from './user-row';
import { AdminUsersService } from '../../services/admin-users.service';
import { ok } from '../../../../core/models/api-result.model';
import { ROLES } from '../../../../core/models/role.model';
import type { ApiResult } from '../../../../core/models/api-result.model';
import type {
  Acknowledged,
  DirectoryUser,
  IndividualRoleInput,
} from '../../services/admin-users.model';

/**
 * Story: the email that decides a CS reporting line is the one on the account,
 * not one somebody types.
 *
 * The CS collection is keyed by email. An admin retyping an address is an admin
 * who can point a reporting line at an account that does not exist, and the
 * rollup then reports a CSM to nobody. So the request always carries the
 * directory record's own email.
 *
 * The reporting-line field itself is offered only for the two hats in the
 * rollup, and its value is dropped for every other role — otherwise switching a
 * CSM to a setter would leave a stale manager on the request.
 */

const USER: DirectoryUser = {
  uid: 'uid-1',
  email: 'csm@taxadvisorygrowth.net',
  role: ROLES.TAG_CSM,
  locations: ['loc1', 'loc2'],
  groupId: 'grp-1',
  groupName: 'CS team',
  scope: null,
  team: [],
};

const PEER: DirectoryUser = {
  uid: 'uid-2',
  email: 'closer@taxadvisorygrowth.net',
  role: ROLES.CLIENT_CLOSER,
  locations: ['loc1'],
  groupId: null,
  groupName: null,
  scope: null,
  team: [],
};

const assignRole =
  vi.fn<(uid: string, input: IndividualRoleInput) => Promise<ApiResult<Acknowledged>>>();

function setup(user: DirectoryUser = USER, managerEmail: string | null = 'csd@tag.io') {
  assignRole.mockReset();
  assignRole.mockResolvedValue(ok({ ok: true }));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [UserRow],
    providers: [
      provideZonelessChangeDetection(),
      { provide: AdminUsersService, useValue: { assignRole } },
    ],
  });

  const fixture = TestBed.createComponent(UserRow);
  fixture.componentRef.setInput('user', user);
  fixture.componentRef.setInput('managerEmail', managerEmail);
  // The directory as the page passes it: this user plus their peers. The
  // component is responsible for excluding the user from their own team.
  fixture.componentRef.setInput('peers', [user, PEER]);
  fixture.detectChanges();

  const component = fixture.componentInstance;
  component['reset']();
  fixture.detectChanges();

  return { fixture, component };
}

describe('UserRow', () => {
  it('seeds the form from the record when the panel opens', () => {
    const { component } = setup();

    expect(component['form'].getRawValue()).toEqual({
      role: ROLES.TAG_CSM,
      locationsRaw: 'loc1, loc2',
      managerEmail: 'csd@tag.io',
      scope: '',
      team: [],
    });
  });

  it('shows the reporting-line field only for the hats in the CS rollup', () => {
    const { fixture, component } = setup();

    expect(component['reportsToCsd']()).toBe(true);

    component['form'].patchValue({ role: ROLES.TAG_CSD });
    fixture.detectChanges();
    expect(component['reportsToCsd']()).toBe(true);

    component['form'].patchValue({ role: ROLES.CLIENT_CLOSER });
    fixture.detectChanges();
    expect(component['reportsToCsd']()).toBe(false);
  });

  it('sends the account’s own email, never a typed one', async () => {
    const { component } = setup();

    await component['save']();

    expect(assignRole).toHaveBeenCalledWith('uid-1', {
      role: ROLES.TAG_CSM,
      locationsRaw: 'loc1, loc2',
      scope: null,
      team: null,
      email: 'csm@taxadvisorygrowth.net',
      managerEmail: 'csd@tag.io',
    });
  });

  it('drops a stale reporting line when the role leaves the CS rollup', async () => {
    const { fixture, component } = setup();

    component['form'].patchValue({ role: ROLES.TAG_SETTER });
    fixture.detectChanges();
    await component['save']();

    expect(assignRole).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ role: ROLES.TAG_SETTER, managerEmail: null }),
    );
  });

  it('sends null rather than an empty string for a blank reporting line', async () => {
    const { fixture, component } = setup(USER, null);

    component['form'].patchValue({ managerEmail: '   ' });
    fixture.detectChanges();
    await component['save']();

    expect(assignRole).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ managerEmail: null }),
    );
  });

  it('passes a missing email through as null, so the server can refuse a CS hat', async () => {
    // The endpoint rejects a CS role on a user with no email BEFORE writing the
    // claim. Sending "" instead of null would look like an address to it.
    const { component } = setup({ ...USER, email: null });

    await component['save']();

    expect(assignRole).toHaveBeenCalledWith('uid-1', expect.objectContaining({ email: null }));
  });

  it('surfaces the refusal and does not claim to have saved', async () => {
    const { component } = setup({ ...USER, email: null });
    assignRole.mockResolvedValue({
      data: null,
      error: {
        message: 'This user has no email on file — cannot set CS reporting line.',
        context: 'PUT /api/admin/users/uid-1/role',
        status: 400,
      },
    });

    await component['save']();

    expect(component['error']()).toContain('no email on file');
    expect(component['saved']()).toBe(false);
  });

  it('falls back to the uid when there is no email to label the row with', () => {
    const { component } = setup({ ...USER, email: null });

    expect(component['label']()).toBe('uid-1');
    expect(component['groupLabel']()).toBe('CS team');
  });

  it('says "No role" rather than showing a blank for an unassigned account', () => {
    const { component } = setup({ ...USER, role: null, groupName: null });

    expect(component['roleLabel']()).toBe('No role');
    expect(component['groupLabel']()).toBe('No group');
  });
});

/**
 * Story 7.7. Until this screen could write them, `scope` and `team` were fields
 * only the read path had ever seen, so every grant fell back to the role
 * default. The tests below are about the two ways this screen could write
 * something the server will refuse or the session will misread.
 */
describe('UserRow data scope', () => {
  it('seeds an existing override so it can be seen before it is changed', () => {
    const { component } = setup({ ...USER, scope: 'team', team: ['uid-2'] });
    expect(component['form'].getRawValue().scope).toBe('team');
    expect(component['form'].getRawValue().team).toEqual(['uid-2']);
  });

  it("offers the team picker only for a team scope", () => {
    const { fixture, component } = setup();
    expect(component['picksTeam']()).toBe(false);

    component['form'].patchValue({ scope: 'team' });
    fixture.detectChanges();
    expect(component['picksTeam']()).toBe(true);

    component['form'].patchValue({ scope: 'tenancy' });
    fixture.detectChanges();
    expect(component['picksTeam']()).toBe(false);
  });

  it('never offers the user their own account as a team member', () => {
    const { component } = setup();
    const options = component['teamOptions']().map((peer) => peer.uid);
    expect(options).not.toContain('uid-1');
    expect(options).toContain('uid-2');
  });

  it('sends null for both when the scope is left at the role default', async () => {
    const { component } = setup();
    await component['save']();
    expect(assignRole).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ scope: null, team: null }),
    );
  });

  it('sends the team alongside a team scope', async () => {
    const { fixture, component } = setup();
    component['form'].patchValue({ scope: 'team', team: ['uid-2'] });
    fixture.detectChanges();

    await component['save']();
    expect(assignRole).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ scope: 'team', team: ['uid-2'] }),
    );
  });

  it('drops a stale team when the scope moves off team, rather than sending one the server refuses', async () => {
    const { fixture, component } = setup({ ...USER, scope: 'team', team: ['uid-2'] });
    component['form'].patchValue({ scope: 'tenancy' });
    fixture.detectChanges();

    await component['save']();
    expect(assignRole).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ scope: 'tenancy', team: null }),
    );
  });

  it('clears an override back to the role default', async () => {
    const { fixture, component } = setup({ ...USER, scope: 'tenancy', team: [] });
    component['form'].patchValue({ scope: '' });
    fixture.detectChanges();

    await component['save']();
    expect(assignRole).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ scope: null, team: null }),
    );
  });
});
