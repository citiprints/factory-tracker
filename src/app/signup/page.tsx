"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
			body: JSON.stringify({ email, password, name })
		});
		setLoading(false);
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Failed to sign up");
			return;
		}
		router.push("/signin");
	}

	return (
		<div className="max-w-sm mx-auto">
			<h1 className="text-xl font-semibold mb-4">Sign up</h1>
			<form onSubmit={onSubmit} className="space-y-3">
				<input className="w-full border rounded px-3 py-2" type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
				<input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
				<input className="w-full border rounded px-3 py-2" type="password" placeholder="Password (min 8)" value={password} onChange={e => setPassword(e.target.value)} required />
				{error && <p className="text-sm text-red-600">{error}</p>}
				<button disabled={loading} className="w-full rounded bg-gray-900 px-3 py-2 text-white">{loading ? "Signing up..." : "Sign up"}</button>
			</form>
		</div>
	);
}
