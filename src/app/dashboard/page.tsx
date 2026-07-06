"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState, statusChip, priorityChip, ticketColor } from "@/components/ui";

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
};

function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="card card-pad">
						<div className="skeleton h-3 w-1/2 mb-3" />
						<div className="skeleton h-8 w-1/3" />
					</div>
				))}
			</div>
			<div className="card card-pad">
				<div className="skeleton h-5 w-1/4 mb-4" />
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="skeleton h-14 w-full" />
					))}
				</div>
			</div>
		</div>
	);
}

function ClockCard() {
	const [state, setState] = useState<null | { clockedIn: boolean; since?: string; location?: string }>(null);

	useEffect(() => {
		fetch("/api/attendance/status")
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (!d) return;
				setState({
					clockedIn: d.clockedIn,
					since: d.openLog?.clockInAt,
					location: d.openLog?.location?.name,
				});
			})
			.catch(() => {});
	}, []);

	if (!state) return null;

	return (
		<Link
			href="/attendance"
			className="ticket block p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow"
			style={{ ["--ticket" as any]: state.clockedIn ? "var(--ok)" : "var(--warn)" }}
		>
			<div className="min-w-0">
				<div className="font-semibold">
					{state.clockedIn ? "You're clocked in" : "You're not clocked in"}
				</div>
				<div className="meta mt-0.5">
					{state.clockedIn
						? `since ${state.since ? new Date(state.since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}${state.location ? ` · ${state.location}` : ""}`
						: "Tap to clock in for your shift"}
				</div>
			</div>
			<span className={state.clockedIn ? "chip chip-ok" : "chip chip-warn"}>
				{state.clockedIn ? "ON SHIFT" : "OFF SHIFT"}
			</span>
		</Link>
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
					setError("Couldn't load tasks.");
				}
			} catch {
				setError("Couldn't load tasks. Check your connection and try again.");
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
	// Workers see only their own tasks; admins see the whole board.
	const scopedTasks = isAdmin ? activeTasks : activeTasks.filter(isAssignedToMe);

	const now = new Date();
	const openTasks = scopedTasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED").length;
	const inProgressTasks = scopedTasks.filter((t) => t.status === "IN_PROGRESS").length;
	const completedTasks = scopedTasks.filter((t) => t.status === "DONE").length;
	const overdueTasks = scopedTasks.filter((t) => {
		if (t.status === "DONE" || t.status === "CANCELLED" || !t.dueAt) return false;
		return new Date(t.dueAt) < now;
	}).length;

	const upcomingDeadlines = scopedTasks
		.filter((t) => {
			if (t.status === "DONE" || t.status === "CANCELLED" || !t.dueAt) return false;
			const dueDate = new Date(t.dueAt);
			const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
			return dueDate >= now && dueDate <= sevenDays;
		})
		.sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
		.slice(0, 6);

	const today = now.toLocaleDateString(undefined, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	const stats: { label: string; value: number; tone?: string }[] = [
		{ label: isAdmin ? "Open tasks" : "My open tasks", value: openTasks },
		{ label: "In progress", value: inProgressTasks, tone: "text-accent" },
		{ label: "Completed", value: completedTasks, tone: "text-ok" },
		{ label: "Overdue", value: overdueTasks, tone: overdueTasks > 0 ? "text-danger" : undefined },
	];

	return (
		<div className="space-y-6">
			<PageHeader
				title={isAdmin ? "Dashboard" : "My day"}
				subtitle={
					<>
						{today} · {isAdmin ? "company-wide" : "your assignments"}
					</>
				}
			/>

			{!isAdmin && <ClockCard />}

			{loading ? (
				<DashboardSkeleton />
			) : error ? (
				<div className="alert alert-danger">
					<span>{error}</span>
					<button onClick={() => window.location.reload()} className="underline underline-offset-2 font-medium shrink-0">
						Retry
					</button>
				</div>
			) : (
				<>
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
						{stats.map((s) => (
							<Link key={s.label} href="/tasks" className="card card-pad hover:shadow-md transition-shadow">
								<div className="meta">{s.label.toUpperCase()}</div>
								<div className={`text-3xl font-semibold mt-1 font-mono tabular-nums ${s.tone ?? ""}`}>
									{s.value}
								</div>
							</Link>
						))}
					</div>

					<section>
						<div className="flex items-baseline justify-between mb-3">
							<h2 className="text-lg font-semibold tracking-tight">Due in the next 7 days</h2>
							<Link href="/tasks" className="text-sm text-accent font-medium hover:text-accent-strong">
								All tasks →
							</Link>
						</div>

						{upcomingDeadlines.length === 0 ? (
							<EmptyState
								title="Nothing due this week"
								hint={isAdmin ? "No upcoming deadlines across active tasks." : "You have no deadlines in the next 7 days."}
							/>
						) : (
							<div className="space-y-2.5">
								{upcomingDeadlines.map((task) => {
									const st = statusChip(task.status);
									const pr = priorityChip(task.priority);
									return (
										<Link
											key={task.id}
											href={`/tasks?open=${task.id}`}
											className="ticket block p-3.5 hover:shadow-md transition-shadow"
											style={ticketColor(task.status)}
										>
											<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
												<div className="flex flex-wrap items-center gap-2 min-w-0">
													<span className="font-medium truncate">{task.title}</span>
													<span className={pr.cls}>{pr.label}</span>
													{isAdmin && isAssignedToMe(task) && (
														<span className="chip chip-info chip-plain">ME</span>
													)}
												</div>
												<div className="flex items-center gap-2.5 shrink-0">
													<span className="meta">
														{task.customerRef?.name ? `${task.customerRef.name} · ` : ""}
														due {new Date(task.dueAt!).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
													</span>
													<span className={st.cls}>{st.label}</span>
												</div>
											</div>
										</Link>
									);
								})}
							</div>
						)}
					</section>
				</>
			)}
		</div>
	);
}
