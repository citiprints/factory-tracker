import { initializeApp, getApps, cert, App } from "firebase-admin/app";

let app: App | null = null;

/** Returns null (rather than throwing) when Firebase isn't configured yet,
 *  so the rest of the app keeps working without push notifications. */
export function firebaseAdminApp(): App | null {
	if (app) return app;
	if (getApps().length) {
		app = getApps()[0];
		return app;
	}

	const projectId = process.env.FIREBASE_PROJECT_ID;
	const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
	// Vercel env vars can't hold real newlines — the key is stored with
	// literal "\n" and must be unescaped before use.
	const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

	if (!projectId || !clientEmail || !privateKey) return null;

	app = initializeApp({
		credential: cert({ projectId, clientEmail, privateKey }),
	});
	return app;
}
