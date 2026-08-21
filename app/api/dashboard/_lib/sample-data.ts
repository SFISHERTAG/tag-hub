import "server-only";
import { MOCK_METRICS_WIDGET_IDS } from "@/lib/dashboard/widget-definitions";
import type { ClientData } from "@/lib/dashboard/csm-clients-types";
import type { ClientHealth } from "@/lib/dashboard/health-scoring";

/**
 * Sample-data disclosure, carried on the wire.
 *
 * `getMockMetrics` (lib/dashboard/mock-metrics.ts) returns the same fixed
 * `{ roas: 95, spend: 102, leads: 88, sla: 97 }` for every client id, so every
 * health score, status and escalation bucket derived from it is identical for
 * every client and is not a reading. The reference implementation guarded this
 * with a banner component (legacy/dashboard/widgets/sample-data-banner.tsx);
 * a banner cannot cross an HTTP boundary, so the disclosure travels in the
 * payload instead and the screens layer renders it.
 *
 * Flip HEALTH_SCORES_ARE_SAMPLE in the same commit that gives
 * lib/dashboard/mock-metrics.ts a real data path. Nothing else needs editing.
 */
export const HEALTH_SCORES_ARE_SAMPLE = true;
export const KPI_METRICS_ARE_SAMPLE = true;

export type SampleDataDisclosure = {
  /** Render a visible notice whenever this is true. Never hide it behind a tooltip. */
  isSample: boolean;
  /** Response fields the notice applies to, dotted from the payload root. */
  fields: readonly string[];
  /** Where the fabrication comes from, so the notice can name it. */
  source: string;
  /** Human-readable text, safe to render verbatim. */
  notice: string;
};

const HEALTH_NOTICE =
  "Sample data. Health scores, statuses and escalation buckets are computed from " +
  "fixed placeholder metrics that are identical for every client. They are not a " +
  "reading and must not be used to make a client decision. Live scores ship with " +
  "the Meta integration.";

const KPI_NOTICE =
  "Sample data. Spend, ROAS, cost per lead and booking rate below are placeholders " +
  "shaped like the real thing. Live numbers ship with the Meta integration.";

export function healthDisclosure(fields: readonly string[]): SampleDataDisclosure {
  return {
    isSample: HEALTH_SCORES_ARE_SAMPLE,
    fields,
    source: "lib/dashboard/mock-metrics.ts#getMockMetrics",
    notice: HEALTH_NOTICE,
  };
}

export function kpiDisclosure(fields: readonly string[]): SampleDataDisclosure {
  return {
    isSample: KPI_METRICS_ARE_SAMPLE,
    fields,
    source: "lib/dashboard/mock-metrics.ts#MOCK_METRICS",
    notice: KPI_NOTICE,
  };
}

/** A ClientHealth with the per-record sample marker the payload contract requires. */
export type ClientHealthDto = ClientHealth & { is_sample: boolean };

/**
 * A ClientData whose health block is individually marked.
 *
 * The envelope-level disclosure covers the screen; this covers a single health
 * badge that gets lifted out of its list into a card, a table cell or a modal
 * and separated from the banner that qualified it.
 */
export type ClientDataDto = Omit<ClientData, "health"> & {
  health: ClientHealthDto;
  metrics_are_sample: boolean;
};

export function toClientDto(client: ClientData): ClientDataDto {
  return {
    ...client,
    health: { ...client.health, is_sample: HEALTH_SCORES_ARE_SAMPLE },
    metrics_are_sample: HEALTH_SCORES_ARE_SAMPLE,
  };
}

export function toClientDtos(clients: readonly ClientData[]): ClientDataDto[] {
  return clients.map(toClientDto);
}

/** Widget ids whose data is wholly or partly fabricated — for the picker and the shell. */
export const SAMPLE_DATA_WIDGET_IDS: readonly string[] = MOCK_METRICS_WIDGET_IDS;
