import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

const CreateMaterialSchema = z.object({
	name: z.string().min(1),
	unit: z.string().min(1),
	reorderPoint: z.number().nonnegative().optional(),
	notes: z.string().optional(),
});

export async function GET() {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const materials = await prisma.material.findMany({ orderBy: { name: "asc" } });
	const withLowStock = materials.map((m) => ({ ...m, lowStock: m.currentStock <= m.reorderPoint }));

	return NextResponse.json({ materials: withLowStock });
}

export async function POST(request: Request) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isAdmin(user)) return NextResponse.json({ error: "Only admins/managers can add materials." }, { status: 403 });

	try {
		const json = await request.json();
		const data = CreateMaterialSchema.parse(json);

		const material = await prisma.material.create({
			data: {
				name: data.name.trim(),
				unit: data.unit.trim(),
				reorderPoint: data.reorderPoint ?? 0,
				notes: data.notes || null,
			},
		});

		await logActivity({
			entityType: "material",
			entityId: material.id,
			action: "CREATED",
			actorId: user.id,
			after: { name: material.name, unit: material.unit, reorderPoint: material.reorderPoint },
		});

		return NextResponse.json({ material }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
