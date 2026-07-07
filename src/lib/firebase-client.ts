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

export type PushTokenResult =
	| { token: string; reason?: undefined }
	| { token: null; reason: string };

/**
 * Registers the service worker, requests notification permission, and
 * returns an FCM token. On any failure, `reason` explains exactly where it
 * stopped — surfaced in the UI so failures are never silent again.
 */
export async function requestPushToken(): Promise<PushTokenResult> {
	if (typeof window === "undefined") return { token: null, reason: "Not running in a browser." };
	if (!("serviceWorker" in navigator)) return { token: null, reason: "This browser doesn't support background notifications." };
	if (!("Notification" in window)) return { token: null, reason: "This browser doesn't support notifications." };

	const app = firebaseApp();
	if (!app) return { token: null, reason: "Push isn't configured yet (missing Firebase settings)." };

	const supported = await isSupported().catch(() => false);
	if (!supported) return { token: null, reason: "This browser doesn't support Firebase push messaging." };

	let permission: NotificationPermission;
	try {
		permission = await Notification.requestPermission();
	} catch (err: any) {
		return { token: null, reason: `Permission request failed: ${err?.message || err}` };
	}
	if (permission !== "granted") {
		return { token: null, reason: permission === "denied" ? "Notifications blocked in browser settings." : "Permission dismissed." };
	}

	let registration: ServiceWorkerRegistration;
	try {
		registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
		await navigator.serviceWorker.ready;
	} catch (err: any) {
		return { token: null, reason: `Service worker registration failed: ${err?.message || err}` };
	}

	try {
		const messaging = getMessaging(app);
		const token = await getToken(messaging, {
			vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
			serviceWorkerRegistration: registration,
		});
		if (!token) return { token: null, reason: "Firebase returned no token." };
		return { token };
	} catch (err: any) {
		return { token: null, reason: `Couldn't get a push token: ${err?.message || err}` };
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
