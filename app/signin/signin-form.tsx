"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { clientAuth } from "@/lib/auth/client";

type Step = "email" | "code";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "Could not send a code.");
        setPending(false);
        return;
      }

      if (data?.cooldown) {
        setNotice(
          `A code was already sent. You can request another in ${data.retryAfterSeconds}s.`,
        );
      }

      setStep("code");
    } catch {
      setError("Network problem. Try again.");
    }
    setPending(false);
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "That code is not right.");
        setPending(false);
        return;
      }

      const credential = await signInWithCustomToken(
        clientAuth(),
        data.customToken,
      );
      const idToken = await credential.user.getIdToken();

      const session = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!session.ok) {
        setError("Could not start a session. Try again.");
        setPending(false);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError("Could not complete sign-in. Try again.");
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-chrome-line bg-chrome-hover px-3 py-2 text-sm text-white outline-none focus:border-accent";

  if (step === "email") {
    return (
      <form onSubmit={requestCode} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm text-chrome-ink-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send code"}
        </button>

        <p className="text-xs text-ink-3">
          Accounts are created by TAG. There is no self-signup.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="code" className="block text-sm text-chrome-ink-2">
          Six-digit code
        </label>
        <p className="text-xs text-ink-3">
          Sent to {email} · expires in 10 minutes
        </p>
        <input
          id="code"
          // `text` with a numeric mode, so a leading zero is never dropped.
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
        />
      </div>

      {notice && <p className="text-xs text-chrome-ink-2">{notice}</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || code.length !== 6}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Sign in"}
      </button>

      <div className="flex justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
            setNotice(null);
          }}
          className="text-chrome-ink-2 underline-offset-2 hover:text-white hover:underline"
        >
          Use a different email
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => requestCode()}
          className="text-chrome-ink-2 underline-offset-2 hover:text-white hover:underline disabled:opacity-60"
        >
          Resend code
        </button>
      </div>
    </form>
  );
}
