import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";

export async function GET(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	const { searchParams } = new URL(request.url);
	const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
	const offset = parseInt(searchParams.get("offset") || "0");
	const entityType = searchParams.get("entityType") || undefined;
	const actorId = searchParams.get("actorId") || undefined;

	const where = {
		...(entityType ? { entityType } : {}),
		...(actorId ? { actorId } : {}),
	};

	const [entries, total] = await Promise.all([
		prisma.activityLog.findMany({
			where,
			orderBy: { at: "desc" },
			take: limit,
			skip: offset,
			include: { actor: { select: { id: true, name: true } } },
		}),
		prisma.activityLog.count({ where }),
	]);

	return NextResponse.json({
		entries,
		pagination: { total, limit, offset, hasMore: offset + limit < total },
	});
}
