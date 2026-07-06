"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Couldn't create the account. Try again.");
      return;
    }
    router.push("/signin?registered=1");
  }

  return (
    <div className="min-h-[78vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="card card-pad">
          <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
          <p className="meta mt-1 mb-6">WRAPZONE · CITIPRINTS</p>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="name" className="field-label">Name</label>
              <input
                id="name"
                className="input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
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
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-faint mt-1">At least 8 characters.</p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <button disabled={loading} className="btn btn-primary btn-block">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-sm text-muted mt-5 text-center">
          Already have an account?{" "}
          <Link href="/signin" className="text-accent font-medium hover:text-accent-strong">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
