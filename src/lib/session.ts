import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("auth_session")?.value;
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
}

// Returns a SAFE user object (no password hash) or null.
// This is the ONLY place session/user resolution should happen.
// Call it server-side (layout, page, route handler) — never re-derive
// auth state on the client with a fetch + useEffect.
export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
}

// Use in API routes / server actions that require auth.
// Throws a plain object the caller can turn into a 401 response.
export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return user;
}

export function isAdmin(user: SafeUser | null): boolean {
  return !!user && (user.role === "ADMIN" || user.role === "MANAGER");
}
