import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, textAlign: "center" }}>
      <div>
        <h1 style={{ fontSize: "2em", margin: 0 }}>Page not found</h1>
        <p style={{ color: "var(--muted)", fontWeight: 600 }}>That page does not exist.</p>
        <Link href="/dashboard" style={{ fontWeight: 800, color: "var(--green)", textDecoration: "underline" }}>
          Go home
        </Link>
      </div>
    </main>
  );
}
