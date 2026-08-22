"use client";
import React, { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";
import TaskComments from "@/components/TaskComments";
import { DESPATCH_ITEM_STATUS_LABELS, despatchItemStatusChipClass } from "@/lib/despatchItemStatus";

type Task = {
	id: string;
	title: string;
	description: string;
	status: string;
	priority: string;
	startAt?: string | null;
	dueAt: string | null;
	customerId?: string | null;
	customerRef?: { id: string; name: string; email: string } | null;
	customFields?: any;
	assignments?: { id: string; user: { id: string; name: string }; role: string }[];
	teamAssignments?: { id: string; team: { id: string; name: string } }[];
	subtasks?: Subtask[];
	despatchItems?: DespatchItem[];
	createdAt: string;
	updatedAt: string;
};

type Subtask = {
	id: string;
	title: string;
	status: string;
	assigneeId?: string | null;
	dueAt?: string | null;
	order: number;
};

type DespatchItem = {
	id: string;
	name: string;
	quantity: number;
	unit: string;
	status: string;
};

type Payment = { id: string; amount: number; mode: string; receivedAt: string; notes: string | null; recordedBy: { name: string } };
type ProofRequest = { id: string; status: string; files: { url: string; name: string }[]; customerNote: string | null; createdAt: string };

function ArchiveSkeleton() {
	return (
		<div className="space-y-4">
			{[1, 2, 3, 4, 5].map((i) => (
				<div key={i} className="border border-gray-200 rounded-lg p-4">
					<div className="animate-pulse space-y-2">
						<div className="h-4 bg-gray-200 rounded w-64 max-w-full"></div>
						<div className="h-3 bg-gray-200 rounded w-40"></div>
					</div>
				</div>
			))}
		</div>
	);
}

export default function ArchivePage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);

	const [teams, setTeams] = useState<{ id: string; name: string; memberIds: string[] }[]>([]);
	const canSeePayments = isAdmin || (!!currentUser && !!teams.find(t => t.name === "Accounts")?.memberIds.includes(currentUser.id));

	const [viewingId, setViewingId] = useState<string | null>(null);
	const [viewingTask, setViewingTask] = useState<Task | null>(null);
	const [viewingPayments, setViewingPayments] = useState<{ totalAmount: number | null; payments: Payment[] } | null>(null);
	const [viewingProofs, setViewingProofs] = useState<ProofRequest[] | null>(null);
	const [viewLoading, setViewLoading] = useState(false);

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
					setTasks(loaded.filter((t: Task) => t.status === "ARCHIVED"));
				}
			} catch (error) {
				console.error("Failed to load archived tasks:", error);
			} finally {
				setLoading(false);
			}
		}
		load();
	}, []);

	useEffect(() => {
		if (!currentUser) return;
		fetch("/api/teams")
			.then(r => r.ok ? r.json() : { teams: [] })
			.then(json => setTeams((json.teams ?? []).map((t: any) => ({ id: t.id, name: t.name, memberIds: (t.members ?? []).map((m: any) => m.userId) }))))
			.catch(() => {});
	}, [currentUser]);

	function isAssignedToMe(task: Task): boolean {
		if (!currentUser || !task.assignments) return false;
		return task.assignments.some(assignment => assignment.user.id === currentUser.id);
	}

	async function unarchiveTask(taskId: string) {
		if (!confirm("Unarchive this task? It will be moved back to active tasks.")) return;
		try {
			const res = await fetch(`/api/tasks/${taskId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "DONE" })
			});
			if (res.ok) {
				setTasks(prev => prev.filter(t => t.id !== taskId));
				if (viewingId === taskId) setViewingId(null);
			}
		} catch (error) {
			console.error("Failed to unarchive task:", error);
		}
	}

	async function openTask(taskId: string) {
		setViewingId(taskId);
		setViewLoading(true);
		setViewingTask(null);
		setViewingPayments(null);
		setViewingProofs(null);
		try {
			const [taskRes, proofsRes] = await Promise.all([
				fetch(`/api/tasks/${taskId}`),
				fetch(`/api/tasks/${taskId}/proof-requests`),
			]);
			if (taskRes.ok) {
				const json = await taskRes.json();
				setViewingTask({
					...json.task,
					customFields: typeof json.task.customFields === "string" ? (() => { try { return JSON.parse(json.task.customFields); } catch { return {}; } })() : (json.task.customFields || {})
				});
			}
			if (proofsRes.ok) {
				const json = await proofsRes.json();
				setViewingProofs(json.proofRequests ?? []);
			}
			if (canSeePayments) {
				const paymentsRes = await fetch(`/api/tasks/${taskId}/payments`);
				if (paymentsRes.ok) {
					const json = await paymentsRes.json();
					setViewingPayments({ totalAmount: json.totalAmount ?? null, payments: json.payments ?? [] });
				}
			}
		} finally {
			setViewLoading(false);
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
									<button
										type="button"
										onClick={() => openTask(task.id)}
										className="font-medium text-left hover:underline"
									>
										{task.title}
									</button>
									{task.customerRef?.name && (
										<span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-800">{task.customerRef.name}</span>
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
						</div>
					))}
				</div>
			)}

			{/* Task detail modal -- read-only history view, right on this page */}
			{viewingId && (() => {
				const total = viewingPayments?.totalAmount ?? null;
				const received = (viewingPayments?.payments ?? []).reduce((sum, p) => sum + p.amount, 0);
				const balance = total != null ? total - received : null;
				const latestProof = viewingProofs && viewingProofs.length > 0 ? viewingProofs[0] : null;

				return (
					<div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-50 p-3">
						<div className="card card-pad max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto !bg-[var(--raised)] shadow-lg">
							<div className="flex flex-wrap items-center justify-between gap-2 mb-4">
								<h2 className="text-xl font-semibold">{viewingTask?.title ?? "Loading…"}</h2>
								<div className="flex items-center gap-2">
									{viewingTask && (
										<button type="button" className="btn btn-outline btn-sm" onClick={() => unarchiveTask(viewingTask.id)}>
											Unarchive
										</button>
									)}
									<button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => setViewingId(null)}>✕</button>
								</div>
							</div>

							{viewLoading || !viewingTask ? (
								<div className="space-y-3">
									<div className="skeleton h-4 w-2/3" />
									<div className="skeleton h-4 w-1/2" />
									<div className="skeleton h-24 w-full" />
								</div>
							) : (
								<div className="space-y-5">
									<div>
										<h3 className="font-medium text-sm mb-1">Basic Information</h3>
										<div className="grid grid-cols-2 gap-3 text-sm">
											<div><span className="text-muted">Status:</span> <span className="chip chip-plain">{viewingTask.status}</span></div>
											<div><span className="text-muted">Created:</span> {new Date(viewingTask.createdAt).toLocaleString()}</div>
											{viewingTask.startAt && <div><span className="text-muted">Start:</span> {new Date(viewingTask.startAt).toLocaleString()}</div>}
											{viewingTask.dueAt && <div><span className="text-muted">Due:</span> {new Date(viewingTask.dueAt).toLocaleString()}</div>}
										</div>
										{viewingTask.description && <p className="text-sm mt-2">{viewingTask.description}</p>}
									</div>

									<div className="text-sm space-y-0.5">
										{viewingTask.customerRef?.name && <div>Customer: {viewingTask.customerRef.name}</div>}
										{((viewingTask.assignments?.length ?? 0) > 0 || (viewingTask.teamAssignments?.length ?? 0) > 0) && (
											<div>
												Assigned: {[
													...(viewingTask.assignments ?? []).map(a => a.user.name),
													...(viewingTask.teamAssignments ?? []).map(ta => `${ta.team.name} (team)`),
												].join(", ")}
											</div>
										)}
									</div>

									{viewingTask.despatchItems && viewingTask.despatchItems.length > 0 && (
										<div>
											<h3 className="font-medium text-sm mb-2">Items</h3>
											<div className="space-y-1.5">
												{viewingTask.despatchItems.map(item => (
													<div key={item.id} className="flex items-center justify-between text-sm bg-wash rounded-lg px-3 py-2">
														<span>{item.name} — {item.quantity} {item.unit}</span>
														<span className={despatchItemStatusChipClass(item.status)}>{DESPATCH_ITEM_STATUS_LABELS[item.status] ?? item.status}</span>
													</div>
												))}
											</div>
										</div>
									)}

									{viewingTask.subtasks && viewingTask.subtasks.length > 0 && (
										<div>
											<h3 className="font-medium text-sm mb-2">Subtasks</h3>
											<div className="space-y-1.5">
												{viewingTask.subtasks.map(s => (
													<div key={s.id} className="flex items-center justify-between text-sm bg-wash rounded-lg px-3 py-2">
														<span>{s.title}</span>
														<span className="chip chip-plain">{s.status}</span>
													</div>
												))}
											</div>
										</div>
									)}

									{latestProof && (
										<div>
											<h3 className="font-medium text-sm mb-2">Design proof</h3>
											<div className="text-sm space-y-1">
												<span className={latestProof.status === "APPROVED" ? "chip chip-ok" : latestProof.status === "REJECTED" ? "chip chip-danger" : "chip chip-plain"}>
													{latestProof.status}
												</span>{" "}
												{latestProof.files.length} file{latestProof.files.length === 1 ? "" : "s"} · {new Date(latestProof.createdAt).toLocaleDateString()}
												{latestProof.customerNote && <p className="text-danger mt-1">Customer feedback: {latestProof.customerNote}</p>}
											</div>
										</div>
									)}

									{canSeePayments && viewingPayments && (
										<div>
											<h3 className="font-medium text-sm mb-2">Payment</h3>
											<div className="flex flex-wrap gap-4 text-sm mb-2">
												<div>Total: <span className="font-medium">{total != null ? `₹${total.toLocaleString("en-IN")}` : "—"}</span></div>
												<div>Received: <span className="font-medium">₹{received.toLocaleString("en-IN")}</span></div>
												<div>Balance: <span className="font-medium">{balance != null ? `₹${balance.toLocaleString("en-IN")}` : "—"}</span></div>
											</div>
											{viewingPayments.payments.length > 0 && (
												<div className="space-y-1.5">
													{viewingPayments.payments.map(p => (
														<div key={p.id} className="flex items-center justify-between text-sm bg-wash rounded-lg px-3 py-2">
															<span>₹{p.amount.toLocaleString("en-IN")} · {p.mode} · {new Date(p.receivedAt).toLocaleDateString()}</span>
															<span className="text-muted">by {p.recordedBy.name}</span>
														</div>
													))}
												</div>
											)}
										</div>
									)}

									<div>
										<h3 className="font-medium text-sm mb-2">Comments</h3>
										<TaskComments taskId={viewingTask.id} />
									</div>
								</div>
							)}
						</div>
					</div>
				);
			})()}
		</div>
	);
}
