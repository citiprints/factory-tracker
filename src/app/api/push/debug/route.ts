import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { firebaseAdminApp } from "@/lib/firebase-admin";
import { getMessaging } from "firebase-admin/messaging";

// Temporary diagnostic route — safe to delete once push notifications are
// confirmed working. Reports config presence and an actual auth check
// against Google, without sending a real notification to anyone.
export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

	const envPresence = {
		FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
		FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
		FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
		FIREBASE_PRIVATE_KEY_LOOKS_VALID:
			!!process.env.FIREBASE_PRIVATE_KEY?.includes("BEGIN PRIVATE KEY"),
		FIREBASE_PROJECT_ID_VALUE: process.env.FIREBASE_PROJECT_ID || null, // not secret, safe to echo
	};

	const app = firebaseAdminApp();
	if (!app) {
		return NextResponse.json({
			configured: false,
			envPresence,
			note: "firebaseAdminApp() returned null — one of the three FIREBASE_* server vars is missing.",
		});
	}

	// Try an actual send to a garbage token. We expect Google to reject the
	// TOKEN (not the credentials) — that failure mode proves auth succeeded.
	// Any error about credentials/auth/project instead tells us the real problem.
	try {
		await getMessaging(app).send(
			{ token: "diagnostic-invalid-token-0000", notification: { title: "x", body: "x" } },
			true // dryRun — never actually delivered even if the token were real
		);
		return NextResponse.json({ configured: true, envPresence, authCheck: "unexpected success (dry run)" });
	} catch (err: any) {
		return NextResponse.json({
			configured: true,
			envPresence,
			authCheck: {
				code: err?.code || null,
				message: err?.message || String(err),
			},
		});
	}
}
