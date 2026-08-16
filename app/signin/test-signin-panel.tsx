"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/auth/roles";

/**
 * Test signin — dev only, bypasses OTP.
 * Only renders if TEST_AUTH_ENABLED=true.
 */

const TEST_ROLES: { label: string; value: Role }[] = [
  { label: "CSM / Team", value: "tag_csm" },
  { label: "Exec", value: "tag_exec" },
  { label: "Setter", value: "tag_setter" },
  { label: "Setter Manager", value: "tag_setter_manager" },
  { label: "Client Owner", value: "client_owner" },
  { label: "Client Manager", value: "client_manager" },
  { label: "Client Setter", value: "client_setter" },
  { label: "Client Setter Manager", value: "client_setter_manager" },
];

export function TestSignInPanel({ next }: { next: string }) {
  const router = useRouter();
  const [testEmail, setTestEmail] = useState("test@taxadvisorygrowth.net");
  const [testRole, setTestRole] = useState<Role>("tag_csm");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function testSignIn(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/test-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, role: testRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data?.error ?? "Test signin failed");
        setPending(false);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError("Network error");
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-chrome-line bg-chrome-hover px-3 py-2 text-sm text-white outline-none focus:border-accent";

  return (
    <div className="mt-8 border-t border-chrome-line pt-8">
      <p className="text-center text-xs text-chrome-ink-3 mb-4 font-medium">
        DEV TEST MODE
      </p>

      <form onSubmit={testSignIn} className="space-y-3">
        <div>
          <label htmlFor="test-email" className="block text-xs text-chrome-ink-2 mb-1">
            Email
          </label>
          <input
            id="test-email"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="test-role" className="block text-xs text-chrome-ink-2 mb-1">
            Role
          </label>
          <select
            id="test-role"
            value={testRole}
            onChange={(e) => setTestRole(e.target.value as Role)}
            className={`${inputClass} cursor-pointer`}
          >
            {TEST_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="text-center text-xs text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-chrome-hover border border-chrome-line px-4 py-2 text-xs font-semibold text-chrome-ink-2 hover:bg-accent hover:border-accent hover:text-accent-ink disabled:opacity-60 transition-colors"
        >
          {pending ? "Signing in…" : "Test Sign In"}
        </button>
      </form>
    </div>
  );
}
