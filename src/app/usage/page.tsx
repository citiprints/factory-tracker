"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";

type UsageData = {
	database: { usedBytes: number; freeTierBytes: number };
	files: { usedBytes: number; objectCount: number; freeTierBytes: number };
};

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`;
}

function UsageCard({ title, usedBytes, freeTierBytes, extra }: { title: string; usedBytes: number; freeTierBytes: number; extra?: string }) {
	const pct = Math.min(100, (usedBytes / freeTierBytes) * 100);
	const barClass = pct >= 90 ? "bg-red-600" : pct >= 70 ? "bg-amber-500" : "bg-green-600";

	return (
		<section className="card card-pad space-y-3">
			<div className="flex items-baseline justify-between gap-2">
				<h2 className="font-semibold">{title}</h2>
				<span className="text-sm text-muted">{pct.toFixed(1)}% of free tier</span>
			</div>
			<div className="w-full h-2.5 rounded-full bg-wash overflow-hidden">
				<div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
			</div>
			<div className="text-sm text-muted">
				{formatBytes(usedBytes)} used of ~{formatBytes(freeTierBytes)} free tier
				{extra ? ` · ${extra}` : ""}
			</div>
		</section>
	);
}

export default function UsagePage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	const [data, setData] = useState<UsageData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!isAdmin) return;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await fetch("/api/usage");
				if (!res.ok) {
					const json = await res.json().catch(() => ({}));
					setError(json.error || "Couldn't load usage data.");
					return;
				}
				setData(await res.json());
			} catch {
				setError("Couldn't load usage data. Check your connection and try again.");
			} finally {
				setLoading(false);
			}
		})();
	}, [isAdmin]);

	if (currentUser && !isAdmin) {
		return (
			<div className="max-w-2xl mx-auto">
				<EmptyState title="Admins only" hint="Usage figures aren't shown to this account." />
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto space-y-5">
			<PageHeader title="Usage" subtitle="Real numbers from the database and file storage — no estimates." />

			{error && <div className="alert alert-danger">{error}</div>}

			{loading ? (
				<div className="space-y-3">
					{[1, 2].map((i) => (
						<div key={i} className="card card-pad space-y-3">
							<div className="skeleton h-4 w-1/3" />
							<div className="skeleton h-2.5 w-full" />
							<div className="skeleton h-3 w-2/3" />
						</div>
					))}
				</div>
			) : data ? (
				<>
					<UsageCard
						title="Database storage (Neon)"
						usedBytes={data.database.usedBytes}
						freeTierBytes={data.database.freeTierBytes}
					/>
					<UsageCard
						title="File storage (Cloudflare R2)"
						usedBytes={data.files.usedBytes}
						freeTierBytes={data.files.freeTierBytes}
						extra={`${data.files.objectCount} file${data.files.objectCount === 1 ? "" : "s"}`}
					/>
					<p className="text-xs text-muted">
						Free-tier figures above are typical published limits, shown as a reference point — verify
						the exact limits on your specific plan in the Neon and Cloudflare dashboards.
					</p>

					<section className="card card-pad space-y-2">
						<h2 className="font-semibold">Vercel usage (bandwidth, builds, functions)</h2>
						<p className="text-sm text-muted">
							Not shown here — this app isn&apos;t connected to a Vercel API token, so these
							numbers can&apos;t be pulled in honestly. Check bandwidth, build minutes, and function
							invocations directly in the Vercel dashboard.
						</p>
					</section>
				</>
			) : null}
		</div>
	);
}
