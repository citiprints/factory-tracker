"use client";
import React, { useEffect, useState } from "react";

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
	const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [viewingId, setViewingId] = useState<string | null>(null);

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

	useEffect(() => {
		async function load() {
			setLoading(true);
			try {
				const res = await fetch("/api/tasks");
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
				<h1 className="text-2xl font-semibold">Archived Tasks</h1>
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
									<button 
										onClick={() => setViewingId(task.id)} 
										className="font-medium text-left hover:underline"
									>
										{task.title}
									</button>
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

			{/* View Task Modal */}
			{viewingId && (() => {
				const task = tasks.find(t => t.id === viewingId);
				if (!task) return null;
				
				return (
					<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
						<div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
							<div className="flex flex-wrap items-center justify-between gap-2 mb-4">
								<h2 className="text-xl font-semibold">Archived Task Details</h2>
								<button
									type="button"
									className="text-gray-500 hover:text-gray-700"
									onClick={() => setViewingId(null)}
								>
									✕
								</button>
							</div>
							
							<div className="space-y-4">
								{/* Basic Info */}
								<div>
									<h3 className="font-medium text-gray-900 mb-2">Basic Information</h3>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-gray-700">Title</label>
											<p className="text-sm text-gray-900">{task.title}</p>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700">Status</label>
											<span className="inline-block px-2 py-1 text-xs rounded bg-gray-600 text-white">
												{task.status}
											</span>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700">Description</label>
											<p className="text-sm text-gray-900">{task.description || "No description"}</p>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700">Created</label>
											<p className="text-sm text-gray-900">{new Date(task.createdAt).toLocaleString()}</p>
										</div>
									</div>
								</div>

								{/* Dates */}
								{(task.startAt || task.dueAt) && (
									<div>
										<h3 className="font-medium text-gray-900 mb-2">Dates</h3>
										<div className="grid grid-cols-2 gap-4">
											{task.startAt && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Start Date</label>
													<p className="text-sm text-gray-900">{new Date(task.startAt).toLocaleString()}</p>
												</div>
											)}
											{task.dueAt && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Due Date</label>
													<p className="text-sm text-gray-900">{new Date(task.dueAt).toLocaleString()}</p>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Customer & Assignments */}
								{(task.customerRef || task.assignments?.length) && (
									<div>
										<h3 className="font-medium text-gray-900 mb-2">Customer & Assignments</h3>
										<div className="space-y-2">
											{task.customerRef && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Customer</label>
													<p className="text-sm text-gray-900">{task.customerRef.name}</p>
												</div>
											)}
											{task.assignments && task.assignments.length > 0 && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Assigned To</label>
													<div className="flex flex-wrap gap-1 mt-1">
														{task.assignments.map(a => (
															<span key={a.id} className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-800">
																{a.user.name}
															</span>
														))}
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Custom Fields */}
								{task.customFields && Object.keys(task.customFields).length > 0 && (
									<div>
										<h3 className="font-medium text-gray-900 mb-2">Custom Fields</h3>
										<div className="space-y-2">
											{task.customFields.quantity && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Quantity</label>
													<p className="text-sm text-gray-900">{task.customFields.quantity}</p>
												</div>
											)}
											{task.customFields.category && (
												<div>
													<label className="block text-sm font-medium text-gray-700">Category</label>
													<p className="text-sm text-gray-900">{task.customFields.category}</p>
												</div>
											)}
											
											{/* Rigid Box specific fields */}
											{task.customFields.category === "Rigid Boxes" && (
												<div className="border border-gray-200 rounded p-3 bg-gray-50">
													<h4 className="font-medium text-sm mb-2">Rigid Box Specifications</h4>
													<div className="grid grid-cols-2 gap-3 text-sm">
														{task.customFields.boxType && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Box Type</label>
																<p className="text-gray-900">{task.customFields.boxType}</p>
															</div>
														)}
														{task.customFields.size && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Size</label>
																<p className="text-gray-900">
																	{task.customFields.size}
																	{task.customFields.existingSize && " (Existing size)"}
																</p>
															</div>
														)}
														{task.customFields.topOuter && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Top Outer</label>
																<p className="text-gray-900">{task.customFields.topOuter}</p>
															</div>
														)}
														{task.customFields.topInner && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Top Inner</label>
																<p className="text-gray-900">{task.customFields.topInner}</p>
															</div>
														)}
														{task.customFields.bottomOuter && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Bottom Outer</label>
																<p className="text-gray-900">{task.customFields.bottomOuter}</p>
															</div>
														)}
														{task.customFields.bottomInner && (
															<div>
																<label className="block text-xs font-medium text-gray-600">Bottom Inner</label>
																<p className="text-gray-900">{task.customFields.bottomInner}</p>
															</div>
														)}
														{task.customFields.hasPartition && (
															<div className="col-span-2">
																<label className="block text-xs font-medium text-gray-600">Partition</label>
																<p className="text-gray-900">
																	Yes
																	{task.customFields.partitionDescription && ` - ${task.customFields.partitionDescription}`}
																</p>
															</div>
														)}
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Attachments */}
								{task.customFields?.attachments && task.customFields.attachments.length > 0 && (
									<div>
										<h3 className="font-medium text-gray-900 mb-2">Attachments</h3>
										<div className="space-y-2">
											{task.customFields.attachments.map((attachment: string, index: number) => (
												<div key={index} className="flex items-center gap-2">
													<a
														href={attachment.startsWith('http') ? attachment : attachment.startsWith('/api/files/') ? attachment : `/api/files/${encodeURIComponent(attachment)}`}
														target="_blank"
														rel="noopener noreferrer"
														className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
													>
														📎 {attachment}
													</a>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Subtasks */}
								{task.subtasks && task.subtasks.length > 0 && (
									<div>
										<h3 className="font-medium text-gray-900 mb-2">Subtasks</h3>
										<div className="space-y-2">
											{task.subtasks.map(subtask => (
												<div key={subtask.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
													<div className="flex items-center gap-2">
														<span className="text-sm">{subtask.title}</span>
														{isSubtaskAssignedToMe(subtask) && (
															<span className="text-[10px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-800">Assigned to me</span>
														)}
													</div>
													<span className="text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-800">{subtask.status}</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				);
			})()}
		</div>
	);
}
