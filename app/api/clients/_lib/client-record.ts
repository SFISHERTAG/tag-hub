import "server-only";
// Predates the metric
// registry: queries directly instead of going through a scoped metric fetch.
// Not a leak today (every read is keyed on a clientId gateClient has already
// authorised), but it is the pattern the zone exists to stop, so this is the
// migration marker: move the data path into lib/dashboard/metrics.ts and
// delete this line. See docs/ROLE_SCOPE_MODEL.md. Line-scoped, not file-wide:
// a file-level disable of this rule id also switched off the cross-integration
// zones for the whole file, so a future sibling-integration import here would
// have passed lint silently.
// eslint-disable-next-line import/no-restricted-paths
import { firestore } from "@/lib/firestore";
import { withErrorHandling, type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * The raw `clients` document, for the two fields ClientData does not carry.
 *
 * `lib/dashboard/csm-clients.ts#getClientDetail` returns the computed
 * ClientData shape, which has `ghl_location_id` but not `meta_ad_account_id`.
 * The reference implementation read the document inline in each action
 * (legacy/csm-dashboard/actions/get-campaigns.ts and siblings); that read is
 * consolidated here so exactly one file in this story touches Firestore
 * directly, and so the id used for every downstream Meta/Drive call is the one
 * stored on the record rather than one the caller sent.
 *
 * Migration marker, same as the ones on lib/dashboard/customization.ts and
 * freshness.ts: this belongs behind a `getClientRecord` in
 * lib/dashboard/csm-clients.ts. It is not added there in this story because
 * lib/ is shared with concurrently-running work.
 */
export type ClientRecord = {
  id: string;
  name: string;
  /** The GHL sub-account this client lives in. Authoritative; never taken from a request. */
  ghlLocationId: string | null;
  /** The Meta ad account backing this client's campaigns, if one is configured. */
  metaAdAccountId: string | null;
  active: boolean;
  csmAssigned: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function getClientRecord(clientId: string): Promise<ApiResult<ClientRecord | null>> {
  return withErrorHandling(`getClientRecord(${clientId})`, async () => {
    const doc = await firestore().collection("clients").doc(clientId).get();
    if (!doc.exists) return null;

    const data = doc.data() ?? {};
    return {
      id: doc.id,
      name: asString(data.name) ?? "Unknown Client",
      ghlLocationId: asString(data.ghl_location_id),
      metaAdAccountId: asString(data.meta_ad_account_id),
      active: data.active === true,
      csmAssigned: asString(data.csm_assigned),
    };
  });
}
