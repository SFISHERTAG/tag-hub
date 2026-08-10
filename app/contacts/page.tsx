import Link from "next/link";
import {
  searchContacts,
  displayName,
  formatDate,
} from "@/lib/ghl/contacts";
import { requireSession } from "@/lib/auth/session";
import { devLocationId, GhlConfigError } from "@/lib/ghl/tokens";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSession();

  const { q } = await searchParams;
  const query = q?.trim() || undefined;

  const locationId = devLocationId();
  if (!locationId) {
    return (
      <div className="max-w-2xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
        <h2 className="text-base font-semibold">Setup needed</h2>
        <p className="mt-2 text-sm">
          No location configured. Set <code>GHL_LOCATION_ID</code> in{" "}
          <code>hub/.env.local</code>.
        </p>
      </div>
    );
  }

  let contacts;
  try {
    contacts = await searchContacts(locationId, { query });
  } catch (error) {
    if (error instanceof GhlConfigError) {
      return (
        <div className="max-w-2xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <h2 className="text-base font-semibold">Setup needed</h2>
          <p className="mt-2 text-sm">{error.message}</p>
        </div>
      );
    }
    return (
      <div className="max-w-2xl rounded-lg border border-red-300 bg-red-50 p-6 text-red-900">
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
        <span className="text-sm text-neutral-500">
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
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-[#ebc507]"
        >
          Search
        </button>
      </form>

      {contacts.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {query ? `No contacts matching "${query}".` : "No contacts found."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
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
                  className="border-t border-neutral-200 hover:bg-neutral-50"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {displayName(contact)}
                    </Link>
                    {contact.companyName && (
                      <span className="ml-2 text-xs text-neutral-500">
                        {contact.companyName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {contact.email || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {contact.phone || "—"}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 text-neutral-500">
                    {contact.source || "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-500">
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
