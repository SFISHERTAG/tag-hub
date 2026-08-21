import { requireSession } from "@/lib/auth/session";
import { getMyBugReports } from "@/lib/bug-reports";
import { Panel, Badge } from "../ui";
import { BugReportForm } from "./bug-report-form";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  submitted: "neutral",
  in_review: "info",
  resolved: "ok",
  closed: "neutral",
} as const;

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In review",
  resolved: "Resolved",
  closed: "Closed",
};

export default async function BugReportsPage() {
  const session = await requireSession();
  const reports = await getMyBugReports(session.uid);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Report a bug</h1>

      <Panel title="Tell us what happened">
        <BugReportForm />
      </Panel>

      {reports.length > 0 && (
        <Panel title="Your reports">
          <ul className="space-y-3">
            {reports.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-line px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-ink">{r.title}</p>
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </div>
                {r.pageArea && (
                  <p className="mt-0.5 text-xs text-ink-3">{r.pageArea}</p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
