"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";
import { BUILT_IN_ITEM_CATEGORIES } from "@/lib/constants";
import {
	ReactFlow,
	Background,
	Controls,
	Handle,
	Position,
	ReactFlowProvider,
	applyNodeChanges,
	applyEdgeChanges,
	type Node,
	type Edge,
	type Connection,
	type NodeChange,
	type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type CategoryField = {
	id: string;
	key: string;
	label: string;
	type: "TEXT" | "NUMBER" | "DATE" | "BOOLEAN";
	required: boolean;
	order: number;
};
type Category = {
	id: string;
	name: string;
	order: number;
	fields: CategoryField[];
};

function AppearanceSection() {
	const [theme, setTheme] = useState<"light" | "dark">("light");

	useEffect(() => {
		const t = document.documentElement.getAttribute("data-theme");
		if (t === "dark" || t === "light") setTheme(t);
	}, []);

	function choose(next: "light" | "dark") {
		document.documentElement.setAttribute("data-theme", next);
		setTheme(next);
		try {
			localStorage.setItem("theme", next);
		} catch {}
	}

	return (
		<section className="card card-pad">
			<h2 className="font-semibold mb-1">Appearance</h2>
			<p className="text-sm text-muted mb-4">Light is the default for everyone. Dark is a personal choice, remembered on this device only.</p>
			<div className="flex gap-2">
				<button
					onClick={() => choose("light")}
					className={theme === "light" ? "btn btn-primary" : "btn btn-outline"}
				>
					☀️ Light
				</button>
				<button
					onClick={() => choose("dark")}
					className={theme === "dark" ? "btn btn-primary" : "btn btn-outline"}
				>
					🌙 Dark
				</button>
			</div>
		</section>
	);
}

function FieldTypeLabel({ type }: { type: string }) {
	const labels: Record<string, string> = { TEXT: "Text", NUMBER: "Number", DATE: "Date", BOOLEAN: "Yes/No" };
	return <span className="chip chip-plain">{labels[type] || type}</span>;
}

function CategoriesSection() {
	const [categories, setCategories] = useState<Category[] | null>(null);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [creatingCategory, setCreatingCategory] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// New-field mini-form state, scoped to whichever category is expanded.
	const [fieldKey, setFieldKey] = useState("");
	const [fieldLabel, setFieldLabel] = useState("");
	const [fieldType, setFieldType] = useState<"TEXT" | "NUMBER" | "DATE" | "BOOLEAN">("TEXT");
	const [fieldRequired, setFieldRequired] = useState(false);
	const [addingField, setAddingField] = useState(false);

	async function load() {
		const res = await fetch("/api/categories");
		if (res.ok) {
			const data = await res.json();
			setCategories(data.categories);
		}
	}

	useEffect(() => {
		load();
	}, []);

	async function createCategory(e: React.FormEvent) {
		e.preventDefault();
		if (!newCategoryName.trim()) return;
		setCreatingCategory(true);
		setError(null);
		try {
			const res = await fetch("/api/categories", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: newCategoryName.trim() }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data.error || "Couldn't add the category.");
				return;
			}
			setNewCategoryName("");
			await load();
		} finally {
			setCreatingCategory(false);
		}
	}

	async function deleteCategory(id: string) {
		if (!confirm("Delete this category? Tasks already using it keep their data — it just won't be offered for new tasks.")) return;
		await fetch(`/api/categories/${id}`, { method: "DELETE" });
		await load();
	}

	async function addField(categoryId: string, e: React.FormEvent) {
		e.preventDefault();
		if (!fieldKey.trim() || !fieldLabel.trim()) return;
		setAddingField(true);
		setError(null);
		try {
			const res = await fetch(`/api/categories/${categoryId}/fields`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ key: fieldKey.trim(), label: fieldLabel.trim(), type: fieldType, required: fieldRequired }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data.error || "Couldn't add the field.");
				return;
			}
			setFieldKey("");
			setFieldLabel("");
			setFieldType("TEXT");
			setFieldRequired(false);
			await load();
		} finally {
			setAddingField(false);
		}
	}

	async function deleteField(categoryId: string, fieldId: string) {
		await fetch(`/api/categories/${categoryId}/fields/${fieldId}`, { method: "DELETE" });
		await load();
	}

	return (
		<section className="card card-pad">
			<h2 className="font-semibold mb-1">Categories &amp; fields</h2>
			<p className="text-sm text-muted mb-4">
				The built-in categories (Rigid Boxes, Cake Boxes, Paper Bags, etc.) always show up in the task form.
				Add your own here — each can have its own custom fields, which appear when that category is picked.
			</p>

			<form onSubmit={createCategory} className="flex gap-2 mb-4">
				<input
					className="input flex-1"
					placeholder="New category name, e.g. Wedding Favours"
					value={newCategoryName}
					onChange={(e) => setNewCategoryName(e.target.value)}
				/>
				<button disabled={creatingCategory} className="btn btn-primary shrink-0">
					{creatingCategory ? "Adding…" : "+ Add category"}
				</button>
			</form>

			{error && <div className="alert alert-danger mb-4">{error}</div>}

			{categories === null ? (
				<div className="space-y-2">
					{[1, 2].map((i) => (
						<div key={i} className="skeleton h-12 w-full" />
					))}
				</div>
			) : categories.length === 0 ? (
				<EmptyState title="No custom categories yet" hint="Add one above to start attaching custom fields to it." />
			) : (
				<div className="space-y-2">
					{categories.map((cat) => (
						<div key={cat.id} className="border border-line rounded-lg">
							<button
								type="button"
								onClick={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
								className="w-full flex items-center justify-between gap-2 p-3 text-left"
							>
								<span className="font-medium">{cat.name}</span>
								<span className="flex items-center gap-2">
									<span className="meta">{cat.fields.length} field{cat.fields.length === 1 ? "" : "s"}</span>
									<span className="text-muted">{expandedId === cat.id ? "▲" : "▼"}</span>
								</span>
							</button>

							{expandedId === cat.id && (
								<div className="border-t border-line p-3 space-y-3">
									{cat.fields.length > 0 && (
										<div className="space-y-1.5">
											{cat.fields.map((f) => (
												<div key={f.id} className="flex items-center justify-between gap-2 text-sm bg-wash rounded-lg px-3 py-2">
													<div className="flex items-center gap-2 min-w-0">
														<span className="truncate">{f.label}</span>
														<FieldTypeLabel type={f.type} />
														{f.required && <span className="chip chip-warn chip-plain">Required</span>}
													</div>
													<button
														type="button"
														onClick={() => deleteField(cat.id, f.id)}
														className="btn btn-danger-outline btn-sm shrink-0"
													>
														Remove
													</button>
												</div>
											))}
										</div>
									)}

									<form onSubmit={(e) => addField(cat.id, e)} className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-line">
										<input
											className="input"
											placeholder="Field label, e.g. Ribbon Colour"
											value={fieldLabel}
											onChange={(e) => setFieldLabel(e.target.value)}
										/>
										<input
											className="input"
											placeholder="Key, e.g. ribbonColour"
											value={fieldKey}
											onChange={(e) => setFieldKey(e.target.value)}
										/>
										<select className="input" value={fieldType} onChange={(e) => setFieldType(e.target.value as any)}>
											<option value="TEXT">Text</option>
											<option value="NUMBER">Number</option>
											<option value="DATE">Date</option>
											<option value="BOOLEAN">Yes/No</option>
										</select>
										<label className="flex items-center gap-2 text-sm">
											<input type="checkbox" checked={fieldRequired} onChange={(e) => setFieldRequired(e.target.checked)} />
											Required
										</label>
										<button disabled={addingField} className="btn btn-outline btn-sm sm:col-span-2">
											{addingField ? "Adding…" : "+ Add field"}
										</button>
									</form>

									<button
										type="button"
										onClick={() => deleteCategory(cat.id)}
										className="text-sm text-danger hover:underline"
									>
										Delete this category
									</button>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</section>
	);
}

type DraftNode = { id: string; name: string; posX: number; posY: number; isStart: boolean };
type DraftEdge = { id: string; fromNodeId: string; toNodeId: string; label: string | null };
type RouteDraft = { name: string; nodes: DraftNode[]; edges: DraftEdge[] };
type StageTemplate = { id: string; category: string; name: string; nodes: DraftNode[]; edges: DraftEdge[] };

function newNodeId() {
	return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `n-${Date.now()}-${Math.random()}`;
}

function blankDraft(): RouteDraft {
	const startId = newNodeId();
	return { name: "", nodes: [{ id: startId, name: "Stage 1", posX: 40, posY: 80, isStart: true }], edges: [] };
}

// A route must be a DAG with exactly one start node -- mirrors
// src/lib/productionRouting.ts's assertIsDag server-side check, duplicated
// here (small, pure, no Prisma) so the builder can give instant feedback
// before round-tripping to the server.
function validateGraph(nodes: DraftNode[], edges: DraftEdge[]): string | null {
	const startNodes = nodes.filter(n => n.isStart);
	if (startNodes.length !== 1) return `A route needs exactly one start stage (found ${startNodes.length}).`;

	const outgoing = new Map<string, string[]>();
	for (const e of edges) {
		if (!outgoing.has(e.fromNodeId)) outgoing.set(e.fromNodeId, []);
		outgoing.get(e.fromNodeId)!.push(e.toNodeId);
	}
	const WHITE = 0, GRAY = 1, BLACK = 2;
	const color = new Map<string, number>(nodes.map(n => [n.id, WHITE]));
	let cycle = false;
	function visit(id: string) {
		color.set(id, GRAY);
		for (const next of outgoing.get(id) ?? []) {
			const c = color.get(next);
			if (c === GRAY) { cycle = true; return; }
			if (c === WHITE) visit(next);
		}
		color.set(id, BLACK);
	}
	for (const n of nodes) {
		if (color.get(n.id) === WHITE) visit(n.id);
	}
	if (cycle) return "Routes can't loop back on themselves -- every path must lead forward to an end.";
	return null;
}

function StageFlowNode({ id, data }: any) {
	return (
		<div className={`stage-flow-node${data.isStart ? " stage-flow-node-start" : ""}`}>
			<Handle type="target" position={Position.Left} />
			<button
				type="button"
				title="Set as start stage"
				onClick={() => data.onToggleStart(id)}
				className="stage-flow-node-star nodrag nopan"
			>
				★
			</button>
			<input
				className="stage-flow-node-input nodrag"
				value={data.name}
				onChange={(e) => data.onRename(id, e.target.value)}
			/>
			<button type="button" title="Delete stage" onClick={() => data.onDelete(id)} className="stage-flow-node-delete nodrag nopan">
				×
			</button>
			<Handle type="source" position={Position.Right} />
		</div>
	);
}

const flowNodeTypes = { stage: StageFlowNode };

function RouteFlowEditor({ draft, onChange }: { draft: RouteDraft; onChange: (d: RouteDraft) => void }) {
	function onRename(id: string, name: string) {
		onChange({ ...draft, nodes: draft.nodes.map(n => (n.id === id ? { ...n, name } : n)) });
	}
	function onToggleStart(id: string) {
		onChange({ ...draft, nodes: draft.nodes.map(n => ({ ...n, isStart: n.id === id })) });
	}
	function onDelete(id: string) {
		onChange({
			name: draft.name,
			nodes: draft.nodes.filter(n => n.id !== id),
			edges: draft.edges.filter(e => e.fromNodeId !== id && e.toNodeId !== id),
		});
	}

	const rfNodes: Node[] = draft.nodes.map(n => ({
		id: n.id,
		type: "stage",
		position: { x: n.posX, y: n.posY },
		// Explicit width/height so React Flow can render immediately instead
		// of waiting on a ResizeObserver measurement pass (which can get
		// stuck leaving nodes permanently invisible in some environments).
		width: 180,
		height: 44,
		data: { name: n.name, isStart: n.isStart, onRename, onToggleStart, onDelete },
	}));
	const rfEdges: Edge[] = draft.edges.map(e => ({ id: e.id, source: e.fromNodeId, target: e.toNodeId, label: e.label ?? undefined }));

	function onNodesChange(changes: NodeChange[]) {
		const updated = applyNodeChanges(changes, rfNodes);
		onChange({
			...draft,
			nodes: updated.map(n => {
				const orig = draft.nodes.find(dn => dn.id === n.id);
				return { id: n.id, name: orig?.name ?? "", posX: n.position.x, posY: n.position.y, isStart: orig?.isStart ?? false };
			}),
		});
	}
	function onEdgesChange(changes: EdgeChange[]) {
		const updated = applyEdgeChanges(changes, rfEdges);
		onChange({ ...draft, edges: updated.map(e => ({ id: e.id, fromNodeId: e.source, toNodeId: e.target, label: ((e as Edge).label as string) ?? null })) });
	}
	function onConnect(connection: Connection) {
		if (!connection.source || !connection.target || connection.source === connection.target) return;
		const label = window.prompt("Label this branch (optional):", "");
		onChange({ ...draft, edges: [...draft.edges, { id: newNodeId(), fromNodeId: connection.source, toNodeId: connection.target, label: label || null }] });
	}
	function addNode() {
		const maxX = draft.nodes.reduce((m, n) => Math.max(m, n.posX), 0);
		onChange({ ...draft, nodes: [...draft.nodes, { id: newNodeId(), name: "New stage", posX: maxX + 180, posY: 80, isStart: draft.nodes.length === 0 }] });
	}

	return (
		<div>
			<div style={{ height: 300 }} className="border border-line rounded-lg overflow-hidden">
				<ReactFlowProvider>
					<ReactFlow
						nodes={rfNodes}
						edges={rfEdges}
						nodeTypes={flowNodeTypes}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onConnect={onConnect}
						fitView
						proOptions={{ hideAttribution: true }}
					>
						<Background gap={16} />
						<Controls showInteractive={false} />
					</ReactFlow>
				</ReactFlowProvider>
			</div>
			<button type="button" className="btn btn-outline btn-sm mt-2" onClick={addNode}>
				+ Add stage
			</button>
		</div>
	);
}

function ProductionStagesSection() {
	const [customCategories, setCustomCategories] = useState<string[]>([]);
	const [templates, setTemplates] = useState<StageTemplate[]>([]);
	const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
	// Local edit buffers, keyed by template id (or "new-<category>" for an
	// unsaved one being created).
	const [drafts, setDrafts] = useState<Record<string, RouteDraft>>({});
	const [saving, setSaving] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function load() {
		const [catsRes, stagesRes] = await Promise.all([fetch("/api/categories"), fetch("/api/category-stages")]);
		if (catsRes.ok) {
			const json = await catsRes.json();
			setCustomCategories((json.categories ?? []).map((c: any) => c.name));
		}
		if (stagesRes.ok) {
			const json = await stagesRes.json();
			setTemplates(json.templates ?? []);
		}
	}

	useEffect(() => { load(); }, []);

	const allCategories = Array.from(new Set([...BUILT_IN_ITEM_CATEGORIES, ...customCategories]));

	function templatesFor(category: string): StageTemplate[] {
		return templates.filter(t => t.category === category);
	}

	function draftFor(key: string, fallback: RouteDraft) {
		return drafts[key] ?? fallback;
	}

	function setDraft(key: string, draft: RouteDraft) {
		setDrafts(prev => ({ ...prev, [key]: draft }));
	}

	function startNewTemplate(category: string) {
		setDrafts(prev => ({ ...prev, [`new-${category}`]: blankDraft() }));
	}

	async function saveTemplate(category: string, existing: StageTemplate | null, key: string) {
		const draft = draftFor(key, existing ? { name: existing.name, nodes: existing.nodes, edges: existing.edges } : blankDraft());
		const name = draft.name.trim();
		if (!name) {
			setError("A route needs a name.");
			return;
		}
		const validationError = validateGraph(draft.nodes, draft.edges);
		if (validationError) {
			setError(validationError);
			return;
		}
		setSaving(key);
		setError(null);
		try {
			const body = { category, name, nodes: draft.nodes, edges: draft.edges };
			const res = existing
				? await fetch(`/api/category-stages/${existing.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				})
				: await fetch("/api/category-stages", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				setError(typeof json.error === "string" ? json.error : "Couldn't save this route.");
				return;
			}
			setDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
			await load();
		} finally {
			setSaving(null);
		}
	}

	async function deleteTemplate(id: string) {
		if (!confirm("Delete this route? Items already using it keep their progress, but no new items can pick it.")) return;
		await fetch(`/api/category-stages/${id}`, { method: "DELETE" });
		await load();
	}

	return (
		<section className="card card-pad">
			<h2 className="font-semibold mb-1">Production stages</h2>
			<p className="text-sm text-muted mb-4">
				Give a category one or more named routes through production, each built as a flowchart —
				drag stages around, drag from a stage's right edge to another stage's left edge to connect
				them, and mark one stage as the ★ start. A route can branch (e.g. after "Printing", go to
				either "Lamination" or straight to "Packing") — whoever's advancing an item picks a branch
				when they reach it. Items in a category with routing configured show this flowchart instead
				of a plain status dropdown once they reach Pre Production; a category with no routes here
				keeps the plain dropdown.
			</p>

			{error && <div className="alert alert-danger mb-4">{error}</div>}

			<div className="space-y-2">
				{allCategories.map(category => {
					const categoryTemplates = templatesFor(category);
					const isExpanded = expandedCategory === category;
					const newKey = `new-${category}`;
					const isAddingNew = newKey in drafts;
					return (
						<div key={category} className="border border-line rounded-lg">
							<button
								type="button"
								onClick={() => setExpandedCategory(isExpanded ? null : category)}
								className="w-full flex items-center justify-between gap-2 p-3 text-left"
							>
								<span className="font-medium">{category}</span>
								<span className="flex items-center gap-2">
									<span className="meta">
										{categoryTemplates.length > 0 ? `${categoryTemplates.length} route${categoryTemplates.length === 1 ? "" : "s"}` : "No routing"}
									</span>
									<span className="text-muted">{isExpanded ? "▲" : "▼"}</span>
								</span>
							</button>

							{isExpanded && (
								<div className="border-t border-line p-3 space-y-3">
									{categoryTemplates.map(t => {
										const key = t.id;
										const draft = draftFor(key, { name: t.name, nodes: t.nodes, edges: t.edges });
										return (
											<div key={key} className="border border-line rounded-lg p-3 space-y-2 bg-wash">
												<div className="flex items-center gap-2">
													<input
														className="input font-medium"
														value={draft.name}
														onChange={(e) => setDraft(key, { ...draft, name: e.target.value })}
														placeholder="Route name, e.g. Standard"
													/>
													<button type="button" onClick={() => deleteTemplate(t.id)} className="text-danger text-sm shrink-0">
														Delete
													</button>
												</div>
												<RouteFlowEditor draft={draft} onChange={(d) => setDraft(key, d)} />
												<div className="flex gap-2 pt-1">
													<button type="button" className="btn btn-primary btn-sm" onClick={() => saveTemplate(category, t, key)} disabled={saving === key}>
														{saving === key ? "Saving…" : "Save"}
													</button>
												</div>
											</div>
										);
									})}

									{isAddingNew ? (
										(() => {
											const draft = draftFor(newKey, blankDraft());
											return (
												<div className="border border-line rounded-lg p-3 space-y-2">
													<input
														className="input font-medium"
														value={draft.name}
														onChange={(e) => setDraft(newKey, { ...draft, name: e.target.value })}
														placeholder="Route name, e.g. Laminated"
													/>
													<RouteFlowEditor draft={draft} onChange={(d) => setDraft(newKey, d)} />
													<div className="flex gap-2 pt-1">
														<button type="button" className="btn btn-primary btn-sm" onClick={() => saveTemplate(category, null, newKey)} disabled={saving === newKey}>
															{saving === newKey ? "Saving…" : "Save route"}
														</button>
														<button
															type="button"
															className="btn btn-ghost btn-sm"
															onClick={() => setDrafts(prev => { const next = { ...prev }; delete next[newKey]; return next; })}
														>
															Cancel
														</button>
													</div>
												</div>
											);
										})()
									) : (
										<button type="button" className="btn btn-outline btn-sm" onClick={() => startNewTemplate(category)}>
											+ Add route
										</button>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}

type TeamMember = { id: string; user: { id: string; name: string } };
type Team = { id: string; name: string; order: number; members: TeamMember[] };
type SimpleUser = { id: string; name: string };

function TeamsSection() {
	const [teams, setTeams] = useState<Team[] | null>(null);
	const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
	const [newTeamName, setNewTeamName] = useState("");
	const [creatingTeam, setCreatingTeam] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [addMemberUserId, setAddMemberUserId] = useState("");
	const [addingMember, setAddingMember] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function load() {
		const [teamsRes, usersRes] = await Promise.all([fetch("/api/teams"), fetch("/api/users")]);
		if (teamsRes.ok) setTeams((await teamsRes.json()).teams);
		if (usersRes.ok) setAllUsers((await usersRes.json()).users);
	}

	useEffect(() => {
		load();
	}, []);

	async function createTeam(e: React.FormEvent) {
		e.preventDefault();
		if (!newTeamName.trim()) return;
		setCreatingTeam(true);
		setError(null);
		try {
			const res = await fetch("/api/teams", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: newTeamName.trim() }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data.error || "Couldn't add the team.");
				return;
			}
			setNewTeamName("");
			await load();
		} finally {
			setCreatingTeam(false);
		}
	}

	async function deleteTeam(id: string) {
		if (!confirm("Delete this team? Members lose whatever access this team's task assignments granted them.")) return;
		await fetch(`/api/teams/${id}`, { method: "DELETE" });
		await load();
	}

	async function addMember(teamId: string, e: React.FormEvent) {
		e.preventDefault();
		if (!addMemberUserId) return;
		setAddingMember(true);
		setError(null);
		try {
			const res = await fetch(`/api/teams/${teamId}/members`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ userId: addMemberUserId }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data.error || "Couldn't add that member.");
				return;
			}
			setAddMemberUserId("");
			await load();
		} finally {
			setAddingMember(false);
		}
	}

	async function removeMember(teamId: string, userId: string) {
		await fetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
		await load();
	}

	return (
		<section className="card card-pad">
			<h2 className="font-semibold mb-1">Teams</h2>
			<p className="text-sm text-muted mb-4">
				Assign a team to a task to give every member the same access as an individual assignee.
				Mention a team in a comment (e.g. @Delivery) to notify every member, even on tasks the team isn&apos;t assigned to.
			</p>

			<form onSubmit={createTeam} className="flex gap-2 mb-4">
				<input
					className="input flex-1"
					placeholder="New team name, e.g. Design"
					value={newTeamName}
					onChange={(e) => setNewTeamName(e.target.value)}
				/>
				<button disabled={creatingTeam} className="btn btn-primary shrink-0">
					{creatingTeam ? "Adding…" : "+ Add team"}
				</button>
			</form>

			{error && <div className="alert alert-danger mb-4">{error}</div>}

			{teams === null ? (
				<div className="space-y-2">
					{[1, 2].map((i) => (
						<div key={i} className="skeleton h-12 w-full" />
					))}
				</div>
			) : teams.length === 0 ? (
				<EmptyState title="No teams yet" hint="Add one above, then add members to it." />
			) : (
				<div className="space-y-2">
					{teams.map((team) => {
						const memberIds = new Set(team.members.map((m) => m.user.id));
						const addableUsers = allUsers.filter((u) => !memberIds.has(u.id));
						return (
							<div key={team.id} className="border border-line rounded-lg">
								<button
									type="button"
									onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
									className="w-full flex items-center justify-between gap-2 p-3 text-left"
								>
									<span className="font-medium">{team.name}</span>
									<span className="flex items-center gap-2">
										<span className="meta">{team.members.length} member{team.members.length === 1 ? "" : "s"}</span>
										<span className="text-muted">{expandedId === team.id ? "▲" : "▼"}</span>
									</span>
								</button>

								{expandedId === team.id && (
									<div className="border-t border-line p-3 space-y-3">
										{team.members.length > 0 && (
											<div className="space-y-1.5">
												{team.members.map((m) => (
													<div key={m.id} className="flex items-center justify-between gap-2 text-sm bg-wash rounded-lg px-3 py-2">
														<span className="truncate">{m.user.name}</span>
														<button
															type="button"
															onClick={() => removeMember(team.id, m.user.id)}
															className="btn btn-danger-outline btn-sm shrink-0"
														>
															Remove
														</button>
													</div>
												))}
											</div>
										)}

										<form onSubmit={(e) => addMember(team.id, e)} className="flex gap-2 pt-2 border-t border-line">
											<select className="input flex-1" value={addMemberUserId} onChange={(e) => setAddMemberUserId(e.target.value)}>
												<option value="">Select a person to add</option>
												{addableUsers.map((u) => (
													<option key={u.id} value={u.id}>{u.name}</option>
												))}
											</select>
											<button disabled={addingMember || !addMemberUserId} className="btn btn-outline btn-sm shrink-0">
												{addingMember ? "Adding…" : "+ Add"}
											</button>
										</form>

										<button
											type="button"
											onClick={() => deleteTeam(team.id)}
											className="text-sm text-danger hover:underline"
										>
											Delete this team
										</button>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}

function IntegrationsSection() {
	const [status, setStatus] = useState<{ email: boolean; push: boolean; whatsapp: boolean } | null>(null);

	useEffect(() => {
		fetch("/api/integrations/status")
			.then(r => r.ok ? r.json() : null)
			.then(setStatus)
			.catch(() => {});
	}, []);

	function Row({ label, configured }: { label: string; configured: boolean }) {
		return (
			<div className="flex items-center justify-between text-sm">
				<span>{label}</span>
				<span className={configured ? "chip chip-ok" : "chip chip-plain"}>
					{configured ? "Configured" : "Not configured"}
				</span>
			</div>
		);
	}

	return (
		<section className="card card-pad space-y-3">
			<h2 className="font-semibold mb-1">Integrations</h2>
			<p className="text-sm text-muted mb-2">
				Outgoing notification channels — email and push already work; WhatsApp needs a Meta
				WhatsApp Business API phone number and access token added as environment variables.
			</p>
			{status ? (
				<div className="space-y-2">
					<Row label="Email (SendGrid)" configured={status.email} />
					<Row label="Push notifications (Firebase)" configured={status.push} />
					<Row label="WhatsApp" configured={status.whatsapp} />
				</div>
			) : (
				<div className="skeleton h-16 w-full" />
			)}
		</section>
	);
}

export default function SettingsPage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	// Appearance applies to everyone; only show category/field/team management to admins.
	return (
		<div className="max-w-2xl mx-auto space-y-5">
			<PageHeader title="Settings" />
			<AppearanceSection />
			{isAdmin && <CategoriesSection />}
			{isAdmin && <ProductionStagesSection />}
			{isAdmin && <TeamsSection />}
			{isAdmin && <IntegrationsSection />}
		</div>
	);
}
