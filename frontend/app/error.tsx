"use client";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: "1.6em", margin: 0 }}>Something went wrong</h1>
        <p style={{ color: "var(--muted)", fontWeight: 600 }}>Please try again.</p>
        <button
          type="button"
          onClick={reset}
          style={{ minHeight: 56, padding: "0 24px", borderRadius: 999, border: "none", background: "var(--green)", color: "#fff", fontWeight: 800 }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
