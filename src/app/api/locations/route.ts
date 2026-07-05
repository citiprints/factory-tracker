import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { z } from "zod";

const LocationSchema = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  radiusM: z.number().min(20).max(2000).default(150),
  address: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locations = await prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ locations });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = await request.json().catch(() => null);
  const parsed = LocationSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const location = await prisma.location.create({ data: parsed.data });
  return NextResponse.json({ location }, { status: 201 });
}
