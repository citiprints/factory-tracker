import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/session";

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only." }, { status: 403 });

	return NextResponse.json({
		email: !!process.env.SENDGRID_API_KEY && !!process.env.SENDGRID_FROM_EMAIL,
		push: !!process.env.FIREBASE_PROJECT_ID && !!process.env.FIREBASE_CLIENT_EMAIL && !!process.env.FIREBASE_PRIVATE_KEY,
		whatsapp: !!process.env.WHATSAPP_PHONE_NUMBER_ID && !!process.env.WHATSAPP_ACCESS_TOKEN,
	});
}
