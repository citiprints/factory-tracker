import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { logActivity } from "@/lib/audit";
import { maybeArchiveTask } from "@/lib/tasks";
import { advanceCurrentStage } from "@/lib/productionRouting";

// Completes an item's current stage. A stage with exactly one outgoing
// edge auto-advances immediately (indistinguishable from the old linear
// forward-only flow); a branch point (2+ outgoing edges) instead returns
// the options for the client to offer a choice via choose-branch.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;

	const completedStage = await prisma.itemStageProgress.findFirst({
		where: { despatchItemId: id, completedAt: null },
		orderBy: { order: "desc" },
	});
	if (!completedStage) {
		return NextResponse.json({ error: "All stages for this item are already complete." }, { status: 409 });
	}

	let result;
	try {
		result = await advanceCurrentStage(id);
	} catch (error: any) {
		return NextResponse.json({ error: error.message ?? "Internal Server Error" }, { status: 409 });
	}

	const despatchItem = await prisma.despatchItem.findUnique({ where: { id } });

	await logActivity({
		entityType: "despatch_item",
		entityId: id,
		action: "STAGE_ADVANCED",
		actorId: user.id,
		taskId: despatchItem?.taskId,
		after: { stageName: completedStage.stageName },
	});

	if (result.kind === "needsBranchChoice") {
		return NextResponse.json({ needsBranchChoice: true, options: result.options, stage: completedStage });
	}

	const isLastStage = result.isLastStage;
	let autoAdvanced = false;
	if (isLastStage && despatchItem && despatchItem.status !== "PACKED" && despatchItem.status !== "DESPATCHED") {
		// Same assembly gate as the PATCH route: a parent with incomplete
		// components finishes its own checklist here, but doesn't auto-advance
		// to Packed until they catch up. The UI offers a "Mark Packed" retry
		// once all stages are done, which re-runs this same check.
		const components = await prisma.despatchItem.findMany({
			where: { parentItemId: id },
			select: { status: true },
		});
		const blocked = components.some((c) => c.status !== "DESPATCHED");
		if (!blocked) {
			await prisma.despatchItem.update({ where: { id }, data: { status: "PACKED" } });
			await logActivity({
				entityType: "despatch_item",
				entityId: id,
				action: "STATUS_CHANGE",
				actorId: user.id,
				taskId: despatchItem.taskId,
				before: { status: despatchItem.status },
				after: { status: "PACKED" },
			});
			await maybeArchiveTask(despatchItem.taskId);
			autoAdvanced = true;
		}
	}

	return NextResponse.json({ stage: completedStage, isLastStage, autoAdvanced });
}
