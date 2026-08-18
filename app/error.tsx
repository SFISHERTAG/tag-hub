"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown inside the root layout's children — most of the app.
 *
 * The console.error call is what matters for debugging: Cloud Run ships
 * stdout/stderr to Cloud Logging automatically, so this is what turns a
 * silent white-screen into a searchable log entry with a digest id you can
 * grep for. The fallback UI is secondary — just enough that a user sees
 * something recoverable instead of a blank page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error.digest ? `[${error.digest}]` : "", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
      <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
      <p className="max-w-sm text-sm text-ink-2">
        The error has been logged. Try again, or come back in a moment.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-ink-3">Reference: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-md border border-chrome-line px-4 py-2 text-sm font-medium text-ink hover:bg-chrome-hover"
      >
        Try again
      </button>
    </div>
  );
}
