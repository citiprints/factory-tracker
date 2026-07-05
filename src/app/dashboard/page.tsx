"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "../UserContext";

type Task = {
	id: string;
	title: string;
	description: string;
	status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED" | "ARCHIVED";
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	startAt?: string | null;
	dueAt: string | null;
	createdAt: string;
	customerRef?: { id: string; name: string } | null;
	customFields?: any;
	assignments?: { id: string; user: { id: string; name: string }; role: string }[];
	subtasks?: Subtask[];
};

type Subtask = {
	id: string;
	title: string;
	status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
	assigneeId?: string | null;
	dueAt?: string | null;
	order: number;
};

function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="border rounded-lg p-4">
						<div className="animate-pulse">
							<div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
							<div className="h-8 bg-gray-200 rounded w-1/3"></div>
						</div>
					</div>
				))}
			</div>
			<div className="border rounded-lg p-4">
				<div className="animate-pulse">
					<div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="border rounded p-3">
								<div className="h-4 bg-gray-200 rounded w-2/3"></div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export default function DashboardPage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!currentUser) return;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const res = await fetch("/api/tasks?limit=100&includeArchived=false&includeQuotations=false");
				if (res.ok) {
					const data = await res.json();
					setTasks(data.tasks || []);
				} else {
					setError("Failed to load tasks");
				}
			} catch {
				setError("Failed to load tasks. Check your connection and try again.");
			} finally {
				setLoading(false);
			}
		}

		load();
	}, [currentUser]);

	function isAssignedToMe(task: Task) {
		if (!currentUser || !task.assignments) return false;
		return task.assignments.some((a) => a.user.id === currentUser.id);
	}

	const activeTasks = tasks.filter((t) => t.status !== "ARCHIVED");

	// Workers see "My Day": only their own tasks. Admins/managers see
	// the whole board -- this matches the nav label ("My Day" vs
	// "Dashboard") which previously showed everyone identical
	// company-wide numbers regardless of role.
	const scopedTasks = isAdmin ? activeTasks : activeTasks.filter(isAssignedToMe);

	const totalTasks = scopedTasks.length;
	const inProgressTasks = scopedTasks.filter((t) => t.status === "IN_PROGRESS").length;
	const completedTasks = scopedTasks.filter((t) => t.status === "DONE").length;
	const overdueTasks = scopedTasks.filter((t) => {
		if (t.status === "DONE" || t.status === "CANCELLED" || !t.dueAt) return false;
		return new Date(t.dueAt) < new Date();
	}).length;

	const upcomingDeadlines = scopedTasks
		.filter((t) => {
			if (t.status === "DONE" || t.status === "CANCELLED" || !t.dueAt) return false;
			const dueDate = new Date(t.dueAt);
			const now = new Date();
			const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
			return dueDate >= now && dueDate <= sevenDaysFromNow;
		})
		.sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
		.slice(0, 5);

	if (loading) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-semibold">{isAdmin ? "Dashboard" : "My Day"}</h1>
				<DashboardSkeleton />
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-semibold">{isAdmin ? "Dashboard" : "My Day"}</h1>
				<div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-4 flex items-center justify-between">
					<span>{error}</span>
					<button
						onClick={() => window.location.reload()}
						className="text-sm underline underline-offset-2"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">{isAdmin ? "Dashboard" : "My Day"}</h1>
				{currentUser && (
					<span className="text-sm text-gray-500">
						{isAdmin ? "Company-wide" : `Showing tasks assigned to you`}
					</span>
				)}
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="border rounded-lg p-4">
					<h3 className="text-sm font-medium text-gray-600">{isAdmin ? "Total Tasks" : "My Tasks"}</h3>
					<p className="text-2xl font-bold">{totalTasks}</p>
				</div>
				<div className="border rounded-lg p-4">
					<h3 className="text-sm font-medium text-gray-600">In Progress</h3>
					<p className="text-2xl font-bold text-blue-600">{inProgressTasks}</p>
				</div>
				<div className="border rounded-lg p-4">
					<h3 className="text-sm font-medium text-gray-600">Completed</h3>
					<p className="text-2xl font-bold text-green-600">{completedTasks}</p>
				</div>
				<div className="border rounded-lg p-4">
					<h3 className="text-sm font-medium text-gray-600">Overdue</h3>
					<p className="text-2xl font-bold text-red-600">{overdueTasks}</p>
				</div>
			</div>

			<div className="border rounded-lg p-4">
				<h2 className="text-lg font-semibold mb-4">Upcoming Deadlines (Next 7 Days)</h2>
				{upcomingDeadlines.length === 0 ? (
					<p className="text-gray-500 text-sm">
						{isAdmin
							? "No upcoming deadlines across active tasks."
							: "Nothing due in the next 7 days. Nice."}
					</p>
				) : (
					<div className="space-y-3">
						{upcomingDeadlines.map((task) => (
							<Link
								key={task.id}
								href={`/tasks?open=${task.id}`}
								className="block border rounded-lg p-3 hover:bg-gray-50 transition-colors"
							>
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
									<div className="flex flex-wrap items-center gap-2 min-w-0">
										<div
											className={`w-2 h-2 rounded-full flex-shrink-0 ${
												task.priority === "URGENT"
													? "bg-red-500"
													: task.priority === "HIGH"
													? "bg-orange-500"
													: task.priority === "MEDIUM"
													? "bg-yellow-500"
													: "bg-green-500"
											}`}
										></div>
										<span className="font-medium truncate">{task.title}</span>
										<span className="text-sm text-gray-500 flex-shrink-0">
											{task.customerRef?.name || "No customer"}
										</span>
										{isAdmin && isAssignedToMe(task) && (
											<span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex-shrink-0">
												Assigned to me
											</span>
										)}
									</div>
									<div className="flex flex-col items-end gap-1 flex-shrink-0">
										<span className="text-sm font-medium">
											{new Date(task.dueAt!).toLocaleDateString()}
										</span>
										<span
											className={`text-xs px-2 py-1 rounded ${
												task.status === "TODO"
													? "bg-gray-100 text-gray-800"
													: task.status === "IN_PROGRESS"
													? "bg-blue-100 text-blue-800"
													: task.status === "BLOCKED"
													? "bg-red-100 text-red-800"
													: "bg-green-100 text-green-800"
											}`}
										>
											{task.status.replace("_", " ")}
										</span>
									</div>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
