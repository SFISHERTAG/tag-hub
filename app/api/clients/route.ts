import { NextResponse, type NextRequest } from "next/server";
import { filterClients } from "@/lib/dashboard/csm-clients-types";
import { CSM_BOOK_ROLES } from "../dashboard/_lib/access";
import { badRequest, handle, unwrap, requireApiRole } from "../dashboard/_lib/http";
import { loadClientBook, parseScope, type ClientBookScope } from "../dashboard/_lib/client-book";
import { healthDisclosure, toClientDtos, type ClientDataDto, type SampleDataDisclosure } from "../dashboard/_lib/sample-data";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/clients";

const STATUS_FILTERS = ["all", "excellent", "healthy", "at-risk", "critical", "alert"] as const;
const SORT_KEYS = ["name", "health", "roas", "spend"] as const;
const SORT_ORDERS = ["asc", "desc"] as const;

export type ClientBookResponse = {
  scope: ClientBookScope;
  /** Whose book this is. Echoed back so a coverage view can label itself as one. */
  csmEmail: string | null;
  clients: ClientDataDto[];
  total: number;
  sampleData: SampleDataDisclosure;
};

/**
 * GET /api/clients
 *
 * The CSM clients book. Port of
 * legacy/csm-dashboard/actions/get-assigned-clients.ts, widened to carry the
 * team and department scopes legacy/dashboard/page.tsx computed inline.
 *
 * Authorisation is the port of legacy/csm-dashboard/actions/access.ts:
 * staff-vs-client, deliberately not per-CSM ownership. Read the comment on
 * CSM_BOOK_ROLES before narrowing it — the openness is the coverage design,
 * not an oversight.
 *
 * What did change: `scope=mine` is keyed on `session.email` and cannot be
 * pointed at anyone else. Reading a peer's book now requires saying
 * `scope=csm&csmEmail=...` out loud, so coverage stays legible as coverage
 * instead of an arbitrary email silently standing in for "my clients".
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiRole(CSM_BOOK_ROLES, CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;

    const params = request.nextUrl.searchParams;
    const scope = parseScope(params.get("scope"));
    const csmEmail = params.get("csmEmail");

    if (scope !== "csm" && csmEmail !== null) {
      throw badRequest("`csmEmail` is only meaningful with `scope=csm`.");
    }

    const clients = unwrap(await loadClientBook(session, scope, csmEmail));

    // filterClients is the same pure function the reference implementation ran
    // in the browser (lib/dashboard/csm-clients-types.ts). Running it here is
    // an optimisation, not a control: it narrows what crosses the wire, and
    // omitting every parameter returns the same set as before.
    const filtered = filterClients(clients, {
      search: params.get("search") ?? undefined,
      statusFilter: parseEnum(params.get("status"), STATUS_FILTERS, "status") ?? undefined,
      sortBy: parseEnum(params.get("sortBy"), SORT_KEYS, "sortBy") ?? undefined,
      sortOrder: parseEnum(params.get("sortOrder"), SORT_ORDERS, "sortOrder") ?? undefined,
    });

    const body: ClientBookResponse = {
      scope,
      csmEmail: scope === "csm" ? (csmEmail ?? session.email) : session.email,
      clients: toClientDtos(filtered),
      total: filtered.length,
      sampleData: healthDisclosure([
        "clients[].health",
        "clients[].metrics",
        "clients[].escalation.bucket",
      ]),
    };
    return NextResponse.json(body);
  });
}

function parseEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  what: string,
): T | null {
  if (raw === null || raw === "") return null;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw badRequest(`Unknown ${what} "${raw}". Expected one of: ${allowed.join(", ")}.`);
  }
  return raw as T;
}
