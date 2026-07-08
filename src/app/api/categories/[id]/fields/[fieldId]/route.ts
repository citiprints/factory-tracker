import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { z } from "zod";

const UpdateFieldSchema = z.object({
	label: z.string().min(1).max(80).optional(),
	type: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN"]).optional(),
	required: z.boolean().optional(),
	order: z.number().int().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; fieldId: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can edit fields." }, { status: 403 });

	const { fieldId } = await params;
	const parsed = UpdateFieldSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

	const field = await prisma.taskCategoryField.update({ where: { id: fieldId }, data: parsed.data });
	return NextResponse.json({ field });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; fieldId: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can delete fields." }, { status: 403 });

	const { fieldId } = await params;
	await prisma.taskCategoryField.delete({ where: { id: fieldId } });
	return NextResponse.json({ ok: true });
}
