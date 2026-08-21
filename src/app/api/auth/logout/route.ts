import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit";

export async function GET() {
	// Handle accidental GET requests gracefully
	return NextResponse.json({ error: "Method not allowed. Use POST for logout." }, { status: 405 });
}

export async function POST() {
	const cookieStore = await cookies();
	const sessionId = cookieStore.get("auth_session")?.value;
	
	if (sessionId) {
		// Fetch the session before deleting it so there's a userId to log
		// against -- there's nothing left to look up once it's gone.
		const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { userId: true } }).catch(() => null);
		await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
		if (session) {
			await logActivity({ entityType: "auth", entityId: session.userId, action: "LOGOUT", actorId: session.userId });
		}
	}
	
	// Create response with expired cookie
	const response = NextResponse.json({ ok: true });
	
	// Clear the auth session cookie
	response.cookies.set("auth_session", "", {
		path: "/",
		expires: new Date(0), // Expire immediately
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax"
	});
	
	return response;
}
