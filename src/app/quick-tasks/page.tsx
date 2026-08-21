"use client";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui";

type QuickTask = {
	id: string;
	text: string;
	dueAt: string | null;
	done: boolean;
	createdAt: string;
};

function formatDue(dueAt: string): string {
	const due = new Date(dueAt);
	const dateLabel = due.toLocaleDateString();
	const timeLabel = due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	const startOfToday = new Date(new Date().toDateString());
	const startOfDue = new Date(due.toDateString());
	const days = Math.round((startOfDue.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
	const relative = days === 0 ? "today" : days > 0 ? `${days} day${days === 1 ? "" : "s"} left` : `overdue by ${-days} day${days === -1 ? "" : "s"}`;
	return `${dateLabel} ${timeLabel} (${relative})`;
}

export default function QuickTasksPage() {
	const [quickTasks, setQuickTasks] = useState<QuickTask[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [text, setText] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [dueTime, setDueTime] = useState("17:00");
	const [creating, setCreating] = useState(false);

	async function load() {
		try {
			const res = await fetch("/api/quick-tasks");
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				setError(json.error || "Couldn't load quick tasks.");
				return;
			}
			const json = await res.json();
			setQuickTasks(json.quickTasks ?? []);
		} catch {
			setError("Couldn't load quick tasks. Check your connection and try again.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		if (!text.trim()) return;
		setCreating(true);
		setError(null);
		try {
			const dueAt = dueDate ? `${dueDate}T${dueTime || "17:00"}` : null;
			const res = await fetch("/api/quick-tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: text.trim(), dueAt }),
			});
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				setError(json.error || "Couldn't add that.");
				return;
			}
			setText("");
			setDueDate("");
			setDueTime("17:00");
			await load();
		} finally {
			setCreating(false);
		}
	}

	async function toggleDone(qt: QuickTask) {
		setQuickTasks(prev => prev.map(t => t.id === qt.id ? { ...t, done: !t.done } : t));
		const res = await fetch(`/api/quick-tasks/${qt.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ done: !qt.done }),
		});
		if (!res.ok) {
			setQuickTasks(prev => prev.map(t => t.id === qt.id ? { ...t, done: qt.done } : t));
		} else {
			load();
		}
	}

	async function remove(id: string) {
		setQuickTasks(prev => prev.filter(t => t.id !== id));
		await fetch(`/api/quick-tasks/${id}`, { method: "DELETE" });
	}

	const pending = quickTasks.filter(t => !t.done);
	const done = quickTasks.filter(t => t.done);

	return (
		<div className="max-w-xl mx-auto space-y-5">
			<PageHeader title="Quick Tasks" subtitle="One-line to-dos, separate from the job board." />

			<form onSubmit={onCreate} className="card card-pad space-y-3">
				<input
					className="input"
					placeholder="What needs doing?"
					value={text}
					onChange={(e) => setText(e.target.value)}
					required
				/>
				<div className="flex gap-2">
					<input type="date" className="input flex-[3]" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
					<input type="time" className="input flex-[2]" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!dueDate} />
				</div>
				{error && <div className="alert alert-danger">{error}</div>}
				<button disabled={creating || !text.trim()} className="btn btn-primary btn-block">
					{creating ? "Adding…" : "+ Add"}
				</button>
			</form>

			{loading ? (
				<div className="space-y-2">
					{[1, 2, 3].map(i => (
						<div key={i} className="card p-4">
							<div className="skeleton h-4 w-2/3" />
						</div>
					))}
				</div>
			) : quickTasks.length === 0 ? (
				<EmptyState title="Nothing here yet" hint="Add your first quick task above." />
			) : (
				<div className="space-y-4">
					<ul className="space-y-2">
						{pending.map(qt => (
							<li key={qt.id} className="card p-4 flex items-start gap-3">
								<input type="checkbox" checked={qt.done} onChange={() => toggleDone(qt)} className="mt-1" />
								<div className="min-w-0 flex-1">
									<div>{qt.text}</div>
									{qt.dueAt && <div className="meta mt-0.5">{formatDue(qt.dueAt)}</div>}
								</div>
								<button type="button" className="text-xs text-danger hover:underline shrink-0" onClick={() => remove(qt.id)}>
									Delete
								</button>
							</li>
						))}
					</ul>

					{done.length > 0 && (
						<details>
							<summary className="text-sm text-muted cursor-pointer">{done.length} done</summary>
							<ul className="space-y-2 mt-2">
								{done.map(qt => (
									<li key={qt.id} className="card p-4 flex items-start gap-3 opacity-60">
										<input type="checkbox" checked={qt.done} onChange={() => toggleDone(qt)} className="mt-1" />
										<div className="min-w-0 flex-1">
											<div className="line-through">{qt.text}</div>
											{qt.dueAt && <div className="meta mt-0.5">{formatDue(qt.dueAt)}</div>}
										</div>
										<button type="button" className="text-xs text-danger hover:underline shrink-0" onClick={() => remove(qt.id)}>
											Delete
										</button>
									</li>
								))}
							</ul>
						</details>
					)}
				</div>
			)}
		</div>
	);
}
