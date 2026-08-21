import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { z } from "zod";

const REASONS = ["RECEIVED", "USED", "WASTED", "ADJUSTMENT"] as const;

const CreateMovementSchema = z.object({
	qty: z.number().positive(),
	reason: z.enum(REASONS),
	note: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const { searchParams } = new URL(request.url);
	const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
	const offset = parseInt(searchParams.get("offset") || "0");

	const [movements, total] = await Promise.all([
		prisma.stockMovement.findMany({
			where: { materialId: id },
			orderBy: { at: "desc" },
			take: limit,
			skip: offset,
			include: { actor: { select: { id: true, name: true } } },
		}),
		prisma.stockMovement.count({ where: { materialId: id } }),
	]);

	return NextResponse.json({ movements, pagination: { total, limit, offset, hasMore: offset + limit < total } });
}

// Floor staff need to be able to log usage, not just admins -- unlike the
// material's own create/edit/delete routes, this one only requires being
// signed in.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const { id } = await params;
		const json = await request.json();
		const data = CreateMovementSchema.parse(json);

		const material = await prisma.material.findUnique({ where: { id } });
		if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });

		// Sign derived server-side from the reason -- the client only ever
		// sends a positive quantity, so it can't accidentally send a negative
		// "received" or a positive "used".
		const delta = data.reason === "RECEIVED" || data.reason === "ADJUSTMENT" ? data.qty : -data.qty;
		const previousStock = material.currentStock;
		const nextStock = previousStock + delta;

		const [, movement] = await prisma.$transaction([
			prisma.material.update({ where: { id }, data: { currentStock: nextStock } }),
			prisma.stockMovement.create({
				data: { materialId: id, delta, reason: data.reason, note: data.note || null, actorId: user.id },
				include: { actor: { select: { id: true, name: true } } },
			}),
		]);

		await logActivity({
			entityType: "material",
			entityId: id,
			action: "STOCK_MOVEMENT",
			actorId: user.id,
			before: { currentStock: previousStock },
			after: { currentStock: nextStock, reason: data.reason, delta },
		});

		return NextResponse.json({ movement, currentStock: nextStock }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
