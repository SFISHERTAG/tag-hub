import "server-only";
import { getMetaApi, getMetaBusinessId, isMetaConfigured } from "./client";
import { withErrorHandling, type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Enumerates the ad accounts the System User can actually reach, read from
 * Meta rather than from us.
 *
 * Every other module in `lib/meta/` takes an `adAccountId` it was handed:
 * `getAdSpend`, `getAdAccountCampaigns` and the rest all start from the
 * tenant's stored `meta_ad_account_id`, which was typed into an intake form
 * (`functions/src/webhooks/phase2-intake-submit.ts`) and edited by hand
 * afterwards (`app/api/admin/tenants/[locationId]/route.ts`). That stored
 * list is a mirror of Business Manager, and a mirror drifts: an account the
 * client revoked, an ID with a typo, or an assignment that was never made
 * all present identically downstream, as an ad account with no spend. This
 * is the real list, so the two can be diffed instead of assumed equal.
 *
 * `client_ad_accounts` is the client-owned side of the Business Portfolio —
 * accounts another business owns and has granted our System User access to,
 * which is the arrangement Story 4.1 set up for TAG's clients. It does not
 * include accounts the portfolio owns outright; those are `owned_ad_accounts`
 * and are a separate edge, deliberately not merged in here.
 */

/** Meta's `account_status` integer, mapped where the docs name a value. */
export const AD_ACCOUNT_STATUS: Readonly<Record<number, string>> = Object.freeze({
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED",
  7: "PENDING_RISK_REVIEW",
  8: "PENDING_SETTLEMENT",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
  201: "ANY_ACTIVE",
  202: "ANY_CLOSED",
});

export interface MetaAdAccount {
  /** Graph node ID, already `act_`-prefixed, e.g. "act_123456789". */
  id: string;
  /** Bare numeric ID without the prefix, e.g. "123456789". */
  accountId: string;
  name: string;
  /** Raw integer from Meta. Kept alongside the label so an unmapped code survives. */
  accountStatus: number | null;
  /** Human label for `accountStatus`, or null when Meta sends a code we don't map. */
  accountStatusLabel: string | null;
  currency: string | null;
  timezoneName: string | null;
}

/** Graph API's own shape. Optional throughout: Meta omits rather than nulls. */
interface RawAdAccount {
  id?: string;
  account_id?: string;
  name?: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
}

interface RawPage {
  data?: RawAdAccount[];
  paging?: { cursors?: { after?: string }; next?: string };
}

const FIELDS = ["id", "account_id", "name", "account_status", "currency", "timezone_name"];

/**
 * Hard stop on the cursor walk. A portfolio this size means something is
 * wrong with the query, not that TAG has 5000 clients, and an unbounded
 * `while` against a paginated remote is how one bad response becomes an
 * infinite loop holding a request open.
 */
const MAX_PAGES = 50;
const PAGE_SIZE = 100;

function normalize(raw: RawAdAccount): MetaAdAccount | null {
  // Without an ID there is nothing a caller can do with the row, and
  // synthesising one would put a fake account in front of a human.
  const accountId = raw.account_id ?? (raw.id?.startsWith("act_") ? raw.id.slice(4) : raw.id);
  if (!accountId) return null;

  const accountStatus = typeof raw.account_status === "number" ? raw.account_status : null;

  return {
    id: raw.id ?? `act_${accountId}`,
    accountId,
    name: raw.name ?? "Unnamed ad account",
    accountStatus,
    accountStatusLabel: accountStatus === null ? null : (AD_ACCOUNT_STATUS[accountStatus] ?? null),
    currency: raw.currency ?? null,
    timezoneName: raw.timezone_name ?? null,
  };
}

/**
 * List every client-owned ad account the configured Business Portfolio has
 * been granted access to.
 *
 * `data: []` (no `error`) when Meta isn't configured — the same expected
 * state `getAdAccountCampaigns` reports, since META_SYSTEM_USER_TOKEN is
 * still absent from the deploy environment. A failed call is `error !== null`
 * and never a silently empty array: "the System User is assigned to nothing"
 * and "the token was revoked" are the two readings a caller must be able to
 * tell apart, and an empty list on failure would say the first while meaning
 * the second.
 *
 * Pages through Meta's cursors rather than taking the first page: a single
 * truncated page reads exactly like a complete short list, so a client whose
 * account sits on page two would present as unassigned.
 */
export async function listClientAdAccounts(
  businessId?: string,
): Promise<ApiResult<MetaAdAccount[]>> {
  if (!isMetaConfigured()) return { data: [], error: null };

  const business = businessId ?? getMetaBusinessId();

  return withErrorHandling(`listClientAdAccounts(${business})`, async () => {
    const api = getMetaApi();
    const accounts: MetaAdAccount[] = [];
    const seen = new Set<string>();
    let after: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await api.call<RawPage>("GET", `/${business}/client_ad_accounts`, {
        fields: FIELDS,
        limit: PAGE_SIZE,
        ...(after ? { after } : {}),
      });

      for (const raw of response.data ?? []) {
        const account = normalize(raw);
        // Meta can repeat a row across pages when the underlying set shifts
        // mid-walk; a duplicate would double-count in any diff built on this.
        if (account && !seen.has(account.id)) {
          seen.add(account.id);
          accounts.push(account);
        }
      }

      // Both halves matter: `next` absent means last page, and a missing
      // cursor with `next` present would otherwise re-request page one forever.
      after = response.paging?.next ? response.paging.cursors?.after : undefined;
      if (!after) break;
    }

    return accounts.sort((a, b) => a.name.localeCompare(b.name));
  });
}

/**
 * True when the System User can reach `adAccountId`. Accepts either form of
 * the ID, since the tenant record stores it inconsistently — `lib/meta/ads.ts`
 * prefixes `act_` defensively for the same reason.
 *
 * Returns the full `ApiResult` rather than a bare boolean so a failed lookup
 * cannot read as "no access": that collapse is exactly what this module was
 * added to make visible.
 */
export async function hasClientAdAccountAccess(
  adAccountId: string,
): Promise<ApiResult<boolean>> {
  const result = await listClientAdAccounts();
  if (result.error) return result as ApiResult<boolean>;

  const bare = adAccountId.startsWith("act_") ? adAccountId.slice(4) : adAccountId;
  return { data: result.data.some((account) => account.accountId === bare), error: null };
}
