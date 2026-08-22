import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";
import { DESPATCH_ITEM_STATUSES } from "@/lib/constants";
import { maybeArchiveTask } from "@/lib/tasks";
import { logActivity } from "@/lib/audit";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { instantiateStages, collectComponentIdsDeep } from "@/lib/productionRouting";

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

		const previousStatus = "status" in data
			? (await prisma.despatchItem.findUnique({ where: { id }, select: { status: true } }))?.status
			: undefined;

		// Assembly gate: a top-level item with components can't be Packed or
		// Despatched until every one of its components is itself Despatched.
		// Components have no special pipeline of their own -- this only fires
		// going the other way, for the parent that depends on them.
		if (data.status === "PACKED" || data.status === "DESPATCHED") {
			const components = await prisma.despatchItem.findMany({
				where: { parentItemId: id },
				select: { name: true, status: true },
			});
			const pending = components.filter((c) => c.status !== "DESPATCHED");
			if (pending.length > 0) {
				return NextResponse.json(
					{ error: `All components must be Despatched first: ${pending.map((c) => c.name).join(", ")}` },
					{ status: 409 }
				);
			}
		}

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

		if ("status" in data) {
			await logActivity({
				entityType: "despatch_item",
				entityId: despatchItem.id,
				action: "STATUS_CHANGE",
				actorId: user.id,
				taskId: despatchItem.taskId,
				before: { status: previousStatus },
				after: { status: despatchItem.status },
			});
			await maybeArchiveTask(despatchItem.taskId);

			// Entering production for the first time: if this item's category
			// has exactly one named route, precompute its ItemStageProgress
			// rows automatically (zero extra clicks, same as before). If it has
			// several, leave progress empty -- the client shows a "Choose
			// route" picker instead, which calls POST .../choose-route. A
			// category with no template at all is untouched -- plain dropdown.
			if (despatchItem.status === "PRE_PRODUCTION") {
				const existingProgress = await prisma.itemStageProgress.count({ where: { despatchItemId: despatchItem.id } });
				if (existingProgress === 0) {
					let category: string | undefined;
					try {
						category = despatchItem.specFields ? JSON.parse(despatchItem.specFields).category : undefined;
					} catch {}
					if (category) {
						const templates = await prisma.categoryStageTemplate.findMany({ where: { category } });
						if (templates.length === 1) {
							const stages: string[] = JSON.parse(templates[0].stages);
							await instantiateStages(despatchItem.id, stages);
						}
					}
				}
			}

			if (despatchItem.status === "DESPATCHED") {
				const task = await prisma.task.findUnique({
					where: { id: despatchItem.taskId },
					include: { customerRef: { select: { name: true, phone: true } } },
				});
				if (task?.customerRef?.phone) {
					await sendWhatsAppMessage({
						to: task.customerRef.phone,
						templateName: "order_despatched",
						params: [task.customerRef.name ?? "there", task.title, despatchItem.name],
					}).catch(() => {});
				}
			}
		}

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
		// Components have no independent existence without their parent --
		// deleting a top-level item takes its whole component tree with it.
		// Same RESTRICT-FK reasoning as the task-deletion route -- an item
		// with any stage-routing progress can't be deleted until those rows
		// are cleared first, deepest descendants first so no row still
		// references an already-deleted parent.
		const componentIds = await collectComponentIdsDeep(id);
		const allIds = [...componentIds.reverse(), id];
		await prisma.itemStageProgress.deleteMany({ where: { despatchItemId: { in: allIds } } });
		for (const itemId of allIds) {
			await prisma.despatchItem.delete({ where: { id: itemId } });
		}
		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
	}
}
