"use client";
import React, { useEffect, useState } from "react";

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
			{/* KPIs Skeleton */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="border border-gray-200 rounded-lg p-4">
						<div className="animate-pulse">
							<div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
							<div className="h-8 bg-gray-200 rounded w-1/3"></div>
						</div>
					</div>
				))}
			</div>

			{/* Upcoming Deadlines Skeleton */}
			<div className="border border-black rounded p-4">
				<div className="animate-pulse">
					<div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="border border-gray-200 rounded p-3">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
									<div className="flex flex-wrap items-center gap-2 min-w-0">
										<div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0"></div>
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
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

export default function DashboardPage() {
	const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

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

	// Load tasks
	useEffect(() => {
		if (!currentUser) return;

		async function load() {
			setLoading(true);
			try {
				const res = await fetch("/api/tasks?limit=100&includeArchived=false&includeQuotations=false");
				if (res.ok) {
					const data = await res.json();
					setTasks(data.tasks || []);
				} else {
					setError("Failed to load tasks");
				}
			} catch (error) {
				setError("Failed to load tasks");
			} finally {
				setLoading(false);
			}
		}

		load();
	}, [currentUser]);

	// Filter out archived tasks from dashboard
	const activeTasks = tasks.filter(task => task.status !== "ARCHIVED");

	// Calculate KPIs
	const totalTasks = activeTasks.length;
	const inProgressTasks = activeTasks.filter(task => task.status === "IN_PROGRESS").length;
	const completedTasks = activeTasks.filter(task => task.status === "DONE").length;
	const overdueTasks = activeTasks.filter(task => {
		if (task.status === "DONE" || task.status === "CANCELLED" || !task.dueAt) return false;
		return new Date(task.dueAt) < new Date();
	}).length;

	// Get upcoming deadlines (next 7 days)
	const upcomingDeadlines = activeTasks
		.filter(task => {
			if (task.status === "DONE" || task.status === "CANCELLED" || !task.dueAt) return false;
			const dueDate = new Date(task.dueAt);
			const now = new Date();
			const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
			return dueDate >= now && dueDate <= sevenDaysFromNow;
		})
		.sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
		.slice(0, 5);

	// Helper function to check if current user is assigned to task
	function isAssignedToMe(task: Task) {
		if (!currentUser || !task.assignments) return false;
		return task.assignments.some(assignment => assignment.user.id === currentUser.id);
	}

	// Helper function to check if current user is assigned to subtask
	function isAssignedToSubtask(subtask: Subtask) {
		if (!currentUser || !subtask.assigneeId) return false;
		return subtask.assigneeId === currentUser.id;
	}

	if (loading) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-semibold">Dashboard</h1>
				<DashboardSkeleton />
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-semibold">Dashboard</h1>
				<p className="text-red-600">{error}</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-semibold">Dashboard</h1>

			{/* KPIs */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="border border-gray-200 rounded-lg p-4">
					<h3 className="text-sm font-medium text-gray-600">Total Tasks</h3>
					<p className="text-2xl font-bold">{totalTasks}</p>
				</div>
				<div className="border border-gray-200 rounded-lg p-4">
					<h3 className="text-sm font-medium text-gray-600">In Progress</h3>
					<p className="text-2xl font-bold text-blue-600">{inProgressTasks}</p>
				</div>
				<div className="border border-gray-200 rounded-lg p-4">
					<h3 className="text-sm font-medium text-gray-600">Completed</h3>
					<p className="text-2xl font-bold text-green-600">{completedTasks}</p>
				</div>
				<div className="border border-gray-200 rounded-lg p-4">
					<h3 className="text-sm font-medium text-gray-600">Overdue</h3>
					<p className="text-2xl font-bold text-red-600">{overdueTasks}</p>
				</div>
			</div>

			{/* Upcoming Deadlines */}
			<div className="border border-black rounded p-4">
				<h2 className="text-lg font-semibold mb-4">Upcoming Deadlines (Next 7 Days)</h2>
				{upcomingDeadlines.length === 0 ? (
					<p className="text-gray-500">No upcoming deadlines</p>
				) : (
					<div className="space-y-4">
						{upcomingDeadlines.map(task => (
							<div key={task.id} className="border border-gray-200 rounded p-3">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
									<div className="flex flex-wrap items-center gap-2 min-w-0">
										<div className={`w-2 h-2 rounded-full flex-shrink-0 ${
											task.priority === "URGENT" ? "bg-red-500" :
											task.priority === "HIGH" ? "bg-orange-500" :
											task.priority === "MEDIUM" ? "bg-yellow-500" : "bg-green-500"
										}`}></div>
										<span className="font-medium truncate">{task.title}</span>
										<span className="text-sm text-gray-500 flex-shrink-0">
											{task.customerRef?.name || "No Customer"}
										</span>
										{isAssignedToMe(task) && (
											<span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex-shrink-0">
												Assigned to me
											</span>
										)}
									</div>
									<div className="flex flex-col items-end gap-1 flex-shrink-0">
										<span className="text-sm font-medium">
											{new Date(task.dueAt!).toLocaleDateString()}
										</span>
										<span className={`text-xs px-2 py-1 rounded ${
											task.status === "TODO" ? "bg-gray-100 text-gray-800" :
											task.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" :
											task.status === "BLOCKED" ? "bg-red-100 text-red-800" :
											"bg-green-100 text-green-800"
										}`}>
											{task.status.replace("_", " ")}
										</span>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
