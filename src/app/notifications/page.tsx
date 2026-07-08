"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, EmptyState, Spinner } from "@/components/ui";

type Notification = {
	id: string;
	title: string;
	body: string;
	type: string;
	linkPath: string | null;
	readAt: string | null;
	createdAt: string;
};

export default function NotificationsPage() {
	const router = useRouter();
	const [notifications, setNotifications] = useState<Notification[] | null>(null);
	const [markingAll, setMarkingAll] = useState(false);

	async function load() {
		const res = await fetch("/api/notifications");
		if (res.ok) {
			const data = await res.json();
			setNotifications(data.notifications);
		}
	}

	useEffect(() => {
		load();
	}, []);

	async function openNotification(n: Notification) {
		if (!n.readAt) {
			await fetch("/api/notifications", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id: n.id }),
			}).catch(() => {});
		}
		if (n.linkPath) router.push(n.linkPath);
	}

	async function markAllRead() {
		setMarkingAll(true);
		await fetch("/api/notifications", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ all: true }),
		}).catch(() => {});
		await load();
		setMarkingAll(false);
	}

	const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

	return (
		<div className="max-w-2xl mx-auto">
			<PageHeader
				title="Notifications"
				subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
				actions={
					unreadCount > 0 && (
						<button onClick={markAllRead} disabled={markingAll} className="btn btn-outline btn-sm">
							{markingAll ? "Marking…" : "Mark all read"}
						</button>
					)
				}
			/>

			{notifications === null ? (
				<Spinner />
			) : notifications.length === 0 ? (
				<EmptyState title="No notifications yet" hint="Task and shift assignments will show up here." />
			) : (
				<div className="space-y-2">
					{notifications.map((n) => (
						<button
							key={n.id}
							onClick={() => openNotification(n)}
							className={`w-full text-left card p-3.5 hover:shadow-md transition-shadow ${!n.readAt ? "border-accent" : ""}`}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										{!n.readAt && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
										<span className="font-medium">{n.title}</span>
									</div>
									<p className="text-sm text-muted mt-0.5">{n.body}</p>
								</div>
								<span className="meta shrink-0">
									{new Date(n.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
								</span>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
