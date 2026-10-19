"use client";

// global-error renders its own <html> and does not include global CSS,
// so it is styled inline with the Forma design tokens.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0d0b",
          color: "#f2f4ef",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "16px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "28rem" }}>
          <p
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#ff5a4d",
              fontWeight: 600,
            }}
          >
            Forma
          </p>
          <h1 style={{ fontSize: "1.25rem", margin: "0.5rem 0" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#97a093", margin: 0 }}>
            The app hit an unexpected error. Try again, or reload the page.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.7rem", color: "#97a09399", marginTop: "0.5rem" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#b6ff3b",
              color: "#0b0d0b",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
