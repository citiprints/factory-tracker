"use client";
import React, { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";

type CustomField = {
	id: string;
	key: string;
	label: string;
	type: string;
	required: boolean;
	order: number;
	createdAt: Date;
};

function CustomFieldsSkeleton() {
	return (
		<div className="space-y-4">
			{[1, 2, 3].map((i) => (
				<div key={i} className="border rounded-lg p-4 animate-pulse">
					<div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
					<div className="h-3 bg-gray-200 rounded w-2/3"></div>
				</div>
			))}
		</div>
	);
}

export default function CustomFieldsPage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	const [fields, setFields] = useState<CustomField[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
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
	const [creating, setCreating] = useState(false);
	const [saving, setSaving] = useState(false);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/custom-fields");
			if (!res.ok) {
				setError("Failed to load custom fields");
				return;
			}
			const json = await res.json();
			setFields(json.fields ?? []);
		} catch {
			setError("Failed to load custom fields. Check your connection and try again.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setCreating(true);
		try {
			const res = await fetch("/api/custom-fields", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: keyv, label, type, required, order })
			});
			if (res.ok) {
				setKeyv(""); setLabel(""); setType("TEXT"); setRequired(false); setOrder(0);
				load();
			} else {
				const json = await res.json().catch(() => ({}));
				setError(json.error || "Failed to create field");
			}
		} finally {
			setCreating(false);
		}
	}

	async function onSaveEdit(e: React.FormEvent, id: string) {
		e.preventDefault();
		setSaving(true);
		setRowError(null);
		try {
			const res = await fetch(`/api/custom-fields/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ label: editLabel, type: editType, required: editRequired, order: editOrder })
			});
			if (res.ok) {
				setEditingId(null);
				load();
			} else {
				const json = await res.json().catch(() => ({}));
				setRowError({ id, message: json.error || "Failed to save changes" });
			}
		} finally {
			setSaving(false);
		}
	}

	async function onDelete(id: string) {
		if (!confirm("Delete this field? Tasks using it will keep their existing values, but the field won't be editable anymore.")) return;
		setRowError(null);
		const res = await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
		if (res.ok) {
			load();
		} else {
			const json = await res.json().catch(() => ({}));
			setRowError({ id, message: json.error || "Failed to delete field" });
		}
	}

	return (
		<div className={isAdmin ? "grid gap-6 sm:grid-cols-2" : ""}>
			{isAdmin && (
				<section>
					<h1 className="text-xl font-semibold mb-3">Add custom field</h1>
					<form onSubmit={onCreate} className="space-y-3">
						<input className="w-full border rounded px-3 py-2 bg-background" placeholder="Key (e.g., sku)" value={keyv} onChange={e => setKeyv(e.target.value)} required />
						<input className="w-full border rounded px-3 py-2 bg-background" placeholder="Label" value={label} onChange={e => setLabel(e.target.value)} required />
						<select className="w-full border rounded px-3 py-2 bg-background" value={type} onChange={e => setType(e.target.value)}>
							<option>TEXT</option>
							<option>NUMBER</option>
							<option>DATE</option>
							<option>BOOLEAN</option>
						</select>
						<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} /> Required</label>
						<input className="w-full border rounded px-3 py-2 bg-background" type="number" value={order} onChange={e => setOrder(parseInt(e.target.value || "0"))} />
						<button disabled={creating} className="rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50">
							{creating ? "Creating..." : "Create"}
						</button>
					</form>
					{error && (
						<div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
							{error}
						</div>
					)}
				</section>
			)}
			<section>
				<div className="flex items-center justify-between mb-2">
					<h2 className="text-lg font-medium">Fields</h2>
					{!isAdmin && <span className="text-xs text-gray-500">View only — ask an admin to make changes</span>}
				</div>
				{loading ? (
					<CustomFieldsSkeleton />
				) : error && !isAdmin ? (
					<div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
				) : fields.length === 0 ? (
					<p className="text-center text-gray-500 text-sm">No custom fields yet.{isAdmin ? " Create one!" : ""}</p>
				) : (
					<ul className="space-y-2">
						{fields.map(f => (
							<li key={f.id} className="border rounded p-3">
								{editingId === f.id ? (
									<form onSubmit={(e) => onSaveEdit(e, f.id)} className="grid gap-2 sm:grid-cols-2">
										<div className="sm:col-span-2">
											<input className="w-full border rounded px-3 py-2 bg-background" value={editLabel} onChange={e => setEditLabel(e.target.value)} required />
										</div>
										<select className="w-full border rounded px-3 py-2 bg-background" value={editType} onChange={e => setEditType(e.target.value)}>
											<option>TEXT</option>
											<option>NUMBER</option>
											<option>DATE</option>
											<option>BOOLEAN</option>
										</select>
										<label className="flex items-center gap-2 text-sm">
											<input type="checkbox" checked={editRequired} onChange={e => setEditRequired(e.target.checked)} /> Required
										</label>
										<input className="w-full border rounded px-3 py-2 bg-background" type="number" value={editOrder} onChange={e => setEditOrder(parseInt(e.target.value || "0"))} />
										{rowError?.id === f.id && (
											<div className="sm:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
												{rowError.message}
											</div>
										)}
										<div className="sm:col-span-2 flex gap-2">
											<button disabled={saving} className="btn rounded px-3 py-2 disabled:opacity-50" type="submit">
												{saving ? "Saving..." : "Save"}
											</button>
											<button className="rounded border px-3 py-2" type="button" onClick={() => { setEditingId(null); setRowError(null); }}>Cancel</button>
										</div>
									</form>
								) : (
									<div>
										<div className="flex items-center justify-between gap-2">
											<div className="min-w-0">
												<div className="font-medium">{f.label} <span className="text-xs text-gray-500">({f.key})</span></div>
												<div className="text-sm text-gray-600">Type: {f.type} • Required: {f.required ? "Yes" : "No"} • Order: {f.order}</div>
											</div>
											{isAdmin && (
												<div className="flex gap-2 flex-shrink-0">
													<button className="rounded border px-3 py-2 text-sm" onClick={() => {
														setEditingId(f.id);
														setRowError(null);
														setEditLabel(f.label);
														setEditType(f.type);
														setEditRequired(f.required);
														setEditOrder(f.order);
													}}>Edit</button>
													<button className="rounded border px-3 py-2 text-sm text-red-700 hover:bg-red-50" onClick={() => onDelete(f.id)}>Delete</button>
												</div>
											)}
										</div>
										{rowError?.id === f.id && (
											<div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
												{rowError.message}
											</div>
										)}
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
