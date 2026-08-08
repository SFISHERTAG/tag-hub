import "server-only";
import { ghl } from "./client";

export type Stage = {
  id: string;
  name: string;
  position: number;
};

export type Pipeline = {
  id: string;
  name: string;
  stages: Stage[];
};

export async function getPipelines(locationId: string): Promise<Pipeline[]> {
  const data = await ghl<{ pipelines?: Pipeline[] }>(
    locationId,
    "/opportunities/pipelines",
    {
      searchParams: { locationId },
      revalidate: 300, // pipelines change rarely
    },
  );

  return (data.pipelines ?? []).map((pipeline) => ({
    ...pipeline,
    stages: [...(pipeline.stages ?? [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    ),
  }));
}
