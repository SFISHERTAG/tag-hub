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
        // The visible "Six-digit code" label was removed for the sparser
        // layout, so the accessible name has to be carried here instead.
        aria-label="Six-digit code"
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
   * A sign-in link from the email fills the boxes and signs the user in.
   *
   * The credentials arrive in the URL fragment (`#e=...&c=...`) rather than the
   * query string, so they are never sent to the server: not in request logs,
   * not in a `Referer`. Reading them here, in the browser, is the only way they
   * can be used at all.
   *
   * Nothing is verified in this effect. It populates the same state that typing
   * would, and the auto-submit effect below does the rest, so the link path and
   * the typing path converge immediately rather than being two flows.
   *
   * The fragment is stripped afterwards with `replaceState`, so the code is not
   * left sitting in the address bar or in a shareable URL. Doing it here rather
   * than after verification means a failed code is cleared too.
   *
   * `react-hooks/set-state-in-effect` is suppressed rather than worked around,
   * and the reason is a hard constraint rather than convenience. A fragment is
   * readable only in the browser, so the server cannot render the code step,
   * and moving this into a `useState` initialiser would make the first client
   * render disagree with the server's HTML: a hydration mismatch. Rendering the
   * email step and then switching is the only correct order, and that is a
   * post-mount state update by definition. The cascade the rule guards against
   * cannot happen here, since the effect has an empty dependency list and
   * clears the fragment it reads.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    function consumeLink() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;

      const params = new URLSearchParams(hash);
      const linkedEmail = params.get("e");
      const linkedCode = params
        .get("c")
        ?.replace(/\D/g, "")
        .slice(0, CODE_LENGTH);

      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );

      if (!linkedEmail || !linkedCode) return;

      setEmail(linkedEmail);
      setCode(linkedCode);
      setStep("code");
    }

    consumeLink();

    /**
     * Also on `hashchange`, which is not belt and braces.
     *
     * Adding a fragment to the URL the browser is already showing is a
     * same-document navigation: no remount, so a mount-only effect never runs.
     * That is exactly what happens to someone who requests a code, leaves the
     * tab open on this page, then clicks the link in their mail client and has
     * it reuse that tab. Found by doing it.
     */
    window.addEventListener("hashchange", consumeLink);
    return () => window.removeEventListener("hashchange", consumeLink);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  /**
   * The submit button, kept and made almost invisible rather than deleted.
   *
   * Deleting it would cost more than it looks. A real `<button type="submit">`
   * is what screen readers announce as the way out of the form, what a keyboard
   * user reaches by tab, and what native implicit submission needs. Opacity
   * hides it from sight without hiding it from any of that: assistive
   * technology ignores `opacity`, so the control is still fully announced.
   *
   * It surfaces on hover or keyboard focus, so it is discoverable the moment
   * anyone looks for it, and otherwise the only instruction on the page is the
   * cursor sitting in a field.
   */
  const ghostButton =
    "w-full rounded-md px-4 py-2 text-xs font-medium text-chrome-ink-2 " +
    "opacity-0 transition-opacity duration-200 hover:opacity-100 " +
    "focus-visible:opacity-100 focus-visible:outline-none " +
    "focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-0";

  /**
   * The only sign that Enter did anything, now that no button changes its
   * label. A form that looks inert after a keypress is the exact complaint that
   * started this work, so silence is not an option even in a sparse design.
   */
  const activity = pending ? (
    <div className="h-px w-full animate-pulse bg-accent" aria-hidden="true" />
  ) : (
    <div className="h-px w-full" aria-hidden="true" />
  );

  if (step === "email") {
    return (
      <form onSubmit={requestCode} className="space-y-3" aria-busy={pending}>
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

        {activity}

        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}

        {/* Announced, not shown: replaces the button label that used to say so. */}
        <p role="status" className="sr-only">
          {pending ? "Sending your sign-in code" : ""}
        </p>

        <button type="submit" disabled={pending} className={ghostButton}>
          Send code
        </button>
      </form>
    );
  }

  return (
    <form
      ref={codeFormRef}
      onSubmit={submitCode}
      className="space-y-3"
      aria-busy={pending}
    >
      <CodeBoxes value={code} onChange={setCode} onKeyDown={submitOnEnter} />

      {activity}

      {notice && (
        <p className="text-center text-xs text-chrome-ink-2">{notice}</p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}

      <p role="status" className="sr-only">
        {pending ? "Checking your code" : `Enter the code sent to ${email}`}
      </p>

      <button
        type="submit"
        disabled={pending || code.length !== CODE_LENGTH}
        className={ghostButton}
      >
        Sign in
      </button>

      {/*
        Kept deliberately, against the instinct to strip everything. A code
        expires in ten minutes and resending is rate limited, so without these
        an expired code is a dead end with no visible way out. They are the two
        smallest things on the page and they only surface on hover.
      */}
      <div className="flex justify-center gap-5 text-[11px]">
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setCode("");
            autoSubmitted.current = null;
            setError(null);
            setNotice(null);
          }}
          className="text-chrome-ink-2/40 underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          Use a different email
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => requestCode()}
          className="text-chrome-ink-2/40 underline-offset-2 transition-colors hover:text-white hover:underline disabled:opacity-60"
        >
          Resend code
        </button>
      </div>
    </form>
  );
}
