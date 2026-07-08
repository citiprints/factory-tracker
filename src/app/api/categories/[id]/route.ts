import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { z } from "zod";

const UpdateCategorySchema = z.object({
	name: z.string().min(1).max(60).optional(),
	order: z.number().int().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can edit categories." }, { status: 403 });

	const { id } = await params;
	const parsed = UpdateCategorySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

	try {
		const category = await prisma.taskCategory.update({
			where: { id },
			data: parsed.data,
			include: { fields: { orderBy: { order: "asc" } } },
		});
		return NextResponse.json({ category });
	} catch (err: any) {
		if (err?.code === "P2002") {
			return NextResponse.json({ error: "A category with that name already exists." }, { status: 409 });
		}
		return NextResponse.json({ error: "Couldn't update the category." }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can delete categories." }, { status: 403 });

	const { id } = await params;
	// Existing tasks already saved under this category keep their stored
	// category name as plain text — deleting the definition only stops it
	// from being offered for new tasks going forward.
	await prisma.taskCategory.delete({ where: { id } });
	return NextResponse.json({ ok: true });
}
