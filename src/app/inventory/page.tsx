"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";

type Material = {
	id: string;
	name: string;
	unit: string;
	currentStock: number;
	reorderPoint: number;
	notes: string | null;
	lowStock: boolean;
};

type Movement = {
	id: string;
	delta: number;
	reason: string;
	note: string | null;
	at: string;
	actor: { id: string; name: string };
};

const REASONS = ["RECEIVED", "USED", "WASTED", "ADJUSTMENT"] as const;

function MaterialRow({ material, isAdmin, onChanged }: { material: Material; isAdmin: boolean; onChanged: () => void }) {
	const [loggingOpen, setLoggingOpen] = useState(false);
	const [qty, setQty] = useState("");
	const [reason, setReason] = useState<(typeof REASONS)[number]>("RECEIVED");
	const [note, setNote] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [historyOpen, setHistoryOpen] = useState(false);
	const [movements, setMovements] = useState<Movement[] | null>(null);

	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(material.name);
	const [editUnit, setEditUnit] = useState(material.unit);
	const [editReorder, setEditReorder] = useState(String(material.reorderPoint));

	async function logMovement(e: React.FormEvent) {
		e.preventDefault();
		const n = Number(qty);
		if (!n || n <= 0) return;
		setSaving(true);
		setError(null);
		try {
			const res = await fetch(`/api/materials/${material.id}/movements`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ qty: n, reason, note: note.trim() || undefined }),
			});
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				setError(json.error || "Couldn't log that movement.");
				return;
			}
			setQty("");
			setNote("");
			setLoggingOpen(false);
			onChanged();
			if (historyOpen) loadHistory();
		} finally {
			setSaving(false);
		}
	}

	async function loadHistory() {
		const res = await fetch(`/api/materials/${material.id}/movements`);
		if (res.ok) {
			const json = await res.json();
			setMovements(json.movements ?? []);
		}
	}

	async function saveEdit(e: React.FormEvent) {
		e.preventDefault();
		const res = await fetch(`/api/materials/${material.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: editName.trim(), unit: editUnit.trim(), reorderPoint: Number(editReorder) || 0 }),
		});
		if (res.ok) {
			setEditing(false);
			onChanged();
		}
	}

	async function remove() {
		if (!confirm(`Delete "${material.name}"? This only works if it has no stock movement history.`)) return;
		const res = await fetch(`/api/materials/${material.id}`, { method: "DELETE" });
		if (res.ok) {
			onChanged();
		} else {
			const json = await res.json().catch(() => ({}));
			alert(json.error || "Couldn't delete this material.");
		}
	}

	return (
		<li className="card p-4 space-y-2">
			{editing ? (
				<form onSubmit={saveEdit} className="flex flex-wrap gap-2 items-end">
					<input className="input flex-1 min-w-[8rem]" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" required />
					<input className="input w-24" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} placeholder="Unit" required />
					<input className="input w-28" type="number" step="any" value={editReorder} onChange={(e) => setEditReorder(e.target.value)} placeholder="Reorder at" />
					<button className="btn btn-primary btn-sm" type="submit">Save</button>
					<button className="btn btn-outline btn-sm" type="button" onClick={() => setEditing(false)}>Cancel</button>
				</form>
			) : (
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<div className="font-medium">{material.name}</div>
						<div className="meta mt-0.5">
							{material.currentStock} {material.unit} in stock · reorder at {material.reorderPoint} {material.unit}
						</div>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						{material.lowStock && <span className="chip chip-danger">Low stock</span>}
						{isAdmin && (
							<>
								<button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>Edit</button>
								<button type="button" className="btn btn-danger-outline btn-sm" onClick={remove}>Delete</button>
							</>
						)}
					</div>
				</div>
			)}

			<div className="flex flex-wrap gap-2">
				<button type="button" className="btn btn-outline btn-sm" onClick={() => setLoggingOpen(v => !v)}>
					{loggingOpen ? "Cancel" : "Log movement"}
				</button>
				<button
					type="button"
					className="btn btn-outline btn-sm"
					onClick={() => { setHistoryOpen(v => !v); if (!historyOpen && !movements) loadHistory(); }}
				>
					{historyOpen ? "Hide history" : "History"}
				</button>
			</div>

			{loggingOpen && (
				<form onSubmit={logMovement} className="flex flex-wrap gap-2 items-end p-3 border border-line rounded-lg bg-wash">
					<input className="input w-28" type="number" step="any" min="0" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} required />
					<select className="input w-40" value={reason} onChange={(e) => setReason(e.target.value as any)}>
						<option value="RECEIVED">Received</option>
						<option value="USED">Used</option>
						<option value="WASTED">Wasted</option>
						<option value="ADJUSTMENT">Adjustment</option>
					</select>
					<input className="input flex-1 min-w-[8rem]" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
					<button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? "Saving…" : "Log"}</button>
					{error && <div className="alert alert-danger w-full">{error}</div>}
				</form>
			)}

			{historyOpen && (
				<div className="text-sm space-y-1 pt-2 border-t border-line">
					{movements === null ? (
						<div className="skeleton h-4 w-1/2" />
					) : movements.length === 0 ? (
						<p className="text-muted">No movements yet.</p>
					) : (
						movements.map(m => (
							<div key={m.id} className="flex flex-wrap justify-between gap-2 text-muted">
								<span>
									{m.delta > 0 ? "+" : ""}{m.delta} {material.unit} · {m.reason.toLowerCase()}
									{m.note ? ` — ${m.note}` : ""}
								</span>
								<span>{m.actor.name} · {new Date(m.at).toLocaleString()}</span>
							</div>
						))
					)}
				</div>
			)}
		</li>
	);
}

export default function InventoryPage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	const [materials, setMaterials] = useState<Material[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [unit, setUnit] = useState("");
	const [reorderPoint, setReorderPoint] = useState("0");
	const [creating, setCreating] = useState(false);

	async function load() {
		try {
			const res = await fetch("/api/materials");
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				setError(json.error || "Couldn't load materials.");
				return;
			}
			const json = await res.json();
			setMaterials(json.materials ?? []);
		} catch {
			setError("Couldn't load materials. Check your connection and try again.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim() || !unit.trim()) return;
		setCreating(true);
		setError(null);
		try {
			const res = await fetch("/api/materials", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), unit: unit.trim(), reorderPoint: Number(reorderPoint) || 0 }),
			});
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				setError(json.error || "Couldn't add that material.");
				return;
			}
			setName("");
			setUnit("");
			setReorderPoint("0");
			setShowForm(false);
			await load();
		} finally {
			setCreating(false);
		}
	}

	return (
		<div className="max-w-2xl mx-auto space-y-5">
			<PageHeader
				title="Inventory"
				subtitle="Raw material stock, tracked by hand."
				actions={isAdmin ? (
					<button onClick={() => setShowForm(v => !v)} className={showForm ? "btn btn-outline" : "btn btn-primary"}>
						{showForm ? "Cancel" : "+ Add material"}
					</button>
				) : undefined}
			/>

			{showForm && (
				<form onSubmit={onCreate} className="card card-pad space-y-3">
					<input className="input" placeholder="Material name, e.g. 300gsm Art Card" value={name} onChange={(e) => setName(e.target.value)} required />
					<div className="flex gap-3">
						<input className="input flex-1" placeholder="Unit, e.g. sheets" value={unit} onChange={(e) => setUnit(e.target.value)} required />
						<input className="input w-32" type="number" step="any" placeholder="Reorder at" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} />
					</div>
					{error && <div className="alert alert-danger">{error}</div>}
					<button disabled={creating} className="btn btn-primary">{creating ? "Adding…" : "Add material"}</button>
				</form>
			)}

			{!showForm && error && <div className="alert alert-danger">{error}</div>}

			{loading ? (
				<div className="space-y-2">
					{[1, 2, 3].map(i => (
						<div key={i} className="card p-4">
							<div className="skeleton h-4 w-1/3 mb-2" />
							<div className="skeleton h-3 w-2/3" />
						</div>
					))}
				</div>
			) : materials.length === 0 ? (
				<EmptyState title="No materials yet" hint={isAdmin ? "Add your first material above." : "Ask an admin to add materials here."} />
			) : (
				<ul className="space-y-2">
					{materials.map(m => (
						<MaterialRow key={m.id} material={m} isAdmin={isAdmin} onChanged={load} />
					))}
				</ul>
			)}
		</div>
	);
}
