"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";

type User = {
	id: string;
	name: string;
	email: string;
	role: string;
	active: boolean;
	createdAt: string;
};

function roleChip(role: string) {
	switch (role) {
		case "ADMIN":
			return "chip chip-danger chip-plain";
		case "MANAGER":
			return "chip chip-info chip-plain";
		default:
			return "chip chip-plain";
	}
}

export default function UsersPage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN";
	const [users, setUsers] = useState<User[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editEmail, setEditEmail] = useState("");
	const [editRole, setEditRole] = useState("");
	const [editActive, setEditActive] = useState(true);
	const [editPassword, setEditPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	// New-member mini-form
	const [addingMember, setAddingMember] = useState(false);
	const [newName, setNewName] = useState("");
	const [newEmail, setNewEmail] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [newRole, setNewRole] = useState("WORKER");
	const [creating, setCreating] = useState(false);

	useEffect(() => {
		if (currentUser && !isAdmin) {
			router.push("/dashboard");
		}
	}, [currentUser, isAdmin, router]);

	async function load() {
		const res = await fetch("/api/users?includeInactive=true");
		if (res.ok) {
			const json = await res.json();
			setUsers(json.users ?? []);
		}
	}

	useEffect(() => {
		if (isAdmin) load();
	}, [isAdmin]);

	async function onUpdate(userId: string) {
		setLoading(true);
		setError(null);
		const res = await fetch(`/api/users/${userId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: editName,
				email: editEmail,
				role: editRole,
				active: editActive,
				...(editPassword ? { password: editPassword } : {}),
			}),
		});
		setLoading(false);
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Couldn't update the user.");
			return;
		}
		setEditingId(null);
		setEditPassword("");
		load();
	}

	async function onDeactivate(userId: string) {
		if (!confirm("Deactivate this user? Their tasks and attendance history stay, but they won't be able to sign in until an admin reactivates them.")) return;
		setLoading(true);
		setError(null);
		const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
		setLoading(false);
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Couldn't deactivate the user.");
			return;
		}
		load();
	}

	async function onReactivate(userId: string) {
		setLoading(true);
		setError(null);
		const res = await fetch(`/api/users/${userId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ active: true }),
		});
		setLoading(false);
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Couldn't reactivate the user.");
			return;
		}
		load();
	}

	async function onPermanentDelete(userId: string, name: string) {
		if (!confirm(`Permanently delete ${name}? This cannot be undone, and only works if they have no tasks, comments, or attendance history — otherwise it'll tell you to deactivate instead.`)) return;
		setLoading(true);
		setError(null);
		const res = await fetch(`/api/users/${userId}?permanent=true`, { method: "DELETE" });
		setLoading(false);
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Couldn't permanently delete the user.");
			return;
		}
		load();
	}

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!newName.trim() || !newEmail.trim() || newPassword.length < 8) return;
		setCreating(true);
		setError(null);
		const res = await fetch("/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: newName.trim(), email: newEmail.trim(), password: newPassword, role: newRole }),
		});
		setCreating(false);
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Couldn't add the team member.");
			return;
		}
		setNewName("");
		setNewEmail("");
		setNewPassword("");
		setNewRole("WORKER");
		setAddingMember(false);
		load();
	}

	if (!currentUser || currentUser.role !== "ADMIN") {
		return (
			<EmptyState title="Admins only" hint="Only administrators can manage the team." />
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<PageHeader title="Team" subtitle={`${users.length} member${users.length === 1 ? "" : "s"} · roles and access`} />
				<button type="button" className="btn btn-primary btn-sm" onClick={() => setAddingMember((v) => !v)}>
					{addingMember ? "Cancel" : "+ Add member"}
				</button>
			</div>

			{addingMember && (
				<form onSubmit={onCreate} className="card card-pad space-y-4">
					<h2 className="font-semibold">Add a team member</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label className="field-label">Name</label>
							<input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required />
						</div>
						<div>
							<label className="field-label">Email</label>
							<input className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
						</div>
						<div>
							<label className="field-label">Temporary password</label>
							<input className="input" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
							<p className="meta mt-1">At least 8 characters. Share it with them directly — they can change it after signing in.</p>
						</div>
						<div>
							<label className="field-label">Role</label>
							<select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
								<option value="WORKER">Worker</option>
								<option value="MANAGER">Manager</option>
								<option value="ADMIN">Admin</option>
							</select>
						</div>
					</div>
					<button className="btn btn-primary btn-sm" disabled={creating}>
						{creating ? "Adding…" : "Add member"}
					</button>
				</form>
			)}

			{error && <div className="alert alert-danger">{error}</div>}

			{users.length === 0 ? (
				<EmptyState title="No team members yet" hint="New sign-ups will appear here." />
			) : (
				<div className="grid gap-2.5">
					{users.map((user) => (
						<div key={user.id} className="card p-4">
							{editingId === user.id ? (
								<div className="space-y-4">
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div>
											<label className="field-label">Name</label>
											<input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
										</div>
										<div>
											<label className="field-label">Email</label>
											<input className="input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
										</div>
										<div>
											<label className="field-label">Role</label>
											<select className="input" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
												<option value="WORKER">Worker</option>
												<option value="MANAGER">Manager</option>
												<option value="ADMIN">Admin</option>
											</select>
										</div>
										<div className="flex items-end pb-1.5">
											<label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
												<input type="checkbox" className="w-4 h-4 accent-[var(--accent)]" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
												Can sign in (active)
											</label>
										</div>
										<div>
											<label className="field-label">Reset password</label>
											<input className="input" type="text" placeholder="Leave blank to keep current password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} minLength={8} />
										</div>
									</div>
									<div className="flex gap-2">
										<button className="btn btn-primary btn-sm" onClick={() => onUpdate(user.id)} disabled={loading}>
											{loading ? "Saving…" : "Save changes"}
										</button>
										<button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditPassword(""); }} disabled={loading}>
											Cancel
										</button>
									</div>
								</div>
							) : (
								<div className="flex flex-wrap items-center gap-3">
									<div className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center font-semibold shrink-0">
										{user.name?.charAt(0).toUpperCase() || "?"}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-medium">{user.name}</span>
											<span className={roleChip(user.role)}>{user.role}</span>
											{!user.active && <span className="chip chip-danger">DISABLED</span>}
										</div>
										<div className="meta mt-0.5 truncate">
											{user.email} · joined {new Date(user.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
										</div>
									</div>
									<div className="flex gap-2 shrink-0">
										<button
											className="btn btn-outline btn-sm"
											onClick={() => {
												setEditingId(user.id);
												setEditName(user.name);
												setEditEmail(user.email);
												setEditRole(user.role);
												setEditActive(user.active);
												setEditPassword("");
											}}
										>
											Edit
										</button>
										{user.active ? (
											<button className="btn btn-danger-outline btn-sm" onClick={() => onDeactivate(user.id)} disabled={loading}>
												Deactivate
											</button>
										) : (
											<button className="btn btn-primary btn-sm" onClick={() => onReactivate(user.id)} disabled={loading}>
												Reactivate
											</button>
										)}
										<button
											className="text-xs text-danger hover:underline shrink-0"
											onClick={() => onPermanentDelete(user.id, user.name)}
											disabled={loading}
											title="Only works if this account has no tasks, comments, or attendance history"
										>
											Delete permanently
										</button>
									</div>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
