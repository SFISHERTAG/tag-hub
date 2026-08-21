import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { apiError, rejectCrossSite } from "@/lib/auth/session-cookie";
import { withErrorHandling } from "@/lib/api/errorInterceptor";
import { getMyBugReports, submitBugReport, type BugReportStatus } from "@/lib/bug-reports";

export const dynamic = "force-dynamic";

/**
 * Story 10.4 — bug reports. HTTP replacement for legacy/bug-reports/page.tsx
 * (the list) and its `submitReport` server action (the form).
 *
 * OWNERSHIP IS TAKEN FROM THE SESSION, NEVER FROM THE BODY. `userId` is
 * `session.uid` on both verbs: the list query filters on it, and the submitted
 * document is stamped with it. There is deliberately no `userId` field in the
 * request shape, so there is nothing for a caller to forge — reading someone
 * else's reports, or filing one under their name, is not expressible.
 *
 * No role gate: any signed-in user may report a bug against the product they
 * are using, which is the same rule the Next page had (`requireSession`, no
 * role check). The gate is authentication, not authorization.
 */

const CONTEXT_GET = "GET /api/bug-reports";
const CONTEXT_POST = "POST /api/bug-reports";

/**
 * The "where did this happen" options, served rather than hardcoded in the
 * client.
 *
 * The Next form owned this list in bug-report-form.tsx and the action accepted
 * whatever string arrived, so the two could drift and any text at all could be
 * written to Firestore. Serving it from the same module that validates against
 * it means the dropdown and the accepted set cannot disagree.
 */
const PAGE_AREAS = [
  "Pipeline",
  "Today",
  "Follow-up",
  "Contacts",
  "Client success",
  "Portfolio",
  "Onboarding",
  "Dashboard",
  "Admin",
  "Sign-in",
  "Other",
] as const;

/**
 * Bounds on stored text. The server action had none, so a single submission
 * could write an unbounded document. These are generous enough that no honest
 * report hits them.
 */
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5_000;
const MAX_STEPS = 5_000;

/**
 * A report as its own author sees it. `userId` and `userEmail` are dropped:
 * the caller is by construction the owner of every row here, so echoing their
 * identity back adds nothing and widens what a cached response carries.
 */
type BugReportView = {
  id: string;
  title: string;
  description: string;
  stepsToReproduce: string | null;
  pageArea: string | null;
  status: BugReportStatus;
  /** Epoch milliseconds. 0 when the server timestamp has not resolved yet. */
  createdAt: number;
};

type BugReportListResponse = {
  reports: BugReportView[];
  /** Allowed values for `pageArea` on POST, in display order. */
  pageAreas: string[];
};

export async function GET() {
  const gate = await requireApiSession(CONTEXT_GET);
  if (!gate.ok) return gate.response;

  const { session } = gate;

  const result = await withErrorHandling<BugReportListResponse>(CONTEXT_GET, async () => {
    const reports = await getMyBugReports(session.uid);
    return {
      reports: reports.map((report) => ({
        id: report.id,
        title: report.title,
        description: report.description,
        stepsToReproduce: report.stepsToReproduce ?? null,
        pageArea: report.pageArea ?? null,
        status: report.status,
        createdAt: report.createdAt,
      })),
      pageAreas: [...PAGE_AREAS],
    };
  });

  if (result.error) return apiError(result.error.message, CONTEXT_GET, 500);

  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  // Same CSRF posture as the impersonation routes: JSON content type plus a
  // same-origin Origin header. This is an authenticated write, and a simple
  // cross-site HTML form cannot satisfy either check.
  const crossSite = rejectCrossSite(request, CONTEXT_POST);
  if (crossSite) return crossSite;

  const gate = await requireApiSession(CONTEXT_POST);
  if (!gate.ok) return gate.response;

  const { session } = gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Malformed request.", CONTEXT_POST, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return apiError("Malformed request.", CONTEXT_POST, 400);
  }

  const fields = body as Record<string, unknown>;
  const title = readTrimmed(fields, "title");
  const description = readTrimmed(fields, "description");
  const stepsToReproduce = readTrimmed(fields, "stepsToReproduce");
  const pageArea = readTrimmed(fields, "pageArea");

  // Messages are the Next action's own strings, so the wording the user reads
  // does not change with the transport.
  if (!title) return apiError("Give it a short title.", CONTEXT_POST, 400);
  if (!description) return apiError("Describe what happened.", CONTEXT_POST, 400);

  if (title.length > MAX_TITLE) {
    return apiError(`Title is too long (max ${MAX_TITLE} characters).`, CONTEXT_POST, 400);
  }
  if (description.length > MAX_DESCRIPTION) {
    return apiError(
      `Description is too long (max ${MAX_DESCRIPTION} characters).`,
      CONTEXT_POST,
      400,
    );
  }
  if (stepsToReproduce.length > MAX_STEPS) {
    return apiError(`Steps are too long (max ${MAX_STEPS} characters).`, CONTEXT_POST, 400);
  }
  if (pageArea && !isPageArea(pageArea)) {
    return apiError("Unknown page area.", CONTEXT_POST, 400);
  }

  const result = await withErrorHandling(CONTEXT_POST, () =>
    submitBugReport({
      userId: session.uid,
      // Falls back to the uid exactly as the action did: a report with no way
      // to identify the reporter is worse than one identified by uid alone.
      userEmail: session.email ?? session.uid,
      title,
      description,
      stepsToReproduce: stepsToReproduce || undefined,
      pageArea: pageArea || undefined,
    }),
  );

  if (result.error) return apiError(result.error.message, CONTEXT_POST, 500);

  // Deliberately does NOT return the refreshed list. Re-reading after the write
  // would put a second Firestore call inside this response, and a failure there
  // would answer 500 for a submission that actually landed — inviting the user
  // to file it twice. The client refetches GET instead.
  return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

function readTrimmed(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

function isPageArea(value: string): boolean {
  return (PAGE_AREAS as readonly string[]).includes(value);
}
