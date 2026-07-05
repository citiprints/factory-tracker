import { prisma } from "@/lib/db";

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
  if (!process.env.FIREBASE_PROJECT_ID) return; // FCM not configured yet — no-op

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  // NOTE: wire up firebase-admin here once FIREBASE_* env vars are set.
  // Left as a stub so the rest of the notification flow works end-to-end
  // (in-app notifications + shift/task assignment) before push is configured.
  //
  // Example once ready:
  //   import { getMessaging } from "firebase-admin/messaging";
  //   await getMessaging().sendEachForMulticast({
  //     tokens: subs.map(s => s.fcmToken),
  //     notification: { title, body },
  //     data: linkPath ? { linkPath } : undefined,
  //   });
}
