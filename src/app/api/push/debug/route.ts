import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { firebaseAdminApp } from "@/lib/firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/db";

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

	// Every token currently on file for THIS user (across all their devices).
	const mySubs = await prisma.pushSubscription.findMany({
		where: { userId: user.id },
		orderBy: { createdAt: "desc" },
	});

	const app = firebaseAdminApp();
	if (!app) {
		return NextResponse.json({
			configured: false,
			envPresence,
			mySubscriptionCount: mySubs.length,
			note: "firebaseAdminApp() returned null — one of the three FIREBASE_* server vars is missing.",
		});
	}

	// Real per-token dry-run check: for each token on file, ask Google whether
	// it's a live, valid registration — without delivering anything.
	const messaging = getMessaging(app);
	const tokenChecks = await Promise.all(
		mySubs.map(async (sub) => {
			try {
				await messaging.send(
					{ token: sub.fcmToken, notification: { title: "diagnostic", body: "diagnostic" } },
					true // dryRun
				);
				return { device: sub.device, createdAt: sub.createdAt, tokenPrefix: sub.fcmToken.slice(0, 12), valid: true };
			} catch (err: any) {
				return {
					device: sub.device,
					createdAt: sub.createdAt,
					tokenPrefix: sub.fcmToken.slice(0, 12),
					valid: false,
					error: err?.code || err?.message || String(err),
				};
			}
		})
	);

	return NextResponse.json({
		configured: true,
		envPresence,
		mySubscriptionCount: mySubs.length,
		tokenChecks,
	});
}
