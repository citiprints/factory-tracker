import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { z } from "zod";

const UpdateShiftSchema = z.object({
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "MISSED", "CANCELLED"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const shift = await prisma.shift.findUnique({ where: { id } });
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Workers may only confirm their own shift; only admins can fully edit.
  const json = await request.json().catch(() => null);
  const parsed = UpdateShiftSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const isOwner = shift.userId === user.id;
  if (!isAdmin(user) && !(isOwner && Object.keys(parsed.data).every((k) => k === "status"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.shift.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ shift: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.shift.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
