"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";

type ActivityEntry = {
	id: string;
	entityType: string;
	entityId: string;
	action: string;
	before: string | null;
	after: string | null;
	actorId: string;
	actor: { id: string; name: string };
	taskId: string | null;
	at: string;
};

const PAGE_SIZE = 50;

const ENTITY_TYPES = ["task", "despatch_item", "payment", "customer", "user", "auth"];

function actionChipClass(action: string): string {
	if (action.includes("DELETED") || action === "LOGIN_FAILED") return "chip chip-danger";
	if (action === "CREATED" || action === "LOGIN") return "chip chip-ok";
	if (action.includes("STATUS") || action === "UPDATED" || action === "TOTAL_AMOUNT_SET") return "chip chip-info";
	return "chip chip-plain";
}

// Renders a compact "key: old → new" summary from the before/after JSON blobs
// -- falls back to "—" for whichever side is null/absent so a CREATED (no
// before) or DELETED (no after) row still reads cleanly.
function ChangeSummary({ before, after }: { before: string | null; after: string | null }) {
	let beforeObj: Record<string, unknown> = {};
	let afterObj: Record<string, unknown> = {};
	try { beforeObj = before ? JSON.parse(before) : {}; } catch {}
	try { afterObj = after ? JSON.parse(after) : {}; } catch {}

	const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));
	if (keys.length === 0) return <span className="text-muted">—</span>;

	return (
		<div className="text-xs text-muted space-y-0.5">
			{keys.map((k) => {
				const b = beforeObj[k];
				const a = afterObj[k];
				return (
					<div key={k}>
						<span className="font-medium">{k}</span>: {b !== undefined && b !== null ? String(b) : "—"} → {a !== undefined && a !== null ? String(a) : "—"}
					</div>
				);
			})}
		</div>
	);
}

export default function AuditLogPage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	const [entries, setEntries] = useState<ActivityEntry[]>([]);
	const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
	const [entityType, setEntityType] = useState("");
	const [actorId, setActorId] = useState("");
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isAdmin) return;
		fetch("/api/users?includeInactive=true").then(r => r.ok ? r.json() : { users: [] }).then(json => setUsers(json.users ?? []));
	}, [isAdmin]);

	async function load(nextOffset: number, append: boolean) {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
			if (entityType) params.set("entityType", entityType);
			if (actorId) params.set("actorId", actorId);
			const res = await fetch(`/api/audit?${params.toString()}`);
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				setError(json.error || "Couldn't load the audit log.");
				return;
			}
			const json = await res.json();
			setEntries(prev => append ? [...prev, ...json.entries] : json.entries);
			setHasMore(json.pagination.hasMore);
			setOffset(nextOffset);
		} catch {
			setError("Couldn't load the audit log. Check your connection and try again.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (!isAdmin) return;
		load(0, false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAdmin, entityType, actorId]);

	if (currentUser && !isAdmin) {
		return (
			<div className="max-w-3xl mx-auto">
				<EmptyState title="Admins only" hint="The audit log isn't shown to this account." />
			</div>
		);
	}

	return (
		<div className="max-w-3xl mx-auto space-y-5">
			<PageHeader title="Audit Log" subtitle="Who changed what, and when." />

			<div className="flex flex-wrap items-end gap-3">
				<div>
					<label className="field-label">Entity type</label>
					<select className="input" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
						<option value="">All</option>
						{ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
					</select>
				</div>
				<div>
					<label className="field-label">Actor</label>
					<select className="input" value={actorId} onChange={(e) => setActorId(e.target.value)}>
						<option value="">All</option>
						{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
					</select>
				</div>
			</div>

			{error && <div className="alert alert-danger">{error}</div>}

			{loading && entries.length === 0 ? (
				<div className="space-y-2">
					{[1, 2, 3].map(i => (
						<div key={i} className="card p-4">
							<div className="skeleton h-4 w-1/3 mb-2" />
							<div className="skeleton h-3 w-2/3" />
						</div>
					))}
				</div>
			) : entries.length === 0 ? (
				<EmptyState title="No activity yet" hint="Changes across tasks, payments, customers, and accounts will show up here." />
			) : (
				<>
					<ul className="space-y-2">
						{entries.map(entry => (
							<li key={entry.id} className="card p-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="flex flex-wrap items-center gap-2">
										<span className={actionChipClass(entry.action)}>{entry.action}</span>
										<span className="text-sm font-medium">{entry.actor.name}</span>
										<span className="meta">{entry.entityType}</span>
										{entry.taskId && (
											<a href={`/tasks?open=${entry.taskId}`} className="text-xs text-blue-600 hover:underline">
												open task
											</a>
										)}
									</div>
									<span className="meta">{new Date(entry.at).toLocaleString()}</span>
								</div>
								<div className="mt-2">
									<ChangeSummary before={entry.before} after={entry.after} />
								</div>
							</li>
						))}
					</ul>
					{hasMore && (
						<button
							type="button"
							className="btn btn-outline btn-sm"
							onClick={() => load(offset + PAGE_SIZE, true)}
							disabled={loading}
						>
							{loading ? "Loading…" : "Load more"}
						</button>
					)}
				</>
			)}
		</div>
	);
}
