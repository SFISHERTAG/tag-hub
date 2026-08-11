import { requireSession } from "@/lib/auth/session";
import { listGroups } from "@/lib/auth/groups";
import { listAllUsers } from "@/lib/auth/user-directory";
import { GroupCard } from "./group-card";
import { NewGroupForm } from "./new-group-form";
import { UserTable } from "./user-table";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const session = await requireSession();

  // Gated on the effective hat — see app/admin/tenants/page.tsx for why.
  if (session.hat !== "tag_exec") {
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only executives can manage users.</p>
      </div>
    );
  }

  const [groups, users] = await Promise.all([listGroups(), listAllUsers()]);
  const ungrouped = users.filter((u) => !u.groupId);
  const usersByUid = new Map(users.map((u) => [u.uid, u]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <span className="text-sm text-ink-3">
          {users.length} {users.length === 1 ? "user" : "users"} · {groups.length}{" "}
          {groups.length === 1 ? "group" : "groups"}
        </span>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-2">Groups</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              members={group.memberUids
                .map((uid) => usersByUid.get(uid))
                .filter((u): u is NonNullable<typeof u> => Boolean(u))}
              ungrouped={ungrouped}
            />
          ))}
        </div>
        <NewGroupForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-2">All users</h2>
        <div className="overflow-x-auto rounded-lg border border-line">
          <UserTable users={users} />
        </div>
      </section>
    </div>
  );
}
