"use client";

import { useEffect, useState, use } from "react";

type ProofFile = { url: string; name: string };

type LoadState =
	| { kind: "loading" }
	| { kind: "error"; message: string }
	| { kind: "pending"; taskTitle: string; files: ProofFile[] }
	| { kind: "responded"; taskTitle: string; status: "APPROVED" | "REJECTED" };

function isImage(name: string) {
	return /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
}

export default function ProofPage({ params }: { params: Promise<{ token: string }> }) {
	const { token } = use(params);
	const [state, setState] = useState<LoadState>({ kind: "loading" });
	const [note, setNote] = useState("");
	const [submitting, setSubmitting] = useState<"APPROVED" | "REJECTED" | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch(`/api/proofs/${token}`)
			.then(async (r) => {
				const data = await r.json();
				if (!r.ok) {
					setState({ kind: "error", message: data.error ?? "This link isn't valid." });
					return;
				}
				if (data.status === "PENDING") {
					setState({ kind: "pending", taskTitle: data.taskTitle, files: data.files ?? [] });
				} else {
					setState({ kind: "responded", taskTitle: data.taskTitle, status: data.status });
				}
			})
			.catch(() => setState({ kind: "error", message: "Something went wrong loading this proof." }));
	}, [token]);

	async function respond(decision: "APPROVED" | "REJECTED") {
		setError(null);
		setSubmitting(decision);
		try {
			const res = await fetch(`/api/proofs/${token}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ decision, note: note.trim() || undefined }),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(typeof data.error === "string" ? data.error : "Please try again.");
				return;
			}
			if (state.kind === "pending") setState({ kind: "responded", taskTitle: state.taskTitle, status: decision });
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setSubmitting(null);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center px-4 py-10">
			<div className="w-full max-w-lg">
				<div className="mb-6 text-center">
					<div className="font-semibold tracking-tight text-lg">Factory Tracker</div>
				</div>

				{state.kind === "loading" && (
					<div className="card card-pad text-center text-muted">Loading…</div>
				)}

				{state.kind === "error" && (
					<div className="card card-pad text-center">
						<p className="font-medium">{state.message}</p>
						<p className="text-sm text-muted mt-1">Please contact us if you think this is a mistake.</p>
					</div>
				)}

				{state.kind === "responded" && (
					<div className="card card-pad text-center">
						<p className="font-medium">
							{state.status === "APPROVED" ? "You approved this proof — thank you." : "You requested changes to this proof."}
						</p>
						<p className="text-sm text-muted mt-1">{state.taskTitle}</p>
					</div>
				)}

				{state.kind === "pending" && (
					<div className="card card-pad space-y-6">
						<div>
							<h1 className="font-semibold text-lg">{state.taskTitle}</h1>
							<p className="text-sm text-muted mt-1">Please review the design proof below and approve it, or request changes.</p>
						</div>

						<div className="space-y-3">
							{state.files.map((f, i) => (
								<div key={i} className="border border-line rounded-lg p-2">
									{isImage(f.name) ? (
										<img src={f.url} alt={f.name} className="w-full h-auto rounded" />
									) : (
										<a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
											{f.name}
										</a>
									)}
									<p className="text-xs text-muted mt-1 truncate">{f.name}</p>
								</div>
							))}
						</div>

						<div>
							<label className="field-label">Notes (optional — especially if requesting changes)</label>
							<textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
						</div>

						{error && <p className="text-sm text-danger">{error}</p>}

						<div className="flex gap-2">
							<button
								type="button"
								className="btn btn-primary btn-block"
								disabled={!!submitting}
								onClick={() => respond("APPROVED")}
							>
								{submitting === "APPROVED" ? "Approving…" : "Approve"}
							</button>
							<button
								type="button"
								className="btn btn-outline btn-block"
								disabled={!!submitting}
								onClick={() => respond("REJECTED")}
							>
								{submitting === "REJECTED" ? "Sending…" : "Request changes"}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
