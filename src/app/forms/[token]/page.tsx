"use client";

import { useEffect, useState, use } from "react";

type FormValues = {
	billingName: string;
	billingEmail: string;
	billingPhone: string;
	billingAddress: string;
	gstin: string;
	deliveryContactName: string;
	deliveryPhone: string;
	deliveryAddress: string;
	deliveryNotes: string;
};

const EMPTY_VALUES: FormValues = {
	billingName: "",
	billingEmail: "",
	billingPhone: "",
	billingAddress: "",
	gstin: "",
	deliveryContactName: "",
	deliveryPhone: "",
	deliveryAddress: "",
	deliveryNotes: "",
};

type LoadState =
	| { kind: "loading" }
	| { kind: "error"; message: string }
	| { kind: "form"; taskTitle: string }
	| { kind: "submitted"; taskTitle: string };

export default function OnboardingFormPage({ params }: { params: Promise<{ token: string }> }) {
	const { token } = use(params);
	const [state, setState] = useState<LoadState>({ kind: "loading" });
	const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch(`/api/forms/${token}`)
			.then(async (r) => {
				const data = await r.json();
				if (!r.ok) {
					setState({ kind: "error", message: data.error ?? "This link isn't valid." });
					return;
				}
				if (data.status === "SUBMITTED") {
					setState({ kind: "submitted", taskTitle: data.taskTitle });
					return;
				}
				setValues((prev) => ({ ...prev, ...Object.fromEntries(
					Object.entries(data.values ?? {}).map(([k, v]) => [k, v ?? ""])
				) }));
				setState({ kind: "form", taskTitle: data.taskTitle });
			})
			.catch(() => setState({ kind: "error", message: "Something went wrong loading this form." }));
	}, [token]);

	function update<K extends keyof FormValues>(key: K, value: string) {
		setValues((v) => ({ ...v, [key]: value }));
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			const res = await fetch(`/api/forms/${token}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(values),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(typeof data.error === "string" ? data.error : "Please check the form and try again.");
				return;
			}
			if (state.kind === "form") setState({ kind: "submitted", taskTitle: state.taskTitle });
		} catch {
			setError("Something went wrong submitting the form. Please try again.");
		} finally {
			setSubmitting(false);
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
						<p className="text-sm text-muted mt-1">
							Please contact us if you think this is a mistake.
						</p>
					</div>
				)}

				{state.kind === "submitted" && (
					<div className="card card-pad text-center">
						<p className="font-medium">Thank you — your details have been received.</p>
						<p className="text-sm text-muted mt-1">{state.taskTitle}</p>
					</div>
				)}

				{state.kind === "form" && (
					<form onSubmit={onSubmit} className="card card-pad space-y-6">
						<div>
							<h1 className="font-semibold text-lg">{state.taskTitle}</h1>
							<p className="text-sm text-muted mt-1">
								Please fill in your billing and delivery details below.
							</p>
						</div>

						<div className="space-y-3">
							<h2 className="text-sm font-medium">Billing details</h2>
							<div>
								<label className="field-label">Billing name *</label>
								<input className="input" required value={values.billingName} onChange={(e) => update("billingName", e.target.value)} />
							</div>
							<div>
								<label className="field-label">Email</label>
								<input className="input" type="email" value={values.billingEmail} onChange={(e) => update("billingEmail", e.target.value)} />
							</div>
							<div>
								<label className="field-label">Phone</label>
								<input className="input" value={values.billingPhone} onChange={(e) => update("billingPhone", e.target.value)} />
							</div>
							<div>
								<label className="field-label">Billing address *</label>
								<textarea className="input" required rows={2} value={values.billingAddress} onChange={(e) => update("billingAddress", e.target.value)} />
							</div>
							<div>
								<label className="field-label">GSTIN / Tax ID</label>
								<input className="input" value={values.gstin} onChange={(e) => update("gstin", e.target.value)} />
							</div>
						</div>

						<div className="space-y-3">
							<h2 className="text-sm font-medium">Delivery details</h2>
							<div>
								<label className="field-label">Contact name</label>
								<input className="input" value={values.deliveryContactName} onChange={(e) => update("deliveryContactName", e.target.value)} />
							</div>
							<div>
								<label className="field-label">Delivery phone</label>
								<input className="input" value={values.deliveryPhone} onChange={(e) => update("deliveryPhone", e.target.value)} />
							</div>
							<div>
								<label className="field-label">Delivery address *</label>
								<textarea className="input" required rows={2} value={values.deliveryAddress} onChange={(e) => update("deliveryAddress", e.target.value)} />
							</div>
							<div>
								<label className="field-label">Delivery notes</label>
								<textarea className="input" rows={2} value={values.deliveryNotes} onChange={(e) => update("deliveryNotes", e.target.value)} />
							</div>
						</div>

						{error && <p className="text-sm text-danger">{error}</p>}

						<button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
							{submitting ? "Submitting…" : "Submit details"}
						</button>
					</form>
				)}
			</div>
		</div>
	);
}
