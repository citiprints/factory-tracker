"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Couldn't sign you in. Check your email and password.");
      setLoading(false);
      return;
    }
    // Full navigation so the server resolves the fresh session cookie.
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-[78vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="card card-pad">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="meta mt-1 mb-6">WRAPZONE · CITIPRINTS</p>

          {justRegistered && (
            <div className="alert alert-ok mb-4">Account created — sign in below.</div>
          )}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="field-label">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <button disabled={loading} className="btn btn-primary btn-block">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-sm text-muted mt-5 text-center">
          New here?{" "}
          <Link href="/signup" className="text-accent font-medium hover:text-accent-strong">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
