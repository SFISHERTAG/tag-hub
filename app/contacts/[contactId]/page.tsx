import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getContact,
  getNotes,
  displayName,
  formatDate,
  firstTouch,
  lastTouch,
  hasMetaIdentifiers,
  type Attribution,
} from "@/lib/ghl/contacts";
import { devLocationId, GhlConfigError } from "@/lib/ghl/tokens";
import { NoteForm } from "./note-form";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-neutral-900">
        {value || "—"}
      </dd>
    </div>
  );
}

/**
 * Attribution answers the question a closer asks first — where did this person
 * come from — and `utmAdId` is the key that later ties a closed deal back to
 * the exact ad that produced it.
 */
function AttributionColumn({
  heading,
  attribution,
}: {
  heading: string;
  attribution: Attribution;
}) {
  const rows: [string, string | undefined][] = [
    ["Source", attribution.utmSource ?? attribution.sessionSource ?? attribution.medium],
    ["Campaign", attribution.utmCampaign ?? attribution.campaign],
    ["Ad ID", attribution.utmAdId],
    ["Content", attribution.utmContent],
    ["Landing page", attribution.pageUrl ?? attribution.url],
  ];

  const present = rows.filter(([, value]) => value);
  if (present.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        {heading}
      </h3>
      <dl className="mt-2 space-y-2">
        {present.map(([label, value]) => (
          <Field key={label} label={label} value={value} />
        ))}
      </dl>
    </div>
  );
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;

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

  let contact;
  let notes;
  try {
    [contact, notes] = await Promise.all([
      getContact(locationId, contactId),
      getNotes(locationId, contactId),
    ]);
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
        <h2 className="text-base font-semibold">Could not load contact</h2>
        <p className="mt-2 font-mono text-xs whitespace-pre-wrap">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  if (!contact) notFound();

  const first = firstTouch(contact);
  const last = lastTouch(contact);
  const metaReady = hasMetaIdentifiers(first) || hasMetaIdentifiers(last);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/contacts"
          className="text-xs text-neutral-500 underline-offset-2 hover:underline"
        >
          ← Contacts
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {displayName(contact)}
        </h1>
        {contact.companyName && (
          <p className="text-sm text-neutral-500">{contact.companyName}</p>
        )}
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" value={contact.email} />
          <Field label="Phone" value={contact.phone} />
          <Field label="Source" value={contact.source} />
          <Field label="Added" value={formatDate(contact.dateAdded)} />
        </dl>
        {contact.tags && contact.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {contact.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </section>

      {(first || last) && (
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-sm font-semibold">Attribution</h2>
          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            {first && (
              <AttributionColumn heading="First touch" attribution={first} />
            )}
            {last && (
              <AttributionColumn heading="Last touch" attribution={last} />
            )}
          </div>
          {metaReady && (
            <p className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
              Meta click identifiers present — a closed deal on this contact can
              be attributed back to the exact ad that produced it.
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold">
          Notes{" "}
          <span className="font-normal text-neutral-500">({notes.length})</span>
        </h2>

        <div className="mt-3">
          <NoteForm locationId={locationId} contactId={contactId} />
        </div>

        {notes.length > 0 && (
          <ul className="mt-5 space-y-3 border-t border-neutral-200 pt-4">
            {notes.map((note) => (
              <li key={note.id}>
                <p className="text-sm whitespace-pre-wrap text-neutral-900">
                  {note.body}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatDate(note.dateAdded)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
