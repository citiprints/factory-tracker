import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canAccessPayments } from "@/lib/payments";

// Revenue = money actually received (Payment rows), grouped by when it was
// received -- not by when the task was created, and not the same thing as
// "total billed" on the main /api/payments task list.
export async function GET(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!(await canAccessPayments(user))) {
		return NextResponse.json({ error: "Only admins and the Accounts team can view revenue." }, { status: 403 });
	}

	const groupBy = request.nextUrl.searchParams.get("groupBy") === "year" ? "year" : "month";

	const payments = await prisma.payment.findMany({
		select: { amount: true, receivedAt: true, mode: true },
		orderBy: { receivedAt: "asc" },
	});

	const buckets = new Map<string, { total: number; count: number }>();
	for (const p of payments) {
		const d = p.receivedAt;
		const key = groupBy === "year"
			? String(d.getFullYear())
			: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		const bucket = buckets.get(key) ?? { total: 0, count: 0 };
		bucket.total += p.amount;
		bucket.count += 1;
		buckets.set(key, bucket);
	}

	const periods = Array.from(buckets.entries())
		.map(([period, v]) => ({ period, total: v.total, count: v.count }))
		.sort((a, b) => a.period.localeCompare(b.period));

	return NextResponse.json({ groupBy, periods });
}
