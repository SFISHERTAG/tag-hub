"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { updateOpportunityStage, closeOpportunity } from "@/lib/ghl/opportunities";

export async function moveOpportunityStagAction(
  locationId: string,
  opportunityId: string,
  pipelineStageId: string,
): Promise<{ ok: true; lastStageChangeAt: string } | { ok: false; error: string }> {
  if (!(await getSession())) {
    return { ok: false, error: "Not signed in." };
  }

  try {
    const result = await updateOpportunityStage(locationId, opportunityId, pipelineStageId);
    revalidatePath("/");
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function closeOpportunityAction(
  locationId: string,
  opportunityId: string,
  status: "won" | "lost",
  monetaryValue: number,
): Promise<{ ok: true; status: string; monetaryValue: number } | { ok: false; error: string }> {
  if (!(await getSession())) {
    return { ok: false, error: "Not signed in." };
  }

  try {
    const result = await closeOpportunity(locationId, opportunityId, status, monetaryValue);
    revalidatePath("/");
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
