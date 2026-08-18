import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * `/` has no tenant of its own to show — it routes by role instead. A single
 * location is unambiguous, so skip straight to it; more than one needs a
 * picker, and /portfolio is that picker.
 */
export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  if (session.locations.length === 1) {
    redirect(`/l/${session.locations[0]}/pipeline`);
  }

  redirect("/portfolio");
}
