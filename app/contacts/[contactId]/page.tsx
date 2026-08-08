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

function AttributionPanel({
  label,
  attribution,
}: {
  label: string;
  attribution: Attribution | undefined;
}) {
  if (!attribution) return null;

  const rows = (
    [
      ["Source", attribution.utmSource ?? attribution.sessionSource],
      ["Medium", attribution.utmMedium ?? attribution.medium],
      ["Campaign", attribution.utmCampaign ?? attribution.campaign],
      ["Content", attribution.utmContent],
      ["Ad ID", attribution.utmAdId],
    ] satisfies [string, string | undefined][]
  ).filter(([, value]) => Boolean(value));

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {hasMetaIdentifiers(attribution) && (
          <span
            title="Carries fbc/fbp — conversions can be attributed back to Meta"
            className="rounded-full bg-[#ebc507] px-2 py-0.5 text-[11px] font-semibold text-black"
          >
            Meta trackable
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-neutral-500">{key}</dt>
            <dd className="truncate font-mono text-neutral-800">{value}</dd>
          </div>
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

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/contacts"
          className="text-xs text-neutral-500 underline-offset-2 hover:underline"
        >
          ← Contacts
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {displayName(contact)}
        </h1>
        {contact.companyName && (
          <p className="text-sm text-neutral-500">{contact.companyName}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-4">
          <h3 className="text-sm font-semibold">Details</h3>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            {[
              ["Email", contact.email],
              ["Phone", contact.phone],
              ["Source", contact.source],
              ["Added", formatDate(contact.dateAdded)],
            ]
              .filter(([, value]) => Boolean(value))
              .map(([key, value]) => (
                <div key={String(key)} className="contents">
                  <dt className="text-neutral-500">{key}</dt>
                  <dd className="truncate text-neutral-800">{value}</dd>
                </div>
              ))}
          </dl>
          {contact.tags && contact.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {contact.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <AttributionPanel label="First touch" attribution={first} />
        <AttributionPanel label="Last touch" attribution={last} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">
          Notes{" "}
          <span className="font-normal text-neutral-500">({notes.length})</span>
        </h2>

        <NoteForm locationId={locationId} contactId={contactId} />

        {notes.length === 0 ? (
          <p className="text-sm text-neutral-500">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-lg border border-neutral-200 p-3"
              >
                <p className="text-sm whitespace-pre-wrap text-neutral-800">
                  {note.body}
                </p>
                <p className="mt-1.5 text-xs text-neutral-400">
                  {formatDate(note.dateAdded)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
