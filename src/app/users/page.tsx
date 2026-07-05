"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
	id: string;
	name: string;
	email: string;
	role: string;
	active: boolean;
	createdAt: string;
};

export default function UsersPage() {
	const [users, setUsers] = useState<User[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editEmail, setEditEmail] = useState("");
	const [editRole, setEditRole] = useState("");
	const [editActive, setEditActive] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [currentUser, setCurrentUser] = useState<any>(null);
	const router = useRouter();

	// Check if current user is admin
	useEffect(() => {
		async function checkAuth() {
			const res = await fetch("/api/auth/me");
			if (res.ok) {
				const user = await res.json();
				setCurrentUser(user);
				if (user.role !== "ADMIN") {
					router.push("/dashboard");
				}
			} else {
				router.push("/signin");
			}
		}
		checkAuth();
	}, [router]);

	async function load() {
		const res = await fetch("/api/users");
		if (res.ok) {
			const json = await res.json();
			setUsers(json.users ?? []);
		}
	}

	useEffect(() => {
		if (currentUser?.role === "ADMIN") {
			load();
		}
	}, [currentUser]);

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
				active: editActive
			})
		});
		setLoading(false);
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Failed to update user");
			return;
		}
		setEditingId(null);
		load();
	}

	async function onDelete(userId: string) {
		if (!confirm("Are you sure you want to delete this user?")) return;
		setLoading(true);
		setError(null);
		const res = await fetch(`/api/users/${userId}`, {
			method: "DELETE"
		});
		setLoading(false);
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			setError(json.error ?? "Failed to delete user");
			return;
		}
		load();
	}

	// Show loading or redirect if not admin
	if (!currentUser || currentUser.role !== "ADMIN") {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<h1 className="text-2xl font-semibold mb-4">Access Denied</h1>
					<p className="text-gray-600">Only administrators can access this page.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">User Management</h1>
			</div>
			
			{error && <p className="text-sm text-red-600">{error}</p>}
			
			<div className="overflow-x-auto">
				<table className="w-full border-collapse border">
					<thead>
						<tr className="bg-gray-50">
							<th className="border p-3 text-left">Name</th>
							<th className="border p-3 text-left">Email</th>
							<th className="border p-3 text-left">Role</th>
							<th className="border p-3 text-left">Status</th>
							<th className="border p-3 text-left">Created</th>
							<th className="border p-3 text-left">Actions</th>
						</tr>
					</thead>
					<tbody>
						{users.map(user => (
							<tr key={user.id} className="hover:bg-gray-50">
								{editingId === user.id ? (
									<>
										<td className="border p-3">
											<input
												className="w-full border rounded px-2 py-1"
												value={editName}
												onChange={e => setEditName(e.target.value)}
											/>
										</td>
										<td className="border p-3">
											<input
												className="w-full border rounded px-2 py-1"
												value={editEmail}
												onChange={e => setEditEmail(e.target.value)}
											/>
										</td>
										<td className="border p-3">
											<select
												className="w-full border rounded px-2 py-1"
												value={editRole}
												onChange={e => setEditRole(e.target.value)}
											>
												<option value="WORKER">Worker</option>
												<option value="MANAGER">Manager</option>
												<option value="ADMIN">Admin</option>
											</select>
										</td>
										<td className="border p-3">
											<label className="flex items-center gap-2">
												<input
													type="checkbox"
													checked={editActive}
													onChange={e => setEditActive(e.target.checked)}
												/>
												Active
											</label>
										</td>
										<td className="border p-3 text-sm text-gray-600">
											{new Date(user.createdAt).toLocaleDateString()}
										</td>
										<td className="border p-3">
											<div className="flex gap-2">
												<button
													className="px-3 py-1 bg-green-600 text-white rounded text-sm"
													onClick={() => onUpdate(user.id)}
													disabled={loading}
												>
													Save
												</button>
												<button
													className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
													onClick={() => setEditingId(null)}
													disabled={loading}
												>
													Cancel
												</button>
											</div>
										</td>
									</>
								) : (
									<>
										<td className="border p-3 font-medium">{user.name}</td>
										<td className="border p-3">{user.email}</td>
										<td className="border p-3">
											<span className={`px-2 py-1 rounded text-xs ${
												user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
												user.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
												'bg-gray-100 text-gray-800'
											}`}>
												{user.role}
											</span>
										</td>
										<td className="border p-3">
											<span className={`px-2 py-1 rounded text-xs ${
												user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
											}`}>
												{user.active ? 'Active' : 'Inactive'}
											</span>
										</td>
										<td className="border p-3 text-sm text-gray-600">
											{new Date(user.createdAt).toLocaleDateString()}
										</td>
										<td className="border p-3">
											<div className="flex gap-2">
												<button
													className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
													onClick={() => {
														setEditingId(user.id);
														setEditName(user.name);
														setEditEmail(user.email);
														setEditRole(user.role);
														setEditActive(user.active);
													}}
												>
													Edit
												</button>
												<button
													className="px-3 py-1 bg-red-600 text-white rounded text-sm"
													onClick={() => onDelete(user.id)}
													disabled={loading}
												>
													Delete
												</button>
											</div>
										</td>
									</>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
