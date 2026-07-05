import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const ClockOutSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => ({}));
  const parsed = ClockOutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const openLog = await prisma.attendanceLog.findFirst({
    where: { userId: user.id, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });

  if (!openLog) {
    return NextResponse.json({ error: "No open clock-in found." }, { status: 409 });
  }

  const updated = await prisma.attendanceLog.update({
    where: { id: openLog.id },
    data: {
      clockOutAt: new Date(),
      clockOutLat: parsed.data.latitude,
      clockOutLng: parsed.data.longitude,
    },
  });

  return NextResponse.json({ log: updated });
}
