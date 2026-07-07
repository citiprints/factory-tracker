"use client";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

// All NEXT_PUBLIC_* — safe to ship to the browser (standard Firebase web config).
const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function firebaseApp() {
	if (!firebaseConfig.apiKey) return null; // not configured yet
	return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Registers the service worker, requests notification permission, and
 * returns an FCM token — or null if push isn't configured/supported/granted.
 * Safe to call repeatedly; it's a no-op once already subscribed this session.
 */
export async function requestPushToken(): Promise<string | null> {
	try {
		if (typeof window === "undefined") return null;
		if (!("serviceWorker" in navigator) || !("Notification" in window)) return null;

		const app = firebaseApp();
		if (!app) return null; // Firebase env vars not set — feature stays dormant

		const supported = await isSupported().catch(() => false);
		if (!supported) return null;

		const permission = await Notification.requestPermission();
		if (permission !== "granted") return null;

		const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
		const messaging = getMessaging(app);
		const token = await getToken(messaging, {
			vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
			serviceWorkerRegistration: registration,
		});
		return token || null;
	} catch (err) {
		console.error("Push registration failed (non-fatal):", err);
		return null;
	}
}

/** Foreground message listener — shows an in-tab toast via callback while the app is open. */
export async function onForegroundPush(callback: (title: string, body: string, linkPath?: string) => void) {
	const app = firebaseApp();
	if (!app) return;
	const supported = await isSupported().catch(() => false);
	if (!supported) return;
	const messaging = getMessaging(app);
	onMessage(messaging, (payload) => {
		callback(
			payload.notification?.title || "Notification",
			payload.notification?.body || "",
			payload.data?.linkPath
		);
	});
}
