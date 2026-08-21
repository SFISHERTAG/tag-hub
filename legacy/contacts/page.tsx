import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Old unscoped path. Routes to the location-scoped equivalent rather than 404ing. */
export default async function ContactsRedirect() {
  const session = await getSession();
  if (!session) redirect("/signin");

  if (session.locations.length === 1) {
    redirect(`/l/${session.locations[0]}/contacts`);
  }

  redirect("/portfolio");
}
