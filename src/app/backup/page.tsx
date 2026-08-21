"use client";
import { useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";

export default function BackupPage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function downloadBackup() {
		setDownloading(true);
		setError(null);
		try {
			const res = await fetch("/api/backup");
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				setError(json.error || "Couldn't generate the backup.");
				return;
			}
			const blob = await res.blob();
			const disposition = res.headers.get("Content-Disposition") || "";
			const match = disposition.match(/filename="(.+)"/);
			const filename = match?.[1] || `factory-tracker-backup-${new Date().toISOString().slice(0, 10)}.zip`;

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch {
			setError("Couldn't generate the backup. Check your connection and try again.");
		} finally {
			setDownloading(false);
		}
	}

	if (currentUser && !isAdmin) {
		return (
			<div className="max-w-2xl mx-auto">
				<EmptyState title="Admins only" hint="Backups aren't available to this account." />
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto space-y-5">
			<PageHeader title="Backup" subtitle="Download everything to your computer, on demand." />

			<section className="card card-pad space-y-4">
				<div>
					<h2 className="font-semibold mb-1">Full backup</h2>
					<p className="text-sm text-muted">
						A single .zip you can save anywhere and open anytime -- no need to be signed in or
						online to look through it later. It includes:
					</p>
				</div>
				<ul className="text-sm text-muted list-disc pl-5 space-y-1">
					<li>Every task, subtask, item, payment, comment, and customer as JSON (<code>data/</code>)</li>
					<li>Every uploaded file -- attachments, onboarding uploads, everything in R2 (<code>files/</code>)</li>
					<li>The full audit trail and attendance/shift history</li>
					<li>A <code>manifest.json</code> listing exactly what's included and generated when/by whom</li>
				</ul>
				<p className="text-xs text-muted">
					Excluded on purpose: account passwords, login sessions, and device push tokens --
					none of that is needed to view your data, and it shouldn&apos;t leave the server. See
					the manifest for the full exclusion list.
				</p>

				{error && <div className="alert alert-danger">{error}</div>}

				<button type="button" className="btn btn-primary" onClick={downloadBackup} disabled={downloading}>
					{downloading ? "Preparing backup…" : "Download full backup"}
				</button>
				{downloading && (
					<p className="text-xs text-muted">This can take a minute or two depending on how many files are stored -- don&apos;t close this tab.</p>
				)}
			</section>
		</div>
	);
}
