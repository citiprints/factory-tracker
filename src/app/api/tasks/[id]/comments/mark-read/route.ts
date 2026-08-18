import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	await prisma.notification.updateMany({
		where: { userId: user.id, taskId: id, type: "COMMENT", readAt: null },
		data: { readAt: new Date() },
	});

	return NextResponse.json({ ok: true });
}
