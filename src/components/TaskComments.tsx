"use client";
import { useEffect, useState, useRef } from "react";
import { Spinner } from "@/components/ui";

type TaskComment = {
	id: string;
	body: string;
	createdAt: string;
	author: { id: string; name: string };
};

export default function TaskComments({ taskId }: { taskId: string }) {
	const [comments, setComments] = useState<TaskComment[] | null>(null);
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const bottomRef = useRef<HTMLDivElement>(null);

	async function load() {
		try {
			const res = await fetch(`/api/tasks/${taskId}/comments`);
			if (res.ok) {
				const data = await res.json();
				setComments(data.comments);
			}
		} catch {
			// leave whatever was already loaded
		}
	}

	useEffect(() => {
		load();
		// Light polling so a second person's message shows up without a
		// full page reload, without needing a websocket for a small team.
		const interval = setInterval(load, 8000);
		return () => clearInterval(interval);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [taskId]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "nearest" });
	}, [comments?.length]);

	async function send(e: React.FormEvent) {
		e.preventDefault();
		if (!draft.trim()) return;
		setSending(true);
		setError(null);
		try {
			const res = await fetch(`/api/tasks/${taskId}/comments`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ body: draft.trim() }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				setError(data.error || "Couldn't send that.");
				return;
			}
			setDraft("");
			await load();
		} catch {
			setError("Couldn't send — check your connection and try again.");
		} finally {
			setSending(false);
		}
	}

	return (
		<div>
			<h3 className="font-medium text-gray-900 mb-2">Comments</h3>
			<div className="border border-line rounded-lg bg-wash">
				<div className="max-h-64 overflow-y-auto p-3 space-y-3">
					{comments === null ? (
						<Spinner label="Loading comments…" />
					) : comments.length === 0 ? (
						<p className="text-sm text-muted text-center py-3">No comments yet — start the conversation.</p>
					) : (
						comments.map((c) => (
							<div key={c.id} className="text-sm">
								<div className="flex items-baseline gap-2">
									<span className="font-medium">{c.author.name}</span>
									<span className="meta">
										{new Date(c.createdAt).toLocaleString(undefined, {
											day: "2-digit",
											month: "short",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								</div>
								<p className="text-fg whitespace-pre-wrap mt-0.5">{c.body}</p>
							</div>
						))
					)}
					<div ref={bottomRef} />
				</div>
				<form onSubmit={send} className="flex items-end gap-2 p-2.5 border-t border-line">
					<textarea
						className="input flex-1 !min-h-[2.5rem]"
						rows={1}
						placeholder="Write a comment…"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								send(e);
							}
						}}
					/>
					<button type="submit" disabled={sending || !draft.trim()} className="btn btn-primary btn-sm">
						{sending ? "…" : "Send"}
					</button>
				</form>
				{error && <div className="alert alert-danger m-2.5 mt-0">{error}</div>}
			</div>
		</div>
	);
}
