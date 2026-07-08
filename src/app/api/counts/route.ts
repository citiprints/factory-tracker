import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// "Pending" = anything still needing action: not done, not cancelled, not archived.
const OPEN_STATUSES = { notIn: ["DONE", "CANCELLED", "ARCHIVED"] };

export async function GET() {
	try {
		const user = await getCurrentUser();
		if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

		const [pendingTasks, pendingQuotes, unreadNotifications] = await Promise.all([
			prisma.task.count({
				where: {
					status: OPEN_STATUSES,
					OR: [
						{ customFields: null },
						{ customFields: { not: { contains: '"isQuotation":true' } } },
					],
				},
			}),
			prisma.task.count({
				where: {
					status: OPEN_STATUSES,
					customFields: { contains: '"isQuotation":true' },
				},
			}),
			prisma.notification.count({
				where: { userId: user.id, readAt: null },
			}),
		]);

		return NextResponse.json({ pendingTasks, pendingQuotes, unreadNotifications });
	} catch (error: any) {
		return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
	}
}
