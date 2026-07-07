import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { z } from "zod";

const Body = z.object({
	fcmToken: z.string().min(10),
	device: z.enum(["android", "ios", "web"]).optional(),
});

export async function POST(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	// Upsert on the token itself: the same device re-registering (e.g. after
	// token rotation) just updates ownership rather than creating duplicates.
	await prisma.pushSubscription.upsert({
		where: { fcmToken: parsed.data.fcmToken },
		update: { userId: user.id, device: parsed.data.device },
		create: { userId: user.id, fcmToken: parsed.data.fcmToken, device: parsed.data.device },
	});

	return NextResponse.json({ ok: true });
}

// Lets the client clean up a token it knows is dead (e.g. permission revoked).
export async function DELETE(request: NextRequest) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { fcmToken } = await request.json().catch(() => ({ fcmToken: null }));
	if (!fcmToken) return NextResponse.json({ error: "Missing fcmToken" }, { status: 400 });

	await prisma.pushSubscription.deleteMany({ where: { fcmToken, userId: user.id } });
	return NextResponse.json({ ok: true });
}
