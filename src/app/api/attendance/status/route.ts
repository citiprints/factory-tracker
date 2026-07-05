import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Returns the current user's open attendance log (if clocked in) plus
// a short recent history. Admins can pass ?userId= to check someone else.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const isAdmin = user.role === "ADMIN" || user.role === "MANAGER";
  const targetUserId = isAdmin ? searchParams.get("userId") ?? user.id : user.id;

  const openLog = await prisma.attendanceLog.findFirst({
    where: { userId: targetUserId, clockOutAt: null },
    include: { location: { select: { name: true } } },
  });

  const recent = await prisma.attendanceLog.findMany({
    where: { userId: targetUserId },
    orderBy: { clockInAt: "desc" },
    take: 10,
    include: { location: { select: { name: true } } },
  });

  return NextResponse.json({ clockedIn: !!openLog, openLog, recent });
}
