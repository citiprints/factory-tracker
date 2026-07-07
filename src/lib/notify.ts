import { prisma } from "@/lib/db";
import { firebaseAdminApp } from "@/lib/firebase-admin";
import { getMessaging } from "firebase-admin/messaging";

type NotifyInput = {
  userId: string;
  title: string;
  body: string;
  type?: "TASK_ASSIGNED" | "SHIFT_ASSIGNED" | "TASK_DUE" | "GENERAL";
  linkPath?: string;
};

// Creates the in-app notification row, then fans out to push (best-effort —
// a missing/invalid FCM token never blocks the in-app notification).
export async function notifyUser({ userId, title, body, type = "GENERAL", linkPath }: NotifyInput) {
  const notification = await prisma.notification.create({
    data: { userId, title, body, type, linkPath },
  });

  await sendPushBestEffort(userId, title, body, linkPath).catch((err) => {
    console.error("Push notification failed (non-fatal):", err);
  });

  return notification;
}

async function sendPushBestEffort(userId: string, title: string, body: string, linkPath?: string) {
  const app = firebaseAdminApp();
  if (!app) return; // FCM not configured yet — no-op

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const tokens = subs.map((s: { fcmToken: string }) => s.fcmToken);
  const res = await getMessaging(app).sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: linkPath ? { linkPath } : undefined,
    webpush: {
      fcmOptions: linkPath ? { link: linkPath } : undefined,
      notification: { icon: "/icon-192.png" },
    },
  });

  // Tokens that are unregistered/invalid never recover — drop them so we
  // stop retrying against a device that's gone.
  const dead = res.responses
    .map((r, i) => (!r.success && isDeadTokenError(r.error?.code) ? tokens[i] : null))
    .filter((t): t is string => !!t);

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { fcmToken: { in: dead } } });
  }
}

function isDeadTokenError(code?: string) {
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
}
