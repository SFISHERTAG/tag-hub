"use client";

import { useState, useTransition } from "react";
import type { Contact, Note } from "@/lib/ghl/contacts";
import type { Opportunity } from "@/lib/ghl/opportunities";
import { formatDate, firstTouch, lastTouch, formatMoney } from "@/lib/ghl/format";
import { getPrepData } from "./actions";

type PrepData = {
  contact: Contact;
  notes: Note[];
  opportunity: Opportunity | null;
};

/**
 * Call-prep control (story 2.7). Renders a plain button in the appointment
 * row — attribution, pipeline, and notes are fetched only once the closer
 * opens the modal (AC4), not while /today itself is loading.
 */
export function PrepPanel({
  contactId,
  contactLabel,
  locationId,
}: {
  contactId: string;
  contactLabel: string;
  locationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PrepData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openModal() {
    setOpen(true);
    if (data || pending) return; // already fetched or in flight

    startTransition(async () => {
      const result = await getPrepData(locationId, contactId);
      if (result.ok) {
        setData({ contact: result.contact, notes: result.notes, opportunity: result.opportunity });
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
      >
        Call prep
      </button>

      {open && (
        <PrepModal
          contactLabel={contactLabel}
          pending={pending}
          error={error}
          data={data}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PrepModal({
  contactLabel,
  pending,
  error,
  data,
  onClose,
}: {
  contactLabel: string;
  pending: boolean;
  error: string | null;
  data: PrepData | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-line bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Call prep for ${contactLabel}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">{contactLabel}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-ink-3 hover:text-ink"
          >
            Close
          </button>
        </div>

        {pending && <p className="text-xs text-ink-3">Loading…</p>}
        {error && <p className="text-xs text-danger">{error}</p>}

        {data && (
          <div className="space-y-4">
            <Attribution contact={data.contact} />
            <Pipeline opportunity={data.opportunity} />
            <Notes notes={data.notes} />
          </div>
        )}
      </div>
    </div>
  );
}

function Attribution({ contact }: { contact: Contact }) {
  const firstTouchAttr = firstTouch(contact);
  const lastTouchAttr = lastTouch(contact);

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-ink-2">Attribution</h4>
      <div className="text-xs text-ink-2 space-y-1">
        {firstTouchAttr && (
          <div>
            <p className="text-ink-3">First touch:</p>
            <p>
              {firstTouchAttr.utmAdId ? `Ad: ${firstTouchAttr.utmAdId}` : "—"}{" "}
              {firstTouchAttr.utmCampaign && `/ ${firstTouchAttr.utmCampaign}`}
            </p>
          </div>
        )}
        {lastTouchAttr && (
          <div>
            <p className="text-ink-3">Last touch:</p>
            <p>
              {lastTouchAttr.utmAdId ? `Ad: ${lastTouchAttr.utmAdId}` : "—"}{" "}
              {lastTouchAttr.utmCampaign && `/ ${lastTouchAttr.utmCampaign}`}
            </p>
          </div>
        )}
        {!firstTouchAttr && !lastTouchAttr && <p>No attribution on file.</p>}
      </div>
    </div>
  );
}

function Pipeline({ opportunity }: { opportunity: Opportunity | null }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-ink-2">Pipeline</h4>
      <div className="text-xs text-ink-2">
        {opportunity ? (
          <>
            <p>Stage: {opportunity.name || "Unnamed deal"}</p>
            {opportunity.monetaryValue > 0 && <p>Value: {formatMoney(opportunity.monetaryValue)}</p>}
            <p>Status: {opportunity.status}</p>
          </>
        ) : (
          <p>N/A — no pipeline data for this contact.</p>
        )}
      </div>
    </div>
  );
}

function Notes({ notes }: { notes: Note[] }) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-ink-2">Notes ({notes.length})</h4>
      {notes.length === 0 ? (
        <p className="text-xs text-ink-2">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-ink-2 border-l border-line-strong pl-2 py-1">
            <p className="text-ink-3">{formatDate(notes[0].dateAdded)}</p>
            <p className="mt-0.5 whitespace-pre-wrap">{notes[0].body}</p>
          </div>

          {notes.length > 1 && <CollapsedNotes notes={notes.slice(1)} />}
        </div>
      )}
    </div>
  );
}

function CollapsedNotes({ notes }: { notes: Note[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-accent hover:underline"
      >
        {expanded ? "Show less" : `Show ${notes.length} more`}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="text-xs text-ink-2 border-l border-line-strong pl-2 py-1">
              <p className="text-ink-3">{formatDate(note.dateAdded)}</p>
              <p className="mt-0.5 whitespace-pre-wrap">{note.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
