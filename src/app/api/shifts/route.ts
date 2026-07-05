import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { notifyUser } from "@/lib/notify";
import { z } from "zod";

const CreateShiftSchema = z.object({
  userId: z.string(),
  date: z.string(), // ISO date
  startTime: z.string(), // "09:00"
  endTime: z.string(), // "18:00"
  locationId: z.string().optional(),
  taskId: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const isAdminUser = isAdmin(user);
  const targetUserId = isAdminUser ? searchParams.get("userId") ?? undefined : user.id;

  const shifts = await prisma.shift.findMany({
    where: {
      ...(targetUserId ? { userId: targetUserId } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    orderBy: { date: "asc" },
    include: {
      user: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({ shifts });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await request.json().catch(() => null);
  const parsed = CreateShiftSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const shift = await prisma.shift.create({
    data: {
      userId: data.userId,
      assignedById: user!.id,
      date: new Date(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      locationId: data.locationId,
      taskId: data.taskId,
      notes: data.notes,
    },
    include: { user: { select: { name: true } }, location: { select: { name: true } } },
  });

  await notifyUser({
    userId: data.userId,
    title: "New shift scheduled",
    body: `${data.date} · ${data.startTime}–${data.endTime}${shift.location ? ` at ${shift.location.name}` : ""}`,
    type: "SHIFT_ASSIGNED",
    linkPath: "/schedule",
  });

  return NextResponse.json({ shift }, { status: 201 });
}
