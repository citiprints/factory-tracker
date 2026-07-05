import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { distanceMeters } from "@/lib/geo";
import { z } from "zod";

const ClockInSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  locationId: z.string().optional(), // if omitted, we auto-match nearest active location
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = ClockInSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { latitude, longitude, locationId } = parsed.data;

  // Block double clock-in: if there's an open log (no clockOutAt), reject.
  const openLog = await prisma.attendanceLog.findFirst({
    where: { userId: user.id, clockOutAt: null },
  });
  if (openLog) {
    return NextResponse.json(
      { error: "Already clocked in. Clock out first.", attendanceLogId: openLog.id },
      { status: 409 }
    );
  }

  const locations = await prisma.location.findMany({ where: { active: true } });

  let matchedLocation: (typeof locations)[number] | null = null;
  let withinGeofence = false;

  if (locationId) {
    matchedLocation = locations.find((l: (typeof locations)[number]) => l.id === locationId) ?? null;
  } else {
    // Auto-match: nearest active location, if within its radius.
    let best: { loc: (typeof locations)[number]; dist: number } | null = null;
    for (const loc of locations) {
      const dist = distanceMeters(latitude, longitude, loc.latitude, loc.longitude);
      if (!best || dist < best.dist) best = { loc, dist };
    }
    if (best) matchedLocation = best.loc;
  }

  if (matchedLocation) {
    const dist = distanceMeters(latitude, longitude, matchedLocation.latitude, matchedLocation.longitude);
    withinGeofence = dist <= matchedLocation.radiusM;
  }

  const log = await prisma.attendanceLog.create({
    data: {
      userId: user.id,
      locationId: matchedLocation?.id,
      clockInLat: latitude,
      clockInLng: longitude,
      withinGeofence,
      method: "APP",
    },
  });

  return NextResponse.json({ log, withinGeofence, location: matchedLocation?.name ?? null });
}
