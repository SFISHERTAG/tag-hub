import Link from "next/link";
import {
  searchContacts,
  displayName,
  formatDate,
} from "@/lib/ghl/contacts";
import { GhlConfigError } from "@/lib/ghl/tokens";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locationId } = await params;
  const { q } = await searchParams;
  const query = q?.trim() || undefined;

  let contacts;
  try {
    contacts = await searchContacts(locationId, { query });
  } catch (error) {
    if (error instanceof GhlConfigError) {
      return (
        <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
          <h2 className="text-base font-semibold">Setup needed</h2>
          <p className="mt-2 text-sm">{error.message}</p>
        </div>
      );
    }
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Could not load contacts</h2>
        <p className="mt-2 font-mono text-xs whitespace-pre-wrap">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
        <span className="text-sm text-ink-3">
          {contacts.length}
          {contacts.length === 50 ? "+" : ""} shown
        </span>
      </div>

      <form method="get" className="flex max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query ?? ""}
          placeholder="Search name, email, or phone"
          className="flex-1 rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-md bg-chrome px-4 py-2 text-sm font-semibold text-accent"
        >
          Search
        </button>
      </form>

      {contacts.length === 0 ? (
        <p className="text-sm text-ink-3">
          {query ? `No contacts matching "${query}".` : "No contacts found."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-raised text-left text-xs text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-t border-line hover:bg-raised"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/l/${locationId}/contacts/${contact.id}`}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {displayName(contact)}
                    </Link>
                    {contact.companyName && (
                      <span className="ml-2 text-xs text-ink-3">
                        {contact.companyName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">
                    {contact.email || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">
                    {contact.phone || "—"}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 text-ink-3">
                    {contact.source || "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-3">
                    {formatDate(contact.dateAdded)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
