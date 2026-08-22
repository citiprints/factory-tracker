"use client";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "../UserContext";
import { PageHeader, EmptyState } from "@/components/ui";

type PaymentStatus = "NOT_SET" | "UNPAID" | "PARTIAL" | "FULLY_PAID";

type TaskPaymentRow = {
	id: string;
	title: string;
	status: string;
	dueAt: string | null;
	customer: { id: string; name: string } | null;
	totalAmount: number | null;
	received: number;
	balance: number | null;
	paymentStatus: PaymentStatus;
	lastPaymentAt: string | null;
};

type Summary = { totalBilled: number; totalReceived: number; totalOutstanding: number };
type RevenuePeriod = { period: string; total: number; count: number };

const STATUS_LABELS: Record<PaymentStatus, string> = {
	NOT_SET: "Not set",
	UNPAID: "Unpaid",
	PARTIAL: "Partial",
	FULLY_PAID: "Fully paid",
};

const STATUS_CHIP_CLASS: Record<PaymentStatus, string> = {
	NOT_SET: "chip chip-plain",
	UNPAID: "chip chip-danger",
	PARTIAL: "chip chip-warn",
	FULLY_PAID: "chip chip-ok",
};

function formatCurrency(n: number): string {
	return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatPeriodLabel(period: string, groupBy: "month" | "year"): string {
	if (groupBy === "year") return period;
	const [year, month] = period.split("-").map(Number);
	return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function RevenueSection() {
	const [groupBy, setGroupBy] = useState<"month" | "year">("month");
	const [periods, setPeriods] = useState<RevenuePeriod[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLoading(true);
		setError(null);
		fetch(`/api/payments/revenue?groupBy=${groupBy}`)
			.then(async (r) => {
				if (!r.ok) {
					const json = await r.json().catch(() => ({}));
					setError(json.error || "Couldn't load revenue.");
					return;
				}
				const json = await r.json();
				setPeriods(json.periods ?? []);
			})
			.catch(() => setError("Couldn't load revenue. Check your connection and try again."))
			.finally(() => setLoading(false));
	}, [groupBy]);

	// Most recent 12 periods, newest last (bars read left-to-right chronologically).
	const shown = periods.slice(-12);
	const maxTotal = Math.max(1, ...shown.map(p => p.total));

	return (
		<section className="card card-pad space-y-3">
			<div className="flex items-center justify-between gap-2">
				<h2 className="font-semibold">Revenue over time</h2>
				<div className="flex gap-1">
					<button
						type="button"
						className={groupBy === "month" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
						onClick={() => setGroupBy("month")}
					>
						Monthly
					</button>
					<button
						type="button"
						className={groupBy === "year" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
						onClick={() => setGroupBy("year")}
					>
						Yearly
					</button>
				</div>
			</div>

			{error && <div className="alert alert-danger">{error}</div>}

			{loading ? (
				<div className="skeleton h-32 w-full" />
			) : shown.length === 0 ? (
				<EmptyState title="No payments recorded yet" hint="Revenue will show up here once payments come in." />
			) : (
				<div className="space-y-1.5">
					{shown.map(p => (
						<div key={p.period} className="flex items-center gap-3">
							<div className="w-16 shrink-0 text-xs text-muted text-right">{formatPeriodLabel(p.period, groupBy)}</div>
							<div className="flex-1 h-5 rounded bg-wash overflow-hidden">
								<div
									className="h-full rounded bg-[var(--accent)]"
									style={{ width: `${Math.max(2, (p.total / maxTotal) * 100)}%` }}
								/>
							</div>
							<div className="w-24 shrink-0 text-xs text-right">{formatCurrency(p.total)}</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}

export default function PaymentsPage() {
	const currentUser = useCurrentUser();
	const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "MANAGER";

	const [teams, setTeams] = useState<{ id: string; name: string; memberIds: string[] }[]>([]);
	const [teamsLoaded, setTeamsLoaded] = useState(false);
	const canSeePayments = isAdmin || (!!currentUser && !!teams.find(t => t.name === "Accounts")?.memberIds.includes(currentUser.id));

	const [tasks, setTasks] = useState<TaskPaymentRow[]>([]);
	const [summary, setSummary] = useState<Summary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState<PaymentStatus | "ALL">("ALL");
	const [search, setSearch] = useState("");
	const [includeArchived, setIncludeArchived] = useState(false);

	useEffect(() => {
		if (!currentUser) return;
		fetch("/api/teams")
			.then(r => r.ok ? r.json() : { teams: [] })
			.then(json => setTeams((json.teams ?? []).map((t: any) => ({ id: t.id, name: t.name, memberIds: (t.members ?? []).map((m: any) => m.userId) }))))
			.finally(() => setTeamsLoaded(true));
	}, [currentUser]);

	async function load() {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/payments${includeArchived ? "?includeArchived=true" : ""}`);
			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				setError(json.error || "Couldn't load payments.");
				return;
			}
			const json = await res.json();
			setTasks(json.tasks ?? []);
			setSummary(json.summary ?? null);
		} catch {
			setError("Couldn't load payments. Check your connection and try again.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		if (!teamsLoaded || !canSeePayments) return;
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [teamsLoaded, canSeePayments, includeArchived]);

	const filtered = useMemo(() => {
		return tasks.filter(t => {
			if (statusFilter !== "ALL" && t.paymentStatus !== statusFilter) return false;
			if (search.trim()) {
				const q = search.toLowerCase();
				if (!t.title.toLowerCase().includes(q) && !(t.customer?.name.toLowerCase().includes(q))) return false;
			}
			return true;
		});
	}, [tasks, statusFilter, search]);

	if (currentUser && teamsLoaded && !canSeePayments) {
		return (
			<div className="max-w-4xl mx-auto">
				<EmptyState title="Not available" hint="Payment data is shown only to admins and the Accounts team." />
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto space-y-5">
			<PageHeader title="Payments" subtitle="Payment status across every job." />

			{error && <div className="alert alert-danger">{error}</div>}

			{loading && !summary ? (
				<div className="space-y-3">
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
						{[1, 2, 3].map(i => (
							<div key={i} className="card card-pad space-y-2">
								<div className="skeleton h-3 w-1/2" />
								<div className="skeleton h-6 w-2/3" />
							</div>
						))}
					</div>
					{[1, 2, 3].map(i => (
						<div key={i} className="card p-4">
							<div className="skeleton h-4 w-1/3 mb-2" />
							<div className="skeleton h-3 w-2/3" />
						</div>
					))}
				</div>
			) : (
				<>
					{summary && (
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
							<div className="card card-pad">
								<div className="text-xs text-muted">Total billed</div>
								<div className="text-xl font-semibold">{formatCurrency(summary.totalBilled)}</div>
							</div>
							<div className="card card-pad">
								<div className="text-xs text-muted">Total received</div>
								<div className="text-xl font-semibold">{formatCurrency(summary.totalReceived)}</div>
							</div>
							<div className="card card-pad">
								<div className="text-xs text-muted">Total outstanding</div>
								<div className="text-xl font-semibold">{formatCurrency(summary.totalOutstanding)}</div>
							</div>
						</div>
					)}

					<RevenueSection />

					<div className="flex flex-wrap items-end gap-3">
						<div>
							<label className="field-label">Payment status</label>
							<select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | "ALL")}>
								<option value="ALL">All</option>
								{(Object.keys(STATUS_LABELS) as PaymentStatus[]).map(s => (
									<option key={s} value={s}>{STATUS_LABELS[s]}</option>
								))}
							</select>
						</div>
						<div className="flex-1 min-w-[180px]">
							<label className="field-label">Search</label>
							<input className="input" placeholder="Task or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
						</div>
						<label className="flex items-center gap-2 text-sm mb-2">
							<input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
							Include archived
						</label>
					</div>

					{filtered.length === 0 ? (
						<EmptyState title="No jobs match" hint="Try a different filter or search." />
					) : (
						<ul className="space-y-2">
							{filtered.map(t => (
								<li key={t.id} className="card p-4">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div className="min-w-0">
											<a href={`/tasks?open=${t.id}&showPayments=1`} className="font-medium hover:underline">{t.title}</a>
											<div className="meta mt-0.5">
												{t.customer?.name ?? "No customer"}
												{t.dueAt && ` · Due ${new Date(t.dueAt).toLocaleDateString()}`}
											</div>
										</div>
										<span className={STATUS_CHIP_CLASS[t.paymentStatus]}>{STATUS_LABELS[t.paymentStatus]}</span>
									</div>
									<div className="mt-2 flex flex-wrap gap-4 text-sm">
										<div>Total: <span className="font-medium">{t.totalAmount != null ? formatCurrency(t.totalAmount) : "—"}</span></div>
										<div>Received: <span className="font-medium">{formatCurrency(t.received)}</span></div>
										<div>Balance: <span className="font-medium">{t.balance != null ? formatCurrency(t.balance) : "—"}</span></div>
										{t.lastPaymentAt && <div className="text-muted">Last payment {new Date(t.lastPaymentAt).toLocaleDateString()}</div>}
									</div>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</div>
	);
}
