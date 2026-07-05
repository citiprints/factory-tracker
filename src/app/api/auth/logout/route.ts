import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export async function GET() {
	// Handle accidental GET requests gracefully
	return NextResponse.json({ error: "Method not allowed. Use POST for logout." }, { status: 405 });
}

export async function POST() {
	const cookieStore = await cookies();
	const sessionId = cookieStore.get("auth_session")?.value;
	
	if (sessionId) {
		// Delete session from database
		await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
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
