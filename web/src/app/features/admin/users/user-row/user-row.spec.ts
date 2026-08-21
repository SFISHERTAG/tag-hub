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
