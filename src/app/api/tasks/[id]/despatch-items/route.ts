import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";
import { DESPATCH_ITEM_STATUSES } from "@/lib/constants";

const CreateDespatchItemsSchema = z.object({
	items: z.array(
		z.object({
			name: z.string().min(1),
			quantity: z.number(),
			unit: z.string().min(1).optional(),
			status: z.enum(DESPATCH_ITEM_STATUSES).optional(),
			order: z.number().int().optional(),
			specFields: z.record(z.string(), z.any()).optional(),
			parentItemId: z.string().optional(),
		})
	).min(1),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { id } = await params;
	const despatchItems = await prisma.despatchItem.findMany({
		where: { taskId: id },
		orderBy: { order: "asc" },
	});
	return NextResponse.json({ despatchItems });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const json = await request.json();
		const data = CreateDespatchItemsSchema.parse(json);
		const { id } = await params;

		const despatchItems = await prisma.$transaction(
			data.items.map((item, index) =>
				prisma.despatchItem.create({
					data: {
						taskId: id,
						name: item.name,
						quantity: item.quantity,
						unit: item.unit ?? "pcs",
						status: (item.status as any) ?? "PENDING_CLIENT_APPROVAL",
						order: item.order ?? index,
						specFields: item.specFields ? JSON.stringify(item.specFields) : undefined,
						parentItemId: item.parentItemId,
					},
				})
			)
		);

		return NextResponse.json({ despatchItems }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.flatten() }, { status: 400 });
		}
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
