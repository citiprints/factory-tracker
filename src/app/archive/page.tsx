"use client";
import React, { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";

type Task = {
	id: string;
	title: string;
	description: string;
	status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED" | "ARCHIVED" | "CLIENT_TO_REVERT" | "OTHERS";
	priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	startAt?: string | null;
	dueAt: string | null;
	estimatedHours?: number | null;
	actualHours?: number | null;
	customerId?: string | null;
	customerRef?: { id: string; name: string; email: string } | null;
	jobNumber?: string | null;
	customFields?: any;
	assignments?: { id: string; user: { id: string; name: string }; role: string }[];
	subtasks?: Subtask[];
	createdAt: string;
	updatedAt: string;
};

type Subtask = {
	id: string;
	title: string;
	status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
	assigneeId?: string | null;
	dueAt?: string | null;
	order: number;
};

// Loading skeleton component
function ArchiveSkeleton() {
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

			{/* Tasks skeleton */}
			<div className="space-y-4">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="border border-gray-200 rounded-lg p-4">
						<div className="animate-pulse">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
								<div className="flex flex-wrap items-center gap-2 min-w-0">
									<div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0"></div>
									<div className="h-4 bg-gray-200 rounded w-64 sm:w-96 max-w-full"></div>
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

export default function ArchivePage() {
	const currentUser = useCurrentUser();
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function load() {
			setLoading(true);
			try {
				const res = await fetch("/api/tasks?includeArchived=true&limit=500");
				if (res.ok) {
					const json = await res.json();
					const loaded: Task[] = (json.tasks ?? []).map((t: any) => ({
						...t,
						customFields: typeof t.customFields === "string" ? (() => { try { return JSON.parse(t.customFields); } catch { return {}; } })() : (t.customFields || {})
					}));
					
					// Load subtasks for each task
					const tasksWithSubtasks = await Promise.all(
						loaded.map(async (task) => {
							const resSubtasks = await fetch(`/api/subtasks?taskId=${task.id}`);
							if (resSubtasks.ok) {
								const subtasksData = await resSubtasks.json();
								return { ...task, subtasks: subtasksData.subtasks || [] };
							}
							return { ...task, subtasks: [] };
						})
					);
					
					// Filter only archived tasks
					const archivedTasks = tasksWithSubtasks.filter(task => task.status === "ARCHIVED");
					setTasks(archivedTasks);
				}
			} catch (error) {
				console.error("Failed to load archived tasks:", error);
			} finally {
				setLoading(false);
			}
		}
		load();
	}, []);

	// Helper function to check if task is assigned to current user
	function isAssignedToMe(task: Task): boolean {
		if (!currentUser || !task.assignments) return false;
		return task.assignments.some(assignment => assignment.user.id === currentUser.id);
	}

	// Helper function to check if subtask is assigned to current user
	function isSubtaskAssignedToMe(subtask: Subtask): boolean {
		if (!currentUser || !subtask.assigneeId) return false;
		return subtask.assigneeId === currentUser.id;
	}

	// Function to unarchive a task
	async function unarchiveTask(taskId: string) {
		if (!confirm("Unarchive this task? It will be moved back to active tasks.")) return;
		
		try {
			const res = await fetch(`/api/tasks/${taskId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "DONE" })
			});
			
			if (res.ok) {
				// Remove from archived tasks list
				setTasks(tasks.filter(t => t.id !== taskId));
			}
		} catch (error) {
			console.error("Failed to unarchive task:", error);
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
				<div className="text-sm text-gray-600">
					{tasks.length} archived task{tasks.length !== 1 ? 's' : ''}
				</div>
			</div>

			{loading ? (
				<ArchiveSkeleton />
			) : tasks.length === 0 ? (
				<div className="text-center py-12">
					<div className="text-6xl mb-4">📦</div>
					<h2 className="text-xl font-medium mb-2">No archived tasks</h2>
					<p className="text-gray-600">Completed tasks will appear here when archived.</p>
				</div>
			) : (
				<div className="space-y-4">
					{tasks.map((task, index) => (
						<div key={task.id} className="border border-gray-300 rounded p-3 bg-gray-50">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span className="text-[10px] w-5 h-5 inline-flex items-center justify-center rounded-full bg-gray-600 text-white">{index + 1}</span>
									<a
										href={`/tasks?open=${task.id}`}
										className="font-medium text-left hover:underline"
									>
										{task.title}
									</a>
									{task.customFields?.quantity && (
										<span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Qty: {task.customFields.quantity}</span>
									)}
									{task.customerRef?.name && (
										<span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-800">{task.customerRef.name}</span>
									)}
									{task.customFields?.category && (
										<span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-800">{task.customFields.category}</span>
									)}
									{isAssignedToMe(task) && (
										<span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">Assigned to me</span>
									)}
								</div>
								<div className="flex items-center gap-2">
									<span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-600 text-white">ARCHIVED</span>
									<button
										onClick={() => unarchiveTask(task.id)}
										className="text-xs px-2 py-1 rounded border hover:bg-gray-100"
									>
										Unarchive
									</button>
								</div>
							</div>
							
							{task.dueAt && (
								<p className="text-xs text-gray-600 mt-1">
									Completed: {new Date(task.dueAt).toLocaleDateString()}
								</p>
							)}

							{/* Subtasks */}
							{task.subtasks && task.subtasks.length > 0 && (
								<div className="mt-2 pt-2 border-t border-gray-200 ml-6 space-y-1">
									{task.subtasks.map(subtask => (
										<div key={subtask.id} className="flex items-center justify-between text-sm">
											<div className="flex items-center gap-2">
												<span className="text-gray-600">• {subtask.title}</span>
												{isSubtaskAssignedToMe(subtask) && (
													<span className="text-[10px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-800">Assigned to me</span>
												)}
											</div>
											<span className="text-[10px] px-1 py-0.5 rounded-full bg-green-100 text-green-800">{subtask.status}</span>
										</div>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			)}

		</div>
	);
}
