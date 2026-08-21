import { Panel, Badge } from "../../ui";
import { SampleDataBanner } from "./sample-data-banner";
import type { CsmBookSummary } from "@/lib/dashboard/team-rollup";

/** CSD-facing: every CSM on their team, worst-average-score book first. */
export function TeamHealthRollup({ books }: { books: CsmBookSummary[] }) {
  if (books.length === 0) {
    return (
      <Panel title="Team health">
        <p className="text-sm text-ink-3">No CSMs report to you yet.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Team health" meta={`${books.length} ${books.length === 1 ? "CSM" : "CSMs"}`}>
      <SampleDataBanner />
      <ol className="space-y-2">
        {books.map((book) => {
          const needsAttention = book.atRisk + book.critical + book.alert;
          return (
            <li
              key={book.csmEmail}
              className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{book.csmEmail}</p>
                <p className="text-xs text-ink-3">
                  {book.clientCount} {book.clientCount === 1 ? "client" : "clients"} · avg score{" "}
                  {book.avgHealthScore}
                  {book.ascensionReadyCount > 0 && ` · ${book.ascensionReadyCount} ascension-ready`}
                </p>
              </div>
              <Badge tone={needsAttention > 0 ? "danger" : "ok"}>
                {needsAttention > 0 ? `${needsAttention} need attention` : "healthy"}
              </Badge>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
