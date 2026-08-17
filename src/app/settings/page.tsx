"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";

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

export default function SettingsPage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	// Appearance applies to everyone; only show category/field/team management to admins.
	return (
		<div className="max-w-2xl mx-auto space-y-5">
			<PageHeader title="Settings" />
			<AppearanceSection />
			{isAdmin && <CategoriesSection />}
			{isAdmin && <TeamsSection />}
		</div>
	);
}
