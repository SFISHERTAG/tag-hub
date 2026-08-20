"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { clientAuth } from "@/lib/auth/client";

type Step = "email" | "code";

/**
 * Enter should do exactly what pressing Sign in does.
 *
 * Implicit form submission is meant to give this for free, but it does not
 * fire reliably for these single-field steps, and an email box that swallows
 * Enter reads as a broken page. `requestSubmit` is used rather than calling
 * the handler directly because it is the button's own path: constraint
 * validation runs, then a real submit event is dispatched.
 *
 * `isComposing` guards an IME candidate window, where Enter is choosing a
 * character rather than finishing the form.
 */
function submitOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

const CODE_LENGTH = 6;

/**
 * Six boxes, one input.
 *
 * The boxes are presentation only. A single real `<input>` sits transparently
 * over them and holds the whole code, because the two things that matter here
 * both want one field: iOS and macOS hand an autofilled code to a single
 * `one-time-code` input rather than distributing it across six, and a pasted
 * "123-456" has to land somewhere it can be cleaned up as a whole. Six real
 * inputs would look identical and break both.
 */
function CodeBoxes({
  value,
  onChange,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Which box the next digit lands in. Clamped so a full code keeps the last
  // box lit rather than pointing past the end.
  const active = Math.min(value.length, CODE_LENGTH - 1);

  /**
   * The real caret is hidden, so leaving it mid-string would send typing
   * somewhere the boxes cannot show. Every interaction pins it to the end.
   */
  function caretToEnd() {
    const el = ref.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }

  return (
    <div className="relative">
      <div className="flex justify-between gap-2" aria-hidden="true">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const lit = focused && i === active;
          return (
            <div
              key={i}
              className={`flex h-12 flex-1 items-center justify-center rounded-md border bg-chrome-hover font-mono text-lg text-white transition-colors ${
                lit ? "border-accent" : "border-chrome-line"
              }`}
            >
              {value[i] ?? (lit ? <span className="h-5 w-px animate-pulse bg-accent" /> : null)}
            </div>
          );
        })}
      </div>

      <input
        ref={ref}
        id="code"
        name="code"
        // `text` with a numeric mode, so a leading zero is never dropped.
        type="text"
        inputMode="numeric"
        pattern="[0-9]{6}"
        required
        autoFocus
        // The pairing iOS and macOS look for before offering the code from
        // Mail in the QuickType bar. Autocorrect and spellcheck are off so
        // nothing rewrites the digits on the way in.
        autoComplete="one-time-code"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        // Deliberately no `maxLength`: it truncates before this runs, so a
        // pasted "123-456" would arrive as "123-45" and clean up to five
        // digits. Strip first, then take six.
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        onKeyDown={onKeyDown}
        onFocus={() => {
          setFocused(true);
          caretToEnd();
        }}
        onBlur={() => setFocused(false)}
        onSelect={caretToEnd}
        className={
          // Covers the boxes so a click anywhere focuses it, and renders
          // nothing of its own. Transparent text rather than `opacity-0` or
          // `display:none`, both of which risk the field being passed over as
          // an autofill target. The `-webkit-autofill` pair stops Chrome
          // painting its autofill background over the boxes.
          "absolute inset-0 h-full w-full cursor-default bg-transparent text-center " +
          "font-mono text-lg text-transparent caret-transparent outline-none " +
          "selection:bg-transparent " +
          "[&:-webkit-autofill]:[-webkit-text-fill-color:transparent] " +
          "[&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]"
        }
      />
    </div>
  );
}

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const codeFormRef = useRef<HTMLFormElement>(null);

  /**
   * The code that was last sent for verification without the user asking.
   * Without it the effect below would resubmit the same rejected code every
   * time `pending` settled, and a wrong code would spin forever.
   */
  const autoSubmitted = useRef<string | null>(null);

  /**
   * A full code submits itself.
   *
   * An autofilled code is the whole point: the digits arrive from the QuickType
   * bar in one shot, and asking for a button press after that is a step with
   * nothing left to decide. Typing the sixth digit reads the same way.
   *
   * `requestSubmit` again rather than calling `submitCode`, so this and the
   * button take an identical path. A code that was already tried and rejected
   * is not retried on its own; the button stays available for that.
   */
  useEffect(() => {
    if (step !== "code" || pending) return;
    if (code.length !== CODE_LENGTH) return;
    if (autoSubmitted.current === code) return;

    autoSubmitted.current = code;
    codeFormRef.current?.requestSubmit();
  }, [step, code, pending]);

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
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          onKeyDown={submitOnEnter}
          placeholder="Email"
          // The placeholder is the only remaining label, so the accessible name
          // has to come from here — a placeholder alone is not one, and it
          // disappears the moment anything is typed.
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${inputClass} text-center placeholder:text-chrome-ink-2`}
        />

        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    );
  }

  return (
    <form ref={codeFormRef} onSubmit={submitCode} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="code"
          className="block text-center text-sm text-chrome-ink-2"
        >
          Six-digit code
        </label>
        <p className="text-center text-xs text-ink-3">
          Sent to {email} · expires in 10 minutes
        </p>
        <CodeBoxes value={code} onChange={setCode} onKeyDown={submitOnEnter} />
      </div>

      {notice && (
        <p className="text-center text-xs text-chrome-ink-2">{notice}</p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
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

      <div className="flex justify-center gap-5 text-xs">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            autoSubmitted.current = null;
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
