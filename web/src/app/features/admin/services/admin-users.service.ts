import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  Acknowledged,
  AdminUsersDirectory,
  CreatedGroup,
  GroupRoleInput,
  IndividualRoleInput,
  NewGroupInput,
} from './admin-users.model';

const USERS_URL = '/api/admin/users';
const GROUPS_URL = `${USERS_URL}/groups`;

/**
 * Typed access to the admin user-management endpoints. The screens talk to
 * this; nothing in this feature touches HttpClient, per CLAUDE.md.
 *
 * Every method is a thin wrapper. There is no local filtering, no caching and
 * no merging of two sources, because each of those would put a second opinion
 * about who holds which role in front of the server's answer — and this is the
 * screen where that answer is written.
 *
 * `uid` and `groupId` are path segments, so they are percent-encoded before
 * being interpolated. A Firebase uid is alphanumeric today, but building a URL
 * by concatenation is the habit that eventually meets an id with a slash in it.
 */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly api = inject(ApiService);

  /** The directory, the groups that write its claims, and the CS reporting lines. */
  load(): Promise<ApiResult<AdminUsersDirectory>> {
    return firstValueFrom(this.api.get<AdminUsersDirectory>(USERS_URL));
  }

  createGroup(input: NewGroupInput): Promise<ApiResult<CreatedGroup>> {
    return firstValueFrom(
      this.api.post<CreatedGroup>(GROUPS_URL, {
        name: input.name,
        role: input.role,
        locationsRaw: input.locationsRaw,
      }),
    );
  }

  /** Applies to every current member of the group immediately. */
  updateGroup(groupId: string, input: GroupRoleInput): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.patch<Acknowledged>(`${GROUPS_URL}/${encodeURIComponent(groupId)}`, {
        role: input.role,
        locationsRaw: input.locationsRaw,
      }),
    );
  }

  deleteGroup(groupId: string): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.delete<Acknowledged>(`${GROUPS_URL}/${encodeURIComponent(groupId)}`),
    );
  }

  addMember(groupId: string, uid: string): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.post<Acknowledged>(`${GROUPS_URL}/${encodeURIComponent(groupId)}/members`, { uid }),
    );
  }

  removeMember(groupId: string, uid: string): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.delete<Acknowledged>(
        `${GROUPS_URL}/${encodeURIComponent(groupId)}/members/${encodeURIComponent(uid)}`,
      ),
    );
  }

  /**
   * Individual grant. Detaches the user from any group server-side, so group
   * state and individual state can never both claim the same person.
   *
   * `managerEmail` is sent as given, including null: the endpoint only reads it
   * for tag_csm / tag_csd and rejects a CS hat on a user with no email on file
   * BEFORE writing the claim, so a refused assignment leaves nothing behind.
   */
  assignRole(uid: string, input: IndividualRoleInput): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.put<Acknowledged>(`${USERS_URL}/${encodeURIComponent(uid)}/role`, {
        role: input.role,
        locationsRaw: input.locationsRaw,
        email: input.email,
        managerEmail: input.managerEmail,
        scope: input.scope,
        team: input.team,
      }),
    );
  }
}
