import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(request.url);
	const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

	const notifications = await prisma.notification.findMany({
		where: { userId: user.id },
		orderBy: { createdAt: "desc" },
		take: limit,
	});

	return NextResponse.json({ notifications });
}

// Mark notifications read. Body: { id: string } for one, or { all: true } for everything.
export async function PATCH(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const body = await request.json().catch(() => ({}));

	if (body.all) {
		await prisma.notification.updateMany({
			where: { userId: user.id, readAt: null },
			data: { readAt: new Date() },
		});
		return NextResponse.json({ ok: true });
	}

	if (body.id) {
		await prisma.notification.updateMany({
			where: { id: body.id, userId: user.id },
			data: { readAt: new Date() },
		});
		return NextResponse.json({ ok: true });
	}

	return NextResponse.json({ error: "Provide id or all" }, { status: 400 });
}
