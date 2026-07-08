"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { Spinner } from "@/components/ui";

type TaskComment = {
	id: string;
	body: string;
	createdAt: string;
	author: { id: string; name: string };
};

type MentionableUser = { id: string; name: string };

/** Renders a comment body, highlighting @Name mentions that match a real user. */
function renderWithMentions(body: string, mentionable: MentionableUser[]) {
	if (mentionable.length === 0) return body;
	// Longest names first so "John Smith" matches before "John" alone.
	const names = [...mentionable.map((u) => u.name)].sort((a, b) => b.length - a.length);
	const pattern = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");
	const parts: (string | { mention: string })[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(body)) !== null) {
		if (match.index > lastIndex) parts.push(body.slice(lastIndex, match.index));
		parts.push({ mention: match[1] });
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < body.length) parts.push(body.slice(lastIndex));
	return parts.map((p, i) =>
		typeof p === "string" ? (
			<span key={i}>{p}</span>
		) : (
			<span key={i} className="text-accent font-medium">
				@{p.mention}
			</span>
		)
	);
}

export default function TaskComments({ taskId, mentionable = [] }: { taskId: string; mentionable?: MentionableUser[] }) {
	const [comments, setComments] = useState<TaskComment[] | null>(null);
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// @mention autocomplete state
	const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = not active
	const [mentionStart, setMentionStart] = useState(0);

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
		const interval = setInterval(load, 8000);
		return () => clearInterval(interval);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [taskId]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "nearest" });
	}, [comments?.length]);

	const mentionMatches = useMemo(() => {
		if (mentionQuery === null) return [];
		const q = mentionQuery.toLowerCase();
		return mentionable.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6);
	}, [mentionQuery, mentionable]);

	function handleDraftChange(value: string, cursorPos: number) {
		setDraft(value);
		// Find an unfinished "@word" ending exactly at the cursor.
		const upToCursor = value.slice(0, cursorPos);
		const m = /@([a-zA-Z0-9 ]{0,30})$/.exec(upToCursor);
		if (m) {
			setMentionQuery(m[1]);
			setMentionStart(cursorPos - m[1].length - 1);
		} else {
			setMentionQuery(null);
		}
	}

	function insertMention(name: string) {
		const ta = textareaRef.current;
		const cursorPos = ta?.selectionStart ?? draft.length;
		const before = draft.slice(0, mentionStart);
		const after = draft.slice(cursorPos);
		const next = `${before}@${name} ${after}`;
		setDraft(next);
		setMentionQuery(null);
		requestAnimationFrame(() => {
			const pos = before.length + name.length + 2;
			ta?.focus();
			ta?.setSelectionRange(pos, pos);
		});
	}

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
			setMentionQuery(null);
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
								<p className="text-fg whitespace-pre-wrap mt-0.5">{renderWithMentions(c.body, mentionable)}</p>
							</div>
						))
					)}
					<div ref={bottomRef} />
				</div>
				<form onSubmit={send} className="relative flex items-end gap-2 p-2.5 border-t border-line">
					{mentionQuery !== null && mentionMatches.length > 0 && (
						<div className="absolute bottom-full left-2.5 mb-1 w-56 card !bg-[var(--raised)] shadow-lg py-1 max-h-40 overflow-y-auto z-10">
							{mentionMatches.map((u) => (
								<button
									key={u.id}
									type="button"
									onClick={() => insertMention(u.name)}
									className="w-full text-left px-3 py-1.5 text-sm hover:bg-wash"
								>
									{u.name}
								</button>
							))}
						</div>
					)}
					<textarea
						ref={textareaRef}
						className="input flex-1 !min-h-[2.5rem]"
						rows={1}
						placeholder="Write a comment… (@ to mention someone)"
						value={draft}
						onChange={(e) => handleDraftChange(e.target.value, e.target.selectionStart)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setMentionQuery(null);
							if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
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
