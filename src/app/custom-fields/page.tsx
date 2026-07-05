"use client";
import React, { useEffect, useState } from "react";

type CustomField = {
	id: string;
	key: string;
	label: string;
	type: string;
	required: boolean;
	order: number;
	createdAt: Date;
};

// Loading skeleton component
function CustomFieldsSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header skeleton */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div className="animate-pulse">
					<div className="h-8 bg-gray-200 rounded w-48"></div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="animate-pulse">
						<div className="h-10 bg-gray-200 rounded w-32"></div>
					</div>
				</div>
			</div>

			{/* Fields skeleton */}
			<div className="space-y-4">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="border border-gray-200 rounded-lg p-4">
						<div className="animate-pulse">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
								<div className="flex flex-wrap items-center gap-2 min-w-0">
									<div className="h-4 bg-gray-200 rounded w-32 sm:w-48 max-w-full"></div>
									<div className="h-4 bg-gray-200 rounded w-16 flex-shrink-0"></div>
									<div className="h-4 bg-gray-200 rounded w-20 flex-shrink-0"></div>
								</div>
								<div className="flex flex-col items-end gap-1 flex-shrink-0">
									<div className="h-4 bg-gray-200 rounded w-20"></div>
									<div className="h-4 bg-gray-200 rounded w-16"></div>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export default function CustomFieldsPage() {
	const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
	const [fields, setFields] = useState<CustomField[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editLabel, setEditLabel] = useState("");
	const [editType, setEditType] = useState("TEXT");
	const [editRequired, setEditRequired] = useState(false);
	const [editOrder, setEditOrder] = useState(0);
	const [keyv, setKeyv] = useState("");
	const [label, setLabel] = useState("");
	const [type, setType] = useState("TEXT");
	const [required, setRequired] = useState(false);
	const [order, setOrder] = useState(0);

	// Check authentication
	useEffect(() => {
		const checkAuth = async () => {
			try {
				const res = await fetch("/api/auth/me");
				if (res.ok) {
					const userData = await res.json();
					setCurrentUser(userData);
				} else {
					// Redirect to homepage if not authenticated
					window.location.href = "/";
					return;
				}
			} catch (error) {
				console.error('Auth check error:', error);
				window.location.href = "/";
				return;
			}
		};

		checkAuth();
	}, []);

	async function load() {
		setLoading(true);
		try {
			const res = await fetch("/api/custom-fields");
			if (!res.ok) return;
			const json = await res.json();
			setFields(json.fields ?? []);
		} catch (error) {
			console.error("Failed to load custom fields:", error);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		const res = await fetch("/api/custom-fields", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ key: keyv, label, type, required, order })
		});
		if (res.ok) {
			setKeyv(""); setLabel(""); setType("TEXT"); setRequired(false); setOrder(0);
			load();
		}
	}



	return (
		<div className="grid gap-6 sm:grid-cols-2">
			<section>
				<h1 className="text-xl font-semibold mb-3">Add custom field</h1>
				<form onSubmit={onCreate} className="space-y-3">
					<input className="w-full border rounded px-3 py-2" placeholder="Key (e.g., sku)" value={keyv} onChange={e => setKeyv(e.target.value)} required />
					<input className="w-full border rounded px-3 py-2" placeholder="Label" value={label} onChange={e => setLabel(e.target.value)} required />
					<select className="w-full border rounded px-3 py-2" value={type} onChange={e => setType(e.target.value)}>
						<option>TEXT</option>
						<option>NUMBER</option>
						<option>DATE</option>
						<option>BOOLEAN</option>
					</select>
					<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> Required</label>
					<input className="w-full border rounded px-3 py-2" type="number" value={order} onChange={e => setOrder(parseInt(e.target.value || "0"))} />
					<button className="rounded bg-gray-900 px-3 py-2 text-white">Create</button>
				</form>
			</section>
			<section>
				<h2 className="text-lg font-medium mb-2">Fields</h2>
				{loading ? (
					<CustomFieldsSkeleton />
				) : fields.length === 0 ? (
					<p className="text-center text-gray-500">No custom fields yet. Create one!</p>
				) : (
					<ul className="space-y-2">
						{fields.map(f => (
							<li key={f.id} className="border rounded p-3">
								{editingId === f.id ? (
									<form
										onSubmit={async e => {
											e.preventDefault();
											await fetch(`/api/custom-fields/${f.id}`, {
												method: "PATCH",
												headers: { "Content-Type": "application/json" },
												body: JSON.stringify({ label: editLabel, type: editType, required: editRequired, order: editOrder })
											});
											setEditingId(null);
											load();
										}}
										className="grid gap-2 sm:grid-cols-2"
									>
										<div className="sm:col-span-2">
											<input className="w-full border rounded px-3 py-2" value={editLabel} onChange={e => setEditLabel(e.target.value)} required />
										</div>
										<select className="w-full border rounded px-3 py-2" value={editType} onChange={e => setEditType(e.target.value)}>
											<option>TEXT</option>
											<option>NUMBER</option>
											<option>DATE</option>
											<option>BOOLEAN</option>
										</select>
										<label className="flex items-center gap-2 text-sm">
											<input type="checkbox" checked={editRequired} onChange={e => setEditRequired(e.target.checked)} /> Required
										</label>
										<input className="w-full border rounded px-3 py-2" type="number" value={editOrder} onChange={e => setEditOrder(parseInt(e.target.value || "0"))} />
										<div className="sm:col-span-2 flex gap-2">
											<button className="btn rounded px-3 py-2" type="submit">Save</button>
											<button className="rounded border px-3 py-2" type="button" onClick={() => setEditingId(null)}>Cancel</button>
										</div>
									</form>
								) : (
									<div className="flex items-center justify-between">
										<div>
											<div className="font-medium">{f.label} <span className="text-xs text-gray-500">({f.key})</span></div>
											<div className="text-sm text-gray-600">Type: {f.type} • Required: {f.required ? "Yes" : "No"} • Order: {f.order}</div>
										</div>
										<div className="flex gap-2">
											<button className="rounded border px-3 py-2" onClick={() => {
												setEditingId(f.id);
												setEditLabel(f.label);
												setEditType(f.type);
												setEditRequired(f.required);
												setEditOrder(f.order);
											}}>Edit</button>
											<button className="rounded border px-3 py-2" onClick={async () => {
												if (confirm("Delete this field?")) {
													await fetch(`/api/custom-fields/${f.id}`, { method: "DELETE" });
													load();
												}
											}}>Delete</button>
										</div>
									</div>
								)}
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
