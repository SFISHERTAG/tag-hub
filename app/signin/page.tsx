import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SignInForm } from "./signin-form";
import { Logo } from "../logo";

export const dynamic = "force-dynamic";

/** Only allow internal paths, so `?next=` cannot become an open redirect. */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Already signed in — no reason to show the form.
  if (await getSession()) redirect(safeNext(next));

  return (
    <div className="flex min-h-screen items-center justify-center bg-chrome px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo fluid />
        </div>

        <SignInForm next={safeNext(next)} />
      </div>
    </div>
  );
}
