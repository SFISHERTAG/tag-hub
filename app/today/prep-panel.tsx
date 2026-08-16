"use client";

import { useState } from "react";
import type { Contact, Note } from "@/lib/ghl/contacts";
import type { Opportunity } from "@/lib/ghl/opportunities";
import { formatDate, displayName, firstTouch, lastTouch } from "@/lib/ghl/format";
import { formatMoney } from "@/lib/ghl/format";

export function PrepPanel({
  contact,
  notes,
  opportunity,
}: {
  contact: Contact;
  notes: Note[];
  opportunity: Opportunity | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const firstTouchAttr = firstTouch(contact);
  const lastTouchAttr = lastTouch(contact);

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-1 py-2 text-xs text-ink-2 hover:text-ink"
      >
        <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
          ▶
        </span>
        {displayName(contact)}
      </button>

      {expanded && (
        <div className="border-l-2 border-line bg-raised p-3 space-y-3">
          {/* Attribution */}
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
            </div>
          </div>

          {/* Opportunity */}
          {opportunity && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-ink-2">Pipeline</h4>
              <div className="text-xs text-ink-2">
                <p>Stage: {opportunity.name || "Unnamed deal"}</p>
                {opportunity.monetaryValue > 0 && (
                  <p>Value: {formatMoney(opportunity.monetaryValue)}</p>
                )}
                <p>Status: {opportunity.status}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-ink-2">
                Notes ({notes.length})
              </h4>
              <div className="space-y-2">
                {notes.map((note) => (
                  <div key={note.id} className="text-xs text-ink-2 border-l border-line-strong pl-2 py-1">
                    <p className="text-ink-3">{formatDate(note.dateAdded)}</p>
                    <p className="mt-0.5 whitespace-pre-wrap">{note.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
