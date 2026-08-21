import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

const UpdateMaterialSchema = z.object({
	name: z.string().min(1).optional(),
	unit: z.string().min(1).optional(),
	reorderPoint: z.number().nonnegative().optional(),
	notes: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can edit materials." }, { status: 403 });

	try {
		const { id } = await params;
		const json = await request.json();
		const data = UpdateMaterialSchema.parse(json);
		const previous = await prisma.material.findUnique({ where: { id } });

		const material = await prisma.material.update({
			where: { id },
			data: {
				...("name" in data ? { name: data.name!.trim() } : {}),
				...("unit" in data ? { unit: data.unit!.trim() } : {}),
				...("reorderPoint" in data ? { reorderPoint: data.reorderPoint } : {}),
				...("notes" in data ? { notes: data.notes || null } : {}),
			},
		});

		await logActivity({
			entityType: "material",
			entityId: id,
			action: "UPDATED",
			actorId: user.id,
			before: previous ?? undefined,
			after: material,
		});

		return NextResponse.json({ material });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can delete materials." }, { status: 403 });

	const { id } = await params;
	const movementCount = await prisma.stockMovement.count({ where: { materialId: id } });
	if (movementCount > 0) {
		return NextResponse.json(
			{ error: "This material has stock movement history and can't be deleted. Edit it instead." },
			{ status: 409 }
		);
	}

	const material = await prisma.material.delete({ where: { id } });
	await logActivity({
		entityType: "material",
		entityId: id,
		action: "DELETED",
		actorId: user.id,
		before: { name: material.name },
	});

	return NextResponse.json({ ok: true });
}
