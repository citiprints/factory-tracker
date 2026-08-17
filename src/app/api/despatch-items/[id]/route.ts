import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";
import { DESPATCH_ITEM_STATUSES } from "@/lib/constants";

const UpdateDespatchItemSchema = z.object({
	name: z.string().min(1).optional(),
	quantity: z.number().optional(),
	unit: z.string().min(1).optional(),
	status: z.enum(DESPATCH_ITEM_STATUSES).optional(),
	order: z.number().int().optional(),
	specFields: z.record(z.string(), z.any()).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	try {
		const json = await request.json();
		const data = UpdateDespatchItemSchema.parse(json);
		const { id } = await params;

		const despatchItem = await prisma.despatchItem.update({
			where: { id },
			data: {
				...("name" in data ? { name: data.name! } : {}),
				...("quantity" in data ? { quantity: data.quantity! } : {}),
				...("unit" in data ? { unit: data.unit! } : {}),
				...("status" in data ? { status: data.status as any } : {}),
				...("order" in data ? { order: data.order } : {}),
				...("specFields" in data ? { specFields: JSON.stringify(data.specFields ?? {}) } : {}),
			},
		});

		return NextResponse.json({ despatchItem });
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

	try {
		const { id } = await params;
		await prisma.despatchItem.delete({ where: { id } });
		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
