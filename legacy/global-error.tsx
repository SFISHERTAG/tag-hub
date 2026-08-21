"use client";

import { useEffect } from "react";

/**
 * Catches errors that escape the root layout itself — error.tsx can't help
 * there since it renders inside that same layout. Must render its own
 * <html>/<body>; there is no parent layout left to supply them.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error (root layout):", error.digest ? `[${error.digest}]` : "", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "1rem", textAlign: "center", fontFamily: "system-ui" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#666" }}>
            The error has been logged. Try again, or come back in a moment.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#999" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{ borderRadius: "0.375rem", border: "1px solid #ccc", padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
